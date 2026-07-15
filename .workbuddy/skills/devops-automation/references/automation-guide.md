# 自动化任务注册与运维指南（devops-automation）

本文件详述如何为 FinSightV9 注册、修改、排查周期性自动化任务，以及 rrule 写法与 prompt 模板。面向需要在对话中实际创建定时任务的场景。

## 一、自动化系统概览

宿主提供 `automation_update` 工具，用于创建/查看/更新/删除周期性任务。任务入库后由系统在后台按 `rrule` 触发，触发时运行 `prompt`（由 agent 执行，拥有 Bash / 文件 / 部署等工具）。

> 注意：自动化任务**不依赖项目内的 cron 文件或 GitHub Actions**，由宿主调度器直接驱动。本项目的 `system-check-loop` 仍保留 GitHub Actions 路径作为补充，两者不冲突。

## 二、automation_update 关键字段

| 字段 | 说明 |
|------|------|
| `mode` | `create` / `view` / `update` / `delete` |
| `name` | 人类可读名称 |
| `prompt` | 任务触发时执行的自然语言指令（须自包含，含路径与步骤） |
| `scheduleType` | `recurring`（周期）或 `once`（一次性） |
| `rrule` | RFC 5545 周期规则（recurring 时必填） |
| `scheduledAt` | 一次性任务的 ISO 时间（once 时必填） |
| `status` | `ACTIVE` / `PAUSED` |
| `cwds` | 工作目录（建议填 `G:/FinSightV9`，使相对路径与 git 上下文正确） |
| `validFrom` / `validUntil` | 可选生效区间（ISO 日期或日期时间） |

## 三、rrule 写法速查

| 需求 | rrule |
|------|-------|
| 每天 03:10 | `FREQ=DAILY;BYHOUR=3;BYMINUTE=10` |
| 每周日 04:00 | `FREQ=WEEKLY;BYDAY=SU;BYHOUR=4;BYMINUTE=0` |
| 每工作日 09:30 | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=30` |
| 每 2 天 | `FREQ=DAILY;INTERVAL=2` |
| 每月 1 号 02:00 | `FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=2;BYMINUTE=0` |

时区由宿主调度器决定；写本地直觉时间即可。

## 四、标准 prompt 模板

### 模板 A：每日 Git 备份

```
对 G:/FinSightV9 执行定时 Git 备份：
1) 用 npx tsx 运行 G:/FinSightV9/.workbuddy/skills/devops-automation/scripts/backup-branch.ts
2) 若工作区无改动则跳过；若有改动则自动提交到 backup/auto 分支并推送
3) 完成后用一两句话报告：是否备份、提交 SHA 前 10 位、推送结果；推送失败也要说明本地快照已保留
```

### 模板 B：每周构建部署到 CloudStudio

```
对 G:/FinSightV9 执行定时部署：
1) 在 G:/FinSightV9 运行 `npm run build` 生成 dist（构建失败则停止并报告错误）
2) 调用 workbuddy_cloudstudio_deploy 工具，将 G:/FinSightV9/dist 部署到 CloudStudio 静态托管
3) 报告部署结果访问 URL；若构建或部署失败，说明原因且不要静默成功
```

## 五、创建示例（对话中表达即可，由 agent 调用工具）

- 「注册每日 03:10 的 Git 备份」 → 用模板 A + rrule `FREQ=DAILY;BYHOUR=3;BYMINUTE=10`，`cwds=G:/FinSightV9`，`status=ACTIVE`。
- 「注册每周日 04:00 的构建部署」 → 用模板 B + rrule `FREQ=WEEKLY;BYDAY=SU;BYHOUR=4;BYMINUTE=0`。

## 六、查看 / 修改 / 暂停 / 删除

- 查看全部：`automation_update mode=list`
- 查看单个：`automation_update mode=view id=<id>`
- 暂停：`automation_update mode=update id=<id> status=PAUSED`
- 改周期：`automation_update mode=update id=<id> rrule=<新规则>`
- 删除：`automation_update mode=delete id=<id>`

## 七、复用现有项目脚本（避免重复造轮子）

| 脚本 | 用途 | 触发命令 |
|------|------|----------|
| `scripts/monitor/system-check-loop.ts` | 审计闭环（变更→文档→健康度→评分） | `npm run system:check-loop:auto` |
| `scripts/build/deploy-rectification-toolkit.ts` | 部署整改工具包到目标目录 | `tsx scripts/build/deploy-rectification-toolkit.ts <targetDir>` |
| `scripts/docs-tool/doc-sync-scheduler.ts` | 文档同步调度 | `npm run doc:sync:auto` |

新增自动化时优先复用，再叠加 devops-automation 的备份/部署脚本。

## 八、排障

- **任务不触发**：`mode=view` 确认 `status=ACTIVE` 且 `rrule` 合法；检查 `cwds` 是否为 `G:/FinSightV9`。
- **备份推送 warning**：多半无远程凭证；本地快照（backup/auto 分支）已保留，配置 SSH/HTTPS 凭证后重试即可。
- **部署构建失败**：先在本地 `npm run build` 定位；不要靠自动化反复重试失败构建。
- **误注册**：`mode=delete id=<id>` 立即移除。
