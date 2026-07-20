$basePath = (Get-Location).Path + "\"
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs/_pending-review", "*.md", [System.IO.SearchOption]::AllDirectories))

Write-Host "Files in _pending-review:"
foreach ($fullPath in $allFsPaths) {
    $relPath = $fullPath.Substring($basePath.Length) -replace '\\', '/'
    Write-Host "  $relPath"
    
    $filename = [System.IO.Path]::GetFileName($relPath)
    $filenameBytes = [System.Text.Encoding]::UTF8.GetBytes($filename)
    Write-Host "  Filename bytes: $($filenameBytes.Length)"
    Write-Host ""
}