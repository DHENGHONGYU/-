---
doc_id: V9-DOC-ARCH-059
title: "04. UI/UX 规范"
domain: arch
status: active
last_updated: 2026-08-17
---

﻿---
title: 04. UI/UX 规范
type: explanation
domain: frontend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "设计参考：https://hslqownhhwaig.ok.kimi.link/ 设计特征：PWA 移动端优先、shadcn/ui 组件体系、HSL CSS 变量主题、widget..."
tags: [frontend, spec, plan, architecture, component, explanation]
version: v2.6.0
last_updated: 2026-08-15
doc_id: V9-DOC-FRONT-003
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v2.6.0
    changes: "修订主色为 Apple Blue #007AFF（对齐 V5 Apple Business Design Tokens 唯一真相源），同步 CSS 变量、设计原则与图表组件/Widget 状态"
    date: 2026-08-15
  - version: v2.5.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-07-17
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# 04. UI/UX 规范

> **Status**: Current  
> **Version**: v2.6.0  
> **Last Updated**: 2026-08-15
>
> **设计参考**：https://hslqownhhwaig.ok.kimi.link/  
> **设计特征**：PWA 移动端优先、shadcn/ui 组件体系、HSL CSS 变量主题、widget 化驾驶舱、Apple Blue #007AFF 强调色（V5 Apple Business Design）。

## 4.1 设计原则

1. **移动端优先**：主要使用场景为平板/桌面研究，但需适配移动端浏览。
2. **PWA 体验**：可安装、离线可用、主题色 `#007AFF`（Apple Blue）。
3. **Widget 化**：驾驶舱由可配置 Widget 网格组成。
4. **五舱工作流**：输入 → 分析 → 交易 → 输出 → 总控，不切屏。
5. **Apple Business Design 主调 + 宋瓷语义点缀**：以象牙白/暖灰为底，Apple Blue #007AFF（`--primary: 210 100% 50%`）为行动色。功能性**警示色为琥珀（amber，`--warning: 36 100% 50%`）**——避免与错误色（`--destructive` 红）及 A 股「红涨」语义撞色；**朱砂红（`--cinnabar`）为文化强调/装饰色**，用于点缀而非功能状态。宋瓷语义色（汝窑天青、官窑粉青、象牙白、暖灰）保留为装饰性扩展，不参与功能语义。

## 4.2 主题系统

### CSS 变量（shadcn/ui 标准）

```css
:root {
  /* ── Apple Business Design Tokens（V5 落地） ──
     Primary: Apple Blue #007AFF · Background: #F2F2F7 · Card: #FFFFFF
     Radius: 16px · Shadow: static alpha<=0.05 / floating alpha<=0.08
  */
  --background: 240 24% 96%;
  --foreground: 240 3% 12%;
  --card: 0 0% 100%;
  --card-foreground: 240 3% 12%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 3% 12%;
  --primary: 210 100% 50%;        /* Apple Blue #007AFF */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 20% 98%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 20% 98%;
  --muted-foreground: 240 2% 57%;
  --accent: 240 20% 98%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 4 100% 59%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 8% 91%;
  --input: 240 8% 91%;
  --ring: 210 100% 50%;
  --radius: 1rem;
}

.dark {
  --background: 240 3% 10%;
  --foreground: 240 10% 96%;
  --card: 240 3% 14%;
  --card-foreground: 240 10% 96%;
  --popover: 240 3% 14%;
  --popover-foreground: 240 10% 96%;
  --primary: 210 100% 60%;
  --primary-foreground: 240 3% 10%;
  --secondary: 240 3% 16%;
  --secondary-foreground: 240 10% 96%;
  --muted: 240 3% 16%;
  --muted-foreground: 240 3% 60%;
  --accent: 240 3% 20%;
  --accent-foreground: 240 10% 96%;
  --destructive: 4 100% 67%;
  --destructive-foreground: 240 3% 10%;
  --border: 240 3% 24%;
  --input: 240 3% 24%;
  --ring: 210 100% 60%;
}
```

### 语义色扩展

