# Clawalytics CN

> 面向 Claude Code 与 OpenClaw 的 AI 成本分析仪表盘。  
> 用一个本地面板看清你的花费、Token、模型使用、Agent 表现、渠道数据和安全状态。

Clawalytics 把原本分散在日志、会话记录和网关事件里的信息整理成一个更容易读懂的界面。你可以快速回答这些问题：

- 今天、本周、本月一共花了多少钱
- 哪个模型、哪个 Agent、哪个渠道最耗资源
- Prompt Cache 帮你省了多少成本
- 最近有哪些会话、设备、配对请求和安全告警
- 当前预算有没有接近阈值

## 中文用户友好版

为了方便中文用户使用，项目内置了汉化界面与双语文案支持。打开仪表盘后可以直接在界面里切换 `中文 / English`，日期、相对时间和部分展示文案也会跟随语言一起切换。

如果你希望把它部署给中文团队、中文运营或中文开发者使用，这一版会比纯英文工具更容易上手。

## 亮点

| 模块 | 你能看到什么 |
| --- | --- |
| 成本总览 | 生命周期、月、周、日花费，趋势图，缓存节省，模型占比 |
| 会话分析 | 每次会话的项目路径、模型、Token、成本、最近活跃时间 |
| 模型分析 | 不同模型和供应商的成本分布、调用次数、输入输出 Token |
| Agent 分析 | OpenClaw 多 Agent 的成本、趋势、请求量与表现对比 |
| 渠道分析 | WhatsApp、Telegram、Slack 等渠道的成本、消息数、单条消息成本 |
| 安全监控 | 设备列表、配对请求、安全告警、连接历史、审计日志 |
| 桌面体验 | Windows 桌面版、托盘驻留、原生通知、开机自启与启动方式选择 |

## Windows 桌面版

现在仓库已经提供可安装的 Windows 桌面版本，适合希望常驻后台、随时查看成本数据的用户。

- Release 页面: https://github.com/xinmo114514/clawalytics-cn/releases
- 当前安装包命名规则: `Clawalytics-<version>-win-x64-setup.exe`
- 安装完成后会出现在开始菜单和桌面快捷方式中

### 桌面版特性

- Win11 风格窗口壳和更现代的标题栏
- 支持开机自启，并可选择“启动后直接打开主窗口”或“静默启动到托盘”
- 关闭按钮支持弹出选择:
  - 最小化到托盘
  - 退出应用
  - 取消
- 支持记住关闭时的选择
- 托盘菜单可重新打开窗口，也可以重置为“下次关闭时再次询问”
- 托盘里的 `Quit` 会真正退出程序，不会继续驻留后台
- 当 OpenClaw 词元或成本更新时，会触发原生 Windows 通知

### 安装与使用说明

- `Clawalytics-<version>-win-x64-setup.exe`
  - 推荐普通用户使用
  - 安装后会自动创建开始菜单和桌面快捷方式
- `Clawalytics-<version>-win-x64-portable.exe`
  - 适合免安装、临时使用或放到 U 盘中运行
  - 不会走完整安装流程
- 第一次打开应用后，建议先在右上角设置里确认:
  - OpenClaw 数据目录
  - Gateway 日志目录
  - 是否开启开机自启
  - 开机后显示主窗口，还是直接驻留托盘
  - 点击关闭按钮时是询问、最小化到托盘，还是直接退出

## 快速开始

### 1. 安装 CLI 版本

```bash
npm install -g clawalytics

# 或
pnpm add -g clawalytics
```

安装完成后，Clawalytics 会尝试自动安装为系统后台服务：

- macOS: LaunchAgent
- Linux: `systemd --user`
- Windows: Task Scheduler

### 2. 启动并查看状态

```bash
clawalytics
```

默认仪表盘地址：

```text
http://localhost:9174
```

### 3. 常用命令

| 命令 | 说明 |
| --- | --- |
| `clawalytics` | 显示迷你状态面板，并告诉你仪表盘地址 |
| `clawalytics status` | 查看完整状态、成本统计、预算使用情况 |
| `clawalytics logs -f` | 跟踪服务日志 |
| `clawalytics config` | 打开配置文件 |
| `clawalytics path` | 查看配置、数据库、日志等路径 |
| `clawalytics budget` | 交互式设置预算阈值 |
| `clawalytics budget --daily 10 --weekly 50 --monthly 200` | 直接设置预算阈值 |
| `clawalytics start --port 3005` | 前台启动，适合开发或调试 |
| `clawalytics tunnel` | 查看远程访问仪表盘的 SSH 隧道说明 |
| `clawalytics install-service` | 手动安装后台服务 |
| `clawalytics uninstall-service` | 卸载后台服务 |
| `clawalytics mcp` | 启动 MCP 服务，供 AI 工具接入 |

