# test-pathtrace-global.ps1 - 验证 PathTrace 模块全局安装后任意目录可用
# 测试流程:
#   1. 将 PathTrace 模块复制到 $HOME\Documents\WindowsPowerShell\Modules\PathTrace\
#   2. 在子进程中从不同目录 (C:\, $env:TEMP) 调用 Import-Module PathTrace
#   3. 验证 Find-PythonExe 可正常工作
#   4. 清理全局安装

$ErrorActionPreference = "Continue"
$script:pass = 0; $script:fail = 0; $script:skip = 0

function Check($name, $result, $isSkip=$false) {
    if ($isSkip) { Write-Host "[SKIP] $name"; $script:skip++; return }
    if ($result) { Write-Host "[PASS] $name"; $script:pass++ } else { Write-Host "[FAIL] $name"; $script:fail++ }
}

Write-Host "============================================="
Write-Host "  PathTrace 模块全局安装测试"
Write-Host "============================================="
Write-Host ""

# ====== 1. 准备模块文件 ======
Write-Host "--- 1. 准备模块文件 ---"
$srcDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($srcDir)) { $srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

$psm1 = Join-Path $srcDir "PathTrace.psm1"
$psd1 = Join-Path $srcDir "PathTrace.psd1"
Check "PathTrace.psm1 存在" (Test-Path $psm1)
Check "PathTrace.psd1 存在" (Test-Path $psd1)

if (-not (Test-Path $psm1) -or -not (Test-Path $psd1)) {
    Write-Host "模块文件缺失，无法继续" -ForegroundColor Red
    exit 1
}

# ====== 2. 全局安装 ======
Write-Host ""
Write-Host "--- 2. 全局安装到 PSModulePath ---"
$globalModuleDir = Join-Path $HOME "Documents\WindowsPowerShell\Modules\PathTrace"

# 清理旧安装
if (Test-Path $globalModuleDir) {
    Remove-Item $globalModuleDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  清理旧安装"
}

New-Item -ItemType Directory -Path $globalModuleDir -Force | Out-Null
Copy-Item $psm1 -Destination $globalModuleDir -Force
Copy-Item $psd1 -Destination $globalModuleDir -Force
Check "模块文件已复制到 $globalModuleDir" (Test-Path (Join-Path $globalModuleDir "PathTrace.psd1"))

# ====== 3. 验证 Get-Module -ListAvailable ======
Write-Host ""
Write-Host "--- 3. Get-Module -ListAvailable 可发现模块 ---"
$available = Get-Module -ListAvailable -Name PathTrace
Check "Get-Module -ListAvailable PathTrace" ($null -ne $available)
if ($available) {
    Write-Host "       Name: $($available.Name)  Version: $($available.Version)"
}

# ====== 4. 从 C:\ 目录调用 ======
Write-Host ""
Write-Host "--- 4. 从 C:\ 目录调用 (子进程) ---"
$testScript = @"
Import-Module PathTrace -Force
Write-PathTrace '从 C:\ 目录调用测试' -Level OK
`$py = Find-PythonExe -RepoRoot 'D:\FinSightV9'
if (`$py) {
    Write-PathTrace "Python 命中: `$py" -Level OK
    Write-Output "RESULT:PASS|$py"
} else {
    Write-PathTrace 'Python 未找到' -Level ERR
    Write-Output 'RESULT:FAIL|'
}
"@

$tmpTest = "$env:TEMP\test-pathtrace-global-call.ps1"
[System.IO.File]::WriteAllText($tmpTest, $testScript, (New-Object System.Text.UTF8Encoding($true)))

# 从 C:\ 运行
$result1 = & powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location C:\; & '$tmpTest'" 2>&1 | Out-String
$match1 = [regex]::Match($result1, "RESULT:(PASS|FAIL)\|(.*)")
if ($match1.Success -and $match1.Groups[1].Value -eq "PASS") {
    Check "从 C:\ 调用 Find-PythonExe" $true
    Write-Host "       返回: $($match1.Groups[2].Value)"
} else {
    Check "从 C:\ 调用 Find-PythonExe" $false
    Write-Host "       输出: $($result1.Substring(0, [Math]::Min(100, $result1.Length)))"
}

# ====== 5. 从 TEMP 目录调用 ======
Write-Host ""
Write-Host "--- 5. 从 $env:TEMP 目录调用 (子进程) ---"
$result2 = & powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location '$env:TEMP'; & '$tmpTest'" 2>&1 | Out-String
$match2 = [regex]::Match($result2, "RESULT:(PASS|FAIL)\|(.*)")
if ($match2.Success -and $match2.Groups[1].Value -eq "PASS") {
    Check "从 TEMP 调用 Find-PythonExe" $true
    Write-Host "       返回: $($match2.Groups[2].Value)"
} else {
    Check "从 TEMP 调用 Find-PythonExe" $false
    Write-Host "       输出: $($result2.Substring(0, [Math]::Min(100, $result2.Length)))"
}

