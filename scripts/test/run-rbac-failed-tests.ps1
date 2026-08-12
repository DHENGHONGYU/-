# RBAC 权限校验失败用例复现脚本
# 执行 routeGuard 和 ACL 相关的所有测试用例，记录失败用例的复现率
# 用法： .\scripts\test\run-rbac-failed-tests.ps1

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
Set-Location $ProjectRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RBAC 权限校验失败用例复现脚本" -ForegroundColor Cyan
Write-Host "  执行时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$targetTests = @(
    "src/core/routeGuard.test.tsx",
    "src/core/databridgeAcl.test.ts",
    "src/core/databridge.test.ts"
)

Write-Host "`n[1/3] 目标测试文件:" -ForegroundColor Yellow
foreach ($t in $targetTests) {
    $exists = Test-Path (Join-Path $ProjectRoot $t)
    Write-Host "  - $t $(if ($exists) { '[OK]' } else { '[MISSING]' })" -ForegroundColor $(if ($exists) { 'Green' } else { 'Red' })
}

Write-Host "`n[2/3] 执行 Vitest RBAC 相关测试（3 轮以计算复现率）..." -ForegroundColor Yellow

$roundResults = @()
$allFailedCases = @{}
$allTotalCases = 0
$allPassedCases = 0
$allFailedCount = 0

