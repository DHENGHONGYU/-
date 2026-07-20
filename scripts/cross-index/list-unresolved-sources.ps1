$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$json = $content | ConvertFrom-Json

Write-Host "=== Active Unresolved Sources ==="
foreach ($prop in Get-Member -InputObject $json.active_unresolved -MemberType NoteProperty) {
    $count = $json.active_unresolved.$($prop.Name).Count
    Write-Host ("{0} : {1} links" -f $prop.Name, $count)
}

Write-Host ""
Write-Host "=== Archived Unresolved Sources ==="
foreach ($prop in Get-Member -InputObject $json.archived_unresolved -MemberType NoteProperty) {
    $count = $json.archived_unresolved.$($prop.Name).Count
    Write-Host ("{0} : {1} links" -f $prop.Name, $count)
}