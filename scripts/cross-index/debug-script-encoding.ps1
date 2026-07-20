$scriptPath = $MyInvocation.MyCommand.Path
$bytes = [System.IO.File]::ReadAllBytes($scriptPath)

Write-Host "First 10 bytes:"
for ($i = 0; $i -lt [Math]::Min(10, $bytes.Length); $i++) {
    Write-Host "  [$i]: $($bytes[$i])"
}

$hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
Write-Host "Has UTF-8 BOM: $hasBom"