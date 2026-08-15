---
doc_id: V9-DOC-DEV-007
title: "PathTrace 模块部署与配置指南"
domain: dev
status: active
last_updated: 2026-08-15
---

# PathTrace 模块部署与配置指南

> **版本**: v1.1.0
> **适用环境**: Windows 10/11 + PowerShell 5.1+
> **最后更新**: 2026-08-09
> **关联文件**: `scripts/PathTrace.psd1`, `scripts/PathTrace.psm1`, `scripts/windows-deploy-verify.ps1`

---

## 1. 概述

PathTrace 是一个可复用的 PowerShell 路径追踪日志模块，提供：

- **5 级分级日志**：INFO / OK / WARN / ERR / DEBUG，带颜色区分
- **批量路径探测**：`Test-PathChain` 自动逐一检查路径列表
- **Python 解释器定位**：`Find-PythonExe` 支持 6 级候选链
- **文件日志**：可选的文件输出，便于事后审计
- **降级回退**：模块不可用时自动使用内联函数，脚本始终可运行

---

## 2. FIN_SIGHT_VENV_PATH 环境变量

### 2.1 用途

当 `.venv` 虚拟环境不在项目目录内时（如统一放置在 `D:\Projects\Data\.venv`），通过此环境变量指定外部路径。PathTrace 模块将其作为候选链的第 0 级（最高优先级）。

### 2.2 候选链优先级

| 优先级 | 来源 | 路径 |
|--------|------|------|
| [0] | `FIN_SIGHT_VENV_PATH` 环境变量 | `$FIN_SIGHT_VENV_PATH\Scripts\python.exe` |
| [1] | 项目根 `.venv` | `$RepoRoot\.venv\Scripts\python.exe` |
| [2] | 项目根 `venv` | `$RepoRoot\venv\Scripts\python.exe` |
| [3] | backend `.venv` | `$RepoRoot\backend\.venv\Scripts\python.exe` |
| [4] | backend `venv` | `$RepoRoot\backend\venv\Scripts\python.exe` |
| [5] | 系统 PATH | `Get-Command python` |

### 2.3 配置方法

#### 临时设置（仅当前终端会话）

```powershell
$env:FIN_SIGHT_VENV_PATH = "D:\Projects\Data\.venv"
```

#### 永久设置（用户级，重启终端后生效）

```powershell
[System.Environment]::SetEnvironmentVariable(
    "FIN_SIGHT_VENV_PATH",
    "D:\Projects\Data\.venv",
    "User"
)
```

#### 永久设置（机器级，需管理员权限）

```powershell
[System.Environment]::SetEnvironmentVariable(
    "FIN_SIGHT_VENV_PATH",
    "D:\Projects\Data\.venv",
    "Machine"
)
```

### 2.4 验证设置

```powershell
# 检查所有级别
[System.Environment]::GetEnvironmentVariable("FIN_SIGHT_VENV_PATH", "Process")
[System.Environment]::GetEnvironmentVariable("FIN_SIGHT_VENV_PATH", "User")
[System.Environment]::GetEnvironmentVariable("FIN_SIGHT_VENV_PATH", "Machine")
```

三个级别均应为空（默认）或指向正确的 `.venv` 路径。

### 2.5 清除设置

```powershell
# 清除用户级
[System.Environment]::SetEnvironmentVariable("FIN_SIGHT_VENV_PATH", $null, "User")

# 清除临时级
Remove-Item Env:\FIN_SIGHT_VENV_PATH -ErrorAction SilentlyContinue
```

### 2.6 降级行为

当 `FIN_SIGHT_VENV_PATH` 指向无效路径时：

1. 候选 [0] miss（路径不存在）
2. 自动回退到候选 [1]（项目根 `.venv`）
3. 输出 WARN 级别日志
4. 脚本继续正常运行，不会中断

---

## 3. PathTrace 模块安装

### 3.1 方式 A：项目内安装（推荐）

模块文件已随项目分发，位于 `scripts/` 目录：

```
scripts/
├── PathTrace.psd1    # 模块清单
├── PathTrace.psm1    # 模块代码
└── windows-deploy-verify.ps1  # 已集成的部署验证脚本
```

无需额外安装，脚本启动时自动从同目录导入。

### 3.2 方式 B：全局安装（任意终端可用）

```powershell
# 创建全局模块目录
$moduleDir = "$HOME\Documents\WindowsPowerShell\Modules\PathTrace"
New-Item -ItemType Directory -Path $moduleDir -Force

# 复制模块文件
Copy-Item D:\FinSightV9\scripts\PathTrace.psd1 $moduleDir\
Copy-Item D:\FinSightV9\scripts\PathTrace.psm1 $moduleDir\

# 验证
Get-Module -ListAvailable -Name PathTrace
```

安装后，任意终端任意目录均可使用：

```powershell
Import-Module PathTrace
$py = Find-PythonExe -RepoRoot "D:\FinSightV9"
```

### 3.3 方式 C：临时导入

```powershell
# 通过清单导入（标准方式）
Import-Module D:\FinSightV9\scripts\PathTrace.psd1

# 或直接导入代码文件
Import-Module D:\FinSightV9\scripts\PathTrace.psm1
```

---

## 4. windows-deploy-verify.ps1 三级导入策略

集成后的 `windows-deploy-verify.ps1` 采用三级导入策略，确保在任何环境下都能正常运行：

