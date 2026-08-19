---
title: 06. 路由规格
type: explanation
domain: frontend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 路由规范：路由定义、命名与导航规则（事实源 src/config/routes.ts）。"
tags: [frontend, routing, spec, plan, component, ui, strategy, architecture, explanation]
version: v3.4.0
last_updated: 2026-08-13
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-FRONT-004
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-DATA-034, V9-DOC-PROJ-176, V9-DOC-PROJ-218, V9-DOC-PROJ-149]
change_log:
  - version: v3.4.0
    changes: "路由表同步：新增14+未文档化路由，移除3个幽灵路由，修复日期不一致"
    date: 2026-08-13
  - version: v3.1.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-07-17
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# 06. 路由规格

> **Status**: Current  
> **Version**: v3.4.0  
> **Last Updated**: 2026-08-13
>
> 本文档定义 V9 的路由注册表、舱室映射、懒加载策略与导航规范。  
> 目标读者：前端开发者、UI/UX 设计师、测试工程师。

---

## 1. 路由设计原则

1. **HashRouter 优先**：纯前端 PWA 部署到 GitHub Pages 等静态托管时，HashRouter 可避免刷新 404。
2. **配置驱动**：所有业务路由集中注册在 `src/config/routes.ts`，禁止页面组件内硬编码路径。
3. **懒加载**：页面级组件使用 `React.lazy()`，减少首屏 bundle。
4. **舱室一致性**：URL 路径前缀与五舱概念对齐，便于用户通过地址栏识别当前工作舱。
5. **不切屏原则**：同一舱室内的功能通过 Tab/面板切换，跨舱室切换通过 PortalShell 导航完成。

---

## 2. 路由注册表

### 2.1 当前注册路由

定义于 `src/config/routes.ts`：

