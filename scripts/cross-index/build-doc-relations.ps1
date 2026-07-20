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
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$utf8 = [System.Text.Encoding]::UTF8

function Read-File-Utf8 {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $bomLen = 0
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bomLen = 3
    }
    $utf8Str = $utf8.GetString($bytes, $bomLen, $bytes.Length - $bomLen)
    return @{ Bytes = $bytes; Utf8Str = $utf8Str; BomLen = $bomLen }
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

$pathToDocId = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$pathToStatus = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)

foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $path = $doc.path
    if (-not $pathToDocId.ContainsKey($path)) {
        $pathToDocId[$path] = if ($doc.doc_id) { $doc.doc_id } else { $key }
    }
    if (-not $pathToStatus.ContainsKey($path)) {
        $pathToStatus[$path] = if ($doc.status) { $doc.status } else { "unknown" }
    }
}
Write-Host "Loaded $($pathToDocId.Count) path->doc_id mappings from master-index"

$allDocPaths = @([System.IO.Directory]::EnumerateFiles((Get-Location).Path + "\docs", "*.md", [System.IO.SearchOption]::AllDirectories))
$basePath = (Get-Location).Path + "\"
$allDocPaths = $allDocPaths | ForEach-Object { [System.Text.RegularExpressions.Regex]::Replace($_.Substring($basePath.Length), '\\', '/') }
Write-Host "Scanned $($allDocPaths.Count) total .md files from filesystem"

$linkGraph = @{}
$totalLinks = 0
$resolvedLinks = 0
$unresolvedLinks = 0
$activeUnresolved = @{}
$archivedUnresolved = @{}

