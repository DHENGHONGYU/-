---
title: v6pro-ui-page-diff-report
type: explanation
domain: frontend
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "v6pro-ui-page-diff-report detailed explanation"
tags: [frontend, report, plan, architecture, component, explanation]
version: v0.9.0
last_updated: 2026-06-24
code_version: 2.0.0
doc_id: V9-DOC-FRONT-015
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176]
change_log: 
---

# V6 Pro 备份源码/线上站点 与 V9 当前项目 UI & Page 差异全量对比报告

> **Status**: Current / Analysis  
> **Date**: 2026-06-24  
> **Sources**:
> - V9 当前项目: `c:\Users\huawei\Documents\kimi\Workspaces\智能投研复盘系统V9`
> - V6 Pro 备份源码: `D:\有价值对话\v6pro_source_backup.tar\v6pro_source_backup\app`
> - 线上部署站点: `https://hslqownhhwaig.ok.kimi.link/`
>
> **说明**: 本报告为只读分析结果，未修改任何源码。所有结论基于源码结构、组件 props、页面入口、路由表及线上站点实际快照。

---

## 1. 对比范围与方法

| 维度 | V9 当前项目 | V6 Pro 备份/线上 |
|---|---|---|
| 前端框架 | React 19 + TypeScript + Vite | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS | Tailwind CSS + shadcn/ui 设计体系 |
| 路由 | `react-router` v7 `HashRouter`，集中式 `ROUTE_REGISTRY` | `react-router` v7 `HashRouter`，`App.tsx` 内联路由表 |
| 状态 | Zustand (`workflowStore`) | 混合：tRPC + TanStack Query + IndexedDB(Dexie) + 内存单例 |
| UI 原子 | 自定义 8 个基础组件 | shadcn/ui 60+ 组件（基于 Radix + CVA） |
| 布局 | 五舱 `PortalShell` + `/cockpit` 独立驾驶舱 | `MainLayout` 左侧折叠边栏 + 顶部面包屑 + `/cockpit` Widget 驾驶舱 |

**方法**: 通过源码目录扫描、组件 props 读取、路由表提取，结合线上站点逐个模块快照，建立功能名称 → 有无 → 差异 → 联动影响四维对照。

---

## 2. 整体架构差异

### 2.1 导航结构差异

```
V9 当前项目（五舱 PortalShell）
├─ 顶部：Logo + 五舱切换（输入/分析/交易/输出/总控）+ 驾驶舱 + 采集状态
├─ 侧边栏：当前舱室子菜单
└─ 主内容区：懒加载 Cabin App

V6 Pro（MainLayout）
├─ 左侧边栏：系统（仪表盘/驾驶舱/数据管理/知识库/AI助手）+ 四大功能模块折叠菜单
├─ 顶部：面包屑 + AI Agent 状态
└─ 主内容区：max-w-7xl 内容卡片
```

**关键差异**：
- V6 Pro 的「模块首页（Hub）+ 子功能页」模式非常成熟，每个模块都有总览页、数据看板、状态监控、导出等 Tab。
- V9 当前以「舱」为单位组织，子功能分散在 `/input/*`、`/analysis/*` 等路径，缺少模块级 Hub 首页。

### 2.2 数据流差异

| 项目 | 数据存储 | 组件取数方式 |
|---|---|---|
| V9 | IndexedDB (`V6Database`) | `Service → dataLayer → db` |
| V6 Pro | IndexedDB + tRPC backend | `tRPC hooks / dataLayer / localStorage 广播` |

**影响**：V6 Pro 部分页面（Portfolio/Trading）依赖后端 tRPC，直接迁移到 V9 纯前端架构需将数据层改造为 IndexedDB 或本地 mock。

---

## 3. UI 组件库差异

### 3.1 基础 UI 组件对照表

