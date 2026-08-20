---
title: data-layer-overview
type: explanation
domain: data
phase: planning
tier: important
status: draft
maintainer: 架构组 / 数据层负责人
summary: "本文档是 src/data/ 与 src/core/databridge.ts 的权威全景说明，面向需要理解数据流、新增 store、排查数据一致性问题的开发者与 AI Agent。"
tags: [data, plan, architecture, explanation, data-definition, store, strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-003
related_docs: [V9-DOC-PROJ-271, V9-DOC-DATA-005, V9-DOC-BACK-001]
referenced_by: [V9-DOC-META-000, V9-DOC-DATA-056, V9-DOC-PROJ-176, V9-DOC-PROJ-156, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 数据层总览

> **定位**：本文档是 `src/data/` 与 `src/core/databridge.ts` 的权威全景说明，面向需要理解数据流、新增 store、排查数据一致性问题的开发者与 AI Agent。
> **合规基准**：基于 `../../AGENTS.md` v1.4.3 §八（数据库版本管理）及 `src/data/` 实际源码编写。
> **关联文档**：
> - [架构总览](../archive/normal/explanation/overview.md)（已归档） — 全局分层与依赖方向
> - [AGENTS.md](../../AGENTS.md) — 工程契约（禁止跨层调用、四步集成、DB_VERSION 规则）
> - [数据字典索引](../archive/normal/explanation/data-dictionary-index.md)（已归档） — 字段级定义唯一索引
> - [引擎规格](./05-engine-specs.md) — L0-L8 引擎分层说明

---

## 1. 数据层目录结构

```
src/data/
├── db.ts                    # V6Database 单例类（get/put/delete/事务/导出导入）
├── db-connection.ts         # IndexedDB 连接管理（openDB / deleteDB / 版本冲突处理）
├── db-schema.ts             # 基线 Schema 创建（createSchema + ensureStore 幂等辅助）
├── db-migrations.ts         # 迁移框架（Migration 接口 + runMigrations + MIGRATIONS 注册表）
├── db-utils.ts              # 低层工具（generateId / now）→ 已上移到 src/lib/utils.ts，此处为向后兼容 re-export
├── types.ts                 # Barrel 统一出口（13 个子模块类型聚合）
├── types/                   # 按域拆分的类型子模块（PR-1 拆分）
│   ├── types.dataLayer.ts   # L0 基础类型（DataLayerResult / dbConfig re-export）
│   ├── types.stock.ts       # 股票基础域
│   ├── types.score.ts       # 评分域
│   ├── types.order.ts       # 订单域
│   ├── types.portfolio.ts   # 组合域
│   ├── types.strategy.ts    # 策略域
│   ├── types.signal.ts      # 信号域
│   ├── types.marketData.ts  # 行情数据域
│   ├── types.sector.ts      # 板块评分域
│   ├── types.rotation.ts    # 轮动域
│   ├── types.scoreDoc.ts    # 评分文档域
│   ├── types.knowledge.ts   # 知识库/资讯域
│   ├── types.sevenDimensions.ts  # 七维数据域
│   ├── types.execution.ts   # 执行计划域
│   ├── types.hybridProofread.ts  # 混合校对域
│   └── types.customAgent.ts # 自定义智能体域（v26）
├── dataLayer.ts             # dataLayer barrel — 聚合全部 domain store 的统一入口
├── dataLayerHelpers.ts      # 共享辅助（sendWriteEnvelope / queryGet / queryList / queryByIndex）→ 已迁移到 src/core/databridgeQueries.ts，此处为向后兼容 re-export
├── dataLayerStockStores.ts  # 股票域 store（stock / dailyQuote / financialReport）
├── dataLayerScoreStores.ts  # 评分域 store（v6 / intelligent / industry / rotation / sector / scoreDoc / hotSector / valuePit）
├── dataLayerTradingStores.ts # 交易域 store（order / signal / executionPlan / executionLog / portfolio / tradeReview）
├── dataLayerContentStores.ts # 内容域 store（researchLog / strategySnapshot / localDoc / news / newsStockMap / sentimentCache / missingReport / customAgent）
├── dataLayerWatchlistStore.ts # 观察列表 store（watchlist）
├── queryBuilder.ts          # 综合查询引擎（多维度并发查询 + zod 校验）
├── repository.ts            # D-02 统一仓储契约（Repository<T> + createRepository 工厂）
├── migrations/              # 独立迁移文件
│   └── rbacMigrationV24.ts  # RBAC 6 表创建（v24）
└── schemas/                 # JSON Schema / 校验定义（如存在）
```

> **依赖规则**：`src/data/` 仅可依赖 `src/core/`、`src/config/`、`src/lib/`（基础设施）、`src/types/`；禁止反向依赖 `src/services/` 或 `src/store/`（见 `../../AGENTS.md` §一）。

---

## 2. IndexedDB Schema（36 Store）

### 2.1 基线 Store（30 个，由 `createSchema` 创建）

以下 store 在 `db-schema.ts` 的 `createSchema()` 中通过 `ensureStore()` 或特殊逻辑**幂等创建**，属于首次安装即必须存在的核心存储。

| # | Store 常量名 | 物理名 | 主键 | 索引 | 说明 |
|---|-------------|--------|------|------|------|
| 1 | `stocks` | `stocks` | `symbol` | `by-status`, `by-group` | 股票基础数据；含 group 字段 backfill 逻辑 |
| 2 | `v6Scores` | `v6_scores` | `symbol` | — | V6 综合评分 |
| 3 | `intelligentScores` | `intelligent_scores` | `id` (autoIncrement) | `by-symbol` | 智能评分 |
| 4 | `industryScores` | `industry_scores` | `id` (autoIncrement) | `by-code` | 行业评分 |
| 5 | `orders` | `orders` | `id` | — | 交易订单 |
| 6 | `watchlists` | `watchlists` | `id` | — | 自选股/观察列表 |
| 7 | `signals` | `signals` | `id` | — | 交易信号 |
| 8 | `researchLogs` | `research_logs` | `id` (autoIncrement) | — | 研究/审计日志（DataBridge 审计写入） |
| 9 | `dailyQuotes` | `daily_quotes` | `symbol` | — | 日线/K 线行情 |
| 10 | `rotationScores` | `rotation_scores` | `id` | `by-sector-date`, `by-sector`, `by-total`, `by-resonance` | 板块轮动评分 |
| 11 | `sectorScores` | `sector_scores` | `id` | `by-sector`, `by-composite`, `by-is-core` | 十五五板块评分 |
| 12 | `scoreDocs` | `score_docs` | `docId` | `by-symbol`, `by-symbol-version`, `by-composite` | 评分文档版本库 |
| 13 | `strategySnapshots` | `strategy_snapshots` | `id` | `by-version`, `by-date`, `by-timestamp` | 策略快照 |
| 14 | `localDocs` | `local_docs` | `id` | `by-symbol`, `by-category`, `by-added-at` | 本地知识库 |
| 15 | `news` | `news` | `id` | `by-source`, `by-category`, `by-publish-time`, `by-hash` (unique) | 资讯文章 |
| 16 | `newsStockMap` | `news_stock_map` | `id` | `by-symbol`, `by-news` | 股票-资讯多对多关联 |
| 17 | `sentimentCache` | `sentiment_cache` | `id` | `by-content-hash` (unique), `by-analyzed-at` | 情感分析缓存 |
| 18 | `newsBookmarks` | `news_bookmarks` | `id` | `by-bookmarked-at` | 资讯收藏（v13） |
| 19 | `hotSectorScores` | `hot_sector_scores` | `symbol` | `by-calculated-at` | 双策略-热门板块（v14） |
| 20 | `valuePitScores` | `value_pit_scores` | `symbol` | `by-calculated-at` | 双策略-价值洼地（v14） |
| 21 | `executionLogs` | `execution_logs` | `id` (autoIncrement) | `by-plan`, `by-symbol`, `by-timestamp` | 执行日志（v15） |
| 22 | `missingReports` | `missing_reports` | `id` (autoIncrement) | `by-symbol`, `by-severity`, `by-detected-at` | 缺失报告登记（v15） |
| 23 | `executionPlans` | `execution_plans` | `id` | `by-signal`, `by-symbol`, `by-phase`, `by-created-at` | 执行计划（v16） |
| 24 | `portfolios` | `portfolios` | `id` | `by-theme`, `by-updated-at` | 投资组合（v16） |
| 25 | `tradeReviews` | `trade_reviews` | `id` | `by-generated-at` | 交易纪律复盘（v17） |
| 26 | `financialReports` | `financial_reports` | `symbol` | `by-symbol` (unique), `by-report-date`, `by-updated-at` | 财务数据报告（v22） |
| 27 | `schemaMigrations` | `schema_migrations` | `id` | — | 迁移追踪（D-01 框架，v23） |
| 28 | `collectConfig` | `collect_config` | `id` | `by-updated-at` | 采集策略配置（v25） |
| 29 | `customAgents` | `custom_agents` | `id` | `by-type`, `by-updated-at` | 用户自定义智能体（v26） |
| 30 | `traceRecords` | `trace_records` | `traceId` | `by-symbol`, `by-dimension`, `by-started-at`, `by-result` | 采集链路追踪（v27） |

> **注意**：`../../AGENTS.md` v1.4.3 §八 中列出的基线 store 为 29 个（截至 `customAgents`），`traceRecords`（v27）为后续新增，实际代码中 `createSchema` 已包含该 store。

### 2.2 增量 Store（6 个，由 Migration 创建）

以下 store 不在 `createSchema` 中创建，而在版本升级时由对应 `Migration.up()` 动态创建。

| Store 常量名 | 物理名 | 创建迁移 | 说明 |
|-------------|--------|---------|------|
| `rbacUsers` | `rbac_users` | `rbacMigrationV24` | RBAC 用户 |
| `rbacRoles` | `rbac_roles` | `rbacMigrationV24` | RBAC 角色 |
| `rbacPermissions` | `rbac_permissions` | `rbacMigrationV24` | RBAC 权限 |
| `rbacUserRoles` | `rbac_user_roles` | `rbacMigrationV24` | 用户-角色映射 |
| `rbacRolePermissions` | `rbac_role_permissions` | `rbacMigrationV24` | 角色-权限映射 |
| `rbacPermissionAuditLogs` | `rbac_permission_audit_logs` | `rbacMigrationV24` | 权限审计日志（append-only） |

### 2.3 Schema 创建职责划分（AGENTS.md §八 规则）

- **基线 store**（首次安装即需要）→ 在 `createSchema`（`db-schema.ts`）中添加
- **增量 store**（版本升级新增）→ 在对应版本的 `Migration.up()`（`db-migrations.ts` 或 `src/data/migrations/`）中添加
- **禁止** 在两处同时添加同一 store 的创建逻辑（违反 DRY）
- `schemaMigrations` / `customAgents` 等 store 本身由 `createSchema` 创建（基线），种子数据由 migration 写入

---

## 3. DataBridge 路由机制

### 3.1 核心类与入口

`DataBridge`（`src/core/databridge.ts`）是数据层的统一桥接器，位于 `src/core/`（核心层），职责包括：

- **`init()`** — 数据库初始化（幂等）：应用启动时调用，已初始化则直接返回
- **`forward(envelope)`** — 写操作入口：ACL 校验 → 路由 → DB/策略/事件/管理器
- **`query(request)`** — 读操作入口：缓存 → ACL 校验 → 数据库查询 → 审计日志
- **`subscribe(channel, callback)`** — 频道订阅（跨模块广播通信）
- **`retryFailed()`** — 失败 envelope 重试（fallbackQueue）
- **`exportAllData(source)`** — 全量数据导出：经 ACL 校验 + 审计后返回所有 store 数据
- **`importAllData(data, source)`** — 全量数据导入：经 ACL 校验后批量写入所有 store
- **`resetAllData(source)`** — 全量数据重置：经 ACL 校验后清空所有 store

### 3.2 Envelope 与 Action 定义

信封元数据字典于 `src/config/dbConfig.ts`：

```typescript
interface EnvelopeMeta {
  source: ModuleId      // 来源模块（如 'fetcher' / 'analyzer' / 'system'）
  target: EnvelopeTarget // 目标（'db' / 'strategy:hotSector' / 'executionPlans' 等）
  action: EnvelopeAction // 动作（见 ENVELOPE_ACTION 常量）
  traceId: string       // 追踪 ID
  timestamp: number     // 时间戳
}
```

当前已定义的 `ENVELOPE_ACTION` 常量（截至 DB_VERSION = 27）：

| 类别 | Action 数量 | 关键 Action 示例 |
|------|------------|----------------|
| 单条写入 | ~30 | `INSERT_STOCK`, `UPDATE_STOCK`, `SAVE_SCORES`, `SAVE_NEWS`, `SAVE_EXECUTION_PLAN` |
| 批量写入 | 5 | `BULK_INSERT_STOCK`, `BULK_SAVE_DAILY_QUOTES`, `BULK_SAVE_SCORES`, `BULK_SAVE_FINANCIAL_REPORTS`, `BULK_SAVE_NEWS` |
| 查询 | 3 | `QUERY_GET`, `QUERY_LIST`, `QUERY_BY_INDEX` |
| 策略触发 | 3 | `STRATEGY_HOT_SECTOR_REFRESH`, `STRATEGY_VALUE_PIT_REFRESH`, `STRATEGY_ROTATION_SIGNAL_DETECT` |
| 事件广播 | 4 | `NEWS_ARTICLE_LOADED`, `HOLDINGS_DATA_LOADED`, `TRADE_ACTION_EXECUTED`, `LOAD_HOLDINGS_DATA` |
| 管理操作 | 3 | `RESET_ALL`, `IMPORT_ALL`, `EXPORT_ALL` |
| RBAC | 7 | `SAVE_RBAC_USER` ~ `SAVE_RBAC_AUDIT_LOG`, `DELETE_RBAC_AUDIT_LOG` |
| 采集/智能体 | 4 | `SAVE_COLLECT_CONFIG`, `DELETE_COLLECT_CONFIG`, `SAVE_CUSTOM_AGENT`, `DELETE_CUSTOM_AGENT`, `SAVE_TRACE_RECORD` |

> **规则**：新增 `ENVELOPE_ACTION` 必须在 `DataBridge.routeToDB()` 中添加对应 case（见 `../../AGENTS.md` §八）。

### 3.3 路由流程图

```
envelope 进入 forward()
    │
    ▼
Envelope 格式校验（EnvelopeFactory.validate）
    │
    ▼
推断 targetStore（ACTION_TO_STORE_MAP 显式映射 或 payload.store）
    │
    ▼
ACL 校验（aclEngine.assert）— 失败时市场类 envelope 入 fallbackQueue 重试
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  按 action 类型分发（routeToAction）                         │
│  ├── STRATEGY_ACTIONS → routeToStrategy（策略引擎）          │
│  ├── QUERY_ACTIONS    → routeToQuery（查询缓存 + DB）        │
│  ├── EVENT_ACTIONS    → routeToEvent（纯广播，不写 DB）      │
│  ├── reset/import/export → routeToManager（DB 管理）         │
│  └── 其余             → routeToDB（Handler 模式写入）        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
写操作成功后：invalidateCache(targetStore) + broadcast(channel, envelope)
```

### 3.4 routeToDB 的 Handler 模式

`routeToDB()` 使用策略模式委托给 `HandlerRegistry`，而非在 switch-case 中硬编码所有写入逻辑：

1. 查找 `meta.action` 对应的 `EnvelopeHandler`
2. 若找到，调用 `handler.handle(envelope, store)`
3. 若未找到，回退为默认 `db.put(store, envelope.payload)`

Handler 定义集中管理于 `src/core/databridgeHandlers.ts`，便于新增 action 时独立扩展。

### 3.5 ACL 矩阵（精简版）

完整 ACL 定义见 `src/config/dbConfig.ts` → `ACL_MATRIX`。以下为核心模块权限摘要：

| 模块 | 读权限 | 写权限 |
|------|--------|--------|
| `fetcher` | `traceRecords`, `collectConfig` | `stocks`, `dailyQuotes`, `financialReports`, `collectConfig`, `traceRecords` |
| `analyzer` | stocks, v6Scores, intelligentScores, industryScores, scoreDocs, hotSectorScores, valuePitScores, signals | v6Scores, intelligentScores, industryScores, scoreDocs, hotSectorScores, valuePitScores |
| `stockpool` | stocks, v6Scores | stocks |
| `tradinghub` | stocks, v6Scores, orders, signals, strategySnapshots, hotSectorScores, valuePitScores | orders, signals, strategySnapshots, hotSectorScores, valuePitScores |
| `news` | stocks, news, newsStockMap, sentimentCache, newsBookmarks | news, newsStockMap, sentimentCache, newsBookmarks |
| `rbac` | rbacUsers ~ rbacPermissionAuditLogs | rbacUsers ~ rbacPermissionAuditLogs（审计日志 append-only） |
| `system` | **全部** | **全部** |
| `datalayer` | **全部** | 无（只读代理） |

### 3.6 Store 包装层与分层合规

`dataLayer*Stores.ts` 系列文件（如 `dataLayerStockStores.ts`、`dataLayerTradingStores.ts` 等）是**领域 Store 包装层**，其定位为：

- **职责**：封装领域相关的业务逻辑（校验、聚合、计算），提供语义化的 CRUD 接口
- **数据访问**：内部通过 `dataLayerHelpers` → `databridgeQueries` → `DataBridge` 访问数据，**不直接持有 db 实例**
- **分层合规**：services 层从这些 store 文件导入是合规的（最终仍走 DataBridge），`audit:layers` v3.4+ 会自动识别并豁免

**合规判定标准**（`isCompliantStoreModule`）：
1. 不直接导入 `db` 实例（仅导入工具函数如 `generateId`/`now` 不算违规）
2. 数据访问通过 `dataLayerHelpers` 或 `databridgeQueries`（最终走 DataBridge）
3. 仅包含领域逻辑封装，不绕过 ACL / 审计 / 缓存机制

---

## 4. 数据库迁移升级策略（D-01）

### 4.1 迁移框架

```typescript
// db-migrations.ts
export interface Migration {
  version: number        // 触发该迁移的目标版本号（严格递增）
  name: string           // 迁移名称（日志/审计）
  up(ctx: MigrationContext): void   // 正向迁移（同步执行，禁止 await）
  down?(ctx: MigrationContext): void // 反向回滚（失败时逆序调用）
}
```

### 4.2 升级触发链

```
浏览器打开页面 → V6Database.init() → openDB()
    │
    ▼
indexedDB.open(DB_NAME, DB_VERSION)  // DB_VERSION = 27
    │
    ▼
onupgradeneeded 回调
    ├── createSchema(db, request, logger)     // 创建/确认基线 store
    └── runMigrations(db, oldVersion, DB_VERSION, MIGRATIONS, logger, tx)
            │
            ▼
        筛选 pending 迁移（oldVersion < version ≤ DB_VERSION）
            │
            ▼
        按 version 升序执行 up()
        任一失败 → 逆序执行 down() 回滚 → 抛错
```

### 4.3 DB_VERSION 升级历史

| 版本 | 变更内容 |
|------|---------|
| v3 → v4 | 新增 `dailyQuotes` |
| v4 → v5 | stocks 新增 `group` 字段与 `by-group` 索引 |
| v5 → v6 | 新增 rotationScores / sectorScores / scoreDocs / strategySnapshots / localDocs / news / newsStockMap / sentimentCache |
| v12 → v13 | 新增 `newsBookmarks` |
| v13 → v14 | 新增 `hotSectorScores` / `valuePitScores` |
| v14 → v15 | 新增 `executionLogs` / `missingReports` |
| v15 → v16 | 新增 `executionPlans` / `portfolios` |
| v19 → v20 | 数据字典补全，新增 datalayer ACL |
| v20 → v22 | 新增 `financialReports` |
| v22 → v23 | 新增 `schemaMigrations`（D-01 迁移框架落地） |
| v23 → v24 | 新增 RBAC 6 表（由 `rbacMigrationV24` 创建） |
| v24 → v25 | 新增 `collectConfig` |
| v25 → v26 | 新增 `customAgents` |
| v26 → v27 | 新增 `traceRecords` |

### 4.4 新增 Store 的 SOP

1. `src/config/dbConfig.ts` 中：
   - `DB_VERSION + 1`
   - `STORE_NAME` 中注册新常量
   - `ACL_MATRIX` 中补充 read/write 白名单
2. 判断基线/增量：
   - 基线 → 在 `db-schema.ts` `createSchema()` 中添加 `ensureStore()` 调用
   - 增量 → 在 `db-migrations.ts` `MIGRATIONS` 数组中追加 Migration 记录（或新建 `src/data/migrations/*.ts`）
3. 如有新写入通道 → 在 `src/core/databridge.ts` `ACTION_TO_STORE_MAP` 中注册 action → store 映射
4. 运行 `npm run audit:layers` 确认无跨层违规
5. 运行 `npx tsc --noEmit` 确认类型安全

> **TODO**：补充一图流「新增 Store 决策树」，由架构组扩写。

---

## 5. 数据类型定义（src/data/types.ts）

### 5.1 Barrel 结构

`types.ts` 是 13+ 个子模块的 barrel re-export，保持原 `import type { Stock, Order } from '@/data/types'` 路径完全兼容。

```typescript
// 按业务域聚合的子模块
L0 基础层          → types/types.dataLayer.ts
执行计划域          → types/types.execution.ts
股票基础域          → types/types.stock.ts
评分域              → types/types.score.ts
订单域              → types/types.order.ts
组合域              → types/types.portfolio.ts
策略域              → types/types.strategy.ts
信号域              → types/types.signal.ts
行情数据域          → types/types.marketData.ts
板块评分域          → types/types.sector.ts
轮动域              → types/types.rotation.ts
评分文档域          → types/types.scoreDoc.ts
知识库/资讯域       → types/types.knowledge.ts
七维数据域          → types/types.sevenDimensions.ts
混合校对域          → types/types.hybridProofread.ts
自定义智能体域      → types/types.customAgent.ts
```

### 5.2 核心类型速查

| 类型 | 来源文件 | 说明 |
|------|---------|------|
| `Stock` | `types.stock.ts` | 股票基础信息（symbol / name / industry / group / researchStatus） |
| `V6Score` | `types.score.ts` | V6 评分结果（composite + 8 维度分） |
| `Order` | `types.order.ts` | 交易订单（direction / status / price / quantity） |
| `Signal` | `types.signal.ts` | 交易信号（type / symbol / confidence / triggeredAt） |
| `DailyQuotes` | `types.marketData.ts` | 日线/K 线数据 |
| `ExecutionPlan` | `types.execution.ts` | 执行计划（phases / riskChecks） |
| `Portfolio` | `types.portfolio.ts` | 投资组合（holdings / theme / metrics） |
| `UnifiedStockData` | 由 `unifiedStockService` 聚合产出 | 数据融合统一契约，被 store 与各页面消费 |

> **字段级定义** → 查询 [数据字典索引](../archive/normal/explanation/data-dictionary-index.md)（已归档）。

---

## 6. QueryBuilder 查询构造

### 6.1 定位

`QueryBuilder`（`src/data/queryBuilder.ts`）提供**绕开 Store 的综合查询**能力，一次性获取单只股票在多维度上的数据，避免组件层发起多次独立 store 查询。

### 6.2 查询参数（zod 校验）

```typescript
const unifiedStockQuerySchema = z.object({
  symbol: z.string().min(1),
  includeBasic: z.boolean().optional(),           // 股票基础信息
  includeQuotes: z.boolean().optional(),          // K 线行情
  includeV6Score: z.boolean().optional(),         // V6 评分
  includeIntelligentScore: z.boolean().optional(), // 智能评分
  includeIndustryScore: z.boolean().optional(),   // 行业评分
  includeSignals: z.boolean().optional(),         // 交易信号
  includeNews: z.boolean().optional(),            // 关联新闻
})
```

### 6.3 执行模型

- **并发查询**：各维度通过 `Promise.all(tasks)` 并行执行
- **Partial Success**：单维度失败仅记入 `errors` 字段，不影响其余维度
- **返回类型**：`Result<QueryBuilderResult>`（与 S-01 统一 Result 约定一致）
- **批量接口**：`queryStocksBatch(symbols, params)` — 串行逐标查询避免 IndexedDB 事务竞争

### 6.4 内部实现要点

| 维度 | dataLayer 调用 |
|------|---------------|
| 基础信息 | `dataLayer.stocks.get(symbol)` |
| 行情 | `dataLayer.dailyQuotes.get(symbol)` |
| V6 评分 | `dataLayer.v6Scores.get(symbol)` |
| 智能评分 | `dataLayer.intelligentScores.getLatestBySymbol(symbol)` |
| 行业评分 | `dataLayer.industryScores.getLatestByCode(industryCode)` |
| 交易信号 | `dataLayer.signals.listBySymbol(symbol)` |
| 关联新闻 | `dataLayer.newsStockMap.listBySymbol(symbol)` → `dataLayer.news.get(newsId)` |

---

## 7. 数据流全景

### 7.1 标准写入流（外部数据 → IndexedDB）

```
外部 API（akshare / 手动导入 / LLM）
    │
    ▼
src/services/fetcher/          ← fetcherService / orchestrator / adapters
    │
    ▼
DataBridge.forward(envelope)   ← 核心桥接层（src/core/databridge.ts）
    │
    ├── ACL 校验（aclEngine.assert）
    ├── 审计日志（researchLogs store）
    └── 路由 → routeToDB / routeToStrategy / routeToEvent
    │
    ▼
dataLayer.{store}.put(...)     ← src/data/dataLayer*.ts domain store
    │
    ▼
V6Database.put(store, value)   ← src/data/db.ts（IndexedDB 事务）
    │
    ▼
IndexedDB（浏览器本地）
    │
    ▼
EventBus.broadcast("{store}:changed")  ← 触发 store 层重新拉取
```

### 7.2 标准读取流（IndexedDB → UI）

```
IndexedDB
    │
    ▼
V6Database.get / getAll / getAllByIndex
    │
    ▼
dataLayer / queryBuilder / Repository  ← 读统一入口
    │
    ▼
DataBridge.query(request)      ← 可选：带缓存与 ACL
    │
    ▼
src/services/{domain}/         ← 业务服务层（如 scoring / trading / news）
    │
    ▼
src/store/{domain}Store.ts     ← Zustand Store（withBroadcast 跨 Tab）
    │
    ▼
src/pages/ 或 src/components/  ← UI 层（仅通过 Store 获取数据）
```

### 7.3 分层依赖约束

```
┌─────────────────────────────────────────────┐
│  UI 层（pages / components / portal / apps） │
│  ─── 只能依赖 store/ 和 services/ ───       │
├─────────────────────────────────────────────┤
│  Store 层（49 个 Zustand Store）             │
│  ─── 只能依赖 services/ 和 core/ ───        │
├─────────────────────────────────────────────┤
│  Services 层（24 子域）                      │
│  ─── 只能依赖 core/、data/、lib/（白名单） ─ │
│  ─── 禁止直接写 db；通过 DataBridge.forward() │
├─────────────────────────────────────────────┤
│  Data 层（本层）                             │
│  ─── 只能依赖 core/、config/、lib/、types/ ─ │
├─────────────────────────────────────────────┤
│  Core 层（DataBridge / ACL / Envelope /     │
│  MemoryCache / EventBus）                    │
│  ─── 禁止依赖 pages / components / lib/ ─── │
└─────────────────────────────────────────────┘
```

> 完整分层规则见 [AGENTS.md §一](../../AGENTS.md)。

---

## 8. Repository 统一仓储契约（D-02）

`repository.ts` 提供 **Repository<T>** 接口与 `createRepository()` 工厂函数，目标是为分散在 53+ store 中的异构数据访问提供统一契约。

```typescript
export interface Repository<T, TKey = string> {
  readonly store: StoreName
  get(key: TKey): Promise<T | undefined>
  getAll(): Promise<T[]>
  queryByIndex(indexName: string, value: unknown): Promise<T[]>
  put(entity: T, key: TKey): Promise<DataLayerResult<void>>
  delete(key: TKey): Promise<DataLayerResult<void>>
}
```

- **读取**：直接委托 `dataBridge.query()`（与 dataLayer 同源）
- **写入**：委托 `dataBridge.forward()`，复用各 store 既有 envelope action
- **不新增 action**：保证与既有 DataBridge 路由完全兼容

> **TODO**：D-03 消除直连 IndexedDB 旁路的迁移进度，由数据层负责人维护跟踪表。

---

## 9. 数据字典索引

所有字段级数据字典统一在以下索引中管理：

→ **[数据字典索引](../archive/normal/explanation/data-dictionary-index.md)（已归档）**

该索引维护：
- 1 份整合主字典（`../reference/data-definition.md`（已归档））— 全模块字段定义 SSOT
- 7 份独立域定义（命名规范 `*-data-definition.md`）
- `UnifiedStockData` 统一数据模型锚点

**查询路径**：字段定义 → 先查 `../reference/data-dictionary-index.md`（已归档） → 再进入对应文件，禁止在别处新建副本。

---

## 10. 验证命令速查

| 命令 | 用途 | 期望结果 |
|------|------|---------|
| `npx tsc --noEmit` | 类型安全检查 | 0 errors |
| `npm run audit:layers` | 跨层调用审计 | 0 violations, 0 warnings |
| `npm run audit:docs` | 文档同步检查 | 索引与引用一致 |
| `npm run audit:hardcode` | 硬编码颜色/数字扫描 | 0 违规 |
| `npm test -- --run` | 单元测试 | 全部通过 |
| `npm run build` | 生产构建 | 成功 |

---

## 11. TODO 清单（待扩写）

以下节点需由架构组或模块 owner 补充完善：

- [ ] **§2.1** — 补充每个基线 store 的完整字段表（或引用数据字典具体章节）
- [ ] **§3.3** — 补充 DataBridge 路由时序图（Mermaid 序列图）
- [ ] **§4.4** — 新增 Store 决策树流程图（基线 vs 增量 vs Handler 注册）
- [ ] **§6** — QueryBuilder 的缓存策略与降级方案（当前无缓存，待评估）
- [ ] **§7.1** — fetcher → DataBridge 的 envelope 构造示例代码（至少 2 个典型场景）
- [ ] **§8** — Repository 实际使用示例与已迁移 store 清单（D-03 进度）
- [ ] **§12** — dataLayer 各 domain store 的 CRUD 接口速查表（自动生成脚本）

---

_本文档由文档治理流程创建，遵循 `../../AGENTS.md` §三 文档规范（Frontmatter / kebab-case / 引用代替副本）。如有 Schema 变更，请同步更新本文件并运行 `npm run audit:docs` 检查索引一致性。_
