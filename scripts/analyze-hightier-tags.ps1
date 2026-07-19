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
        $tagCount = 0
        $tags = @()
        if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
            $tagStr = $matches[1].Trim()
            if ($tagStr -ne '') {
                $tags = ($tagStr -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
                $tagCount = $tags.Count
            }
        }
        $isArchive = $doc.FullName -match '\\archive\\'
        $results += [PSCustomObject]@{
            Path = $doc.FullName.Replace($PWD.Path + '\', '')
            Tier = $tier
            Type = $type
            Domain = $domain
            TagCount = $tagCount
            Tags = $tags -join ', '
            IsArchive = $isArchive
        }
    }
}

$highTier = $results | Where-Object { ($_.Tier -eq 'important' -or $_.Tier -eq 'reference') -and -not $_.IsArchive }
Write-Host "Important + Reference docs (active): $($highTier.Count)"
Write-Host ""

Write-Host "===== Tag count distribution ====="
$highTier | Group-Object TagCount | Sort-Object { [int]$_.Name } | ForEach-Object {
    Write-Host "$($_.Name) tags: $($_.Count) docs"
}
Write-Host ""

$lowTagHighTier = $highTier | Where-Object { $_.TagCount -le 3 }
Write-Host "High-tier docs with <= 3 tags: $($lowTagHighTier.Count)"
Write-Host ""
$lowTagHighTier | Select-Object -First 30 Path, TagCount, Tags, Domain, Type | Format-Table -AutoSize