| 组件 | V9 当前 | V6 Pro 备份 | 差异说明 | 建议 |
|---|---|---|---|---|
| Button | ? 自定义 4 variant | ? shadcn 6 variant + size/icon | V6 更丰富 | 可吸收 icon/ghost/link 变体 |
| Card | ? 基础 Card | ? Header/Title/Description/Action/Content/Footer | V6 拆分更细 | 建议拆分，便于统一布局 |
| Input | ? 标准 | ? 标准 | 基本一致 | 无需改动 |
| Textarea | ? 标准 | ? 标准 | 一致 | 无需改动 |
| Badge | ? 4 variant | ? 4 variant + `asChild` | V6 更灵活 | 可补充 `asChild` |
| Checkbox | ? 带 label | ? 标准 | V9 更贴合表单 | 保持现状 |
| Progress | ? 5 分制进度 | ? 标准进度条 | V9 面向评分维度 | 保持现状，补充标准进度条 |
| Dialog / Sheet / Modal | ? 无独立封装 | ? dialog/alert-dialog/sheet/drawer/popover | V9 缺失弹层 | **高优先级补充** |
| Select / Combobox | ? 无 | ? select/command | V9 用原生 select | **建议引入** |
| Tabs | ? 无 | ? tabs | V9 无 Tabs 组件 | **建议引入** |
| Table | ? 无业务 Table 封装 | ? table 全套 | V9 用原生 table | 可引入 |
| Switch | ? 无 | ? switch | 采集配置需要 | **建议引入** |
| Slider | ? 无 | ? slider | 权重配置需要 | 建议引入 |
| Toast / Sonner | ? 无 | ? toast/sonner | 操作反馈 | 建议引入 |
| Tooltip / HoverCard | ? 无 | ? tooltip/hover-card | 信息提示 | 建议引入 |
| Chart | ? 无 | ? chart（Recharts 封装） | 可视化 | 建议引入 |
| Calendar / DatePicker | ? 无 | ? calendar | 日期筛选 | 建议引入 |
| Breadcrumb | ? 无 | ? breadcrumb | 页面导航 | 建议引入 |
| Pagination | ? 无 | ? pagination | 长列表 | 建议引入 |
| Accordion / Collapsible | ? 无 | ? | 折叠面板 | 建议引入 |
| Dropdown / Context Menu | ? 无 | ? | 右键/下拉菜单 | 建议引入 |
| Skeleton / Spinner | ? PageSkeleton | ? skeleton/spinner | V9 仅页面级 | 建议补充组件级骨架 |
| ScrollArea | ? 无 | ? scroll-area | 自定义滚动 | 建议引入 |
| Resizable | ? 无 | ? resizable | 可调整面板 | 低优先级 |
| Sidebar | ? 无 | ? sidebar | V9 自定义 PortalShell | 可吸收模式 |

### 3.2 组件库差异结论

- **V9 当前组件库非常精简**，只有 8 个基础组件，缺少现代中后台系统所需的 Dialog、Tabs、Select、Table、Switch、Toast、Chart 等。
- **V6 Pro 拥有完整 shadcn/ui 体系**（约 60+ 组件），可直接作为 V9 UI 升级基座。
- **如果全部迁移 V6 组件库**，影响面：
  - `src/components/ui/` 目录重构
  - 所有使用原生 `<dialog>`、`<select>`、`<table>` 的页面需替换
  - 需要引入 Radix UI 依赖（V6 已使用）
  - 需要统一 `cn` / `cva` 变体写法

---

## 4. 页面/模块功能逐项对比

### 4.1 系统级页面

| 功能名称 | V6 Pro 备份/线上 | V9 当前 | 差异说明 | 可否增加 | 增加影响面 |
|---|---|---|---|---|---|
| 仪表盘 Dashboard | ? 市场热度、股票池概览、资金配置饼图、交易统计、板块资金流向 | ? HomePage + CockpitShell 统计卡 | V6 更完整，含饼图/板块资金；V9 较精简 | ? 建议增强 | 需引入 Chart 组件；`CockpitShell` 数据模型扩展 |
| 驾驶舱 Cockpit | ? Widget 网格系统（market/portfolio/strategy/agent 4 类 20+ widget） | ? 独立统计卡 + 快捷入口 | V6 是可配置 Widget 驾驶舱；V9 是固定 Dashboard | ? 建议吸收 Widget 机制 | 需新增 `src/cockpit/widgets/*`、`WidgetRegistry`、`DataFlowEngine` |
| 数据管理 | ? IndexedDB 导出/导入/清理/重置页面 | ? `CommandApp` 重置 + `OutputApp` 导出 | V6 独立页面功能更全 | ? 建议增加独立页面 | 需新增页面 + dataLayer 管理方法 |
| 本地知识库 | ? 文件夹扫描、文档浏览、RAG 预览 | ? 无 | V9 完全缺失 | ? 可增加 | 依赖 `@/lib/localFileSystem`、`@/lib/rag` |
| AI 助手 | ? 聊天页 + 快捷指令（选股/板块轮动/策略复盘/外部证据/估值分析） | ? 无 | V9 完全缺失 | ? 可增加 | 需新增 `analysis.createSession` 服务或 LLM 对话服务 |

