$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$json = $content | ConvertFrom-Json

$targetDoc = "V9-DOC-META-000"

Write-Host "=== Unresolved links from $targetDoc ==="
if ($json.active_unresolved.PSObject.Properties[$targetDoc]) {
    $links = $json.active_unresolved.$targetDoc
    foreach ($link in $links) {
        Write-Host ("  Link: {0}" -f $link.link)
        Write-Host ("  Resolved: {0}" -f $link.resolved)
        Write-Host ""
    }
} else {
    Write-Host "No unresolved links found"
}