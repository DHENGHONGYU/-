$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$results = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($doc.FullName -match '\\archive\\') { continue }

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    if ($tier -ne 'important' -and $tier -ne 'reference') { continue }

    $summary = ''
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') { $summary = $matches[1].Trim() }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }

    $tagCount = 0
    if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
        $tagStr = $matches[1].Trim()
        if ($tagStr -ne '') { $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count }
    }

    if ($summary.Length -lt 30 -or $tagCount -lt 5) {
        $results += [PSCustomObject]@{
            Path = $doc.FullName.Replace($PWD.Path + '\', '')
            Tier = $tier
            Title = $title
            Summary = $summary
            SummaryLen = $summary.Length
            TagCount = $tagCount
        }
    }
}

Write-Host "Remaining docs needing improvement: $($results.Count)"
Write-Host ""
$results | Format-Table -AutoSize

$results | Export-Csv -Path 'docs\00-meta\docs-needing-improvement.csv' -Encoding UTF8 -NoTypeInformation
Write-Host ""
Write-Host "Exported to docs\00-meta\docs-needing-improvement.csv"
