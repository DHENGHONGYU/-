# ============================================================
# 数据链覆盖度缺口修复 — 分级回归测试执行脚本 (L1-L5)
#
# 用法:
#   .\scripts\test\run-gapfix-regression.ps1                # 默认 L1
#   .\scripts\test\run-gapfix-regression.ps1 -Level L1      # 新增4个测试文件
#   .\scripts\test\run-gapfix-regression.ps1 -Level L2      # 采集域现有 spec
#   .\scripts\test\run-gapfix-regression.ps1 -Level L3      # 全仓单元测试
#   .\scripts\test\run-gapfix-regression.ps1 -Level L4      # E2E 指引(手动)
#   .\scripts\test\run-gapfix-regression.ps1 -Level L5      # 生产验证指引(手动)
#   .\scripts\test\run-gapfix-regression.ps1 -Level L1 -Report  # 生成 Markdown 报告
#
# 回归范围与准入标准见: docs/reports/data-chain-coverage-gap-fix-plan.md §6
# ============================================================

param(
    [ValidateSet('L1', 'L2', 'L3', 'L4', 'L5', 'All')]
    [string]$Level = 'L1',
    [switch]$Report
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
Set-Location $ProjectRoot

# ── L1: 新增的 4 个缺口修复测试文件 ─────────────────────────
$L1Files = @(
    "tests/fallback-chain-unit.test.ts",
    "tests/quality-metrics-alerts.test.ts",
    "tests/hot-sector-timeliness.test.ts",
    "tests/refresh-coordinator-integration.test.ts"
)

# ── L2: 采集域现有 spec 集合 ────────────────────────────────
$L2Files = @(
    "tests/__tests__/services/adaptiveSourceOrchestrator.spec.ts",
    "tests/__tests__/services/mockFallbackPolicy.spec.ts"
)

# ── 工具函数 ────────────────────────────────────────────────

function Remove-AnsiCodes {
    param([string]$Text)
    $esc = [char]27
    return ($Text -replace "$esc\[[0-9;]*m", "")
}

function Test-FileExists {
    param([string]$RelPath)
    return (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelPath))
}

function Invoke-VitestSuite {
    param(
        [string[]]$Files,
        [string]$Label
    )
    Write-Host "`n[$Label] 执行 vitest run $($Files.Count) 个文件..." -ForegroundColor Yellow

    # 前置存在性检查
    $missing = @()
    foreach ($f in $Files) {
        if (-not (Test-FileExists $f)) { $missing += $f }
    }
    if ($missing.Count -gt 0) {
        foreach ($m in $missing) { Write-Host "  [MISSING] $m" -ForegroundColor Red }
        return @{ ExitCode = 2; Total = 0; Passed = 0; Failed = 0; FilesTotal = 0; FilesPassed = 0; FilesFailed = 0; Missing = $missing; Output = "" }
    }
    foreach ($f in $Files) { Write-Host "  [OK] $f" -ForegroundColor Green }

    # 执行 vitest（输出缓冲后统一解析）
    $output = (& npx vitest run @Files 2>&1 | Out-String)
    $exitCode = $LASTEXITCODE
    $clean = Remove-AnsiCodes -Text $output

    # 解析汇总行（兼容 "X failed | Y passed (Z)" 与 "Y passed (Z)" 两种格式）
    $lines = $clean -split "`r?`n"
    $testsLine = ($lines | Where-Object { $_ -match '^\s*Tests\s+\d' } | Select-Object -Last 1)
    $filesLine = ($lines | Where-Object { $_ -match '^\s*Test Files\s+\d' } | Select-Object -Last 1)

    $failed = 0; $passed = 0; $total = 0
    if ($testsLine) {
        if ($testsLine -match '^\s*Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed\s*\((\d+)\)') {
            $failed = [int]$Matches[1]; $passed = [int]$Matches[2]; $total = [int]$Matches[3]
        } elseif ($testsLine -match '^\s*Tests\s+(\d+)\s+passed\s*\((\d+)\)') {
            $passed = [int]$Matches[1]; $total = [int]$Matches[2]
        }
    }
    $filesFailed = 0; $filesPassed = 0; $filesTotal = 0
    if ($filesLine) {
        if ($filesLine -match '^\s*Test Files\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed\s*\((\d+)\)') {
            $filesFailed = [int]$Matches[1]; $filesPassed = [int]$Matches[2]; $filesTotal = [int]$Matches[3]
        } elseif ($filesLine -match '^\s*Test Files\s+(\d+)\s+passed\s*\((\d+)\)') {
            $filesPassed = [int]$Matches[1]; $filesTotal = [int]$Matches[2]
        }
    }

    # 打印 vitest 尾部输出（摘要部分）
    $tailLines = ($lines | Where-Object { $_ -ne "" } | Select-Object -Last 8)
    foreach ($tl in $tailLines) { Write-Host "  $tl" -ForegroundColor DarkGray }

    return @{
        ExitCode     = $exitCode
        Total        = $total
        Passed       = $passed
        Failed       = $failed
        FilesTotal   = $filesTotal
        FilesPassed  = $filesPassed
        FilesFailed  = $filesFailed
        Missing      = @()
        Output       = $clean
    }
}

