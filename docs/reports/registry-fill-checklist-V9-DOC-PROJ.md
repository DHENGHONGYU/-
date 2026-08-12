---
title: registry-fill-checklist-V9-DOC-PROJ
type: report
domain: project
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "V9-DOC-PROJ 待补齐登记清单（源自 registry-doc-id-audit-2026-08-13）——59 条已标注 doc_id 但未登记到 doc-id-registry.md 的文档"
tags: [project, registry, doc_id, checklist, governance]
version: v1.0.0
last_updated: 2026-08-13
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-REP-REGPROJ-001
related_docs: [V9-DOC-PROJ-186]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-08-13
---

# V9-DOC-PROJ 待补齐登记清单

> **来源**：[registry-doc-id-audit-2026-08-13](registry-doc-id-audit-2026-08-13.md) §A
> **目标**：将下列 59 条已在文档 frontmatter 标注 `doc_id` 但缺失于 [doc-id-registry.md](../meta/doc-id-registry.md) 的条目补齐登记
> **登记位置**：`docs/meta/doc-id-registry.md` 的 PROJ 区块（按 doc_id 数值升序插入）

## 处理步骤

1. 按序核对每条 `doc_id` 对应文件的 frontmatter 是否确实存在该 id
2. 在 `docs/meta/doc-id-registry.md` 新增行：`| <doc_id> | project | <title> | <相对 docs/ 的路径> |`
3. 勾选本清单 `[ ]` → `[x]`
4. 完成后运行 `npm run audit:docs` 复核

## 清单（59 条）

