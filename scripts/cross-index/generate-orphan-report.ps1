<#
.SYNOPSIS
  Generate orphan document report: docs with no referenced_by + 30+ days not modified
#>
param([string]$OutputPath = "docs/reports/audit/orphans-$(Get-Date -Format 'yyyy-MM-dd').md")

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Loading relation-index.json..."
$relationIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationIndexContent | ConvertFrom-Json

$orphans = @()
$thirtyDaysAgo = (Get-Date).AddDays(-30)

foreach ($prop in Get-Member -InputObject $relationIndex.links -MemberType NoteProperty) {
    $docId = $prop.Name
    $links = $relationIndex.links.$docId
    $incoming = if ($links.incoming) { @($links.incoming) } else { @() }

    if ($incoming.Count -eq 0) {
        $filePath = $links.path
        $fileInfo = Get-Item $filePath -ErrorAction SilentlyContinue
        $lastWrite = if ($fileInfo) { $fileInfo.LastWriteTime } else { $null }
        $isStale = if ($lastWrite -and $lastWrite -lt $thirtyDaysAgo) { $true } else { $false }
        
        $orphans += [ordered]@{
            doc_id = $docId
            path = $filePath
            outgoing_count = if ($links.outgoing) { @($links.outgoing).Count } else { 0 }
            last_modified = if ($lastWrite) { $lastWrite.ToString("yyyy-MM-dd") } else { "UNKNOWN" }
            is_stale = $isStale
        }
    }
}

$staleOrphans = $orphans | Where-Object { $_.is_stale }
$recentOrphans = $orphans | Where-Object { -not $_.is_stale }

$report = @"
---
title: Orphan Document Report $(Get-Date -Format 'yyyy-MM-dd')
type: report
domain: project
phase: testing
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Orphan documents report: docs with no incoming references (referenced_by)"
tags: [project, audit, documentation, governance, orphans]
version: v1.0.0
last_updated: $(Get-Date -Format 'yyyy-MM-dd')
doc_id: V9-DOC-QA-$(Get-Date -Format 'MMdd')
change_log:
  - version: v1.0.0
    changes: "Initial version"
    date: $(Get-Date -Format 'yyyy-MM-dd')
---

# Orphan Document Report

> **Generated**: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
> **Total orphans**: $($orphans.Count)
> **Stale orphans (>30 days)**: $($staleOrphans.Count)
> **Recent orphans**: $($recentOrphans.Count)

## Summary

| Category | Count | Description |
|----------|-------|-------------|
| Total orphans | $($orphans.Count) | Documents with no incoming references |
| Stale (>30 days) | $($staleOrphans.Count) | Candidate for status: deprecated |
| Recent | $($recentOrphans.Count) | May still be useful, needs review |

## Stale Orphans (Candidate for Deprecation)

These documents have no incoming references AND haven't been modified in over 30 days.
Consider marking them as `status: deprecated`.

| doc_id | path | outgoing links | last modified |
|--------|------|----------------|---------------|
"@

foreach ($o in $staleOrphans | Sort-Object last_modified) {
    $report += @"
| $($o.doc_id) | $($o.path) | $($o.outgoing_count) | $($o.last_modified) |
"@
}

$report += @"

## Recent Orphans

These documents have no incoming references but were modified recently.
They may still be useful or newly created.

| doc_id | path | outgoing links | last modified |
|--------|------|----------------|---------------|
"@

foreach ($o in $recentOrphans | Sort-Object last_modified -Descending) {
    $report += @"
| $($o.doc_id) | $($o.path) | $($o.outgoing_count) | $($o.last_modified) |
"@
}

$report += @"

## Recommendations

1. **Stale orphans**: Mark as `status: deprecated` after review
2. **Recent orphans**: Add cross-references from related documents
3. **Zero outgoing**: Consider merging or archiving if no links to other docs
"@

$outDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $outDir).Path + "\" + (Split-Path $OutputPath -Leaf), $report, $utf8NoBom)

Write-Host "Orphan report written to: $OutputPath"
Write-Host "Stale orphans: $($staleOrphans.Count)"
Write-Host "Recent orphans: $($recentOrphans.Count)"