# ── 报告函数 ────────────────────────────────────────────────

function Write-MarkdownReport {
    param(
        [string]$Level,
        [hashtable]$Result,
        [bool]$AdmissionPassed,
        [string]$Detail
    )
    $reportDir = Join-Path $ProjectRoot "outputs"
    if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir | Out-Null }
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $reportPath = Join-Path $reportDir "gapfix-regression-$($Level.ToLower())-$ts.md"

    $passRate = 0
    if ($Result.Total -gt 0) { $passRate = [math]::Round($Result.Passed / $Result.Total * 100, 1) }

    $md = @()
    $md += "# GapFix 回归测试报告 — $Level"
    $md += ""
    $md += "- 执行时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $md += "- 测试文件: $($Result.FilesPassed)/$($Result.FilesTotal) 通过"
    $md += "- 用例统计: $($Result.Passed) passed / $($Result.Failed) failed / $($Result.Total) total (通过率 $passRate%)"
    $md += "- 准入判定: $(if ($AdmissionPassed) { 'PASS' } else { 'FAIL' })"
    $md += ""
    $md += "## 准入条件详情"
    $md += ""
    $md += $Detail
    $md | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Host "`n[Report] 报告已生成: $reportPath" -ForegroundColor Cyan
}

# ── 主流程 ─────────────────────────────────────────────────

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  GapFix 分级回归测试  Level=$Level" -ForegroundColor Cyan
Write-Host "  执行时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$script:ExitCode = 0

# ── L1: 新增 4 个测试文件（缺口修复用例）─────────────────────
if ($Level -eq 'L1' -or $Level -eq 'All') {
    $r = Invoke-VitestSuite -Files $L1Files -Label "L1-新增缺口用例"
    $admission = ($r.Failed -eq 0 -and $r.Total -gt 0 -and $r.ExitCode -eq 0)
    $detail = "准入条件: 全部用例通过 (failed=0)。实际: $($r.Failed) failed / $($r.Total) total。"

    Write-Host "`n[L1 准入检查]" -ForegroundColor Yellow
    if ($admission) {
        Write-Host "  PASS — $($r.Passed)/$($r.Total) 全部通过" -ForegroundColor Green
    } else {
        Write-Host "  FAIL — $($r.Failed) failed / $($r.Total) total (exitCode=$($r.ExitCode))" -ForegroundColor Red
        $script:ExitCode = 1
    }

    if ($Report) { Write-MarkdownReport -Level "L1" -Result $r -AdmissionPassed $admission -Detail $detail }
}

# ── L2: 采集域现有 spec（不允许新增失败）────────────────────
if ($Level -eq 'L2' -or $Level -eq 'All') {
    $r = Invoke-VitestSuite -Files $L2Files -Label "L2-采集域现有spec"
    $admission = ($r.Failed -eq 0 -and $r.ExitCode -eq 0)
    $detail = "准入条件: 新增测试不导致现有采集域测试失败。实际: $($r.Failed) failed / $($r.Total) total。"

    Write-Host "`n[L2 准入检查]" -ForegroundColor Yellow
    if ($admission) {
        Write-Host "  PASS — 采集域 spec $($r.Passed)/$($r.Total) 通过，无新增失败" -ForegroundColor Green
    } else {
        Write-Host "  FAIL — $($r.Failed) failed (exitCode=$($r.ExitCode))，需与基线对比确认是否为存量失败" -ForegroundColor Red
        $script:ExitCode = 1
    }

    if ($Report) { Write-MarkdownReport -Level "L2" -Result $r -AdmissionPassed $admission -Detail $detail }
}

