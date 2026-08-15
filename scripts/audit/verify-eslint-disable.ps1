<#
.SYNOPSIS
    ESLint-disable comment batch verification script (v2)

.DESCRIPTION
    Verifies eslint-disable comments by comparing ESLint output with and without
    each specific rule enabled. This avoids file modifications entirely.

.USAGE
    pwsh -File scripts/audit/verify-eslint-disable.ps1
    pwsh -File scripts/audit/verify-eslint-disable.ps1 -ScanOnly
    pwsh -File scripts/audit/verify-eslint-disable.ps1 -TargetFile "src/cockpit/widgets/SignalQualityDashboardWidget.tsx"

.OUTPUTS
    outputs/audit/eslint-disable-verification.csv
    outputs/audit/eslint-disable-verification-report.md
#>

param(
    [switch]$ScanOnly,
    [string]$TargetFile = ""
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$outputDir = Join-Path $projectRoot "outputs\audit"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# ============================================================
# Step 1: Scan all eslint-disable comments
# ============================================================
Write-Host "Scan Step 1: Finding eslint-disable comments..." -ForegroundColor Cyan

$files = Get-ChildItem -Path (Join-Path $projectRoot "src") -Recurse -Include "*.ts", "*.tsx" |
    Where-Object { $_.Name -notlike "*.d.ts" }

$disableEntries = @()

foreach ($file in $files) {
    $lines = [System.IO.File]::ReadAllLines($file.FullName, [System.Text.Encoding]::UTF8)
    $relPath = $file.FullName.Replace($projectRoot + "\", "").Replace("\", "/")

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match 'eslint-disable(?:-next-line)?\s+([\w\-/,@.]+)') {
            $rules = $Matches[1].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
            foreach ($rule in $rules) {
                $disableEntries += [PSCustomObject]@{
                    File       = $relPath
                    LineNumber = $i + 1
                    Rule       = $rule
                }
            }
        }
    }
}

if ($TargetFile -ne "") {
    $disableEntries = $disableEntries | Where-Object { $_.File -eq $TargetFile }
}

Write-Host "   Found $($disableEntries.Count) eslint-disable comments" -ForegroundColor Gray

$byRule = $disableEntries | Group-Object Rule | Sort-Object Count -Descending
Write-Host "`nBy Rule:" -ForegroundColor Yellow
foreach ($group in $byRule) {
    Write-Host "   $($group.Name): $($group.Count)"
}

$byFile = $disableEntries | Group-Object File | Sort-Object Count -Descending
Write-Host "`nBy File (Top 15):" -ForegroundColor Yellow
foreach ($group in ($byFile | Select-Object -First 15)) {
    Write-Host "   $($group.Name): $($group.Count)"
}
if ($byFile.Count -gt 15) {
    Write-Host "   ... and $($byFile.Count - 15) more files"
}

