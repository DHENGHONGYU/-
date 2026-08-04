<#
.SYNOPSIS
  Clean pre-commit hook side-effect files by restoring them to HEAD.

.DESCRIPTION
  Git index stat cache can become stale after lint-staged's eslint --fix
  modifies files, causing `git status` and `git checkout -- .` to miss
  modified files (racy-clean problem). This script performs iterative
  "refresh -> restore" cycles until the working tree stabilizes, leaving
  only user-intended modifications.

  Four-phase pipeline:
    1. Repo state pre-check
    2. Iterative side-effect detection (refresh + diff)
    3. DryRun preview or Apply restore
    4. Post-cleanup verification

.PARAMETER Apply
  Actually restore side-effect files to HEAD. Without this flag, the
  script only shows what would be cleaned (DryRun mode, default).

.PARAMETER PreserveFiles
  Array of file paths (relative to repo root) that are user-intended
  modifications and should be preserved. Files NOT in this list will be
  restored to HEAD. Supports glob patterns via -Like matching.

.PARAMETER PreserveFromFile
  Path to a text file containing file paths to preserve (one per line).
  Lines starting with # are treated as comments.

.PARAMETER MaxRounds
  Maximum number of refresh+restore cycles. Default: 10.

.PARAMETER VerifyTsc
  Run `npm run tsc:prod` after cleanup to verify type safety.

.PARAMETER y
  Skip interactive confirmation when -Apply is set. USE WITH CAUTION.

.EXAMPLE
  # DryRun: show what would be cleaned (safe, default)
  .\scripts\git\clean-side-effects.ps1

  # DryRun with explicit preserve list
  .\scripts\git\clean-side-effects.ps1 -PreserveFiles @('src/lib/format.ts','src/lib/withBroadcast.ts')

  # Apply: actually restore side-effect files
  .\scripts\git\clean-side-effects.ps1 -Apply -PreserveFiles @('src/lib/format.ts','src/lib/withBroadcast.ts')

  # Apply with preserve file and tsc verification
  .\scripts\git\clean-side-effects.ps1 -Apply -y -PreserveFromFile .user-preserve.txt -VerifyTsc
#>

