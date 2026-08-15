# Auto-generated: Apply require-await fixes with void markers
# Actions:
# 1. Remove async keyword from functions with no await/Promise usage
# 2. Add void prefix to Promise calls that don't need awaiting

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$jsonPath = Join-Path $projectRoot "outputs\audit\full-lint-report.json"
$outputDir = Join-Path $projectRoot "outputs\audit"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "=== Applying require-await Fixes ===" -ForegroundColor Cyan
Write-Host "Strategy: Remove unnecessary async, add void for floating promises" -ForegroundColor Gray

if (-not (Test-Path $jsonPath)) {
    Write-Host "ERROR: Lint report not found at $jsonPath" -ForegroundColor Red
    exit 1
}

$raw = Get-Content $jsonPath -Raw
$results = $raw | ConvertFrom-Json

# Collect require-await suppressed messages
$raEntries = @()
foreach ($file in $results) {
    $relPath = $file.filePath.Replace($projectRoot + "\", "").Replace("\", "/")
    
    if ($file.suppressedMessages) {
        foreach ($msg in $file.suppressedMessages) {
            if ($msg.ruleId -eq "@typescript-eslint/require-await") {
                $raEntries += [PSCustomObject]@{
                    File = $relPath
                    Line = $msg.line
                    Message = $msg.message
                }
            }
        }
    }
}

Write-Host "Found $($raEntries.Count) require-await suppressed entries" -ForegroundColor Yellow

# Track modifications
$modifications = @()
$filesModified = @{}

# Process each file grouped by file
$raByFile = $raEntries | Group-Object File

foreach ($group in $raByFile) {
    $currentFile = $group.Name
    $filePath = Join-Path $projectRoot $currentFile.Replace("/", "\")
    
    if (-not (Test-Path $filePath)) {
        Write-Host "  SKIP: $currentFile - file not found" -ForegroundColor Gray
        continue
    }
    
    $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
    $fileModified = $false
    
    # Sort entries by line number descending to avoid line shift issues
    $sortedEntries = $group.Group | Sort-Object Line -Descending
    
    foreach ($entry in $sortedEntries) {
        $ln = $entry.Line
        if ($ln -gt $lines.Count) { continue }
        
        $line = $lines[$ln - 1]
        
        # Check if line contains async
        $isAsync = $line -match '\basync\b'
        if (-not $isAsync) { continue }
        
        # Search function body for await/Promise usage
        $hasAwait = $false
        $hasPromise = $false
        $searchEnd = [Math]::Min($ln + 40, $lines.Count - 1)
        
        for ($i = $ln; $i -le $searchEnd; $i++) {
            $searchLine = $lines[$i]
            if ($searchLine -match '(?<!\/\/)\bawait\b') { $hasAwait = $true; break }
            if ($searchLine -match '(?<!\/\/)\.then\s*\(|(?<!\/\/)\.catch\s*\(|(?<!\/\/)new\s+Promise|(?<!\/\/)Promise\.(all|race|any|resolve|reject)') { $hasPromise = $true }
        }
        
        if (-not $hasAwait -and -not $hasPromise) {
            # Case 1: Remove async keyword - no await or Promise usage
            $newLine = $line -replace '\basync\s+', ''
            if ($newLine -ne $line) {
                $lines[$ln - 1] = $newLine
                $fileModified = $true
                $modifications += [PSCustomObject]@{
                    File = $currentFile
                    Line = $ln
                    Action = "REMOVE_ASYNC"
                    Original = $line.Trim()
                    Modified = $newLine.Trim()
                }
                Write-Host "  REMOVED async: ${currentFile}:${ln}" -ForegroundColor Green
            }
        }
        elseif (-not $hasAwait -and $hasPromise) {
            # Case 2: Has Promise without await - needs void marker or await
            # This is a candidate for adding void before the Promise call
            $modifications += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "NEEDS_VOID_OR_AWAIT"
                Original = $line.Trim()
                Note = "Function has Promise calls without await - review manually"
            }
            Write-Host "  NEEDS REVIEW: ${currentFile}:${ln} - Promise without await" -ForegroundColor Yellow
        }
        # else: Has await - keep suppression, no modification needed
    }
    
    if ($fileModified) {
        [System.IO.File]::WriteAllLines($filePath, $lines, [System.Text.Encoding]::UTF8)
        $filesModified[$currentFile] = $true
    }
}

# Now scan for floating promises that could use void markers
Write-Host "`nScanning for floating promise calls..." -ForegroundColor Cyan

$srcDir = Join-Path $projectRoot "src"
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.ts", "*.tsx" -File | Where-Object {
    $_.FullName -notmatch "\\__tests__\\|\\\.test\.|\\\.spec\."
}