```css
:root {
  --ru-blue: 205 35% 70%;       /* 汝窑天青 */
  --guan-green: 145 15% 65%;    /* 官窑粉青 */
  --cinnabar: 5 65% 52%;        /* 朱砂红 */
  --ivory: 40 33% 94%;          /* 象牙白 */
  --warm-gray: 30 12% 90%;      /* 暖灰 */
}
```

### 使用规范

- 背景：`bg-background`
- 主文字：`text-foreground`
- 次要文字：`text-muted-foreground`
- 主按钮：`bg-primary text-primary-foreground`
- 危险操作：`bg-destructive text-destructive-foreground`
- 边框：`border-border`
- 聚焦环：`ring-ring`

## 4.3 布局系统

### 五舱布局（PortalShell）

当前实现采用 **Kimi 经典深色布局**：

```
┌─────────────────────────────────────────────────────────────┐
│  56px 顶部状态栏：Logo 徽章 | 五舱 Tab | 采集健康 | 运行时长 | 版本  │
├─────────────────────┬───────────────────────────────────────┤
│                     │                                       │
│  260px 左侧分组      │    右侧主内容区                        │
│  功能侧边栏          │    （子页面 / Tab 切换）                │
│  （按舱分组标题）     │                                       │
│                     │                                       │
└─────────────────────┴───────────────────────────────────────┘
```

设计要点：

- 根容器始终添加 `dark` 类，使用 `theme.colors.background` 等 HSL 变量。
- 首页（`/`）与驾驶舱（`/cockpit`）保持浅色主题，其余舱室在深色壳内渲染。
- 左侧边栏按「常用 / 采集 / 工具」分组展示子导航，组标题仅视觉分组，不触发跳转。
- 主内容区统一 `p-6` 内边距，`overflow-auto` 可滚动。

### 五舱布局（早期规划）

```
┌─────────────────────────────────────┐
│  顶部导航栏：首页 | 输入 | 分析 | 交易 | 输出 | 总控 | 驾驶舱  │
├──────────┬──────────────────────────┤
│          │                          │
│ 左侧面板 │    右侧执行界面           │
│ （一级   │    （Tab/子页面切换）      │
│  功能）  │                          │
│          │                          │
├──────────┴──────────────────────────┤
│  底部状态栏                          │
└─────────────────────────────────────┘
```

### 驾驶舱布局（CockpitShell）

```
┌─────────────────────────────────────┐
│  顶部栏：标题 | 时间 | 刷新 | 设置   │
├─────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ W1 │ │ W2 │ │ W3 │ │ W4 │      │
│  └────┘ └────┘ └────┘ └────┘      │
│  ┌────┐ ┌────┐ ┌────┐              │
│  │ W5 │ │ W6 │ │ W7 │              │
│  └────┘ └────┘ └────┘              │
├─────────────────────────────────────┤
│  底部状态栏                          │
└─────────────────────────────────────┘
```

### 驾驶舱 Widget 架构规范

驾驶舱采用可插拔 Widget 架构，支持用户自定义布局与内容。

**Widget 定义规范**：
```ts
interface WidgetDefinition {
  id: string;
  name: string;
  category: 'market' | 'portfolio' | 'strategy' | 'agent';
  icon: string;
  defaultSize: { cols: number; rows: number };
  defaultPosition: { x: number; y: number };
  component: React.ComponentType<WidgetProps>;
  dataChannels: string[];      // 订阅的数据通道
  dependencies: string[];      // 依赖的 Widget
}
```

**Widget 生命周期**：
```
mount → initData → subscribeChannels → render → updateData → unsubscribeChannels → unmount
```

**Widget 分类与清单**：

