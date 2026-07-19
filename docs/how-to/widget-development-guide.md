---
title: Widget 开发指�?
type: how-to
domain: frontend
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "适用范围：驾驶舱（Cockpit）所�?Widget 组件的开发、注册与集成 参考模�?*：`src/cockpit/widgets/ValuePitWidget.tsx`..."
tags: [frontend, widget, guide]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---w-to
domain: frontend
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "Widget 开发指�?type: how-to document"
tags: [frontend, widget, guide]
phase: development
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# Widget 开发指�?
> **适用范围**：驾驶舱（Cockpit）所�?Widget 组件的开发、注册与集成
> **参考模�?*：`src/cockpit/widgets/ValuePitWidget.tsx`
> **关联文件**：`src/cockpit/core/widgetRegistry.ts`、`src/constants/cockpit.constants.ts`

---

## 一、Widget 开发全流程

### 1.1 流程概览

```
定义类型 �?创建组件 �?注册模板 �?添加常量配置 �?创建默认实例 �?编写测试
```

### 1.2 步骤详解

#### 步骤 1：定�?Widget 数据类型

�?`src/types/modules/widget.types.ts` 中定�?Widget 需要的数据类型�?
```typescript
// src/types/modules/widget.types.ts
export interface MyNewWidgetData {
  symbol: string
  name: string
  score: number
  // ...业务字段
}
```

同时扩展 `MarketData` 类型（如果需要由 MarketDataProvider 注入数据）�?
#### 步骤 2：创�?Widget 组件

�?`src/cockpit/widgets/` 目录下创建组件文件，参照 ValuePitWidget 的标准模式（详见第二章）�?
#### 步骤 3：添加常量配�?
�?`src/constants/cockpit.constants.ts` 中添加三处配置：

```typescript
// 1. DEFAULT_WIDGET_CONFIG �?标题、尺寸、分�?export const DEFAULT_WIDGET_CONFIG = {
  // ...已有配置
  myNewWidget: {
    title: '我的�?Widget',
    size: WIDGET_SIZE.HALF_WIDTH,
    category: 'analysis',
  },
}

// 2. WIDGET_DEFAULT_DATA_SOURCE �?数据源配�?export const WIDGET_DEFAULT_DATA_SOURCE = {
  // ...已有配置
  myNewWidget: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/my-widget/data',
    enabled: true,
  },
}
```

#### 步骤 4：注�?Widget 模板

�?`src/cockpit/core/widgetRegistry.ts` �?`registerDefaultWidgets()` 中注册：

```typescript
{
  meta: {
    id: 'myNewWidget',
    name: DEFAULT_WIDGET_CONFIG.myNewWidget.title,
    category: DEFAULT_WIDGET_CONFIG.myNewWidget.category,
    description: '我的�?Widget 功能描述',
    defaultSize: DEFAULT_WIDGET_CONFIG.myNewWidget.size,
    defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.myNewWidget,
  },
  component: () => import('@/cockpit/widgets/MyNewWidget'),
},
```

#### 步骤 5：创建默认实�?
�?`createDefaultInstances()` �?`defaultLayout` 数组中添加默认布局位置�?
```typescript
{ widgetId: 'myNewWidget', position: { x: 0, y: 39 } },
```

注意：`y` 值应递增，避免与已有 Widget 重叠�?
#### 步骤 6：编写测�?
�?`tests/` 目录下创建对应的测试文件 `tests/MyNewWidget.test.tsx`，覆�?loading/error 状态和基本渲染逻辑�?
---

## 二、Widget 组件规范（硬约束�?
### 2.1 标准 Widget 签名

所�?Widget 组件必须遵循统一签名�?
```typescript
interface WidgetProps {
  config: WidgetConfig
  data?: {
    [dataKey]: WidgetDataType
  }
}

export default function MyWidget({ config, data }: WidgetProps): React.JSX.Element
```

### 2.2 Loading 状态（硬约束）

**所�?Widget 必须处理 loading 状�?*，不允许�?loading 反馈的空白渲染：

```typescript
// 正确示范
const isLoading = useMyStore((s) => s.isLoading)

if (isLoading) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader><CardTitle>{config.title}</CardTitle></CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <span className="text-muted-foreground">加载�?..</span>
      </CardContent>
    </Card>
  )
}
```

