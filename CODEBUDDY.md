# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 项目是什么

Clawalytics（`clawalytics`）是一个**本地优先的 AI 成本分析仪表盘**，读取 Claude Code / OpenClaw 的会话日志，统计花费、Token、模型占比、Agent、渠道与安全事件。它有四种运行形态，共用同一份前后端代码：

- CLI（`bin/clawalytics.js`，可全局安装并注册为系统后台服务）
- Web（Express + Vite）
- Windows 桌面端（Electron + electron-builder，托盘常驻 / 开机自启 / 原生通知）
- MCP stdio 服务（`bin/clawalytics-mcp.js`，供 AI 工具调用）

技术栈：React 19 + TanStack Router(文件路由) + TanStack Query + Tailwind v4 + Recharts；Express 5 + better-sqlite3 + ws；tsx 直跑 TS。

## 常用命令

包管理器是 **pnpm（经 corepack）**，脚本内部也硬编码了 `corepack pnpm`，不要改用 npm/yarn。Node >= 18（CI 用 20）。

```bash
pnpm install              # 安装；postinstall 会自动注册系统后台服务
pnpm dev                  # 同时起 client(Vite) + server(tsx watch) —— 日常开发用这个
pnpm dev:client           # 只起前端 :5173，/api 代理到 :9174
pnpm dev:server           # 只起后端 :9174（带热重载）
pnpm dev:desktop          # 构建后以 Electron 方式运行
pnpm build                # build:client(tsc -b && vite build) + build:server(tsc -p tsconfig.server.json)
pnpm start                # 生产模式启动（NODE_ENV=production，serve dist/client）
pnpm lint                 # eslint .
pnpm format / format:check
pnpm test:openclaw         # 唯一的自动化测试：OpenClaw 数据管道冒烟测试
pnpm rebuild:native        # 修复 better-sqlite3 原生绑定（报 ERR_DLOPEN_FAILED 时先跑它）
pnpm build:desktop         # 产出 release/ 下的 setup.exe + portable.exe
```

关键点：

- **没有单元测试框架**（无 vitest/jest）。`pnpm test:openclaw` 是单个脚本 `scripts/test-openclaw-data-pipeline.mjs`，在临时目录伪造 openclaw.json/JSONL/SQLite 并断言解析结果，通过 `pnpm test:openclaw` 整跑，无单用例筛选参数。要验证改动就跑它 + `pnpm build`。
- `pnpm build` 里 `tsc -b` 会做**全量类型检查**（`noUnusedLocals`/`noUnusedParameters` 都是开的），`vite build` 不会。提交前必跑。
- 前端 dev 依赖后端在 :9174 运行（`vite.config.ts:28-32` 的 proxy），只跑 `dev:client` 时接口全 502。
- 生产模式下 Express 才 serve `dist/client`；dev 模式必须走 Vite（`src/server/index.ts:72-74`、SPA fallback 在 `:99-110`）。
- CI（`.github/workflows/ci.yml`）只跑 `pnpm lint` → `pnpm format:check` → `pnpm build`。`pnpm knip` 已被注释掉，但 CONTRIBUTING 仍建议本地跑。

## 目录地图

```
bin/clawalytics.js            CLI 入口（commander，1061 行），自成一套 config.yaml 读写
bin/clawalytics-mcp.js        MCP 入口，仅 import ../dist/server/mcp/index.js
electron/main.mjs             Electron 主进程（同进程启动后端、托盘、开机自启、通知）
electron/preload.mjs          contextBridge → window.electronAPI（3 个通道）
scripts/                      dev/构建/安装相关脚本（见下）
src/client/                   前端
src/server/                   后端（Express + 采集引擎）
```

## 后端架构

**启动链路**（`src/server/index.ts`）：端口优先级 `start({port})` > `process.env.PORT` > **9174**（`:48`、`:121`）。路由全部挂在 `/api/*`：`stats / sessions / costs / config / desktop / tokens / trends / agents / channels / devices / security / audit / tools / models / export`，外加 `GET /api/health`。`start()` 顺序（`:225-286`）：建配置目录 → 打开 DB → 读配置 → 初始化定价服务 → 初始化 AnalyticsService（传入 OpenClaw 路径）→ 可选启动安全监听 → listen → 挂载 WebSocket（`/ws`，与 HTTP 同端口）。关闭走 `cleanupServerState()` + SIGINT/SIGTERM。

**最重要的一条：`AnalyticsService` 是内存态分析引擎，是几乎所有成本数据的真正来源。**
`src/server/services/analytics-service.ts`（2700+ 行）在启动时把 OpenClaw 的 SQLite/JSONL 全量解析进内存 Map，`src/server/routes/*.ts` 里看到的 `getAnalyticsService().getXxx()` 都是从这些 Map 读。`src/server/db/queries.ts` 文件头明确写着 "DB functions removed - use AnalyticsService" —— 它现在只剩 TS 接口定义，不要往里加查询实现。SQLite（`~/.clawalytics/clawalytics.db`，WAL）目前主要承载**安全/审计类**数据（`devices`/`pairing_requests`/`security_alerts`/`audit_log`/`connection_events`/`outbound_calls`）。

