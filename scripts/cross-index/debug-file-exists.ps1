$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$path = "docs/00-meta/GOVERNANCE.md"
$fullPath = Join-Path (Get-Location).Path $path

$bytes = [System.IO.File]::ReadAllBytes($fullPath)
$utf8 = [System.Text.Encoding]::UTF8
$utf8Str = $utf8.GetString($bytes)

$links = [regex]::Matches($utf8Str, '\[([^\]]+)\]\(([^)\s]+)\)')

foreach ($link in $links) {
    $text = $link.Groups[1].Value
    $rawPath = $link.Groups[2].Value
    
    if (-not ($rawPath -match '^https?://') -and $rawPath -match '\.md') {
        $normalizedRaw = $rawPath -replace '\\', '/'
        
        if ($normalizedRaw.StartsWith('docs/')) {
            $resolvedPath = $normalizedRaw
        } else {
            $sourceDirParts = "docs/00-meta" -split '/' | Where-Object { $_ }
            $linkParts = $normalizedRaw -split '/' | Where-Object { $_ }
            
            $stack = @($sourceDirParts)
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
            $resolvedPath = $stack -join '/'
        }
        
        $fullResolved = Join-Path (Get-Location).Path $resolvedPath
        $exists = [System.IO.File]::Exists($fullResolved)
        
        if (-not $exists) {
            $filename = [System.IO.Path]::GetFileName($resolvedPath)
            $filenameBytes = [System.Text.Encoding]::UTF8.GetBytes($filename)
            Write-Host "Missing: $filename"
            Write-Host "  Resolved: $resolvedPath"
            Write-Host "  Filename bytes: $filenameBytes"
            Write-Host ""
        }
    }
}