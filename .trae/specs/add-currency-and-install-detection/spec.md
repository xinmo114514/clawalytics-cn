# 货币切换与安装包智能识别 Spec

## Why
用户需要在不同场景下查看美金或人民币计价的成本数据，同时安装包应能智能识别是首次安装还是更新，提供更好的用户体验。

## What Changes
- 新增货币切换功能，支持美金（USD）和人民币（CNY）显示
- 新增安装包智能识别功能，自动检测更新或首次安装
- 在外观设置中添加货币选择项
- 修改 NSIS 安装脚本实现安装类型检测

## Impact
- Affected specs: 外观设置、桌面偏好设置、货币格式化
- Affected code:
  - `src/client/lib/format.ts` - 货币格式化函数
  - `src/client/context/locale-provider.tsx` - 可能需要新增货币上下文
  - `src/client/features/settings/components/appearance-settings.tsx` - 设置界面
  - `src/server/services/desktop-service.ts` - 桌面偏好服务
  - `src/server/routes/desktop.ts` - 桌面 API 路由
  - `electron/main.mjs` - Electron 主进程
  - `scripts/custom-nsis.nsh` - NSIS 安装脚本

## ADDED Requirements

### Requirement: 货币切换功能
系统应提供货币切换功能，允许用户在美金（USD）和人民币（CNY）之间切换显示。

#### Scenario: 用户切换货币显示
- **WHEN** 用户在设置页面选择货币类型
- **THEN** 系统应保存货币偏好设置，并立即更新所有货币显示

#### Scenario: 货币格式化显示
- **WHEN** 系统显示成本数据
- **THEN** 应根据当前货币设置显示正确的货币符号和数值
  - CNY: ¥ 符号，数值保持不变（系统内部以 CNY 存储）
  - USD: $ 符号，数值除以汇率（默认汇率 7）

#### Scenario: 货币设置持久化
- **WHEN** 用户关闭并重新打开应用
- **THEN** 系统应恢复用户上次选择的货币设置

### Requirement: 安装包智能识别
安装包应能自动识别用户是在更新还是首次安装，并提供相应的安装体验。

#### Scenario: 首次安装检测
- **WHEN** 安装程序运行时检测到系统中未安装 Clawalytics
- **THEN** 应显示完整的安装向导，包括安装目录选择等选项

#### Scenario: 更新安装检测
- **WHEN** 安装程序运行时检测到系统中已安装 Clawalytics
- **THEN** 应显示更新提示，使用之前的安装目录，跳过不必要的配置步骤

#### Scenario: 安装类型提示
- **WHEN** 安装程序检测到安装类型
- **THEN** 应在安装界面标题中显示"安装"或"更新"以区分安装类型

## MODIFIED Requirements

### Requirement: 桌面偏好设置
扩展桌面偏好设置接口，新增货币字段。

原有字段：
- locale: 语言设置
- closeAction: 关闭行为
- launchOnStartup: 开机启动
- startupMode: 启动模式
- notificationsEnabled: 通知开关
- notificationTrigger: 通知触发条件
- notificationDelaySeconds: 通知延迟

新增字段：
- currency: 货币类型（'CNY' | 'USD'）

### Requirement: 外观设置组件
在外观设置组件中新增货币选择项，与主题、语言、字体等设置并列显示。

## Technical Details

### 货币切换实现方案
1. **客户端**：
   - 创建 `CurrencyProvider` 上下文管理货币状态
   - 修改 `formatCurrency` 函数接受货币参数
   - 在 `appearance-settings.tsx` 添加货币选择 UI

2. **服务端**：
   - 扩展 `DesktopPreferences` 接口添加 `currency` 字段
   - 修改 `desktop-service.ts` 支持货币设置存取

3. **Electron 主进程**：
   - 修改 `electron/main.mjs` 中的货币格式化器支持动态货币
   - 同步货币设置到桌面偏好

### 安装包智能识别实现方案
修改 `scripts/custom-nsis.nsh`：
1. 使用 NSIS 的 `ReadRegStr` 检测注册表中的安装路径
2. 使用 `IfFileExists` 检测安装目录是否存在
3. 设置变量标识安装类型（首次/更新）
4. 根据安装类型调整安装向导页面显示
