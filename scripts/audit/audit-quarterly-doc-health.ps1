#!/usr/bin/env pwsh
<#
.SYNOPSIS
  V9 季度全仓文档健康度审计脚本
.DESCRIPTION
  按 document-archive-management.md 中定义的季度审计流程，自动化执行：
  1. 交叉引用断链检查
  2. 过期文档检测（> 180 天未更新）
  3. 缺失 doc_id 文档检测
  4. 不完整 Frontmatter 检测
  5. 生成 Markdown 报告
.PARAMETER OutputDir
  报告输出目录，默认 docs/reports/audit/
.PARAMETER StaleDays
  过期判定天数，默认 180
.EXAMPLE
  .\scripts\audit\audit-quarterly-doc-health.ps1
  .\scripts\audit\audit-quarterly-doc-health.ps1 -StaleDays 90
#>

param(
  [string]$OutputDir = "docs/reports/audit",
  [int]$StaleDays = 180
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Item (Split-Path $PSScriptRoot -Parent) -Force).Parent.FullName
Set-Location $RepoRoot

$ReportDate = Get-Date -Format "yyyy-MM-dd"
$ReportFile = Join-Path $OutputDir "quarterly-doc-health-$ReportDate.md"
$JsonFile = Join-Path $OutputDir "quarterly-doc-health-$ReportDate.json"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " V9 季度文档健康度审计" -ForegroundColor Cyan
Write-Host " 日期: $ReportDate" -ForegroundColor Cyan
Write-Host " 过期阈值: $StaleDays 天" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── 1. 交叉引用断链检查 ──
Write-Host "`n[1/4] 交叉引用断链检查..." -ForegroundColor Yellow
$crossRefResult = npx tsx scripts/audit/audit-doc-code-references.ts --json 2>&1
$crossRefPassed = ($LASTEXITCODE -eq 0)

# 解析 JSON 报告
$latestAuditJson = Get-ChildItem "scripts/docs/reports/audit/" -Filter "audit-doc-code-references-*.json" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$crossRefData = $null
if ($latestAuditJson) {
  $crossRefData = Get-Content $latestAuditJson.FullName -Raw | ConvertFrom-Json
}

# ── 2. 过期文档检测 ──
Write-Host "[2/4] 过期文档检测..." -ForegroundColor Yellow
$staleDocs = @()
$now = Get-Date
$cutoff = $now.AddDays(-$StaleDays)

Get-ChildItem "docs/" -Recurse -Filter "*.md" |
  Where-Object { $_.FullName -notmatch '\\archive\\' -and $_.FullName -notmatch '\\node_modules\\' } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match 'last_updated:\s*(\d{4}-\d{2}-\d{2})') {
      $lastUpdated = [datetime]::Parse($matches[1])
      if ($lastUpdated -lt $cutoff) {
        $staleDocs += [PSCustomObject]@{
          File = $_.FullName.Replace("$RepoRoot\", "").Replace('\', '/')
          LastUpdated = $lastUpdated.ToString("yyyy-MM-dd")
          DaysSince = [int](($now - $lastUpdated).TotalDays)
        }
      }
    }
  }

$staleDocs = $staleDocs | Sort-Object DaysSince -Descending

# ── 3. 缺失 doc_id 检测 ──
Write-Host "[3/4] 缺失 doc_id 检测..." -ForegroundColor Yellow
$missingDocId = @()

Get-ChildItem "docs/" -Recurse -Filter "*.md" |
  Where-Object { $_.FullName -notmatch '\\archive\\' -and $_.FullName -notmatch '\\node_modules\\' } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -notmatch 'doc_id:') {
      $missingDocId += [PSCustomObject]@{
        File = $_.FullName.Replace("$RepoRoot\", "").Replace('\', '/')
        Size = $_.Length
      }
    }
  }

# ── 4. Frontmatter 完整性检测 ──
Write-Host "[4/4] Frontmatter 完整性检测..." -ForegroundColor Yellow
$incompleteMeta = @()
$requiredFields = @('title', 'tier', 'version', 'last_updated')

