# 全局主题色应用修复 Spec

## Why
用户在切换主题色后，发现某些组件（如红色主题色、错误提示、destructive 操作等）的颜色没有跟随主题色变化。这违反了规格文档中"全局主题色应用"的要求，影响用户体验和视觉一致性。

## What Changes
- 全面扫描所有组件中硬编码的颜色值，特别是红色相关颜色
- 将所有红色相关颜色统一为使用 CSS 变量
- 确保 destructive、error、warning 等语义化颜色也支持主题色切换
- 建立完整的语义化颜色体系，确保全局一致性

## Impact
- Affected specs: 全局主题色应用、视觉一致性
- Affected code:
  - `src/client/components/ui/*.tsx` - UI 基础组件
  - `src/client/components/**/*.tsx` - 所有使用硬编码颜色的组件
  - `src/client/styles/theme.css` - 主题色定义

## ADDED Requirements

### Requirement: 语义化颜色体系
系统 SHALL 提供完整的语义化颜色体系，确保所有语义相关的颜色都能通过 CSS 变量统一管理。

#### Scenario: Destructive 颜色主题化
- **WHEN** 用户切换主题色
- **THEN** 所有 destructive（破坏性操作）相关的红色元素应跟随主题色变化
- **OR** destructive 颜色应使用语义化的 CSS 变量

#### Scenario: Error 颜色主题化
- **WHEN** 用户切换主题色
- **THEN** 所有错误提示、错误状态相关的颜色应保持一致性
- **AND** 可以通过 CSS 变量控制错误色的具体色值

#### Scenario: Warning 颜色主题化
- **WHEN** 用户切换主题色
- **THEN** 所有警告相关的颜色应保持一致性
- **AND** 可以通过 CSS 变量控制警告色的具体色值

### Requirement: 硬编码颜色全面替换
系统 SHALL 将所有组件中的硬编码颜色替换为 CSS 变量。

#### Scenario: 组件硬编码颜色扫描
- **WHEN** 审查所有组件代码
- **THEN** 不应存在任何硬编码的颜色值（如 `red`、`blue`、`#ff0000`、`oklch(...)` 等）
- **AND** 所有颜色应通过 CSS 变量引用

#### Scenario: 颜色变量完整性
- **WHEN** 定义 CSS 颜色变量
- **THEN** 应确保所有组件可能使用的颜色都有对应的 CSS 变量
- **AND** 包括但不限于：primary、secondary、accent、destructive、muted、background、foreground、border、chart-*、status-* 等

### Requirement: 全局一致性验证
系统 SHALL 验证主题色在所有组件中的全局一致性。

#### Scenario: 实时切换一致性
- **WHEN** 用户切换主题色（blue/purple/green/orange/pink）
- **THEN** 应用中所有使用主题色的元素应立即同步变化
- **AND** 不应存在任何遗漏的组件

#### Scenario: 跨页面一致性
- **WHEN** 用户浏览不同页面
- **THEN** 主题色应保持完全一致
- **AND** 不应因页面不同而出现颜色差异

## MODIFIED Requirements

### Requirement: 现有主题色定义的扩展
在现有主题色定义基础上，添加完整的语义化颜色变量。

#### 需要新增的 CSS 变量：
```css
/* 语义化状态颜色 */
--destructive: oklch(...) /* 破坏性操作 */
--destructive-foreground: oklch(...) /* 破坏性操作前景 */
--warning: oklch(...) /* 警告色 */
--warning-foreground: oklch(...) /* 警告色前景 */
--success: oklch(...) /* 成功色 */
--success-foreground: oklch(...) /* 成功色前景 */
--info: oklch(...) /* 信息色 */
--info-foreground: oklch(...) /* 信息色前景 */

/* 每个主题色对应的状态色变体 */
--primary-destructive: var(--primary); /* 在 destructive 上下文中使用主题色 */
--primary-warning: var(--primary);
--primary-success: var(--primary);
--primary-info: var(--primary);
```

## REMOVED Requirements
无

## Implementation Notes

### 关键组件需要检查的颜色：
1. Button 组件 - destructive 变体
2. Alert/Toast 组件 - error、warning、success、info 变体
3. Badge 组件 - 各种状态颜色
4. Input 组件 - error 状态边框
5. Dialog/Modal 组件 - 关闭按钮、高亮元素
6. Card 组件 - 边框、阴影
7. Table 组件 - 行悬停、选中状态
8. Chart 组件 - 数据点颜色
9. Sidebar 组件 - active 状态
10. Navigation 组件 - 当前页面指示器

### 验证方法：
1. 代码扫描：搜索所有硬编码的颜色值
2. 视觉测试：在不同主题色下截图对比
3. 实时切换：快速切换主题色，观察所有变化
