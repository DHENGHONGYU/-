<#
.SYNOPSIS
  Build master-index.json by scanning all .md files and parsing frontmatter (byte-level encoding-safe)
.DESCRIPTION
  1. Scan all .md files under docs/
  2. Parse YAML frontmatter (regex-based, PS 5.1 compatible)
  3. Extract: doc_id, title, path, type, domain, phase, tier, status, maintainer, summary, tags, version, last_updated
  4. Generate master-index.json with UTF-8 no BOM encoding
  5. Output to docs/00-meta/ai-index/master-index.json
#>
param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$utf8 = [System.Text.Encoding]::UTF8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-File-Utf8 {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $bomLen = 0
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bomLen = 3
    }
    $utf8Str = $utf8.GetString($bytes, $bomLen, $bytes.Length - $bomLen)
    return $utf8Str
}

function Parse-Frontmatter {
    param([string]$Content)

    $result = @{}

    # Match frontmatter block between --- markers
    $fmMatch = [regex]::Match($Content, '(?s)^---\r?\n(.*?)\r?\n---')
    if (-not $fmMatch.Success) {
        return $result
    }

    $fmText = $fmMatch.Groups[1].Value
    $lines = $fmText -split "`r?`n"

    $currentKey = $null
    $inList = $false
    $listItems = @()
    $inChangeLog = $false

    foreach ($line in $lines) {
        if ($line -match '^\s*#') { continue }

        # List item under a key (e.g., "  - value")
        if ($line -match '^\s+-\s+(.+)$') {
            $itemValue = $matches[1].Trim().Trim('"').Trim("'")
            if ($currentKey) {
                if (-not $result.ContainsKey($currentKey)) {
                    $result[$currentKey] = @()
                }
                if ($result[$currentKey] -isnot [System.Collections.IList]) {
                    $result[$currentKey] = @()
                }
                $result[$currentKey] += $itemValue
            }
            continue
        }

        # Key: value
        if ($line -match '^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$') {
            $key = $matches[1]
            $value = $matches[2].Trim()

            # Skip nested keys like change_log (complex structure)
            if ($key -eq 'change_log' -or $key -eq 'changelog') {
                $currentKey = $null
                $inChangeLog = $true
                continue
            }
            $inChangeLog = $false

            # Empty value means list follows
            if ($value -eq '') {
                $currentKey = $key
                $result[$key] = @()
                continue
            }

            # Inline list [a, b, c]
            if ($value -match '^\[(.*)\]$') {
                $listContent = $matches[1]
                $items = $listContent -split ','
                $parsedItems = @()
                foreach ($item in $items) {
                    $trimmed = $item.Trim().Trim('"').Trim("'")
                    if ($trimmed) {
                        $parsedItems += $trimmed
                    }
                }
                $result[$key] = $parsedItems
                $currentKey = $null
                continue
            }

            # Quoted string
            if ($value -match '^"(.*)"$') {
                $result[$key] = $matches[1]
            } elseif ($value -match "^'(.*)'$") {
                $result[$key] = $matches[1]
            } else {
                $result[$key] = $value
            }
            $currentKey = $null
        } elseif ($inChangeLog) {
            # Skip change_log nested content
            continue
        }
    }

    return $result
}

Write-Host "Scanning all .md files under docs/..."

$allDocPaths = @([System.IO.Directory]::EnumerateFiles((Get-Location).Path + "\docs", "*.md", [System.IO.SearchOption]::AllDirectories))
$basePath = (Get-Location).Path + "\"
$allDocPaths = $allDocPaths | ForEach-Object { [System.Text.RegularExpressions.Regex]::Replace($_.Substring($basePath.Length), '\\', '/') }

Write-Host "Found $($allDocPaths.Count) .md files"

$documents = [ordered]@{}
$stats = [ordered]@{
    total_docs = 0
    active_docs = 0
    archived_docs = 0
    no_doc_id_count = 0
    no_tier_count = 0
    no_status_count = 0
    doc_id_coverage = ""
    tier_coverage = ""
    status_coverage = ""
}

$docIdCount = 0
$tierCount = 0
$statusCount = 0
$activeCount = 0
$archivedCount = 0

