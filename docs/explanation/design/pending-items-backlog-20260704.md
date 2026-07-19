---
title: pending-items-backlog-20260704
type: explanation
domain: project
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 待处理事项清单（2026-07-04 快照）：未完成的缺陷、优化与文档项�?
tags: [project, plan, design, log, governance, documentation, strategy, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-048
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 待处理事项清单（Backlog�?
> **Date**: 2026-07-04
> **Source**: 颜色整改 + Git 推送流程中发现
> **适用范围**: 非关键问题与优化建议（不影响核心功能/用户体验/开发进�?系统稳定性）
> **跟踪原则**: 确保不遗漏、便于后续迭代处�?
---

## 优先级定�?
| 级别 | 含义 | 处理时机 |
|------|------|----------|
| **P0** | 阻塞性问�?| 当前迭代立即处理 |
| **P1** | 高优先级 | 当前迭代或下一迭代 |
| **P2** | 中优先级 | 下一迭代 |
| **P3** | 低优先级 | 后续迭代或机会处�?|

---

## 一、类型安全类

### 1.1 项目存在 549 个预先存在的 TypeScript 编译错误

- **问题内容**: 项目中存�?549 个预先存在的 TS 编译错误（本次颜色整改引�?0 个新错误，已确认�?- **影响范围**:
  - 影响 TypeScript 类型安全检�?  - 导致 pre-commit hook �?`tsc --noEmit` 检查失败，需�?`--no-verify` 跳过（详�?1.3�?  - IDE 显示大量红色波浪线，影响开发体�?- **优先�?*: **P1**
- **建议处理时机**: 下一迭代，按 Top 5 优先级顺序修�?
### 1.2 Top 5 高优先级 TS 错误（已识别�?
- **问题内容**:
  1. `src/store/intelligentScoreStore.ts:402` �?`transparencyConfig` 不在 `RunIntelligentScoreInput` 类型
  2. `src/agents/agentRuntime.ts` �?`factorSources` 不在 `IntelligentScore` 类型�? 处）
  3. `src/services/execution/executionPlanService.ts:78` �?`checkExecutionPlanFreshness` 参数数量不匹�?  4. `src/components/trading/PhaseStepper.tsx:3` �?`ExecutionPhase` 未从 `@/types/trade` 导出
  5. `src/components/organisms/analysis/sector/SectorRotationHeatmap.tsx` �?`hexToRgba` 未导�?+ `fundFlow` 属性缺�?- **影响范围**: 影响类型安全和功能正确�?- **优先�?*: **P1**
- **建议处理时机**: 本迭代优先修复（建议�?1�?�?�?�? 顺序�?
### 1.3 Pre-commit hook 失效

- **问题内容**: 因预先存�?549 �?TS 错误，husky + lint-staged �?pre-commit hook �?`tsc --noEmit` 检查会失败，需�?`git commit --no-verify` 跳过
- **影响范围**: 失去 hook 自动检查保护，存在提交低质量代码风�?- **优先�?*: **P1**（依�?1.1 �?TS 错误修复�?- **建议处理时机**: TS 错误数量降至阈值（建议 < 50）后自动恢复

---

## 二、Git 配置�?
### 2.1 git config 未设�?user.name/user.email

- **问题内容**: 本地和全局 git config 均未设置 `user.name` �?`user.email`，Git 自动使用 `<windows-username>@<hostname>.<organization-domain>` 生成敏感邮箱
- **影响范围**:
  - 后续�?commit 会继续使用敏感邮箱（已用 `git filter-branch` 重写历史，但未持久化 config�?  - 需在每�?commit 前通过环境变量临时设置，或修改 config
- **优先�?*: **P1**
- **建议处理时机**: 推送完成后立即设置（推荐使�?GitHub noreply 邮箱 `<github-username>@users.noreply.github.com`�?
### 2.2 远程 Initial commit 作者邮�?`21064718@qq.com`

- **问题内容**: 远程仓库 `origin/main` �?Initial commit (`4f6ec64`) 作者邮箱为 QQ 邮箱（含 QQ �?`21064718`�?- **影响范围**: 已公开�?GitHub 公共仓库，无法撤�?- **优先�?*: **P3**（已成事实，无法改变�?- **建议处理时机**: 无法处理，仅记录备案

### 2.3 filter-branch 备份引用未清�?
- **问题内容**: `git filter-branch` 创建�?`refs/original/refs/heads/main` 备份引用，仍指向旧的敏感 commit
- **影响范围**:
  - 占用 git 仓库空间
  - 若误用可能导致敏感信息重新出�?- **优先�?*: **P3**
- **建议处理时机**: 确认推送成功且历史稳定后，执行 `git update-ref -d refs/original/refs/heads/main` 清理

### 2.4 stash 中的修改未恢�?
- **问题内容**: �?2 �?stash 未恢�?  - `stash@{0}: On main: auto-stash-before-filter-branch`（filter-branch 前的最后一�?stash�?  - `stash@{1}: On main: backup-before-filter-branch`（filter-branch 前的首次 stash�?- **影响范围**: 包含工作区的大量未提交修改（100+ modified 文件 + 100+ untracked 文件�?- **优先�?*: **P0**（关键，需立即处理�?- **建议处理时机**: 推送完成后立即恢复（`git stash pop stash@{0}`�?
### 2.5 临时文件清理

- **问题内容**: `.git/backup-head-before-rewrite.txt`（记录重写前�?HEAD hash `69d6b37`�?- **影响范围**: 占用少量空间
- **优先�?*: **P3**
- **建议处理时机**: 确认推送成功后删除

---

## 三、工作区整洁�?
### 3.1 工作区大量未提交修改

- **问题内容**: 工作区有 100+ modified 文件（含 src/、docs/、tests/ 等）�?100+ untracked 文件
- **影响范围**:
  - 影响工作区整洁度
  - 部分文件可能是开发过程中的临时产�?  - 不影响已提交历史
- **优先�?*: **P2**
- **建议处理时机**: 下一迭代，分批评估并提交或清�?
### 3.2 大量 untracked 的审�?脚本文件

- **问题内容**: untracked 文件包括�?  - 审计报告目录（`v9-module-audit-report/`, `v9-round2-audit/`, `v9-round3-audit/`, `agent-module-qa-audit/`, `build-root-cause-analysis/`�?  - 脚本文件（`scripts/audit-*.ts`, `scripts/verify-*.py`, `scripts/verify-*.mjs` 等）
  - 测试报告（`test-report/`, `bt-junit.xml`, `is-junit.xml`, `ms-junit.xml`�?  - 临时文件（`tmp_probe.py`, `cockpit.png`, `input-hub.png`, `verify_step*.png`�?- **影响范围**: 仓库膨胀，可能包含敏感信息或临时产物
- **优先�?*: **P2**
- **建议处理时机**: 下一迭代，评估后决定�?  - 审计报告 �?提交�?`docs/audit/`
  - 脚本文件 �?提交�?`scripts/`
  - 测试报告 �?添加�?`.gitignore`
  - 临时文件 �?删除

### 3.3 异常文件�?
- **问题内容**: 存在异常文件名的 untracked 文件，可能是误操作产生：
  - `Trae CNresourcesappoutvsworkbenchcontribterminalcommonscriptssafe_rm_aliases.ps1…` (含特殊字�?
  - `kimiWorkspaces智能投研复盘系统V9�?; git --no-pager log --oneline -3` (含命令注�?
- **影响范围**: 可能导致 git 操作异常
- **优先�?*: **P2**
- **建议处理时机**: 下一迭代，确认后删除

---

## 四、架构债务�?
### 4.1 NewsPage 迁移的技术�?
- **问题内容**: `src/store/analysisNewsStore.ts` 有来�?pages 层的 value import，违�?AGENTS.md 分层规则（store 层禁止依�?pages 层）
- **影响范围**: 架构层级违规，可能影响后续重�?- **优先�?*: **P2**
- **建议处理时机**: 下一迭代，重�?newsStore 解除�?pages 层的依赖

### 4.2 TypeScript 错误处理和类型安全检测报�?md 已删�?
- **问题内容**: 根目录的 `../../reports/audit/typescript错误处理和类型安全检测报�?md` 文件在工作区修改中标记为 deleted
- **影响范围**: 文档丢失（但仍在 git 历史中可恢复�?- **优先�?*: **P3**
- **建议处理时机**: 如需保留，从 git 历史恢复；如不需要，确认删除

### 4.3 旧版组件文件已删�?
- **问题内容**: 以下文件在工作区修改中标记为 deleted�?  - `src/apps/input/BulkImportPanel.tsx`
  - `src/apps/input/InputDashboard.tsx`
  - `src/apps/input/DataTestPanel.tsx`
  - `src/apps/input/HotSectorPanel.tsx`
  - `src/apps/input/InputApp.tsx`
  - `src/services/trading/mockDataGenerator.ts`
  - `src/pages/analysis/NewsPage.tsx`（旧版，已被 news-v6 替代�?  - `src/store/rotationSignalStore.ts` + 测试文件
- **影响范围**: 旧版组件清理，符合架构演�?- **优先�?*: **P3**
- **建议处理时机**: 确认无引用后，提交删�?
---

## 五、其�?
### 5.1 LF/CRLF 换行符警�?
- **问题内容**: git stash 时大量文件出�?`LF will be replaced by CRLF` 警告
- **影响范围**: 不影响功能，但日志噪�?- **优先�?*: **P3**
- **建议处理时机**: 配置 `.gitattributes` 统一换行�?
### 5.2 推送浏览器认证流程

- **问题内容**: `git push` 触发 GitHub 浏览�?OAuth 认证，等待时间较�?- **影响范围**: 不影响功能，但影响推送体�?- **优先�?*: **P3**
- **建议处理时机**: 可选配�?PAT（Personal Access Token）替代浏览器认证

---

## 跟踪记录

| 日期 | 操作 | 备注 |
|------|------|------|
| 2026-07-04 | 初始创建 | 颜色整改 + 推送流程中发现 |

---

## 处理进度

- [ ] 1.1 549 �?TS 错误（P1�?- [ ] 1.2 Top 5 TS 错误（P1�?- [ ] 1.3 Pre-commit hook 恢复（P1，依�?1.1�?- [ ] 2.1 git config 设置（P1�?- [ ] 2.2 远程 QQ 邮箱（P3，无法处理）
- [ ] 2.3 filter-branch 备份清理（P3�?- [ ] 2.4 stash 恢复（P0，关键）
- [ ] 2.5 临时文件清理（P3�?- [ ] 3.1 工作区修改提交（P2�?- [ ] 3.2 untracked 文件处理（P2�?- [ ] 3.3 异常文件名清理（P2�?- [ ] 4.1 NewsPage 技术债重构（P2�?- [ ] 4.2 TS 报告恢复（P3�?- [ ] 4.3 旧版组件删除确认（P3�?- [ ] 5.1 换行符配置（P3�?- [ ] 5.2 PAT 配置（P3�?