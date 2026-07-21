---
title: ADR-002: IndexedDB 替代 localStorage
type: reference
domain: data
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Architecture Decision Record: IndexedDB 替代 localStorage"
tags: [data, adr, registry, store, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-035
referenced_by: [V9-DOC-META-000, V9-DOC-PROD-005, V9-DOC-DATA-056, V9-DOC-PROJ-176, V9-DOC-PROJ-156, V9-DOC-PROJ-149, V9-DOC-ARCH-013]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-002: IndexedDB 替代 localStorage

> **状态**: Accepted  
> **决策日期**: 2026-06-20  
> **版本**: v1.0.0

---

## 1. 背景（Context）

V9 作为纯前端系统（ADR-001），需要本地持久化方案存储股票行情、评分、交易记录等数据。V6 阶段使用 localStorage 作为持久化方案，但遇到以下瓶颈：

- **容量限制**：localStorage 仅 5MB，无法存储全量 A 股日 K 数据（> 3000 只股票 × 数年数据）。
- **性能问题**：localStorage 同步读写，大容量数据解析阻塞 UI 线程。
- **数据结构**：localStorage 仅支持字符串键值对，无法支持复杂查询、索引、事务。
- **缺乏版本管理**：localStorage 无 Schema 版本概念，数据迁移困难。

### 触发条件

- 2026-06-20 架构评审：确认 V9 数据量将超过 10MB（全量日 K + 财报 + 评分）。
- 用户反馈：V6 在数据量 > 3MB 时出现明显卡顿。

---

## 2. 决策（Decision）

**采用 IndexedDB 作为 V9 唯一本地持久化方案，替代 localStorage。**

- 所有业务数据（stocks、daily_quotes、v6_scores、orders 等）存储于 IndexedDB。
- localStorage 仅保留极小量配置项（如 `theme` 偏好、API Key 加密存储）。
- Schema 变更必须递增 `DB_VERSION`（`src/config/dbConfig.ts`）。
- 新增 Store 须在 `STORE_NAME` 注册，并在 `ACL_MATRIX` 中配置读写权限。

### 决策理由

- **Why not localStorage**：容量、性能、结构均不满足需求。
- **Why not SQLite（via wasm）**：增加 ~1MB 包体积，且需要额外的 wasm 加载和 CORS 配置；IndexedDB 原生支持，无需额外依赖。
- **Why not OPFS（Origin Private File System）**：Chrome-only，兼容性差；IndexedDB 支持所有现代浏览器。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. IndexedDB**（最终选择） | 原生支持、容量大（~50MB+）、支持索引/事务/查询 | API 较底层（Promise 封装需自行处理） | ? 采纳 |
| **B. localStorage** | 简单、同步 API | 容量 5MB、无索引、阻塞 UI | ? 否决 |
| **C. SQLite via sql.js** | 关系型查询、事务完整 | 包体积大、wasm 加载慢、CORS 问题 | ? 否决 |
| **D. OPFS** | 文件系统 API、高性能 | Chrome-only、兼容性差 | ? 否决（V10 可重新评估） |

---

## 4. 后果（Consequences）

### 正面影响

- 容量从 5MB 扩展到 50MB+，可存储全量 A 股数据。
- 异步读写，不阻塞 UI 线程。
- 支持索引和范围查询，数据分析效率提升。
- Schema 版本管理（`DB_VERSION`）使数据迁移可控。

### 负面影响 / 技术债

- IndexedDB API 较底层，需要封装 `dataLayer` 提供友好接口。
  - **缓解**：已封装 `dataLayer.ts` 提供 CRUD + 查询 + 事务抽象。
- 浏览器隐私模式下 IndexedDB 可能不可用（iOS Safari 无痕模式）。
  - **缓解**：启动时检测 IndexedDB 可用性，不可用降级到内存模式 + 提示用户。
- Schema 升级时旧数据迁移需要手动处理。
  - **缓解**：`db-migrations.ts` 提供 Migration 接口，每次升级编写迁移脚本。

### 影响范围

| 模块 | 影响 |
|------|------|
| `src/data/` | 新增 dataLayer、db-schema、db-migrations、types |
| `src/config/dbConfig.ts` | DB_VERSION、STORE_NAME、ACL_MATRIX 定义 |
| `src/services/` | 所有写操作经 DataBridge → dataLayer → IndexedDB |
| `src/store/` | Store 初始化时从 IndexedDB 读取种子数据 |

---

## 5. 实施与验证

### 实施步骤

- [x] Step 1：选择 IndexedDB 封装库（原生 API + 自行封装 dataLayer）
- [x] Step 2：定义基线 Schema（30 个 Store，v27）
- [x] Step 3：实现 `db-schema.ts`（`createSchema`）和 `db-migrations.ts`（`Migration` 接口）
- [x] Step 4：实现 `dataLayer.ts`（CRUD + 查询 + 事务）
- [ ] Step 5：补充 IndexedDB 不可用时的降级方案（内存模式）
- [ ] Step 6：性能基准测试（写入 1000 条记录 < 1s，查询 < 100ms）

### 验证命令

```bash
npm run test:clean   # 验证数据层测试
npm run audit:docs   # 验证文档同步
```

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| ADR-001（纯前端架构） | `../explanation/adr-001-pure-frontend-architecture.md` |
| ADR-003（DataBridge） | `adr-003-databridge-over-direct-datalayer.md` |
| 数据层总览 | `../explanation/data-layer-overview.md` |
| 原始提案 | `./2026-06-20-indexeddb-over-localstorage.md` |

---

## 7. 状态变更记录

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-20 | proposed | @architect | 初始提案 |
| 2026-06-20 | accepted | 架构组 | 评审通过 |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR v1.0.0 |
