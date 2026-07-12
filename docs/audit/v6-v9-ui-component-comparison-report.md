---
title: V6-V9 UI 组件库比对分析报告
code_version: 2.0.0
---

# V6-V9 UI 组件库比对分析报告

> 生成时间: 2026-07-01
> 比对对象: `v6-ui-assets/source-migration/components/ui` (遗留) vs `src/components/ui` (现有)

---

## 📊 总体统计

| 指标 | 遗留组件库 (V6) | 现有组件库 (V9) | 差异 |
|------|-----------------|-----------------|------|
| **组件总数** | 47 个 | 38 个 | -9 个 |
| **带测试** | 0 个 | 15 个 | +15 个 |
| **使用 Radix UI** | 30+ 组件 | 0 个 | - |
| **使用 CVA** | 多个组件 | 0 个 | - |

---

## 🔄 组件映射关系

### ✅ 完整对应组件 (名称和功能一致)

| 遗留组件 (V6) | 现有组件 (V9) | 状态 | 说明 |
|--------------|--------------|------|------|
| `badge.tsx` | `Badge.tsx` | ✅ 已迁移 | V9 扩展了 success/warning 变体 |
| `breadcrumb.tsx` | `Breadcrumb.tsx` | ✅ 已迁移 | 功能一致 |
| `button.tsx` | `Button.tsx` | ✅ 已迁移 | V9 增加了 success/danger 变体和 isLoading |
| `card.tsx` | `Card.tsx` | ✅ 已迁移 | 功能一致 |
| `checkbox.tsx` | `Checkbox.tsx` | ✅ 已迁移 | 功能一致 |
| `dialog.tsx` | `Dialog.tsx` | ✅ 已迁移 | V9 使用原生 `<dialog>` 替代 Radix |
| `empty.tsx` | `EmptyState.tsx` | ✅ 已迁移 | V9 重命名为 EmptyState |
| `input.tsx` | `Input.tsx` | ✅ 已迁移 | 功能一致 |
| `label.tsx` | `Label.tsx` | ✅ 已迁移 | 功能一致 |
| `pagination.tsx` | `Pagination.tsx` | ✅ 已迁移 | 功能一致 |
| `popover.tsx` | `Popover.tsx` | ✅ 已迁移 | 功能一致 |
| `progress.tsx` | `Progress.tsx` | ✅ 已迁移 | 功能一致 |
| `radio-group.tsx` | `Radio.tsx` | ✅ 已迁移 | V9 拆分为 Radio + RadioGroup |
| `select.tsx` | `Select.tsx` | ✅ 已迁移 | V9 使用原生实现替代 Radix |
| `separator.tsx` | `Separator.tsx` | ✅ 已迁移 | 功能一致 |
| `sheet.tsx` | `Sheet.tsx` | ✅ 已迁移 | V9 增加了测试 |
| `skeleton.tsx` | `Skeleton.tsx` | ✅ 已迁移 | 功能一致 |
| `slider.tsx` | `Slider.tsx` | ✅ 已迁移 | 功能一致 |
| `switch.tsx` | `Switch.tsx` | ✅ 已迁移 | 功能一致 |
| `table.tsx` | `Table.tsx` | ✅ 已迁移 | 功能一致 |
| `tabs.tsx` | `Tabs.tsx` | ✅ 已迁移 | 功能一致 |
| `textarea.tsx` | `Textarea.tsx` | ✅ 已迁移 | 功能一致 |
| `toggle.tsx` | `Toggle.tsx` | ✅ 已迁移 | 功能一致 |
| `tooltip.tsx` | `Tooltip.tsx` | ✅ 已迁移 | 功能一致 |

---

## ❌ 缺失组件 (遗留有，V9 无)

