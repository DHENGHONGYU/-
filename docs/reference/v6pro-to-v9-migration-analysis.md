---
doc_id: V9-DOC-REF-986
title: v6pro-to-v9-migration-analysis
tier: important
code_version: "2.0.0-rc.2"
version: v0.9.0-migration-review
last_updated: 2026-06-25
change_log:
  - version: v0.9.0-migration-review
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-06-25
---

# V6 Pro → V9 源码比对与二次开发重点模块梳理

> **Status**: Current  
> **Version**: v0.9.0-migration-review  
> **Last Updated**: 2026-06-25  
> **Source**: `D:/有价值对话/v6pro_source_backup.tar/v6pro_source_backup/app`  
> **Target**: `<用户目录>/Documents/kimi/Workspaces/智能投研复盘系统V9`

---

## 1. 背景与目标

V6 Pro 是上一代功能完整的智能投研系统，拥有成熟的数据层、UI 组件库、驾驶舱 Widget 框架和丰富的页面体系。V9 在架构规范（五层架构、DataBridge 信封、ACL、路由注册表）上做了重构，但当前页面层与部分数据能力明显滞后于 V6 Pro。

本文档通过**源码级比对**，梳理：
1. V6 Pro 的数据架构、UI 组件、驾驶舱框架、页面路由现状。
2. 与 V9 当前实现的差异。
3. **可直接迁移或借鉴的二次开发重点模块**，按优先级与迁移成本排序。
4. 迁移约束、风险与建议实施路线。

---