Get-ChildItem "docs/" -Recurse -Filter "*.md" |
  Where-Object { $_.FullName -notmatch '\\archive\\' -and $_.FullName -notmatch '\\node_modules\\' } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    $missing = @()
    foreach ($field in $requiredFields) {
      if ($content -notmatch "$field`:") {
        $missing += $field
      }
    }
    if ($missing.Count -gt 0) {
      $incompleteMeta += [PSCustomObject]@{
        File = $_.FullName.Replace("$RepoRoot\", "").Replace('\', '/')
        MissingFields = $missing -join ', '
      }
    }
  }

# ── 计算健康度评分 ──
$totalDocs = (Get-ChildItem "docs/" -Recurse -Filter "*.md" |
  Where-Object { $_.FullName -notmatch '\\archive\\' -and $_.FullName -notmatch '\\node_modules\\' }).Count

$brokenRefs = if ($crossRefData) { $crossRefData.brokenReferences.Count } else { 'N/A' }
$crossRefTotal = if ($crossRefData) { $crossRefData.totalReferences } else { 'N/A' }
$crossRefBrokenRate = if ($crossRefData) { $crossRefData.brokenRate } else { 'N/A' }
$crossRefSummary = if ($crossRefData) { $crossRefData.summary } else { $null }

$score = 100
if ($crossRefPassed -eq $false) { $score -= 10 }
if ($staleDocs.Count -gt 10) { $score -= 5 }
if ($staleDocs.Count -gt 20) { $score -= 5 }
if ($missingDocId.Count -gt 0) { $score -= 5 * [Math]::Min($missingDocId.Count, 4) }
if ($incompleteMeta.Count -gt 0) { $score -= 2 * [Math]::Min($incompleteMeta.Count, 5) }

# ── 生成报告 ──
Write-Host "`n生成报告..." -ForegroundColor Yellow

# 计算评级
$grade = if ($score -ge 90) { '[A] 健康' }
  elseif ($score -ge 75) { '[B] 需关注' }
  elseif ($score -ge 60) { '[C] 需整改' }
  else { '[D] 严重' }

$crossRefStatus = if ($crossRefPassed) { 'PASS' } else { 'FAIL' }

# 构建过期文档表格行
$staleRows = "| (none) | - | - |"
if ($staleDocs.Count -gt 0) {
  $staleRows = ($staleDocs | ForEach-Object { "| $($_.File) | $($_.LastUpdated) | $($_.DaysSince) |" }) -join "`n"
}

# 构建缺失 doc_id 表格行
$missingIdRows = "| (none) | - |"
if ($missingDocId.Count -gt 0) {
  $missingIdRows = ($missingDocId | ForEach-Object { "| $($_.File) | $($_.Size) B |" }) -join "`n"
}

# 构建 Frontmatter 不完整表格行
$incompleteRows = "| (none) | - |"
if ($incompleteMeta.Count -gt 0) {
  $incompleteRows = ($incompleteMeta | ForEach-Object { "| $($_.File) | $($_.MissingFields) |" }) -join "`n"
}

# 构建建议
$suggestionLines = @()
if (-not $crossRefPassed) {
  $suggestionLines += "**P0**: Fix broken cross-references, run: npm run audit:doc-code-references"
}
if ($staleDocs.Count -gt 10) {
  $suggestionLines += "**P1**: Clean $($staleDocs.Count) stale docs, see: docs/meta/document-archive-management.md"
}
if ($missingDocId.Count -gt 0) {
  $suggestionLines += "**P1**: Add doc_id to $($missingDocId.Count) docs"
}
if ($incompleteMeta.Count -gt 0) {
  $suggestionLines += "**P2**: Fix $($incompleteMeta.Count) docs with incomplete frontmatter"
}
if ($suggestionLines.Count -eq 0) {
  $suggestionLines += "All checks passed, no action required."
}
$suggestionsText = $suggestionLines -join "`n"

