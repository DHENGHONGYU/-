$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$sourceRelPath = "docs/00-meta/GOVERNANCE.md"
$rawPath = "../_pending-review/23个核心文档重新检索报告.md"

Write-Host "Source: $sourceRelPath"
Write-Host "Raw: $rawPath"
Write-Host ""

$sourceDirParts = $sourceRelPath -split '/' | Where-Object { $_ }
Write-Host "Source dir parts: $sourceDirParts"
$sourceDirParts = $sourceDirParts[0..($sourceDirParts.Count - 2)]
Write-Host "Source dir parts (without filename): $sourceDirParts"
$sourceDir = $sourceDirParts -join '/'
Write-Host "Source dir: $sourceDir"
Write-Host ""

$linkParts = $rawPath -split '/' | Where-Object { $_ }
Write-Host "Link parts: $linkParts"
Write-Host ""

$stack = @()
if ($sourceDir) {
    $stack = $sourceDir -split '/' | Where-Object { $_ }
}
Write-Host "Initial stack: $stack"
Write-Host ""

foreach ($part in $linkParts) {
    Write-Host "Processing part: '$part'"
    if ($part -eq '..') {
        if ($stack.Count -gt 1) {
            $stack = $stack[0..($stack.Count - 2)]
        }
    } elseif ($part -eq '.') {
        continue
    } else {
        $stack += $part
    }
    Write-Host "Stack now: $stack"
}
Write-Host ""

$resolvedPath = $stack -join '/'
Write-Host "Resolved path: $resolvedPath"

$fullPath = Join-Path (Get-Location).Path $resolvedPath
Write-Host "Full path: $fullPath"
Write-Host "Exists: $([System.IO.File]::Exists($fullPath))"