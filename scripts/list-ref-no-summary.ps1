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
        $title = ''
        if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') {
            $title = $matches[1].Trim()
        }
        $isArchive = $doc.FullName -match '\\archive\\'
        $results += [PSCustomObject]@{
            Path = $doc.FullName.Replace($PWD.Path + '\', '')
            Title = $title
            Tier = $tier
            Type = $type
            Domain = $domain
            HasSummary = $hasSummary
            IsArchive = $isArchive
        }
    }
}

$refDocs = $results | Where-Object { $_.Tier -eq 'reference' -and -not $_.HasSummary -and -not $_.IsArchive }
Write-Host "Reference docs missing summary (non-archive): $($refDocs.Count)"
Write-Host ""
$refDocs | Select-Object Path, Title, Domain, Type | Format-Table -AutoSize

Write-Host ""
Write-Host "===== By domain ====="
$refDocs | Group-Object Domain | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "$($_.Name): $($_.Count)"
}