**采集管道**（`src/server/parser/` + `parser/openclaw/`）：

- 入口 `AnalyticsService.parseSessionFile()` → 逐行 `JSON.parse` → `parseOpenClawLine()`（`session-parser.ts:140`）。该函数同时兼容 OpenClaw 命名（`usage.input/output/cacheRead/cacheWrite`）和 Claude Code 命名（`usage.input_tokens/...`，`:162-179`）。
- **双数据源**：优先读 OpenClaw 的 `agent/openclaw-agent.sqlite`（`agent-database.ts`，表 `session_windows`/`session_nodes`/`transcript_events`），JSONL 兜底；`isCanonicalDatabaseSession()` 去重避免重复计费。
- 成本计算 `parser/costs.ts:36` `calculateCost(provider, model, usage)`。若日志自带 `usage.cost.total` 则以它为权威值（美元按 `USD_TO_CNY_RATE` 换算），本地内置价目只作兜底。
- **增量缓存**：`~/.clawalytics/analytics-session-cache-v1.json`，按文件 `mtime`/`size` 判定新鲜度；启动时先用缓存渲染、再后台增量重解析（stale-while-refresh），后台刷新 500ms 防抖且每 10 个文件 `setImmediate` 让出事件循环。
- **文件监听**（chokidar 三处）：agent 的 `*.sqlite`(+`-wal`)、`agents/<id>/sessions` 目录（`depth:0`、`awaitWriteFinish`、WSL 下自动切 polling）、Gateway 日志 `/tmp/openclaw/openclaw-*.log`（用读偏移做增量）。变更即 `broadcastCostsUpdated()`。
- **定价**：`services/pricing-service.ts`，磁盘缓存 `~/.clawalytics/pricing-cache.json`（24h TTL）+ 可选远端 endpoint 后台刷新，失败静默回落 `config/defaults.ts` 的内置价目表（单位 CNY/1M token）。匹配有前缀变体逻辑（按 key 长度降序），改这里要小心 `gpt-4o` 误匹配 `gpt-4` 的历史 bug。

**配置**：`~/.clawalytics/config.yaml`（`src/server/config/loader.ts`）。含 USD→CNY 旧配置迁移逻辑（`:309` `looksLikeLegacyUsdRates`）。

**WebSocket**（`src/server/ws/index.ts`）：单频道全量广播，无房间概念。事件仅 5 种：`costs:updated`、`session:new`、`alert:new`、`device:changed`、`desktop:close-requested`。

**MCP**：`src/server/mcp/tools.ts` 定义 10 个工具（spending summary / cost breakdown / daily costs / model comparison / budget status / security alerts / agent stats / session stats / tool usage / cache efficiency），`mcp/index.ts` 把 JSON Schema 转 zod 后注册。`bin/clawalytics-mcp.js` 依赖 `dist/` 已构建。

## 前端架构

**入口与路由**：`index.html` → `src/client/main.tsx`。TanStack Router 用**文件路由 + 插件代码生成**：`vite.config.ts:10-15` 的 `tanstackRouter` 插件在 dev/build 时自动生成 `src/client/routeTree.gen.ts`（**不要手改，也不要手建**）。没有单独的 gen 脚本，新增页面 = 在 `src/client/routes/` 下加文件。

- `src/client/routes/_authenticated/route.tsx` 是 pathless layout → `components/layout/authenticated-layout.tsx`（它也负责调 `useWebSocket()`）。
- 路由文件要**保持极薄**（3-8 行，只做 `createFileRoute` + 引入 feature 组件），页面实现放 `src/client/features/<域>/`。懒加载靠 `autoCodeSplitting`，不要手写 `.lazy.tsx`。
- 侧边栏导航集中在 `components/layout/data/sidebar-data.ts`。

**数据请求**：`src/client/lib/api.ts` 是唯一的请求层（axios，`baseURL: '/api'`），同时**集中定义了所有 API 响应类型**（`Stats`/`Session`/`Agent`/`Config`/`SecurityAlert`/`DesktopPreferences` 等）。没有共享类型包、没有代码生成 —— 改后端响应结构必须同步改这里。注意命名混用：老接口是 snake_case（`session.total_cost`），Models API 是 camelCase。

queryClient 在 `main.tsx:22-66`（`staleTime: 10s`、401/403 不重试、500 在生产跳 `/500`）。各页面自设 `refetchInterval`（5s–30s），WS 事件经 `lib/ws.ts` 触发 `invalidateQueries`。

**状态**：**没有用 zustand**（它在 optionalDependencies 里但零引用）。一律 React Context：`context/` 下 theme / font / locale / currency / direction，嵌套顺序见 `main.tsx:87-103`。

