# 注册表与文档对比报告

> 生成时间：2026-08-12
> 数据源：docs/meta/doc-id-registry.md 与 docs 下全部 .md 的 frontmatter

## 0. 总览

| 指标 | 数值 |
|------|------|
| 注册表登记条目数 | 174 |
| 扫描 .md 文件数 | 642 |
| 文档含 doc_id 数 | 300 |
| 文档缺 doc_id 数 | 339 |
| A. 有 doc_id 未登记 | 228 |
| B1. 注册表路径不存在 | 69 |
| B2. 注册表 doc_id 与文件不一致 | 54 |
| C. 路径与注册表不一致 | 21 |
| D. 重复 doc_id 组数 | 3 |

## A. 有 doc_id 但未登记到注册表（遗漏登记）

| doc_id | 文档路径 |
|--------|----------|
| GOV-SCRIPT-CLEANUP-2026-08-03 | docs/reports/governance/script-cleanup-report-2026-08-03.md |
| V9-ADR-010 | docs/specs/architecture/adr-010-cockpit-command-cross-layout.md |
| V9-DOC-AI-012 | docs/reference/ai/README.md |
| V9-DOC-AI-014 | docs/reference/agent-audit-report.md |
| V9-DOC-AI-017 | docs/reference/llm-contract.md |
| V9-DOC-AI-019 | docs/reference/prompts/autonomous-workflow-optimization.md |
| V9-DOC-AI-031 | docs/meta/agent-app-docs-classification.md |
| V9-DOC-AI-AGENTS-001 | docs/meta/AGENTS.md |
| V9-DOC-ARCH-??? | docs/guides/development/mcp-cli-skill-strategy.md |
| V9-DOC-ARCH-019 | docs/reference/ui-migration-checklist.md |
| V9-DOC-ARCH-021 | docs/reference/complexity-governance.md |
| V9-DOC-ARCH-023 | docs/reference/2026-07-01-v6-architecture-dominance-batch-a.md |
| V9-DOC-ARCH-034 | docs/explanation/complexity-remediation-plan.md |
| V9-DOC-ARCH-036 | docs/explanation/complexity-redlines.md |
| V9-DOC-ARCH-038 | docs/explanation/complexity-governance.md |
| V9-DOC-ARCH-040 | docs/explanation/architecture/overview.md |
| V9-DOC-ARCH-043 | docs/explanation/architecture/api-contracts.md |
| V9-DOC-ARCH-045 | docs/explanation/2026-06-25-v6-migration.md |
| V9-DOC-ARCH-047 | docs/meta/markdown-reorg-framework.md |
| V9-DOC-ARCH-050 | docs/specs/architecture/cockpit-command-blueprint.md |
| V9-DOC-ARCH-DEBT-20260812 | docs/reports/governance/mcp-direct-service-import-debt-fix-plan-2026-08-12.md |
| V9-DOC-AUDIT-018 | docs/reports/audit/no-unsafe-audit-INDEX.md |
| V9-DOC-AUDIT-STABILITY-001 | docs/audit/reports/system/databridge-stability-assessment-20260726.md |
| V9-DOC-AUTO-06E838 | docs/reports/optimization/walkthrough-scoredoc-report_optimization.md |
| V9-DOC-AUTO-1807D5 | docs/reports/strategy/stock-selection-strategy_strategy.md |
| V9-DOC-AUTO-1E7C03 | docs/reports/strategy/watchlist-strategy_strategy.md |
| V9-DOC-AUTO-386190 | docs/reports/changelogs/CHANGELOG_changelogs.md |
| V9-DOC-AUTO-489135 | docs/reports/strategy/hot-momentum-strategy_strategy.md |
| V9-DOC-AUTO-48AA71 | docs/reports/strategy/value-bargain-strategy_strategy.md |
| V9-DOC-AUTO-4C1CCB | docs/reports/release-management/README_release-management.md |
| V9-DOC-AUTO-67F745 | docs/reports/上线前全面校验报告-v2.0.0.md |
| V9-DOC-AUTO-727A68 | docs/reports/release-management/buildscoredocdiff-rollback-plan_release-management.md |
| V9-DOC-AUTO-847FAE | docs/explanation/report-generation-architecture-assessment.md |
| V9-DOC-AUTO-8C4E8E | docs/reports/project-management/development-lessons-learned.md |
| V9-DOC-AUTO-953C0E | docs/reports/strategy/core-scarce-strategy_strategy.md |
| V9-DOC-AUTO-BAA242 | docs/reference/implementation/chart-integration.md |
| V9-DOC-AUTO-BF7C73 | docs/reports/project-management/README_project-management.md |
| V9-DOC-AUTO-CDFD3E | docs/reports/SOLO-REVIEW.md |
| V9-DOC-AUTO-E0D2AF | docs/reports/changelogs/monthly-2026-07_changelogs.md |
| V9-DOC-AUTO-FF80FA | docs/reports/health-report.md |
| V9-DOC-BACK-014 | docs/reference/v9-input-cabin-strategy-report.md |
| V9-DOC-BACK-015 | docs/explanation/2026-06-24-pool-screening-signal-persistence-review-engine.md |
| V9-DOC-BACK-018 | docs/reference/walkthrough-scoredoc-report.md |
| V9-DOC-BACK-019 | docs/reference/trading-contract.md |
| V9-DOC-BACK-021 | docs/reference/pwa-contract.md |
| V9-DOC-BACK-022 | docs/reference/screening-contract.md |
| V9-DOC-BACK-023 | docs/reference/services-catalog.md |
| V9-DOC-BACK-024 | docs/reference/dual-strategy-update-log-and-consistency-check.md |
| V9-DOC-BACK-025 | docs/reference/2026-06-24-adopt-v6-core-resource-trading-strategy.md |
| V9-DOC-BACK-032 | docs/explanation/design/investment-pipeline-stage-analysis.md |
| V9-DOC-BACK-033 | docs/guides/how-to-add-service.md |
| V9-DOC-BACK-041 | docs/explanation/2026-06-27-dual-strategy-system.md |
| V9-DOC-BACK-046 | docs/guides/how-to/how-to-configure-v6-scoring.md |
| V9-DOC-DATA-028 | docs/reference/adr-010-profile-evidence-chain.md |
| V9-DOC-DATA-029 | docs/reference/adr-014-vector-search-over-tfidf.md |
| V9-DOC-DATA-030 | docs/guides/development/data-flow-convergence-plan.md |
| V9-DOC-DATA-031 | docs/explanation/design/v9-indexeddb-store-schema.md |
| V9-DOC-DATA-032 | docs/reference/v9-indexeddb-store-schema.md |
| V9-DOC-DATA-035 | docs/reference/adr-002-indexeddb-over-localstorage.md |
| V9-DOC-DATA-036 | docs/reference/data-collection-route-ui-audit.md |
| V9-DOC-DATA-037 | docs/reference/2026-06-20-indexeddb-over-localstorage.md |
| V9-DOC-DATA-039 | docs/reference/v9-data-timeline.md |
| V9-DOC-DATA-040 | docs/reference/world_bank_open_data.md |
| V9-DOC-DATA-042 | docs/reference/project/2026-06-21-databridge-over-direct-datalayer.md |
| V9-DOC-DATA-044 | docs/reference/tushare-token-setup.md |
| V9-DOC-DATA-048 | docs/reference/changelogs/2026-07/jsdoc-update-summary-data-collector-20260712.md |
| V9-DOC-DATA-049 | docs/reference/data_link_sequence_diagram.md |
| V9-DOC-DATA-050 | docs/reference/collection-contract.md |
| V9-DOC-DATA-056 | docs/reference/modules/data-layer-overview.md |
| V9-DOC-DATA-057 | docs/reference/2026-06-29-data-relationship-blueprint.md |
| V9-DOC-DATA-059 | docs/reference/prompts/store-integration-guide.md |
| V9-DOC-DATA-060 | docs/reference/backtest-data-definition.md |
| V9-DOC-DATA-067 | docs/explanation/v9-data-relationship-er.md |
| V9-DOC-DATA-069 | docs/explanation/db-migration-v4-to-v6.md |
| V9-DOC-DATA-073 | docs/reference/ai/store-integration-guide.md |
| V9-DOC-DATA-077 | docs/guides/how-to/how-to-run-scoring-pipeline.md |
| V9-DOC-DATA-078 | docs/guides/how-to/how-to-data-import-export.md |
| V9-DOC-DEV-001 | docs/reference/stock-dictionary-generation.md |
| V9-DOC-EXP-901 | docs/explanation/overview.md |
| V9-DOC-EXP-902 | docs/explanation/cabins-overview.md |
| V9-DOC-EXP-903 | docs/explanation/song-aesthetics.md |
| V9-DOC-EXP-904 | docs/explanation/quality-gates-baseline.md |
| V9-DOC-EXP-905 | docs/explanation/runbook.md |
| V9-DOC-FM-DOCS-REPORTS-ACL-CLEANUP-AND-DOC-FIX-LOG-001 | docs/reports/acl-cleanup-and-doc-fix-log-2026-08-09.md |
| V9-DOC-FM-DOCS-REPORTS-CYQ-CHIP-DISTRIBUTION-VERIF-002 | docs/reports/cyq-chip-distribution-verification-2026-08-09.md |
| V9-DOC-FM-DOCS-REPORTS-GOVERNANCE-NEXT-PHASE-ARCHI-003 | docs/reports/governance/next-phase-architecture-optimization-plan-2026-08-10-v2.md |
| V9-DOC-FM-DOCS-REPORTS-GOVERNANCE-TECH-DEBT-GOVERN-004 | docs/reports/governance/tech-debt-governance-summary-phase-2-2026-08-10.md |
| V9-DOC-FM-DOCS-REPORTS-P0-TEST-COVERAGE-IMPROVEMEN-008 | docs/reports/p0-test-coverage-improvement-plan-2026-08-09.md |
| V9-DOC-FM-DOCS-REPORTS-PR-TEMPLATE-V2-GOVERNANCE-2-009 | docs/reports/PR-TEMPLATE-v2-governance-2026-08-10.md |
| V9-DOC-FM-DOCS-REPORTS-PROJECT-MANAGEMENT-P2-BJ-HK-011 | docs/reports/project-management/p2-bj-hk-stock-support-task.md |
| V9-DOC-FM-DOCS-REPORTS-PROJECT-MANAGEMENT-P2-DEVEL-012 | docs/reports/project-management/p2-development-schedule.md |
| V9-DOC-FM-DOCS-REPORTS-TEST-CATALOG-GAP-ANALYSIS-2-018 | docs/reports/test-catalog-gap-analysis-2026-08-09.md |
| V9-DOC-FM-DOCS-REPORTS-TEST-DUPLICATE-CLEANUP-SUGG-019 | docs/reports/test-duplicate-cleanup-suggestions-2026-08-09.md |
| V9-DOC-FM-DOCS-REPORTS-TESTING-MOCK-ISOLATION-FINA-021 | docs/reports/testing/mock-isolation-final-report-v1.2-2026-08-10.md |
| V9-DOC-FM-DOCS-REPORTS-TESTING-MOCK-ISOLATION-FIX--022 | docs/reports/testing/mock-isolation-fix-report-2026-08-10.md |
| V9-DOC-FM-DOCS-REPORTS-TESTING-MOCK-ISOLATION-GOVE-023 | docs/reports/testing/mock-isolation-governance-summary-2026-08-10.md |
| V9-DOC-FM-DOCS-REPORTS-TESTING-MOCK-ISOLATION-RISK-024 | docs/reports/testing/mock-isolation-risk-list-2026-08-10.md |
| V9-DOC-FM-DOCS-REPORTS-TESTING-PHASE1-EXECUTION-CH-025 | docs/reports/testing/phase1-execution-checklist-2026-08-09.md |
| V9-DOC-FM-DOCS-REPORTS-TESTING-PHASE1-FIXED-TESTS--026 | docs/reports/testing/phase1-fixed-tests-mock-guide.md |
| V9-DOC-FM-DOCS-REPORTS-TESTING-PREEXISTING-TEST-FA-027 | docs/reports/testing/preexisting-test-failures-remediation-plan-2026-08-09.md |
| V9-DOC-FM-DOCS-REPORTS-WINDOWS-DEPLOYMENT-VERIFICA-030 | docs/reports/windows-deployment-verification-checklist.md |
| V9-DOC-FRONT-013 | docs/reference/ui-remediation-tracker.md |
| V9-DOC-FRONT-014 | docs/explanation/v6pro-ui-page-diff-report.md |
| V9-DOC-FRONT-017 | docs/reference/widget-integration-checklist.md |
| V9-DOC-FRONT-019 | docs/reference/widget-error-handling.md |
| V9-DOC-FRONT-024 | docs/reference/input-cabin-ui-reshaping.md |
| V9-DOC-FRONT-032 | docs/explanation/design/widget-integration-checklist.md |
| V9-DOC-FRONT-039 | docs/explanation/page-structure.md |
| V9-DOC-FRONT-045 | docs/explanation/kimi-webbridge.md |
| V9-DOC-FRONT-049 | docs/explanation/design/color-token-consolidation-feasibility.md |
| V9-DOC-FRONT-050 | docs/explanation/design/component-specs.md |
| V9-DOC-FRONT-051 | docs/explanation/design/a11y-i18n.md |
| V9-DOC-FRONT-053 | docs/explanation/a11y-i18n.md |
| V9-DOC-FRONT-054 | docs/explanation/design/design-system-audit-report.md |
| V9-DOC-FRONT-055 | docs/explanation/2026-06-24-input-cabin-subpages.md |
| V9-DOC-GOV-001 | docs/reports/governance/breaking-changes-report-2026-08-03.md |
| V9-DOC-GOV-002 | docs/reports/governance/governance-summary-2026-08-03.md |
| V9-DOC-GOV-003 | docs/reports/governance/doc-maintenance-specification.md |
| V9-DOC-GUIDE-021 | docs/guides/component-admission-policy.md |
| V9-DOC-GUIDE-022 | docs/guides/module-completion-standard.md |
| V9-DOC-GUIDE-023 | docs/guides/lessons-learned-component-governance.md |
| V9-DOC-HOW-901 | docs/guides/how-to/how-to-add-widget.md |
| V9-DOC-HOW-902 | docs/guides/how-to/how-to-add-store.md |
| V9-DOC-HOW-903 | docs/guides/how-to/how-to-add-service.md |
| V9-DOC-HOW-904 | docs/guides/how-to/code-review-guide.md |
| V9-DOC-META-000 | docs/meta/registry-index.md |
| V9-DOC-PRM-901 | docs/reference/prompts/service-integration-guide.md |
| V9-DOC-PROD-003 | docs/specs/product/README.md |
| V9-DOC-PROD-004 | docs/specs/requirements/README.md |
| V9-DOC-PROD-005 | docs/specs/requirements/adr/README.md |
| V9-DOC-PROD-008 | docs/guides/team-handbook/05-competitive-analysis.md |
| V9-DOC-PROD-010 | docs/specs/01-vision-and-goals.md |
| V9-DOC-PROD-011 | docs/reports/project-management/01-p1-debt-cleanup-todo.md |
| V9-DOC-PROD-028 | docs/reports/project-management/batch-04-tech-debt-governance-todo.md |
| V9-DOC-PROJ-145 | docs/reports/README_reports.md |
| V9-DOC-PROJ-150 | docs/reference/project/plans/README.md |
| V9-DOC-PROJ-156 | docs/reference/modules/README.md |
| V9-DOC-PROJ-157 | docs/guides/how-to/README.md |
| V9-DOC-PROJ-158 | docs/reports/project-management/README.md |
| V9-DOC-PROJ-159 | docs/explanation/design/README.md |
| V9-DOC-PROJ-162 | docs/explanation/v9-rectification-tasks-v15-v16.md |
| V9-DOC-PROJ-165 | docs/reference/project/changelogs/2026-07/2026-07-14-p4-completion.md |
| V9-DOC-PROJ-171 | docs/reference/changelogs/2026-07/2026-07-05-module-registry-and-integration.md |
| V9-DOC-PROJ-175 | docs/meta/README.md |
| V9-DOC-PROJ-181 | docs/guides/CODE-REVIEW.md |
| V9-DOC-PROJ-185 | docs/meta/registry-index-root.md |
| V9-DOC-PROJ-186 | docs/meta/doc-id-registry.md |
| V9-DOC-PROJ-187 | docs/guides/tutorials/README.md |
| V9-DOC-PROJ-190 | docs/reference/yuandian_law.md |
| V9-DOC-PROJ-191 | docs/reference/踩坑规则门禁指南.md |
| V9-DOC-PROJ-195 | docs/reference/v9-l2状态层补齐路线图.md |
| V9-DOC-PROJ-196 | docs/reference/yahoo_finance.md |
| V9-DOC-PROJ-198 | docs/reference/meta/doc-trigger-action-map.md |
| V9-DOC-PROJ-201 | docs/reference/tianyancha.md |
| V9-DOC-PROJ-202 | docs/reference/useCase-contract.md |
| V9-DOC-PROJ-206 | docs/reference/scholar.md |
| V9-DOC-PROJ-208 | docs/reference/sec_edgar.md |
| V9-DOC-PROJ-209 | docs/reference/changelogs/2026-07/daily-doc-validation-2026-07-12.md |
| V9-DOC-PROJ-210 | docs/reference/changelogs/2026-07/jsdoc-combined-report-20260712.md |
| V9-DOC-PROJ-213 | docs/reference/changelogs/2026-07/action-list-p1.md |
| V9-DOC-PROJ-216 | docs/reference/changelogs/2026-07/pr-5-build-optimization-summary.md |
| V9-DOC-PROJ-218 | docs/reference/deployment.md |
| V9-DOC-PROJ-219 | docs/reference/ifind.md |
| V9-DOC-PROJ-220 | docs/reference/imf.md |
| V9-DOC-PROJ-221 | docs/reference/export-contract.md |
| V9-DOC-PROJ-225 | docs/reference/coding-conventions.md |
| V9-DOC-PROJ-226 | docs/reference/news-contract.md |
| V9-DOC-PROJ-228 | docs/reference/input-contract.md |
| V9-DOC-PROJ-231 | docs/reports/ops/runbook.md |
| V9-DOC-PROJ-232 | docs/reports/ops/deployment.md |
| V9-DOC-PROJ-238 | docs/reference/code-review-cheatsheet.md |
| V9-DOC-PROJ-250 | docs/explanation/design/autonomous-workflow-optimization.md |
| V9-DOC-PROJ-260 | docs/explanation/v9-l2状态层补齐路线图.md |
| V9-DOC-PROJ-273 | docs/explanation/rollback-drill-report.md |
| V9-DOC-PROJ-282 | docs/explanation/nested-code-review-report.md |
| V9-DOC-PROJ-301 | docs/assets/articles/02-experience-five-pitfalls.md |
| V9-DOC-PROJ-302 | docs/assets/articles/publish-ready.md |
| V9-DOC-PROJ-306 | docs/meta/ai-index/.ai-index/README.md |
| V9-DOC-PROJ-312 | docs/explanation/design/song-aesthetics.md |
| V9-DOC-PROJ-313 | docs/reference/10-glossary.md |
| V9-DOC-PROJ-315 | docs/meta/document-style-guide.md |
| V9-DOC-PROJ-316 | docs/meta/document-classification-system.md |
| V9-DOC-PROJ-317 | docs/meta/document-organization-workflow.md |
| V9-DOC-PROJ-320 | docs/meta/documentation-team-training.md |
| V9-DOC-PROJ-321 | docs/meta/document-archive-management.md |
| V9-DOC-PROJ-325 | docs/meta/doc-trigger-action-map.md |
| V9-DOC-PROJ-331 | docs/meta/type-domain-audit-worksheet.md |
| V9-DOC-PROJ-336 | docs/reference/templates/task-graph-template.md |
| V9-DOC-PROJ-340 | docs/reports/action-plans/encoding-damage-systematic-fix-plan.md |
| V9-DOC-PROJ-341 | docs/explanation/task-graph-template.md |
| V9-DOC-PROJ-349 | docs/guides/how-to/how-to-troubleshooting.md |
| V9-DOC-PROJ-CHANGELOG-INDEX | docs/reports/changelogs/README.md |
| V9-DOC-PROJ-GOV-001 | docs/reports/project-management/docs-governance-file-structure-report-2026-08-03.md |
| V9-DOC-QA-021 | docs/explanation/ai-generate-audit-fix-loop.md |
| V9-DOC-QA-024 | docs/reference/changelogs/2026-07/2026-07-05-ui-testing-optimization.md |
| V9-DOC-QA-025 | docs/reference/changelogs/2026-07/pr-8-dedup-audit-report.md |
| V9-DOC-QA-026 | docs/explanation/design/quality-audit-plan.md |
| V9-DOC-QA-027 | docs/reference/2026-07-04-ui-testing-optimization.md |
| V9-DOC-QA-028 | docs/reference/ai-generate-audit-fix-loop.md |
| V9-DOC-QA-029 | docs/reports/testing/README_testing.md |
| V9-DOC-QA-030 | docs/reference/changelogs/2026-07/2026-07-05-comprehensive-audit-and-remediation.md |
| V9-DOC-QA-034 | docs/reference/v9-code-quality-audit-report-20260629.md |
| V9-DOC-QA-036 | docs/reports/testing/sector-stocks-ui-acceptance-checklist.md |
| V9-DOC-QA-048 | docs/reference/changelogs/2026-07/test-cache-fix-summary.md |
| V9-DOC-QA-049 | docs/reference/backtest-contract.md |
| V9-DOC-QA-051 | docs/reference/audit-b4-1-code-quality.md |
| V9-DOC-QA-064 | docs/guides/how-to/testing/complexity-remediation-plan.md |
| V9-DOC-QA-065 | docs/guides/09-quality-gates.md |
| V9-DOC-QA-074 | docs/reference/audit-b4-4-security.md |
| V9-DOC-QA-082 | docs/explanation/design/quality-assurance-strategy.md |
| V9-DOC-QA-100 | docs/explanation/penetration-test-report.md |
| V9-DOC-QA-101 | docs/explanation/v9-code-quality-audit-report-20260713.md |
| V9-DOC-QA-102 | docs/explanation/v9-code-quality-audit-report-20260629.md |
| V9-DOC-QA-106 | docs/explanation/audit-b4-2-test-quality.md |
| V9-DOC-QA-108 | docs/guides/standards/quality-gates.md |
| V9-DOC-QA-110 | docs/assets/articles/01-tutorial-audit-workflow.md |
| V9-DOC-QA-116 | docs/guides/how-to/how-to-use-audit-scripts.md |
| V9-DOC-REF-901 | docs/reference/test-catalog.md |
| V9-DOC-REF-902 | docs/reference/security-model.md |
| V9-DOC-REF-903 | docs/reference/development-workflow-sop.md |
| V9-DOC-REF-904 | docs/reference/jsdoc-convention.md |
| V9-DOC-REF-905 | docs/reference/api-contract.md |
| V9-DOC-ROOT-901 | docs/README.md |
| V9-DOC-SOP-MERGE-v2.1.0 | docs/reports/release-management/merge-sop-v2.1.0.md |
| V9-DOC-TECH-025 | docs/reports/governance/KB-TECH-DEBT-20260811-04-batch-fix-plan.md |
| V9-DOC-TECH-026 | docs/reports/governance/batch-04-completion-report-20260812.md |
| V9-REL-AUTO-26A7F0 | docs/reports/release-management/v2.6.0-release-report.md |
| V9-REL-P0-29A7F9 | docs/reports/release-management/p0-seed-retry-memory-fallback-release-report.md |

