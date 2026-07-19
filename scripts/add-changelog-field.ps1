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
    if ($tier -ne 'quick-note') { continue }
    if ($doc.FullName -match '\\archive\\') { continue }

    if ($fm -match '(?m)^\s*change_log\s*:') {
        $skipped++
        continue
    }

    $version = ''
    if ($fm -match '(?m)^\s*version\s*:\s*(.+?)\s*$') { $version = $matches[1].Trim() }
    $lastUpdated = ''
    if ($fm -match '(?m)^\s*last_updated\s*:\s*(.+?)\s*$') { $lastUpdated = $matches[1].Trim() }
    $status = ''
    if ($fm -match '(?m)^\s*status\s*:\s*(.+?)\s*$') { $status = $matches[1].Trim() }

    $changeLog = @()
    if ($version -ne '' -and $lastUpdated -ne '') {
        $changeLog += "  - version: $version"
        $changeLog += "    date: $lastUpdated"
        $changeLog += "    changes: Initial version established"
    }

    if ($changeLog.Count -eq 0) {
        $skipped++
        continue
    }

    $changeLogStr = "change_log:`n" + ($changeLog -join "`n")

    $newFm = $fm
    $inserted = $false

    if ($newFm -match '(?m)(^\s*code_version\s*:.*$)') {
        $newFm = $newFm -replace '(?m)(^\s*code_version\s*:.*$)', "`$1`n$changeLogStr"
        $inserted = $true
    }
    elseif ($newFm -match '(?m)(^\s*last_updated\s*:.*$)') {
        $newFm = $newFm -replace '(?m)(^\s*last_updated\s*:.*$)', "`$1`n$changeLogStr"
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

Write-Host "Updated: $updated"
Write-Host "Skipped: $skipped"
