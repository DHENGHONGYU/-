---
skill_id: V9-SKILL-DEVOPS
name: devops-automation
description: 项目级运维自动化技能（FinSightV9）。当用户要求「定时备份」「自动提交」「Git 快照备份」「批量部署」「定时构建部署」「注册定时任务」「部署到静态托管」「周期性自动化」时使用；也适用于为该项目配置每日/每周周期性任务，或排查备份与部署失败。
agent_created: true
tags:
  - automation
  - backup
  - deploy
  - devops
  - schedule
  - project:finsightv9
triggers:
  keywords: [定时备份, 自动提交, Git 快照, 批量部署, 定时构建部署, 注册定时任务, 部署到静态托管, 周期性任务, 自动化 Skill, 备份失败, 部署失败]
  files:
    - ".workbuddy/skills/devops-automation/scripts/**"
    - "scripts/monitor/system-check-loop.ts"
    - "scripts/build/deploy-rectification-toolkit.ts"
  events: [schedule-register, backup-failure, deploy-failure]
gates:
  - 脚本零破坏性检查（无 reset --hard / rm -rf / 不切换主分支）
  - 敏感文件排除校验（.env / 密钥 / token 模式）
mandatory: false
covers_docs: [V9-DOC-PROJ-232, V9-DOC-PROJ-218, docs/archive/reference-historical/automation-test-plan.md, V9-DOC-QA-091, V9-DOC-QA-050]
---

# devops-automation — FinSightV9 运维自动化

为 FinSightV9 项目提供可复用的「定时备份」与「批量部署」自动化能力。配套两个可执行脚本与一个定时任务注册方法，使备份/部署从一次性手工操作变为可重复、可追溯、零破坏的标准动作。

## 触发词

定时备份、自动提交、Git 快照、批量部署、定时构建部署、注册定时任务、部署到静态托管、周期性任务、自动化 Skill。

## 何时使用

- 用户要求对项目做定时/自动备份（工作区快照提交到 `backup/auto` 分支）。
- 用户要求构建并部署（vite build → 多目标目录 / CloudStudio 静态托管）。
- 用户要求注册周期性自动化任务（每日、每周等）。
- 用户排查备份推送失败、部署构建失败等问题。

## 目录结构

```
devops-automation/
├── SKILL.md
├── scripts/
│   ├── backup-branch.ts   # 定时备份：快照提交 + 推送 backup/auto
│   └── batch-deploy.ts    # 批量部署：构建 + 多目标增量复制
└── references/
    └── automation-guide.md # 定时任务注册、rrule 示例、排障、复用现有脚本
```

## 定时备份工作流（backup-branch.ts）

将工作区改动自动提交并推送到备份分支。

- **运行**：`npx tsx .workbuddy/skills/devops-automation/scripts/backup-branch.ts`
- **参数**：`--branch <名>`（默认 `backup/auto`）、`--remote <名>`（默认 `origin`）、`--no-push`、`--message <msg>`
- **行为**：无改动则跳过；有改动则用底层 plumbing（`add → write-tree → commit-tree → branch -f`）把 `backup/auto` 指向当前工作树，**绝不改动当前分支（如 main）**；再 `--force-with-lease` 推送备份分支。
- **关键安全约定**：① 快照走 plumbing 而非 `git commit`，因此不污染当前分支历史、也不触发预提交钩子（快照不被门禁阻断，也无「绕过钩子」争议）；主分支开发仍走 `npm run commit` 强制全部门禁。② 自动排除 `.env`/密钥/`token` 等敏感文件，防泄露。③ 推送失败仅告警、本地快照保留。

## 批量部署工作流（batch-deploy.ts）

构建并批量复制产物，静态托管上传由宿主 agent 完成。

