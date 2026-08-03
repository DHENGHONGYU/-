# V9 GitHub 备份治理与上线前准备方案

> **版本**: v1.0 | **日期**: 2026-08-03 | **状态**: 待评审
>
> **目标**: 解决备份频率过高、分支策略混乱、安全暴露等问题，建立体系化备份与发布管理流程，为上线做准备。

---

## 一、当前问题诊断

### 1.1 问题总览

| 级别 | 问题 | 证据 | 影响 |
|------|------|------|------|
| P0 | Git remote URL 硬编码 GitHub PAT token | `git remote -v` 输出含 `ghp_***@github.com` | 任何能读取 `.git/config` 的人/程序可获取完整 token，仓库可被任意篡改 |
| P0 | git-auto-push.yml 每 5 分钟 cron 触发 | `schedule: cron: '*/5 * * * *'` | 每天最多 288 次触发，windows-latest runner 10 倍计费，快速消耗 CI 额度 |
| P1 | 分支策略混乱：5 个本地 + 3 个远程 feature 分支 | `backup/auto`, `fix/phase1-hemostasis`, `recover/keep-ea2734f3`, `feat/cross-index-20260719` 等 | 分支生命周期无管理，合并后未清理，增加维护成本 |
| P1 | Tag 管理不规范 | `v1.2.0`, `v2.1.0-prerelease`, `v2.6.0` 三个 tag，版本号跳跃大，无 GitHub Release 关联 | 无法追溯版本内容，回滚困难 |
| P1 | backup/auto 分支污染提交历史 | `backup: auto-snapshot 2026-08-02T15-56-04-856Z` | 自动快照提交混入 git log，降低可读性 |
| P2 | 单 remote 无异地备份 | 仅 `origin` 指向 GitHub | GitHub 平台级故障时无恢复途径 |
| P2 | 缺少上线前检查清单 | 无 release process 文档 | 上线时遗漏关键检查项的风险高 |

### 1.2 当前备份机制分析

**backup-branch.ts**（已随 v9-devops-automation 技能一同删除，自动备份功能已下线）：
- ~~使用 git plumbing（write-tree → commit-tree → branch -f）创建快照~~
- 不污染当前分支，排除敏感文件（17 种模式）
- 支持 `--no-push` 纯本地模式
- **设计评价**: 脚本本身设计合理（零破坏 + 防泄露），问题在于触发频率和分支管理策略

**git-auto-push.yml**（`.github/workflows/git-auto-push.yml`）：
- 每 5 分钟 cron + push 触发
- 使用 windows-latest runner（10 倍计费）
- 默认分支硬编码为 `feat/cross-index-20260719`
- 默认 tag 硬编码为 `v2.6.0`
- **设计评价**: 网络恢复自动推送的初衷合理，但 5 分钟 cron 频率过高，windows runner 成本过大

---

## 二、分支策略重新设计

### 2.1 策略选型：简化 GitHub Flow + Release Branch

基于项目当前阶段（单人开发 + AI 辅助，准备上线），采用**简化 GitHub Flow + Release Branch** 混合策略：

```
main (受保护，稳定可发布)
 ├── feat/* (短期功能分支，≤3 天合并)
 ├── fix/* (短期修复分支，≤1 天合并)
 └── release/x.y.z (发布准备分支，上线前创建)
```

**放弃的分支**：
- `backup/auto` — 改用 tag + git bundle 替代（见 §三）
- `develop` — 单人项目不需要长期 develop 分支
- `recover/*` — 一次性恢复分支，用完即删

### 2.2 分支生命周期规则

| 分支类型 | 命名规范 | 最长存活 | 创建时机 | 合并方式 | 合并后处理 |
|----------|----------|----------|----------|----------|------------|
| `main` | 固定 | 永久 | 项目初始化 | — | — |
| `feat/*` | `feat/<功能名>` | 3 天 | 开发新功能 | squash merge | 删除分支 |
| `fix/*` | `fix/<问题名>` | 1 天 | 修复 bug | squash merge | 删除分支 |
| `release/*` | `release/v<版本号>` | 2 周 | 上线前创建 | merge commit | 保留为历史标记，打 tag 后可删 |

### 2.3 分支清理计划

