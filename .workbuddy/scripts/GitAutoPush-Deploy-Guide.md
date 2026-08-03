# Git Auto-Push 部署与操作手册

> **版本**: v1.0.0  
> **更新日期**: 2026-07-26  
> **适用范围**: FinSightV9 本地开发机 / CI/CD 环境  
> **关联模块**: `GitAutoPush.psm1` / `auto-push-on-network.ps1` / `schedule-auto-push.ps1`

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     本地开发机 (Windows)                         │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │ GitAutoPush.psm1    │    │  schedule-auto-push.ps1       │  │
│  │ (PowerShell 模块)    │◄───│  (5min 间隔调度器)             │  │
│  │                     │    │                                │  │
│  │  ├─ Test-GitNetwork │    │  auto-push-on-network.ps1     │  │
│  │  ├─ Get-Pending...  │    │  (网络恢复一次性推送)            │  │
│  │  ├─ Push-Branch...  │    │  ├─ 网络检测循环               │  │
│  │  ├─ Push-Tag...     │    │  ├─ 分支推送 (3次重试)          │  │
│  │  └─ Invoke-AutoPush │    │  └─ Tag 推送 (3次重试)         │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │ Windows 任务计划程序  │───►│  日志: .workbuddy\*.log       │  │
│  │ (定时触发)           │    │  测试: .workbuddy\tests\      │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GitHub CI/CD (Ubuntu/Windows)                   │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │ git-auto-push.yml   │    │  ci.yml (集成测试)             │  │
│  │                      │    │  ├─ git-autopush-test Job    │  │
│  │  ├─ Pester 测试 Job  │    │  └─ Pester 测试报告上传       │  │
│  │  ├─ auto-push Job   │    └──────────────────────────────┘  │
│  │  └─ verify-only Job  │                                       │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 前置条件

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Windows PowerShell | 5.1+ 或 7+ | 支持 `Test-NetConnection` |
| Git for Windows | 2.30+ | 已配置 `user.name` / `user.email` |
| GitHub 远程 | HTTPS 或 SSH | `origin` 已正确配置 |
| 网络 | 能访问 `github.com:443` | 脚本会自动检测并等待恢复 |
| （可选）Pester | 5.x | 运行单元测试 |

## 3. 本地手动触发方式

### 3.1 方式一：一次性推送（推荐）

适用于网络恢复后立即推送 pending commits 和 tags：

```powershell
# PowerShell 5.1+ / 7+
powershell -ExecutionPolicy Bypass -File L:\FinSightV9\.workbuddy\scripts\auto-push-on-network.ps1 `
    -CheckInterval 10 `
    -MaxRetries 0 `
    -RepoPath "L:\FinSightV9" `
    -Branch "feat/cross-index-20260719" `
    -Tag "v2.6.0"
```

**参数说明**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-CheckInterval` | 10 | 网络检测间隔（秒） |
| `-MaxRetries` | 0 | 最大重试次数（0 = 无限重试直到成功） |
| `-RepoPath` | `L:\FinSightV9` | 仓库路径 |
| `-Branch` | `feat/cross-index-20260719` | 目标分支 |
| `-Tag` | `v2.6.0` | 要推送的 tag |

**退出码**：
- `0` — 成功：分支和 tag 已推送且验证同步
- `1` — 失败：网络检测达到 MaxRetries 上限或网络永不恢复
- `2` — 部分成功：推送完成但远端验证不通过

### 3.2 方式二：5 分钟循环调度

适用于开发期间持续监控网络恢复并自动推送：

```powershell
# 启动 5 分钟间隔调度器
powershell -ExecutionPolicy Bypass -File L:\FinSightV9\.workbuddy\scripts\schedule-auto-push.ps1 `
    -IntervalMinutes 5 `
    -CheckIntervalSeconds 10 `
    -MaxRetries 0 `
    -PushRetries 3 `
    -PushRetryDelaySeconds 2 `
    -Branch "feat/cross-index-20260719" `
    -Tag "v2.6.0"
```

**单次执行（不循环）**：

```powershell
powershell -ExecutionPolicy Bypass -File L:\FinSightV9\.workbuddy\scripts\schedule-auto-push.ps1 `
    -RunOnce `
    -CheckIntervalSeconds 3 `
    -MaxRetries 3 `
    -Branch "feat/cross-index-20260719" `
    -Tag "v2.6.0"
```

### 3.3 方式三：直接调用模块

适用于在 PowerShell 会话中灵活调用：

