#!/usr/bin/env pwsh
<#
.SYNOPSIS
  V9 文档健康度统一审计编排器
.DESCRIPTION
  按 document-archive-management.md 中定义的审计流程，编排执行：
  1. 死文档审计（audit-dead-docs.ps1）
  2. 交叉引用断链检查（audit:doc-code-references）
  3. 季度全仓文档健康度审计（audit-quarterly-doc-health.ps1）
  4. 生成综合报告与趋势对比
.PARAMETER Mode
  审计模式：monthly（月度快速审计）、quarterly（季度全量审计）、full（全量+死文档）
.PARAMETER OutputDir
  报告输出目录，默认 docs/reports/audit/
.PARAMETER DryRun
  死文档审计仅扫描不执行移动操作
.PARAMETER NoCrossRef
  跳过交叉引用检查（用于快速扫描）
.PARAMETER NoDeadDocs
  跳过死文档审计
.PARAMETER StaleDays
  过期判定天数，默认 180
.EXAMPLE
  # 月度快速审计（仅交叉引用 + 过期检测）
  .\scripts\audit\audit-doc-health-orchestrator.ps1 -Mode monthly
  # 季度全量审计
  .\scripts\audit\audit-doc-health-orchestrator.ps1 -Mode quarterly
  # 全量审计（含死文档）
  .\scripts\audit\audit-doc-health-orchestrator.ps1 -Mode full
#>

param(
  [ValidateSet('monthly', 'quarterly', 'full')]
  [string]$Mode = 'quarterly',
  [string]$OutputDir = 'docs/reports/audit',
  [switch]$DryRun = $true,
  [switch]$NoCrossRef,
  [switch]$NoDeadDocs,
  [int]$StaleDays = 180
)

$ErrorActionPreference = 'Continue'
$RepoRoot = (Get-Item (Split-Path $PSScriptRoot -Parent) -Force).Parent.FullName
Set-Location $RepoRoot

$ReportDate = Get-Date -Format 'yyyy-MM-dd'
$ReportTime = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$ReportFile = Join-Path $OutputDir "doc-health-orchestrator-$ReportDate.md"
$JsonFile = Join-Path $OutputDir "doc-health-orchestrator-$ReportDate.json"

# Ensure output directory
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host '============================================' -ForegroundColor Cyan
Write-Host " V9 Document Health Orchestrator" -ForegroundColor Cyan
Write-Host " Mode: $Mode" -ForegroundColor Cyan
Write-Host " Date: $ReportDate" -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan

# ── Results containers ──
$results = @{
  mode = $Mode
  date = $ReportDate
  timestamp = $ReportTime
  deadDocs = $null
  crossRef = $null
  quarterlyHealth = $null
  overallScore = 0
  overallGrade = ''
  checks = @()
  recommendations = @()
}

# Count total docs for baselines
$totalDocs = (Get-ChildItem 'docs/' -Recurse -Filter '*.md' |
  Where-Object { $_.FullName -notmatch '\\archive\\' -and $_.FullName -notmatch '\\node_modules\\' }).Count

