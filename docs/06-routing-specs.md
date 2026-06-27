# 06. 路由规格

> **Status**: Current  
> **Version**: v1.1.0  
> **Last Updated**: 2026-06-26
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

| 路径 | 组件 | 分类 | 说明 |
|------|------|------|------|
| `/` | `HomePage` | portal | 首页 |
| `/cockpit` | `CockpitShell` | portal | 驾驶舱 Dashboard |
| `/input/hub` | `PortalShell` | input | 输入舱 - 模块首页 |
| `/input` | `PortalShell` | input | 输入舱 - 录入看板 |
| `/input/bulk-import` | `PortalShell` | input | 输入舱 - 批量导入 |
| `/input/hot-sectors` | `PortalShell` | input | 输入舱 - 热门板块 |
| `/input/data-test` | `PortalShell` | input | 输入舱 - 采集测试 |
| `/input/local-knowledge` | `LocalKnowledgePage` | input | 输入舱 - 本地知识库 |
| `/analysis/hub` | `PortalShell` | analysis | 分析舱 - 模块首页 |
| `/analysis` | `PortalShell` | analysis | 分析舱入口 |
| `/trading/hub` | `PortalShell` | trading | 交易舱 - 模块首页 |
| `/trading` | `PortalShell` | trading | 交易舱 |
| `/output` | `PortalShell` | output | 输出舱 |
| `/command/hub` | `PortalShell` | command | 总控舱 - 模块首页 |
| `/command` | `PortalShell` | command | 总控舱 |
| `/analysis/stock-score` | `StockAnalysisPage` | analysis | 个股九维评分分析 |
| `/analysis/stock-score/:symbol` | `StockAnalysisPage` | analysis | 个股九维评分分析（带代码） |
| `/analysis/sector` | `SectorAnalysisPage` | analysis | 行业与板块分析 |
| `/analysis/backtest` | `BacktestPage` | analysis | 策略回测 |
| `/analysis/industry-score` | `IndustryScorePage` | analysis | V4 行业评分 |
| `/analysis/intelligent-score` | `IntelligentScorePage` | analysis | V6 个股智能评分 |
| `/analysis/score-docs` | `ScoreDocPage` | analysis | 评分文档版本库 |
| `/analysis/news` | `NewsPage` | analysis | 智能资讯 |
| `/analysis/news-v6` | `NewsPage` | analysis | 智能资讯 (V6 风格迁移版) |
| `/trading/strategy-snapshots` | `StrategySnapshotPage` | trading | 策略快照 |
| `/trading/holdings` | `HoldingsPage` | trading | 交易持仓管理 |
| `/mock-test` | `MockTestPage` | other | V9 模块 Mock 验证页（Slider/Sheet/Toggle/Engine） |

> 所有业务路由均已集中注册；`App.tsx` 通过遍历 `ROUTE_REGISTRY` 渲染，不再硬编码路径。
>
> 路由→组件→服务映射见第 8 节。

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

---

## 3. 舱室与路由映射

### 3.1 五舱与驾驶舱映射

| 舱室 | 路径前缀 | 主要页面 | 当前状态 |
|------|----------|----------|----------|
| 输入舱 | `/input` | `/input`、`/input/bulk-import`、`/input/hot-sectors`、`/input/data-test`、`/input/local-knowledge` | ✅ 已注册；子页面已拆分 |
| 分析舱 | `/analysis/*` | 个股评分、行业评分、板块分析、回测 | ✅ 已注册 |
| 交易舱 | `/trading` | 模拟下单、持仓、订单历史、风控 | ✅ 已注册 |
| 输出舱 | `/output` | 研究报告、复盘笔记、数据导出 | ✅ 已注册 |
| 总控舱 | `/command` | 系统统计、配置、数据重置 | ✅ 已注册 |
| 驾驶舱 | `/cockpit` | 综合 Dashboard | ✅ 已注册 |

> 输入舱已按分析舱模式拆分为 `/input`、`/input/bulk-import`、`/input/hot-sectors`、`/input/data-test`、`/input/local-knowledge` 五个子页面，统一由 `PortalShell` 渲染并在 `InputApp` 内按路径分发。交易/输出/总控舱仍仅注册入口路由，舱内功能通过 `PortalShell` 面板切换。
>
> **Hub 页说明**：Hub 页是一类组件的统称，实际文件名为 `InputHubPage`/`AnalysisHubPage`/`TradingHubPage`/`CommandHubPage`，由 `PortalShell` 内部分发；output hub 直接复用 `OutputApp`。

### 3.2 输入舱子路由映射

| 路径 | 组件 | 服务 | 说明 |
|------|------|------|------|
| `/input` | `InputDashboard.tsx` | `inputService`, `stockpoolService` | 录入看板、单条录入、股票池五态看板 |
| `/input/bulk-import` | `BulkImportPanel.tsx` | `batchImportService`, `inputService` | 批量文本导入、解析预览、导入结果 |
| `/input/hot-sectors` | `HotSectorPanel.tsx` | `hotSectorService`, `inputService` | 热门板块卡片、关联股票、加入候选池 |
| `/input/data-test` | `DataTestPanel.tsx` | `fetcherService` | 服务健康、单/批量接口测试 |
| `/input/local-knowledge` | `LocalKnowledgePage` | `localKnowledgeService` | 本地知识库浏览与管理 |

