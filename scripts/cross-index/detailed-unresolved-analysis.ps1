$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$relationContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationContent | ConvertFrom-Json

$masterContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterContent | ConvertFrom-Json

$allDocs = @{}
Get-ChildItem -Path "docs" -Filter "*.md" -Recurse -File | ForEach-Object {
    $relPath = $_.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
    $allDocs[$relPath.ToLower()] = $relPath
}

$filenameIndex = @{}
foreach ($path in $allDocs.Keys) {
    $filename = [System.IO.Path]::GetFileName($path)
    if (-not $filenameIndex.ContainsKey($filename)) {
        $filenameIndex[$filename] = @()
    }
    $filenameIndex[$filename] += $allDocs[$path]
}

$categories = @{
    deleted_file = @()
    renamed_file = @()
    wrong_path = @()
    query_params = @()
    chinese_url_encoded = @()
    chinese_filename = @()
    other = @()
}

foreach ($prop in Get-Member -InputObject $relationIndex.unresolved_links -MemberType NoteProperty) {
    $srcPath = $prop.Name
    $links = $relationIndex.unresolved_links.$srcPath
    
    foreach ($linkObj in $links) {
        $rawLink = if ($linkObj -is [string]) { $linkObj } else { $linkObj.link }
        $resolved = if ($linkObj -is [string]) { $linkObj } else { $linkObj.resolved }
        
        $isQuery = $rawLink -match '\?' -or $resolved -match '\?'
        $isChinese = $rawLink -match '[\u4e00-\u9fff]' -or $resolved -match '[\u4e00-\u9fff]'
        $isEncoded = $resolved -match '%[0-9A-Fa-f]{2}'
        
        if ($isQuery) {
            $categories['query_params'] += @{
                source = $srcPath
                raw = $rawLink
                resolved = $resolved
            }
        } elseif ($isEncoded) {
            $decoded = [System.Uri]::UnescapeDataString($resolved)
            $categories['chinese_url_encoded'] += @{
                source = $srcPath
                raw = $rawLink
                resolved = $resolved
                decoded = $decoded
                exists = $allDocs.ContainsKey($decoded.ToLower())
            }
        } elseif ($isChinese) {
            $categories['chinese_filename'] += @{
                source = $srcPath
                raw = $rawLink
                resolved = $resolved
                exists = $allDocs.ContainsKey($resolved.ToLower())
            }
        } else {
            $fileExists = $allDocs.ContainsKey($resolved.ToLower())
            
            if ($fileExists) {
                $categories['wrong_path'] += @{
                    source = $srcPath
                    raw = $rawLink
                    resolved = $resolved
                    actual_path = $allDocs[$resolved.ToLower()]
                }
            } else {
                $filename = [System.IO.Path]::GetFileName($resolved)
                $similarFiles = if ($filenameIndex.ContainsKey($filename)) { $filenameIndex[$filename] } else { @() }
                
                if ($similarFiles.Count -gt 0) {
                    $categories['renamed_file'] += @{
                        source = $srcPath
                        raw = $rawLink
                        resolved = $resolved
                        similar_files = $similarFiles
                    }
                } else {
                    $categories['deleted_file'] += @{
                        source = $srcPath
                        raw = $rawLink
                        resolved = $resolved
                    }
                }
            }
        }
    }
}

Write-Host "=== Unresolved Links Detailed Breakdown ==="
Write-Host ""

foreach ($key in $categories.Keys) {
    Write-Host "--- $key ($($categories[$key].Count)) ---"
    $count = 0
    foreach ($item in $categories[$key]) {
        Write-Host "  Source: $($item.source)"
        Write-Host "    Raw: $($item.raw)"
        Write-Host "    Resolved: $($item.resolved)"
        if ($item.ContainsKey('decoded')) {
            Write-Host "    Decoded: $($item.decoded) (exists: $($item.exists))"
        }
        if ($item.ContainsKey('exists')) {
            Write-Host "    Exists: $($item.exists)"
        }
        if ($item.ContainsKey('actual_path')) {
            Write-Host "    Actual: $($item.actual_path)"
        }
        if ($item.ContainsKey('similar_files')) {
            Write-Host "    Similar files:"
            foreach ($sf in $item.similar_files) {
                Write-Host "      - $sf"
            }
        }
        Write-Host ""
        $count++
        if ($count -ge 5) { break }
    }
    Write-Host ""
}

Write-Host "=== Summary ==="
Write-Host "Total unresolved: $($categories.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum"
foreach ($key in $categories.Keys) {
    Write-Host "  $key : $($categories[$key].Count)"
}