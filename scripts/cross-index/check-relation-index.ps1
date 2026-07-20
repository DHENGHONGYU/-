$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$json = $content | ConvertFrom-Json

Write-Host "=== relation-index.json Structure ==="
Write-Host "Keys: $($json | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)"
Write-Host ""

$unresolvedCount = ($json.unresolved_links | Get-Member -MemberType NoteProperty).Count
Write-Host "unresolved_links entries: $unresolvedCount"

$sample = $json.unresolved_links | Get-Member -MemberType NoteProperty | Select-Object -First 3
foreach ($prop in $sample) {
    Write-Host "  $($prop.Name)"
    $links = $json.unresolved_links.$($prop.Name)
    foreach ($link in $links) {
        if ($link -is [string]) {
            Write-Host "    - $link"
        } else {
            Write-Host "    - link: $($link.link), resolved: $($link.resolved)"
        }
    }
}