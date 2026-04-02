# OpenClaw 数据导入故障排查步骤

## 1. 日志分析

### 步骤 1.1: 检查 Clawalytics 日志
- **操作**: 打开 Clawalytics 日志文件
  - Windows: `~/.clawalytics/clawalytics.log`
  - macOS/Linux: `~/.clawalytics/clawalytics.log`
- **预期结果**: 能够看到详细的日志信息，包括数据导入过程中的错误信息
- **常见错误**: 
  - "OpenClaw directory does not exist"
  - "Error parsing session file"
  - "Permission denied"

### 步骤 1.2: 检查 OpenClaw 日志
- **操作**: 打开 OpenClaw 日志文件
  - Windows: `~\AppData\Roaming\openclaw\logs`
  - macOS: `~/.openclaw/logs`
  - Linux: `~/.openclaw/logs`
- **预期结果**: 能够看到 OpenClaw 的运行状态和可能的错误信息

## 2. 连接配置检查

### 步骤 2.1: 验证 OpenClaw 路径配置
- **操作**: 在 Clawalytics 设置中检查 OpenClaw 路径配置
  - 打开 Clawalytics
  - 点击右上角设置图标
  - 进入 "OpenClaw 设置" 选项卡
  - 检查 "OpenClaw 目录路径" 是否正确
- **预期结果**: 路径应该指向 OpenClaw 的安装目录
- **常见错误**: 路径不存在、路径指向错误的目录

### 步骤 2.2: 验证路径存在性
- **操作**: 在文件系统中验证 OpenClaw 目录是否存在
  - Windows: 使用文件资源管理器导航到配置的路径
  - macOS/Linux: 使用终端执行 `ls -la <path>`
- **预期结果**: 目录应该存在且包含 OpenClaw 的相关文件和子目录

## 3. 数据格式验证

### 步骤 3.1: 检查 OpenClaw 数据结构
- **操作**: 检查 OpenClaw 目录结构
  - 预期结构:
    ```
    openclaw/
    ├── agents/
    │   └── <agent-id>/
    │       ├── sessions/
    │       │   └── <session-id>.jsonl
    │       └── sessions.json
    └── openclaw.json
    ```
- **预期结果**: 目录结构应该符合预期，包含必要的文件和子目录

### 步骤 3.2: 检查会话文件格式
- **操作**: 检查一个会话文件的内容
  - 使用文本编辑器打开一个 `.jsonl` 文件
  - 查看文件格式是否为有效的 JSON 行格式
- **预期结果**: 文件应该包含有效的 JSON 格式的行，每行代表一个消息或事件

## 4. 权限检查

### 步骤 4.1: 验证文件权限
- **操作**: 检查 OpenClaw 目录和文件的权限
  - Windows: 右键点击目录，选择 "属性" > "安全" 选项卡
  - macOS/Linux: 使用终端执行 `ls -la <path>`
- **预期结果**: 当前用户应该具有读取和执行权限

### 步骤 4.2: 测试文件访问
- **操作**: 尝试读取 OpenClaw 目录中的文件
  - Windows: 尝试打开一个会话文件
  - macOS/Linux: 使用终端执行 `cat <session-file>`
- **预期结果**: 能够成功读取文件内容

## 5. 网络连接测试

### 步骤 5.1: 检查本地连接
- **操作**: 确保 OpenClaw 正在运行
  - Windows: 检查任务管理器中是否有 OpenClaw 进程
  - macOS: 检查活动监视器中是否有 OpenClaw 进程
  - Linux: 使用 `ps aux | grep openclaw` 检查进程
- **预期结果**: OpenClaw 应该正在运行

## 6. 系统兼容性检查

### 步骤 6.1: 检查 Clawalytics 版本
- **操作**: 查看 Clawalytics 的版本信息
  - 打开 Clawalytics
  - 点击右上角设置图标
  - 查看版本信息
- **预期结果**: 版本应该是最新的，或者与 OpenClaw 兼容

### 步骤 6.2: 检查 OpenClaw 版本
- **操作**: 查看 OpenClaw 的版本信息
  - 打开 OpenClaw
  - 查看关于页面或配置文件中的版本信息
- **预期结果**: 版本应该与 Clawalytics 兼容

## 7. 故障排除流程

### 流程图
1. **开始** → 检查日志文件
2. → 验证 OpenClaw 路径配置
3. → 检查目录和文件权限
4. → 验证数据格式
5. → 检查 OpenClaw 运行状态
6. → **结束**

### 常见问题及解决方案

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|--------|
| "OpenClaw directory does not exist" | 路径配置错误或目录不存在 | 修正 OpenClaw 路径配置，确保目录存在 |
| "Error parsing session file" | 数据格式错误或文件损坏 | 检查会话文件格式，修复或删除损坏的文件 |
| "Permission denied" | 权限不足 | 确保当前用户具有访问 OpenClaw 目录的权限 |
| "Failed to reload OpenClaw data" | 服务启动失败 | 检查 OpenClaw 是否正在运行，重启 Clawalytics 服务 |

## 8. 高级故障排查

### 步骤 8.1: 启用详细日志
- **操作**: 修改 Clawalytics 配置，启用详细日志
  - 编辑 `~/.clawalytics/config.yaml` 文件
  - 添加或修改 `logLevel: debug`
- **预期结果**: 日志文件将包含更详细的信息

### 步骤 8.2: 手动测试数据导入
- **操作**: 使用命令行工具手动测试数据导入
  - 打开终端
  - 执行 `curl -X POST http://localhost:3000/api/config/openclaw/reload`
- **预期结果**: 应该返回成功信息或详细的错误信息