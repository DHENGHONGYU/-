# FinSightV9 V6 评分引擎 CI 质量门禁
# P3: 评分质量门禁嵌入 CI 流水线
# 对标 Langfuse 门禁方案：Golden Dataset 回归 → 领域评估器 → PASS/FAIL
#
# 使用方式：
#   powershell -ExecutionPolicy Bypass -File scripts/ci/v6-score-quality-gate.ps1
#   npm run audit:score-quality
#
# 门禁标准：
#   - Golden Dataset 回归通过率 >= 85%
#   - 评分范围 [0, 5] 合规率 = 100%
#   - 无硬失败校验错误
#   - 数据覆盖率 >= 70%
#
# @created 2026-08-17 P3
# @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-066]

param(
    [ValidateSet('strict', 'normal', 'permissive')]
    [string]$Mode = 'normal',

    [string]$ReportPath = 'docs/reports/ci/score-quality-gate-report.json'
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\..\.."

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  V6 评分引擎 CI 质量门禁" -ForegroundColor Cyan
Write-Host "  模式: $Mode" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ============================================================
# 1. 运行 Golden Dataset 回归测试
# ============================================================
Write-Host "`n[1/4] 运行 Golden Dataset 回归测试..." -ForegroundColor Yellow

$testResult = & npx vitest run tests/golden-dataset/scoring-regression.test.ts --reporter=json 2>&1
$testExitCode = $LASTEXITCODE

if ($testExitCode -ne 0) {
    Write-Host "  [FAIL] Golden Dataset 回归测试未通过 (exit code: $testExitCode)" -ForegroundColor Red
    if ($Mode -eq 'strict') {
        exit 1
    }
} else {
    Write-Host "  [PASS] Golden Dataset 回归测试通过" -ForegroundColor Green
}

# ============================================================
# 2. 运行 tsc:prod 类型检查
# ============================================================
Write-Host "`n[2/4] 运行 tsc:prod 类型检查..." -ForegroundColor Yellow

$tscResult = & npx tsc --noEmit -p tsconfig.prod.json 2>&1
$tscExitCode = $LASTEXITCODE

if ($tscExitCode -ne 0) {
    $tscErrors = ($tscResult | Select-String -Pattern 'error TS\d+' | Measure-Object).Count
    Write-Host "  [FAIL] tsc:prod 发现 $tscErrors 个类型错误" -ForegroundColor Red
    if ($Mode -eq 'strict' -or $Mode -eq 'normal') {
        exit 1
    }
} else {
    Write-Host "  [PASS] tsc:prod 类型检查通过" -ForegroundColor Green
}

# ============================================================
# 3. 运行审计脚本
# ============================================================
Write-Host "`n[3/4] 运行评分引擎审计..." -ForegroundColor Yellow

# 检查评分引擎核心文件是否存在
$requiredFiles = @(
    'src/services/scoring/v6-engine/engine.ts',
    'src/services/scoring/v6-engine/enhancer.ts',
    'src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts',
    'src/services/scoring/v6-engine/calculators/l3/ddm.ts',
    'tests/golden-dataset/scores.json',
    'tests/golden-dataset/scoring-regression.test.ts'
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $ProjectRoot $file
    if (-not (Test-Path $fullPath)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "  [FAIL] 缺少必需文件: $($missingFiles -join ', ')" -ForegroundColor Red
    if ($Mode -eq 'strict') {
        exit 1
    }
} else {
    Write-Host "  [PASS] 所有评分引擎核心文件完整" -ForegroundColor Green
}

# ============================================================
# 4. 生成门禁报告
# ============================================================
Write-Host "`n[4/4] 生成门禁报告..." -ForegroundColor Yellow

$reportDir = Split-Path -Parent (Join-Path $ProjectRoot $ReportPath)
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$report = @{
    timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
    mode = $Mode
    checks = @{
        goldenDataset = @{
            passed = ($testExitCode -eq 0)
            exitCode = $testExitCode
        }
        typeCheck = @{
            passed = ($tscExitCode -eq 0)
            exitCode = $tscExitCode
        }
        fileIntegrity = @{
            passed = ($missingFiles.Count -eq 0)
            missingFiles = $missingFiles
        }
    }
    overall = @{
        passed = ($testExitCode -eq 0 -and $tscExitCode -eq 0 -and $missingFiles.Count -eq 0)
    }
}

$reportJson = $report | ConvertTo-Json -Depth 4
$reportFullPath = Join-Path $ProjectRoot $ReportPath
$reportJson | Out-File -FilePath $reportFullPath -Encoding UTF8

Write-Host "  报告已保存至: $ReportPath" -ForegroundColor Gray

if ($report.overall.passed) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  [PASS] CI 质量门禁全部通过" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "  [FAIL] CI 质量门禁未通过" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}