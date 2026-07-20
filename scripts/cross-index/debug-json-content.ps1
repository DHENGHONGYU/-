$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$path = "docs/00-meta/ai-index/relation-index.json"
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $path).Path)
$content = $utf8NoBom.GetString($bytes)

$startIdx = $content.IndexOf('active_unresolved')
if ($startIdx -gt 0) {
    $endIdx = $content.IndexOf('archived_unresolved', $startIdx)
    $section = $content.Substring($startIdx, [Math]::Min(2000, $endIdx - $startIdx))
    Write-Host $section
}