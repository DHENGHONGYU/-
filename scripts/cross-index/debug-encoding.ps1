$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path)

$text = $utf8NoBom.GetString($bytes)

$found = $text -match '双通道'
Write-Host "Found '双通道' in file: $found"

if ($found) {
    $index = $text.IndexOf('双通道')
    Write-Host "Position: $index"
    
    $start = [Math]::Max(0, $index - 20)
    $end = [Math]::Min($text.Length, $index + 40)
    Write-Host "Context: $($text.Substring($start, $end - $start))"
} else {
    Write-Host "Searching for hex pattern..."
    $hexPattern = "E4 BA 8C E9 80 9A E9 81 93"
    $hexString = -join ($bytes | ForEach-Object { "{0:X2}" -f $_ })
    $hexIndex = $hexString.IndexOf($hexPattern.Replace(' ', ''))
    Write-Host "Hex pattern found at: $hexIndex"
}