### 4.2 模块一：数据采集及接口

| 功能名称 | V6 Pro 备份/线上 | V9 当前 | 差异说明 | 可否增加 | 增加影响面 |
|---|---|---|---|---|---|
| 数据工场/模块 Hub 首页 | ? 6 大子模块卡片 + 4 Tab（模块总览/数据看板/七维状态/数据导出） | ? 无 | V9 输入舱无模块级总览 | ? 建议增加 | 需新增 `/input/hub` 页面；与现有 `/input` 子页面联动 |
| 股票池管理 | ? 分组/导入/导出/添加/策略模板/搜索/排序/七维热力/操作列 | ? `InputDashboard` + `PoolBoard` 看板/列表 | V6 是表格+策略模板+分组筛选；V9 是看板流 | ? 可吸收表格视图+策略模板 | 需改造 `PoolBoard`/`PoolList`；`usePoolData` 增加分组/模板字段 |
| 七维采集配置 | ? 7 维度开关 + 5 方向策略模板 + 字段明细 + 查看采集任务 | ? 无 | V9 只有 `DataTestPanel` 接口测试 | ? 建议增加 | 需新增 `CollectParamPanel`；`src/config/collectConfig.ts` 数据模型 |
| 采集任务监控 | ? 任务列表/评分卡片/采集日志 3 Tab + 状态卡 + 进度条 + 全部重采/批量采集 | ? 无（仅 DataTestPanel 单接口测试） | V9 缺失任务级监控 | ? 建议增加 | 需新增 `CollectMonitor`；与 `fetcherService` 对接 |
| 智能资讯 | ? 新闻索引 + 研报中心 + 筛选面板 + 资讯卡片 + 情感分析 | ? 无 | V9 完全缺失 | ? 可增加 | 需新增 `news/*` 组件；需要资讯数据源 |
| 抓取引擎 | ?? 占位/简化实现（`FetcherPage` / `ModulePage`） | ? `DataTestPanel` 健康检查 + 单接口/批量测试 | V9 实际测试能力更强 | 保持现状 | — |
| 本地存储/数据导出 | ? 7 维 JSON + meta.json / 数据看板 / 导出 | ? `OutputApp` 导出全部 JSON | V6 维度更细；V9 统一导出 | 可细化 | `systemService.exportAll` 增加维度选择 |

### 4.3 模块二：智能 AI 体调度

| 功能名称 | V6 Pro 备份/线上 | V9 当前 | 差异说明 | 可否增加 | 增加影响面 |
|---|---|---|---|---|---|
| AI 体中心 Hub | ? 4 个核心模块卡片 + 调度架构图 | ? 无 | V9 完全缺失 | ? 建议增加 | 需新增 `/command/agent-hub` 或独立模块 |
| Agent 管理 | ? Agent 注册/生命周期/健康/协调/任务调度面板 | ? 无 | V9 完全缺失 | ? 建议增加 | 需新增 `agents/*` 模块；`AgentRegistry` 单例 |
| 任务调度 | ?? 占位页 | ? 无 | 均未实现 | 暂缓 | — |
| 健康监控 | ?? 占位页 | ? 无 | 均未实现 | 暂缓 | — |
| 协调决策 | ?? 占位页 | ? 无 | 均未实现 | 暂缓 | — |

### 4.4 模块三：行业个股分析