| 分支 | 操作 | 理由 |
|------|------|------|
| `backup/auto` | 删除（本地+远程） | 改用 tag + bundle 体系替代 |
| `fix/phase1-hemostasis` | 合并后删除 | 止血修复已完成 |
| `recover/keep-ea2734f3` | 删除 | 一次性恢复分支，已完成使命 |
| `feat/cross-index-20260719` | 合并后删除 | 远程过期 feature 分支 |
| `feat/console-filter` | 合并后删除 | 远程过期 feature 分支 |
| `refactor/pr-6-module-split` | 合并后删除 | 远程过期 feature 分支 |
| `release/v2.1.0-prerelease` | 打 tag 后保留或删除 | 当前工作分支，上线后处理 |

### 2.4 main 分支保护规则（GitHub Settings 配置）

```
[x] Require pull request reviews before merging (至少 1 人审批)
[x] Require status checks to pass before merging
    [x] CI (dev branches) — smoke
    [x] CI (dev branches) — test
    [x] CI (dev branches) — layers
[x] Require conversation resolution before merging
[x] Require linear history (优先 rebase merge)
[x] Dismiss stale pull request approvals when new commits are pushed
[ ] Do not allow force pushes
[ ] Do not allow deletions
```

---

## 三、备份节奏体系（人工触发 + 提醒机制）

> **核心原则：所有备份操作由开发者手动执行，系统仅提供定时提醒和操作引导，绝不自动执行任何备份/推送动作。**

### 3.1 备份提醒机制（提醒而非执行）

使用 GitHub Actions 的 `schedule` 仅发送提醒通知，不执行任何 git 操作：

```yaml
# .github/workflows/backup-reminder.yml
name: Backup Reminder
on:
  schedule:
    - cron: '0 10 * * 1,4'  # 每周一、四 10:00 UTC（北京时间 18:00）

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Check last push time
        run: |
          echo "## 备份提醒" >> $GITHUB_STEP_SUMMARY
          echo "距上次推送已超过推荐间隔，建议执行备份操作：" >> $GITHUB_STEP_SUMMARY
          echo "- L1 热备: git push origin main" >> $GITHUB_STEP_SUMMARY
          echo "- L3 冷备: npm run backup:bundle" >> $GITHUB_STEP_SUMMARY
```

**提醒频率**：每周 2 次（周一、周四），仅通知，不执行。

### 3.2 L1 在线热备（GitHub 原生 — 人工推送）

| 项目 | 方案 |
|------|------|
| 机制 | 开发者手动执行 `git push` 到 GitHub origin |
| 频率 | 每完成一个完整逻辑单元即推送（建议每日 1-3 次） |
| RPO | ≤1 工作日 |
| 触发 | **仅手动** `git push`，pre-push 门禁通过后推送 |
| 自动化 | **无** — 禁止任何自动推送机制 |

**关闭项**：
- 完全移除 `git-auto-push.yml` 的 `schedule: cron` 和 `push` 触发器
- 仅保留 `workflow_dispatch`（手动触发）用于网络恢复场景
- 将 runner 从 `windows-latest` 改为 `ubuntu-latest`（降 10 倍成本）

### 3.3 L2 异地温备（多 remote 镜像 — 人工触发）

| 项目 | 方案 |
|------|------|
| 机制 | 手动执行镜像推送至 Gitee/GitLab |
| 频率 | 每周 1 次（备份提醒日执行） + 每个 release tag 时 |
| RPO | ≤7 天 |
| 触发 | **仅手动** `git push --mirror <gitee-url>`（注：`npm run backup:mirror` 已于 2026-08-03 移除，mirror.sh 未实现） |

**配置步骤**：
1. 在 Gitee 创建镜像仓库（私有）
2. 在 GitHub Secrets 添加 `GITEE_TOKEN`
3. 创建 `.github/workflows/mirror-backup.yml`（仅 `workflow_dispatch`，无 cron）
4. 需要镜像时手动触发或本地执行

**本地镜像脚本**（`scripts/backup/mirror.sh`）：
```bash
#!/bin/bash
# 手动执行异地镜像备份
set -e
echo "🔄 开始镜像备份到 Gitee..."
git push --mirror git@gitee.com:DHENGHONGYU/finsight-v9.git
echo "✅ 镜像备份完成"
git fsck --full  # 完整性校验
```

### 3.4 L3 离线冷备（git bundle 归档 — 人工执行）

| 项目 | 方案 |
|------|------|
| 机制 | 手动执行 `git bundle --all` 生成全量归档 |
| 频率 | 每周 1 次 + 每个 release tag 时 |
| RPO | ≤7 天 |
| 触发 | **仅手动** `npm run backup:bundle` |
| 存储 | 本地磁盘 `backups/` + 云存储（可选） |

