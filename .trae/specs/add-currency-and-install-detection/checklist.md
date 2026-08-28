# Checklist

## 货币切换功能
- [x] CurrencyProvider 上下文组件已创建并正确导出
- [x] formatCurrency 函数支持 USD 和 CNY 两种货币格式化
- [x] DesktopPreferences 接口已添加 currency 字段
- [x] desktop-service.ts 已支持货币设置的存取
- [x] desktop.ts 路由已支持货币 API
- [x] 外观设置页面已添加货币选择 UI
- [x] Electron 主进程已支持动态货币格式化
- [x] 所有使用 formatCurrency 的组件已更新支持货币切换
- [x] 货币设置能正确持久化和恢复

## 安装包智能识别功能
- [x] NSIS 脚本能正确检测是否已安装
- [x] 首次安装显示完整安装向导
- [x] 更新安装显示更新提示并使用原安装目录
- [x] 安装界面标题正确显示"安装"或"更新"
- [x] 安装和更新流程测试通过
