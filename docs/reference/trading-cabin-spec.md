---
title: Trading 舱规格（trading-cabin-spec）
type: reference
domain: backend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "trading 舱（交易与持仓）的职责边界、页面、路由、数据流。补「4 舱缺 spec」缺口。"
tags: [backend, trading, input-cabin, spec, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-013
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# Trading 舱规格（trading-cabin-spec）

> **定位**：trading 舱（交易与持仓）的职责边界、页面、路由、数据流。补「4 舱缺 spec」缺口。
> **权威契约**：`../../AGENTS.md`；路由见 `./06-routing-specs.md`；总览见 `../explanation/cabins-overview.md`。
> **状态**：? P0 新增（骨架版）

---

## 1. 职责边界

交易与持仓管理：组合、持仓、风控、策略快照、交易流编排。基于 analysis 的分析结论执行交易域逻辑（**本系统为研究辅助，非真实下单通道**；交易流为模拟/复盘性质）。

## 2. 页面清单（5 个，文件位于 `src/pages/trading/`）

| 页面文件 | 路由 | 职责 |
|----------|------|------|
| PortfolioPage | `/trading`(默认) | 组合总览 |
| HoldingsPage | `/trading/holdings` | 持仓明细 |
| RiskControlPage | `/trading/risk` | 风控面板 |
| StrategySnapshotPage | `/trading/strategy` | 策略快照 |
| TradingFlowPage | `/trading/flow` | 交易流 |

## 3. 路由与分发

入口 `/trading` → `src/apps/trading/TradingApp.tsx` 分发 → 上述 `*Page`。

## 4. 数据流

`store/portfolio` + `store/trade` ← `services/trading` + `services/trade` + `services/portfolio` + `riskControlService`；风控结果经 `store` 回流页面。

## 5. 跨舱依赖

- 上游：`analysis`（决策依据）、`output`（交易复盘 `TradeReview`）
- 下游：`command`（健康监控）、`output`（`TradeReviewPage`）
- 共享：`cockpit` Widget（PortfolioOverview / PositionControl / PnLAnalysis / RiskControl）

## 6. 文档锚点

- 总览：`../explanation/cabins-overview.md`
- 路由：`./06-routing-specs.md`
- 服务：`./services-catalog.md`（trading / trade / portfolio）