[CmdletBinding()]
param(
  [switch]$Apply,
  [string[]]$PreserveFiles = @(),
  [string]$PreserveFromFile = '',
  [int]$MaxRounds = 10,
  [switch]$VerifyTsc,
  [switch]$y
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent

# ── Tiny logging helpers ────────────────────────────────────────────────
# IMPORTANT: Use [Console]::WriteLine() instead of Write-Host to avoid
# PowerShell's Information stream generating InformationRecord objects.
# When Trae IDE's AI agent executes commands via PowerShell SDK, these
# InformationRecord objects get serialized to CLIXML, producing massive
# XML noise in the output. [Console]::WriteLine() writes directly to stdout,
# bypassing the Information stream entirely.
function Write-Banner([string]$m) {
  $bar = '=' * 72
  [Console]::WriteLine()
  [Console]::WriteLine($bar)
  [Console]::WriteLine("  $m")
  [Console]::WriteLine($bar)
}
function Write-Info([string]$m)    { [Console]::WriteLine("[INFO ] $m") }
function Write-Ok([string]$m)      { [Console]::WriteLine("[ OK  ] $m") }
function Write-Warn([string]$m)    { [Console]::WriteLine("[WARN ] $m") }
function Write-Err([string]$m)     { [Console]::WriteLine("[FAIL ] $m") }

# Helper for colored output via [Console] (bypasses Information stream)
function Write-Line([string]$text, [string]$color = 'Gray') {
  try {
    $prev = [Console]::ForegroundColor
    [Console]::ForegroundColor = $color
    [Console]::WriteLine($text)
  } catch {
    [Console]::WriteLine($text)
  } finally {
    try { [Console]::ForegroundColor = $prev } catch {}
  }
}

# ── Helper: check if a file path matches the preserve list ─────────────
function Test-PreserveFile([string]$filePath, [string[]]$preserveList) {
  foreach ($p in $preserveList) {
    $p = $p.Trim()
    if (-not $p -or $p.StartsWith('#')) { continue }
    # Exact match
    if ($filePath -eq $p) { return $true }
    # Normalize path separators for cross-platform matching
    $normPath = $filePath -replace '\\', '/'
    $normP = $p -replace '\\', '/'
    if ($normPath -eq $normP) { return $true }
    # Glob pattern match (simple * wildcard)
    if ($normP -contains '*') {
      $pattern = $normP -replace '\.', '\.' -replace '\*', '.*'
      if ($normPath -match "^$pattern$") { return $true }
    }
  }
  return $false
}

# ── Helper: refresh index and get all modified tracked files ───────────
function Get-ModifiedFiles {
  # Use --really-refresh to bypass assume-unchanged bit
  & git update-index --really-refresh 2>&1 | Out-Null
  # git diff --name-only returns tracked modified files (relative paths)
  return @(& git diff --name-only)
}

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

# 1c: current branch and HEAD
$branch = & git branch --show-current
$head = & git log --oneline -1
Write-Info "Branch: $branch"
Write-Info "HEAD:   $head"

# 1d: load preserve list from file if specified
$preserveList = @($PreserveFiles)
if ($PreserveFromFile -and (Test-Path -LiteralPath $PreserveFromFile)) {
  $fileLines = Get-Content -LiteralPath $PreserveFromFile -Encoding utf8
  $preserveList += $fileLines
  Write-Ok "Loaded $(($fileLines | Where-Object { $_ -and -not $_.StartsWith('#') }).Count) preserve entries from: $PreserveFromFile"
}

if ($preserveList.Count -eq 0) {
  Write-Warn "No preserve files specified. ALL modified tracked files will be treated as side-effects."
  Write-Warn "Use -PreserveFiles or -PreserveFromFile to protect user-intended modifications."
} else {
  Write-Info "Preserve list ($($preserveList.Count) entries):"
  $preserveList | Where-Object { $_ -and -not $_.StartsWith('#') } | ForEach-Object {
    Write-Line "         $_" 'DarkGray'
  }
}

# ── 2/4: Iterative side-effect detection ────────────────────────────────
Write-Banner "PHASE 2/4: Iterative Side-Effect Detection (max $MaxRounds rounds)"

$roundResults = @()
$allSideEffects = [System.Collections.Generic.HashSet[string]]::new()

for ($round = 1; $round -le $MaxRounds; $round++) {
  Write-Info "Round ${round}: Refreshing index..."
  $modified = Get-ModifiedFiles

  if ($modified.Count -eq 0) {
    Write-Ok "Round ${round}: No modified files detected. Working tree is clean."
    $roundResults += [PSCustomObject]@{ Round = $round; Total = 0; SideEffects = 0; New = 0 }
    break
  }

  # Classify: user files vs side-effects
  $userFiles = @()
  $sideEffects = @()
  foreach ($f in $modified) {
    if (Test-PreserveFile -filePath $f -preserveList $preserveList) {
      $userFiles += $f
    } else {
      $sideEffects += $f
      [void]$allSideEffects.Add($f)
    }
  }

  $newThisRound = @($sideEffects | Where-Object { -not $roundResults.SideEffects -contains $_ })
  Write-Info "Round ${round}: Total modified=$($modified.Count), User files=$($userFiles.Count), Side-effects=$($sideEffects.Count)"

  $roundResults += [PSCustomObject]@{
    Round       = $round
    Total       = $modified.Count
    SideEffects = $sideEffects.Count
    New         = $newThisRound.Count
  }

  if ($sideEffects.Count -eq 0) {
    Write-Ok "Round ${round}: Only user-intended files remain. Stabilized."
    break
  }

  # DryRun mode: just report, don't restore
  if (-not $Apply) {
    Write-Warn "Round ${round} [DryRun]: Would restore $($sideEffects.Count) side-effect file(s):"
    $sideEffects | ForEach-Object { Write-Line "         $_" 'DarkYellow' }
    # In DryRun, still refresh to discover all stale-cache files
    continue
  }

  # Apply mode: restore side-effect files
  Write-Info "Round ${round} [Apply]: Restoring $($sideEffects.Count) side-effect file(s)..."
  foreach ($f in $sideEffects) {
    & git restore $f 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "  -> restored: $f"
    } else {
      Write-Err "  -> FAILED:   $f"
    }
  }
}

# Summary of all rounds
Write-Banner "DETECTION SUMMARY"
$roundResults | Format-Table -AutoSize | Out-Host

if ($allSideEffects.Count -eq 0) {
  Write-Ok "No side-effect files detected. Working tree is clean."
  exit 0
}

Write-Info "Total unique side-effect files detected: $($allSideEffects.Count)"
$allSideEffects | Sort-Object | ForEach-Object {
  Write-Line "         $_" 'DarkYellow'
}