foreach ($relPath in $allDocPaths) {
    $fullPath = Join-Path (Get-Location).Path $relPath
    $content = Read-File-Utf8 -Path $fullPath
    $fm = Parse-Frontmatter -Content $content

    $docId = if ($fm.ContainsKey('doc_id') -and $fm.doc_id) { $fm.doc_id } else { $null }
    $title = if ($fm.ContainsKey('title') -and $fm.title) { $fm.title } else { [System.IO.Path]::GetFileNameWithoutExtension($relPath) }
    $type = if ($fm.ContainsKey('type') -and $fm.type) { $fm.type } else { $null }
    $domain = if ($fm.ContainsKey('domain') -and $fm.domain) { $fm.domain } else { $null }
    $phase = if ($fm.ContainsKey('phase') -and $fm.phase) { $fm.phase } else { $null }
    $tier = if ($fm.ContainsKey('tier') -and $fm.tier) { $fm.tier } else { $null }
    $status = if ($fm.ContainsKey('status') -and $fm.status) { $fm.status } else { $null }
    $maintainer = if ($fm.ContainsKey('maintainer') -and $fm.maintainer) { $fm.maintainer } else { $null }
    $summary = if ($fm.ContainsKey('summary') -and $fm.summary) { $fm.summary } else { $null }
    $version = if ($fm.ContainsKey('version') -and $fm.version) { $fm.version } else { $null }
    $lastUpdated = if ($fm.ContainsKey('last_updated') -and $fm.last_updated) { $fm.last_updated } else { $null }

    $tags = @()
    if ($fm.ContainsKey('tags')) {
        if ($fm.tags -is [System.Collections.IList]) {
            $tags = @($fm.tags)
        } elseif ($fm.tags) {
            $tags = @($fm.tags)
        }
    }

    # Determine key for documents dict: use doc_id if available, else path
    $key = if ($docId) { $docId } else { $relPath }

    $docObj = [ordered]@{
        title = $title
        path = $relPath
        type = $type
        domain = $domain
        phase = $phase
        tier = $tier
        status = $status
        maintainer = $maintainer
        summary = $summary
        tags = $tags
        version = $version
        last_updated = $lastUpdated
        doc_id = $docId
    }

    $documents[$key] = $docObj

    if ($docId) { $docIdCount++ }
    if ($tier) { $tierCount++ }
    if ($status) {
        $statusCount++
        if ($status -eq 'active') { $activeCount++ }
        elseif ($status -eq 'archived' -or $status -eq 'deprecated') { $archivedCount++ }
    }
}

$total = $allDocPaths.Count
$stats.total_docs = $total
$stats.active_docs = $activeCount
$stats.archived_docs = $archivedCount
$stats.no_doc_id_count = $total - $docIdCount
$stats.no_tier_count = $total - $tierCount
$stats.no_status_count = $total - $statusCount
$stats.doc_id_coverage = if ($total -gt 0) { "{0:N1}% ($docIdCount/$total)" -f (($docIdCount / $total) * 100) } else { "0%" }
$stats.tier_coverage = if ($total -gt 0) { "{0:N1}% ($tierCount/$total)" -f (($tierCount / $total) * 100) } else { "0%" }
$stats.status_coverage = if ($total -gt 0) { "{0:N1}% ($statusCount/$total)" -f (($statusCount / $total) * 100) } else { "0%" }

$masterIndex = [ordered]@{
    version = "v1.0"
    generated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
    schema_version = "v1"
    stats = $stats
    documents = $documents
}

Write-Host ""
Write-Host "========== Master Index Statistics =========="
Write-Host "Total docs: $total"
Write-Host "Docs with doc_id: $docIdCount ($($stats.doc_id_coverage))"
Write-Host "Docs with tier: $tierCount ($($stats.tier_coverage))"
Write-Host "Docs with status: $statusCount ($($stats.status_coverage))"
Write-Host "Active docs: $activeCount"
Write-Host "Archived docs: $archivedCount"

if ($DryRun) {
    Write-Host ""
    Write-Host "[DryRun] Skipping file write."
    exit 0
}

$outPath = "docs/00-meta/ai-index/master-index.json"
$outDir = Split-Path $outPath -Parent
if (-not (Test-Path $outDir)) {
    New-Item -Path $outDir -ItemType Directory -Force | Out-Null
}

$json = $masterIndex | ConvertTo-Json -Depth 10 -Compress:$false
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $outDir).Path + "\master-index.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "Master index written to: $outPath"
Write-Host "File size: $((Get-Item $outPath).Length) bytes"
