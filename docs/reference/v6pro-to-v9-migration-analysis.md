---
title: V6 Pro �?V9 源码比对与二次开发重点模块梳�?tier: important
type: reference
domain: project
phase: development
status: active
maintainer: V9 Architecture Team
summary: "┌─────────────────────────────────────────────────────────────�?
tags: [project, migration, analysis]
version: v0.9.0
last_updated: 2026-06-25
code_version: 2.0.0
doc_id: V9-DOC-PROJ-113
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log: 
---

# V6 Pro �?V9 源码比对与二次开发重点模块梳�?
> **Status**: Current  
> **Version**: v0.9.0-migration-review  
> **Last Updated**: 2026-06-25  
> **Source**: `D:/有价值对�?v6pro_source_backup.tar/v6pro_source_backup/app`  
> **Target**: `C:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9`

---

## 1. 背景与目�?
V6 Pro 是上一代功能完整的智能投研系统，拥有成熟的数据层、UI 组件库、驾驶舱 Widget 框架和丰富的页面体系。V9 在架构规范（五层架构、DataBridge 信封、ACL、路由注册表）上做了重构，但当前页面层与部分数据能力明显滞后�?V6 Pro�?
本文档通过**源码级比�?*，梳理：
1. V6 Pro 的数据架构、UI 组件、驾驶舱框架、页面路由现状�?2. �?V9 当前实现的差异�?3. **可直接迁移或借鉴的二次开发重点模�?*，按优先级与迁移成本排序�?4. 迁移约束、风险与建议实施路线�?
---

## 2. V6 Pro 整体架构概览

```
┌─────────────────────────────────────────────────────────────�?�?                       L5 展示�?                             �?�? pages/*  +  components/*  +  cockpit/*  +  agents/*         �?├─────────────────────────────────────────────────────────────�?�?                       L4 应用�?                             �?�? pages/*（业务编排）+  components/trading|news|collect|analysis�?├─────────────────────────────────────────────────────────────�?�?                       L3 引擎/服务�?                        �?�? data/*（业务融合）+  lib/*  +  agents/analysis/*             �?├─────────────────────────────────────────────────────────────�?�?                       L2 数据访问�?                         �?�? data/dataLayer.ts  +  data/db.ts                             �?├─────────────────────────────────────────────────────────────�?�?                       L1 基础设施�?                         �?�? IndexedDB(V6ProDB v7)  +  tRPC 后端(api/)  +  Python 采集    �?└─────────────────────────────────────────────────────────────�?```

**关键特征**�?- 前后端一体：前端通过 `tRPC` + React Query 调用 Node 后端（`/api/trpc`）�?- 本地持久化：IndexedDB `V6ProDB` 版本 7，含 16 �?store�?- Agent 框架：完整的 Agent 注册、调度、健康、任务队列、A2A/MCP 协议�?- 驾驶舱：可插�?Widget 运行时框架（注册�?+ 引擎 + 数据�?+ 事件总线 + 网格布局）�?- UI 组件库：完整 shadcn/ui v4 体系�?0+ 原子/分子组件�?
---

## 3. V9 当前架构概览

```
┌─────────────────────────────────────────────────────────────�?�?                       L5 展示�?                             �?�? portal/PortalShell.tsx  +  pages/*  +  cockpit/CockpitShell �?├─────────────────────────────────────────────────────────────�?�?                       L4 应用�?�?五舱                       �?�? apps/input/*  +  apps/analysis/*  +  apps/trading/*          �?�? apps/output/*  +  apps/command/*                             �?├─────────────────────────────────────────────────────────────�?�?                       L3 引擎/服务�?                        �?�? services/input/*  +  services/scoring/*  +  services/trading�?�? services/analysis/*  +  services/fetcher/*  +  services/system�?�? services/llm/*                                               �?├─────────────────────────────────────────────────────────────�?�?                       L2 数据访问�?                         �?�? data/dataLayer.ts  +  data/db.ts  +  core/databridge.ts      �?├─────────────────────────────────────────────────────────────�?�?                       L1 基础设施�?                         �?�? IndexedDB(V6ProDB v5)  +  DataBridge/Envelope/ACL            �?�? +  Python 采集服务(python/data_service/)                     �?└─────────────────────────────────────────────────────────────�?```

