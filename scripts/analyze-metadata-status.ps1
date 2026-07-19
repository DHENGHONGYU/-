$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$results = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fm = $matches[1]
        $tier = 'unknown'
        if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') {
            $tier = $matches[1].Trim()
        }
        $type = 'unknown'
        if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') {
            $type = $matches[1].Trim()
        }
        $domain = 'unknown'
        if ($fm -match '(?m)^\s*domain\s*:\s*(.+?)\s*$') {
            $domain = $matches[1].Trim()
        }
        $hasSummary = $fm -match '(?m)^\s*summary\s*:'
        $hasChangeLog = $fm -match '(?m)^\s*change_log\s*:'
        $tagCount = 0
        if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
            $tagStr = $matches[1].Trim()
            if ($tagStr -ne '') {
                $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count
            }
        }
        $results += [PSCustomObject]@{
            Path = $doc.FullName.Replace($PWD.Path + '\', '')
            Tier = $tier
            Type = $type
            Domain = $domain
            HasSummary = $hasSummary
            HasChangeLog = $hasChangeLog
            TagCount = $tagCount
        }
    }
}

Write-Host "Total docs with FM: $($results.Count)"
Write-Host ""
Write-Host "===== Summary by Tier ====="
$results | Group-Object Tier | ForEach-Object {
    $tier = $_.Name
    $items = $_.Group
    $total = $items.Count
    $withSummary = ($items | Where-Object { $_.HasSummary }).Count
    $withChangeLog = ($items | Where-Object { $_.HasChangeLog }).Count
    $avgTags = ($items | Measure-Object -Property TagCount -Average).Average
    $summaryPct = [math]::Round($withSummary / $total * 100, 1)
    $changelogPct = [math]::Round($withChangeLog / $total * 100, 1)
    Write-Host "Tier: $tier | Total: $total | Summary: $withSummary ($summaryPct%) | ChangeLog: $withChangeLog ($changelogPct%) | AvgTags: $([math]::Round($avgTags,1))"
}

Write-Host ""
Write-Host "===== Tag Count Distribution ====="
$results | Group-Object TagCount | Sort-Object { [int]$_.Name } | ForEach-Object {
    Write-Host "$($_.Name) tags: $($_.Count) docs"
}

Write-Host ""
Write-Host "===== Docs with < 3 tags (first 20) ====="
$lowTagDocs = $results | Where-Object { $_.TagCount -lt 3 }
Write-Host "Total: $($lowTagDocs.Count)"
$lowTagDocs | Select-Object -First 20 Path, TagCount, Tier, Domain | Format-Table -AutoSize

Write-Host ""
Write-Host "===== Important/reference docs missing summary ====="
$missingSummary = $results | Where-Object { ($_.Tier -eq 'important' -or $_.Tier -eq 'reference') -and -not $_.HasSummary }
Write-Host "Total: $($missingSummary.Count)"
$missingSummary | Select-Object Path, Tier, Domain | Format-Table -AutoSize
