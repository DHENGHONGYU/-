---
title: S02 · 日常开发与提交 SOP
type: sop
domain: dev-workflow
phase: implementation
tier: T2
status: active
maintainer: V9 Architecture Team
summary: "分支 7 型命名策略 + git worktree 并行开发 + squash merge 三规则；3 类合法提交方式（Conventional 规范 / git commit -m 速提 / SkAI agent 智能提交），禁止 git gui / IDE 插件提交；附 pre-commit 22 步 + pre-push 6 步门禁速查表，补充 governance 文档的 1 个回滚缺口。"
tags: [sop, dev-workflow, git-strategy, commit-governance, pre-commit-checklist]
version: v1.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-SOP-002
related_docs:
  - V9-DOC-GIT-001  # git-commit-governance.md
  - V9-DOC-QA-065   # 质量门禁 09-quality-gates.md
  - V9-DOC-SOP-003  # S03 代码审查（下一阶段）
referenced_by: [V9-DOC-SOP-003, V9-DOC-SOP-004]
change_log:
  - version: v1.0.0
    changes: "Initial version：分支 7 型 + 3 种提交方式 + pre-commit/pre-push 速查表；对 git-commit-governance 补充 pre-commit 失败时的 3 步回滚操作（缺口 1）。"
    date: 2026-08-19
---

# S02 · 日常开发与提交 SOP

> **编号**：S02 · **适用场景**：Feature / Bug / Chore 等日常开发过程中的分支创建、编码、提交、推送全流程。  
> **执行角色**：全体开发工程师 · **预计耗时**：按功能复杂度变化（本 SOP 提供规范而非耗时参考）  
> **规范等级**：🟧 强约束（T2）。违反提交规范的 commit 不允许进入主干；使用 git gui 或 IDE 插件提交的 MR 直接打回。

---

## 参考文档与缺口补充说明

| # | 文档 | 本 SOP 引用方式 |
|---|------|---------------|
| 1 | [Git 提交治理规范](./how-to/git-commit-governance.md) | 原文 §1-§5 定义了 Conventional、Scope 列表、Husky 钩子、Rebase 策略，本文**不重写**；仅在 §4 Fix-1 处补充 governance 文档的**缺口：pre-commit 失败后如何回退部分暂存文件**（1 个缺口）。 |
| 2 | [质量门禁](../09-quality-gates.md) §Husky v2 scope-guard | §二 2.C 的 pre-commit 22 步速查表**直接引用其编号和阈值**（避免双重定义）。 |

---

## 一、前置条件（Prerequisites）

| # | 条件 | 验证方法 |
|---|------|---------|
| PC-1 | 环境已就绪（通过 S01 所有检查） | `npm run env:check` exit 0，AkShare venv 通过 `--verify-current` |
| PC-2 | Husky v5.x 已安装且钩子启用 | `ls .husky/pre-commit .husky/pre-push` 均存在；`git config --get core.hooksPath` = `.husky` |
| PC-3 | `git user.name` + `user.email` 已配置企业域 | `git config user.email` 以 `@公司域名` 结尾（禁止个人邮箱提交产品仓） |
| PC-4 | GPG 签名配置（推荐） | `git config commit.gpgsign=true`，或至少使用 annotated tags |

---

## 二、操作步骤

### 2.A · 分支策略（7 种分支类型 + worktree 并行 + squash merge 三规则）

**7 种分支命名规范**（AGENTS.md v1.6.0 同步约束）：

