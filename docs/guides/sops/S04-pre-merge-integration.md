---
title: S04 · 合并前集成测试 SOP
type: sop
domain: integration
phase: pre-merge
tier: T1
status: active
maintainer: V9 Architecture Team
summary: "PR 合入主干前的标准集成测试流程：单模块准入 → gate:quick 快速门禁 → 可信单元测试（排除 quarantine ≥99.2%）→ tsc:prod + audit:layers + ACL 一致性 → CI 对比 → E2E 冒烟，附本地 vs CI 结果双检与 merge dry-run 冲突预防。"
tags: [sop, integration, pre-merge, gate-quick, CI-comparison, test-stable]
version: v1.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-SOP-004
related_docs:
  - V9-DOC-QA-065     # 质量门禁 09-quality-gates.md
  - V9-DOC-QA-116     # how-to-use-audit-scripts.md（审计脚本解读）
  - V9-DOC-MOD-STD    # module-completion-standard.md（单模块准入）
  - V9-DOC-TEST-STRATEGY  # testing-strategy.md（可信测试定义）
referenced_by: [V9-DOC-SOP-005]
change_log:
  - version: v1.0.0
    changes: "Initial version：抽取 22 步门禁与 pre-push 6 步子集，定义合并前集成测试的标准链路与阈值，补充 CI vs 本地双检与冲突预防 dry-run。"
    date: 2026-08-19
---

# S04 · 合并前集成测试 SOP

> **编号**：S04 · **适用场景**：功能分支（`feature/*` / `hotfix/*`）向主干（`develop` / `release/*`）发起 PR 并通过 Code Review 后、合入前的最后一次集成级验证。  
> **执行角色**：PR Owner / Reviewer（二次签名） · **预计耗时**：15–25 分钟  
> **规范等级**：🟥 强制执行。未通过本 SOP 的 PR 禁止点击 Merge 按钮。GitHub Branch Protection 规则中设置「仅当 CI 集成测试 PASSED 方可合入」做技术兜底。

---

## 参考文档与交叉引用

| # | 文档 | 引用位置 | 说明 |
|---|------|---------|------|
| 1 | [质量门禁标准](../09-quality-gates.md) | §3 通过标准 | gate:quick、可信单元测试等阈值的真相源 |
| 2 | [如何使用质量审计脚本](../how-to/how-to-use-audit-scripts.md) | §2 STEP 2–7 的命令参数说明 + §4 Top 失败修复 | 本 SOP 仅补充 2 条**集成专项**失败（见 §4 Fix-7/8），其余 6 类失败按该文档 §6.2 处理 |
| 3 | [模块完成度标准](../module-completion-standard.md) | §一 PC-3 / §二 STEP 1 | 单模块进入集成前的准入条件 |
| 4 | [测试策略文档](../testing-strategy.md) | §二 STEP 3 可信测试定义 | Quarantine 机制说明、稳定测试子集的维护流程 |

---

## 一、前置条件（Prerequisites）

| # | 条件 | 验证方法 | 通过判定 |
|---|------|---------|---------|
| PC-1 | **功能分支已通过 Code Review**（S03 阶段结论），Reviewer 已批准 Approve | GitHub PR 页 Review Status = APPROVED（≥ 2 Reviews：1 同域 + 1 跨域） | 人工核对 PR 页 |
| PC-2 | 分支无 merge conflict 与 main / target branch | `git merge-base --is-ancestor HEAD origin/main && git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main 2>&1 | Select-String -Pattern '<<<<<<<|>>>>>>>'` | 0 处冲突字符串 |
| PC-3 | **单模块准入通过**：本次 PR 影响的所有模块均满足 [模块完成度标准](../module-completion-standard.md) §2 验收清单（S10 合规测试、S11 性能约束、S12 用户验证三轮全 PASS） | 对照模块完成度清单逐项打勾；或执行 `npm run audit:module-completion -- --scope <moduleName>` 辅助 | 清单 = 0 缺口 |
| PC-4 | **CI Pipeline 至少跑过 1 次**（相同 commit SHA）且「已知非产品 Bug 的失败」已登记入 quarantine.list | 查看 GitHub Actions 记录；若首次提交，先触发一次 CI 后再执行本节 | CI 已运行 + 差异项登记 |
| PC-5 | 工作区「干净」：`git status --short` = 空，无未提交的本地修改（防止「本地未提交的临时修复」让测试假象通过） | `git diff HEAD --quiet && git status --short | Measure-Object -Line` | Lines = 0 |