- **运行**：`npx tsx .workbuddy/skills/devops-automation/scripts/batch-deploy.ts [--target <dir>]... [--no-build]`
- **行为**：`npm run build` 产出 `dist`，增量复制到每个 `--target` 目录（自动创建、不删既有文件）；目标目录经围栏校验，拒绝项目根/`.git`/`node_modules`/个人目录/系统目录。
- **静态托管**：构建后由宿主 agent 调用 `workbuddy_cloudstudio_deploy` 工具将 `dist` 部署到 CloudStudio 静态托管，获取访问 URL。
- 未指定 `--target` 时仅构建，便于单独做静态托管部署。

## 注册定时任务（automation_update）

真正的周期执行通过宿主的自动化系统注册（非 cron 文件）。在对话中要求「注册定时备份/部署」时，使用 `automation_update` 工具：

- **每日备份**：`scheduleType=recurring`，`rrule=FREQ=DAILY;BYHOUR=3;BYMINUTE=10`，prompt 指示运行 `backup-branch.ts`。
- **每周部署**：`scheduleType=recurring`，`rrule=FREQ=WEEKLY;BYDAY=SU;BYHOUR=4;BYMINUTE=0`，prompt 指示先 build 再调用 `workbuddy_cloudstudio_deploy`。

详细的 rrule 写法、prompt 模板与 CRUD 见 `references/automation-guide.md`。

## 安全约束（务必遵守）

- **零破坏性**：两个脚本均无 `reset --hard`、`rm -rf`、不切换主分支、不触碰个人目录（Desktop/Downloads/Documents 等）。
- **不污染主分支**：备份走底层 plumbing 创建快照，当前分支（如 main）提交历史完全不受影响；绝不 `git commit` 到主分支。
- **敏感文件防泄露**：备份自动识别并排除 `.env`/密钥/`token`/私钥等模式，绝不上传凭证类文件。
- **部署目标围栏**：批量部署拒绝写入项目根、`.git`、`node_modules`、个人目录与系统目录，防止误覆盖。
- **门禁一致性**：主分支开发仍走 `npm run commit`（cz）与 15 道预提交门禁；备份快照不经过也不绕过这些钩子。

## 已知限制与运营提醒

- **推送凭证**：每日备份默认推送到 `origin`（项目远程 `https://github.com/DHENGHONGYU/-.git`）。若运行环境无该远程的推送凭证，任务会告警并仅保留本地 `backup/auto` 快照（不报错退出）。如需纯本地快照，可在定时任务 prompt 中追加 `--no-push`。
- **敏感文件为「文件名模式」识别**：`.env`/`*.pem`/`*.key`/`credentials*`/`id_rsa` 等会被自动排除；若密钥写在非上述命名的源码文件（如 `src/config/secrets.ts`）中则不会被识别，请保持密钥统一放在 `.env`（已被 gitignore）中。
- **batch-deploy 未绑定定时任务**：当前每周部署任务直接走 `npm run build` + `workbuddy_cloudstudio_deploy`；`batch-deploy.ts` 是多目标目录复制的独立工具，按需手动调用或另注册任务。

## 复用现有脚本

项目已有可组合的自动化资产（见 `scripts/`）：

- `scripts/monitor/system-check-loop.ts` — 每 2 天跑审计闭环（`npm run system:check-loop:auto`）。
- `scripts/build/deploy-rectification-toolkit.ts` — 部署整改工具包到目标目录。
- `scripts/docs-tool/doc-sync-scheduler.ts` — 文档同步调度（`npm run doc:sync:auto`）。

新增自动化任务时优先复用上述脚本，而非重复造轮子。

## 故障排查

| 现象 | 原因 | 处理 |
|------|------|------|
| 备份提示「无改动，跳过」 | 工作区干净 | 正常，无需处理 |
| 推送失败 warning | 无凭证/网络/远程不存在 | 本地快照已保留；配置远程或凭证后重试 |
| 部署构建失败 | 代码错误或门禁阻断 build | 先在本地 `npm run build` 修复 |
| 定时任务未触发 | rrule 写法或自动化状态 PAUSED | 用 `automation_update mode=view` 检查；参考 guide 的 rrule 示例 |