| 功能名称 | V6 Pro 备份/线上 | V9 当前 | 差异说明 | 可否增加 | 增加影响面 |
|---|---|---|---|---|---|
| 分析中心 Hub | ? 5 个分析模块快捷入口 + 详情卡片 | ? 无 | V9 分析舱缺少 Hub | ? 建议增加 | 需新增 `/analysis/hub` |
| 分析仪表板 | ?? 线上崩溃/空白（JS 错误 56 个） | ? 无 | V6 源码有实现但线上无法运行 | 暂缓 | 需先解决运行时错误 |
| 股票池（分析侧） | ? 实时行情/V6 评分/历史版本/比对/持仓订单面板/行业分类 | ? `AnalysisApp` 批量评分 + `StockAnalysisPage` | V6 分析侧股票池功能更丰富 | ? 建议增强 | 需扩展 `StockAnalysisPage`；`v6ScoreService` 增加历史版本 |
| 个股分析 | ? L0-L8 深度分析/综合仪表盘/AI 分析报告/评分趋势/分析笔记 | ? `StockAnalysisPage` V6 九维评分 | V6 层级更深（L0-L8） | ? 建议吸收 | 需新增 `analysis/depth/*` 组件；`scoringSystem` 数据模型 |
| 板块分析 | ? 4 大 SKILL 模型 + 15 大赛道评分排行 + 申万 3 级映射 | ? `IndustryScorePage` V4 行业评分 | V6 板块分析更体系化 | ? 建议增强 | 需扩展 `IndustryScorePage` 或新增 `SectorAnalysisPage` |
| 板块轮动 | ? SKILL v3.1 五大因子 16 子指标/信号分级/预警/三条禁令/CSV 导出 | ? 无 | V9 完全缺失 | ? 建议增加 | 需新增 `SectorRotationPage`；`rotationData` 数据层 |
| 跟盘分析 | ? K 线+筹码+信号+分批策略/日线周线月线/关联指数 | ? 无 | V9 完全缺失 | ? 建议增加 | 需新增 `StockTrackerPage`；依赖 K 线/筹码数据 |

### 4.5 模块四：交易及持仓

| 功能名称 | V6 Pro 备份/线上 | V9 当前 | 差异说明 | 可否增加 | 增加影响面 |
|---|---|---|---|---|---|
| 交易中心 Hub | ? 资产概览 + 交易流程 + 5 模块卡片 | ? 无 | V9 缺少交易模块 Hub | ? 建议增加 | 需新增 `/trading/hub` |
| 策略管理 | ? 三类策略自动分类/股票池?V6?板块轮动三源联动/60s 刷新/版本快照/变更比对 | ? 无 | V9 完全缺失 | ? 高优先级 | 需新增 `StrategyPage`；与 `stocks/v6Scores/rotationScores` 联动 |
| 策略执行 | ? 标的筛选/分步建仓/动态止盈/T 降成本 | ? 无 | V9 完全缺失 | ? 可增加 | 需新增 `StrategyExecutorPage` |
| 持仓中心 | ? 持仓列表/交易记录/添加股票/AI 交易复盘 | ? `TradingApp` 持仓/订单 | V6 更完整，含 AI 复盘 | ? 建议增强 | 扩展 `TradingApp` 或拆分 `PortfolioManager` |
| 资金配置 | ? 目标 vs 实际配置/饼图/条形图/持仓明细 | ?? `CockpitShell` 静态进度条 | V6 可视化+实时对比 | ? 建议增强 | 需引入 Chart；扩展 `cockpit` 数据 |
| 交易记录 | ? 交易流水 CRUD/统计卡片/关联股票策略 | ? `TradingApp` 订单列表 | V6 是独立页面功能更全 | ? 建议拆分独立页面 | 新增 `/trading/records`；复用 `tradingService` |

### 4.6 当前 V9 独有而 V6 Pro 未体现

