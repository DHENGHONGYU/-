<#
.SYNOPSIS
  Build master-index.json - the single source of truth for all doc metadata
  (byte-level encoding-safe)
.DESCRIPTION
  Scans all .md files in docs/, parses frontmatter, outputs JSON to
  docs/00-meta/ai-index/master-index.json
  Uses [System.IO.File]::ReadAllBytes for encoding safety.
#>
$ErrorActionPreference = "Stop"
$ascii = [System.Text.Encoding]::ASCII
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-File-Ascii {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $bomLen = 0
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bomLen = 3
    }
    $asciiStr = $ascii.GetString($bytes, $bomLen, $bytes.Length - $bomLen)
    return @{ Bytes = $bytes; AsciiStr = $asciiStr; BomLen = $bomLen }
}

function Parse-Frontmatter {
    param([string]$AsciiStr)
    if ($AsciiStr -match "^---\r?\n([\s\S]*?)\r?\n---") {
        return $matches[1]
    }
    return $null
}

function Extract-Field {
    param([string]$Fm, [string]$FieldName)
    # Match "field: value" or "field: \"value\"" or "field: [item1, item2]"
    $pattern = "$FieldName`:\s*(.+?)(\r?\n|$)"
    if ($Fm -match $pattern) {
        $val = $matches[1].Trim()
        # Strip quotes
        $val = $val -replace '^"', '' -replace '"$', ''
        # Strip brackets for arrays, split by comma
        if ($val -match '^\[(.+)\]$') {
            $inner = $matches[1]
            return ($inner -split ',' | ForEach-Object { $_.Trim() -replace '^"', '' -replace '"$', '' }) | Where-Object { $_ }
        }
        return $val
    }
    return $null
}

# Collect all docs (active + archived)
$allDocs = Get-ChildItem -Path "docs" -Filter "*.md" -Recurse -File |
    Where-Object { $_.FullName -notmatch "\\deprecated-docs\\old-versions\\" }
Write-Host "Scanned $($allDocs.Count) total docs"

$documents = @{}
$stats = @{
    total_docs = $allDocs.Count
    active_docs = 0
    archived_docs = 0
    doc_id_coverage = 0
    status_coverage = 0
    tier_coverage = 0
}
$orphans = @()
$staleDocs = @()
$noDocId = @()
$noStatus = @()
$noTier = @()

foreach ($f in $allDocs) {
    $info = Read-File-Ascii -Path $f.FullName
    $fm = Parse-Frontmatter -AsciiStr $info.AsciiStr

    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'

    if (-not $fm) {
        # No frontmatter
        $orphans += @{ path = $relPath; reason = "no_frontmatter" }
        continue
    }

    $docId = Extract-Field -Fm $fm -FieldName "doc_id"
    $title = Extract-Field -Fm $fm -FieldName "title"
    $type = Extract-Field -Fm $fm -FieldName "type"
    $domain = Extract-Field -Fm $fm -FieldName "domain"
    $phase = Extract-Field -Fm $fm -FieldName "phase"
    $tier = Extract-Field -Fm $fm -FieldName "tier"
    $status = Extract-Field -Fm $fm -FieldName "status"
    $maintainer = Extract-Field -Fm $fm -FieldName "maintainer"
    $summary = Extract-Field -Fm $fm -FieldName "summary"
    $tags = Extract-Field -Fm $fm -FieldName "tags"
    $version = Extract-Field -Fm $fm -FieldName "version"
    $lastUpdated = Extract-Field -Fm $fm -FieldName "last_updated"

    # Stats tracking
    if ($docId) { $stats.doc_id_coverage++ }
    if ($status) { $stats.status_coverage++ }
    if ($tier) { $stats.tier_coverage++ }

    if ($status -eq "archived") {
        $stats.archived_docs++
    } else {
        $stats.active_docs++
    }

    if (-not $docId) { $noDocId += $relPath }
    if (-not $status) { $noStatus += $relPath }
    if (-not $tier) { $noTier += $relPath }

    # Build doc entry
    $entry = [ordered]@{
        title = $title
        path = $relPath
        type = $type
        domain = $domain
        phase = $phase
        tier = $tier
        status = $status
        maintainer = $maintainer
        summary = $summary
        tags = if ($tags) { @($tags) } else { @() }
        version = $version
        last_updated = $lastUpdated
    }

    if ($docId) {
        $entry["doc_id"] = $docId
        $documents[$docId] = $entry
    } else {
        # Use path as key for docs without doc_id
        $documents[$relPath] = $entry
    }
}

# Convert stats to percentages
$totalStats = @{
    total_docs = $stats.total_docs
    active_docs = $stats.active_docs
    archived_docs = $stats.archived_docs
    doc_id_coverage = "$([Math]::Round($stats.doc_id_coverage / $stats.total_docs * 100, 1))% ($($stats.doc_id_coverage)/$($stats.total_docs))"
    status_coverage = "$([Math]::Round($stats.status_coverage / $stats.total_docs * 100, 1))% ($($stats.status_coverage)/$($stats.total_docs))"
    tier_coverage = "$([Math]::Round($stats.tier_coverage / $stats.total_docs * 100, 1))% ($($stats.tier_coverage)/$($stats.total_docs))"
    no_doc_id_count = $noDocId.Count
    no_status_count = $noStatus.Count
    no_tier_count = $noTier.Count
}

$masterIndex = [ordered]@{
    version = "v1.0"
    generated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
    schema_version = "v1"
    stats = $totalStats
    documents = $documents
    orphans = $orphans
    no_doc_id = $noDocId
    no_status = $noStatus
    no_tier = $noTier
}

# Output JSON
$json = $masterIndex | ConvertTo-Json -Depth 10 -Compress:$false

# Ensure ai-index dir exists
$outDir = "docs/00-meta/ai-index"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$outPath = Join-Path $outDir "master-index.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path $outPath -Parent)).Path + "\master-index.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "========== Master Index Generated =========="
Write-Host "Output: $outPath"
Write-Host "Total docs: $($stats.total_docs)"
Write-Host "Active: $($stats.active_docs) | Archived: $($stats.archived_docs)"
Write-Host "doc_id coverage: $($totalStats.doc_id_coverage)"
Write-Host "status coverage: $($totalStats.status_coverage)"
Write-Host "tier coverage: $($totalStats.tier_coverage)"
Write-Host "Orphans (no frontmatter): $($orphans.Count)"
Write-Host "No doc_id: $($noDocId.Count)"
Write-Host "No status: $($noStatus.Count)"
Write-Host "No tier: $($noTier.Count)"
