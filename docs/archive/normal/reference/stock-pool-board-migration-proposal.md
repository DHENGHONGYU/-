---
title: "股票池看板迁移至分析舱 — 可行性方案论证"
domain: ref
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 股票池看板迁移至分析舱 — 可行性方案论证

> 版本：v1.0 | 日期：2026-07-09 | 状态：待决策

---

## 一、背景与目标

将原“输入舱”中的“股票池看板”模块迁移到“分析舱”，并为其新增：
1. **独立页面路由** `/analysis/stock-pool`，可独立访问。
2. **数据采集进度展示**：按数据类型展示实时进度条与状态。
3. **采集情况汇报面板**：结构化汇总采集结果、时间范围、失败记录等。

同时需对原输入舱入口做合理处理（跳转或移除），并保持与分析舱现有架构一致。

---

## 二、现状梳理

| 模块 | 当前位置 | 职责 | 与本任务关系 |
|---|---|---|---|
| `InputDashboard` | `src/apps/input/InputDashboard.tsx` | 输入舱首页，包含统计卡片区、候选股票录入区、股票池看板区 | 看板代码位于文件底部（约 100 行），需整体迁出 |
| `PoolBoard` | `src/components/organisms/pool/PoolBoard.tsx` | 纯展示组件，支持看板/列表视图、按研究状态分池 | 可直接复用，迁移成本低 |
| `AnalysisApp` | `src/apps/analysis/AnalysisApp.tsx` | 分析舱子路由分发（使用 `useLocation` + 条件渲染） | 需新增 `/analysis/stock-pool` 分支 |
| `ROUTE_REGISTRY` | `src/config/routes.ts` | 项目路由唯一真相源 | 需注册新路由 |
| `PortalShell` | `src/portal/PortalShell.tsx` | 顶栏 + 侧边栏导航 | 需在分析舱菜单新增“股票池看板”，并处理输入舱原入口 |
| `collectionRuntimeStore` | `src/store/collectionRuntimeStore.ts` | 采集运行时状态（traceSpans / taskStatuses / logs / stats） | 进度与汇报面板的数据源 |
| `collectConfig` | `src/config/collectConfig.ts` | 8 个采集维度（01~08）的元数据与名称 | 用于将维度 code 映射为业务类型名称 |
| `poolStore` | `src/store/poolStore.test.ts` | 股票池数据与分组 | 新页面仍需消费 |

---

## 三、复杂度评估

**综合复杂度：中到高（3.5/5）**。原因：

1. **页面迁移本身并不复杂**：`PoolBoard` 已是独立组件，抽出看板状态逻辑到新页面即可。
2. **新增进度/汇报面板需要状态聚合**：`collectionRuntimeStore` 以 `taskId` / `traceId` 为键，需要按维度 code 聚合出“进度百分比 + 状态 + 失败记录 + 时间范围”。
3. **跨舱室交互与导航调整**：涉及 `PortalShell` 菜单、`InputDashboard` 入口裁剪、`ROUTE_REGISTRY`、`AnalysisApp` 四处的联动修改。
4. **质量门禁与文档同步**：新增页面必须同步 `../explanation/06-routing-specs.md`、通过 `audit:layers`、`audit:routes`、`lint:colors`、`tsc:prod` 等。

---

## 四、影响面与交叉比对

### 4.1 对输入舱的影响

- `InputDashboard` 将从“录入 + 看板”混合页变为纯“录入 + 统计”页。
- 需移除或替换原股票池看板 Card，否则会出现两处入口的歧义。
- 输入舱顶部副标题 `股票录入 · 批量导入 · 热门板块 · 采集测试` 可保持不变，或改为 `股票录入 · 批量导入 · 热门板块 · 采集测试 · 股票池看板（已迁移）`。
- **风险**：若用户习惯从输入舱直接操作看板，迁移后需通过显式跳转降低认知成本。

### 4.2 对分析舱架构的影响

- 分析舱当前以“评分/筛选/回测”为核心，迁入股票池看板后，职责从“分析结果展示”扩展到“标的池管理”。
- 这与“分析舱负责研究标的”的产品定位一致，不会破坏分层。
- 新页面应遵循 `pages/` → `store/` / `services/` 的依赖方向，禁止直接访问 `dataLayer`。

### 4.3 对路由与导航的影响

- `ROUTE_REGISTRY` 新增 `/analysis/stock-pool`。
- `AnalysisApp` 的 `useLocation` 条件分支新增一条。
- `PortalShell` 的 `PANEL_ITEMS.analysis` 新增“股票池看板”菜单；`PANEL_ITEMS.input` 需移除或重定向原入口。
- `RouteGuard` 自动识别 `category: 'analysis'`，无需额外权限改动。

### 4.4 对数据采集状态的影响

