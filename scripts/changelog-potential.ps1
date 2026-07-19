$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$results = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]

    $isArchive = $doc.FullName -match '\\archive\\'
    if ($isArchive) { continue }

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    $hasChangeLog = $fm -match '(?m)^\s*change_log\s*:'
    $hasVersion = $fm -match '(?m)^\s*version\s*:'
    $hasLastUpdated = $fm -match '(?m)^\s*last_updated\s*:'

    $results += [PSCustomObject]@{
        Tier = $tier
        HasChangeLog = $hasChangeLog
        HasVersion = $hasVersion
        HasLastUpdated = $hasLastUpdated
    }
}

$byTier = $results | Group-Object Tier
Write-Host "Total active docs: $($results.Count)"
Write-Host ""
Write-Host "===== change_log coverage by tier ====="
foreach ($group in $byTier) {
    $tier = $group.Name
    $items = $group.Group
    $total = $items.Count
    $withCL = ($items | Where-Object { $_.HasChangeLog }).Count
    $withVer = ($items | Where-Object { $_.HasVersion }).Count
    $pct = [math]::Round($withCL / $total * 100, 1)
    Write-Host "$tier`: $total docs, $withCL with change_log ($pct%)"
    Write-Host "    Has version: $withVer"
}

Write-Host ""
Write-Host "===== Total potential for standard tier ====="
$standard = $results | Where-Object { $_.Tier -eq 'standard' }
$stdTotal = $standard.Count
$stdWithCL = ($standard | Where-Object { $_.HasChangeLog }).Count
$stdWithVer = ($standard | Where-Object { $_.HasVersion }).Count
$stdWithVerNoCL = ($standard | Where-Object { $_.HasVersion -and -not $_.HasChangeLog }).Count
Write-Host "Standard tier total: $stdTotal"
Write-Host "Already with change_log: $stdWithCL"
Write-Host "Has version but no change_log: $stdWithVerNoCL (potential)"
Write-Host "If all with version get change_log: $($stdWithCL + $stdWithVerNoCL) ($([math]::Round(($stdWithCL + $stdWithVerNoCL)/$stdTotal*100, 1))%)"

Write-Host ""
Write-Host "===== Overall potential ====="
$allWithVer = ($results | Where-Object { $_.HasVersion }).Count
$allWithCL = ($results | Where-Object { $_.HasChangeLog }).Count
$allWithVerNoCL = ($results | Where-Object { $_.HasVersion -and -not $_.HasChangeLog }).Count
Write-Host "Total docs: $($results.Count)"
Write-Host "Already with change_log: $allWithCL ($([math]::Round($allWithCL/$results.Count*100, 1))%)"
Write-Host "Has version but no change_log: $allWithVerNoCL"
Write-Host "Potential max coverage: $($allWithCL + $allWithVerNoCL) ($([math]::Round(($allWithCL + $allWithVerNoCL)/$results.Count*100, 1))%)"
