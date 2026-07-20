$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$basePath = (Get-Location).Path + "\"

$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs", "*.md", [System.IO.SearchOption]::AllDirectories))
foreach ($fullPath in $allFsPaths) {
    $relPath = $fullPath.Substring($basePath.Length) -replace '\\', '/'
    $fsPathSet[$relPath] = $fullPath
}

$sourceRelPath = "docs/00-meta/GOVERNANCE.md"
$rawPath = "../_pending-review/23个核心文档重新检索报告.md"

$sourceDirParts = [System.Linq.Enumerable]::ToArray([System.Linq.Enumerable]::Where([string[]]$sourceRelPath.Split('/'), [System.Func[string,bool]]{param($p) return $p -ne ''}))
if ($sourceDirParts.Length -gt 1) {
    $sourceDirParts = [System.Linq.Enumerable]::Take($sourceDirParts, $sourceDirParts.Length - 1)
}
$sourceDir = [string]::Join('/', $sourceDirParts)

$linkParts = [System.Linq.Enumerable]::ToArray([System.Linq.Enumerable]::Where([string[]]$rawPath.Split('/'), [System.Func[string,bool]]{param($p) return $p -ne ''}))

$stack = New-Object "System.Collections.Generic.List``1[System.String]"
if ($sourceDir) {
    foreach ($part in [System.Linq.Enumerable]::Where([string[]]$sourceDir.Split('/'), [System.Func[string,bool]]{param($p) return $p -ne ''})) {
        $stack.Add($part)
    }
}

foreach ($part in $linkParts) {
    if ($part -eq '..') {
        if ($stack.Count -gt 1) {
            $stack.RemoveAt($stack.Count - 1)
        }
    } elseif ($part -eq '.') {
        continue
    } else {
        $stack.Add($part)
    }
}

$resolvedPath = [string]::Join('/', $stack)
$fullResolvedPath = Join-Path (Get-Location).Path $resolvedPath

Write-Host "Resolved path: $resolvedPath"
Write-Host "Full path: $fullResolvedPath"
Write-Host "Exists in fsPathSet: $($fsPathSet.ContainsKey($resolvedPath))"
Write-Host "File exists: $([System.IO.File]::Exists($fullResolvedPath))"

foreach ($key in $fsPathSet.Keys) {
    if ($key.EndsWith("/23个核心文档重新检索报告.md", [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "Found in fsPathSet: $key"
        break
    }
}