# Scan all console calls in src directory
# Lists files, line numbers, and console call types

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$srcDir = Join-Path $projectRoot "src"
$outputDir = Join-Path $projectRoot "outputs\audit"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "=== Console Calls Scanner ===" -ForegroundColor Cyan
Write-Host "Scanning $srcDir ..." -ForegroundColor Gray

# Find all TypeScript/TSX files
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.ts", "*.tsx" -File | Where-Object {
    $_.FullName -notmatch "\\__tests__\\|\\\.test\.|\\\.spec\."
}

Write-Host "Found $($files.Count) source files (excluding test files)" -ForegroundColor Gray

$consoleEntries = @()

# Process each file
foreach ($file in $files) {
    $relPath = $file.FullName.Replace($projectRoot + "\", "").Replace("\", "/")
    $lines = [System.IO.File]::ReadAllLines($file.FullName, [System.Text.Encoding]::UTF8)
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $lineNum = $i + 1
        
        # Match all console calls (excluding commented lines)
        if ($line -match '(?<!\/\/)\bconsole\.(log|warn|error|info|debug|trace|group|groupCollapsed|groupEnd|dir|dirxml|table|count|countReset|assert|clear|time|timeEnd|timeLog|profile|profileEnd|memory)\b') {
            $matchType = if ($line -match 'console\.log\b') { 'log' }
                        elseif ($line -match 'console\.warn\b') { 'warn' }
                        elseif ($line -match 'console\.error\b') { 'error' }
                        elseif ($line -match 'console\.info\b') { 'info' }
                        elseif ($line -match 'console\.debug\b') { 'debug' }
                        elseif ($line -match 'console\.trace\b') { 'trace' }
                        elseif ($line -match 'console\.group\b') { 'group' }
                        elseif ($line -match 'console\.dir\b') { 'dir' }
                        elseif ($line -match 'console\.table\b') { 'table' }
                        else { 'other' }
            
            # Check if there's an eslint-disable directive on the line above
            $hasSuppressAbove = $false
            $suppressRule = ""
            if ($i -gt 0) {
                $prevLine = $lines[$i - 1]
                if ($prevLine -match 'eslint-disable(?:-next-line)?\s+(.*no-console.*)') {
                    $hasSuppressAbove = $true
                    $suppressRule = $Matches[1].Trim()
                }
            }
            
            # Also check if suppression is on the same line (inline)
            if ($line -match '//\s*eslint-disable(?:-next-line)?\s+.*no-console') {
                $hasSuppressAbove = $true
                if ([string]::IsNullOrEmpty($suppressRule)) {
                    $suppressRule = "inline"
                }
            }
            
            $consoleEntries += [PSCustomObject]@{
                File = $relPath
                Line = $lineNum
                Type = $matchType
                HasSuppressDirective = $hasSuppressAbove
                SuppressRule = $suppressRule
                Content = $line.Trim()
            }
        }
    }
}

Write-Host "Found $($consoleEntries.Count) console calls total" -ForegroundColor Yellow

# Generate CSV report
$csvPath = Join-Path $outputDir "console-calls.csv"
$consoleEntries | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host "    CSV: $csvPath" -ForegroundColor Gray

# Generate Markdown report
$reportPath = Join-Path $outputDir "console-calls-report.md"
$md = "# Console Calls Distribution Report`n`n"
$md += "Total console calls found: **$($consoleEntries.Count)**`n`n"
$md += "Files scanned: $($files.Count) (excluding test files)`n`n"

# By type
$md += "## By Type`n`n"
$md += "| Type | Count | Percentage |`n|------|-------|------------|`n"
$byType = $consoleEntries | Group-Object Type | Sort-Object Count -Descending
foreach ($g in $byType) {
    $pct = [math]::Round(($g.Count / $consoleEntries.Count) * 100, 1)
    $md += "| ``$($g.Name)`` | $($g.Count) | $pct% |`n"
}