# ═══════════════════════════════════════════
# Phase 1: Dead Document Audit
# ═══════════════════════════════════════════
if (-not $NoDeadDocs -and $Mode -in @('quarterly', 'full')) {
  Write-Host "`n[Phase 1/3] Dead Document Audit..." -ForegroundColor Yellow
  $deadDocsStart = Get-Date
  
  try {
    $deadDocsArgs = @('-OutputDir', $OutputDir)
    if ($DryRun) { $deadDocsArgs += '-DryRun' }
    
    $deadDocsOutput = & pwsh -ExecutionPolicy Bypass -File 'scripts/audit/audit-dead-docs.ps1' @deadDocsArgs 2>&1
    $deadDocsExit = $LASTEXITCODE
    
    # Parse result from the latest audit report
    $latestDeadReport = Get-ChildItem $OutputDir -Filter 'dead-docs-audit-*.md' |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    
    if ($latestDeadReport) {
      $deadContent = Get-Content $latestDeadReport.FullName -Raw
      $deadMatch = [regex]::Match($deadContent, 'Dead Docs Identified\s*\|\s*(\d+)')
      $deadTotalMatch = [regex]::Match($deadContent, 'Total Active Docs\s*\|\s*(\d+)')
      $deadRateMatch = [regex]::Match($deadContent, 'Dead Rate\s*\|\s*([\d.]+)%')
      $levelAMatch = [regex]::Match($deadContent, 'Level A.*?\|\s*(\d+)')
      $levelBMatch = [regex]::Match($deadContent, 'Level B.*?\|\s*(\d+)')
      $levelCMatch = [regex]::Match($deadContent, 'Level C.*?\|\s*(\d+)')
      
      $results.deadDocs = @{
        passed = $true
        totalActive = if ($deadTotalMatch.Success) { [int]$deadTotalMatch.Groups[1].Value } else { $totalDocs }
        deadCount = if ($deadMatch.Success) { [int]$deadMatch.Groups[1].Value } else { 0 }
        deadRate = if ($deadRateMatch.Success) { [float]$deadRateMatch.Groups[1].Value } else { 0 }
        levelA = if ($levelAMatch.Success) { [int]$levelAMatch.Groups[1].Value } else { 0 }
        levelB = if ($levelBMatch.Success) { [int]$levelBMatch.Groups[1].Value } else { 0 }
        levelC = if ($levelCMatch.Success) { [int]$levelCMatch.Groups[1].Value } else { 0 }
        reportFile = $latestDeadReport.Name
        duration = [math]::Round(((Get-Date) - $deadDocsStart).TotalSeconds, 1)
      }
      
      $deadRate = $results.deadDocs.deadRate
      if ($deadRate -gt 30) {
        $results.checks += @{ name = 'Dead Docs'; status = 'FAIL'; detail = "Dead rate $deadRate% > 30% threshold" }
        $results.recommendations += "**P1**: Dead document rate is $deadRate% (>30%), prioritize archiving Level C drafts"
      } elseif ($deadRate -gt 15) {
        $results.checks += @{ name = 'Dead Docs'; status = 'WARN'; detail = "Dead rate $deadRate% (15-30%)" }
        $results.recommendations += "**P2**: Dead document rate is $deadRate%, schedule archival review"
      } else {
        $results.checks += @{ name = 'Dead Docs'; status = 'PASS'; detail = "Dead rate $deadRate% (healthy)" }
      }
      
      Write-Host "  Dead Docs: $($results.deadDocs.deadCount) dead / $($results.deadDocs.totalActive) total ($deadRate%)" -ForegroundColor Green
    } else {
      $results.deadDocs = @{ passed = $false; error = 'Report not found' }
      $results.checks += @{ name = 'Dead Docs'; status = 'ERROR'; detail = 'Report generation failed' }
      Write-Host '  Dead Docs: FAILED - Report not generated' -ForegroundColor Red
    }
  } catch {
    $results.deadDocs = @{ passed = $false; error = $_.Exception.Message }
    $results.checks += @{ name = 'Dead Docs'; status = 'ERROR'; detail = $_.Exception.Message }
    Write-Host "  Dead Docs: ERROR - $($_.Exception.Message)" -ForegroundColor Red
  }
} else {
  Write-Host "`n[Phase 1/3] Dead Document Audit: SKIPPED (mode=$Mode)" -ForegroundColor DarkYellow
  $results.deadDocs = @{ passed = $null; skipped = $true; reason = "Mode is '$Mode'" }
}

