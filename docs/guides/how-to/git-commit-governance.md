---
title: git-commit-governance
type: how-to
domain: qa
phase: operation
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "V9 Git 提交规范守卫使用指南：commit-msg 信息格式校验、commit-scope 作用域守卫（文件数/跨层/删除/临时产物）与 pre-commit 集成，含 Windows 兼容性约束与验证方法"
tags: [qa, git, hook, commit, gate, windows]
version: v1.0.0
last_updated: 2026-08-13
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-QA-121
related_docs: [V9-DOC-QA-116, V9-DOC-PROJ-903]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-08-13
---

# V9 Git 提交规范守卫使用指南

> **版本**：v1.0.0
> **更新日期**：2026-08-13
> **适用范围**：需要理解或维护 V9 Git 提交规范守卫的开发者（AI 辅助 + 人工编码）

---

## 1. 定位

V9 通过 **Husky 钩子** 在提交阶段强制提交规范，堵住「提交卫生」盲点。本指南聚焦其中的 **提交规范守卫** 三件套：

| 入口 | 角色 | 触发时机 |
|------|------|----------|
| `.husky/commit-msg` | 提交信息格式校验 | 每次 `git commit` |
| `scripts/audit/audit-commit-scope.sh` | 提交作用域守卫 | 每次 `git commit`（pre-commit 最先执行） |
| `.husky/pre-commit` | 集成入口，调用 scope 守卫 | 每次 `git commit` |

> 关联总览见 [development-workflow-sop](../../archive/historical-2026-08-16/batch7/docs/reference/development-workflow-sop.md（已归档）) §四；质量审计脚本全览见 [how-to-use-audit-scripts](how-to-use-audit-scripts.md)。

---

## 2. 规则明细

### 2.1 commit-msg — 提交信息格式校验

来源：[`.husky/commit-msg`](../../../.husky/commit-msg)

- **格式**：`type(scope): description`（Conventional Commits）
- **合法 type**：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- **scope**：`[a-zA-Z0-9_-]+`（可选，但项目约定必须用）
- **额外约束**：禁止中文冒号「：」，统一使用英文冒号「:」
- 空消息（`--allow-empty`）放行

### 2.2 audit-commit-scope.sh — 提交作用域守卫

来源：[`scripts/audit/audit-commit-scope.sh`](../../../scripts/audit/audit-commit-scope.sh)

| 规则 | 内容 | 处置 |
|------|------|------|
| 规则 1 | 单次提交文件数 ≤ 30 | 超限 BLOCK |
| 规则 2 | 禁止跨层混合提交（≥ 3 个顶层域） | BLOCK |
| 规则 3 | `src/` + `docs/` 目录删除项 > 30 | BLOCK |
| 规则 4 | 禁止临时产物混入（`test-output.txt` / `audit-out.txt` / `.tmp-` / `draft-` / `WIP` / `_temp` / `debug-output`） | BLOCK |

**顶层域分组**：src/components|components、src/hooks|hooks、src/services|services、src/store|store、src/lib|lib、src/utils|utils、src/types|types、src/constants|constants、src/config|config、src/styles|styles、src/apps|apps、src/pages|pages、src/assets|assets、src/i18n|i18n、src/__tests__|tests、docs|docs、scripts|scripts、tests|tests、playwright|e2e、.cypress|e2e、public|public、vite.config|build_config、eslint|lint_config、tsconfig|ts_config、.husky|husky、package.json|package_config、README|docs_root、CHANGELOG|docs_root、AGENTS|agents_root。

**根级文件精确匹配**：`package.json`、`tsconfig*.json`、`vite.config.ts`、`eslint*.config.js`、`.gitignore`、`.gitattributes`、`.dockerignore`、`AGENTS.md`、`CHANGELOG.md`、`README.md`、`playwright.config.ts`、`vitest.config.ts`、`.editorconfig`、.husky/pre-commit|pre-push|commit-msg 等归入对应域。

---

## 3. Windows 兼容性约束（必读）

以下约束是脚本在 Windows 上稳定运行的**前置条件**，团队协作时务必遵守：

