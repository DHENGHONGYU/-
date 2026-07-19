---
title: 智能投研复盘系统 V9 �?系统架构与设计文�?
type: explanation
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "版本：v1.0 · 日期�?026-07-12 范围：全系统分层架构、核心模块职责、数据流、设计令牌与质量门禁..."
tags: [architecture, plan, design, system]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-032
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 智能投研复盘系统 V9 �?系统架构与设计文�?
> **版本**：v1.0 · **日期**�?026-07-12
> **范围**：全系统分层架构、核心模块职责、数据流、设计令牌与质量门禁
> **配套可视�?*：`docs/architecture/architecture-diagrams.html`（浏览器打开，含分层�?/ 数据流图 / 舱室地图�?
---

## 0. 文档目的

本文档面向后续接入的 AI 智能体与研发人员，说�?V9 系统�?*整体架构**（而非仅驾驶舱 Widget 层，驾驶舱细节见 `architecture.md`）。阅读后应能理解�?
- 系统采用的分层结构与**依赖方向约束**�?- 22 个业务服务子域�?0+ �?Zustand Store、核心数据治理层（`core/`）各自的职责边界�?- 一条数据从「业务服�?�?写入 IndexedDB �?广播 �?视图重渲染」的完整链路�?- 设计令牌体系（L1–L6）与质量门禁（Husky 11 道预提交 + 2 道预推送）�?
---

## 1. 系统概览

| 维度 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript 5.7（strict�?|
| 构建 | Vite 6（`@vitejs/plugin-react`），内置 `mock-trade-api` 中间件模�?`/api/v1/trade/*` |
| 状�?| Zustand（约 50+ store，跨 Tab 广播 `withBroadcast`�?|
| 存储 | IndexedDB（本地自管，�?`dataLayer` 访问，无后端�?|
| 样式 | Tailwind 3 + 设计令牌体系（L1–L6，宋韵美学） |
| 测试 | Vitest 2（单�?集成�? Playwright（E2E�?|
| 路径别名 | `@/*` �?`src/*`（`tsconfig.json` + `vite.config.ts`�?|

### 1.1 五大业务�?
| 舱（cabin�?| 目录 | 核心页面 |
|------------|------|----------|
| 输入�?| `src/pages/input` `src/apps/input` | 采集任务、抓取配置、本地知识、七维配�?|
| 分析�?| `src/pages/analysis` `src/apps/analysis` | 热门板块、行业评分、智能评分、多因子筛选、回�?|
| 交易�?| `src/pages/trading` `src/apps/trading` | 持仓、组合、风控、策略快照、交易流 |
| 输出�?| `src/pages/output` `src/apps/output` | 仪表盘、输出中心、研报、复盘向导、交易复�?|
| 指令�?| `src/pages/command` `src/apps/command` | MCP 看板、智能体看板、系统健康、能力展�?|

渲染链路：`main.tsx �?App.tsx �?portal/PortalShell.tsx �?apps/*/XxxApp（React.lazy）→ pages/*`�?
### 1.2 核心设计原则

1. **分层依赖单向**：`pages/components �?store/services �?core �?data/lib/config`，严禁反向或越层�?2. **无硬编码**：阈�?权重�?`services/scoring/.../config.ts`；颜色走 `constants/theme.tokens.ts`；常数集中在 `constants/`�?3. **统一数据入口**：所有写库必须经 `DataBridge.forward()`；所有读库经 `dataBridge.query()` �?`dataLayer`；视图层禁止直连 `db`�?4. **事件驱动刷新**：写库后�?`EventBus` 广播 `${store}${CHANGED_SUFFIX}`，订阅的 Store 自动更新并触发视图重渲染�?5. **令牌�?UI**：所有颜色引�?L1–L6 令牌，A 股「红涨绿跌」为固定例外，不随主题切换�?
---

