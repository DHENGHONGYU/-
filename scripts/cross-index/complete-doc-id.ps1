<#
.SYNOPSIS
  Batch complete missing doc_id fields in frontmatter (BYTE-LEVEL safe version)
.DESCRIPTION
  Uses byte-level manipulation to preserve original file encoding 100%.
  Only ASCII bytes (doc_id line) are inserted; original bytes are untouched.
  No encoding detection or conversion happens - safe for UTF-8, GBK, BOM, etc.
  Groups by domain, sorts by tier priority (important > reference > standard > quick-note)
  Format: V9-DOC-{DOMAIN}-{NNN}
  Processes <= 50 docs per batch, validates after each batch
  Supports -DryRun preview, -StartIndex for resumable processing
.PARAMETER BatchSize
  Docs per batch, default 50
.PARAMETER StartIndex
  Skip first N pending docs, for resumable processing, default 0
.PARAMETER DryRun
  Preview mode, no actual file modifications
.EXAMPLE
  powershell -File scripts/cross-index/complete-doc-id.ps1 -DryRun
  powershell -File scripts/cross-index/complete-doc-id.ps1 -BatchSize 50 -StartIndex 0
#>
param(
    [int]$BatchSize = 50,
    [int]$StartIndex = 0,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ASCII encoding for byte-level matching (non-ASCII bytes become ? but length is preserved)
$ascii = [System.Text.Encoding]::ASCII

# Helper: read file bytes and return (bytes, asciiStr, bomLen)
# asciiStr starts AFTER BOM, so string positions are relative to first byte after BOM.
# To get actual byte position in $bytes, add $bomLen to string position.
function Read-File-Ascii {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $bomLen = 0
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bomLen = 3
    }
    $asciiStr = $ascii.GetString($bytes, $bomLen, $bytes.Length - $bomLen)
    return @{
        Bytes = $bytes
        AsciiStr = $asciiStr
        BomLen = $bomLen
    }
}

# 1. Collect all active docs (exclude archive/ and deprecated-docs/)
$docs = Get-ChildItem -Path "docs" -Filter "*.md" -Recurse -File |
    Where-Object { $_.FullName -notmatch "\\archive\\|\\deprecated-docs\\" }

Write-Host "Scanned $($docs.Count) active docs"

# 2. Read existing doc_id-registry.md, build path -> doc_id map
$existing = @{}
if (Test-Path "docs/00-meta/doc-id-registry.md") {
    $regContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/doc-id-registry.md").Path, (New-Object System.Text.UTF8Encoding($false)))
    foreach ($line in $regContent -split "`r?`n") {
        if ($line -match "^\|\s*(V9-DOC-\w+-\d+)\s*\|\s*\w+\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|") {
            $existing[$matches[3].Trim()] = $matches[1]
        }
    }
}
Write-Host "Existing doc_id count (from registry): $($existing.Count)"

# 3. Scan all existing doc_ids, find max number per domain
$domainAbbr = @{
    project = "PROJ"
    architecture = "ARCH"
    frontend = "FRONT"
    backend = "BACK"
    data = "DATA"
    ai = "AI"
    qa = "QA"
    product = "PROD"
    development = "DEV"
}
$domainMax = @{}
foreach ($docId in $existing.Values) {
    if ($docId -match "V9-DOC-(\w+)-(\d+)") {
        $domain = $matches[1]
        $num = [int]$matches[2]
        if (-not $domainMax.ContainsKey($domain) -or $num -gt $domainMax[$domain]) {
            $domainMax[$domain] = $num
        }
    }
}

# Also scan all docs to find doc_ids not in registry (defensive scan using ASCII bytes)
foreach ($f in $docs) {
    $info = Read-File-Ascii -Path $f.FullName
    if ($info.AsciiStr -match "^---\r?\n([\s\S]*?)\r?\n---") {
        $fm = $matches[1]
        if ($fm -match "doc_id:\s*(V9-DOC-\w+-\d+)") {
            $docId = $matches[1]
            if ($docId -match "V9-DOC-(\w+)-(\d+)") {
                $domain = $matches[1]
                $num = [int]$matches[2]
                if (-not $domainMax.ContainsKey($domain) -or $num -gt $domainMax[$domain]) {
                    $domainMax[$domain] = $num
                }
            }
        }
    }
}
Write-Host "Adjusted domain max numbers (after scanning all docs):"
foreach ($k in ($domainMax.Keys | Sort-Object)) {
    Write-Host "  $k : $($domainMax[$k])"
}

# 4. Collect docs missing doc_id (using ASCII-safe byte scanning)
$toProcess = @()
foreach ($f in $docs) {
    $info = Read-File-Ascii -Path $f.FullName
    if ($info.AsciiStr -match "^---\r?\n([\s\S]*?)\r?\n---") {
        $fm = $matches[1]
        if ($fm -notmatch "doc_id:\s*V9-DOC-") {
            $toProcess += [PSCustomObject]@{
                File = $f
                Frontmatter = $fm
                Bytes = $info.Bytes
                AsciiStr = $info.AsciiStr
                BomLen = $info.BomLen
            }
        }
    }
}

Write-Host ""
Write-Host "Pending doc_id completion: $($toProcess.Count) docs"

if ($toProcess.Count -eq 0) {
    Write-Host "[OK] All active docs already have doc_id, nothing to do"
    exit 0
}

# 5. Sort by tier priority (important first)
$tierOrder = @{ important = 1; reference = 2; standard = 3; "quick-note" = 4; core = 0 }
$toProcess = $toProcess | Sort-Object {
    $tier = "standard"
    if ($_.Frontmatter -match "tier:\s*(\w+)") { $tier = $matches[1] }
    if ($tierOrder.ContainsKey($tier)) { $tierOrder[$tier] } else { 5 }
}