# ============================================================
# Step 2: Verify using rule-comparison approach
# ============================================================
if (-not $ScanOnly) {
    Write-Host "`nStep 2: Verifying by comparing ESLint output..." -ForegroundColor Cyan

    $results = @()

    $fileGroups = $disableEntries | Group-Object File

    foreach ($fileGroup in $fileGroups) {
        $currentFile = $fileGroup.Name
        $filePath = Join-Path $projectRoot $currentFile.Replace("/", "\")

        if (-not (Test-Path $filePath)) {
            Write-Host "   WARNING: File not found: $currentFile" -ForegroundColor Yellow
            continue
        }

        Write-Host "`n   File: $currentFile" -ForegroundColor White

        $rulesForFile = $fileGroup.Group | Select-Object -ExpandProperty Rule -Unique

        # Baseline: run ESLint with all rules
        $baselineMessages = @()
        try {
            $baselineOutput = & npx eslint $filePath --format json 2>&1
            $jsonStr = ($baselineOutput -join "")
            $jsonStart = $jsonStr.IndexOf("[")
            if ($jsonStart -ge 0) {
                $jsonPart = $jsonStr.Substring($jsonStart)
                $jsonEnd = $jsonPart.LastIndexOf("]")
                if ($jsonEnd -ge 0) { $jsonPart = $jsonPart.Substring(0, $jsonEnd + 1) }
                $baselineResult = $jsonPart | ConvertFrom-Json
                if ($baselineResult -is [Array]) {
                    $baselineMessages = $baselineResult[0].messages
                } else {
                    $baselineMessages = $baselineResult.messages
                }
            }
        } catch { }

        # For each rule, run ESLint with that rule disabled
        foreach ($rule in $rulesForFile) {
            $ruleEntries = $fileGroup.Group | Where-Object { $_.Rule -eq $rule }
            $lineNumbers = $ruleEntries | Select-Object -ExpandProperty LineNumber

            $noRuleMessages = @()
            try {
                $disableRuleJson = "{'" + $rule + "': 'off'}"
                $noRuleOutput = & npx eslint $filePath --format json --rule $disableRuleJson 2>&1
                $jsonStr = ($noRuleOutput -join "")
                $jsonStart = $jsonStr.IndexOf("[")
                if ($jsonStart -ge 0) {
                    $jsonPart = $jsonStr.Substring($jsonStart)
                    $jsonEnd = $jsonPart.LastIndexOf("]")
                    if ($jsonEnd -ge 0) { $jsonPart = $jsonPart.Substring(0, $jsonEnd + 1) }
                    $noRuleResult = $jsonPart | ConvertFrom-Json
                    if ($noRuleResult -is [Array]) {
                        $noRuleMessages = $noRuleResult[0].messages
                    } else {
                        $noRuleMessages = $noRuleResult.messages
                    }
                }
            } catch { }

            # Check if rule triggers in baseline
            $baselineHasRule = ($baselineMessages | Where-Object { $_.ruleId -eq $rule }).Count
            $noRuleHasRule = ($noRuleMessages | Where-Object { $_.ruleId -eq $rule }).Count
            $ruleTriggers = $baselineHasRule -gt $noRuleHasRule

            # Check if rule triggers at the specific commented lines
            $triggersAtLine = $false
            foreach ($msg in $baselineMessages) {
                if ($msg.ruleId -eq $rule) {
                    foreach ($ln in $lineNumbers) {
                        if ([math]::Abs($msg.line - $ln) -le 3) {
                            $triggersAtLine = $true
                            break
                        }
                    }
                }
                if ($triggersAtLine) { break }
            }

            $isNecessary = $triggersAtLine -or $ruleTriggers

            foreach ($entry in $ruleEntries) {
                $status = if ($isNecessary) { "NECESSARY" } else { "STALE" }
                $reason = if ($isNecessary) {
                    if ($triggersAtLine) { "Rule triggers at commented line" }
                    else { "Rule triggers elsewhere in file" }
                } else {
                    "Rule does not trigger (may have been fixed)"
                }

                $results += [PSCustomObject]@{
                    File       = $currentFile
                    LineNumber = $entry.LineNumber
                    Rule       = $rule
                    Status     = $status
                    Reason     = $reason
                }

                $color = if ($isNecessary) { "Red" } else { "Green" }
                Write-Host "      [$status] Line $($entry.LineNumber) [$rule]: $reason" -ForegroundColor $color
            }
        }
    }

    # ============================================================
    # Step 3: Generate reports
    # ============================================================
    Write-Host "`nStep 3: Generating reports..." -ForegroundColor Cyan

    $csvPath = Join-Path $outputDir "eslint-disable-verification.csv"
    $results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    Write-Host "   CSV report: $csvPath" -ForegroundColor Gray

    $mdPath = Join-Path $outputDir "eslint-disable-verification-report.md"
    $staleCount = ($results | Where-Object { $_.Status -eq "STALE" }).Count
    $necessaryCount = ($results | Where-Object { $_.Status -eq "NECESSARY" }).Count

    $reportContent = @"
# ESLint-Disable Comment Verification Report

> Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
> Method: ESLint rule comparison (with/without each rule)

## Summary

| Metric | Count |
|--------|-------|
| Total Comments | $($results.Count) |
| NECESSARY (keep) | $necessaryCount |
| STALE (can remove) | $staleCount |

## Verification Results

| File | Line | Rule | Status | Reason |
|------|------|------|--------|--------|
"@

    foreach ($r in ($results | Sort-Object File, LineNumber)) {
        $statusStr = if ($r.Status -eq "STALE") { "STALE" } else { "NECESSARY" }
        $reportContent += "| ``$($r.File)`` | $($r.LineNumber) | ``$($r.Rule)`` | $statusStr | $($r.Reason) |`n"
    }

    if ($staleCount -gt 0) {
        $reportContent += "`n## STALE Comments - Safe to Remove`n`n"
        $staleByFile = $results | Where-Object { $_.Status -eq "STALE" } | Group-Object File
        foreach ($group in $staleByFile) {
            $reportContent += "### $($group.Name)`n`n"
            $staleLines = ($group.Group | Sort-Object LineNumber -Descending | ForEach-Object { $_.LineNumber }) -join ", "
            $reportContent += "- Lines: $staleLines`n`n"
        }
    }

    [System.IO.File]::WriteAllText($mdPath, $reportContent, [System.Text.Encoding]::UTF8)
    Write-Host "   MD report: $mdPath" -ForegroundColor Gray

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Verification Complete!" -ForegroundColor Green
    Write-Host "  NECESSARY (keep): $necessaryCount" -ForegroundColor Red
    Write-Host "  STALE (remove):   $staleCount" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
} else {
    Write-Host "`n  Scan-only mode (no verification)" -ForegroundColor Green
    Write-Host "  Found $($disableEntries.Count) eslint-disable comments" -ForegroundColor Green
    Write-Host "  Remove -ScanOnly to run full verification" -ForegroundColor Yellow
}