## 2. 分层架构与依赖方�?
```
┌──────────────────────────────────────────────────────────────�?�? pages/  +  components/   �?视图层（5 舱页�?+ 原子设计组件库） �?├──────────────────────────────────────────────────────────────�?�? store/        �?状态层（Zustand，withBroadcast �?Tab 广播�? �?�? services/     �?服务层（22 业务子域，经 DataBridge 写数据）   �?├──────────────────────────────────────────────────────────────�?�? core/         �?数据治理层（DataBridge / Envelope / ACL /     �?�?                   MemoryCache / EventBus / 级联与管道编排）    �?├──────────────────────────────────────────────────────────────�?�? data/         �?数据访问层（dataLayer �?IndexedDB�?          �?�? lib/          �?基础设施库（logger/eventBus/format/errors…）  �?�? config/       �?配置层（路由/API/阈�?ACL 矩阵/图表配色�?     �?�? constants/    �?常量与主题令牌（零运行时依赖，被所有层引用�?  �?�? types/        �?纯类型定义（零依赖）                          �?└──────────────────────────────────────────────────────────────�?```

### 2.1 依赖方向规则（权威约束，�?`../../AGENTS.md` §一�?
| �?| 可依�?| 禁止依赖 |
|----|--------|----------|
| `pages/` `components/` | `store/` `services/` | 直接调用 `dataLayer` / `db` |
| `store/` | `services/` `core/` | 直接�?`db`（须�?DataBridge�?|
| `services/` | `core/` `data/` `lib/`（仅基础设施白名单） | 直接�?`db`（经 `DataBridge.forward()`�?|
| `lib/` | `core/` `config/` | `services/` `store/` `pages/` `components/` |
| `core/` | `types/` | `pages/` `components/` `lib/`（业务模块） |
| `config/` | �?| `services/` `pages/` `components/` `lib/` |
| `constants/` `types/` | �?| 任何运行时模�?|

> **门禁**：`npm run audit:layers` 校验跨层调用；`npm run audit:atomic` 校验原子组件层级边界（atom 不引 store/service/molecule，molecule 不引 organism/template/store/service，template 不引 organism/store/service）�?
---

## 3. 核心模块说明

### 3.1 `core/` 数据治理层（系统总线�?
| 文件 | 职责 |
|------|------|
| `databridge.ts`（`forward()` @:363�?| **唯一切面入口**：校验信�?�?ACL 鉴权 �?审计日志 �?路由（DB/Query/Event/Manager/Strategy）→ 广播变更事件 |
| `envelope.ts`（`EnvelopeFactory` @:30�?| **统一消息信封**：`create/validate`，结�?`{meta, payload}`，`meta` �?`source/target/action/traceId` |
| `acl.ts`（`AclEngine` @:58�?| **权限引擎**：基�?`config/dbConfig.ts` �?`ACL_MATRIX`，按 `ModuleId �?store 读写` 白名单鉴权，`assert` 失败�?`AclError` |
| `memoryCache.ts` | **进程内缓�?*：TTL（默�?10s�? LRU（默�?200 条），查询路径降�?IndexedDB 访问 |
| `widgetEventBus.ts` | Widget 级隔离事件总线（事件名 `widget:{id}:{event}`�?|
| `dataflow/` | 数据流引�?`dataflowEngine.ts`、类型、默认构建器 |
| 编排�?| `cascadeExecutor` `pipelineScheduler` `refreshCoordinator` `poolTransitionEngine` `feedbackOrchestrator` `freshnessGuard` `transaction` `validation` |

> **双文件关�?*：`core/databridge.ts`（主实现）经 `../../src/showcase/index.ts`（`DataBridgeAdapter` 适配层）对外暴露 `dataBridge` 单例�?
### 3.2 `data/` 数据访问层（DAL�?
- `dataLayer.ts` 及按域拆分的 `dataLayer*Stores.ts`，直�?IndexedDB（`db`）�?- 仅被 `core/databridge.ts` �?`routeToDB` 调用；`store/` �?`services/` 不得直连�?
### 3.3 `services/` 业务服务子域�?2 个）