**冷备脚本**（添加到 package.json `scripts`）：
```bash
# 手动执行冷备
npm run backup:bundle

# 实际执行：
DATE=$(date +%Y%m%d)
git bundle create "backups/v9-full-${DATE}.bundle" --all
git bundle verify "backups/v9-full-${DATE}.bundle"
echo "✅ 冷备完成: backups/v9-full-${DATE}.bundle"
```

### 3.5 backup-branch.ts 已废止（2026-08-03 上线前最小口径清理）

**已删除**：backup-branch.ts 脚本、v9-devops-automation SKILL、每日备份 automation 任务、PowerShell 自动推送脚本（GitAutoPush.psm1 / auto-push-on-network.ps1 / schedule-auto-push.ps1）、test-backup-branch.cjs 测试、package.json 的 `backup:snapshot` 与 `backup:mirror` 命令。

**保留**：`backup:bundle`（git-bundle.cjs 离线冷备，人工触发）。

**理由**：取消一切自动 git 备案机制（含定时快照、自动推送、auto-PR），上线前仅保留人工备份体系。详见 §三 备份节奏体系。

### 3.6 备份操作指引（快速参考）

| 场景 | 命令 | 频率 |
|------|------|------|
| 日常推送 | `git push origin <branch>` | 每日 1-3 次 |
| 离线冷备 | `npm run backup:bundle` | 每周 1 次 + release 时 |
| 网络恢复推送 | GitHub Actions → workflow_dispatch | 网络恢复后手动触发 |

---

## 四、CI/CD 优化方案

### 4.1 git-auto-push.yml 改造

```yaml
# 改造前：每 5 分钟 cron + push 触发 + windows-latest
# 改造后：仅 workflow_dispatch 手动触发 + ubuntu-latest
on:
  workflow_dispatch:    # 仅手动触发（网络恢复场景）
    inputs:
      branch:
        description: 'Target branch'
        required: true
        default: 'main'

jobs:
  auto-push:
    runs-on: ubuntu-latest    # 从 windows-latest 改为 ubuntu-latest（降 10 倍成本）
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      - name: Push pending commits
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git push origin ${{ github.event.inputs.branch }}
```

**移除项**：
- `schedule: cron: '*/5 * * * *'` — 过于频繁
- `push: branches: ['feat/**']` — 与 ci.yml 重复触发
- Pester 测试 job — 在自动推送工作流中测试 PowerShell 模块不合理
- `windows-latest` runner — 10 倍计费

### 4.2 CI 并发控制

在所有 workflows 中添加并发控制，避免重复构建：

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4.3 Workflow 审计

