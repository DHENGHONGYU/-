---
title: 投资流程阶段化分析：仓位、引擎、数据架构与数据交互
type: explanation
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文档把 V9 投资研究流程拆分为 13 个阶段，逐项说明：业务动作、研究池仓位、实际交易仓位、负责引擎、数据架构、数据交互方式、当前实现状态以及与下阶段的衔接。"
tags: [backend, research, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-BACK-032
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 投资流程阶段化分析：仓位、引擎、数据架构与数据交互

> **Status**: Current  
> **Version**: v1.0.0  
> **Last Updated**: 2026-06-24
>
> 本文档把 V9 投资研究流程拆分为 13 个阶段，逐项说明：业务动作、研究池仓位、实际交易仓位、负责引擎、数据架构、数据交互方式、当前实现状态以及与下阶段的衔接。

## 1. 阶段总览

```
采集 → 录入/导入 → 基础数据落地 → 分析评分 → 筛选/晋升 → 深度研究 → 观察/决策
                                                            ↓
平仓/卖出 ← 持仓管理 ← 建仓 ← 信号生成 ← 观察池
   ↓
归档 → 检查/复盘
```

## 2. 逐项阶段分析

| 阶段 | 业务动作 | 研究池仓位 | 实际交易仓位 | 负责引擎 / 服务 | 数据架构（Store / 字段） | 数据交互（输入 / 输出 / DataBridge Action） | 当前状态 | 与下阶段衔接 |
|------|----------|------------|--------------|-----------------|-------------------------|--------------------------------------------|----------|--------------|
| **1. 采集** | 从 AKShare/Python 服务抓取基础数据、K线数据 | 无（数据准备） | 无 | **FetcherEngine**<br>`fetcherClient.ts`<br>`fetcherAdapter.ts` | `stocks`（待更新）<br>`daily_quotes`（待写入） | HTTP → Python 服务 → `collectBasic` / `collectKline` → 解析后准备写入 | 已实现 | 为录入后的标的补充数据质量 |
| **2. 录入/导入** | 手动录入、CSV 批量导入、热门板块加入 | `candidate` | 无 | **InputEngine**<br>`inputService.addStock`<br>`batchImportService.importStocks`<br>`hotSectorService.addHotSectorStock/s` | `stocks`（新增）<br>字段：`symbol, name, researchStatus=candidate, source, dataVersion, ingestedAt` | UI → service → `DataBridge.forward(INSERT_STOCK)` → `stocks` | 已实现 | 产生候选池原料 |
| **3. 基础数据落地** | 录入后拉取基础/K线，标记数据质量 | `candidate` | 无 | **FetcherEngine + DataQualityEngine**（内嵌在 `fetcherService`） | `stocks.dataQuality`<br>`{ basic, kline, finance, lastChecked }`<br>`daily_quotes` | `fetchStockBasic/Kline` → `DataBridge.forward(UPDATE_STOCK / SAVE_DAILY_QUOTES)` | 已实现 | 数据质量满足后才适合进入分析 |
| **4. 分析评分** | V6 九维评分、LLM 智能评分、V4 行业评分 | `candidate` / `screened` / `deepDive` | 无 | **ScoringEngine**<br>`v6ScoreService`<br>`intelligentScoreService`<br>`industryScoreService` | `v6_scores`<br>`intelligent_scores`<br>`industry_scores` | 读 `stocks` + `daily_quotes` → 计算 → `DataBridge.forward(SAVE_SCORES / SAVE_INTELLIGENT_SCORES / SAVE_INDUSTRY_SCORES)` | V6/LLM/V4 已实现；V6 当前大量 mock 分 | 评分为筛选提供量化依据 |
| **5. 筛选/晋升** | 基于评分与数据质量把 candidate → screened，screened → deepDive | `candidate → screened`<br>`screened → deepDive` | 无 | **ScreeningEngine**（**缺失**）<br>目前由 `stockpoolService.transitionStock` 手动触发 | `stocks.researchStatus` | 规则引擎输出 → `stockpoolService.transitionStock` → `DataBridge.forward(UPDATE_STOCK)` | **未实现自动筛选**，仅有输入舱看板手动按钮 | 筛选产出值得深度研究的标的 |
| **6. 深度研究** | 研究员对 deepDive 标的做深度判断 | `deepDive` | 无 | **ResearchEngine** / **IntelligentScoreEngine**（LLM） | `stocks`<br>`intelligent_scores`<br>`research_logs`（规划中） | 读取评分 + 补充材料 → LLM 生成报告 → 手动/自动决定晋升 | LLM 深度评分已实现；自动决策未实现 | 决定进入观察池或归档 |
| **7. 观察/决策** | 决定跟踪，等待买点 | `deepDive → watching` | 无 | **PortfolioDecisionEngine**（**缺失**，目前手动） | `stocks.researchStatus=watching` | 手动点击“加入观察” → `stockpoolService.transitionStock` → `UPDATE_STOCK` | 手动已实现 | 为交易舱信号生成提供标的池 |
| **8. 信号生成** | 对 watching 标的生成买卖信号 | `watching` | 无 | **SignalEngine**<br>`signalGenerator.ts` | `signals`（Store 存在但当前未持久化，仅在内存使用） | 读 `stocks` + `daily_quotes` → 生成 `TradingSignal[]` → 返回交易舱 | 已实现生成逻辑；信号未持久化 | 为建仓提供触发条件 |
| **9. 建仓** | 模拟买入，生成订单 | `watching`（保持不变） | 产生持仓（`accountType: paper`） | **TradingEngine / PaperTrading**<br>`tradingService.createBuyOrder`<br>`positionSizer`<br>`riskEngine` | `orders` Store<br>字段：`id, symbol, direction, quantity, price, amount, status, accountType, createdAt` | 读 watching + signal → 计算仓位/风控 → `DataBridge.forward(INSERT_ORDER)` | 已实现（模拟盘） | 形成可跟踪的交易持仓 |
| **10. 持仓管理** | 跟踪持仓，触发加仓、止损、止盈 | `watching` | `orders` 中 `status=open` | **PositionEngine / RiskEngine**（部分在 `tradingService`） | `orders`<br>`stocks.price`<br>`daily_quotes` | `fetcherService` 更新价格 → 交易舱读取 `orders` + `daily_quotes` → 生成再平衡信号 | 基础已实现；无自动加仓/再平衡 | 触发平仓或继续持仓 |
| **11. 平仓/卖出** | 卖出持仓，订单状态变更 | `watching`（可保留或归档） | `orders` 新增 sell order，持仓归零 | **TradingEngine**<br>`tradingService.createSellOrder` | `orders` Store | 用户/信号触发 → `DataBridge.forward(INSERT_ORDER)` | 已实现 | 交易结果进入复盘数据 |
| **12. 归档** | 把不再跟踪的标的移入归档池 | `archived` | 无 | **PortfolioArchiveEngine**（目前手动） | `stocks.researchStatus=archived` | `stockpoolService.transitionStock` → `UPDATE_STOCK` | 手动已实现 | 淘汰记录进入复盘 |
| **13. 检查/复盘** | 分析评分准确性、交易盈亏、淘汰原因 | `archived` | 已平仓/持仓订单 | **ReviewEngine / ReportingEngine**（**缺失**） | `orders`<br>`stocks`<br>`v6_scores`<br>`intelligent_scores`<br>`research_logs`（规划中） | 聚合读取全部相关 Store → 生成复盘报告/指标 | **未实现专门复盘页**，仅有 `OutputApp` 全量导出 | 反馈优化下一轮采集/筛选策略 |

## 3. 数据架构全景

```
┌─────────────────────────────────────────────────────────────┐
│                        IndexedDB: V6ProDB                   │
├──────────────┬──────────────────────────────────────────────┤
│ stocks       │ symbol(PK), researchStatus, source,          │
│              │ dataQuality, price, pe, pb, ...              │
├──────────────┼──────────────────────────────────────────────┤
│ daily_quotes │ symbol(PK), latest, history, updatedAt       │
├──────────────┼──────────────────────────────────────────────┤
│ v6_scores    │ id(PK), symbol, score, factors, ...          │
├──────────────┼──────────────────────────────────────────────┤
│ intelligent_scores │ id(PK), symbol, overallScore, ...      │
├──────────────┼──────────────────────────────────────────────┤
│ industry_scores    │ id(PK), code, name, overallScore, ...  │
├──────────────┼──────────────────────────────────────────────┤
│ orders       │ id(PK), symbol, direction, quantity, price,  │
│              │ amount, status, accountType, createdAt       │
├──────────────┼──────────────────────────────────────────────┤
│ signals      │ id(PK), symbol, direction, reason, ...       │
│              │ （当前未持久化写入）                           │
├──────────────┼──────────────────────────────────────────────┤
│ research_logs│ id(PK), traceId, actor, action, target, ...  │
│              │ （部分写入，用于审计）                         │
└──────────────┴──────────────────────────────────────────────┘
```

## 4. 数据交互模式

### 4.1 写入统一走 DataBridge

所有会改变 IndexedDB 状态的写操作，都必须通过 `DataBridge.forward(StandardEnvelope)`：

| DataBridge Action | 目标 Store | 触发场景 |
|-------------------|-----------|----------|
| `INSERT_STOCK` | `stocks` | 录入/导入/热门板块加入 |
| `UPDATE_STOCK` | `stocks` | 基础数据更新、状态流转 |
| `SAVE_DAILY_QUOTES` | `daily_quotes` | K线采集 |
| `SAVE_SCORES` | `v6_scores` | V6 评分 |
| `SAVE_INTELLIGENT_SCORES` | `intelligent_scores` | LLM 智能评分 |
| `SAVE_INDUSTRY_SCORES` | `industry_scores` | 行业评分 |
| `INSERT_ORDER` | `orders` | 买入/卖出 |
| `EXPORT_ALL` / `RESET_ALL` | 全部 | 导出/重置 |

### 4.2 读取按舱复用 dataLayer

各舱 service 可以读取任意 store（受 ACL 约束），例如：

- **交易舱**读取 `v6_scores` 和 `daily_quotes` 来生成信号。
- **分析舱**读取 `stocks` 和 `daily_quotes` 来计算评分。
- **输出舱**读取全部 store 做导出。

### 4.3 事件通知

`databridge` 写入成功后会通过 `eventBus.broadcast('db:changed')`，便于 UI 层刷新股票池看板等组件。

## 5. 关键缺口与建议

| 缺口 | 影响 | 建议落地位置 |
|------|------|--------------|
| **自动筛选引擎缺失** | 评分无法自动驱动 candidate → screened → deepDive | 分析舱新增 `ScreeningEngine`，调用 `stockpoolService.transitionStock` |
| **信号未持久化** | 无法复盘信号历史、无法做信号准确率统计 | 交易舱在 `scanWatchingSignals` 后写入 `signals` Store |
| **复盘引擎缺失** | 无法闭环验证“评分 → 交易 → 盈亏” | 输出舱新增 `ReviewEngine`，聚合 `orders + scores + stocks` |
| **持仓管理与观察池状态未衔接** | 买入后 watching 标的是否归档靠人工判断 | 在交易舱下单时提供选项：保留观察 / 自动归档 |
| **研究日志不完整** | 缺少状态流转、评分、交易的完整审计链 | 在各阶段关键写操作后补充 `INSERT_RESEARCH_LOG` |

## 6. 与研究池五态、应用层五舱的对应关系

| 应用层五舱 | 主要处理的研究池状态 | 主要处理的交易仓位 | 核心产出 |
|------------|----------------------|--------------------|----------|
| **输入舱 Input** | `candidate` | 无 | 新增标的、数据质量更新 |
| **分析舱 Analysis** | `candidate → screened → deepDive` | 无 | 评分、筛选、晋升 |
| **交易舱 Trading** | `watching` | `orders`（建仓/平仓） | 信号、订单 |
| **输出舱 Output** | `archived` | 已平仓订单 | 报告、复盘 |
| **总控舱 Command** | 全部 | 全部 | 统计、配置、重置 |