- 进度展示将直接消费 `collectionRuntimeStore.taskStatuses`。
- 汇报面板将聚合 `traceSpans` + `logs`，不新增持久化状态。
- 当前 `collectionPipeline` 仅对 `01`（基本信息/行情）和 `02`（K线）维度有真实采集链路；`03~08` 会走 `unsupported` 分支并标记为失败。汇报面板需要识别这种“未支持”状态并显示为“待接入”，避免用户误以为采集异常。

### 4.5 对质量门禁的影响

- `audit:layers`：新增页面仅依赖 `store/`、`services/`、`components/`，符合分层。
- `audit:routes`：新增路由 + PortalShell 菜单项需同步，否则会产生“菜单有但路由未注册”或反之的孤儿项。
- `audit:hardcode`：颜色需继续走 `COLOR_TOKENS` / `THEME_TOKENS`。
- `lint:colors`：新组件不得出现裸 HEX / Tailwind 颜色类。
- `tsc:prod` + 测试：新增类型与组件需要类型安全。

---

## 五、可行方案对比

### 方案 A：迁移到分析舱独立页面 + 扩展进度/汇报（推荐）

- 新建 `src/pages/analysis/StockPoolBoardPage.tsx`。
- `InputDashboard` 移除股票池看板 Card，替换为跳转提示卡片。
- `AnalysisApp` / `routes.ts` / `PortalShell` 注册 `/analysis/stock-pool`。
- 在看板中新增 `CollectionProgressPanel` 与 `CollectionReportPanel`。

**优点**：
- 职责清晰，输入舱专注“录入”，分析舱承接“池管理 + 采集监控”。
- 不引入双入口，避免数据状态同步问题。
- 复用现有 `PoolBoard` 与 `collectionRuntimeStore`，改动可控。

**缺点**：
- 用户需要适应新入口；需保留一段时间的跳转提示。

### 方案 B：保留输入舱看板 + 分析舱新建只读/镜像看板

- 输入舱保留原看板。
- 分析舱新建 `/analysis/stock-pool` 作为“增强版看板”，新增进度/汇报。

**优点**：
- 对老用户零打扰。

**缺点**：
- 双入口维护成本高，容易产生状态不一致。
- 违背“迁移”诉求，输入舱职责仍然混杂。
- 两个页面若行为不同，会增加测试与文档负担。

### 方案 C：直接抽取为驾驶舱 Widget

- 将股票池看板改造为 `cockpit/widgets/StockPoolBoardWidget.tsx`。

**缺点**：
- 用户明确要求“分析舱下创建独立页面路由”，驾驶舱 Widget 不满足需求。
- 仅建议作为后续可选增强，而非本次主方案。

---

## 六、推荐方案详细设计

### 6.1 路由与导航

```text
/analysis/stock-pool  → StockPoolBoardPage
```

- `routes.ts` 注册：`path: '/analysis/stock-pool'`, `category: 'analysis'`。
- `AnalysisApp.tsx` 在 `useLocation` 分支中新增：
  - `path === '/analysis/stock-pool'` → `<StockPoolBoardPage />`
- `PortalShell.tsx` 分析舱菜单新增：
  - `{ key: 'stock-pool', label: '股票池看板', path: '/analysis/stock-pool', icon: LayoutDashboard }`
- 输入舱菜单调整：
  - 移除或注释原“录入看板”中的股票池看板入口；或在“候选池”分组新增“股票池看板（已迁往分析舱）”跳转项。

### 6.2 页面组件结构

```
StockPoolBoardPage
├── PageHeader（标题 + 返回/跳转入口）
├── PoolBoard 控制栏（视图切换 / 分组筛选 / 新建分组 / 质量筛选 / 批量操作）
├── PoolBoard（原组件复用）
└── 新建分组 Dialog
```

> **后续调整**：`CollectionProgressPanel` 与 `CollectionReportPanel` 原设计在股票池看板顶部/底部，后按“采集展示归采集舱”原则迁移至 `/input/collect-tasks` 的“进度汇报” Tab。

### 6.3 状态与数据流

- **股票池数据**：`usePoolStore()` + `refresh()`。
- **分组选项**：`getAllGroups()`。
- **采集运行时**：`useCollectionRuntimeStore()`（在 `CollectTaskPage` 中消费）。
- **维度元数据**：`DEFAULT_DIMENSIONS`（来自 `collectConfig`）。
- **聚合服务**：`collectionReportService.ts`，输出：
  - `progressItems: Array<{ code, name, status, progress, total, success, failed }>`
  - `reportItems: Array<{ code, name, collectedCount, timeRange, lastCollectedAt, failures }>`

### 6.4 维度 → 业务类型映射

当前 `01`/`02` 有真实链路，`03~08` 在 `collectionPipeline` 中标记为 `unsupported`。汇报面板策略：

| 维度 | 业务类型 | 真实进度来源 | 展示策略 |
|---|---|---|---|
| 01 | 基本信息/行情 | `taskStatuses` / `traceSpans` | 真实进度 |
| 02 | K 线/行情数据 | `taskStatuses` / `traceSpans` | 真实进度 |
| 03~08 | 筹码/重大事项/热点新闻/行业竞品/关联指数/研报 | 暂无真实链路 | 显示“待接入”占位，避免误报异常 |

