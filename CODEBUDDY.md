# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 项目是什么

Clawalytics（`clawalytics`）是一个**本地优先的 AI 成本分析仪表盘**，读取 OpenClaw / Hermes 的会话与用量数据，统计花费、Token、模型占比、Agent、渠道与安全事件。只有两种运行形态，共用同一份前后端代码：

- Web（Express + Vite，开发时前后端分开跑）
- Windows 桌面端（Electron + electron-builder，托盘常驻 / 开机自启 / 原生通知）

技术栈：React 19 + TanStack Router(文件路由) + TanStack Query + Tailwind v4 + Recharts；Express 5 + better-sqlite3 + ws；tsx 直跑 TS。

没有 CLI、没有 MCP 服务、没有 postinstall 钩子 —— `bin/`、`src/server/mcp/` 已不存在，历史文档里的相关描述全部作废。

## 常用命令

包管理器是 **pnpm（经 corepack）**，脚本内部也硬编码了 `corepack pnpm`，不要改用 npm/yarn。CI 用 Node 22.12.0 + pnpm 10.32.0。

```bash
pnpm install              # 安装依赖
pnpm dev                  # 同时起 client(Vite) + server(tsx watch) —— 日常开发用这个
pnpm dev:client           # 只起前端 :5173，/api 代理到 :9174
pnpm dev:server           # 只起后端 :9174（带热重载）
pnpm dev:desktop          # 构建后以 Electron 方式运行
pnpm build                # build:client(tsc -b && vite build) + build:server(tsc -p tsconfig.server.json)
pnpm lint                 # eslint .
pnpm format:check         # prettier 检查（CI 门禁）；pnpm format 会全量重写文件，慎用
pnpm rebuild:native       # 修复 better-sqlite3 原生绑定（报 ERR_DLOPEN_FAILED 时先跑它）
pnpm build:desktop        # 产出 release/ 下的 setup.exe + portable.exe
```

## 测试

**没有单元测试框架**（无 vitest/jest）。测试全部是 `scripts/test-*.mjs` 回归脚本，通过 `pnpm test:*` 运行，各自在临时目录伪造数据/起真实服务并断言结果。改动核心逻辑时先加失败回归脚本再修复（TDD）。

| 脚本 | 覆盖 |
| --- | --- |
| `test:analytics` / `test:openclaw` / `test:hermes` | 数据管道与统计回归（含数据源配置） |
| `test:security-boundary` | 请求信任、origin/token 校验、WS 非法 upgrade 404、连接上限、stop 不悬挂 |
| `test:pairing-sync` | 配对文件快照对账、schema v5 迁移、文件乱序收敛、畸形输入 |
| `test:request-trust` / `test:desktop-security` | 回环绑定、渲染进程隔离、Electron 安全策略 |
| `test:server-binding` | 后端只绑 `127.0.0.1` |
| `test:desktop-notifications` / `test:costs-socket-teardown` / `test:input-safety` / `test:wsl-platform` | 桌面通知、ws 拆卸、输入安全、WSL 路径 |
| `test:desktop-e2e` | 打包后的 Electron 端到端（认证、隔离、主题、CSV 下载）；**必须先构建 directory build** |

桌面 E2E 本地跑法：`pnpm exec electron-builder --win dir --config.win.signAndEditExecutable=false`（或带 `CLAWALYTICS_DIRECTORY_BUILD=1` 的构建路径）之后再 `pnpm test:desktop-e2e`。CI 的 Windows job 就是这么做的。

关键点：

- `pnpm build` 里 `tsc -b` 会做**全量类型检查**（`noUnusedLocals`/`noUnusedParameters` 都是开的），`vite build` 不会。提交前必跑。
- 前端 dev 依赖后端在 :9174 运行（`vite.config.ts` 的 proxy），只跑 `dev:client` 时接口全 502。
- 生产模式下 Express 才 serve `dist/client`；dev 模式必须走 Vite（`src/server/index.ts` 的 SPA fallback）。
- CI（`.github/workflows/ci.yml`）分两个 job：Ubuntu 跑 format/lint/build + analytics/hermes/openclaw/security-boundary/request-trust/desktop-security/pairing-sync/input-safety + `pnpm audit --prod`；Windows 额外跑 desktop-notifications/server-binding/wsl-platform + unpacked directory build + 桌面 E2E。