$reportLines = @(
  "# V9 Quarterly Document Health Audit Report",
  "",
  "> Audit Date: $ReportDate",
  "> Stale Threshold: $StaleDays days",
  "> Scope: docs/ (excluding archive/)",
  "",
  "---",
  "",
  "## Overall Score",
  "",
  "| Metric | Value |",
  "|--------|-------|",
  "| Health Score | $score / 100 |",
  "| Grade | $grade |",
  "",
  "---",
  "",
  "## 1. Cross-Reference Health",
  "",
  "| Metric | Value |",
  "|--------|-------|",
  "| Total References | $crossRefTotal |",
"| Broken References | $brokenRefs |",
"| Broken Rate | $crossRefBrokenRate% |",
"| Status | $crossRefStatus |",
"",
"### By Type",
"",
"| Type | Total | Broken |",
"|------|-------|--------|",
"| Doc-to-Code | $(if ($crossRefSummary) { $crossRefSummary.docToCode.total } else { 'N/A' }) | $(if ($crossRefSummary) { $crossRefSummary.docToCode.broken } else { 'N/A' }) |",
"| Code-to-Doc | $(if ($crossRefSummary) { $crossRefSummary.codeToDoc.total } else { 'N/A' }) | $(if ($crossRefSummary) { $crossRefSummary.codeToDoc.broken } else { 'N/A' }) |",
"| Doc-to-Doc | $(if ($crossRefSummary) { $crossRefSummary.docToDoc.total } else { 'N/A' }) | $(if ($crossRefSummary) { $crossRefSummary.docToDoc.broken } else { 'N/A' }) |",
  "",
  "---",
  "",
  "## 2. Stale Documents (> $StaleDays days)",
  "",
  "Total: $($staleDocs.Count) documents",
  "",
  "| File | Last Updated | Days Since |",
  "|------|-------------|------------|",
  $staleRows,
  "",
  "---",
  "",
  "## 3. Missing doc_id",
  "",
  "Total: $($missingDocId.Count) documents",
  "",
  "| File | Size |",
  "|------|------|",
  $missingIdRows,
  "",
  "---",
  "",
  "## 4. Incomplete Frontmatter",
  "",
  "Total: $($incompleteMeta.Count) documents",
  "",
  "| File | Missing Fields |",
  "|------|----------------|",
  $incompleteRows,
  "",
  "---",
  "",
  "## 5. Summary",
  "",
  "| Metric | Value |",
  "|--------|-------|",
  "| Active Docs | $totalDocs |",
  "| Stale Docs | $($staleDocs.Count) |",
  "| Missing doc_id | $($missingDocId.Count) |",
  "| Incomplete Frontmatter | $($incompleteMeta.Count) |",
  "| Broken Cross-Refs | $brokenRefs |",
  "",
  "---",
  "",
  "## 6. Recommendations",
  "",
  $suggestionsText,
  "",
  "---",
  "",
  "> Generated by: scripts/audit/audit-quarterly-doc-health.ps1",
  "> Command: .\scripts\audit\audit-quarterly-doc-health.ps1"
)

# 确保输出目录存在
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# 写入 Markdown 报告
$reportLines -join "`n" | Out-File -FilePath $ReportFile -Encoding utf8

# 写入 JSON 数据
$jsonData = @{
  date = $ReportDate
  score = $score
  totalDocs = $totalDocs
  crossRef = @{
    total = if ($crossRefData) { $crossRefData.totalReferences } else { 0 }
    broken = $brokenRefs
    brokenRate = if ($crossRefData) { $crossRefData.brokenRate } else { -1 }
    passed = $crossRefPassed
  }
  staleDocs = @($staleDocs)
  missingDocId = @($missingDocId)
  incompleteMeta = @($incompleteMeta)
} | ConvertTo-Json -Depth 4

$jsonData | Out-File -FilePath $JsonFile -Encoding utf8

Write-Host "`n============================================" -ForegroundColor Green
Write-Host " Audit Complete" -ForegroundColor Green
Write-Host " Health Score: $score / 100" -ForegroundColor Green
Write-Host " Report: $ReportFile" -ForegroundColor Green
Write-Host " JSON: $JsonFile" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

if ($crossRefPassed) { exit 0 } else { exit 1 }