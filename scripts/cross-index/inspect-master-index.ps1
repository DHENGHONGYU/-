$json = Get-Content 'docs/00-meta/ai-index/master-index.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$props = Get-Member -InputObject $json.documents -MemberType NoteProperty
Write-Host "Total documents: $($props.Count)"
Write-Host ""
Write-Host "First 5 keys:"
$props | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.Name)" }
Write-Host ""
Write-Host "Sample entry (first):"
$firstKey = $props[0].Name
$json.documents.$firstKey | ConvertTo-Json
