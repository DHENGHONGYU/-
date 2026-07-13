# DataBridge 主题包（Topic: DataBridge）

> **定位**：聚合所有与 DataBridge 相关的文档、ADR、契约、数据定义，消除「DataBridge 散落 5 个目录」的信息孤岛。  
> **主题包路径**：`docs/topics/databridge/`  
> **创建日期**：2026-07-12  
> **消费方式**：从本索引进入，按需深入对应文档；不逐个扫描全仓库。

---

## 1. 核心概念

**DataBridge** 是 V9 数据层的核心路由网关，承担以下职责：

- **路由写入**：所有 Service 层写入 IndexedDB 必须经过 `DataBridge.forward()` → `routeToDB()`，禁止直写 db。
- **ACL 权限**：`ENVELOPE_ACTION` 白名单控制（CREATE/UPDATE/DELETE/READ/BATCH/SYNC/MIGRATE）。
- **数据流枢纽**：`fetcher → DataBridge → dataLayer → IndexedDB` 构成标准写入链路。
- **Schema 升级**：新增 Store 必须同步更新 `DB_VERSION` + `STORE_NAME` + `ACL_MATRIX` + `createSchema`。

---

## 2. 文档索引（按主题分组）

### 2.1 架构决策与链路分析

| 文档 | 路径 | 核心内容 | 类型 |
|------|------|----------|------|
| ADR-003: DataBridge 替代直接 dataLayer 写入 | `../../06-project-management/2026-06-21-databridge-over-direct-datalayer.md` | 为什么引入 DataBridge、替代方案对比、决策后果 | ADR |
| DataBridge 数据链路全景分析报告 | `../../02-design/《DataBridge数据链路全景分析报告》.md` | 完整链路图、瓶颈分析、优化建议 | 分析 |
| DataBridge 端点与数据映射清单 | `../../01-requirements/《DataBridge端点与数据映射清单》.md` | 端点定义、字段映射、数据流向 | 契约 |
| 数据层总览 | `../../modules/data-layer-overview.md` | 30+6 Store 清单、DataBridge 路由机制、QueryBuilder | 总览 |

### 2.2 整改与实施

| 文档 | 路径 | 核心内容 | 类型 |
|------|------|----------|------|
| DataBridge 改进建议整改实施计划 | `../../01-requirements/《DataBridge改进建议整改实施计划》.md` | 整改步骤、任务拆分、验收标准 | 计划 |
| DataBridge 改进建议整改报告 | `../../02-design/《DataBridge改进建议整改报告》.md` | 整改结果、问题根因、后续建议 | 报告 |

### 2.3 数据定义（经 P1-1 迁移至 standards/）

| 文档 | 路径 | 核心内容 |
|------|------|----------|
| 数据字典索引 | `../../standards/DATA_DICTIONARY_INDEX.md` | 所有 DATA_DEFINITION 的 SSOT 索引 |
| 数据流数据定义 | `../../standards/dataflow-data-definition.md` | DataFlow Engine 数据结构 |
| 数据层总览 | `../../modules/data-layer-overview.md` | DataBridge 路由、ENVELOPE_ACTION、QueryBuilder |

### 2.4 代码层锚点

| 代码文件 | 路径（相对 src/） | 说明 |
|----------|-------------------|------|
| `DataBridge.ts` | `src/core/DataBridge.ts` | 核心路由类（forward/routeToDB） |
| `db-schema.ts` | `src/data/db-schema.ts` | 基线 Store 创建（29+6） |
| `db-migrations.ts` | `src/data/db-migrations.ts` | Schema 升级迁移 |
| `types.ts` | `src/data/types.ts` | 数据类型定义（13+ 子模块） |

### 2.4 测试与变更记录

| 文档 | 路径 | 核心内容 | 类型 |
|------|------|----------|------|
| DataBridge 拆分计划 | `../../04-testing/databridge-split-plan.md` | 测试视角的 DataBridge 模块拆分评估 | 测试 |
| DataBridge Query 实现日志 | `../../changelogs/2026-07/2026-07-05-databridge-query-implementation.md` | query 接口实现过程与决策记录 | 变更日志 |

---

## 3. 数据流全景（Mermaid 概要）

```
外部行情/资讯 API
  └─> fetcherService (采集)
        └─> DataBridge.forward(envelope)
              └─> routeToDB() / routeToQuery() / routeToStrategy()
                    └─> dataLayer (IndexedDB)
                          └─> EventBus (跨 Tab 广播)
                                └─> store/* (Zustand + withBroadcast)
                                      └─> components/pages (仅经 Store 取数)
```

**写入规则**：Services → DataBridge → dataLayer → IndexedDB（禁止直写）  
**读取规则**：IndexedDB → dataLayer → Services → Store → UI（允许直连读取）

---

## 4. 使用场景速查

| 场景 | 推荐文档 |
|------|----------|
| 新增 Store 需要 DataBridge 路由 | `../../modules/data-layer-overview.md` §Schema 升级 + `../../ai/service-integration-guide.md` §DataBridge 使用规范 |
| 排查数据写入失败 | `../../02-design/《DataBridge数据链路全景分析报告》.md` + `../../06-project-management/2026-06-21-databridge-over-direct-datalayer.md` |
| 查数据字段定义 | `../../standards/DATA_DICTIONARY_INDEX.md` → 对应域定义 |
| 了解 DataBridge 引入原因 | `../../06-project-management/2026-06-21-databridge-over-direct-datalayer.md`（ADR-003） |

---

## 5. 扩展计划

- [ ] `databridge-envelope-cookbook.md` — 典型 envelope 构造示例（按 action 类型）
- [ ] `databridge-troubleshooting.md` — 常见路由失败排查指南
- [ ] `databridge-performance-tuning.md` — 批量写入/并发优化

---

> **主题包治理**：按 `GOVERNANCE.md` 索引一致性要求，新增 DataBridge 相关文档须在此索引登记。  
> **相关主题**：`../topics/dual-strategy/`（双策略引擎）、`../topics/ai-engineering/`（AI 工程）
