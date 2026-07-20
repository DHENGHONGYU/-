---
title: V6-V9 UI 组件库比对分析报�?
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "比对对象: `v6-ui-assets/source-migration/components/ui` (遗留) vs..."
tags: [qa, component, analysis, frontend]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---orts
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [qa, component, analysis, frontend]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V6-V9 UI 组件库比对分析报�?
> **Date**: 2026-07-01
> 比对对象: `v6-ui-assets/source-migration/components/ui` (遗留) vs `../../../src/showcase/UIComponentShowcase.tsx` (现有)

---

## 总体统计

| 指标 | 遗留组件�?(V6) | 现有组件�?(V9) | 差异 |
|------|-----------------|-----------------|------|
| **组件总数** | 47 �?| 38 �?| -9 �?|
| **带测�?* | 0 �?| 15 �?| +15 �?|
| **使用 Radix UI** | 30+ 组件 | 0 �?| - |
| **使用 CVA** | 多个组件 | 0 �?| - |

---

## 🔄 组件映射关系

### �?完整对应组件 (名称和功能一�?

| 遗留组件 (V6) | 现有组件 (V9) | 状�?| 说明 |
|--------------|--------------|------|------|
| `badge.tsx` | `Badge.tsx` | �?已迁�?| V9 扩展�?success/warning 变体 |
| `breadcrumb.tsx` | `Breadcrumb.tsx` | �?已迁�?| 功能一�?|
| `button.tsx` | `Button.tsx` | �?已迁�?| V9 增加�?success/danger 变体�?isLoading |
| `card.tsx` | `Card.tsx` | �?已迁�?| 功能一�?|
| `checkbox.tsx` | `Checkbox.tsx` | �?已迁�?| 功能一�?|
| `dialog.tsx` | `Dialog.tsx` | �?已迁�?| V9 使用原生 `<dialog>` 替代 Radix |
| `empty.tsx` | `EmptyState.tsx` | �?已迁�?| V9 重命名为 EmptyState |
| `input.tsx` | `Input.tsx` | �?已迁�?| 功能一�?|
| `label.tsx` | `Label.tsx` | �?已迁�?| 功能一�?|
| `pagination.tsx` | `Pagination.tsx` | �?已迁�?| 功能一�?|
| `popover.tsx` | `Popover.tsx` | �?已迁�?| 功能一�?|
| `progress.tsx` | `Progress.tsx` | �?已迁�?| 功能一�?|
| `radio-group.tsx` | `Radio.tsx` | �?已迁�?| V9 拆分�?Radio + RadioGroup |
| `select.tsx` | `Select.tsx` | �?已迁�?| V9 使用原生实现替代 Radix |
| `separator.tsx` | `Separator.tsx` | �?已迁�?| 功能一�?|
| `sheet.tsx` | `Sheet.tsx` | �?已迁�?| V9 增加了测�?|
| `skeleton.tsx` | `Skeleton.tsx` | �?已迁�?| 功能一�?|
| `slider.tsx` | `Slider.tsx` | �?已迁�?| 功能一�?|
| `switch.tsx` | `Switch.tsx` | �?已迁�?| 功能一�?|
| `table.tsx` | `Table.tsx` | �?已迁�?| 功能一�?|
| `tabs.tsx` | `Tabs.tsx` | �?已迁�?| 功能一�?|
| `textarea.tsx` | `Textarea.tsx` | �?已迁�?| 功能一�?|
| `toggle.tsx` | `Toggle.tsx` | �?已迁�?| 功能一�?|
| `tooltip.tsx` | `Tooltip.tsx` | �?已迁�?| 功能一�?|

---

## �?缺失组件 (遗留有，V9 �?

