# 🦞 Clawalytics

> Tame your OpenClaw token burn. Track AI spending in real-time.

Clawalytics is a local analytics dashboard for [OpenClaw](https://github.com/anthropics/claude-code) users. It watches your Claude Code log files and gives you real-time insights into your AI token spending across multiple providers.

## Features

- **Real-Time Cost Tracking** - Watch your spending update live
- **Multi-Provider Support** - Anthropic, OpenAI, Kimi, Google, DeepSeek
- **Session Analytics** - Break down costs by session, model, and time
- **Customizable Rates** - Configure your own provider rates
- **100% Local** - Your data never leaves your machine
- **Beautiful Dashboard** - Dark/light mode, charts, tables

## Installation

```bash
npm install -g clawalytics
```

## Usage

```bash
# Start the dashboard
clawalytics start

# Start on a custom port
clawalytics start --port 8080

# Show current stats
clawalytics status

# Open config file
clawalytics config

# Show data paths
clawalytics path
```

Then open http://localhost:3000 in your browser.

## How It Works

Clawalytics watches your OpenClaw/Claude Code log files (located at `~/.claude/projects/`) and parses the JSONL entries to calculate costs based on token usage and provider rates.

All data is stored locally in SQLite at `~/.clawalytics/clawalytics.db`.

## Configuration

Config is stored at `~/.clawalytics/config.yaml`. You can customize:

- Log file path
- Provider rates (per 1M tokens)
- Alert thresholds

## Supported Models

### Anthropic
- Claude Opus 4 ($15/$75 per 1M tokens)
- Claude Sonnet 4 ($3/$15 per 1M tokens)
- Claude Haiku ($0.25/$1.25 per 1M tokens)

### OpenAI
- GPT-4o ($2.50/$10 per 1M tokens)
- GPT-4o-mini ($0.15/$0.60 per 1M tokens)

### Others
- Kimi k2.5, Google Gemini, DeepSeek

## Requirements

- Node.js >= 18.0.0
- OpenClaw / Claude Code installed

## License

MIT
# clawalytics
# clawalytics