## Web / CLI 开发方式

如果你更习惯源码运行，也可以继续按原来的方式开发：

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format:check
```

## 从源码构建 Windows 安装包

```bash
pnpm install
pnpm build:desktop
```

构建完成后，产物默认在：

```text
release/Clawalytics-<version>-win-x64-setup.exe
release/Clawalytics-<version>-win-x64-portable.exe
release/win-unpacked/Clawalytics.exe
```

## 典型使用场景

### 只使用 Claude Code

即使你没有接入 OpenClaw，Clawalytics 也可以单独工作，用来分析：

- Claude Code 日志中的成本与 Token
- 会话趋势与项目分布
- 模型使用占比
- Prompt Cache 带来的节省

### 配合 OpenClaw 使用

接入 OpenClaw 后，你还可以额外获得：

- 多 Agent 成本归因
- 渠道维度的成本和消息统计
- 设备配对与安全监控
- 审计日志与工具调用分析

## 功能概览

### 成本与 Token 分析

- 生命周期、月、周、日成本统计
- 30 天花费趋势
- 输入、输出、缓存创建、缓存读取 Token 拆分
- Prompt Cache 节省估算
- 按模型查看成本分布

### 会话历史

- 全量会话列表
- 按项目、日期、关键字筛选
- 每次会话的成本归因
- 最近活跃时间与持续时长

### Agent 与渠道洞察

- 多 Agent 成本对比
- 单 Agent 趋势图与详情页
- 渠道消息量与成本对比
- 单条消息成本估算

### 安全与审计

- 已配对设备列表
- 待处理配对请求
- 安全告警面板
- 连接事件历史
- 可筛选的审计日志
- 工具调用成功率与耗时统计

### 使用体验

- `中文 / English` 语言切换
- `Light / Dark / System` 主题切换
- 本地数据库，无需单独部署外部数据库
- Web、CLI 与 Windows 桌面端可以配合使用

## 配置与数据位置

Clawalytics 默认把配置和数据放在用户目录下：

- 配置文件：`~/.clawalytics/config.yaml`
- 数据库：`~/.clawalytics/clawalytics.db`
- 日志文件：`~/.clawalytics/clawalytics.log`

常见配置项包括：

- OpenClaw 数据路径
- Gateway 日志路径
- 安全告警开关
- 价格接口地址

一个常见配置示例：

```yaml
# Claude Code 日志目录，默认会自动检测
logPath: ~/.claude/projects

# OpenClaw 集成
openClawEnabled: true
openClawPath: ~/.openclaw

# 安全监控
securityAlertsEnabled: true
gatewayLogsPath: /tmp/openclaw

# 预算阈值
alertThresholds:
  dailyBudget: 10
  weeklyBudget: 50
  monthlyBudget: 200
```

## 支持的模型与供应商

Clawalytics 支持对多家 AI 供应商的调用成本进行分析，包含但不限于：

| 供应商 | 典型模型 |
| --- | --- |
| Anthropic | Claude Opus 4、Claude Sonnet 4、Claude Sonnet 3.5、Claude Haiku 3.5 |
| OpenAI | GPT-4o、GPT-4o-mini、GPT-5 |
| Google | Gemini 系列 |
| DeepSeek | DeepSeek Chat、DeepSeek Reasoner |
| Kimi | Kimi 系列 |

对支持缓存定价的模型，系统会自动把缓存相关成本纳入统计。

## 技术栈

- 前端：React 19、TanStack Router、TanStack Query、Tailwind CSS、Recharts
- 后端：Express 5、better-sqlite3、WebSocket
- 桌面端：Electron
- 构建：Vite、TypeScript、electron-builder

## 主题色与美观度提升

这一版对整体配色做了更系统的整理，不再只是“能换主题”，而是尽量让不同模块在视觉上看起来属于同一套产品语言。

- 仪表盘里的“每日成本”“最近 30 天花费趋势”等核心图表，已经和当前主题色联动，切换主题后主曲线、辅助曲线、网格线、坐标轴与提示色会一起变化。
- 统一收敛了原本分散的硬编码颜色，优先改为读取主题变量，减少某些卡片、图表、图标和状态色彼此风格割裂的问题。
- 每套主题不仅有主色，还补齐了图表色、成功色、警告色、信息色与边框层级，让浅色 / 深色模式下都更协调、更耐看。
- Windows 桌面版支持跟随系统 Accent Color，配合应用内的蓝色、紫色、绿色、橙色、粉色主题，可以更自然地融入不同用户的系统环境。
- 这次优化的目标不是单纯把颜色“做得更亮”，而是让数据可读性、层次感和整体观感同时提升，尤其是在长时间查看成本图表时更舒服。

## License

MIT