```
┌─────────────────────────────────────────────────────┐
│              脚本启动                                │
├─────────────────────────────────────────────────────┤
│  第 1 级: 同目录 .psd1 清单导入                      │
│  → 检查 $PSScriptRoot\PathTrace.psd1 是否存在       │
│  → 存在则 Import-Module .psd1                       │
│  → 失败则尝试 .psm1                                 │
├─────────────────────────────────────────────────────┤
│  第 2 级: 全局 PSModulePath 导入                     │
│  → Import-Module PathTrace (从全局模块路径)          │
│  → 失败则进入降级模式                                │
├─────────────────────────────────────────────────────┤
│  第 3 级: 内联降级函数                               │
│  → 定义 inline Write-PathTrace + Find-PythonExe     │
│  → 输出 WARN 日志: "使用内联降级函数"                │
│  → 脚本继续正常运行                                  │
└─────────────────────────────────────────────────────┘
```

**设计原则**：模块优先，降级保底。无论模块是否安装、路径是否正确，脚本都不会因模块缺失而崩溃。

---

## 5. 函数 API

### 5.1 Write-PathTrace

```powershell
Write-PathTrace [-Message] <string> [-Level <string>] [-Indent <int>]
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| Message | string | (必填) | 日志消息 |
| Level | string | INFO | 日志级别: INFO/OK/WARN/ERR/DEBUG |
| Indent | int | 0 | 缩进级别 0-4 |

```powershell
Write-PathTrace "部署开始" -Level INFO
Write-PathTrace "Python 找到" -Level OK
Write-PathTrace "配置缺失，使用默认值" -Level WARN
Write-PathTrace "Python 未找到" -Level ERR
Write-PathTrace "跳过可选检查" -Level DEBUG -Indent 1
```

### 5.2 Find-PythonExe

```powershell
Find-PythonExe [-RepoRoot] <string> [-EnvVenvPath <string>] [-IncludeSystemPath]
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| RepoRoot | string | (必填) | 项目根目录 |
| EnvVenvPath | string | $null | FIN_SIGHT_VENV_PATH 的值 |
| IncludeSystemPath | switch | $true | 是否在所有候选未命中时回退到系统 PATH |

返回：Python 可执行文件路径，或 $null

### 5.3 Test-PathChain

```powershell
Test-PathChain [-Paths] <string[]> [-Label <string>]
```

返回：第一个存在的路径，或 $null

### 5.4 Enable-PathTraceLog / Disable-PathTraceLog

```powershell
Enable-PathTraceLog -Path "C:\temp\deploy.log"
# ... 执行操作 ...
Disable-PathTraceLog
```

---

## 6. 在其他脚本中复用

```powershell
# 导入模块
Import-Module $PSScriptRoot\PathTrace.psd1

# 定位 Python
$python = Find-PythonExe -RepoRoot (Split-Path -Parent $PSScriptRoot)
if (-not $python) {
    Write-PathTrace "Python 解释器未找到" -Level ERR
    exit 1
}

# 批量探测配置文件
$config = Test-PathChain -Paths @(
    "$PSScriptRoot\config\app.env",
    "$PSScriptRoot\..\config\app.env"
) -Label "配置文件"

# 启用文件日志
Enable-PathTraceLog -Path "$env:TEMP\my-script.log"
Write-PathTrace "脚本执行完成" -Level OK
Disable-PathTraceLog
```

---

## 7. 故障排查

| 症状 | 原因 | 修复 |
|------|------|------|
| `PathTrace 模块不可用，使用内联降级函数` | .psd1/.psm1 不在同目录且未全局安装 | 将模块文件复制到脚本同目录，或全局安装 |
| `候选[0] miss` | FIN_SIGHT_VENV_PATH 指向的路径不存在 | 检查路径是否正确，或清除环境变量 |
| `所有 5 级候选均未命中` | .venv 未创建或路径均不正确 | 运行 `python -m venv .venv` 创建虚拟环境 |
| `系统 python 也未找到` | Python 未安装或不在 PATH | 安装 Python 或将其添加到系统 PATH |
| 日志无颜色 | 降级模式使用 Write-Host（有颜色）vs 模块模式使用 [Console]（无颜色） | 预期行为，功能不受影响 |
| `FIN_SIGHT_VENV_PATH 干扰正常部署` | 环境变量残留了旧路径 | 清除环境变量（见 §2.5） |

---

## 8. 部署前检查清单

```powershell
# 1. 确认 FIN_SIGHT_VENV_PATH 未被意外设置
$envVal = [System.Environment]::GetEnvironmentVariable("FIN_SIGHT_VENV_PATH", "Process")
if ($envVal) { Write-Host "WARNING: FIN_SIGHT_VENV_PATH=$envVal" } else { Write-Host "OK: 未设置" }

# 2. 确认 PathTrace 模块文件存在
Test-Path D:\FinSightV9\scripts\PathTrace.psd1
Test-Path D:\FinSightV9\scripts\PathTrace.psm1

# 3. 运行部署验证
powershell -ExecutionPolicy Bypass -File D:\FinSightV9\scripts\windows-deploy-verify.ps1

# 4. 检查 PathTrace 日志输出
# 日志应显示: "PathTrace 模块已加载 (来源: 清单)"
# 如果显示: "PathTrace 模块不可用，使用内联降级函数" → 检查模块文件位置
```
