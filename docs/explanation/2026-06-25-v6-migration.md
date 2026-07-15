---
title: 2026-06-25-v6-migration
code_version: 2.0.0

tier: reference
---

---
title: ADR-009: V6 Pro JSON 全量导出迁移至 V9 IndexedDB
version: v0.9.0
last_updated: 2026-06-25
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-25
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
code_version: 2.0.0
tier: reference
---
> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25

# ADR-009: V6 Pro JSON 全量导出迁移至 V9 IndexedDB

- **状态**：Accepted
- **日期**：2026-06-25
- **决策人**：待指定

---

## 背景

V6 Pro 在浏览器端积累了大量用户数据，包括自选股、评分、板块轮动、策略快照、本地知识库、资讯等。V9 与 V6 Pro 共用同一个 IndexedDB 数据库名 `V6ProDB`，无法在同一浏览器中同时打开两个版本的实例，因此必须采用"导出 → 转换 → 导入"的离线 JSON 迁移方式。

需要决策的关键问题：
1. V9 迁移入口应接受哪种 V6 导出格式？
2. 需要迁移哪些 store？
3. 数据冲突时默认跳过还是覆盖？
4. V6 特有但 V9 暂无直接对应 store 的数据如何处理？

---

## 选项

### 选项 A：仅接受 `dataManager.export()` 全量导出

- 接受底层全量导出 JSON（下划线 store key，覆盖 16 个 store）。
- 在 V9 侧实现 12 个核心 store 的转换函数。
- V6 特有 store（`v6_reports`、`score_history`、`concepts`、`strategies`）暂不导入，但保留扩展点。

| 优点 | 缺点 |
|------|------|
| 数据完整，store key 与 V9 一致 | 无 `version`、`exportTime` 元信息，需在导入时补充 |
| 转换逻辑可回归测试，可审计 | 用户需通过开发者工具或 V6 调试入口导出 |

### 选项 B：兼容 `dataLayer.manager.export()` 业务层导出

- 同时支持下划线 key 全量导出与 camelCase key 业务层导出。
- 对缺失 store 给出明确提示或部分导入。

| 优点 | 缺点 |
|------|------|
| 用户导出路径更友好 | 业务层导出缺失 V6 Pro 核心 store（`sector_scores`、`rotation_scores`、`score_docs` 等） |
| 兼容性好 | 需要维护两套转换逻辑，增加复杂度和测试成本 |

### 选项 C：在 V6 侧补齐业务层导出后再迁移

- 先在 V6 源码中扩展 `DataExport`，使其覆盖全部 16 个 store，再迁移到 V9。

| 优点 | 缺点 |
|------|------|
| 导出结构更规范，带元信息 | 需要修改并重新发布 V6 Pro，周期长 |
| | 与"仅做 V9 迁移"的目标冲突 |

---

## 决策

**采用选项 A**：V9 迁移功能仅接受 `dataManager.export()` 全量导出。

### 决策理由

1. **数据完整性**：`dataManager.export()` 覆盖全部 16 个 store，包含 V6 Pro 核心数据，避免因导出口径不一致导致用户数据丢失。
2. **转换唯一性**：以单一 JSON shape 作为输入，减少分支逻辑和回归测试矩阵。
3. **实现可控**：全量导出的 store key 与 V9 `STORE_NAME` 一致，可直接映射，无需额外名称转换。
4. **元信息可补充**：缺失的 `version`、`exportTime` 可在 V9 侧读取 JSON 时自动附加，不影响功能。

---

## 实施范围

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/services/system/v6MigrationService.ts` | 迁移服务入口：解析 JSON、按顺序导入、冲突处理 |
| `src/services/v6Migration/converters/*.ts` | 12 个核心 store 的转换函数 |
| `src/components/organisms/system/MigrationPanel.tsx` | 迁移面板 UI：选择文件、显示进度、跳过/覆盖选项 |
| 对应 `*.test.ts` / `*.test.tsx` | 19 个单元测试 |

### 转换的 12 个核心 store

1. `stocks`
2. `daily_quotes`
3. `v6_scores`
4. `orders`
5. `sector_scores`
6. `rotation_scores`
7. `score_docs`
8. `strategy_snapshots`
9. `local_docs`
10. `news`
11. `news_stock_map`
12. `sentiment_cache`

### 导入顺序

导入必须按依赖关系执行，例如：
1. `stocks`（被 `daily_quotes`、`score_docs`、`news_stock_map` 等依赖）
2. `daily_quotes`、`v6_scores`、`orders`
3. `sector_scores`、`rotation_scores`
4. `score_docs`、`strategy_snapshots`
5. `local_docs`、`news`
6. `news_stock_map`、`sentiment_cache`

### 冲突策略

- **默认行为**：按目标 store 的 keyPath 先查询；若已存在，**跳过**（保留 V9 现有数据）。
- **可选行为**：用户在 `MigrationPanel` 勾选"覆盖已有数据"后，执行 **覆盖** 写入。

---

## 影响

- 新增 `v6MigrationService.ts` 作为迁移逻辑的唯一入口。
- 新增 `MigrationPanel.tsx`，集成到设置/系统迁移页面。
- 新增 12 个转换函数，每个函数对应一个 V6 → V9 store 映射。
- 新增 19 个单元测试，覆盖转换函数、去重策略、错误处理。
- V9 IndexedDB 版本从 v5 升级到 v6，新增 8 个迁移相关 Store（见 `./db-migration-v4-to-v6.md`）。

---

## 反对意见与回退

### 反对意见

- V6 特有 store（`v6_reports`、`score_history`、`concepts`、`strategies`）未被导入，可能导致用户认为"数据丢失"。
- 仅支持全量导出，对不熟悉开发者工具的用户不够友好。

### 回退与扩展点

1. **暂不导入的 store 保留扩展点**：
   - `v6MigrationService.ts` 中已识别这些 store，但转换函数返回空数组或占位对象。
   - 后续决策改为导入时，只需补充对应 converter，无需改动迁移流程。
2. **业务层导出兼容**：
   - 若未来需要在 V9 侧兼容 `dataLayer.manager.export()` 的 camelCase JSON，可在解析层增加 shape 归一化步骤。
3. **数据库回退**：
   - 若迁移导致数据库异常，用户可导出备份 → `indexedDB.deleteDatabase('V6ProDB')` → 重新导入。

---

## 相关文档

- `../reference/v6-to-v9-migration-spec.md`：详细转换规范。
- `./db-migration-v4-to-v6.md`：IndexedDB 升级规范。