**关键特征**�?- 纯前端：�?Node 后端，所有写操作通过 `DataBridge.forward(StandardEnvelope)`�?- IndexedDB `V6ProDB` 版本 5，含 9 �?store�?- 五舱门户：`input` / `analysis` / `trading` / `output` / `command` + `cockpit`�?- 路由真相源：`src/config/routes.ts`�?- UI 组件库：自研轻量 shadcn 风格组件�?7 个原�?分子组件�?
---

## 4. 数据架构比对

### 4.1 IndexedDB Schema 对比

| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 数据库名 | `V6ProDB` | `V6ProDB`（同名，需注意版本冲突�?|
| 版本 | `7` | `5` |
| Store 数量 | 16 | 9 |
| stocks | �?keyPath `symbol`，索�?`market/industryL1/csL1/isFavorite/createdAt` | �?keyPath `symbol`，索�?`by-status/by-group` |
| daily_quotes | �?复合主键 `id`，索�?`symbol_date` | �?|
| v6_scores | �?复合主键 `id`，索�?`symbol_date/symbol/scoreDate/composite` | �?|
| v6_reports | �?| �?|
| score_history | �?| �?|
| score_docs | ✅（评分文档版本库） | �?|
| rotation_scores | ✅（板块轮动五因子） | �?|
| sector_scores | ✅（十五五板块评分） | �?|
| strategy_snapshots | �?| �?|
| news | �?| �?|
| news_stock_map | �?| �?|
| sentiment_cache | �?| �?|
| local_docs | ✅（本地知识库） | �?|
| orders | �?| �?|
| concepts | �?| �?|
| strategies | ✅（预留�?| �?|
| intelligent_scores | �?| �?|
| industry_scores | �?| �?|
| signals | �?| �?|
| research_logs | �?| �?|
| watchlists | �?| �?|

### 4.2 核心数据实体差异

| 能力 | V6 Pro | V9 |
|------|--------|-----|
| V6 报告持久�?| `v6_reports` + `score_docs` 版本�?| 仅生成页面展示，无持久化 |
| 批量评分历史 | `score_history` | �?|
| 本地知识�?| `local_docs` | �?|
| 板块轮动评分 | `rotation_scores` + 五因�?16 指标模型 | �?`hotSectorService` 静态样�?|
| 十五五板块评�?| `sector_scores` + 20 大新兴行业定�?| 仅有 `sectorSkillData.ts` 静�?SKILL |
| 策略快照 | `strategy_snapshots` + 变更追踪 | �?|
| 资讯/情感 | `news` / `news_stock_map` / `sentiment_cache` | �?|
| 投资组合 | 无显�?Portfolio 持久�?| `Portfolio` / `PortfolioHolding` / `RebalanceAction` 类型定义 |
| 智能评分 | V6Score 为主 | `IntelligentScore` + `IndustryScore` 独立 store |
| 研究状�?| �?| `researchStatus` 五态机 + `group` 分组管理 |
| 数据�?| �?| `DataBridge` + `Envelope` 异步解耦写操作 |
| 七维数据架构 | `storage/architecture.ts` + `LocalStorageManager` | �?|
| 数据融合引擎 | `dataFusion.ts` �?`UnifiedStockData` | �?|

### 4.3 数据分层设计差异

| 层级 | V6 Pro | V9 |
|------|--------|-----|
| L1 持久�?| `data/db.ts` 直接 IndexedDB | `data/db.ts` + `core/databridge.ts` 信封路由 |
| L2 访问�?| `data/dataLayer.ts` 直接 CRUD | `data/dataLayer.ts` 封装 `DataBridge.forward` |
| L3 业务融合 | `dataAPI.ts` + `dataFusion.ts` + `storage/architecture.ts` | `services/` 各引擎分散实�?|
| 后端依赖 | tRPC + Node 后端 | 纯前�?+ Python 采集服务 |