**主题**：`context/theme-provider.tsx` 管两套独立状态 —— 明暗 `theme` + 配色 `colorTheme`（windows/blue/purple/green/orange/pink），都存 cookie。CSS 变量全在 `styles/theme.css`（442 行，oklch），`@theme inline` 映射为 Tailwind token。`color-windows` 会把主色指向 `--windows-accent`，该变量由 `theme-provider.tsx` 通过 `window.electronAPI` 读取并订阅系统色变化。图表颜色走 `hooks/use-chart-colors.ts`（读 `--chart-1..5`，用 MutationObserver 跟随主题变化）。

**i18n（重要，全仓约 700 处）**：**没有 i18next，也没有语言文件**。自建 `context/locale-provider.tsx`，组件里 `const { text } = useLocale()` 然后 `text('中文', 'English')`；非组件环境用 `translateStatic(zh, en)` / `getStoredLocale()`。**新增文案就是在组件内联写 `text('中','en')`**；侧边栏文案在 `sidebar-data.ts`（它接收 `text` 作为参数）。语言会三写持久化：localStorage + cookie + 后端 desktop preferences。

**UI 约定**：shadcn 组件在 `components/ui/`（33 个，被 eslint 与 knip ignore，视为第三方代码基本不动）。Tailwind v4 是 **CSS-first**（无 `tailwind.config.js`，配置写在 `src/client/styles/index.css` 的 `@theme`/`@layer base`/`@utility`）。`@` 别名指向 `src/client`。图表每处一个独立 `*-chart.tsx` 组件（**没有** `components/ui/chart.tsx` 封装），共用 `use-chart-colors` + `useCurrency`。

## 桌面端（Electron）

`electron/main.mjs` **同进程**加载后端，不是 spawn 子进程：`startBackend()`（`:1319`）设 `NODE_ENV=production`、`ELECTRON=true`、随机空闲端口，然后 `await import('dist/server/index.js')` 调 `start({port})`，窗口再 `loadURL('http://127.0.0.1:<port>')`。这意味着**后端改动对桌面端同样生效，且后端可以直接调用 Electron 能力**。

双向桥：主进程通过 `setDesktopBridge({handleCloseChoice, syncPreferences})` 注入回调给后端；后端通过 WS 事件 `desktop:close-requested` 让渲染进程弹关闭确认，再由 `POST /api/desktop/window/close-choice` 回传。

preload 只暴露 3 个通道：`get-windows-accent-color`、`select-folder`、`windows-accent-color-changed`（`contextIsolation: true`、`nodeIntegration: false`）。

## 容易踩的坑

1. **配置读写有两份实现**：`src/server/config/loader.ts` 和 `bin/clawalytics.js` 各自解析 `config.yaml`；`desktop-preferences.json` 在 `services/desktop-service.ts` 和 `electron/main.mjs` 各有一份。加字段要**同步改两处**。
2. **`components.json` 已过时**：它把 `tailwind.css` 指向 `src/styles/index.css`（实际是 `src/client/styles/index.css`）。用 shadcn CLI 新增组件会写错位置，建议直接手抄现有 `components/ui/` 里的组件。
3. **`.prettierrc` 的 `importOrder` 管得很细**（含 `@/context/*`、`@/hooks/*`、`@/components/*`、`@/features/*` 等分组）。改完 import 一定要 `pnpm format`，否则 CI 的 `format:check` 会红。
4. **ESLint 规则**：`no-console` 是 error（仅 `src/server/**` 下放开）、强制 inline type import（`import { type Foo }`）、`react-refresh/only-export-components`（Context 文件顶部需要 `eslint-disable`，参考 `context/search-provider.tsx:37`）。
5. **没有 Claude Code 原生解析器**。虽然 `sessions.source_type` 默认值是 `'claude-code'`，但数据源只有 OpenClaw。要支持 `~/.claude/projects/**/*.jsonl` 需要在 `src/server/parser/` 新增解析器并接入 `AnalyticsService.initialize()` 的 watcher 列表。
6. **货币**：后端统一按 CNY 存储与计算，前端 `lib/format.ts:3` 硬编码 `USD_TO_CNY_RATE = 7`。改动要前后端一起看（后端 `lib/currency.ts`）。
7. **调试 native 依赖**：`better-sqlite3` 报 `ERR_DLOPEN_FAILED` / `Could not locate the bindings file` 时跑 `pnpm rebuild:native`（`scripts/ensure-native-deps.mjs`），它会检测 NODE_MODULE_VERSION 并自动 rebuild。`dev:server`、`start`、`build:desktop` 都已前置该脚本。
8. **Windows 构建**依赖 `scripts/run-electron-builder.mjs`（造 pnpm.cmd shim 注入 PATH 绕过 corepack 问题）与 `prepare-nsis-app-dir.cjs`（afterPack/afterSign，复制 `win-unpacked` → `win-unpacked-nsis` 并把 `Clawalytics.exe` 重命名为 `.payload` 配合自定义 NSIS 安装器）。改打包流程前先读这两个脚本。

## 开发约定（来自 CONTRIBUTING.md）

- 加新功能**先开 issue 讨论**，否则 PR 不被接受。
- 提交前跑：`pnpm lint && pnpm format && pnpm build`。
- PR 用 `.github/PULL_REQUEST_TEMPLATE.md` 模板，且需通过 CI。