# ═══════════════════════════════════════════
# Phase 2: Cross-Reference Audit
# ═══════════════════════════════════════════
if (-not $NoCrossRef) {
  Write-Host "`n[Phase 2/3] Cross-Reference Audit..." -ForegroundColor Yellow
  $crossRefStart = Get-Date
  
  try {
    $crossRefOutput = npx tsx scripts/audit/audit-doc-code-references.ts --json 2>&1
    $crossRefExit = $LASTEXITCODE
    
    $latestAuditJson = Get-ChildItem 'scripts/docs/reports/audit/' -Filter 'audit-doc-code-references-*.json' |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    
    if ($latestAuditJson) {
      $crossRefData = Get-Content $latestAuditJson.FullName -Raw | ConvertFrom-Json
      $brokenCount = $crossRefData.brokenReferences.Count
      $totalRefs = $crossRefData.totalReferences
      $brokenRate = if ($crossRefData.brokenRate) { $crossRefData.brokenRate } else { 0 }
      
      $results.crossRef = @{
        passed = ($crossRefExit -eq 0)
        totalReferences = $totalRefs
        brokenReferences = $brokenCount
        brokenRate = $brokenRate
        summary = $crossRefData.summary
        duration = [math]::Round(((Get-Date) - $crossRefStart).TotalSeconds, 1)
      }
      
      if ($brokenRate -gt 0) {
        $results.checks += @{ name = 'Cross-Refs'; status = 'FAIL'; detail = "Broken rate $brokenRate% ($brokenCount/$totalRefs)" }
        $results.recommendations += "**P0**: Fix $brokenCount broken cross-references (rate: $brokenRate%)"
      } else {
        $results.checks += @{ name = 'Cross-Refs'; status = 'PASS'; detail = "0 broken / $totalRefs total" }
      }
      
      Write-Host "  Cross-Refs: $brokenCount broken / $totalRefs total ($brokenRate%)" -ForegroundColor $(if ($brokenRate -eq 0) { 'Green' } else { 'Red' })
    } else {
      $results.crossRef = @{ passed = $false; error = 'JSON report not found' }
      $results.checks += @{ name = 'Cross-Refs'; status = 'ERROR'; detail = 'JSON report generation failed' }
      Write-Host '  Cross-Refs: FAILED - JSON report not generated' -ForegroundColor Red
    }
  } catch {
    $results.crossRef = @{ passed = $false; error = $_.Exception.Message }
    $results.checks += @{ name = 'Cross-Refs'; status = 'ERROR'; detail = $_.Exception.Message }
    Write-Host "  Cross-Refs: ERROR - $($_.Exception.Message)" -ForegroundColor Red
  }
} else {
  Write-Host "`n[Phase 2/3] Cross-Reference Audit: SKIPPED (--NoCrossRef)" -ForegroundColor DarkYellow
  $results.crossRef = @{ passed = $null; skipped = $true }
}

# ═══════════════════════════════════════════
# Phase 3: Quarterly Health Audit
# ═══════════════════════════════════════════
Write-Host "`n[Phase 3/3] Quarterly Document Health Audit..." -ForegroundColor Yellow
$healthStart = Get-Date

