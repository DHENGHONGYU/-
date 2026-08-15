# Analyze no-unused-vars and any-related warning distribution
# Generates a detailed report on where these warnings occur

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$outputDir = Join-Path $projectRoot "outputs\audit"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "=== Analyzing no-unused-vars & any-related Warnings ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate lint JSON report
Write-Host "Step 1: Running ESLint with JSON format..." -ForegroundColor Yellow
$reportPath = Join-Path $outputDir "lint-warnings-analysis.json"

Set-Location $projectRoot
npx eslint src/ --ext .ts,.tsx --format json --max-warnings 5000 2>$null | Out-File -FilePath $reportPath -Encoding UTF8

if (-not (Test-Path $reportPath)) {
    Write-Host "ERROR: Failed to generate lint report" -ForegroundColor Red
    exit 1
}

Write-Host "    Report generated" -ForegroundColor Green

# Step 2: Parse and analyze
Write-Host "Step 2: Parsing report..." -ForegroundColor Yellow
$raw = Get-Content $reportPath -Raw
$results = $raw | ConvertFrom-Json

# Define rule groups
$unusedVarRules = @("@typescript-eslint/no-unused-vars", "no-unused-vars")
$anyRelatedRules = @(
    "@typescript-eslint/no-explicit-any",
    "no-explicit-any",
    "@typescript-eslint/no-unsafe-assignment",
    "@typescript-eslint/no-unsafe-return",
    "@typescript-eslint/no-unsafe-call",
    "@typescript-eslint/no-unsafe-member-access",
    "@typescript-eslint/no-unsafe-argument",
    "@typescript-eslint/no-unsafe-unary-minus",
    "@typescript-eslint/strict-boolean-expressions"
)

# Collect entries
$unusedVars = @()
$anyRelated = @()

