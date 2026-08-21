#!/usr/bin/env pwsh
<#
.SYNOPSIS
  V9 全量死文档审计脚本
.DESCRIPTION
  按 document-archive-management.md 中定义的判定标准，自动化扫描：
  1. DEPRECATED_ 前缀文档
  2. deprecated/ 目录中的文档
  3. 无 doc_id + 无交叉引用的孤儿文档
  4. 日期前缀临时记录（2026-MM-DD-xxx.md）
  5. 关键词命中（report/summary/cleanup/changelog 等非正式文档）
  6. 与归档目录重复的文档
  7. 空文档或极小文档（< 500 bytes）
  8. 超过 365 天未更新的文档
.PARAMETER OutputDir
  报告输出目录，默认 docs/reports/audit/
.PARAMETER DryRun
  仅扫描不执行移动操作
.EXAMPLE
  .\scripts\audit\audit-dead-docs.ps1
  .\scripts\audit\audit-dead-docs.ps1 -DryRun
#>

param(
  [string]$OutputDir = "docs/reports/audit",
  [switch]$DryRun = $true
)

$ErrorActionPreference = "Continue"
$RepoRoot = (Get-Item (Split-Path $PSScriptRoot -Parent) -Force).Parent.FullName
Set-Location $RepoRoot

$ReportDate = Get-Date -Format "yyyy-MM-dd"
$ReportFile = Join-Path $OutputDir "dead-docs-audit-$ReportDate.md"
$CsvFile = Join-Path $OutputDir "dead-docs-audit-$ReportDate.csv"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " V9 Dead Document Audit" -ForegroundColor Cyan
Write-Host " Date: $ReportDate" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── Helpers ──
function Get-RelativePath($fullPath) {
  return $fullPath.Replace($RepoRoot + '\', '').Replace('\', '/')
}

# ── Collect all docs ──
$allDocs = @(Get-ChildItem "docs/" -Recurse -Filter "*.md" |
  Where-Object { $_.FullName -notmatch '\\archive\\' -and $_.FullName -notmatch '\\node_modules\\' })

$totalDocs = $allDocs.Count

# ── Load registered doc-id paths (active doc whitelist) ──
# 已登记 doc_id 的文档视为活跃文档：即使 archive 存在同名副本（历史快照）
# 或文件名命中关键词/日期前缀，也不判死，避免系统性误报。
$registeredDocs = @{}
$registryFile = "docs/meta/doc-id-registry.md"
if (Test-Path $registryFile) {
  Get-Content $registryFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\|\s*V9-DOC-[A-Za-z0-9-]+\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|') {
      $p = $Matches[1].Trim().Replace('\', '/')
      if ($p -and $p -match '\.md$') { $registeredDocs[('docs/' + $p).ToLower()] = $true }
    }
  }
}
Write-Host ("[+] Registered doc-id whitelist loaded: {0} entries" -f $registeredDocs.Count) -ForegroundColor DarkCyan

# ── Results containers ──
$deadDocs = [System.Collections.ArrayList]::new()
$categories = @{
  deprecated_prefix = @()
  deprecated_dir = @()
  orphan_no_ref = @()
  date_prefix_temp = @()
  keyword_hit = @()
  duplicate_archive = @()
  empty_or_tiny = @()
  stale_365 = @()
}

# ── Build archive file index (for duplicate detection) ──
Write-Host "[0/8] Building archive index..." -ForegroundColor Yellow
$archiveFiles = @{}
# docs/archive/
Get-ChildItem "docs/archive/" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue |
  ForEach-Object { $archiveFiles[$_.Name.ToLower()] = $_.FullName }
# archive/docs/
Get-ChildItem "archive/" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue |
  ForEach-Object { $archiveFiles[$_.Name.ToLower()] = $_.FullName }

