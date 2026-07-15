---
title: api-contract
code_version: 2.0.0

tier: core
---

---
title: docs/reference/api-contract.md
code_version: 2.0.0
tier: core
---

> **Version**: v1.2.0  
> **Last Updated**: 2026-07-12  
> **Maintainer**: 架构资产治理官

# 交易持仓管理模块 API 契约文档

## 1. 模块功能简述

交易持仓管理模块负责管理用户的股票持仓数据，提供持仓列表查询、补仓、平仓、数据导出等核心功能。模块采用前后端分离架构，前端通过 RESTful API 与后端交互，所有接口响应统一包装。

> **P0 后更新**：交易服务层已从 7 个引擎扩展至 20+ 个模块（含 tradeReviewAI、watchlistMoversService、策略快照等），详见 §9.10。

## 2. 核心数据结构

### 2.1 HoldingItem（持仓明细项）

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | string | 是 | 证券代码 | "600519" |
| name | string | 是 | 证券名称 | "贵州茅台" |
| quantity | number | 是 | 持仓数量（股） | 29864 |
| currentPrice | number | 是 | 当前价格 | 60.47 |
| avgCost | number | 是 | 成本均价 | 67.03 |
| floatingPnl | number | 是 | 浮动盈亏金额 | -195907.84 |
| floatingPnlPercent | number | 是 | 浮动盈亏百分比 | -9.79 |
| marketValueRatio | number | 是 | 市值占比（0-15） | 3.34 |
| strategyId | string | 是 | 关联策略ID | "CORE-001" |
| strategyType | StrategyType | 是 | 策略类型 | "CORE" |

### 2.2 HoldingsQueryParams（持仓列表查询参数）

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| page | number | 是 | 当前页码 | 1 |
| pageSize | number | 是 | 每页条数 | 10 |
| startDate | string | 否 | 开始日期（ISO 格式） | "2026-01-01" |
| endDate | string | 否 | 结束日期（ISO 格式） | "2026-06-26" |
| direction | TradeDirection | 是 | 交易方向 | "ALL" |
| keyword | string | 否 | 搜索关键词（代码或名称模糊匹配） | "贵州" |

### 2.3 HoldingsListData（持仓列表数据）

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| total | number | 是 | 总条数 | 25 |
| list | HoldingItem[] | 是 | 持仓列表 | [{code: "600519", ...}] |

### 2.4 HoldingsApiResponse\<T\>（统一 API 响应包装）

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | number | 是 | 状态码（200 成功，500 失败） | 200 |
| data | T | 是 | 响应数据 | {total: 25, list: [...]} |
| message | string | 否 | 错误信息 | "success" |

### 2.5 TradeActionRequest（交易操作请求参数）

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | string | 是 | 证券代码 | "600519" |
| action | HoldingAction | 是 | 操作类型 | "ADD_POSITION" |
| quantity | number | 是 | 操作数量（股） | 500 |

### 2.6 TradeActionResponse（交易操作响应）

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | number | 是 | 状态码（200 成功，500 失败） | 200 |
| success | boolean | 是 | 是否成功 | true |
| message | string | 是 | 提示信息 | "补仓操作成功：600519，数量：500" |

## 3. 状态枚举值及含义

### 3.1 TradeDirection（交易方向）

| 枚举值 | 含义 | 适用策略类型 |
|--------|------|-------------|
| BUY | 买入 | CORE、HOT |
| SELL | 卖出 | VALUE |
| ALL | 全部 | 所有 |

### 3.2 StrategyType（策略类型）

| 枚举值 | 含义 | 中文标签 |
|--------|------|----------|
| CORE | 核心仓 | 蓝筹股、长期持有 |
| HOT | 热点短线 | 热门板块、短期交易 |
| VALUE | 价值洼地 | 低估值、价值投资 |

### 3.3 HoldingAction（持仓操作类型）

| 枚举值 | 含义 | 中文标签 |
|--------|------|----------|
| ADD_POSITION | 补仓 | 增加持仓数量 |
| CLOSE_POSITION | 平仓 | 减少或清仓 |

## 4. API 端点清单

| 方法 | 路径 | 描述 | 请求参数 | 响应类型 |
|------|------|------|----------|----------|
| GET | /api/v1/trade/holdings | 获取持仓列表 | HoldingsQueryParams（Query） | HoldingsApiResponse\<HoldingsListData\> |
| POST | /api/v1/trade/add-position | 补仓操作 | TradeActionRequest（Body） | TradeActionResponse |
| POST | /api/v1/trade/close-position | 平仓操作 | TradeActionRequest（Body） | TradeActionResponse |
| GET | /api/v1/trade/holdings/export | 导出持仓数据（CSV） | HoldingsQueryParams（Query） | text/csv |

