param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

function Clean-Text($s) {
    $t = $s.Trim()
    # strip markdown bold/italic/links/images
    $t = $t -replace '!\[[^\]]*\]\([^)]*\)', ''
    $t = $t -replace '\[([^\]]*)\]\([^)]*\)', '$1'
    $t = $t -replace '\*\*([^*]+)\*\*', '$1'
    $t = $t -replace '`([^`]+)`', '$1'
    $t = $t.Trim()
    return $t
}

function Extract-Summary($body) {
    $lines = $body -split "`r?`n"

    # 1. blockquote 定位/Purpose/说明 line
    foreach ($line in $lines) {
        if ($line -match '^>\s*\*\*(定位|Purpose|目标|说明|简介|核心)\*\*[：:]\s*(.+)$') {
            $s = Clean-Text $matches[2]
            if ($s.Length -ge 10) { return @{ Text = $s; Source = "blockquote" } }
        }
    }

    # 2. ## 概述 / ## 概述与目标 / ## Overview section first paragraph
    $inOverview = $false
    foreach ($line in $lines) {
        if ($line -match '^#{1,3}\s') {
            $inOverview = ($line -match '概述|概览|Overview|Summary|简介')
            continue
        }
        if ($inOverview -and $line.Trim() -ne '' -and $line -notmatch '^[>\-|#*]' -and $line -notmatch '^\s*$') {
            $s = Clean-Text $line
            if ($s.Length -ge 10) { return @{ Text = $s; Source = "overview" } }
        }
    }

    # 3. first plain paragraph (skip headings, blockquotes, HR, tables, lists, code fences)
    $inCode = $false
    foreach ($line in $lines) {
        if ($line -match '^```') { $inCode = -not $inCode; continue }
        if ($inCode) { continue }
        $t = $line.Trim()
        if ($t -eq '' -or $t -match '^#' -or $t -match '^>' -or $t -match '^-{3,}$' -or $t -match '^\|' -or $t -match '^[-*+]\s' -or $t -match '^\d+\.\s' -or $t -match '^\*\*[^：:]+：\*\*') { continue }
        $s = Clean-Text $t
        if ($s.Length -ge 10) { return @{ Text = $s; Source = "paragraph" } }
    }

    # 4. H1 fallback
    foreach ($line in $lines) {
        if ($line -match '^#\s+(.+)$') {
            $s = Clean-Text $matches[1]
            if ($s.Length -ge 4) { return @{ Text = $s; Source = "h1" } }
        }
    }
    return $null
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$need = 0
$extracted = 0
$applied = 0
$bySource = @{}
$samples = @()
$tooLong = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---\s*\r?\n(.*)$') { continue }
    $fm = $matches[1]
    $body = $matches[2]

    $tier = ""
    if ($fm -match '(?m)^tier\s*:\s*(.+)$') { $tier = $matches[1].Trim() }
    if ($tier -ne 'important') { continue }
    if ($fm -match '(?m)^summary\s*:') { continue }

    $need++
    $r = Extract-Summary $body
    if (-not $r) { continue }

    $s = $r.Text
    # truncate to 100 chars at sentence boundary if possible
    if ($s.Length -gt 100) {
        $cut = $s.Substring(0, 100)
        $m = [regex]::Matches($cut, '[。；;，,、]')
        if ($m.Count -gt 0 -and $m[$m.Count-1].Index -ge 40) {
            $s = $cut.Substring(0, $m[$m.Count-1].Index + 1)
        } else {
            $s = $cut.TrimEnd() + "…"
            $tooLong++
        }
    }

    $extracted++
    $bySource[$r.Source] = ($bySource[$r.Source] + 1)
    if ($samples.Count -lt 15) {
        $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
        $samples += [PSCustomObject]@{ Path = $rel; Source = $r.Source; Summary = $s }
    }

    if ($Apply) {
        $esc = $s -replace '"', "'"
        $newFm = $fm
        if ($fm -match '(?m)^maintainer\s*:.*$') {
            $newFm = $fm -replace '(?m)^(maintainer\s*:.*)$', ('$1' + "`n" + "summary: `"$esc`"")
        } elseif ($fm -match '(?m)^phase\s*:.*$') {
            $newFm = $fm -replace '(?m)^(phase\s*:.*)$', ('$1' + "`n" + "summary: `"$esc`"")
        } else {
            $newFm = $fm.TrimEnd() + "`nsummary: `"$esc`""
        }
        $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
        Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
        $applied++
    }
}

Write-Host "===== Summary Extraction =====" -ForegroundColor Yellow
Write-Host "Important missing summary: $need"
Write-Host "Extracted: $extracted"
Write-Host "By source: $(($bySource.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', ')"
Write-Host "Truncated with ellipsis: $tooLong"
if ($Apply) { Write-Host "Applied: $applied" -ForegroundColor Green }
Write-Host ""
Write-Host "=== Samples ===" -ForegroundColor Yellow
$samples | ForEach-Object { Write-Host "  [$($_.Source)] $($_.Path)"; Write-Host "     -> $($_.Summary)" }

