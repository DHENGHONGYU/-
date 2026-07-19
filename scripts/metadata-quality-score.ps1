$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$results = @()
$totalDocs = 0

$coreFields = @('title', 'type', 'domain', 'status', 'tier', 'version', 'last_updated')
$recommendedFields = @('doc_id', 'summary', 'tags', 'maintainer', 'phase', 'change_log')

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    $isArchive = $doc.FullName -match '\\archive\\'
    $path = $doc.FullName.Replace($PWD.Path + '\', '')

    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $results += [PSCustomObject]@{
            Path = $path
            IsArchive = $isArchive
            HasFM = $false
            TotalScore = 0
            CoreScore = 0
            RecommendedScore = 0
            QualityScore = 0
            StructureScore = 0
        }
        continue
    }

    $fm = $matches[1]
    $totalDocs++

    $coreScore = 0
    $coreMax = 30
    $corePerField = $coreMax / $coreFields.Count
    foreach ($field in $coreFields) {
        if ($fm -match "(?m)^\s*$field\s*:\s*.+") {
            $coreScore += $corePerField
        }
    }

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') {
        $tier = $matches[1].Trim()
    }
    $type = ''
    if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') {
        $type = $matches[1].Trim()
    }

    $recScore = 0
    $recMax = 25
    $recFields = @('maintainer', 'phase', 'tags', 'summary')
    if ($tier -eq 'important' -or $tier -eq 'reference') {
        $recFields += 'doc_id'
    }
    $recPerField = $recMax / ($recFields.Count + 1)
    foreach ($field in $recFields) {
        if ($fm -match "(?m)^\s*$field\s*:\s*.+") {
            if ($field -eq 'tags') {
                if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
                    $tagStr = $matches[1].Trim()
                    $tagCount = 0
                    if ($tagStr -ne '') {
                        $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count
                    }
                    if ($tagCount -ge 3) { $recScore += $recPerField }
                    elseif ($tagCount -ge 1) { $recScore += $recPerField * 0.5 }
                }
            } else {
                $recScore += $recPerField
            }
        }
    }
    if ($fm -match '(?m)^\s*change_log\s*:\s*.+') {
        $recScore += $recPerField * 0.5
    }

    $qualityScore = 0
    $qualityMax = 25

    $summaryLen = 0
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') {
        $summary = $matches[1].Trim()
        $summaryLen = $summary.Length
    }
    if ($summaryLen -ge 30) { $qualityScore += 6 }
    elseif ($summaryLen -ge 15) { $qualityScore += 3 }
    elseif ($summaryLen -gt 0) { $qualityScore += 1 }

    $tagCount = 0
    if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
        $tagStr = $matches[1].Trim()
        if ($tagStr -ne '') {
            $tagCount = ($tagStr -split ',' | Where-Object { $_.Trim() -ne '' }).Count
        }
    }
    if ($tagCount -ge 5) { $qualityScore += 6 }
    elseif ($tagCount -ge 4) { $qualityScore += 4 }
    elseif ($tagCount -ge 3) { $qualityScore += 2 }
    elseif ($tagCount -ge 1) { $qualityScore += 1 }

    $version = ''
    if ($fm -match '(?m)^\s*version\s*:\s*(.+?)\s*$') {
        $version = $matches[1].Trim()
    }
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
    if ($fm -match '(?m)^\s*last_updated\s*:\s*(.+?)\s*$') {
        $lastUpdated = $matches[1].Trim()
    }
    if ($lastUpdated -match '^\d{4}-\d{2}-\d{2}$') { $qualityScore += 4 }

    $structureScore = 0
    $structMax = 20
    $lines = $fm -split '\r?\n'
    $fieldCount = ($lines | Where-Object { $_ -match '^\s*\w+\s*:' }).Count
    if ($fieldCount -ge 10) { $structureScore += 5 }
    elseif ($fieldCount -ge 7) { $structureScore += 3 }

    $orderScore = 0
    $expectedOrder = @('title', 'type', 'domain', 'phase', 'tier', 'status', 'maintainer', 'summary', 'tags', 'version', 'last_updated')
    $lastIdx = -1
    $orderedCount = 0
    foreach ($field in $expectedOrder) {
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$field\s*:") {
                if ($i -gt $lastIdx) {
                    $orderedCount++
                    $lastIdx = $i
                }
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
        IsArchive = $isArchive
        HasFM = $true
        Tier = $tier
        Type = $type
        TotalScore = $totalScore
        CoreScore = [math]::Round($coreScore, 1)
        RecommendedScore = [math]::Round($recScore, 1)
        QualityScore = [math]::Round($qualityScore, 1)
        StructureScore = [math]::Round($structureScore, 1)
    }
}

$activeDocs = $results | Where-Object { -not $_.IsArchive -and $_.HasFM }
$avgTotal = ($activeDocs | Measure-Object -Property TotalScore -Average).Average
$avgCore = ($activeDocs | Measure-Object -Property CoreScore -Average).Average
$avgRec = ($activeDocs | Measure-Object -Property RecommendedScore -Average).Average
$avgQuality = ($activeDocs | Measure-Object -Property QualityScore -Average).Average
$avgStructure = ($activeDocs | Measure-Object -Property StructureScore -Average).Average

Write-Host "===== Metadata Quality Score Report ====="
Write-Host "Active docs scored: $($activeDocs.Count)"
Write-Host ""
Write-Host "Overall avg score: $([math]::Round($avgTotal, 1)) / 100"
Write-Host ""
Write-Host "Breakdown by dimension:"
Write-Host "  Core fields:      $([math]::Round($avgCore, 1)) / 30  ($([math]::Round($avgCore/30*100,1))%)"
Write-Host "  Recommended:      $([math]::Round($avgRec, 1)) / 25  ($([math]::Round($avgRec/25*100,1))%)"
Write-Host "  Quality:          $([math]::Round($avgQuality, 1)) / 25  ($([math]::Round($avgQuality/25*100,1))%)"
Write-Host "  Structure:        $([math]::Round($avgStructure, 1)) / 20  ($([math]::Round($avgStructure/20*100,1))%)"
Write-Host ""

Write-Host "===== Score distribution ====="
$scoreBuckets = @(
    @{ Min = 90; Max = 100; Label = "A+ (90-100)" },
    @{ Min = 80; Max = 89.9; Label = "A (80-89)" },
    @{ Min = 70; Max = 79.9; Label = "B (70-79)" },
    @{ Min = 60; Max = 69.9; Label = "C (60-69)" },
    @{ Min = 0; Max = 59.9; Label = "D (<60)" }
)
foreach ($bucket in $scoreBuckets) {
    $count = ($activeDocs | Where-Object { $_.TotalScore -ge $bucket.Min -and $_.TotalScore -le $bucket.Max }).Count
    $pct = [math]::Round($count / $activeDocs.Count * 100, 1)
    Write-Host "  $($bucket.Label): $count docs ($pct%)"
}
Write-Host ""

Write-Host "===== By tier ====="
$activeDocs | Group-Object Tier | ForEach-Object {
    $tier = $_.Name
    $items = $_.Group
    $avg = ($items | Measure-Object -Property TotalScore -Average).Average
    Write-Host "  $tier`: $($items.Count) docs, avg $([math]::Round($avg, 1))"
}
Write-Host ""

Write-Host "===== Bottom 10 docs (lowest scores) ====="
$activeDocs | Sort-Object TotalScore | Select-Object -First 10 Path, TotalScore, CoreScore, QualityScore | Format-Table -AutoSize