| 分类 | Widget ID | 名称 | 默认尺寸 | 说明 |
|------|-----------|------|----------|------|
| **市场类** | `market-overview` | 市场概览 | 4x2 | 大盘指数、涨跌家数、热点板块 |
| **市场类** | `market-index` | 指数行情 | 4x3 | 主要指数 K 线图 |
| **市场类** | `market-news` | 财经新闻 | 4x2 | 实时财经新闻流 |
| **持仓类** | `portfolio-summary` | 组合概览 | 6x2 | 总资产、盈亏、仓位分布 |
| **持仓类** | `portfolio-holdings` | 持仓明细 | 6x3 | 持仓股票列表与盈亏 |
| **策略类** | `strategy-signals` | 交易信号 | 6x2 | 观察池信号汇总 |
| **策略类** | `strategy-rotation` | 板块轮动 | 6x2 | 行业轮动评分与建议 |
| **策略类** | `strategy-score` | 评分监控 | 4x2 | 高分股票实时监控 |
| **Agent类** | `agent-status` | Agent状态 | 4x2 | Agent运行状态与健康度 |
| **Agent类** | `agent-tasks` | 任务队列 | 4x3 | 当前任务与进度 |
| **Agent类** | `agent-logs` | 日志流 | 4x3 | Agent执行日志 |

**Widget 事件联动**：
- 使用 `WidgetEventBus` 进行跨 Widget 通信
- 事件名格式：`widget:{widgetId}:{event}`
- 支持数据同步与状态同步

**当前状态**：✅ 已实现。`App.tsx` 通过 `widgetEngine.preloadComponents` 预热 Widget 组件，驾驶舱支持可配置 Widget 网格。详见 `src/components/templates/CockpitLayout.tsx`。

### 图表组件规范

数据可视化是驾驶舱与分析舱的核心能力，需引入专业图表库。

**图表库选型**：
- **轻量级 K 线图**：`lightweight-charts`（高性能、专注金融图表）
- **通用图表**：`recharts`（React 友好、功能丰富）

**图表组件清单**：

| 组件 | 路径 | 说明 |
|------|------|------|
| LineChart | `src/components/chart/LineChart.tsx` | 折线图 |
| BarChart | `src/components/chart/BarChart.tsx` | 柱状图 |
| CandlestickChart | `src/components/chart/CandlestickChart.tsx` | K 线图 |
| AreaChart | `src/components/chart/AreaChart.tsx` | 面积图 |
| ScoreRadar | `src/components/chart/ScoreRadar.tsx` | 评分雷达图 |
| FactorHeatmap | `src/components/chart/FactorHeatmap.tsx` | 因子热力图 |

**图表交互规范**：
- 支持悬停 tooltip 显示详细数据
- 支持缩放与平移
- 支持时间范围选择
- 支持数据导出

**当前状态**：✅ 已实现。图表组件库完整（19 个文件），覆盖 LineChart、BarChart、CandlestickChart、AreaChart、ScoreRadar、FactorHeatmap 等。K 线图使用 `lightweight-charts`，通用图表使用 `recharts`。详见 `src/components/chart/`。

## 4.4 股票池 UI 规范

### 池视图（PoolView）

每个股票池统一使用 `PoolView` 组件展示：

```
┌─────────────────────────────────────┐
│  [图标] 池名称              [刷新]  │
├─────────────────────────────────────┤
│  ┌─────┬─────┬─────┬─────┐         │
│  │股票1│股票2│股票3│股票4│         │
│  └─────┴─────┴─────┴─────┘         │
│  ┌─────┬─────┬─────┐               │
│  │股票5│股票6│股票7│               │
│  └─────┴─────┴─────┘               │
├─────────────────────────────────────┤
│  空状态：前往输入舱添加候选股票      │
└─────────────────────────────────────┘
```

### 股票卡片（PoolCard）

```
┌─────────────────────┐
│  600519.SH          │
│  贵州茅台            │
│  价格: ￥1688.00     │
│  分组: [核心持仓]   │
│  V6: 4.2 / 5.0      │
│  [推送到观察池]      │
└─────────────────────┘
```

- 卡片展示当前所属分组（未指定时显示「默认分组」）。
- 提供「移入分组」下拉，快速将标的切换到其他分组；分组切换不影响研究状态流转。

### 股票池分组（PoolGroup）

分组是用户自定义的展示/筛选维度，与 `researchStatus` 五态流转解耦：