---

## 二、操作步骤（14 步）

### STEP 1 — 单模块准入复核（BLOCK）

```powershell
# 若不知本次影响范围，自动推导：
$affected = git diff --name-only origin/main...HEAD | Select-String -Pattern 'src/modules/([^/]+)' | ForEach-Object { $_.Matches.Groups[1].Value } | Sort-Object -Unique
Write-Output "本次影响模块：$affected"

# 对每个模块执行模块完成度辅助审计（若某模块无清单输出 Warning）
foreach ($m in $affected) { npm run audit:module-completion -- --scope $m }
```

**判定**：所有模块 PASS / WARN ≤ 1（PASS 优先）。引用 [模块完成度标准](../module-completion-standard.md) §2，不重写。

### STEP 2 — **gate:quick 快速门禁**（BLOCK · 集成核心）

```powershell
# ——— 命令说明 ———
# package.json 定义：gate:quick = audit:layers + audit:hardcode + audit:deadcode +
#                                   audit:secrets + tsc:prod + test:unit:quick + audit:component-usage
# 即 pre-push 6 步 + 组件使用审计，目标 ≤ 8 分钟
npm run gate:quick
```

**7 个子门禁详解（从 [如何使用审计脚本](../how-to/how-to-use-audit-scripts.md) §3.1 引用）**：

| 子步骤（内部） | 命令 | 目标耗时 | 目的 |
|--------------|------|---------|------|
| GQ-1 | `audit:layers` | ≤ 60s | 分层合规 |
| GQ-2 | `audit:hardcode` | ≤ 45s | Critical=0 |
| GQ-3 | `audit:deadcode` | ≤ 60s | 僵尸组件 < N+3% |
| GQ-4 | `audit:secrets` | ≤ 30s | 密钥 = 0 |
| GQ-5 | `tsc:prod` | ≤ 120s | 类型 = 0 error |
| GQ-6 | `test:unit:quick` | ≤ 180s | 单元快测 ≥ 98% 通过 |
| GQ-7 | `audit:component-usage` | ≤ 30s | 注册一致 |

**通过标准**：GQ-1…GQ-7 全部 exit 0，总耗时 ≤ 10 分钟（超时进入 P1 WARN）。

### STEP 3 — **可信单元测试**（排除 quarantine，BLOCK）

```powershell
# 定义：vitest 全量 - 去掉 tests/quarantine.list（由 test:stable 语义保证）
npm run test:stable
```

**可信判定 3 条件**（自 [测试策略文档](../testing-strategy.md) §可信单元测试定义 引用）：
1. ❌ 排除 `tests/quarantine.list` 内的全部 Case（列表由 QA 每两周维护并发布）
2. ✅ 测试文件必须存在 ≥ 3 个月，近 30 天内无"多次 flip-flop 先红后绿随机通过"记录
3. ✅ 必须含"正向 + 反向 + 边界"三维 Case（`audit:tests` 脚本会校验命名规范）

**通过率阈值**（集成场景）：≥ **99.2%**（低于上线场景的 99.6%，但仍非常严格）。

### STEP 4 — tsc:test 集成类型快速校验（WARN）

```powershell
npm run tsc:test
```

**目的**：提前发现 test 文件对源码的隐性依赖（pre-push 未覆盖）。errors > 20 → WARN。