| Workflow | 触发方式 | 建议 |
|----------|----------|------|
| `ci.yml` | push to feat/** | 保留，添加 concurrency |
| `quality-check.yml` | 需检查 | 确认触发条件，避免与 ci.yml 重叠 |
| `git-auto-push.yml` | cron + push | **改造**：仅 workflow_dispatch + ubuntu-latest |
| `doc-freshness.yml` | 需检查 | 确认是否需要定时触发 |
| `doc-automation.yml` | 需检查 | 确认是否需要定时触发 |
| `cross-index-validation.yml` | 需检查 | 确认触发条件 |
| `changelog-automation.yml` | 需检查 | 确认是否与 release 流程整合 |
| `skill-integrity-monitor.yml` | 需检查 | 确认是否需要定时触发 |
| `system-check-loop.yml` | 需检查 | 确认是否需要定时触发 |
| `visual-baseline-update.yml` | 需检查 | 确认触发条件 |

---

## 五、Tag / Release 管理（SemVer 2.0）

### 5.1 版本号规则

```
Major.Minor.Patch[-prerelease][+build]
```

| 版本变更 | 何时使用 | 示例 |
|----------|----------|------|
| Major (X.0.0) | 不兼容 API 变更、架构重构 | 1.x.x → 2.0.0 |
| Minor (x.Y.0) | 向后兼容的新功能 | 1.5.x → 1.6.0 |
| Patch (x.y.Z) | 向后兼容的 bug 修复 | 1.5.3 → 1.5.4 |
| prerelease | alpha < beta < rc < 正式版 | `2.0.0-rc.1` |

### 5.2 当前 Tag 治理

| Tag | 操作 | 理由 |
|-----|------|------|
| `v1.2.0` | 保留 | 历史版本标记 |
| `v2.1.0-prerelease` | 保留，上线时改为 `v2.1.0` | 当前预发布版本 |
| `v2.6.0` | 删除或重命名为 `v2.1.0-rc.1` | 版本号跳跃过大，与实际版本不一致 |

### 5.3 Release 流程

```
1. 从 main 创建 release/v2.1.0 分支
2. 在 release 分支上仅做 bug fix
3. 代码冻结（T-3 天）：仅允许 Critical 级 bug fix
4. 完整回归测试通过
5. 合并到 main，打 tag v2.1.0
6. 创建 GitHub Release（关联 CHANGELOG）
7. 删除 release 分支（保留 tag）
8. 冷备：git bundle create backups/v9-v2.1.0.bundle --all
```

---

## 六、安全加固

### 6.1 P0 紧急：PAT Token 轮换

**当前问题**：`git remote -v` 输出含 `[REDACTED_PAT]@github.com`

**修复步骤**：
1. 登录 GitHub → Settings → Developer settings → Personal access tokens
2. 撤销当前暴露的 token
3. 创建新 token（最小权限：仅 `repo` 读写）
4. 配置 Git credential helper（不写入 URL）：
   ```bash
   # 方案 A：使用 Git Credential Manager（推荐）
   git config --global credential.helper manager

   # 方案 B：使用环境变量
   # 在 ~/.bashrc 或 PowerShell profile 中设置
   export GH_TOKEN="<新token>"
   git config --global credential.helper '!gh auth git-credential'

   # 方案 C：使用 SSH（最安全）
   git remote set-url origin git@github.com:DHENGHONGYU/-.git
   ```
5. 更新 remote URL 移除 token：
   ```bash
   git remote set-url origin https://github.com/DHENGHONGYU/-.git
   ```

### 6.2 敏感文件防护

当前 `.gitignore` 已覆盖 `.env`, `.env.local`, `.env.*.local`，backup-branch.ts 已排除 17 种敏感文件模式。**保持现状即可**。

### 6.3 CI Secrets 管理

- 所有 token/密钥存放在 GitHub Secrets（Settings → Secrets and variables → Actions）
- 禁止在 workflow 文件中硬编码任何凭证
- 定期轮换（每 90 天）

---

## 七、上线前准备清单

### 7.1 Go/No-Go Gate（发布评审清单）

```
□ 1. 版本基线
     □ 需求清单已基线化（功能范围锁定）
     □ Bug 修复清单已基线化
     □ 版本号已确定（SemVer 规范）
     □ CHANGELOG.md 已更新

□ 2. 代码质量
     □ pre-commit 门禁全绿（17 步 P0 门禁）
     □ pre-push 门禁全绿（5 步 + 测试 + 构建）
     □ tsc:prod 类型检查 0 错误
     □ ESLint 0 error（warning ≤ 2000 阈值）
     □ 生产构建成功（npm run build）

□ 3. 测试覆盖
     □ 单元测试通过率 100%（npm run test:stable）
     □ 核心模块覆盖率 ≥ 70%
     □ 关键路径覆盖率 ≥ 95%
     □ E2E 冒烟测试通过（npm run test:e2e:smoke）
     □ 无 P0 级隔离测试项（tests/quarantine.list）

□ 4. 安全审计
     □ audit:secrets 密钥扫描通过
     □ Git remote URL 无暴露的 PAT token
     □ .env / 密钥文件不在版本控制中
     □ 依赖漏洞扫描通过（npm audit）

□ 5. 文档齐备
     □ API 文档已更新
     □ Release Notes 已编写
     □ 升级指南已编写（如有破坏性变更）
     □ 已知问题清单已更新

□ 6. 分支与 Tag
     □ release 分支已创建
     □ 代码冻结已执行（T-3 天）
     □ Tag 已打好（vX.Y.Z 格式）
     □ GitHub Release 已创建

□ 7. 备份验证
     □ L1 热备：GitHub origin 已同步
     □ L2 温备：镜像仓库已同步（如配置）
     □ L3 冷备：git bundle 已生成并验证
     □ 恢复演练：从 bundle 恢复成功（git clone bundle → 验证完整性）

□ 8. 回滚预案
     □ 回滚判定条件已明确
     □ 回滚操作步骤已文档化
     □ 回滚负责人已指定
     □ 预计回滚耗时已评估

□ 9. 监控告警
     □ 错误率告警已配置
     □ 性能基线已建立（与上一版本对比）
     □ 日志收集已确认
```

### 7.2 代码冻结策略

| 阶段 | 时间 | 规则 |
|------|------|------|
| 软冻结 | T-7 天 | 仅允许 Major 级以下 bug fix |
| 硬冻结 | T-3 天 | 仅允许 Critical 级 bug fix |
| 发布日 | T-0 | 合并到 main，打 tag，创建 Release |
| 发布后 | T+1 | 删除 release 分支，开启下一版本周期 |

### 7.3 回滚流程

```bash
# 1. 确认回滚目标版本
git tag -l "v*"

# 2. 从 tag 创建回滚分支
git checkout -b hotfix/rollback v2.0.0

# 3. 或直接 revert 问题提交
git revert <problem-commit-sha>

# 4. 推送回滚
git push origin main

# 5. 打新版本 tag
git tag v2.0.1
git push origin v2.0.1
```

---

## 八、执行计划

### Phase 1：紧急安全修复（立即执行）

| 序号 | 任务 | 优先级 | 预计耗时 |
|------|------|--------|----------|
| 1.1 | 撤销暴露的 GitHub PAT token，创建新 token | P0 | 即时 |
| 1.2 | 更新 git remote URL 移除 token | P0 | 即时 |
| 1.3 | 配置 credential helper 或 SSH | P0 | 即时 |

### Phase 2：备份频率治理（1 天内）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 2.1 | 改造 git-auto-push.yml：移除 cron 和 push 触发，改 ubuntu-latest，仅保留 workflow_dispatch | P0 |
| 2.2 | 在所有 workflows 添加 concurrency 控制 | P1 |
| 2.3 | 审计 10 个 workflows 的触发条件，关闭不必要的定时任务 | P1 |
| 2.4 | 创建 backup-reminder.yml：仅提醒不执行 | P2 |

### Phase 3：分支清理（1 天内）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 3.1 | 合并或删除过期 feature 分支 | P1 |
| 3.2 | 删除 backup/auto 分支 | P1 |
| 3.3 | 删除一次性恢复分支（recover/keep-*） | P1 |
| 3.4 | 配置 main 分支保护规则 | P1 |

### Phase 4：人工备份体系建立（1 周内）

> **⚠️ 已废止（2026-08-03 上线前最小口径清理）**：本 Phase 4 中 4.1（backup:snapshot/backup:mirror）、4.4（改造 backup-branch.ts）已随自动备案功能取消而废止。仅保留 4.2（Gitee 镜像）、4.3（mirror-backup.yml）、4.5（提醒）作为可选人工备份参考。当前人工备份仅保留 `npm run backup:bundle`（git-bundle.cjs），见 §3.5。

| 序号 | 任务 | 优先级 | 状态 |
|------|------|--------|------|
| 4.1 | ~~在 package.json 添加 backup:snapshot / backup:bundle / backup:mirror 脚本~~ | P2 | 废止（仅保留 backup:bundle） |
| 4.2 | 创建 Gitee 镜像仓库（手动镜像目标） | P2 | 可选 |
| 4.3 | 创建 mirror-backup.yml（仅 workflow_dispatch，无 cron） | P2 | 可选 |
| 4.4 | ~~改造 backup-branch.ts 默认 --no-push，完全脱离 CI 自动化~~ | P2 | 废止（脚本已删除） |
| 4.5 | 创建 backup-reminder.yml 定时提醒（每周 2 次，仅通知不执行） | P2 | 可选 |

### Phase 5：上线前准备（上线前 2 周）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 5.1 | 完成 §七 上线前检查清单全部项 | P1 |
| 5.2 | 治理 Tag（删除/重命名不规范 tag） | P2 |
| 5.3 | 从 bundle 恢复演练 | P2 |
| 5.4 | 编写回滚预案文档 | P2 |

---

## 九、提交规范强化

### 9.1 Conventional Commits 格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**type**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` | `chore` | `revert`

### 9.2 提交粒度规则

1. **原子提交**：一个 commit 只做一件事
2. **善用 amend**：发现错误立即 `git commit --amend`，不新建 `fix typo` commit
3. **禁止自动快照提交**：`backup: auto-snapshot` 类提交不进入 main 分支
4. **pre-commit 门禁**：所有正式提交必须通过 17 步门禁

### 9.3 推送频率

- 每完成一个完整逻辑单元即推送（每日 1-3 次）
- 禁止 AI 工具自动推送（仅开发者手动 `git push`）
- pre-push 门禁通过后才允许推送

---

## 十、关联文档

- [deployment.md](./deployment.md) — 部署流程
- [runbook.md](./runbook.md) — 运维手册
- [../../AGENTS.md](../../AGENTS.md) — AI 协作规范
- [../reference/CODE-REVIEW.md](../reference/CODE-REVIEW.md) — 代码审查规范
- [../../CHANGELOG.md](../../CHANGELOG.md) — 变更日志
