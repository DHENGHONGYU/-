---
doc_id: V9-DOC-REF-912
title: analysis-cabin-spec
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# Analysis 舱规格（analysis-cabin-spec）

> **定位**：analysis 舱（投研分析中枢）的职责边界、页面、路由、数据流定义。补「4 舱缺 spec」缺口。
> **权威契约**：`../../AGENTS.md` §一/§二；路由见 `../explanation/06-routing-specs.md`（已归档）；总览见 `../explanation/cabins-overview.md`（已归档）。
> **状态**：✅ P0 新增（骨架版）

---

## 1. 职责边界

投研分析中枢：承接 `input` 采集的数据，进行评分、信号、板块/行业、回测、新闻、股票池等分析，产出可供 `output` 复盘与 `trading` 决策的依据。**不直接执行交易**。

## 2. 页面清单（12 个，文件位于 `src/pages/analysis/`）

| 页面文件 | 路由 | 职责 |
|----------|------|------|
| StockAnalysisPage | `/analysis/stock-score` | 个股深度分析 |
| IntelligentScorePage | `/analysis/intelligent-score` | 智能评分 |
| IndustryScorePage | `/analysis/industry-score` | 行业评分 |
| SectorAnalysisPage | `/analysis/sector` | 板块分析 |
| HotSectorPage | `/analysis/hot-sector` | 热点板块 |
| BacktestPage | `/analysis/backtest` | 策略回测 |
| MultiFactorFilterPage | `/analysis/multi-factor` | 多因子筛选 |
| NewsPage | `/analysis/news` | 新闻资讯 |
| StockPoolBoardPage | `/analysis/stock-pool` | 股票池看板 |
| ValuePitPage | `/analysis/value-pit` | 价值洼地 |
| ScoreComparisonPage | `/analysis/score-comparison` | 评分对比 |
| ScoreDocPage | `/analysis/score-docs` | 评分文档 |

## 3. 路由与分发

入口 `/analysis` → `src/apps/analysis/AnalysisApp.tsx` 分发 → 上述 `*Page`。

## 4. 数据流

`IndexedDB`（input 采集）→ `services/analysis` + `services/scoring`(v6) + `services/screening` + `services/backtest` → `DataFusion` → `UnifiedStockData` → `store/*` → `pages/analysis/*Page`。

## 5. 跨舱依赖

- 上游：`input`（数据）、`collection`（采集）
- 下游：`output`（复盘/研究报）、`trading`（决策依据）、`command`（健康监控）
- 共享：`cockpit` Widget（InvestmentProfile / StockPool / KaiScore / HotSector / ModelCompare）

## 6. 文档锚点

- 总览：`../explanation/cabins-overview.md`（已归档）
- 路由：`../explanation/06-routing-specs.md`（已归档）
- 组件：`./atomic-component-system.md`
- 服务：`./services-catalog.md`（analysis / scoring / screening / backtest / stock-analysis / stockpool）
