<#
.SYNOPSIS
  Build doc-to-doc relations by scanning Markdown links (byte-level encoding-safe)
.DESCRIPTION
  1. Scan all docs for [text](path) links
  2. Resolve relative paths to target doc paths (UNIFIED forward-slash handling)
  3. Look up doc_id from master-index.json
  4. Build link graph: source_doc_id -> [target_doc_ids]
  5. Generate relation-index.json
#>
param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$ascii = [System.Text.Encoding]::ASCII

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

Write-Host "Loading master-index.json..."
$masterIndexPath = "docs/00-meta/ai-index/master-index.json"
if (-not (Test-Path $masterIndexPath)) {
    Write-Host "ERROR: master-index.json not found at $masterIndexPath"
    Write-Host "Run build-master-index.ps1 first"
    exit 1
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$masterIndexContent = [System.IO.File]::ReadAllText((Resolve-Path $masterIndexPath).Path, $utf8NoBom)
$masterIndex = $masterIndexContent | ConvertFrom-Json

$pathToDocId = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $path = $doc.path.ToLower()
    $pathToDocId[$path] = if ($doc.doc_id) { $doc.doc_id } else { $key }
}
Write-Host "Loaded $($pathToDocId.Count) path->doc_id mappings"

$allDocs = Get-ChildItem -Path "docs" -Filter "*.md" -Recurse -File |
    Where-Object { $_.FullName -notmatch "\\deprecated-docs\\old-versions\\" }

$linkGraph = @{}
$totalLinks = 0
$resolvedLinks = 0
$unresolvedLinks = 0
$orphanLinks = @{}

foreach ($f in $allDocs) {
    $info = Read-File-Ascii -Path $f.FullName
    $content = $info.AsciiStr

    $sourceRelPath = $f.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
    $sourceLower = $sourceRelPath.ToLower()

    $sourceDocId = if ($pathToDocId.ContainsKey($sourceLower)) { $pathToDocId[$sourceLower] } else { $sourceRelPath }

    if (-not $linkGraph.ContainsKey($sourceDocId)) {
        $linkGraph[$sourceDocId] = @{
            path = $sourceRelPath
            outgoing = @()
            incoming = @()
        }
    }

    $links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)]+)\)')
    foreach ($link in $links) {
        $text = $link.Groups[1].Value
        $rawPath = $link.Groups[2].Value

        # Skip external URLs, anchors, and non-MD files
        if ($rawPath -match '^https?://') { continue }
        if ($rawPath -match '^#') { continue }
        if (-not ($rawPath -match '\.md')) { continue }

        $totalLinks++

        $normalizedRaw = $rawPath -replace '\\', '/'

        $resolvedPath = $normalizedRaw

        if (-not ($normalizedRaw -match '^/')) {
            $sourceDirParts = $sourceRelPath -split '/' | Where-Object { $_ }
            $sourceDirParts = $sourceDirParts[0..($sourceDirParts.Count - 2)]
            $sourceDir = $sourceDirParts -join '/'

            $linkParts = $normalizedRaw -split '/' | Where-Object { $_ }

            $stack = @()
            if ($sourceDir) {
                $stack = $sourceDir -split '/' | Where-Object { $_ }
            }

            foreach ($part in $linkParts) {
                if ($part -eq '..') {
                    if ($stack.Count -gt 0) {
                        $stack = $stack[0..($stack.Count - 2)]
                    }
                } elseif ($part -eq '.') {
                    continue
                } else {
                    $stack += $part
                }
            }

            $resolvedPath = $stack -join '/'
        } else {
            $resolvedPath = $normalizedRaw.TrimStart('/')
        }

        $resolvedLower = $resolvedPath.ToLower()

        if ($pathToDocId.ContainsKey($resolvedLower)) {
            $targetDocId = $pathToDocId[$resolvedLower]
            if ($targetDocId -ne $sourceDocId) {
                $linkGraph[$sourceDocId].outgoing += $targetDocId
                $resolvedLinks++
            }
        } else {
            $unresolvedLinks++
            if (-not $orphanLinks.ContainsKey($sourceDocId)) {
                $orphanLinks[$sourceDocId] = @()
            }
            $orphanLinks[$sourceDocId] += @{ link = $rawPath; resolved = $resolvedPath }
        }
    }
}

foreach ($docId in $linkGraph.Keys) {
    $linkGraph[$docId].outgoing = ($linkGraph[$docId].outgoing | Select-Object -Unique)
}

foreach ($sourceDocId in $linkGraph.Keys) {
    foreach ($targetDocId in $linkGraph[$sourceDocId].outgoing) {
        if (-not $linkGraph.ContainsKey($targetDocId)) {
            $linkGraph[$targetDocId] = @{ path = "UNKNOWN"; outgoing = @(); incoming = @() }
        }
        $linkGraph[$targetDocId].incoming += $sourceDocId
    }
}

foreach ($docId in $linkGraph.Keys) {
    $linkGraph[$docId].incoming = ($linkGraph[$docId].incoming | Select-Object -Unique)
}

Write-Host ""
Write-Host "========== Link Graph Statistics =========="
Write-Host "Total docs scanned: $($allDocs.Count)"
Write-Host "Total links found: $totalLinks"
Write-Host "Resolved links: $resolvedLinks"
Write-Host "Unresolved links: $unresolvedLinks"
Write-Host "Docs with links: $($linkGraph.Count)"
Write-Host "Orphan link sources: $($orphanLinks.Count)"

$orphans = @()
foreach ($docId in $linkGraph.Keys) {
    if ($linkGraph[$docId].incoming.Count -eq 0) {
        $orphans += @{
            doc_id = $docId
            path = $linkGraph[$docId].path
            outgoing_count = $linkGraph[$docId].outgoing.Count
        }
    }
}
Write-Host "Orphans (no incoming links): $($orphans.Count)"

$relationIndex = [ordered]@{
    version = "v1.0"
    generated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
    stats = [ordered]@{
        total_docs = $allDocs.Count
        total_links = $totalLinks
        resolved_links = $resolvedLinks
        unresolved_links = $unresolvedLinks
        docs_with_links = $linkGraph.Count
        orphan_docs = $orphans.Count
        orphan_link_sources = $orphanLinks.Count
    }
    links = $linkGraph
    orphans = $orphans
    unresolved_links = $orphanLinks
}

$json = $relationIndex | ConvertTo-Json -Depth 10 -Compress:$false
$outPath = "docs/00-meta/ai-index/relation-index.json"
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path $outPath -Parent)).Path + "\relation-index.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "Relation index written to: $outPath"
Write-Host "File size: $((Get-Item $outPath).Length) bytes"