| # | 路径 | 组件 | 分类 | 说明 |
|:-:|------|------|------|------|
| 1 | `/` | `HomePage` | portal | 首页 |
| 2 | `/cockpit` | `CockpitShell` | portal | 驾驶舱 Dashboard |
| 3 | `/input/hub` | `PortalShell` | input | 输入舱 - 模块首页 |
| 4 | `/input` | `PortalShell` | input | 输入舱 |
| 5 | `/input/bulk-import` | `PortalShell` | input | 输入舱 - 批量导入（已整合至录入看板，fallback 到 /input） |
| 6 | `/input/hot-sectors` | `PortalShell` | input | 输入舱 - 热门板块（已整合至录入看板，fallback 到 /input） |
| 7 | `/input/data-test` | `PortalShell` | input | 输入舱 - 采集测试（已合并至采集监控台） |
| 8 | `/input/collection-monitor` | `PortalShell` | input | 输入舱 - 采集监控台（链路测试 + 任务监控） |
| 9 | `/input/collection-strategy` | `PortalShell` | input | 输入舱 - 采集策略配置（七维策略 + 抓取引擎） |
| 10 | `/input/local-knowledge` | `PortalShell` | input | 输入舱 - 本地知识库 |
| 11 | `/input/seven-dim` | `PortalShell` | input | 输入舱 - 七维采集策略配置（已合并至采集策略配置） |
| 12 | `/input/fetcher-config` | `PortalShell` | input | 输入舱 - 抓取引擎配置（已合并至采集策略配置） |
| 13 | `/input/collect-tasks` | `PortalShell` | input | 输入舱 - 采集任务监控（已合并至采集监控台） |
| 14 | `/input/pool-board` | `PortalShell` | input | 输入舱 - 研究候选池总览（基本信息 + 采集进度） |
| 15 | `/analysis/hub` | `PortalShell` | analysis | 分析舱 - 模块首页 |
| 16 | `/analysis` | `PortalShell` | analysis | 分析舱 |
| 17 | `/analysis/industry-dashboard` | `PortalShell` | analysis | 分析舱 - 行业全景仪表盘 |
| 18 | `/analysis/sector` | `PortalShell` | analysis | 行业与板块分析 |
| 19 | `/analysis/backtest` | `PortalShell` | analysis | 策略回测 |
| 20 | `/analysis/industry-score` | `PortalShell` | analysis | V4 行业评分 |
| 21 | `/analysis/stock-score` | `PortalShell` | analysis | V6 个股评分 |
| 22 | `/analysis/intelligent-score` | `PortalShell` | analysis | 个股智能分析 |
| 23 | `/analysis/intelligent-score/:symbol` | `PortalShell` | analysis | 个股智能分析（带代码） |
| 24 | `/analysis/score-docs` | `PortalShell` | analysis | 评分文档版本库 |
| 25 | `/analysis/news` | `PortalShell` | analysis | 智能资讯 |
| 26 | `/analysis/score-comparison` | `PortalShell` | analysis | 历史评分比对看板 |
| 27 | `/analysis/hot-sector` | `PortalShell` | analysis | 热门板块策略选股（五维评分） |
| 28 | `/analysis/value-pit` | `PortalShell` | analysis | 价值洼地策略选股（五维评分 + 轮动信号） |
| 29 | `/analysis/multi-factor` | `PortalShell` | analysis | 多因子筛选（条件组增删 / 因子编辑 / 模板持久化） |
| 30 | `/trading/flow` | `PortalShell` | trading | 交易舱 - 交易流程 |
| 31 | `/trading` | `PortalShell` | trading | 交易舱 |
| 32 | `/trading/strategy-snapshots` | `PortalShell` | trading | 策略快照 |
| 33 | `/trading/holdings` | `PortalShell` | trading | 交易持仓管理 |
| 34 | `/trading/execution-plans` | `PortalShell` | trading | 执行计划管理 |
| 35 | `/trading/execution` | `PortalShell` | trading | 执行管理（别名 → execution-plans） |
| 36 | `/trading/portfolio` | `PortalShell` | trading | 投资组合管理 |
| 37 | `/trading/risk` | `PortalShell` | trading | 风险控制管理 |
| 38 | `/output` | `PortalShell` | output | 输出舱 |
| 39 | `/output/hub` | `PortalShell` | output | 输出舱 - 模块首页 |
| 40 | `/output/research` | `PortalShell` | output | 输出舱 - 研究报告 |
| 41 | `/output/review` | `PortalShell` | output | 输出舱 - 交易复盘 |
| 42 | `/output/export` | `PortalShell` | output | 输出舱 - 数据导出 |
| 43 | `/output/dashboard` | `PortalShell` | output | 输出舱 - 仪表盘 |
| 44 | `/output/wizard` | `PortalShell` | output | 输出舱 - 复盘向导 |
| 45 | `/output/prediction` | `PortalShell` | output | 输出舱 - 预测校验 |
| 46 | `/output/retrospective` | `PortalShell` | output | 输出舱 - 周期复盘 |
| 47 | `/output/factor-dashboard` | `PortalShell` | output | 输出舱 - 因子画板 |
| 48 | `/output/chip-strategy` | `PortalShell` | output | 输出舱 - 筹码与交易策略复盘 |
| 49 | `/command/hub` | `PortalShell` | command | 总控舱 - 模块首页 |
| 50 | `/command` | `PortalShell` | command | 总控舱 |
| 51 | `/command/agents` | `PortalShell` | command | 智能体总控台 |
| 52 | `/command/agents/registry` | `PortalShell` | command | 智能体注册表 |
| 53 | `/command/agents/registry/:agentId` | `PortalShell` | command | 智能体详情 |
| 54 | `/command/agents/trigger` | `PortalShell` | command | 智能体任务触发 |
| 55 | `/command/agents/tasks` | `PortalShell` | command | 智能体任务列表 |
| 56 | `/command/agents/custom` | `PortalShell` | command | 自定义智能体 |
| 57 | `/command/agents/llm` | `PortalShell` | command | LLM 管理 |
| 58 | `/command/agents/capability-graph` | `PortalShell` | command | 能力图谱 |
| 59 | `/command/agents/dag-scheduler` | `PortalShell` | command | DAG 调度器 |
| 60 | `/command/agents/feedback` | `PortalShell` | command | 反馈控制台 |
| 61 | `/command/agents/model-upgrade` | `PortalShell` | command | 模型升级 |
| 62 | `/command/agents/data-labels` | `PortalShell` | command | 数据标签管理 |
| 63 | `/command/agents/api-config` | `PortalShell` | command | API 配置 |
| 64 | `/command/agents/skill-audit` | `PortalShell` | command | Skill 核查 |
| 65 | `/command/agents/optimization` | `PortalShell` | command | 优化建议 |
| 66 | `/command/agents/changelog` | `PortalShell` | command | 更新日志 |
| 67 | `/command/system-health` | `PortalShell` | command | 系统健康（监控+架构健康度合并） |
| 68 | `/command/agents/task-panel` | `PortalShell` | command | 智能体任务管理（任务列表+触发+反馈合并） |
| 69 | `/command/agents/model-config` | `PortalShell` | command | 模型配置（LLM+API密钥+模型升级合并） |
| 70 | `/command/agents/optimization-panel` | `PortalShell` | command | 优化建议（优化建议+Skill核查合并） |
| 71 | `/command/mcp-servers` | `PortalShell` | command | MCP Server 管理 |
| 72 | `/command/showcase` | `PortalShell` | command | 组件示例库 |
| 73 | `/command/health` | `PortalShell` | command | 架构健康度仪表盘 |
| 74 | `/command/monitor` | `PortalShell` | command | 系统监控 |
| 75 | `/command/config` | `PortalShell` | command | 配置管理 |
| 76 | `/command/test` | `PortalShell` | command | 压力测试 |
| 77 | `/mock-test` | `MockTestPage` | other | V9 模块 Mock 验证页（Slider/Sheet/Toggle/Engine） |