### 6.5 输入舱入口处理

在 `InputDashboard` 原股票池看板位置，替换为一个提示卡片：

```
股票池看板已迁移至「分析舱」
[前往分析舱股票池看板]
```

保留按钮可导航至 `/analysis/stock-pool`，降低用户寻找成本。

---

## 七、新增/修改文件清单

### 新增文件

1. `src/pages/analysis/StockPoolBoardPage.tsx` — 迁移后的独立页面。
2. `src/components/organisms/collection/CollectionProgressPanel.tsx` — 进度展示（后迁移至采集任务页）。
3. `src/components/organisms/collection/CollectionReportPanel.tsx` — 汇报面板（后迁移至采集任务页）。
4. `src/services/data-collector/collectionReportService.ts` — 聚合计算服务（保持 UI 薄）。
5. `src/hooks/useStockPoolBoard.ts` — 股票池看板逻辑 Hook。

### 修改文件

1. `src/apps/input/InputDashboard.tsx` — 移除/替换股票池看板区。
2. `src/apps/analysis/AnalysisApp.tsx` — 新增 `/analysis/stock-pool` 分支。
3. `src/config/routes.ts` — 注册新路由。
4. `src/portal/PortalShell.tsx` — 调整分析舱与输入舱菜单。
5. `../explanation/06-routing-specs.md` — 同步路由说明。

---

## 八、实施步骤与顺序

1. **类型与服务层**：在 `services/data-collector/` 新增 `collectionReportService.ts`，定义 `CollectionProgressItem` / `CollectionReportItem` 类型与聚合逻辑。
2. **UI 组件层**：新增 `CollectionProgressPanel` 与 `CollectionReportPanel`，颜色走令牌系统；组件置于 `src/components/collection/`。
3. **页面层**：新建 `StockPoolBoardPage.tsx` 复用 `PoolBoard`；在 `CollectTaskPage.tsx`（`/input/collect-tasks`）接入上述面板。
4. **路由层**：修改 `routes.ts`、`AnalysisApp.tsx`、`PortalShell.tsx`；输入舱左侧菜单增加“采集任务监控”。
5. **输入舱处理**：调整 `InputDashboard` 看板区为跳转提示。
6. **文档同步**：更新 `../explanation/06-routing-specs.md`。
7. **门禁验证**：运行 `npm run audit`、`tsc:prod`、`lint:colors`。

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 用户找不到股票池看板入口 | 体验 | 输入舱保留跳转提示；PortalShell 菜单高亮 |
| `03~08` 维度无真实采集链路，面板显示全失败 | 误解 | 对 `unsupported` 维度显示“待接入”而非“异常” |
| 进度条依赖 `taskStatuses`，无任务时全部空白 | 体验 | 无任务时显示“暂无采集任务”，并提供手动触发入口 |
| 新增路由未同步到 `RouteGuard` 白名单 | 访问 404 | 注册 `ROUTE_REGISTRY` 后白名单自动生成 |
| `audit:layers` 检测到 UI 跨层调用 | 阻塞 | 新增页面仅通过 store/service 获取数据，不直接访问 `dataLayer` |
| 颜色硬编码导致 `lint:colors` 失败 | 阻塞 | 统一使用 `COLOR_TOKENS` / `THEME_TOKENS`；UI 颜色类改用 CSS 变量语义类（如 `text-foreground`、`bg-muted`、`border-border`），`twText` / `twBg` 已于 2026-08-13 全面废弃 |

---

## 十、质量门禁计划

执行以下命令并确保通过：

```bash
# 系统 Node 24，关闭沙箱运行
npm run audit
npm run tsc:prod
npm run lint:colors
```

重点关注：
- `audit:routes`：新路由与 PortalShell 菜单一致性。
- `audit:layers`：无跨层调用。
- `audit:hardcode`：无新增颜色硬编码、无新增魔法数字。
- `audit:tokens`：无新增裸颜色字面量。
- `tsc:prod`：类型无报错。

---

## 十一、决策点

请确认以下事项后，再进入实施：

1. **是否采用推荐方案 A**（迁移到分析舱独立页面，输入舱仅保留跳转提示）？
2. **进度/汇报面板的维度粒度**：按当前 8 个采集维度展示，还是合并为“行情 / 财务 / 新闻”等 fewer 业务类型？
3. **输入舱跳转提示**：保留“股票池看板已迁移”卡片，还是直接在“候选池”菜单新增跳转项即可？
4. **是否需要同步更新 `../explanation/06-routing-specs.md`**（推荐同步，否则 `audit:docs` 可能告警）？

---

## 十二、结论

推荐按 **方案 A** 实施。该方案职责清晰、可复用现有基础设施、不引入双入口，且能在保持现有质量门禁基线的前提下完成迁移与扩展。复杂度可控，主要风险集中在维度“待接入”状态展示和入口提示上，已有明确缓解措施。
