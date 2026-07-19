---
title: 04. UI/UX 规范
type: reference
domain: frontend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "04. UI/UX 规范 - reference documentation (frontend)"
tags: [frontend, spec, standards, component, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-007
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 04. UI/UX 规范

> **Status**: Current  
> **Version**: v2.5.0  
> **Last Updated**: 2026-07-05
>
> **设计参�?*：https://hslqownhhwaig.ok.kimi.link/  
> **设计特征**：PWA 移动端优先、shadcn/ui 组件体系、HSL CSS 变量主题、widget 化驾驶舱、翡翠绿强调色�?
## 4.1 设计原则

1. **移动端优�?*：主要使用场景为平板/桌面研究，但需适配移动端浏览�?2. **PWA 体验**：可安装、离线可用、主题色 `#0D9165`（翡翠绿）�?3. **Widget �?*：驾驶舱由可配置 Widget 网格组成�?4. **五舱工作�?*：输�?�?分析 �?交易 �?输出 �?总控，不切屏�?5. **宋瓷美学 + 现代极简**：以象牙�?暖灰为底，翡翠绿为行动色。功能�?*警示色为琥珀（amber，`--warning: 38 92% 50%`�?*——避免与错误色（`--destructive` 红）�?A 股「红涨」语义撞色；**朱砂红（`--cinnabar`）为文化强调/装饰�?*，用于点缀而非功能状态�?
## 4.2 主题系统

### CSS 变量（shadcn/ui 标准�?
```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 160 84% 31%;        /* 翡翠�?#0D9165 */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 160 84% 31%;
  --radius: 0.625rem;
}
```

### 语义色扩�?
```css
:root {
  --ru-blue: 205 35% 70%;       /* 汝窑天青 */
  --guan-green: 145 15% 65%;    /* 官窑粉青 */
  --cinnabar: 5 65% 52%;        /* 朱砂�?*/
  --ivory: 40 33% 94%;          /* 象牙�?*/
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

### 五舱布局（PortalShell�?
当前实现采用 **Kimi 经典深色布局**�?
```
┌─────────────────────────────────────────────────────────────�?�? 56px 顶部状态栏：Logo 徽章 | 五舱 Tab | 采集健康 | 运行时长 | 版本  �?├─────────────────────┬───────────────────────────────────────�?�?                    �?                                      �?�? 260px 左侧分组      �?   右侧主内容区                        �?�? 功能侧边�?         �?   （子页面 / Tab 切换�?               �?�? （按舱分组标题）     �?                                      �?�?                    �?                                      �?└─────────────────────┴───────────────────────────────────────�?```

设计要点�?
- 根容器始终添�?`dark` 类，使用 `theme.colors.background` �?HSL 变量�?- 首页（`/`）与驾驶舱（`/cockpit`）保持浅色主题，其余舱室在深色壳内渲染�?- 左侧边栏按「常�?/ 采集 / 工具」分组展示子导航，组标题仅视觉分组，不触发跳转�?- 主内容区统一 `p-6` 内边距，`overflow-auto` 可滚动�?
### 五舱布局（早期规划）

```
┌─────────────────────────────────────�?�? 顶部导航栏：首页 | 输入 | 分析 | 交易 | 输出 | 总控 | 驾驶�? �?├──────────┬──────────────────────────�?�?         �?                         �?�?左侧面板 �?   右侧执行界面           �?�?（一�?  �?   （Tab/子页面切换）      �?�? 功能�? �?                         �?�?         �?                         �?├──────────┴──────────────────────────�?�? 底部状态栏                          �?└─────────────────────────────────────�?```

### 驾驶舱布局（CockpitShell�?
```
┌─────────────────────────────────────�?�? 顶部栏：标题 | 时间 | 刷新 | 设置   �?├─────────────────────────────────────�?�? ┌────�?┌────�?┌────�?┌────�?     �?�? �?W1 �?�?W2 �?�?W3 �?�?W4 �?     �?�? └────�?└────�?└────�?└────�?     �?�? ┌────�?┌────�?┌────�?             �?�? �?W5 �?�?W6 �?�?W7 �?             �?�? └────�?└────�?└────�?             �?├─────────────────────────────────────�?�? 底部状态栏                          �?└─────────────────────────────────────�?```

### 驾驶�?Widget 架构规范

驾驶舱采用可插拔 Widget 架构，支持用户自定义布局与内容�?
**Widget 定义规范**�?```ts
interface WidgetDefinition {
  id: string;
  name: string;
  category: 'market' | 'portfolio' | 'strategy' | 'agent';
  icon: string;
  defaultSize: { cols: number; rows: number };
  defaultPosition: { x: number; y: number };
  component: React.ComponentType<WidgetProps>;
  dataChannels: string[];      // 订阅的数据通道
  dependencies: string[];      // 依赖�?Widget
}
```

**Widget 生命周期**�?```
mount �?initData �?subscribeChannels �?render �?updateData �?unsubscribeChannels �?unmount
```

**Widget 分类与清�?*�?
| 分类 | Widget ID | 名称 | 默认尺寸 | 说明 |
|------|-----------|------|----------|------|
| **市场�?* | `market-overview` | 市场概览 | 4x2 | 大盘指数、涨跌家数、热点板�?|
| **市场�?* | `market-index` | 指数行情 | 4x3 | 主要指数 K 线图 |
| **市场�?* | `market-news` | 财经新闻 | 4x2 | 实时财经新闻�?|
| **持仓�?* | `portfolio-summary` | 组合概览 | 6x2 | 总资产、盈亏、仓位分�?|
| **持仓�?* | `portfolio-holdings` | 持仓明细 | 6x3 | 持仓股票列表与盈�?|
| **策略�?* | `strategy-signals` | 交易信号 | 6x2 | 观察池信号汇�?|
| **策略�?* | `strategy-rotation` | 板块轮动 | 6x2 | 行业轮动评分与建�?|
| **策略�?* | `strategy-score` | 评分监控 | 4x2 | 高分股票实时监控 |
| **Agent�?* | `agent-status` | Agent状�?| 4x2 | Agent运行状态与健康�?|
| **Agent�?* | `agent-tasks` | 任务队列 | 4x3 | 当前任务与进�?|
| **Agent�?* | `agent-logs` | 日志�?| 4x3 | Agent执行日志 |

**Widget 事件联动**�?- 使用 `WidgetEventBus` 进行�?Widget 通信
- 事件名格式：`widget:{widgetId}:{event}`
- 支持数据同步与状态同�?
**当前状�?*：�?`CockpitShell.tsx` 为静态页面，缺少 Widget 框架�?
### 图表组件规范

数据可视化是驾驶舱与分析舱的核心能力，需引入专业图表库�?
**图表库选型**�?- **轻量�?K 线图**：`lightweight-charts`（高性能、专注金融图表）
- **通用图表**：`recharts`（React 友好、功能丰富）

**图表组件清单**�?
| 组件 | 路径 | 说明 |
|------|------|------|
| LineChart | `src/components/chart/LineChart.tsx` | 折线�?|
| BarChart | `src/components/chart/BarChart.tsx` | 柱状�?|
| CandlestickChart | `src/components/chart/CandlestickChart.tsx` | K 线图 |
| AreaChart | `src/components/chart/AreaChart.tsx` | 面积�?|
| ScoreRadar | `src/components/chart/ScoreRadar.tsx` | 评分雷达�?|
| FactorHeatmap | `src/components/chart/FactorHeatmap.tsx` | 因子热力�?|

**图表交互规范**�?- 支持悬停 tooltip 显示详细数据
- 支持缩放与平�?- 支持时间范围选择
- 支持数据导出

**当前状�?*：�?未实现。缺少图表组件�?
## 4.4 股票�?UI 规范

### 池视图（PoolView�?
每个股票池统一使用 `PoolView` 组件展示�?
```
┌─────────────────────────────────────�?�? [图标] 池名�?             [刷新]  �?├─────────────────────────────────────�?�? ┌─────┬─────┬─────┬─────�?        �?�? │股�?│股�?│股�?│股�?�?        �?�? └─────┴─────┴─────┴─────�?        �?�? ┌─────┬─────┬─────�?              �?�? │股�?│股�?│股�?�?              �?�? └─────┴─────┴─────�?              �?├─────────────────────────────────────�?�? 空状态：前往输入舱添加候选股�?     �?└─────────────────────────────────────�?```

### 股票卡片（PoolCard�?
```
┌─────────────────────�?�? 600519.SH          �?�? 贵州茅台            �?�? 价格: ¥1688.00     �?�? 分组: [核心持仓]   �?�? V6: 4.2 / 5.0      �?�? [推送到观察池]      �?└─────────────────────�?```

- 卡片展示当前所属分组（未指定时显示「默认分组」）�?- 提供「移入分组」下拉，快速将标的切换到其他分组；分组切换不影响研究状态流转�?
### 股票池分组（PoolGroup�?
分组是用户自定义的展�?筛选维度，�?`researchStatus` 五态流转解耦：

- **分组筛选器**：位�?`StockPoolBoardPage` 股票池看板工具栏（原 `InputDashboard` 看板已迁移至分析舱），选项包含「全部组」及所有已存在的分组�?- **新建分组**：通过工具栏「新建分组」按钮打开弹窗输入分组名称，创建后自动选中并可用于后续录入�?- **录入时指定分�?*：单条录入、批量导入、热门板块加池均支持选择目标分组，未选择时使用默认分组�?- **批量移入分组**：选中多个标的后，可通过「批量移入分组」下拉将标的统一移动到目标分组�?- **列表视图**：`PoolList` 表头包含「分组」列，行内可直接下拉切换分组�?
## 4.5 组件库清�?
> **v2.1.0 变更**：组件库按原子设计（Atomic Design）分层，分为 `atoms`、`molecules`、`organisms`、`templates` 四级�?> 详见 `./atomic-component-system.md` �?`src/components/componentRegistry.ts`�?> 过渡期内 `src/components/ui/` 仍保留兼�?shim，但新增组件须按原子层级放置�?
### 原子组件（Atoms�?
| 组件 | 路径 | 说明 |
|------|------|------|
| Button | `src/components/atoms/Button.tsx`（shim: `src/components/atoms/Button.tsx`�?| �?�?危险/幽灵按钮 |
| Card | `src/components/atoms/Card.tsx` | 卡片容器 |
| Input | `src/components/atoms/Input.tsx` | 文本输入 |
| Badge | `src/components/atoms/Badge.tsx` | 状态徽�?|
| Progress | `src/components/atoms/Progress.tsx` | 进度�?|
| Skeleton | `src/components/atoms/Skeleton.tsx` | 加载骨架 |
| Checkbox | `src/components/atoms/Checkbox.tsx` | 复选框 |
| Textarea | `src/components/atoms/Textarea.tsx` | 多行文本输入 |
| Select | `src/components/atoms/Select.tsx` | 选择�?|
| Radio | `src/components/atoms/Radio.tsx` | 单�?|
| Switch | `src/components/atoms/Switch.tsx` | 开�?|
| Slider | `src/components/atoms/Slider.tsx` | 滑块 |
| Toggle | `src/components/atoms/Toggle.tsx` | 切换 |
| Tooltip | `src/components/atoms/Tooltip.tsx` | 工具提示 |
| Popover | `src/components/atoms/Popover.tsx ` | 气泡卡片 |
| Sheet | `src/components/atoms/Sheet.tsx` | 抽屉 |
| Toast | `src/components/atoms/Toast.tsx` | 轻提�?|
| Menu | `src/components/atoms/Menu.tsx ` | 菜单 |
| Pagination | `src/components/atoms/Pagination.tsx ` | 分页 |
| Breadcrumb | `src/components/atoms/Breadcrumb.tsx` | 面包�?|
| Result | `src/components/atoms/Result.tsx` | 结果展示 |
| List | `src/components/atoms/List.tsx ` | 列表 |
| Grid | `src/components/atoms/Grid.tsx ` | 栅格 |
| Table | `src/components/atoms/Table.tsx` | 表格 |
| DatePicker | `src/components/atoms/DatePicker.tsx ` | 日期选择 |
| StockPriceChange | `src/components/atoms/StockPriceChange.tsx` | 股价变化 |

### 分子组件（Molecules�?
| 组件 | 路径 | 说明 |
|------|------|------|
| Dialog | `src/components/molecules/Dialog.tsx` | 模态对话框 |
| Tabs | `src/components/molecules/Tabs.tsx` | 标签�?|
| Alert | `src/components/molecules/Alert.tsx` | 警告提示 |
| DataState | `src/components/molecules/DataState.tsx` | 加载/�?错误状�?|
| ErrorState | `src/components/molecules/ErrorState.tsx` | 错误状�?|
| EmptyState | `src/components/molecules/EmptyState.tsx` | 空状�?|
| LoadingState | `src/components/molecules/LoadingState.tsx` | 加载状�?|
| PageHeader | `src/components/templates/PageHeader.tsx` | 页面标题 + 操作�?|
| FormField | `src/components/molecules/FormField.tsx` | 表单字段（Label + 控件 + 错误�?|
| MetricCard | `src/components/molecules/MetricCard.tsx` | 指标卡（标题 + 数�?+ 趋势�?|
| SearchBar | `src/components/molecules/SearchBar.tsx` | 搜索�?|
| FilterChip | `src/components/molecules/FilterChip.tsx` | 可关闭筛选标�?|

### 有机体组件（Organisms�?
| 组件 | 路径 | 说明 |
|------|------|------|
| StockSearch | `src/components/organisms/input/StockSearch.tsx` | 股票搜索组件 |
| QualityIndicator | `src/components/organisms/input/QualityIndicator.tsx` | 数据质量指示 |
| PoolBoard | `src/components/organisms/pool/PoolBoard.tsx` | 股票池看�?|
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
| LineChart | `src/components/chart/LineChart.tsx` | 折线�?|
| BarChart | `src/components/chart/BarChart.tsx` | 柱状�?|
| CandlestickChart | `src/components/chart/CandlestickChart.tsx` | K 线图 |
| AreaChart | `src/components/chart/AreaChart.tsx` | 面积�?|
| ScoreRadar | `src/components/chart/ScoreRadar.tsx` | 评分雷达�?|
| FactorHeatmap | `src/components/chart/FactorHeatmap.tsx` | 因子热力�?|

### 模板组件（Templates�?
| 组件 | 路径 | 说明 |
|------|------|------|
| PageContainer | `src/components/templates/PageContainer.tsx` | 页面内容容器 |
| DashboardLayout | `src/components/templates/DashboardLayout.tsx` | 仪表盘布局 |
| SidebarLayout | `src/components/templates/SidebarLayout.tsx` | 侧边栏布局 |
| CockpitLayout | `src/components/templates/CockpitLayout.tsx` | 驾驶舱布局 |

## 4.6 响应式断�?
| 断点 | 宽度 | 布局 |
|------|------|------|
| `sm` | �?640px | 手机横屏 |
| `md` | �?768px | 平板 |
| `lg` | �?1024px | 小桌�?|
| `xl` | �?1280px | 大桌�?|

### 五舱响应式规�?
- `< md`：左侧功能面板可折叠，默认隐�?- `�?md`：左侧功能面板固定显�?- `�?lg`：右侧执行界面可并排显示多个面板

## 4.7 动画与交�?
- 页面切换：`fade + slide`�?00ms
- 数据加载：骨架屏，禁�?spinner 长时间空�?- 操作反馈：Toast 提示，成�?失败明确区分
- 按钮点击：scale 0.98 微动�?- 卡片悬停：shadow 提升

## 4.8 字体与排�?
- 字体：系统默认无衬线字体�?- 标题：`text-xl font-semibold`
- 正文：`text-sm text-foreground`
- 辅助：`text-xs text-muted-foreground`
- 数值：等宽数字字体（`font-variant-numeric: tabular-nums`�?
---

## 4.9 版本比对

本文档当前版本为 `v0.9.0-docs-review`，与规划基线 `v0.9.0-docs-base` 的差异见�?
- `./architecture-version-comparison.md`

主要变化�?
1. PortalShell 布局更新�?Kimi 经典深色布局�?6px 顶部�?+ 260px 分组侧边栏�?2. 明确首页/驾驶舱保持浅色，其余舱室在深色壳内渲染�?3. 增加输入舱子页面布局说明�?