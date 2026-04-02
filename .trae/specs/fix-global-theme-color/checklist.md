# Checklist

## 语义化颜色 CSS 变量体系
- [ ] theme.css 中包含完整的 destructive CSS 变量
- [ ] theme.css 中包含完整的 warning CSS 变量
- [ ] theme.css 中包含完整的 success CSS 变量
- [ ] theme.css 中包含完整的 info CSS 变量
- [ ] 每个主题色都有对应的状态色变体
- [ ] 亮色模式和暗色模式下都有完整的语义化颜色

## 硬编码颜色扫描
- [ ] 所有组件中没有硬编码的 red 颜色值
- [ ] 所有组件中没有硬编码的 blue 颜色值
- [ ] 所有组件中没有硬编码的 green 颜色值
- [ ] 所有组件中没有硬编码的 yellow 颜色值
- [ ] 所有组件中没有硬编码的 hex 颜色值
- [ ] 所有组件中没有硬编码的 rgb/rgba 颜色值
- [ ] 所有组件中没有硬编码的 oklch 颜色值（除了 theme.css）

## UI 基础组件验证
- [ ] button.tsx 中 destructive 变体使用 CSS 变量
- [ ] alert.tsx 中所有状态变体使用 CSS 变量
- [ ] badge.tsx 中所有状态颜色使用 CSS 变量
- [ ] input.tsx 中 error 状态边框使用 CSS 变量
- [ ] dialog.tsx 中所有颜色使用 CSS 变量
- [ ] card.tsx 中边框和阴影使用 CSS 变量
- [ ] table.tsx 中行悬停、选中状态使用 CSS 变量

## 功能组件验证
- [ ] sidebar.tsx 中 active 状态颜色使用 CSS 变量
- [ ] navigation 相关组件使用 CSS 变量
- [ ] chart 相关组件使用 chart-* CSS 变量
- [ ] form 相关组件使用 CSS 变量
- [ ] data-table 相关组件使用 CSS 变量

## 页面组件验证
- [ ] dashboard 页面所有组件使用 CSS 变量
- [ ] agents 页面所有组件使用 CSS 变量
- [ ] models 页面所有组件使用 CSS 变量
- [ ] security 页面所有组件使用 CSS 变量
- [ ] settings 页面所有组件使用 CSS 变量
- [ ] 其他页面所有组件使用 CSS 变量

## 全局主题色应用验证
- [ ] blue 主题色在所有组件中一致应用
- [ ] purple 主题色在所有组件中一致应用
- [ ] green 主题色在所有组件中一致应用
- [ ] orange 主题色在所有组件中一致应用
- [ ] pink 主题色在所有组件中一致应用
- [ ] Windows 主题色在所有组件中一致应用
- [ ] 亮色模式下主题色一致性验证通过
- [ ] 暗色模式下主题色一致性验证通过

## 实时切换验证
- [ ] 主题色切换后所有组件立即更新
- [ ] 页面导航后主题色保持一致
- [ ] 刷新页面后主题色保持一致
- [ ] 不同用户界面元素颜色一致

## 代码质量验证
- [ ] TypeScript 编译无错误
- [ ] ESLint 检查无错误
- [ ] Prettier 格式化无问题
- [ ] 所有页面的功能完整性测试通过
