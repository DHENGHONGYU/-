$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$relationContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationContent | ConvertFrom-Json

$masterContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterContent | ConvertFrom-Json

$orphans = @{}
foreach ($orphan in $relationIndex.orphans) {
    $docId = if ($orphan.doc_id) { $orphan.doc_id } else { $orphan.path }
    $orphans[$docId] = $orphan
}

$categories = @{
    recent_active = @()
    recent_archived = @()
    old_active = @()
    old_archived = @()
    no_metadata = @()
}

$now = Get-Date
$days90 = $now.AddDays(-90)

foreach ($docId in $orphans.Keys) {
    if ($masterIndex.documents.PSObject.Properties[$docId]) {
        $doc = $masterIndex.documents.$docId
        $status = if ($doc.status) { $doc.status } else { "unknown" }
        $lastUpdated = $doc.last_updated
        
        if ($lastUpdated) {
            try {
                $lastUpdatedDate = [datetime]::Parse($lastUpdated)
                if ($lastUpdatedDate -gt $days90) {
                    if ($status -eq "active") {
                        $categories['recent_active'] += @{
                            doc_id = $docId
                            path = $doc.path
                            status = $status
                            last_updated = $lastUpdated
                            tier = $doc.tier
                            title = $doc.title
                        }
                    } else {
                        $categories['recent_archived'] += @{
                            doc_id = $docId
                            path = $doc.path
                            status = $status
                            last_updated = $lastUpdated
                            tier = $doc.tier
                            title = $doc.title
                        }
                    }
                } else {
                    if ($status -eq "active") {
                        $categories['old_active'] += @{
                            doc_id = $docId
                            path = $doc.path
                            status = $status
                            last_updated = $lastUpdated
                            tier = $doc.tier
                            title = $doc.title
                        }
                    } else {
                        $categories['old_archived'] += @{
                            doc_id = $docId
                            path = $doc.path
                            status = $status
                            last_updated = $lastUpdated
                            tier = $doc.tier
                            title = $doc.title
                        }
                    }
                }
            } catch {
                $categories['no_metadata'] += @{
                    doc_id = $docId
                    path = $doc.path
                    status = $status
                    last_updated = $lastUpdated
                    error = "Date parse error"
                }
            }
        } else {
            $categories['no_metadata'] += @{
                doc_id = $docId
                path = $doc.path
                status = $status
                last_updated = $lastUpdated
            }
        }
    } else {
        $categories['no_metadata'] += @{
            doc_id = $docId
            path = $orphans[$docId].path
            status = "unknown"
            last_updated = $null
        }
    }
}

Write-Host "=== Orphan Documents by Age ==="
Write-Host ""

foreach ($key in @('recent_active', 'recent_archived', 'old_active', 'old_archived', 'no_metadata')) {
    Write-Host "--- $key ($($categories[$key].Count)) ---"
    foreach ($doc in $categories[$key]) {
        Write-Host "  [$($doc.status)] $($doc.path)"
        if ($doc.tier) { Write-Host "      Tier: $($doc.tier)" }
        if ($doc.last_updated) { Write-Host "      Last Updated: $($doc.last_updated)" }
        if ($doc.title) { Write-Host "      Title: $($doc.title)" }
        Write-Host ""
    }
}

Write-Host "=== Summary ==="
Write-Host "Total orphans: $($orphans.Count)"
foreach ($key in $categories.Keys) {
    Write-Host "  $key : $($categories[$key].Count)"
}

Write-Host ""
Write-Host "=== Recommended Actions ==="
Write-Host "- recent_active ($($categories['recent_active'].Count)): Keep as intentional orphans, add cross-ref in GOVERNANCE.md"
Write-Host "- recent_archived ($($categories['recent_archived'].Count)): Move to _pending-review/"
Write-Host "- old_active ($($categories['old_active'].Count)): Review for deprecation, add cross-ref or move"
Write-Host "- old_archived ($($categories['old_archived'].Count)): Move to _pending-review/"
Write-Host "- no_metadata ($($categories['no_metadata'].Count)): Add metadata or deprecate"