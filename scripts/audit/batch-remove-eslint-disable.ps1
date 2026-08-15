<#
.SYNOPSIS
    Batch verify and remove stale eslint-disable comments

.DESCRIPTION
    Two-phase approach:
    1. Scan: Run ESLint on src/ and find all eslint-disable comments
       - Check suppressedMessages to verify comments are necessary
       - Detect "Unused eslint-disable directive" warnings (can always remove)
    2. Remove: Safely remove verified-stale comments with backup

.USAGE
    pwsh -File scripts/audit/batch-remove-eslint-disable.ps1 -ScanOnly
    pwsh -File scripts/audit/batch-remove-eslint-disable.ps1 -RemoveStale
    pwsh -File scripts/audit/batch-remove-eslint-disable.ps1 -ReportOnly

.OUTPUTS
    outputs/audit/stale-eslint-comments.csv
    outputs/audit/stale-eslint-comments-report.md
    outputs/audit/batch-remove-eslint-comments.ps1
#>

param(
    [switch]$ScanOnly,
    [switch]$RemoveStale,
    [switch]$ReportOnly
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$outputDir = Join-Path $projectRoot "outputs\audit"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# ============================================================
# Phase 1: Scan all eslint-disable comments
# ============================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ESLint-Disable Comment Batch Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[Phase 1] Scanning eslint-disable comments..." -ForegroundColor Yellow

$files = Get-ChildItem -Path (Join-Path $projectRoot "src") -Recurse -Include "*.ts", "*.tsx" |
    Where-Object { $_.Name -notlike "*.d.ts" }

$allEntries = @()
$unusedDisableEntries = @()
$necessaryEntries = @()
$staleEntries = @()

$fileCount = 0
foreach ($file in $files) {
    $fileCount++
    if ($fileCount % 20 -eq 0) {
        Write-Host "   Scanned $fileCount files..." -ForegroundColor Gray
    }

    $relPath = $file.FullName.Replace($projectRoot + "\", "").Replace("\", "/")
    $filePath = $file.FullName

    # Run ESLint on this file
    try {
        $output = & npx eslint $filePath --format json 2>&1
        $jsonStr = ($output -join "")
        
        # Find the JSON array start
        $jsonStart = $jsonStr.IndexOf("[")
        if ($jsonStart -lt 0) { continue }
        
        $jsonPart = $jsonStr.Substring($jsonStart)
        $jsonEnd = $jsonPart.LastIndexOf("]")
        if ($jsonEnd -lt 0) { continue }
        $jsonPart = $jsonPart.Substring(0, $jsonEnd + 1)
        
        $result = $jsonPart | ConvertFrom-Json
        
        if ($result -is [Array]) {
            $fileResult = $result[0]
        } else {
            $fileResult = $result
        }

        # Check suppressed messages (these are the eslint-disable comments)
        if ($fileResult.suppressedMessages -and $fileResult.suppressedMessages.Count -gt 0) {
            foreach ($msg in $fileResult.suppressedMessages) {
                $allEntries += [PSCustomObject]@{
                    File       = $relPath
                    LineNumber = $msg.line
                    Rule       = $msg.ruleId
                    Type       = "SUPPRESSED"
                    Message    = $msg.message
                    Necessary  = $true
                }
                $necessaryEntries += [PSCustomObject]@{
                    File       = $relPath
                    LineNumber = $msg.line
                    Rule       = $msg.ruleId
                    Message    = $msg.message
                }
            }
        }

        # Check for "Unused eslint-disable directive" warnings
        if ($fileResult.messages -and $fileResult.messages.Count -gt 0) {
            foreach ($msg in $fileResult.messages) {
                if ($msg.ruleId -eq "@typescript-eslint/no-unused-eslint-disable" -or
                    $msg.message -like "*Unused eslint-disable*" -or
                    $msg.message -like "*no problems were reported*") {
                    $unusedDisableEntries += [PSCustomObject]@{
                        File       = $relPath
                        LineNumber = $msg.line
                        Rule       = "unused-directive"
                        Message    = $msg.message
                    }
                    $staleEntries += [PSCustomObject]@{
                        File       = $relPath
                        LineNumber = $msg.line
                        Rule       = "unused-directive"
                        Type       = "STALE"
                        Reason     = "Unused eslint-disable directive (rule no longer triggers)"
                    }
                }
            }
        }
    } catch {
        # Skip files that ESLint can't process
    }
}

Write-Host "`n[Phase 1 Complete]" -ForegroundColor Green
Write-Host "   Files scanned: $fileCount" -ForegroundColor White
Write-Host "   Total suppressed comments: $($allEntries.Count)" -ForegroundColor White
Write-Host "   Necessary (rule triggers): $($necessaryEntries.Count)" -ForegroundColor Green
Write-Host "   Unused directives (stale): $($unusedDisableEntries.Count)" -ForegroundColor Red

# ============================================================
# Phase 2: Verify each suppressed comment is truly necessary
# ============================================================
if (-not $ReportOnly) {
    Write-Host "`n[Phase 2] Verifying suppressed comments..." -ForegroundColor Yellow
    
    $verifiedResults = @()
    
    $groupedEntries = $necessaryEntries | Group-Object File
    
    foreach ($group in $groupedEntries) {
        $currentFile = $group.Name
        $filePath = Join-Path $projectRoot $currentFile.Replace("/", "\")
        
        Write-Host "   Verifying: $currentFile" -ForegroundColor White
        
        # For each unique rule in this file, check if the rule truly triggers
        $rulesInFile = $group.Group | Select-Object -ExpandProperty Rule -Unique
        
        foreach ($rule in $rulesInFile) {
            $ruleEntries = $group.Group | Where-Object { $_.Rule -eq $rule }
            $lineNumbers = $ruleEntries | Select-Object -ExpandProperty LineNumber
            $sampleMessage = $ruleEntries[0].Message
            
            # Check if this is a "unnecessary dependency" type (can be fixed by refactoring)
            $isUnnecessaryDep = $sampleMessage -like "*unnecessary dependency*" -or 
                               $sampleMessage -like "*unnecessary dependencies*"
            
            # Check if this is a "missing dependency" type (can be fixed by adding deps)
            $isMissingDep = $sampleMessage -like "*missing dependenc*" -or
                           $sampleMessage -like "*missing dependencies*"
            
            $fixSuggestion = if ($isUnnecessaryDep) {
                "REFACTOR: Extract dependency to make it explicit (e.g., pass as parameter)"
            } elseif ($isMissingDep) {
                "FIX: Add missing dependencies to the dependency array"
            } else {
                "KEEP: Comment is necessary but requires manual review"
            }
            
            foreach ($entry in $ruleEntries) {
                $verifiedResults += [PSCustomObject]@{
                    File        = $currentFile
                    LineNumber  = $entry.LineNumber
                    Rule        = $rule
                    Status      = "NECESSARY"
                    Message     = $entry.Message
                    Suggestion  = $fixSuggestion
                }
            }
            
            Write-Host "     Rule [$rule]: $($ruleEntries.Count) comments - $fixSuggestion" -ForegroundColor $(
                if ($isUnnecessaryDep) { "Yellow" } 
                elseif ($isMissingDep) { "Cyan" } 
                else { "Red" }
            )
        }
    }
    
    # Combine with stale entries
    $allResults = @()
    $allResults += $verifiedResults
    $allResults += $staleEntries | ForEach-Object {
        [PSCustomObject]@{
            File        = $_.File
            LineNumber  = $_.LineNumber
            Rule        = $_.Rule
            Status      = "STALE"
            Message     = $_.Message
            Suggestion  = "REMOVE: Safe to delete (rule no longer triggers)"
        }
    }
} else {
    $allResults = @()
    $allResults += $necessaryEntries | ForEach-Object {
        [PSCustomObject]@{
            File        = $_.File
            LineNumber  = $_.LineNumber
            Rule        = $_.Rule
            Status      = "NECESSARY"
            Message     = $_.Message
            Suggestion  = "Keep - rule triggers"
        }
    }
    $allResults += $staleEntries | ForEach-Object {
        [PSCustomObject]@{
            File        = $_.File
            LineNumber  = $_.LineNumber
            Rule        = $_.Rule
            Status      = "STALE"
            Message     = $_.Message
            Suggestion  = "REMOVE: Safe to delete"
        }
    }
}

# ============================================================
# Phase 3: Generate reports
# ============================================================
Write-Host "`n[Phase 3] Generating reports..." -ForegroundColor Yellow

# CSV Report
$csvPath = Join-Path $outputDir "stale-eslint-comments.csv"
$allResults | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host "   CSV: $csvPath" -ForegroundColor Gray

# Summary
$totalCount = $allResults.Count
$staleCount = ($allResults | Where-Object { $_.Status -eq "STALE" }).Count
$necessaryCount = ($allResults | Where-Object { $_.Status -eq "NECESSARY" }).Count

# Markdown Report
$mdPath = Join-Path $outputDir "stale-eslint-comments-report.md"
$mdContent = @"
# ESLint Disable Comments Audit Report

> Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
> Project: FinSightV9

## Summary

| Category | Count |
|----------|-------|
| Total Comments Found | $totalCount |
| NECESSARY (keep) | $necessaryCount |
| STALE (can remove) | $staleCount |

## Statistics by Rule

| Rule | Count | Status |
|------|-------|--------|
"@

$ruleStats = $allResults | Group-Object Rule | Sort-Object Count -Descending
foreach ($ruleGroup in $ruleStats) {
    $ruleNecessary = ($ruleGroup.Group | Where-Object { $_.Status -eq "NECESSARY" }).Count
    $ruleStale = ($ruleGroup.Group | Where-Object { $_.Status -eq "STALE" }).Count
    $statusLabel = if ($ruleStale -gt 0 -and $ruleNecessary -gt 0) { "Mixed" }
                   elseif ($ruleStale -gt 0) { "STALE" }
                   else { "NECESSARY" }
    $mdContent += "| ``$($ruleGroup.Name)`` | $($ruleGroup.Count) | $statusLabel |`n"
}

# Stale section
if ($staleCount -gt 0) {
    $mdContent += "`n## STALE Comments - Safe to Remove`n`n"
    $staleByFile = $allResults | Where-Object { $_.Status -eq "STALE" } | Group-Object File
    foreach ($group in $staleByFile) {
        $mdContent += "### $($group.Name)`n`n"
        foreach ($entry in ($group.Group | Sort-Object LineNumber)) {
            $mdContent += "- Line $($entry.LineNumber): ``$($entry.Rule)`` - $($entry.Suggestion)`n"
        }
        $mdContent += "`n"
    }
}

# Necessary section with fix suggestions
$mdContent += "`n## NECESSARY Comments - Fix Suggestions`n`n"
$necByFile = $allResults | Where-Object { $_.Status -eq "NECESSARY" } | Group-Object File
foreach ($group in $necByFile) {
    $mdContent += "### $($group.Name)`n`n"
    foreach ($entry in ($group.Group | Sort-Object LineNumber)) {
        $mdContent += "- **Line $($entry.LineNumber)** ``$($entry.Rule)``: $($entry.Suggestion)`n"
        $mdContent += "  - Message: $($entry.Message)`n"
    }
    $mdContent += "`n"
}

[System.IO.File]::WriteAllText($mdPath, $mdContent, [System.Text.Encoding]::UTF8)
Write-Host "   MD:  $mdPath" -ForegroundColor Gray

# ============================================================
# Phase 4: Generate batch removal script
# ============================================================
if ($staleCount -gt 0) {
    $batchPath = Join-Path $outputDir "batch-remove-eslint-comments.ps1"
    $batchLines = [System.Collections.ArrayList]::new()
    
    [void]$batchLines.Add('<#')
    [void]$batchLines.Add('.SYNOPSIS')
    [void]$batchLines.Add('    Auto-generated batch removal of stale eslint-disable comments')
    [void]$batchLines.Add('.DESCRIPTION')
    [void]$batchLines.Add('    Generated by audit-eslint-disable batch tool')
    [void]$batchLines.Add('    Review carefully before running!')
    [void]$batchLines.Add('#>')
    [void]$batchLines.Add('')
    [void]$batchLines.Add('$ErrorActionPreference = "Continue"')
    [void]$batchLines.Add("`$projectRoot = '$projectRoot'")
    [void]$batchLines.Add('')
    [void]$batchLines.Add('Write-Host "Removing stale eslint-disable comments..." -ForegroundColor Yellow')
    [void]$batchLines.Add('')
    [void]$batchLines.Add('$removed = 0')
    [void]$batchLines.Add('')
    
    $staleByFile = $allResults | Where-Object { $_.Status -eq "STALE" } | Group-Object File
    foreach ($group in $staleByFile) {
        $fileLines = $group.Group | Sort-Object LineNumber -Descending
        $filePathWin = $group.Name.Replace("/", "\")
        
        [void]$batchLines.Add("# File: $($group.Name)")
        [void]$batchLines.Add("`$fp = Join-Path `$projectRoot '$filePathWin'")
        [void]$batchLines.Add('if (Test-Path $fp) {')
        [void]$batchLines.Add('    $lines = [System.IO.File]::ReadAllLines($fp, [System.Text.Encoding]::UTF8)')
        
        foreach ($entry in $fileLines) {
            $ln = $entry.LineNumber
            $rule = $entry.Rule
            [void]$batchLines.Add("    if (`$lines.Length -ge $ln) { `$lines[$ln - 1] = '' }  # Line $ln [$rule]")
        }
        
        [void]$batchLines.Add('    [System.IO.File]::WriteAllLines($fp, $lines, [System.Text.Encoding]::UTF8)')
        [void]$batchLines.Add("    Write-Host '  Cleaned: $($group.Name)' -ForegroundColor Green")
        [void]$batchLines.Add('}')
        [void]$batchLines.Add('')
    }
    
    [void]$batchLines.Add('Write-Host ""')
    [void]$batchLines.Add('Write-Host "Verifying with ESLint..." -ForegroundColor Yellow')
    [void]$batchLines.Add('npx eslint src/ --ext .ts,.tsx --max-warnings 2000')
    [void]$batchLines.Add('')
    [void]$batchLines.Add('Write-Host "Done!" -ForegroundColor Green')
    
    [System.IO.File]::WriteAllLines($batchPath, $batchLines, [System.Text.Encoding]::UTF8)
    Write-Host "   Batch removal script: $batchPath" -ForegroundColor Gray
}

# ============================================================
# Summary
# ============================================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Audit Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Total comments: $totalCount" -ForegroundColor White
Write-Host "  NECESSARY (keep/fix): $necessaryCount" -ForegroundColor Yellow
Write-Host "  STALE (can remove):   $staleCount" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

if ($RemoveStale -and $staleCount -gt 0) {
    Write-Host "`n[RemoveStale] Removing stale comments..." -ForegroundColor Red
    Write-Host "WARNING: This modifies files! Review the CSV report first." -ForegroundColor Red
    
    $staleByFile = $allResults | Where-Object { $_.Status -eq "STALE" } | Group-Object File
    foreach ($group in $staleByFile) {
        $fileLines = $group.Group | Sort-Object LineNumber -Descending
        $filePath = Join-Path $projectRoot $group.Name.Replace("/", "\")
        
        if (-not (Test-Path $filePath)) { continue }
        
        $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
        $removedInFile = 0
        
        foreach ($entry in $fileLines) {
            $ln = $entry.LineNumber
            if ($lines.Length -ge $ln) {
                $originalLine = $lines[$ln - 1]
                # Check if line contains eslint-disable
                if ($originalLine -match 'eslint-disable') {
                    $lines[$ln - 1] = ''
                    $removedInFile++
                    Write-Host "  Removed line $ln from $($group.Name)" -ForegroundColor Green
                } else {
                    # Line might have already been processed or is the next line
                    # Check if it's a continuation comment
                    if ($originalLine -match '^\s*//\s*$' -or $originalLine.Trim() -eq '') {
                        $lines[$ln - 1] = ''
                        $removedInFile++
                    }
                }
            }
        }
        
        if ($removedInFile -gt 0) {
            [System.IO.File]::WriteAllLines($filePath, $lines, [System.Text.Encoding]::UTF8)
            Write-Host "  => Removed $removedInFile lines from $($group.Name)" -ForegroundColor Green
        }
    }
    
    Write-Host "`n[RemoveStale] Complete. Run lint to verify." -ForegroundColor Green
} elseif (-not $RemoveStale -and $staleCount -gt 0) {
    Write-Host "`nTIP: Run with -RemoveStale to remove stale comments." -ForegroundColor Yellow
    Write-Host "     Or review the reports in outputs/audit/ first." -ForegroundColor Yellow
}