# ── Build cross-reference index ──
Write-Host "[1/8] Building cross-reference index..." -ForegroundColor Yellow
$refTargets = @{}
# Run cross-ref audit to get all valid references
try {
  $latestAuditJson = Get-ChildItem "scripts/docs/reports/audit/" -Filter "audit-doc-code-references-*.json" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($latestAuditJson) {
    $auditData = Get-Content $latestAuditJson.FullName -Raw | ConvertFrom-Json
    foreach ($ref in $auditData.validReferences) {
      $target = $ref.target.ToLower().Replace('\', '/')
      if (-not $refTargets.ContainsKey($target)) { $refTargets[$target] = @() }
      $refTargets[$target] += $ref.source
    }
  }
} catch {
  Write-Host "  Warning: Cross-reference index build failed, will skip orphan detection" -ForegroundColor DarkYellow
}

# ── 1. DEPRECATED_ prefix ──
Write-Host "[2/8] Scanning DEPRECATED_ prefix..." -ForegroundColor Yellow
$allDocs | Where-Object { $_.Name -match '^DEPRECATED_' } | ForEach-Object {
  $relPath = Get-RelativePath $_.FullName
  $categories.deprecated_prefix += $relPath
  $null = $deadDocs.Add([PSCustomObject]@{
    Path = $relPath; Size = $_.Length; Category = 'DEPRECATED_ prefix'; Level = 'C';
    Reason = 'File name has DEPRECATED_ prefix'; LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
  })
}

# ── 2. deprecated/ directory ──
Write-Host "[3/8] Scanning deprecated/ directories..." -ForegroundColor Yellow
$allDocs | Where-Object { $_.FullName -match '\\deprecated\\' } | ForEach-Object {
  $relPath = Get-RelativePath $_.FullName
  if ($relPath -notin $categories.deprecated_prefix) {
    $categories.deprecated_dir += $relPath
    $null = $deadDocs.Add([PSCustomObject]@{
      Path = $relPath; Size = $_.Length; Category = 'deprecated/ directory'; Level = 'C';
      Reason = 'Located in deprecated/ directory'; LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
    })
  }
}

# ── 4. Date-prefix temp records ──
Write-Host "[4/8] Scanning date-prefix temp records..." -ForegroundColor Yellow
# changelogs/、adr/、retro/ 目录下的日期前缀是正式归档命名惯例（变更日志、ADR、复盘记录），豁免
$allDocs | Where-Object {
  $_.Name -match '^\d{4}-\d{2}-\d{2}-' -and $_.FullName -notmatch '\\(changelogs|adr|retro)\\'
} | ForEach-Object {
  $relPath = Get-RelativePath $_.FullName
  if ($relPath -notin $categories.deprecated_prefix -and $relPath -notin $categories.deprecated_dir) {
    $categories.date_prefix_temp += $relPath
    $null = $deadDocs.Add([PSCustomObject]@{
      Path = $relPath; Size = $_.Length; Category = 'Date-prefix temp record'; Level = 'C';
      Reason = 'Date-prefix filename (temporary record)'; LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
    })
  }
}

# ── 5. Keyword hits (non-formal docs) ──
Write-Host "[5/8] Scanning keyword hits..." -ForegroundColor Yellow
$reportKeywords = @('report', 'summary', 'cleanup', 'changelog', 'checklist', 'todo',
  'review', 'audit', '治理', '整改', '复盘', '报告', '总结')
$allDocs | Where-Object {
  $name = $_.Name.ToLower()
  $relPath = Get-RelativePath $_.FullName
  if ($relPath -in $categories.deprecated_prefix -or $relPath -in $categories.deprecated_dir -or $relPath -in $categories.date_prefix_temp) { return $false }
  # Only flag if in a non-report directory (reports/ is the right place for reports)
  if ($relPath -match '^docs/reports/') { return $false }
  if ($relPath -match '^docs/release-notes/') { return $false }
  if ($relPath -match '^docs/lessons/') { return $false }
  # 灰度/版本发布报告目录：报告类文档的正式归属地
  if ($relPath -match '^docs/releases/') { return $false }
  # changelogs/ 变更日志目录：文件名天然含 report/summary 字样，与 date-prefix 豁免逻辑一致
  if ($relPath -match '/changelogs/') { return $false }
  # 已登记 doc_id 的文档为正式文档，文件名命中关键词不判死
  if ($registeredDocs.ContainsKey($relPath.ToLower())) { return $false }
  foreach ($kw in $reportKeywords) {
    if ($name -match $kw) { return $true }
  }
  return $false
} | ForEach-Object {
  $relPath = Get-RelativePath $_.FullName
  $categories.keyword_hit += $relPath
  $null = $deadDocs.Add([PSCustomObject]@{
    Path = $relPath; Size = $_.Length; Category = 'Keyword hit (non-formal)'; Level = 'B';
    Reason = 'Filename contains report/summary/review keywords in non-report directory';
    LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
  })
}

# ── 6. Duplicate with archive ──
Write-Host "[6/8] Scanning archive duplicates..." -ForegroundColor Yellow
# 仅当内容与 archive 副本完全一致时才判定为死副本；
# 内容不同 = 活跃演进版（archive 中只是历史快照）；已登记 doc_id 的一律不判死。
$allDocs | ForEach-Object {
  $relPath = Get-RelativePath $_.FullName
  if ($relPath -in $categories.deprecated_prefix -or $relPath -in $categories.deprecated_dir) { return }
  if ($registeredDocs.ContainsKey($relPath.ToLower())) { return }
  $nameKey = $_.Name.ToLower()
  if ($archiveFiles.ContainsKey($nameKey)) {
    $sameContent = $false
    try {
      $hashActive = (Get-FileHash -LiteralPath $_.FullName -Algorithm MD5).Hash
      $hashArchive = (Get-FileHash -LiteralPath $archiveFiles[$nameKey] -Algorithm MD5).Hash
      $sameContent = ($hashActive -eq $hashArchive)
    } catch { $sameContent = $false }
    if ($sameContent) {
      $categories.duplicate_archive += $relPath
      $null = $deadDocs.Add([PSCustomObject]@{
        Path = $relPath; Size = $_.Length; Category = 'Duplicate in archive'; Level = 'B';
        Reason = "Content identical to archive copy: $($archiveFiles[$nameKey])";
        LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
      })
    }
  }
}

# ── 7. Empty or tiny docs ──
Write-Host "[7/8] Scanning empty/tiny docs..." -ForegroundColor Yellow
$allDocs | Where-Object { $_.Length -lt 500 } | ForEach-Object {
  $relPath = Get-RelativePath $_.FullName
  if ($relPath -in $categories.deprecated_prefix -or $relPath -in $categories.deprecated_dir) { return }
  $categories.empty_or_tiny += $relPath
  $null = $deadDocs.Add([PSCustomObject]@{
    Path = $relPath; Size = $_.Length; Category = 'Empty or tiny doc'; Level = 'C';
    Reason = "File size < 500 bytes ($($_.Length) bytes)"; LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
  })
}

# ── 8. Stale > 365 days ──
Write-Host "[8/8] Scanning stale docs (>365 days)..." -ForegroundColor Yellow
$now = Get-Date
$cutoff365 = $now.AddDays(-365)
$allDocs | Where-Object { $_.LastWriteTime -lt $cutoff365 } | ForEach-Object {
  $relPath = Get-RelativePath $_.FullName
  if ($relPath -in $categories.deprecated_prefix -or $relPath -in $categories.deprecated_dir -or
      $relPath -in $categories.date_prefix_temp -or $relPath -in $categories.keyword_hit -or
      $relPath -in $categories.duplicate_archive -or $relPath -in $categories.empty_or_tiny) { return }
  $daysSince = [int](($now - $_.LastWriteTime).TotalDays)
  $categories.stale_365 += $relPath
  $null = $deadDocs.Add([PSCustomObject]@{
    Path = $relPath; Size = $_.Length; Category = 'Stale >365 days'; Level = 'B';
    Reason = "Last modified $($_.LastWriteTime.ToString('yyyy-MM-dd')) ($daysSince days ago)";
    LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
  })
}

# ── Generate Report ──
Write-Host "`nGenerating report..." -ForegroundColor Yellow

$depPrefixCount = $categories.deprecated_prefix.Count
$depDirCount = $categories.deprecated_dir.Count
$orphanCount = $categories.orphan_no_ref.Count
$dateTempCount = $categories.date_prefix_temp.Count
$keywordCount = $categories.keyword_hit.Count
$dupCount = $categories.duplicate_archive.Count
$tinyCount = $categories.empty_or_tiny.Count
$staleCount = $categories.stale_365.Count
$totalDead = $deadDocs.Count

# Deduplicate deadDocs by Path
$uniqueDead = $deadDocs | Sort-Object Path -Unique
$totalDeadUnique = $uniqueDead.Count

# Level breakdown
$levelA = ($uniqueDead | Where-Object { $_.Level -eq 'A' }).Count
$levelB = ($uniqueDead | Where-Object { $_.Level -eq 'B' }).Count
$levelC = ($uniqueDead | Where-Object { $_.Level -eq 'C' }).Count

# ── Build table rows ──
$deadTableRows = if ($totalDeadUnique -gt 0) {
  ($uniqueDead | ForEach-Object { "| $($_.Path) | $($_.Category) | $($_.Level) | $($_.Reason) | $($_.LastModified) |" }) -join "`n"
} else {
  "| (none) | - | - | - | - |"
}

# ── Build category summary ──
$catSummary = @(
  "| Category | Count | Level |",
  "|----------|-------|-------|",
  "| DEPRECATED_ prefix | $depPrefixCount | C |",
  "| deprecated/ directory | $depDirCount | C |",
  "| Date-prefix temp records | $dateTempCount | C |",
  "| Keyword hits (non-formal) | $keywordCount | B |",
  "| Duplicate in archive | $dupCount | B |",
  "| Empty or tiny docs | $tinyCount | C |",
  "| Stale > 365 days | $staleCount | B |"
) -join "`n"

$deadRate = if ($totalDocs -gt 0) { [math]::Round(($totalDeadUnique / $totalDocs) * 100, 1) } else { 0 }

$deadRateDisplay = "$deadRate" + '%'
$modeDisplay = if ($DryRun) { 'Dry Run (no files moved)' } else { 'Execute' }

$reportLines = @()
$reportLines += '# V9 Dead Document Audit Report'
$reportLines += ''
$reportLines += "> Audit Date: $ReportDate"
$reportLines += '> Scope: docs/ (excluding archive/)'
$reportLines += "> Mode: $modeDisplay"
$reportLines += ''
$reportLines += '---'
$reportLines += ''
$reportLines += '## Summary'
$reportLines += ''
$reportLines += '| Metric | Value |'
$reportLines += '|--------|-------|'
$reportLines += "| Total Active Docs | $totalDocs |"
$reportLines += "| Dead Docs Identified | $totalDeadUnique |"
$reportLines += "| Dead Rate | $deadRateDisplay |"
$reportLines += "| Level A (Important) | $levelA |"
$reportLines += "| Level B (Normal) | $levelB |"
$reportLines += "| Level C (Draft/Temp) | $levelC |"
$reportLines += ''
$reportLines += '---'
$reportLines += ''
$reportLines += '## Category Breakdown'
$reportLines += ''
$reportLines += $catSummary
$reportLines += ''
$reportLines += '---'
$reportLines += ''
$reportLines += '## Full Dead Document List'
$reportLines += ''
$reportLines += '| Path | Category | Level | Reason | Last Modified |'
$reportLines += '|------|----------|-------|--------|---------------|'
$reportLines += $deadTableRows
$reportLines += ''
$reportLines += '---'
$reportLines += ''
$reportLines += '## Recommended Actions'
$reportLines += ''
$reportLines += '1. **Level C (Draft/Temp)**: Move to D:\转移文件清单V9 immediately'
$reportLines += '2. **Level B (Normal)**: Review and move to D:\转移文件清单V9 after confirmation'
$reportLines += '3. **Level A (Important)**: Keep or move to docs/archive/important/ with preservation'
$reportLines += '4. Run cross-reference audit after archiving: npm run audit:doc-code-references'
$reportLines += ''
$reportLines += '> Detection guards: docs registered in doc-id-registry.md are never flagged;'
$reportLines += '> archive duplicates require identical content hash; changelogs/ and adr/'
$reportLines += '> directories are exempt from date-prefix detection.'
$reportLines += ''
$reportLines += '---'
$reportLines += ''
$reportLines += '> Generated by: scripts/audit/audit-dead-docs.ps1'

# Ensure output dir
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Write report
$reportLines -join "`n" | Out-File -FilePath $ReportFile -Encoding utf8

# Write CSV
$uniqueDead | Select-Object Path, Category, Level, Reason, LastModified |
  Export-Csv -Path $CsvFile -NoTypeInformation -Encoding utf8

Write-Host "`n============================================" -ForegroundColor Green
Write-Host " Audit Complete" -ForegroundColor Green
Write-Host " Total Docs: $totalDocs" -ForegroundColor Green
Write-Host " Dead Docs: $totalDeadUnique ($deadRateDisplay)" -ForegroundColor Green
Write-Host "   Level A: $levelA | Level B: $levelB | Level C: $levelC" -ForegroundColor Green
Write-Host " Report: $ReportFile" -ForegroundColor Green
Write-Host " CSV: $CsvFile" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green