| 组件名 | 优先级 | 说明 | 迁移建议 |
|--------|--------|------|----------|
| `accordion.tsx` | 🟡 中 | 手风琴展开/折叠组件 | **建议迁移** - 基于 Radix Accordion |
| `alert-dialog.tsx` | 🟡 中 | Alert + Dialog 组合 | **建议迁移** - 可整合到 Dialog |
| `alert.tsx` | 🟡 中 | 警告提示组件 | **建议迁移** - Alert/AlertTitle/AlertDescription |
| `aspect-ratio.tsx` | 🟢 低 | 保持元素宽高比 | 可用 CSS aspect-ratio 替代 |
| `avatar.tsx` | 🟡 中 | 用户头像组件 | **建议迁移** - 用户系统需要 |
| `button-group.tsx` | 🟢 低 | 按钮组组件 | 可用 Button + flex 替代 |
| `calendar.tsx` | 🔴 高 | 日期选择日历 | **建议迁移** - 已有 DatePicker，可合并 |
| `carousel.tsx` | 🟢 低 | 轮播组件 | **建议迁移** - 资讯轮播页需要 |
| `chart.tsx` | 🔴 高 | 图表组件包装 | **建议迁移** - V9 需要图表展示 |
| `collapsible.tsx` | 🟡 中 | 可折叠区域 | 可用 Accordion 替代 |
| `command.tsx` | 🟡 中 | 命令面板 (Cmd+K) | **建议迁移** - 命令面板功能 |
| `context-menu.tsx` | 🟡 中 | 右键菜单 | **建议迁移** - 表格行操作需要 |
| `drawer.tsx` | 🟡 中 | 抽屉侧边栏 | 可用 Sheet 扩展实现 |
| `dropdown-menu.tsx` | 🟡 中 | 下拉菜单 | **建议迁移** - 导航菜单需要 |
| `field.tsx` | 🟢 低 | 表单字段包装 | 可用 Label + Input 组合替代 |
| `form.tsx` | 🟡 中 | 表单组件 | **建议迁移** - 表单验证 |
| `hover-card.tsx` | 🟢 低 | 悬浮卡片 | 可用 Popover 替代 |
| `input-group.tsx` | 🟢 低 | 输入框组 | 可用 Input + flex 组合 |
| `input-otp.tsx` | 🟢 低 | 验证码输入 | 可用 Input 组合实现 |
| `item.tsx` | 🟢 低 | 列表项基础组件 | 可用 div + 样式替代 |
| `kbd.tsx` | 🟢 低 | 键盘按键样式 | **建议迁移** - Command 面板需要 |
| `menubar.tsx` | 🟡 中 | 菜单栏 | **建议迁移** - 导航系统 |
| `navigation-menu.tsx` | 🔴 高 | 导航菜单 | **建议迁移** - PortalShell 需要 |
| `resizable.tsx` | 🟡 中 | 可调整大小 | **建议迁移** - Dashboard 需要 |
| `scroll-area.tsx` | 🟡 中 | 自定义滚动区域 | **建议迁移** - 长列表需要 |
| `sidebar.tsx` | 🟡 中 | 侧边栏组件 | **建议迁移** - Dashboard 布局 |
| `sonner.tsx` | 🟡 中 | Toast 通知 (sonner) | V9 已有 Toast，可优化 |
| `spinner.tsx` | 🟡 中 | 加载动画 | V9 Button 已内置 isLoading |
| `toggle-group.tsx` | 🟢 低 | Toggle 按钮组 | 可用 Toggle 组合实现 |

---

## 🆕 V9 独有组件 (V6 无)

| 组件名 | 说明 |
|--------|------|
| `DataState.tsx` | 数据状态展示 (loading/error/empty) |
| `ErrorState.tsx` | 错误状态展示 |
| `Grid.tsx` | 栅格布局组件 |
| `List.tsx` | 列表组件 |
| `LoadingState.tsx` | 加载状态展示 |
| `Menu.tsx` | 菜单组件 |
| `Result.tsx` | 结果展示组件 |

---

## ⚙️ 技术实现差异

### Radix UI 依赖

**遗留组件 (V6)** 大量使用 Radix UI 原语：
- `@radix-ui/react-accordion`
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

