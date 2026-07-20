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

$chineseLinks = @()
foreach ($prop in Get-Member -InputObject $relationIndex.active_unresolved -MemberType NoteProperty) {
    $srcDocId = $prop.Name
    $links = $relationIndex.active_unresolved.$srcDocId
    foreach ($linkObj in $links) {
        $rawLink = $linkObj.link
        $resolved = $linkObj.resolved
        
        $hasChinese = $false
        $rawBytes = [System.Text.Encoding]::UTF8.GetBytes($rawLink)
        foreach ($b in $rawBytes) {
            if ($b -gt 127) {
                $hasChinese = $true
                break
            }
        }
        
        if ($hasChinese) {
            $filename = [System.IO.Path]::GetFileName($resolved)
            $found = $false
            
            foreach ($key in $fsPathSet.Keys) {
                $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($key)
                $nameBytes = [System.Text.Encoding]::UTF8.GetBytes($filename)
                $keyEndsWith = $keyBytes.Length -ge $nameBytes.Length
                if ($keyEndsWith) {
                    for ($i = 0; $i -lt $nameBytes.Length; $i++) {
                        if ($keyBytes[$keyBytes.Length - $nameBytes.Length + $i] -ne $nameBytes[$i]) {
                            $keyEndsWith = $false
                            break
                        }
                    }
                }
                if ($keyEndsWith) {
                    $found = $true
                    break
                }
            }
            
            if (-not $found) {
                $chineseLinks += @{
                    source = $srcDocId
                    resolved = $resolved
                    filename = $filename
                    found = $found
                }
            }
        }
    }
}

Write-Host "Total Chinese links NOT found: $($chineseLinks.Count)"
Write-Host ""

$uniqueFiles = $chineseLinks | Group-Object { $_.filename } | Sort-Object Count -Descending
Write-Host "Unique files (top 20):"
foreach ($group in $uniqueFiles) {
    Write-Host "$($group.Count) -> $($group.Name)"
}