| 项 | 约束 | 原因 |
|----|------|------|
| **运行环境** | 必须经 **Git Bash（MSYS）** 运行，不能直接在原生 cmd/PowerShell 调用 `sh` | 脚本依赖 POSIX 工具（`grep`/`awk`/`sort`/`tr`/`sed`/`cut`/`head`/`basename`）与 /tmp；husky v9 在 Windows 上正是经 git-bash 的 sh 调用 |
| **行尾（CRLF）** | 所有 `.sh` 必须保持 **LF**，禁止 CRLF | 若脚本以 CRLF 检出，`\r` 会附着在变量/模式末尾，导致 `case` 匹配、`grep -F`、`cut -d'|'` 失效。已由 `.gitattributes` 全局 `* text=auto eol=lf` 保障，勿改动 |
| **临时文件** | 用固定路径 + PID（/tmp/v9-scope-guard-$$），**禁用 `mktemp`** | Git Bash 下 `mktemp` 偶发 "Bad file descriptor"；脚本用 `trap cleanup EXIT` 兜底清理 |
| **git 输出** | `git diff --cached --name-only` 在 Windows 也输出 `/` 分隔 | 路径前缀匹配 src/components/* 有效；脚本用 `read -r` 整行读取，可正确处理含空格路径 |
| **中文输出** | 脚本输出 UTF-8 中文 | 在 cmd 默认代码页下可能乱码；建议团队在 Git Bash / 配置 UTF-8 的终端提交 |
| **`set -e` 安全** | 管道 / `if` / `|| echo 0` 组合已兜底 | 避免 `grep` 无匹配时在 `set -e` 下误退出 |

**验证当前状态**（已确认满足）：

```bash
git config core.autocrlf          # → false
git check-attr eol -- .husky/pre-commit .husky/commit-msg scripts/audit/audit-commit-scope.sh
                                  # → 三个均 eol: lf
```

---

## 4. 运行与验证

### 4.1 手动验证 commit-msg

```bash
# 合法信息 → 应通过（exit 0）
printf 'feat(input): 新增意向候选池筛选\n' > /tmp/msg-good.txt
sh .husky/commit-msg /tmp/msg-good.txt

# 非法信息 → 应阻断（exit 1）
printf '这是一条不符合规范的提交\n' > /tmp/msg-bad.txt
sh .husky/commit-msg /tmp/msg-bad.txt

# 中文冒号 → 应阻断（exit 1）
printf 'feat(input)：新增功能\n' > /tmp/msg-cn.txt
sh .husky/commit-msg /tmp/msg-cn.txt
```

### 4.2 手动验证 scope 守卫

在隔离的临时 git 仓库模拟暂存场景（单一域 / 跨 3 域 / 临时产物 / 双域），观察输出与退出码（`0` = 通过，`1` = 阻断）。

### 4.3 PowerShell 下的调用方式

PowerShell 无法直接解析 `sh`，需显式调用 Git Bash：

```powershell
& "C:\Program Files\Git\bin\bash.exe" -lc "sh scripts/audit/audit-commit-scope.sh"
```

> 若需捕获中文输出，建议在 bash 内部重定向到文件再读取，避免 PowerShell 输出编码丢失。

---

## 5. 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| 提交被 `commit-msg` 阻断 | 提交信息不符合格式 / 含中文冒号 | 改为 `type(scope): description`，用英文冒号 |
| 提交被 scope 守卫阻断（文件数 > 30） | 单次提交过多 | 拆分为多个原子提交 |
| 提交被 scope 守卫阻断（跨 ≥3 域） | 跨层混合提交 | 用 `git commit --only <paths>` 聚焦单一域 |
| 提交被 scope 守卫阻断（临时产物） | 混入 `test-output.txt` 等 | `git reset HEAD <file>` 移除，或加入 `.gitignore` |
| 终端 `sh: command not found` | 在原生 cmd/PowerShell 下运行 | 改用 Git Bash，或显式调用 `bash.exe` |

---

## 6. 维护义务

- **行尾**：任何 `.sh` 修改保持 LF；勿改动 `.gitattributes` 的 `eol=lf` 规则。
- **新增顶层域**：在 `audit-commit-scope.sh` 的 `DOMAIN_MAP` / `ROOT_FILE_MATCHES` 同步追加，并更新本文档 §2.2 分组表。
- **规则阈值调整**：涉及提交门禁口径变更，需更新本文档并评估是否影响 CI。
- **变更验证**：修改脚本后运行 §4 的验证用例，确认退出码符合预期后再提交。

> **最后验证**：修改本文档或脚本后，运行 `npm run audit:docs` 与 `npm run file:check` 确认文档一致性。

---

## 🔗 SOP 交叉引用（日常开发 → 提交标准化）

> 本文档定义「Git 提交/分支/合并的**规则**」（Conventional 规范、Scope 列表、Husky 钩子、Rebase 策略）。对应的**标准操作步骤**由 [S02 日常开发与提交 SOP](../sops/S02-dev-workflow.md) 承载，两者关系：**本篇 = 规则**、**S02 = 操作**。
>
> | 本篇章节 | S02 对应段落 | 补充的治理缺口（原文未覆盖） |
> |---------|------------|-------------------------|
> | §1 Conventional 规范 + §1.2 Scope 列表 | S02 §2.B 3 类合法提交方式（Standard Conventional / 速提 / SkAI 智能）+ 禁止 GUI/IDE 插件提交 | 明确 3 类提交方式；禁止 git gui / VSCode 插件（Husky scope-guard 可能被绕过）；本篇仅写了"怎么写规范"，未写"用什么工具提交" |
> | §2 Husky 钩子（pre-commit / commit-msg / pre-push） | S02 §2.C pre-commit 22 步 + pre-push 6 步**速查表**（表格式 + 判定 + Tip） | 提供一张"背表 + 速记口诀（层硬僵密实测）"；本篇 §2 列出了钩子，但没有一张一目了然的表给 commit 前 30 秒快速过 |
> | §3 Scope Guard / §4 Rebase vs Merge | S02 §2.A 7 型分支命名 + Git Worktree 并行 + Squash 3 条适用规则 | 补充 worktree 并行开发命令（多任务避免 stash 混乱）；本篇写了 merge vs rebase 抽象策略，没写具体"多分支怎么办"命令 |
> | §5 失败处理（仅写了"如何通过"） | S02 §4 Fix-1：**pre-commit 失败时只回退部分暂存文件的 3 步标准回滚** | **补 gap-1**：治理文档 §5 最大的缺口 — 只描述"失败 → 重新 fix → 重新 commit"的笼统路径，没写最常用的操作「已经暂存 A+B+C 文件，pre-commit 仅因 C 文件失败，要怎么只提交 A、B，留 C 后面修」的标准操作（`git stash push <rest>` → commit → pop）；以及对应的禁忌（禁止 `git reset --hard` 丢工作） |
>
> 一致性承诺：当本篇调整 Conventional scope 列表 / Husky 钩子步骤 / Merge 策略时，S02 §2.A/§2.B/§2.C 同步更新；S02 的版本号与本篇版本号保持一致。