> **v3.4.0 同步**：路由表与 `src/config/routes.ts` 全面对齐。新增 17 条未文档化路由（输入舱 3 条：`/input/collection-monitor`、`/input/collection-strategy`、`/input/pool-board`；分析舱 2 条：`/analysis/industry-dashboard`、`/analysis/intelligent-score/:symbol`；输出舱 5 条：`/output/wizard`、`/output/prediction`、`/output/retrospective`、`/output/factor-dashboard`、`/output/chip-strategy`；总控舱 7 条：`/command/system-health`、`/command/agents/task-panel`、`/command/agents/model-config`、`/command/agents/optimization-panel`、`/command/showcase`、`/command/health`、`/command/test`）。移除 3 个幽灵路由（`/analysis/stock-pool` → 代码实际为 `/input/pool-board`；`/analysis/stock-score/:symbol` → 代码实际为 `/analysis/intelligent-score/:symbol`；`/trading/hub` → ROUTE_REGISTRY 中不存在）。路由总数由 62 修正为 **77 条**。
>
> **v3.0.0 变更**：路由数从 31 条增至 47 条。新增 16 条路由（输入舱 3 条、分析舱 2 条、总控舱智能体子模块 10 条、总控舱扩展 1 条），移除已废弃的 `/analysis/news-v6`。所有五舱路由的 `component` 统一为 `PortalShell`，实际页面组件由三级加载链的第三级（App 分发器）渲染。
>
> **v3.1.0 修正**：交叉一致性检查发现数量偏差，路由总数修正为 **48 条**（补算 `/mock-test` 路由编号）；分析舱路由数由 11 修正为 12（含价值洼地策略路由）。
>
> **v3.2.0 变更**：新增 `/analysis/stock-pool` 股票池看板路由；分析舱路由数由 12 修正为 13；路由总数由 48 修正为 **49 条**。股票池看板从输入舱迁移至分析舱，并在输入舱侧栏保留跳转入口。
>
> **v3.3.0 治理**：清理 `ROUTE_REGISTRY` 中重复的 `/trading/risk`；移除 `EXPECTED_PATHS` 中过期的 `/trading/hub` 与 `/analysis/news-v6`；补全交易舱、输出舱、总控舱智能体子模块等 29 条真实路由到预期列表。路由总数由 49 修正为 **62 条**，覆盖率达到 100%。
>
> 所有业务路由均已集中注册；`App.tsx` 通过遍历 `ROUTE_REGISTRY` 渲染，不再硬编码路径。
>
> 路由→组件→服务映射见第 8 节。三级加载链架构见第 2.5 节。

### 2.2 路由分类

```ts
export type RouteCategory =
  | 'portal'      // 门户/驾驶舱
  | 'input'       // 输入舱
  | 'analysis'    // 分析舱
  | 'trading'     // 交易舱
  | 'output'      // 输出舱
  | 'command'     // 总控舱
  | 'system'      // 系统设置
  | 'other'       // 其他
```

### 2.3 路由接口

```ts
export interface RouteConfig {
  path: string
  component: LazyExoticComponent<ComponentType<unknown>>
  category: RouteCategory
  description: string
}
```

### 2.4 辅助函数

