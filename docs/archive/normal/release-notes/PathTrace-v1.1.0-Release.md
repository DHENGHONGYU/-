---title: "PathTrace v1.1.0 Release 说明"
domain: proj
status: active
last_updated: 2026-08-23
code_version: 2.0.0-rc.2
version: v1.1.3
change_log:
  - version: 1.1.3
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.1.2 / 正文 v1.1.0) → 取真值 max=1.1.2 → PATCH++ 对齐 frontmatter/正文/change_log 三轨"
    date: 2026-08-23
  - version: v1.1.2
    changes: "基准日校对(2026-08-22)：R1取真值(P1 change_log 最新条目=v1.1.1) → R2 PATCH++(v1.1.2) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
- version: v1.1.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.1.0) → R2 PATCH++(v1.1.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# PathTrace v1.1.0 Release 说明

> **发布日期**: 2026-08-09
> **版本**: v1.1.3
> **适用环境**: Windows 10/11 + PowerShell 5.1+
> **文件清单**: `PathTrace.psd1` + `PathTrace.psm1`

---

## 1. 核心功能

| 功能 | 说明 |
|------|------|
| **5 级分级日志** | INFO / OK / WARN / ERR / DEBUG，带颜色区分和缩进 |
| **DEBUG 模式开关** | `Enable-PathTraceDebug` / `Disable-PathTraceDebug`，默认关闭，按需开启 |
| **批量路径探测** | `Test-PathChain` 逐一检查路径列表，返回首个命中 |
| **Python 解释器定位** | `Find-PythonExe` 支持 6 级候选链 + 环境变量 + 系统 PATH 回退 |
| **文件日志** | `Enable-PathTraceLog` 写入文件，带毫秒级时间戳 |
| **降级回退** | 模块不可用时自动使用内联函数，脚本始终可运行 |
| **边界安全** | 空字符串、空数组、无效驱动器、超长路径、UNC 路径全部不崩溃 |

---

## 2. 升级对比

### 2.1 硬编码路径 vs PathTrace 模块

| 维度 | 硬编码路径（原始） | PathTrace 模块（v1.1.0） |
|------|-------------------|--------------------------|
| **路径定位** | `D:\FinSightV9\.venv\Scripts\python.exe` 写死 | 6 级候选链动态探测 |
| **跨盘符** | 不支持 | 支持（`$PSScriptRoot` 自动适配） |
| **跨用户** | 不支持 | 支持（动态推导，无硬编码用户名） |
| **外部 venv** | 不支持 | `FIN_SIGHT_VENV_PATH` 环境变量 |
| **日志输出** | `Write-Host` 无分级 | 5 级日志 + 颜色 + 缩进 + DEBUG 开关 |
| **排查能力** | 无日志 | 候选逐一打印 HIT/miss + 耗时 + Test-Path 结果 |
| **代码复用** | 每脚本各自硬编码 | `Import-Module` 一行导入 |
| **降级回退** | 无（模块缺失即崩溃） | 三级导入 + 内联降级函数 |
| **性能** | ~0ms | ~2ms（4-5 条 Test-Path，可忽略） |
| **维护成本** | O(N)（改 N 个脚本） | O(1)（改 1 个模块） |

### 2.2 v1.0.0 → v1.1.0 变更

| 变更项 | 类型 | 说明 |
|--------|------|------|
| `Enable-PathTraceDebug` / `Disable-PathTraceDebug` | 新增 | DEBUG 模式开关，控制 DEBUG 级别日志输出 |
| Find-PythonExe DEBUG 日志 | 新增 | 候选路径构造细节、Test-Path 结果、Stopwatch 耗时 |
| Test-PathChain DEBUG 日志 | 新增 | 每个候选的 Test-Path 返回值 |
| `[AllowEmptyString()]` + `[AllowEmptyCollection()]` | 修复 | Test-PathChain 参数支持空字符串和空数组 |
| `[AllowEmptyString()]` on Write-PathTrace | 修复 | Message 参数支持空字符串 |
| Join-Path try/catch | 修复 | 无效驱动器（如 `X:\`）不再崩溃，输出 WARN 日志 |
| DEBUG 日志 typo 修复 | 修复 | `EnvVenvPath` 显示多余的 `)` 已修正 |

---

## 3. 使用方法

### 3.1 导入模块

```powershell
# 方式 A: 通过清单导入（标准方式）
Import-Module .\scripts\PathTrace.psd1

