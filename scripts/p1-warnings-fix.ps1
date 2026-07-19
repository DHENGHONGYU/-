param(
    [string]$DocsPath = "g:\FinSightV9\docs"
)
$ErrorActionPreference = "Stop"

function Get-Frontmatter($path) {
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fmText = $matches[1]
        $result = @{}
        foreach ($line in ($fmText -split "`r?`n")) {
            if ($line -match '^([a-z_]+)\s*:\s*(.*)$') {
                $key = $matches[1].Trim()
                $val = $matches[2].Trim()
                if ($val -match '^\[(.*)\]$') {
                    $arr = ($matches[1] -split ',' | ForEach-Object { $_.Trim() }) | Where-Object { $_ }
                    $result[$key] = $arr
                } else {
                    $result[$key] = $val -replace '^"', '' -replace '"$', ''
                }
            }
        }
        return $result
    }
    return $null
}

function Add-FrontmatterField($path, $fieldName, $fieldValue) {
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fmText = $matches[1]
        $fmLines = $fmText -split "`r?`n"
        $newFmLines = @()
        $fieldFound = $false
        $lastStatusLine = -1
        for ($i = 0; $i -lt $fmLines.Length; $i++) {
            $newFmLines += $fmLines[$i]
            if ($fmLines[$i] -match "^$fieldName\s*:") {
                $fieldFound = $true
            }
            if ($fmLines[$i] -match '^status\s*:') {
                $lastStatusLine = $i
            }
        }
        if (-not $fieldFound) {
            $insertIndex = [Math]::Max($lastStatusLine + 1, $newFmLines.Length)
            $newFmLines = $newFmLines[0..($insertIndex-1)] + "$fieldName`: $fieldValue" + $newFmLines[$insertIndex..($newFmLines.Length-1)]
        }
        $newFm = $newFmLines -join "`n"
        $newContent = $content -replace '(?s)^---\s*\r?\n.*?\r?\n---', "---`n$newFm`n---"
        Set-Content -Path $path -Value $newContent -Encoding UTF8 -NoNewline
        return $true
    }
    return $false
}

function Fix-Version($path, $currentVersion) {
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fmText = $matches[1]
        $newFmText = $fmText -replace "version:\s*$([regex]::Escape($currentVersion))", "version: v1.0.0"
        $newContent = $content -replace '(?s)^---\s*\r?\n.*?\r?\n---', "---`n$newFmText`n---"
        Set-Content -Path $path -Value $newContent -Encoding UTF8 -NoNewline
        return $true
    }
    return $false
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$fixedDeprecatedBy = 0
$fixedInvalidVersion = 0
$fixedMissingDocId = 0

$deprecatedMap = @{
    "deprecated-batch2-merge-report.md" = "Doc Restructure - Metadata Governance"
    "deprecated-v9-issue-resolution-schedule.md" = "V9 Bug Fix & Refactor Roadmap"
    "deprecated-batch1-merge-report.md" = "Doc Restructure - Metadata Governance"
    "deprecated-batch3-merge-report.md" = "Doc Restructure - Metadata Governance"
    "deprecated-cockpit-news-doc-correction-plan.md" = "Cockpit Doc Refactoring Plan"
    "deprecated-doc-sync-gap-list.md" = "Doc Sync Automation System"
    "deprecated-v9-parallel-task-schedule.md" = "V9 Parallel Task Scheduling"
    "deprecated-ui-module-alignment.md" = "UI Module Unification Plan"
    "data-definition-v1.0.0-cockpit.md" = "Cockpit Data Definition v2.0"
    "data-dictionary-index-v1.6.0.md" = "Data Dictionary Index v2.0"
    "deployment-v1.0.0.md" = "Deployment Guide v2.0"
    "registry-index-v1.0.0-02-design.md" = "registry-index.md (latest)"
    "regression-suite-v1.0.0.md" = "Regression Test Suite v2.0"
    "2026-07-05-p0-5-and-legacy-bugs-jira-tickets.md" = "Jira Ticket System Migration"
}

$docIdMap = @{
    "phase2-manual-task-list.md" = "V9-DOC-META-018"
    "registry-index.md" = "V9-DOC-META-000"
}

foreach ($doc in $docs) {
    $fm = Get-Frontmatter $doc.FullName
    if (-not $fm) { continue }
    
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $fileName = $doc.Name

    if ($fm.status -eq "deprecated" -and -not $fm.deprecated_by -and -not $fm.superseded_by) {
        $deprecatedBy = if ($deprecatedMap.ContainsKey($fileName)) { $deprecatedMap[$fileName] } else { "文档重构与元数据治理项目" }
        Add-FrontmatterField $doc.FullName "deprecated_by" "`"$deprecatedBy`""
        Write-Host "[DEPRECATED_BY] $relPath -> $deprecatedBy" -ForegroundColor Green
        $fixedDeprecatedBy++
    }

    if ($fm.version -and $fm.version -notmatch '^v\d+\.\d+\.\d+$') {
        $oldVersion = $fm.version
        Fix-Version $doc.FullName $oldVersion
        Write-Host "[INVALID_VERSION] $relPath -> $oldVersion -> v1.0.0" -ForegroundColor Cyan
        $fixedInvalidVersion++
    }

    if ($fm.tier -eq "important" -and -not $fm.doc_id) {
        if ($docIdMap.ContainsKey($fileName)) {
            $docId = $docIdMap[$fileName]
            Add-FrontmatterField $doc.FullName "doc_id" $docId
            Write-Host "[DOC_ID] $relPath -> $docId" -ForegroundColor Yellow
            $fixedMissingDocId++
        } else {
            Write-Host "[SKIP DOC_ID] $relPath (no mapping found)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Yellow
Write-Host "Fixed deprecated_by: $fixedDeprecatedBy"
Write-Host "Fixed invalid_version: $fixedInvalidVersion"
Write-Host "Fixed missing_doc_id: $fixedMissingDocId"