---

## 5. UI 组件设计比对

### 5.1 基础组件�?
| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 组件�?| shadcn/ui v4 + Radix UI | 自研轻量 shadcn 风格 |
| 基础组件数量 | 50+ | 18 �?|
| 变体方案 | `class-variance-authority`（CVA�?| 手动 `cn` 条件类名 |
| 组件标记 | `data-slot` 属�?| �?|
| Toast | `sonner` + `next-themes` | 自定�?`useToast` + `Toast.tsx` |
| 图表 | `lightweight-charts` + `recharts` | 无图表组�?|
| 主题 | 默认 light（slate），支持 dark | 全局 dark + 宋瓷语义�?CSS 变量 |

### 5.2 V9 现有 UI 组件

`src/components/ui/`：Badge、Breadcrumb、Button、Card、Checkbox、Dialog、Input、Progress、Select、Separator、Skeleton、Switch、Table、Tabs、Textarea、Toast、Tooltip�?
### 5.3 V6 Pro 现有 UI 组件（部分）

表单类：`button`, `input`, `textarea`, `select`, `checkbox`, `switch`, `slider`, `radio-group`, `calendar`, `form`  
容器/导航类：`card`, `dialog`, `tabs`, `table`, `badge`, `tooltip`, `popover`, `sheet`, `drawer`, `sidebar`, `breadcrumb`, `navigation-menu`, `menubar`  
反馈/数据类：`progress`, `skeleton`, `spinner`, `sonner`, `chart`, `carousel`, `accordion`, `alert`  
高级交互：`command`, `dropdown-menu`, `context-menu`, `resizable`, `scroll-area`, `hover-card`

### 5.4 布局差异

| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 全局布局 | `MainLayout` 包裹全站：左侧大侧边栏（4 大业务域分组�? 右侧主内容区 | `PortalShell` 作为路由组件：顶�?5 舱导�?+ 左侧二级 sidebar |
| 路由集成 | `MainLayout` 包裹 `<Routes>` | `PortalShell` 自身是路由目�?|
| 内容宽度 | `max-w-7xl mx-auto p-6` | 各舱自主控制 |
| 驾驶�?| `CockpitShell` 可编�?Widget 网格 | `CockpitShell` 静�?Dashboard |

---

## 6. 驾驶舱设计比�?
| 维度 | V6 Pro 驾驶�?| V9 驾驶�?|
|------|--------------|----------|
| 形�?| 可扩�?Widget 框架 | 单一静�?landing �?|
| Widget 机制 | 注册�?+ 懒加载引�?+ 生命周期 | 无，页面内容硬编�?|
| 数据�?| `DataFlowEngine`（SSE/订阅/缓存/定时刷新�?| 仅调�?`loadSystemStats()` |
| 事件联动 | `WidgetEventBus` �?Widget 联动 | �?|
| 布局 | 响应�?12 列网格，small/medium/large/full | Tailwind 固定网格 `grid-cols-2 lg:grid-cols-4` |
| 编辑能力 | 编辑模式、添�?删除/刷新/折叠 Widget | �?|
| UI 风格 | 自定�?light/dark、recharts 图表 | shadcn/ui 组件 |
| 内容 | 18 个业�?Widget + Mock 实时数据 | 核心指标卡片、模块快捷入口、资金配置、快捷操�?|

### V6 Pro 驾驶�?Widget 清单

| 分类 | Widget ID | 功能 |
|------|-----------|------|
| 市场 | `market-index` | 大盘指数 |
| 市场 | `market-sector-heatmap` | 板块热力�?|
| 市场 | `market-fundflow` | 资金流向 |
| 市场 | `market-emotion` | 市场情绪 |
| 市场 | `market-watchlist` | 自选股 |
| 持仓 | `portfolio-summary` | 持仓概览 |
| 持仓 | `portfolio-pnl` | 盈亏分析 |
| 持仓 | `portfolio-position` | 仓位管理 |
| 持仓 | `portfolio-risk` | 风险监控 |
| 持仓 | `portfolio-review` | AI 交易复盘 |
| 策略 | `strategy-signals` | 买卖信号 |
| 策略 | `strategy-radar` | 评分雷达 |
| 策略 | `strategy-screener` | 选股筛�?|
| 策略 | `strategy-backtest` | 策略回测 |
| Agent | `agent-status` | Agent 状�?|
| Agent | `agent-tasks` | 任务队列 |
| Agent | `agent-health` | 系统健康 |
| Agent | `agent-logs` | 日志�?|

