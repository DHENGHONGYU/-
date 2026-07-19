---
title: 交易持仓管理模块 API 契约文档
type: reference
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 1. 模块功能简�?..."
tags: [project, contract, management]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-215
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

> **Version**: v1.1.0  
> **Last Updated**: 2026-06-26  
> **Maintainer**: 架构资产治理�?
# 交易持仓管理模块 API 契约文档

## 1. 模块功能简�?
交易持仓管理模块负责管理用户的股票持仓数据，提供持仓列表查询、补仓、平仓、数据导出等核心功能。模块采用前后端分离架构，前端通过 RESTful API 与后端交互，所有接口响应统一包装�?
## 2. 核心数据结构

### 2.1 HoldingItem（持仓明细项�?
| 字段�?| 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | string | �?| 证券代码 | "600519" |
| name | string | �?| 证券名称 | "贵州茅台" |
| quantity | number | �?| 持仓数量（股�?| 29864 |
| currentPrice | number | �?| 当前价格 | 60.47 |
| avgCost | number | �?| 成本均价 | 67.03 |
| floatingPnl | number | �?| 浮动盈亏金额 | -195907.84 |
| floatingPnlPercent | number | �?| 浮动盈亏百分�?| -9.79 |
| marketValueRatio | number | �?| 市值占比（0-15�?| 3.34 |
| strategyId | string | �?| 关联策略ID | "CORE-001" |
| strategyType | StrategyType | �?| 策略类型 | "CORE" |

### 2.2 HoldingsQueryParams（持仓列表查询参数）

| 字段�?| 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| page | number | �?| 当前页码 | 1 |
| pageSize | number | �?| 每页条数 | 10 |
| startDate | string | �?| 开始日期（ISO 格式�?| "2026-01-01" |
| endDate | string | �?| 结束日期（ISO 格式�?| "2026-06-26" |
| direction | TradeDirection | �?| 交易方向 | "ALL" |
| keyword | string | �?| 搜索关键词（代码或名称模糊匹配） | "贵州" |

### 2.3 HoldingsListData（持仓列表数据）

| 字段�?| 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| total | number | �?| 总条�?| 25 |
| list | HoldingItem[] | �?| 持仓列表 | [{code: "600519", ...}] |

### 2.4 HoldingsApiResponse\<T\>（统一 API 响应包装�?
| 字段�?| 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | number | �?| 状态码�?00 成功�?00 失败�?| 200 |
| data | T | �?| 响应数据 | {total: 25, list: [...]} |
| message | string | �?| 错误信息 | "success" |

### 2.5 TradeActionRequest（交易操作请求参数）

| 字段�?| 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | string | �?| 证券代码 | "600519" |
| action | HoldingAction | �?| 操作类型 | "ADD_POSITION" |
| quantity | number | �?| 操作数量（股�?| 500 |

### 2.6 TradeActionResponse（交易操作响应）

| 字段�?| 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| code | number | �?| 状态码�?00 成功�?00 失败�?| 200 |
| success | boolean | �?| 是否成功 | true |
| message | string | �?| 提示信息 | "补仓操作成功�?00519，数量：500" |

## 3. 状态枚举值及含义

### 3.1 TradeDirection（交易方向）

| 枚举�?| 含义 | 适用策略类型 |
|--------|------|-------------|
| BUY | 买入 | CORE、HOT |
| SELL | 卖出 | VALUE |
| ALL | 全部 | 所�?|

### 3.2 StrategyType（策略类型）

| 枚举�?| 含义 | 中文标签 |
|--------|------|----------|
| CORE | 核心�?| 蓝筹股、长期持�?|
| HOT | 热点短线 | 热门板块、短期交�?|
| VALUE | 价值洼�?| 低估值、价值投�?|

### 3.3 HoldingAction（持仓操作类型）

| 枚举�?| 含义 | 中文标签 |
|--------|------|----------|
| ADD_POSITION | 补仓 | 增加持仓数量 |
| CLOSE_POSITION | 平仓 | 减少或清�?|

## 4. API 端点清单

| 方法 | 路径 | 描述 | 请求参数 | 响应类型 |
|------|------|------|----------|----------|
| GET | /api/v1/trade/holdings | 获取持仓列表 | HoldingsQueryParams（Query�?| HoldingsApiResponse\<HoldingsListData\> |
| POST | /api/v1/trade/add-position | 补仓操作 | TradeActionRequest（Body�?| TradeActionResponse |
| POST | /api/v1/trade/close-position | 平仓操作 | TradeActionRequest（Body�?| TradeActionResponse |
| GET | /api/v1/trade/holdings/export | 导出持仓数据（CSV�?| HoldingsQueryParams（Query�?| text/csv |

