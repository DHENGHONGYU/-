$samplePaths = @(
    'docs\README.md',
    'docs\00-meta\metadata-governance-phased-plan.md',
    'docs\reference\v9-system-blueprint.md',
    'docs\explanation\adr-007-screening-signal-persistence-review.md',
    'docs\how-to\code-review-guide.md',
    'docs\reports\audit\mcp-usage\mcp-usage-report-1784331636620.md',
    'docs\03-development\data-flow-convergence-plan.md',
    'docs\reference\ai-center-contract.md'
)

Write-Host "===== Integrity check for 8 sampled docs ====="
Write-Host ""

foreach ($relPath in $samplePaths) {
    $fullPath = Join-Path $PWD.Path $relPath
    if (-not (Test-Path $fullPath)) {
        Write-Host "--- $relPath ---"
        Write-Host "  ERROR: File not found!"
        Write-Host ""
        continue
    }
    
    $content = Get-Content $fullPath -Raw
    Write-Host "--- $relPath ---"
    
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        Write-Host "  ERROR: No frontmatter found!"
        Write-Host ""
        continue
    }
    
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)
    
    $lines = $fm -split '\r?\n' | Where-Object { $_ -match '\S' }
    $fieldCount = ($lines | Where-Object { $_ -match '^\s*\w+\s*:' }).Count
    
    Write-Host "  Fields: $fieldCount"
    
    $hasChangeLog = $fm -match '(?m)^\s*change_log\s*:'
    $hasVersion = $fm -match '(?m)^\s*version\s*:'
    $hasSummary = $fm -match '(?m)^\s*summary\s*:'
    $hasTags = $fm -match '(?m)^\s*tags\s*:'
    
    Write-Host "  change_log: $hasChangeLog"
    Write-Host "  version: $hasVersion"
    Write-Host "  summary: $hasSummary"
    Write-Host "  tags: $hasTags"
    
    if ($body.Trim().StartsWith('#')) {
        Write-Host "  Body: starts with H1 OK"
    } else {
        $preview = $body.Trim().Substring(0, [math]::Min(40, $body.Trim().Length))
        Write-Host "  Body preview: $preview..."
    }
    
    Write-Host ""
}

Write-Host "===== Final validation ====="
$allValid = $true
foreach ($relPath in $samplePaths) {
    $fullPath = Join-Path $PWD.Path $relPath
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
            $allValid = $false
            break
        }
    }
}

Write-Host "All sample docs have valid frontmatter: $allValid"