| 子域 | 职责 |
|------|------|
| `analysis/` | 分析服务：轮动评分、板块分析引擎、评分文档、筛选引擎、新鲜度守卫（写�?`DataBridge.forward()`�?|
| `data-collector/` | 采集管道：`collectionPipeline` `dataSourceOrchestrator` `MarketDataAdapter` `collectors/{Mock,Rest,WebSocket}` `tracePersistenceService` |
| `scoring/` | 评分服务：行业评分、热门板块分�?编排、因�?|
| `trading/` | 交易服务：双策略引擎、组合、仓位、风险引擎、盈亏计算、评分适配 |
| `fetcher/` | 数据拉取：`fetcherClient`（akshare �?Provider）、`fetcherAdapter`、`fetcherService`（写�?`EnvelopeFactory + dataBridge.forward`�?|
| `llm/` | 大模型：`llmClient`（多模型）、`llmGateway` |
| `news/` | 新闻：新闻服务、情绪分析、情绪趋势、股票关�?|
| `execution/` | 执行：执行计划、执行日�?|
| `collection/` `input/` `stock-analysis/` `stockpool/` `screening/` `portfolio/` `backtest/` `export/` `pwa/` `rbac/` `system/` `trade/` `ai-center/` `hybrid-proofread/` `mcp/` | 各业�?基础设施子域 |
| 平铺服务 | `contracts.ts` `errorBus.ts` `feedbackService.ts` `resilience.ts` `riskControlService.ts` `unifiedStockService.ts` |

**写库规范（Service �?DataBridge�?*�?```ts
// src/services/fetcher/fetcherService.ts:20-29
const envelope = EnvelopeFactory.create(
  { source: MODULE_ID.fetcher, target: ENVELOPE_TARGET.db,
    action: ENVELOPE_ACTION.updateStock, traceId: createTraceId(update.symbol) }, update)
await dataBridge.forward(envelope)
```

### 3.4 `store/` 状态层（Zustand�?
- �?**50+** �?store 模块，命名如 `analysisStore` `tradingStore` `inputHubStore` `outputStore` `commandStore` `portfolioStore` `holdingsStore` `orderStore`�?- 派生/订阅：`.derived.ts`（`analysisStore.derived.ts` `riskStore.derived.ts` …）+ `derived.index.ts`�?- 基础设施：`databridgeStore`（监�?`DATABRIDGE_PENDING_CHANGED`）、`dataflowStore` `widgetStore` `agentStore`（订�?`AGENT_*`）、`workflowStore`（含 `CabinType`）�?- **`withBroadcast`**：`src/store/helpers/withBroadcast.ts`（re-export �?`src/lib/withBroadcast.ts`），封装 `eventBus.emit()`，写操作后主动广�?`EVENT_NAMES.X_CHANGED`�?- 视图层仅通过 `useStore()` / `useMarketData()` 取数，不直接�?`db`�?
### 3.5 `components/` 原子设计组件�?
四层目录（层级边界由 `audit:atomic` 强制）：

| �?| 目录 | 示例 |
|----|------|------|
| atoms | `atoms/` | Button、Card、Badge、Checkbox |
| molecules | `molecules/` | Alert、Dialog、DataState、ErrorState |
| organisms | `organisms/` | 按域 `agent/ analysis/ collection/ input/ localDoc/ news/ output/` |
| templates | `templates/` | CockpitLayout、DashboardLayout、PageContainer、PageHeader、SidebarLayout |
| 专用 | `chart/` `cabin/` `cockpit/` `widgets/` | 图表、评分舱卡片、信号谱、Widget �?|

`componentRegistry.ts` 全量 `active`；`chart/` �?`cockpit/cabin/widgets` �?Widget 注册表耦合不物理搬迁�?
### 3.6 `cockpit/` 驾驶�?Widget 框架

- `CockpitShell.tsx` + `core/{widgetEngine,widgetRegistry}` + `providers/MarketDataProvider` + `widgets/`（A–E �?Widget�? `data/mockDataProvider`�?- 数据流：`MarketDataProvider` �?`useMarketData()` �?Widget；底�?`TaskScheduler` + `Collector`(Mock/Rest/WebSocket) �?`MarketDataAdapter` �?标准 `MarketData`。详�?`architecture.md`�?
### 3.7 `portal/` 入口外壳

