param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

# domain keyword scoring: filename/title keywords weighted
$domainKeywords = @{
    data = @('data-definition','data-dictionary','dataflow','databridge','data-layer','data-architecture','data-collection','collection','indexeddb','schema','store','stock-pool','asset','data-lineage','db-migration','dataset','data-security','news-data','seven-dim','multi-factor','data-blueprint')
    frontend = @('ui-','-ui','ux','widget','component','cockpit','page','layout','theme','a11y','i18n','visual','css','spacing','design-token','token','kimi','portalshell','navigation','route','routing','interaction','icon','chart','dark')
    backend = @('engine','service','algo','backtest','strategy','screening','trading','factor','pipeline','signal','scoring','score','algorithm')
    ai = @('mcp','agent','llm','prompt','ai-','-ai','memory-layer','skill')
    qa = @('test','qa','audit','checklist','verification','regression','security-test','penetration','vulnerability','quality','coverage','e2e','a11y-check')
    architecture = @('architecture','adr-','adr_','blueprint','infra','framework','system-architecture','design-principles','complexity')
    product = @('prd','persona','scenario','competitive','product','requirement','user-','privacy')
}

function Score-Domains($text) {
    $scores = @{}
    foreach ($d in $domainKeywords.Keys) {
        $s = 0
        foreach ($kw in $domainKeywords[$d]) {
            $matchesFound = [regex]::Matches($text, [regex]::Escape($kw))
            $s += $matchesFound.Count
        }
        if ($s -gt 0) { $scores[$d] = $s }
    }
    return $scores
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$stats = @{ rescored = 0; changed = 0; keptProject = 0 }
$changes = @()
$ambiguous = @()

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }

    $fm = $matches[1]
    $domain = ""
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }
    if ($domain -ne "project") { continue }

    # skip 00-meta which is legitimately project
    if ($relPath -match '^00-meta/') { continue }

    $title = ""
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $text = "$base $($title.ToLower())"

    $scores = Score-Domains $text
    if ($scores.Count -eq 0) {
        $stats.keptProject++
        continue
    }

    $stats.rescored++
    $sorted = $scores.GetEnumerator() | Sort-Object Value -Descending
    $top = $sorted | Select-Object -First 1
    $second = $sorted | Select-Object -Skip 1 -First 1

    # unique top with score >= 1 is confident enough
    $newDomain = $null
    if (-not $second -or $top.Value -gt $second.Value) {
        $newDomain = $top.Key
    } else {
        # tie-break rules
        if ($base -match '^adr[-_]') { $newDomain = "architecture" }
        elseif ($text -match 'strategy') { $newDomain = "backend" }
        elseif ($text -match 'migration') { $newDomain = "architecture" }
    }

    if ($newDomain) {
        $changes += [PSCustomObject]@{ Path = $relPath; Old = "project"; New = $newDomain; Score = $top.Value }
        if ($Apply) {
            $newFm = $fm -replace '(?m)^domain\s*:.*$', "domain: $newDomain"
            $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
            Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
            $stats.changed++
        }
    } else {
        $cand = ($sorted | ForEach-Object { "$($_.Key):$($_.Value)" }) -join ", "
        $ambiguous += [PSCustomObject]@{ Path = $relPath; Candidates = $cand }
    }
}

Write-Host ""
Write-Host "===== Domain Re-inference Summary =====" -ForegroundColor Yellow
Write-Host "Rescored (had keyword hits): $($stats.rescored)"
Write-Host "High-confidence changes: $($changes.Count)"
Write-Host "Ambiguous (need manual): $($ambiguous.Count)"
Write-Host "No keyword hits (stay project): $($stats.keptProject)"
if ($Apply) { Write-Host "Applied: $($stats.changed)" -ForegroundColor Green }

Write-Host ""
Write-Host "=== Proposed changes by new domain ===" -ForegroundColor Yellow
$changes | Group-Object New | Sort-Object Count -Descending | ForEach-Object { "{0,-15} {1}" -f $_.Name, $_.Count }

if (-not $Apply) {
    Write-Host ""
    Write-Host "=== Sample changes (first 30) ===" -ForegroundColor Yellow
    $changes | Select-Object -First 30 | ForEach-Object { "  $($_.New)  [$($_.Score)]  $($_.Path)" }
    Write-Host ""
    Write-Host "=== Ambiguous (first 30) ===" -ForegroundColor Yellow
    $ambiguous | Select-Object -First 30 | ForEach-Object { "  $($_.Path)  ->  $($_.Candidates)" }
}

