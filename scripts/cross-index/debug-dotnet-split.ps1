$path = "../_pending-review/23个核心文档重新检索报告.md"
Write-Host "Original path: $path"
Write-Host ""

$parts = $path.Split('/')
Write-Host "Using .NET Split('/'):"
for ($i = 0; $i -lt $parts.Length; $i++) {
    Write-Host "  [$i]: '$($parts[$i])'"
}
Write-Host ""

$partsPS = $path -split '/'
Write-Host "Using PowerShell -split '/':"
for ($i = 0; $i -lt $partsPS.Length; $i++) {
    Write-Host "  [$i]: '$($partsPS[$i])'"
}