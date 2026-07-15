---
title: scoring-contract
code_version: 2.0.0

tier: important
---

---
title: scoring 服务契约
status: active
owner: scoring 子域 / 架构组
updated: 2026-07-12
code_version: 2.0.0
tier: important
---

# scoring-contract.md — 评分引擎服务

> **定位**：V9 核心投研评分引擎，包含 v6 五因子评分、热门板块/价值洼地双策略评分、轮动信号检测。  
> **关联**：`./services-catalog.md`（子域 #16）、`../../AGENTS.md` §一、ADR-009。

---

## 1. 职责边界

### 1.1 核心职责

1. **v6 五因子评分**：基本面（财务质量）、技术面（趋势强度）、资金面（主力动向）、消息面（舆情热度）、估值面（PE/PB 分位）。
2. **双策略评分**：热门板块五维评分（动量/情绪/技术/估值/大盘）、价值洼地五维评分（催化/估值/筹码/轮动/流动性）。
3. **轮动信号检测**：比较双策略得分，检测共振信号，输出买入/卖出/观望建议。
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
// src/services/scoring/v6-engine/types.ts

export interface V6ScoreInput {
  symbol: string;
  dailyQuotes: DailyQuote[];
  financialReport: FinancialReport;
  sentimentScore?: number;
}

export interface V6ScoreOutput {
  symbol: string;
  totalScore: number;        // 0-100
  factorScores: {
    fundamental: number;     // 基本面
    technical: number;       // 技术面
    capital: number;         // 资金面
    sentiment: number;       // 消息面
    valuation: number;       // 估值面
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  updatedAt: string;
}

export interface HotSectorScore {
  sector: string;
  dimensions: {
    momentum: number;
    sentiment: number;
    technical: number;
    valuation: number;
    macro: number;
  };
  compositeScore: number;
  rank: number;
}

export interface RotationSignal {
  type: 'buy' | 'sell' | 'hold';
  confidence: number;        // 0-1
  reason: string;
  triggeredAt: string;
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 说明 |
|------|------|------|------|
| `runV6Score()` | `(input: V6ScoreInput) => V6ScoreOutput` | v6 五因子评分 | L3 纯计算，无副作用 |
| `analyzeHotSector()` | `(stocks: StockData[]) => HotSectorScore[]` | 热门板块评分 | 五维 16 指标 |
| `analyzeValuePit()` | `(stocks: StockData[]) => ValuePitScore[]` | 价值洼地评分 | 五维 16 指标 |
| `detectRotationSignal()` | `(hotScores, pitScores) => RotationSignal[]` | 轮动信号检测 | 共振度计算 |

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
| `V6_WEIGHT_FUNDAMENTAL` | 0.25 | 基本面权重 | `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_TECHNICAL` | 0.20 | 技术面权重 | `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_CAPITAL` | 0.20 | 资金面权重 | `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_SENTIMENT` | 0.15 | 消息面权重 | `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_VALUATION` | 0.20 | 估值面权重 | `src/services/scoring/v6-engine/config.ts` |
| `ROTATION_THRESHOLD` | 0.7 | 轮动信号置信度阈值 | `src/services/scoring/v6-engine/config.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `hotSectorAnalyzer.test.ts` | 热门板块评分计算 |
| 单元测试 | `rotationSignalDetector.test.ts` | 轮动信号检测逻辑 |
| 单元测试 | `industryScoreSkill.test.ts` | 行业评分 |
| 集成测试 | `tests/engine.test.ts` | 引擎整体测试（已知不稳定，test:clean 排除） |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |
