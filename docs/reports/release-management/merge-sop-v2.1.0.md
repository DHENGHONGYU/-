---
title: 合并操作 SOP — Bootstrap P0 Gate 生效版
type: sop
domain: release-management
phase: effective
status: active
maintainer: V9 DevOps + Release Mgmt
summary: 代码合并到 main/dev 的标准操作流程（SOP），覆盖 pre-merge 检查项、门禁规则应用场景、合并步骤、常见问题处理与审批流。
tags: [sop, merge, branch-protection, bootstrap-p0-gate, ci-gate, approval]
version: v1.0.0
last_updated: 2026-07-30
doc_id: V9-DOC-SOP-MERGE-v2.1.0
tier: T1
related_docs:
  - V9-DOC-RELEASE-v2.1.0 (Release Notes)
  - V9-DOC-FIX-P0-001-ACCEPT (P0 验收报告)
  - V9-DOC-TRIAGE-TSC-v2.1.0-prerelease (tsc 27 项分类)
---

# 合并操作 SOP — v2.1.0 (Bootstrap P0 Gate 生效版)

> **文档版本**: v1.0.0
> **生效日期**: 2026-07-30
> **适用分支**: `main`（生产） / `dev`（集成分支）
> **适用 PR 源分支: `feat/**` / `fix/**` / `release/**`
> **关联 Branch Protection: `bootstrap-p0-gate` + `quality-gate-summary`（必需）

---

## 0. 文档目的

统一团队合并操作规范，确保：

1. **P0 高风险分支（种子数据降级/编排器启动降级/dataBridge.init 失败阻断）不会被回归
2. **只有通过 `bootstrap-p0-gate` 门禁的代码才能合并到 main
3. PR 审查、批准流程可追溯
4. 遇到失败时有统一的排查路径和负责人

---

## 1. 角色与审批流程

### 1.1 角色矩阵

| 角色 | 职责 | 可执行动作 |
|------|------|----------|
| 作者 (Author) | 开发人员 | 开分支 → 提交 PR、回复评论、re-run CI、解决冲突、解释代码 |
| 审查人 (Reviewer) | 同组 Senior 以上 | Approve / Request Changes / Comment；Code Review Checklist（见 §6） |
| 合并人 (Merger) | Tech Lead 或 Release Manager | 只有 **Merger** 可点 GitHub UI「Merge」按钮 |
| DevOps / Maintainer | 配置 Branch Protection；修复 CI 故障；SOP 更新 | 配置保护/禁用门禁审批；门禁失败 escalate |

### 1.2 审批流程

```
 [Author] 创建 PR
      │
      ▼
 ┌───────────────────────────────────────────┐
 │  自动触发: lint/typecheck/            │
 │  bootstrap-p0-gate                      │
 │  quality-gate-summary (needs all)         │
 └───────────────────────────────────────────┘
      │ 全部通过 + 0 个失败
      ▼
 [Author] @reviewer 请求审查（必须至少 1 人批准
      │
      ▼
 [Reviewer] 点击 Approve （新推到代码 自动 Dismiss 旧批准
      │  (dismiss_stale_review_approvals=true)
      ▼
 [Merger] 检查 合并按钮（Squash and Merge （默认，保留 线性历史
      │ （禁止直接 push 到 main）
      ▼
  post-merge CI (quality-check 再跑一遍
```

### 1.3 审批人数要求

| 目标分支 | 必需批准数 | 必须批准的角色 | 管理员可豁免 |
|---------|---------|-------------|-----------|
| main | **至少 1 人 (required_approving_review_count=1) | Senior/Lead | ❌ enforce_admins=true → 管理员也要遵守 |
| dev | 0（可在 CODEOWNERS 中配置 1 人 | 可选 | 同上，具体以 Branch Protection 配置 |

---

## 2. 代码合并前的必要检查项（作者自检清单）

> **作者在创建 PR 前，必须在本地跑完以下项目检查清单。** ✅ 每项均通过后点 **Create PR**。

### 2.1 本地自检 ✔️

- [ ] **✅ `npm run lint` — ESLint max-warnings 2000 以内（项目历史阈值）
- [ ] **✅ `npm run tsc:prod`** — 如报出属于 27 项历史遗留 tsc 错误可接受；新增的 tsc 错误 **必须修复**（见 V9-DOC-TRIAGE-TSC）
- [ ] **✅ `npm run test:databridge:gate`** — 核心门禁，**52/52 tests** (必须 0 failed, 0 skipped
- [ ] **✅ `npm run test:known`** — 如果改动了 LLM / Fetcher / Agent 模块，则加跑这组
- [ ] **✅ `npm run build`** — Vite 构建通过（若改动 UI / src/components / vite.config）
- [ ] **✅ 分支命名合规**：`feat/JIRA-ID-short-desc` / `fix/JIRA-ID-p0-seed-retry` / `release/v2.1.0rc1`
- [ ] **✅ commit message 合规**：Conventional Commits（feat/fix/chore/docs/test/ci/refactor/perf/style）
- [ ] **✅ 无残留敏感信息**：没硬编码 AK/SK / Token / 邮箱 / 个人路径
- [ ] **✅ changelog 已更新**：`CHANGELOG.md` §Unreleased Added/Changed/Fixed 对应章节
- [ ] **✅ 文档同步**：若新增/接口变更 对应 docs/ 下文档已更新 (V9 docs-as-mirror 原则）
- [ ] **✅ 无 TODO/FIXME/XXX 标记**：遗留技术债创建了追踪 Issue 链接

### 2.2 PR 描述必填模板

提交 PR 时必须填写以下区块：

```md
## 变更概述
- 背景: （关联 Issue 号：#1234

## 改动类型
- [ ] feat 新功能
- [x] fix Bug 修复 (P0/P1/P2)
- [ ] refactor 重构
- [ ] chore 工具/配置变更
- [ ] docs 文档更新

## 自检清单（作者）
- [x] npm run test:databridge:gate → 52/52
- [x] tsc:prod 0 新增错误
- [x] lint 无新增 warn
- [x] 单元测试覆盖新增/改动路径

## 测试证据
```粘贴本地测试输出或截图链接

## 风险与回滚
- 风险：低/中/高
- 回滚：git revert <commit-hash>
```

---

## 3. 门禁规则（bootstrap-p0-gate）具体应用场景与要求

### 3.1 门禁做什么？

```yaml
bootstrap-p0-gate (GitHub 状态检查名，必填）
├── tsc:prod                    # 生产类型检查（历史 27 项遗留可接受，新增 0）
└── test:databridge:gate (52 tests，严格 0 failed)
    ├── executionPlanService.dataflow  (34 tests)  — 数据流转/状态机/闭环
    ├── bootstrapService.test.ts     (13 tests)  — P0-1/2/3 三分支修复
    └── dbConfig.test.ts       (5 tests)  — ACL 矩阵契约
```

**硬阻断条件 (任一条不满足则合并按钮禁用):

| # | 条件 | 动作 |
|---|------|------|
| 1 | `bootstrap-p0-gate` job outcome≠success | ❌ 禁用 Merge |
| 2 | `quality-gate-summary` outcome≠success | ❌ 禁用 Merge |
| 3 | 批准数 <1 | ❌ 禁用 Merge |
| 4 | PR 存在 unresolved 评论会话 | ❌ 禁用 Merge |
| 5 | 落后 base branch N 合并前必须 Rebase / Merge 同步 (strict=true，必须最新）| ❌ 禁用 Merge |

### 3.2 何时触发门禁？

| 触发事件 | 是否运行门禁 |
|---------|---------|
| PR: `opened synchronize reopened ready_for_review** | ✅ 必跑 |
| PR 作者 push 新 commit 到 PR 的源分支 | ✅ 必跑（自动 rerun 并 Dismiss 旧批准 |
| 手动 `workflow_dispatch` 手动 | ✅ 可选 可通过 Actions 页面 |
| Draft PR → 转为 Ready 时 | ✅ 必跑 |

### 3.3 失败 什么情况下 允许豁免？

| # | 场景 | 是否允许豁免 | 审批 |
|---|------|-------------|-----|
| 1 | 纯文档 / markdown yml 配置变更，src** 不改 .github  不触发 | ❌ 不允许（CI 仍会允许，除非 `.github` 必须全流程 | DevOps 审批 |
| 2 | 紧急 Hotfix 线上事故 (P0 Incident) | ✅ 允许 2 人 + Release Manager 书面审批；事后补测试；补 PR 24h 内补全） | Release Manager + Tech Lead 双批准；记录审计）
| 3 | tsc:prod 27 项历史遗留错误阻塞合并？ | 已接受；但新增 tsc 错误禁止豁免 | 不允许豁免 ）

---

## 4. 合并操作步骤流程

### 4.1 标准合并步骤（作者 → 审查人 → 合并人 3 角色）

#### Step 1 — 创建分支并开发

```bash
# 从 main 最新拉取最新
git checkout main
git pull --ff-only origin main

# 创建新分支
git checkout -b feat/xxx-123-p0-seed-retry-memory-fallback
```

#### Step 2 — 本地自检 §2.1 全项全部跑并 commit

```bash
npm run tsc:prod
npm run test:databridge:gate        # ← 关键 52 条；必须 52/52
git add ...
git commit -m "fix(p0): 种子数据重试耗尽内存 fallback"
```

#### Step 3 — 推送并创建 PR

```bash
git push --no-verify origin feat/xxx-123-p0-seed-retry-memory-fallback
# 然后用 gh CLI 或浏览器 Create PR，base:main, compare: feat/xxx
# 选 Squash 选项（作者在 PR 模板
```

#### Step 4 — 等 CI 通过

```
等待:   ✅ lint
✅ typecheck
✅ bootstrap-p0-gate (这个是本章的
✅  ... 其他 job
✅ quality-gate-summary  状态检查显示  全通过
```

#### Step 5 — 作者 @审查人审查

- Reviewer 检查 §6 审查清单全部打勾
- 点击 Approve → 通知合并人；不通过则 Request Changes → 作者修复 → 重新 Step 2 → Step 4 重跑 CI（新 → Dismiss

#### Step 6 — 合并人执行合并（**禁止命令行直接推送到 main）

GitHub UI 操作：
- Merge method: **Squash and merge**（默认 1 PR → 1 commit，线性历史干净）
- 若确需保留 commits，选 Create a merge commit — 须 Release Manager 批准
- **Delete branch 勾上 → 删除源分支（禁止保留僵尸 feature 分支）
- 点「Confirm squash and merge」

#### Step 7 — 合并后验证

```bash
git checkout main
git pull --ff-only
npm run test:databridge:gate     # 本地再验一次 52 tests
```

### 4.2 PR 冲突解决流程

**冲突出现时操作：

```bash
# 在你的分支
git fetch origin main
git rebase origin main          # 推荐 rebase 到最新 main（线性历史
# 解决冲突
git add <files>
git rebase --continue
git push --force-with-lease origin <your-branch>   # 必须 --force-with-lease，禁止 --force
```

冲突文件 >10 个或涉及 Store / ACL 等核心：建议通知 Reviewer 提前一起 review 解决 通知。

---

## 5. 常见问题与处理方案

| 5.1 bootstrap-p0-gate 失败排查路径

| 现象 | 可能根因 | 排查动作 | 责任人 |
|------|---------|---------|--------|
| tsc:prod 失败，报大量新引入 tsc 错误 | 作者本次改动引入了类型错误 | 对比错误定位改动文件 → 修复本地重跑 `npm run tsc:prod | Author |
| tsc:prod 仅显示那原本历史 27 项（A~G 分类，判定错误无新增 → 继续，可合并 | 属于历史遗留，triage 报告已隔离 | Author 报告确认无新增即可 | Author / Reviewer |
| test:databridge:gate 有 1 tests failed | 回归 | 1. 本地 `npm run test:databridge:gate —no-coverage 重跑；2. 读日志；3. 定位是否为 P0-1/2/3 三分支 | Author + Reviewer |
| test:databridge:gate 全部 timeout >10min canceled | ubuntu-latest infra | 手动 re-run；多次失败，通知 DevOps escalate | DevOps on-call |
| PR 显示 “必须先更新分支 （落后 main）| strict=true，要求最新 | 本地 §4.2 git rebase origin main 解决 | Author |
| 审查人批准后又推新 commit 后批准消失 | dismiss_stale_review_approvals=true 自动 Dismiss 旧批准；通知 Reviewer 重新审查 Author | Reviewer 再次 approve | 正常机制；无需处理 按流程重审 |
| 会话未解决 按钮禁用 | required_conversation_resolution=true | 每条评论 Resolve 掉；或讨论结束。— Reviewer 确认 → resolve → 重新合并。| Author / Reviewer |
| Merge 按钮灰掉 但所有 check 全过但无法合并 | 未达批准数 | 找一个 Senior+ Approve；再按 再点 Merge | Merger |
| Allow deletions=false 但想删除分支 | 分支保护设置了删除？删除仅删除 PR 源分支 可；UI 上删除是允许（Branch Protection 仅阻止 main 自身被删 | Author / Merger |
| 紧急 P0 incident 想跳过门禁走热修复 | 见 §3.3；hotfix 流程 | 2 位审批（Lead + RM 双批 → DevOps 临时关保护 2 分钟完成 → 立即回开保护 → 24h 补 PR → 补全测试 补上  | DevOps + RM |
| Job 报 Node 20 找不到 / npm ci 404 | CI runner 网络问题；重试 npm ERR | 2 次重试 → DevOps 检查 runner 缓存 / VPN 状态 | DevOps |

### 5.2  escalation 路径

```
Level 1: 作者 → 查看 CI 日志 → 本地复现 → google → 修复
Level 2: Reviewer 确认  → 排查失败无 →   escalate 到 DevOps on-call
Level 3: DevOps → Maintainer（长时间失败 DevOps 建 Incident Issue
```

---

## 6. Code Review 检查清单（审查人必填

- [ ] 改动与 PR 标题 / 描述相符，不夹带无关变更
- [ ] 是否引入新的 tsc 错误（与 §27 项分类对比，无新增）
- [ ] **核心路径（bootstrapService / seedService / ACL / DataBridge）改动，是否有测试用例覆盖到了新增路径
- [ ] 没有硬编码密钥 / 个人路径 C:/Users/<user>/ （V9 Windows 路径用环境变量 $USERPROFILE 替换）
- [ ] 日志符合规范（logger.info/warn/error 等级合理，无裸 console.log）
- [ ] 边界条件 / 异常处理路径有写（try/catch，空值，Array越界，NaN 兜底等
- [ ] test:databridge:gate 本地跑通，或至少 PR 的 CI 门禁通了
- [ ] docs/ 文档同步更新 （新增 feature 文档同步)
- [ ] CHANGELOG §Unreleased 条目 Added/Changed/Fixed 对应已填
- [ ] SQL/DB schema 迁移（若涉及
- [ ] 性能 / 并发 / 内存 泄漏风险

---

## 7. 相关责任人 & 审批

| 事项 | 主责角色 | 备份 | Escalation |
|------|---------|-----|------------|
| 创建 PR / 本地自检 | 作者 | — | — |
| Code Review + 批准至少 1 人 | Senior / Tech Lead | 组内互换 | Tech Lead |
| 最终合并 | Tech Lead 或 Release Manager | Deputy RM | Release Manager 审批权 |
| Branch Protection 配置 / CI 变更 | DevOps | Maintainer | CTO Office |
| 紧急 hotfix 豁免审批 | Release Manager + **两人双批 | — | 重大事故全员通知 全员邮件留档
| 文档更新 (SOP 变更) | DevOps | Tech Writer | Architecture Team |

---

## 8. 审计记录保留

- 所有合并操作自动审计追踪保存在：
- GitHub Audit Log (组织级）
- PR Review 评论 + Actions Run logs保留 90 天
- 本 SOP 变更记录 git history
- outputs/ 下 tsc 分类报告 / 验收报告

保留 ≥ 180 天

---

*— 本文档为团队强规；v2.1.0-prerelease tag 起执行，v2.2.0 再评审后替换版本号