## 5. 数据流向图

```
用户操作 → HoldingsPage → holdingsService → 后端 API
                                           ↓
                                   mock-trade-api（开发环境）
                                           ↓
                                    mockHoldingsData
```

### 5.1 持仓列表查询流程

```
用户进入页面 → dispatch SET_LOADING → fetchHoldings(params) → API 响应 → dispatch SET_DATA → 更新 UI
```

### 5.2 交易操作流程

```
点击补仓/平仓 → dispatch SET_MODAL（open=true）→ 确认操作 → executeTradeAction(req) → API 响应 → dispatch SET_MODAL（open=false）→ dispatch REFRESH → 重新加载列表
```

### 5.3 导出流程

```
点击导出 → dispatch SET_LOADING（isExporting=true）→ exportHoldingsCSV(params) → API 返回 CSV → 浏览器下载 → dispatch SET_LOADING（isExporting=false）
```

## 6. 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始化模块，定义核心数据结构和 API 接口 | System |
| 2026-06-26 | v1.1.0 | 修复导出接口：支持筛选参数透传；统一导出格式为 CSV | System |
| 2026-06-26 | v1.2.0 | 修复交易操作：支持 quantity 参数传递；修复随机成功率逻辑 | System |
| 2026-06-26 | v1.3.0 | 新增 §9 交易服务层接口：覆盖 7 个引擎模块的 9 个核心接口定义与函数清单 | Architecture Asset Governor |
| 2026-07-12 | v1.4.0 | **更新行号引用**（代码迭代后偏移修正）；**扩展 §9.10 模块清单**（从 7 个增至 20+ 个，含 tradeReviewAI、watchlistMoversService、策略快照等） | Architecture Asset Governor |

## 7. 错误码说明

| 错误码 | 含义 | 触发场景 |
|--------|------|----------|
| 200 | 成功 | 接口调用成功 |
| 500 | 内部错误 | 服务端异常、交易系统繁忙 |

## 8. Mock 数据说明

开发环境下，`mock-trade-api` 插件拦截 `/api/v1/trade/*` 请求：

- 提供 25 条模拟持仓数据（8条 CORE、8条 HOT、9条 VALUE）
- 支持分页、筛选、搜索功能
- 交易操作模拟 90% 成功率
- 导出接口返回 UTF-8 编码的 CSV 文件（含 BOM）

## 9. 交易服务层接口（Trading Services）

> 以下为 `src/services/trading/` 下 20+ 个引擎/服务模块的核心接口定义。

### 9.1 CreateOrderInput — 创建订单输入

**来源**: `src/services/trading/tradingService.ts:23-29`（原 v1.3.0 为 :22-28，代码迭代后行号偏移 +1）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `direction` | `'buy' \| 'sell'` | 是 | 交易方向 |
| `quantity` | `number` | 是 | 交易数量 |
| `price` | `number` | 是 | 交易价格 |
| `accountType` | `'paper' \| 'real'` | 否 | 账户类型（默认 paper） |

### 9.2 TradeAdvice — 交易建议

**来源**: `src/services/trading/tradingService.ts:55-59`（原 v1.3.0 为 :54-58，行号偏移 +1）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `signal` | `TradingSignal` | 是 | 交易信号 |
| `sizing` | `PositionSizingResult` | 是 | 仓位计算结果 |
| `risk` | `RiskCheckResult` | 是 | 风控检查结果 |

### 9.2b TradeSignal（TradingSignal）— 交易信号

**来源**: `src/data/types.ts:237-246`（Signal 接口），`src/services/trading/signalGenerator.ts:7`（别名 `TradingSignal = Signal`）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 信号唯一标识 |
| `symbol` | `string` | 是 | 股票代码 |
| `direction` | `'buy' \| 'sell' \| 'hold' \| 'watch'` | 是 | 交易方向 |
| `type` | `string` | 是 | 信号类型（如 `ma_cross`, `rsi_oversold`） |
| `confidence` | `number` | 是 | 置信度（0-1） |
| `rationale` | `string` | 是 | 信号生成理由 |
| `snapshot` | `SignalSnapshot` | 是 | 技术指标快照 |
| `createdAt` | `number` | 是 | 信号生成时间戳 |

**SignalSnapshot 子类型**：

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `pePercentile` | `number` | 否 | PE 百分位 |
| `pbPercentile` | `number` | 否 | PB 百分位 |
| `priceToMA20` | `number` | 否 | 价格相对 MA20 比率 |
| `priceToMA60` | `number` | 否 | 价格相对 MA60 比率 |
| `volumeRatio` | `number` | 否 | 量比 |
| `rsi14` | `number` | 否 | 14 日 RSI |
| `macdDirection` | `'red' \| 'green' \| 'neutral'` | 否 | MACD 方向 |