try {
  $healthArgs = @('-OutputDir', $OutputDir, '-StaleDays', $StaleDays)
  $healthOutput = & pwsh -ExecutionPolicy Bypass -File 'scripts/audit/audit-quarterly-doc-health.ps1' @healthArgs 2>&1
  $healthExit = $LASTEXITCODE
  
  $latestHealthJson = Get-ChildItem $OutputDir -Filter 'quarterly-doc-health-*.json' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  
  if ($latestHealthJson) {
    $healthData = Get-Content $latestHealthJson.FullName -Raw | ConvertFrom-Json
    
    $healthScore = $healthData.score
    $healthGrade = if ($healthScore -ge 90) { 'A' }
      elseif ($healthScore -ge 75) { 'B' }
      elseif ($healthScore -ge 60) { 'C' }
      else { 'D' }
    
    $results.quarterlyHealth = @{
      passed = ($healthExit -eq 0)
      score = $healthScore
      grade = $healthGrade
      totalDocs = $healthData.totalDocs
      staleCount = $healthData.staleDocs.Count
      missingDocIdCount = $healthData.missingDocId.Count
      incompleteMetaCount = $healthData.incompleteMeta.Count
      duration = [math]::Round(((Get-Date) - $healthStart).TotalSeconds, 1)
    }
    
    if ($healthScore -lt 60) {
      $results.checks += @{ name = 'Health Score'; status = 'FAIL'; detail = "Score $healthScore/100 (Grade $healthGrade)" }
      $results.recommendations += "**P0**: Health score critically low ($healthScore/100), immediate remediation required"
    } elseif ($healthScore -lt 75) {
      $results.checks += @{ name = 'Health Score'; status = 'WARN'; detail = "Score $healthScore/100 (Grade $healthGrade)" }
      $results.recommendations += "**P1**: Health score needs improvement ($healthScore/100)"
    } else {
      $results.checks += @{ name = 'Health Score'; status = 'PASS'; detail = "Score $healthScore/100 (Grade $healthGrade)" }
    }
    
    Write-Host "  Health: Score $healthScore/100 ($healthGrade), Stale: $($healthData.staleDocs.Count), Missing ID: $($healthData.missingDocId.Count)" -ForegroundColor $(if ($healthScore -ge 75) { 'Green' } else { 'Yellow' })
  } else {
    $results.quarterlyHealth = @{ passed = $false; error = 'JSON report not found' }
    $results.checks += @{ name = 'Health Score'; status = 'ERROR'; detail = 'Report generation failed' }
    Write-Host '  Health: FAILED - JSON report not generated' -ForegroundColor Red
  }
} catch {
  $results.quarterlyHealth = @{ passed = $false; error = $_.Exception.Message }
  $results.checks += @{ name = 'Health Score'; status = 'ERROR'; detail = $_.Exception.Message }
  Write-Host "  Health: ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

# ═══════════════════════════════════════════
# Calculate Overall Score
# ═══════════════════════════════════════════
$overallScore = 100
$failCount = 0
$warnCount = 0

foreach ($check in $results.checks) {
  if ($check.status -eq 'FAIL' -or $check.status -eq 'ERROR') { $failCount++ }
  if ($check.status -eq 'WARN') { $warnCount++ }
}

# Dead docs penalty
if ($results.deadDocs -and -not $results.deadDocs.skipped) {
  if ($results.deadDocs.deadRate -gt 30) { $overallScore -= 15 }
  elseif ($results.deadDocs.deadRate -gt 15) { $overallScore -= 8 }
}

# Cross-ref penalty
if ($results.crossRef -and -not $results.crossRef.skipped) {
  if ($results.crossRef.brokenRate -gt 0) { $overallScore -= 10 }
}

# Health score directly contributes
if ($results.quarterlyHealth -and -not $results.quarterlyHealth.error) {
  $overallScore = [math]::Min($overallScore, [math]::Max(0, $results.quarterlyHealth.score))
}

$overallGrade = if ($overallScore -ge 90) { 'A - 健康' }
  elseif ($overallScore -ge 75) { 'B - 需关注' }
  elseif ($overallScore -ge 60) { 'C - 需整改' }
  else { 'D - 严重' }

$results.overallScore = $overallScore
$results.overallGrade = $overallGrade

# ═══════════════════════════════════════════
# Trend Comparison (if previous report exists)
# ═══════════════════════════════════════════
$trendNote = ''
$prevReport = Get-ChildItem $OutputDir -Filter 'doc-health-orchestrator-*.json' |
  Where-Object { $_.Name -notmatch $ReportDate } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($prevReport) {
  try {
    $prevData = Get-Content $prevReport.FullName -Raw | ConvertFrom-Json
    $prevScore = $prevData.overallScore
    $scoreDelta = $overallScore - $prevScore
    $trend = if ($scoreDelta -gt 0) { 'improved' }
      elseif ($scoreDelta -lt 0) { 'declined' }
      else { 'stable' }
    
    $results.trend = @{
      previousScore = $prevScore
      previousDate = $prevData.date
      delta = $scoreDelta
      direction = $trend
    }
    
    $deltaStr = if ($scoreDelta -ge 0) { "+$scoreDelta" } else { "$scoreDelta" }
    $trendIcon = if ($trend -eq 'improved') { '↑' }
      elseif ($trend -eq 'declined') { '↓' }
      else { '→' }
    $trendNote = "`n> **Trend**: $trendIcon $deltaStr vs previous audit ($($prevData.date) score: $prevScore)"
  } catch {
    $trendNote = ''
  }
}

# ═══════════════════════════════════════════
# Generate Combined Report
# ═══════════════════════════════════════════
Write-Host "`nGenerating combined report..." -ForegroundColor Yellow

# Build check table
$checkRows = ($results.checks | ForEach-Object {
  $icon = if ($_.status -eq 'PASS') { '✅' }
    elseif ($_.status -eq 'WARN') { '⚠️' }
    elseif ($_.status -eq 'FAIL') { '❌' }
    else { '🔥' }
  "| $icon $($_.name) | $($_.status) | $($_.detail) |"
}) -join "`n"

# Build dead docs section
$deadSection = if ($results.deadDocs -and -not $results.deadDocs.skipped) {
  @(
    "## 1. Dead Document Audit",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    "| Total Active Docs | $($results.deadDocs.totalActive) |",
    "| Dead Docs | $($results.deadDocs.deadCount) |",
    "| Dead Rate | $($results.deadDocs.deadRate)% |",
    "| Level A (Important) | $($results.deadDocs.levelA) |",
    "| Level B (Normal) | $($results.deadDocs.levelB) |",
    "| Level C (Draft/Temp) | $($results.deadDocs.levelC) |",
    "| Duration | $($results.deadDocs.duration)s |",
    "",
    "> Report: $($results.deadDocs.reportFile)",
    ""
  ) -join "`n"
} else {
  "## 1. Dead Document Audit`n`n**Skipped** (mode: $Mode)`n"
}

# Build cross-ref section
$crossRefSection = if ($results.crossRef -and -not $results.crossRef.skipped) {
  $docToCode = if ($results.crossRef.summary) { $results.crossRef.summary.docToCode } else { $null }
  $codeToDoc = if ($results.crossRef.summary) { $results.crossRef.summary.codeToDoc } else { $null }
  $docToDoc = if ($results.crossRef.summary) { $results.crossRef.summary.docToDoc } else { $null }
  
  @(
    "## 2. Cross-Reference Audit",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    "| Total References | $($results.crossRef.totalReferences) |",
    "| Broken References | $($results.crossRef.brokenReferences) |",
    "| Broken Rate | $($results.crossRef.brokenRate)% |",
    "| Status | $(if ($results.crossRef.passed) { 'PASS' } else { 'FAIL' }) |",
    "| Duration | $($results.crossRef.duration)s |",
    "",
    "### By Type",
    "",
    "| Type | Total | Broken |",
    "|------|-------|--------|",
    "| Doc-to-Code | $(if ($docToCode) { $docToCode.total } else { 'N/A' }) | $(if ($docToCode) { $docToCode.broken } else { 'N/A' }) |",
    "| Code-to-Doc | $(if ($codeToDoc) { $codeToDoc.total } else { 'N/A' }) | $(if ($codeToDoc) { $codeToDoc.broken } else { 'N/A' }) |",
    "| Doc-to-Doc | $(if ($docToDoc) { $docToDoc.total } else { 'N/A' }) | $(if ($docToDoc) { $docToDoc.broken } else { 'N/A' }) |",
    ""
  ) -join "`n"
} else {
  "## 2. Cross-Reference Audit`n`n**Skipped**`n"
}

# Build health section
$healthSection = if ($results.quarterlyHealth -and -not $results.quarterlyHealth.error) {
  @(
    "## 3. Quarterly Document Health",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    "| Health Score | $($results.quarterlyHealth.score) / 100 |",
    "| Grade | $($results.quarterlyHealth.grade) |",
    "| Total Docs | $($results.quarterlyHealth.totalDocs) |",
    "| Stale Docs | $($results.quarterlyHealth.staleCount) |",
    "| Missing doc_id | $($results.quarterlyHealth.missingDocIdCount) |",
    "| Incomplete Frontmatter | $($results.quarterlyHealth.incompleteMetaCount) |",
    "| Duration | $($results.quarterlyHealth.duration)s |",
    ""
  ) -join "`n"
} else {
  "## 3. Quarterly Document Health`n`n**Error**: $($results.quarterlyHealth.error)`n"
}

# Build recommendations
$recSection = if ($results.recommendations.Count -gt 0) {
  @(
    "## 5. Recommendations",
    "",
    ($results.recommendations | ForEach-Object { "- $_" }) -join "`n",
    ""
  ) -join "`n"
} else {
  "## 5. Recommendations`n`nAll checks passed. No action required.`n"
}

# Build action commands
$actionCommands = @(
  "# Run individual audits:",
  "powershell -ExecutionPolicy Bypass -File scripts/audit/audit-dead-docs.ps1",
  "npx tsx scripts/audit/audit-doc-code-references.ts",
  "powershell -ExecutionPolicy Bypass -File scripts/audit/audit-quarterly-doc-health.ps1",
  "# Run full orchestrator:",
  "powershell -ExecutionPolicy Bypass -File scripts/audit/audit-doc-health-orchestrator.ps1 -Mode full"
) -join "`n"

$reportContent = @(
  "# V9 Document Health Orchestrator Report",
  "",
  "> **Audit Date**: $ReportDate",
  "> **Mode**: $Mode",
  "> **Scope**: docs/ (excluding archive/)",
  $trendNote,
  "",
  "---",
  "",
  "## Overall Score",
  "",
  "| Metric | Value |",
  "|--------|-------|",
  "| **Overall Health Score** | **$overallScore / 100** |",
  "| **Grade** | **$overallGrade** |",
  "| Total Checks | $($results.checks.Count) |",
  "| Failures | $failCount |",
  "| Warnings | $warnCount |",
  "",
  "### Check Results",
  "",
  "| Check | Status | Detail |",
  "|-------|--------|--------|",
  $checkRows,
  "",
  "---",
  "",
  $deadSection,
  "---",
  "",
  $crossRefSection,
  "---",
  "",
  $healthSection,
  "---",
  "",
  $recSection,
  "---",
  "",
  "## 6. Audit Commands",
  "",
  '```bash',
  $actionCommands,
  '```',
  "",
  "---",
  "",
  "> **Generated by**: scripts/audit/audit-doc-health-orchestrator.ps1",
  "> **Schedule**: Monthly (dead docs + cross-ref) / Quarterly (full health audit)",
  "> **Reference**: docs/meta/document-archive-management.md"
) -join "`n"

$reportContent | Out-File -FilePath $ReportFile -Encoding utf8

# Write JSON
$results | ConvertTo-Json -Depth 4 | Out-File -FilePath $JsonFile -Encoding utf8

# ═══════════════════════════════════════════
# Summary Output
# ═══════════════════════════════════════════
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " Orchestrator Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Overall Score: $overallScore / 100 ($overallGrade)" -ForegroundColor $(if ($overallScore -ge 75) { 'Green' } else { 'Yellow' })
Write-Host " Checks: $($results.checks.Count) total, $failCount failures, $warnCount warnings" -ForegroundColor $(if ($failCount -eq 0) { 'Green' } else { 'Red' })
Write-Host " Report: $ReportFile" -ForegroundColor Cyan
Write-Host " JSON: $JsonFile" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Exit with failure if any critical check failed
if ($failCount -gt 0) {
  exit 1
} else {
  exit 0
}