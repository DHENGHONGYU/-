$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$relationContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationContent | ConvertFrom-Json

$masterContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterContent | ConvertFrom-Json

$pathToMeta = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $doc = $masterIndex.documents.$($prop.Name)
    $pathToMeta[$doc.path.ToLower()] = $doc
}

$orphans = @()
foreach ($orphan in $relationIndex.orphans) {
    $docId = $orphan.doc_id
    $path = $orphan.path.ToLower()
    
    $actualPath = $path
    if (-not (Test-Path $path)) {
        $glob = Get-ChildItem -Path "docs" -Filter "*$([System.IO.Path]::GetFileName($path))" -Recurse -ErrorAction SilentlyContinue
        if ($glob) {
            $actualPath = $glob.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
        }
    }
    
    $meta = $null
    if ($pathToMeta.ContainsKey($path)) {
        $meta = $pathToMeta[$path]
    }
    
    $tier = if ($meta -and $meta.tier) { $meta.tier } else { "" }
    $status = if ($meta -and $meta.status) { $meta.status } else { "" }
    $lastUpdated = if ($meta -and $meta.last_updated) { $meta.last_updated } else { "" }
    
    $classification = ""
    if ($status -eq 'archived') {
        $classification = "move-to-pending"
    } elseif ($status -eq 'draft') {
        $classification = "move-to-pending"
    } elseif ($tier -eq 'important' -or $tier -eq 'core') {
        $classification = "add-cross-ref"
    } else {
        $classification = "keep"
    }
    
    $orphans += [PSCustomObject]@{
        doc_id = $docId
        path = $actualPath
        tier = $tier
        status = $status
        last_updated = $lastUpdated
        classification = $classification
    }
}

Write-Host "=== Orphan Document Triage ==="
Write-Host "Total orphans: $($orphans.Count)"
Write-Host ""

$byClassification = $orphans | Group-Object classification
foreach ($group in $byClassification) {
    Write-Host "--- $($group.Name) ($($group.Count)) ---"
    foreach ($o in $group.Group) {
        Write-Host "  [$($o.status)] [$($o.tier)] $($o.doc_id) - $($o.path)"
    }
    Write-Host ""
}

$orphans | Export-Csv -Path "docs/_pending-review/orphan-triage.csv" -NoTypeInformation -Encoding UTF8

Write-Host "Triage report written to: docs/_pending-review/orphan-triage.csv"