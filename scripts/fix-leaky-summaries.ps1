function Extract-CleanSummary($body, $title, $maxLen = 100) {
    $lines = $body -split '\r?\n'
    $candidates = @()
    $inBlockquote = $false
    $blockquoteText = ''
    $firstPara = ''
    $inPara = $false
    $foundHeading = $false

    foreach ($line in $lines) {
        if ($line -match '^#\s') {
            if ($foundHeading -and ($firstPara.Length -ge 15 -or $blockquoteText.Length -ge 15)) { break }
            $foundHeading = $true
            continue
        }
        if ($line -match '^##\s') {
            if ($firstPara.Length -ge 15 -or $blockquoteText.Length -ge 15) { break }
        }

        if ($line -match '^>\s*(.+?)\s*$') {
            $bqLine = $matches[1].Trim()
            # Strip markdown bold/italic markers for pattern matching
            $bqLineClean = $bqLine -replace '\*\*', '' -replace '__', ''
            # Skip frontmatter-like blockquote lines
            if ($bqLineClean -match '^\s*Status\s*:' -or $bqLineClean -match '^\s*Version\s*:' -or $bqLineClean -match '^\s*Date\s*:' -or $bqLineClean -match '^\s*Last Updated\s*:' -or $bqLineClean -match '^\s*Current\s+Version' -or $bqLineClean -match '^\s*Goal\s*:' -or $bqLineClean -match '^\s*domain\s*:' -or $bqLineClean -match '^\s*tier\s*:' -or $bqLineClean -match '^\s*phase\s*:' -or $bqLineClean -match '^\s*\w+\s*:\s*.+') {
                continue
            }
            $blockquoteText += ' ' + $bqLine
            $inBlockquote = $true
            continue
        } elseif ($inBlockquote -and $line -eq '') {
            $inBlockquote = $false
        }

        if ($line -eq '---') { continue }
        if ($line -eq '') {
            if ($inPara -and $firstPara.Length -ge 15) { break }
            $inPara = $false
            continue
        }

        # Skip frontmatter-like lines (key: value patterns)
        if ($line -match '^\s*\w+\s*:\s*.+') { continue }
        if ($line -match '^\s*domain\s*:') { continue }
        if ($line -match '^\s*tier\s*:') { continue }
        if ($line -match '^\s*phase\s*:') { continue }
        if ($line -match '^\s*status\s*:') { continue }
        if ($line -match '^\s*maintainer\s*:') { continue }
        if ($line -match '^\s*tags\s*:') { continue }
        if ($line -match '^\s*type\s*:') { continue }
        if ($line -match '^\s*version\s*:') { continue }
        if ($line -match '^\s*last_updated\s*:') { continue }
        if ($line -match '^\s*code_version\s*:') { continue }
        if ($line -match '^\s*summary\s*:') { continue }
        if ($line -match '^\s*title\s*:') { continue }
        if ($line -match '^\s*doc_id\s*:') { continue }
        # Skip Status/Version/Date blocks (common in doc headers)
        if ($line -match '^\s*Status\s*:') { continue }
        if ($line -match '^\s*Version\s*:') { continue }
        if ($line -match '^\s*Date\s*:') { continue }
        if ($line -match '^\s*Last Updated\s*:') { continue }
        if ($line -match '^\s*Current\s+Version') { continue }
        if ($line -match '^\s*Goal\s*:') { continue }
        # Skip truncated frontmatter fragments
        if ($line -match '^\s*(ence|tion|ation|ing|ed|s)\s+\w+\s*:') { continue }
        if ($line -match '\w+\s*domain\s*:') { continue }
        if ($line -match '\w+\s*tier\s*:') { continue }

        if ($line -match '^\|') { continue }
        if ($line -match '^```') { continue }
        if ($line -match '^-\s') { continue }
        if ($line -match '^\d+\.\s') { continue }
        if ($line -match '^<') { continue }

        if (-not $inPara) { $inPara = $true }
        $firstPara += ' ' + $line.Trim()
    }

    $bqText = $blockquoteText.Trim()
    $paraText = $firstPara.Trim()

    # Clean markdown formatting for validation
    $bqTextClean = $bqText -replace '\*\*', '' -replace '__', ''
    $paraTextClean = $paraText -replace '\*\*', '' -replace '__', ''

    # Validate blockquote doesn't have frontmatter leaks
    $candidate = ''
    $bqValid = $bqText.Length -ge 20 -and $bqText -notmatch '^```' -and $bqTextClean -notmatch 'domain\s*:' -and $bqTextClean -notmatch 'tier\s*:' -and $bqTextClean -notmatch 'phase\s*:' -and $bqTextClean -notmatch '^Status\s*:' -and $bqTextClean -notmatch '^Version\s*:' -and $bqTextClean -notmatch '^Date\s*:' -and $bqTextClean -notmatch '^\w+\s*:\s*.+'
    if ($bqValid) {
        $candidate = $bqText
    } else {
        $paraValid = $paraText.Length -ge 20 -and $paraText -notmatch 'domain\s*:' -and $paraText -notmatch 'tier\s*:' -and $paraText -notmatch 'phase\s*:' -and $paraTextClean -notmatch '^Status\s*:' -and $paraTextClean -notmatch '^Version\s*:' -and $paraTextClean -notmatch '^Date\s*:' -and $paraTextClean -notmatch '^\w+\s*:\s*.+'
        if ($paraValid) {
            $candidate = $paraText
        }
    }

    if ($candidate -eq '') { return '' }
    if ($candidate -match '^```') { return '' }

    # Final check on cleaned text
    $candidateClean = $candidate -replace '\*\*', '' -replace '__', ''
    if ($candidateClean -match 'domain\s*:') { return '' }
    if ($candidateClean -match 'tier\s*:') { return '' }
    if ($candidateClean -match '^Status\s*:') { return '' }
    if ($candidateClean -match '^Version\s*:') { return '' }
    if ($candidateClean -match '^Date\s*:') { return '' }
    if ($candidateClean -match '^\w+\s*:\s*.+') { return '' }

    $candidate = $candidate -replace '\*\*', ''
    $candidate = $candidate -replace '\s+', ' '

    if ($candidate.Length -gt $maxLen) {
        $lastSpace = $candidate.LastIndexOf(' ', $maxLen)
        if ($lastSpace -gt 0) {
            $candidate = $candidate.Substring(0, $lastSpace) + '...'
        } else {
            $candidate = $candidate.Substring(0, $maxLen) + '...'
        }
    }

    return $candidate.Trim()
}

