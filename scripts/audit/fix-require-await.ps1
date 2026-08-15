# Auto-generated: Fix require-await violations
# Strategy: Analyze function bodies and apply appropriate fix
# - No await/Promise usage → remove async keyword
# - Has Promise without await → add await
# - Legitimate async usage → mark with void prefix for floating promises

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$jsonPath = Join-Path $projectRoot "outputs\audit\full-lint-report.json"
$outputDir = Join-Path $projectRoot "outputs\audit"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "=== require-await Auto-Fix Script ===" -ForegroundColor Cyan
Write-Host "Analyzing lint report..." -ForegroundColor Gray

if (-not (Test-Path $jsonPath)) {
    Write-Host "ERROR: Lint report not found at $jsonPath" -ForegroundColor Red
    Write-Host "Run 'npm run lint -- --format json' first" -ForegroundColor Yellow
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
                    Column = $msg.column
                    Message = $msg.message
                }
            }
        }
    }
}

Write-Host "Found $($raEntries.Count) require-await suppressed entries" -ForegroundColor Yellow

# Analyze and classify each entry
$fixPlan = @()
$raByFile = $raEntries | Group-Object File

foreach ($group in $raByFile) {
    $currentFile = $group.Name
    $filePath = Join-Path $projectRoot $currentFile.Replace("/", "\")
    
    if (-not (Test-Path $filePath)) {
        Write-Host "  SKIP: $currentFile - file not found" -ForegroundColor Gray
        continue
    }
    
    $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
    
    foreach ($entry in $group.Group) {
        $ln = $entry.Line
        if ($ln -gt $lines.Count) { continue }
        
        $line = $lines[$ln - 1]
        
        # Check if line contains async
        $isAsync = $line -match '\basync\b'
        if (-not $isAsync) {
            $fixPlan += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "NEEDS_REVIEW"
                Reason = "Line does not contain async - may be inline callback or Promise chain"
                OriginalLine = $line.Trim()
            }
            continue
        }
        
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
            # No await or Promise usage - safe to remove async
            $fixPlan += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "REMOVE_ASYNC"
                Reason = "async function with no await/Promise usage"
                OriginalLine = $line.Trim()
            }
        } elseif (-not $hasAwait -and $hasPromise) {
            # Has Promise but no await - needs await keyword
            $fixPlan += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "ADD_AWAIT"
                Reason = "async function calls Promise without await"
                OriginalLine = $line.Trim()
            }
        } else {
            # Has await usage - suppression is legitimate
            $fixPlan += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "KEEP_COMMENT"
                Reason = "Has await usage, suppression necessary"
                OriginalLine = $line.Trim()
            }
        }
    }
}

# Generate report
$reportPath = Join-Path $outputDir "require-await-fix-plan.md"
$reportContent = @"
# require-await Fix Plan

Total entries: **$($raEntries.Count)**

## Classification

"@

$removeCount = ($fixPlan | Where-Object { $_.Action -eq "REMOVE_ASYNC" }).Count
$addAwaitCount = ($fixPlan | Where-Object { $_.Action -eq "ADD_AWAIT" }).Count
$keepCount = ($fixPlan | Where-Object { $_.Action -eq "KEEP_COMMENT" }).Count
$reviewCount = ($fixPlan | Where-Object { $_.Action -eq "NEEDS_REVIEW" }).Count

$reportContent += "| Action | Count |`n|--------|-------|`n"
$reportContent += "| Remove async keyword | $removeCount |`n"
$reportContent += "| Add await keyword | $addAwaitCount |`n"
$reportContent += "| Keep suppression (legitimate) | $keepCount |`n"
$reportContent += "| Needs manual review | $reviewCount |`n"

$reportContent += "`n## Detailed Plan`n`n"
$reportContent += "| File | Line | Action | Reason | Original (truncated) |`n|------|------|--------|--------|----------------------|`n"

foreach ($item in ($fixPlan | Sort-Object Action, File, Line)) {
    $shortLine = if ($item.OriginalLine.Length -gt 80) { $item.OriginalLine.Substring(0, 77) + "..." } else { $item.OriginalLine }
    $reportContent += "| ``$($item.File)`` | $($item.Line) | $($item.Action) | $($item.Reason) | ``$shortLine`` |`n"
}

[System.IO.File]::WriteAllText($reportPath, $reportContent, [System.Text.Encoding]::UTF8)
Write-Host "    Fix plan: $reportPath" -ForegroundColor Gray

