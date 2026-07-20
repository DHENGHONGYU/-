$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$path = "docs/00-meta/GOVERNANCE.md"
$fullPath = Join-Path (Get-Location).Path $path

$bytes = [System.IO.File]::ReadAllBytes($fullPath)
$utf8Str = $utf8NoBom.GetString($bytes)

$links = [regex]::Matches($utf8Str, '\[([^\]]+)\]\(([^)\s]+)\)')
foreach ($link in $links) {
    $text = $link.Groups[1].Value
    $rawPath = $link.Groups[2].Value
    
    if ($rawPath -match '_pending-review') {
        $textBytes = [System.Text.Encoding]::UTF8.GetBytes($text)
        $pathBytes = [System.Text.Encoding]::UTF8.GetBytes($rawPath)
        
        Write-Host "Text bytes length: $($textBytes.Length)"
        Write-Host "Path bytes length: $($pathBytes.Length)"
        Write-Host "Path (raw): $rawPath"
        
        $parts = $rawPath.Split('/')
        Write-Host "Split parts:"
        foreach ($p in $parts) {
            $pBytes = [System.Text.Encoding]::UTF8.GetBytes($p)
            Write-Host "  '$p' (bytes: $($pBytes.Length))"
        }
        break
    }
}