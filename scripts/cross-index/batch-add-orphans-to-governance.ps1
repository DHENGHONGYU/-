$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$masterContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterContent | ConvertFrom-Json

$relationContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationContent | ConvertFrom-Json

$activeOrphans = @()
foreach ($orphan in $relationIndex.orphans) {
    $docId = $orphan.doc_id
    if ($masterIndex.documents.PSObject.Properties[$docId]) {
        $doc = $masterIndex.documents.$docId
        if ($doc.status -eq "active") {
            $activeOrphans += @{
                doc_id = $docId
                path = $doc.path
                title = $doc.title
                tier = $doc.tier
            }
        }
    }
}

Write-Host "Found $($activeOrphans.Count) active orphans"

$governancePath = "docs/00-meta/GOVERNANCE.md"
$content = [System.IO.File]::ReadAllText((Resolve-Path $governancePath).Path, $utf8NoBom)

$sectionTitle = "## Standalone Reference Documents"
$sectionMarker = "<!-- END_STANDALONE_REFS -->"

if ($content -match [regex]::Escape($sectionMarker)) {
    $content = $content -replace "(?ms)$([regex]::Escape($sectionTitle)).*?$([regex]::Escape($sectionMarker))", "$sectionTitle`n"
}

$refs = @{}
foreach ($orphan in $activeOrphans) {
    $relPath = $orphan.path -replace '^docs/', ''
    $filename = [System.IO.Path]::GetFileNameWithoutExtension($relPath)
    $title = $filename
    $tier = if ($orphan.tier) { " ($($orphan.tier))" } else { "" }
    if (-not $refs.ContainsKey($relPath)) {
        $refs[$relPath] = "- [$title$tier]($relPath)"
    }
}

$sectionContent = "$sectionTitle`n`nThese documents are intentionally standalone and have no incoming links:`n`n" + ($refs.Values -join "`n") + "`n`n$sectionMarker`n"

if ($content -match [regex]::Escape($sectionMarker)) {
    $content = $content -replace [regex]::Escape($sectionMarker), $sectionContent
} else {
    $content = $content + "`n`n" + $sectionContent
}

[System.IO.File]::WriteAllText((Resolve-Path $governancePath).Path, $content, $utf8NoBom)
Write-Host "Added $($activeOrphans.Count) active orphans to GOVERNANCE.md"