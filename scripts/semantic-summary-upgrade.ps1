function Extract-SemanticSummary($body, $title, $maxLen = 100) {
    $lines = $body -split '\r?\n'
    $blockquote = @()
    $firstPara = @()
    $inBlockquote = $false
    $inPara = $false
    $foundHeading = $false

    foreach ($line in $lines) {
        if ($line -match '^#\s') {
            if ($foundHeading -and $firstPara.Count -gt 0) { break }
            $foundHeading = $true
            continue
        }
        if ($line -match '^##\s') {
            if ($firstPara.Count -gt 0 -or $blockquote.Count -gt 0) { break }
        }

        if ($line -match '^>\s*(.+?)\s*$') {
            $blockquote += $matches[1].Trim()
            $inBlockquote = $true
            continue
        } elseif ($inBlockquote -and $line -eq '') {
            $inBlockquote = $false
            if ($blockquote.Count -gt 0 -and $blockquote[0].Length -ge 10) { break }
        }

        if ($line -eq '---') { continue }
        if ($line -eq '') {
            if ($inPara -and $firstPara.Count -gt 0) {
                $paraText = ($firstPara -join ' ').Trim()
                if ($paraText.Length -ge 15) { break }
            }
            $inPara = $false
            continue
        }
        if ($line -match '^\|') { continue }
        if ($line -match '^```') { continue }
        if ($line -match '^-\s') { continue }
        if ($line -match '^\d+\.\s') { continue }
        if ($line -match '^<') { continue }

        if (-not $inPara) { $inPara = $true }
        $firstPara += $line.Trim()
    }

    $bqText = ($blockquote -join ' ').Trim()
    $paraText = ($firstPara -join ' ').Trim()

    $candidate = ''
    if ($bqText.Length -ge 20 -and $bqText -notmatch '^```') {
        $candidate = $bqText
    } elseif ($paraText.Length -ge 20) {
        $candidate = $paraText
    }

    if ($candidate -eq '') { return '' }
    if ($candidate -match '^```') { return '' }

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
$updated = 0
$skipped = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    if ($tier -ne 'standard') { continue }
    if ($doc.FullName -match '\\archive\\') { continue }

    $summary = ''
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') { $summary = $matches[1].Trim() }
    if ($summary -eq '') { continue }

    $isTemplate = $false
    if ($summary -match ' reference document$' -or
        $summary -match ' detailed explanation$' -or
        $summary -match ' report$' -or
        $summary -match ' step-by-step guide$' -or
        $summary -match ' meta document$' -or
        $summary -match ' document$' -or
        $summary -match ' guide$' -or
        $summary -match ' specification$' -or
        $summary -match ' spec$') {
        $isTemplate = $true
    }

    if (-not $isTemplate -and $summary.Length -ge 25) {
        $skipped++
        continue
    }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }

    $newSummary = Extract-SemanticSummary $body $title
    if ($newSummary -eq '' -or $newSummary.Length -lt 15) {
        $skipped++
        continue
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
    $updated++
    Write-Host ("OK: " + $doc.FullName.Replace($PWD.Path + '\', ''))
    Write-Host ("  OLD: $summary")
    Write-Host ("  NEW: $newSummary")
}

Write-Host ""
Write-Host "Updated: $updated"
Write-Host "Skipped: $skipped"
