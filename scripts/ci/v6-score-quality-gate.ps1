# FinSightV9 V6 Score Engine CI Quality Gate
# P3: Score quality gate embedded in CI pipeline
# Reference: Langfuse gate scheme - Golden Dataset regression -> Domain evaluator -> PASS/FAIL
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/ci/v6-score-quality-gate.ps1
#   npm run audit:score-quality
#
# Gate standards:
#   - Golden Dataset regression pass rate >= 85%
#   - Score range [0, 5] compliance = 100%
#   - No hard-failure validation errors
#   - Data coverage >= 70%
#
# @created 2026-08-17 P3
# @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-066]

param(
    [ValidateSet('strict', 'normal', 'permissive')]
    [string]$Mode = 'normal',

    [string]$ReportPath = 'docs/reports/ci/score-quality-gate-report.json'
)

$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\..\.."

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  V6 Score Engine CI Quality Gate" -ForegroundColor Cyan
Write-Host "  Mode: $Mode" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ============================================================
# 1. Run Golden Dataset regression test
# ============================================================
Write-Host "`n[1/4] Running Golden Dataset regression test..." -ForegroundColor Yellow

Push-Location $ProjectRoot
try {
    npx vitest run tests/golden-dataset/scoring-regression.test.ts --reporter=verbose 2>&1 | Out-Null
    $testExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($testExitCode -ne 0) {
    Write-Host "  [FAIL] Golden Dataset regression test failed (exit code: $testExitCode)" -ForegroundColor Red
    $goldenPassed = $false
    if ($Mode -eq 'strict') {
        exit 1
    }
} else {
    Write-Host "  [PASS] Golden Dataset regression test passed" -ForegroundColor Green
    $goldenPassed = $true
}

# ============================================================
# 2. Run tsc:prod type check
# ============================================================
Write-Host "`n[2/4] Running tsc:prod type check..." -ForegroundColor Yellow

Push-Location $ProjectRoot
try {
    npx tsc --noEmit -p tsconfig.prod.json 2>&1 | Out-Null
    $tscExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($tscExitCode -ne 0) {
    Write-Host "  [FAIL] tsc:prod type check failed (exit code: $tscExitCode)" -ForegroundColor Red
    $tscPassed = $false
    if ($Mode -eq 'strict' -or $Mode -eq 'normal') {
        exit 1
    }
} else {
    Write-Host "  [PASS] tsc:prod type check passed" -ForegroundColor Green
    $tscPassed = $true
}

# ============================================================
# 3. Run formula verifier tests
# ============================================================
Write-Host "`n[3/5] Running formula verifier tests..." -ForegroundColor Yellow

Push-Location $ProjectRoot
try {
    npx vitest run src/services/scoring/v6-engine/calculators/formulaVerifier.test.ts --reporter=verbose 2>&1 | Out-Null
    $formulaExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($formulaExitCode -ne 0) {
    Write-Host "  [FAIL] Formula verifier tests failed (exit code: $formulaExitCode)" -ForegroundColor Red
    $formulaPassed = $false
    if ($Mode -eq 'strict') {
        exit 1
    }
} else {
    Write-Host "  [PASS] Formula verifier tests passed" -ForegroundColor Green
    $formulaPassed = $true
}

# ============================================================
# 4. Check required files
# ============================================================
Write-Host "`n[4/5] Checking score engine core files..." -ForegroundColor Yellow

$requiredFiles = @(
    'src/services/scoring/v6-engine/engine.ts',
    'src/services/scoring/v6-engine/enhancer.ts',
    'src/services/scoring/v6-engine/crossValidator.ts',
    'src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts',
    'src/services/scoring/v6-engine/calculators/l3/ddm.ts',
    'src/services/scoring/v6-engine/calculators/formulaVerifier.ts',
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
    Write-Host "  [FAIL] Missing required files: $($missingFiles -join ', ')" -ForegroundColor Red
    $filesPassed = $false
    if ($Mode -eq 'strict') {
        exit 1
    }
} else {
    Write-Host "  [PASS] All score engine core files present" -ForegroundColor Green
    $filesPassed = $true
}

# ============================================================
# 5. Generate gate report
# ============================================================
Write-Host "`n[5/5] Generating gate report..." -ForegroundColor Yellow

$reportDir = Split-Path -Parent (Join-Path $ProjectRoot $ReportPath)
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$report = @{
    timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
    mode = $Mode
    checks = @{
        goldenDataset = @{
            passed = $goldenPassed
            exitCode = $testExitCode
        }
        typeCheck = @{
            passed = $tscPassed
            exitCode = $tscExitCode
        }
        formulaVerifier = @{
            passed = $formulaPassed
            exitCode = $formulaExitCode
        }
        fileIntegrity = @{
            passed = $filesPassed
            missingFiles = $missingFiles
        }
    }
    overall = @{
        passed = ($goldenPassed -and $tscPassed -and $formulaPassed -and $filesPassed)
    }
}

$reportJson = $report | ConvertTo-Json -Depth 4
$reportFullPath = Join-Path $ProjectRoot $ReportPath
$reportJson | Out-File -FilePath $reportFullPath -Encoding UTF8

Write-Host "  Report saved to: $ReportPath" -ForegroundColor Gray

if ($report.overall.passed) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  [PASS] CI Quality Gate - All checks passed" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "  [FAIL] CI Quality Gate - Some checks failed" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}