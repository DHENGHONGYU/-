---
title: registry-fill-checklist-V9-DOC-QA
type: report
domain: qa
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "V9-DOC-QA 待补齐登记专项清单（源自 registry-doc-id-audit-2026-08-13）——24 条已标注 doc_id 但未登记，QA-116 优先处理"
tags: [qa, registry, doc_id, checklist, governance]
version: v1.0.0
last_updated: 2026-08-13
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-REP-REGQA-001
related_docs: [V9-DOC-QA-116]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-08-13
---

# V9-DOC-QA 待补齐登记专项清单

> **来源**：[registry-doc-id-audit-2026-08-13](registry-doc-id-audit-2026-08-13.md) §A
> **目标**：将下列 24 条已在文档 frontmatter 标注 `doc_id` 但缺失于 [doc-id-registry.md](../meta/doc-id-registry.md) 的 QA 类条目补齐登记
> **登记位置**：`docs/meta/doc-id-registry.md` 的 QA 区块（按 doc_id 数值升序插入）
> **优先级**：⭐ **QA-116 优先**（本次 git-commit-governance 相关，用户明确要求）

## 处理步骤

1. 从 ⭐ QA-116 开始核对 frontmatter 是否存在对应 doc_id
2. 在 `docs/meta/doc-id-registry.md` 新增行：`| <doc_id> | qa | <title> | <相对 docs/ 的路径> |`
3. 勾选清单 `[ ]` → `[x]`
4. 完成后运行 `npm run audit:docs` 复核

## 清单（24 条）

| # | 优先级 | 完成 | doc_id | 文档路径 |
|---|--------|------|--------|----------|
| 1 | ⭐ | [ ] | V9-DOC-QA-116 | docs/guides/how-to/how-to-use-audit-scripts.md |
| 2 | | [ ] | V9-DOC-QA-021 | docs/explanation/ai-generate-audit-fix-loop.md |
| 3 | | [ ] | V9-DOC-QA-024 | docs/reference/changelogs/2026-07/2026-07-05-ui-testing-optimization.md |
| 4 | | [ ] | V9-DOC-QA-025 | docs/reference/changelogs/2026-07/pr-8-dedup-audit-report.md |
| 5 | | [ ] | V9-DOC-QA-026 | docs/explanation/design/quality-audit-plan.md |
| 6 | | [ ] | V9-DOC-QA-027 | docs/reference/2026-07-04-ui-testing-optimization.md |
| 7 | | [ ] | V9-DOC-QA-028 | docs/reference/ai-generate-audit-fix-loop.md |
| 8 | | [ ] | V9-DOC-QA-029 | docs/reports/testing/README_testing.md |
| 9 | | [ ] | V9-DOC-QA-030 | docs/reference/changelogs/2026-07/2026-07-05-comprehensive-audit-and-remediation.md |
| 10 | | [ ] | V9-DOC-QA-034 | docs/reference/v9-code-quality-audit-report-20260629.md |
| 11 | | [ ] | V9-DOC-QA-036 | docs/reports/testing/sector-stocks-ui-acceptance-checklist.md |
| 12 | | [ ] | V9-DOC-QA-048 | docs/reference/changelogs/2026-07/test-cache-fix-summary.md |
| 13 | | [ ] | V9-DOC-QA-049 | docs/reference/backtest-contract.md |
| 14 | | [ ] | V9-DOC-QA-051 | docs/reference/audit-b4-1-code-quality.md |
| 15 | | [ ] | V9-DOC-QA-064 | docs/guides/how-to/testing/complexity-remediation-plan.md |
| 16 | | [ ] | V9-DOC-QA-065 | docs/guides/09-quality-gates.md |
| 17 | | [ ] | V9-DOC-QA-074 | docs/reference/audit-b4-4-security.md |
| 18 | | [ ] | V9-DOC-QA-082 | docs/explanation/design/quality-assurance-strategy.md |
| 19 | | [ ] | V9-DOC-QA-100 | docs/explanation/penetration-test-report.md |
| 20 | | [ ] | V9-DOC-QA-101 | docs/explanation/v9-code-quality-audit-report-20260713.md |
| 21 | | [ ] | V9-DOC-QA-102 | docs/explanation/v9-code-quality-audit-report-20260629.md |
| 22 | | [ ] | V9-DOC-QA-106 | docs/explanation/audit-b4-2-test-quality.md |
| 23 | | [ ] | V9-DOC-QA-108 | docs/guides/standards/quality-gates.md |
| 24 | | [ ] | V9-DOC-QA-110 | docs/assets/articles/01-tutorial-audit-workflow.md |

## 注意事项

- **#8（V9-DOC-QA-029）** 与另一文档共用 doc_id（见重复冲突清单第 3 组），登记前需先裁定保留哪个文件占用该 id，避免重复登记。
- **#21（V9-DOC-QA-102）** 与 **#10（V9-DOC-QA-034）** 指向 `v9-code-quality-audit-report-20260629.md` 的同名不同路径版本（`explanation/` 与 `reference/`）——需人工核对是否为迁移残留，避免重复编号。