- **分组筛选器**：位于 `StockPoolBoardPage` 股票池看板工具栏（原 `InputDashboard` 看板已迁移至分析舱），选项包含「全部组」及所有已存在的分组。
- **新建分组**：通过工具栏「新建分组」按钮打开弹窗输入分组名称，创建后自动选中并可用于后续录入。
- **录入时指定分组**：单条录入、批量导入、热门板块加池均支持选择目标分组，未选择时使用默认分组。
- **批量移入分组**：选中多个标的后，可通过「批量移入分组」下拉将标的统一移动到目标分组。
- **列表视图**：`PoolList` 表头包含「分组」列，行内可直接下拉切换分组。

## 4.5 组件库清单

> **v2.1.0 变更**：组件库按原子设计（Atomic Design）分层，分为 `atoms`、`molecules`、`organisms`、`templates` 四级。
> 详见 `../reference/atomic-component-system.md` 与 `src/components/componentRegistry.ts`。
> 过渡期内 `src/components/ui/` 仍保留兼容 shim，但新增组件须按原子层级放置。

### 原子组件（Atoms）

| 组件 | 路径 | 说明 |
|------|------|------|
| Button | src/components/atoms/Button.tsx（shim: `src/components/atoms/Button.tsx`） | 主/次/危险/幽灵按钮 |
| Card | `src/components/atoms/Card.tsx` | 卡片容器 |
| Input | `src/components/atoms/Input.tsx` | 文本输入 |
| Badge | `src/components/atoms/Badge.tsx` | 状态徽章 |
| Progress | `src/components/atoms/Progress.tsx` | 进度条 |
| Skeleton | `src/components/molecules/states/Skeleton.tsx` | 加载骨架 |
| Checkbox | `src/components/atoms/Checkbox.tsx` | 复选框 |
| Textarea | `src/components/atoms/Textarea.tsx` | 多行文本输入 |
| Select | `src/components/atoms/Select.tsx` | 选择器 |
| Radio | `src/components/atoms/Radio.tsx` | 单选 |
| Switch | `src/components/atoms/Switch.tsx` | 开关 |
| Slider | `src/components/atoms/Slider.tsx` | 滑块 |
| Toggle | `src/components/atoms/Toggle.tsx` | 切换 |
| Tooltip | `src/components/atoms/Tooltip.tsx` | 工具提示 |
| Popover | `src/components/atoms/Popover.tsx（已废弃，不再使用）` | 气泡卡片 |
| Sheet | `src/components/atoms/Sheet.tsx` | 抽屉 |
| Toast | `src/components/atoms/Toaster.tsx` | 轻提示 |
| Menu | `src/components/atoms/Menu.tsx（已废弃，不再使用）` | 菜单 |
| Pagination | `src/pages/trading/components/Pagination.tsx` | 分页 |
| Breadcrumb | `src/components/atoms/Breadcrumb.tsx` | 面包屑 |
| Result | `src/components/atoms/Result.tsx（已废弃，不再使用）` | 结果展示 |
| List | `src/components/atoms/List.tsx（已废弃，不再使用）` | 列表 |
| Grid | `src/components/atoms/Grid.tsx（已废弃，不再使用）` | 栅格 |
| Table | `src/components/atoms/Table.tsx` | 表格 |
| DatePicker | `src/components/atoms/DatePicker.tsx（已废弃，不再使用）` | 日期选择 |
| StockPriceChange | `src/components/atoms/StockPriceChangeBadge.tsx` | 股价变化 |

### 分子组件（Molecules）

| 组件 | 路径 | 说明 |
|------|------|------|
| Dialog | `src/components/molecules/Dialog.tsx` | 模态对话框 |
| Tabs | `src/components/molecules/Tabs.tsx` | 标签页 |
| Alert | `src/components/molecules/Alert.tsx` | 警告提示 |
| DataState | `src/components/molecules/DataState.tsx` | 加载/空/错误状态 |
| ErrorState | `src/components/molecules/ErrorState.tsx` | 错误状态 |
| EmptyState | `src/components/molecules/EmptyState.tsx` | 空状态 |
| LoadingState | `src/components/molecules/LoadingState.tsx` | 加载状态 |
| PageHeader | `src/components/templates/PageHeader.tsx` | 页面标题 + 操作区 |
| FormField | `src/components/molecules/FormField.tsx` | 表单字段（Label + 控件 + 错误） |
| MetricCard | `src/components/molecules/MetricCard.tsx` | 指标卡（标题 + 数值 + 趋势） |
| SearchBar | `src/components/molecules/SearchBar.tsx` | 搜索栏 |
| FilterChip | `src/components/molecules/FilterChip.tsx` | 可关闭筛选标签 |