| 组件�?| 优先�?| 说明 | 迁移建议 |
|--------|--------|------|----------|
| `accordion.tsx` | 🟡 �?| 手风琴展开/折叠组件 | **建议迁移** - 基于 Radix Accordion |
| `alert-dialog.tsx` | 🟡 �?| Alert + Dialog 组合 | **建议迁移** - 可整合到 Dialog |
| `alert.tsx` | 🟡 �?| 警告提示组件 | **建议迁移** - Alert/AlertTitle/AlertDescription |
| `aspect-ratio.tsx` | 🟢 �?| 保持元素宽高�?| 可用 CSS aspect-ratio 替代 |
| `avatar.tsx` | 🟡 �?| 用户头像组件 | **建议迁移** - 用户系统需�?|
| `button-group.tsx` | 🟢 �?| 按钮组组�?| 可用 Button + flex 替代 |
| `calendar.tsx` | 🔴 �?| 日期选择日历 | **建议迁移** - 已有 DatePicker，可合并 |
| `carousel.tsx` | 🟢 �?| 轮播组件 | **建议迁移** - 资讯轮播页需�?|
| `chart.tsx` | 🔴 �?| 图表组件包装 | **建议迁移** - V9 需要图表展�?|
| `collapsible.tsx` | 🟡 �?| 可折叠区�?| 可用 Accordion 替代 |
| `command.tsx` | 🟡 �?| 命令面板 (Cmd+K) | **建议迁移** - 命令面板功能 |
| `context-menu.tsx` | 🟡 �?| 右键菜单 | **建议迁移** - 表格行操作需�?|
| `drawer.tsx` | 🟡 �?| 抽屉侧边�?| 可用 Sheet 扩展实现 |
| `dropdown-menu.tsx` | 🟡 �?| 下拉菜单 | **建议迁移** - 导航菜单需�?|
| `field.tsx` | 🟢 �?| 表单字段包装 | 可用 Label + Input 组合替代 |
| `form.tsx` | 🟡 �?| 表单组件 | **建议迁移** - 表单验证 |
| `hover-card.tsx` | 🟢 �?| 悬浮卡片 | 可用 Popover 替代 |
| `input-group.tsx` | 🟢 �?| 输入框组 | 可用 Input + flex 组合 |
| `input-otp.tsx` | 🟢 �?| 验证码输�?| 可用 Input 组合实现 |
| `item.tsx` | 🟢 �?| 列表项基础组件 | 可用 div + 样式替代 |
| `kbd.tsx` | 🟢 �?| 键盘按键样式 | **建议迁移** - Command 面板需�?|
| `menubar.tsx` | 🟡 �?| 菜单�?| **建议迁移** - 导航系统 |
| `navigation-menu.tsx` | 🔴 �?| 导航菜单 | **建议迁移** - PortalShell 需�?|
| `resizable.tsx` | 🟡 �?| 可调整大�?| **建议迁移** - Dashboard 需�?|
| `scroll-area.tsx` | 🟡 �?| 自定义滚动区�?| **建议迁移** - 长列表需�?|
| `sidebar.tsx` | 🟡 �?| 侧边栏组�?| **建议迁移** - Dashboard 布局 |
| `sonner.tsx` | 🟡 �?| Toast 通知 (sonner) | V9 已有 Toast，可优化 |
| `spinner.tsx` | 🟡 �?| 加载动画 | V9 Button 已内�?isLoading |
| `toggle-group.tsx` | 🟢 �?| Toggle 按钮�?| 可用 Toggle 组合实现 |

---

## 🆕 V9 独有组件 (V6 �?

| 组件�?| 说明 |
|--------|------|
| `DataState.tsx` | 数据状态展�?(loading/error/empty) |
| `ErrorState.tsx` | 错误状态展�?|
| `Grid.tsx` | 栅格布局组件 |
| `List.tsx` | 列表组件 |
| `LoadingState.tsx` | 加载状态展�?|
| `Menu.tsx` | 菜单组件 |
| `Result.tsx` | 结果展示组件 |

---

## ⚙️ 技术实现差�?
### Radix UI 依赖

