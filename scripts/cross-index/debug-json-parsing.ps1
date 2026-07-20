$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)

Write-Host "Raw JSON content (first 500 chars):"
Write-Host $content.Substring(0, [Math]::Min(500, $content.Length))
Write-Host ""

$masterIndex = $content | ConvertFrom-Json

Write-Host "`nAfter ConvertFrom-Json:"
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $doc = $masterIndex.documents.$($prop.Name)
    if ($doc.path -match '[\u4e00-\u9fff]') {
        Write-Host "doc_id: $($prop.Name)"
        Write-Host "path: $($doc.path)"
        Write-Host ""
        break
    }
}