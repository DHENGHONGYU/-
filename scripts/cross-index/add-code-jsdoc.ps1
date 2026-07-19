<#
.SYNOPSIS
  Batch add @doc JSDoc tags to src/ files
.DESCRIPTION
  Reads code-doc-index.json and adds @doc tags to each src file
  Limits to max 5 docs per file (by tier priority)
#>
param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$tierPriority = @{ 'important' = 3; 'reference' = 2; 'standard' = 1; 'quick-note' = 0 }

Write-Host "Loading master-index.json for tier info..."
$masterIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterIndexContent | ConvertFrom-Json

$docIdToTier = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $docId = if ($doc.doc_id) { $doc.doc_id } else { $key }
    $tier = if ($doc.tier) { $doc.tier } else { 'standard' }
    $docIdToTier[$docId] = $tier
}

Write-Host "Loading code-doc-index.json..."
$codeDocIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/code-doc-index.json").Path, $utf8NoBom)
$codeDocIndex = $codeDocIndexContent | ConvertFrom-Json

$codeToDocs = @{}
foreach ($prop in Get-Member -InputObject $codeDocIndex.code_to_docs -MemberType NoteProperty) {
    $path = $prop.Name
    $data = $codeDocIndex.code_to_docs.$path
    $codeToDocs[$path] = $data
}
Write-Host "Loaded $($codeToDocs.Count) code->docs mappings"

$modified = 0
$skipped = 0

foreach ($relPath in $codeToDocs.Keys) {
    $data = $codeToDocs[$relPath]
    $coveredDocs = if ($data.covered_docs) { @($data.covered_docs) } else { @() }

    $coveredDocs = $coveredDocs | Where-Object { $_ -match "^V9-DOC-\w+-\d{3}$" }

    if ($coveredDocs.Count -gt 5) {
        $sorted = $coveredDocs | ForEach-Object {
            [PSCustomObject]@{
                doc_id = $_
                tier_priority = if ($docIdToTier.ContainsKey($_)) { $tierPriority[$docIdToTier[$_]] } else { 0 }
            }
        } | Sort-Object tier_priority -Descending | Select-Object -First 5
        $coveredDocs = $sorted.doc_id
    }

    if (-not (Test-Path $relPath)) {
        $skipped++; continue
    }

    $content = [System.IO.File]::ReadAllText((Resolve-Path $relPath).Path, $utf8NoBom)

    if ($content -match "^/\*\*") {
        if ($content -match "@doc\s+\[.+?\]") {
            $docList = $coveredDocs -join ", "
            $content = $content -replace "@doc\s+\[.+?\]", "@doc [$docList]"
        } else {
            $openingEnd = $content.IndexOf("*/")
            if ($openingEnd -gt 0) {
                $docList = $coveredDocs -join ", "
                $insertText = " * @doc [$docList]`n"
                $content = $content.Substring(0, $openingEnd) + $insertText + $content.Substring($openingEnd)
            }
        }
    } else {
        $docList = $coveredDocs -join ", "
        $jsdoc = "/**`n"
        $jsdoc += " * @doc [$docList]`n"
        $jsdoc += " */`n"
        $content = $jsdoc + $content
    }

    if ($DryRun) {
        Write-Host "[DRY] $relPath : @doc=$($coveredDocs.Count)"
    } else {
        [System.IO.File]::WriteAllText((Resolve-Path $relPath).Path, $content, $utf8NoBom)
        Write-Host "[OK] $relPath : @doc=$($coveredDocs.Count)"
    }
    $modified++
}

Write-Host ""
Write-Host "========== JSDoc Tags Added =========="
Write-Host "Modified: $modified"
Write-Host "Skipped: $skipped"