| 函数 | 位置 | 用途 |
|------|------|------|
| `getAllPaths()` | `src/config/routes.ts` | 返回所有已注册路径，用于路由一致性校验 |
| `hasRoute(path)` | `src/config/routes.ts` | 判断路径是否已注册 |
| `getRoutesByCategory(category)` | `src/config/routes.ts` | 按舱室分类获取路由 |
| `getCabinPaths()` | `src/config/routes.ts` | 获取五舱入口路径映射 |

### 2.5 三级加载链架构（v3.0.0 新增）

V9 采用三级间接加载架构，`ROUTE_REGISTRY` 中的 `component` 字段仅指向第一级（`PortalShell`），实际页面组件由第三级 App 分发器渲染：

```
Level 1: routes.ts（77 条路由）
  ↓ component 统一指向 PortalShell（3 个例外：HomePage / CockpitShell / MockTestPage）
Level 2: PortalShell（src/portal/PortalShell.tsx）
  ↓ 根据 URL 路径前缀分发到对应 App 分发器
Level 3: App 分发器（src/apps/{cabin}/*App.tsx）
  ↓ 根据 location.pathname 条件渲染具体页面组件（React.lazy 或静态 import）
```

**设计决策**：所有 App 分发器均使用 `useLocation() + 条件渲染` 替代嵌套 `<Routes>`，原因是 React Router v7 在 descendant `<Routes>` 场景下绝对路径匹配行为与 v6 不一致。

#### 各分发器子路由明细

| 分发器 | 文件路径 | 子路由数 | 分发方式 |
|--------|---------|:--------:|---------|
| **InputApp** | `src/apps/input/InputApp.tsx` | 8 | `INPUT_ROUTES` 查表 + React.lazy |
| **AnalysisApp** | `src/apps/analysis/AnalysisApp.tsx` | 11 | `ANALYSIS_ROUTES` 查表 + React.lazy |
| **TradingApp** | `src/apps/trading/TradingApp.tsx` | 7 | `TRADING_ROUTES` 查表 + React.lazy |
| **OutputApp** | `src/apps/output/OutputApp.tsx` | 11 | `OUTPUT_ROUTES` 查表 + React.lazy + ErrorBoundary |
| **CommandApp** | `src/apps/command/CommandApp.tsx` | 7 | `BRANCH_INFO` + switch 分发 + React.lazy |
| **AgentApp** | `src/apps/command/AgentApp.tsx` | 18 | `AGENT_ROUTE_MAP` 查表 + React.lazy |

> **分发方式说明**：所有分发器均使用「路径→组件」查表模式（`INPUT_ROUTES` / `ANALYSIS_ROUTES` / `TRADING_ROUTES` / `OUTPUT_ROUTES` / `BRANCH_INFO`+switch / `AGENT_ROUTE_MAP`），新增子页面仅需在对应数组中追加条目。PortalShell 通过 `isAgentPath` 判断将 `/command/agents*` 路径单独路由至 `AgentApp`（而非 `CommandApp`）。

---

## 3. 舱室与路由映射

### 3.1 五舱与驾驶舱映射

| 舱室 | 路径前缀 | 路由数 | 主要页面 | 当前状态 |
|------|----------|:------:|----------|----------|
| 输入舱 | `/input` | 12 | 录入看板、批量导入、热门板块、采集测试、采集监控台、采集策略配置、本地知识库、七维配置、抓取配置、采集任务、研究候选池 | ? 已注册；8 子页面由 InputApp 分发 |
| 分析舱 | `/analysis/*` | 15 | 行业仪表盘、个股评分、智能评分、行业评分、板块分析、回测、评分文档、资讯、评分比对、热门板块、价值洼地、多因子 | ? 已注册；11 子页面由 AnalysisApp 分发 |
| 交易舱 | `/trading` | 8 | 交易流程、交易看板、策略快照、持仓管理、执行计划、执行管理、投资组合、风险控制 | ? 已注册；7 子页面由 TradingApp 分发 |
| 输出舱 | `/output` | 11 | 研究报告、交易复盘、数据导出、仪表盘、复盘向导、预测校验、周期复盘、因子画板、筹码策略 | ? 已注册；11 子页面由 OutputApp 分发 |
| 总控舱 | `/command` | 28 | 系统健康、系统监控、配置管理、组件示例库、架构健康度、压力测试、智能体子模块（19 页）、MCP 管理 | ? 已注册；CommandApp(7) + AgentApp(18) 分发 |
| 驾驶舱 | `/cockpit` | 1 | 综合 Dashboard | ? 已注册 |

