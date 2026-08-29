# Clawalytics 性能优化方案（根治"未响应"）

## 根因诊断（已验证）

1. **架构层**：后端与 Electron 主窗口同进程（`electron/main.mjs:1333` 直接 `import(dist/server/index.js)`，`:1339` 在建窗口前 `await start()`）。后端任何同步重活（启动全量解析、文件变更全量重扫 SQLite）都会冻结主进程消息循环 → Windows 显示"未响应"。
2. **后端热点**：
   - `agent-database.ts:192-196` 每次变更全表扫描 `transcript_events` 并逐条 parse+计价，无 seq 增量断点；watcher（`:610-627`）任一 agent 变更都重扫**全部** agents，防抖仅 500ms。
   - `analytics-service.ts:1347` + `:1441` 每行 JSONL 解析两次。
   - `analytics-service.ts:1209-1211` `changed = true` 无条件置脏 → 广播风暴；前端 `ws.ts:87-96` 一次事件连发 8 个 invalidateQueries。
   - 死缓存：`_dailyCosts/_modelUsage`（`analytics-service.ts:249-262`）声明后从不读取，~15 个 getXxx 方法每次调用 O(全部 requests) 全量重扫。
   - 缓存落盘 `writeFileSync` 全量大 JSON（`:1060`），活跃期约 1s 一次；历史解析中每条 tool_result 同步 INSERT（`:1499`）。
   - 启动时全量解析同步执行，且 500ms 后 background refresh 把 SQLite **再读一遍**（`:327`）。
3. **前端**：9 个 Recharts 图表默认 1500ms 动画随每次轮询重播、数据 transform 无 useMemo；表格排序/聚合无 memo；ThemeProvider context 未 memo；图表 MutationObserver 无防抖；轮询无视口可见性；`ws.ts:107` 失效键与安全页实际键不匹配（`['alerts']` vs `['securityAlerts']`/`['recentConnections']`）。
4. **服务端/打包**：无 compression、静态资源无缓存头；`routes/config.ts` 每请求重读 config.yaml；`getRequests` 无 limit；asar 120MB（前端可选依赖 lucide-react 44M、date-fns 31M 等被打进包）+ sourcemap + 图片双份 + NSIS 准备脚本跑两遍。

用户已确认：**四个阶段全部执行**。

---

## 阶段 1 — 后端热点修复（最高收益，先做）

目标文件：`src/server/services/analytics-service.ts`、`src/server/parser/openclaw/agent-database.ts`、`src/server/parser/openclaw/session-parser.ts`

1. **SQLite 增量读取**（核心）：
   - 在 `AnalyticsService` 维护 `Map<dbPath+':'+sessionId, lastSeq>`；`loadAgentDatabaseSessions` 改为 `SELECT ... WHERE seq > ? ORDER BY seq`，只解析新增事件；新增事件 append 进已有 session 的 `requests`，而非重建。
   - 缓存落盘时一并持久化 lastSeq（`~/.clawalytics/analytics-session-cache-v1.json` 的 entry 增加字段），启动后直接从断点续读，消除"启动后二次全量读 SQLite"（`analytics-service.ts:327` 的重复读取自然消失）。
   - watcher 触发时只重扫**发生变更的那一个 agent**（`agent-database.ts:617-627` 用事件路径推断 agent id），而非全部。
2. **消除重复 JSON.parse**：`parseSessionFile` 中先 `JSON.parse` 一次，把对象同时传给 `parseOpenClawLine` 与 `processLineForTools`（改两者签名为接受已解析对象，调用点只有这两处+测试，全仓 grep 确认）。
3. **真实 diff**：删除 `analytics-service.ts:1209-1211` 的无条件置脏；`changed` 只在「新增/变更 session、新增 request、成本变化」时置 true。`broadcastCostsUpdated()` 只在真实变更后调用。
4. **激活死缓存**：在一次聚合遍历中同时填充 `_dailyCosts`、`_modelUsage`、`_statsCache`（挂在现有 `getStats`/`recompute` 路径），`markDirty()` 统一失效；`getDailyCosts/getModelUsage/getTokenBreakdown/getCostSummary/getModelStats/getProviderSummary/getAllChannelsDailyCosts` 全部走缓存，消除 O(R) 重复扫描。
5. **异步落盘**：`scheduleSessionCacheSave` 改 `fs.promises.writeFile(tmp)` + `rename` 原子替换；序列化结果与上次相同则跳过。
6. **批量写库**：`logOutboundCall` 在批量解析场景改为收集后单事务 `better-sqlite3.transaction` 批量 INSERT。
7. **watcher 防抖**：`BACKGROUND_SESSION_REFRESH_DELAY_MS` 500 → 2000（尾沿合并）；所有 watcher（含 `agent-loader.ts:173` config watcher）加 `awaitWriteFinish`；`handleSessionFile:668-683` 去掉重复的 readdir/statSync 轮次。
8. **让出粒度**：`loadAgentDatabaseSessions` 每个 session 后 yield；`parseSessionFile` 每 200 行 yield 一次（`setImmediate`）。
9. **杂项**：`costs.ts` `warnedModels` 等无界 Map 加容量上限；`ws/index.ts` 加心跳（30s ping/pong）+ `maxPayload`；`queries-security.ts` 的 prepare 改模块级复用；`pricing-service.ts:272-284` 兜底候选列表 memoize。

## 阶段 2 — Electron 架构迁移（根治窗口冻结）

目标文件：`electron/main.mjs`、新增 `src/server/electron-child.ts`（tsconfig.server 增加该入口）