**现有组件 (V9)** 使用原生 HTML 实现：
- Dialog 使用原生 `<dialog>` 元素
- Select 使用原生 `<select>` 或自定义实现
- Tabs 使用 div + 状态管理
- 所有组件零外部 UI 依赖

### CVA (Class Variance Authority)

**遗留组件 (V6)** 使用 CVA 管理变体：
```tsx
const buttonVariants = cva("base-class", {
  variants: { variant: {...}, size: {...} },
  defaultVariants: {...}
})
```

**现有组件 (V9)** 使用 cn() + 对象语法：
```tsx
const classes = cn('base-class', {
  'variant-class': variant === 'xxx',
  'size-class': size === 'xxx',
}, className)
```

### React.memo 包装

**遗留组件 (V6)**: 无 memo 包装
**现有组件 (V9)**: 所有组件使用 React.memo + forwardRef

### 依赖对比

| 依赖 | 遗留 (V6) | 现有 (V9) |
|------|-----------|-----------|
| `@radix-ui/*` | 15+ 个包 | 0 个 |
| `class-variance-authority` | ✅ 使用 | ❌ 未使用 |
| `react-memo` | ❌ 未显式使用 | ✅ 全部使用 |
| 组件包体积 | 较大 | 精简 |

---

## 📋 迁移优先级建议

### 🔴 高优先级 (核心业务需要)

1. **navigation-menu.tsx** → PortalShell 导航菜单
2. **chart.tsx** → 数据可视化展示
3. **calendar.tsx** → 日期选择功能

### 🟡 中优先级 (提升用户体验)

4. **alert.tsx** → 警告提示组件
5. **context-menu.tsx** → 右键菜单
6. **dropdown-menu.tsx** → 下拉菜单
7. **scroll-area.tsx** → 自定义滚动
8. **command.tsx** → 命令面板 (Cmd+K)
9. **avatar.tsx** → 用户头像

### 🟢 低优先级 (可替代或延后)

10. `accordion.tsx` / `collapsible.tsx` → 可合并
11. `resizable.tsx` → Dashboard 布局
12. `sidebar.tsx` → PortalShell 侧边栏
13. `kbd.tsx` → Command 面板需要
14. `menubar.tsx` → 导航系统

---

## 📁 目录结构

```
智能投研复盘系统V9/
├── v6-ui-assets/source-migration/     # 遗留组件库
│   └── components/ui/                  # 47 个组件
│       ├── accordion.tsx
│       ├── alert-dialog.tsx
│       ├── alert.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── chart.tsx                   # ⚠️ 缺失
│       ├── command.tsx                 # ⚠️ 缺失
│       ├── context-menu.tsx            # ⚠️ 缺失
│       ├── dropdown-menu.tsx           # ⚠️ 缺失
│       ├── navigation-menu.tsx          # ⚠️ 缺失
│       └── ...
│
└── src/components/ui/                  # 现有组件库
    ├── Badge.tsx
    ├── Button.tsx
    ├── Card.tsx
    ├── Dialog.tsx
    ├── EmptyState.tsx
    ├── NavigationMenu.tsx               # ❌ 缺失
    ├── Chart.tsx                        # ❌ 缺失
    └── ...
```

---

## ✅ 结论

1. **不存在两套 UI 组件同时运行的情况** - v6-ui-assets 是孤立遗留代码
2. **V9 组件库更精简** - 零 Radix 依赖，包体积更小
3. **存在 25+ 个缺失组件** - 可从遗留代码迁移或重新实现
4. **建议优先级** - 高: navigation-menu, chart, calendar

---

## 📝 行动项

| # | 行动 | 负责人 | 状态 |
|---|------|--------|------|
| 1 | 评估 navigation-menu 迁移必要性 | - | 待定 |
| 2 | 评估 chart 组件选型 (ECharts/Recharts) | - | 待定 |
| 3 | 清理 v6-ui-assets 孤立代码 | - | 待定 |
| 4 | 补充缺失组件测试 | - | 待定 |