- �?`PortalShell.tsx`：侧边栏/路由守卫、`React.lazy` 加载 5 �?`apps/*/XxxApp`、顶�?fetcher 健康、挂�?cockpit 组件�?
### 3.8 `config/` + `constants/` 配置与令�?
- `config/`：路由、API 路径（`marketDataEndpoints.ts` `collectConfig.ts`）、各业务阈值、ACL 矩阵（`dbConfig.ts`）、图表配色（`chartColors.ts`）�?- `constants/theme.tokens.ts` �?拆分�?`constants/theme/*.ts`（base/color/shades/helpers/stock/design），L1–L6 令牌体系（见 §5）�?
### 3.9 `agents/` 智能体运行时

- `agentRegistry` `agentRuntime` `taskQueue` `agentHealthMonitor`：智能体注册/健康/任务队列，订�?`AGENT_*` 事件�?`agentStore` 暴露�?
---

## 4. 核心数据�?
### 4.1 写路径（Write�?
```
Service (e.g. fetcherService)
  �?EnvelopeFactory.create({source, target:'db', action, traceId}, payload)   [core/envelope.ts:49]
  �?dataBridge.forward(envelope)                                              [core/databridge.ts:363]
       �?EnvelopeFactory.validate()                                          [core/envelope.ts]
       �?aclEngine.assert({module, store, operation})                        [core/acl.ts:88]
       �?审计日志 writeAuditLog()
       �?routeToAction �?routeToDB �?dataLayer �?IndexedDB                   [src/data/dataLayer.ts]
       �?eventBus.emit(`${store}${CHANGED_SUFFIX}`, envelope)                [core/databridge.ts:789]
```

### 4.2 �?/ 响应路径（Read / React�?
```
Store 订阅 eventBus 频道 �?set() 更新 Zustand state �?组件 useStore() 重渲�?或直接经 dataBridge.query() / dataLayer �?IndexedDB
```

### 4.3 采集管道数据流（驾驶舱）

```
TaskScheduler �?Collector(Mock/Rest/WebSocket) �?RawMarketData
  �?MarketDataAdapter.adapt() �?Partial<MarketData>
  �?MarketDataProvider.setData() �?useMarketData() �?Widget 重渲�?```

### 4.4 时序图（�?�?广播 �?重渲染）

```mermaid
sequenceDiagram
    autonumber
    participant S as Service
    participant DB as DataBridge
    participant ACL as ACL Engine
    participant DAL as dataLayer
    participant EB as EventBus
    participant ST as Store
    participant V as View

    S->>DB: forward(Envelope)
    DB->>DB: validate(Envelope)
    DB->>ACL: assert(module, store, op)
    ACL-->>DB: ok / AclError
    DB->>DAL: routeToDB() �?write IndexedDB
    DAL-->>DB: done
    DB->>EB: emit(`${store}Changed`, envelope)
    EB->>ST: on(storeChanged)
    ST->>ST: set(state)
    ST->>V: useStore() 重渲�?```

---

## 5. 设计令牌体系（L1–L6�?
| 层级 | 导出 | 用�?| 文件 |
|------|------|------|------|
| **L1** 基础 | `THEME_TOKENS` | 通用语义色、尺寸、间距、圆角、排�?| `theme.tokens.base.ts` |
| **L2** 语义 | `COLOR_TOKENS` + `getColorHex/Tailwind/BgClass` | 涨跌/评分/信号/背景/文字/边框 | `theme.tokens.color.ts` |
| **L3** 色阶 | `COLOR_SHADES` + `twText/twBg/twBorder` | 特定色阶 + Tailwind 辅助 | `theme.tokens.shades.ts` |
| L3/L4 辅助 | `DARK/HOVER/FOCUS/FILL/GRADIENT/CHART_PALETTE/SPACING` | 交互�?图表调色�?| `theme.tokens.helpers.ts` |
| **L5** 股票 | `STOCK_COLOR_TOKENS` + `getStockColor*` | 红涨绿跌固定例外（不随主题） | `theme.tokens.stock.ts` |
| **L6** 设计 | `SEMANTIC_COLOR_ROLES` + `TYPOGRAPHY_SCALE` + `ELEVATION` + `LAYOUT_TOKENS` | 语义角色/排版/层级/布局 | `theme.tokens.design.ts` |

