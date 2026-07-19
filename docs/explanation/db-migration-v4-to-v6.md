---
title: V6ProDB IndexedDB 升级规范（v4 → v6）
type: explanation
domain: data
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 1. 概述 本文档规定 `V6ProDB` 从版本 `4` 升级到版本 `6` 的完整步骤，包括新增 Store、索引变更、历史数据兼容处理及未来升级规范。"
tags: [data, registry, migration]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-069
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25

# V6ProDB IndexedDB 升级规范（v4 → v6）

## 1. 概述

| 项目 | 值 |
|------|-----|
| 数据库名 | `V6ProDB` |
| 当前版本 | `6` |
| 升级入口 | `src/data/db.ts` 的 `request.onupgradeneeded` |
| 升级方式 | 逐版本递进（sequential），不可逆 |

本文档规定 `V6ProDB` 从版本 `4` 升级到版本 `6` 的完整步骤，包括新增 Store、索引变更、历史数据兼容处理及未来升级规范。

---

## 2. 逐版本升级说明

### 2.1 v3 → v4：行情与信号 Store

**变更内容**：
- 新增 `daily_quotes` Store，用于保存 K 线 / 行情数据。
- 新增 `signals` Store，用于保存交易信号。

**Schema**：
| Store | KeyPath | 索引 |
|------|---------|------|
| `daily_quotes` | `symbol` | 无 |
| `signals` | `id` | 无 |

**兼容处理**：
- 首次创建时直接 `createObjectStore`。
- 若 Store 已存在（理论上不存在，因 v3 无此 Store），跳过创建。

---

### 2.2 v4 → v5：`stocks` 新增分组字段与索引

**变更内容**：
- `stocks` Store 新增 `group` 字段。
- `stocks` Store 新增 `by-group` 索引，按分组快速查询股票池。

**升级逻辑**：
1. 若 `stocks` Store 不存在，创建 Store 并同时建立 `by-status` 与 `by-group` 索引。
2. 若 `stocks` Store 已存在：
   - 通过 `request.transaction.objectStore(STORE_NAME.stocks)` 获取 Store。
   - 检查 `indexNames` 中是否已包含 `by-group`；若未包含，则 `createIndex('by-group', 'group', { unique: false })`。
   - 打开游标遍历全部历史数据，对缺失 `group` 字段的记录回写为默认分组 `DEFAULT_POOL_GROUP`。

**默认值**：
```ts
const DEFAULT_POOL_GROUP = 'DEFAULT_POOL_GROUP'
```

> **注意**：该回写是一次性数据迁移，升级完成后旧数据即具备 `group` 字段，后续业务层可直接依赖该字段。

---

### 2.3 v5 → v6：V6 Pro 迁移专用 Store

**变更内容**：新增 8 个 Store，支撑 V6 Pro JSON 全量导出数据迁移至 V9 IndexedDB。

| Store | KeyPath | 索引 |
|------|---------|------|
| `rotation_scores` | `id` | `by-sector-date`（`[sectorCode, scoreDate]`，唯一）、`by-sector`、`by-total`、`by-resonance` |
| `sector_scores` | `id` | `by-sector`、`by-composite`、`by-is-core` |
| `score_docs` | `docId` | `by-symbol`、`by-symbol-version`（`[symbol, version]`，唯一）、`by-composite` |
| `strategy_snapshots` | `id` | `by-version`（唯一）、`by-date`、`by-timestamp` |
| `local_docs` | `id` | `by-symbol`、`by-category`、`by-added-at` |
| `news` | `id` | `by-source`、`by-category`、`by-publish-time`、`by-hash`（唯一） |
| `news_stock_map` | `id` | `by-symbol`、`by-news` |
| `sentiment_cache` | `id` | `by-content-hash`（唯一）、`by-analyzed-at` |

**升级逻辑**：
- 每个 Store 独立判断 `db.objectStoreNames.contains(storeName)`。
- 不存在则创建，并一并建立对应索引；已存在则跳过。
- 因这些 Store 在 v5 之前不存在，历史数据为空，无需额外回写。

---

## 3. 升级实现位置

所有升级逻辑集中在：

```ts
// src/data/db.ts
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result
  // v3 → v4 / v4 → v5 / v5 → v6 的递进处理...
}
```

**代码组织要求**：
- 禁止在 `onupgradeneeded` 外部直接修改 `DB_VERSION` 来触发升级。
- 每个版本分支需使用 `if (!db.objectStoreNames.contains(...))` 做幂等判断，确保重复执行不会报错。
- 对已有 Store 的索引变更，必须先通过 `request.transaction` 获取 upgrade transaction，再调用 `createIndex`。

---

## 4. 回退与兼容策略

### 4.1 升级不可逆

IndexedDB 的 `onupgradeneeded` 只能向前升级，不支持自动回滚。因此：
- 任何 Schema 变更发布前，必须在测试环境完整验证。
- 生产环境升级失败时，不能依赖浏览器回退版本号。

### 4.2 历史数据迁移方式

- 字段默认值回写：使用 IndexedDB 游标（`openCursor()`）逐条读取并 `cursor.update()`。
- 批量数据迁移：若未来需要在升级时跨 Store 搬移数据，应在 upgrade transaction 内完成，避免部分成功。

### 4.3 升级失败应急预案

若用户浏览器中数据库损坏或升级事务中断：
1. **导出备份**：引导用户通过 `dataLayer.export()` 或 `dataManager.export()` 导出可读 JSON。
2. **删除并重建数据库**：调用 `indexedDB.deleteDatabase(DB_NAME)` 清除旧库。
3. **恢复数据**：重新打开应用后，通过迁移面板导入备份 JSON。

> 该流程仅作为最后手段，正常升级应保证事务内完成。

---

## 5. 未来升级规范

1. **禁止直接改 `DB_VERSION` 跳版**：
   - 必须从当前版本 `N` 逐条处理到目标版本 `N+1`，不得在 `onupgradeneeded` 中按 `event.oldVersion` 写死分支后跳过中间版本。
2. **每个版本一个独立代码块**：
   - 使用 `if (event.oldVersion < X)` 包裹第 `X` 版本的升级逻辑，确保从任意旧版本启动都能正确执行全部升级步骤。
3. **新增 Store 必须幂等**：
   - 始终先检查 `db.objectStoreNames.contains(storeName)`。
4. **已有 Store 加索引必须幂等**：
   - 始终先检查 `store.indexNames.contains(indexName)`。
5. **数据回写必须防御性**：
   - 对历史记录做 `undefined` / `null` 判断，避免把有效旧值覆盖为默认值。
6. **Schema 变更需同步文档**：
   - 每次修改 `src/data/db.ts` 的升级逻辑后，必须同步更新本文档的"逐版本升级说明"。

---

## 6. 相关文件

- `src/data/db.ts`：升级实现。
- `src/config/dbConfig.ts`：`DB_NAME`、`DB_VERSION`、`DEFAULT_POOL_GROUP`、`STORE_NAME` 定义。
- `../reference/v6-to-v9-migration-spec.md`：V6 Pro JSON 迁移转换规范。
- `./2026-06-25-v6-migration.md`：V6 Pro 全量导出迁移决策记录。
