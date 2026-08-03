# Git Auto-Push 操作文档

> **版本**: v2.6.0  
> **更新日期**: 2026-07-26  
> **适用场景**: 网络恢复后自动推送 Git 变更到远程仓库

---

## 文件结构

```
.workbuddy/scripts/
├── GitAutoPush.psm1              # 可复用 PowerShell 模块（核心逻辑）
├── auto-push-on-network.ps1      # 单次执行脚本（持续监听网络）
└── schedule-auto-push.ps1        # 定时任务调度脚本（5 分钟间隔）
```

## 快速开始

### 1. 单次手动执行（开发机）

```powershell
# 方式 A：直接运行原脚本（持续监听网络，网络恢复后自动推送）
powershell -ExecutionPolicy Bypass -File ".workbuddy\scripts\auto-push-on-network.ps1"

# 方式 B：使用调度脚本（立即执行一次，不循环）
powershell -ExecutionPolicy Bypass -File ".workbuddy\scripts\schedule-auto-push.ps1" -RunOnce

# 方式 C：使用可复用模块
Import-Module ".workbuddy\scripts\GitAutoPush.psm1"
Invoke-AutoPush -RepoPath "L:\FinSightV9" -Branch "feat/cross-index-20260719" -Tag "v2.6.0"
```

### 2. 定时器模式（推荐）

```powershell
# 启动 5 分钟间隔的循环检查
powershell -ExecutionPolicy Bypass -File ".workbuddy\scripts\schedule-auto-push.ps1" -IntervalMinutes 5
```

### 3. Windows 计划任务注册

```powershell
# 注册一次性任务（立即运行）
powershell -ExecutionPolicy Bypass -File ".workbuddy\scripts\schedule-auto-push.ps1" -InstallScheduledTask

# 创建每 5 分钟执行的计划任务
schtasks /create /tn "FinSightV9-GitAutoPush" /tr "powershell -ExecutionPolicy Bypass -File `
  `"L:\FinSightV9\.workbuddy\scripts\schedule-auto-push.ps1`" -RunOnce" /sc minute /mo 5 /f
```

### 4. CI/CD 环境集成

本项目已内置完整的 GitHub Actions 工作流：

| 工作流 | 文件 | 说明 |
|--------|------|------|
| **Git Auto-Push** | `.github/workflows/git-auto-push.yml` | 独立自动推送工作流 |
| **CI (dev branches)** | `.github/workflows/ci.yml` | 已集成 `git-autopush-test` Job |

#### 方式 A：使用独立工作流（推荐）

1. 打开 GitHub → Actions → **Git Auto-Push**
2. 点击 **Run workflow**，填写参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| Branch | 目标分支 | `feat/cross-index-20260719` |
| Tag | 目标 Tag（可选） | `v2.6.0` |
| Check Interval | 网络检测间隔（秒） | `10` |
| Max Retries | 最大检测次数（0=无限） | `0` |
| Mode | `push` / `test` / `verify` | `push` |

3. 工作流包含 3 个 Job：
   - **test** — Pester 单元测试（Ubuntu）
   - **auto-push** — 自动推送（Windows，需 GitHub 可达）
   - **verify-only** — Dry-run 同步状态检查

#### 方式 B：触发 CI 工作流中的 Pester 测试

```bash
# 本地触发（需 GitHub CLI）
gh workflow run "CI (dev branches)" --ref feat/cross-index-20260719
```

#### 方式 C：在自定义工作流中引用模块

```yaml
jobs:
  auto-push:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run auto-push
        shell: pwsh
        run: |
          Import-Module ".workbuddy\scripts\GitAutoPush.psm1"
          $exitCode = Invoke-AutoPush `
            -RepoPath "${{ github.workspace }}" `
            -Branch "main" `
            -Tag "v1.0.0" `
            -CheckIntervalSeconds 30 `
            -MaxRetries 10
          exit $exitCode
```

---

## 可复用函数 API

### 模块导入

```powershell
Import-Module ".workbuddy\scripts\GitAutoPush.psm1"
```

### 导出函数列表

