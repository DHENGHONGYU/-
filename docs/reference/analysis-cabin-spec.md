---
title: Analysis 舱规格（analysis-cabin-spec�?
type: reference
domain: project
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "analysis 舱（投研分析中枢）的职责边界、页面、路由、数据流定义。补�? 舱缺 spec」缺口�?
tags: [project, input-cabin, analysis, spec, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-079
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: project
tier: important
doc_id: V9-DOC-PROJ-079
status: active
maintainer: V9 Architecture Team
summary: "analysis 舱（投研分析中枢）的职责边界、页面、路由、数据流定义。补�? 舱缺 spec」缺口�?
tags: [project, input-cabin, analysis]
phase: design
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# Analysis 舱规格（analysis-cabin-spec�?
> **定位**：analysis 舱（投研分析中枢）的职责边界、页面、路由、数据流定义。补�? 舱缺 spec」缺口�?> **权威契约**：`../../AGENTS.md` §一/§二；路由�?`./06-routing-specs.md`；总览�?`../explanation/cabins-overview.md`�?> **状�?*：✅ P0 新增（骨架版�?
---

## 1. 职责边界

投研分析中枢：承�?`input` 采集的数据，进行评分、信号、板�?行业、回测、新闻、股票池等分析，产出可供 `output` 复盘�?`trading` 决策的依据�?*不直接执行交�?*�?
## 2. 页面清单�?2 个，文件位于 `src/pages/analysis/`�?
| 页面文件 | 路由 | 职责 |
|----------|------|------|
| StockAnalysisPage | `/analysis/stock-score` | 个股深度分析 |
| IntelligentScorePage | `/analysis/intelligent-score` | 智能评分 |
| IndustryScorePage | `/analysis/industry-score` | 行业评分 |
| SectorAnalysisPage | `/analysis/sector` | 板块分析 |
| HotSectorPage | `/analysis/hot-sector` | 热点板块 |
| BacktestPage | `/analysis/backtest` | 策略回测 |
| MultiFactorFilterPage | `/analysis/multi-factor` | 多因子筛�?|
| NewsPage | `/analysis/news` | 新闻资讯 |
| StockPoolBoardPage | `/analysis/stock-pool` | 股票池看�?|
| ValuePitPage | `/analysis/value-pit` | 价值洼�?|
| ScoreComparisonPage | `/analysis/score-comparison` | 评分对比 |
| ScoreDocPage | `/analysis/score-docs` | 评分文档 |

## 3. 路由与分�?
入口 `/analysis` �?`src/apps/analysis/AnalysisApp.tsx` 分发 �?上述 `*Page`�?
## 4. 数据�?
`IndexedDB`（input 采集）→ `services/analysis` + `services/scoring`(v6) + `services/screening` + `services/backtest` �?`DataFusion` �?`UnifiedStockData` �?`store/*` �?`pages/analysis/*Page`�?
## 5. 跨舱依赖

- 上游：`input`（数据）、`collection`（采集）
- 下游：`output`（复�?研究报）、`trading`（决策依据）、`command`（健康监控）
- 共享：`cockpit` Widget（InvestmentProfile / StockPool / KaiScore / HotSector / ModelCompare�?
## 6. 文档锚点

- 总览：`../explanation/cabins-overview.md`
- 路由：`./06-routing-specs.md`
- 组件：`./atomic-component-system.md`
- 服务：`./services-catalog.md`（analysis / scoring / screening / backtest / stock-analysis / stockpool�?