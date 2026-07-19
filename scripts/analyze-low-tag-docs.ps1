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

$activeDocs = $results | Where-Object { -not $_.IsArchive }
Write-Host "Active docs (non-archive): $($activeDocs.Count)"
Write-Host ""

Write-Host "===== Tag Count Distribution (active docs) ====="
$activeDocs | Group-Object TagCount | Sort-Object { [int]$_.Name } | ForEach-Object {
    Write-Host "$($_.Name) tags: $($_.Count) docs"
}

Write-Host ""
Write-Host "===== Docs with 0-2 tags (non-archive, first 30) ====="
$lowTag = $activeDocs | Where-Object { $_.TagCount -lt 3 }
Write-Host "Total: $($lowTag.Count)"
$lowTag | Select-Object -First 30 Path, TagCount, Tier, Domain, Type | Format-Table -AutoSize

Write-Host ""
Write-Host "===== By tier (low tag docs) ====="
$lowTag | Group-Object Tier | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "$($_.Name): $($_.Count)"
}
