$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$governancePath = "docs/00-meta/GOVERNANCE.md"
$content = [System.IO.File]::ReadAllText((Resolve-Path $governancePath).Path, $utf8NoBom)

$links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)\s]+)\)')
Write-Host "Found $($links.Count) links in GOVERNANCE.md"
Write-Host ""

$count = 0
foreach ($link in $links) {
    $text = $link.Groups[1].Value
    $rawPath = $link.Groups[2].Value
    
    if ($rawPath -match '[\u4e00-\u9fff]') {
        Write-Host "Link text: $text"
        Write-Host "Raw path: $rawPath"
        Write-Host ""
        $count++
        if ($count -ge 5) { break }
    }
}