$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$path = "docs/00-meta/GOVERNANCE.md"
$fullPath = Join-Path (Get-Location).Path $path

$bytes = [System.IO.File]::ReadAllBytes($fullPath)
$utf8 = [System.Text.Encoding]::UTF8
$utf8Str = $utf8.GetString($bytes)

$links = [regex]::Matches($utf8Str, '\[([^\]]+)\]\(([^)\s]+)\)')
Write-Host "Total links found: $($links.Count)"
Write-Host ""

$count = 0
foreach ($link in $links) {
    $text = $link.Groups[1].Value
    $rawPath = $link.Groups[2].Value
    
    if ($rawPath -match '_pending-review') {
        Write-Host "Match $count :"
        Write-Host "Text: $text"
        Write-Host "Raw path: $rawPath"
        Write-Host ""
        $count++
        if ($count -ge 3) { break }
    }
}