$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
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
        
        $fullPath = Join-Path (Get-Location).Path $resolved
        $exists = [System.IO.File]::Exists($fullPath)
        
        if (-not $exists) {
            $missingLinks += @{
                source = $srcDocId
                rawLink = $rawLink
                resolved = $resolved
                exists = $exists
            }
        }
    }
}

Write-Host "Total active missing_file links: $($missingLinks.Count)"
Write-Host ""

$grouped = $missingLinks | Group-Object { $_.resolved } | Sort-Object Count -Descending
foreach ($group in $grouped) {
    Write-Host "$($group.Count) links -> $($group.Name)"
    $sources = $group.Group.source | Select-Object -Unique
    foreach ($src in $sources) {
        Write-Host "  - $src"
    }
    Write-Host ""
}