# 6. Batch slice
$batch = $toProcess | Select-Object -Skip $StartIndex -First $BatchSize
Write-Host "This batch: $($batch.Count) / $($toProcess.Count) (StartIndex=$StartIndex, BatchSize=$BatchSize)"
Write-Host ""

# 7. Process each doc using BYTE-LEVEL manipulation (encoding-safe)
$processed = 0
$skipped = 0
$newDomainMax = @{}
foreach ($k in $domainMax.Keys) { $newDomainMax[$k] = $domainMax[$k] }

foreach ($item in $batch) {
    $f = $item.File
    $fm = $item.Frontmatter
    $bytes = $item.Bytes
    $asciiStr = $item.AsciiStr
    $bomLen = $item.BomLen

    # Extract domain
    $domain = "project"
    if ($fm -match "domain:\s*(\w+)") { $domain = $matches[1] }
    if ($domainAbbr.ContainsKey($domain)) {
        $domainUpper = $domainAbbr[$domain]
    } else {
        $domainUpper = $domain.ToUpper()
    }

    # Compute next number
    if (-not $newDomainMax.ContainsKey($domainUpper)) { $newDomainMax[$domainUpper] = 0 }
    $newDomainMax[$domainUpper]++
    $next = $newDomainMax[$domainUpper]
    $docId = "V9-DOC-$domainUpper-$($next.ToString('000'))"

    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1)

    if ($DryRun) {
        Write-Host "[DRY] $relPath -> $docId (domain=$domain)"
    } else {
        # Detect line ending style (CRLF or LF) by finding first LF byte after `---`
        $lineEnding = "`r`n"  # default CRLF
        $lfSearchStart = 3  # skip `---` (BOM already stripped from asciiStr)
        for ($i = $lfSearchStart; $i -lt [Math]::Min($asciiStr.Length, $lfSearchStart + 5); $i++) {
            if ($bytes[$i + $bomLen] -eq 0x0A) {
                if ($i -gt 0 -and $bytes[$i + $bomLen - 1] -eq 0x0D) {
                    $lineEnding = "`r`n"
                } else {
                    $lineEnding = "`n"
                }
                break
            }
        }

        # Find position to insert doc_id
        # Standard position: BEFORE `change_log:` line (between code_version and change_log)
        # Fallback: at end of frontmatter (before closing `---`)
        $openingMarkerLen = 3 + $lineEnding.Length  # `---` + line ending
        $closingMarkerPattern = $lineEnding + "---"
        $closingPosInStr = $asciiStr.IndexOf($closingMarkerPattern, $openingMarkerLen)

        if ($closingPosInStr -lt 0) {
            Write-Host "[SKIP] $relPath - cannot find closing frontmatter marker"
            $skipped++
            continue
        }

        # Look for `change_log:` line within frontmatter
        # Pattern: line ending + "change_log:"
        $changeLogPattern = $lineEnding + "change_log:"
        $changeLogPosInStr = $asciiStr.IndexOf($changeLogPattern, $openingMarkerLen, $closingPosInStr - $openingMarkerLen)

        if ($changeLogPosInStr -ge 0) {
            # Insert BEFORE change_log: line (at the position of line ending before change_log)
            $insertPosInStr = $changeLogPosInStr + $lineEnding.Length  # after the line ending, so doc_id is on its own line before change_log
            # Actually, we want: ...last_updated\r\n doc_id: ...\r\n change_log:
            # So insert at $changeLogPosInStr + lineEnding.Length, with text "doc_id: ...\r\n"
            # Wait, simpler: insert at $changeLogPosInStr, with text "\r\ndoc_id: ..." - but that adds line ending before doc_id
            # Even simpler: insert at $changeLogPosInStr + lineEnding.Length with text "doc_id: ...\r\n"
            $insertText = "doc_id: $docId" + $lineEnding
            $insertPosInStr = $changeLogPosInStr + $lineEnding.Length
        } else {
            # No change_log: insert at end of frontmatter (before closing ---)
            # Insert at $closingPosInStr with text "\r\ndoc_id: ..."
            $insertText = $lineEnding + "doc_id: $docId"
            $insertPosInStr = $closingPosInStr
        }

        # Convert to byte position in original $bytes (add BOM length)
        $insertPos = $insertPosInStr + $bomLen

        # Build insert bytes (pure ASCII)
        $insertBytes = $ascii.GetBytes($insertText)

        # Construct new byte array: original[:insertPos] + insertBytes + original[insertPos:]
        $newBytes = New-Object byte[] ($bytes.Length + $insertBytes.Length)
        [Array]::Copy($bytes, 0, $newBytes, 0, $insertPos)
        [Array]::Copy($insertBytes, 0, $newBytes, $insertPos, $insertBytes.Length)
        [Array]::Copy($bytes, $insertPos, $newBytes, $insertPos + $insertBytes.Length, $bytes.Length - $insertPos)

        [System.IO.File]::WriteAllBytes($f.FullName, $newBytes)
        Write-Host "[OK] $relPath -> $docId"
    }
    $processed++
}

Write-Host ""
Write-Host "========== Batch Complete =========="
Write-Host "Processed: $processed | Skipped: $skipped"
$remaining = $toProcess.Count - $StartIndex - $processed
Write-Host "Remaining: $remaining docs"
if ($remaining -gt 0) {
    Write-Host ""
    Write-Host "Next batch command (after committing current batch):"
    Write-Host "  powershell -File scripts/cross-index/complete-doc-id.ps1 -BatchSize $BatchSize -StartIndex 0"
    Write-Host "  (StartIndex=0 because processed docs are auto-filtered from pending list)"
} else {
    Write-Host ""
    Write-Host "[OK] All docs processed"
}