### 2.3 Error 状态（硬约束）

**所�?Widget 必须处理 error 状�?*，展示友好的错误信息�?
```typescript
const error = useMyStore((s) => s.error)

if (error) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader><CardTitle>{config.title}</CardTitle></CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <span className="text-red-500">加载失败：{error}</span>
      </CardContent>
    </Card>
  )
}
```

### 2.4 空数据状�?
当数据为空时，展示明确的空状态提示：

```typescript
{valuePit.length === 0 ? (
  <div className="text-center text-muted-foreground py-8">暂无价值洼地策略数�?/div>
) : (
  // ...正常渲染
)}
```

### 2.5 useEffect cleanup（硬约束�?
如果 Widget 内部使用 `useEffect` 发起异步操作�?*必须使用 `cancelled` flag 模式**防止组件卸载后更新状态：

```typescript
useEffect(() => {
  let cancelled = false

  async function fetchData() {
    try {
      const result = await myService.getData()
      if (!cancelled) {
        setData(result)
      }
    } catch (err) {
      if (!cancelled) {
        setError(String(err))
      }
    }
  }

  fetchData()

  return () => {
    cancelled = true
  }
}, [/* 依赖�?*/])
```

### 2.6 导出方式

Widget 组件必须使用 **default export**，以支持 `React.lazy()` 懒加载：

```typescript
export default function MyWidget({ config, data }: WidgetProps): React.JSX.Element {
  // ...
}
```

---

## 三、Store 集成模式

### 3.1 数据获取模式

Widget 应从对应�?Zustand Store 获取数据�?loading/error 状态，不直接调用底层服务：

```typescript
// �?Store 获取状态（selector 模式�?const storeValuePit = useDualStrategyStore((s) => s.valuePitScores)
const isLoading = useDualStrategyStore((s) => s.isLoading)
const error = useDualStrategyStore((s) => s.error)

// 优先使用注入�?data，回退�?Store
const valuePit = (data?.valuePit ?? storeValuePit) ?? []
```

### 3.2 数据双通道模式

Widget 支持两种数据来源�?1. **MarketDataProvider 注入**（通过 `data` prop）�?驾驶舱标准模�?2. **Zustand Store 回退** �?当无 Provider 注入时直接从 Store 读取

```typescript
const storeData = useMyStore((s) => s.myData)
const finalData = (data?.myData ?? storeData) ?? []
```

### 3.3 Store 选择器规�?
使用细粒�?selector 避免不必要的重渲染：

```typescript
// 正确：细粒度 selector
const valuePit = useDualStrategyStore((s) => s.valuePitScores)
const isLoading = useDualStrategyStore((s) => s.isLoading)

// 错误：订阅整�?Store
const store = useDualStrategyStore()  // 任何状态变化都触发重渲�?```

---

## 四、颜色规�?
### 4.1 设计令牌系统

本项目采用双令牌系统管理颜色�?
| 令牌 | 文件 | 用�?|
|:---|:---|:---|
| `THEME_TOKENS` | `src/constants/theme.tokens.ts` | 通用 UI 令牌（颜色、尺寸、间距、圆角） |
| `COLOR_TOKENS` | `src/constants/theme.tokens.ts` | 语义化业务颜色（涨跌、状态、评分、信号） |

### 4.2 强制规则

1. **禁止硬编�?Tailwind 颜色�?*（如 `text-blue-500`、`bg-red-500`�?2. **禁止硬编�?HEX 颜色�?*（如 `color: '#3b82f6'`�?3. 所有颜色必须从 `COLOR_TOKENS` �?`THEME_TOKENS` 读取

```typescript
// 正确示范
import { COLOR_TOKENS, THEME_TOKENS } from '@/constants/theme.tokens'

// Tailwind 类名
<span className={COLOR_TOKENS.info.tailwind}>信息文本</span>

// style 属�?<span style={{ color: COLOR_TOKENS.info.hex }}>信息文本</span>

// 背景�?<div className={COLOR_TOKENS.success.bgClass}>成功背景</div>

// 通用 UI 令牌
<span className={THEME_TOKENS.color.muted}>弱化文本</span>
```

