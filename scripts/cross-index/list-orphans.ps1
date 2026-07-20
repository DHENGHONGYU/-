$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$json = $content | ConvertFrom-Json

Write-Host "=== Orphan Documents ==="
Write-Host "Total orphans: $($json.orphans.Count)"
Write-Host ""

foreach ($orphan in $json.orphans) {
    $docId = $orphan.doc_id
    $path = $orphan.path
    $outgoing = $orphan.outgoing_count
    
    Write-Host "doc_id: $docId"
    Write-Host "path: $path"
    Write-Host "outgoing links: $outgoing"
    Write-Host ""
}