---

## 7. 页面/路由结构比对

### 7.1 V6 Pro 路由结构

V6 Pro �?29 条扁平路由，分为四大功能模块 + 系统�?+ 驾驶舱：

| 模块 | 路径 | 页面 |
|------|------|------|
| 系统�?| `/` | Dashboard |
| 系统�?| `/data` | DataManagement |
| 系统�?| `/knowledge` | LocalKnowledge |
| 系统�?| `/ai-assistant` | AIAssistant |
| I. 数据采集及接�?| `/data-hub` | DataHubPage |
| I. 数据采集及接�?| `/stock-pool` | StockPoolPage |
| I. 数据采集及接�?| `/seven-dim` | SevenDimCollectPage |
| I. 数据采集及接�?| `/collect-task` | CollectTaskPage |
| I. 数据采集及接�?| `/news` | NewsPage |
| I. 数据采集及接�?| `/fetcher` | FetcherPage |
| II. 智能 AI 体调�?| `/agent-hub` | AgentHubPage |
| II. 智能 AI 体调�?| `/agents` | AgentManagerPage |
| II. 智能 AI 体调�?| `/task-dispatch` | ModulePage（占位） |
| II. 智能 AI 体调�?| `/health-monitor` | ModulePage（占位） |
| II. 智能 AI 体调�?| `/coordinator` | ModulePage（占位） |
| III. 行业个股分析 | `/analysis-hub` | AnalysisHubPage |
| III. 行业个股分析 | `/analysis-dashboard` | AnalysisDashboardPage |
| III. 行业个股分析 | `/stock-pool` | StockPool（⚠�?与上面冲突） |
| III. 行业个股分析 | `/sectors` | SectorAnalysis |
| III. 行业个股分析 | `/sector-rotation` | SectorRotation |
| III. 行业个股分析 | `/analysis` | StockAnalysis |
| III. 行业个股分析 | `/stock-tracker` | StockTracker |
| IV. 交易及持�?| `/trading-hub` | TradingHubPage |
| IV. 交易及持�?| `/strategy` | StrategyPage |
| IV. 交易及持�?| `/strategy-executor` | StrategyExecutor |
| IV. 交易及持�?| `/portfolio-manager` | PortfolioManager |
| IV. 交易及持�?| `/trading` | TradingPage |
| IV. 交易及持�?| `/portfolio` | PortfolioPage |
| 驾驶�?| `/cockpit` | CockpitShell |

### 7.2 V9 路由结构

V9 当前�?13 条路由，集中�?`analysis` 舱：

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | HomePage | 首页 |
| `/input` | InputHubPage / InputApp | 输入舱入�?看板 |
| `/input/bulk-import` | BulkImportPanel | 批量导入 |
| `/input/hot-sectors` | HotSectorPanel | 热门板块 |
| `/input/data-test` | DataTestPanel | 采集测试 |
| `/analysis` | AnalysisHubPage | 分析�?Hub |
| `/analysis/stock-score` | StockAnalysisPage | 个股评分 |
| `/analysis/:symbol` | StockAnalysisPage | 个股详情 |
| `/analysis/sector` | SectorAnalysisPage | 板块分析 |
| `/analysis/backtest` | BacktestPage | 回测 |
| `/analysis/industry-score` | IndustryScorePage | 行业评分 |
| `/analysis/intelligent-score` | IntelligentScorePage | 智能评分 |
| `/trading` | TradingHubPage / TradingApp | 交易�?|
| `/output` | OutputHubPage / OutputApp | 输出�?|
| `/command` | CommandHubPage / CommandApp | 总控�?|
| `/cockpit` | CockpitShell | 驾驶�?|

