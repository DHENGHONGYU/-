---
title: registry-duplicate-docid-3-groups
type: report
domain: project
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "doc-id 注册表 3 组重复 doc_id 冲突详情与裁定建议（源自 registry-doc-id-audit-2026-08-13 §D）"
tags: [project, registry, doc_id, duplicate, conflict, governance]
version: v1.0.0
last_updated: 2026-08-13
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-REP-REGDUPL-001
related_docs: [V9-DOC-PROJ-186]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-08-13
---

# doc-id 注册表重复冲突详情（3 组）

> **来源**：[registry-doc-id-audit-2026-08-13](registry-doc-id-audit-2026-08-13.md) §D
> **性质**：多个文档 frontmatter 共用同一 `doc_id` → 注册表登记时无法一一对应，必须裁定保留谁、改谁

---

## 组 1：V9-DOC-DATA-030

| 竞争文件 | 相对 docs/ 路径 | 状态 |
|----------|----------------|------|
| 文件 A | `explanation/adr-015-duckdb-wasm-timeseries.md` | 需核对 |
| 文件 B | `guides/development/data-flow-convergence-plan.md` | 需核对 |

**初步判断**：从文件名看，`adr-015-duckdb-wasm-timeseries`（DuckDB WASM 时序）为 **ADR 决策记录**，`data-flow-convergence-plan`（数据流收敛计划）为**方案/计划类**，两者主题差异大，属「误复用同一编号」。建议：保留其中与 `DATA-030` 语境更契合者，另一文件改取新 doc_id 或删除重复。

**待人工裁定**：
- [ ] 打开两文件核对 frontmatter `doc_id` 与 `title`
- [ ] 裁定保留哪个为 `V9-DOC-DATA-030`
- [ ] 另一文件：改新 id 或删除

---

## 组 2：V9-DOC-DATA-029

| 竞争文件 | 相对 docs/ 路径 | 状态 |
|----------|----------------|------|
| 文件 A | `explanation/design/profile-eight-domains-design.md` | 需核对 |
| 文件 B | `reference/adr-014-vector-search-over-tfidf.md` | 需核对 |

**初步判断**：`adr-014-vector-search-over-tfidf`（向量检索 vs TF-IDF）是 **ADR 决策记录**；`profile-eight-domains-design`（八域画像设计）是**设计文档**。同样疑似误复用。且 `DATA-029`/`DATA-030` 相邻，推测当时批量生成存在编号错位。

**待人工裁定**：
- [ ] 打开两文件核对 frontmatter
- [ ] 裁定保留哪个为 `V9-DOC-DATA-029`
- [ ] 另一文件：改新 id 或删除

---

## 组 3：V9-DOC-QA-029

| 竞争文件 | 相对 docs/ 路径 | 状态 |
|----------|----------------|------|
| 文件 A | `reports/testing/README.md` | 需核对 |
| 文件 B | `reports/testing/README_testing.md` | 需核对 |

**初步判断**：`README.md` 与 `README_testing.md` 位于**同一目录 `reports/testing/`**，疑似同一测试报告目录的「正式版 + 自动生成版」双份残留。属于明显的**重复文件**，建议直接保留一个、删除另一个（或二选一作为该目录 README）。

**待人工裁定**：
- [ ] 对比两文件内容差异（正式 vs 自动生成）
- [ ] 裁定保留 `README.md` 还是 `README_testing.md`
- [ ] 删除另一个，确保该目录只有一个 README
- [ ] 完成后登记 `V9-DOC-QA-029`（见 QA 专项清单 #8）

---

## 裁定后动作

1. 保留的 doc_id → 在 [doc-id-registry.md](../meta/doc-id-registry.md) 登记唯一路径
2. 被改/被删文件的 frontmatter 同步修正
3. 运行 `npm run audit:docs` 复核重复清零
