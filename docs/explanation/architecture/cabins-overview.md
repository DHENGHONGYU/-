# V9 舱室总览（Cabins Overview）

> **定位**：统览 5 大舱（cabin）的职责、页面与关键路由，补《文档理解核查报告》「舱职责文档分散」缺口。
> **权威路由**：`src/config/routes.ts`（62 条）、`02-design/06-routing-specs.md`。
> **状态**：✅ P0 新增（骨架版，各舱详细 spec 见 `02-design/*-cabin-spec.md`）

---

## 1. 舱室职责矩阵

| 舱 | 入口 | 页面数 | 核心职责 | 代表页面 |
|----|------|:---:|----------|----------|
| **input** | `/input` | 4 | 数据输入与采集配置：行情源、采集任务、数据源注册 | InputPage 等（见 `input-cabin-spec.md`） |
| **analysis** | `/analysis` | 12 | 投研分析中枢：评分、信号、板块/行业、回测、新闻、股票池 | StockAnalysis / IntelligentScore / Backtest / HotSector / News / StockPoolBoard / SectorAnalysis / MultiFactorFilter / ValuePit / IndustryScore / ScoreComparison / ScoreDoc |
| **trading** | `/trading` | 5 | 交易与持仓：组合、持仓、风控、策略快照、交易流 | Portfolio / Holdings / RiskControl / StrategySnapshot / TradingFlow |
| **output** | `/output` | 5 | 产出与复盘：仪表盘、输出中枢、研究报、复盘向导、交易复盘 | Dashboard / OutputHub / ResearchReport / ReviewWizard / TradeReview |
| **command** | `/command` | 1*(壳)+多子路由 | 总控舱：架构健康、Agent/MCP 管理、监控、Showcase | MCPServerDashboard（壳）+ /command/health、/command/agents/*、/command/mcp-servers、/command/monitor、/command/showcase |

> 注：`command` 舱以单一 `{Command}App` 分发器 + 多子路由实现，页面文件仅 1 个壳，但功能面最广（健康总览、Agent 编排、MCP 服务、监控）。

---

## 2. 加载机制

每个舱对应 `src/apps/{cabin}/{Cabin}App.tsx` 分发器，经 `PortalShell` 统一壳后懒加载 `src/pages/{cabin}/*Page.tsx`（详见 `architecture/overview.md` §3）。

---

## 3. 跨舱依赖（高优先级关注）

- **analysis → output**：分析结论经 `output` 复盘向导/研究报产出。
- **input → analysis**：采集数据经 IndexedDB 供分析消费。
- **trading → output**：交易复盘回流 `TradeReview`。
- **command**：横向监控全部舱的健康度（`/command/health` 架构仪表盘）。

---

## 4. 驾驶舱（Cockpit）与舱的关系

Cockpit 是**跨舱的可定制仪表盘子系统**（`src/cockpit/`），以 Widget 组合呈现各舱核心指标，非独立舱。已知核心 Widget：

| 代号 | Widget | 关联舱 |
|------|--------|--------|
| A | InvestmentProfile / 分析中心 | analysis |
| B | StockPool 管理与监控 | analysis/input |
| C | KaiScore 选股综合评分 | analysis |
| D | ModelCompare 大模型智能对比 | analysis/command |
| E | 个股/市场深度分析聊天 | analysis |
| + | AgentPerformance / AITradeReview / EngineStatus / FundFlow / HotSector / MarketIndices / MarketSentiment / PnLAnalysis / PortfolioOverview / PositionControl | 对应域 |

Widget 集成三处必改：`src/cockpit/core/widgetRegistry.ts`、`src/constants/cockpit.constants.ts`（`DEFAULT_WIDGET_CONFIG` + `WIDGET_DEFAULT_DATA_SOURCE`）、组件消费 `useMarketData()`。

---

## 5. 文档锚点

- input：`01-requirements/input-cabin-spec.md`（✅ 已有）
- analysis/trading/output/command：`02-design/{analysis,trading,output,command}-cabin-spec.md`（✅ P0 新增）
- 路由明细：`02-design/06-routing-specs.md`
- 全局架构：`architecture/overview.md`
