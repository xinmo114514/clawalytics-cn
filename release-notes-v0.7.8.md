## Clawalytics v0.7.8

这一版专注于修复七个核心业务逻辑的潜在数据正确性问题，全部通过测试先行方式还原：每个修复点都先加入会失败的回归断言，再做最小改动，最后再跑全量测试矩阵。

### 修复

- **价格热刷新**：`refreshPricingCache` 现在必须接收调用方重新加载的费率表，自定义价格保存后立即生效；删除内置模型价格会自动恢复为默认值，删除纯自定义模型则保持无定价。`POST /api/config` 与 `/api/config/rates/:provider/:model` 三处都已同步修改。
- **上月键溢出**：`lastMonthStr` 改为基于"当月 1 日减 1 个月"构造，月末日期（Mar 31 / May 31 等）不再把当前月错算成上月，2 月等短月份会被正确归入上月成本。
- **Hermes 请求数低估**：`getModelDailyUsage`、`getAgentDailyCosts`、`getAllAgentsDailyCosts` 改为累加 `apiCallCount ?? 1`，显式 0 仍然保留为 0。一条代表 5 次调用的 Hermes 聚合记录现在会按 5 计入每日请求数。
- **来源隔离泄漏**：`getAgents` 在 `sourceType=hermes` 筛选下不再预填 OpenClaw agent；只有 `all` 与 `openclaw` 会看到 OpenClaw 预填充的 Agent 列表。
- **供应商识别重复**：网关解析器现在委托给 `costs.ts` 的 `identifyProvider`，删除重复的 `inferProvider`。MiniMax、MiMo、Moonshot k2p5、Mistral、Llama 等模型归类与价格键保持一致。
- **异常检测窗口**：模型异常检测改为基于每日模型数据，拆分两个互不重叠的 7 天窗口。真实成本尖峰（上周 1 CNY / 本周 100 CNY）现在 ratio = 99.99 能正确触发告警，不再被 2.0 上限压制。
- **Hermes 告警调度**：Hermes 成功刷新后会调用与 OpenClaw 相同的防抖预算与异常检查，且这两个检查始终在 `all` 数据源上下文下运行，不再被当前 UI 选中的来源干扰。
- **本地日历日期**：预算与异常检测的去重键统一使用本地日历日期，使用西半球时区的用户不再因为 UTC 偏移而把告警日期算成"明天"。

### 测试

新增回归断言覆盖：

- 价格保存即时生效与删除恢复默认（`test-data-source-config.mjs`）
- `lastMonthStr` 在 Mar 31 边界上的归月行为（`test-analytics-regressions.mjs`）
- Hermes 5 次调用的聚合记录在 model daily / agent daily / all-agents daily 中均按 5 计入；显式 0 仍为 0
- `getAgents` 在 Hermes-only 下不泄漏 OpenClaw agent（`test-hermes-data-pipeline.mjs`）
- `parseModelIdentifier` 对 MiniMax/MiMo/Moonshot k2p5/Mistral/Llama 等模型的供应商归类（`test-openclaw-data-pipeline.mjs`）
- 模型异常检测在 disjoint 7-day 窗口下的真实尖峰触发
- Hermes 刷新后预算告警实际写入 SQLite

每个测试都通过临时回退修复点确认会失败，再切回修复确认通过；不存在"假阳性"回归。

### 验证

- `pnpm test:analytics / test:openclaw / test:hermes / test:server-binding / test:desktop-notifications` 全部通过
- `pnpm lint` 仅有 14 条与本版无关的 Fast Refresh warning（修改前已存在）
- `pnpm build` 服务端与客户端编译均成功

### 兼容性

- 没有改动 HTTP 接口、请求或响应格式
- 没有改动配置文件 schema
- 没有引入新的运行时依赖

### 下载

- Windows x64 安装包：[Clawalytics-0.7.8-win-x64-setup.exe](https://github.com/xinmo114514/clawalytics-cn/releases/download/v0.7.8/Clawalytics-0.7.8-win-x64-setup.exe)
- Windows x64 Portable：[Clawalytics-0.7.8-win-x64-portable.exe](https://github.com/xinmo114514/clawalytics-cn/releases/download/v0.7.8/Clawalytics-0.7.8-win-x64-portable.exe)
- `clawalytics-0.7.8-source.zip`：仅源代码（约 794 KB）
- `clawalytics-0.7.8-built.zip`：源码 + dist/ 编译产物（约 1.6 MB），解压后 `pnpm start` 即可启动生产服务

完整变更日志见仓库 `CHANGELOG.md`。