foreach ($file in $results) {
    $relPath = $file.filePath.Replace($projectRoot + "\", "").Replace("\", "/")
    
    # Check messages
    if ($file.messages) {
        foreach ($msg in $file.messages) {
            if ($msg.ruleId -in $unusedVarRules) {
                $unusedVars += [PSCustomObject]@{
                    File = $relPath
                    Line = $msg.line
                    Column = $msg.column
                    Message = $msg.message
                    Rule = $msg.ruleId
                    Severity = $msg.severity
                }
            }
            if ($msg.ruleId -in $anyRelatedRules) {
                $anyRelated += [PSCustomObject]@{
                    File = $relPath
                    Line = $msg.line
                    Column = $msg.column
                    Message = $msg.message
                    Rule = $msg.ruleId
                    Severity = $msg.severity
                }
            }
        }
    }
    
    # Check suppressed messages
    if ($file.suppressedMessages) {
        foreach ($msg in $file.suppressedMessages) {
            if ($msg.ruleId -in $unusedVarRules) {
                $unusedVars += [PSCustomObject]@{
                    File = $relPath
                    Line = $msg.line
                    Column = $msg.column
                    Message = $msg.message
                    Rule = $msg.ruleId
                    Severity = $msg.severity
                    Suppressed = $true
                }
            }
            if ($msg.ruleId -in $anyRelatedRules) {
                $anyRelated += [PSCustomObject]@{
                    File = $relPath
                    Line = $msg.line
                    Column = $msg.column
                    Message = $msg.message
                    Rule = $msg.ruleId
                    Severity = $msg.severity
                    Suppressed = $true
                }
            }
        }
    }
}

Write-Host "    Found $($unusedVars.Count) no-unused-vars entries" -ForegroundColor Green
Write-Host "    Found $($anyRelated.Count) any-related entries" -ForegroundColor Green

# Step 3: Generate CSV files
Write-Host "Step 3: Generating CSV reports..." -ForegroundColor Yellow

$unusedVarsCsv = Join-Path $outputDir "no-unused-vars.csv"
$unusedVars | Export-Csv -Path $unusedVarsCsv -NoTypeInformation -Encoding UTF8
Write-Host "    CSV: no-unused-vars.csv ($($unusedVars.Count) entries)" -ForegroundColor Gray

$anyRelatedCsv = Join-Path $outputDir "any-related-warnings.csv"
$anyRelated | Export-Csv -Path $anyRelatedCsv -NoTypeInformation -Encoding UTF8
Write-Host "    CSV: any-related-warnings.csv ($($anyRelated.Count) entries)" -ForegroundColor Gray

# Step 4: Generate Markdown report
Write-Host "Step 4: Generating Markdown report..." -ForegroundColor Yellow

$mdPath = Join-Path $outputDir "unused-vars-and-any-report.md"

# Calculate statistics
$uvActive = @($unusedVars | Where-Object { -not $_.Suppressed })
$uvSuppressed = @($unusedVars | Where-Object { $_.Suppressed })
$arActive = @($anyRelated | Where-Object { -not $_.Suppressed })
$arSuppressed = @($anyRelated | Where-Object { $_.Suppressed })

# Group any-related by rule
$anyByRule = $anyRelated | Group-Object Rule | Sort-Object Count -Descending

$md = "# ESLint Warning Distribution Report`n`n"
$md += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n"

$md += "## Summary`n`n"
$md += "| Category | Total | Active | Suppressed | Files |`n|----------|-------|--------|------------|-------|`n"
$md += "| no-unused-vars | $($unusedVars.Count) | $($uvActive.Count) | $($uvSuppressed.Count) | $(($unusedVars | Group-Object File).Count) |`n"
$md += "| any-related (all rules) | $($anyRelated.Count) | $($arActive.Count) | $($arSuppressed.Count) | $(($anyRelated | Group-Object File).Count) |`n"

# Rule breakdown for any-related
$md += "`n### Any-Related Rules Breakdown`n`n"
$md += "| Rule | Count | % of Total |`n|------|-------|------------|`n"
foreach ($g in $anyByRule) {
    $pct = [math]::Round($g.Count / [math]::Max($anyRelated.Count, 1) * 100, 1)
    $md += "| ``$($g.Name)`` | $($g.Count) | ${pct}% |`n"
}

# no-unused-vars section
$md += "`n## 1. no-unused-vars Analysis`n`n"
$md += "### By File`n`n"
$md += "| File | Count | Suppressed |`n|------|-------|------------|`n"
$uvByFile = $unusedVars | Group-Object File | Sort-Object Count -Descending
foreach ($g in $uvByFile) {
    $suppressedCount = ($g.Group | Where-Object { $_.Suppressed }).Count
    $md += "| ``$($g.Name)`` | $($g.Count) | $suppressedCount |`n"
}

$md += "`n### Full Listing`n`n"
$md += "| # | File | Line | Message | Suppressed |`n|---|------|------|---------|------------|`n"
$idx = 1
foreach ($item in ($unusedVars | Sort-Object File, Line)) {
    $msg = if ($item.Message.Length -gt 100) { $item.Message.Substring(0, 97) + "..." } else { $item.Message }
    $supp = if ($item.Suppressed) { "Yes" } else { "No" }
    $md += "| $idx | ``$($item.File)`` | $($item.Line) | $msg | $supp |`n"
    $idx++
}

# any-related section
$md += "`n## 2. Any-Related Warnings Analysis`n`n"

# By file
$md += "### By File (Top 30)`n`n"
$md += "| File | Count | % of Total |`n|------|-------|------------|`n"
$arByFile = $anyRelated | Group-Object File | Sort-Object Count -Descending | Select-Object -First 30
foreach ($g in $arByFile) {
    $pct = [math]::Round($g.Count / [math]::Max($anyRelated.Count, 1) * 100, 1)
    $md += "| ``$($g.Name)`` | $($g.Count) | ${pct}% |`n"
}

# By directory
$md += "`n### By Directory`n`n"
$md += "| Directory | Count |`n|-----------|-------|`n"
$arByDir = $anyRelated | ForEach-Object {
    $parts = $_.File -split "/"
    if ($parts.Length -gt 2) { "$($parts[0])/$($parts[1])/$($parts[2])" } else { $_.File }
} | Group-Object | Sort-Object Count -Descending
foreach ($g in $arByDir) {
    $md += "| ``$($g.Name)`` | $($g.Count) |`n"
}

# Full listing by rule
$md += "`n### Full Listing (By Rule, First 100)`n`n"
foreach ($rule in $anyByRule) {
    $md += "#### $($rule.Name) ($($rule.Count) warnings)`n`n"
    $md += "| File | Line | Message |`n|------|------|---------|`n"
    $items = $rule.Group | Sort-Object File, Line | Select-Object -First 100
    foreach ($item in $items) {
        $msg = if ($item.Message.Length -gt 120) { $item.Message.Substring(0, 117) + "..." } else { $item.Message }
        $md += "| ``$($item.File)`` | $($item.Line) | $msg |`n"
    }
    $md += "`n"
}

# Recommendations
$md += "`n## Recommendations`n`n"
$md += "### no-unused-vars`n"
$md += "1. **Test files**: Most warnings are in test files (``*.test.ts``). Consider adding test-specific ESLint overrides to ignore unused vars in tests.`n"
$md += "2. **Naming convention**: Use underscore prefix (``_unused``) for intentionally unused variables to satisfy the rule.`n"
$md += "3. **Remove dead code**: Some unused variables may indicate dead code that should be removed entirely.`n"
$md += "4. **React props**: In React components, remove unused destructured props from the component parameter.`n"
$md += "`n### Any-Related Warnings`n"
$md += "1. **Type definitions**: Replace ``any`` with proper TypeScript interfaces, especially for API responses.`n"
$md += "2. **Use ``unknown``**: When the type is truly unknown, prefer ``unknown`` over ``any`` - it forces type checking before use.`n"
$md += "3. **Generic types**: Use generics (``T``, ``K``, ``V``) for flexible type scenarios instead of ``any``.`n"
$md += "4. **Type guards**: Add proper type narrowing before accessing properties on potentially ``any`` values.`n"
$md += "5. **Third-party libraries**: Create type declaration files (``.d.ts``) for untyped third-party libraries.`n"
$md += "6. **Strict boolean expressions**: Replace ``if (someAny)`` with explicit type checks like ``if (someAny != null)`` or ``if (typeof someAny === 'string')``.`n"

[System.IO.File]::WriteAllText($mdPath, $md, [System.Text.Encoding]::UTF8)
Write-Host "    Report: $mdPath" -ForegroundColor Green

# Step 5: Print summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Analysis Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "no-unused-vars:" -ForegroundColor Yellow
Write-Host "  Total: $($unusedVars.Count)" -ForegroundColor White
Write-Host "  Active: $($uvActive.Count)" -ForegroundColor Green
Write-Host "  Suppressed: $($uvSuppressed.Count)" -ForegroundColor Gray
Write-Host "  Files affected: $(($unusedVars | Group-Object File).Count)" -ForegroundColor White
Write-Host ""

Write-Host "Any-related warnings:" -ForegroundColor Yellow
Write-Host "  Total: $($anyRelated.Count)" -ForegroundColor White
Write-Host "  Active: $($arActive.Count)" -ForegroundColor Green
Write-Host "  Suppressed: $($arSuppressed.Count)" -ForegroundColor Gray
Write-Host "  Files affected: $(($anyRelated | Group-Object File).Count)" -ForegroundColor White
Write-Host ""

Write-Host "Any-related by rule:" -ForegroundColor Cyan
foreach ($g in $anyByRule) {
    Write-Host "  $($g.Name): $($g.Count)" -ForegroundColor White
}

Write-Host ""
Write-Host "Top files with no-unused-vars:" -ForegroundColor Cyan
foreach ($g in ($uvByFile | Select-Object -First 5)) {
    Write-Host "  $($g.Name): $($g.Count)" -ForegroundColor White
}

Write-Host ""
Write-Host "Top files with any-related warnings:" -ForegroundColor Cyan
foreach ($g in ($arByFile | Select-Object -First 5)) {
    Write-Host "  $($g.Name): $($g.Count)" -ForegroundColor White
}

Write-Host ""
Write-Host "Generated files:" -ForegroundColor Gray
Write-Host "  $unusedVarsCsv" -ForegroundColor White
Write-Host "  $anyRelatedCsv" -ForegroundColor White
Write-Host "  $mdPath" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan