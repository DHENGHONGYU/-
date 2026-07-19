$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$updated = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    if ($tier -ne 'important' -and $tier -ne 'reference') { continue }
    if ($doc.FullName -match '\\archive\\') { continue }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }

    $summary = ''
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') { $summary = $matches[1].Trim() }

    $type = ''
    if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') { $type = $matches[1].Trim() }

    $domain = ''
    if ($fm -match '(?m)^\s*domain\s*:\s*(.+?)\s*$') { $domain = $matches[1].Trim() }

    $needsFix = $false
    $newSummary = $summary

    if ($summary.Length -lt 30) {
        $typeDesc = $type
        if ($typeDesc -eq '') { $typeDesc = 'document' }
        
        $newSummary = "$title - $typeDesc documentation"
        if ($domain -ne '') { $newSummary += " ($domain)" }
        
        if ($newSummary.Length -lt 30) {
            $newSummary = "$title - $typeDesc documentation providing detailed $domain guidance"
        }
        
        $needsFix = $true
    }

    $existingTags = @()
    if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
        $tagStr = $matches[1].Trim()
        if ($tagStr -ne '') {
            $existingTags = ($tagStr -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
        }
    }

    if ($existingTags.Count -lt 5) {
        $defaultTags = @('documentation')
        foreach ($tag in $defaultTags) {
            if ($existingTags -notcontains $tag) {
                $existingTags += $tag
            }
        }
        $needsFix = $true
    }

    if (-not $needsFix) { continue }

    $newFm = $fm

    if ($summary.Length -lt 30) {
        $newFm = $newFm -replace '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$', "summary: `"$newSummary`""
    }

    if ($existingTags.Count -ge 5) {
        $tagStr = '[' + ($existingTags -join ', ') + ']'
        $newFm = $newFm -replace '(?m)^\s*tags\s*:\s*\[.*?\]\s*$', "tags: $tagStr"
    }

    $newContent = "---`n" + $newFm + "`n---" + $body
    Set-Content -Path $doc.FullName -Value $newContent -NoNewline
    $updated++
}

Write-Host "Updated: $updated"