### 3.3 路径命名规范

- 使用 kebab-case：`/analysis/stock-score`，非 `/analysis/stockScore`。
- 动态参数使用 `:symbol`，如 `/analysis/stock-score/600519.SH`。
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
- 选中股票后进入 `/analysis/stock-score/:symbol` 详情页。
- 返回上一级时保留筛选条件（通过 URL 查询参数或局部状态）。

### 5.3 路由守卫

v1.0.0 计划实现：

- **数据存在性守卫**：访问 `/analysis/stock-score/:symbol` 时，若 `symbol` 不在 stocks store 中，重定向到候选池。
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

| 偏差 | 影响 | 计划 |
|------|------|------|
| 五舱入口已注册但子页面未拆分 | `/trading/signals` 等子路径不存在 | Phase 2 随功能完善逐步增加子路由 |
| Hub 页（`InputHubPage`/`AnalysisHubPage`/`TradingHubPage`/`CommandHubPage`）未进入 `ROUTE_REGISTRY` | 外部路由表不感知 Hub 组件 | 设计选择：Hub 页由 `PortalShell` 内部懒加载分发，不独立注册；output hub 直接复用 `OutputApp` |
| 无路由守卫 | 访问不存在的 symbol 会进入空白详情页 | Phase 2 增加数据存在性校验 |
| ErrorBoundary 仅包裹根路由 | 单个页面崩溃可能影响整个应用 | Phase 2 为每个 Route 增加独立边界 |
| 代码分割未按舱室 | 首屏仍加载全部页面组件 | Phase 3 按舱室拆分 chunk |
| `/input/prototype` 为临时路由 | 与正式路由并存，可能造成漂移 | 已确认归档：保留路径但标记为临时，Phase 2 末迁移为设计档案或删除 |

---

## 8. 路由 → 组件 → 服务映射

| 路径 | 组件 | 服务 | 分类 |
|------|------|------|------|
| `/` | `HomePage` | - | portal |
| `/cockpit` | `CockpitShell` | - | portal |
| `/input/hub` | `PortalShell`（内部分发至 `InputApp`） | `inputService`, `stockpoolService` | input |
| `/input` | `PortalShell`（内部分发至 `InputApp`/`InputDashboard`） | `inputService`, `stockpoolService` | input |
| `/input/bulk-import` | `BulkImportPanel.tsx` | `batchImportService` | input |
| `/input/hot-sectors` | `HotSectorPanel.tsx` | `hotSectorService` | input |
| `/input/data-test` | `DataTestPanel.tsx` | `fetcherService` | input |
| `/input/prototype` | `InputPrototype.tsx` | mock | input |
| `/input/local-knowledge` | `LocalKnowledgePage` | `localKnowledgeService` | input |
| `/analysis/hub` | `PortalShell`（内部分发至 `AnalysisApp`） | - | analysis |
| `/analysis` | `PortalShell`（内部分发至 `AnalysisApp`） | - | analysis |
| `/analysis/stock-score` | `StockAnalysisPage` | `v6ScoreService`, `intelligentScoreService` | analysis |
| `/analysis/stock-score/:symbol` | `StockAnalysisPage` | `v6ScoreService`, `intelligentScoreService` | analysis |
| `/analysis/sector` | `SectorAnalysisPage` | `industryScoreService` | analysis |
| `/analysis/backtest` | `BacktestPage` | - | analysis |
| `/analysis/industry-score` | `IndustryScorePage` | `industryScoreService` | analysis |
| `/analysis/intelligent-score` | `IntelligentScorePage` | `intelligentScoreService` | analysis |
| `/analysis/score-docs` | `ScoreDocPage` | `scoreDocService` | analysis |
| `/analysis/news` | `NewsPage` | `newsService` | analysis |
| `/analysis/news-v6` | `NewsPage`（V6 迁移验证页） | `newsService` | analysis |
| `/trading/hub` | `PortalShell`（内部分发至 `TradingApp`） | `tradingService`, `signalGenerator`, `riskEngine` | trading |
| `/trading` | `PortalShell`（内部分发至 `TradingApp`） | `tradingService`, `signalGenerator`, `riskEngine` | trading |
| `/trading/strategy-snapshots` | `StrategySnapshotPage` | `strategySnapshotService` | trading |
| `/trading/holdings` | `HoldingsPage` | `holdingsService` | trading |
| `/output` | `PortalShell`（内部分发至 `OutputApp`） | - | output |
| `/command/hub` | `PortalShell`（内部分发至 `CommandApp`） | - | command |
| `/command` | `PortalShell`（内部分发至 `CommandApp`） | - | command |
| `/mock-test` | `MockTestPage` | - | other |

> 完整路由源文件见 `src/config/routes.ts`。`getAllPaths()` 返回所有已注册路径，可用于路由一致性校验。

---

## 9. 版本比对

本文档当前版本为 `v0.9.0-migration-implemented`，与规划基线 `v0.9.0-docs-base` 的差异见：

- `docs/implementation/architecture-version-comparison.md`

主要变化：

1. 增加第 8 节「路由 → 组件 → 服务映射」，作为 UI/服务双向追踪表。
2. 第 3.2 节增加输入舱子路由映射。
3. 偏差清单增加 `/input/prototype` 临时路由处理计划。