### STEP 5 — 架构分层 + 原子组件双门禁（BLOCK，与 gate:quick 重复但为 CI 一致性核对）

```powershell
npm run audit:layers
npm run audit:atomic
```

与 gate:quick 输出做**字符串级比对**：若本地 ≠ CI（同 SHA），标记环境漂移 BLOCK。

### STEP 6 — ACL 一致性（集成 BLOCK 级）

```powershell
npm run audit:acl-consistency
```

**集成场景特化要求**：若本次 PR 修改 `actions.acl.ts` / `mcpAclInterceptor.ts` / `DataBridge.ts`，必须补 `test:acl:extended` 扩展：

```powershell
# PR 命中 ACL 三文件时强制执行
npm run test:acl:extended   # 84 条 case，耗时 ≤ 150s
```

### STEP 7 — E2E 快速冒烟（≤3 分钟，BLOCK）

```powershell
npm run test:e2e-verify   # 用 S05 §4 同一套官方套件（简化模式）
```

与 S05 全量真数不同，集成场景允许简化：仅跑"沪深 5 只 + 港股 2 只 + 美股 2 只 + ETF 2 只"共 **11 只** 的最小集（`--lite` flag 默认启用）。  
**通过率**：≥ 98%（允许 1 只偶发网络超时，连续 2 次才 BLOCK）。

### STEP 8 — CI 结果对比（本地 vs CI SHA 一致性）

```powershell
# 8.1 抓取 CI 的报告（GitHub Actions 已上传 artifacts）
# 假设本地下载路径为 ./temp/ci-report-<SHA>.json

# 8.2 对比 4 个关键字段（本地 vs CI）
node -e @"
const local = { tsc: require('./temp/local-tsc.json'), stable: require('./temp/local-stable.json') };
const ci = require('./temp/ci-report-$($(git rev-parse HEAD)).json');
const keys=['tsc.prod.errors','stable.passRate','stable.total','layers.violations'];
let diffs=0; keys.forEach(k=>{ if(_.get(local,k) !== _.get(ci,k)) { console.log('DIFF',k,_.get(local,k),'vs',_.get(ci,k)); diffs++ }});
process.exit(diffs ? 1 : 0);
"@
```

**CI vs 本地 0 差异**（允许 `test:stable` 通过率差 ≤ 0.2%，归因于随机测试顺序）。

### STEP 9 — CI 模式完整复现（BLOCK）

```powershell
# CI 环境用 test:ci（CI=true，并行度 = max，失败后不重跑）
$env:CI='true'
npm run test:ci
```

与本地 `test:stable` 结果对比，差异 > 5 个用例或通过率差 > 0.3% → BLOCK。

### STEP 10 — 单模块联调专项（按 PR scope）

```powershell
# 例：若 PR 改 scoring（V6 评分引擎），补跑 3 个专项
npm run test:v6-discrimination   # 评分区分度
npm run test:rag-gate            # 幻觉门禁
npm run test:acl:extended        # ACL（改 DataBridge 时）
```

**判定**：专项全通过（0 失败）。

### STEP 11 — Merge Dry-run（冲突预防）

```powershell
# 不真实 merge，仅在 index 中模拟冲突
git merge --no-commit --no-ff origin/main
$conflicts = (git diff --name-only --diff-filter=U)
if ($conflicts) { Write-Host "⚠️ DRY-RUN 冲突：$conflicts" -Foreground Red; git merge --abort; exit 1 }
else { Write-Host "✅ 无冲突"; git merge --abort; exit 0 }
```

**BLOCK**：有冲突时必须先本地 rebase 解决。

### STEP 12 — 复杂度不增复现

```powershell
npm run complexity-scan
```

**判定**：Complexity Score ≤ baseline（或上升 ≤ 3% 并附架构师审批邮件）。

### STEP 13 — 数据蓝图一致性