| 功能名称 | V9 当前 | V6 Pro 备份/线上 | 说明 |
|---|---|---|---|
| 五舱工作流 PortalShell | ? 顶部五舱切换 + 侧边栏子菜单 | ? 无（使用 MainLayout） | V9 架构更清晰，建议保留 |
| 输入舱原型 `/input/prototype` | ? 4 个原型页面 | ? 无 | V9 用于交互验证，可保留 |
| V4 行业评分独立页 | ? `IndustryScorePage` | ?? 板块分析页替代 | V9 保留 V4 评分能力，建议保留 |
| V6 个股智能评分独立页 | ? `IntelligentScorePage` | ?? 个股分析内嵌 | V9 保留独立评分入口，建议保留 |
| 批量导入独立页 | ? `BulkImportPanel` | ?? 弹窗/页内 | V9 已页面化，建议保留 |
| 热门板块独立页 | ? `HotSectorPanel` | ?? 输入舱内嵌 | V9 已页面化，建议保留 |
| 系统监控/重置 | ? `CommandApp` | ?? 分散在各页 | V9 集中总控，建议保留 |

---

## 5. 可吸收设计模式与影响评估

### 5.1 建议直接吸收（低耦合高价值）

| 设计模式 | 来源 | 落地位置 | 影响面 | 优先级 |
|---|---|---|---|---|
| shadcn/ui 组件库（Dialog/Tabs/Select/Table/Switch/Toast/Chart） | `src/components/ui/` | `src/components/ui/` 重构 | 全项目 UI 替换 | P0 |
| 模块 Hub 首页模式 | `DataHubPage/AnalysisHubPage/TradingHubPage/AgentHubPage` | 各舱入口增加 Hub | 路由表 + PortalShell 子菜单 | P1 |
| 七维采集参数面板 | `CollectParamPanel` + `SevenDimCollectPage` | `/input/seven-dim` | `src/config/collectConfig.ts`、fetcherService | P1 |
| 采集任务监控面板 | `CollectMonitor` + `CollectTaskPage` | `/input/collect-task` | fetcherService、新增任务数据模型 | P1 |
| 股票池表格+策略模板视图 | `StockPoolPage` | `InputDashboard` / `PoolList` | `usePoolData`、PoolBoard | P1 |
| 板块轮动页 | `SectorRotation` | `/analysis/sector-rotation` | `rotationData`、股票池数据 | P1 |
| AI 交易复盘 | `TradeReviewDashboard` | `TradingApp` 或独立页 | `tradeReviewAI`、orders | P2 |
| 资金配置可视化 | `Portfolio` 饼图/条形图 | `CockpitShell` | Chart 组件、portfolio 数据 | P2 |

### 5.2 建议选择性吸收（中耦合）

| 设计模式 | 来源 | 落地位置 | 影响面 | 优先级 |
|---|---|---|---|---|
| Widget 驾驶舱 | `src/cockpit/widgets/*` + `CockpitShell` | 重写 `CockpitShell` | cockpit 目录重构、新增 registry/engine/dataflow/bus | P2 |
| 智能资讯 | `src/components/news/*` + `NewsPage` | `/input/news` 或独立模块 | 需要资讯数据源/adapter | P2 |
| Agent 管理中心 | `AgentManagerPanel` + `AgentManagerPage` | `/command/agents` | 新增 `agents/*` 模块 | P2 |
| 本地知识库 | `LocalKnowledge` | `/knowledge` | `localFileSystem`、`rag` | P2 |
| AI 助手聊天 | `AIAssistant` | `/ai-assistant` | LLM session 服务 | P2 |

### 5.3 不建议直接照搬（与 V9 架构冲突）

| V6 Pro 模式 | 不建议原因 | V9 替代方案 |
|---|---|---|
| tRPC 后端依赖 | V9 是纯前端 + IndexedDB 架构 | 保留纯前端，用本地服务/mock 替代 |
| MainLayout 左侧边栏 | V9 五舱 PortalShell 更符合当前工作流 | 保留 PortalShell，可吸收 Hub 首页 |
| 三舱硬隔离 | V9 已演进为五舱 | 保持五舱 |
| 部分占位页面 | 线上崩溃或空白 | 待 V6 源码修复后再评估 |

---

## 6. 联动界面修改清单

如果按优先级逐步吸收 V6 Pro 设计，以下界面/文件需要联动修改：

### 6.1 若引入 shadcn/ui 组件库

