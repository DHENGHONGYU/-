<#
.SYNOPSIS
  Batch add related_docs and referenced_by fields to frontmatter (byte-level encoding-safe)
.DESCRIPTION
  Reads relation-index.json, inserts related_docs (outgoing links) and referenced_by (incoming links)
  into each doc's frontmatter. Uses byte-level manipulation for 100% encoding preservation.
  Idempotent: removes existing related_docs/referenced_by lines before inserting new ones.
#>
param([switch]$DryRun)

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

Write-Host "Loading relation-index.json..."
$relationIndexPath = "docs/00-meta/ai-index/relation-index.json"
if (-not (Test-Path $relationIndexPath)) {
    Write-Host "ERROR: relation-index.json not found"
    exit 1
}
$relationIndexContent = [System.IO.File]::ReadAllText((Resolve-Path $relationIndexPath).Path, $utf8NoBom)
$relationIndex = $relationIndexContent | ConvertFrom-Json

$docIdToLinks = @{}
foreach ($prop in Get-Member -InputObject $relationIndex.links -MemberType NoteProperty) {
    $docId = $prop.Name
    $links = $relationIndex.links.$docId
    $docIdToLinks[$docId] = @{
        path = $links.path
        outgoing = if ($links.outgoing) { @($links.outgoing) } else { @() }
        incoming = if ($links.incoming) { @($links.incoming) } else { @() }
    }
}
Write-Host "Loaded $($docIdToLinks.Count) doc_id -> links mappings"

Write-Host "Loading master-index.json for path->doc_id lookup..."
$masterIndexPath = "docs/00-meta/ai-index/master-index.json"
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

$modified = 0
$skipped = 0
$noDocId = 0
$unchanged = 0

foreach ($f in $allDocs) {
    $info = Read-File-Ascii -Path $f.FullName
    $bytes = $info.Bytes; $asciiStr = $info.AsciiStr; $bomLen = $info.BomLen

    if (-not ($asciiStr -match "^---\r?\n([\s\S]*?)\r?\n---")) {
        $skipped++; continue
    }
    $fm = $matches[1]
    $fmFullMatch = $matches[0]

    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
    $relPathLower = $relPath.ToLower()

    $docId = if ($pathToDocId.ContainsKey($relPathLower)) { $pathToDocId[$relPathLower] } else { $relPath }

    if (-not $docIdToLinks.ContainsKey($docId)) {
        $noDocId++; continue
    }

    $outgoing = $docIdToLinks[$docId].outgoing
    $incoming = $docIdToLinks[$docId].incoming

    # Detect line ending from frontmatter
    $lineEnding = "`r`n"
    if ($fm -match "`n" -and $fm -notmatch "`r`n") {
        $lineEnding = "`n"
    }

    # Split frontmatter into lines, remove existing related_docs and referenced_by
    $fmLines = $fm -split "`r?`n"
    $cleanLines = @()
    $foundRelDocs = $false
    $foundRefBy = $false
    foreach ($line in $fmLines) {
        if ($line -match '^related_docs:\s*\[') {
            $foundRelDocs = $true
            continue
        }
        if ($line -match '^referenced_by:\s*\[') {
            $foundRefBy = $true
            continue
        }
        $cleanLines += $line
    }

    # Build new field lines
    $newFieldLines = @()
    if ($outgoing.Count -gt 0) {
        $outgoingStr = $outgoing -join ", "
        $newFieldLines += "related_docs: [$outgoingStr]"
    }
    if ($incoming.Count -gt 0) {
        $incomingStr = $incoming -join ", "
        $newFieldLines += "referenced_by: [$incomingStr]"
    }

    # If no fields to add and none existed, skip
    if ($newFieldLines.Count -eq 0 -and -not $foundRelDocs -and -not $foundRefBy) {
        continue
    }

    # Find insertion point: before change_log if exists, otherwise before closing ---
    $insertIndex = $cleanLines.Count
    $changeLogIndex = -1
    for ($i = 0; $i -lt $cleanLines.Count; $i++) {
        if ($cleanLines[$i] -match '^change_log:') {
            $changeLogIndex = $i
            break
        }
    }
    if ($changeLogIndex -ge 0) {
        $insertIndex = $changeLogIndex
    }

    # Build new frontmatter lines
    $newFmLines = @()
    for ($i = 0; $i -lt $cleanLines.Count; $i++) {
        if ($i -eq $insertIndex) {
            foreach ($fl in $newFieldLines) {
                $newFmLines += $fl
            }
        }
        $newFmLines += $cleanLines[$i]
    }
    # If insert at end (no change_log and closing --- position)
    if ($insertIndex -eq $cleanLines.Count) {
        foreach ($fl in $newFieldLines) {
            $newFmLines += $fl
        }
    }

    $newFm = $newFmLines -join $lineEnding

    # Check if anything changed
    if ($foundRelDocs -or $foundRefBy) {
        $oldFmNormalized = ($fmLines | Where-Object { $_ -notmatch '^related_docs:\s*\[' -and $_ -notmatch '^referenced_by:\s*\[' }) -join $lineEnding
    } else {
        $oldFmNormalized = $fm
    }

    # Build new full content
    $newFmFull = "---" + $lineEnding + $newFm + $lineEnding + "---"
    $newAsciiStr = $asciiStr.Replace($fmFullMatch, $newFmFull)

    # Skip if unchanged
    if ($newAsciiStr -eq $asciiStr) {
        $unchanged++
        continue
    }

    # Convert back to bytes
    $newContentBytes = $ascii.GetBytes($newAsciiStr)
    if ($bomLen -gt 0) {
        $newBytes = New-Object byte[] ($bomLen + $newContentBytes.Length)
        [Array]::Copy($bytes, 0, $newBytes, 0, $bomLen)
        [Array]::Copy($newContentBytes, 0, $newBytes, $bomLen, $newContentBytes.Length)
    } else {
        $newBytes = $newContentBytes
    }

    if ($DryRun) {
        Write-Host "[DRY] $relPath : related_docs=$($outgoing.Count), referenced_by=$($incoming.Count)"
    } else {
        [System.IO.File]::WriteAllBytes($f.FullName, $newBytes)
        Write-Host "[OK] $relPath : related_docs=$($outgoing.Count), referenced_by=$($incoming.Count)"
    }
    $modified++
}

Write-Host ""
Write-Host "========== Relation Fields Updated =========="
Write-Host "Modified: $modified"
Write-Host "Unchanged: $unchanged"
Write-Host "Skipped (no frontmatter/closing marker): $skipped"
Write-Host "No doc_id in relation-index: $noDocId"
