$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$jsonPath = Join-Path $projectRoot "outputs\audit\full-lint-report.json"
$outputDir = Join-Path $projectRoot "outputs\audit"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "=== Analyzing ESLint suppressed messages ===" -ForegroundColor Cyan

$raw = Get-Content $jsonPath -Raw
$results = $raw | ConvertFrom-Json

$requireAwait = @()
$reactRefresh = @()
$noConsole = @()

foreach ($file in $results) {
    $relPath = $file.filePath.Replace($projectRoot + "\", "").Replace("\", "/")
    
    if ($file.suppressedMessages) {
        foreach ($msg in $file.suppressedMessages) {
            $entry = [PSCustomObject]@{
                File = $relPath
                Line = $msg.line
                Rule = $msg.ruleId
                Message = $msg.message
            }
            
            switch -Wildcard ($msg.ruleId) {
                "@typescript-eslint/require-await" { $requireAwait += $entry }
                "react-refresh/*" { $reactRefresh += $entry }
                "no-console" { $noConsole += $entry }
                default { }
            }
        }
    }
}

# ============================================================
# Report 1: require-await analysis + auto-fix script
# ============================================================
Write-Host "`n[1] require-await: $($requireAwait.Count) suppressed comments" -ForegroundColor Yellow

$raCsvPath = Join-Path $outputDir "require-await-analysis.csv"
$requireAwait | Export-Csv -Path $raCsvPath -NoTypeInformation -Encoding UTF8
Write-Host "    CSV: $raCsvPath" -ForegroundColor Gray

# Analyze each file to check if async can be removed
Write-Host "    Analyzing function bodies..." -ForegroundColor Gray
$fixable = @()
$needsAwait = @()
$keep = @()

$raFiles = $requireAwait | Group-Object File
foreach ($group in $raFiles) {
    $currentFile = $group.Name
    $filePath = Join-Path $projectRoot $currentFile.Replace("/", "\")
    
    if (-not (Test-Path $filePath)) { continue }
    
    $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
    
    foreach ($entry in $group.Group) {
        $ln = $entry.Line
        if ($ln -ge $lines.Count) { continue }
        
        $line = $lines[$ln - 1]
        
        $hasAwait = $false
        $hasPromise = $false
        
        $searchEnd = [Math]::Min($ln + 30, $lines.Count - 1)
        for ($i = $ln; $i -le $searchEnd; $i++) {
            $searchLine = $lines[$i]
            if ($searchLine -match '\bawait\b') { $hasAwait = $true; break }
            if ($searchLine -match '\.then\(|\.catch\(|new Promise|Promise\.') { $hasPromise = $true }
        }
        
        $isAsync = $line -match '\basync\b'
        
        if (-not $isAsync) {
            $keep += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "KEEP (not async)"
                Reason = "Line does not contain async keyword"
                OriginalLine = $line.Trim()
            }
        } elseif (-not $hasAwait -and -not $hasPromise) {
            $fixable += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "REMOVE_ASYNC"
                Reason = "async function with no await/Promise usage"
                OriginalLine = $line.Trim()
            }
        } elseif (-not $hasAwait -and $hasPromise) {
            $needsAwait += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "ADD_AWAIT"
                Reason = "async function calls Promise without await"
                OriginalLine = $line.Trim()
            }
        } else {
            $keep += [PSCustomObject]@{
                File = $currentFile
                Line = $ln
                Action = "KEEP"
                Reason = "Has await usage, suppression necessary"
                OriginalLine = $line.Trim()
            }
        }
    }
}

# Generate require-await fix script
$fixScriptPath = Join-Path $outputDir "fix-require-await.ps1"
$fixLines = [System.Collections.ArrayList]::new()

[void]$fixLines.Add('<#')
[void]$fixLines.Add('Auto-generated script: Fix require-await violations by removing unnecessary async keywords')
[void]$fixLines.Add('Review carefully before running!')
[void]$fixLines.Add('#>')
[void]$fixLines.Add('')
[void]$fixLines.Add("`$projectRoot = '$projectRoot'")
[void]$fixLines.Add('')
[void]$fixLines.Add('Write-Host "Fixing require-await violations..." -ForegroundColor Yellow')
[void]$fixLines.Add('Write-Host "Strategy: Remove async keyword from functions with no await/Promise usage" -ForegroundColor Cyan')
[void]$fixLines.Add('')

