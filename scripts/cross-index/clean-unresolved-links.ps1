<#
.SYNOPSIS
  Clean unresolved links by fixing common patterns:
  - Double "docs/docs/" prefix → "docs/"
  - Strip query params from .md links
  - Global scan across all markdown files
#>

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$allMdFiles = Get-ChildItem -Path "docs" -Filter "*.md" -Recurse -File |
    Where-Object { $_.FullName -notmatch "\\deprecated-docs\\old-versions\\" }

$fixedCount = 0
$modifiedFiles = @{}

Write-Host "Scanning $($allMdFiles.Count) markdown files..."

foreach ($file in $allMdFiles) {
    $content = [System.IO.File]::ReadAllText((Resolve-Path $file.FullName).Path, $utf8NoBom)
    $originalContent = $content
    $changed = $false
    
    $doubleCount = ($content | Select-String -Pattern 'docs/docs/' -AllMatches).Matches.Count
    if ($doubleCount -gt 0) {
        $content = $content.Replace("docs/docs/", "docs/")
        $fixedCount += $doubleCount
        $changed = $true
        Write-Host "  [FIXED-DOUBLE] $($file.FullName) : removed $doubleCount 'docs/docs/' patterns"
    }
    
    $queryMatches = [regex]::Matches($content, '\]\(([^)]+\.md)\?[^)]*\)')
    if ($queryMatches.Count -gt 0) {
        $content = [regex]::Replace($content, '\]\(([^)]+\.md)\?[^)]*\)', ']($1)')
        $fixedCount += $queryMatches.Count
        $changed = $true
        Write-Host "  [FIXED-QPARAM] $($file.FullName) : stripped $($queryMatches.Count) query params"
    }
    
    if ($changed) {
        [System.IO.File]::WriteAllText((Resolve-Path $file.FullName).Path, $content, $utf8NoBom)
        $modifiedFiles[$file.FullName] = $true
    }
}

Write-Host ""
Write-Host "========== Link Cleanup Results =========="
Write-Host "Fixed links: $fixedCount"
Write-Host "Modified files: $($modifiedFiles.Count)"
