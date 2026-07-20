$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$basePath = (Get-Location).Path + "\"

$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs", "*.md", [System.IO.SearchOption]::AllDirectories))
foreach ($fullPath in $allFsPaths) {
    $relPath = $fullPath.Substring($basePath.Length) -replace '\\', '/'
    $fsPathSet[$relPath] = $fullPath
}

$relationIndexPath = "docs/00-meta/ai-index/relation-index.json"
$content = [System.IO.File]::ReadAllText((Resolve-Path $relationIndexPath).Path, $utf8NoBom)
$relationIndex = $content | ConvertFrom-Json

$chineseLinks = @()
foreach ($prop in Get-Member -InputObject $relationIndex.active_unresolved -MemberType NoteProperty) {
    $srcDocId = $prop.Name
    $links = $relationIndex.active_unresolved.$srcDocId
    foreach ($linkObj in $links) {
        $rawLink = $linkObj.link
        $resolved = $linkObj.resolved
        
        if ($resolved -match '[\u4e00-\u9fff]') {
            $filename = [System.IO.Path]::GetFileName($resolved)
            
            $found = $false
            foreach ($key in $fsPathSet.Keys) {
                if ($key.EndsWith("/$filename", [System.StringComparison]::OrdinalIgnoreCase)) {
                    $found = $true
                    Write-Host "FOUND match: $resolved -> $key"
                    break
                }
            }
            
            if (-not $found) {
                $chineseLinks += @{
                    source = $srcDocId
                    resolved = $resolved
                    filename = $filename
                }
            }
        }
    }
}

Write-Host ""
Write-Host "Total Chinese links NOT found: $($chineseLinks.Count)"

if ($chineseLinks.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Missing Chinese links ==="
    foreach ($link in $chineseLinks) {
        Write-Host "Source: $($link.source)"
        Write-Host "Resolved: $($link.resolved)"
        Write-Host "Filename: $($link.filename)"
        Write-Host ""
    }
}