## 5. 数据流向�?
```
用户操作 �?HoldingsPage �?holdingsService �?后端 API
                                           �?                                   mock-trade-api（开发环境）
                                           �?                                    mockHoldingsData
```

### 5.1 持仓列表查询流程

```
用户进入页面 �?dispatch SET_LOADING �?fetchHoldings(params) �?API 响应 �?dispatch SET_DATA �?更新 UI
```

### 5.2 交易操作流程

```
点击补仓/平仓 �?dispatch SET_MODAL（open=true）→ 确认操作 �?executeTradeAction(req) �?API 响应 �?dispatch SET_MODAL（open=false）→ dispatch REFRESH �?重新加载列表
```

### 5.3 导出流程

```
点击导出 �?dispatch SET_LOADING（isExporting=true）→ exportHoldingsCSV(params) �?API 返回 CSV �?浏览器下�?�?dispatch SET_LOADING（isExporting=false�?```

## 6. 变更日志

| 日期 | 版本 | 变更内容 | 变更�?|
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始化模块，定义核心数据结构�?API 接口 | System |
| 2026-06-26 | v1.1.0 | 修复导出接口：支持筛选参数透传；统一导出格式�?CSV | System |
| 2026-06-26 | v1.2.0 | 修复交易操作：支�?quantity 参数传递；修复随机成功率逻辑 | System |
| 2026-06-26 | v1.3.0 | 新增 §9 交易服务层接口：覆盖 7 个引擎模块的 9 个核心接口定义与函数清单 | Architecture Asset Governor |

## 7. 错误码说�?
| 错误�?| 含义 | 触发场景 |
|--------|------|----------|
| 200 | 成功 | 接口调用成功 |
| 500 | 内部错误 | 服务端异常、交易系统繁�?|

## 8. Mock 数据说明

开发环境下，`mock-trade-api` 插件拦截 `/api/v1/trade/*` 请求�?
- 提供 25 条模拟持仓数据（8�?CORE�?�?HOT�?�?VALUE�?- 支持分页、筛选、搜索功�?- 交易操作模拟 90% 成功�?- 导出接口返回 UTF-8 编码�?CSV 文件（含 BOM�?
## 9. 交易服务层接口（Trading Services�?
> 以下�?`src/services/trading/` �?7 个引�?服务模块的核心接口定义�?
### 9.1 CreateOrderInput �?创建订单输入

**来源**: `src/services/trading/tradingService.ts:22-28`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | �?| 股票代码 |
| `direction` | `'buy' \| 'sell'` | �?| 交易方向 |
| `quantity` | `number` | �?| 交易数量 |
| `price` | `number` | �?| 交易价格 |
| `accountType` | `'paper' \| 'real'` | �?| 账户类型（默�?paper�?|

### 9.2 TradeAdvice �?交易建议

**来源**: `src/services/trading/tradingService.ts:54-58`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `signal` | `TradingSignal` | �?| 交易信号 |
| `sizing` | `PositionSizingResult` | �?| 仓位计算结果 |
| `risk` | `RiskCheckResult` | �?| 风控检查结�?|

### 9.2b TradeSignal（TradingSignal）�?交易信号

**来源**: `src/data/types.ts:237-246`（Signal 接口），`src/services/trading/signalGenerator.ts:7`（别�?`TradingSignal = Signal`�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 信号唯一标识 |
| `symbol` | `string` | �?| 股票代码 |
| `direction` | `'buy' \| 'sell' \| 'hold' \| 'watch'` | �?| 交易方向 |
| `type` | `string` | �?| 信号类型（如 `ma_cross`, `rsi_oversold`�?|
| `confidence` | `number` | �?| 置信度（0-1�?|
| `rationale` | `string` | �?| 信号生成理由 |
| `snapshot` | `SignalSnapshot` | �?| 技术指标快�?|
| `createdAt` | `number` | �?| 信号生成时间�?|

**SignalSnapshot 子类�?*�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `pePercentile` | `number` | �?| PE 百分�?|
| `pbPercentile` | `number` | �?| PB 百分�?|
| `priceToMA20` | `number` | �?| 价格相对 MA20 比率 |
| `priceToMA60` | `number` | �?| 价格相对 MA60 比率 |
| `volumeRatio` | `number` | �?| 量比 |
| `rsi14` | `number` | �?| 14 �?RSI |
| `macdDirection` | `'red' \| 'green' \| 'neutral'` | �?| MACD 方向 |

