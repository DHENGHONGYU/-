$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$results = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fm = $matches[1]
        $body = $content.Substring($matches[0].Length)

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
        $summary = ''
        if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') {
            $summary = $matches[1].Trim()
        }
        $tagCount = 0
        if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
            $tagStr = $matches[1].Trim()
            if ($tagStr -ne '') {
                $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count
            }
        }
        $hasChangeLog = $fm -match '(?m)^\s*change_log\s*:'
        $hasDocId = $fm -match '(?m)^\s*doc_id\s*:'
        $isArchive = $doc.FullName -match '\\archive\\'

        $isTemplateSummary = $false
        if ($summary -match ' reference document$' -or 
            $summary -match ' detailed explanation$' -or 
            $summary -match ' report$' -or 
            $summary -match ' step-by-step guide$' -or
            $summary -match ' meta document$' -or
            $summary -match ' document$') {
            $isTemplateSummary = $true
        }

        $results += [PSCustomObject]@{
            Path = $doc.FullName.Replace($PWD.Path + '\', '')
            Tier = $tier
            Type = $type
            Domain = $domain
            Summary = $summary
            SummaryLength = $summary.Length
            IsTemplateSummary = $isTemplateSummary
            TagCount = $tagCount
            HasChangeLog = $hasChangeLog
            HasDocId = $hasDocId
            IsArchive = $isArchive
        }
    }
}

$activeDocs = $results | Where-Object { -not $_.IsArchive }
Write-Host "Active docs: $($activeDocs.Count)"
Write-Host ""

Write-Host "===== Summary Quality Analysis ====="
$withSummary = $activeDocs | Where-Object { $_.Summary -ne '' }
$templateSummary = $activeDocs | Where-Object { $_.IsTemplateSummary }
Write-Host "With summary: $($withSummary.Count) ($([math]::Round($withSummary.Count/$activeDocs.Count*100,1))%)"
Write-Host "Template-style summary: $($templateSummary.Count) ($([math]::Round($templateSummary.Count/$withSummary.Count*100,1))% of with-summary)"
Write-Host ""

Write-Host "===== Template summary by tier ====="
$templateSummary | Group-Object Tier | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "$($_.Name): $($_.Count)"
}
Write-Host ""

Write-Host "===== Change log coverage ====="
$withChangelog = $activeDocs | Where-Object { $_.HasChangeLog }
Write-Host "With change_log: $($withChangelog.Count) ($([math]::Round($withChangelog.Count/$activeDocs.Count*100,1))%)"
$withChangelog | Group-Object Tier | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)"
}
Write-Host ""

Write-Host "===== Tag quality analysis ====="
$lowTag = $activeDocs | Where-Object { $_.TagCount -eq 3 }
Write-Host "Docs with exactly 3 tags: $($lowTag.Count) ($([math]::Round($lowTag.Count/$activeDocs.Count*100,1))%)"
Write-Host "Avg tag count: $([math]::Round(($activeDocs | Measure-Object -Property TagCount -Average).Average, 2))"
Write-Host ""

Write-Host "===== Docs with very short summary (< 20 chars) ====="
$shortSummary = $activeDocs | Where-Object { $_.SummaryLength -gt 0 -and $_.SummaryLength -lt 20 }
Write-Host "Total: $($shortSummary.Count)"
$shortSummary | Select-Object -First 15 Path, Summary, SummaryLength, Tier | Format-Table -AutoSize
