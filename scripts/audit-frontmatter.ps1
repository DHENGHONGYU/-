$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs') -Recurse -Include "*.md" -File | 
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.git\\" -and $_.FullName -notmatch "\\ai-index\\" }

$total = $docs.Count
$hasFrontmatter = 0
$fieldCounts = @{}
$titleCount = 0
$versionCount = 0
$dateCount = 0
$typeCount = 0
$domainCount = 0
$phaseCount = 0
$statusCount = 0
$tagsCount = 0
$changelogCount = 0
$summaryCount = 0
$maintainerCount = 0
$tierCount = 0
$docIdCount = 0
$codeVersionCount = 0
$deprecatedByCount = 0

$noFMDocs = @()

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring(((Join-Path (Split-Path $PSScriptRoot -Parent) 'docs').Length + 1)).Replace("\", "/")
    try {
        $content = Get-Content $doc.FullName -Raw -Encoding UTF8
        if ($content -match '^---\s*\n([\s\S]*?)\n---') {
            $hasFrontmatter++
            $fm = $matches[1]
            
            if ($fm -match '(?m)^title:\s*.+') { $titleCount++ }
            if ($fm -match '(?m)^version:\s*.+') { $versionCount++ }
            if ($fm -match '(?m)^last_updated:\s*.+') { $dateCount++ }
            if ($fm -match '(?m)^type:\s*.+') { $typeCount++ }
            if ($fm -match '(?m)^domain:\s*.+') { $domainCount++ }
            if ($fm -match '(?m)^phase:\s*.+') { $phaseCount++ }
            if ($fm -match '(?m)^status:\s*.+') { $statusCount++ }
            if ($fm -match '(?m)^tags:\s*.+') { $tagsCount++ }
            if ($fm -match '(?m)^change_log:|change-log:|changelog:') { $changelogCount++ }
            if ($fm -match '(?m)^summary:\s*.+') { $summaryCount++ }
            if ($fm -match '(?m)^maintainer:\s*.+') { $maintainerCount++ }
            if ($fm -match '(?m)^tier:\s*.+') { $tierCount++ }
            if ($fm -match '(?m)^doc_id:\s*.+') { $docIdCount++ }
            if ($fm -match '(?m)^code_version:\s*.+') { $codeVersionCount++ }
            if ($fm -match '(?m)^deprecated_by:') { $deprecatedByCount++ }
            
            $lines = $fm -split "`n"
            foreach ($line in $lines) {
                if ($line -match '^(\w[\w-]*):\s*.+') {
                    $field = $matches[1].ToLower()
                    if (-not $fieldCounts.ContainsKey($field)) { $fieldCounts[$field] = 0 }
                    $fieldCounts[$field]++
                }
            }
        } else {
            $noFMDocs += $relPath
        }
    } catch {}
}

Write-Host "===== 元数据现状报告 ====="
Write-Host "文档总数: $total"
Write-Host "有 Frontmatter: $hasFrontmatter ($([math]::Round($hasFrontmatter/$total*100, 1))%)"
Write-Host "无 Frontmatter: $($total - $hasFrontmatter) ($([math]::Round(($total-$hasFrontmatter)/$total*100, 1))%)"
Write-Host ""
Write-Host "===== 各字段覆盖率 ====="
Write-Host "title: $titleCount ($([math]::Round($titleCount/$total*100, 1))%)"
Write-Host "version: $versionCount ($([math]::Round($versionCount/$total*100, 1))%)"
Write-Host "last_updated: $dateCount ($([math]::Round($dateCount/$total*100, 1))%)"
Write-Host "type: $typeCount ($([math]::Round($typeCount/$total*100, 1))%)"
Write-Host "domain: $domainCount ($([math]::Round($domainCount/$total*100, 1))%)"
Write-Host "phase: $phaseCount ($([math]::Round($phaseCount/$total*100, 1))%)"
Write-Host "status: $statusCount ($([math]::Round($statusCount/$total*100, 1))%)"
Write-Host "tags: $tagsCount ($([math]::Round($tagsCount/$total*100, 1))%)"
Write-Host "change_log: $changelogCount ($([math]::Round($changelogCount/$total*100, 1))%)"
Write-Host "summary: $summaryCount ($([math]::Round($summaryCount/$total*100, 1))%)"
Write-Host "maintainer: $maintainerCount ($([math]::Round($maintainerCount/$total*100, 1))%)"
Write-Host "tier: $tierCount ($([math]::Round($tierCount/$total*100, 1))%)"
Write-Host "doc_id: $docIdCount ($([math]::Round($docIdCount/$total*100, 1))%)"
Write-Host "code_version: $codeVersionCount ($([math]::Round($codeVersionCount/$total*100, 1))%)"
Write-Host ""
Write-Host "===== 所有出现过的字段（Top 20）====="
$fieldCounts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 20 | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Value) ($([math]::Round($_.Value/$total*100, 1))%)"
}
Write-Host ""
Write-Host "===== 无 Frontmatter 的文档（前 20 个）====="
$noFMDocs | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
Write-Host "..."
Write-Host "共 $($noFMDocs.Count) 份文档无 Frontmatter"