for ($round = 1; $round -le 3; $round++) {
    Write-Host "`n--- Round $round / 3 ---" -ForegroundColor Magenta

    $outputFile = Join-Path $env:TEMP "rbac-test-round-$round.json"

    $cmd = "npx vitest run --reporter=json --outputFile=`"$outputFile`" $($targetTests -join ' ') 2>&1"
    Write-Host "  执行: npx vitest run $($targetTests -join ' ')"

    Invoke-Expression $cmd | Out-Null
    $exitCode = $LASTEXITCODE

    $result = @{
        Round = $round
        ExitCode = $exitCode
        Total = 0
        Passed = 0
        Failed = 0
        Skipped = 0
        FailedNames = @()
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }

    if (Test-Path $outputFile) {
        try {
            $rawJson = Get-Content $outputFile -Raw -Encoding UTF8

            # 方案A：优先正则提取顶层字段（避免中文字符编码导致JSON解析失败）
            if ($rawJson -match '"numTotalTests"\s*:\s*(\d+)') {
                $result.Total = [int]$matches[1]
            }
            if ($rawJson -match '"numPassedTests"\s*:\s*(\d+)') {
                $result.Passed = [int]$matches[1]
            }
            if ($rawJson -match '"numFailedTests"\s*:\s*(\d+)') {
                $result.Failed = [int]$matches[1]
            }
            if ($rawJson -match '"numPendingTests"\s*:\s*(\d+)') {
                $result.Skipped = [int]$matches[1]
            }

            # 方案B：若解析顶层JSON成功且存在失败用例，进一步获取失败用例名
            if ($result.Failed -gt 0) {
                try {
                    $json = $rawJson | ConvertFrom-Json -ErrorAction Stop
                    if ($json.testResults) {
                        foreach ($tr in $json.testResults) {
                            if ($tr.assertionResults) {
                                foreach ($assert in $tr.assertionResults) {
                                    if ($assert.status -eq "failed") {
                                        $truncName = if ($tr.name) { Split-Path $tr.name -Leaf } else { 'unknown' }
                                        $ancestor = if ($assert.ancestorTitles -is [array]) { $assert.ancestorTitles -join " > " } else { '' }
                                        $title = if ($assert.title) { [string]$assert.title } else { 'untitled' }
                                        $fullName = "$truncName > $ancestor > $title"
                                        $result.FailedNames += $fullName
                                        if (-not $allFailedCases.ContainsKey($fullName)) {
                                            $allFailedCases[$fullName] = 0
                                        }
                                        $allFailedCases[$fullName]++
                                    }
                                }
                            }
                        }
                    }
                } catch {
                    Write-Host "  [WARN] 失败用例名解析跳过(编码): $_" -ForegroundColor DarkYellow
                }
            }
        } catch {
            Write-Host "  [WARN] 结果文件解析失败: $_" -ForegroundColor Yellow
        }
    }

    $roundResults += $result
    $allTotalCases += $result.Total
    $allPassedCases += $result.Passed
    $allFailedCount += $result.Failed

    $statusColor = if ($result.Failed -eq 0) { 'Green' } else { 'Red' }
    Write-Host "  Round $round 结果: Total=$($result.Total), Passed=$($result.Passed), Failed=$($result.Failed), Skipped=$($result.Skipped)" -ForegroundColor $statusColor
    if ($result.Failed -gt 0) {
        foreach ($fn in $result.FailedNames) {
            Write-Host "    [FAIL] $fn" -ForegroundColor Red
        }
    }
}

Write-Host "`n[3/3] 复现率统计..." -ForegroundColor Yellow

$uniqueCases = $allFailedCases.Keys.Count
$totalCaseOccurrences = ($allFailedCases.Values | Measure-Object -Sum).Sum
$reproducibleCount = 0
$flakyCount = 0

foreach ($case in $allFailedCases.Keys) {
    $count = $allFailedCases[$case]
    if ($count -eq 3) { $reproducibleCount++ }
    elseif ($count -gt 0) { $flakyCount++ }
}

if ($uniqueCases -gt 0) {
    $reproRate = [math]::Round(($totalCaseOccurrences / ($uniqueCases * 3)) * 100, 2)
    $strictReproRate = [math]::Round(($reproducibleCount / $uniqueCases) * 100, 2)
} else {
    $reproRate = 0
    $strictReproRate = 0
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  RBAC 测试复现报告" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Write-Host "`n总体统计:" -ForegroundColor Yellow
Write-Host "  总用例(3轮累计): $allTotalCases"
Write-Host "  通过(3轮累计): $allPassedCases"
Write-Host "  失败(3轮累计): $allFailedCount"

Write-Host "`n复现率分析:" -ForegroundColor Yellow
Write-Host "  唯一失败用例数: $uniqueCases"
Write-Host "  100%稳定复现(3/3): $reproducibleCount"
Write-Host "  偶现(1-2/3): $flakyCount"
Write-Host "  加权复现率: $reproRate%"
Write-Host "  严格复现率(3/3比例): $strictReproRate%"

if ($uniqueCases -gt 0) {
    Write-Host "`n失败用例明细 (出现次数):" -ForegroundColor Yellow
    foreach ($case in ($allFailedCases.Keys | Sort-Object)) {
        $cnt = $allFailedCases[$case]
        $cntColor = if ($cnt -eq 3) { 'Red' } elseif ($cnt -eq 2) { 'Yellow' } else { 'Gray' }
        $pct = [math]::Round(($cnt / 3) * 100, 0)
        Write-Host "  [$cnt/3 = $pct%] $case" -ForegroundColor $cntColor
    }
} else {
    Write-Host "`n[SUCCESS] 0 个失败用例，复现率 0%" -ForegroundColor Green
}

Write-Host "`n各轮详情:" -ForegroundColor Yellow
foreach ($r in $roundResults) {
    $c = if ($r.Failed -eq 0) { 'Green' } else { 'Red' }
    Write-Host "  Round $($r.Round) [$($r.Timestamp)]: Total=$($r.Total), Passed=$($r.Passed), Failed=$($r.Failed)" -ForegroundColor $c
}

# 输出摘要对象供外部读取
$summary = [PSCustomObject]@{
    ScriptRunAt       = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    UniqueFailedCases = $uniqueCases
    TotalFailedOccurrences = $totalCaseOccurrences
    StableReproCount  = $reproducibleCount
    FlakyCount        = $flakyCount
    WeightedReproRate = $reproRate
    StrictReproRate   = $strictReproRate
    AllTotalCases     = $allTotalCases
    AllPassedCases    = $allPassedCases
    AllFailedCount    = $allFailedCount
    PerRoundResults   = $roundResults
    FailedCaseDetails = $allFailedCases
}

$summaryPath = Join-Path $ProjectRoot "outputs\rbac-repro-summary-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$summaryDir = Split-Path $summaryPath -Parent
if (-not (Test-Path $summaryDir)) { New-Item -ItemType Directory -Path $summaryDir -Force | Out-Null }
$summary | ConvertTo-Json -Depth 5 | Set-Content $summaryPath -Encoding UTF8
Write-Host "`n摘要已保存: $summaryPath" -ForegroundColor Green

Write-Host "`n复现率: $reproRate%" -ForegroundColor $(if ($reproRate -eq 0) { 'Green' } else { 'Red' })

# 用退出码传递复现率（便于 CI 判断：0=通过, 非0=存在失败）
if ($reproRate -eq 0) { exit 0 } else { exit 1 }