```powershell
npm run validate:blueprint
```

### STEP 14 — 报告生成 + Reviewer 二次签名

```powershell
# 运行集成测试套件 + 质量聚合（统一的集成产物入口）
npm run test:integration
npm run gate:aggregate
# 归档：把 2 条命令输出复制到下方模板，另存为
# docs/reports/integration/$(Get-Date -Format yyyy-MM-dd)_P${env:PR_NUMBER}_$($(git rev-parse HEAD).Substring(0,7)).md
```

**报告模板（复制后在目标文件中填写）**：

| 段落 | 内容 |
|---|---|
| PR 号 / SHA | `$env:PR_NUMBER` / `$(git rev-parse HEAD)` |
| gate:quick | 粘贴 BLOCK/WARN/INFO 汇总表 |
| test:stable | 通过率（需 ≥ 99.2%）+ 用例总数 + quarantine 列表 |
| tsc:prod / tsc:test | error 数 + 处理方式说明 |
| E2E 冒烟 | 通过率 + 失败单只股票清单（如有） |
| 复杂度 | ΔComplexity（必须 ≤ 基线） |
| 构建产物 | build 耗时 + bundle 尺寸 |
| 结论 | Go / Need-fix（需附修复路径） |

将产物附到 PR 评论中，@ 2 名 Reviewer 追加"集成测试签名 Approve"。

---

## 三、通过标准

| 类别 | 判定规则 | 对应 §二 步骤 |
|------|---------|-------------|
| 🟥 BLOCK（8 项，全部 0） | gate:quick 全通过、可信单元测试 ≥ 99.2%、audit:layers=0、ACL 一致、E2E 冒烟 ≥ 98%、CI 模式无异常、CI 本地差异≤5 用例、Merge Dry-run 无冲突 | STEP 2,3,5,6,7,9,8,11 |
| 🟠 WARN（≤ 2） | tsc:test errors 21~50、Complexity Score 略超基线（审批后）、gate:quick 超时 10~15m、E2E 11 只集内单只超时 | STEP 4/12/7 |
| 🟡 INFO（不限） | 专项测试覆盖率略低（≥ 80%，但不低于模块完成度要求）、lint warnings 略增 | STEP 1/10 |

**最终 Go/No-Go**：BLOCK = 0 且 WARN ≤ 2 → 允许 Merge；否则 BLOCK 修复后重跑本 SOP 从 STEP 1 开始。

---

## 四、常见失败与修复（Top 8）

> **Fix 1–6** 来自 [如何使用质量审计脚本](../how-to/how-to-use-audit-scripts.md) §6.2（引用不重写）：
> - Fix-1 TSC_PROD_FAIL：`tsc --force` 清幻影错误 + `audit:layers` 定位跨层 import
> - Fix-2 RAG_FAIL：Golden 增补 + 双审 + `test:rag-all` 5 件套
> - Fix-3 ACL_FAIL：`actions.acl.ts` 补齐缺失 → `mcpAclInterceptor` 自动生成
> - Fix-4 HARDCODE_MAJOR：定位 file:line → 显式守卫或常量归位（`v9-constant-migration`）
> - Fix-5 LAYERS_VIOLATION：改 DataBridge forward/query → `v9-databridge-migration`
> - Fix-6 MOCK_RESIDUE：grep mock → 改为真实 fetcher → `v9-mock-data-diagnosis`

### Fix-7（本 SOP 补充 · 集成专项 1）**CI 与本地通过率差异 > 5 用例**

- **典型症状**：本地 `test:stable` 99.8% 通过，CI 只有 98.9%，且失败 Case 名互不重合
- **根因分类**：① 环境变量缺失（CI 有 `CI=true`，本地默认 `undefined`）；② 随机数种子不一致（测试使用非 seed 随机）；③ 并行度高导致的竞争条件
- **标准修复命令**：