```powershell
# 导入模块
Import-Module L:\FinSightV9\.workbuddy\scripts\GitAutoPush.psm1

# 检测网络
Test-GitNetwork -HostName 'github.com' -Port 443

# 查看 pending commits
Get-PendingCommits -RepoPath 'L:\FinSightV9' -Branch 'feat/cross-index-20260719'

# 一键自动推送
Invoke-AutoPush `
    -RepoPath 'L:\FinSightV9' `
    -Branch 'feat/cross-index-20260719' `
    -Tag 'v2.6.0' `
    -CheckIntervalSeconds 10 `
    -MaxRetries 0 `
    -PushRetries 3 `
    -PushRetryDelaySeconds 2
```

## 4. Windows 任务计划程序注册

### 4.1 创建定时任务

```powershell
# 以管理员身份运行 PowerShell
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument '-ExecutionPolicy Bypass -File "L:\FinSightV9\.workbuddy\scripts\schedule-auto-push.ps1" -RunOnce -CheckIntervalSeconds 10 -MaxRetries 0 -Branch "feat/cross-index-20260719" -Tag "v2.6.0"'

$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At (Get-Date '09:00:00') `
    -RepetitionInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
    -TaskName 'FinSightV9-GitAutoPush' `
    -Action $action `
    -Trigger $trigger `
    -RunLevel Highest `
    -Description 'FinSightV9 Git 自动推送：每 5 分钟检测网络并推送 pending commits'
```

### 4.2 管理命令

```powershell
# 查看任务状态
Get-ScheduledTask -TaskName 'FinSightV9-GitAutoPush'

# 手动触发
Start-ScheduledTask -TaskName 'FinSightV9-GitAutoPush'

# 停用/启用
Disable-ScheduledTask -TaskName 'FinSightV9-GitAutoPush'
Enable-ScheduledTask -TaskName 'FinSightV9-GitAutoPush'

# 删除任务
Unregister-ScheduledTask -TaskName 'FinSightV9-GitAutoPush' -Confirm:$false
```

### 4.3 通过脚本一键安装

```powershell
powershell -ExecutionPolicy Bypass -File L:\FinSightV9\.workbuddy\scripts\schedule-auto-push.ps1 `
    -InstallScheduledTask `
    -TaskName 'FinSightV9-GitAutoPush' `
    -Branch 'feat/cross-index-20260719' `
    -Tag 'v2.6.0'
```

## 5. GitHub Actions CI/CD 触发

### 5.1 工作流 YAML

