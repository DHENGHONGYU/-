---
title: chart-integration
type: reference
domain: project
phase: maintenance
status: active
maintainer: V9 Architecture Team
summary: "详细 UI 规范见 `docs/04-ui-ux-specs.md` §4.3「图表组件规范」。"
tags: [reference, implementation]
version: v1.1.0
last_updated: 2026-07-26
code_version: 2.0.0
doc_id: V9-DOC-AUTO-BAA242
tier: T1
---

# V9 图表组件集成规格

> **对应蓝图**：`docs/explanation/implementation/v9-system-blueprint.md` §2 技术栈（图表选型）、§7.3 图表组件规范、§10 偏差项 D16「缺少图表组件库」。
> **依赖文档**：`docs/DATAFLOW_DATA_DEFINITION.md`（数据流引擎通道定义）、`docs/04-ui-ux-specs.md`（图表交互规范）。

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

> 详细 UI 规范见 `docs/04-ui-ux-specs.md` §4.3「图表组件规范」。

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

### 3.4 行业 V4 图表 5 件套（`src/components/chart/industry/`）

> 用于「行业 V4 四力模型」可视化，覆盖景气度 / 竞争格局 / 政策环境 / 技术跃迁 四个维度。

| 组件 | 路径 | 底层库 | 说明 |
|------|------|--------|------|
| `IndustryV4Panel` | `src/components/chart/industry/IndustryV4Panel.tsx` | recharts | 集成面板：综合评分 + 维度切换 + 雷达 + 子指标栏 |
| `IndustryV4Radar` | `src/components/chart/industry/IndustryV4Radar.tsx` | recharts | 多维度雷达图（支持多 series、自定义 maxValue） |
| `SubIndicatorBar` | `src/components/chart/industry/SubIndicatorBar.tsx` | recharts | 子指标条形图（支持 horizontal/vertical 布局、排序、null 过滤） |
| `TrendLineChart` | `src/components/chart/industry/TrendLineChart.tsx` | recharts | 多系列趋势折线图（支持参考线、yDomain、显示开关） |
| `ValuationDistribution` | `src/components/chart/industry/ValuationDistribution.tsx` | recharts | 估值分布直方图（含 `buildHistogram` 工具函数与高亮参考线） |

#### 3.4.1 IndustryV4Panel Props 契约

```ts
interface IndustryV4PanelProps {
  dimensions: Array<{
    name: 'prosperity' | 'competition' | 'policy' | 'technology'
    label: string
    score: number
    subIndicators: Array<{ key: string; label: string; value: number | null; maxValue?: number }>
  }>
  compositeScore: number | null
  height?: number | string           // 默认 400
  activeDimension?: V4DimensionName  // 默认 'prosperity'
  onDimensionChange?: (d: V4DimensionName) => void
  showRadar?: boolean                // 默认 true
  showSubIndicators?: boolean        // 默认 true
}
```

#### 3.4.2 数据映射约定

- **雷达图**：`dimensions → radarData`，由 `IndustryV4Radar` 内部将 `dimension` 字段重映射为 `label`（用于极角轴显示中文标签）
- **子指标栏**：`activeDim.subIndicators → SubIndicatorBar.data`，自动过滤 `value === null` 的项；`sortByValue='desc'`、`layout='vertical'`、`labelPosition='right'`（与 Panel 内默认配置一致）
- **估值分布**：`buildHistogram(values, binCount)` 返回 `ValuationDistributionBin[]`，最后一个 bin 为闭区间 `[min, max]`；`currentValue` 命中时该 Cell `fill=highlightColor` 且 `fillOpacity=1`

---

## 4. 与 DataBridge / DataFlow 的数据对接

### 4.1 数据流订阅模型

图表不直接读取 IndexedDB，而是通过 `DataFlowEngine.subscribe()` 订阅通道。具体通道定义见 `docs/DATAFLOW_DATA_DEFINITION.md` §2。

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

> Envelope 规范见 `docs/explanation/implementation/v9-system-blueprint.md` §5.1。

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
3. **颜色常量化**：所有图表颜色从 `src/constants/chart.constants.ts` 读取，禁止硬编码。
4. **懒加载**：页面级图表使用 `React.lazy(() => import('@/components/chart/StockChart'))`。

---

## 6. 验收标准

- [ ] `npm run tsc` 通过，新增图表类型无 `any`。
- [ ] `npm run lint` 通过，图表颜色/阈值全部来自 constants。
- [ ] 分析舱 `/analysis/stock-score/:symbol` 可渲染 K 线与评分雷达。
- [ ] 驾驶舱 `MarketIndicesWidget` 使用 `IndicatorChart` 展示大盘走势。
- [ ] Lighthouse Performance ≥ 80（3G 慢网，首屏图表渲染 ≤ 2s）。
- [ ] `npm run test:chart:industry` 通过，5 件套图表组件 106 项用例全部绿（详见 §7）。

---

## 7. 单元测试覆盖（5 件套图表组件）

> 测试框架：Vitest + React Testing Library + jsdom
> 测试策略：Mock recharts 各子组件，精确验证 props 传递与数据转换，避免依赖 recharts 内部实现细节。

### 7.1 测试命令

