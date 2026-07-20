$utf8Bom = New-Object System.Text.UTF8Encoding($true)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$basePath = (Get-Location).Path + "\"

$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs/_pending-review", "*.md", [System.IO.SearchOption]::AllDirectories))
foreach ($fullPath in $allFsPaths) {
    $relPath = [System.Text.RegularExpressions.Regex]::Replace($fullPath.Substring($basePath.Length), '\\', '/')
    $fsPathSet[$relPath] = $fullPath
}

$sourceRelPath = "docs/00-meta/GOVERNANCE.md"
$rawPath = "../_pending-review/23个核心文档重新检索报告.md"

$sourceDirParts = $sourceRelPath.Split('/') | Where-Object { $_ }
if ($sourceDirParts.Length -gt 1) {
    $sourceDirParts = $sourceDirParts[0..($sourceDirParts.Length - 2)]
}
$sourceDir = [string]::Join('/', $sourceDirParts)

$linkParts = $rawPath.Split('/') | Where-Object { $_ }

$stack = @()
if ($sourceDir) {
    $stack = $sourceDir.Split('/') | Where-Object { $_ }
}

foreach ($part in $linkParts) {
    if ($part -eq '..') {
        if ($stack.Count -gt 1) {
            $stack = $stack[0..($stack.Count - 2)]
        }
    } elseif ($part -eq '.') {
        continue
    } else {
        $stack += $part
    }
}

$resolvedPath = [string]::Join('/', $stack)
Write-Host "Resolved path: $resolvedPath"
Write-Host "Exists in fsPathSet: $($fsPathSet.ContainsKey($resolvedPath))"