$floatingPromiseEntries = @()

foreach ($file in $files) {
    $relPath = $file.FullName.Replace($projectRoot + "\", "").Replace("\", "/")
    $lines = [System.IO.File]::ReadAllLines($file.FullName, [System.Text.Encoding]::UTF8)
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $lineNum = $i + 1
        
        # Look for Promise calls that are not awaited and not in a return statement
        # Pattern: functionCall() that returns Promise, without await or return
        if ($line -match '(?<!\/\/)(?<!await\s)(?<!return\s)(?<!void\s)\b\w+\([^)]*\)(?<!\s*\.\s*then)(?<!\s*\.\s*catch)\s*;?\s*$' -and
            $line -match '(?:fetch|axios|\.then\(|\.catch\(|new Promise|Promise\.|async\s+\w+\s*\()') {
            # Check if this is a floating promise
            $floatingPromiseEntries += [PSCustomObject]@{
                File = $relPath
                Line = $lineNum
                Content = $line.Trim()
            }
        }
    }
}

# Generate report
$reportPath = Join-Path $outputDir "require-await-apply-report.md"
$reportContent = @"
# require-await Fix Application Report

## Summary

- **Total require-await entries**: $($raEntries.Count)
- **Files modified**: $($filesModified.Count)
- **Modifications made**: $($modifications.Count)

## Modifications Applied

"@

$removedAsync = $modifications | Where-Object { $_.Action -eq "REMOVE_ASYNC" }
$needsReview = $modifications | Where-Object { $_.Action -eq "NEEDS_VOID_OR_AWAIT" }

$reportContent += "### Remove async keyword ($($removedAsync.Count))`n`n"
$reportContent += "| File | Line | Original | Modified |`n|------|------|----------|----------|`n"
foreach ($m in $removedAsync) {
    $orig = if ($m.Original.Length -gt 80) { $m.Original.Substring(0, 77) + "..." } else { $m.Original }
    $mod = if ($m.Modified.Length -gt 80) { $m.Modified.Substring(0, 77) + "..." } else { $m.Modified }
    $reportContent += "| ``$($m.File)`` | $($m.Line) | ``$orig`` | ``$mod`` |`n"
}

if ($needsReview.Count -gt 0) {
    $reportContent += "`n### Needs manual review ($($needsReview.Count))`n`n"
    $reportContent += "These functions have Promise calls without await. Consider adding ``void`` prefix or ``await``.`n`n"
    $reportContent += "| File | Line | Original | Note |`n|------|------|----------|------|`n"
    foreach ($m in $needsReview) {
        $orig = if ($m.Original.Length -gt 80) { $m.Original.Substring(0, 77) + "..." } else { $m.Original }
        $reportContent += "| ``$($m.File)`` | $($m.Line) | ``$orig`` | $($m.Note) |`n"
    }
}

$reportContent += "`n## Recommendations`n`n"
$reportContent += "1. **Run lint check**: Verify no new errors introduced`n"
$reportContent += "2. **Review NEEDS_VOID_OR_AWAIT cases**: Manually determine if void or await is appropriate`n"
$reportContent += "3. **Consider adding void markers**: For Promise calls in event handlers that don't need awaiting`n"

[System.IO.File]::WriteAllText($reportPath, $reportContent, [System.Text.Encoding]::UTF8)

Write-Host "`n    Application report: $reportPath" -ForegroundColor Gray

# Print summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Application Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Files modified: $($filesModified.Count)" -ForegroundColor White
Write-Host "  Async keywords removed: $($removedAsync.Count)" -ForegroundColor Green
Write-Host "  Needs review: $($needsReview.Count)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run lint check: npm run lint" -ForegroundColor White
Write-Host "  2. Review NEEDS_VOID_OR_AWAIT cases in: $reportPath" -ForegroundColor White
Write-Host "  3. Consider running: npm run gate:quick" -ForegroundColor White