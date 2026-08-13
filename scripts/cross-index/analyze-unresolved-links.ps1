<#
.SYNOPSIS
  Analyze unresolved links and categorize them
#>

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Loading relation-index.json..."
$relationIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationIndexContent | ConvertFrom-Json

$unresolved = @{}
foreach ($prop in Get-Member -InputObject $relationIndex.unresolved_links -MemberType NoteProperty) {
    $srcPath = $prop.Name
    $links = $relationIndex.unresolved_links.$srcPath
    foreach ($linkObj in $links) {
        $rawLink = if ($linkObj -is [string]) { $linkObj } else { $linkObj.link }
        $resolvedLink = if ($linkObj -is [string]) { $linkObj } else { $linkObj.resolved }
        
        if (-not $unresolved.ContainsKey($resolvedLink)) {
            $unresolved[$resolvedLink] = @{ count = 0; sources = @(); raw = $rawLink }
        }
        $unresolved[$resolvedLink].count++
        if ($unresolved[$resolvedLink].sources -notcontains $srcPath) {
            $unresolved[$resolvedLink].sources += $srcPath
        }
    }
}

$categories = @{
    'external' = @()
    'nonexistent' = @()
    'json_file' = @()
    'typo' = @()
    'other' = @()
}

foreach ($link in $unresolved.Keys) {
    if ($link -match '^https?://') {
        $categories['external'] += @{ link = $link; count = $unresolved[$link].count }
    } elseif ($link -match '\.json$') {
        $categories['json_file'] += @{ link = $link; count = $unresolved[$link].count }
    } elseif ($link -match '\)$') {
        $categories['typo'] += @{ link = $link; count = $unresolved[$link].count }
    } else {
        try {
            if (Test-Path $link -ErrorAction Stop) {
                $categories['other'] += @{ link = $link; count = $unresolved[$link].count }
            } else {
                $categories['nonexistent'] += @{ link = $link; count = $unresolved[$link].count }
            }
        } catch {
            $categories['nonexistent'] += @{ link = $link; count = $unresolved[$link].count }
        }
    }
}

Write-Host ""
Write-Host "========== Unresolved Links Analysis =========="
Write-Host "Total unresolved: $($unresolved.Count) unique links"
Write-Host ""
Write-Host "=== Category Breakdown ==="
Write-Host "External URLs: $($categories['external'].Count)"
Write-Host "Non-existent files: $($categories['nonexistent'].Count)"
Write-Host "JSON files (not MD): $($categories['json_file'].Count)"
Write-Host "Typo (trailing paren): $($categories['typo'].Count)"
Write-Host "Other: $($categories['other'].Count)"

Write-Host ""
Write-Host "=== Top 20 Non-existent Files ==="
$categories['nonexistent'] | Sort-Object count -Descending | Select-Object -First 20 | ForEach-Object {
    Write-Host "  $($_.count)x - $($_.link)"
}

Write-Host ""
Write-Host "=== JSON Files ==="
$categories['json_file'] | ForEach-Object {
    Write-Host "  $($_.count)x - $($_.link)"
}
