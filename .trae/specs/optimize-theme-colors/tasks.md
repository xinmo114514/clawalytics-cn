# Tasks

- [x] Task 1: 优化主题色浓度
  - [x] SubTask 1.1: 分析当前主题色的 chroma 值，确定降低比例（约 30-35%）
  - [x] SubTask 1.2: 更新 theme.css 中所有主题色的 primary 颜色值
  - [x] SubTask 1.3: 更新亮色模式和暗色模式下的主题色定义
  - [x] SubTask 1.4: 调整 Windows 主题色的默认浓度值

- [x] Task 2: 建立完整的配色体系
  - [x] SubTask 2.1: 为每个主题色添加浅色变体（--primary-light）
  - [x] SubTask 2.2: 为每个主题色添加深色变体（--primary-dark）
  - [x] SubTask 2.3: 为每个主题色添加悬停状态颜色（--primary-hover）
  - [x] SubTask 2.4: 为每个主题色添加激活状态颜色（--primary-active）
  - [x] SubTask 2.5: 添加次要强调色（--secondary-accent）
  - [x] SubTask 2.6: 添加微妙背景色和边框色变体
  - [x] SubTask 2.7: 完善 chart-2 到 chart-5 的图表配色方案

- [x] Task 3: 修复实时更新问题
  - [x] SubTask 3.1: 检查 theme-provider.tsx 中的主题色更新逻辑
  - [x] SubTask 3.2: 确保 CSS 变量更新后能触发组件重新渲染
  - [x] SubTask 3.3: 添加 Windows 主题色变化的监听机制（如需要）
  - [x] SubTask 3.4: 测试主题色切换的实时性

- [x] Task 4: 替换仪表盘硬编码颜色
  - [x] SubTask 4.1: 更新 daily-cost-chart.tsx，使用主题色 CSS 变量
  - [x] SubTask 4.2: 更新 token-breakdown-card.tsx，使用主题色配色方案
  - [x] SubTask 4.3: 更新 model-usage-chart.tsx，使用主题色图表配色
  - [x] SubTask 4.4: 检查并更新其他仪表盘组件中的硬编码颜色

- [x] Task 5: 替换其他页面硬编码颜色
  - [x] SubTask 5.1: 更新 models 相关组件中的硬编码颜色
  - [x] SubTask 5.2: 更新 agents 相关组件中的硬编码颜色
  - [x] SubTask 5.3: 更新 security 相关组件中的硬编码颜色
  - [x] SubTask 5.4: 检查并更新其他使用硬编码颜色的组件

- [x] Task 6: 全局主题色应用验证
  - [x] SubTask 6.1: 验证主题色在设置页面的应用效果
  - [x] SubTask 6.2: 验证主题色在仪表盘页面的应用效果
  - [x] SubTask 6.3: 验证主题色在其他所有页面的应用效果
  - [x] SubTask 6.4: 验证亮色模式和暗色模式下的主题色表现

- [x] Task 7: 视觉效果验证与优化
  - [x] SubTask 7.1: 验证颜色过渡的平滑性
  - [x] SubTask 7.2: 验证对比度是否符合 WCAG 标准
  - [x] SubTask 7.3: 验证长时间使用的视觉舒适度
  - [x] SubTask 7.4: 根据测试结果进行微调优化

- [x] Task 8: 构建和测试
  - [x] SubTask 8.1: 运行构建确认无 TypeScript 错误
  - [x] SubTask 8.2: 运行 lint 检查代码质量
  - [x] SubTask 8.3: 在开发环境中全面测试主题色功能
  - [x] SubTask 8.4: 测试所有主题色在不同页面的一致性

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 2]
- [Task 6] depends on [Task 4, Task 5]
- [Task 7] depends on [Task 6]
- [Task 8] depends on [Task 7]
