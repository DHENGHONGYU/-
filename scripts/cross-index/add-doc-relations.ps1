<#
.SYNOPSIS
  Batch add related_docs and referenced_by fields to frontmatter (byte-level encoding-safe)
.DESCRIPTION
  Reads relation-index.json, inserts related_docs (outgoing links) and referenced_by (incoming links)
  into each doc's frontmatter. Uses byte-level manipulation for 100% encoding preservation.
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

foreach ($f in $allDocs) {
    $info = Read-File-Ascii -Path $f.FullName
    $bytes = $info.Bytes; $asciiStr = $info.AsciiStr; $bomLen = $info.BomLen

    if (-not ($asciiStr -match "^---\r?\n([\s\S]*?)\r?\n---")) {
        $skipped++; continue
    }
    $fm = $matches[1]

    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
    $relPathLower = $relPath.ToLower()

    $docId = if ($pathToDocId.ContainsKey($relPathLower)) { $pathToDocId[$relPathLower] } else { $relPath }

    if (-not $docIdToLinks.ContainsKey($docId)) {
        $noDocId++; continue
    }

    $outgoing = $docIdToLinks[$docId].outgoing
    $incoming = $docIdToLinks[$docId].incoming

    if ($outgoing.Count -eq 0 -and $incoming.Count -eq 0) {
        continue
    }

    # Detect line ending
    $lineEnding = "`r`n"
    for ($i = 3; $i -lt [Math]::Min($asciiStr.Length, 8); $i++) {
        if ($bytes[$i + $bomLen] -eq 0x0A) {
            $lineEnding = if ($i -gt 0 -and $bytes[$i + $bomLen - 1] -eq 0x0D) { "`r`n" } else { "`n" }
            break
        }
    }

    $openingMarkerLen = 3 + $lineEnding.Length
    $closingMarkerPattern = $lineEnding + "---"
    $closingPosInStr = $asciiStr.IndexOf($closingMarkerPattern, $openingMarkerLen)
    if ($closingPosInStr -lt 0) { $skipped++; continue }

    # Build insert text
    $insertLines = @()
    
    if ($outgoing.Count -gt 0) {
        $outgoingStr = $outgoing -join ", "
        $insertLines += "related_docs: [$outgoingStr]"
    }
    
    if ($incoming.Count -gt 0) {
        $incomingStr = $incoming -join ", "
        $insertLines += "referenced_by: [$incomingStr]"
    }

    $insertText = ($insertLines -join $lineEnding) + $lineEnding

    # Find insert position: before change_log: if exists, otherwise before closing ---
    $changeLogPattern = $lineEnding + "change_log:"
    $changeLogPosInStr = $asciiStr.IndexOf($changeLogPattern, $openingMarkerLen, $closingPosInStr - $openingMarkerLen)

    if ($changeLogPosInStr -ge 0) {
        $insertPosInStr = $changeLogPosInStr + $lineEnding.Length
    } else {
        $insertPosInStr = $closingPosInStr
        $insertText = $lineEnding + ($insertLines -join $lineEnding)
    }

    $insertPos = $insertPosInStr + $bomLen
    $insertBytes = $ascii.GetBytes($insertText)

    $newBytes = New-Object byte[] ($bytes.Length + $insertBytes.Length)
    [Array]::Copy($bytes, 0, $newBytes, 0, $insertPos)
    [Array]::Copy($insertBytes, 0, $newBytes, $insertPos, $insertBytes.Length)
    [Array]::Copy($bytes, $insertPos, $newBytes, $insertPos + $insertBytes.Length, $bytes.Length - $insertPos)

    if ($DryRun) {
        Write-Host "[DRY] $relPath : related_docs=$($outgoing.Count), referenced_by=$($incoming.Count)"
    } else {
        [System.IO.File]::WriteAllBytes($f.FullName, $newBytes)
        Write-Host "[OK] $relPath : related_docs=$($outgoing.Count), referenced_by=$($incoming.Count)"
    }
    $modified++
}

Write-Host ""
Write-Host "========== Relation Fields Added =========="
Write-Host "Modified: $modified"
Write-Host "Skipped (no frontmatter/closing marker): $skipped"
Write-Host "No doc_id in relation-index: $noDocId"