## B1. 注册表路径指向的文件不存在

| doc_id | 登记路径 |
|--------|----------|
| V9-DOC-AI-001 | 00-meta/prompt-execute-remediation.md |
| V9-DOC-AI-002 | explanation/design/ui-design-agent-execution-plan.md |
| V9-DOC-AI-004 | prompts/README.md |
| V9-DOC-AI-007 | reports/audit/mcp-server-governance-retrospective.md |
| V9-DOC-ARCH-004 | reference/03-architecture-standards.md |
| V9-DOC-BACK-003 | explanation/design/07-operation-strategy.md |
| V9-DOC-BACK-004 | explanation/design/analysis-screening-module-dev-plan.md |
| V9-DOC-BACK-001 | reference/05-engine-specs.md |
| V9-DOC-BACK-009 | reference/07-operation-strategy.md |
| V9-DOC-DATA-001 | 01-product/data-security-and-privacy.md |
| V9-DOC-FRONT-003 | explanation/design/04-ui-ux-specs.md |
| V9-DOC-FRONT-004 | explanation/design/06-routing-specs.md |
| V9-DOC-FRONT-005 | explanation/design/ui-only-implementation-summary.md |
| V9-DOC-FRONT-007 | reference/04-ui-ux-specs.md |
| V9-DOC-FRONT-008 | reference/06-routing-specs.md |
| V9-DOC-PROD-001 | 01-product/competitive-analysis.md |
| V9-DOC-PROD-002 | 01-product/user-personas-and-scenarios.md |
| V9-DOC-PROJ-001 | 00-meta/tag-taxonomy.md |
| V9-DOC-PROJ-002 | 00-meta/23-core-docs-functional-match-report.md |
| V9-DOC-PROJ-003 | 00-meta/23-core-docs-v2-final-report.md |
| V9-DOC-PROJ-004 | 00-meta/23个核心文档重新检索报告.md |
| V9-DOC-PROJ-005 | 00-meta/cleanup-schedule.md |
| V9-DOC-PROJ-006 | 00-meta/development-log.md |
| V9-DOC-PROJ-007 | 00-meta/directory-structure-guide.md |
| V9-DOC-PROJ-008 | 00-meta/doc-auto-update-kanban.md |
| V9-DOC-PROJ-009 | 00-meta/doc-file-management-optimization-plan.md |
| V9-DOC-PROJ-010 | 00-meta/doc-style-standard.md |
| V9-DOC-PROJ-011 | 00-meta/doc-system-check-v9.md |
| V9-DOC-PROJ-026 | 00-meta/document-metadata-standard.md |
| V9-DOC-PROJ-012 | 00-meta/FILE-MANAGEMENT-GUIDE-cleanup-decisions.md |
| V9-DOC-PROJ-013 | 00-meta/FILE-MANAGEMENT-GUIDE-file-wandering-report.md |
| V9-DOC-PROJ-014 | 00-meta/FILE-MANAGEMENT-GUIDE-task-list.md |
| V9-DOC-PROJ-015 | 00-meta/functional-module-guide.md |
| V9-DOC-PROJ-016 | 00-meta/GOVERNANCE.md |
| V9-DOC-PROJ-017 | 00-meta/metadata-governance-phased-plan.md |
| V9-DOC-PROJ-027 | 00-meta/phase2-manual-task-list.md |
| V9-DOC-PROJ-018 | 00-meta/registry-index.md |
| V9-DOC-PROJ-019 | 00-meta/src-directories-evaluation-report.md |
| V9-DOC-PROJ-020 | 00-meta/trae-file-management-review.md |
| V9-DOC-PROJ-021 | 00-meta/V9-文档治理修复行动计划.md |
| V9-DOC-PROJ-022 | 00-meta/文档归类体系结构.md |
| V9-DOC-PROJ-023 | 00-meta/文档体系体检报告-v9.md |
| V9-DOC-PROJ-024 | 00-meta/文档自动更新体系-架构梳理与任务清单.md |
| V9-DOC-PROJ-025 | 00-meta/执行校验报告.md |
| V9-DOC-PROJ-043 | explanation/design/completeness-profile-batch4.md |
| V9-DOC-PROJ-044 | explanation/design/deprecated-doc-sync-gap-list.md |
| V9-DOC-PROJ-045 | explanation/design/doc-sync-execution-plan.md |
| V9-DOC-PROJ-047 | explanation/design/p4-文档去重清单与执行方案.md |
| V9-DOC-PROJ-048 | explanation/design/pending-items-backlog-20260704.md |
| V9-DOC-PROJ-052 | explanation/design/ui改善部分检索报告.md |
| V9-DOC-PROJ-053 | 00-meta/audit-reports/v6pro-v9-gap-analysis-final.md |
| V9-DOC-PROJ-054 | explanation/design/v6-v9界面设计优化可行性计划.md |
| V9-DOC-PROJ-057 | explanation/design/迁移风险复盘与应对策略文档.md |
| V9-DOC-PROJ-070 | how-to/FILE-MANAGEMENT-GUIDE.md |
| V9-DOC-PROJ-071 | how-to/pwa-offline-guide.md |
| V9-DOC-PROJ-072 | how-to/visual-regression-guide.md |
| V9-DOC-PROJ-073 | reference/02-functional-specs.md |
| V9-DOC-PROJ-083 | reference/CHANGELOG.md |
| V9-DOC-PROJ-121 | team-handbook/06-team-operation-guide.md |
| V9-DOC-PROJ-122 | tutorials/getting-started.md |
| V9-DOC-QA-001 | 00-meta/directory-audit-todo.md |
| V9-DOC-QA-002 | 04-testing/e2e-test-expansion-plan.md |
| V9-DOC-QA-003 | 04-testing/performance-baseline.md |
| V9-DOC-QA-004 | 04-testing/pre-testing-checklist.md |
| V9-DOC-QA-005 | 04-testing/security-test-plan.md |
| V9-DOC-QA-006 | 04-testing/unit-test-repair-roadmap.md |
| V9-DOC-QA-007 | explanation/design/v9-code-quality-kanban-20260629.md |
| V9-DOC-QA-008 | how-to/testing/testing-strategy.md |
| V9-DOC-QA-010 | reference/testing-strategy.md |

