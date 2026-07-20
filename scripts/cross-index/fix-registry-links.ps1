$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$basePath = (Get-Location).Path + "\"

$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs", "*.md", [System.IO.SearchOption]::AllDirectories))
foreach ($fullPath in $allFsPaths) {
    $relPath = $fullPath.Substring($basePath.Length) -replace '\\', '/'
    $fsPathSet[$relPath] = $fullPath
}

$filePath = "docs/00-meta/registry-index.md"
$fullPath = Join-Path (Get-Location).Path $filePath
$bytes = [System.IO.File]::ReadAllBytes($fullPath)
$utf8Str = $utf8NoBom.GetString($bytes)

$links = [regex]::Matches($utf8Str, '\[([^\]]+)\]\(([^)\s]+)\)')
$fixedCount = 0

foreach ($link in $links) {
    $text = $link.Groups[1].Value
    $rawPath = $link.Groups[2].Value
    
    if (-not ($rawPath -match '^https?://') -and $rawPath -match '\.md') {
        $resolvedPath = $rawPath
        
        if (-not $resolvedPath.StartsWith('docs/')) {
            $resolvedPath = "docs/00-meta/" + $resolvedPath
        }
        
        $exists = $fsPathSet.ContainsKey($resolvedPath)
        
        if (-not $exists) {
            $filename = [System.IO.Path]::GetFileName($resolvedPath)
            
            $archivePath = "docs/archive/00-meta-historical/" + $filename
            if ($fsPathSet.ContainsKey($archivePath)) {
                $newLink = "[${text}](${archivePath})"
                $oldLink = "[${text}](${rawPath})"
                
                if ($utf8Str.Contains($oldLink)) {
                    $utf8Str = $utf8Str.Replace($oldLink, $newLink)
                    $fixedCount++
                    Write-Host "Fixed: $rawPath -> $archivePath"
                }
            } else {
                $altPath = "docs/archive/" + $filename
                if ($fsPathSet.ContainsKey($altPath)) {
                    $newLink = "[${text}](${altPath})"
                    $oldLink = "[${text}](${rawPath})"
                    
                    if ($utf8Str.Contains($oldLink)) {
                        $utf8Str = $utf8Str.Replace($oldLink, $newLink)
                        $fixedCount++
                        Write-Host "Fixed: $rawPath -> $altPath"
                    }
                } else {
                    foreach ($key in $fsPathSet.Keys) {
                        if ($key.EndsWith("/$filename", [System.StringComparison]::OrdinalIgnoreCase)) {
                            $newLink = "[${text}](${key})"
                            $oldLink = "[${text}](${rawPath})"
                            
                            if ($utf8Str.Contains($oldLink)) {
                                $utf8Str = $utf8Str.Replace($oldLink, $newLink)
                                $fixedCount++
                                Write-Host "Fixed: $rawPath -> $key"
                            }
                            break
                        }
                    }
                }
            }
        }
    }
}

[System.IO.File]::WriteAllText($fullPath, $utf8Str, $utf8NoBom)
Write-Host ""
Write-Host "Total links fixed: $fixedCount"