### 9.3 OrderRiskInput �?风控检查输�?
**来源**: `src/services/trading/riskEngine.ts:6-12`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | �?| 股票代码 |
| `direction` | `SignalDirection` | �?| 交易方向 |
| `quantity` | `number` | �?| 交易数量 |
| `price` | `number` | �?| 交易价格 |
| `portfolioValue` | `number` | �?| 组合净�?|

### 9.4 RiskCheckResult �?风控检查结�?
**来源**: `src/services/trading/riskEngine.ts:14-18`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `ok` | `boolean` | �?| 是否通过 |
| `warnings` | `string[]` | �?| 警告列表 |
| `blocks` | `string[]` | �?| 阻塞原因列表 |

**阻塞�?*：价�?数量非法、冷却期内、超当日交易次数、超仓位上限、行情过�? 
**警告�?*：单日交易次数接近上限、仓位接近上�?
### 9.5 PositionSizingInput �?仓位计算输入

**来源**: `src/services/trading/positionSizer.ts:4-13`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `direction` | `SignalDirection` | �?| 交易方向 |
| `price` | `number` | �?| 当前价格 |
| `portfolioValue` | `number` | �?| 组合净�?|
| `currentHoldingShares` | `number` | �?| 当前持仓股数 |
| `currentHoldingValue` | `number` | �?| 当前持仓市�?|
| `currentTotalPositionValue` | `number` | �?| 当前总仓位市�?|
| `winRate` | `number` | �?| 胜率 |
| `profitLossRatio` | `number` | �?| 盈亏�?|

### 9.6 PositionSizingResult �?仓位计算结果

**来源**: `src/services/trading/positionSizer.ts:15-23`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `action` | `'buy' \| 'sell' \| 'hold'` | �?| 操作建议 |
| `targetShares` | `number` | �?| 目标股数 |
| `targetValue` | `number` | �?| 目标市�?|
| `positionPct` | `number` | �?| 仓位比例 |
| `kellyPct` | `number` | �?| Kelly 比例 |
| `roundedDown` | `boolean` | �?| 是否向下取整 |
| `cappedBy` | `'single' \| 'total' \| 'min' \| 'max' \| 'none'` | �?| 上限约束来源 |

### 9.7 CompositeScoreView �?综合评分视图

**来源**: `src/services/trading/scoringAdapter.ts:13-29`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | �?| 股票代码 |
| `v6Score` | `number \| null` | �?| V6 自动评分�?-5�?|
| `intelligentScore` | `number \| null` | �?| 智能评分�?-5�?|
| `industryScore` | `number \| null` | �?| 行业/主题评分�?-5�?|
| `valuationScore` | `number \| null` | �?| 估值因子分�?-5�?|
| `composite` | `number \| null` | �?| 综合评分�?-5�?|
| `rationale` | `string` | �?| 评分来源摘要 |
| `scoredAt` | `number \| null` | �?| 最近评分时�?|

### 9.8 PortfolioBuilderInput �?组合构建输入

**来源**: `src/services/trading/portfolioBuilder.ts:9-21`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `theme` | `ThemeConfig` | �?| 主题配置 |
| `stocks` | `Stock[]` | �?| 候选股票池 |
| `totalPortfolioValue` | `number` | �?| 总资产净�?|
| `currentHoldings` | `Record<string, number>` | �?| 当前持仓股数 |
| `scoringOptions` | `ScoringAdapterOptions` | �?| 评分适配器选项 |
| `ruleConfig` | `StrategyRuleConfig` | �?| 策略规则配置 |

### 9.9 RunStrategyOptions �?策略引擎选项

**来源**: `src/services/trading/strategyEngine.ts:17-24`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `theme` | `ThemeConfig` | �?| 主题配置 |
| `ruleConfig` | `StrategyRuleConfig` | �?| 策略规则配置 |
| `momentumMap` | `Record<string, number>` | �?| 动量快照（symbol �?priceToMA20�?|

### 9.10 交易服务模块函数清单

| 模块 | 核心函数 | 描述 |
|------|---------|------|
| `tradingService` | `createOrderFromSignal`, `computeTradeAdvice` | 订单创建与交易建议生�?|
| `signalGenerator` | `generateSignalsForSymbol`, `pickStrongestSignal` | 技术信号生成（MA/RSI/量比/MACD�?|
| `riskEngine` | `checkOrderRisk` | 风控检查（冷却�?仓位/新鲜度） |
| `positionSizer` | `calculatePosition` | Kelly 公式仓位计算 |
| `scoringAdapter` | `getCompositeScores` | V6+智能+行业三维评分聚合 |
| `strategyEngine` | `runStrategy`, `classifyStocks` | 20�?3 策略规则引擎 |
| `portfolioBuilder` | `buildThemePortfolio` | 主题组合构建与再平衡 |
