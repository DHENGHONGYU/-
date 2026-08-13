<#
.SYNOPSIS
  Audit orphan documents and categorize by tier
#>

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Loading relation-index.json..."
$relationIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationIndexContent | ConvertFrom-Json

Write-Host "Loading master-index.json..."
$masterIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterIndexContent | ConvertFrom-Json

$docIdToTier = @{}
$docIdToStatus = @{}
$docIdToPath = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $docId = if ($doc.doc_id) { $doc.doc_id } else { $key }
    $docIdToTier[$docId] = if ($doc.tier) { $doc.tier } else { 'standard' }
    $docIdToStatus[$docId] = if ($doc.status) { $doc.status } else { 'active' }
    $docIdToPath[$docId] = $doc.path
}

$orphans = @()
foreach ($prop in Get-Member -InputObject $relationIndex.links -MemberType NoteProperty) {
    $docId = $prop.Name
    $links = $relationIndex.links.$docId
    $incoming = if ($links.incoming) { @($links.incoming) } else { @() }
    
    if ($incoming.Count -eq 0) {
        $orphans += [PSCustomObject]@{
            doc_id = $docId
            path = $links.path
            tier = $docIdToTier[$docId]
            status = $docIdToStatus[$docId]
            outgoing = if ($links.outgoing) { @($links.outgoing).Count } else { 0 }
        }
    }
}

$byTier = $orphans | Group-Object tier
$byStatus = $orphans | Group-Object status

Write-Host ""
Write-Host "========== Orphan Document Audit =========="
Write-Host "Total orphans: $($orphans.Count)"
Write-Host ""
Write-Host "=== By Tier ==="
foreach ($group in $byTier | Sort-Object Name) {
    $count = $group.Count
    $percent = [math]::Round(($count / $orphans.Count) * 100, 1)
    Write-Host "  $($group.Name): $count ($percent%)"
}

Write-Host ""
Write-Host "=== By Status ==="
foreach ($group in $byStatus | Sort-Object Name) {
    $count = $group.Count
    $percent = [math]::Round(($count / $orphans.Count) * 100, 1)
    Write-Host "  $($group.Name): $count ($percent%)"
}

Write-Host ""
Write-Host "=== Important Tier Orphans (Action Required) ==="
$importantOrphans = $orphans | Where-Object { $_.tier -eq 'important' }
foreach ($o in $importantOrphans) {
    Write-Host "  [$($o.status)] $($o.doc_id) - $($o.path)"
}

Write-Host ""
Write-Host "=== Reference Tier Orphans ==="
$referenceOrphans = $orphans | Where-Object { $_.tier -eq 'reference' }
foreach ($o in $referenceOrphans) {
    Write-Host "  [$($o.status)] $($o.doc_id) - $($o.path)"
}

Write-Host ""
Write-Host "=== Active Orphans (No incoming + Active status) ==="
$activeOrphans = $orphans | Where-Object { $_.status -eq 'active' } | Select-Object -First 20
foreach ($o in $activeOrphans) {
    Write-Host "  [$($o.tier)] $($o.doc_id) - $($o.path)"
}