> **v3.4.0 同步**：各舱路由数与 `ROUTE_REGISTRY` 对齐——输入舱 9→12、分析舱 13→15、交易舱 4→8、输出舱 5→11、总控舱 15→28。智能体子模块从 10 页扩展至 19 页（含合并面板 task-panel / model-config / optimization-panel）。
>
> **v3.0.0 变更**：总控舱从 2 条路由扩展至 15 条（新增智能体子模块 10 条 + MCP/监控/配置 3 条）。输入舱新增 3 条（七维配置、抓取配置、采集监控）。分析舱新增 2 条（热门板块、价值洼地）。交易/总控舱已完成子页面拆分。
>
> **Hub 页说明**：Hub 页是一类组件的统称，实际文件名为 `InputHubPage`/`AnalysisHubPage`/`TradingHubPage`/`OutputHubPage`/`CommandHubPage`，由 `PortalShell` 内部分发。

### 3.2 输入舱子路由映射

| 路径 | 组件 | 服务 | 说明 |
|------|------|------|------|
| `/input` | `InputDashboard.tsx` | `inputService` | 录入看板、单条录入 |
| `/input/hub` | `InputHubPage` | `inputService`, `stockpoolService` | 输入舱模块首页 |
| `/input/bulk-import` | `BulkImportPanel.tsx` | `batchImportService`, `inputService` | 批量文本导入（已整合至录入看板，fallback 到 /input） |
| `/input/hot-sectors` | `HotSectorPanel.tsx` | `hotSectorService`, `inputService` | 热门板块（已整合至录入看板，fallback 到 /input） |
| `/input/data-test` | `CollectionMonitorPanel` | `fetcherService` | 采集测试（已合并至采集监控台） |
| `/input/collection-monitor` | `CollectionMonitorPanel` | `fetcherService`, `collectTaskService` | 采集监控台（链路测试 + 任务监控） |
| `/input/collection-strategy` | `CollectionStrategyPage` | `sevenDimService`, `fetcherConfigService` | 采集策略配置（七维策略 + 抓取引擎） |
| `/input/local-knowledge` | `LocalKnowledgePage` | `localKnowledgeService` | 本地知识库浏览与管理 |
| `/input/seven-dim` | `CollectionStrategyPage` | `sevenDimService` | 七维采集策略配置（已合并至采集策略配置） |
| `/input/fetcher-config` | `CollectionStrategyPage` | `fetcherConfigService` | 抓取引擎配置（已合并至采集策略配置） |
| `/input/collect-tasks` | `CollectionMonitorPanel` | `collectTaskService`, `collectionReportService` | 采集任务监控（已合并至采集监控台） |
| `/input/pool-board` | `PoolBoardPage` | `poolStore` | 研究候选池总览（基本信息 + 采集进度） |

### 3.3 路径命名规范

- 使用 kebab-case：`/analysis/stock-score`，非 `/analysis/stockScore`。
- 动态参数使用 `:symbol`，如 `/analysis/intelligent-score/600519.SH`。
- 同一功能不同视图使用查询参数或子路径，避免路径爆炸。

---

## 4. 懒加载策略

### 4.1 页面级懒加载

所有 `pages/` 下的页面组件通过 `React.lazy()` 动态导入：

```ts
{
  path: '/analysis/stock-score',
  component: React.lazy(() => import('@/pages/analysis/StockAnalysisPage')),
  category: 'analysis',
  description: '个股九维评分分析',
}
```

### 4.2 代码分割

`vite.config.ts` 已配置 `manualChunks`：

| Chunk | 包含依赖 |
|-------|----------|
| `vendor` | react, react-dom, react-router, zustand |
| `ui` | lucide-react, clsx, tailwind-merge |

未来可按舱室进一步拆分：

```ts
manualChunks: {
  'analysis': ['@/pages/analysis/*'],
  'trading': ['@/apps/trading/*'],
}
```

### 4.3 加载状态

- 懒加载过程中显示 `Suspense` fallback，fallback 使用骨架屏（Skeleton），禁止白屏。
- 加载失败时捕获错误并提示用户刷新或返回首页。

---

## 5. 导航规范

### 5.1 PortalShell 职责

`src/portal/PortalShell.tsx` 作为五舱导航容器，负责：

- 渲染舱室切换 Tab/侧边栏。
- 高亮当前舱室。
- 不直接参与业务路由，仅通过 `<Outlet />` 或内部状态渲染当前舱室应用。