## 目录地图

```
electron/                      Electron 主进程与工具模块
  main.mjs                       主进程：utilityProcess 子进程后端、托盘、自启、通知、自愈
  electron-child.ts (编译为 dist/server/electron-child.js)  后端子进程入口
  costs-socket-teardown.mjs      ws socket 安全拆卸（防退出崩溃）
  preload.cjs                    contextBridge → window.electronAPI（3 个通道白名单）
scripts/                       dev/构建/测试脚本（test-*.mjs 是全部回归测试）
src/client/                    前端
src/server/                    后端（Express + 采集引擎）
src/shared/                    前后端共享类型与 CSV 序列化
```

## 后端架构

**启动链路**（`src/server/index.ts`）：端口优先级 `start({port})` > `process.env.PORT` > **9174**。路由全部挂在 `/api/*`：`stats / sessions / costs / config / desktop / tokens / trends / agents / channels / devices / security / audit / tools / models / export`，外加 `GET /api/health`。`start()` 顺序：建配置目录 → 打开 DB → 读配置 → 初始化定价服务 → 初始化 AnalyticsService（传入 OpenClaw 路径）→ 可选启动安全监听 → `listen('127.0.0.1', port)` → 挂载 WebSocket（`/ws`，与 HTTP 同端口）。关闭走 `stop()` → `cleanupServerState()`，SIGINT/SIGTERM 同路径。

**最重要的一条：`AnalyticsService` 是内存态分析引擎，是几乎所有成本数据的真正来源。**
`src/server/services/analytics-service.ts` 在启动时把 OpenClaw 的 SQLite/JSONL 全量解析进内存 Map，`src/server/routes/*.ts` 里看到的 `getAnalyticsService().getXxx()` 都是从这些 Map 读。`src/server/db/queries.ts` 只剩 TS 接口定义，不要往里加查询实现。SQLite（`~/.clawalytics/clawalytics.db`，WAL）主要承载**安全/审计类**数据（`devices`/`pairing_requests`/`security_alerts`/`audit_log`/`connection_events`/`outbound_calls`）。

**数据库迁移**：`src/server/db/schema.ts` 里 `migrations` 数组按版本号顺序执行（当前到 **v5**），每条迁移在事务中且只跑一次（`schema_version` 表记录）。新库的基础建表语句已包含全部列；迁移必须幂等、不删用户数据。

**采集管道**（`src/server/parser/` + `parser/openclaw/`）：

- **双数据源**：优先读 OpenClaw 的 `agent/openclaw-agent.sqlite`，JSONL 兜底；Hermes 数据源经 `hermes-*` 系列模块接入，同一套统计出口。
- 成本计算 `parser/costs.ts` `calculateCost(provider, model, usage)`。若日志自带 `usage.cost.total` 则以它为权威值（美元按 `USD_TO_CNY_RATE` 换算），本地内置价目只作兜底。
- **增量缓存**：`~/.clawalytics/analytics-session-cache-v1.json`，按文件 `mtime`/`size` 判定新鲜度；启动时先用缓存渲染、再后台增量重解析（stale-while-refresh）。
- **文件监听**（chokidar 三处）：agent 的 `*.sqlite`(+`-wal`)、`agents/<id>/sessions` 目录、Gateway 日志。变更即 `broadcastCostsUpdated()`。
- **定价**：`services/pricing-service.ts`，磁盘缓存 `~/.clawalytics/pricing-cache.json`（24h TTL）+ 可选远端 endpoint 后台刷新，失败静默回落 `config/defaults.ts` 的内置价目表（单位 CNY/1M token）。匹配有前缀变体逻辑（按 key 长度降序），改这里要小心 `gpt-4o` 误匹配 `gpt-4` 的历史 bug。

**安全监听与配对同步**（`src/server/parser/security-watcher.ts` + `parser/openclaw/device-loader.ts`）：