- 图表配色 `src/config/chartColors.ts`�?98 行）全部引用 `COLOR_TOKENS.hex`，关键导出：`PIE_CHART_PALETTE` `ROTATION_FACTOR_COLORS` `MARKET_STYLE_COLORS` `SIGNAL_GRADE_COLORS` `SCORE_BUCKET_COLORS`�?- **约束**：UI 层颜色必须走令牌；A 股涨跌色固定；`lint:colors` + `audit:tokens` + `verify:tokens` 三道门禁校验�?
---

## 6. 质量保障体系（门禁）

**Husky `pre-commit`�?1 道，全过才提交）**�?`lint-staged` �?`lint:colors` �?`tsc:prod` �?`audit:layers` �?`audit:atomic` �?`file:check` �?`audit:docs` �?`verify:tokens` �?`audit:tokens` �?`audit:jsdoc` �?`audit:complexity`

**Husky `pre-push`�? 道）**：`test:clean`（核心单测）�?`build`（生产构建）

**其它权威脚本**：`audit:hardcode` `audit:deadcode` `audit:semantic` `audit:routes` `audit:mcp` `audit:token` `audit:tests` `audit:reserved-stores` `audit:mapping-integrity` `audit:execution-paths` `audit:split-quality` `audit:typography`�?
> 当前基线（见 `public/health-report.json`）：综合得分 93；跨层调�?0、颜色硬编码 0、深层嵌�?0、长�?0、重复条�?0、JSDoc 缺失 0、文档同�?0（已全归零）�?
---

## 7. 关键契约与约�?
1. **视图层不直接写库**：所有写�?`dataBridge.forward()`；所有读�?`dataBridge.query()` / `dataLayer`�?2. **常量集中**：禁止在组件硬编码颜�?维度�?模型版本/端点路径；端点集中在 `config/marketDataEndpoints.ts` `config/collectConfig.ts`�?3. **Adapter 兜底**：`MarketDataAdapter` 字段缺失必须返回合法默认值，避免组件崩溃�?4. **事件清理**：`useEffect` �?`EventBus.subscribe` 必须配对 `unsubscribe`；`useEffect` �?`addEventListener` 必须 `removeEventListener`（见 `../../AGENTS.md` §三模板）�?5. **类型安全**：禁�?`any` / `@ts-ignore`（用 `@ts-expect-error` + 注释）；新增公共函数/组件/Hook/Store 须补 JSDoc（`../reference/jsdoc-convention.md`）�?6. **AI 行为契约**：`../../AGENTS.md` �?AI 生成代码的强制约束；迁移/新增 Widget/记忆检索需加载 `prompts/` 模板�?`docs/` 检查清单�?
---

## 8. 目录结构速查

```
src/
├── apps/          5 舱应用级聚合入口（React.lazy�?├── portal/        PortalShell.tsx 入口外壳
├── pages/         input / analysis / trading / output / command 五舱页面
├── components/    atoms molecules organisms templates chart cabin cockpit widgets
├── cockpit/       CockpitShell + core + providers + widgets（驾驶舱框架�?├── services/      22 业务子域 + 平铺服务
├── store/         ~50+ Zustand store + helpers(withBroadcast/withOptimisticUpdate)
├── core/          databridge / envelope / acl / memoryCache / widgetEventBus / dataflow / 编排�?├── data/          dataLayer �?IndexedDB
├── lib/           eventBus / withBroadcast / logger / format / errors / utils / perf
├── config/        路由/API/阈�?ACL矩阵/图表配色
├── constants/     theme.tokens.ts �?theme/*.ts（L1–L6�?├── types/         纯类型定�?├── agents/        智能体运行时
├── hooks/ schemas/ blueprints/ devtools/ fixtures/ generated/ i18n/ mcp/ showcase/ utils/
└── main.tsx App.tsx index.css
```

---

> **附录**：本文件�?`architecture.md`（驾驶舱 Widget 专项）、`../../AGENTS.md`（AI 行为契约）、`../reference/design-token-mapping.md`（令牌映射）互为补充。架构图可见 `docs/architecture/architecture-diagrams.html`�?