## B2. 注册表 doc_id 与文件 frontmatter 不一致

| doc_id | 登记路径 | 文件实际 doc_id |
|--------|----------|----------------|
| V9-DOC-AI-003 | explanation/ui-design-agent-execution-plan.md | (缺失) |
| V9-DOC-AI-006 | reference/agent-runtime-spec.md | (缺失) |
| V9-DOC-ARCH-001 | explanation/adr-001-pure-frontend-architecture.md | (缺失) |
| V9-DOC-ARCH-006 | explanation/adr-004-hashrouter-static-hosting.md | (缺失) |
| V9-DOC-ARCH-003 | explanation/v10-architecture-alignment.md | (缺失) |
| V9-DOC-BACK-005 | explanation/design/trading-core-factors.md | (缺失) |
| V9-DOC-BACK-008 | explanation/trading-core-factors.md | (缺失) |
| V9-DOC-BACK-002 | reference/dataflow-engine-spec.md | (缺失) |
| V9-DOC-BACK-010 | reference/fourth-industrial-revolution-core-resource-strategy.md | (缺失) |
| V9-DOC-BACK-011 | reference/refactor-research-pool-rename-plan.md | (缺失) |
| V9-DOC-DATA-004 | explanation/design/data-definition.md | (缺失) |
| V9-DOC-DATA-007 | explanation/design/data-flow-spec.md | (缺失) |
| V9-DOC-DATA-010 | explanation/design/news-data-definition.md | (缺失) |
| V9-DOC-DATA-012 | explanation/news-data-definition.md | (缺失) |
| V9-DOC-DATA-014 | reference/cockpit/data-definition.md | (缺失) |
| V9-DOC-DATA-016 | reference/data-definition.md | (缺失) |
| V9-DOC-DATA-019 | reference/data-flow-spec.md | (缺失) |
| V9-DOC-DATA-023 | reference/news/DATA_DEFINITION.md | (缺失) |
| V9-DOC-DATA-024 | reference/unified-pool-storage-spec.md | (缺失) |
| V9-DOC-FRONT-002 | explanation/adr-005-portalshell-dark-kimi-layout.md | (缺失) |
| V9-DOC-FRONT-006 | explanation/ui-only-implementation-summary.md | (缺失) |
| V9-DOC-FRONT-010 | reference/cockpit-news-doc-fix-plan.md | (缺失) |
| V9-DOC-PROJ-032 | explanation/A-H-INDEX.md | (缺失) |
| V9-DOC-PROJ-035 | explanation/b批次高价值孤儿集成状态报告-2026-07-08.md | (缺失) |
| V9-DOC-PROJ-036 | explanation/cabins-overview.md | V9-DOC-EXP-902 |
| V9-DOC-PROJ-037 | explanation/completeness-profile-batch4.md | (缺失) |
| V9-DOC-PROJ-046 | explanation/design/input-cabin-spec.md | (缺失) |
| V9-DOC-PROJ-049 | explanation/design/tech-debt.md | (缺失) |
| V9-DOC-PROJ-055 | explanation/design/v9现有数据资产清单.md | (缺失) |
| V9-DOC-PROJ-058 | explanation/design/数据治理路线图.md | (缺失) |
| V9-DOC-PROJ-063 | explanation/pending-items-backlog-20260704.md | (缺失) |
| V9-DOC-PROJ-066 | explanation/v6pro-to-v9-migration-analysis.md | (缺失) |
| V9-DOC-PROJ-067 | explanation/v9-issue-management.md | (缺失) |
| V9-DOC-PROJ-068 | explanation/v9-架构缺陷与整改行动清单.md | (缺失) |
| V9-DOC-PROJ-079 | reference/analysis-cabin-spec.md | (缺失) |
| V9-DOC-PROJ-080 | reference/batchB-fix-plan.md | (缺失) |
| V9-DOC-PROJ-081 | reference/batchD-fix-plan.md | (缺失) |
| V9-DOC-PROJ-082 | reference/batchE-fix-plan.md | (缺失) |
| V9-DOC-PROJ-084 | reference/changelogs/2026-07/pr-7-trade-error-classifier-split-plan.md | (缺失) |
| V9-DOC-PROJ-088 | reference/command-cabin-spec.md | (缺失) |
| V9-DOC-PROJ-089 | reference/completeness-profile-batch1.md | (缺失) |
| V9-DOC-PROJ-098 | reference/input-cabin-spec.md | (缺失) |
| V9-DOC-PROJ-100 | reference/output-cabin-spec.md | (缺失) |
| V9-DOC-PROJ-105 | reference/rm剩余任务全量盘点与整改方案-2026-07-08.md | (缺失) |
| V9-DOC-PROJ-107 | reference/stock-analysis-contract.md | (缺失) |
| V9-DOC-PROJ-108 | reference/stockpool-contract.md | (缺失) |
| V9-DOC-PROJ-111 | reference/ui设计优化实施计划-详细版.md | (缺失) |
| V9-DOC-PROJ-113 | reference/v6pro-to-v9-migration-analysis.md | (缺失) |
| V9-DOC-PROJ-114 | reference/v6-to-v9-migration-spec.md | (缺失) |
| V9-DOC-PROJ-116 | reference/v9核心数据字典与类型定义(整合版).md | (缺失) |
| V9-DOC-PROJ-117 | reference/v9数据架构修订建议.md | (缺失) |
| V9-DOC-PROJ-118 | reference/《功能模块数据契约》.md | (缺失) |
| V9-DOC-QA-011 | explanation/a11y-checklist.md | (缺失) |
| V9-DOC-QA-009 | reference/test-catalog.md | V9-DOC-REF-901 |

