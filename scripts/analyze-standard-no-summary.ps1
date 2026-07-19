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
            if ($title.StartsWith('"') -and $title.EndsWith('"')) {
                $title = $title.Substring(1, $title.Length - 2)
            }
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

$standardDocs = $results | Where-Object { $_.Tier -eq 'standard' -and -not $_.IsArchive -and -not $_.HasSummary }
Write-Host "Standard docs missing summary (non-archive): $($standardDocs.Count)"
Write-Host ""

Write-Host "===== By domain ====="
$standardDocs | Group-Object Domain | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "$($_.Name): $($_.Count)"
}

Write-Host ""
Write-Host "===== By type ====="
$standardDocs | Group-Object Type | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "$($_.Name): $($_.Count)"
}

Write-Host ""
Write-Host "===== Sample (first 20) ====="
$standardDocs | Select-Object -First 20 Path, Title, Domain, Type | Format-Table -AutoSize
