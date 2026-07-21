---
title: core-data-strategy-report
code_version: 2.0.0

tier: reference
---

---
title: docs/explanation/core-data-strategy-report.md
code_version: 2.0.0
tier: reference
---

# V9 智能投研复盘系统 — 核心数据策略报告

> **文档体系版本**: v2.0.0 | **本文档修订**: rev.1 | **兼容 AGENTS.md v1.4.6+
> **生成日期**: 2026-07-13 | **校验基准**: `src/config/dbConfig.ts` (DB_VERSION = 28)、`src/data/db-schema.ts`、`src/core/databridge.ts`、`src/data/types.ts`
> **文档性质**: 策略对齐报告，覆盖重新调整后的数据架构、数据库定义、数据传递机制，并与现有开发蓝图逐项校对。

---

## 目录

1. [文档范围与真相源](#一文档范围与真相源)
2. [数据架构全景图](#二数据架构全景图)
3. [数据库定义规范](#三数据库定义规范)
4. [数据传递路径与交互协议](#四数据传递路径与交互协议)
5. [与现有开发蓝图校对](#五与现有开发蓝图校对)
6. [术语表](#六术语表)
7. [附录：验证命令与参考文档](#七附录验证命令与参考文档)

---

## 一、文档范围与真相源

### 1.1 范围

本报告基于当前实际代码与近期架构调整，重新定义 V9 项目的核心数据策略，具体包括：

- **数据架构全景图**：五层架构、层级职责、实体关系（ER）、数据流向。
- **数据库定义规范**：IndexedDB `V6ProDB` 的 40 个 ObjectStore、主键、索引、字段类型、约束条件及版本迁移策略。
- **数据传递机制**：`DataBridge` + `StandardEnvelope` + `ACL` 的读写协议、`EnvelopeAction` 路由、订阅广播机制。
- **蓝图校对**：与 `../reference/v9-system-blueprint.md`、`../reference/v9-indexeddb-store-schema.md`、`../reference/data-flow-spec.md`、`../reference/../reference/../reference/v9核心数据字典与类型定义(整合版).md` 逐项比对，标注一致项、偏差项及修正建议。

### 1.2 真相源文件

| 真相源 | 路径 | 作用 |
|--------|------|------|
| 架构契约 | `../../AGENTS.md` | 项目分层规则、目录职责、验证命令、Gateway 写入权限规范 |
| 数据库配置 | `src/config/dbConfig.ts` | `DB_VERSION`、`STORE_NAME`、`ENVELOPE_ACTION`、`ENVELOPE_TARGET`、`MODULE_ID`、`ACL_MATRIX` |
| Schema 定义 | `src/data/db-schema.ts` | 基线 ObjectStore 创建逻辑、索引、字段回填 |
| 迁移框架 | `src/data/db-migrations.ts` | 版本升级迁移逻辑、RBAC 6 表创建 |
| 数据桥接 | `src/core/databridge.ts` | `forward()`、`query()`、`subscribe()`、路由、缓存、审计 |
| 信封协议 | `src/core/envelope.ts` | `StandardEnvelope`、`EnvelopeMeta`、`EnvelopeFactory` |
| 处理器注册 | `src/core/databridgeHandlers.ts` | 按 `EnvelopeAction` 路由到具体 DB 操作 |
| 类型定义 | `src/data/types.ts` | 全部业务实体 TypeScript 类型 |
| 股票池常量 | `src/constants/pool.constants.ts` | `RESEARCH_STATUS`、`DEFAULT_POOL_GROUP` |
| 股票池 Store | `src/data/dataLayerStockStores.ts` | `stocks` 表的 CRUD 与索引查询 |

### 1.3 版本基线

- **AGENTS.md**: v1.4.6（含 Gateway 层写入权限规范 §八 / §十四 MCP 权限 / §十五 本地优先部署原则）
- **DB_VERSION**: 28
- **STORE_NAME 数量**: 40（34 个基线 + 6 个 RBAC 迁移）
- **ENVELOPE_ACTION 数量**: 62

---

## 二、数据架构全景图

### 2.1 五层架构

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ L5 展示层 (Presentation)                                                    │
│ src/pages/  src/components/  src/portal/  src/cockpit/                      │
│ • 页面、组件、驾驶舱 Widget、用户交互                                        │
│ • 只允许依赖 store/ 和 services/，禁止直接调用 dataLayer 或 db              │
├─────────────────────────────────────────────────────────────────────────────┤
│ L4 应用层 (Application)                                                     │
│ src/apps/                                                                   │
│ • 五舱 App 分发器（input / analysis / trading / output / command）          │
│ • React.lazy 加载，桥接页面与业务服务                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ L3 引擎层 (Domain Engine)                                                   │
│ src/services/  src/agents/                                                  │
│ • 评分、采集、交易、信号、策略、输入等 20+ 子域服务                          │
│ • 所有写入必须封装为 StandardEnvelope，通过 DataBridge.forward() 发起        │
├─────────────────────────────────────────────────────────────────────────────┤
│ L2 数据层 (Data)                                                            │
│ src/data/                                                                   │
│ • IndexedDB 封装、dataLayer、queryBuilder、types/gateway                     │
│ • data/gateway/ 是唯一允许直接操作 dataLayer 与 db 的入口（AGENTS.md §八）  │
├─────────────────────────────────────────────────────────────────────────────┤
│ L1 基础设施层 (Infrastructure)                                              │
│ src/core/  src/lib/  src/config/  src/constants/                            │
│ • DataBridge、ACL、Envelope、EventBus、MemoryCache、Logger、路由、常量       │
│ • 配置层禁止依赖业务模块；常量层承载业务语义常量                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 层级职责与依赖方向

| 层级 | 目录 | 职责 | 可依赖 | 可被依赖 |
|------|------|------|--------|----------|
| L5 展示 | `pages/`, `components/`, `portal/`, `cockpit/` | UI 渲染、Widget、用户交互 | `store/`, `services/`, `hooks/`, `lib/` | `apps/`, `portal/` |
| L4 应用 | `apps/` | 五舱 App 分发器 | `pages/`, `components/`, `store/`, `services/` | `portal/` |
| L3 引擎 | `services/`, `agents/` | 业务计算、数据采集、评分、交易、信号 | `core/`, `data/`, `lib/` 基础设施 | `store/`, `apps/`, `pages/` |
| L2 数据 | `data/` | IndexedDB 封装、dataLayer、迁移、类型 | `core/`, `lib/` | `services/`（经 Gateway）、`core/`（经 Gateway） |
| L1 基础 | `core/`, `lib/`, `config/`, `constants/` | DataBridge、ACL、Envelope、EventBus、Logger、配置、常量 | `core/` 内部、`config/` | 所有层 |

**核心依赖规则**：

1. 上层可调用下层，禁止反向依赖。
2. `pages/components` 禁止直接调用 `dataLayer` 或 `db`，必须通过 `Store` 或 `Service`。
3. `store/` 只能依赖 `services/` 和 `core/`。
4. `services/` 只能依赖 `core/`、`data/`、`lib/` 基础设施；所有写入必须封装为 `StandardEnvelope` 并通过 `DataBridge.forward()` 发起。
5. `data/gateway/` 是唯一允许直接操作 `dataLayer` 与 `db` 的入口。
6. `config/` 禁止依赖 `services/`、`pages/`、`components/`、`lib/`。
7. `constants/` 承载业务语义常量（如 `RESEARCH_STATUS`），可被所有层引用。

### 2.3 实体关系图（ER）

`Stock`（股票池主表）是整个数据架构的核心枢纽：

```text
                           ┌─────────────┐
                           │   stocks    │
                           │  (symbol PK)│
                           └──────┬──────┘
      ┌──────────────┬───────────┼───────────┬──────────────┐
      ▼              ▼           ▼           ▼              ▼
┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
│daily_quotes│  │v6_scores │ │hot_sector│ │value_pit │  │financial_│
│  (1:1)   │  │  (1:1)   │ │_scores   │ │_scores   │  │ reports  │
└──────────┘  └──────────┘ └────┬─────┘ └────┬─────┘  └──────────┘
                                │            │
                                ▼            ▼
                         ┌──────────┐  ┌──────────┐
                         │  signals │  │  orders  │
                         │  (1:N)   │  │  (1:N)   │
                         └────┬─────┘  └────┬─────┘
                              │             │
                              ▼             ▼
                       ┌──────────┐  ┌──────────┐
                       │execution_│  │ portfolio│
                       │  plans   │  │ (推导)   │
                       └──────────┘  └──────────┘

 stocks ──N:M── news_articles (via news_stock_map)
 stocks ──1:N── local_docs / score_docs / intelligent_scores
 industry_scores ──1:N── stocks (via industryCode)
```

### 2.4 核心实体关系表

| 主体实体 | 关系 | 客体实体 | 关联字段 | 说明 |
|---|---|---|---|---|
| `Stock` | 1:1 | `DailyQuotes` | `symbol` | 一只股票对应一条最新行情记录 |
| `Stock` | 1:1 | `V6Score` | `symbol` | 一只股票对应一条最新综合评分 |
| `Stock` | 1:1 | `HotSectorScore` | `symbol` | 双策略热门评分 |
| `Stock` | 1:1 | `ValuePitScore` | `symbol` | 双策略洼地评分 |
| `Stock` | 1:1 | `FinancialReport` | `symbol` | 财报数据 |
| `Stock` | 1:N | `IntelligentScore` | `symbol` | 历史智能评分 |
| `Stock` | 1:N | `Order` | `symbol` | 交易订单 |
| `Stock` | 1:N | `Signal` | `symbol` | 交易信号 |
| `Stock` | 1:N | `LocalDoc` | `symbol` | 本地文档 |
| `Stock` | 1:N | `ScoreDocVersion` | `symbol` | 评分文档版本 |
| `Stock` | 1:N | `MissingReport` | `symbol` | 缺失报告 |
| `IndustryScore` | 1:N | `Stock` | `industryCode` | 行业包含多只股票 |
| `NewsArticle` | N:M | `Stock` | `news_stock_map` | 文章与股票多对多关联 |
| `NewsArticle` | 1:1 | `SentimentCache` | `hash` / `contentHash` | 情绪缓存 |
| `Signal` | 1:N | `ExecutionPlan` | `signalId` | 信号派生执行计划 |
| `ExecutionPlan` | 1:N | `ExecutionLog` | `planId` | 计划对应多条日志 |
| `Portfolio` | N:M | `Stock` | `holdings.symbol` | 投资组合持仓 |

### 2.5 数据流向

```text
外部数据源 / 用户输入
        │
        ▼
┌──────────────────┐
│ fetcherService   │  ──StandardEnvelope──►  DataBridge.forward()
│ inputService     │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│ DataBridge       │  ACL 校验 → 路由 → data/gateway/ → IndexedDB
│ (core/databridge)│
└──────────────────┘
        │
        ▼
┌──────────────────┐
│ analyzer /       │  ◄────EventBus / DataBridge.subscribe()────┐
│ strategy /       │                                          │
│ trading services │                                          │
└──────────────────┘                                          │
        │                                                      │
        ▼                                                      │
┌──────────────────┐                                          │
│ Zustand Store    │  ◄──────────stocks:changed───────────────┘
│ (poolStore /     │
│  signalStore 等) │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│ React Components │
│ Pages / Cockpit  │
└──────────────────┘
```

### 2.6 标准数据管线时序

| 阶段 | 触发条件 | 输入 | 输出 Store | 关键字段 | 负责模块 |
|---|---|---|---|---|---|
| P1 采集 | 手动/定时/事件 | 外部 API / 用户输入 | `stocks`, `daily_quotes`, `financial_reports` | `ingestedAt`, `updatedAt` | `fetcherService`, `inputService` |
| P2 评分 | 数据就绪/用户触发 | `stocks` + `daily_quotes` | `v6_scores` | `calculatedAt` | `v6ScoreService` |
| P3 策略 | 评分完成后 | `v6_scores` + `daily_quotes` | `hot_sector_scores`, `value_pit_scores` | `calculatedAt` | `hotSectorAnalyzer`, `valuePitAnalyzer` |
| P4 轮动 | 策略评分后/定时 | `value_pit_scores` + sector 数据 | `rotation_scores` | `scoreDate`, `createdAt` | `rotationScoreService` |
| P5 信号 | 策略评分后 | `stocks` + `daily_quotes` + scores | `signals` | `createdAt` | `signalGenerator` |
| P6 交易 | 信号/用户决策 | `stocks` + `signals` | `orders`, `execution_plans`, `execution_logs` | `createdAt` | `tradingService`, `riskEngine` |
| P7 复盘 | 收盘后/手动 | `orders` + `daily_quotes` | `trade_reviews` | `generatedAt` | `tradeReviewAI` |
| P8 资讯 | 定时/事件 | 外部资讯源 | `news`, `news_stock_map`, `sentiment_cache` | `publishTime`, `analyzedAt` | `newsService` |
| P9 智能评分 | 用户触发 | `stocks` + `local_docs` | `intelligent_scores` | `scoredAt` | `intelligentScoreService` |
| P10 行业评分 | 用户触发 | sector 数据 | `industry_scores` | `scoredAt` | `industryScoreService` |
| P11 工作流 | 事件/定时触发 | 各类业务事件 | `workflow_defs`, `workflow_schedules`, `workflow_triggers`, `workflow_runs` | `updatedAt`, `createdAt` | `WorkflowServer` |

---

## 三、数据库定义规范

### 3.1 基础配置

| 配置项 | 值 | 说明 | 来源 |
|---|---|---|---|
| 数据库名 | `V6ProDB` | 生产环境默认名；测试环境可被 `TEST_DB_NAME` 覆盖 | `src/config/dbConfig.ts:2` |
| 当前版本 | `DB_VERSION = 28` | IndexedDB schema 版本号 | `src/config/dbConfig.ts:3` |
| 连接管理 | `V6Database` 单例 | 封装 `indexedDB.open`，处理版本冲突与缓存复用 | `src/data/db.ts:22` |
| 连接打开 | `openDB()` | 处理 `VersionError` 重试与 `blocked` 事件 | `src/data/db-connection.ts:72` |

### 3.2 DB_VERSION 升级历史

| 版本 | 变更内容 | 文件 |
|---|---|---|
| v3 → v4 | 新增 `daily_quotes` | `src/config/dbConfig.ts` |
| v4 → v5 | `stocks` 新增 `group` 字段与 `by-group` 索引 | `src/data/db-schema.ts` |
| v5 → v6 | 新增 `rotation_scores`, `sector_scores`, `score_docs`, `strategy_snapshots`, `local_docs`, `news`, `news_stock_map`, `sentiment_cache` | `src/data/db-schema.ts` |
| v6 → v12 | V9 架构升级，统一数据模型与索引结构 | `src/data/db-schema.ts` |
| v12 → v13 | 新增 `news_bookmarks` | `src/data/db-schema.ts` |
| v13 → v14 | 新增 `hot_sector_scores`, `value_pit_scores` | `src/data/db-schema.ts` |
| v14 → v15 | 新增 `execution_logs`, `missing_reports` | `src/data/db-schema.ts` |
| v15 → v16 | 新增 `execution_plans`, `portfolios` | `src/data/db-schema.ts` |
| v16 → v17 | 新增 `trade_reviews` | `src/data/db-schema.ts` |
| v17 → v22 | 新增 `financial_reports` | `src/data/db-schema.ts` |
| v22 → v23 | 新增 `schema_migrations`（迁移追踪） | `src/data/db-schema.ts` |
| v23 → v24 | 新增 RBAC 6 表 | `src/data/migrations/rbacMigrationV24.ts` |
| v24 → v25 | 新增 `collect_config` | `src/data/db-schema.ts` |
| v25 → v26 | 新增 `custom_agents` | `src/data/db-schema.ts` |
| v26 → v27 | 新增 `trace_records` | `src/data/db-schema.ts` |
| v27 → v28 | 新增 `workflow_defs`, `workflow_schedules`, `workflow_triggers`, `workflow_runs` | `src/data/db-schema.ts` |

### 3.3 ObjectStore 清单

当前共 **40 个 ObjectStore**：34 个基线 Store 由 `createSchema()` 创建，6 个 RBAC Store 由 `rbacMigrationV24` 迁移创建。

#### 3.3.1 基线 Store（createSchema 创建，34 个）

| # | Store | 主键 | 自增 | 索引 | 对应实体 |
|---|-------|------|------|------|----------|
| 1 | `stocks` | `symbol` | 否 | `by-status`, `by-group` | `Stock` |
| 2 | `v6_scores` | `symbol` | 否 | — | `V6Score` |
| 3 | `intelligent_scores` | `id` | 是 | `by-symbol` | `IntelligentScore` |
| 4 | `industry_scores` | `id` | 是 | `by-code` | `IndustryScore` |
| 5 | `orders` | `id` | 否 | — | `Order` |
| 6 | `watchlists` | `id` | 否 | — | `Watchlist` |
| 7 | `signals` | `id` | 否 | — | `Signal` |
| 8 | `research_logs` | `id` | 是 | — | `ResearchLog` |
| 9 | `daily_quotes` | `symbol` | 否 | — | `DailyQuotes` |
| 10 | `rotation_scores` | `id` | 否 | `by-sector-date`(唯一), `by-sector`, `by-total`, `by-resonance` | `RotationSectorScore` |
| 11 | `sector_scores` | `id` | 否 | `by-sector`, `by-composite`, `by-is-core` | `SectorScoreRecord` |
| 12 | `score_docs` | `docId` | 否 | `by-symbol`, `by-symbol-version`(唯一), `by-composite` | `ScoreDocVersion` |
| 13 | `strategy_snapshots` | `id` | 否 | `by-version`(唯一), `by-date`, `by-timestamp` | `StrategySnapshot` |
| 14 | `local_docs` | `id` | 否 | `by-symbol`, `by-category`, `by-added-at` | `LocalDoc` |
| 15 | `news` | `id` | 否 | `by-source`, `by-category`, `by-publish-time`, `by-hash`(唯一) | `NewsArticle` |
| 16 | `news_stock_map` | `id` | 否 | `by-symbol`, `by-news` | `NewsStockMap` |
| 17 | `sentiment_cache` | `id` | 否 | `by-content-hash`(唯一), `by-analyzed-at` | `SentimentCache` |
| 18 | `news_bookmarks` | `id` | 否 | `by-bookmarked-at` | `NewsBookmark` |
| 19 | `hot_sector_scores` | `symbol` | 否 | `by-calculated-at` | `HotSectorScore` |
| 20 | `value_pit_scores` | `symbol` | 否 | `by-calculated-at` | `ValuePitScore` |
| 21 | `execution_logs` | `id` | 是 | `by-plan`, `by-symbol`, `by-timestamp` | `ExecutionLog` |
| 22 | `missing_reports` | `id` | 是 | `by-symbol`, `by-severity`, `by-detected-at` | `MissingReport` |
| 23 | `execution_plans` | `id` | 否 | `by-signal`, `by-symbol`, `by-phase`, `by-created-at` | `ExecutionPlan` |
| 24 | `portfolios` | `id` | 否 | `by-theme`, `by-updated-at` | `Portfolio` |
| 25 | `trade_reviews` | `id` | 否 | `by-generated-at` | `TradeReviewRecord` |
| 26 | `financial_reports` | `symbol` | 否 | `by-symbol`(唯一), `by-report-date`, `by-updated-at` | `FinancialReport` |
| 27 | `schema_migrations` | `id` | 否 | — | 迁移追踪 |
| 28 | `collect_config` | `id` | 否 | `by-updated-at` | 采集策略配置 |
| 29 | `custom_agents` | `id` | 否 | `by-type`, `by-updated-at` | `CustomAgent` |
| 30 | `trace_records` | `traceId` | 否 | `by-symbol`, `by-dimension`, `by-started-at`, `by-result` | 采集链路追踪 |
| 31 | `workflow_defs` | `id` | 否 | `by-updated-at`, `by-name` | 工作流定义 |
| 32 | `workflow_schedules` | `id` | 否 | `by-workflow-id`, `by-enabled` | 工作流定时调度 |
| 33 | `workflow_triggers` | `id` | 否 | `by-workflow-id`, `by-event`, `by-enabled` | 工作流事件触发器 |
| 34 | `workflow_runs` | `runId` | 否 | `by-workflow-id`, `by-status`, `by-created-at` | 工作流运行实例 |

#### 3.3.2 增量 Store（迁移创建，6 个）

| # | Store | 主键 | 说明 |
|---|-------|------|------|
| 35 | `rbac_users` | `id` | RBAC 用户 |
| 36 | `rbac_roles` | `id` | RBAC 角色 |
| 37 | `rbac_permissions` | `id` | RBAC 权限 |
| 38 | `rbac_user_roles` | `id` | 用户-角色映射 |
| 39 | `rbac_role_permissions` | `id` | 角色-权限映射 |
| 40 | `rbac_permission_audit_logs` | `id` | 权限审计日志 |

### 3.4 核心实体字段定义

#### 3.4.1 Stock（股票池主表）

```typescript
interface Stock {
  symbol: string;                    // 主键，格式如 "600519.SH"
  name: string;                      // 股票名称
  price?: number;                    // 最新价
  pe?: number;                       // 市盈率
  pb?: number;                       // 市净率
  roe?: number;                      // 净资产收益率
  marketCap?: number;                // 总市值
  researchStatus: ResearchStatus;    // candidate | screened | deepDive | watching | archived
  source: DataSource;                // manual | import | akshare
  dataVersion: number;               // 数据版本，update 时递增
  dataQuality?: StockDataQuality;    // 数据质量评分
  ingestedAt?: number;               // 首次纳入时间戳
  updatedAt?: number;                // 最后更新时间戳
  industryCode?: string;             // 行业代码
  theme?: string[];                  // 主题标签
  sector?: string;                   // 板块
  group?: string;                    // 用户自定义分组
  dataProvenance?: 'real' | 'mock' | 'unknown';
  dataSource?: 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock' | 'unknown';
}
```

**索引设计**：

| 索引名 | keyPath | 用途 |
|---|---|---|
| `by-status` | `researchStatus` | 按研究状态分池查询（意向候选/研究精选/深度/观察/归档） |
| `by-group` | `group` | 按自定义分组查询 |

**约束条件**：

- `symbol` 为全局唯一主键，必须大写且 trim。
- `researchStatus` 必须为 `RESEARCH_STATUS` 枚举值之一。
- `group` 缺失时，`poolStore` 与 `dataLayerStockStores` 会回退为 `DEFAULT_POOL_GROUP = '默认分组'`。
- `dataVersion` 在 `updateStock` 时自动 `+1`。

#### 3.4.2 Order（交易订单）

```typescript
interface Order {
  id: string;                        // 主键，nanoid
  symbol: string;                    // 股票代码
  direction: 'buy' | 'sell';         // 买卖方向
  quantity: number;                  // 数量
  price: number;                     // 成交价
  amount: number;                    // 金额
  status: 'pending' | 'filled' | 'cancelled';
  accountType: 'paper' | 'real';     // 模拟盘 / 真实交易
  createdAt: number;                 // 创建时间戳
  planStopLoss?: number;             // 计划止损
  planTakeProfit?: number;           // 计划止盈
  planPositionPct?: number;          // 计划仓位百分比
  planFollowed?: boolean;            // 是否按计划执行
  maxDrawdown?: number;              // 最大回撤
  maxFloatingProfit?: number;        // 最大浮盈
  profitCaptureRate?: number;        // 止盈兑现率
  errors?: string[];                 // 执行错误记录
  reviewNoteId?: string;             // 关联复盘笔记
}
```

**说明**：交易持仓池不单独建表，由 `orders` 中 `status = 'filled'` 的订单聚合推导。

#### 3.4.3 V6Score（V6 综合评分）

```typescript
interface V6Score {
  symbol: string;                    // 主键
  score: number;                     // 0-5 综合评分
  factors: Record<string, number>;   // 各因子得分
  algorithmVersion: string;          // 算法版本
  calculatedAt: number;              // 计算时间戳
  dataVersion: number;               // 数据版本
  qualityWarning?: string;           // 质量警告
  rating?: string;                   // 评级
  layerDetails?: Record<string, unknown>;
  allRisks?: string[];
  recommendation?: string;
  engineVersion?: string;
}
```

#### 3.4.4 DailyQuotes（日线行情）

```typescript
interface DailyQuotes {
  symbol: string;                    // 主键
  latest: KlineBar;                  // 最新 K 线
  history: KlineBar[];               // 历史 K 线
  period: string;                    // 周期
  adjust: boolean;                   // 是否复权
  updatedAt: number;                 // 更新时间戳
}

interface KlineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}
```

#### 3.4.5 HotSectorScore / ValuePitScore（双策略评分）

```typescript
interface HotSectorScore {
  symbol: string;                    // 主键
  name: string;
  score: number;
  dimensions: Record<string, number>;
  action: string;
  calculatedAt: number;
  dataVersion: number;
  qualityWarning?: string;
}

interface ValuePitScore {
  symbol: string;                    // 主键
  name: string;
  score: number;
  dimensions: Record<string, number>;
  rotationSignal?: string;
  action: string;
  calculatedAt: number;
  dataVersion: number;
  qualityWarning?: string;
}
```

#### 3.4.6 Signal（交易信号）

```typescript
interface Signal {
  id: string;                        // 主键
  symbol: string;
  direction: 'buy' | 'sell';
  type: string;                      // 信号类型
  strategy: string;                  // 来源策略
  confidence: number;                // 置信度
  rationale: string;                 // 依据
  snapshot: SignalSnapshot;          // 技术快照
  createdAt: number;
}
```

#### 3.4.7 ExecutionPlan / ExecutionLog（执行计划与日志）

```typescript
interface ExecutionPlan {
  id: string;                        // 主键
  signalId?: string;                 // 关联信号
  symbol: string;
  name: string;
  phase: string;                     // plan | confirmed | pending | executed | cancelled | reviewed
  direction: 'buy' | 'sell';
  quantity: number;
  targetPrice: number;
  currentPrice?: number;
  rationale: string;
  confidence: number;
  riskChecks: string[];
  risk?: Record<string, unknown>;
  sizing?: Record<string, unknown>;
  result?: Record<string, unknown>;
  orderId?: string;
  errorMessage?: string;
  accountType?: 'paper' | 'real';
  confirmedAt?: number;
  executedAt?: number;
  reviewedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

interface ExecutionLog {
  id: string;                        // 主键，自增
  planId: string;
  symbol: string;
  action: string;
  actor?: string;
  phase: string;
  timestamp: number;
  detail?: unknown;
  success?: boolean;
  errorMessage?: string;
  createdAt: number;
}
```

### 3.5 股票池统一存储 Schema

根据 `../reference/unified-pool-storage-spec.md`，股票池采用**单表多状态模型**：

| 池名 | 英文标识 | 存储位置 | 区分字段 |
|---|---|---|---|
| 意向候选池 | Candidate Pool | `stocks` | `researchStatus = 'candidate'` |
| 研究精选池 | Screened Pool | `stocks` | `researchStatus = 'screened'` |
| 深度研究池 | Deep Dive Pool | `stocks` | `researchStatus = 'deepDive'` |
| 观察池 | Watching Pool | `stocks` | `researchStatus = 'watching'` |
| 归档池 | Archive Pool | `stocks` | `researchStatus = 'archived'` |
| 交易持仓池 | Trade Holding Pool | `orders` | 由已成交订单聚合推导，不独立建表 |

**状态流转**（`src/core/poolTransitionEngine.ts`）：

```text
candidate  ──► screened ──► deepDive ──► watching ──► archived
   ▲                                              │
   └──────────────────────────────────────────────┘
```

| 当前状态 | 可流转至 |
|---|---|
| `candidate` | `screened`, `archived` |
| `screened` | `deepDive`, `archived` |
| `deepDive` | `watching`, `archived` |
| `watching` | `archived` |
| `archived` | `candidate` |

### 3.6 迁移策略

#### 3.6.1 基线创建

- `src/data/db-schema.ts` 的 `createSchema()` 在 `onupgradeneeded` 中幂等地创建 34 个基线 Store。
- 每个 Store 先检查 `db.objectStoreNames.contains(storeName)`，已存在则跳过。
- `stocks` Store 已存在时，补全缺失的 `by-group` 索引，并 backfill 缺失的 `group` 字段为 `DEFAULT_POOL_GROUP`。

#### 3.6.2 增量迁移

- `src/data/db-migrations.ts` 的 `runMigrations()` 按版本顺序执行注册迁移。
- 迁移失败时逆序调用 `down()` 回滚。
- 当前注册迁移：
  - `rbacMigrationV24`：创建 RBAC 6 表。
  - `seed_schema_migrations_tracker`：写入 `schema_migrations` 种子数据。
  - `seed_custom_agents_tracker`：写入 `custom_agents` 种子数据。
  - `seed_trace_records_tracker`：写入 `trace_records` 种子数据。
  - `seed_workflow_stores_tracker`：写入工作流 Store 种子数据。

#### 3.6.3 旧 localStorage 数据迁移

| 旧 localStorage key | 迁移目标 | 处理方式 |
|---|---|---|
| `intention_pool` | `stocks` + `researchStatus = 'candidate'` | V6 迁移服务批量写入 |
| `screener_pool` | `stocks` + `researchStatus = 'screened'` | V6 迁移服务批量写入 |
| `watchlist` | `stocks` 或 `watchlists` | 含研究备注 → stocks；仅 symbol 列表 → watchlists |
| `v6_paper_trading` | `orders` | 转换订单格式后写入 |

---

## 四、数据传递路径与交互协议

### 4.1 分层写入权限矩阵

| 层级 | 能否直接写 `dataLayer` | 必须使用的入口 |
|---|---|---|
| `components/` / `pages/` | ❌ 禁止 | `Store` → `Service` → `DataBridge.forward()` |
| `store/` | ❌ 禁止 | `Service` → `DataBridge.forward()` |
| `services/` | ❌ 禁止 | `DataBridge.forward(StandardEnvelope)` |
| `core/DataBridge` | ❌ 禁止（目标态）| 转交 `data/gateway/` 执行 |
| `data/gateway/` | ✅ 唯一允许 | `dataLayer[storeName].save/delete/update` |

> **现状偏差**：当前 `src/core/databridge.ts:16` 仍 `import { db } from '@/data/db'`，`routeToDB()` 直接调用 `db.put`，尚未完全收敛到 `data/gateway/`。详见 [5.2 偏差项](#52-偏差项)。

### 4.2 StandardEnvelope 统一数据格式

```typescript
// src/core/envelope.ts
interface StandardEnvelope<TPayload = unknown> {
  meta: EnvelopeMeta;
  payload: TPayload;
}

// src/config/dbConfig.ts 导出类型
interface EnvelopeMeta {
  source: ModuleId;           // 调用方模块 ID，用于 ACL
  target: EnvelopeTarget;     // 'db' | 'event' | 'strategy:hotSector' | ...
  action: EnvelopeAction;     // 'INSERT_STOCK' | 'SAVE_SCORES' | ...
  traceId: string;            // 全局唯一追踪 ID
  timestamp: number;          // 信封创建时间戳
}
```

`EnvelopeFactory`（`src/core/envelope.ts`）：

- `create(meta, payload)`：自动填充 `timestamp`。
- `validate(envelope)`：校验 `source`、`target`、`action`、`traceId`、`timestamp`、`payload` 非 `undefined`。

### 4.3 DataBridge 核心接口

#### 4.3.1 `query<T>(request)`

```typescript
// 读入口
DataBridge.query<T>({
  moduleId: ModuleId,
  storeName: StoreName,
  action: 'QUERY_GET' | 'QUERY_LIST' | 'QUERY_BY_INDEX',
  key?: string,
  indexName?: string,
  indexValue?: unknown,
}): Promise<QueryResult<T>>
```

执行流程：

1. 等待 DB ready。
2. 生成缓存 key。
3. 命中 `MemoryCache` 直接返回。
4. ACL 校验 `SELECT` 读权限。
5. 执行 `db.get` / `db.getAll` / `db.getAllByIndex`。
6. 写入读缓存（TTL 10s，最大 200 条）。
7. 写审计日志到 `research_logs`。

#### 4.3.2 `forward(envelope)`

```typescript
// 写入口
DataBridge.forward(envelope: StandardEnvelope): Promise<void>
```

执行流程：

1. 验证 envelope 结构。
2. 通过 `ACTION_TO_STORE_MAP` 推断目标 Store 与操作。
3. ACL 校验（市场类 envelope 被拒绝时进入 `fallbackQueue` 重试）。
4. 写审计日志到 `research_logs`。
5. 按 `action` 路由：
   - 策略动作 → `routeToStrategy`
   - 查询动作 → `routeToQuery`
   - 事件动作 → `routeToEvent`
   - 管理动作（`resetAll` / `importAll` / `exportAll`）→ `routeToManager`
   - 其余 → `routeToDB`（调用 handler 执行 DB 写）
6. DB 写成功后清除读缓存并广播到对应频道。

#### 4.3.3 `subscribe(channel, callback)`

- 订阅频道，禁止订阅 `db` 频道。
- 跨模块数据同步机制：`poolStore` 订阅 `stocks` 频道，非 `stockpool` 自身来源的事件触发 100ms 去抖后 `refresh()`。

#### 4.3.4 缓存与性能

- **读缓存**：`MemoryCache`，namespace `databridge:read`，TTL `10_000ms`，最大 `200` 条。
- **慢调用阈值**：`forward()` > 50ms、`broadcast()` > 10ms 记录 warn。
- **缓存失效**：当前 `invalidateCache()` 为全清，后续可按 store 细化。

### 4.4 EnvelopeAction 路由映射

当前 `ENVELOPE_ACTION` 共 62 个动作，`DataBridge` 通过 `ACTION_TO_STORE_MAP` 显式映射到目标 Store。

#### 4.4.1 股票池相关

| EnvelopeAction | 目标 Store | 处理器 |
|---|---|---|
| `insertStock` | `stocks` | `InsertStockHandler` |
| `updateStock` | `stocks` | `UpdateStockHandler`（`dataVersion + 1`） |
| `deleteStock` | `stocks` | `DeleteStockHandler`（级联删除关联记录） |
| `updateStockStatus` | `stocks` | `UpdateStockStatusHandler` |
| `updateStockGroup` | `stocks` | `UpdateStockGroupHandler` |
| `bulkInsertStock` | `stocks` | `BulkHandler` |

#### 4.4.2 评分与行情

| EnvelopeAction | 目标 Store |
|---|---|
| `saveScores` | `v6_scores` |
| `saveDailyQuotes` | `daily_quotes` |
| `saveFinancialReport` | `financial_reports` |
| `saveIntelligentScores` | `intelligent_scores` |
| `saveIndustryScores` | `industry_scores` |
| `saveRotationScores` | `rotation_scores` |
| `saveSectorScores` | `sector_scores` |
| `saveScoreDocs` | `score_docs` |
| `saveStrategySnapshots` | `strategy_snapshots` |
| `saveHotSectorScores` | `hot_sector_scores` |
| `saveValuePitScores` | `value_pit_scores` |
| `bulkSaveDailyQuotes` | `daily_quotes` |
| `bulkSaveScores` | `v6_scores` |
| `bulkSaveFinancialReports` | `financial_reports` |

#### 4.4.3 交易与信号

| EnvelopeAction | 目标 Store |
|---|---|
| `insertSignal` | `signals` |
| `insertOrder` | `orders` |
| `updateOrder` | `orders` |
| `deleteOrder` | `orders` |
| `saveExecutionPlan` | `execution_plans` |
| `updateExecutionPlan` | `execution_plans` |
| `deleteExecutionPlan` | `execution_plans` |
| `updateExecutionPhase` | `execution_plans` |
| `saveExecutionLog` | `execution_logs` |
| `savePortfolio` | `portfolios` |
| `saveTradeReview` | `trade_reviews` |

#### 4.4.4 策略事件

| EnvelopeAction | 触发动作 | 输出频道 |
|---|---|---|
| `strategyHotSectorRefresh` | 热门板块策略重计算 | `strategy:hotSector` |
| `strategyValuePitRefresh` | 价值洼地策略重计算 | `strategy:valuePit` |
| `strategyRotationSignalDetect` | 轮动信号检测 | `strategy:rotationSignal` |

#### 4.4.5 管理动作

| EnvelopeAction | 操作类型 |
|---|---|
| `resetAll` | 清空所有 Store |
| `importAll` | 批量导入 |
| `exportAll` | 导出 |

### 4.5 ACL 矩阵

`ACL_MATRIX`（`src/config/dbConfig.ts`）按模块定义 `read` / `write` / `actions` 权限。

| 模块 | 读权限 | 写权限 | 允许操作 |
|---|---|---|---|
| `system` | 全部 Store | 全部 Store | 全部操作 |
| `datalayer` | 全部 Store | — | `SELECT` |
| `fetcher` | `stocks`, `financialReports`, `traceRecords`, `collectConfig` | `stocks`, `dailyQuotes`, `financialReports`, `collectConfig`, `traceRecords` | SELECT, INSERT, UPDATE, DELETE |
| `stockpool` | `stocks`, `v6Scores` | `stocks` | SELECT, INSERT, UPDATE, DELETE |
| `analyzer` | `stocks`, `v6Scores`, `intelligentScores`, `industryScores`, `scoreDocs`, `hotSectorScores`, `valuePitScores`, `signals`, `dailyQuotes`, `financialReports` | `v6Scores`, `intelligentScores`, `industryScores`, `scoreDocs`, `hotSectorScores`, `valuePitScores` | SELECT, INSERT, UPDATE |
| `tradinghub` | `stocks`, `v6Scores`, `orders`, `signals`, `strategySnapshots`, `hotSectorScores`, `valuePitScores` | `orders`, `signals`, `strategySnapshots`, `hotSectorScores`, `valuePitScores` | INSERT, UPDATE, DELETE |
| `trading` | `stocks`, `orders`, `signals`, `strategySnapshots` | `orders`, `signals` | SELECT, INSERT, UPDATE |
| `news` | `stocks`, `news`, `newsStockMap`, `sentimentCache`, `newsBookmarks` | `news`, `newsStockMap`, `sentimentCache`, `newsBookmarks` | SELECT, INSERT, UPDATE, DELETE |
| `rbac` | 全部 `rbac*` Store | 全部 `rbac*` Store | SELECT, INSERT, UPDATE, DELETE |

> 完整 ACL 矩阵见 `src/config/dbConfig.ts` `ACL_MATRIX`。

### 4.6 事件与订阅机制

#### 4.6.1 DataBridge 订阅频道

| 频道 | 用途 | 消费者 |
|---|---|---|
| `stocks` | 股票池数据变更 | `poolStore` |
| `scores` | 评分数据变更 | `analysisStore`, `stockAnalysisStore` |
| `orders` | 订单数据变更 | `tradingStore`, `holdingsStore` |
| `signals` | 信号数据变更 | `signalStore`, `executionStore` |
| `strategy:hotSector` | 热门板块策略结果 | `hotSectorStore` |
| `strategy:valuePit` | 价值洼地策略结果 | `valuePitStore` |
| `strategy:rotationSignal` | 轮动信号 | `dualStrategyStore` |

#### 4.6.2 EventBus 事件

| 事件名 | 触发时机 | 消费者 |
|---|---|---|
| `BATCH_IMPORT_COMPLETED` | 批量导入完成 | `poolStore` 刷新股票池 |
| `COLLECT_ALL_COMPLETED` | 全量采集完成 | `poolStore` 刷新股票池 |
| `V6_SCORE_COMPLETED` | V6 评分完成 | `poolStore` 刷新股票池 |
| `STOCK_POOL_CHANGED` | 股票池写操作后 | 跨组件通知 |

### 4.7 模块间数据流路径表

| 源模块 | 目标 Store | EnvelopeAction | 触发场景 |
|---|---|---|---|
| `fetcherService` | `stocks` | `insertStock` / `bulkInsertStock` | 外部数据采集 |
| `fetcherService` | `daily_quotes` | `saveDailyQuotes` / `bulkSaveDailyQuotes` | 行情采集 |
| `fetcherService` | `financial_reports` | `saveFinancialReport` / `bulkSaveFinancialReports` | 财报采集 |
| `inputService` | `stocks` | `insertStock` | 手动录入 |
| `v6ScoreService` | `v6_scores` | `saveScores` | V6 评分计算 |
| `hotSectorAnalyzer` | `hot_sector_scores` | `saveHotSectorScores` | 热门板块策略 |
| `valuePitAnalyzer` | `value_pit_scores` | `saveValuePitScores` | 价值洼地策略 |
| `signalGenerator` | `signals` | `insertSignal` | 信号生成 |
| `tradingService` | `orders` | `insertOrder` / `updateOrder` | 订单创建/更新 |
| `executionStore` | `execution_plans` | `saveExecutionPlan` / `updateExecutionPlan` | 执行计划 |
| `executionStore` | `execution_logs` | `saveExecutionLog` | 执行日志 |
| `newsService` | `news` | `saveNews` / `bulkSaveNews` | 资讯采集 |
| `newsService` | `sentiment_cache` | `saveSentimentCache` | 情感分析 |
| `tradeReviewAI` | `trade_reviews` | `saveTradeReview` | 交易复盘 |
| `WorkflowServer` | `workflow_*` | `saveWorkflowDef` / `saveWorkflowRun` 等 | 工作流执行 |

---

## 五、与现有开发蓝图校对

### 5.1 一致项

| 蓝图文档 | 一致内容 | 说明 |
|---|---|---|
| `../reference/v9-system-blueprint.md` | 五层架构分层原则 | L1~L5 职责与依赖方向与代码一致 |
| `../reference/v9-system-blueprint.md` | DataBridge 作为统一数据桥接层 | `forward()` / `query()` / `subscribe()` 实现一致 |
| `../reference/v9-system-blueprint.md` | 股票池五态流转 | candidate → screened → deepDive → watching → archived 一致 |
| `data-flow-spec.md` | 异步数据三态要求 | `AsyncState<T>`（loading / data / error）在 Store 中普遍使用 |
| `10-glossary.md` | 股票池术语 | 意向候选池/研究精选池/深度研究池/观察池/归档池与代码一致 |
| `../reference/v9数据架构修订建议.md` | DataBridge + Envelope + ACL 通信体系 | 协议定义与实现一致 |
| `../reference/databridge端点与数据映射清单.md` | 大部分 forward 端点映射 | 股票、评分、订单、资讯等核心映射一致 |
| `../reference/v9-indexeddb-store-schema.md` | 核心 Store 主键设计 | `stocks.symbol`、`orders.id`、`v6_scores.symbol` 等一致 |

### 5.2 偏差项

| 编号 | 蓝图文档 | 蓝图描述 | 代码实际 | 偏差等级 | 修正建议 |
|---|---|---|---|---|---|
| DEV-01 | `../reference/v9-system-blueprint.md` | IndexedDB 共 **17 个 Store** | 实际 **40 个 Store** | 🔴 严重 | 按 `STORE_NAME` 重新统计并更新 |
| DEV-02 | `../reference/v9-indexeddb-store-schema.md` | 版本 **v21**，25 个 Store | `DB_VERSION = 28`，40 个 Store | 🔴 严重 | 更新版本号，补充 v22~v28 变更与新增 Store |
| DEV-03 | `../reference/../reference/v9核心数据字典与类型定义(整合版).md` | 版本 **v16**，列出 `watchlist`(单数)、`news_articles`、`kline_data`、`rotation_signals` 等 | 实际为 `watchlists`、`news`、`daily_quotes`、`rotation_scores`；且多个 Store 不存在 | 🔴 严重 | 重新与 `src/config/dbConfig.ts` 和 `src/data/db-schema.ts` 对齐 |
| DEV-04 | `architecture.md` | 文件名暗示整体架构 | 实际内容为 Cockpit Widget 架构说明 | 🟡 中等 | 重命名文件或补充整体架构章节 |
| DEV-05 | `data-flow-spec.md` | 未提及 Gateway 层 | AGENTS.md v1.4.6 已新增 `data/gateway/` 为唯一写入入口 | 🟡 中等 | 补充 Gateway 写入权限规范引用 |
| DEV-06 | `../reference/databridge端点与数据映射清单.md` | 部分端点与实际动作名不一致（如 `saveV6Score`、`createExecutionPlan`、`saveNewsBookmark`） | 实际 `ENVELOPE_ACTION` 为 `saveScores`、`saveExecutionPlan`、`newsArticleBookmarked` | 🟡 中等 | 统一端点命名与 `ENVELOPE_ACTION` 完全一致 |
| DEV-07 | Gateway 规范 | 要求 `DataBridge` 不直接 `import { db }` | `src/core/databridge.ts:16` 仍直接导入 `db`，`routeToDB()` 直接调用 `db.put` | 🔴 严重 | 创建 `src/data/gateway/dataGateway.ts`，将 `routeToDB()` 委托给 Gateway |
| DEV-08 | `../reference/databridge端点与数据映射清单.md` | 声明 Watchlist / Signal 完整 CRUD | 实际仅 `saveWatchlist`、`insertSignal`，缺 `update/delete` | 🟡 中等 | 补充 `updateWatchlist` / `deleteWatchlist` / `updateSignal` / `deleteSignal` |
| DEV-09 | `data-flow-spec.md` | EventBus / Envelope / DataChannel 关系未明确 | 代码中三者并存，职责边界模糊 | 🟢 轻微 | 增加通信体系对比说明 |
| DEV-10 | `../reference/v9-system-blueprint.md` | L3 引擎层子模块映射不完整 | 策略、轮动、资讯等 P0 模块未体现 | 🟢 轻微 | 补充子模块与产出实体映射表 |

### 5.3 需修正部分（按优先级排序）

#### P0 阻塞级

1. **修正 Store 数量与版本号**：
   - `../reference/v9-system-blueprint.md` 中 "17 个 Store" 修正为 40 个。
   - `../reference/v9-indexeddb-store-schema.md` 版本号从 v21 更新为 v28，并补充 v22~v28 的 Store 变更历史。
   - `../reference/../reference/v9核心数据字典与类型定义(整合版).md` 重新生成 Store 清单，删除不存在 Store（如 `kline_data`、`rotation_signals`、`data_channels` 等）。

2. **落地 Gateway 层**：
   - 创建 `src/data/gateway/dataGateway.ts`，实现 `execute(envelope: StandardEnvelope): GatewayWriteResult`。
   - 修改 `src/core/databridge.ts`，移除 `import { db } from '@/data/db'`，`routeToDB()` 委托 Gateway。
   - 修改 `src/core/databridgeHandlers.ts`，Handler 不再直接 `db.put`，而是构造 Envelope 调用 Gateway。

3. **统一 `ENVELOPE_ACTION` 命名**：
   - 端点清单中 `saveV6Score` → `saveScores`。
   - `createExecutionPlan` → `saveExecutionPlan`。
   - `saveNewsBookmark` → `newsArticleBookmarked`。

#### P1 严重级

4. **补充缺失 CRUD 端点**：
   - Watchlist：`insertWatchlist` / `updateWatchlist` / `deleteWatchlist`。
   - Signal：`updateSignal` / `deleteSignal`。

5. **更新数据字典**：
   - `watchlist` → `watchlists`。
   - `news_articles` → `news`。
   - `news_summaries` / `news_sentiment` → `sentiment_cache`。
   - 删除或标注规划中 Store。

6. **文档结构修正**：
   - `architecture.md` 重命名为 `cockpit-widget-architecture.md` 或补充整体架构章节。
   - `data-flow-spec.md` 补充 Gateway 层说明与引用。

#### P2 优化级

7. **通信体系说明**：明确 `EventBus`、`Envelope`、`DataBridge.subscribe` 的使用边界。
8. **模块-层级映射表**：补充 `MODULE_ID` 与五层架构的归属关系。
9. **缓存策略细化**：当前 `invalidateCache` 为全清，文档中标注后续优化方向。

---

## 六、术语表

| 术语 | 英文 | 定义 | 相关 Store / 文件 |
|------|------|------|------------------|
| **股票池** | Stock Pool | 单表多状态模型：所有标的统一存于 `stocks`，通过 `researchStatus` 区分五态 | `stocks` |
| **意向候选池** | Candidate Pool | 初步感兴趣的标的，`researchStatus = 'candidate'` | `stocks` |
| **研究精选池** | Screened Pool | 通过初步筛选，`researchStatus = 'screened'` | `stocks` |
| **深度研究池** | Deep Dive Pool | 已完成深度分析，`researchStatus = 'deepDive'` | `stocks` |
| **观察池** | Watching Pool | 已决定跟踪，`researchStatus = 'watching'` | `stocks` |
| **归档池** | Archive Pool | 已淘汰/卖出，`researchStatus = 'archived'` | `stocks` |
| **DataBridge** | DataBridge | 统一数据桥接层：提供 `forward()` 写入口、`query()` 读入口、`subscribe()` 订阅、ACL 校验、缓存、审计日志 | `src/core/databridge.ts` |
| **标准信封** | StandardEnvelope | 模块间通信标准格式：`{ meta: EnvelopeMeta, payload: unknown }` | `src/core/envelope.ts` |
| **EnvelopeMeta** | EnvelopeMeta | 信封元数据：`source`, `target`, `action`, `traceId`, `timestamp` | `src/config/dbConfig.ts` |
| **ACL** | ACL Matrix | 基于模块与 Store 的访问控制矩阵 | `src/config/dbConfig.ts` `ACL_MATRIX` |
| **Gateway** | data/gateway/ | AGENTS.md v1.4.6 定义：唯一允许直接操作 `dataLayer`/`db` 的入口 | `src/data/gateway/`（目标态） |
| **V6 评分** | V6 Score | 多因子加权评分，0-5 分制 | `v6_scores` |
| **热门板块策略** | Hot Sector Strategy | 板块已在动时跟随趋势 | `hot_sector_scores` |
| **价值洼地策略** | Value Pit Strategy | 等板块开始轮动后再进入 | `value_pit_scores` |
| **轮动信号** | Rotation Signal | 成交量突破 + 资金净流入 + 技术金叉 | `rotation_scores` / `signals` |
| **执行计划** | Execution Plan | 信号到订单之间的状态机 | `execution_plans` |
| **模拟盘** | Paper Trading | `accountType = 'paper'` | `orders` |
| **真实交易** | Real Trading | `accountType = 'real'`（占位） | `orders` |
| **五舱** | Five Cabins | input / analysis / trading / output / command | `src/apps/` |
| **驾驶舱** | Cockpit | 系统监控 Widget Dashboard | `src/cockpit/` |
| **单一可信源** | SSOT | `poolStore` 作为股票池数据的唯一可信源 | `src/store/poolStore.test.ts` |

---

## 七、附录：验证命令与参考文档

### 7.1 验证命令

```powershell
# 类型检查
./node_modules/.bin/tsc --noEmit

# 架构分层审计
npm.cmd run audit:layers

# 数据库定义一致性检查（建议新增）
# node scripts/validate-data-blueprint.ts

# 单元测试
./node_modules/.bin/vitest run

# 生产构建
npm.cmd run build
```

### 7.2 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 架构契约 | `../../AGENTS.md` | 项目分层规则与行为约束 |
| 系统蓝图 | `../reference/v9-system-blueprint.md` | 项目整体蓝图 |
| IndexedDB Schema | `../reference/v9-indexeddb-store-schema.md` | IndexedDB 表结构（已滞后） |
| 数据流规范 | `../reference/data-flow-spec.md` | 数据流约束 |
| 核心数据字典 | `../reference/../reference/../reference/v9核心数据字典与类型定义(整合版).md` | 类型定义（已滞后） |
| 术语表 | `../reference/10-glossary.md` | 领域术语 |
| DataBridge 端点清单 | `../reference/../reference/databridge端点与数据映射清单.md` | 端点映射 |
| DataBridge 数据链路 | `./design/databridge数据链路全景分析报告.md` | 全链路分析 |
| 数据架构修订建议 | `../reference/v9数据架构修订建议.md` | 架构修订 |
| 股票池统一存储 | `../reference/unified-pool-storage-spec.md` | 统一存储方案 |
| Gateway 写入权限 | `../reference/gateway-write-permission-spec.md` | Gateway 规范 |
| 数据关系 ER | `./v9-data-relationship-er.md` | ER 关系 |

### 7.3 变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v2.0.0-rev.1 | 2026-07-13 | 初始版本：整合 DB_VERSION=28 实际代码、40 个 ObjectStore、62 个 EnvelopeAction、股票池统一存储、Gateway 目标态与现状偏差分析 |

---

> **维护建议**: 本报告应随每次 `DB_VERSION` 升级、`ENVELOPE_ACTION` 新增、`STORE_NAME` 变更而更新。建议在 `scripts/` 中新增 `validate-data-blueprint.ts`，自动比对 `src/config/dbConfig.ts` 与 `../reference/v9-indexeddb-store-schema.md`、`../reference/../reference/../reference/v9核心数据字典与类型定义(整合版).md` 的一致性。