### 5.2 舱内导航

- 分析舱内使用二级 Tab 切换「个股评分 / 行业评分 / 板块分析 / 回测」。
- 选中股票后进入 `/analysis/intelligent-score/:symbol` 详情页。
- 返回上一级时保留筛选条件（通过 URL 查询参数或局部状态）。

### 5.3 路由守卫

v1.0.0 计划实现：

- **数据存在性守卫**：访问 `/analysis/intelligent-score/:symbol` 时，若 `symbol` 不在 stocks store 中，重定向到候选池。
- **离线守卫**：访问需要 LLM 的功能时，若离线则提示并阻止进入或提供降级入口。

---

## 6. 与 v6-pro-cockpit 的对齐点

v6 项目强调「路由表即 UI 映射 truth source」，其做法值得 V9 借鉴：

1. **全量路由注册**：所有页面（含 Portal/Cockpit/五舱）均进入 `ROUTE_REGISTRY`。
2. **路由-组件一致性审计**：定期检查 `ROUTE_REGISTRY` 中的路径与 `src/pages/` 实际文件是否一一对应。
3. **路由分类与权限**：按舱室分类，未来可扩展基于用户角色的路由可见性。
4. **懒加载 fallback 规范**：统一 Skeleton 组件，避免各页面自行实现。

---

## 7. 当前偏差与下一步

| 偏差 | 影响 | 状态 | 计划 |
|------|------|------|------|
| Hub 页未进入 `ROUTE_REGISTRY` | 外部路由表不感知 Hub 组件 | ? 设计选择 | Hub 页由 App 分发器内部分发，不独立注册 |
| 无路由守卫 | 访问不存在的 symbol 会进入空白详情页 | ? 待实现 | Phase 2 增加数据存在性校验 |
| ErrorBoundary 仅包裹根路由 | 单个页面崩溃可能影响整个应用 | ? 待实现 | Phase 2 为每个 Route 增加独立边界（OutputApp 已实现） |
| 代码分割未按舱室 | 首屏仍加载全部页面组件 | ? 待实现 | Phase 3 按舱室拆分 chunk |

> **v3.4.0 同步**：路由总数由 62 修正为 **77**；移除文档中残留的 3 个幽灵路由（`/analysis/stock-pool`、`/analysis/stock-score/:symbol`、`/trading/hub`）；补全 17 条未文档化路由到注册表与映射表。
>
> **v3.0.0 已解决偏差**：五舱子页面已全部拆分（48 条路由）；`/input/prototype` 已移除；总控舱智能体子模块 10 条路由已注册。
>
> **v3.1.0 修正**：路由总数统计由 47 修正为 48；分析舱路由数由 11 修正为 12。
>
> **v3.3.0 治理**：路由总数由 49 修正为 **62**；删除重复 `/trading/risk`；移除过期 `/trading/hub`、`/analysis/news-v6`；补全所有真实路由到预期列表，覆盖率 100%。

---

## 8. 路由 → 组件 → 服务映射