### 7.3 路由差异总结

| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 注册位置 | `src/App.tsx` 扁平列表 | `src/config/routes.ts` 分类注册�?|
| 架构模式 | 功能模块扁平路由 | 五舱（portal + 5 cabins）架�?|
| 页面数量 | 29 条路由，20+ 真实功能�?| �?16 条路由，子页面集中在 analysis |
| 数据�?| tRPC + 后端 API + 本地 dataLayer | dataBridge + Envelope + IndexedDB |
| 状态管�?| React Query（tRPC�? 本地 state | Zustand + dataBridge |
| 输入�?| DataHub / StockPool / SevenDim / CollectTask / Fetcher / News | �?`InputDashboard` / `BulkImportPanel` / `HotSectorPanel` / `DataTestPanel` |
| 总控�?| AgentHub / AgentManager / 任务调度 / 健康监控 / 协调决策 | �?`CommandHubPage` + `CommandApp` |
| 交易�?| TradingHub / Strategy / StrategyExecutor / PortfolioManager / Trading / Portfolio | �?`TradingHubPage` + `TradingApp` |
| AI / 知识�?| AIAssistant / LocalKnowledge | �?|

---

## 8. 二次开发重点模块梳�?
### 8.1 模块评估矩阵

评估维度�?- **业务价�?*：对 V9 用户可见的价值�?- **架构契合�?*：与 V9 五舱架构、DataBridge、路由注册表的匹配程度�?- **迁移成本**：从 V6 Pro 迁移�?V9 所需改造量�?- **数据就绪�?*：V9 当前数据层是否已具备支撑能力�?
### 8.2 P0 �?建议优先实施（高价�?/ 中低成本 / 数据就绪�?
| 优先�?| 模块名称 | V6 Pro 来源 | V9 目标位置 | 业务价�?| 迁移要点 |
|--------|----------|-------------|------------|----------|----------|
| ⭐⭐�?| **七维数据架构与采集配置页** | `src/services/system/architectureService.ts`<br>`src/pages/input/SevenDimConfigPage.tsx`<br>`src/components/organisms/input/CollectionPlanPanel.tsx` | `src/apps/input/` 或新�?`/input/seven-dim` | 补齐输入舱核心能力，与现�?`fetcherConfig.ts` 联动 | 将七维架构定义抽象为 V9 配置；采集进度页改为调用 `fetcherService` |
| ⭐⭐�?| **股票池管理页增强** | `src/pages/analysis/PoolBoardPage.tsx`<br>`src/pages/analysis/PoolBoardPage.tsx` | `src/apps/input/InputDashboard.tsx` 或新�?`/input/stock-pool` | V9 数据层已就绪（stocks/group/status），缺完整管理页 | 复用 V6 列表/筛�?分组能力，接�?V9 `stockpoolService` |
| ⭐⭐�?| **板块轮动评分** | `src/data/sectorDefinitions.ts`<br>`src/data/sectorDefinitions.ts` | `src/services/analysis/rotationScoreService.ts` + `/analysis/sector-rotation` | 替代 `hotSectorService` 静态样本，提供量化轮动 | 新增 `rotation_scores` store；迁移五因子模型；LLM 调用改为 `services/llm/llmClient` |
| ⭐⭐�?| **十五五板块定义与评分** | `src/data/sectorDefinitions.ts`<br>`src/data/sectorSkillData.ts` | 合并�?`src/data/sectorSkillData.ts` + `src/services/scoring/industryScoreService.ts` | 直接补强 V9 行业评分能力 | �?V6 板块定义数据下沉�?V9 数据层；复用 V4 行业评分流程 |
| ⭐⭐ | **V6 评分报告版本�?* | `src/data/types.ts`（V6Score/ScoreDocVersion�?br>`src/data/dataLayer.ts`（scoreDocs�?| `src/data/dataLayer.ts` 新增 `scoreDocStore` + `src/services/analysis/scoreDocService.ts` | 支持单股多版本报告、diff、导�?Markdown | 新增 `score_docs` store；保�?V9 `IntelligentScore` / `IndustryScore` 不变 |
| ⭐⭐ | **策略快照与变更追�?* | `src/data/types.ts`（StrategySnapshot/StrategyChangeLog�?br>`src/data/dataLayer.ts`（strategy_snapshots�?| `src/services/trading/strategySnapshotService.ts` | 支持 core/hot/value 分组快照�?diff | 新增 `strategy_snapshots` store；与 `strategyEngine` 输出结构对齐 |

