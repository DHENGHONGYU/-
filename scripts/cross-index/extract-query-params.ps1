$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$basePath = (Get-Location).Path + "\"

$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs", "*.md", [System.IO.SearchOption]::AllDirectories))
foreach ($fullPath in $allFsPaths) {
    $relPath = [System.Text.RegularExpressions.Regex]::Replace($fullPath.Substring($basePath.Length), '\\', '/')
    $fsPathSet[$relPath] = $fullPath
}

$relationIndexPath = "docs/00-meta/ai-index/relation-index.json"
$content = [System.IO.File]::ReadAllText((Resolve-Path $relationIndexPath).Path, $utf8NoBom)
$relationIndex = $content | ConvertFrom-Json

$queryLinks = @()
foreach ($prop in Get-Member -InputObject $relationIndex.active_unresolved -MemberType NoteProperty) {
    $srcDocId = $prop.Name
    $links = $relationIndex.active_unresolved.$srcDocId
    foreach ($linkObj in $links) {
        $rawLink = $linkObj.link
        $resolved = $linkObj.resolved
        
        if ($rawLink -match '\?' -or $resolved -match '\?') {
            $basePathOnly = [System.Text.RegularExpressions.Regex]::Replace($resolved, '\?.*$', '')
            $exists = $fsPathSet.ContainsKey($basePathOnly)
            
            $queryLinks += @{
                source = $srcDocId
                rawLink = $rawLink
                resolved = $resolved
                basePath = $basePathOnly
                exists = $exists
            }
        }
    }
}

Write-Host "Total query_params links: $($queryLinks.Count)"
Write-Host ""

Write-Host "=== Resolved after stripping query params ==="
$resolvedCount = ($queryLinks | Where-Object { $_.exists }).Count
Write-Host "Resolved: $resolvedCount"
foreach ($link in $queryLinks | Where-Object { $_.exists }) {
    Write-Host "✓ $($link.basePath)"
}

Write-Host ""
Write-Host "=== Still unresolved ==="
$unresolvedCount = ($queryLinks | Where-Object { -not $_.exists }).Count
Write-Host "Unresolved: $unresolvedCount"
foreach ($link in $queryLinks | Where-Object { -not $_.exists }) {
    Write-Host "✗ $($link.basePath)"
}