foreach ($sourceRelPath in $allDocPaths) {
    $fullPath = Join-Path (Get-Location).Path $sourceRelPath
    $info = Read-File-Utf8 -Path $fullPath
    $content = $info.Utf8Str

    $sourceDocId = if ($pathToDocId.ContainsKey($sourceRelPath)) { $pathToDocId[$sourceRelPath] } else { $sourceRelPath }
    $sourceStatus = if ($pathToStatus.ContainsKey($sourceRelPath)) { $pathToStatus[$sourceRelPath] } else { "unknown" }

    if (-not $linkGraph.ContainsKey($sourceDocId)) {
        $linkGraph[$sourceDocId] = @{
            path = $sourceRelPath
            outgoing = @()
            incoming = @()
        }
    }

    $links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)\s]+)\)')
    foreach ($link in $links) {
        $text = $link.Groups[1].Value
        $rawPath = $link.Groups[2].Value

        # Skip external URLs, anchors, and non-MD files
        if ($rawPath -match '^https?://') { continue }
        if ($rawPath -match '^#') { continue }
        if (-not ($rawPath -match '\.md')) { continue }

        $totalLinks++

        $normalizedRaw = [System.Text.RegularExpressions.Regex]::Replace($rawPath, '\\', '/')

        if ($normalizedRaw -match '%[0-9A-Fa-f]{2}') {
            $normalizedRaw = [System.Uri]::UnescapeDataString($normalizedRaw)
        }

        $fileMatch = [System.Text.RegularExpressions.Regex]::Match($normalizedRaw, '^file:///[^/]+/docs/(.*)')
        if ($fileMatch.Success) {
            $normalizedRaw = 'docs/' + $fileMatch.Groups[1].Value
        }

        $resolvedPath = $normalizedRaw
        $isExternal = $false

        $trimmedRaw = $normalizedRaw.Trim()
        if ($trimmedRaw.StartsWith('docs/')) {
            $resolvedPath = $trimmedRaw
        } elseif (-not $trimmedRaw.StartsWith('/')) {
            $sourceDirParts = [System.Linq.Enumerable]::ToArray([System.Linq.Enumerable]::Where([string[]]$sourceRelPath.Split('/'), [System.Func[string,bool]]{param($p) return $p -ne ''}))
            if ($sourceDirParts.Length -gt 1) {
                $sourceDirParts = [System.Linq.Enumerable]::Take($sourceDirParts, $sourceDirParts.Length - 1)
            }
            $sourceDir = [string]::Join('/', $sourceDirParts)

            $linkParts = [System.Linq.Enumerable]::ToArray([System.Linq.Enumerable]::Where([string[]]$normalizedRaw.Split('/'), [System.Func[string,bool]]{param($p) return $p -ne ''}))

            $stack = New-Object "System.Collections.Generic.List``1[System.String]"
            if ($sourceDir) {
                foreach ($part in [System.Linq.Enumerable]::Where([string[]]$sourceDir.Split('/'), [System.Func[string,bool]]{param($p) return $p -ne ''})) {
                    $stack.Add($part)
                }
            }

            foreach ($part in $linkParts) {
                if ($part -eq '..') {
                    if ($stack.Count -gt 1) {
                        $stack.RemoveAt($stack.Count - 1)
                    } elseif ($stack.Count -eq 1 -and $stack[0] -eq 'docs') {
                        $isExternal = $true
                        break
                    } elseif ($stack.Count -eq 0) {
                        $isExternal = $true
                        break
                    }
                } elseif ($part -eq '.') {
                    continue
                } else {
                    $stack.Add($part)
                }
            }

            if (-not $isExternal) {
                $resolvedPath = [string]::Join('/', $stack)
            }
        } else {
            $resolvedPath = $normalizedRaw.TrimStart('/')
        }

        if ($isExternal) {
            continue
        }

        $resolvedPath = [System.Text.RegularExpressions.Regex]::Replace($resolvedPath, '\?.*$', '')
        $resolvedPath = [System.Text.RegularExpressions.Regex]::Replace($resolvedPath, '#.*$', '')

        $targetDocId = $null
        $foundMatch = $false

        if ($pathToDocId.ContainsKey($resolvedPath)) {
            $targetDocId = $pathToDocId[$resolvedPath]
            $foundMatch = $true
        } else {
            $fullPathCheck = Join-Path (Get-Location).Path $resolvedPath
            if ([System.IO.File]::Exists($fullPathCheck)) {
                foreach ($key in $pathToDocId.Keys) {
                    if ($key.Equals($resolvedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                        $targetDocId = $pathToDocId[$key]
                        $foundMatch = $true
                        break
                    }
                }
            }
        }

        if (-not $foundMatch) {
            try {
                $filename = [System.IO.Path]::GetFileName($resolvedPath)
                $matchedPaths = @()
                foreach ($key in $pathToDocId.Keys) {
                    if ($key.EndsWith("/$filename", [System.StringComparison]::OrdinalIgnoreCase)) {
                        $matchedPaths += $key
                    }
                }
                if ($matchedPaths.Count -eq 1) {
                    $targetDocId = $pathToDocId[$matchedPaths[0]]
                    $foundMatch = $true
                } elseif ($matchedPaths.Count -gt 1) {
                    foreach ($key in $matchedPaths) {
                        if ($key.Equals($resolvedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                            $targetDocId = $pathToDocId[$key]
                            $foundMatch = $true
                            break
                        }
                    }
                }
            } catch {
            }
        }

        if ($foundMatch -and $targetDocId -and $targetDocId -ne $sourceDocId) {
            $linkGraph[$sourceDocId].outgoing += $targetDocId
            $resolvedLinks++
        } else {
            $unresolvedLinks++
            $targetUnresolved = if ($sourceStatus -eq "active") { $activeUnresolved } else { $archivedUnresolved }
            if (-not $targetUnresolved.ContainsKey($sourceDocId)) {
                $targetUnresolved[$sourceDocId] = @()
            }
            $targetUnresolved[$sourceDocId] += @{ link = $rawPath; resolved = $resolvedPath; source_status = $sourceStatus }
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

$activeUnresolvedCount = ($activeUnresolved.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
$archivedUnresolvedCount = ($archivedUnresolved.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum

Write-Host ""
Write-Host "========== Link Graph Statistics =========="
Write-Host "Total docs scanned: $($allDocPaths.Count)"
Write-Host "Total links found: $totalLinks"
Write-Host "Resolved links: $resolvedLinks"
Write-Host "Unresolved links: $unresolvedLinks (active: $activeUnresolvedCount, archived: $archivedUnresolvedCount)"
Write-Host "Docs with links: $($linkGraph.Count)"
Write-Host "Active unresolved sources: $($activeUnresolved.Count)"
Write-Host "Archived unresolved sources: $($archivedUnresolved.Count)"

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
        active_unresolved_links = $activeUnresolvedCount
        archived_unresolved_links = $archivedUnresolvedCount
        docs_with_links = $linkGraph.Count
        orphan_docs = $orphans.Count
        active_unresolved_sources = $activeUnresolved.Count
        archived_unresolved_sources = $archivedUnresolved.Count
    }
    links = $linkGraph
    orphans = $orphans
    active_unresolved = $activeUnresolved
    archived_unresolved = $archivedUnresolved
}

$json = $relationIndex | ConvertTo-Json -Depth 10 -Compress:$false
$outPath = "docs/00-meta/ai-index/relation-index.json"
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path $outPath -Parent)).Path + "\relation-index.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "Relation index written to: $outPath"
Write-Host "File size: $((Get-Item $outPath).Length) bytes"