# Generate and execute fix script for REMOVE_ASYNC cases
$fixScriptPath = Join-Path $outputDir "apply-require-await-fixes.ps1"
$fixLines = [System.Collections.ArrayList]::new()

[void]$fixLines.Add('<#')
[void]$fixLines.Add('Auto-generated: Apply require-await fixes')
[void]$fixLines.Add('Review carefully before running!')
[void]$fixLines.Add('Actions: Remove async keyword from functions with no await/Promise usage')
[void]$fixLines.Add('#>')
[void]$fixLines.Add('')
[void]$fixLines.Add("`$projectRoot = '$projectRoot'")
[void]$fixLines.Add('')
[void]$fixLines.Add('Write-Host "Applying require-await fixes..." -ForegroundColor Yellow')
[void]$fixLines.Add('')

# Process REMOVE_ASYNC entries first (sorted descending by line number to avoid line shift issues)
$removeEntries = $fixPlan | Where-Object { $_.Action -eq "REMOVE_ASYNC" } | Sort-Object File, Line -Descending
foreach ($item in $removeEntries) {
    $fileWin = $item.File.Replace("/", "\")
    [void]$fixLines.Add("# $($item.File):$($item.Line) - $($item.Reason)")
    [void]$fixLines.Add("`$fp = Join-Path `$projectRoot '$fileWin'")
    [void]$fixLines.Add('if (Test-Path $fp) {')
    [void]$fixLines.Add('    $lines = [System.IO.File]::ReadAllLines($fp, [System.Text.Encoding]::UTF8)')
    [void]$fixLines.Add("    if (`$lines.Length -ge $($item.Line)) {")
    [void]$fixLines.Add("        `$original = `$lines[$($item.Line) - 1]")
    [void]$fixLines.Add("        `$lines[$($item.Line) - 1] = `$original -replace '\basync\s+', ''")
    [void]$fixLines.Add('        [System.IO.File]::WriteAllLines($fp, $lines, [System.Text.Encoding]::UTF8)')
    [void]$fixLines.Add("        Write-Host '  FIXED: $($item.File):$($item.Line) - removed async keyword' -ForegroundColor Green")
    [void]$fixLines.Add('    }')
    [void]$fixLines.Add('}')
    [void]$fixLines.Add('')
}

# Process ADD_AWAIT entries
$addEntries = $fixPlan | Where-Object { $_.Action -eq "ADD_AWAIT" } | Sort-Object File, Line -Descending
foreach ($item in $addEntries) {
    $fileWin = $item.File.Replace("/", "\")
    [void]$fixLines.Add("# $($item.File):$($item.Line) - $($item.Reason)")
    [void]$fixLines.Add("# MANUAL REVIEW REQUIRED: Add 'await' before Promise calls in this function")
    [void]$fixLines.Add("`$fp = Join-Path `$projectRoot '$fileWin'")
    [void]$fixLines.Add('if (Test-Path $fp) {')
    [void]$fixLines.Add('    Write-Host "  REVIEW: ' + $item.File + ':' + $item.Line + ' - needs manual await addition" -ForegroundColor Yellow')
    [void]$fixLines.Add('}')
    [void]$fixLines.Add('')
}

[void]$fixLines.Add('Write-Host ""')
[void]$fixLines.Add('Write-Host "Verifying with ESLint..." -ForegroundColor Yellow')
[void]$fixLines.Add('Set-Location $projectRoot')
[void]$fixLines.Add('npx eslint src/ --ext .ts,.tsx --max-warnings 2000 2>&1 | Select-String "require-await"')

[System.IO.File]::WriteAllLines($fixScriptPath, $fixLines, [System.Text.Encoding]::UTF8)
Write-Host "    Fix script: $fixScriptPath ($removeCount auto-fix, $addEntries.Count manual)" -ForegroundColor Green

# Also generate a simple console report
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Total require-await entries: $($raEntries.Count)" -ForegroundColor White
Write-Host "  Auto-fixable (remove async): $removeCount" -ForegroundColor Green
Write-Host "  Needs await addition: $($addEntries.Count)" -ForegroundColor Yellow
Write-Host "  Keep suppression: $keepCount" -ForegroundColor Gray
Write-Host "  Needs review: $reviewCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the fix plan: $reportPath" -ForegroundColor White
Write-Host "  2. Run the fix script: powershell -ExecutionPolicy Bypass -File `"$fixScriptPath`"" -ForegroundColor White
Write-Host "  3. Manually review ADD_AWAIT cases" -ForegroundColor White