# By file
$md += "`n## By File`n`n"
$md += "| File | Total | log | warn | error | info | Other | With Suppression |`n|------|-------|-----|------|-------|------|-------|------------------|`n"
$byFile = $consoleEntries | Group-Object File | Sort-Object Count -Descending
foreach ($g in $byFile) {
    $entries = $g.Group
    $total = $entries.Count
    $logCount = ($entries | Where-Object { $_.Type -eq "log" }).Count
    $warnCount = ($entries | Where-Object { $_.Type -eq "warn" }).Count
    $errorCount = ($entries | Where-Object { $_.Type -eq "error" }).Count
    $infoCount = ($entries | Where-Object { $_.Type -eq "info" }).Count
    $otherCount = ($entries | Where-Object { $_.Type -notin @("log","warn","error","info") }).Count
    $suppressedCount = ($entries | Where-Object { $_.HasSuppressDirective }).Count
    $md += "| ``$($g.Name)`` | $total | $logCount | $warnCount | $errorCount | $infoCount | $otherCount | $suppressedCount |`n"
}

# Full listing
$md += "`n## Full Listing`n`n"
$md += "| File | Line | Type | Suppressed | Content |`n|------|------|------|------------|---------|`n"
foreach ($item in ($consoleEntries | Sort-Object File, Line)) {
    $content = $item.Content
    if ($content.Length -gt 100) { $content = $content.Substring(0, 97) + "..." }
    $suppressed = if ($item.HasSuppressDirective) { "`u2705" } else { "`u274C" }
    $md += "| ``$($item.File)`` | $($item.Line) | $($item.Type) | $suppressed | ``$content`` |`n"
}

# Recommendations
$md += "`n## Recommendations`n`n"
$md += "### Console calls that can be converted to logger`n"
$md += "- **console.log** (without eslint-disable): These are not suppressed and will trigger lint warnings. Recommend converting to ``logger.debug()`` or ``logger.info()``.`n"
$md += "- **console.info**: Can be converted to ``logger.info()``.`n"
$md += "- **console.debug**: Can be converted to ``logger.debug()``.`n`n"

$md += "### Console calls that should be kept`n"
$md += "- **console.warn**: ESLint ``no-console`` rule by default allows ``warn`` and ``error``. These may not need suppression.`n"
$md += "- **console.error**: Useful for error logging, allowed by default.`n"
$md += "- **console.group/groupCollapsed**: Useful for formatted diagnostic output.`n"
$md += "- **console.table**: Useful for debugging tabular data.`n`n"

$md += "### Files with most console calls (top targets for cleanup)`n`n"
$md += "| Rank | File | Count | Action |`n|------|------|-------|--------|`n"
$rank = 1
foreach ($g in ($byFile | Select-Object -First 10)) {
    $entries = $g.Group
    $unsuppressed = ($entries | Where-Object { -not $_.HasSuppressDirective }).Count
    $logCalls = ($entries | Where-Object { $_.Type -eq "log" }).Count
    $action = if ($unsuppressed -gt 0) { "Clean up $unsuppressed unsuppressed calls" }
              elseif ($logCalls -gt 0) { "Convert $logCalls console.log to logger" }
              else { "Review necessity" }
    $md += "| $rank | ``$($g.Name)`` | $($g.Count) | $action |`n"
    $rank++
}

[System.IO.File]::WriteAllText($reportPath, $md, [System.Text.Encoding]::UTF8)

Write-Host "    Report:   $reportPath" -ForegroundColor Gray

# Print summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Console Calls Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Total calls: $($consoleEntries.Count)" -ForegroundColor White
Write-Host "  Files affected: $($byFile.Count)" -ForegroundColor White
Write-Host "  With eslint-disable: $(($consoleEntries | Where-Object { $_.HasSuppressDirective }).Count)" -ForegroundColor Yellow
Write-Host "  Without suppression: $(($consoleEntries | Where-Object { -not $_.HasSuppressDirective }).Count)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Print by type
Write-Host "By type:" -ForegroundColor Yellow
foreach ($g in $byType) {
    Write-Host "  $($g.Name): $($g.Count)" -ForegroundColor White
}

Write-Host ""
Write-Host "Top files with console calls:" -ForegroundColor Yellow
foreach ($g in ($byFile | Select-Object -First 10)) {
    Write-Host "  $($g.Name): $($g.Count) calls" -ForegroundColor White
}

Write-Host ""
Write-Host "Generated files:" -ForegroundColor Gray
Write-Host "  $csvPath" -ForegroundColor White
Write-Host "  $reportPath" -ForegroundColor White