- `src/components/ui/`：全部重写或新增 60+ 组件
- `package.json`：新增 `@radix-ui/*`、`class-variance-authority`、`clsx`/`tailwind-merge`（已有部分）
- `tailwind.config.js`：补充 shadcn CSS 变量（如 `--background`、`--foreground`、`--card` 等）
- `src/index.css`：增加 shadcn 基础样式
- 影响页面：所有使用原生 `<dialog>`、`<select>`、`<table>` 的页面（`InputDashboard`、`BulkImportPanel`、`PoolList`、`IndustryScorePage`、`IntelligentScorePage`、`TradingApp`、`CommandApp`）

### 6.2 若增加模块 Hub 首页

- `src/config/routes.ts`：新增 `/input/hub`、`/analysis/hub`、`/trading/hub`、`/command/hub`
- `src/portal/PortalShell.tsx`：调整默认入口行为，支持 Hub 作为舱室首页
- `src/pages/`：新增各 Hub 页面
- `../../reference/06-routing-specs.md`：更新路由规格

### 6.3 若增加七维采集 + 采集任务

- `src/apps/input/`：新增 `SevenDimPanel.tsx`、`CollectTaskPanel.tsx`
- `src/services/input/`：新增 `collectConfigService`、`collectTaskService`
- `src/data/`：新增 `collectConfig.ts`、扩展 `db.ts` schema
- `src/apps/input/InputApp.tsx`：增加路由分发
- 联动：`DataTestPanel` 可降级为采集任务中的「接口测试」子 Tab

### 6.4 若增强股票池管理

- `src/components/organisms/pool/PoolList.tsx`：增加表格列（分组、七维热力、操作列）
- `src/components/organisms/pool/usePoolDataFromStore.ts`：增加分组过滤、策略模板、排序
- `src/apps/input/InputDashboard.tsx`：增加策略模板按钮、导入/导出/添加按钮
- 联动：`StockAnalysisPage` 接收 `/analysis?symbol=` 跳转参数（V6 模式）

### 6.5 若增加板块轮动

- `src/components/organisms/analysis/sector/SectorRotationHeatmap.tsx`：新增页面
- `src/services/analysis/`：新增 `rotationService`
- `src/data/`：新增 `rotationData.ts`、扩展 `dataLayer.ts`
- 联动：`StrategyPage` 消费 `rotationScores`

### 6.6 若增强交易持仓

- `src/apps/trading/TradingApp.tsx`：拆分或扩展为 Hub + 持仓 + 交易记录
- `src/services/trading/`：新增 `portfolioService`、`tradeReviewService`
- `../../../src/services/trading/`：新增 `RiskBanner`、`FinalConfirm`、`TradeReviewDashboard`
- 联动：`CockpitShell` 展示实时持仓摘要

---

## 7. 实施建议与优先级

### 7.1 短期（1-2 周）：UI 基座统一

1. **引入 shadcn/ui 组件库**：优先补齐 Dialog、Tabs、Select、Table、Switch、Toast、Chart、Breadcrumb。
2. **重构 `src/components/ui/`**：建立与 V6 Pro 一致的组件命名和 props 规范。
3. **更新主题变量**：让 Tailwind 支持 shadcn CSS 变量体系。

### 7.2 中期（2-4 周）：输入舱增强

1. **新增 `/input/hub` 模块首页**：聚合股票池、批量导入、热门板块、七维采集、采集任务入口。
2. **新增七维采集配置页**：迁移 `CollectParamPanel` 和 `SevenDimCollectPage`。
3. **新增采集任务监控页**：迁移 `CollectMonitor` 和 `CollectTaskPage`。
4. **增强股票池表格视图**：增加分组、策略模板、七维热力、操作列。

### 7.3 中期（3-5 周）：分析舱增强

1. **新增 `/analysis/hub` 首页**。
2. **新增板块轮动页** `SectorRotationPage`。
3. **增强个股分析页**：增加 L0-L8 层级展示、AI 分析报告、评分历史版本比对。
4. **增强行业评分页**：引入 15 大赛道评分排行。

### 7.4 长期（5-8 周）：交易舱与驾驶舱