### 有机体组件（Organisms）

| 组件 | 路径 | 说明 |
|------|------|------|
| StockSearch | `src/components/organisms/input/StockSearch.tsx` | 股票搜索组件 |
| QualityIndicator | `src/components/organisms/input/QualityIndicator.tsx` | 数据质量指示 |
| PoolBoard | `src/components/organisms/pool/PoolBoard.tsx` | 股票池看板 |
| PoolCard | `src/components/organisms/pool/PoolCard.tsx` | 股票卡片 |
| PoolList | `src/components/organisms/pool/PoolList.tsx` | 股票列表视图 |
| CollectionProgressPanel | `src/components/organisms/collection/CollectionProgressPanel.tsx` | 采集进度面板 |
| CollectionReportPanel | `src/components/organisms/collection/CollectionReportPanel.tsx` | 采集汇报面板 |
| ScoreFactorDeltaPanel | `src/components/organisms/shared/ScoreFactorDeltaPanel.tsx` | 评分因子变化面板 |
| ScoreUpdateAlert | `src/components/organisms/shared/ScoreUpdateAlert.tsx` | 评分更新提醒 |
| ErrorBoundary | `src/components/organisms/shared/ErrorBoundary.tsx` | 错误边界组件 |

### 图表组件

| 组件 | 路径 | 说明 |
|------|------|------|
| LineChart | `src/components/chart/LineChart.tsx` | 折线图 |
| BarChart | `src/components/chart/BarChart.tsx` | 柱状图 |
| CandlestickChart | `src/components/chart/CandlestickChart.tsx` | K 线图 |
| AreaChart | `src/components/chart/AreaChart.tsx` | 面积图 |
| ScoreRadar | `src/components/chart/ScoreRadar.tsx` | 评分雷达图 |
| FactorHeatmap | `src/components/chart/FactorHeatmap.tsx` | 因子热力图 |

### 模板组件（Templates）

| 组件 | 路径 | 说明 |
|------|------|------|
| PageContainer | `src/components/templates/PageContainer.tsx` | 页面内容容器 |
| DashboardLayout | `src/components/templates/DashboardLayout.tsx` | 仪表盘布局 |
| SidebarLayout | `src/components/templates/SidebarLayout.tsx` | 侧边栏布局 |
| CockpitLayout | `src/components/templates/CockpitLayout.tsx` | 驾驶舱布局 |

## 4.6 响应式断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| `sm` | ≥ 640px | 手机横屏 |
| `md` | ≥ 768px | 平板 |
| `lg` | ≥ 1024px | 小桌面 |
| `xl` | ≥ 1280px | 大桌面 |

### 五舱响应式规则

- `< md`：左侧功能面板可折叠，默认隐藏
- `≥ md`：左侧功能面板固定显示
- `≥ lg`：右侧执行界面可并排显示多个面板

## 4.7 动画与交互

- 页面切换：`fade + slide`，200ms
- 数据加载：骨架屏，禁止 spinner 长时间空转
- 操作反馈：Toast 提示，成功/失败明确区分
- 按钮点击：scale 0.98 微动效
- 卡片悬停：shadow 提升

## 4.8 字体与排版

- 字体：系统默认无衬线字体栈
- 标题：`text-xl font-semibold`
- 正文：`text-sm text-foreground`
- 辅助：`text-xs text-muted-foreground`
- 数值：等宽数字字体（`font-variant-numeric: tabular-nums`）

---

## 4.9 版本比对

本文档当前版本为 `v0.9.0-docs-review`，与规划基线 `v0.9.0-docs-base` 的差异见：

- `../reference/architecture-version-comparison.md`

主要变化：

1. PortalShell 布局更新为 Kimi 经典深色布局：56px 顶部栏 + 260px 分组侧边栏。
2. 明确首页/驾驶舱保持浅色，其余舱室在深色壳内渲染。
3. 增加输入舱子页面布局说明。