## 2. V6 Pro 整体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        L5 展示层                              │
│  pages/*  +  components/*  +  cockpit/*  +  agents/*         │
├─────────────────────────────────────────────────────────────┤
│                        L4 应用层                              │
│  pages/*（业务编排）+  components/trading|news|collect|analysis│
├─────────────────────────────────────────────────────────────┤
│                        L3 引擎/服务层                         │
│  data/*（业务融合）+  lib/*  +  agents/analysis/*             │
├─────────────────────────────────────────────────────────────┤
│                        L2 数据访问层                          │
│  data/dataLayer.ts  +  data/db.ts                             │
├─────────────────────────────────────────────────────────────┤
│                        L1 基础设施层                          │
│  IndexedDB(V6ProDB v7)  +  tRPC 后端(api/)  +  Python 采集    │
└─────────────────────────────────────────────────────────────┘
```

**关键特征**：
- 前后端一体：前端通过 `tRPC` + React Query 调用 Node 后端（`/api/trpc`）。
- 本地持久化：IndexedDB `V6ProDB` 版本 7，含 16 个 store。
- Agent 框架：完整的 Agent 注册、调度、健康、任务队列、A2A/MCP 协议。
- 驾驶舱：可插拔 Widget 运行时框架（注册表 + 引擎 + 数据流 + 事件总线 + 网格布局）。
- UI 组件库：完整 shadcn/ui v4 体系，50+ 原子/分子组件。

---

## 3. V9 当前架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        L5 展示层                              │
│  portal/PortalShell.tsx  +  pages/*  +  cockpit/CockpitShell │
├─────────────────────────────────────────────────────────────┤
│                        L4 应用层 — 五舱                       │
│  apps/input/*  +  apps/analysis/*  +  apps/trading/*          │
│  apps/output/*  +  apps/command/*                             │
├─────────────────────────────────────────────────────────────┤
│                        L3 引擎/服务层                         │
│  services/input/*  +  services/scoring/*  +  services/trading│
│  services/analysis/*  +  services/fetcher/*  +  services/system│
│  services/llm/*                                               │
├─────────────────────────────────────────────────────────────┤
│                        L2 数据访问层                          │
│  data/dataLayer.ts  +  data/db.ts  +  core/databridge.ts      │
├─────────────────────────────────────────────────────────────┤
│                        L1 基础设施层                          │
│  IndexedDB(V6ProDB v5)  +  DataBridge/Envelope/ACL            │
│  +  Python 采集服务(python/data_service/)                     │
└─────────────────────────────────────────────────────────────┘
```

**关键特征**：
- 纯前端：无 Node 后端，所有写操作通过 `DataBridge.forward(StandardEnvelope)`。
- IndexedDB `V6ProDB` 版本 5，含 9 个 store。
- 五舱门户：`input` / `analysis` / `trading` / `output` / `command` + `cockpit`。
- 路由真相源：`src/config/routes.ts`。
- UI 组件库：自研轻量 shadcn 风格组件，17 个原子/分子组件。

---

## 4. 数据架构比对

### 4.1 IndexedDB Schema 对比

| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 数据库名 | `V6ProDB` | `V6ProDB`（同名，需注意版本冲突） |
| 版本 | `7` | `5` |
| Store 数量 | 16 | 9 |
| stocks | ✅ keyPath `symbol`，索引 `market/industryL1/csL1/isFavorite/createdAt` | ✅ keyPath `symbol`，索引 `by-status/by-group` |
| daily_quotes | ✅ 复合主键 `id`，索引 `symbol_date` | ✅ |
| v6_scores | ✅ 复合主键 `id`，索引 `symbol_date/symbol/scoreDate/composite` | ✅ |
| v6_reports | ✅ | ❌ |
| score_history | ✅ | ❌ |
| score_docs | ✅（评分文档版本库） | ❌ |
| rotation_scores | ✅（板块轮动五因子） | ❌ |
| sector_scores | ✅（十五五板块评分） | ❌ |
| strategy_snapshots | ✅ | ❌ |
| news | ✅ | ❌ |
| news_stock_map | ✅ | ❌ |
| sentiment_cache | ✅ | ❌ |
| local_docs | ✅（本地知识库） | ❌ |
| orders | ✅ | ✅ |
| concepts | ✅ | ❌ |
| strategies | ✅（预留） | ❌ |
| intelligent_scores | ❌ | ✅ |
| industry_scores | ❌ | ✅ |
| signals | ❌ | ✅ |
| research_logs | ❌ | ✅ |
| watchlists | ❌ | ✅ |

### 4.2 核心数据实体差异

| 能力 | V6 Pro | V9 |
|------|--------|-----|
| V6 报告持久化 | `v6_reports` + `score_docs` 版本库 | 仅生成页面展示，无持久化 |
| 批量评分历史 | `score_history` | 无 |
| 本地知识库 | `local_docs` | 无 |
| 板块轮动评分 | `rotation_scores` + 五因子 16 指标模型 | 仅 `hotSectorService` 静态样本 |
| 十五五板块评分 | `sector_scores` + 20 大新兴行业定义 | 仅有 `sectorSkillData.ts` 静态 SKILL |
| 策略快照 | `strategy_snapshots` + 变更追踪 | 无 |
| 资讯/情感 | `news` / `news_stock_map` / `sentiment_cache` | 无 |
| 投资组合 | 无显式 Portfolio 持久化 | `Portfolio` / `PortfolioHolding` / `RebalanceAction` 类型定义 |
| 智能评分 | V6Score 为主 | `IntelligentScore` + `IndustryScore` 独立 store |
| 研究状态 | 无 | `researchStatus` 五态机 + `group` 分组管理 |
| 数据桥 | 无 | `DataBridge` + `Envelope` 异步解耦写操作 |
| 七维数据架构 | `storage/architecture.ts` + `LocalStorageManager` | 无 |
| 数据融合引擎 | `dataFusion.ts` → `UnifiedStockData` | 无 |

### 4.3 数据分层设计差异

| 层级 | V6 Pro | V9 |
|------|--------|-----|
| L1 持久化 | `data/db.ts` 直接 IndexedDB | `data/db.ts` + `core/databridge.ts` 信封路由 |
| L2 访问层 | `data/dataLayer.ts` 直接 CRUD | `data/dataLayer.ts` 封装 `DataBridge.forward` |
| L3 业务融合 | `dataAPI.ts` + `dataFusion.ts` + `storage/architecture.ts` | `services/` 各引擎分散实现 |
| 后端依赖 | tRPC + Node 后端 | 纯前端 + Python 采集服务 |

---

## 5. UI 组件设计比对

### 5.1 基础组件库

| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 组件库 | shadcn/ui v4 + Radix UI | 自研轻量 shadcn 风格 |
| 基础组件数量 | 50+ | 18 个 |
| 变体方案 | `class-variance-authority`（CVA） | 手动 `cn` 条件类名 |
| 组件标记 | `data-slot` 属性 | 无 |
| Toast | `sonner` + `next-themes` | 自定义 `useToast` + `Toast.tsx` |
| 图表 | `lightweight-charts` + `recharts` | 无图表组件 |
| 主题 | 默认 light（slate），支持 dark | 全局 dark + 宋瓷语义色 CSS 变量 |

### 5.2 V9 现有 UI 组件

`src/components/atoms/`：Badge、Breadcrumb、Button、Card、Checkbox、Dialog、Input、Progress、Select、Separator、Skeleton、Switch、Table、Tabs、Textarea、Toast、Tooltip。

### 5.3 V6 Pro 现有 UI 组件（部分）

表单类：`button`, `input`, `textarea`, `select`, `checkbox`, `switch`, `slider`, `radio-group`, `calendar`, `form`  
容器/导航类：`card`, `dialog`, `tabs`, `table`, `badge`, `tooltip`, `popover`, `sheet`, `drawer`, `sidebar`, `breadcrumb`, `navigation-menu`, `menubar`  
反馈/数据类：`progress`, `skeleton`, `spinner`, `sonner`, `chart`, `carousel`, `accordion`, `alert`  
高级交互：`command`, `dropdown-menu`, `context-menu`, `resizable`, `scroll-area`, `hover-card`

### 5.4 布局差异

| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 全局布局 | `MainLayout` 包裹全站：左侧大侧边栏（4 大业务域分组）+ 右侧主内容区 | `PortalShell` 作为路由组件：顶部 5 舱导航 + 左侧二级 sidebar |
| 路由集成 | `MainLayout` 包裹 `<Routes>` | `PortalShell` 自身是路由目标 |
| 内容宽度 | `max-w-7xl mx-auto p-6` | 各舱自主控制 |
| 驾驶舱 | `CockpitShell` 可编辑 Widget 网格 | `CockpitShell` 静态 Dashboard |

---

## 6. 驾驶舱设计比对

| 维度 | V6 Pro 驾驶舱 | V9 驾驶舱 |
|------|--------------|----------|
| 形态 | 可扩展 Widget 框架 | 单一静态 landing 页 |
| Widget 机制 | 注册表 + 懒加载引擎 + 生命周期 | 无，页面内容硬编码 |
| 数据流 | `DataFlowEngine`（SSE/订阅/缓存/定时刷新） | 仅调用 `loadSystemStats()` |
| 事件联动 | `WidgetEventBus` 跨 Widget 联动 | 无 |
| 布局 | 响应式 12 列网格，small/medium/large/full | Tailwind 固定网格 `grid-cols-2 lg:grid-cols-4` |
| 编辑能力 | 编辑模式、添加/删除/刷新/折叠 Widget | 无 |
| UI 风格 | 自定义 light/dark、recharts 图表 | shadcn/ui 组件 |
| 内容 | 18 个业务 Widget + Mock 实时数据 | 核心指标卡片、模块快捷入口、资金配置、快捷操作 |

### V6 Pro 驾驶舱 Widget 清单

| 分类 | Widget ID | 功能 |
|------|-----------|------|
| 市场 | `market-index` | 大盘指数 |
| 市场 | `market-sector-heatmap` | 板块热力图 |
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
| 策略 | `strategy-screener` | 选股筛选 |
| 策略 | `strategy-backtest` | 策略回测 |
| Agent | `agent-status` | Agent 状态 |
| Agent | `agent-tasks` | 任务队列 |
| Agent | `agent-health` | 系统健康 |
| Agent | `agent-logs` | 日志流 |

---

## 7. 页面/路由结构比对

### 7.1 V6 Pro 路由结构

V6 Pro 共 29 条扁平路由，分为四大功能模块 + 系统层 + 驾驶舱：

| 模块 | 路径 | 页面 |
|------|------|------|
| 系统层 | `/` | Dashboard |
| 系统层 | `/data` | DataManagement |
| 系统层 | `/knowledge` | LocalKnowledge |
| 系统层 | `/ai-assistant` | AIAssistant |
| I. 数据采集及接口 | `/data-hub` | DataHubPage |
| I. 数据采集及接口 | `/stock-pool` | StockPoolPage |
| I. 数据采集及接口 | `/seven-dim` | SevenDimCollectPage |
| I. 数据采集及接口 | `/collect-task` | CollectTaskPage |
| I. 数据采集及接口 | `/news` | NewsPage |
| I. 数据采集及接口 | `/fetcher` | FetcherPage |
| II. 智能 AI 体调度 | `/agent-hub` | AgentHubPage |
| II. 智能 AI 体调度 | `/agents` | AgentManagerPage |
| II. 智能 AI 体调度 | `/task-dispatch` | ModulePage（占位） |
| II. 智能 AI 体调度 | `/health-monitor` | ModulePage（占位） |
| II. 智能 AI 体调度 | `/coordinator` | ModulePage（占位） |
| III. 行业个股分析 | `/analysis-hub` | AnalysisHubPage |
| III. 行业个股分析 | `/analysis-dashboard` | AnalysisDashboardPage |
| III. 行业个股分析 | `/stock-pool` | StockPool（⚠️ 与上面冲突） |
| III. 行业个股分析 | `/sectors` | SectorAnalysis |
| III. 行业个股分析 | `/sector-rotation` | SectorRotation |
| III. 行业个股分析 | `/analysis` | StockAnalysis |
| III. 行业个股分析 | `/stock-tracker` | StockTracker |
| IV. 交易及持仓 | `/trading-hub` | TradingHubPage |
| IV. 交易及持仓 | `/strategy` | StrategyPage |
| IV. 交易及持仓 | `/strategy-executor` | StrategyExecutor |
| IV. 交易及持仓 | `/portfolio-manager` | PortfolioManager |
| IV. 交易及持仓 | `/trading` | TradingPage |
| IV. 交易及持仓 | `/portfolio` | PortfolioPage |
| 驾驶舱 | `/cockpit` | CockpitShell |

### 7.2 V9 路由结构

V9 当前约 13 条路由，集中在 `analysis` 舱：

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | HomePage | 首页 |
| `/input` | InputHubPage / InputApp | 输入舱入口/看板 |
| `/input/bulk-import` | BulkImportPanel | 批量导入 |
| `/input/hot-sectors` | HotSectorPanel | 热门板块 |
| `/input/data-test` | DataTestPanel | 采集测试 |
| `/analysis` | AnalysisHubPage | 分析舱 Hub |
| `/analysis/stock-score` | StockAnalysisPage | 个股评分 |
| `/analysis/:symbol` | StockAnalysisPage | 个股详情 |
| `/analysis/sector` | SectorAnalysisPage | 板块分析 |
| `/analysis/backtest` | BacktestPage | 回测 |
| `/analysis/industry-score` | IndustryScorePage | 行业评分 |
| `/analysis/intelligent-score` | IntelligentScorePage | 智能评分 |
| `/trading` | TradingHubPage / TradingApp | 交易舱 |
| `/output` | OutputHubPage / OutputApp | 输出舱 |
| `/command` | CommandHubPage / CommandApp | 总控舱 |
| `/cockpit` | CockpitShell | 驾驶舱 |

### 7.3 路由差异总结

| 维度 | V6 Pro | V9 |
|------|--------|-----|
| 注册位置 | `src/App.tsx` 扁平列表 | `src/config/routes.ts` 分类注册表 |
| 架构模式 | 功能模块扁平路由 | 五舱（portal + 5 cabins）架构 |
| 页面数量 | 29 条路由，20+ 真实功能页 | 约 16 条路由，子页面集中在 analysis |
| 数据层 | tRPC + 后端 API + 本地 dataLayer | dataBridge + Envelope + IndexedDB |
| 状态管理 | React Query（tRPC）+ 本地 state | Zustand + dataBridge |
| 输入舱 | DataHub / StockPool / SevenDim / CollectTask / Fetcher / News | 仅 `InputDashboard` / `BulkImportPanel` / `HotSectorPanel` / `DataTestPanel` |
| 总控舱 | AgentHub / AgentManager / 任务调度 / 健康监控 / 协调决策 | 仅 `CommandHubPage` + `CommandApp` |
| 交易舱 | TradingHub / Strategy / StrategyExecutor / PortfolioManager / Trading / Portfolio | 仅 `TradingHubPage` + `TradingApp` |
| AI / 知识库 | AIAssistant / LocalKnowledge | 无 |

---

## 8. 二次开发重点模块梳理

### 8.1 模块评估矩阵

评估维度：
- **业务价值**：对 V9 用户可见的价值。
- **架构契合度**：与 V9 五舱架构、DataBridge、路由注册表的匹配程度。
- **迁移成本**：从 V6 Pro 迁移到 V9 所需改造量。
- **数据就绪度**：V9 当前数据层是否已具备支撑能力。

### 8.2 P0 — 建议优先实施（高价值 / 中低成本 / 数据就绪）

| 优先级 | 模块名称 | V6 Pro 来源 | V9 目标位置 | 业务价值 | 迁移要点 |
|--------|----------|-------------|------------|----------|----------|
| ⭐⭐⭐ | **七维数据架构与采集配置页** | `src/services/system/architectureService.ts`<br>src/pages/SevenDimCollectPage.tsx<br>src/components/collect/CollectParamPanel.tsx | `src/apps/input/` 或新增 `/input/seven-dim` | 补齐输入舱核心能力，与现有 `fetcherConfig.ts` 联动 | 将七维架构定义抽象为 V9 配置；采集进度页改为调用 `fetcherService` |
| ⭐⭐⭐ | **股票池管理页增强** | src/pages/StockPoolPage.tsx<br>src/pages/StockPool.tsx | `src/apps/input/InputDashboard.tsx` 或新增 `/input/stock-pool` | V9 数据层已就绪（stocks/group/status），缺完整管理页 | 复用 V6 列表/筛选/分组能力，接入 V9 `stockpoolService` |
| ⭐⭐⭐ | **板块轮动评分** | src/data/rotationData.ts<br>`src/data/sectorDefinitions.ts` | `src/services/analysis/rotationScoreService.ts` + `/analysis/sector-rotation` | 替代 `hotSectorService` 静态样本，提供量化轮动 | 新增 `rotation_scores` store；迁移五因子模型；LLM 调用改为 `services/llm/llmClient` |
| ⭐⭐⭐ | **十五五板块定义与评分** | `src/data/sectorDefinitions.ts`<br>`src/data/sectorSkillData.ts` | 合并至 `src/data/sectorSkillData.ts` + `src/services/scoring/industryScoreService.ts` | 直接补强 V9 行业评分能力 | 将 V6 板块定义数据下沉到 V9 数据层；复用 V4 行业评分流程 |
| ⭐⭐ | **V6 评分报告版本库** | `src/data/types.ts`（V6Score/ScoreDocVersion）<br>`src/data/dataLayer.ts`（scoreDocs） | `src/data/dataLayer.ts` 新增 `scoreDocStore` + `src/services/analysis/scoreDocService.ts` | 支持单股多版本报告、diff、导出 Markdown | 新增 `score_docs` store；保持 V9 `IntelligentScore` / `IndustryScore` 不变 |
| ⭐⭐ | **策略快照与变更追踪** | `src/data/types.ts`（StrategySnapshot/StrategyChangeLog）<br>`src/data/dataLayer.ts`（strategy_snapshots） | `src/services/trading/strategySnapshotService.ts` | 支持 core/hot/value 分组快照与 diff | 新增 `strategy_snapshots` store；与 `strategyEngine` 输出结构对齐 |

### 8.3 P1 — 中高价值（需 UI/服务层较大改造）

| 优先级 | 模块名称 | V6 Pro 来源 | V9 目标位置 | 业务价值 | 迁移要点 |
|--------|----------|-------------|------------|----------|----------|
| ⭐⭐ | **可编辑 Widget 驾驶舱框架** | `src/mcp/core/registry.ts`<br>`src/services/scoring/v6-engine/engine.ts`<br>`src/cockpit`<br>src/cockpit/core/bus.ts<br>src/components/atoms/Grid.tsx | 重构 `src/cockpit/CockpitShell.tsx` | 将静态 Dashboard 升级为可插拔卡片系统 | 保留 V9 UI 风格，替换 V6 单例 Map 为 Zustand 或 Context；SSE 改为轮询或事件总线 |
| ⭐⭐ | **市场类 Widget** | src/cockpit/widgets/market/* | src/cockpit/widgets/market/*（待新建） | 驾驶舱核心内容 | 用 V9 组件重写；接入 `fetcherService` 或 Mock 数据 |
| ⭐⭐ | **持仓/组合 Widget** | src/cockpit/widgets/portfolio/*<br>src/components/trading/PortfolioManager.tsx | src/cockpit/widgets/portfolio/*（待新建） + `src/apps/trading/` | 交易舱核心内容 | 复用 V9 `Portfolio` 类型；重写 UI |
| ⭐⭐ | **交易记录 / 模拟交易页** | `src/pages/trading`<br>src/components/trading/SimulatedTrading.tsx | `src/apps/trading/` | 补足交易舱功能 | 将 V6 tRPC 调用替换为 `tradingService`；接入 V9 风控/仓位引擎 |
| ⭐⭐ | **AI 交易复盘** | src/components/trading/TradeReviewDashboard.tsx<br>`src/services/trading/tradeReviewAI.ts` | `src/apps/trading/` 或 `src/apps/command/` | 高价值复盘能力 | 将 tRPC 替换为本地 LLM 调用；接入 V9 `Order` 数据 |
| ⭐⭐ | **资讯与情感数据层** | `src/data/types.ts`（NewsArticle/NewsStockMap/SentimentCache）<br>src/agents/news/* | `src/services/news/` + `/input/news` 或 `/command/news` | 输入舱信息入口 | 新增 `news/news_stock_map/sentiment_cache` 三个 store；迁移财经源适配器 |
| ⭐ | **本地知识库** | `src/pages/input/LocalKnowledgePage.tsx`<br>src/data/knowledgeBase.ts<br>src/lib/rag.ts | `src/apps/command/` 或独立 `/knowledge` | RAG/文档管理 | 新增 `local_docs` store；LLM 调用改为 V9 `llmClient` |

### 8.4 P2 — 按需实施（高价值但架构差异大或依赖后端）

| 优先级 | 模块名称 | V6 Pro 来源 | V9 目标位置 | 业务价值 | 迁移要点 |
|--------|----------|-------------|------------|----------|----------|
| ⭐⭐ | **Agent 中心与管理** | src/agents/core/*<br>`src/pages/command/agent/AgentHubPage.tsx`<br>src/pages/AgentManagerPage.tsx<br>src/components/agents/AgentManagerPanel.tsx | `src/apps/command/` | 总控舱核心能力 | V6 是完整 Agent 运行时；V9 当前无后端，需评估是否作为纯前端状态机或延迟到 V10 |
| ⭐ | **AI 助手对话页** | src/pages/AIAssistant.tsx | `src/apps/command/` 或全局浮窗 | 用户交互入口 | 依赖 LLM 与 RAG，可先作为 `llmClient` + `local_docs` 的查询界面 |
| ⭐ | **数据管理页** | src/pages/DataManagement.tsx<br>src/pages/DataHubPage.tsx | `src/apps/command/` | 系统管理 | 导出/导入/清空 IndexedDB，与 V9 `systemService` 能力重合 |
| ⭐ | **shadcn/ui 组件库补齐** | src/components/ui/* | `src/components/atoms/` | 提升 UI 一致性与开发效率 | 按 V9 主题变量逐个迁移，避免一次性引入过多组件 |

---

## 9. 迁移风险与约束

### 9.1 架构约束（必须遵守）

1. **禁止引入 Node 后端**：V9 为纯前端架构，V6 的 tRPC 调用必须替换为本地 `services/` 层调用。
2. **写操作必经 DataBridge**：所有 IndexedDB 写入必须通过 `DataBridge.forward(StandardEnvelope)`，禁止 L5/L4 直接调用 `dataLayer`。
3. **路由注册规范**：新增页面必须在 `src/config/routes.ts` 注册，并同步更新 `../explanation/06-routing-specs.md`（已归档）。
4. **配置优先**：阈值、权重、解析规则必须从 `src/config/` 读取。
5. **API 兼容性**：对外暴露的服务方法签名尽量保持不变，避免影响上层调用。
6. **不新增大型依赖**：除非经过 ADR 评审。

### 9.2 数据层风险

1. **数据库版本冲突**：V6 Pro 与 V9 使用同名数据库 `V6ProDB`，但版本号不同（v7 vs v5）。若在同一域名/端口运行，会触发 IndexedDB 版本升级。迁移时应：
   - 统一 schema 到 V9 的 `dbConfig.ts`。
   - 在 `db.ts` 的 `onupgradeneeded` 中处理新增 store 的创建与旧数据兼容。
   - 必要时重命名数据库以隔离开发与生产环境。
2. **数据融合引擎依赖**：V6 的 `dataFusion.ts` 依赖 AKShare、技术指标、情感、板块强度等多源数据，V9 当前仅接入 AKShare 部分字段，需补齐数据源或提供 Mock 回退。
3. **tRPC 类型丢失**：V6 大量页面使用 `trpc.*.useQuery`，迁移时需重新设计数据获取逻辑（本地服务 + Zustand / React Query）。

### 9.3 UI/UX 风险

1. **组件库版本差异**：V6 使用 shadcn/ui v4（`data-slot` 标记），V9 使用自研轻量组件，迁移业务组件时需注意 prop 和 className 适配。
2. **主题色差**：V6 默认 light，V9 全局 dark，迁移时需统一为 V9 深色主题与 CSS 变量。
3. **图表依赖**：V6 使用 `lightweight-charts` 和 `recharts`，V9 当前无图表组件，引入时需评估包体积。

### 9.4 测试与文档风险

1. **测试覆盖**：V9 当前要求 `npm test` 全部通过，新增模块需同步补充单元测试。
2. **文档同步**：每新增一个模块，需更新 `../specs/02-functional-specs.md`、`../explanation/05-engine-specs.md`、`../explanation/06-routing-specs.md`（已归档）、`../guides/08-implementation-plan.md`。
3. **审计基线**：新增代码可能增加 `audit:hardcode` 的静默回退/魔法数字计数，需保持 Fatal 为 0，并尽量控制 Critical/Major 增长。

---

## 10. 建议实施路线

### Phase 1：数据层补齐（1~2 周）

目标：让 V9 具备承载 V6 核心能力的数据底座。

1. **统一 IndexedDB Schema**：
   - 评估是否需要将 `V6ProDB` 升级到 v7，或在 v5 基础上新增 store。
   - 新增/合并 store：`rotation_scores`、`sector_scores`、`score_docs`、`strategy_snapshots`、`news`、`news_stock_map`、`sentiment_cache`、`local_docs`。
2. **迁移数据融合能力**：
   - 将 `storage/architecture.ts` 的七维架构抽象为 V9 配置。
   - 将 `dataFusion.ts` 的核心逻辑适配为 V9 src/services/analysis/unifiedStockService.ts（待新建）。
3. **迁移板块与轮动能力**：
   - 将 `rotationData.ts` + `sectorData.ts` 的数据定义迁移到 V9 `src/data/`。
   - 新增 `services/analysis/rotationScoreService.ts`。

### Phase 2：输入舱页面补齐（1~2 周）

目标：让输入舱从“录入看板”升级为“数据工场”。

1. 新增 `/input/stock-pool` 股票池管理页（复用 V6 列表/筛选/分组）。
2. 新增 `/input/seven-dim` 七维采集配置页。
3. 增强 `/input/hot-sectors` 为真正的板块轮动入口。
4. 新增 `/input/news` 智能资讯入口（P1 可选）。

### Phase 3：交易舱与驾驶舱升级（2~3 周）

目标：补齐交易能力，升级驾驶舱为 Widget 框架。

1. 迁移/重写 `PortfolioManager`、`SimulatedTrading`、`TradeReviewDashboard` 到 `src/apps/trading/`。
2. 新增 `/trading/portfolio`、`/trading/records`、`/trading/review` 子路由。
3. 重构 `CockpitShell` 为 Widget 运行时框架（注册表 + 引擎 + 数据流 + 网格）。
4. 逐步接入市场/持仓/策略/Agent Widget。

### Phase 4：总控舱与 Agent / AI 助手（3~4 周，按需）

目标：补齐 Agent 调度、AI 助手、知识库能力。

1. 评估 Agent 运行时是纯前端状态机还是延迟到 V10 后端支撑。
2. 实现 `AgentHubPage` / `AgentManagerPage` 前端壳子（展示状态/任务/日志）。
3. 实现 `LocalKnowledge` 本地知识库页面。
4. 实现 `AIAssistant` 对话页。

### Phase 5：UI 组件库补齐（贯穿全程）

1. 按业务需求逐步从 V6 的 shadcn/ui 组件中迁移缺少的组件到 V9 `src/components/atoms/`。
2. 优先补齐：`chart`、`calendar`、`slider`、`radio-group`、`dropdown-menu`、`scroll-area`、`command`、`accordion`。

---

## 11. 结论

V6 Pro 是 V9 二次开发的宝贵资产库，尤其在**数据融合、板块轮动、驾驶舱 Widget 框架、交易/组合管理、资讯情感、本地知识库**等方面远超 V9 当前实现。

V9 的优势在于**架构规范清晰、纯前端离线可用、路由注册规范、DataBridge 解耦**。二次开发应遵循“**数据层优先补齐 → 输入舱页面落地 → 交易舱与驾驶舱升级 → 总控舱/Agent/AI 助手按需实现**”的路线。

迁移过程中必须坚守 V9 架构铁律：**不写死数据、不直接操作 IndexedDB、不引入未评审依赖、不同步更新文档与测试**。


---

## 12. 实施更新记录

### 2026-06-24：Phase 2 第二步 V6 Pro → V9 JSON 数据迁移落地

- 已完成迁移规范中间文档：`./v6-to-v9-migration-spec.md`，作为 `v6MigrationService` 的唯一权威转换依据。
- 已完成迁移服务：`src/services/system/v6MigrationService.ts`，支持解析 V6 全量导出、转换 12 个核心 store、按依赖顺序导入 V9，默认跳过已存在记录并支持覆盖。
- 已完成迁移 UI：`src/components/organisms/system/MigrationPanel.tsx`，支持文件上传、转换预览、导入执行、报告展示。
- 已在总控舱集成入口：`src/apps/command/CommandApp.tsx` 新增"V6 迁移"按钮。
- 已补充单元测试：`tests/v6MigrationService.test.ts`（19 tests）、`tests/MigrationPanel.test.tsx`（4 tests）。
- 全量质量门禁通过：tsc / lint / test（291 passed）/ build / e2e（5 passed）。
