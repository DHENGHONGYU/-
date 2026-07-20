$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$governancePath = "docs/00-meta/GOVERNANCE.md"
$content = [System.IO.File]::ReadAllText((Resolve-Path $governancePath).Path, $utf8NoBom)

$links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)\s]+)\)')

foreach ($link in $links) {
    $text = $link.Groups[1].Value
    $rawPath = $link.Groups[2].Value
    
    if (-not ($rawPath -match '^https?://') -and $rawPath -match '\.md') {
        $fullPath = Join-Path (Get-Location).Path $rawPath
        $exists = [System.IO.File]::Exists($fullPath)
        
        if (-not $exists) {
            $relativePath = Join-Path "docs/00-meta" $rawPath
            $fullPath2 = Join-Path (Get-Location).Path $relativePath
            $exists2 = [System.IO.File]::Exists($fullPath2)
            
            Write-Host "Link: $rawPath"
            Write-Host "  Direct path exists: $exists"
            Write-Host "  In 00-meta exists: $exists2"
            Write-Host ""
        }
    }
}