# ── L3: 全仓单元测试（通过率 >= 98%）───────────────────────
if ($Level -eq 'L3' -or $Level -eq 'All') {
    Write-Host "`n[L3-全仓单元测试] 执行 npm run test（预计 ~8 分钟）..." -ForegroundColor Yellow
    $output = (& npm run test 2>&1 | Out-String)
    $exitCode = $LASTEXITCODE
    $clean = Remove-AnsiCodes -Text $output
    $lines = $clean -split "`r?`n"
    $testsLine = ($lines | Where-Object { $_ -match '^\s*Tests\s+\d' } | Select-Object -Last 1)

    $failed = 0; $passed = 0; $total = 0
    if ($testsLine) {
        if ($testsLine -match '^\s*Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed\s*\((\d+)\)') {
            $failed = [int]$Matches[1]; $passed = [int]$Matches[2]; $total = [int]$Matches[3]
        } elseif ($testsLine -match '^\s*Tests\s+(\d+)\s+passed\s*\((\d+)\)') {
            $passed = [int]$Matches[1]; $total = [int]$Matches[2]
        }
    }
    $passRate = 0
    if ($total -gt 0) { $passRate = [math]::Round($passed / $total * 100, 1) }
    $admission = ($passRate -ge 98)
    $detail = "准入条件: 全仓单元测试通过率 >= 98%。实际: $passRate% ($passed/$total)。"

    Write-Host "  统计: $passed passed / $failed failed / $total total (通过率 $passRate%)"
    Write-Host "`n[L3 准入检查]" -ForegroundColor Yellow
    if ($admission) {
        Write-Host "  PASS — 通过率 $passRate% >= 98%" -ForegroundColor Green
    } else {
        Write-Host "  FAIL — 通过率 $passRate% < 98%" -ForegroundColor Red
        $script:ExitCode = 1
    }

    if ($Report) {
        $r = @{ ExitCode = $exitCode; Total = $total; Passed = $passed; Failed = $failed; FilesTotal = 0; FilesPassed = 0; FilesFailed = 0; Missing = @(); Output = $clean }
        Write-MarkdownReport -Level "L3" -Result $r -AdmissionPassed $admission -Detail $detail
    }
}

# ── L4: E2E 输入舱测试（手动 + Playwright 指引）─────────────
if ($Level -eq 'L4' -or $Level -eq 'All') {
    Write-Host "`n[L4-E2E输入舱测试] 手动执行指引:" -ForegroundColor Yellow
    Write-Host "  1. npm run dev 启动前端，打开输入舱测试看板 (InputTestDashboard)" -ForegroundColor Gray
    Write-Host "  2. 依次点击 13 个 UI 按钮，确认全部可点击且有响应（无控制台异常）" -ForegroundColor Gray
    Write-Host "  3. 可选: npx playwright test e2e/input-stock-pool.spec.ts e2e/sector-stocks.spec.ts" -ForegroundColor Gray
    Write-Host "  准入: 13个UI按钮全部可点击有响应，无控制台异常（人工判定）" -ForegroundColor Gray
    Write-Host "  注: L4 为手动层级，脚本不做自动判定" -ForegroundColor DarkGray
}

# ── L5: 生产数据验证（手动指引）─────────────────────────────
if ($Level -eq 'L5' -or $Level -eq 'All') {
    Write-Host "`n[L5-生产数据验证] 手动执行指引:" -ForegroundColor Yellow
    Write-Host "  1. 启动 Python 侧car（AkShare/腾讯源），前端触发一次完整采集" -ForegroundColor Gray
    Write-Host "  2. 观察质量面板 20 分钟，逐项核对:" -ForegroundColor Gray
    Write-Host "     (a) fallbackCount >= 0 恒非负（Math.max 修复验证）" -ForegroundColor Gray
    Write-Host "     (b) 告警在真实数据下不恒空/不恒报" -ForegroundColor Gray
    Write-Host "     (c) 板块 scoreDate 为当日时 timely=true" -ForegroundColor Gray
    Write-Host "  准入: 上述三项观测全部满足（人工判定）" -ForegroundColor Gray
    Write-Host "  注: L5 为手动层级，脚本不做自动判定" -ForegroundColor DarkGray
}

# ── 退出 ────────────────────────────────────────────────────
Write-Host "`n============================================================" -ForegroundColor Cyan
if ($script:ExitCode -eq 0) {
    Write-Host "  结果: Level=$Level 全部自动准入检查通过" -ForegroundColor Green
} else {
    Write-Host "  结果: Level=$Level 存在准入失败项，详见上方日志" -ForegroundColor Red
}
Write-Host "============================================================" -ForegroundColor Cyan
exit $script:ExitCode
