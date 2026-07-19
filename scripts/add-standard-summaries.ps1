$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$updated = 0
$skipped = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        continue
    }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') {
        $tier = $matches[1].Trim()
    }
    if ($tier -ne 'standard') {
        continue
    }
    if ($fm -match '(?m)^\s*summary\s*:') {
        continue
    }
    if ($doc.FullName -match '\\archive\\') {
        continue
    }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') {
        $title = $matches[1].Trim()
        if ($title.StartsWith('"') -and $title.EndsWith('"')) {
            $title = $title.Substring(1, $title.Length - 2)
        }
    }
    $domain = ''
    if ($fm -match '(?m)^\s*domain\s*:\s*(.+?)\s*$') {
        $domain = $matches[1].Trim()
    }
    $type = ''
    if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') {
        $type = $matches[1].Trim()
    }

    if ($title -eq '' -or $title -eq 'TODO-ADD-TITLE') {
        $firstHeading = ''
        if ($body -match '(?m)^#\s+(.+?)\s*$') {
            $firstHeading = $matches[1].Trim()
        }
        if ($firstHeading -ne '') {
            $title = $firstHeading
        } else {
            $skipped++
            continue
        }
    }

    $summary = ''
    $typeLabel = ''
    switch ($type) {
        'reference' { $typeLabel = 'reference document' }
        'explanation' { $typeLabel = 'detailed explanation' }
        'reports' { $typeLabel = 'report' }
        'how-to' { $typeLabel = 'step-by-step guide' }
        'tutorials' { $typeLabel = 'tutorial' }
        'meta' { $typeLabel = 'meta document' }
        default { $typeLabel = 'document' }
    }

    $cleanTitle = $title -replace '["\\]', ''
    if ($cleanTitle.Length -gt 70) {
        $cleanTitle = $cleanTitle.Substring(0, 67) + '...'
    }

    $summary = "$cleanTitle $typeLabel"
    if ($summary.Length -gt 100) {
        $summary = $summary.Substring(0, 97) + '...'
    }

    $summary = $summary -replace '"', '\"'
    $newFm = $fm
    $inserted = $false

    if ($newFm -match '(?m)(^\s*tags\s*:.*$)') {
        $newFm = $newFm -replace '(?m)(^\s*tags\s*:.*$)', ("summary: `"$summary`"`n" + '$1')
        $inserted = $true
    }
    elseif ($newFm -match '(?m)(^\s*maintainer\s*:.*$)') {
        $newFm = $newFm -replace '(?m)(^\s*maintainer\s*:.*$)', ("summary: `"$summary`"`n" + '$1')
        $inserted = $true
    }

    if (-not $inserted) {
        $skipped++
        continue
    }

    $newContent = "---`n" + $newFm + "`n---" + $body
    Set-Content -Path $doc.FullName -Value $newContent -NoNewline
    $updated++
}

Write-Host "Total updated: $updated"
Write-Host "Total skipped: $skipped"