| # | 完成 | doc_id | 文档路径 |
|---|------|--------|----------|
| 1 | [ ] | V9-DOC-PROJ-145 | docs/reports/README_reports.md |
| 2 | [ ] | V9-DOC-PROJ-150 | docs/reference/project/plans/README.md |
| 3 | [ ] | V9-DOC-PROJ-156 | docs/reference/modules/README.md |
| 4 | [ ] | V9-DOC-PROJ-157 | docs/guides/how-to/README.md |
| 5 | [ ] | V9-DOC-PROJ-158 | docs/reports/project-management/README.md |
| 6 | [ ] | V9-DOC-PROJ-159 | docs/explanation/design/README.md |
| 7 | [ ] | V9-DOC-PROJ-162 | docs/explanation/v9-rectification-tasks-v15-v16.md |
| 8 | [ ] | V9-DOC-PROJ-165 | docs/reference/project/changelogs/2026-07/2026-07-14-p4-completion.md |
| 9 | [ ] | V9-DOC-PROJ-171 | docs/reference/changelogs/2026-07/2026-07-05-module-registry-and-integration.md |
| 10 | [ ] | V9-DOC-PROJ-175 | docs/meta/README.md |
| 11 | [ ] | V9-DOC-PROJ-181 | docs/guides/CODE-REVIEW.md |
| 12 | [ ] | V9-DOC-PROJ-185 | docs/meta/registry-index-root.md |
| 13 | [ ] | V9-DOC-PROJ-186 | docs/meta/doc-id-registry.md |
| 14 | [ ] | V9-DOC-PROJ-187 | docs/guides/tutorials/README.md |
| 15 | [ ] | V9-DOC-PROJ-190 | docs/reference/yuandian_law.md |
| 16 | [ ] | V9-DOC-PROJ-191 | docs/reference/踩坑规则门禁指南.md |
| 17 | [x] | V9-DOC-PROJ-195 | docs/reference/v9-l2状态层补齐路线图.md |
| 18 | [ ] | V9-DOC-PROJ-196 | docs/reference/yahoo_finance.md |
| 19 | [ ] | V9-DOC-PROJ-198 | docs/reference/meta/doc-trigger-action-map.md |
| 20 | [ ] | V9-DOC-PROJ-201 | docs/reference/tianyancha.md |
| 21 | [ ] | V9-DOC-PROJ-202 | docs/reference/useCase-contract.md |
| 22 | [ ] | V9-DOC-PROJ-206 | docs/reference/scholar.md |
| 23 | [ ] | V9-DOC-PROJ-208 | docs/reference/sec_edgar.md |
| 24 | [ ] | V9-DOC-PROJ-209 | docs/reference/changelogs/2026-07/daily-doc-validation-2026-07-12.md |
| 25 | [ ] | V9-DOC-PROJ-210 | docs/reference/changelogs/2026-07/jsdoc-combined-report-20260712.md |
| 26 | [ ] | V9-DOC-PROJ-213 | docs/reference/changelogs/2026-07/action-list-p1.md |
| 27 | [ ] | V9-DOC-PROJ-216 | docs/reference/changelogs/2026-07/pr-5-build-optimization-summary.md |
| 28 | [ ] | V9-DOC-PROJ-218 | docs/reference/deployment.md |
| 29 | [ ] | V9-DOC-PROJ-219 | docs/reference/ifind.md |
| 30 | [ ] | V9-DOC-PROJ-220 | docs/reference/imf.md |
| 31 | [ ] | V9-DOC-PROJ-221 | docs/reference/export-contract.md |
| 32 | [ ] | V9-DOC-PROJ-225 | docs/reference/coding-conventions.md |
| 33 | [ ] | V9-DOC-PROJ-226 | docs/reference/news-contract.md |
| 34 | [ ] | V9-DOC-PROJ-228 | docs/reference/input-contract.md |
| 35 | [ ] | V9-DOC-PROJ-231 | docs/reports/ops/runbook.md |
| 36 | [ ] | V9-DOC-PROJ-232 | docs/reports/ops/deployment.md |
| 37 | [ ] | V9-DOC-PROJ-238 | docs/reference/code-review-cheatsheet.md |
| 38 | [ ] | V9-DOC-PROJ-250 | docs/explanation/design/autonomous-workflow-optimization.md |
| 39 | ~~[ ]~~ | V9-DOC-PROJ-260 | ~~docs/explanation/v9-l2状态层补齐路线图.md~~（已删：与 PROJ-195 重复，见 proj-195-vs-proj-260-diff） |
| 40 | [ ] | V9-DOC-PROJ-273 | docs/explanation/rollback-drill-report.md |
| 41 | [ ] | V9-DOC-PROJ-282 | docs/explanation/nested-code-review-report.md |
| 42 | [ ] | V9-DOC-PROJ-301 | docs/assets/articles/02-experience-five-pitfalls.md |
| 43 | [ ] | V9-DOC-PROJ-302 | docs/assets/articles/publish-ready.md |
| 44 | [ ] | V9-DOC-PROJ-306 | docs/meta/ai-index/.ai-index/README.md |
| 45 | [ ] | V9-DOC-PROJ-312 | docs/explanation/design/song-aesthetics.md |
| 46 | [ ] | V9-DOC-PROJ-313 | docs/reference/10-glossary.md |
| 47 | [ ] | V9-DOC-PROJ-315 | docs/meta/document-style-guide.md |
| 48 | [ ] | V9-DOC-PROJ-316 | docs/meta/document-classification-system.md |
| 49 | [ ] | V9-DOC-PROJ-317 | docs/meta/document-organization-workflow.md |
| 50 | [ ] | V9-DOC-PROJ-320 | docs/meta/documentation-team-training.md |
| 51 | [ ] | V9-DOC-PROJ-321 | docs/meta/document-archive-management.md |
| 52 | [ ] | V9-DOC-PROJ-325 | docs/meta/doc-trigger-action-map.md |
| 53 | [ ] | V9-DOC-PROJ-331 | docs/meta/type-domain-audit-worksheet.md |
| 54 | [ ] | V9-DOC-PROJ-336 | docs/reference/templates/task-graph-template.md |
| 55 | [ ] | V9-DOC-PROJ-340 | docs/reports/action-plans/encoding-damage-systematic-fix-plan.md |
| 56 | [ ] | V9-DOC-PROJ-341 | docs/explanation/task-graph-template.md |
| 57 | [ ] | V9-DOC-PROJ-349 | docs/guides/how-to/how-to-troubleshooting.md |
| 58 | [ ] | V9-DOC-PROJ-CHANGELOG-INDEX | docs/reports/changelogs/README.md |
| 59 | [ ] | V9-DOC-PROJ-GOV-001 | docs/reports/project-management/docs-governance-file-structure-report-2026-08-03.md |

## 注意事项

- **#13（V9-DOC-PROJ-186）** 本身是 `doc-id-registry.md`，登记时路径写 `meta/doc-id-registry.md`。
- **#17（PROJ-195）已登记**：保留 `reference/v9-l2状态层补齐路线图.md`；**#39（PROJ-260）已删除**（与 #17 重复，explanation 版已移除，见 `proj-195-vs-proj-260-diff.md`）。
