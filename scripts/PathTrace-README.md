# PathTrace

> PowerShell 路径追踪日志模块 — 可复用、可降级、可调试

[![Version](https://img.shields.io/badge/version-1.1.0-blue)]()
[![PowerShell](https://img.shields.io/badge/PowerShell-5.1+-blue)]()
[![Tests](https://img.shields.io/badge/tests-16%2F16%20PASS-green)]()

---

## 核心功能

| 功能 | 函数 | 说明 |
|------|------|------|
| 分级日志 | `Write-PathTrace` | 5 级 (INFO/OK/WARN/ERR/DEBUG) + 颜色 + 缩进 |
| DEBUG 开关 | `Enable-PathTraceDebug` / `Disable-PathTraceDebug` | 按需开启详细日志 |
| 批量路径探测 | `Test-PathChain` | 逐一检查路径列表，返回首个命中 |
| Python 定位 | `Find-PythonExe` | 6 级候选链 + 环境变量 + 系统 PATH 回退 |
| 文件日志 | `Enable-PathTraceLog` / `Disable-PathTraceLog` | 带毫秒时间戳的文件输出 |

---

## 快速开始

```powershell
# 导入模块
Import-Module .\scripts\PathTrace.psm1

# 定位 Python
$python = Find-PythonExe -RepoRoot "D:\FinSightV9"

# 输出日志
Write-PathTrace "部署开始" -Level INFO
Write-PathTrace "Python 找到: $python" -Level OK

# 排查问题时启用 DEBUG
Enable-PathTraceDebug
$python = Find-PythonExe -RepoRoot "D:\FinSightV9"
Disable-PathTraceDebug
```

---

## 一键部署

```powershell
# 部署到用户级（无需管理员）
.\scripts\deploy-pathtrace-module.ps1

# 部署到机器级（需管理员）
.\scripts\deploy-pathtrace-module.ps1 -Scope AllUsers

# 验证安装
.\scripts\deploy-pathtrace-module.ps1 -Verify

# 卸载
.\scripts\deploy-pathtrace-module.ps1 -Uninstall
```

部署后任意终端可用：
```powershell
Import-Module PathTrace  # 无需指定路径
```

---

## 候选链优先级

`Find-PythonExe` 按以下顺序探测 Python 解释器：

| 优先级 | 来源 | 路径 |
|--------|------|------|
| [0] | `FIN_SIGHT_VENV_PATH` 环境变量 | `$env\Scripts\python.exe` |
| [1] | 项目根 `.venv` | `$RepoRoot\.venv\Scripts\python.exe` |
| [2] | 项目根 `venv` | `$RepoRoot\venv\Scripts\python.exe` |
| [3] | backend `.venv` | `$RepoRoot\backend\.venv\Scripts\python.exe` |
| [4] | backend `venv` | `$RepoRoot\backend\venv\Scripts\python.exe` |
| [5] | 系统 PATH | `Get-Command python` |

配置外部 venv 路径：
```powershell
# 临时
$env:FIN_SIGHT_VENV_PATH = "D:\Projects\Data\.venv"

# 永久（用户级）
[System.Environment]::SetEnvironmentVariable("FIN_SIGHT_VENV_PATH", "D:\Projects\Data\.venv", "User")
```

---

## DEBUG 模式日志输出示例

### 默认模式（DEBUG 关闭）

```
[PathTrace] INFO | FIN_SIGHT_VENV_PATH 未设置（可选，用于 .venv 在项目外部时指定）
[PathTrace] INFO | === Python 解释器候选链 探测开始 ===
[PathTrace] OK   |   候选[1]/4 HIT: D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] INFO |   候选[2]/4 miss: D:\FinSightV9\venv\Scripts\python.exe
[PathTrace] INFO |   候选[3]/4 miss: D:\FinSightV9\backend\.venv\Scripts\python.exe
[PathTrace] INFO |   候选[4]/4 miss: D:\FinSightV9\backend\venv\Scripts\python.exe
[PathTrace] OK   | 选中: 候选[1] -> D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] INFO | === Python 解释器候选链 探测结束 ===
```

### DEBUG 模式（启用详细日志）

```
[PathTrace] OK   | DEBUG 模式已启用

[PathTrace] DEBUG | RepoRoot = D:\FinSightV9
[PathTrace] DEBUG | EnvVenvPath = (null)
[PathTrace] DEBUG | IncludeSystemPath = True
[PathTrace] INFO  | FIN_SIGHT_VENV_PATH 未设置（可选，用于 .venv 在项目外部时指定）
[PathTrace] DEBUG | 候选[0] 跳过: EnvVenvPath 为空
[PathTrace] DEBUG | 候选[1] 构造: D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] DEBUG | 候选[2] 构造: D:\FinSightV9\venv\Scripts\python.exe
[PathTrace] DEBUG | 候选[3] 构造: D:\FinSightV9\backend\.venv\Scripts\python.exe
[PathTrace] DEBUG | 候选[4] 构造: D:\FinSightV9\backend\venv\Scripts\python.exe
[PathTrace] INFO  | === Python 解释器候选链 探测开始 ===
[PathTrace] OK    |   候选[1]/4 HIT: D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 True
[PathTrace] INFO  |   候选[2]/4 miss: D:\FinSightV9\venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] INFO  |   候选[3]/4 miss: D:\FinSightV9\backend\.venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] INFO  |   候选[4]/4 miss: D:\FinSightV9\backend\venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] OK    | 选中: 候选[1] -> D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] INFO  | === Python 解释器候选链 探测结束 ===
[PathTrace] DEBUG | 候选链探测耗时: 2ms (共 4 条路径)
```

### DEBUG + 无效环境变量（降级回退）

```
[PathTrace] DEBUG | 候选[0] 构造: Join-Path('D:\NonExistent\fake_venv', 'Scripts\python.exe') = D:\NonExistent\fake_venv\Scripts\python.exe
[PathTrace] OK    | 检测到 FIN_SIGHT_VENV_PATH=D:\NonExistent\fake_venv，加入候选
[PathTrace] INFO  | === Python 解释器候选链 探测开始 ===
[PathTrace] INFO  |   候选[1]/5 miss: D:\NonExistent\fake_venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] OK    |   候选[2]/5 HIT: D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 True
[PathTrace] OK    | 选中: 候选[2] -> D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] INFO  | === Python 解释器候选链 探测结束 ===
[PathTrace] DEBUG | 候选链探测耗时: 2ms (共 5 条路径)
```

### 无效驱动器容错

```
[PathTrace] DEBUG | RepoRoot = X:\NonExistent\Project
[PathTrace] WARN  | 候选[1] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] WARN  | 候选[2] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] WARN  | 候选[3] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] WARN  | 候选[4] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] INFO  | === Python 解释器候选链 探测开始 ===
[PathTrace] WARN  | 所有 0 级候选均未命中
[PathTrace] INFO  | === Python 解释器候选链 探测结束 ===
```

---

## 边界测试报告

### 测试结果

| # | 测试项 | 输入 | v1.0.0 | v1.1.0 | 修复方式 |
|---|--------|------|--------|--------|----------|
| 1 | 空字符串路径 | `@("", "", "")` | 崩溃 | PASS | `[AllowEmptyString()]` |
| 2 | 混合空与非空路径 | `@("", valid, "")` | 崩溃 | PASS | 空路径被跳过 |
| 3 | 空数组 | `@()` | 崩溃 | PASS | `[AllowEmptyCollection()]` |
| 4 | 空消息 | `Write-PathTrace ""` | 崩溃 | PASS | `[AllowEmptyString()]` |
| 5 | 无效驱动器 | `X:\NonExistent` | 崩溃 | PASS | `Join-Path` try/catch |
| 6 | 含空格路径 | `D:\My Project\...` | PASS | PASS | 无需修复 |
| 7 | 含中文路径 | `C:\temp\测试目录` | PASS | PASS | 无需修复 |
| 8 | UNC 路径 | `\\Server\Share\...` | PASS | PASS | 无需修复 |
| 9 | 超长路径 (>260 字符) | `D:\AAA...A\python.exe` | PASS | PASS | Test-Path 返回 False |
| 10 | null EnvVenvPath | `$null` | PASS | PASS | `IsNullOrEmpty` 处理 |
| 11 | 重复 Enable/Disable | 连续调用 2 次 | PASS | PASS | 幂等操作 |
| 12 | 文件日志目录不存在 | `C:\temp\new\log.txt` | PASS | PASS | `New-Item -Force` |

### 修复详情

**修复 1: 空字符串/空数组参数绑定**

```powershell
# 修复前: PowerShell 默认拒绝空字符串和空数组
[Parameter(Mandatory=$true)]
[string[]]$Paths

# 修复后: 显式允许空值
[Parameter(Mandatory=$true)]
[AllowEmptyString()]
[AllowEmptyCollection()]
[string[]]$Paths
```

**修复 2: 无效驱动器 Join-Path 崩溃**

```powershell
# 修复前: Join-Path 对不存在的驱动器抛出 DriveNotFoundException
$c1 = Join-Path $RepoRoot ".venv\Scripts\python.exe"

# 修复后: try/catch 捕获，输出 WARN，跳过该候选
try {
    $c = Join-Path $RepoRoot $suffix -ErrorAction Stop
} catch {
    $c = $null
    Write-PathTrace "候选[$cIdx] 构造失败: $($_.Exception.Message)" -Level WARN
}
```

**修复 3: DEBUG 日志 typo**

```powershell
# 修复前: EnvVenvPath = (null))  ← 多余的 )
# 修复后: EnvVenvPath = (null)
```

---

## 三级导入策略

`windows-deploy-verify.ps1` 集成了三级导入策略，确保任何环境下都能运行：

```
第 1 级: 同目录 .psd1 清单导入 → 失败则尝试 .psm1
第 2 级: 全局 PSModulePath 导入
第 3 级: 内联降级函数（脚本自带，零依赖保底）
```

模块不可用时自动降级：
```
[PathTrace] WARN | PathTrace 模块不可用，使用内联降级函数
[PathTrace] OK   | 最终选中 Python: D:\FinSightV9\.venv\Scripts\python.exe
```

---

## 升级对比

| 维度 | 硬编码路径 | PathTrace v1.1.0 |
|------|-----------|-------------------|
| 路径定位 | 写死单一路径 | 6 级候选链动态探测 |
| 跨盘符 | 不支持 | 支持 |
| 跨用户 | 不支持 | 支持 |
| 外部 venv | 不支持 | `FIN_SIGHT_VENV_PATH` |
| 日志 | 无分级 | 5 级 + DEBUG 开关 |
| 排查 | 黑盒 | 全链路可观测 |
| 代码复用 | 每脚本各自写 | `Import-Module` 一行 |
| 降级 | 崩溃 | 内联函数保底 |
| 性能 | ~0ms | ~2ms (可忽略) |
| 维护成本 | O(N) | O(1) |

---

## 测试套件

| 测试套件 | 项数 | 结果 |
|----------|------|------|
| 全局安装测试 | 10 | 10/10 PASS |
| 边界情况测试 | 6 | 6/6 PASS |
| 降级回退测试 | 4 场景 | 4/4 PASS |
| DEBUG 模式测试 | 3 场景 | 3/3 PASS |
| 集成测试 | 13 | 13/13 PASS |

运行测试：
```powershell
.\scripts\test-pathtrace-global.ps1
```

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `PathTrace.psd1` | PowerShell 模块清单 |
| `PathTrace.psm1` | 模块代码（7 个导出函数） |
| `deploy-pathtrace-module.ps1` | 一键部署脚本 |
| `test-pathtrace-global.ps1` | 自动化测试套件（16 项） |
| `PathTrace-Usage.md` | 详细使用文档 |
| `PathTrace-README.md` | 本文件 |

---

## 已知限制

| 限制 | 说明 | 影响 |
|------|------|------|
| 颜色输出 | 模块模式 `[Console]::WriteLine()` 无颜色 | 仅视觉差异 |
| 文件日志并发 | 多进程同时写同一文件可能交错 | 建议独立日志文件 |
| 长路径 | PS 5.1 `Test-Path` 对 >260 字符可能返回 False | Windows 系统限制 |