# ====== 6. 验证不带 -Force 的常规导入 ======
Write-Host ""
Write-Host "--- 6. 常规导入 (不带 -Force) ---"
$result3 = & powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location C:\; Import-Module PathTrace -ErrorAction SilentlyContinue; if (Get-Command Write-PathTrace -ErrorAction SilentlyContinue) { 'CMD_FOUND' } else { 'CMD_NOT_FOUND' }" 2>&1 | Out-String
Check "常规导入后 Write-PathTrace 可用" ($result3 -match "CMD_FOUND")
if ($result3 -match "CMD_FOUND") {
    Write-Host "       Write-PathTrace 可用 (模块导入成功)"
}

# ====== 7. 验证 FIN_SIGHT_VENV_PATH 传递 ======
Write-Host ""
Write-Host "--- 7. 环境变量传递测试 ---"
$envTest = @"
Import-Module PathTrace -Force
`$py = Find-PythonExe -RepoRoot 'D:\FinSightV9' -EnvVenvPath 'D:\FinSightV9\.venv'
Write-Output "ENV_RESULT:|`$py"
"@
$tmpEnvTest = "$env:TEMP\test-pathtrace-env.ps1"
[System.IO.File]::WriteAllText($tmpEnvTest, $envTest, (New-Object System.Text.UTF8Encoding($true)))

$result4 = & powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location C:\; & '$tmpEnvTest'" 2>&1 | Out-String
$match4 = [regex]::Match($result4, "ENV_RESULT:\|(.*)")
if ($match4.Success -and $match4.Groups[1].Value -match "python\.exe") {
    Check "环境变量参数正确传递" $true
    Write-Host "       返回: $($match4.Groups[1].Value)"
} else {
    Check "环境变量参数正确传递" $false
}

# ====== 8. 清理 ======
Write-Host ""
Write-Host "--- 8. 清理全局安装 ---"
Remove-Item $globalModuleDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $tmpTest -Force -ErrorAction SilentlyContinue
Remove-Item $tmpEnvTest -Force -ErrorAction SilentlyContinue
Check "全局模块已清理" (-not (Test-Path $globalModuleDir))

# 验证清理后不可导入（使用全新 NoProfile 进程，避免缓存）
$result5 = & powershell -NoProfile -ExecutionPolicy Bypass -Command "Import-Module PathTrace -ErrorAction SilentlyContinue; if (Get-Command Write-PathTrace -ErrorAction SilentlyContinue) { 'STILL_AVAILABLE' } else { 'NOT_AVAILABLE' }" 2>&1 | Out-String
Check "清理后模块不可导入" ($result5 -match "NOT_AVAILABLE")

# ====== 9. 边界情况: 空字符串路径 ======
Write-Host ""
Write-Host "--- 9. 边界情况: 空字符串路径 ---"
# 重新导入模块用于边界测试
Remove-Module PathTrace -ErrorAction SilentlyContinue
Import-Module "D:\FinSightV9\scripts\PathTrace.psm1" -Force
Enable-PathTraceDebug

$r_edge1 = Test-PathChain -Paths @("", "", "") -Label "空路径测试"
Check "空字符串路径数组返回 null" ($null -eq $r_edge1)

# ====== 10. 边界情况: 混合空与非空路径 ======
Write-Host ""
Write-Host "--- 10. 边界情况: 混合空与非空路径 ---"
$r_edge2 = Test-PathChain -Paths @("", "D:\FinSightV9\.venv\Scripts\python.exe", "") -Label "混合路径"
Check "混合数组跳过空路径并命中" ($r_edge2 -match "python\.exe")

# ====== 11. 边界情况: 空数组 ======
Write-Host ""
Write-Host "--- 11. 边界情况: 空数组 ---"
$r_edge3 = Test-PathChain -Paths @() -Label "空数组"
Check "空数组不崩溃 (返回 null)" ($null -eq $r_edge3)

# ====== 12. 边界情况: 空消息 ======
Write-Host ""
Write-Host "--- 12. 边界情况: 空消息 ---"
try {
    Write-PathTrace "" -Level INFO
    Check "空消息不崩溃" $true
} catch {
    Check "空消息不崩溃" $false
}

# ====== 13. 边界情况: 无效驱动器 ======
Write-Host ""
Write-Host "--- 13. 边界情况: 无效驱动器 ---"
$r_edge5 = Find-PythonExe -RepoRoot "X:\NonExistent\Project" -IncludeSystemPath:$false
Check "无效驱动器不崩溃 (返回 null)" ($null -eq $r_edge5)

# ====== 14. 边界情况: 正常路径仍工作 ======
Write-Host ""
Write-Host "--- 14. 边界情况: 正常路径仍工作 (回归验证) ---"
Disable-PathTraceDebug
$r_edge6 = Find-PythonExe -RepoRoot "D:\FinSightV9"
Check "正常路径仍命中" ($r_edge6 -match "python\.exe")

# ====== 汇总 ======
Write-Host ""
Write-Host "============================================="
Write-Host "  PASS: $($script:pass)  FAIL: $($script:fail)  SKIP: $($script:skip)"
$total = $script:pass + $script:fail + $script:skip
Write-Host "  TOTAL: $total"
if ($script:fail -eq 0) {
    Write-Host "  结果: 全部通过" -ForegroundColor Green
} else {
    Write-Host "  结果: $($script:fail) 项失败" -ForegroundColor Red
}
Write-Host "============================================="