| 路径 | 实际页面组件（App 分发器渲染） | 服务 | 分类 |
|------|------|------|------|
| `/` | `HomePage` | - | portal |
| `/cockpit` | `CockpitShell` | - | portal |
| `/input/hub` | → `InputApp` → `InputHubPage` | `inputService`, `stockpoolService` | input |
| `/input` | → `InputApp` → `InputDashboard` | `inputService`, `stockpoolService` | input |
| `/input/bulk-import` | → `InputApp` → `InputDashboard`（fallback） | `batchImportService`, `inputService` | input |
| `/input/hot-sectors` | → `InputApp` → `InputDashboard`（fallback） | `hotSectorService`, `inputService` | input |
| `/input/data-test` | → `InputApp` → `CollectionMonitorPanel` | `fetcherService` | input |
| `/input/collection-monitor` | → `InputApp` → `CollectionMonitorPanel` | `fetcherService`, `collectTaskService` | input |
| `/input/collection-strategy` | → `InputApp` → `CollectionStrategyPage` | `sevenDimService`, `fetcherConfigService` | input |
| `/input/local-knowledge` | → `InputApp` → `LocalKnowledgePage` | `localKnowledgeService` | input |
| `/input/seven-dim` | → `InputApp` → `CollectionStrategyPage` | `sevenDimService` | input |
| `/input/fetcher-config` | → `InputApp` → `CollectionStrategyPage` | `fetcherConfigService` | input |
| `/input/collect-tasks` | → `InputApp` → `CollectionMonitorPanel` | `collectTaskService` | input |
| `/input/pool-board` | → `InputApp` → `PoolBoardPage` | `poolStore` | input |
| `/analysis/hub` | → `AnalysisApp` → `AnalysisHubPage` | - | analysis |
| `/analysis` | → `AnalysisApp` → `AnalysisTemplateCards` | - | analysis |
| `/analysis/industry-dashboard` | → `AnalysisApp` → `IndustryDashboardPage` | `industryScoreService` | analysis |
| `/analysis/sector` | → `AnalysisApp` → `SectorAnalysisPage` | `industryScoreService` | analysis |
| `/analysis/backtest` | → `AnalysisApp` → `BacktestPage` | - | analysis |
| `/analysis/industry-score` | → `AnalysisApp` → `IndustryScorePage` | `industryScoreService` | analysis |
| `/analysis/stock-score` | → `AnalysisApp` → `StockAnalysisPage` | `v6ScoreService`, `intelligentScoreService` | analysis |
| `/analysis/intelligent-score` | → `AnalysisApp` → `IntelligentScorePage` | `intelligentScoreService` | analysis |
| `/analysis/intelligent-score/:symbol` | → `AnalysisApp` → `IntelligentScorePage` | `intelligentScoreService` | analysis |
| `/analysis/score-docs` | → `AnalysisApp` → `ScoreDocPage` | `scoreDocService` | analysis |
| `/analysis/news` | → `AnalysisApp` → `NewsPage` | `newsService` | analysis |
| `/analysis/score-comparison` | → `AnalysisApp` → `ScoreComparisonPage` | - | analysis |
| `/analysis/hot-sector` | → `AnalysisApp` → `HotSectorPage` | `hotSectorService` | analysis |
| `/analysis/value-pit` | → `AnalysisApp` → `ValuePitPage` | `valuePitService` | analysis |
| `/analysis/multi-factor` | → `AnalysisApp` → `MultiFactorFilterPage` | - | analysis |
| `/trading/flow` | → `TradingApp` → `TradingFlowPage` | `tradingService` | trading |
| `/trading` | → `TradingApp` → `TradingDashboard` | `tradingService`, `signalGenerator`, `riskEngine` | trading |
| `/trading/strategy-snapshots` | → `TradingApp` → `StrategySnapshotPage` | `strategySnapshotService` | trading |
| `/trading/holdings` | → `TradingApp` → `HoldingsPage` | `holdingsService` | trading |
| `/trading/execution-plans` | → `TradingApp` → `ExecutionPlanPanel` | `tradingService` | trading |
| `/trading/execution` | → `TradingApp` → `ExecutionPlanPanel` | `tradingService` | trading |
| `/trading/portfolio` | → `TradingApp` → `PortfolioPage` | `tradingService` | trading |
| `/trading/risk` | → `TradingApp` → `RiskControlPage` | `riskEngine` | trading |
| `/output` | → `OutputApp` → `OutputHubPage` | `outputStore` | output |
| `/output/hub` | → `OutputApp` → `OutputHubPage` | `outputStore` | output |
| `/output/research` | → `OutputApp` → `ResearchReportPage` | `scoreDocStore` | output |
| `/output/review` | → `OutputApp` → `TradeReviewPage` | `disciplineStore` | output |
| `/output/export` | → `OutputApp` → `DataExportPanel` | `systemService` | output |
| `/output/dashboard` | → `OutputApp` → `DashboardPage` | `outputStore` | output |
| `/output/wizard` | → `OutputApp` → `ReviewWizardPage` | `disciplineStore` | output |
| `/output/prediction` | → `OutputApp` → `PredictionPage` | - | output |
| `/output/retrospective` | → `OutputApp` → `RetrospectivePage` | - | output |
| `/output/factor-dashboard` | → `OutputApp` → `FactorDashboardPage` | - | output |
| `/output/chip-strategy` | → `OutputApp` → `ChipStrategyReviewPage` | - | output |
| `/command/hub` | → `CommandApp` → `CommandHubPage` | - | command |
| `/command` | → `CommandApp` → `SystemMonitor` | `systemMonitorStore` | command |
| `/command/agents` | → `AgentApp` → `AgentHubPage` | `agentStore` | command |
| `/command/agents/registry` | → `AgentApp` → `AgentRegistryPage` | `agentStore` | command |
| `/command/agents/registry/:agentId` | → `AgentApp` → `AgentDetailPage` | `agentStore` | command |
| `/command/agents/trigger` | → `AgentApp` → `AgentTaskTriggerPage` | `agentStore` | command |
| `/command/agents/tasks` | → `AgentApp` → `AgentTasksPage` | `agentStore` | command |
| `/command/agents/custom` | → `AgentApp` → `AgentCustomPage` | `agentStore` | command |
| `/command/agents/llm` | → `AgentApp` → `AgentLlmPage` | `llmConfigService` | command |
| `/command/agents/capability-graph` | → `AgentApp` → `AgentCapabilityGraphPage` | `agentStore` | command |
| `/command/agents/dag-scheduler` | → `AgentApp` → `AgentDagSchedulerPage` | `agentStore` | command |
| `/command/agents/feedback` | → `AgentApp` → `AgentFeedbackPage` | `agentFeedbackStore` | command |
| `/command/agents/model-upgrade` | → `AgentApp` → `AgentModelUpgradePage` | `llmConfigService` | command |
| `/command/agents/data-labels` | → `AgentApp` → `AgentDataLabelPage` | `agentStore` | command |
| `/command/agents/api-config` | → `AgentApp` → `AgentApiConfigPage` | `llmConfigService` | command |
| `/command/agents/skill-audit` | → `AgentApp` → `AgentSkillAuditPage` | `agentStore` | command |
| `/command/agents/optimization` | → `AgentApp` → `AgentOptimizationPage` | `agentStore` | command |
| `/command/agents/changelog` | → `AgentApp` → `AgentChangelogPage` | `agentStore` | command |
| `/command/system-health` | → `CommandApp` → `SystemHealthPanel` | `systemMonitorStore` | command |
| `/command/agents/task-panel` | → `AgentApp` → `AgentTaskPanel` | `agentStore` | command |
| `/command/agents/model-config` | → `AgentApp` → `ModelConfigPanel` | `llmConfigService` | command |
| `/command/agents/optimization-panel` | → `AgentApp` → `OptimizationPanel` | `agentStore` | command |
| `/command/mcp-servers` | → `CommandApp` → `MCPServerDashboardPage` | `mcpService` | command |
| `/command/showcase` | → `CommandApp` → `ComponentShowcasePage` | - | command |
| `/command/health` | → `CommandApp` → `HealthDashboardPage` | `systemMonitorStore` | command |
| `/command/monitor` | → `CommandApp` → `SystemMonitor` | `systemMonitorStore` | command |
| `/command/config` | → `CommandApp` → `ConfigApp` | `configService` | command |
| `/command/test` | → `CommandApp` → `StressOverviewPage` | - | command |
| `/mock-test` | `MockTestPage` | - | other |