| 类型 | 命名模板 | 示例 | 合入目标 | 生命周期 |
|------|---------|------|---------|---------|
| 主分支 | `main` / `master` | `main` | —— | 永久 |
| 发布分支 | `release/<major.minor>` | `release/2.0` | main | 版本 EOL 后 30 天删除 |
| 功能分支 | `feature/<scope>-<简述>` | `feature/scoring-add-peg-ratio` | develop / release/* | 合入后即删 |
| Bug 修复分支 | `bugfix/<ticket_id>-<简述>` | `bugfix/TCK-3421-score-flip-flop` | develop / release/* | 合入后即删 |
| HOTFIX | `hotfix/<patch-ver>-<简述>` | `hotfix/2.0.1-xss-payload` | main + release/* | 合入 + 打 PATCH Tag 后删 |
| 文档分支 | `docs/<scope>-<简述>` | `docs/sop-suite-prelaunch-v2` | main | 合入后即删 |
| 重构分支 | `refactor/<scope>-<简述>` | `refactor/dataLayer-to-databridge` | develop | 合入后即删 |

**Git Worktree 并行开发**（≥ 2 个并行任务时强制使用）：

```powershell
# 创建 worktree（每个分支一个独立目录，避免 stash 混乱）
git worktree add ../FinSightV9-scoring feature/scoring-add-peg-ratio
git worktree add ../FinSightV9-bug3421  bugfix/TCK-3421-score-flip-flop
git worktree list   # 查看所有 worktree
# 用完清理
git worktree remove ../FinSightV9-scoring
```

**Squash Merge 三条适用规则**：
1. ✅ `feature/*` 合入 develop：**建议 squash**（使 commit 历史整洁，一个 feature 一个 commit）
2. ❌ `release/*` → main：**禁止 squash**（保留版本 commit 粒度，方便 bisect 定位）
3. ❌ `hotfix/*` → main / release：**禁止 squash**（保留 P0 修复的可追溯性）

### 2.B · 三种合法提交方式（🟥 禁止 Git GUI / IDE 插件提交）

> **FR-6 强制**：以下三种方式通过 Husky 钩子链路保证门禁必跑；GUI 或 IDE 插件提交时 Husky v2 scope-guard 可能无法正确拦截 scope 规则，**一律禁止**。

#### 方式 1 — Standard Conventional 手动提交（推荐，80% 场景）

```powershell
# (1) 智能暂存：按文件逻辑 group 多次 add（避免把无关改动塞进一个 commit）
git add -p                    # 交互式 hunk 级选择（推荐）
# 或
git add src/services/foo.ts tests/services/foo.test.ts

# (2) 用 Conventional Commit 规范写提交消息
git commit -m "<type>(<scope>): <subject>"  -m "<body>"  -m "<footer>"
```

**type** = `feat/fix/docs/style/refactor/perf/test/chore/ci/build/revert`（见 governance §1.1）  
**scope** = 从 governance §1.2 的 V9 标准 Scope 列表选择（如 `scoring/databridge/ui/agent/mcp/docs-ops/devops/global`）；**空 scope 仅允许 cross-cutting 如升级 Node.js**。  
**subject** 英文 + ≤ 50 字符，动词原形开头。body 中文说明（为何而非怎么做）。footer BREAKING CHANGE / Closes #issue。

#### 方式 2 — 极速提交（简单 chore/docs 场景）

```powershell
# 场景：一句话能说清楚、无需 body（如 "chore(docs): fix typo in AGENTS"）
git commit -m "docs(architecture): fix typo"
```

#### 方式 3 — SkAI 交互模式（复杂提交场景）

```powershell
# 调用项目自带的 Trae 集成 SkAI，自动：分析 diff → 生成 type/scope → 起草 message → 交互式修改 → 提交
skai commit --mode agent
# 流程：
#   1. SkAI 列出本次暂存改动涉及的文件与模块
#   2. 自动生成候选 Conventional Message（type + scope 从改动推断）
#   3. 用户在 CLI 中 approve / edit / regenerate
#   4. 最终 git commit（仍然通过 Husky 22 步门禁）
```

**禁止方式（违反即打回）**：
- ❌ `git gui` / GitHub Desktop / VSCode Source Control 面板点「提交」
- ❌ 自动 message（如 `git commit -m "."`、`git commit -m "fix"`）
- ❌ 中文 type / scope 混用

### 2.C · Husky 门禁速查表

**pre-commit 22 步（提交必跑，引用 AGENTS.md §七 22 步编号）**

| # | 子步骤名 | 命令缩写 | 判定 | 失败最常见 Tip |
|---|---------|---------|:---:|-------------|
| 1 | env:check | npm run env:check | B | §5 Fix-1 回滚方案（治理文档缺口） |
| 2 | secrets SAST | audit:secrets | B | 移动敏感值到 `.env.local` + `.gitignore` |
| 3 | venv verify | run-venv-python.cjs --verify-current | B | S01 §Step 4 重装 venv |
| 4 | lint-staged | npx lint-staged | B | 按 ESLint 报错逐行修；超过 50 处批量跑 `npm run lint -- --fix` |
| 5 | lint:colors | lint:colors | W | 改为 theme 令牌 |
| 6 | tsc:prod | tsc:prod | B | `tsc --force` 去幻影；scope 误配用 v9-tsc-gate-scope-audit |
| 7 | tsc:test | tsc:test | W | errors > 50 升级 BLOCK |
| 8 | audit:layers | audit:layers | B | DataBridge 改法 → v9-databridge-migration |
| 9 | audit:atomic | audit:atomic | B | 修正原子组件依赖方向 |
| 10 | audit:db-references | audit:db-references | B | 对齐 ENVELOPE_ACTION / ACL |
| 11 | audit:mcp | audit:mcp | W | Server 数量 = 15 |
| 12 | file:check | file:check | W | 文档命名规范 |
| 13 | doc:gate | doc:gate | B | docs-freshness-governance SKILL |
| 14 | audit:docs | audit:docs | B | doc-id 补全 + 版本漂移修复 |
| 15 | doc-id | audit:doc-id:fix --dry-run | B | REGISTRY_INDEX 补全 |
| 16 | ACL 一致性 | audit:acl-consistency | B | 补 actions.acl.ts 缺项 |
| 17 | Mock 残留 | audit:mock-modules | B | 替换 fetcher → v9-mock-data-diagnosis |
| 18 | AGENTS 契约 | audit:agents-consistency:changed | B | 严格模式用 :strict 全量 |
| 19 | 令牌 | verify:tokens + colorSoT | B | 设计令牌映射修正 |
| 20 | 复杂度 | complexity-scan | B | 分数超过需架构师签字 |
| 21 | 杂项 | audit:jsdoc/tests/tokens/widget/ai-output | W | 分别治理 |
| 22 | RAG 幻觉 | test:rag-gate（条件触发） | C | 条件：改 scoring/prompt，必须重跑 |

**判定缩写**：BLOCK(B) / WARN(W) / CONDITIONAL(C)。

**pre-push 6 步速查（Push 必跑，引用 AGENTS.md §Husky v2 scope-guard）**：

| # | 步骤 | 缩写 | 判定 |
|---|------|:---:|:---:|
| P1 | audit:layers | 层 | B |
| P2 | audit:hardcode Critical | 硬 | B |
| P3 | audit:deadcode 阈值 | 僵 | W |
| P4 | audit:secrets | 密 | B |
| P5 | tsc:prod | 型 | B |
| P6 | test:unit:quick | 测 | B |

> **速记口诀**：层 硬 僵 密 型 测（一哼僵密实测），Push 6 步。

---

## 三、通过标准

| 项 | 通过判定 |
|----|---------|
| 分支类型 | 7 种之一（非裸名无 type） |
| 提交方式 | 3 种合法方式之一，message 符合 Conventional + scope 合法 |
| pre-commit | BLOCK = 0（WARN 数 ≤ 8） |
| pre-push | BLOCK = 0（deadcode 超 <3% 可放行） |
| 推送 | `git push` 成功，远端无 rejected（`[rejected]` 输出 0 行） |

---

## 四、常见失败与修复（Top 5 · 含治理文档缺口补充）

| # | 失败场景 | 根因 | 修复命令 / 操作 | 说明 |
|---|---------|------|---------------|------|
| Fix-1 | **pre-commit 22 步失败后，有"只提交成功的文件"需求**（governance 文档缺口 1） | 治理文档 §5 只描述了"如何通过"，没写"暂存一半如何退回另一半" | **标准 3 步回滚**：<br>`git stash push -m "failed-precommit-rest" <other-files>` → `git commit <成功-files>` → `git stash pop` + 修其余文件后再提交。<br>**禁止**：`git reset HEAD --hard`（丢失未保存工作） | 🔺 补充治理文档 1 个缺口 |
| Fix-2 | tsc:prod 幻影错误 100+（类型均在 test 文件） | scope 误配（prod tsconfig 扫了 tests/） | `tsc -p tsconfig.prod.json --noEmit --force`；仍不行按 v9-tsc-gate-scope-audit SKILL | 引用 |
| Fix-3 | lint-staged 失败且错误 > 200 处 | 新安装规则或批量 import 变动 | `npm run lint -- --fix`（仅自动修复部分），剩余手动；最后 git add 再 commit | 引用 |
| Fix-4 | commit message Conventional 失败 | scope 拼写错误或 subject > 72 字 | `git commit --amend` 修改；若已推远端用 `git commit --amend && git push --force-with-lease` | governance §2 引用 |
| Fix-5 | Push 被拒（non-fast-forward） | 他人先提交了同一个分支 | 先 `git pull --rebase` 或 `git fetch + rebase`，解决冲突后再次 push（禁止 merge 合并拉取） | governance §4 引用 |

---

## 五、证据与归档

日常开发无需每 commit 归档，但以下两类事件必须存档：

| 场景 | 归档内容 | 目录 |
|------|---------|------|
| 每次成功合入主干的 feature/hotfix | 完整 pre-commit 22 步日志 + pre-push 6 步日志 | `docs/reports/dev-workflow/commit-logs/PR<id>.log` |
| 每次回滚 commit（`revert` / `reset`） | 回滚原因 + 影响评估 + 修复计划 | `docs/reports/dev-workflow/rollbacks/YYYY-MM-DD-<sha7>.md` |

```powershell
# Pre-commit 日志存档（PR 打开时自动，或手动）
$env:HUSKY_LOG_DIR='docs/reports/dev-workflow/commit-logs'
git commit -m "feat(scope): subject"  # 此时 Husky 自动 tee 到 <hash>.log
```

---

## 六、阶段跳转

- **前置阶段**：[S01 开发环境搭建 SOP](./S01-dev-env-setup.md) 已完成并通过
- **本阶段结束后**：推送远端成功 → 发起 PR → 进入 [S03 代码审查 SOP](./S03-code-review.md)
- **失败回退**：pre-commit/pre-push 失败 → Fix 对应条目后重新执行 §二 2.C 对应步骤

> **规范承诺**：本 SOP v1.0.0 与 git-commit-governance.md v1.4+ 双向对齐。若 governance 升级 Conventional 规则或 scope 列表，本 SOP §2.A/§2.B 同步修订后 bump 到 v1.x 并记录 change_log。
