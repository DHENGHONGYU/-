param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs')
)
$ErrorActionPreference = "Stop"

function Get-Frontmatter($path) {
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fmText = $matches[1]
        $result = @{}
        foreach ($line in ($fmText -split "`r?`n")) {
            if ($line -match '^([a-z_]+)\s*:\s*(.*)$') {
                $key = $matches[1].Trim()
                $val = $matches[2].Trim()
                if ($val -match '^\[(.*)\]$') {
                    $arr = ($matches[1] -split ',' | ForEach-Object { $_.Trim() }) | Where-Object { $_ }
                    $result[$key] = $arr
                } else {
                    $result[$key] = $val -replace '^"', '' -replace '"$', ''
                }
            }
        }
        return $result
    }
    return $null
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$missingSummaryImp = 0
$missingTags = 0
$tooFewTags = 0
$tooManyTags = 0
$typePathMismatch = 0

$mismatchList = @()
$fewTagsList = @()

foreach ($doc in $docs) {
    $fm = Get-Frontmatter $doc.FullName
    if (-not $fm) { continue }
    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")

    if ($fm.tier -eq 'important' -and -not $fm.summary) { $missingSummaryImp++ }
    if (-not $fm.tags) { $missingTags++ }
    if ($fm.tags -is [array] -and $fm.tags.Count -lt 3) { $tooFewTags++; $fewTagsList += [PSCustomObject]@{ Path = $rel; Count = $fm.tags.Count; Tags = ($fm.tags -join ',') } }
    if ($fm.tags -is [array] -and $fm.tags.Count -gt 8) { $tooManyTags++ }

    # type path match (same as validate-frontmatter.ps1)
    $typeDirMap = @{
        "reference" = @("reference", "01-product", "01-requirements", "04-testing", "06-project-management", "architecture", "design", "guides", "modules", "ops", "prompts", "standards", "team-handbook", "testing", "assets", "drafts", "ai", "01-p1-debt-cleanup-todo.md", "README.md", "registry-index.md")
        "explanation" = @("explanation", "architecture", "design")
        "how-to" = @("how-to", "guides", "prompts")
        "tutorials" = @("tutorials", "guides")
        "reports" = @("reports", "design", "04-testing")
        "meta" = @("00-meta", "reference/meta")
    }
    if ($fm.type -and $typeDirMap.ContainsKey($fm.type)) {
        $allowedDirs = $typeDirMap[$fm.type]
        $matched = $false
        foreach ($d in $allowedDirs) {
            if ($rel -match [regex]::Escape($d)) { $matched = $true; break }
        }
        if (-not $matched) {
            $typePathMismatch++
            $mismatchList += [PSCustomObject]@{ Path = $rel; Type = $fm.type; AllowedDirs = ($allowedDirs -join ', ') }
        }
    }
}

Write-Host "===== P2 Breakdown =====" -ForegroundColor Yellow
Write-Host "Missing summary (important tier): $missingSummaryImp"
Write-Host "Missing tags: $missingTags"
Write-Host "Too few tags (< 3): $tooFewTags"
Write-Host "Too many tags (> 8): $tooManyTags"
Write-Host "Type/Path mismatch: $typePathMismatch"
Write-Host ""
Write-Host "=== Top type/path mismatches ===" -ForegroundColor Yellow
$mismatchList | Group-Object Type | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count) files"
}
Write-Host ""
Write-Host "=== Type/path mismatch sample ===" -ForegroundColor Yellow
$mismatchList | Select-Object -First 15 | ForEach-Object {
    Write-Host "  [$($_.Type)] $($_.Path)"
}
Write-Host ""
Write-Host "=== Few-tags sample (2 tags) ===" -ForegroundColor Yellow
$fewTagsList | Where-Object { $_.Count -eq 2 } | Select-Object -First 10 | ForEach-Object {
    Write-Host "  [$($_.Count)] $($_.Path) -> $($_.Tags)"
}
