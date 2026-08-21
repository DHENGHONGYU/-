---
type: deliverable
domain: data-collection
doc_id: V9-DELIVER-20260822-COMMIT-PLAN
title: 待提交改动分组清单（维度10-16接线+GAP-4 / 复杂度扁平化 两批次）
code_version: "2.0.0-rc.2"
version: v1.0.0
last_updated: 2026-08-22
change_log:
  - version: v1.0.0
    changes: "Kimi Work 会话完成 mandatory 技能门禁（collection-pipeline-testing + data-flow-integrity-audit）后产出：两逻辑批次分组、精确 git add 路径、commit message 与提交前复验清单"
    date: 2026-08-22
---

# 待提交改动分组清单（2026-08-22）

> 基线 commit：`8bab431b`（docs 批次 8/8）
> 门禁证据：见 `deliverables/2026-08-21-collection-governance.md` v1.1.0 change_log + 本会话实测（全部 exit 0）
> ⚠️ 提交纪律（AGENTS.md v1.6.0+ 硬约束）：**禁止 `git add -A`**；每组提交前核对 `git diff --cached --stat` 文件数与本清单一致。

## ⚠️ 提交前必读：并发会话仍在写入

本会话期间检测到另一会话（复杂度治理批次）持续追加改动：`chipDistribution.ts`（曾引入 TS2393 重名冲突，已在本会话修复）、`reviewLaunchEvaluator.ts`、`ddm.ts`、`correlationAnalyzer.ts`、`crossModelValidator.ts`、`ragRetriever.ts` 均为会话中新出现。
**TRAE 提交前必须重新执行**：

```bash
git status --short                                    # ① 以实时清单为准，比对本文件
node node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit --incremental false   # ② 必须 0 错误
node node_modules/tsx/dist/cli.mjs scripts/audit/audit-layer-calls.ts                     # ③ 必须 0 违规
```

> 注：本环境无 npm/npx，门禁请用上述 `node node_modules/...` 直连形式（npm scripts 等价物见下表备注）。

---

## 批次 ① feat/fix：维度 10-16 采集接线修复 + GAP-4 预算守卫落地

**逻辑归属**：collection-pipeline-governance Scenario F + GAP-4 闭环；mandatory 技能 `collection-pipeline-testing` / `data-flow-integrity-audit` 已 PASS。

**文件（9 个）**：

```bash
git add \
  src/config/dbConfig.ts \
  src/services/data-collector/collectionPipeline.ts \
  src/services/data-collector/MonthlyBudgetGuard.ts \
  src/services/data-collector/MonthlyBudgetGuard.test.ts \
  src/services/data-collector/collectionPipeline.dispatch.test.ts \
  tests/collection-dry-run.test.ts \
  package.json \
  deliverables/2026-08-21-collection-governance.md \
  deliverables/E2E-westock-quality-report.md
```

**核对**：`git diff --cached --stat` 应为 9 文件（7 src/tests + 2 deliverables，package.json 仅新增 `data-collector:dry-run` / `test:services:collection-pipeline:prod` 两脚本）。

**建议 commit message**：

```
fix(data-collector): 维度10-16采集接线修复 + GAP-4月度预算守卫落地

- collectionPipeline: NonQuoteMode 补 5 mode，NON_QUOTE_MODES 集合替代 || 链，DIMENSION_TO_ACTION 补 10-14→saveLocalDocs，local_docs id/schema 兜底
- dbConfig: ACL_MATRIX[fetcher] read/write 增 localDocs（修 fail-closed 拒写）
- MonthlyBudgetGuard: GAP-4 补实现（四级状态+sanityCheck，12 例单测）
- 新增 dispatch 防漂移回归 + dry-run 静态接线校验；package.json 补 2 个 npm 脚本
- 门禁: tsc:prod=0 / audit:layers=0 / audit:acl-consistency=0 / audit:db-references=0 / validate:blueprint✅ / vitest 采集域 138 passed
- mandatory:collection-pipeline-testing PASS; mandatory:data-flow-integrity-audit PASS
```

---

## 批次 ② refactor：复杂度扁平化治理（嵌套压平 / 辅助函数抽取）

**逻辑归属**：complexity-governance（`scan_out.json` 扫描基线：deeplyNestedBlocks 113 → 102）；纯重构，无行为变更。

**文件（12 个，以实时 git status 为准）**：

```bash
git add \
  src/services/lifecycle/analysisResultLifecycle.ts \
  src/services/llm/jsonParser.ts \
  src/services/orchestration/researchPipelineOrchestrator.ts \
  src/services/portfolio/portfolioService.test.ts \
  src/services/scoring/rles-engine/reviewLaunchEvaluator.ts \
  src/services/scoring/v6-engine/calculators/chipDistribution.ts \
  src/services/scoring/v6-engine/calculators/l3/ddm.ts \
  src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts \
  src/services/scoring/v6-engine/calculators/l7_l8.ts \
  src/services/scoring/v6-engine/correlationAnalyzer.ts \
  src/services/scoring/v6-engine/crossModelValidator.ts \
  src/services/scoring/v6-engine/engine.ts \
  src/services/scoring/v6-engine/ragRetriever.ts \
  src/services/skills/trendTechnicalTimingSkill.ts \
  src/services/storage/ConflictResolver.ts \
  src/services/storage/SnapshotManager.ts \
  src/services/system/bootstrapService.ts
```

**核对**：`git diff --cached --stat` 文件数与实时 `git status` 中除批次①外的剩余项一致（并发会话可能继续追加；若超过单提交 ≤30 文件上限则继续细分 v6-engine 子批次）。

**建议 commit message**：

```
refactor(services): 复杂度扁平化——嵌套压平与辅助函数抽取（无行为变更）

- bootstrapService/jsonParser/chipDistribution 等 17 文件深层嵌套压平
- chipDistribution: 获利盘累积抽取为 calcProfitRatioFromBuckets（避开既有导出 API calcProfitRatio 重名）
- 门禁: tsc:prod=0 / audit:layers=0 / 相关 vitest 全绿（portfolio 31 + chip 221 + v6/skills/orchestration 84）
```

---

## 不纳入提交

| 路径 | 原因 |
|---|---|
| `outputs/collection-test-before.txt` | outputs/ 为本地快照目录（gitignored） |
| `_apply_patch.cjs` / `_scan.json` / `scan_out.json` | 已在 Kimi Work 会话删除（scope-guard 拦截项） |

## 提交后收尾

1. `git log --oneline -3` 确认两笔 commit 落地；
2. push 前 pre-push 钩子会跑 `skill-router --enforce --since <base>`：本改动命中 mandatory 技能已在本会话确认并全绿，若钩子仍拦截可用 `SKILL_GATE_CONFIRM=1 git push` 旁路（依据 AGENTS.md v1.5.5）；
3. Live E2E（`WESTOCK_LIVE_E2E=1`）非本次提交阻断项——真实取数证据已含于 `deliverables/E2E-westock-quality-report.md`（2026-08-21 16:19 实测，综合均值 94.4）；下次**上线发布前**仍需按 S05 补跑。