### 8.3 P1 �?中高价值（需 UI/服务层较大改造）

| 优先�?| 模块名称 | V6 Pro 来源 | V9 目标位置 | 业务价�?| 迁移要点 |
|--------|----------|-------------|------------|----------|----------|
| ⭐⭐ | **可编�?Widget 驾驶舱框�?* | `src/mcp/core/registry.ts`<br>`src/services/scoring/v6-engine/engine.ts`<br>`src/cockpit`<br>`src/lib/eventBus.ts`<br>`src/components/atoms/Grid.tsx` | 重构 `src/cockpit/CockpitShell.tsx` | 将静�?Dashboard 升级为可插拔卡片系统 | 保留 V9 UI 风格，替�?V6 单例 Map �?Zustand �?Context；SSE 改为轮询或事件总线 |
| ⭐⭐ | **市场�?Widget** | `src/cockpit/widgets/market/*` | `src/cockpit/widgets/market/*` | 驾驶舱核心内�?| �?V9 组件重写；接�?`fetcherService` �?Mock 数据 |
| ⭐⭐ | **持仓/组合 Widget** | `src/cockpit/widgets/portfolio/*`<br>`src/pages/trading/PortfolioPage.tsx` | `src/cockpit/widgets/portfolio/*` + `src/apps/trading/` | 交易舱核心内�?| 复用 V9 `Portfolio` 类型；重�?UI |
| ⭐⭐ | **交易记录 / 模拟交易�?* | `src/pages/trading`<br>`src/pages/trading/TradingFlowPage.tsx` | `src/apps/trading/` | 补足交易舱功�?| �?V6 tRPC 调用替换�?`tradingService`；接�?V9 风控/仓位引擎 |
| ⭐⭐ | **AI 交易复盘** | `src/pages/output/TradeReviewPage.tsx`<br>`src/services/trading/tradeReviewAI.ts` | `src/apps/trading/` �?`src/apps/command/` | 高价值复盘能�?| �?tRPC 替换为本�?LLM 调用；接�?V9 `Order` 数据 |
| ⭐⭐ | **资讯与情感数据层** | `src/data/types.ts`（NewsArticle/NewsStockMap/SentimentCache�?br>`src/agents/news/*` | `src/services/news/*` + `/input/news` �?`/command/news` | 输入舱信息入�?| 新增 `news/news_stock_map/sentiment_cache` 三个 store；迁移财经源适配�?|
| �?| **本地知识�?* | `src/pages/input/LocalKnowledgePage.tsx`<br>`src/mcp/servers/knowledge/knowledgeServer.ts`<br>`src/services/system/localEmbeddingService.ts` | `src/apps/command/` 或独�?`/knowledge` | RAG/文档管理 | 新增 `local_docs` store；LLM 调用改为 V9 `llmClient` |

### 8.4 P2 �?按需实施（高价值但架构差异大或依赖后端�?
| 优先�?| 模块名称 | V6 Pro 来源 | V9 目标位置 | 业务价�?| 迁移要点 |
|--------|----------|-------------|------------|----------|----------|
| ⭐⭐ | **Agent 中心与管�?* | `src/agents/core/*`<br>`src/pages/command/agent/AgentHubPage.tsx`<br>`src/pages/command/agent/AgentRegistryPage.tsx`<br>`src/pages/command/agent/AgentRegistryPage.tsx` | `src/apps/command/` | 总控舱核心能�?| V6 是完�?Agent 运行时；V9 当前无后端，需评估是否作为纯前端状态机或延迟到 V10 |
| �?| **AI 助手对话�?* | `src/pages/command/agent/AgentHubPage.tsx` | `src/apps/command/` 或全局浮窗 | 用户交互入口 | 依赖 LLM �?RAG，可先作�?`llmClient` + `local_docs` 的查询界�?|
| �?| **数据管理�?* | `src/pages/input/LocalKnowledgePage.tsx`<br>`src/pages/output/OutputHubPage.tsx` | `src/apps/command/` | 系统管理 | 导出/导入/清空 IndexedDB，与 V9 `systemService` 能力重合 |
| �?| **shadcn/ui 组件库补�?* | `src/components/ui/*` | `src/components/ui/*` | 提升 UI 一致性与开发效�?| �?V9 主题变量逐个迁移，避免一次性引入过多组�?|

