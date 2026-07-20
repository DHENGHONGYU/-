$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$triage = Import-Csv -Path "docs/_pending-review/orphan-triage.csv" -Encoding UTF8

$pendingDocs = $triage | Where-Object { $_.classification -eq 'move-to-pending' }

Write-Host "Moving $($pendingDocs.Count) documents to _pending-review..."

$basePath = (Get-Location).Path

foreach ($doc in $pendingDocs) {
    $sourcePath = Join-Path $basePath $doc.path
    $filename = [System.IO.Path]::GetFileName($doc.path)
    $targetPath = Join-Path $basePath "docs/_pending-review/$filename"
    
    if (Test-Path $sourcePath) {
        $content = [System.IO.File]::ReadAllText($sourcePath, $utf8NoBom)
        
        $content = $content -replace '(status:\s*)(\w+)', "`$1deprecated"
        
        if ($content -notmatch 'moved_from:') {
            $content = $content -replace '(---\n)', "`$1moved_from: $($doc.path)`n"
        }
        
        [System.IO.File]::WriteAllText($targetPath, $content, $utf8NoBom)
        
        Remove-Item -Path $sourcePath -Force
        
        Write-Host "  MOVED: $($doc.path) -> _pending-review/$filename"
    } else {
        Write-Host "  SKIP (not found): $($doc.path)"
    }
}

Write-Host ""
Write-Host "Done. $($pendingDocs.Count) documents moved."