# 方式 B: 直接导入代码文件
Import-Module .\scripts\PathTrace.psm1

# 方式 C: 全局安装
Copy-Item .\scripts\PathTrace.* "$HOME\Documents\WindowsPowerShell\Modules\PathTrace\"
Import-Module PathTrace
```

### 3.2 基本用法

```powershell
# 定位 Python（一行搞定）
$python = Find-PythonExe -RepoRoot "D:\FinSightV9"

# 输出日志
Write-PathTrace "部署开始" -Level INFO
Write-PathTrace "Python 找到" -Level OK
Write-PathTrace "配置缺失" -Level WARN

# 启用 DEBUG 模式（排查问题时）
Enable-PathTraceDebug
$python = Find-PythonExe -RepoRoot "D:\FinSightV9"
Disable-PathTraceDebug

# 批量探测路径
$config = Test-PathChain -Paths @(
    "$PSScriptRoot\config\app.env",
    "$PSScriptRoot\..\config\app.env"
) -Label "配置文件"

# 启用文件日志
Enable-PathTraceLog -Path "$env:TEMP\deploy.log"
# ... 执行操作 ...
Disable-PathTraceLog
```

### 3.3 在 windows-deploy-verify.ps1 中的集成方式

脚本采用三级导入策略，确保任何环境下都能运行：

```
第 1 级: 同目录 .psd1 清单导入 → 失败则尝试 .psm1
第 2 级: 全局 PSModulePath 导入
第 3 级: 内联降级函数（脚本自带，零依赖保底）
```

---

## 4. DEBUG 模式日志输出示例

### 4.1 默认模式（DEBUG 关闭）

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

### 4.2 DEBUG 模式（启用详细日志）

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

### 4.3 DEBUG + 无效环境变量（降级回退示例）

```
[PathTrace] DEBUG | 候选[0] 构造: Join-Path('D:\NonExistent\fake_venv', 'Scripts\python.exe') = D:\NonExistent\fake_venv\Scripts\python.exe
[PathTrace] OK    | 检测到 FIN_SIGHT_VENV_PATH=D:\NonExistent\fake_venv，加入候选
[PathTrace] DEBUG | 候选[1] 构造: D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] INFO  | === Python 解释器候选链 探测开始 ===
[PathTrace] INFO  |   候选[1]/5 miss: D:\NonExistent\fake_venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] OK    |   候选[2]/5 HIT: D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 True
[PathTrace] INFO  |   候选[3]/5 miss: D:\FinSightV9\venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] INFO  |   候选[4]/5 miss: D:\FinSightV9\backend\.venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] INFO  |   候选[5]/5 miss: D:\FinSightV9\backend\venv\Scripts\python.exe
[PathTrace] DEBUG |     Test-Path 返回 False
[PathTrace] OK    | 选中: 候选[2] -> D:\FinSightV9\.venv\Scripts\python.exe
[PathTrace] INFO  | === Python 解释器候选链 探测结束 ===
[PathTrace] DEBUG | 候选链探测耗时: 2ms (共 5 条路径)
```

### 4.4 无效驱动器容错示例

```
[PathTrace] DEBUG | RepoRoot = X:\NonExistent\Project
[PathTrace] DEBUG | EnvVenvPath = (null)
[PathTrace] DEBUG | IncludeSystemPath = False
[PathTrace] WARN  | 候选[1] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] WARN  | 候选[2] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] WARN  | 候选[3] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] WARN  | 候选[4] 构造失败: Cannot find drive. A drive with the name 'X' does not exist.
[PathTrace] INFO  | === Python 解释器候选链 探测开始 ===
[PathTrace] WARN  | 所有 0 级候选均未命中
[PathTrace] INFO  | === Python 解释器候选链 探测结束 ===
[PathTrace] DEBUG | 候选链探测耗时: 1ms (共 0 条路径)
```

---

## 5. 边界情况测试报告

### 5.1 测试结果汇总

| 测试项 | 输入 | v1.0.0 | v1.1.0 | 说明 |
|--------|------|--------|--------|------|
| 空字符串路径 | `@("", "", "")` | 崩溃 | PASS | `[AllowEmptyString()]` 修复 |
| 混合空与非空路径 | `@("", valid, "")` | 崩溃 | PASS | 空路径被跳过，有效路径命中 |
| 空数组 | `@()` | 崩溃 | PASS | `[AllowEmptyCollection()]` 修复 |
| 空消息 | `Write-PathTrace ""` | 崩溃 | PASS | `[AllowEmptyString()]` 修复 |
| 无效驱动器 | `X:\NonExistent` | 崩溃 | PASS | `Join-Path` try/catch 修复 |
| 含空格路径 | `D:\My Project\...` | PASS | PASS | 无需修复 |
| 含中文路径 | `C:\temp\测试目录` | PASS | PASS | 无需修复 |
| UNC 路径 | `\\Server\Share\...` | PASS | PASS | 无需修复 |
| 超长路径 (>260 字符) | `D:\AAA...A\python.exe` | PASS | PASS | Test-Path 返回 False，不崩溃 |
| null EnvVenvPath | `$null` | PASS | PASS | `[string]::IsNullOrEmpty` 处理 |
| 重复 Enable/Disable Debug | 连续调用 2 次 | PASS | PASS | 幂等操作 |
| 文件日志目录不存在 | `C:\temp\new\log.txt` | PASS | PASS | `New-Item -Force` 自动创建 |

### 5.2 修复详情

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

# 修复后: try/catch 捕获异常，输出 WARN 日志，跳过该候选
try {
    $c = Join-Path $RepoRoot $suffix -ErrorAction Stop
} catch {
    $c = $null
    Write-PathTrace "候选[$cIdx] 构造失败: $($_.Exception.Message)" -Level WARN
}
```

