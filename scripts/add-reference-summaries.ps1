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
    if ($tier -ne 'reference') {
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

    $summary = ''
    $fileName = $doc.Name
    $dirName = $doc.Directory.Name

    if ($fileName -eq 'README.md') {
        $dirPath = $doc.DirectoryName.Replace($PWD.Path + '\docs', '').Trim('\')
        if ($dirPath -eq '') {
            $summary = 'FinSightV9 documentation hub with full library navigation and category index'
        } else {
            $dirParts = $dirPath -split '\\'
            $lastDir = $dirParts[-1]
            $summary = "$lastDir directory document index and navigation entry"
        }
    }
    elseif ($fileName -like '*registry-index*' -or $fileName -like '*REGISTRY_INDEX*') {
        $summary = 'Document category index registry with domain and type-based library navigation'
    }
    elseif ($fileName -like '*adr*' -or $title -like 'ADR-*') {
        $cleanTitle = $title -replace '^ADR-\d+:\s*', ''
        $summary = "Architecture Decision Record: $cleanTitle"
        if ($summary.Length -gt 100) {
            $summary = $summary.Substring(0, 97) + '...'
        }
    }
    elseif ($title -ne '' -and $title -ne 'TODO-ADD-TITLE') {
        $cleanTitle = $title
        if ($type -eq 'reference') {
            $summary = "$cleanTitle reference document"
        } elseif ($type -eq 'reports') {
            $summary = "$cleanTitle report"
        } elseif ($type -eq 'explanation') {
            $summary = "$cleanTitle detailed explanation"
        } else {
            $summary = $cleanTitle
        }
        if ($summary.Length -gt 100) {
            $summary = $summary.Substring(0, 97) + '...'
        }
    }
    else {
        $firstHeading = ''
        if ($body -match '(?m)^#\s+(.+?)\s*$') {
            $firstHeading = $matches[1].Trim()
        }
        if ($firstHeading -ne '') {
            $summary = "$firstHeading reference document"
            if ($summary.Length -gt 100) {
                $summary = $summary.Substring(0, 97) + '...'
            }
        } else {
            $skipped++
            Write-Host ("SKIP: " + $doc.FullName.Replace($PWD.Path + '\', '') + " - no title")
            continue
        }
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
        Write-Host ("SKIP: " + $doc.FullName.Replace($PWD.Path + '\', '') + " - no insert point")
        continue
    }

    $newContent = "---`n" + $newFm + "`n---" + $body
    Set-Content -Path $doc.FullName -Value $newContent -NoNewline
    $updated++
    Write-Host ("OK: " + $doc.FullName.Replace($PWD.Path + '\', '') + " -> " + $summary)
}

Write-Host ""
Write-Host "Total updated: $updated"
Write-Host "Total skipped: $skipped"