1. **新增 `/trading/hub` 首页**。
2. **拆分持仓中心/交易记录独立页**。
3. **增加 AI 交易复盘**。
4. **重构驾驶舱为 Widget 体系**：可选，工作量大但可配置性高。

### 7.5 可选（根据资源）

1. 智能资讯模块
2. Agent 管理中心
3. 本地知识库
4. AI 助手聊天

---

## 8. 结论

- **V6 Pro 备份/线上站点在 UI 组件丰富度、模块完整度、页面布局成熟度上明显领先于 V9 当前项目**。
- **V9 当前的优势在于五舱工作流清晰、纯前端架构统一、数据层规范（DataBridge + ACL）**。
- **建议采用「UI 基座先行 → 输入舱补全 → 分析舱增强 → 交易舱完善 → 可选模块」的渐进式吸收策略**。
- **不建议直接整体替换 V6 Pro 源码**，因为 V6 存在 tRPC 后端依赖、部分页面占位/崩溃、路由重复等问题，需按 V9 架构进行适配改造。

---

## 附录 A：线上站点访问记录

| 访问路径 | 页面状态 | 主要观察到功能 |
|---|---|---|
| `/` | ? 正常 | 仪表盘、股票池概览、资金配置、交易统计、板块资金流向 |
| `/#/data-hub` | ? 正常 | 模块总览 Tab、6 大子模块卡片、数据流水线 |
| `/#/stock-pool` | ? 正常 | 导入/导出/添加、策略模板、分组筛选、搜索排序、表格、七维热力、操作列 |
| `/#/seven-dim` | ? 正常 | 5 方向策略模板、7 维度开关、字段明细 |
| `/#/collect-task` | ? 正常 | 状态卡、任务列表/评分卡片/采集日志 Tab、进度条 |
| `/#/news` | ? 正常 | 资讯列表、筛选面板 |
| `/#/agent-hub` | ? 正常 | 4 模块卡片 + 架构图 |
| `/#/agents` | ? 正常 | Agent 管理面板 |
| `/#/analysis-hub` | ? 正常 | 5 分析模块入口 |
| `/#/analysis-dashboard` | ? 空白/崩溃 | JS 错误 56 个，页面未渲染 |
| `/#/analysis?symbol=600519` | ? 正常 | 个股分析详情 |
| `/#/sectors` | ? 正常 | 板块分析 |
| `/#/sector-rotation` | ? 正常 | 板块轮动 |
| `/#/trading-hub` | ? 正常 | 交易中心总览 |
| `/#/strategy` | ? 正常 | 策略管理 |
| `/#/portfolio-manager` | ? 正常 | 持仓管理 |
| `/#/trading` | ? 正常 | 交易记录 |
| `/#/portfolio` | ? 正常 | 资金配置 |
| `/#/cockpit` | ? 正常 | Widget 驾驶舱 |
| `/#/ai-assistant` | ? 正常 | AI 助手聊天 |
| `/#/knowledge` | ? 正常 | 本地知识库 |

---

## 附录 B：关键文件索引

### V9 当前项目关键文件

- `src/components/ui/*`
- `src/apps/input/InputApp.tsx`
- `src/apps/input/InputDashboard.tsx`
- `src/apps/input/BulkImportPanel.tsx`
- `src/apps/input/HotSectorPanel.tsx`
- `src/apps/input/DataTestPanel.tsx`
- `src/apps/analysis/AnalysisApp.tsx`
- `src/apps/trading/TradingApp.tsx`
- `src/apps/output/OutputApp.tsx`
- `src/apps/command/CommandApp.tsx`
- `src/portal/PortalShell.tsx`
- `src/cockpit/CockpitShell.tsx`
- `src/config/routes.ts`

### V6 Pro 备份关键文件

- `src/components/ui/*`
- `src/components/collect/*`
- `src/components/news/*`
- `src/components/agents/*`
- `src/components/analysis/*`
- `src/components/trading/*`
- `src/cockpit/widgets/*`
- `src/cockpit/CockpitShell.tsx`
- `src/cockpit/core/*`
- `src/pages/*`
- `src/App.tsx`
