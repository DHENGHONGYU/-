$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$basePath = (Get-Location).Path + "\"

$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs", "*.md", [System.IO.SearchOption]::AllDirectories))
foreach ($fullPath in $allFsPaths) {
    $relPath = [System.Text.RegularExpressions.Regex]::Replace($fullPath.Substring($basePath.Length), '\\', '/')
    $fsPathSet[$relPath] = $fullPath
}

$masterIndexPath = "docs/00-meta/ai-index/master-index.json"
$masterContent = [System.IO.File]::ReadAllText((Resolve-Path $masterIndexPath).Path, $utf8NoBom)
$masterIndex = $masterContent | ConvertFrom-Json

$docIdToTier = @{}
$docIdToPath = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $doc = $masterIndex.documents.$($prop.Name)
    if ($doc.doc_id) {
        $docIdToTier[$doc.doc_id] = if ($doc.tier) { $doc.tier } else { "unknown" }
        $docIdToPath[$doc.doc_id] = $doc.path
    }
}

$relationIndexPath = "docs/00-meta/ai-index/relation-index.json"
$content = [System.IO.File]::ReadAllText((Resolve-Path $relationIndexPath).Path, $utf8NoBom)
$relationIndex = $content | ConvertFrom-Json

$missingLinks = @()
foreach ($prop in Get-Member -InputObject $relationIndex.active_unresolved -MemberType NoteProperty) {
    $srcDocId = $prop.Name
    $links = $relationIndex.active_unresolved.$srcDocId
    foreach ($linkObj in $links) {
        $rawLink = $linkObj.link
        $resolved = $linkObj.resolved
        
        $fullPathCheck = Join-Path (Get-Location).Path $resolved
        if (-not [System.IO.File]::Exists($fullPathCheck)) {
            $tier = if ($docIdToTier.ContainsKey($srcDocId)) { $docIdToTier[$srcDocId] } else { "unknown" }
            $srcPath = if ($docIdToPath.ContainsKey($srcDocId)) { $docIdToPath[$srcDocId] } else { $srcDocId }
            
            $missingLinks += @{
                sourceDocId = $srcDocId
                sourceTier = $tier
                sourcePath = $srcPath
                rawLink = $rawLink
                resolved = $resolved
            }
        }
    }
}

$groupedByTier = $missingLinks | Group-Object { $_.sourceTier } | Sort-Object Count -Descending

Write-Host "Total missing_file links: $($missingLinks.Count)"
Write-Host ""

foreach ($group in $groupedByTier) {
    Write-Host "=== Tier: $($group.Name) ($($group.Count) links) ==="
    
    $groupedBySource = $group.Group | Group-Object { $_.sourceDocId } | Sort-Object Count -Descending
    foreach ($sourceGroup in $groupedBySource) {
        $srcPath = $sourceGroup.Group[0].sourcePath
        Write-Host "  $($sourceGroup.Count) links -> $srcPath"
    }
    Write-Host ""
}