## C. 文档路径与注册表登记路径不一致

| doc_id | 注册表路径 | 文档实际路径 |
|--------|------------|--------------|
| V9-DOC-ARCH-004 | reference/03-architecture-standards.md | docs/explanation/03-architecture-standards.md |
| V9-DOC-BACK-001 | reference/05-engine-specs.md | docs/explanation/05-engine-specs.md |
| V9-DOC-FRONT-004 | explanation/design/06-routing-specs.md | docs/explanation/06-routing-specs.md |
| V9-DOC-BACK-009 | reference/07-operation-strategy.md | docs/guides/07-operation-strategy.md |
| V9-DOC-PROJ-071 | how-to/pwa-offline-guide.md | docs/guides/how-to/pwa-offline-guide.md |
| V9-DOC-PROJ-121 | team-handbook/06-team-operation-guide.md | docs/guides/team-handbook/06-team-operation-guide.md |
| V9-DOC-PROJ-122 | tutorials/getting-started.md | docs/guides/tutorials/getting-started.md |
| V9-DOC-PROJ-007 | 00-meta/directory-structure-guide.md | docs/meta/directory-structure-guide.md |
| V9-DOC-PROJ-010 | 00-meta/doc-style-standard.md | docs/meta/doc-style-standard.md |
| V9-DOC-PROJ-026 | 00-meta/document-metadata-standard.md | docs/meta/document-metadata-standard.md |
| V9-DOC-PROJ-015 | 00-meta/functional-module-guide.md | docs/meta/functional-module-guide.md |
| V9-DOC-PROJ-016 | 00-meta/GOVERNANCE.md | docs/meta/GOVERNANCE.md |
| V9-DOC-PROJ-017 | 00-meta/metadata-governance-phased-plan.md | docs/meta/metadata-governance-phased-plan.md |
| V9-DOC-PROJ-001 | 00-meta/tag-taxonomy.md | docs/meta/tag-taxonomy.md |
| V9-DOC-FRONT-002 | explanation/adr-005-portalshell-dark-kimi-layout.md | docs/reference/adr-016-useStockAdd-hook-errorboundary-safety.md |
| V9-DOC-AI-004 | prompts/README.md | docs/reference/prompts/README.md |
| V9-DOC-QA-004 | 04-testing/pre-testing-checklist.md | docs/reports/testing/pre-testing-checklist.md |
| V9-DOC-QA-005 | 04-testing/security-test-plan.md | docs/reports/testing/security-test-plan.md |
| V9-DOC-PROJ-073 | reference/02-functional-specs.md | docs/specs/02-functional-specs.md |
| V9-DOC-FRONT-003 | explanation/design/04-ui-ux-specs.md | docs/specs/04-ui-ux-specs.md |
| V9-DOC-PROD-002 | 01-product/user-personas-and-scenarios.md | docs/specs/product/user-personas-and-scenarios.md |

