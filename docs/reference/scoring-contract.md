---
type: reference
domain: data
phase: design
doc_id: V9-DOC-REF-955
title: scoring-contract
code_version: "2.0.0-rc.2"
tier: important
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "代码侧变更确认兼容：v6-engine 复杂度扁平化重构（嵌套压平 + 辅助函数抽取，无行为变更）"
    date: 2026-08-22
  - version: v1.0.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11

covers_code:
  - src/services/scoring/v6-engine/config.ts
  - src/config/strategyRules.ts
---
# scoring-contract.md — 评分引擎服务

> **定位**：V9 核心投研评分引擎，包含 v6 十一层递进式评分（L-1~L8）、热门板块/价值洼地双策略评分、轮动信号检测。  
> **关联**：`./services-catalog.md`（子域 #16）、`../../AGENTS.md` §一、ADR-009。

---

## 1. 职责边界

### 1.1 核心职责

1. **v6 十一层递进式评分**：L-1 行业评分估值 → L0 宏观扫描 → L1 护城河 → L2 竞品格局 → L3a 财务健康 → L3b 估值水平 → L4 情景推演 → L5 T-M 矩阵 → L6 Hype 周期 → L7 第二曲线 → L8 技术筹码，各层独立计算（0-5 分制），加权汇总为综合评分（0-5）。
2. **双策略评分**：热门板块五维评分（动量/情绪/技术/估值/大盘）、价值洼地五维评分（催化/估值/筹码/轮动/流动性）。
3. **轮动信号检测**：比较双策略得分，检测共振信号，输出买入/卖出/观望建议，支持置信度覆盖机制。
4. **纯计算层（L3）**：无副作用，输入数据 → 计算 → 输出评分，可独立单测。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/scoring/`（服务层 #16） |
| 依赖方向 | `core/`（类型守卫）、`data/`（类型定义）、`lib/`（logger、errors） |
| 禁止事项 | 禁止直写 IndexedDB（评分结果须经 DataBridge 路由） |
| 被依赖方 | `store/v6ScoreStore`、`store/hotSectorScoreStore`、`store/valuePitScoreStore` |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `fetcher` | 上游数据源 | `fetcher` → IndexedDB → `scoring`（读取行情/财报） |
| `analysis` | 下游消费方 | `scoring` → IndexedDB → `analysis`（读取评分展示） |
| `screening` | 下游消费方 | `scoring` → IndexedDB → `screening`（按评分筛选） |
| `stock-analysis` | 下游消费方 | `scoring` → IndexedDB → `stock-analysis`（个股深度评分） |

---

## 2. 公共接口

### 2.1 类型定义

```typescript
// src/data/types/types.score.ts

export interface V6Score {
  symbol: string
  score: number               // 0-5 综合评分
  factors: Record<string, number>  // 11 层因子分（键名：lMinus1/l0/l1/l2/l3f/l3v/l4/l5/l6/l7/l8）
  algorithmVersion: string
  calculatedAt: number
  dataVersion: number
  qualityWarning?: string
  rating?: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  layerDetails?: Record<string, { score: number; summary: string; weight: number }>
  allRisks?: string[]
  recommendation?: string
  engineVersion?: string
}

// src/services/scoring/v6-engine/types.ts

export type LayerId =
  | 'lMinus1' | 'l0' | 'l1' | 'l2' | 'l3f' | 'l3v'
  | 'l4' | 'l5' | 'l6' | 'l7' | 'l8'

export const ALL_LAYER_IDS: LayerId[] = [
  'lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v', 'l4', 'l5', 'l6', 'l7', 'l8',
]

export const LAYER_LABELS: Record<LayerId, string> = {
  lMinus1: 'L-1 行业评分估值',
  l0:      'L0 STEEP 宏观扫描',
  l1:      'L1 护城河分析',
  l2:      'L2 竞品格局',
  l3f:     'L3a 财务健康',
  l3v:     'L3b 估值水平',
  l4:      'L4 情景推演',
  l5:      'L5 T-M 矩阵',
  l6:      'L6 Hype 周期',
  l7:      'L7 第二曲线',
  l8:      'L8 技术筹码',
}

