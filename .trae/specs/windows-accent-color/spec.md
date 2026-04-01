# Windows 主题色跟随 Spec

## Why
用户希望应用能够跟随 Windows 11 的系统主题色，自动适配与应用主题色，使应用更好地融入 Windows 系统，提供更一致的用户体验。

## What Changes
- 扩展 theme-provider 支持新的 "windows" 主题选项
- 添加从 Windows 注册表读取主题色的功能
- 在主题选择 UI 中添加 "跟随 Windows" 选项
- 暗色模式下同时跟随 Windows 的深色主题色

## Impact
- Affected specs: 需要修改现有的主题系统
- Affected code: 
  - `src/client/context/theme-provider.tsx`
  - `src/client/styles/theme.css`
  - `src/client/features/settings/components/appearance-settings.tsx`
  - `src/client/components/config-drawer.tsx`

## ADDED Requirements
### Requirement: Windows 主题色跟随
应用 SHALL 提供跟随 Windows 11 系统主题色的选项。

#### Scenario: 用户选择跟随 Windows
- **WHEN** 用户在主题设置中选择 "跟随 Windows"
- **THEN** 应用的主题色自动同步为 Windows 11 的主题色
- **AND** 当 Windows 主题色变化时，应用主题色自动更新

#### Scenario: 亮色/暗色模式下的 Windows 主题色
- **WHEN** 系统处于亮色模式
- **THEN** 应用使用 Windows 亮色主题色
- **AND** 当系统处于暗色模式时，应用使用 Windows 暗色主题色

## MODIFIED Requirements
### Requirement: Theme 类型扩展
原有 Theme 类型 `'dark' | 'light' | 'system'` 扩展为 `'dark' | 'light' | 'system' | 'windows'`

### Requirement: colorThemes 配置
- 默认值从 `'blue'` 改为 `'windows'`
- 当 colorTheme 为 `'windows'` 时，从 CSS 变量 `--primary` 动态读取 Windows 主题色

## REMOVED Requirements
无