- OpenClaw 的 `nodes/paired.json` / `pending.json` 是**权威状态**：任一文件变化都重新读取**两份**快照，双快照都合法（`ok`）时在一个事务里执行 `reconcileSecurityState()`（`db/queries-security.ts`）全量对账，返回真实状态变化集合。
- 审计与告警**只针对变化**发送；启动对账静默（不补发历史通知）；重复快照零写入。
- 快照 `missing`/`error`（文件缺失、JSON 损坏、条目字段非法）= 暂时不可用：保留数据库与内存状态，按 100/250/500/1000/2000ms 单队列重试；新文件事件重置重试；合法空数组 = 权威空状态（会移除/终结记录）。
- 文件乱序最终一致：`removed → resolved` 允许纠正；已 resolved 的历史请求不因设备移除降级。
- Gateway 日志解析（`gateway-parser.ts`）独立于配对同步，产生 connection_events / 审计 / 告警。

**配置**：`~/.clawalytics/config.yaml`（`src/server/config/loader.ts`）。含 USD→CNY 旧配置迁移逻辑（`looksLikeLegacyUsdRates`）。

**WebSocket**（`src/server/ws/index.ts`）：单频道全量广播，无房间概念。事件 6 种：`costs:updated`、`analytics:status`、`session:new`、`alert:new`、`device:changed`、`desktop:close-requested`。仅接受 `/ws` 的 upgrade（其余路径 404 + 关闭）；token/origin 校验、32 连接上限、64KB payload 限制都在 upgrade 阶段完成。

## 前端架构

**入口与路由**：`index.html` → `src/client/main.tsx`。TanStack Router 用**文件路由 + 插件代码生成**：`vite.config.ts` 的 `tanstackRouter` 插件在 dev/build 时自动生成 `src/client/routeTree.gen.ts`（**不要手改，也不要手建**）。新增页面 = 在 `src/client/routes/` 下加文件。

- `src/client/routes/_authenticated/route.tsx` 是 pathless layout → `components/layout/authenticated-layout.tsx`（它也负责调 `useWebSocket()`）。
- 路由文件要**保持极薄**（3-8 行，只做 `createFileRoute` + 引入 feature 组件），页面实现放 `src/client/features/<域>/`。懒加载靠 `autoCodeSplitting`，不要手写 `.lazy.tsx`。
- 侧边栏导航集中在 `components/layout/data/sidebar-data.ts`。

**数据请求**：`src/client/lib/api.ts` 是唯一的请求层（axios，`baseURL: '/api'`），同时**集中定义了所有 API 响应类型**。没有共享类型包、没有代码生成 —— 改后端响应结构必须同步改这里。注意命名混用：老接口是 snake_case（`session.total_cost`），Models API 是 camelCase。

**文件下载**：导出一律走 `src/client/lib/download.ts` 的 `downloadApiExport(url, fallbackFilename)`（同源 fetch + 临时 `<a download>`，文件名解析自 `Content-Disposition`）。**不要用 `window.open`** —— Electron 的 `setWindowOpenHandler` 会拒绝它。本地生成的 Blob 导出（Sessions/Security）保持 `<a download>` 方式。

queryClient 在 `main.tsx`（`staleTime: 10s`、401/403 不重试、500 在生产跳 `/500`）。各页面自设 `refetchInterval`（5s–30s），WS 事件经 `lib/ws.ts` 触发 `invalidateQueries`。

**状态**：一律 React Context：`context/` 下 theme / font / locale / currency / direction，嵌套顺序见 `main.tsx`。

**主题**：`context/theme-provider.tsx` 管两套独立状态 —— 明暗 `theme` + 配色 `colorTheme`（windows/blue/purple/green/orange/pink），都存 cookie。明暗主题直接切换 `documentElement` 的 `light`/`dark` class。CSS 变量全在 `styles/theme.css`（oklch），`@theme inline` 映射为 Tailwind token。图表颜色走 `hooks/use-chart-colors.ts`。

**i18n（重要，全仓约 700 处）**：**没有 i18next，也没有语言文件**。自建 `context/locale-provider.tsx`，组件里 `const { text } = useLocale()` 然后 `text('中文', 'English')`；非组件环境用 `translateStatic(zh, en)` / `getStoredLocale()`。**新增文案就是在组件内联写 `text('中','en')`**；侧边栏文案在 `sidebar-data.ts`（它接收 `text` 作为参数）。默认语言 `en`，三写持久化：localStorage + cookie + 后端 desktop preferences。

