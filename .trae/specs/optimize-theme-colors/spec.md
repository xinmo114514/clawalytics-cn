# 主题色功能迭代优化 Spec

## Why
当前主题色系统存在浓度过高、配色体系不完善、实时更新不稳定以及应用范围有限等问题，影响用户体验和视觉一致性。需要通过系统性的优化，建立更完善的配色体系，提升整体视觉美感和用户满意度。

## What Changes
- 降低所有主题色的浓度（chroma 值），使其呈现更淡雅的视觉效果
- 为每个主题色建立完整的配套配色方案，包括次要色、背景色、边框色、悬停色、激活色等
- 修复主题色修改后无法实时更新的问题，确保变更即时生效
- 替换仪表盘及其他页面中的硬编码颜色，使用主题色 CSS 变量
- 扩展主题色的全局应用范围，确保在所有页面保持一致的视觉效果
- **BREAKING** 修改现有主题色的具体色值，可能影响用户已有的视觉习惯

## Impact
- Affected specs: 主题系统、配色方案
- Affected code:
  - `src/client/styles/theme.css` - 主题色定义和配色方案
  - `src/client/context/theme-provider.tsx` - 主题色管理逻辑
  - `src/client/features/dashboard/components/*.tsx` - 仪表盘组件
  - `src/client/features/models/components/*.tsx` - 模型相关组件
  - `src/client/features/agents/components/*.tsx` - Agent 相关组件
  - `src/client/features/security/components/*.tsx` - 安全相关组件
  - 所有使用硬编码颜色的组件

## ADDED Requirements

### Requirement: 主题色浓度优化
系统 SHALL 提供浓度适中、视觉舒适的主题色，确保长时间使用不产生视觉疲劳。

#### Scenario: 主题色浓度调整
- **WHEN** 用户查看应用界面
- **THEN** 主题色的 chroma 值应降低至原来的 60-70%
- **AND** 颜色饱和度适中，既不过于鲜艳也不过于暗淡
- **AND** 保持足够的对比度，确保可读性

### Requirement: 完整的配色体系
系统 SHALL 为每个主题色提供完整的配套配色方案。

#### Scenario: 配色方案应用
- **WHEN** 用户选择某个主题色
- **THEN** 系统应提供以下配套颜色：
  - 主色调及其变体（浅色、深色、悬停、激活）
  - 次要色及其变体
  - 背景色变体（主背景、次背景、卡片背景）
  - 边框色变体
  - 文本色变体（主文本、次文本、禁用文本）
  - 图表配色方案（chart-1 到 chart-5）
- **AND** 所有配套颜色应与主色调协调统一

### Requirement: 实时主题色更新
系统 SHALL 确保主题色修改后立即生效，无需刷新页面。

#### Scenario: 主题色实时切换
- **WHEN** 用户在设置中更改主题色
- **THEN** 所有使用主题色的组件应立即更新为新颜色
- **AND** 不需要刷新页面或重新加载应用
- **AND** 颜色过渡应平滑自然

#### Scenario: Windows 主题色实时跟随
- **WHEN** Windows 系统主题色发生变化
- **THEN** 应用应在 1 秒内检测到变化并更新主题色
- **AND** 如果用户选择了"跟随 Windows"选项，应用主题色应自动同步

### Requirement: 全局主题色应用
系统 SHALL 在所有页面和组件中统一应用主题色。

#### Scenario: 仪表盘主题色应用
- **WHEN** 用户查看仪表盘页面
- **THEN** 所有图表、卡片、按钮应使用当前主题色
- **AND** 数据可视化组件（如折线图、柱状图、树状图）应使用主题色的配套配色
- **AND** 不应出现硬编码的颜色值

#### Scenario: 其他页面主题色应用
- **WHEN** 用户浏览任何页面
- **THEN** 页面中的所有交互元素应使用当前主题色
- **AND** 导航栏、侧边栏、按钮、链接等应保持一致的主题色
- **AND** 主题色应在亮色和暗色模式下都有良好的表现

### Requirement: 视觉美观标准
系统 SHALL 确保主题色系统符合现代 UI 设计标准。

#### Scenario: 色彩过渡自然
- **WHEN** 用户在不同状态间切换（如悬停、激活、禁用）
- **THEN** 颜色过渡应平滑自然，无突兀变化
- **AND** 使用 CSS transition 实现平滑过渡效果

#### Scenario: 对比度适中
- **WHEN** 用户在亮色或暗色模式下使用应用
- **THEN** 文本与背景的对比度应符合 WCAG 2.1 AA 标准（至少 4.5:1）
- **AND** 重要信息的对比度应达到 AAA 标准（至少 7:1）
- **AND** 主题色与背景色的对比度应确保可读性

## MODIFIED Requirements

### Requirement: 主题色定义
原有主题色的具体色值需要调整，降低浓度以实现更淡雅的视觉效果。

#### 原有值（示例）：
- blue: `oklch(0.208 0.042 265.755)` - chroma: 0.042
- purple: `oklch(0.558 0.221 291.231)` - chroma: 0.221
- green: `oklch(0.596 0.172 148.233)` - chroma: 0.172
- orange: `oklch(0.705 0.213 47.739)` - chroma: 0.213
- pink: `oklch(0.584 0.244 352.323)` - chroma: 0.244

#### 修改后（示例）：
- blue: `oklch(0.208 0.028 265.755)` - chroma: 0.028（降低约 33%）
- purple: `oklch(0.558 0.145 291.231)` - chroma: 0.145（降低约 34%）
- green: `oklch(0.596 0.115 148.233)` - chroma: 0.115（降低约 33%）
- orange: `oklch(0.705 0.140 47.739)` - chroma: 0.140（降低约 34%）
- pink: `oklch(0.584 0.160 352.323)` - chroma: 0.160（降低约 34%）

### Requirement: CSS 变量扩展
原有 CSS 变量从 4 个扩展至完整的配色体系。

#### 原有变量：
- `--primary`
- `--primary-foreground`
- `--ring`
- `--chart-1`

#### 新增变量：
- `--primary-light` - 主色调浅色变体
- `--primary-dark` - 主色调深色变体
- `--primary-hover` - 悬停状态颜色
- `--primary-active` - 激活状态颜色
- `--secondary-accent` - 次要强调色
- `--background-subtle` - 微妙背景色
- `--border-subtle` - 微妙边框色
- `--chart-2` 到 `--chart-5` - 完整的图表配色方案

## REMOVED Requirements
无