配置文件：[git-auto-push.yml](file:///L:/FinSightV9/.github/workflows/git-auto-push.yml)

**三种触发方式**：
1. **手动触发** (`workflow_dispatch`)：通过 GitHub UI 或 `gh` CLI
2. **定时触发** (`schedule`)：每 5 分钟 cron
3. **Push 触发** (`push`)：推送 `feat/**` 或 `feature/**` 分支时

### 5.2 GitHub UI 手动触发

1. 打开仓库 Actions 标签页
2. 选择 **"Git Auto-Push (Network Recovery)"** 工作流
3. 点击 **"Run workflow"** 按钮
4. 填写参数：

| 参数 | 示例 | 说明 |
|------|------|------|
| `branch` | `feat/cross-index-20260719` | 目标分支 |
| `tag` | `v2.6.0` | 要推送的 tag |
| `check_interval` | `10` | 网络检测间隔（秒） |
| `push_retries` | `3` | 推送重试次数 |
| `mode` | `push` | 操作模式：push / test / verify |

### 5.3 gh CLI 触发

```bash
# 前置：首次使用需认证
gh auth login

# 列出工作流
gh workflow list

# 手动触发推送
gh workflow run git-auto-push.yml \
    --raw-field branch="feat/cross-index-20260719" \
    --raw-field tag="v2.6.0" \
    --raw-field check_interval="10" \
    --raw-field push_retries="3" \
    --raw-field mode="push"

# 触发 dry-run 验证模式
gh workflow run git-auto-push.yml \
    --raw-field branch="feat/cross-index-20260719" \
    --raw-field mode="verify"

# 查看运行结果
gh run list --workflow git-auto-push.yml --limit 5
gh run view <run-id> --log

# 等待完成并下载日志
gh run watch <run-id>
gh run download <run-id> --name git-autopush-logs
```

### 5.4 工作流 Jobs 说明

| Job | Runner | 超时 | 说明 |
|-----|--------|------|------|
| `test` | `ubuntu-latest` | 15min | 运行 Pester 单元测试 |
| `auto-push` | `windows-latest` | 30min | 网络检测 + 自动推送 |
| `verify-only` | `ubuntu-latest` | 10min | `mode=verify` 时的 dry-run 同步检查 |

**依赖关系**：`auto-push` 需要 `test` 成功（push 触发时）；手动触发时 `auto-push` 独立运行。

## 6. 日志与故障排查

### 6.1 日志位置

| 日志 | 路径 | 内容 |
|------|------|------|
| 本地推送日志 | `.workbuddy\push-auto.log` | `auto-push-on-network.ps1` 输出 |
| 模块调用日志 | `.workbuddy\git-auto-push.log` | `GitAutoPush.psm1` 输出 |
| CI 日志 | GitHub Actions Artifacts | `git-autopush-logs` artifact |

### 6.2 常见问题排查

| 现象 | 可能原因 | 排查步骤 |
|------|---------|---------|
| 网络检测超时 | `github.com:443` 不可达 | 1. `Test-NetConnection github.com -Port 443`<br>2. 检查防火墙/代理设置 |
| 无 pending commits | 本地已同步远端 | 正常现象，脚本会输出 "Nothing to push" |
| Tag 推送失败 | Tag 名称不匹配或已存在 | 1. `git tag -l 'v2.6.0'`<br>2. `git ls-remote --tags origin` |
| 认证失败 | Git 凭据过期 | `git config credential.helper` → 重新登录 |
| 推送被拒 | 远端分支有新提交 | 1. `git fetch origin`<br>2. `git rebase origin/feat/cross-index-20260719` |

### 6.3 快速诊断命令

```powershell
# 一键自检
Import-Module L:\FinSightV9\.workbuddy\scripts\GitAutoPush.psm1

# 检查网络
Test-GitNetwork

# 检查 pending
Get-PendingCommits -RepoPath 'L:\FinSightV9' -Branch 'feat/cross-index-20260719'

# 检查 tag 状态
Test-TagNeedsPush -RepoPath 'L:\FinSightV9' -Tag 'v2.6.0'

# 检查远端同步
Test-RemoteSync -RepoPath 'L:\FinSightV9' -Branch 'feat/cross-index-20260719' -Tag 'v2.6.0'
```

## 7. 单元测试

### 7.1 本地运行 Pester 测试

```powershell
# 安装 Pester（首次）
Install-Module -Name Pester -Force -SkipPublisherCheck -Scope CurrentUser

# 运行全部测试
Invoke-Pester -Path L:\FinSightV9\.workbuddy\tests\GitAutoPush.Tests.ps1 -Output Detailed
```

### 7.2 测试覆盖场景

| 场景 | 用例数 | 说明 |
|------|:------:|------|
| Module Loading | 2 | 模块导入、函数导出 |
| Write-GitLog | 5 | 日志各级别输出 |
| Test-GitNetwork | 4 | 连通性检测 |
| Network Fluctuation Simulation | 4 | 隔离仓库、推送失败重试 |
| Retry Mechanism Validation | 2 | 重试计数与耗时 |
| Invoke-AutoPush Integration | 3 | 退出码、空工作检测 |
| Edge Cases | 4 | 边界场景 |
| Network Fluctuation Stress Tests | 5 | 大负载、并发失败 |
| Network Recovery Scenario Tests | 4 | 网络恢复后推送 |

## 8. 安全约束

- **`--no-verify` 标志**：脚本使用 `git push --no-verify` 跳过 pre-push 钩子，适用于网络恢复后的紧急推送。日常开发请使用标准 `git push`。
- **日志脱敏**：日志文件可能包含分支名和 tag，不含敏感信息。
- **本地凭据**：推送使用 Windows Credential Manager 中存储的 Git 凭据，不硬编码。

## 9. 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `.workbuddy/scripts/GitAutoPush.psm1` | 模块 | 可复用 PowerShell 模块，8 个导出函数 |
| `.workbuddy/scripts/auto-push-on-network.ps1` | 脚本 | 网络恢复后一次性推送 |
| `.workbuddy/scripts/schedule-auto-push.ps1` | 脚本 | 5 分钟间隔循环调度器 |
| `.workbuddy/tests/GitAutoPush.Tests.ps1` | 测试 | Pester 单元测试，9 个场景 33+ 用例 |
| `.github/workflows/git-auto-push.yml` | CI/CD | GitHub Actions 工作流 |
| `.github/workflows/ci.yml` | CI/CD | 集成 `git-autopush-test` Job |
| `.workbuddy/scripts/GitAutoPush-Deploy-Guide.md` | 文档 | 本文档 |