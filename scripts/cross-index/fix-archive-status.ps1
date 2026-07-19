<#
.SYNOPSIS
  Fix status field in archive/ docs to "archived" (byte-level encoding-safe)
.DESCRIPTION
  Uses [System.IO.File]::ReadAllBytes / WriteAllBytes for 100% encoding preservation.
  1. Existing status: <word> -> replace with status: archived
  2. Missing status field -> insert status: archived before change_log:
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

$archived = Get-ChildItem -Path "docs\archive" -Filter "*.md" -Recurse -File
Write-Host "Scanned $($archived.Count) docs in docs/archive/"

$replaced = 0; $inserted = 0; $skipped = 0; $alreadyArchived = 0

foreach ($f in $archived) {
    $info = Read-File-Ascii -Path $f.FullName
    $bytes = $info.Bytes; $asciiStr = $info.AsciiStr; $bomLen = $info.BomLen

    if (-not ($asciiStr -match "^---\r?\n([\s\S]*?)\r?\n---")) {
        Write-Host "[SKIP] $($f.Name) - no frontmatter"
        $skipped++; continue
    }
    $fm = $matches[1]

    if ($fm -match "status:\s*archived") {
        $alreadyArchived++; continue
    }

    # Detect line ending
    $lineEnding = "`r`n"
    for ($i = 3; $i -lt [Math]::Min($asciiStr.Length, 8); $i++) {
        if ($bytes[$i + $bomLen] -eq 0x0A) {
            $lineEnding = if ($i -gt 0 -and $bytes[$i + $bomLen - 1] -eq 0x0D) { "`r`n" } else { "`n" }
            break
        }
    }

    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1)

    if ($fm -match "status:\s*(\w+)") {
        # Replace existing status value
        $oldStatus = $matches[1]
        $oldPattern = "status: $oldStatus"
        $newPattern = "status: archived"

        $openingMarkerLen = 3 + $lineEnding.Length
        $closingMarkerPattern = $lineEnding + "---"
        $closingPosInStr = $asciiStr.IndexOf($closingMarkerPattern, $openingMarkerLen)
        if ($closingPosInStr -lt 0) { Write-Host "[SKIP] $relPath - no closing marker"; $skipped++; continue }

        $statusPosInStr = $asciiStr.IndexOf($oldPattern, $openingMarkerLen, $closingPosInStr - $openingMarkerLen)
        if ($statusPosInStr -lt 0) { Write-Host "[SKIP] $relPath - status line not found"; $skipped++; continue }

        $statusPos = $statusPosInStr + $bomLen
        $oldBytes = $ascii.GetBytes($oldPattern)
        $newBytes = $ascii.GetBytes($newPattern)

        $resultBytes = New-Object byte[] ($bytes.Length - $oldBytes.Length + $newBytes.Length)
        [Array]::Copy($bytes, 0, $resultBytes, 0, $statusPos)
        [Array]::Copy($newBytes, 0, $resultBytes, $statusPos, $newBytes.Length)
        [Array]::Copy($bytes, $statusPos + $oldBytes.Length, $resultBytes, $statusPos + $newBytes.Length, $bytes.Length - $statusPos - $oldBytes.Length)

        if ($DryRun) {
            Write-Host "[DRY-REPLACE] $relPath : $oldStatus -> archived"
        } else {
            [System.IO.File]::WriteAllBytes($f.FullName, $resultBytes)
            Write-Host "[REPLACE] $relPath : $oldStatus -> archived"
        }
        $replaced++
    } else {
        # Insert status: archived before change_log: or at frontmatter end
        $openingMarkerLen = 3 + $lineEnding.Length
        $closingMarkerPattern = $lineEnding + "---"
        $closingPosInStr = $asciiStr.IndexOf($closingMarkerPattern, $openingMarkerLen)
        if ($closingPosInStr -lt 0) { Write-Host "[SKIP] $relPath - no closing marker"; $skipped++; continue }

        $changeLogPattern = $lineEnding + "change_log:"
        $changeLogPosInStr = $asciiStr.IndexOf($changeLogPattern, $openingMarkerLen, $closingPosInStr - $openingMarkerLen)

        if ($changeLogPosInStr -ge 0) {
            $insertText = "status: archived" + $lineEnding
            $insertPosInStr = $changeLogPosInStr + $lineEnding.Length
        } else {
            $insertText = $lineEnding + "status: archived"
            $insertPosInStr = $closingPosInStr
        }

        $insertPos = $insertPosInStr + $bomLen
        $insertBytes = $ascii.GetBytes($insertText)

        $resultBytes = New-Object byte[] ($bytes.Length + $insertBytes.Length)
        [Array]::Copy($bytes, 0, $resultBytes, 0, $insertPos)
        [Array]::Copy($insertBytes, 0, $resultBytes, $insertPos, $insertBytes.Length)
        [Array]::Copy($bytes, $insertPos, $resultBytes, $insertPos + $insertBytes.Length, $bytes.Length - $insertPos)

        if ($DryRun) {
            Write-Host "[DRY-INSERT] $relPath"
        } else {
            [System.IO.File]::WriteAllBytes($f.FullName, $resultBytes)
            Write-Host "[INSERT] $relPath"
        }
        $inserted++
    }
}

Write-Host ""
Write-Host "========== Archive Status Fix Complete =========="
Write-Host "Already archived: $alreadyArchived"
Write-Host "Replaced: $replaced"
Write-Host "Inserted: $inserted"
Write-Host "Skipped: $skipped"
Write-Host "Total: $($archived.Count)"
