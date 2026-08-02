param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs')
)

$ErrorActionPreference = "Stop"

function Clean-Text($s) {
    $t = $s.Trim()
    $t = $t -replace '!\[[^\]]*\]\([^)]*\)', ''
    $t = $t -replace '\[([^\]]*)\]\([^)]*\)', '$1'
    $t = $t -replace '\*\*([^*]+)\*\*', '$1'
    $t = $t -replace '`([^`]+)`', '$1'
    return $t.Trim()
}

function Extract-Source($body) {
    $lines = $body -split "`r?`n"
    foreach ($line in $lines) {
        if ($line -match '^>\s*\*\*(定位|Purpose|目标|说明|简介|核心)\*\*[：:]\s*(.+)$') {
            if ((Clean-Text $matches[2]).Length -ge 10) { return "blockquote" }
        }
    }
    $inOverview = $false
    foreach ($line in $lines) {
        if ($line -match '^#{1,3}\s') { $inOverview = ($line -match '概述|概览|Overview|Summary|简介'); continue }
        if ($inOverview -and $line.Trim() -ne '' -and $line -notmatch '^[>\-|#*]' -and $line -notmatch '^\s*$') {
            if ((Clean-Text $line).Length -ge 10) { return "overview" }
        }
    }
    $inCode = $false
    foreach ($line in $lines) {
        if ($line -match '^```') { $inCode = -not $inCode; continue }
        if ($inCode) { continue }
        $t = $line.Trim()
        if ($t -eq '' -or $t -match '^#' -or $t -match '^>' -or $t -match '^-{3,}$' -or $t -match '^\|' -or $t -match '^[-*+]\s' -or $t -match '^\d+\.\s' -or $t -match '^\*\*[^：:]+：\*\*') { continue }
        if ((Clean-Text $t).Length -ge 10) { return "paragraph" }
    }
    return "h1"
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$report = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---\s*\r?\n(.*)$') { continue }
    $fm = $matches[1]; $body = $matches[2]

    $tier = ""
    if ($fm -match '(?m)^tier\s*:\s*(.+)$') { $tier = $matches[1].Trim() }
    if ($tier -ne 'important') { continue }
    if ($fm -notmatch '(?m)^summary\s*:\s*"(.*)"') { continue }
    $summary = $matches[1]

    $source = Extract-Source $body
    if ($source -ne 'paragraph' -and $source -ne 'h1') { continue }

    $title = ""
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }

    $flags = @()
    if ($summary.Length -lt 15) { $flags += "SHORT" }
    if ($source -eq 'h1') { $flags += "TITLE_ONLY" }
    if ($summary -match '^\d+\.\s') { $flags += "LIST_LEAK" }
    if ($summary -match '\|') { $flags += "TABLE_LEAK" }
    if ($summary -match '…$') { $flags += "TRUNCATED" }
    if ($summary -match '\.md|\.ts|/src/|npm run') { $flags += "CODE_HEAVY" }
    $cjk = [regex]::Matches($summary, '[一-鿿]').Count
    if ($cjk -lt 5 -and $summary.Length -lt 40) { $flags += "LOW_INFO" }

    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $report += [PSCustomObject]@{ Path = $rel; Source = $source; Flags = ($flags -join ","); Summary = $summary }
}

$weak = $report | Where-Object { $_.Flags -ne "" }
$ok = $report | Where-Object { $_.Flags -eq "" }

Write-Host "===== Summary Quality Report =====" -ForegroundColor Yellow
Write-Host "paragraph+h1 total: $($report.Count)"
Write-Host "Weak (flagged): $($weak.Count)"
Write-Host "OK (no flags): $($ok.Count)"
Write-Host ""
Write-Host "=== Weak summaries ===" -ForegroundColor Yellow
$weak | ForEach-Object { Write-Host "[$($_.Flags)] $($_.Path)"; Write-Host "   -> $($_.Summary)" }

$out = Join-Path $PSScriptRoot 'weak-summaries.txt'
$weak | ForEach-Object { "[$($_.Flags)] $($_.Path) || $($_.Summary)" } | Set-Content $out -Encoding UTF8
Write-Host ""
Write-Host "Weak list saved: $out"