---

## 9. 迁移风险与约�?
### 9.1 架构约束（必须遵守）

1. **禁止引入 Node 后端**：V9 为纯前端架构，V6 �?tRPC 调用必须替换为本�?`services/` 层调用�?2. **写操作必�?DataBridge**：所�?IndexedDB 写入必须通过 `DataBridge.forward(StandardEnvelope)`，禁�?L5/L4 直接调用 `dataLayer`�?3. **路由注册规范**：新增页面必须在 `src/config/routes.ts` 注册，并同步更新 `./06-routing-specs.md`�?4. **配置优先**：阈值、权重、解析规则必须从 `src/config/*.ts` 读取�?5. **API 兼容�?*：对外暴露的服务方法签名尽量保持不变，避免影响上层调用�?6. **不新增大型依�?*：除非经�?ADR 评审�?
### 9.2 数据层风�?
1. **数据库版本冲�?*：V6 Pro �?V9 使用同名数据�?`V6ProDB`，但版本号不同（v7 vs v5）。若在同一域名/端口运行，会触发 IndexedDB 版本升级。迁移时应：
   - 统一 schema �?V9 �?`dbConfig.ts`�?   - �?`db.ts` �?`onupgradeneeded` 中处理新�?store 的创建与旧数据兼容�?   - 必要时重命名数据库以隔离开发与生产环境�?2. **数据融合引擎依赖**：V6 �?`dataFusion.ts` 依赖 AKShare、技术指标、情感、板块强度等多源数据，V9 当前仅接�?AKShare 部分字段，需补齐数据源或提供 Mock 回退�?3. **tRPC 类型丢失**：V6 大量页面使用 `trpc.*.useQuery`，迁移时需重新设计数据获取逻辑（本地服�?+ Zustand / React Query）�?
### 9.3 UI/UX 风险

1. **组件库版本差�?*：V6 使用 shadcn/ui v4（`data-slot` 标记），V9 使用自研轻量组件，迁移业务组件时需注意 prop �?className 适配�?2. **主题色差**：V6 默认 light，V9 全局 dark，迁移时需统一�?V9 深色主题�?CSS 变量�?3. **图表依赖**：V6 使用 `lightweight-charts` �?`recharts`，V9 当前无图表组件，引入时需评估包体积�?
### 9.4 测试与文档风�?
1. **测试覆盖**：V9 当前要求 `npm test` 全部通过，新增模块需同步补充单元测试�?2. **文档同步**：每新增一个模块，需更新 `./02-functional-specs.md`、`./05-engine-specs.md`、`./06-routing-specs.md`、`./08-implementation-plan.md`�?3. **审计基线**：新增代码可能增�?`audit:hardcode` 的静默回退/魔法数字计数，需保持 Fatal �?0，并尽量控制 Critical/Major 增长�?
---

## 10. 建议实施路线

### Phase 1：数据层补齐�?~2 周）

目标：让 V9 具备承载 V6 核心能力的数据底座�?
1. **统一 IndexedDB Schema**�?   - 评估是否需要将 `V6ProDB` 升级�?v7，或�?v5 基础上新�?store�?   - 新增/合并 store：`rotation_scores`、`sector_scores`、`score_docs`、`strategy_snapshots`、`news`、`news_stock_map`、`sentiment_cache`、`local_docs`�?2. **迁移数据融合能力**�?   - �?`storage/architecture.ts` 的七维架构抽象为 V9 配置�?   - �?`dataFusion.ts` 的核心逻辑适配�?V9 `services/analysis/unifiedStockService.ts`�?3. **迁移板块与轮动能�?*�?   - �?`rotationData.ts` + `sectorData.ts` 的数据字典迁移到 V9 `src/data/`�?   - 新增 `services/analysis/rotationScoreService.ts`�?
### Phase 2：输入舱页面补齐�?~2 周）

目标：让输入舱从“录入看板”升级为“数据工场”�?
1. 新增 `/input/stock-pool` 股票池管理页（复�?V6 列表/筛�?分组）�?2. 新增 `/input/seven-dim` 七维采集配置页�?3. 增强 `/input/hot-sectors` 为真正的板块轮动入口�?4. 新增 `/input/news` 智能资讯入口（P1 可选）�?
### Phase 3：交易舱与驾驶舱升级�?~3 周）

目标：补齐交易能力，升级驾驶舱为 Widget 框架�?
1. 迁移/重写 `PortfolioManager`、`SimulatedTrading`、`TradeReviewDashboard` �?`src/apps/trading/`�?2. 新增 `/trading/portfolio`、`/trading/records`、`/trading/review` 子路由�?3. 重构 `CockpitShell` �?Widget 运行时框架（注册�?+ 引擎 + 数据�?+ 网格）�?4. 逐步接入市场/持仓/策略/Agent Widget�?
### Phase 4：总控舱与 Agent / AI 助手�?~4 周，按需�?
目标：补�?Agent 调度、AI 助手、知识库能力�?
1. 评估 Agent 运行时是纯前端状态机还是延迟�?V10 后端支撑�?2. 实现 `AgentHubPage` / `AgentManagerPage` 前端壳子（展示状�?任务/日志）�?3. 实现 `LocalKnowledge` 本地知识库页面�?4. 实现 `AIAssistant` 对话页�?
### Phase 5：UI 组件库补齐（贯穿全程�?
1. 按业务需求逐步�?V6 �?shadcn/ui 组件中迁移缺少的组件�?V9 `src/components/ui/`�?2. 优先补齐：`chart`、`calendar`、`slider`、`radio-group`、`dropdown-menu`、`scroll-area`、`command`、`accordion`�?
---

## 11. 结论

V6 Pro �?V9 二次开发的宝贵资产库，尤其�?*数据融合、板块轮动、驾驶舱 Widget 框架、交�?组合管理、资讯情感、本地知识库**等方面远�?V9 当前实现�?
V9 的优势在�?*架构规范清晰、纯前端离线可用、路由注册规范、DataBridge 解�?*。二次开发应遵循�?*数据层优先补�?�?输入舱页面落�?�?交易舱与驾驶舱升�?�?总控�?Agent/AI 助手按需实现**”的路线�?
迁移过程中必须坚�?V9 架构铁律�?*不写死数据、不直接操作 IndexedDB、不引入未评审依赖、不同步更新文档与测�?*�?

---

## 12. 实施更新记录

### 2026-06-24：Phase 2 第二�?V6 Pro �?V9 JSON 数据迁移落地

- 已完成迁移规范中间文档：`./v6-to-v9-migration-spec.md`，作�?`v6MigrationService` 的唯一权威转换依据�?- 已完成迁移服务：`src/services/system/v6MigrationService.ts`，支持解�?V6 全量导出、转�?12 个核�?store、按依赖顺序导入 V9，默认跳过已存在记录并支持覆盖�?- 已完成迁�?UI：`src/components/organisms/system/MigrationPanel.tsx`，支持文件上传、转换预览、导入执行、报告展示�?- 已在总控舱集成入口：`src/apps/command/CommandApp.tsx` 新增"V6 迁移"按钮�?- 已补充单元测试：`tests/v6MigrationService.test.ts`�?9 tests）、`tests/MigrationPanel.test.tsx`�? tests）�?- 全量质量门禁通过：tsc / lint / test�?91 passed�? build / e2e�? passed）�?