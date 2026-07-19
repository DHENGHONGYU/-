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
        $hasDocId = $fm -match '(?m)^\s*doc_id\s*:'
        $isArchive = $doc.FullName -match '\\archive\\'
        $results += [PSCustomObject]@{
            Path = $doc.FullName.Replace($PWD.Path + '\', '')
            Tier = $tier
            Type = $type
            Domain = $domain
            HasSummary = $hasSummary
            HasChangeLog = $hasChangeLog
            HasDocId = $hasDocId
            IsArchive = $isArchive
        }
    }
}

$activeDocs = $results | Where-Object { -not $_.IsArchive }
Write-Host "Active docs (non-archive): $($activeDocs.Count)"
Write-Host ""

Write-Host "===== Summary coverage by tier (active docs) ====="
$activeDocs | Group-Object Tier | ForEach-Object {
    $tier = $_.Name
    $items = $_.Group
    $total = $items.Count
    $withSummary = ($items | Where-Object { $_.HasSummary }).Count
    $withDocId = ($items | Where-Object { $_.HasDocId }).Count
    $summaryPct = [math]::Round($withSummary / $total * 100, 1)
    Write-Host "Tier: $tier | Total: $total | Summary: $withSummary ($summaryPct%) | DocId: $withDocId"
}

Write-Host ""
Write-Host "===== Overall summary coverage ====="
$total = $activeDocs.Count
$withSummary = ($activeDocs | Where-Object { $_.HasSummary }).Count
Write-Host "Total: $total | With summary: $withSummary ($([math]::Round($withSummary/$total*100,1))%)"

Write-Host ""
Write-Host "===== important docs missing summary (active) ====="
$missing = $activeDocs | Where-Object { $_.Tier -eq 'important' -and -not $_.HasSummary }
Write-Host "Total: $($missing.Count)"
$missing | Select-Object Path, Domain | Format-Table -AutoSize

Write-Host ""
Write-Host "===== reference docs missing summary (active) ====="
$missingRef = $activeDocs | Where-Object { $_.Tier -eq 'reference' -and -not $_.HasSummary }
Write-Host "Total: $($missingRef.Count)"
$missingRef | Select-Object Path, Domain | Format-Table -AutoSize
