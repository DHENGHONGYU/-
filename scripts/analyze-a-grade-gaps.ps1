$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$results = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($doc.FullName -match '\\archive\\') { continue }

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }

    $tagCount = 0
    if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
        $tagStr = $matches[1].Trim()
        if ($tagStr -ne '') { $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count }
    }

    $summaryLen = 0
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') { $summaryLen = $matches[1].Trim().Length }

    $version = ''
    if ($fm -match '(?m)^\s*version\s*:\s*(.+?)\s*$') { $version = $matches[1].Trim() }

    $hasChangeLog = $fm -match '(?m)^\s*change_log\s*:'

    $results += [PSCustomObject]@{
        Path = $doc.FullName.Replace($PWD.Path + '\', '')
        Tier = $tier
        TagCount = $tagCount
        SummaryLen = $summaryLen
        HasVersion = ($version -ne '')
        HasChangeLog = $hasChangeLog
    }
}

$aDocs = $results | Where-Object { $_.Tier -eq 'important' -or $_.Tier -eq 'reference' }
Write-Host "High-tier docs: $($aDocs.Count)"
Write-Host ""

Write-Host "===== Tag count distribution ====="
$aDocs | Group-Object TagCount | Sort-Object { [int]$_.Name } | ForEach-Object {
    Write-Host "  $($_.Name) tags: $($_.Count) docs"
}
Write-Host ""

Write-Host "===== Summary length distribution ====="
$buckets = @(
    @{ Min = 0; Max = 14; Label = "<15 chars" },
    @{ Min = 15; Max = 29; Label = "15-29 chars" },
    @{ Min = 30; Max = 49; Label = "30-49 chars" },
    @{ Min = 50; Max = 99; Label = "50-99 chars" },
    @{ Min = 100; Max = 999; Label = "100+ chars" }
)
foreach ($b in $buckets) {
    $count = ($aDocs | Where-Object { $_.SummaryLen -ge $b.Min -and $_.SummaryLen -le $b.Max }).Count
    Write-Host "  $($b.Label): $count docs"
}
Write-Host ""

$lowTag = $aDocs | Where-Object { $_.TagCount -lt 5 }
$shortSummary = $aDocs | Where-Object { $_.SummaryLen -lt 30 }
Write-Host "===== Opportunity analysis ====="
Write-Host "Docs with <5 tags (can gain 2-4 pts): $($lowTag.Count)"
Write-Host "Docs with <30 char summary (can gain 3-5 pts): $($shortSummary.Count)"
Write-Host "Both issues (max gain): $($aDocs.Where({$_.TagCount -lt 5 -and $_.SummaryLen -lt 30}).Count)"
Write-Host ""
Write-Host "===== Sample of docs needing improvement ====="
$aDocs | Where-Object { $_.TagCount -lt 5 -or $_.SummaryLen -lt 30 } | Select-Object -First 20 Path, Tier, TagCount, SummaryLen | Format-Table -AutoSize
