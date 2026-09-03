## Clawalytics v0.7.9

### OpenClaw 2026.8.2 兼容

- 修复 OpenClaw 升级后看板不再接收新数据的问题。
- 支持新版 `agents/<agent>/agent/openclaw-agent.sqlite` 活跃会话数据库。
- WSL2 数据通过一致性快照读取，避免 Windows 直接读取 WAL 数据库失败。
- `sqlite3` 不可用时自动回退 Python SQLite 备份。
- 继续兼容旧版 JSONL 会话和旧版 SQLite 表结构。
- 避免 SQLite、旧 JSONL 与迁移归档重复统计。
- 忽略不可直接作为 JSONL 读取的 `.jsonl.deleted....zst` 压缩归档。
- 保留新版 OpenClaw 的 `reasoningTokens`。

### 稳定性

- WSL SQLite 快照失败时保留历史数据，并将数据源标记为错误/过期，避免静默显示陈旧数据。
- 增加 WSL 快照回退、清理、压缩归档和旧版兼容回归测试。
- 修复 Hermes 测试夹具的固定日期和失败清理问题。

### 验证

- OpenClaw 数据管线通过
- Hermes 数据管线通过
- 分析回归测试通过
- TypeScript 服务端与客户端构建通过
- Windows x64 安装包构建通过

### 下载

- Windows x64 安装包：`Clawalytics-0.7.9-win-x64-setup.exe`（145.7 MB）
- Windows x64 Portable：`Clawalytics-0.7.9-win-x64-portable.exe`（90.5 MB）
- 安装包 SHA-512：`PVutlu1ZE8cdm6pnOXwMwi5dUUOXvSiK3sI3A56ikPLl9OGpH7zIx3UzREk9bhgUvIUx/83Smf7rRdZo1gb6Fw==`
