Write-Host "Console.InputEncoding: $([Console]::InputEncoding)"
Write-Host "Console.OutputEncoding: $([Console]::OutputEncoding)"
Write-Host "System.Text.Encoding.Default: $([System.Text.Encoding]::Default)"
Write-Host "OutputEncoding: $OutputEncoding"
Write-Host ""

$testStr = "23个核心文档重新检索报告.md"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($testStr)
Write-Host "Test string: $testStr"
Write-Host "UTF-8 bytes: $bytes"
Write-Host ""

$decoded = [System.Text.Encoding]::UTF8.GetString($bytes)
Write-Host "Decoded back: $decoded"
Write-Host "Equal: $($testStr -eq $decoded)"