**遗留组件 (V6)** 大量使用 Radix UI 原语�?- `@radix-ui/react-accordion`
- `@radix-ui/react-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-slider`
- `@radix-ui/react-switch`
- `@radix-ui/react-popover`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-separator`
- `@radix-ui/react-collapsible`

**现有组件 (V9)** 使用原生 HTML 实现�?- Dialog 使用原生 `<dialog>` 元素
- Select 使用原生 `<select>` 或自定义实现
- Tabs 使用 div + 状态管�?- 所有组件零外部 UI 依赖

### CVA (Class Variance Authority)

**遗留组件 (V6)** 使用 CVA 管理变体�?```tsx
const buttonVariants = cva("base-class", {
  variants: { variant: {...}, size: {...} },
  defaultVariants: {...}
})
```

**现有组件 (V9)** 使用 cn() + 对象语法�?```tsx
const classes = cn('base-class', {
  'variant-class': variant === 'xxx',
  'size-class': size === 'xxx',
}, className)
```

### React.memo 包装

**遗留组件 (V6)**: �?memo 包装
**现有组件 (V9)**: 所有组件使�?React.memo + forwardRef

### 依赖对比

| 依赖 | 遗留 (V6) | 现有 (V9) |
|------|-----------|-----------|
| `@radix-ui/*` | 15+ 个包 | 0 �?|
| `class-variance-authority` | �?使用 | �?未使�?|
| `react-memo` | �?未显式使�?| �?全部使用 |
| 组件包体�?| 较大 | 精简 |

---

## 迁移优先级建�?
### 🔴 高优先级 (核心业务需�?

1. **navigation-menu.tsx** �?PortalShell 导航菜单
2. **chart.tsx** �?数据可视化展�?3. **calendar.tsx** �?日期选择功能

### 🟡 中优先级 (提升用户体验)

4. **alert.tsx** �?警告提示组件
5. **context-menu.tsx** �?右键菜单
6. **dropdown-menu.tsx** �?下拉菜单
7. **scroll-area.tsx** �?自定义滚�?8. **command.tsx** �?命令面板 (Cmd+K)
9. **avatar.tsx** �?用户头像

### 🟢 低优先级 (可替代或延后)

10. `accordion.tsx` / `collapsible.tsx` �?可合�?11. `resizable.tsx` �?Dashboard 布局
12. `sidebar.tsx` �?PortalShell 侧边�?13. `kbd.tsx` �?Command 面板需�?14. `menubar.tsx` �?导航系统

---

## 目录结构

```
智能投研复盘系统V9/
├── v6-ui-assets/source-migration/     # 遗留组件�?�?  └── components/ui/                  # 47 个组�?�?      ├── accordion.tsx
�?      ├── alert-dialog.tsx
�?      ├── alert.tsx
�?      ├── badge.tsx
�?      ├── button.tsx
�?      ├── card.tsx
�?      ├── chart.tsx                   # ⚠️ 缺失
�?      ├── command.tsx                 # ⚠️ 缺失
�?      ├── context-menu.tsx            # ⚠️ 缺失
�?      ├── dropdown-menu.tsx           # ⚠️ 缺失
�?      ├── navigation-menu.tsx          # ⚠️ 缺失
�?      └── ...
�?└── src/components/ui/                  # 现有组件�?    ├── Badge.tsx
    ├── Button.tsx
    ├── Card.tsx
    ├── Dialog.tsx
    ├── EmptyState.tsx
    ├── NavigationMenu.tsx               # �?缺失
    ├── Chart.tsx                        # �?缺失
    └── ...
```

---

## �?结论

1. **不存在两�?UI 组件同时运行的情�?* - v6-ui-assets 是孤立遗留代�?2. **V9 组件库更精简** - �?Radix 依赖，包体积更小
3. **存在 25+ 个缺失组�?* - 可从遗留代码迁移或重新实�?4. **建议优先�?* - �? navigation-menu, chart, calendar

---

## 行动�?
| # | 行动 | 负责�?| 状�?|
|---|------|--------|------|
| 1 | 评估 navigation-menu 迁移必要�?| - | 待定 |
| 2 | 评估 chart 组件选型 (ECharts/Recharts) | - | 待定 |
| 3 | 清理 v6-ui-assets 孤立代码 | - | 待定 |
| 4 | 补充缺失组件测试 | - | 待定 |