# ── 3/4: Execute or confirm ──────────────────────────────────────────────
if (-not $Apply) {
  Write-Banner "PHASE 3/4: DryRun Preview (no changes made)"
  Write-Warn "DryRun mode: $($allSideEffects.Count) file(s) would be restored to HEAD."
  Write-Warn "To actually clean, re-run with -Apply flag."
  [Console]::WriteLine()
  Write-Line "  Example:" 'Cyan'
  Write-Line "  .\scripts\git\clean-side-effects.ps1 -Apply -PreserveFiles @('src/lib/format.ts', ...)" 'Cyan'
  exit 0
}

Write-Banner "PHASE 3/4: Apply Restore"

# In Apply mode, the restore already happened during detection loops.
# But if user used -y without -Apply being processed in loop (edge case),
# do a final sweep.
if ($y) {
  Write-Info "Auto-confirmed (-y). Skipping interactive prompt."
} else {
  $finalModified = Get-ModifiedFiles
  $finalSideEffects = @($finalModified | Where-Object { -not (Test-PreserveFile -filePath $_ -preserveList $preserveList) })
  if ($finalSideEffects.Count -gt 0) {
    Write-Warn "Final sweep: $($finalSideEffects.Count) side-effect file(s) still present after $MaxRounds rounds."
    Write-Warn "Files:"
    $finalSideEffects | ForEach-Object { Write-Line "         $_" 'DarkYellow' }
    $confirm = Read-Host "Type YES to force restore these files (anything else cancels)"
    if ($confirm -ne 'YES') {
      Write-Warn "Cancelled by user. $($finalSideEffects.Count) file(s) not restored."
      exit 1
    }
    foreach ($f in $finalSideEffects) {
      & git restore $f 2>&1 | Out-Null
      Write-Ok "  -> force restored: $f"
    }
  }
}

# ── 4/4: Post-cleanup verification ──────────────────────────────────────
Write-Banner "PHASE 4/4: Post-Cleanup Verification"

# 4a: refresh and check working tree
& git update-index --really-refresh 2>&1 | Out-Null
$verifyModified = @(& git diff --name-only)
$verifyUserFiles = @($verifyModified | Where-Object { Test-PreserveFile -filePath $_ -preserveList $preserveList })
$verifySideEffects = @($verifyModified | Where-Object { -not (Test-PreserveFile -filePath $_ -preserveList $preserveList) })

Write-Info "Working tree status after cleanup:"
Write-Info "  Total modified:  $($verifyModified.Count)"
Write-Info "  User files:      $($verifyUserFiles.Count)"
Write-Info "  Side-effect files: $($verifySideEffects.Count)"

if ($verifySideEffects.Count -eq 0) {
  Write-Ok "All side-effect files cleaned. Only user-intended modifications remain."
} else {
  Write-Err "$($verifySideEffects.Count) side-effect file(s) still remain after cleanup:"
  $verifySideEffects | ForEach-Object { Write-Line "         $_" 'Red' }
}

if ($verifyUserFiles.Count -gt 0) {
  Write-Ok "Preserved user files ($($verifyUserFiles.Count)):"
  $verifyUserFiles | ForEach-Object { Write-Line "         $_" 'DarkGreen' }
}

# 4b: optional tsc:prod verification
if ($VerifyTsc) {
  Write-Info "Running tsc:prod verification..."
  & npm run tsc:prod 2>&1 | Out-Host
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "tsc:prod PASSED (0 errors)"
  } else {
    Write-Err "tsc:prod FAILED (exit=$LASTEXITCODE). Type errors may exist in remaining files."
  }
}

# 4c: final git status
Write-Info "Final git status:"
$status = & git status --short
$status | ForEach-Object { Write-Line "         $_" 'Gray' }

# ── Final result ──────────────────────────────────────────────────────────
Write-Banner "FINAL RESULT"
if ($verifySideEffects.Count -eq 0) {
  Write-Ok "Cleanup successful. Working tree contains only user-intended modifications."
  if ($VerifyTsc -and $LASTEXITCODE -ne 0) {
    Write-Warn "But tsc:prod reported errors. Review type definitions in preserved files."
    exit 1
  }
  exit 0
} else {
  Write-Warn "Partial cleanup. $($verifySideEffects.Count) file(s) could not be restored."
  Write-Warn "These may be locked by IDE or have permission issues. Try closing editors and re-run."
  exit 1
}