export interface CompositeScore {
  score: number                    // 0-5
  rating: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  layers: Record<LayerId, LayerScore>
  allRisks: string[]
  recommendation: string
  timestamp: number
  engineVersion: string
  confidence?: { ess: number; level: string; dataSources: Record<string, string> }
  skippedLayers?: LayerId[]
  coverageRate?: number            // 0-1
}

export interface V6ScoreInput {
  symbol: string
  stock: StockBasicData
  financials: FinancialData
  quotes: QuoteData
  industryScore?: IndustryScoreData
  zeroToOneEvents?: ZeroToOneEvent[]
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 说明 |
|------|------|------|------|
| `runV6Score()` | `(symbol: string) => Promise<DataLayerResult<V6Score>>` | v6 十一层评分 | v6ScoreService 主入口，DataBridge 路由 |
| `runV6ScoreBatch()` | `(symbols: string[]) => Promise<DataLayerResult<V6Score[]>>` | 批量评分 | 并发计算 + 结果持久化 |
| `createV6Engine()` | `(override?: V6ScoreConfigOverride) => V6ScoreEngine` | 创建引擎实例 | 支持配置覆盖，Backtestable |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `scoring:v6:completed` | scoring | `v6ScoreStore` | 评分计算完成 |
| `scoring:rotation:signal` | scoring | `rotationSignalStore` | 轮动信号触发 |

---

## 3. 数据流

```
IndexedDB (stocks, daily_quotes, financial_reports)
  ↓ (读取)
scoringService.runV6Score() / analyzeHotSector() / analyzeValuePit()
  ↓ (纯计算，无副作用)
V6ScoreOutput / HotSectorScore[] / ValuePitScore[]
  ↓ (DataBridge.forward())
IndexedDB (v6_scores, hot_sector_scores, value_pit_scores, rotation_scores)
  ↓ (EventBus)
store/*ScoreStore (Zustand + withBroadcast)
  ↓
components/pages (ScoreDoc, StockAnalysis, HotSector, ValuePit)
```

### 3.1 L8 筹码数据流（统一三套体系）

三套筹码分析体系通过 `chipDataBridge.ts` 共享数据：

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ chipAnomaly      │     │ V6 L8 评分引擎    │     │ valuePitAnalyzer     │
│ Detector         │     │ (evaluateChip)    │     │ (筹码结构维度)       │
│                  │     │                   │     │                     │
│ 异动事件检测     │────→│ chipDataBridge    │←────│ buildChipStructure  │
│ holder_count     │     │ .getChipScore     │     │ Data(symbol, v6)    │
│ concentration    │     │ Impact()          │     │                     │
│ institutional    │     │     ↓             │     │ 数据来源:           │
│                  │     │ CSR 调整          │     │ anomaly > v6 > 0    │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

**数据优先级**：异动检测器真实数据 > V6Score L8 推断 > 默认值 0

**L8 八级指标增强**（TASK-02）：

| 指标 | 原代理逻辑 | TASK-02 增强 |
|------|-----------|-------------|
| SCD（股东人数变化度） | 20日收益率+波动率 | 优先使用 `shareholderCount` 真实数据，无数据时回退代理 |
| AII（庄家吸筹强度） | 收益率-换手率 | 增加 `northboundHoldings` 北向资金增强（±0.25~0.5） |
| CSR（筹码结构风险比） | 七级平均 | 叠加 `getChipScoreImpact()` 异动反馈闭环（±1.0 范围） |

**异动反馈闭环**：
- `getChipScoreImpact(symbol)` 检查最近 24h 内 `ChipAnomalyEvent`
- 按严重度加权：critical ±0.5 / warning ±0.25 / info ±0.1
- 股东减少/集中度提升 → 正向（CSR+）；股东增加/集中度下降 → 负向（CSR-）
- `ChipResult.scoreImpact` 字段记录调整值，evidence/summary/dataSources 同步反映

**价值洼地筹码维度**：
- `valuePitAnalyzer.analyzeBySymbol()` 调用 `buildChipStructureData(symbol, v6Score)` 替代硬编码 0
- 筹码结构数据来源标记：`source: 'anomaly' | 'v6_inferred' | 'default'`

---

## 4. 配置与依赖

### 4.1 依赖白名单

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 评分计算日志 |
| errors | `@/lib/errors` | ScoreCalculationError |
| format | `@/lib/format` | 数值格式化、百分比 |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `DEFAULT_WEIGHTS.lMinus1` | 0.10 | L-1 行业评分权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l0` | 0.08 | L0 宏观扫描权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l1` | 0.15 | L1 护城河权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l2` | 0.10 | L2 竞品格局权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l3f` | 0.10 | L3a 财务健康权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l3v` | 0.08 | L3b 估值水平权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l4` | 0.08 | L4 情景推演权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l5` | 0.05 | L5 T-M 矩阵权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l6` | 0.07 | L6 Hype 周期权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l7` | 0.15 | L7 第二曲线权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_WEIGHTS.l8` | 0.04 | L8 技术筹码权重 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_THRESHOLDS.rating.strongBuy` | 4.0 | 强买评级阈值 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_THRESHOLDS.rating.buy` | 3.0 | 买入评级阈值 | `src/services/scoring/v6-engine/config.ts` |
| `DEFAULT_CLASSIFY_THRESHOLDS` | 见下 | 策略分类阈值 | `src/config/strategyRules.ts` |

**策略分类阈值**（`DEFAULT_CLASSIFY_THRESHOLDS`）：

| 策略 | 字段 | 阈值 |
|------|------|------|
| 核心稀缺 (core) | compositeMin / l1Min / l7Min | 4.0 / 3.5 / 3.5 |
| 热点动量 (hot) | compositeMin / l3vMax / resonanceMin | 3.0 / 2.5 / 60 |
| 价值洼地 (value) | compositeMin / l3vMax / resonanceMax / l3fMin | 3.0 / 3.0 / 50 / 3.0 |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `strategySnapshotService.core-scarce.test.ts` | 核心稀缺组合分类、边界条件、快照保存与加载 |
| 集成测试 | `scoring-strategy-audit-10stocks.test.ts` | 10 只随机抽样评分策略一致性审计（含因子键大小写校验） |
| 集成测试 | `v6-score-discrimination.integration.test.ts` | 25 只标的评分区分度验证 |
| 集成测试 | `v6-engine.benchmark.test.ts` | V6 引擎基准测试 |
| 集成测试 | `scoringAdapter.test.ts` | 评分适配器层 |
| 单元测试 | `v6ExceptionHandling.test.ts` | V6 异常处理 |
| 单元测试 | `v6Lifecycle.test.ts` | V6 生命周期 |
| 集成测试 | `strategySnapshotService.integrity.test.ts` | 快照完整性 |
| 集成测试 | `strategySnapshotService.dedup-anomaly.test.ts` | 去重异常 |

---

## 6. 已知技术债务

| 债务项 | 影响 | 状态 |
|--------|------|------|
| `LayerId`（engine.types.ts）与 `ScoreLayerId`（types.profile.ts）为相同联合类型的不同别名 | 跨域引用需手动转换，新开发者易混淆 | 待统一（优先级低，涉及 5+ profile 域服务文件） |
| `strategySnapshotService` 的 `pickFactor` 兼容大写键和中文别名 | 历史数据兼容性需求，引擎实际输出已统一为小写 | 兼容层保留，待历史数据清零后移除 |

---

## 7. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |
| 2026-08-09 | v3.0.0 | 5因子→11层模型同步，更新类型定义/配置项/测试策略 | 开发组 |
| 2026-08-09 | v3.1.0 | TASK-02：统一三套筹码分析体系数据流，chipDataBridge 模块，L8 SCD/AII/CSR 增强，价值洼地接入真实数据 | 开发组 |
