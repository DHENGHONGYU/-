$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$testObj = [ordered]@{
    path = "docs/explanation/design/test-file.md"
    title = "Test File"
}

$json = $testObj | ConvertTo-Json -Depth 5

Write-Host "JSON output"
Write-Host $json

Write-Host ""
Write-Host "Writing to test file"
[System.IO.File]::WriteAllText((Get-Location).Path + "\test-output.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "Reading back"
$content = [System.IO.File]::ReadAllText((Get-Location).Path + "\test-output.json", $utf8NoBom)
Write-Host $content