$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$fixed = 0
$reverted = 0
$skipped = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $summary = ''
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') { $summary = $matches[1].Trim() }
    if ($summary -eq '') { continue }
    if ($doc.FullName -match '\\archive\\') { continue }

    $isBad = $false
    if ($summary -match 'domain\s*:' -or $summary -match 'tier\s*:' -or $summary -match 'phase\s*:' -or $summary -match 'status\s*:' -or $summary -match 'maintainer\s*:' -or $summary -match 'tags\s*:') {
        $isBad = $true
    }
    elseif ($summary -match '^Status\s*:' -or $summary -match '^Version\s*:' -or $summary -match '^Date\s*:' -or $summary -match '^Last Updated\s*:' -or $summary -match '^Current\s') {
        $isBad = $true
    }
    elseif ($summary -match '^ence\s+' -or $summary -match '^tion\s+' -or $summary -match '^ation\s+' -or $summary -match '^Sta\s+' -or $summary -match '^Ver\s+') {
        $isBad = $true
    }
    elseif ($summary.Length -lt 15) {
        $isBad = $true
    }

    if (-not $isBad) { continue }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }
    if ($title.StartsWith('"') -and $title.EndsWith('"')) {
        $title = $title.Substring(1, $title.Length - 2)
    }
    $type = ''
    if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') { $type = $matches[1].Trim() }

    $newSummary = Extract-CleanSummary $body $title

    if ($newSummary -eq '' -or $newSummary.Length -lt 15) {
        # Fallback to template-style based on title
        if ($title -ne '' -and $title -ne 'TODO-ADD-TITLE') {
            $typeLabel = switch ($type) {
                'reference' { 'reference document' }
                'explanation' { 'detailed explanation' }
                'reports' { 'report' }
                'how-to' { 'step-by-step guide' }
                'meta' { 'meta document' }
                default { 'document' }
            }
            $cleanTitle = $title -replace '["\\]', ''
            if ($cleanTitle.Length -gt 70) { $cleanTitle = $cleanTitle.Substring(0, 67) + '...' }
            $newSummary = "$cleanTitle $typeLabel"
            $reverted++
        } else {
            $skipped++
            continue
        }
    } else {
        $fixed++
    }

    if ($newSummary -eq $summary) {
        $skipped++
        continue
    }

    $newSummary = $newSummary -replace '"', '\"'
    $newFm = $fm -replace "(?m)(^\s*summary\s*:\s*`"?).*?(`"?\s*`$)", "`$1$newSummary`$2"

    if ($newFm -eq $fm) {
        $skipped++
        continue
    }

    $newContent = "---`n" + $newFm + "`n---" + $body
    Set-Content -Path $doc.FullName -Value $newContent -NoNewline
}

Write-Host "Fixed (semantic): $fixed"
Write-Host "Reverted (template): $reverted"
Write-Host "Skipped: $skipped"
Write-Host "Total processed: $($fixed + $reverted + $skipped)"