### 9.3 OrderRiskInput — 风控检查输入

**来源**: `src/services/trading/riskEngine.ts:9-15`（原 v1.3.0 为 :6-12，行号偏移 +3）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `direction` | `SignalDirection` | 是 | 交易方向 |
| `quantity` | `number` | 是 | 交易数量 |
| `price` | `number` | 是 | 交易价格 |
| `portfolioValue` | `number` | 是 | 组合净值 |

### 9.4 RiskCheckResult — 风控检查结果

**来源**: `src/services/trading/riskEngine.ts:19-23`（原 v1.3.0 为 :14-18，行号偏移 +5）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `ok` | `boolean` | 是 | 是否通过 |
| `warnings` | `string[]` | 是 | 警告列表 |
| `blocks` | `string[]` | 是 | 阻塞原因列表 |

**阻塞项**：价格/数量非法、冷却期内、超当日交易次数、超仓位上限、行情过期  
**警告项**：单日交易次数接近上限、仓位接近上限

### 9.5 PositionSizingInput — 仓位计算输入

**来源**: `src/services/trading/positionSizer.ts:4-13`（行号不变）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `direction` | `SignalDirection` | 是 | 交易方向 |
| `price` | `number` | 是 | 当前价格 |
| `portfolioValue` | `number` | 是 | 组合净值 |
| `currentHoldingShares` | `number` | 否 | 当前持仓股数 |
| `currentHoldingValue` | `number` | 否 | 当前持仓市值 |
| `currentTotalPositionValue` | `number` | 否 | 当前总仓位市值 |
| `winRate` | `number` | 否 | 胜率 |
| `profitLossRatio` | `number` | 否 | 盈亏比 |

### 9.6 PositionSizingResult — 仓位计算结果

**来源**: `src/services/trading/positionSizer.ts:15-23`（行号不变）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `action` | `'buy' \| 'sell' \| 'hold'` | 是 | 操作建议 |
| `targetShares` | `number` | 是 | 目标股数 |
| `targetValue` | `number` | 是 | 目标市值 |
| `positionPct` | `number` | 是 | 仓位比例 |
| `kellyPct` | `number` | 是 | Kelly 比例 |
| `roundedDown` | `boolean` | 是 | 是否向下取整 |
| `cappedBy` | `'single' \| 'total' \| 'min' \| 'max' \| 'none'` | 是 | 上限约束来源 |

### 9.7 CompositeScoreView — 综合评分视图

**来源**: `src/services/trading/scoringAdapter.ts:13-29`（行号不变）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `v6Score` | `number \| null` | 是 | V6 自动评分（0-5） |
| `intelligentScore` | `number \| null` | 是 | 智能评分（0-5） |
| `industryScore` | `number \| null` | 是 | 行业/主题评分（0-5） |
| `valuationScore` | `number \| null` | 是 | 估值因子分（0-5） |
| `composite` | `number \| null` | 是 | 综合评分（0-5） |
| `rationale` | `string` | 是 | 评分来源摘要 |
| `scoredAt` | `number \| null` | 是 | 最近评分时间 |

### 9.8 PortfolioBuilderInput — 组合构建输入

**来源**: `src/services/trading/portfolioBuilder.ts:10-22`（原 v1.3.0 为 :9-21，行号偏移 +1）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `theme` | `ThemeConfig` | 是 | 主题配置 |
| `stocks` | `Stock[]` | 是 | 候选股票池 |
| `totalPortfolioValue` | `number` | 否 | 总资产净值 |
| `currentHoldings` | `Record<string, number>` | 否 | 当前持仓股数 |
| `scoringOptions` | `ScoringAdapterOptions` | 否 | 评分适配器选项 |
| `ruleConfig` | `StrategyRuleConfig` | 否 | 策略规则配置 |

### 9.9 RunStrategyOptions — 策略引擎选项

**来源**: `src/services/trading/strategyEngine.ts:21-28`（原 v1.3.0 为 :17-24，行号偏移 +4）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `theme` | `ThemeConfig` | 否 | 主题配置 |
| `ruleConfig` | `StrategyRuleConfig` | 否 | 策略规则配置 |
| `momentumMap` | `Record<string, number>` | 否 | 动量快照（symbol → priceToMA20） |

### 9.10 交易服务模块函数清单（v1.4.0 扩展版）

