<#
.SYNOPSIS
  Batch add @test_id and @covers_docs JSDoc tags to test files
.DESCRIPTION
  Reads test-doc-index.json and adds JSDoc tags to each test file
  Limits to max 5 docs per test (by tier priority)
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

Write-Host "Loading test-doc-index.json..."
$testDocIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/test-doc-index.json").Path, $utf8NoBom)
$testDocIndex = $testDocIndexContent | ConvertFrom-Json

$testToDocs = @{}
foreach ($prop in Get-Member -InputObject $testDocIndex.test_to_docs -MemberType NoteProperty) {
    $path = $prop.Name
    $data = $testDocIndex.test_to_docs.$path
    $testToDocs[$path] = $data
}
Write-Host "Loaded $($testToDocs.Count) test->docs mappings"

$modified = 0
$skipped = 0

foreach ($relPath in $testToDocs.Keys) {
    $data = $testToDocs[$relPath]
    $testId = $data.test_id
    $coveredDocs = if ($data.covered_docs) { @($data.covered_docs) } else { @() }

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
        if ($content -match "@test_id\s+V9-TEST-\w+-\d{3}") {
            $content = $content -replace "@test_id\s+V9-TEST-\w+-\d{3}", "@test_id $testId"
        } else {
            $firstLine = $content -split "`n" | Select-Object -First 1
            $insertPos = $content.IndexOf("`n", $firstLine.Length)
            if ($insertPos -gt 0) {
                $insertText = "`n * @test_id $testId"
                $content = $content.Substring(0, $insertPos) + $insertText + $content.Substring($insertPos)
            }
        }

        if ($content -match "@covers_docs\s+\[.+?\]") {
            $docList = $coveredDocs -join ", "
            $content = $content -replace "@covers_docs\s+\[.+?\]", "@covers_docs [$docList]"
        } else {
            $openingEnd = $content.IndexOf("*/")
            if ($openingEnd -gt 0) {
                $docList = $coveredDocs -join ", "
                $insertText = " * @covers_docs [$docList]`n"
                $content = $content.Substring(0, $openingEnd) + $insertText + $content.Substring($openingEnd)
            }
        }
    } else {
        $docList = $coveredDocs -join ", "
        $jsdoc = "/**`n"
        $jsdoc += " * @test_id $testId`n"
        $jsdoc += " * @covers_docs [$docList]`n"
        $jsdoc += " */`n"
        $content = $jsdoc + $content
    }

    if ($DryRun) {
        Write-Host "[DRY] $relPath : test_id=$testId, covers_docs=$($coveredDocs.Count)"
    } else {
        [System.IO.File]::WriteAllText((Resolve-Path $relPath).Path, $content, $utf8NoBom)
        Write-Host "[OK] $relPath : test_id=$testId, covers_docs=$($coveredDocs.Count)"
    }
    $modified++
}

Write-Host ""
Write-Host "========== JSDoc Tags Added =========="
Write-Host "Modified: $modified"
Write-Host "Skipped: $skipped"
