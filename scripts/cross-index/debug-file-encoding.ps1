$path = "docs/00-meta/GOVERNANCE.md"
$fullPath = Join-Path (Get-Location).Path $path

$bytes = [System.IO.File]::ReadAllBytes($fullPath)
Write-Host "File size: $($bytes.Length) bytes"
Write-Host "First 5 bytes: $($bytes[0]) $($bytes[1]) $($bytes[2]) $($bytes[3]) $($bytes[4])"
Write-Host ""

$hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
Write-Host "Has BOM: $hasBom"
Write-Host ""

$utf8 = [System.Text.Encoding]::UTF8
$bomLen = if ($hasBom) { 3 } else { 0 }
$utf8Str = $utf8.GetString($bytes, $bomLen, $bytes.Length - $bomLen)

$lines = $utf8Str -split "`n"
$lineCount = 0
foreach ($line in $lines) {
    $lineCount++
    if ($line -match '23') {
        Write-Host "Line $lineCount :"
        Write-Host $line
        Write-Host ""
    }
}