function Extract-QualitySummary($body, $title) {
    $lines = $body -split '\r?\n'
    $inBlockquote = $false
    $blockquoteText = ''
    $firstParagraph = ''
    $inParagraph = $false

    foreach ($line in $lines) {
        if ($line -match '^>\s*(.+?)\s*$') {
            $blockquoteText += ' ' + $matches[1].Trim()
            $inBlockquote = $true
            continue
        }
        elseif ($inBlockquote -and $line -eq '') {
            $inBlockquote = $false
        }

        if ($line -match '^##\s') { break }

        if ($line -match '^#\s') { continue }
        if ($line -eq '---') { continue }
        if ($line -eq '') {
            if ($inParagraph -and $firstParagraph.Length -gt 20) { break }
            $inParagraph = $false
            continue
        }
        if ($line -match '^\|') { continue }
        if ($line -match '^```') { continue }

        if (-not $inParagraph) {
            $inParagraph = $true
        }
        $firstParagraph += ' ' + $line.Trim()

        if ($firstParagraph.Length -gt 150) { break }
    }

    $candidate = ''
    if ($blockquoteText.Trim().Length -ge 15) {
        $candidate = $blockquoteText.Trim()
    }
    elseif ($firstParagraph.Trim().Length -ge 15) {
        $candidate = $firstParagraph.Trim()
    }

    if ($candidate -match '^```') { return '' }
    if ($candidate.Length -lt 10) { return '' }
    if ($candidate -match '^[^\x00-\x7F]+$' -and $candidate.Length -lt 15) { return '' }

    if ($candidate.Length -gt 100) {
        $candidate = $candidate.Substring(0, 97) + '...'
    }

    return $candidate
}

$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$fixed = 0
$skipped = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        continue
    }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $summary = ''
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') {
        $summary = $matches[1].Trim()
    }
    if ($summary -eq '') { continue }

    $isArchive = $doc.FullName -match '\\archive\\'
    if ($isArchive) { continue }

    $isBad = $false
    if ($summary -match '^```') { $isBad = $true }
    elseif ($summary -match '^[^\x00-\x7F]+$' -and $summary.Length -lt 15) { $isBad = $true }
    elseif ($summary -match '一句话描述') { $isBad = $true }
    elseif ($summary.Length -lt 12) { $isBad = $true }
    elseif ($summary -match ' report$' -and $summary.Length -lt 20) { $isBad = $true }

    if (-not $isBad) { continue }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') {
        $title = $matches[1].Trim()
    }

    $newSummary = Extract-QualitySummary $body $title
    if ($newSummary -eq '' -or $newSummary.Length -lt 15) {
        $skipped++
        Write-Host ("SKIP: " + $doc.FullName.Replace($PWD.Path + '\', '') + " - cannot extract good summary")
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
    $fixed++
    Write-Host ("FIX: " + $doc.FullName.Replace($PWD.Path + '\', ''))
    Write-Host ("  OLD: $summary")
    Write-Host ("  NEW: $newSummary")
}

Write-Host ""
Write-Host "Fixed: $fixed"
Write-Host "Skipped: $skipped"
