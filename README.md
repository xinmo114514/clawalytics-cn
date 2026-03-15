# Clawalytics

**Cost-tracking analytics dashboard for Claude Code and OpenClaw users.**

Track your AI spending, monitor agent performance, analyze channel usage, and maintain security oversight — all in one unified dashboard.

## 汉化说明

本仓库基于原项目进行汉化和本地化维护，主要目标是降低中文用户的使用门槛，让界面文案、配置流程和日常操作更符合中文语境与阅读习惯。

这里的改动并不是面向原项目提交的演示型 PR，而是作为一个可直接使用、可持续维护的中文版本来建设。除了基础翻译外，也会同步处理影响中文用户体验的细节问题，例如术语统一、默认语言切换、页面文案补全，以及后续版本更新时的汉化跟进。

如果你希望直接部署、体验或继续扩展一个更适合中文用户的 Clawalytics 版本，这个仓库就是为这个目的而准备的。

## Features

### Core Analytics

#### Dashboard Overview
- **Total cost tracking** — Lifetime, monthly, weekly, and daily spending
- **Token breakdown** — Input, output, cache creation, and cache read tokens
- **Cache savings calculator** — See how much you save with prompt caching (90% discount on cache reads)
- **Daily cost chart** — 30-day spending trends
- **Model usage distribution** — Pie chart breakdown by model (Claude Opus, Sonnet, Haiku, etc.)
- **Recent sessions** — Quick view of latest coding sessions

#### Session History
- **Full session list** — Paginated view of all coding sessions
- **Session details** — Project path, model used, tokens consumed, cost
- **Filtering & search** — Find sessions by project or date range
- **Cost per session** — Granular cost attribution

### OpenClaw Integration

#### Agent Analytics
- **Multi-agent tracking** — Monitor costs across all your OpenClaw agents
- **Per-agent cost breakdown** — See which agents consume the most resources
- **Agent detail view** — Deep dive into individual agent performance
- **Daily cost charts** — 30-day trends per agent
- **Token analysis** — Input/output token distribution by agent

#### Channel Analytics
- **Channel cost comparison** — Compare spending across WhatsApp, Telegram, Slack
- **Message volume tracking** — Monitor message counts per channel
- **Cost per message** — Understand the true cost of each conversation
- **Channel breakdown table** — Detailed metrics for each channel

### Security & Monitoring

#### Security Dashboard
- **Active devices** — Monitor all paired devices
- **Pending pairing requests** — Approve or deny new device connections
- **Security alerts** — Real-time alerts for suspicious activity
- **Connection history** — 24-hour connection event log

#### Device Management
- **Paired devices list** — View all authorized devices
- **Device status** — Active, inactive, or suspended states
- **Last seen tracking** — Know when devices were last active
- **Pairing request queue** — Manage incoming device requests

#### Audit Log
- **Complete audit trail** — Every action logged with timestamps
- **Filterable history** — Filter by action type, entity, actor, or date range
- **Export capability** — Download audit logs as CSV
- **Action tracking** — Create, update, delete, and system events

#### Tool Usage Analytics
- **Tool call tracking** — Monitor API and tool invocations
- **Success/error rates** — Track tool reliability
- **Duration metrics** — Average execution time per tool
- **Recent calls list** — View latest tool invocations

### Configuration

#### Settings
- **Log path configuration** — Set custom Claude Code log locations
- **OpenClaw integration** — Enable/disable OpenClaw features
- **Security alerts** — Toggle security monitoring
- **Gateway logs path** — Configure gateway log location

#### Appearance
- **Theme switching** — Light, dark, or system theme
- **Font preferences** — Customize dashboard typography

#### Notifications
- **Alert preferences** — Configure which alerts to receive
- **Email notifications** — Set up email alerts (coming soon)

## Installation

```bash
# Install globally
npm install -g clawalytics

# Or with pnpm
pnpm add -g clawalytics
```

## Usage

```bash
# Start the dashboard
clawalytics start

# Start on a custom port
clawalytics start --port 3005

# View current configuration
clawalytics config

# Set log path
clawalytics path /path/to/claude/logs

# Check status
clawalytics status
```

The dashboard will be available at `http://localhost:9174` by default.

## Configuration

Configuration is stored at `~/.clawalytics/config.yaml`:

```yaml
# Claude Code log path (auto-detected by default)
logPath: ~/.claude/projects

# OpenClaw integration
openClawEnabled: true
openClawPath: ~/.openclaw

# Security monitoring
securityAlertsEnabled: true
gatewayLogsPath: /tmp/openclaw
```

## Database

Clawalytics uses SQLite for data storage, located at `~/.clawalytics/clawalytics.db`.

### Tables

| Table | Purpose |
|-------|---------|
| `sessions` | Coding session records |
| `daily_costs` | Aggregated daily spending |
| `agents` | OpenClaw agent registry |
| `channels` | Messaging channel tracking |
| `agent_daily_costs` | Per-agent daily costs |
| `channel_daily_costs` | Per-channel daily costs |
| `devices` | Paired device records |
| `pairing_requests` | Device pairing queue |
| `connection_events` | Connection log |
| `outbound_calls` | Tool/API call tracking |
| `security_alerts` | Alert storage |
| `audit_log` | Complete audit trail |

## API Reference

### Core Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Basic statistics |
| `GET /api/stats/enhanced` | Full stats with cache savings |
| `GET /api/sessions` | Session list (paginated) |
| `GET /api/costs/summary` | Cost summary (lifetime/month/week/today) |
| `GET /api/costs/daily` | Daily cost data (30 days) |
| `GET /api/costs/by-model` | Per-model cost breakdown |
| `GET /api/costs/cache-savings` | Cache savings details |
| `GET /api/tokens/breakdown` | Token distribution |
| `GET /api/trends/weekly` | Week-over-week comparison |
| `GET /api/config` | Current configuration |
| `POST /api/config` | Update configuration |

### Agent Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/agents` | List all agents |
| `GET /api/agents/:id` | Agent details |
| `GET /api/agents/stats` | Agent statistics |

### Channel Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/channels` | List all channels |
| `GET /api/channels/:id` | Channel details |
| `GET /api/channels/stats` | Channel statistics |

### Security Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/devices` | List paired devices |
| `GET /api/devices/pending` | Pending pairing requests |
| `POST /api/devices/:id/approve` | Approve pairing request |
| `POST /api/devices/:id/deny` | Deny pairing request |
| `GET /api/security/dashboard` | Security overview |
| `GET /api/security/alerts` | Alert list |
| `POST /api/security/alerts/:id/acknowledge` | Acknowledge alert |
| `GET /api/security/connections` | Connection events |

### Audit Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/audit` | Audit log (filterable) |
| `GET /api/audit/stats` | Audit statistics |
| `GET /api/audit/recent` | Recent audit entries |
| `GET /api/audit/:id` | Single audit entry |

### Tool Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/tools` | Tool usage list |
| `GET /api/tools/stats` | Tool statistics |

## Supported Providers

Clawalytics supports cost tracking for multiple AI providers:

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Opus 4, Claude Sonnet 4, Claude Sonnet 3.5, Claude Haiku 3.5 |
| **OpenAI** | GPT-4o, GPT-4o-mini |
| **Google** | Gemini Pro, Gemini Flash |
| **DeepSeek** | DeepSeek Chat, DeepSeek Coder |
| **Kimi** | Kimi models |

Cache pricing is automatically applied for supported models (Anthropic).

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/clawalytics.git
cd clawalytics/clawalytics

# Install dependencies
pnpm install

# Start development servers (client + API)
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

### Project Structure

```
clawalytics/
├── src/
│   ├── client/              # React frontend
│   │   ├── components/      # Shared UI components
│   │   ├── features/        # Feature modules
│   │   │   ├── agents/      # Agent analytics
│   │   │   ├── channels/    # Channel analytics
│   │   │   ├── security/    # Security dashboard
│   │   │   └── tools/       # Tool analytics
│   │   ├── lib/             # Utilities & API client
│   │   └── routes/          # TanStack Router pages
│   └── server/              # Express backend
│       ├── config/          # Configuration management
│       ├── db/              # SQLite database & queries
│       ├── parser/          # Log file parsers
│       │   └── openclaw/    # OpenClaw-specific parsers
│       ├── routes/          # API route handlers
│       └── services/        # Business logic services
├── dist/                    # Production build output
└── bin/                     # CLI entry point
```

## Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind CSS, Recharts
- **Backend**: Express.js, better-sqlite3
- **Build**: Vite, TypeScript
- **File Watching**: chokidar

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

Built with :crab: for the Claude Code community
