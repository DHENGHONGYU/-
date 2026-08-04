<#
.SYNOPSIS
  Securely cleanup ALL entries in .git/stash with multi-phase verification.

.DESCRIPTION
  Four-phase pipeline (state check -> list -> interactive delete -> verify)
  to make irreversible stash drop actions fully auditable and guarded.

.PARAMETER y
  Skip interactive confirmation (auto YES). USE WITH CAUTION.

.PARAMETER BackupDir
  Optional: path to save a backup JSON of stash metadata before cleanup.

.EXAMPLE
  .\scripts\git\cleanup-stash.ps1
  .\scripts\git\cleanup-stash.ps1 -y
  .\scripts\git\cleanup-stash.ps1 -BackupDir "$env:TEMP\git-stash-backup"
#>

[CmdletBinding()]
param(
  [switch]$y,
  [string]$BackupDir = ''
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent

# ── Tiny logging helpers (English only, avoids PS encoding issues) ──────
function Write-Banner([string]$m) {
  $bar = '=' * 72
  Write-Host ""
  Write-Host $bar -ForegroundColor Cyan
  Write-Host "  $m" -ForegroundColor Cyan
  Write-Host $bar -ForegroundColor Cyan
}
function Write-Info([string]$m)    { Write-Host "[INFO ] $m" -ForegroundColor Gray }
function Write-Ok([string]$m)      { Write-Host "[ OK  ] $m" -ForegroundColor Green }
function Write-Warn([string]$m)    { Write-Host "[WARN ] $m" -ForegroundColor Yellow }
function Write-Err([string]$m)     { Write-Host "[FAIL ] $m" -ForegroundColor Red }

# ── 1/4: Precondition & state check ─────────────────────────────────────
Write-Banner "PHASE 1/4: Repo State Pre-check"
Set-Location $RepoRoot
Write-Info "Repo root: $RepoRoot"

# 1a: git availability
try {
  $gitVer = & git --version
  if ($LASTEXITCODE -ne 0) { throw 'git binary not callable' }
  Write-Ok "Git installed: $gitVer"
} catch {
  Write-Err "Git is not available. Abort."
  exit 2
}

# 1b: inside a work tree
$inside = & git rev-parse --is-inside-work-tree 2>$null
if ($inside -ne 'true') {
  Write-Err "Not inside a git work-tree. Abort."
  exit 3
}
Write-Ok "Inside valid git work-tree"

# 1c: status porcelain (warn dirty, NOT block)
$dirty = & git status --porcelain
if ($dirty) {
  Write-Warn "Working tree has $($dirty.Count) uncommitted change(s) - safe but double-check!"
} else {
  Write-Ok "Working tree is clean"
}

# 1d: stash count
$stashLines = @(& git stash list)
$stashCount = $stashLines.Count
Write-Info "Detected stash entries: $stashCount"

if ($stashCount -eq 0) {
  Write-Ok "No stash entries to clean. Exit early."
  exit 0
}

# ── 2/4: Enumerate every stash record w/ parsed index ──────────────────
Write-Banner "PHASE 2/4: Enumerate Stash Records"
$stashRecords = @()
foreach ($line in $stashLines) {
  # e.g. "stash@{0}: On main: message here"
  if ($line -match '^(stash@\{(\d+)\}):\s+(.+)$') {
    $stashRecords += [PSCustomObject]@{
      Ref     = $Matches[1]         # stash@{0}
      Index   = [int]$Matches[2]    # 0
      Message = $Matches[3].Trim()
    }
  } else {
    Write-Warn "Unparsable stash line: $line"
  }
}
$stashRecords | Format-Table -AutoSize Index, Ref, Message | Out-Host

# (Optional) backup stash metadata to JSON
if ($BackupDir -and (Test-Path -LiteralPath $BackupDir -IsValid)) {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupFile = Join-Path $BackupDir "stash-backup-$ts.json"
  $stashRecords | ConvertTo-Json -Depth 4 | Set-Content -Path $backupFile -Encoding utf8
  Write-Ok "Stash metadata backed up to: $backupFile"
}

# ── 3/4: Execute cleanup (reverse order + interactive guard) ───────────
Write-Banner "PHASE 3/4: Execute Cleanup"

if (-not $y) {
  Write-Warn "About to PERMANENTLY DELETE $stashCount stash record(s) - NOT recoverable!"
  $confirm = Read-Host "Type YES to continue (anything else cancels)"
  if ($confirm -ne 'YES') {
    Write-Warn "Cancelled by user. No stash deleted."
    exit 0
  }
}

$cleaned = 0
$failed  = 0

# Drop in reverse index order so indices don't shift on mid-loop deletions
for ($i = $stashCount - 1; $i -ge 0; $i--) {
  $stashRef = "stash@{$i}"
  Write-Info "Dropping $stashRef ..."
  & git stash drop $stashRef 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "  -> $stashRef deleted successfully"
    $cleaned++
  } else {
    Write-Err "  -> $stashRef FAILED to delete"
    $failed++
  }
}

# Fallback: if any left, do `git stash clear`
$remaining = @(& git stash list).Count
if ($remaining -gt 0 -and $failed -gt 0) {
  Write-Warn "$remaining record(s) still exist after reverse-drop. Fallback: git stash clear"
  & git stash clear 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "git stash clear succeeded"
  } else {
    Write-Err "git stash clear failed (exit=$LASTEXITCODE)"
  }
  $remaining = @(& git stash list).Count
}

Write-Info "Cleanup summary: cleaned=$cleaned, failed=$failed, remaining=$remaining"

# ── 4/4: Post-cleanup verification ─────────────────────────────────────
Write-Banner "PHASE 4/4: Post-Cleanup Verification"

$verify1 = @(& git stash list).Count
if ($verify1 -eq 0) { Write-Ok "Stash list is EMPTY (verified)" }
else                { Write-Err "Stash list still has $verify1 entry(ies)!" }

$verify2 = & git status --short --branch
Write-Info "git status (after cleanup):"
$verify2 | ForEach-Object { Write-Host "         $_" -ForegroundColor Gray }

$fsck = & git fsck --no-progress --unreachable 2>&1
$fsckErrors = ($fsck | Select-String 'error|fatal').Count
if ($fsckErrors -eq 0) { Write-Ok "git fsck integrity OK (0 unreachable errors)" }
else                   { Write-Warn "git fsck reported $fsckErrors lines (may be benign)" }

Write-Banner "FINAL RESULT"
if ($verify1 -eq 0 -and $fsckErrors -eq 0) {
  Write-Ok "All stash entries purged. Repo healthy. Done."
  exit 0
} else {
  Write-Warn "Partial result. Manual review recommended."
  exit 1
}