| 模块 | 核心函数 | 描述 | 新增/原有 |
|------|---------|------|----------|
| `tradingService` | `createOrderFromSignal`, `computeTradeAdvice` | 订单创建与交易建议生成 | 原有 |
| `signalGenerator` | `generateSignalsForSymbol`, `pickStrongestSignal` | 技术信号生成（MA/RSI/量比/MACD） | 原有 |
| `riskEngine` | `checkOrderRisk` | 风控检查（冷却期/仓位/新鲜度） | 原有 |
| `positionSizer` | `calculatePosition` | Kelly 公式仓位计算 | 原有 |
| `scoringAdapter` | `getCompositeScores` | V6+智能+行业三维评分聚合 | 原有 |
| `strategyEngine` | `runStrategy`, `classifyStocks` | 20进13 策略规则引擎 | 原有 |
| `portfolioBuilder` | `buildThemePortfolio` | 主题组合构建与再平衡 | 原有 |
| `dualStrategyEngine` | — | 双策略引擎（核心+热点短线联动） | **新增** |
| `mockDataGenerator` | — | 模拟数据生成器（25 条持仓数据） | **新增** |
| `pnlComputer` | — | 盈亏计算引擎 | **新增** |
| `portfolioService` | — | 组合服务层（持仓管理） | **新增** |
| `positionComputer` | — | 仓位计算辅助 | **新增** |
| `riskComputer` | — | 风险计算辅助 | **新增** |
| `strategySnapshotService` | — | 策略快照服务（持久化/回放） | **新增** |
| `tradeErrorClassifier` | `classifyTradeError` | 交易错误分类（类型/严重级/根因） | **新增** |
| `tradeErrorDefinitions` | — | 错误定义与错误码字典 | **新增** |
| `tradeErrorDetectors` | — | 错误检测器集合 | **新增** |
| `tradeErrorUtils` | — | 错误处理工具函数 | **新增** |
| `tradeReviewAI` | `generateReview`, `analyzeDimensions` | 交易复盘 AI（维度分析 + LLM 增强） | **新增** |
| `tradeReviewAI.dimensions` | `extractDimensions` | 复盘维度提取（技术/心理/策略） | **新增** |
| `tradeReviewAI.llmEnhancer` | `enhanceWithLLM` | LLM 增强复盘报告 | **新增** |
| `tradeReviewAI.profileGenerator` | `generateProfile` | 交易画像生成 | **新增** |
| `tradeReviewAI.reportGenerator` | `generateReport` | 复盘报告生成 | **新增** |
| `tradeReviewAI.skillDevelopment` | `generateSkillPlan` | 交易技能发展计划 | **新增** |
| `tradeReviewAI.types` | — | 复盘类型定义 | **新增** |
| `tradeReviewAI.utils` | — | 复盘工具函数 | **新增** |
| `watchlistMoversService` | `getWatchlistMovers` | 自选股异动监测与推送 | **新增** |

> **模块总数**：原 7 个 → 当前 **20+ 个**（含 tradeReviewAI 系列 7 个模块 + watchlistMoversService 等独立模块）。
> **交易复盘能力**：v1.4.0 新增完整的交易复盘 AI 能力（维度分析 → LLM 增强 → 画像生成 → 报告输出 → 技能发展），覆盖 `src/services/trading/tradeReviewAI*` 系列文件。

<!-- merge-source: docs/explanation/design/api-contract.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `./trade/api-contract.md`）

> 以下为 `src/services/trading/` 下 7 个引擎/服务模块的核心接口定义。
**来源**: `src/services/trading/tradingService.ts:22-28`
**来源**: `src/services/trading/tradingService.ts:54-58`
**来源**: `src/services/trading/riskEngine.ts:6-12`
**来源**: `src/services/trading/riskEngine.ts:14-18`
**来源**: `src/services/trading/positionSizer.ts:4-13`
**来源**: `src/services/trading/positionSizer.ts:15-23`
**来源**: `src/services/trading/scoringAdapter.ts:13-29`
**来源**: `src/services/trading/portfolioBuilder.ts:9-21`
**来源**: `src/services/trading/strategyEngine.ts:17-24`
### 9.10 交易服务模块函数清单
| 模块 | 核心函数 | 描述 |
| `tradingService` | `createOrderFromSignal`, `computeTradeAdvice` | 订单创建与交易建议生成 |
| `signalGenerator` | `generateSignalsForSymbol`, `pickStrongestSignal` | 技术信号生成（MA/RSI/量比/MACD） |
| `riskEngine` | `checkOrderRisk` | 风控检查（冷却期/仓位/新鲜度） |
| `positionSizer` | `calculatePosition` | Kelly 公式仓位计算 |
| `scoringAdapter` | `getCompositeScores` | V6+智能+行业三维评分聚合 |
| `strategyEngine` | `runStrategy`, `classifyStocks` | 20进13 策略规则引擎 |
| `portfolioBuilder` | `buildThemePortfolio` | 主题组合构建与再平衡 |
