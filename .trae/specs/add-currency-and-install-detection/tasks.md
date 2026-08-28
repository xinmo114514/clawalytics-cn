# Tasks

- [x] Task 1: 实现货币切换功能
  - [x] SubTask 1.1: 创建 CurrencyProvider 上下文组件
  - [x] SubTask 1.2: 修改 format.ts 支持动态货币格式化
  - [x] SubTask 1.3: 扩展 DesktopPreferences 接口添加 currency 字段
  - [x] SubTask 1.4: 修改 desktop-service.ts 支持货币设置
  - [x] SubTask 1.5: 修改 desktop.ts 路由支持货币 API
  - [x] SubTask 1.6: 在 appearance-settings.tsx 添加货币选择 UI
  - [x] SubTask 1.7: 修改 electron/main.mjs 支持动态货币格式化
  - [x] SubTask 1.8: 更新所有使用 formatCurrency 的组件以支持货币切换

- [x] Task 2: 实现安装包智能识别功能
  - [x] SubTask 2.1: 修改 custom-nsis.nsh 添加安装类型检测逻辑
  - [x] SubTask 2.2: 添加更新/首次安装的界面提示
  - [x] SubTask 2.3: 测试安装包的安装和更新流程

# Task Dependencies
- Task 1 和 Task 2 相互独立，可并行执行
- SubTask 1.1-1.5 为基础工作，需先完成
- SubTask 1.6-1.8 依赖 SubTask 1.1-1.5