> **v3.4.0 同步**：映射表与 `ROUTE_REGISTRY` 全量对齐（77 条）。移除 3 个幽灵路由（`/analysis/stock-score/:symbol`、`/analysis/stock-pool`、`/trading/hub`）；新增 31 条缺失映射（输入舱 3 条、分析舱 4 条、交易舱 5 条、输出舱 6 条、总控舱 13 条）。合并后旧路由（data-test / collect-tasks / seven-dim / fetcher-config）的组件列更新为实际渲染的合并组件；AgentApp 子模块组件名从占位符 `AgentPlaceholderPage` 更正为实际组件名。
>
> **v3.0.0 变更**：组件列从 `ROUTE_REGISTRY` 的 `PortalShell` 改为实际渲染页面组件（由 App 分发器内部渲染）。新增 16 条路由映射，移除已废弃的 `/analysis/news-v6` 和 `/input/prototype`。
>
> 完整路由源文件见 `src/config/routes.ts`。`getAllPaths()` 返回所有已注册路径，可用于路由一致性校验。

---

## 9. 版本比对

本文档当前版本为 `v0.9.0-migration-implemented`，与规划基线 `v0.9.0-docs-base` 的差异见：

- `../../reference/architecture-version-comparison.md`

主要变化：

1. 增加第 8 节「路由 → 组件 → 服务映射」，作为 UI/服务双向追踪表。
2. 第 3.2 节增加输入舱子路由映射。
3. 偏差清单增加 `/input/prototype` 临时路由处理计划。
