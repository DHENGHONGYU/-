---
title: cabins-overview
type: explanation
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "统览 5 大舱（cabin）的职责、页面与关键路由，补《文档理解核查报告》「舱职责文档分散」缺口�?
tags: [project, input-cabin, plan, explanation, governance, documentation, strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-036
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 舱室总览（Cabins Overview�?
> **定位**：统�?5 大舱（cabin）的职责、页面与关键路由，补《文档理解核查报告》「舱职责文档分散」缺口�?> **权威路由**：`src/config/routes.ts`�?2 条）、`../reference/06-routing-specs.md`�?> **状�?*：✅ P0 新增（骨架版，各舱详�?spec �?`02-design/*-cabin-spec.md`�?
---

## 1. 舱室职责矩阵

| �?| 入口 | 页面�?| 核心职责 | 代表页面 |
|----|------|:---:|----------|----------|
| **input** | `/input` | 4 | 数据输入与采集配置：行情源、采集任务、数据源注册 | InputPage 等（�?`../reference/input-cabin-spec.md`�?|
| **analysis** | `/analysis` | 12 | 投研分析中枢：评分、信号、板�?行业、回测、新闻、股票池 | StockAnalysis / IntelligentScore / Backtest / HotSector / News / StockPoolBoard / SectorAnalysis / MultiFactorFilter / ValuePit / IndustryScore / ScoreComparison / ScoreDoc |
| **trading** | `/trading` | 5 | 交易与持仓：组合、持仓、风控、策略快照、交易流 | Portfolio / Holdings / RiskControl / StrategySnapshot / TradingFlow |
| **output** | `/output` | 5 | 产出与复盘：仪表盘、输出中枢、研究报、复盘向导、交易复�?| Dashboard / OutputHub / ResearchReport / ReviewWizard / TradeReview |
| **command** | `/command` | 1*(�?+多子路由 | 总控舱：架构健康、Agent/MCP 管理、监控、Showcase | MCPServerDashboard（壳�? /command/health�?command/agents/*�?command/mcp-servers�?command/monitor�?command/showcase |

> 注：`command` 舱以单一 `{Command}App` 分发�?+ 多子路由实现，页面文件仅 1 个壳，但功能面最广（健康总览、Agent 编排、MCP 服务、监控）�?
---

## 2. 加载机制�?App 角色定位

### 2.1 三级加载�?
```
PortalShell (src/portal/PortalShell.tsx)
  └─ React.lazy(() => import('@/apps/{cabin}/{Xxx}App'))   �?二级：舱分发�?       └─ <{Xxx}App /> �?渲染 src/pages/{cabin}/*Page.tsx   �?三级：页�?```

### 2.2 逐舱 App 分发器角�?
| �?| App 分发器（`src/apps/`�?| 角色 | 调用�?| 备注 |
|----|------|------|------|------|
| input | `InputApp.tsx` | 输入舱分发器 | PortalShell→InputApp→pages/input/* | ⚠️ 待整改：`apps/input/` �?`BulkImportPanel`/`DataTestPanel`/`HotSectorPanel`/`InputDashboard`，应�?`pages/` �?`components/` |
| analysis | `AnalysisApp.tsx` | 分析舱分发器 | PortalShell→AnalysisApp→pages/analysis/* | �?干净 |
| trading | `TradingApp.tsx` | 交易舱分发器 | PortalShell→TradingApp→pages/trading/* | ⚠️ 待整改：`apps/trading/` �?`components/` `panels/` |
| output | `OutputApp.tsx` | 产出舱分发器 | PortalShell→OutputApp→pages/output/* | �?干净 |
| command | `CommandApp.tsx` `AgentApp.tsx` `ConfigApp.tsx` | 命令舱分发器（三 dispatcher�?| PortalShell→CommandApp/AgentApp；CommandApp �?`React.lazy(ConfigApp)` 服务 `/command/config` | ⚠️ 二级嵌套，文档须显式呈现 |

> **角色边界**：`apps/` 仅承�?`{Cabin}App.tsx` 分发器，页面组件一律在 `pages/{cabin}/` �?`components/`。目录指�?`../00-meta/directory-structure-guide.md` §2.3.1 同此约束�?
---

## 3. 跨舱依赖（高优先级关注）

- **analysis �?output**：分析结论经 `output` 复盘向导/研究报产出�?- **input �?analysis**：采集数据经 IndexedDB 供分析消费�?- **trading �?output**：交易复盘回�?`TradeReview`�?- **command**：横向监控全部舱的健康度（`/command/health` 架构仪表盘）�?
---

## 4. 驾驶舱（Cockpit）与舱的关系

Cockpit �?*跨舱的可定制仪表盘子系统**（`src/cockpit/`），�?Widget 组合呈现各舱核心指标，非独立舱。已知核�?Widget�?
| 代号 | Widget | 关联�?|
|------|--------|--------|
| A | InvestmentProfile / 分析中心 | analysis |
| B | StockPool 管理与监�?| analysis/input |
| C | KaiScore 选股综合评分 | analysis |
| D | ModelCompare 大模型智能对�?| analysis/command |
| E | 个股/市场深度分析聊天 | analysis |
| + | AgentPerformance / AITradeReview / EngineStatus / FundFlow / HotSector / MarketIndices / MarketSentiment / PnLAnalysis / PortfolioOverview / PositionControl | 对应�?|

Widget 集成三处必改：`src/cockpit/core/widgetRegistry.ts`、`src/constants/cockpit.constants.ts`（`DEFAULT_WIDGET_CONFIG` + `WIDGET_DEFAULT_DATA_SOURCE`）、组件消�?`useMarketData()`�?
---

## 5. 文档锚点

- input：`../reference/input-cabin-spec.md`（✅ 已有�?- analysis/trading/output/command：`02-design/{analysis,trading,output,command}-cabin-spec.md`（✅ P0 新增�?- 路由明细：`../reference/06-routing-specs.md`
- 全局架构：`./overview.md`