```typescript
// 错误示范 �?禁止
<span className="text-blue-500">信息文本</span>
<span style={{ color: '#3b82f6' }}>信息文本</span>
<div className="bg-red-500">错误背景</div>
```

### 4.3 业务常量中的颜色

Widget 相关的业务常量（如评分等级、状态映射）应定义在 `src/constants/cockpit.constants.ts` 中：

```typescript
// cockpit.constants.ts
export const SCORE_LEVELS = {
  EXCELLENT: { min: 80, max: 100, label: '优秀', color: '#22c55e', bgClass: 'bg-green-500' },
  GOOD: { min: 60, max: 80, label: '良好', color: '#3b82f6', bgClass: 'bg-blue-500' },
  // ...
}
```

组件中通过常量引用，不直接写颜色值：

```typescript
function getScoreColor(score: number): string {
  if (score >= SCORE_LEVELS.EXCELLENT.min / 20) return SCORE_LEVELS.EXCELLENT.color
  if (score >= SCORE_LEVELS.GOOD.min / 20) return SCORE_LEVELS.GOOD.color
  // ...
}
```

### 4.4 颜色格式选择

| 场景 | 推荐格式 | 示例 |
|:---|:---|:---|
| Tailwind className | `.tailwind` / `.bgClass` | `COLOR_TOKENS.info.tailwind` |
| React style 属�?| `.hex` / `.raw` | `COLOR_TOKENS.info.hex` |
| CSS 变量 / 图表�?| `.rgb` | `COLOR_TOKENS.info.rgb` |

---

## 五、参照模板：ValuePitWidget.tsx

以下�?ValuePitWidget 的标准模式要点总结�?
### 5.1 结构概览

```typescript
// 1. 导入
import React from 'react'
import { Gem } from 'lucide-react'              // lucide 图标
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { useDualStrategyStore } from '@/store/dualStrategyStore'  // Store
import type { WidgetConfig, ValuePitData } from '@/types/modules/widget.types'  // 类型
import { SCORE_LEVELS } from '@/constants/cockpit.constants'      // 业务常量

// 2. Props 类型
interface ValuePitWidgetProps {
  config: WidgetConfig
  data?: { valuePit?: ValuePitData[] }
}

// 3. 辅助函数（纯函数，提取到组件外部�?function getActionLabel(action): { label: string; variant: string } { /* ... */ }
function getScoreColor(score: number): string { /* ... */ }

// 4. 常量映射（提取到组件外部�?const DIMENSION_ICONS: Record<string, React.ReactNode> = { /* ... */ }
const DIMENSION_NAMES: Record<string, string> = { /* ... */ }

// 5. 组件定义（default export�?export default function ValuePitWidget({ config, data }: ValuePitWidgetProps): React.JSX.Element {
  // 5a. Store 集成（selector 模式 + data prop 回退�?  const storeValuePit = useDualStrategyStore((s) => s.valuePitScores)
  const valuePit = (data?.valuePit ?? storeValuePit) ?? []

  // 5b. JSX 渲染（Card 容器 + 空状态处理）
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Gem className="h-4 w-4" />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-4">
        {valuePit.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无数据</div>
        ) : (
          /* 正常渲染 */
        )}
      </CardContent>
    </Card>
  )
}
```

### 5.2 关键模式总结

| 模式 | ValuePitWidget 实现 | 是否必须 |
|:---|:---|:---|
| Props 签名 | `{ config, data }` | �?|
| Store selector | `useDualStrategyStore((s) => s.valuePitScores)` | �?|
| Data prop 回退 | `data?.valuePit ?? storeValuePit` | �?|
| 空数据状�?| `valuePit.length === 0 ? ...` | �?|
| Loading 状�?| 未使用（数据直接�?Store 同步提供�?| 视数据源而定 |
| Default export | `export default function` | �?|
| 颜色来源 | `SCORE_LEVELS.EXCELLENT.color`（常量） | �?|
| UI 容器 | `Card > CardHeader + CardContent` | �?|

---

