$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$results = @()
$coreFields = @('title', 'type', 'domain', 'status', 'tier', 'version', 'last_updated')

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    $isArchive = $doc.FullName -match '\\archive\\'
    $path = $doc.FullName.Replace($PWD.Path + '\', '')
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]

    $coreScore = 0
    $corePerField = 30 / $coreFields.Count
    foreach ($field in $coreFields) {
        if ($fm -match "(?m)^\s*$field\s*:\s*.+") { $coreScore += $corePerField }
    }

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    $type = ''
    if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') { $type = $matches[1].Trim() }
    $domain = ''
    if ($fm -match '(?m)^\s*domain\s*:\s*(.+?)\s*$') { $domain = $matches[1].Trim() }

    $recScore = 0
    $recFields = @('maintainer', 'phase', 'tags', 'summary')
    if ($tier -eq 'important' -or $tier -eq 'reference') { $recFields += 'doc_id' }
    $recPerField = 25 / ($recFields.Count + 1)
    foreach ($field in $recFields) {
        if ($fm -match "(?m)^\s*$field\s*:\s*.+") {
            if ($field -eq 'tags') {
                if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
                    $tagStr = $matches[1].Trim()
                    $tagCount = 0
                    if ($tagStr -ne '') { $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count }
                    if ($tagCount -ge 3) { $recScore += $recPerField }
                    elseif ($tagCount -ge 1) { $recScore += $recPerField * 0.5 }
                }
            } else { $recScore += $recPerField }
        }
    }
    if ($fm -match '(?m)^\s*change_log\s*:\s*.+') { $recScore += $recPerField * 0.5 }

    $qualityScore = 0
    $summaryLen = 0
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') { $summaryLen = $matches[1].Trim().Length }
    if ($summaryLen -ge 30) { $qualityScore += 6 }
    elseif ($summaryLen -ge 15) { $qualityScore += 3 }
    elseif ($summaryLen -gt 0) { $qualityScore += 1 }

    $tagCount = 0
    if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
        $tagStr = $matches[1].Trim()
        if ($tagStr -ne '') { $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count }
    }
    if ($tagCount -ge 5) { $qualityScore += 6 }
    elseif ($tagCount -ge 4) { $qualityScore += 4 }
    elseif ($tagCount -ge 3) { $qualityScore += 2 }
    elseif ($tagCount -ge 1) { $qualityScore += 1 }

    $version = ''
    if ($fm -match '(?m)^\s*version\s*:\s*(.+?)\s*$') { $version = $matches[1].Trim() }
    if ($version -match '^v\d+\.\d+\.\d+$') { $qualityScore += 5 }
    elseif ($version -match '^v\d+\.\d+') { $qualityScore += 2 }

    $typePathMatch = $false
    if ($type -eq 'reference' -and $path -match '\\reference\\') { $typePathMatch = $true }
    elseif ($type -eq 'explanation' -and $path -match '\\explanation\\') { $typePathMatch = $true }
    elseif ($type -eq 'how-to' -and $path -match '\\how-to\\') { $typePathMatch = $true }
    elseif ($type -eq 'tutorials' -and $path -match '\\tutorials\\') { $typePathMatch = $true }
    elseif ($type -eq 'reports' -and $path -match '\\reports\\') { $typePathMatch = $true }
    elseif ($type -eq 'meta' -and $path -match '\\00-meta\\') { $typePathMatch = $true }
    if ($typePathMatch) { $qualityScore += 4 }

    $lastUpdated = ''
    if ($fm -match '(?m)^\s*last_updated\s*:\s*(.+?)\s*$') { $lastUpdated = $matches[1].Trim() }
    if ($lastUpdated -match '^\d{4}-\d{2}-\d{2}$') { $qualityScore += 4 }

    $structureScore = 0
    $lines = $fm -split '\r?\n'
    $fieldCount = ($lines | Where-Object { $_ -match '^\s*\w+\s*:' }).Count
    if ($fieldCount -ge 10) { $structureScore += 5 }
    elseif ($fieldCount -ge 7) { $structureScore += 3 }

    $expectedOrder = @('title', 'type', 'domain', 'phase', 'tier', 'status', 'maintainer', 'summary', 'tags', 'version', 'last_updated')
    $lastIdx = -1
    $orderedCount = 0
    foreach ($field in $expectedOrder) {
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$field\s*:") {
                if ($i -gt $lastIdx) { $orderedCount++; $lastIdx = $i }
                break
            }
        }
    }
    $structureScore += [math]::Round(($orderedCount / $expectedOrder.Count) * 8)

    $hasCodeVersion = $fm -match '(?m)^\s*code_version\s*:'
    if ($hasCodeVersion) { $structureScore += 3 }
    if ($tier -eq 'important' -and ($fm -match '(?m)^\s*doc_id\s*:')) { $structureScore += 4 }
    elseif ($tier -ne 'important') { $structureScore += 4 }

    $totalScore = [math]::Round($coreScore + $recScore + $qualityScore + $structureScore, 1)

    $results += [PSCustomObject]@{
        Path = $path
        Tier = $tier
        Type = $type
        Domain = $domain
        TotalScore = $totalScore
        CoreScore = [math]::Round($coreScore, 1)
        RecommendedScore = [math]::Round($recScore, 1)
        QualityScore = [math]::Round($qualityScore, 1)
        StructureScore = [math]::Round($structureScore, 1)
    }
}

$activeDocs = $results | Where-Object { $_.Path -notmatch '\\archive\\' }
$avgTotal = ($activeDocs | Measure-Object -Property TotalScore -Average).Average
$avgCore = ($activeDocs | Measure-Object -Property CoreScore -Average).Average
$avgRec = ($activeDocs | Measure-Object -Property RecommendedScore -Average).Average
$avgQuality = ($activeDocs | Measure-Object -Property QualityScore -Average).Average
$avgStructure = ($activeDocs | Measure-Object -Property StructureScore -Average).Average

$csvPath = "docs\00-meta\metadata-quality-scores.csv"
$activeDocs | Sort-Object TotalScore -Descending | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

Write-Host "Quality score baseline established."
Write-Host "Avg score: $([math]::Round($avgTotal, 1))/100"
Write-Host "CSV exported: $csvPath"
Write-Host "Active docs: $($activeDocs.Count)"
Write-Host ""
Write-Host "Score distribution:"
Write-Host "  A+ (90+): $($activeDocs.Where({$_.TotalScore -ge 90}).Count)"
Write-Host "  A (80-89): $($activeDocs.Where({$_.TotalScore -ge 80 -and $_.TotalScore -lt 90}).Count)"
Write-Host "  B (70-79): $($activeDocs.Where({$_.TotalScore -ge 70 -and $_.TotalScore -lt 80}).Count)"
Write-Host "  C (60-69): $($activeDocs.Where({$_.TotalScore -ge 60 -and $_.TotalScore -lt 70}).Count)"
Write-Host "  D (<60): $($activeDocs.Where({$_.TotalScore -lt 60}).Count)"