```powershell
# (1) 对齐环境变量
$env:CI='true'; $env:NODE_ENV='test'; $env:VITE_DATA_SOURCE_TYPE='mock'

# (2) 对齐 vitest 参数（CI 模式通常 --pool=forks + 随机执行）
npx vitest run --pool=forks --poolOptions.forks.singleFork=true --sequence.shuffle --reporter=verbose tests/xxx.test.ts

# (3) 重跑失败用例，加 --retry=2 确认非 flip-flop
npx vitest run <失败文件名> --retry=2
```

- **对应 SKILL**：`collection-pipeline-testing`（若是数据/采集相关 Case）

### Fix-8（本 SOP 补充 · 集成专项 2）**Merge Dry-run 出现跨模块冲突**

- **典型症状**：`git merge --no-ff --no-commit origin/main` 后 `src/App.tsx`、`AGENTS.md`、`package.json` 三文件被标 UNMERGED
- **根因分类**：① 多人同时新增路由；② 多人修改 package.json scripts；③ AGENTS.md 多人版本号 bump
- **标准修复命令**：

```powershell
# (1) 交互式 rebase + 解决冲突（推荐）
git rebase -i origin/main
# → 编辑冲突文件（优先使用"合并双方 + 去重"策略：
#    App.tsx 两侧新增路由均保留；package.json 脚本先合并再按名字排序去重）

# (2) 冲突解决后重跑 Merge Dry-run（STEP 11），直至无冲突
```

- **对应文档**：[git-commit-governance.md §4 Rebase vs Merge 规则](../how-to/git-commit-governance.md)

---

## 五、证据与归档

| # | 证据 | 命名模式 | 生成方式 |
|---|------|---------|---------|
| E1 | gate:quick 完整 stdout + stderr | `01-gate-quick-<sha7>.log` | `npm run gate:quick 2>&1 \| Tee 01-gate-quick-$(git rev-parse --short HEAD).log` |
| E2 | test:stable JSON 报告 | `02-test-stable-<sha7>.json` | `npx vitest run --reporter=json --outputFile.json=02-test-stable-$(git rev-parse --short HEAD).json` |
| E3 | CI vs 本地差异 diff 报告 | `03-ci-local-diff-<sha7>.md` | STEP 8 脚本 tee 输出 |
| E4 | E2E 冒烟 11 只结果 | `04-e2e-verify-lite-<sha7>.json` | `npm run test:e2e-verify -- --reporter=json` 输出 |
| E5 | test:ci 报告 | `05-test-ci-<sha7>.xml` | JUnit reporter |
| E6 | Merge Dry-run 结果 | `06-merge-dry-run-<sha7>.txt` | STEP 11 输出 + "No conflicts" 标记 |
| E7 | 最终报告（含 Reviewer 签名） | `07-report-P<pnum>-<sha7>.md` | STEP 14 自动脚本 |

**归档目录**：`docs/reports/integration/YYYY-MM-DD_P<pr-number>_<sha7>/`

```powershell
# 打包命令
$sha7=$(git rev-parse --short HEAD)
$dir="docs/reports/integration/$(Get-Date -Format 'yyyy-MM-dd')_P$(node -e 'console.log(process.env.PR_NUMBER||0)')_$sha7"
New-Item -ItemType Directory -Force $dir | Out-Null
Move-Item 0[1-7]-* $dir
```

---

## 六、阶段跳转

- **前置阶段**：[S03 · 代码审查 SOP](./S03-code-review.md) 全部 BLOCK=0（Approve ≥ 2）
- **后续阶段**：本 SOP BLOCK=0 → GitHub Merge → 进入 release 分支后执行 [S05 · 上线前全面体检 SOP](./S05-pre-launch-checklist.md)
- **失败回退**：BLOCK > 0 → 返回 [S02 · 日常开发与提交 SOP](./S02-dev-workflow.md) §3.3 Bug 修复子流程修复后重新发起 PR
