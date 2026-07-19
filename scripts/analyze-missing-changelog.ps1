$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$skipped = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    if ($tier -ne 'important' -and $tier -ne 'reference') { continue }
    if ($doc.FullName -match '\\archive\\') { continue }

    if ($fm -match '(?m)^\s*change_log\s*:') { continue }

    $version = ''
    if ($fm -match '(?m)^\s*version\s*:\s*(.+?)\s*$') { $version = $matches[1].Trim() }
    $lastUpdated = ''
    if ($fm -match '(?m)^\s*last_updated\s*:\s*(.+?)\s*$') { $lastUpdated = $matches[1].Trim() }

    $reason = ''
    if ($version -eq '') { $reason += 'no-version;' }
    if ($lastUpdated -eq '') { $reason += 'no-lastUpdated;' }
    if ($reason -eq '') { $reason = 'unknown' }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }

    $skipped += [PSCustomObject]@{
        Path = $doc.FullName.Replace($PWD.Path + '\', '')
        Tier = $tier
        Title = $title
        HasVersion = ($version -ne '')
        HasLastUpdated = ($lastUpdated -ne '')
        Reason = $reason
    }
}

Write-Host "High-tier docs missing change_log: $($skipped.Count)"
Write-Host ""
Write-Host "By tier:"
$skipped | Group-Object Tier | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)"
}
Write-Host ""
Write-Host "By reason:"
$skipped | Group-Object Reason | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)"
}
Write-Host ""
Write-Host "===== Missing version ====="
$skipped | Where-Object { -not $_.HasVersion } | Select-Object Path, Tier, Title | Format-Table -AutoSize
Write-Host ""
Write-Host "===== Missing last_updated ====="
$skipped | Where-Object { -not $_.HasLastUpdated } | Select-Object Path, Tier, Title | Format-Table -AutoSize