**修复 3: DEBUG 日志 typo**

```powershell
# 修复前: 多余的右括号
Write-PathTrace "EnvVenvPath = $(if($EnvVenvPath){$EnvVenvPath}else{'(null)'}))" -Level DEBUG
# 输出: EnvVenvPath = (null))

# 修复后
Write-PathTrace "EnvVenvPath = $(if($EnvVenvPath){$EnvVenvPath}else{'(null)'})" -Level DEBUG
# 输出: EnvVenvPath = (null)
```

---

## 6. 已知限制

| 限制 | 说明 | 影响 |
|------|------|------|
| 颜色输出 | 模块模式使用 `[Console]::WriteLine()`（无颜色），降级模式使用 `Write-Host`（有颜色） | 仅视觉差异，功能不受影响 |
| 文件日志并发 | 多进程同时写入同一日志文件可能产生交错 | 建议每个进程使用独立日志文件 |
| 长路径支持 | PS 5.1 的 `Test-Path` 对 >260 字符路径可能返回 False | Windows 系统限制，非模块问题 |
| .psd1 编码 | `New-ModuleManifest` 生成的 .psd1 在某些编辑器修改后可能编码异常 | 建议直接导入 .psm1 文件 |

---

## 7. 文件清单

| 文件 | 用途 |
|------|------|
| [PathTrace.psd1](file:///D:/FinSightV9/scripts/PathTrace.psd1) | PowerShell 模块清单（标准库格式） |
| [PathTrace.psm1](file:///D:/FinSightV9/scripts/PathTrace.psm1) | 模块代码（7 个导出函数） |
| [PathTrace-Usage.md](file:///D:/FinSightV9/scripts/PathTrace-Usage.md) | 使用文档 |
| [pathtrace-deployment-guide.md](file:///D:/FinSightV9/docs/guides/how-to/pathtrace-deployment-guide.md) | 部署配置指南（8 章节） |
| [windows-deploy-verify.ps1](file:///D:/FinSightV9/scripts/windows-deploy-verify.ps1) | 集成 PathTrace 的部署验证脚本 |
| [test-pathtrace-global.ps1](file:///D:/FinSightV9/scripts/test-pathtrace-global.ps1) | 全局安装测试（10 项） |
| [test-venv-path-resilience.ps1](file:///D:/FinSightV9/scripts/test-venv-path-resilience.ps1) | 路径变动韧性测试 |

---

## 8. 测试覆盖

| 测试套件 | 项数 | 结果 |
|----------|------|------|
| 全局安装测试 | 10 | 10/10 PASS |
| 降级回退测试 | 4 场景 | 4/4 PASS |
| DEBUG 模式测试 | 3 场景 | 3/3 PASS |
| 边界情况测试 | 14 项 | 14/14 PASS (v1.1.0 修复后) |
| windows-deploy-verify 集成 | 13 项 | 13/13 PASS |
