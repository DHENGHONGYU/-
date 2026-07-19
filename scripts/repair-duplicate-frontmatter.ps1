param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

function Is-DuplicateFm($lines, $startIdx) {
    $endIdx = $startIdx
    $text = ""
    for ($i = $startIdx; $i -lt [math]::Min($startIdx + 15, $lines.Count); $i++) {
        $text += $lines[$i] + "`n"
        if ($lines[$i].Trim() -eq "---") { $endIdx = $i; break }
    }
    if ($text -match '(?m)^title:|^# Classification|^type:|^domain:|^# Version') {
        return $true, $endIdx
    }
    return $false, -1
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File | 
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$total = $docs.Count
$brokenCount = 0
$fixedCount = 0
$errorCount = 0

Write-Host "Scanning $total documents for duplicate frontmatter..." -ForegroundColor Cyan
Write-Host ""

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    try {
        $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    } catch { continue }
    
    $lines = $content -split "`r?`n"
    if ($lines.Count -lt 5 -or $lines[0].Trim() -ne "---") { continue }
    
    $firstEnd = -1
    for ($i = 1; $i -lt [math]::Min($lines.Count, 60); $i++) {
        if ($lines[$i].Trim() -eq "---") { $firstEnd = $i; break }
    }
    if ($firstEnd -eq -1) { continue }
    
    $isDup, $secondEnd = Is-DuplicateFm $lines ($firstEnd + 1)
    if (-not $isDup) { continue }
    
    $brokenCount++
    
    if ($Apply) {
        $newLines = @()
        for ($i = 0; $i -le $firstEnd; $i++) {
            $newLines += $lines[$i]
        }
        for ($i = $secondEnd + 1; $i -lt $lines.Count; $i++) {
            $newLines += $lines[$i]
        }
        
        $newContent = ($newLines -join "`n").TrimStart()
        Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
        $fixedCount++
        Write-Host "  [FIXED] $relPath" -ForegroundColor Green
    } else {
        Write-Host "  [BROKEN] $relPath" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "===== Repair Summary =====" -ForegroundColor Yellow
Write-Host "Total scanned: $total"
Write-Host "Broken (duplicate frontmatter): $brokenCount"
if ($Apply) {
    Write-Host "Fixed: $fixedCount" -ForegroundColor Green
    Write-Host "Errors: $errorCount" -ForegroundColor Red
} else {
    Write-Host ""
    Write-Host "This is a REPORT ONLY. Use -Apply to fix files." -ForegroundColor Yellow
    Write-Host "Example: .\scripts\repair-duplicate-frontmatter.ps1 -Apply" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
