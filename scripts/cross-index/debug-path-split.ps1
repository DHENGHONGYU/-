$path = "../_pending-review/23个核心文档重新检索报告.md"
Write-Host "Original path: $path"
Write-Host ""

$normalizedRaw = $path -replace '\\', '/'
Write-Host "Normalized: $normalizedRaw"
Write-Host ""

$linkParts = $normalizedRaw -split '/'
Write-Host "Split result:"
for ($i = 0; $i -lt $linkParts.Count; $i++) {
    Write-Host "  [$i]: '$($linkParts[$i])'"
}