1. **后端移入 utilityProcess**：
   - 新入口 `src/server/electron-child.ts`：`await start({ port })` 后 `process.parentPort.postMessage({ type: 'ready', port })`；监听 `parentPort.on('message')` 退出信号，调用 `stop()`。
   - `main.mjs` `startBackend()`（`:1319-1349`）：`utilityProcess.fork(dist/server/electron-child.js)`，等 ready 消息拿 port；`stopBackend()`（`:1351-1381`）改 `child.kill()` + 等待 `exit`。
   - **DesktopBridge 走 MessagePort**：`setDesktopBridge` 的两个回调（`desktop-service.ts:159-176`）在子进程内改为 `parentPort.postMessage({type:'handleCloseChoice'|'syncPreferences', ...})`；main.mjs 收到后转发给现有 `handleDesktopCloseChoice` / `syncDesktopPreferences`。
   - **窗口先行**：`createMainWindow` 中先 `new BrowserWindow()` + `loadURL` 前才需要 port——顺序改为：fork 子进程 → 立即创建窗口（显示骨架屏/loading）→ 拿到 port 后 `loadURL`。CLI/Web/MCP 形态不经过 electron/，不受影响。
2. **主进程去同步 I/O**：
   - `loadDesktopPreferences`（`:356-371`）改为启动读一次入内存 + 写穿；托盘菜单/通知路径全部读缓存。
   - 1000ms 轮询 `getAccentColor()`（`:131-149`）改用 `systemPreferences.on('accent-color-changed')`。
   - `syncLaunchOnStartupSettings` 只跑一次（删除 `:1531` 的 2 秒重跑，或改为仅在设置 diff 时执行）。

## 阶段 3 — 前端优化

1. **WS 节流**：`ws.ts` 按 event type 做 2s 尾沿防抖合并 invalidate；修复键错误：`['alerts']` → `['securityAlerts']`、`['recentConnections']`（`security-page.tsx:102,108` 的实际键）。
2. **可见性感知轮询**：新增 `src/client/lib/polling.ts` 导出 `pollWhenVisible(ms)`（TanStack `refetchInterval` 函数形式：`document.hidden ? false : ms`），替换各页面硬编码间隔（dashboard 6 处、sessions 4 处、security 5 处、models-tab 4 处等约 25 处）。
3. **`main.tsx:34`**：`refetchOnWindowFocus: false`（WS + 轮询已覆盖刷新），并为 stats 类 query 设 `staleTime`。
4. **图表**：9 个 `*-chart.tsx` 统一 `isAnimationActive={false}`；`daily-cost-chart.tsx:25-39` 等 data transform 包 `useMemo`。
5. **表格**：`agents-table.tsx:44-62` 排序、`sessions-table.tsx:144` reduce 包 `useMemo`；4 个表格行组件 `React.memo`。
6. **ThemeProvider**：`context-provider.tsx`（`theme-provider.tsx:172-182`）context value 包 `useMemo`；`app-sidebar.tsx:17` 的 `getSidebarData` 包 `useMemo`。
7. **use-chart-colors**：MutationObserver 回调加 rAF/100ms 防抖合并。
8. **vite.config.ts**：加 `manualChunks` 把 recharts/react-dom 拆 vendor（入口 423KB → 分片）。

## 阶段 4 — 服务端 HTTP 层 + 打包瘦身

1. `server/index.ts`：加 `compression()`；`express.static` 对 `/assets/*` 设 `maxAge: '30d', immutable`。
2. `routes/config.ts`：按 mtime 缓存 `loadConfig()` 结果。
3. `analytics-service.getRequests`（`:1660-1676`）加 `limit`（默认 200）+ 返回 total；`routes/sessions.ts:91-100` 透传。
4. **打包**（`package.json` build.files + `scripts/prepare-nsis-app-dir.cjs`）：
   - 前端专用依赖（lucide-react、date-fns、recharts、framer-motion、@radix-ui/*、zustand 等）从 `optionalDependencies` 移到 `devDependencies`（先 grep 确认 server/electron 无运行时 require）。
   - `files` 排除 `dist/server/**/*.map`、`*.d.ts.map`；`public/images` 去重；`prepare-nsis-app-dir.cjs` 只挂 `afterPack` 或 `afterSign` 其一。
   - 目标：asar 120MB → <10MB。

---

## 验证

1. `pnpm build` + `pnpm typecheck` + 现有测试全绿。
2. 手工场景（真实 `~/.openclaw` 数据）：
   - 冷启动：窗口出现时间（应 <2s，骨架屏后端加载）；启动期间拖动窗口不冻结。
   - 活跃写入：一个 agent 持续产生流量时，任务管理器无"未响应"，后端 CPU 稳态（增量读取生效后应接近空闲）。
   - Network 面板：静置时请求频率；WS 事件触发后 2s 内合并为一批请求。
3. 桌面集成回归：托盘菜单、通知、关闭选择弹窗、开机自启设置、系统强调色跟随。
4. 打包回归：`pnpm dist` 产物体积、安装后托盘/通知/自启可用。

## 风险与回退

- **增量 seq 语义**：需先确认 `transcript_events.seq` 是 per-session 递增（读 schema/写入方），checkpoint 按 `dbPath+sessionId` 粒度，容错：lastSeq 大于当前 max 时回退全量读该 session。
- **utilityProcess**：desktop bridge 与退出时序是主要回归点；保留 `startBackend` 旧实现于独立函数，可用环境变量 `CLAWALYTICS_IN_PROCESS=1` 一键回退（仅限紧急回退，不长期维护）。
- **前端依赖移出**：若 grep 发现运行时引用则该项单独搁置。
