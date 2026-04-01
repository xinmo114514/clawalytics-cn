# Tasks
- [ ] Task 1: 扩展 ThemeProvider 支持 windows 主题选项
  - [ ] SubTask 1.1: 在 theme-provider.tsx 中添加 'windows' 主题类型
  - [ ] SubTask 1.2: 添加颜色主题选项 'windows'
  - [ ] SubTask 1.3: 实现 Windows 主题色读取逻辑
- [ ] Task 2: 更新主题 CSS 变量支持 windows 颜色
  - [ ] SubTask 2.1: 在 theme.css 中添加 :root.color-windows 样式
  - [ ] SubTask 2.2: 在 theme.css 中添加 .dark.color-windows 样式
- [ ] Task 3: 更新设置页面 UI
  - [ ] SubTask 3.1: 在 appearance-settings.tsx 中添加 Windows 主题选项
- [ ] Task 4: 更新配置抽屉 UI
  - [ ] SubTask 4.1: 在 config-drawer.tsx 中添加 Windows 颜色选项
- [ ] Task 5: 构建验证
  - [ ] SubTask 5.1: 运行构建确认无错误

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2]