**UI 约定**：shadcn 组件在 `components/ui/`（被 eslint ignore，视为第三方代码基本不动）。Tailwind v4 是 **CSS-first**（无 `tailwind.config.js`，配置写在 `src/client/styles/index.css` 的 `@theme`/`@layer base`/`@utility`）。`@` 别名指向 `src/client`。字体全部本地化在 `public/fonts/*.woff2` + `styles/fonts.css` —— **不要重新引入任何外部 CDN/字体链接**，桌面端必须零外网依赖（VPN 环境下渲染阻塞外链会白屏）。

## 桌面端（Electron）

`electron/main.mjs` 以 **utilityProcess 子进程**方式启动后端：`startBackendChild()` fork `dist/server/electron-child.js`（`src/server/electron-child.ts`），随机空闲端口 + 每进程一次性 desktop token。备用路径 `startBackendInProcess()` 可同进程加载（env 开关）。子进程意外退出会自动重启（上限 3 次）并重载窗口。

- 主窗口 `loadDashboard()`：设置 **HttpOnly** cookie（`clawalytics_desktop_token`）后 `loadURL('http://127.0.0.1:<port>')`，带 3 次重试；`did-fail-load` 回落主题化加载页（永不白屏）；`render-process-gone` 有限重载；全局 `uncaughtException`/`unhandledRejection` 只记日志。
- `setWindowOpenHandler` 只放行外链白名单到 `shell.openExternal`，其余一律 deny（这就是导出必须用 `downloadApiExport` 的原因）。
- 双向桥：主进程通过 `setDesktopBridge({handleCloseChoice, syncPreferences})` 注入回调给后端；后端通过 WS 事件 `desktop:close-requested` 让渲染进程弹关闭确认，再由 `POST /api/desktop/window/close-choice` 回传。
- preload 白名单只有 3 个通道：`get-windows-accent-color`、`select-folder`、`windows-accent-color-changed`（`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`）。
- 关闭 ws socket 一律用 `electron/costs-socket-teardown.mjs` 的 `teardownSocket()`，防止 CONNECTING 状态拆卸触发主进程未捕获异常。

## 容易踩的坑

1. **`desktop-preferences.json` 有两份读写实现**：`src/server/services/desktop-service.ts` 和 `electron/main.mjs` 各自解析。加字段要**同步改两处**。
2. **`.prettierrc` 的 `importOrder` 管得很细**（含 `@/context/*`、`@/hooks/*`、`@/components/*`、`@/features/*` 等分组）。改完 import 要对单个文件手工对齐或跑 `pnpm format:check` 验证；**在多个会话并行工作时不要跑全量 `pnpm format`**（会覆盖别人的在途写入）。
3. **ESLint 规则**：`no-console` 是 error（仅 `src/server/**` 下放开）、强制 inline type import（`import { type Foo }`）、`react-refresh/only-export-components`（Context 文件顶部需要 `eslint-disable`，参考 `context/search-provider.tsx`）。
4. **货币**：后端统一按 CNY 存储与计算，前端 `lib/format.ts` 硬编码 `USD_TO_CNY_RATE = 7`。改动要前后端一起看（后端 `lib/currency.ts`）。
5. **调试 native 依赖**：`better-sqlite3` 报 `ERR_DLOPEN_FAILED` / `Could not locate the bindings file` 时跑 `pnpm rebuild:native`（`scripts/ensure-native-deps.mjs`），它会检测 NODE_MODULE_VERSION 并自动 rebuild。`dev:server`、`dev:desktop`、`build:desktop` 都已前置该脚本。
6. **Windows 构建**依赖 `scripts/run-electron-builder.mjs`（造 pnpm.cmd shim 注入 PATH 绕过 corepack 问题）与 `prepare-nsis-app-dir.cjs`（afterPack/afterSign，复制 `win-unpacked` → `win-unpacked-nsis` 并把 `Clawalytics.exe` 重命名为 `.payload` 配合自定义 NSIS 安装器）。改打包流程前先读这两个脚本。
7. **发布节奏**：`package.json` 的 `version` 决定产物名（`Clawalytics-${version}-win-x64-*`）；README 顶部版本/链接需同步更新；所有回归脚本 + 桌面 E2E 全绿之前不打 tag、不出安装包。

## 开发约定（来自 CONTRIBUTING.md）

- 加新功能**先开 issue 讨论**，否则 PR 不被接受。
- 提交前跑：`pnpm lint && pnpm format:check && pnpm build`。
- PR 用 `.github/PULL_REQUEST_TEMPLATE.md` 模板，且需通过 CI。
