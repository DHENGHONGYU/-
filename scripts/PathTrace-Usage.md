# PathTrace 模块使用文档

> **版本**: v1.0.0
> **适用环境**: Windows + PowerShell 5.1+
> **文件**: `PathTrace.psd1` (清单) + `PathTrace.psm1` (代码)

## 1. 导入模块

```powershell
# 方式 A: 通过清单导入（推荐，标准方式）
Import-Module .\scripts\PathTrace.psd1

# 方式 B: 直接导入代码文件
Import-Module .\scripts\PathTrace.psm1

# 方式 C: 全局安装（复制到 PSModulePath）
Copy-Item .\scripts\PathTrace.* "$HOME\Documents\WindowsPowerShell\Modules\PathTrace\"
Import-Module PathTrace  # 之后任意终端直接可用
```

## 2. 函数列表

| 函数 | 用途 | 返回值 |
|------|------|--------|
| `Write-PathTrace` | 输出分级日志 | void |
| `Test-PathChain` | 批量探测路径，返回首个命中 | string 或 $null |
| `Find-PythonExe` | 6 级候选链定位 Python 解释器 | string 或 $null |
| `Enable-PathTraceLog` | 启用文件日志 | void |
| `Disable-PathTraceLog` | 禁用文件日志 | void |

## 3. 使用示例

### 3.1 基本日志输出

```powershell
Import-Module .\scripts\PathTrace.psd1

Write-PathTrace "路径探测开始"
Write-PathTrace "命中: D:\project\.venv" -Level OK
Write-PathTrace "配置文件缺失" -Level WARN
Write-PathTrace "Python 未找到" -Level ERR
Write-PathTrace "跳过可选检查" -Level DEBUG
```

输出效果：
```
[PathTrace] INFO | 路径探测开始
[PathTrace] OK   | 命中: D:\project\.venv
[PathTrace] WARN | 配置文件缺失
[PathTrace] ERR  | Python 未找到
[PathTrace] DEBUG | 跳过可选检查
```

日志级别颜色：INFO(灰) / OK(绿) / WARN(黄) / ERR(红) / DEBUG(青)

### 3.2 缩进输出

```powershell
Write-PathTrace "根级" -Indent 0
Write-PathTrace "子级" -Indent 1
Write-PathTrace "孙级" -Indent 2
```

### 3.3 批量路径探测

```powershell
$paths = @(
    "C:\app\config\settings.json",
    "C:\app\config\settings.yaml",
    "C:\app\config\settings.toml"
)
$found = Test-PathChain -Paths $paths -Label "配置文件"
# 返回第一个存在的路径，或 $null
```

### 3.4 Python 解释器定位

```powershell
# 基本用法
$python = Find-PythonExe -RepoRoot "D:\FinSightV9"

# 指定外部 venv 路径
$python = Find-PythonExe -RepoRoot "D:\FinSightV9" -EnvVenvPath "D:\Projects\Data\.venv"

# 禁用系统 PATH 回退
$python = Find-PythonExe -RepoRoot "D:\FinSightV9" -IncludeSystemPath:$false
```

候选链优先级（6 级）：

| 优先级 | 来源 | 路径 |
|--------|------|------|
| [0] | FIN_SIGHT_VENV_PATH 环境变量 | `$EnvVenvPath\Scripts\python.exe` |
| [1] | 项目根 .venv | `$RepoRoot\.venv\Scripts\python.exe` |
| [2] | 项目根 venv | `$RepoRoot\venv\Scripts\python.exe` |
| [3] | backend .venv | `$RepoRoot\backend\.venv\Scripts\python.exe` |
| [4] | backend venv | `$RepoRoot\backend\venv\Scripts\python.exe` |
| [5] | 系统 PATH | `Get-Command python` |

### 3.5 文件日志

```powershell
# 启用文件日志（同时输出到控制台和文件）
Enable-PathTraceLog -Path "C:\temp\deploy.log"

Write-PathTrace "部署开始" -Level INFO
# ... 执行部署操作 ...
Write-PathTrace "部署完成" -Level OK

# 禁用文件日志
Disable-PathTraceLog
```

文件内容格式：
```
[2026-08-09 00:15:52] === PathTrace 日志开始 ===
[00:15:52.681] [PathTrace] OK   | 部署开始
[00:15:53.123] [PathTrace] OK   | 部署完成
[2026-08-09 00:15:53] === PathTrace 日志结束 ===
```

## 4. 在其他脚本中复用

```powershell
# 在脚本顶部导入模块
Import-Module $PSScriptRoot\PathTrace.psd1

# 使用 Find-PythonExe 替代硬编码路径
$python = Find-PythonExe -RepoRoot (Split-Path -Parent $PSScriptRoot)
if (-not $python) {
    Write-PathTrace "Python 解释器未找到" -Level ERR
    exit 1
}

# 使用 Test-PathChain 探测任意路径
$configFile = Test-PathChain -Paths @(
    "$PSScriptRoot\config\app.env",
    "$PSScriptRoot\..\config\app.env"
) -Label "配置文件"
```

## 5. 技术说明

- **输出方式**: 使用 `[Console]::WriteLine()` 而非 `Write-Host`，可被 `Start-Process -RedirectStandardOutput` 捕获
- **编码**: 文件使用 UTF-8 with BOM 编码，兼容 PowerShell 5.1 中文显示
- **无外部依赖**: 纯 PowerShell 实现，不依赖任何第三方模块
