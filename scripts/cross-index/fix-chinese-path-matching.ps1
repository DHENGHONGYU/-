$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$basePath = (Get-Location).Path + "\"

$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs", "*.md", [System.IO.SearchOption]::AllDirectories))
$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)

foreach ($fullPath in $allFsPaths) {
    $relPath = $fullPath.Substring($basePath.Length) -replace '\\', '/'
    $fsPathSet[$relPath] = $fullPath
}
Write-Host "Filesystem paths loaded: $($fsPathSet.Count)"

$masterIndexPath = "docs/00-meta/ai-index/master-index.json"
$content = [System.IO.File]::ReadAllText((Resolve-Path $masterIndexPath).Path, $utf8NoBom)
$masterIndex = $content | ConvertFrom-Json

$indexPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $doc = $masterIndex.documents.$($prop.Name)
    $indexPathSet[$doc.path] = $prop.Name
}
Write-Host "Index paths loaded: $($indexPathSet.Count)"

Write-Host ""
Write-Host "=== Paths in index but NOT on filesystem ==="
$missingInFs = @()
foreach ($path in $indexPathSet.Keys) {
    if (-not $fsPathSet.ContainsKey($path)) {
        $missingInFs += $path
        Write-Host "  $path"
    }
}
Write-Host "Total: $($missingInFs.Count)"

Write-Host ""
Write-Host "=== Paths on filesystem but NOT in index ==="
$missingInIndex = @()
foreach ($path in $fsPathSet.Keys) {
    if (-not $indexPathSet.ContainsKey($path)) {
        $missingInIndex += $path
        Write-Host "  $path"
    }
}
Write-Host "Total: $($missingInIndex.Count)"