## 六、Widget 开发检查清�?
开发新 Widget 时，逐项确认�?
- [ ] 数据类型定义�?`widget.types.ts`
- [ ] 组件 Props 包含 `config: WidgetConfig` �?`data?`
- [ ] 使用 `default export` 导出组件
- [ ] Loading 状态有明确 UI 反馈（骨架屏/加载提示�?- [ ] Error 状态有明确 UI 反馈（错误信�?重试按钮�?- [ ] 空数据状态有友好提示文案
- [ ] useEffect 使用 `cancelled` flag cleanup
- [ ] Store 使用细粒�?selector，避免整 Store 订阅
- [ ] 所有颜色从 `COLOR_TOKENS` / `THEME_TOKENS` / 业务常量读取
- [ ] 无硬编码 Tailwind 颜色类或 HEX �?- [ ] `DEFAULT_WIDGET_CONFIG` 已添加对应条�?- [ ] `WIDGET_DEFAULT_DATA_SOURCE` 已添加对应条�?- [ ] `widgetRegistry.ts` 已注册模�?- [ ] `createDefaultInstances()` 已添加默认布局
- [ ] 对应测试文件已创建并通过

---

## 七、已注册 Widget 清单（v1.1.0 更新�?
### 7.1 数据展示�?Widget�?2 个）

| Widget ID | 组件文件 | 分类 | 说明 |
|-----------|----------|------|------|
| `marketIndices` | `MarketIndicesWidget.tsx` | market | 大盘指数实时数据 |
| `sectorHeatmap` | `SectorHeatmapWidget.tsx` | market | 板块涨跌幅热力图 |
| `fundFlow` | `FundFlowWidget.tsx` | market | 资金流向数据 |
| `marketSentiment` | `MarketSentimentWidget.tsx` | market | 市场情绪指标 |
| `watchlist` | `WatchlistWidget.tsx` | portfolio | 自选股列表 |
| `portfolioOverview` | `PortfolioOverviewWidget.tsx` | portfolio | 持仓概览 |
| `aiTradeReview` | `AITradeReviewWidget.tsx` | strategy | AI 交易复盘分析 |
| `investmentProfile` | `InvestmentProfileWidget.tsx` | analysis | 投资画像/分析中心 |
| `stockPool` | `StockPoolWidget.tsx` | portfolio | 股票池管理与监控列表 |
| `kaiScore` | `KaiScoreWidget.tsx` | analysis | KAI 选股综合评分图谱 |
| `modelCompare` | `ModelCompareWidget.tsx` | agent | AI 大模型智能对�?|
| `stockChat` | `StockChatWidget.tsx` | agent | 个股/市场深度分析聊天 |

### 7.2 系统监控�?Widget�? 个，v1.1.0 新增�?
| Widget ID | 组件文件 | 分类 | 说明 |
|-----------|----------|------|------|
| `agentPerformance` | `AgentPerformance.tsx` | agent | Agent 执行统计与成功率 |
| `engineStatus` | `EngineStatus.tsx` | system | 引擎运行状态监�?|
| `systemArchitecture` | `SystemArchitecture.tsx` | system | 系统架构拓扑�?|
| `pnlAnalysis` | `pnlAnalysis.tsx` | strategy | 盈亏分析面板 |
| `positionControl` | `PositionControl.tsx` | strategy | 仓位控制与风�?|
| `riskMonitor` | `RiskMonitor.tsx` | strategy | 风险指标实时监控 |
| `signalMonitor` | `SignalMonitor.tsx` | strategy | 交易信号监控面板 |

### 7.3 Widget 错误隔离（v1.1.0 新增�?
所�?Widget �?`CockpitShell.tsx` �?`WidgetWrapper` 中统一包裹 `WidgetErrorBoundary`，实�?Widget 级错误隔离：

```typescript
import { WidgetErrorBoundary } from '@/components/WidgetErrorBoundary'

// WidgetWrapper 渲染管线
return (
  <WidgetErrorBoundary
    widgetId={config.widgetId}
    instanceId={config.instanceId}
    errorTitle={`${config.title} 加载异常`}
  >
    <Component config={config} data={data} />
  </WidgetErrorBoundary>
)
```

单个 Widget 的渲染错误不会导致整个驾驶舱崩溃�?
> **变更**: 2026-07-05 | v1.1.0 | 新增 7 个系统监控类 Widget 清单；新�?Widget 错误隔离说明 | 架构资产治理�?