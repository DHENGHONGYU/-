---
title: V9 图表组件集成规格
type: reference
domain: frontend
phase: development
tier: important
status: draft
maintainer: V9 Architecture Team
summary: "本文档规定 V9 分析舱与驾驶舱中所有金融/指标图表的技术选型、组件 API、与数据层的对接方式以及性能优化策略。不覆盖通用 UI 组件（Button/Card 等）与表格渲染。"
tags: [frontend, integration, component, visualization, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-FRONT-009
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-331, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 图表组件集成规格

> **对应蓝图**：`./v9-system-blueprint.md` §2 技术栈（图表选型）、§7.3 图表组件规范、§10 偏差项 D16「缺少图表组件库」。
> **依赖文档**：`./dataflow-data-definition.md`（数据流引擎通道定义）、`./04-ui-ux-specs.md`（图表交互规范）。

---

## 1. 目标与范围

本文档规定 V9 分析舱与驾驶舱中所有金融/指标图表的技术选型、组件 API、与数据层的对接方式以及性能优化策略。不覆盖通用 UI 组件（Button/Card 等）与表格渲染。

---

## 2. 图表技术选型

### 2.1 选型结论

| 库 | 用途 | 安装命令 | 选型理由 |
|---|---|---|---|
| `lightweight-charts` | K 线图、分时图、成交量 | `npm i lightweight-charts` | 金融场景专用，60 FPS 渲染，内置时间轴、十字光标、缩放平移 |
| `recharts` | 折线/柱状/面积/雷达/热力图 | `npm i recharts` | React 声明式 API，与组件生命周期天然契合 |

> 详细 UI 规范见 `./04-ui-ux-specs.md` §4.3「图表组件规范」。

### 2.2 分层封装策略

```
┌─────────────────────────────────────────────┐
│  L5 业务组件（分析舱/驾驶舱）                  │
│  StockChart, IndicatorChart, ScoreRadar     │
├─────────────────────────────────────────────┤
│  L4 图表包装层（src/components/chart/）       │
│  CandlestickChart, LineChart, BarChart      │
├─────────────────────────────────────────────┤
│  L3 数据适配（src/services/chart/）           │
│  klineAdapter, indicatorAdapter             │
├─────────────────────────────────────────────┤
│  L2 数据层（DataBridge / DataFlowEngine）     │
│  daily_quotes, strategy:score, market:index │
└─────────────────────────────────────────────┘
```

---

## 3. 组件 API 定义

### 3.1 StockChart（K 线主图）

```tsx
// src/components/chart/StockChart.tsx
import type { DataPacket } from '@/core/dataflow/dataflowTypes'

export interface KlineData {
  time: number          // Unix 秒（lightweight-charts 要求）
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockChartProps {
  symbol: string
  channel?: 'market:index' | 'strategy:signal' | string
  interval?: '1d' | '1w' | '1M'
  height?: number
  showVolume?: boolean
  onCrosshairMove?: (data: KlineData | null) => void
}

export function StockChart(props: StockChartProps): JSX.Element
```

### 3.2 IndicatorChart（指标副图）

```tsx
// src/components/chart/IndicatorChart.tsx
export interface IndicatorSeries {
  key: string
  name: string
  color: string
  data: { time: number; value: number }[]
}

export interface IndicatorChartProps {
  title: string
  series: IndicatorSeries[]
  height?: number
  syncSymbol?: string          // 与 StockChart 同步十字光标
  emptyText?: string
}

export function IndicatorChart(props: IndicatorChartProps): JSX.Element
```

### 3.3 基础图表组件清单

| 组件 | 路径 | 底层库 | 说明 |
|------|------|--------|------|
| `CandlestickChart` | `src/components/chart/CandlestickChart.tsx` | lightweight-charts | K 线 + 成交量 |
| `LineChart` | `src/components/chart/LineChart.tsx` | recharts | 折线/面积 |
| `BarChart` | `src/components/chart/BarChart.tsx` | recharts | 柱状 |
| `ScoreRadar` | `src/components/chart/ScoreRadar.tsx` | recharts | 九维评分雷达 |
| `FactorHeatmap` | `src/components/chart/FactorHeatmap.tsx` | recharts | 因子热力 |

---

## 4. 与 DataBridge / DataFlow 的数据对接

### 4.1 数据流订阅模型

图表不直接读取 IndexedDB，而是通过 `DataFlowEngine.subscribe()` 订阅通道。具体通道定义见 `./dataflow-data-definition.md` §2。

```ts
// src/services/chart/klineAdapter.ts
import { dataFlowEngine } from '@/core/dataflow/dataflowEngine'
import type { DataPacket } from '@/core/dataflow/dataflowTypes'
import type { KlineData } from '@/components/chart/StockChart'

export function subscribeKline(
  symbol: string,
  onData: (data: KlineData[]) => void,
): () => void {
  const channel = `stock:kline:${symbol}`
  return dataFlowEngine.subscribe<KlineData[]>(channel, (packet: DataPacket<KlineData[]>) => {
    onData(packet.data)
  })
}
```

### 4.2 数据注册（引擎层）

```ts
// src/services/chart/chartDataRegistrar.ts
import { dataFlowEngine } from '@/core/dataflow/dataflowEngine'
import { dataLayer } from '@/data/dataLayer'

export function registerKlineRefresh(symbol: string, intervalMs = 60_000): void {
  const channel = `stock:kline:${symbol}`
  dataFlowEngine.registerRefresh(
    channel,
    () => dataLayer.dailyQuotes.get(symbol).then((q) => q?.kline ?? []),
    intervalMs,
  )
}
```

### 4.3 与 StandardEnvelope 的映射

| 图表数据 | 来源 Store | Envelope Action | 通道名 |
|----------|------------|-----------------|--------|
| K 线 | `daily_quotes` | `SAVE_DAILY_QUOTES` | `stock:kline:${symbol}` |
| 评分时间序列 | `v6_scores` | `UPDATE_SCORE` | `strategy:score` |
| 大盘指数 | `daily_quotes` | `SAVE_DAILY_QUOTES` | `market:index` |
| 板块轮动 | `rotation_scores` | `UPDATE_ROTATION_SCORE` | `market:sector` |

> Envelope 规范见 `./v9-system-blueprint.md` §5.1。

---

## 5. 性能优化策略

### 5.1 数据量控制

| 场景 | 策略 | 阈值 |
|------|------|------|
| K 线初始加载 | 按区间分页：1 年/3 年/全部 | 单次 ≤ 500 条 |
| 实时追加 | 增量更新，不重置全量 | 内存缓存最近 200 条 |
| 缩放 | 可视区动态采样（LTTB） | 可视区 ≤ 150 点 |
| 多图同屏 | 共享 DataFlow 订阅，避免重复 fetch | 同 symbol 仅 1 个注册 |

### 5.2 刷新频率

```ts
// src/services/chart/chartRefreshPolicy.ts
export const CHART_REFRESH_POLICY = {
  kline: { interval: 60_000, priority: 'normal' as const },
  intraday: { interval: 5_000, priority: 'high' as const },
  score: { interval: 60_000, priority: 'normal' as const },
  marketIndex: { interval: 5_000, priority: 'high' as const },
}
```

### 5.3 渲染优化

1. **防抖 resize**：图表容器尺寸变化时使用 `ResizeObserver` + `requestAnimationFrame` 防抖。
2. **离屏销毁**：组件卸载时调用 `chart.remove()` 释放 WebGL/Canvas 上下文。
3. **颜色常量化**：所有图表颜色从 `src/constants/theme.tokens.ts` 读取，禁止硬编码。
4. **懒加载**：页面级图表使用 `React.lazy(() => import('@/components/chart/StockChart'))`。

---

## 6. 验收标准

- [ ] `npm run tsc` 通过，新增图表类型无 `any`。
- [ ] `npm run lint` 通过，图表颜色/阈值全部来自 constants。
- [ ] 分析舱 `/analysis/stock-score/:symbol` 可渲染 K 线与评分雷达。
- [ ] 驾驶舱 `MarketIndicesWidget` 使用 `IndicatorChart` 展示大盘走势。
- [ ] Lighthouse Performance ≥ 80（3G 慢网，首屏图表渲染 ≤ 2s）。

---

## 7. 相关链接

- `./v9-system-blueprint.md` §2、§7.3、D16
- `./04-ui-ux-specs.md` §4.3
- `./dataflow-data-definition.md`
- `./feedback-loop-spec.md`（图表加载失败时的 Toast 反馈）
- `./widget-error-handling.md`（图表 Widget 的错误边界）