```bash
# 仅运行行业 V4 图表测试（5 件套）
npm run test:chart:industry

# 生成可视化 HTML 测试报告（基于上一步产出的 JSON）
npm run report:chart

# 一键运行并生成报告
npm run test:chart:industry && npm run report:chart
```

### 7.1.1 CI/CD 流水线集成（PR 合并强制门禁）

| 集成点 | 文件 | Job 名 | 阻塞级别 |
|--------|------|--------|----------|
| 主分支 PR 门禁 | `.github/workflows/quality-check.yml` | `chart-industry-tests` | **P0 阻塞**（合并到 main/develop 必过） |
| 开发分支早反馈 | `.github/workflows/ci.yml` | `chart-industry-tests` | **P0 阻塞**（feat/** 推送即跑） |
| 本地推送前 | `.husky/pre-push` | `[4/5] test:clean` | 已包含（全量测试覆盖） |

CI 产物（artifact）：
- `chart-industry-test-report` — 主分支 PR，保留 14 天
- `dev-chart-industry-test-report` — 开发分支，保留 7 天

> 设计依据：主分支门禁由 `quality-gate-summary` job 聚合校验，`chart-industry-tests` 失败即阻断 PR 合并。

### 7.2 测试文件清单

| 测试文件 | 用例数 | 覆盖组件 |
|----------|--------|----------|
| `src/components/chart/industry/IndustryV4Panel.test.tsx` | 40 | IndustryV4Panel (17) + IndustryV4Radar (8) + SubIndicatorBar (15) |
| `src/components/chart/industry/TrendLineChart.test.tsx` | 25 | TrendLineChart |
| `src/components/chart/industry/ValuationDistribution.test.tsx` | 34 | buildHistogram (11) + ValuationDistribution (23) |
| `src/components/chart/industry/IndustryHeatmap.test.tsx` | 7 | IndustryHeatmap（既有组件复检） |
| **合计** | **106** | **5 件套全覆盖** |

### 7.3 测试维度

| 维度 | 覆盖内容 |
|------|----------|
| 数据映射 | dimensions → radarData、value → Cell fill、score → 归一化、buildHistogram 分箱逻辑 |
| 条件渲染 | `showRadar` / `showSubIndicators` / `showGrid` / `showLegend` / `showTooltip` |
| 配置传递 | `barColor` / `valueDomain` / `barRadius` / `layout` / `sortByValue` / `yDomain` / `maxValue` |
| 边界情况 | 空数据 / null 值 / 单数据点 / 负数 / `currentValue=0` / 100 点大数据集 |
| 纯函数 | `buildHistogram`：默认 binCount、自定义 binCount、所有值相同时的除零保护、最后一个 bin 闭区间 |
| 集成测试 | `buildHistogram` 生成的数据可直接传入 `ValuationDistribution`；`currentValue` 高亮联动 |

### 7.4 测试报告产物

| 产物 | 路径 | 说明 |
|------|------|------|
| JSON 原始结果 | `outputs/test-results/chart-tests.json` | vitest `--reporter=json` 输出 |
| HTML 可视化报告 | `outputs/test-results/chart-report.html` | 深色主题，按文件/分组/用例三级折叠 |
| 报告生成脚本 | `scripts/generate-test-report.cjs` | CommonJS 脚本（项目使用 ESM，需 `.cjs` 扩展名） |

### 7.5 测试 Mock 策略约定

```ts
// 1. Mock recharts：使用 vi.fn 捕获各子组件 props
vi.mock('recharts', () => {
  const React = require('react')
  return {
    BarChart: vi.fn((props) => {
      captured.barChart = props
      return React.createElement('div', { 'data-testid': 'recharts-bar-chart' }, props.children)
    }),
    Bar: vi.fn((props) => {
      captured.bar = props
      // ⚠️ 必须渲染 props.children 才能触发 Cell 子组件 mock
      return React.createElement('g', { 'data-testid': 'recharts-bar' }, props.children)
    }),
    Cell: vi.fn((props) => {
      captured.cells = captured.cells || []
      captured.cells.push(props)
      return null
    }),
    // ... 其他子组件类似
  }
})

// 2. Mock usePerfTrace，避免污染性能追踪
vi.mock('@/hooks/usePerfTrace', () => ({ usePerfTrace: vi.fn() }))

// 3. beforeEach 重置 captured，避免测试间状态泄漏
beforeEach(() => { captured = {} })
```

> ⚠️ **关键经验**：当被测组件通过 `<Bar><Cell fill=.../></Bar>` 这种父子结构设置颜色时，Bar 的 mock 必须渲染 `props.children`，否则 Cell mock 不会被调用。若仅校验颜色值，更稳健的做法是直接读取 Bar 的 `props.children` 数组中各 Cell React 元素的 `props.fill`。

---

## 8. 相关链接

- `docs/explanation/implementation/v9-system-blueprint.md` §2、§7.3、D16
- `docs/04-ui-ux-specs.md` §4.3
- `docs/DATAFLOW_DATA_DEFINITION.md`
- `docs/explanation/implementation/feedback-loop-spec_implementation.md`（图表加载失败时的 Toast 反馈）
- `docs/explanation/implementation/widget-error-handling.md`（图表 Widget 的错误边界）
- `outputs/test-results/chart-report.html`（5 件套图表组件可视化测试报告）
- `src/components/chart/industry/`（5 件套组件源码与单元测试）