## D. 重复 doc_id（多个文档共用同一 doc_id）

- **V9-DOC-DATA-030**
  - docs/explanation/adr-015-duckdb-wasm-timeseries.md
  - docs/guides/development/data-flow-convergence-plan.md
- **V9-DOC-DATA-029**
  - docs/explanation/design/profile-eight-domains-design.md
  - docs/reference/adr-014-vector-search-over-tfidf.md
- **V9-DOC-QA-029**
  - docs/reports/testing/README.md
  - docs/reports/testing/README_testing.md

## E. 缺少 doc_id 的文档清单

共 339 个：
- docs/audit/code-quality-audit-report.md
- docs/audit/code-quality-rubric.md
- docs/audit/v6-v9-ui-component-comparison-report.md
- docs/audit/v9-ui-component-feasibility-assessment.md
- docs/explanation/2026-06-23-portalshell-dark-kimi-layout.md
- docs/explanation/2026-07-05-exception-handling-test-report.md
- docs/explanation/A-H-INDEX.md
- docs/explanation/README.md
- docs/explanation/V9-体系化上线测试-TODO-LIST.md
- docs/explanation/V9_L2状态层补齐路线图.md
- docs/explanation/a11y-checklist.md
- docs/explanation/a11y-contrast-report.md
- docs/explanation/action-list.md
- docs/explanation/adr-001-pure-frontend-architecture.md
- docs/explanation/adr-004-hashrouter-static-hosting.md
- docs/explanation/adr-005-portalshell-dark-kimi-layout.md
- docs/explanation/ai-center-data-definition.md
- docs/explanation/architecture-version-comparison.md
- docs/explanation/architecture/adr/README.md
- docs/explanation/architecture/cabins-overview.md
- docs/explanation/architecture/mcp-coupling-analysis-report.md
- docs/explanation/architecture/security-model.md
- docs/explanation/architecture/v9-strategy-architecture.md
- docs/explanation/b批次组件集成测试报告-b6-2026-07-08.md
- docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md
- docs/explanation/completeness-profile-batch2.md
- docs/explanation/completeness-profile-batch3.md
- docs/explanation/completeness-profile-batch4.md
- docs/explanation/completeness-profile-batch5.md
- docs/explanation/completeness-profile.md
- docs/explanation/component-deprecation-policy.md
- docs/explanation/core-data-strategy-report.md
- docs/explanation/data-collection-architecture.md
- docs/explanation/design/00-readme.md
- docs/explanation/design/ai-center-data-definition.md
- docs/explanation/design/blueprints/README.md
- docs/explanation/design/component-library-guide.md
- docs/explanation/design/core-scarce-strategy.md
- docs/explanation/design/data-collection-architecture.md
- docs/explanation/design/data-definition.md
- docs/explanation/design/data-flow-spec.md
- docs/explanation/design/derived-metrics-engine-design.md
- docs/explanation/design/filesystem-mapping-spec.md
- docs/explanation/design/freshness-alerts.md
- docs/explanation/design/hot-momentum-strategy.md
- docs/explanation/design/implementation-governance.md
- docs/explanation/design/input-cabin-spec.md
- docs/explanation/design/news-data-definition.md
- docs/explanation/design/spacing-tokens.md
- docs/explanation/design/stock-selection-strategy.md
- docs/explanation/design/tech-debt.md
- docs/explanation/design/test-expansion-design.md
- docs/explanation/design/trading-core-factors.md
- docs/explanation/design/ui-design-system.md
- docs/explanation/design/v9-strategy-architecture.md
- docs/explanation/design/v9现有数据资产清单.md
- docs/explanation/design/value-bargain-strategy.md
- docs/explanation/design/watchlist-strategy.md
- docs/explanation/design/双通道投研评分系统技术方案.md
- docs/explanation/design/发布计划与评审-r01.md
- docs/explanation/design/回滚方案与演练-r03.md
- docs/explanation/design/数据治理路线图.md
- docs/explanation/feature-entry-list.md
- docs/explanation/implementation/00-README.md
- docs/explanation/implementation/a11y-checklist.md
- docs/explanation/implementation/adr/2026-06-20-indexeddb-over-localstorage.md
- docs/explanation/implementation/adr/2026-06-20-pure-frontend-architecture.md
- docs/explanation/implementation/adr/2026-06-21-databridge-over-direct-datalayer.md
- docs/explanation/implementation/adr/2026-06-21-hashrouter-for-static-hosting.md
- docs/explanation/implementation/adr/2026-06-23-portalshell-dark-kimi-layout.md
- docs/explanation/implementation/adr/2026-06-24-adopt-v6-core-resource-trading-strategy.md
- docs/explanation/implementation/adr/2026-06-24-input-cabin-subpages.md
- docs/explanation/implementation/adr/2026-06-24-pool-screening-signal-persistence-review-engine.md
- docs/explanation/implementation/adr/2026-06-25-v6-migration.md
- docs/explanation/implementation/adr/2026-06-27-dual-strategy-system.md
- docs/explanation/implementation/agent-runtime-spec.md
- docs/explanation/implementation/chart-integration.md
- docs/explanation/implementation/component-deprecation-policy.md
- docs/explanation/implementation/component-library-guide.md
- docs/explanation/implementation/data-collection-architecture.md
- docs/explanation/implementation/data-flow-spec.md
- docs/explanation/implementation/data-interaction-protocols.md
- docs/explanation/implementation/dataflow-engine-spec.md
- docs/explanation/implementation/deprecated/DEPRECATED_batch1-merge-report.md
- docs/explanation/implementation/deprecated/DEPRECATED_batch2-merge-report.md
- docs/explanation/implementation/deprecated/DEPRECATED_batch3-merge-report.md
- docs/explanation/implementation/deprecated/DEPRECATED_cockpit-news-doc-correction-plan.md
- docs/explanation/implementation/deprecated/DEPRECATED_doc-sync-gap-list.md
- docs/explanation/implementation/deprecated/DEPRECATED_ui-module-alignment.md
- docs/explanation/implementation/deprecated/DEPRECATED_v9-issue-execution-board.md
- docs/explanation/implementation/deprecated/DEPRECATED_v9-issue-resolution-schedule.md
- docs/explanation/implementation/deprecated/DEPRECATED_v9-parallel-task-schedule.md
- docs/explanation/implementation/feature-entry-list.md
- docs/explanation/implementation/feedback-loop-spec.md
- docs/explanation/implementation/implementation-governance.md
- docs/explanation/implementation/input-cabin-spec.md
- docs/explanation/implementation/performance-baseline.md
- docs/explanation/implementation/pwa-offline-guide.md
- docs/explanation/implementation/quality-audit-plan.md
- docs/explanation/implementation/quality-gates-baseline.md
- docs/explanation/implementation/rotation-score-spec.md
- docs/explanation/implementation/spacing-tokens.md
- docs/explanation/implementation/trading-core-factors.md
- docs/explanation/implementation/ui-design-system.md
- docs/explanation/jsdoc-convention.md
- docs/explanation/news-data-definition.md
- docs/explanation/optimization-plan.md
- docs/explanation/optimization-progress-report.md
- docs/explanation/pending-items-backlog-20260704.md
- docs/explanation/pending-tasks-inventory-20260701.md
- docs/explanation/performance-baseline.md
- docs/explanation/production-release-checklist-SKILL.md
- docs/explanation/rbac整合可行性分析与实施计划-2026-07-08.md
- docs/explanation/refactor-impact-analysis-2026-06-27.md
- docs/explanation/regression-suite.md
- docs/explanation/regression-test-report.md
- docs/explanation/seven-dim-config-data-definition.md
- docs/explanation/state-management.md
- docs/explanation/stock-selection-strategy.md
- docs/explanation/strategy/breakout-trading-strategy.md
- docs/explanation/strategy/core-scarce-strategy.md
- docs/explanation/strategy/fake-breakout-technical-docs.md
- docs/explanation/strategy/hot-momentum-strategy.md
- docs/explanation/strategy/stock-selection-strategy.md
- docs/explanation/strategy/value-bargain-strategy.md
- docs/explanation/strategy/watchlist-strategy.md
- docs/explanation/system-architecture.md
- docs/explanation/token-usage-cookbook.md
- docs/explanation/trading-core-factors.md
- docs/explanation/ui-design-agent-execution-plan.md
- docs/explanation/ui-only-implementation-summary.md
- docs/explanation/v10-architecture-alignment.md
- docs/explanation/v6-v9-architecture-audit-action-list.md
- docs/explanation/v6pro-to-v9-migration-analysis.md
- docs/explanation/v9-issue-management.md
- docs/explanation/v9-strategy-architecture.md
- docs/explanation/v9-代码实现分析报告.md
- docs/explanation/v9-架构缺陷与整改行动清单.md
- docs/explanation/v9-架构覆盖分析报告.md
- docs/explanation/v9-目标功能清单.md
- docs/explanation/vulnerability-scan-report.md
- docs/explanation/《V9数据架构修订建议》.md
- docs/explanation/双通道投研评分系统技术方案.md
- docs/explanation/数据治理路线图.md
- docs/guides/08-implementation-plan.md
- docs/guides/component-lifecycle-sop.md
- docs/guides/development/code-review/code-review-cheatsheet.md
- docs/guides/development/code-review/code-review-training.md
- docs/guides/development/code-review/solo-review.md
- docs/guides/development/mock-data-cleanup-lessons.md
- docs/guides/getting-started.md
- docs/guides/how-to-add-store.md
- docs/guides/how-to-add-widget.md
- docs/guides/how-to/COLOR-TOKEN-GUIDE.md
- docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md
- docs/guides/how-to/MCP-LIFECYCLE-GUIDE.md
- docs/guides/how-to/coverage-improvement-progress.md
- docs/guides/how-to/development-roadmap-todo.md
- docs/guides/how-to/hooks-guide.md
- docs/guides/how-to/mcp-acl-guide.md
- docs/guides/how-to/pathtrace-deployment-guide.md
- docs/guides/how-to/pathtrace-github-actions-deploy-guide.md
- docs/guides/how-to/testing/completeness-profile-batch2.md
- docs/guides/how-to/visual-regression-guide.md
- docs/guides/standards/coding-conventions.md
- docs/guides/team-handbook/01-design-philosophy.md
- docs/guides/team-handbook/02-architecture.md
- docs/guides/team-handbook/03-ui-components.md
- docs/guides/team-handbook/04-model-runtime.md
- docs/guides/team-handbook/README.md
- docs/guides/testing-strategy.md
- docs/guides/widget-development-guide.md
- docs/guides/踩坑规则门禁指南.md
- docs/lessons/directDataAPI-bugfix-2026-08-09.md
- docs/lessons/extreme-timeout-test-report-2026-08-09.md
- docs/lessons/push-summary-2026-08-09.md
- docs/lessons/stage3-4-changelog-2026-08-09.md
- docs/lessons/stage3-4-review-checklist-2026-08-09.md
- docs/meta/REGISTRY_INDEX.md
- docs/meta/audit-reports/agent-audit-report.md
- docs/meta/audit-reports/v6pro-v9-gap-analysis-final.md
- docs/meta/changelog-warnings-handling-strategy.md
- docs/meta/doc-system-check-v9.md
- docs/meta/strategy-doc-header-checklist.md
- docs/meta/文件整理清单.md
- docs/reference/2026-06-21-hashrouter-for-static-hosting.md
- docs/reference/AI_CENTER_DATA_DEFINITION.md
- docs/reference/AI_CENTER_VUE3_EXAMPLES.md
- docs/reference/BACKTEST_DATA_DEFINITION.md
- docs/reference/DATAFLOW_DATA_DEFINITION.md
- docs/reference/DATA_DICTIONARY_INDEX.md
- docs/reference/MULTI_FACTOR_SCREENING_DATA_DEFINITION.md
- docs/reference/NEWS_DATA_DEFINITION.md
- docs/reference/SEVEN_DIM_CONFIG_DATA_DEFINITION.md
- docs/reference/V9-TEST-CASES.md
- docs/reference/V9_IndexedDB_Store_Schema.md
- docs/reference/V9_数据血缘追踪.md
- docs/reference/V9数据宪法.md
- docs/reference/V9现有数据资产清单.md
- docs/reference/_contract-template.md
- docs/reference/action-list.md
- docs/reference/agent-runtime-spec.md
- docs/reference/ai-center-data-definition.md
- docs/reference/ai/service-integration-guide.md
- docs/reference/analysis-cabin-spec.md
- docs/reference/analysis-contract.md
- docs/reference/architecture-version-comparison.md
- docs/reference/atomic-component-system.md
- docs/reference/automation-test-plan.md
- docs/reference/autonomous-workflow-user-guide.md
- docs/reference/batchB-fix-plan.md
- docs/reference/batchD-fix-plan.md
- docs/reference/batchE-fix-plan.md
- docs/reference/changelogs/2026-07/2026-07-05-audit-false-positive-analysis.md
- docs/reference/changelogs/2026-07/2026-07-05-color-refactor-p1.md
- docs/reference/changelogs/2026-07/2026-07-05-color-refactor-p2.md
- docs/reference/changelogs/2026-07/2026-07-05-color-token-refactor.md
- docs/reference/changelogs/2026-07/2026-07-05-databridge-query-implementation.md
- docs/reference/changelogs/2026-07/2026-07-05-p2-completion-and-backlog.md
- docs/reference/changelogs/2026-07/2026-07-05-post-dev-review-actions.md
- docs/reference/changelogs/2026-07/2026-07-05-post-dev-review.md
- docs/reference/changelogs/2026-07/2026-07-05-systematic-doc-update.md
- docs/reference/changelogs/2026-07/2026-07-14-architecture-governance.md
- docs/reference/changelogs/2026-07/completeness-profile-p1.md
- docs/reference/changelogs/2026-07/jsdoc-update-summary-20260712.md
- docs/reference/changelogs/2026-07/pr-7-trade-error-classifier-split-plan.md
- docs/reference/changelogs/2026-08/registry-governance-summary.md
- docs/reference/changelogs/变更摘要-2026-06-28-phase0-数据层改造.md
- docs/reference/cockpit-news-doc-fix-plan.md
- docs/reference/cockpit/DATA_DEFINITION.md
- docs/reference/cockpit/cockpit-refactor-plan.md
- docs/reference/cockpit/data-definition.md
- docs/reference/command-cabin-spec.md
- docs/reference/completeness-profile-batch1.md
- docs/reference/completeness-profile-batch5.md
- docs/reference/completeness-profile.md
- docs/reference/component-deprecation-policy.md
- docs/reference/data-collection-task-list.md
- docs/reference/data-collection/DATA_DEFINITION.md
- docs/reference/data-collection/data-definition.md
- docs/reference/data-definition.md
- docs/reference/data-flow-spec.md
- docs/reference/databridge-split-plan.md
- docs/reference/databridge改进建议整改实施计划.md
- docs/reference/databridge端点与数据映射清单.md
- docs/reference/dataflow-engine-spec.md
- docs/reference/design-token-mapping.md
- docs/reference/design-tokens.md
- docs/reference/execution-contract.md
- docs/reference/fourth-industrial-revolution-core-resource-strategy.md
- docs/reference/input-cabin-spec.md
- docs/reference/meta/file-system-assessment-v2.md
- docs/reference/news-data-definition.md
- docs/reference/news/DATA_DEFINITION.md
- docs/reference/news/data-definition.md
- docs/reference/output-cabin-spec.md
- docs/reference/portfolio-contract.md
- docs/reference/pr-description.md
- docs/reference/prompts/autonomous-workflow-user-guide.md
- docs/reference/pwa-offline-guide.md
- docs/reference/refactor-research-pool-rename-plan.md
- docs/reference/risk-derived-data-definition.md
- docs/reference/rm剩余任务全量盘点与整改方案-2026-07-08.md
- docs/reference/scoring-contract.md
- docs/reference/seven-dim-advanced-config-implementation.md
- docs/reference/seven-dim-config-data-definition.md
- docs/reference/stock-analysis-contract.md
- docs/reference/stock-pool-board-migration-proposal.md
- docs/reference/stockpool-contract.md
- docs/reference/superpowers/plans/2026-06-29-data-relationship-blueprint.md
- docs/reference/superpowers/plans/2026-07-01-v6-architecture-dominance-batch-a.md
- docs/reference/superpowers/plans/2026-07-04-ui-testing-optimization.md
- docs/reference/system-contract.md
- docs/reference/templates/regression-suite.md
- docs/reference/trade/API_CONTRACT.md
- docs/reference/trade/api-contract.md
- docs/reference/ui设计优化实施计划-详细版.md
- docs/reference/unified-pool-storage-spec.md
- docs/reference/useStockAdd.md
- docs/reference/v6-to-v9-migration-spec.md
- docs/reference/v6pro-to-v9-migration-analysis.md
- docs/reference/v9-architecture-data-dictionary-validation-report.md
- docs/reference/v9-数据血缘追踪.md
- docs/reference/v9数据架构修订建议.md
- docs/reference/v9核心数据字典与类型定义(整合版).md
- docs/reference/《DataBridge端点与数据映射清单》.md
- docs/reference/《V9核心数据字典与类型定义（整合版）》.md
- docs/reference/《V9现有数据资产清单》.md
- docs/reference/《功能模块数据契约》.md
- docs/reference/功能模块数据契约.md
- docs/reference/网页测试检索校对纳入采集方案分析.md
- docs/release-notes/NETWORK-TROUBLESHOOTING.md
- docs/release-notes/RELEASE-NOTES-dark-mode-optimization.md
- docs/release-notes/RELEASE-NOTES-v2.0.0-rc.2.md
- docs/release-notes/RELEASE-NOTES.md
- docs/releases/PathTrace-v1.1.0-Release.md
- docs/reports/CHANGELOG.md
- docs/reports/RELEASE_NOTES.md
- docs/reports/TECH-DEBT.md
- docs/reports/audit/batch05-plan-20260811.md
- docs/reports/audit/batch06-strategy-plan.md
- docs/reports/audit/type-debt-cleanup-2026-08-12.md
- docs/reports/changelogs/development-log.md
- docs/reports/governance/2026-08-12-session-retrospective.md
- docs/reports/governance/final-retrospective-mobile-nav-2026-08-12.md
- docs/reports/governance/next-phase-architecture-optimization-plan-2026-08-10.md
- docs/reports/governance/p1-hardcode-fix-git-change-summary-2026-08-12.md
- docs/reports/governance/tech-debt-governance-summary-2026-08-10.md
- docs/reports/ops/backup-governance.md
- docs/reports/ops/data-source-config.md
- docs/reports/ops/production-deployment-guide.md
- docs/reports/p1-llmEnhancer-test-failure-investigation-2026-08-09.md
- docs/reports/project-management/td-015-p3-monitoring-review-plan.md
- docs/reports/project-management/v9-post-dev-review.md
- docs/reports/release-management/code-review-checklist-v2.6.0.md
- docs/reports/release-management/git-auto-push-operation-guide.md
- docs/reports/release-management/v2.6.0-changelog-draft.md
- docs/reports/testing/2026-07-05-exception-handling-test-report.md
- docs/reports/testing/V9-TEST-CASES.md
- docs/reports/testing/e2e-test-expansion-plan.md
- docs/reports/testing/hardcode-cleanup-plan.md
- docs/reports/testing/performance-baseline.md
- docs/reports/testing/stock-analysis-walkthrough-test-plan.md
- docs/reports/testing/test-catalog.md
- docs/reports/testing/trading-fix-diff-summary-2026-08-11.md
- docs/reports/testing/trading-mobile-nav-commit-changelog-2026-08-12.md
- docs/reports/testing/trading-regression-test-report-2026-08-11.md
- docs/reports/testing/unit-test-repair-roadmap.md
- docs/reports/zero-fallback-remediation-acceptance-report-2026-07-26.md
- docs/reports/《V9 代码实现分析报告》.md
- docs/reports/《V9 架构缺陷与整改行动清单》.md
- docs/reports/《V9 架构覆盖分析报告》.md
- docs/retro/2026-04-08-ci-coverage-rollup-fix.md
- docs/retro/2026-08-09-vite-proxy-hk-code-retrospective.md
- docs/specs/design/system-design.md
- docs/specs/product/competitive-analysis.md
- docs/specs/product/data-security-and-privacy.md
- docs/specs/《V9 目标功能清单》.md
- docs/test-strategy.md