foreach ($item in ($fixable | Sort-Object File, Line -Descending)) {
    $fileWin = $item.File.Replace("/", "\")
    [void]$fixLines.Add("# $($item.File):$($item.Line) - $($item.Reason)")
    [void]$fixLines.Add("`$fp = Join-Path `$projectRoot '$fileWin'")
    [void]$fixLines.Add('if (Test-Path $fp) {')
    [void]$fixLines.Add('    $lines = [System.IO.File]::ReadAllLines($fp, [System.Text.Encoding]::UTF8)')
    [void]$fixLines.Add("    if (`$lines.Length -ge $($item.Line)) {")
    [void]$fixLines.Add("        `$original = `$lines[$($item.Line) - 1]")
    [void]$fixLines.Add("        `$lines[$($item.Line) - 1] = `$original -replace '\basync\s+', ''")
    [void]$fixLines.Add('        [System.IO.File]::WriteAllLines($fp, $lines, [System.Text.Encoding]::UTF8)')
    [void]$fixLines.Add("        Write-Host '  FIXED: $($item.File):$($item.Line) - removed async' -ForegroundColor Green")
    [void]$fixLines.Add('    }')
    [void]$fixLines.Add('}')
    [void]$fixLines.Add('')
}

[void]$fixLines.Add('Write-Host ""')
[void]$fixLines.Add('Write-Host "Verifying with ESLint..." -ForegroundColor Yellow')
[void]$fixLines.Add('npx eslint src/ --ext .ts,.tsx --max-warnings 2000')

[System.IO.File]::WriteAllLines($fixScriptPath, $fixLines, [System.Text.Encoding]::UTF8)

$raSummary = @"
## require-await Analysis

Total suppressed: **$($requireAwait.Count)**

### Fixable - Remove async keyword ($($fixable.Count))
These functions are marked `async` but contain no `await` or Promise calls.
Remove the `async` keyword to resolve the `require-await` violation.

"@

if ($fixable.Count -gt 0) {
    $raSummary += "| File | Line | Original (truncated) |`n|------|------|----------------------|`n"
    foreach ($item in ($fixable | Sort-Object File, Line)) {
        $shortLine = if ($item.OriginalLine.Length -gt 80) { $item.OriginalLine.Substring(0, 77) + "..." } else { $item.OriginalLine }
        $raSummary += "| ``$($item.File)`` | $($item.Line) | ``$shortLine`` |`n"
    }
}

$raSummary += "`n### Needs review ($($needsAwait.Count))
These functions call Promises without awaiting them manually. Review each case.

"@

if ($needsAwait.Count -gt 0) {
    $raSummary += "| File | Line | Original (truncated) |`n|------|------|----------------------|`n"
    foreach ($item in ($needsAwait | Sort-Object File, Line)) {
        $shortLine = if ($item.OriginalLine.Length -gt 80) { $item.OriginalLine.Substring(0, 77) + "..." } else { $item.OriginalLine }
        $raSummary += "| ``$($item.File)`` | $($item.Line) | ``$shortLine`` |`n"
    }
}

$raSummary += "`n### Keep - Suppression necessary ($($keep.Count))

These functions legitimately need async for internal await usage.

"@

$mdRaPath = Join-Path $outputDir "require-await-analysis.md"
[System.IO.File]::WriteAllText($mdRaPath, $raSummary, [System.Text.Encoding]::UTF8)

Write-Host "    Fix script: $fixScriptPath ($($fixable.Count) fixable)" -ForegroundColor Green
Write-Host "    Analysis:   $mdRaPath" -ForegroundColor Gray

# ============================================================
# Report 2: react-refresh distribution + split plan
# ============================================================
Write-Host "`n[2] react-refresh: $($reactRefresh.Count) suppressed comments" -ForegroundColor Yellow

$rrCsvPath = Join-Path $outputDir "react-refresh-analysis.csv"
$reactRefresh | Export-Csv -Path $rrCsvPath -NoTypeInformation -Encoding UTF8

$rrByFile = $reactRefresh | Group-Object File | Sort-Object Count -Descending

Write-Host "    By file:" -ForegroundColor Gray
foreach ($g in $rrByFile) {
    Write-Host "      $($g.Name): $($g.Count) warnings" -ForegroundColor White
}

# Read context for each react-refresh entry
$rrDetailed = @()
foreach ($group in $rrByFile) {
    $currentFile = $group.Name
    $filePath = Join-Path $projectRoot $currentFile.Replace("/", "\")
    if (-not (Test-Path $filePath)) { continue }
    
    $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
    
    foreach ($entry in $group.Group) {
        $ln = $entry.Line
        if ($ln -ge $lines.Count) { continue }
        
        $line = $lines[$ln - 1]
        $nextLines = @()
        $searchEnd = [Math]::Min($ln + 2, $lines.Count - 1)
        for ($i = $ln; $i -le $searchEnd; $i++) {
            $nextLines += $lines[$i]
        }
        $context = ($nextLines -join " ").Trim()
        if ($context.Length -gt 120) { $context = $context.Substring(0, 117) + "..." }
        
        $isComponent = $context -match 'function\s+\w+|const\s+\w+\s*=\s*React|const\s+\w+\s*=\s*\(' -or
                       $context -match 'export\s+(default\s+)?function\s+\w+|export\s+(default\s+)?const\s+\w+\s*=\s*'
        $isConstOrFn = $context -match 'export\s+(const|function|enum|type|interface|class)\s+\w+'
        $isHelper = $context -match 'export\s+(const|function)\s+\w+' -and -not ($context -match 'function\s+\w+\s*\(.*\)\s*:\s*(React|JSX|ReactNode)')
        
        $suggestion = if ($isComponent) {
            "KEEP: export component - separate concern"
        } elseif ($isHelper) {
            "EXTRACT: Move to $($group.Name -replace '\.tsx?', '')/.constants.ts or .utils.ts"
        } else {
            "REVIEW: Determine if component or helper"
        }
        
        $rrDetailed += [PSCustomObject]@{
            File = $currentFile
            Line = $ln
            Context = $context
            Suggestion = $suggestion
        }
    }
}

$rrMd = "# react-refresh/only-export-components Analysis`n`n"
$rrMd += "Total suppressed: **$($reactRefresh.Count)** across **$($rrByFile.Count)** files`n`n"
$rrMd += "## Distribution by File`n`n"
$rrMd += "| File | Count | Extract Suggestion |`n|------|-------|-------------------|`n"

foreach ($g in $rrByFile) {
    $suggSet = $g.Group | ForEach-Object { $_.Context }
    $suggSet = $suggSet | Select-Object -First 3
    $suggStr = ($suggSet -join "; ")
    if ($suggStr.Length -gt 80) { $suggStr = $suggStr.Substring(0, 77) + "..." }
    $rrMd += "| ``$($g.Name)`` | $($g.Count) | $suggStr |`n"
}

$rrMd += "`n## Detailed Analysis`n`n"
$rrMd += "| File | Line | Context | Suggestion |`n|------|------|---------|------------|`n"
foreach ($item in ($rrDetailed | Sort-Object File, Line)) {
    $ctx = $item.Context
    if ($ctx.Length -gt 100) { $ctx = $ctx.Substring(0, 97) + "..." }
    $rrMd += "| ``$($item.File)`` | $($item.Line) | ``$ctx`` | $($item.Suggestion) |`n"
}

$rrMd += "`n## Extraction Strategy`n`n"
$rrMd += "For each file with non-component exports, create a companion file:`n`n"
$rrMd += "1. **Constants**: Create `ComponentName.constants.ts` for exported constants/types`n"
$rrMd += "2. **Utilities**: Create `ComponentName.utils.ts` for helper functions`n"
$rrMd += "3. **Hooks**: Create `useComponentName.ts` for custom hooks`n`n"
$rrMd += "This keeps the main `.tsx` file focused on component definitions only.`n"

$rrMdPath = Join-Path $outputDir "react-refresh-analysis.md"
[System.IO.File]::WriteAllText($rrMdPath, $rrMd, [System.Text.Encoding]::UTF8)

Write-Host "    Analysis:  $rrMdPath" -ForegroundColor Gray

# ============================================================
# Report 3: no-console distribution
# ============================================================
Write-Host "`n[3] no-console: $($noConsole.Count) suppressed comments" -ForegroundColor Yellow

$ncCsvPath = Join-Path $outputDir "no-console-distribution.csv"
$noConsole | Export-Csv -Path $ncCsvPath -NoTypeInformation -Encoding UTF8

$ncByFile = $noConsole | Group-Object File | Sort-Object Count -Descending
Write-Host "    By file:" -ForegroundColor Gray
foreach ($g in $ncByFile) {
    Write-Host "      $($g.Name): $($g.Count)" -ForegroundColor White
}

# Detailed console usage listing
$ncDetailed = @()
foreach ($file in $results) {
    $relPath = $file.filePath.Replace($projectRoot + "\", "").Replace("\", "/")
    if (-not $file.suppressedMessages) { continue }
    
    $hasConsoleSuppression = $file.suppressedMessages | Where-Object { $_.ruleId -eq "no-console" }
    if (-not $hasConsoleSuppression) { continue }
    
    $filePath = $file.filePath
    if (-not (Test-Path $filePath)) { continue }
    
    $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match 'console\.(log|warn|error|info|debug|trace|group|dir|table)\b') {
            $matchType = if ($line -match 'console\.log') { 'log' }
                        elseif ($line -match 'console\.warn') { 'warn' }
                        elseif ($line -match 'console\.error') { 'error' }
                        elseif ($line -match 'console\.info') { 'info' }
                        elseif ($line -match 'console\.debug') { 'debug' }
                        elseif ($line -match 'console\.group') { 'group' }
                        else { 'other' }
            
            $hasSuppressAbove = $false
            if ($i -gt 0 -and $lines[$i - 1] -match 'eslint-disable(?:-next-line)?\s+.*no-console') {
                $hasSuppressAbove = $true
            }
            
            $ncDetailed += [PSCustomObject]@{
                File = $relPath
                Line = $i + 1
                ConsoleType = $matchType
                HasSuppressDirective = $hasSuppressAbove
                Content = $line.Trim()
            }
        }
    }
}

$ncMd = "# no-console Distribution Report`n`n"
$ncMd += "Total console calls with eslint-disable: **$($noConsole.Count)**`n`n"
$ncMd += "Additional console calls found (without eslint-disable): `n`n"

$ncByType = $ncDetailed | Group-Object ConsoleType | Sort-Object Count -Descending
$ncMd += "## By Type`n`n"
$ncMd += "| Type | Count |`n|------|-------|`n"
foreach ($g in $ncByType) {
    $ncMd += "| ``$($g.Name)`` | $($g.Count) |`n"
}

$ncMd += "`n## By File`n`n"
$ncMd += "| File | Count | console.log | console.warn | console.error | Other |`n|------|-------|-------------|-------------|--------------|-------|`n"
foreach ($g in $ncByFile) {
    $fileEntries = $ncDetailed | Where-Object { $_.File -eq $g.Name }
    $logCount = ($fileEntries | Where-Object { $_.ConsoleType -eq "log" }).Count
    $warnCount = ($fileEntries | Where-Object { $_.ConsoleType -eq "warn" }).Count
    $errorCount = ($fileEntries | Where-Object { $_.ConsoleType -eq "error" }).Count
    $otherCount = ($fileEntries | Where-Object { $_.ConsoleType -notin @("log","warn","error") }).Count
    $ncMd += "| ``$($g.Name)`` | $($g.Count) | $logCount | $warnCount | $errorCount | $otherCount |`n"
}

$ncMd += "`n## Full Listing (with eslint-disable suppressions)`n`n"
$ncMd += "| File | Line | Type | Content |`n|------|------|------|---------|`n"
foreach ($item in ($ncDetailed | Where-Object { $_.HasSuppressDirective } | Sort-Object File, Line)) {
    $content = $item.Content
    if ($content.Length -gt 100) { $content = $content.Substring(0, 97) + "..." }
    $ncMd += "| ``$($item.File)`` | $($item.Line) | $($item.ConsoleType) | ``$content`` |`n"
}

$ncMd += "`n## Recommendation`n`n"
$ncMd += "### Safe to convert to logger`n"
$ncMd += "- **console.log** → `logger.info()` or `logger.debug()``n"
$ncMd += "- **console.info** → `logger.info()``n"
$ncMd += "- **console.debug** → `logger.debug()``n"
$ncMd += "`n"
$ncMd += "### Keep as console (diagnostic purposes)`n"
$ncMd += "- **console.warn** → Keep for warnings (ESLint allows warn/error by default)`n"
$ncMd += "- **console.error** → Keep for errors`n"
$ncMd += "- **console.group** → Keep for formatted diagnostic output`n"

$ncMdPath = Join-Path $outputDir "no-console-distribution.md"
[System.IO.File]::WriteAllText($ncMdPath, $ncMd, [System.Text.Encoding]::UTF8)

Write-Host "    Report:    $ncMdPath" -ForegroundColor Gray

# ============================================================
# Final Summary
# ============================================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Analysis Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  require-await:  $($requireAwait.Count) total, $($fixable.Count) fixable (remove async)" -ForegroundColor White
Write-Host "  react-refresh:  $($reactRefresh.Count) total across $($rrByFile.Count) files" -ForegroundColor White
Write-Host "  no-console:     $($noConsole.Count) suppressed + $($ncDetailed.Count) total console calls" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nGenerated files:" -ForegroundColor Gray
Write-Host "  $raCsvPath" -ForegroundColor White
Write-Host "  $mdRaPath" -ForegroundColor White
Write-Host "  $fixScriptPath" -ForegroundColor White
Write-Host "  $rrCsvPath" -ForegroundColor White
Write-Host "  $rrMdPath" -ForegroundColor White
Write-Host "  $ncCsvPath" -ForegroundColor White
Write-Host "  $ncMdPath" -ForegroundColor White