| 函数 | 说明 |
|------|------|
| `Invoke-AutoPush` | 完整自动推送流程（检测→推送→验证） |
| `Test-GitNetwork` | 检测 GitHub 443 端口连通性 |
| `Get-PendingCommits` | 获取待推送的 commit 列表 |
| `Test-TagNeedsPush` | 检查 Tag 是否需要推送 |
| `Push-BranchWithRetry` | 带重试的分支推送 |
| `Push-TagWithRetry` | 带重试的 Tag 推送 |
| `Test-RemoteSync` | 验证远程与本地同步状态 |
| `Write-GitLog` | 统一日志输出（控制台 + 文件） |

### 使用示例

#### 基本用法

```powershell
Invoke-AutoPush -RepoPath "C:\Projects\MyRepo" -Branch "main"
```

#### 带 Tag 推送

```powershell
Invoke-AutoPush -RepoPath "C:\Projects\MyRepo" -Branch "main" -Tag "v1.0.0"
```

#### 自定义参数

```powershell
Invoke-AutoPush `
  -RepoPath "C:\Projects\MyRepo" `
  -Branch "develop" `
  -Tag "v2.0.0" `
  -CheckIntervalSeconds 30 `
  -MaxRetries 20 `
  -PushRetries 5 `
  -LogFile "C:\logs\git-push.log"
```

#### 分步操作

```powershell
# Step 1: 检测网络
if (Test-GitNetwork) {
    Write-Host 'GitHub is reachable'
}

# Step 2: 检查待推送
$pending = Get-PendingCommits -RepoPath "." -Branch "main"
if ($pending.Count -gt 0) {
    # Step 3: 推送
    Push-BranchWithRetry -RepoPath "." -Branch "main"
}

# Step 4: 验证
Test-RemoteSync -RepoPath "." -Branch "main"
```

---

## 参数说明

### Invoke-AutoPush 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `-RepoPath` | string | （必填） | 仓库路径 |
| `-Branch` | string | （必填） | 目标分支名 |
| `-Tag` | string | 无 | 目标 Tag 名（可选） |
| `-CheckIntervalSeconds` | int | 10 | 网络检测间隔（秒） |
| `-MaxRetries` | int | 0 | 最大检测次数（0=无限） |
| `-PushRetries` | int | 3 | 推送重试次数 |
| `-PushRetryDelaySeconds` | int | 2 | 推送重试间隔（秒） |
| `-LogFile` | string | 自动 | 日志文件路径 |

### Test-GitNetwork 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `-HostName` | string | github.com | 目标主机 |
| `-Port` | int | 443 | 目标端口 |
| `-TimeoutSeconds` | int | 5 | 超时时间（秒） |

---

## 退出码

| 退出码 | 含义 |
|:------:|------|
| 0 | 全部完成，远程与本地同步 |
| 1 | 网络始终未恢复 / 最大重试次数 |
| 2 | 推送完成但验证未通过（需手动检查） |

---

## 日志文件

日志默认写入仓库根目录 `.workbuddy\` 下：

- `git-auto-push.log` — 单次推送日志
- `git-auto-push-scheduler.log` — 调度器日志

日志格式：
```
[2026-07-26 14:30:00] [INFO] ===== Git Auto-Push Started =====
[2026-07-26 14:30:00] [INFO] Repo: L:\FinSightV9
[2026-07-26 14:30:05] [INFO] [Check 1] Testing github.com:443...
[2026-07-26 14:30:05] [WARN] Network unreachable, retry in 10s...
```

---

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| `Test-NetConnection` 超时 | 网络阻断 / 防火墙 | 检查代理设置 / 配置 git proxy |
| `gh` 命令不存在 | 未安装 GitHub CLI | 安装 [GitHub CLI](https://cli.github.com/) |
| Push 失败但认证正常 | 远程仓库冲突 | 执行 `git pull --rebase` 后重试 |
| 计划任务未运行 | 系统休眠 / 权限不足 | 在"任务计划程序"中检查触发器和条件 |

### 设置 Git 代理（如需）

```powershell
git config --global http.proxy http://proxy.company.com:8080
git config --global https.proxy http://proxy.company.com:8080
```

---

## 其他项目复用

1. 将 `GitAutoPush.psm1` 复制到目标项目的脚本目录
2. 修改 `schedule-auto-push.ps1` 中的默认参数：
   ```powershell
   [string]$RepoPath = 'C:\Projects\OtherRepo'
   [string]$Branch = 'main'
   [string]$Tag = 'v1.0.0'
   ```
3. 或在调用时覆盖参数：
   ```powershell
   Invoke-AutoPush -RepoPath "D:\Work\MyProject" -Branch "develop"
   ```
