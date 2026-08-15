$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$jsonPath = Join-Path $projectRoot "outputs\audit\full-lint-report.json"

if (-not (Test-Path $jsonPath)) {
    Write-Host "JSON report not found at $jsonPath" -ForegroundColor Red
    exit 1
}

$raw = Get-Content $jsonPath -Raw
$results = $raw | ConvertFrom-Json

$suppressed = @()
$stale = @()
$necessary = @()

foreach ($file in $results) {
    $relPath = $file.filePath.Replace($projectRoot + "\", "").Replace("\", "/")
    
    if ($file.suppressedMessages -and $file.suppressedMessages.Count -gt 0) {
        foreach ($msg in $file.suppressedMessages) {
            $suppressed += [PSCustomObject]@{
                File = $relPath
                Line = $msg.line
                Rule = $msg.ruleId
                Message = $msg.message
            }
            $necessary += [PSCustomObject]@{
                File = $relPath
                Line = $msg.line
                Rule = $msg.ruleId
                Status = "NECESSARY"
                Message = $msg.message
            }
        }
    }
    
    if ($file.messages -and $file.messages.Count -gt 0) {
        foreach ($msg in $file.messages) {
            if ($msg.message -like "*Unused eslint-disable*" -or $msg.message -like "*no problems were reported*") {
                $stale += [PSCustomObject]@{
                    File = $relPath
                    Line = $msg.line
                    Rule = $msg.ruleId
                    Status = "STALE"
                    Message = $msg.message
                }
            }
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ESLint Suppressed Messages Analysis" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NECESSARY (suppressed): $($necessary.Count)" -ForegroundColor Green
Write-Host "  STALE (unused):        $($stale.Count)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

if ($stale.Count -gt 0) {
    Write-Host "`n--- STALE Comments (can safely remove) ---" -ForegroundColor Red
    foreach ($s in $stale) {
        Write-Host "  $($s.File):$($s.Line) [$($s.Rule)]" -ForegroundColor Red
        Write-Host "    $($s.Message)" -ForegroundColor Gray
    }
} else {
    Write-Host "`n  No stale comments found!" -ForegroundColor Green
}

Write-Host "`n--- NECESSARY Comments (by rule) ---" -ForegroundColor Yellow
$byRule = $necessary | Group-Object Rule | Sort-Object Count -Descending
foreach ($group in $byRule) {
    Write-Host "  $($group.Name): $($group.Count)" -ForegroundColor White
}

Write-Host "`n--- NECESSARY Comments (by file, top 15) ---" -ForegroundColor Yellow
$byFile = $necessary | Group-Object File | Sort-Object Count -Descending
foreach ($group in ($byFile | Select-Object -First 15)) {
    Write-Host "  $($group.Name): $($group.Count)" -ForegroundColor White
}
if ($byFile.Count -gt 15) {
    Write-Host "  ... and $($byFile.Count - 15) more files" -ForegroundColor Gray
}

$csvPath = Join-Path $projectRoot "outputs\audit\suppressed-messages-analysis.csv"
$all = @()
$all += $necessary
$all += $stale
$all | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host "`n  CSV saved: $csvPath" -ForegroundColor Gray

$mdPath = Join-Path $projectRoot "outputs\audit\suppressed-messages-analysis.md"
$md = "# ESLint Suppressed Messages Analysis`n`n"
$md += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n"
$md += "## Summary`n`n"
$md += "| Category | Count |`n|----------|-------|`n"
$md += "| NECESSARY (suppressed) | $($necessary.Count) |`n"
$md += "| STALE (can remove) | $($stale.Count) |`n`n"

if ($stale.Count -gt 0) {
    $md += "## STALE Comments`n`n"
    foreach ($s in $stale) {
        $md += "- **$($s.File):$($s.Line)** ``$($s.Rule)`` - $($s.Message)`n"
    }
    $md += "`n"
}

$md += "## NECESSARY Comments by Rule`n`n"
$md += "| Rule | Count |`n|------|-------|`n"
foreach ($group in $byRule) {
    $md += "| ``$($group.Name)`` | $($group.Count) |`n"
}

$md += "`n## NECESSARY Comments by File`n`n"
$md += "| File | Count |`n|------|-------|`n"
foreach ($group in $byFile) {
    $md += "| ``$($group.Name)`` | $($group.Count) |`n"
}

[System.IO.File]::WriteAllText($mdPath, $md, [System.Text.Encoding]::UTF8)
Write-Host "  MD saved: $mdPath" -ForegroundColor Gray
