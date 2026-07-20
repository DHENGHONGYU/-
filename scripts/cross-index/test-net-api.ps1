$paths = @([System.IO.Directory]::EnumerateFiles((Get-Location).Path + "\docs", "*.md", [System.IO.SearchOption]::AllDirectories))

$chinesePaths = $paths | Where-Object { $_ -match '[\u4e00-\u9fff]' }

Write-Host "Total paths: $($paths.Count)"
Write-Host "Paths with Chinese: $($chinesePaths.Count)"

if ($chinesePaths.Count -gt 0) {
    Write-Host "`nFirst Chinese path:"
    $first = $chinesePaths[0]
    Write-Host "Full path: $first"
    
    $rel = $first.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
    Write-Host "Relative path: $rel"
    
    Write-Host "`nHex bytes of relative path:"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($rel)
    $hex = -join ($bytes | ForEach-Object { "{0:X2}" -f $_ })
    Write-Host $hex
}