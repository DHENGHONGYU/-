---
title: scoring-contract.md �?评分引擎服务
type: reference
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：V9 核心投研评分引擎，包�?v6 五因子评分、热门板�?价值洼地双策略评分、轮动信号检测�?..."
tags: [backend, contract, scoring]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-020
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# scoring-contract.md �?评分引擎服务

> **定位**：V9 核心投研评分引擎，包�?v6 五因子评分、热门板�?价值洼地双策略评分、轮动信号检测�? 
> **关联**：`./services-catalog.md`（子�?#16）、`../../AGENTS.md` §一、ADR-009�?
---

## 1. 职责边界

### 1.1 核心职责

1. **v6 五因子评�?*：基本面（财务质量）、技术面（趋势强度）、资金面（主力动向）、消息面（舆情热度）、估值面（PE/PB 分位）�?2. **双策略评�?*：热门板块五维评分（动量/情绪/技�?估�?大盘）、价值洼地五维评分（催化/估�?筹码/轮动/流动性）�?3. **轮动信号检�?*：比较双策略得分，检测共振信号，输出买入/卖出/观望建议�?4. **纯计算层（L3�?*：无副作用，输入数据 �?计算 �?输出评分，可独立单测�?
### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/scoring/`（服务层 #16�?|
| 依赖方向 | `core/`（类型守卫）、`data/`（类型定义）、`lib/`（logger、errors�?|
| 禁止事项 | 禁止直写 IndexedDB（评分结果须�?DataBridge 路由�?|
| 被依赖方 | `store/v6ScoreStore`、`store/hotSectorScoreStore`、`store/valuePitScoreStore` |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据�?|
|----------|------|--------|
| `fetcher` | 上游数据�?| `fetcher` �?IndexedDB �?`scoring`（读取行�?财报�?|
| `analysis` | 下游消费�?| `scoring` �?IndexedDB �?`analysis`（读取评分展示） |
| `screening` | 下游消费�?| `scoring` �?IndexedDB �?`screening`（按评分筛选） |
| `stock-analysis` | 下游消费�?| `scoring` �?IndexedDB �?`stock-analysis`（个股深度评分） |

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
    fundamental: number;     // 基本�?    technical: number;       // 技术面
    capital: number;         // 资金�?    sentiment: number;       // 消息�?    valuation: number;       // 估值面
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

### 2.2 主入口函�?
| 函数 | 签名 | 职责 | 说明 |
|------|------|------|------|
| `runV6Score()` | `(input: V6ScoreInput) => V6ScoreOutput` | v6 五因子评�?| L3 纯计算，无副作用 |
| `analyzeHotSector()` | `(stocks: StockData[]) => HotSectorScore[]` | 热门板块评分 | 五维 16 指标 |
| `analyzeValuePit()` | `(stocks: StockData[]) => ValuePitScore[]` | 价值洼地评�?| 五维 16 指标 |
| `detectRotationSignal()` | `(hotScores, pitScores) => RotationSignal[]` | 轮动信号检�?| 共振度计�?|

### 2.3 事件接口

| 事件�?| 发布�?| 订阅�?| 说明 |
|--------|--------|--------|------|
| `scoring:v6:completed` | scoring | `v6ScoreStore` | 评分计算完成 |
| `scoring:rotation:signal` | scoring | `rotationSignalStore` | 轮动信号触发 |

---

## 3. 数据�?
```
IndexedDB (stocks, daily_quotes, financial_reports)
  �?(读取)
scoringService.runV6Score() / analyzeHotSector() / analyzeValuePit()
  �?(纯计算，无副作用)
V6ScoreOutput / HotSectorScore[] / ValuePitScore[]
  �?(DataBridge.forward())
IndexedDB (v6_scores, hot_sector_scores, value_pit_scores, rotation_scores)
  �?(EventBus)
store/*ScoreStore (Zustand + withBroadcast)
  �?components/pages (ScoreDoc, StockAnalysis, HotSector, ValuePit)
```

---

## 4. 配置与依�?
### 4.1 依赖白名�?
| 依赖 | 路径 | 用�?|
|------|------|------|
| logger | `@/lib/logger` | 评分计算日志 |
| errors | `@/lib/errors` | ScoreCalculationError |
| format | `@/lib/format` | 数值格式化、百分比 |

### 4.2 配置�?
| 配置�?| 默认�?| 说明 | 来源 |
|--------|--------|------|------|
| `V6_WEIGHT_FUNDAMENTAL` | 0.25 | 基本面权�?| `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_TECHNICAL` | 0.20 | 技术面权重 | `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_CAPITAL` | 0.20 | 资金面权�?| `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_SENTIMENT` | 0.15 | 消息面权�?| `src/services/scoring/v6-engine/config.ts` |
| `V6_WEIGHT_VALUATION` | 0.20 | 估值面权重 | `src/services/scoring/v6-engine/config.ts` |
| `ROTATION_THRESHOLD` | 0.7 | 轮动信号置信度阈�?| `src/services/scoring/v6-engine/config.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `hotSectorAnalyzer.test.ts` | 热门板块评分计算 |
| 单元测试 | `rotationSignalDetector.test.ts` | 轮动信号检测逻辑 |
| 单元测试 | `industryScoreSkill.test.ts` | 行业评分 |
| 集成测试 | `tests/engine.test.ts` | 引擎整体测试（已知不稳定，test:clean 排除�?|

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作�?|
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构�?|
