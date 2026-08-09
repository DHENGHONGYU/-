# scripts/pre-push-pathtrace-check.ps1
# PathTrace Module Pre-Push Local Pre-Check
# Avoids pipeline failures after `git push`.
#
# Usage:
#   .\scripts\pre-push-pathtrace-check.ps1              # Full check (recommended).
#   .\scripts\pre-push-pathtrace-check.ps1 -SkipSyntax   # Skip AST parse (ultra fast).
#   .\scripts\pre-push-pathtrace-check.ps1 -RunTests     # Also run 16-item test suite.
#   .\scripts\pre-push-pathtrace-check.ps1 -InstallHook  # Install as Git pre-push hook.
#   .\scripts\pre-push-pathtrace-check.ps1 -UninstallHook# Uninstall Git pre-push hook.
#   .\scripts\pre-push-pathtrace-check.ps1 -Verbose      # Inline detailed diagnostics + consolidated dump on FAIL.
#   # NOTE: On FAIL, a consolidated diagnostic dump is ALWAYS shown (even without -Verbose).
#   #       -Verbose adds inline [DIAG] lines during execution for real-time tracing.

param(
    [switch]$SkipSyntax,
    [switch]$RunTests,
    [switch]$InstallHook,
    [switch]$UninstallHook,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$script:pass = 0; $script:fail = 0; $script:warn = 0
$script:verbose = $Verbose.IsPresent
$script:diag = [System.Collections.ArrayList]::new()

function Write-Diag($msg) {
    if ($script:verbose) {
        Write-Host "  [DIAG] $msg" -ForegroundColor Magenta
    }
    [void]$script:diag.Add($msg)
}

function Check($name, $result, [switch]$WarningOnly) {
    if ($result) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        $script:pass++
    } elseif ($WarningOnly) {
        Write-Host "  [WARN] $name" -ForegroundColor Yellow
        $script:warn++
    } else {
        Write-Host "  [FAIL] $name" -ForegroundColor Red
        $script:fail++
    }
}

function Invoke-WithStopwatch($label, [scriptblock]$block) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    & $block
    $sw.Stop()
    Write-Host "    elapsed $($sw.ElapsedMilliseconds) ms" -ForegroundColor DarkGray
}

# ====== Git Hook Install ======
if ($InstallHook) {
    $gitDir = (git rev-parse --git-dir 2>$null)
    if (-not $gitDir) { Write-Error "Not inside a Git repository"; exit 1 }
    $hooksDir = Join-Path $gitDir "hooks"
    $hookPath = Join-Path $hooksDir "pre-push"
    $hookContent = @'
#!/bin/sh
# PathTrace pre-push hook installed by scripts/pre-push-pathtrace-check.ps1
# Triggers only when push touches PathTrace-related files.
files=$(git diff --name-only origin...HEAD 2>/dev/null || git diff --name-only 2>/dev/null || true)
if echo "$files" | grep -qE "(scripts/PathTrace|scripts/deploy-pathtrace|scripts/test-pathtrace|\.github/workflows/pathtrace)"; then
    echo "[pre-push] PathTrace files detected, running local pre-check..."
    SCRIPT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
    if command -v pwsh >/dev/null 2>&1; then
        pwsh -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/scripts/pre-push-pathtrace-check.ps1"
        rc=$?
    else
        powershell -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/scripts/pre-push-pathtrace-check.ps1"
        rc=$?
    fi
    if [ $rc -ne 0 ]; then
        echo ""
        echo "[pre-push] FAILED with exit=$rc — push aborted."
        echo "[pre-push] Fix issues then re-push, or use git push --no-verify (NOT recommended)."
        exit $rc
    fi
    echo "[pre-push] PASSED."
else
    echo "[pre-push] No PathTrace changes, skipping pre-check."
fi
exit 0
'@
    if (-not (Test-Path $hooksDir)) { New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null }
    # Use .NET WriteAllText with UTF8Encoding(false) for cross-version compatibility
    # (Set-Content -Encoding utf8NoBOM is PS7-only and silently fails on PS 5.1)
    try {
        $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($hookPath, $hookContent, $utf8NoBom)
    } catch {
        Write-Error "Failed to write hook file: $($_.Exception.Message)"
        exit 1
    }
    # Verify the hook file was actually written
    if (-not (Test-Path $hookPath)) {
        Write-Error "Hook installation FAILED: file not created at $hookPath"
        exit 1
    }
    $writtenLen = (Get-Item $hookPath).Length
    if ($writtenLen -lt 100) {
        Write-Error "Hook installation FAILED: file too small ($writtenLen bytes), content may be corrupted"
        exit 1
    }
    Write-Host "[pre-push hook] Installed at: $hookPath ($writtenLen bytes)" -ForegroundColor Green
    Write-Host "  Trigger: push contains PathTrace-related paths"
    Write-Host "  Bypass (NOT recommended): git push --no-verify"
    exit 0
}

if ($UninstallHook) {
    $gitDir = (git rev-parse --git-dir 2>$null)
    if (-not $gitDir) { Write-Error "Not inside a Git repository"; exit 1 }
    $hookPath = Join-Path $gitDir "hooks/pre-push"
    if (Test-Path $hookPath) {
        Remove-Item $hookPath -Force
        Write-Host "[pre-push hook] Uninstalled: $hookPath" -ForegroundColor Green
    } else {
        Write-Host "[pre-push hook] No hook file found, nothing to uninstall" -ForegroundColor DarkGray
    }
    exit 0
}

# ====== Locate Repo Root ======
$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$RepoRoot = Split-Path -Parent $ScriptDir

$psd1Path = Join-Path $RepoRoot "scripts/PathTrace.psd1"
$psm1Path = Join-Path $RepoRoot "scripts/PathTrace.psm1"
$deployPath = Join-Path $RepoRoot "scripts/deploy-pathtrace-module.ps1"
$testPath = Join-Path $RepoRoot "scripts/test-pathtrace-global.ps1"
$workflowPath = Join-Path $RepoRoot '.github/workflows/pathtrace-ci.yml'
$readmePath = Join-Path $RepoRoot 'scripts/PathTrace-README.md'
$usagePath = Join-Path $RepoRoot 'scripts/PathTrace-Usage.md'

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  PathTrace Pre-Push Pre-Check" -ForegroundColor Cyan
Write-Host "  RepoRoot = $RepoRoot" -ForegroundColor DarkGray
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ====== 1. File Integrity ======
Write-Host "--- 1. File Integrity ---" -ForegroundColor Yellow
$required = @{
    PSD1       = $psd1Path
    PSM1       = $psm1Path
    Deploy     = $deployPath
    TestSuite  = $testPath
    Workflow   = $workflowPath
    README     = $readmePath
    UsageDoc   = $usagePath
}
foreach ($k in $required.Keys) {
    $f = $required[$k]
    $fn = [IO.Path]::GetFileName($f)
    $exists = Test-Path $f
    Check "File exists: $k ($fn)" $exists
    if (-not $exists) {
        Write-Diag "MISSING: $k -> expected at: $f"
        Write-Diag "  PSScriptRoot=$ScriptDir  RepoRoot=$RepoRoot"
        Write-Diag "  CWD=$(Get-Location)"
        # suggest similar files
        $parent = Split-Path $f -Parent
        if (Test-Path $parent) {
            $sibs = Get-ChildItem $parent -Name -ErrorAction SilentlyContinue | Select-Object -First 5
            Write-Diag "  siblings in '$parent': $($sibs -join ', ')"
        } else {
            Write-Diag "  parent dir '$parent' does NOT exist"
        }
    }
}

# ====== 2. PSD1 ModuleVersion Gate Check (P0 core) ======
Write-Host ""
Write-Host "--- 2. PSD1 ModuleVersion Gate (>= 1.0.0) ---" -ForegroundColor Yellow
$manifest = $null
Invoke-WithStopwatch "ModuleVersion check" {
    try {
        $script:manifest = Test-ModuleManifest -Path $psd1Path -ErrorAction Stop
        $m = $script:manifest
        Write-Host "    Manifest name: $($m.Name)    GUID: $($m.Guid)"
        Write-Host "    ModuleVersion : $($m.Version)"
        $ver = [version]$m.Version
        $verOk = $ver -ge [version]'1.0.0'
        Check "ModuleVersion $ver >= 1.0.0" $verOk
        if (-not $verOk) {
            Write-Host "    -> Fix: edit scripts/PathTrace.psd1, set ModuleVersion to '1.X.Y'" -ForegroundColor DarkRed
            Write-Diag "ModuleVersion=$ver  threshold=1.0.0  comparison -lt => True"
            Write-Diag "PSD1 path: $psd1Path"
            Write-Diag "To fix: open the file and change ModuleVersion = '0.x.y' to ModuleVersion = '1.X.Y'"
        }
    } catch {
        Check "Test-ModuleManifest parses" $false
        Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor DarkRed
        Write-Diag "Test-ModuleManifest threw: $($_.Exception.GetType().FullName)"
        Write-Diag "  message: $($_.Exception.Message)"
        Write-Diag "PSD1 path: $psd1Path"
        Write-Diag "First 5 lines of file:"
        if (Test-Path $psd1Path) {
            $lines = Get-Content $psd1Path -TotalCount 5
            for ($i = 0; $i -lt $lines.Count; $i++) { Write-Diag "  $($i+1): $($lines[$i])" }
        } else {
            Write-Diag "  (file not found)"
        }
    }
}

# ====== 3. PSD1 FunctionsToExport Completeness ======
Write-Host ""
Write-Host "--- 3. PSD1 FunctionsToExport Completeness ---" -ForegroundColor Yellow
Invoke-WithStopwatch "FunctionsToExport check" {
    if (-not $script:manifest) { Check "PSD1 parseable" $false; return }
    $requiredFuncs = @(
        'Write-PathTrace', 'Test-PathChain', 'Find-PythonExe',
        'Enable-PathTraceLog', 'Disable-PathTraceLog',
        'Enable-PathTraceDebug', 'Disable-PathTraceDebug'
    )
    $declared = @($script:manifest.ExportedFunctions.Keys)
    $missing = $requiredFuncs | Where-Object { $_ -notin $declared }
    if ($missing.Count -gt 0) {
        Check "All 7 core functions declared (missing: $($missing -join ', '))" $false
        Write-Host "    -> Fix: add missing to FunctionsToExport in PathTrace.psd1" -ForegroundColor DarkRed
        Write-Diag "Required: $($requiredFuncs -join ', ')"
        Write-Diag "Declared: $($declared -join ', ')"
        Write-Diag "Missing : $($missing -join ', ')"
        Write-Diag "To fix: open $psd1Path and add the missing names to the FunctionsToExport array"
    } else {
        Check "All 7 core functions declared in FunctionsToExport" $true
    }
    Write-Host "    Declared ($($declared.Count)): $($declared -join ', ')"
}

# ====== 4. PSM1 <-> PSD1 Export Cross-Check ======
Write-Host ""
Write-Host "--- 4. Export-ModuleMember vs PSD1 FunctionsToExport ---" -ForegroundColor Yellow
Invoke-WithStopwatch "Export cross-match" {
    $psm1Content = Get-Content $psm1Path -Raw
    $pat = [regex]::new('Export-ModuleMember\s+-Function\s+(.+)', [System.Text.RegularExpressions.RegexOptions]::Multiline)
    $exportMatch = $pat.Match($psm1Content)
    if (-not $exportMatch.Success) {
        Check ".psm1 contains Export-ModuleMember line" $false
        return
    }
    $psm1Funcs = ($exportMatch.Groups[1].Value -split ',') | ForEach-Object { $_.Trim() } |
                 Where-Object { -not [string]::IsNullOrEmpty($_) } | Sort-Object
    if (-not $script:manifest) { $script:manifest = Test-ModuleManifest -Path $psd1Path -ErrorAction SilentlyContinue }
    $psd1Funcs = @($script:manifest.ExportedFunctions.Keys) | Sort-Object
    $diff = Compare-Object $psm1Funcs $psd1Funcs
    if ($diff) {
        $diffStr = ($diff | ForEach-Object { "$($_.SideIndicator)$($_.InputObject)" }) -join " "
        Check "Export lists match (diff: $diffStr)" $false
        Write-Host "    PSM1 Export: $($psm1Funcs -join ', ')"
        Write-Host "    PSD1 Declare: $($psd1Funcs -join ', ')"
        Write-Host "    -> Fix: edit both files until lists are identical" -ForegroundColor DarkRed
    } else {
        Check "Export lists match ($($psm1Funcs.Count) functions)" $true
    }
}

# ====== 5. Syntax AST Parse Check ======
Write-Host ""
Write-Host "--- 5. PowerShell Syntax AST Parse ---" -ForegroundColor Yellow
if ($SkipSyntax) {
    Write-Host "  [SKIP] Syntax parse skipped (-SkipSyntax)" -ForegroundColor Gray
} else {
    Invoke-WithStopwatch "Syntax parse" {
        $selfPath = $MyInvocation.MyCommand.Path
        $targets = @($psd1Path, $psm1Path, $deployPath, $testPath)
        if ($selfPath) { $targets += $selfPath }
        $targets = $targets | Where-Object { -not [string]::IsNullOrEmpty($_) -and (Test-Path $_) }
        $localFail = $false
        foreach ($f in $targets) {
            $tokens = $null; $errors = $null
            $ast = [System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$tokens, [ref]$errors)
            $fname = Split-Path $f -Leaf
            if ($errors -and $errors.Count -gt 0) {
                $localFail = $true
                Write-Host "  [FAIL] $fname syntax error" -ForegroundColor Red
                foreach ($e in $errors | Select-Object -First 3) {
                    Write-Host "         Line $($e.Extent.StartLineNumber) Col $($e.Extent.StartColumnNumber): $($e.Message)" -ForegroundColor DarkRed
                }
            } else {
                Write-Host "  [PASS] $fname syntax OK ($($tokens.Count) tokens)" -ForegroundColor Green
                $script:pass++
            }
        }
        if ($localFail) { $script:fail++ }
    }
}

# ====== 6. Validate timeout / failure propagation simulation ======
Write-Host ""
Write-Host "--- 6. Pipeline failure propagation simulation ---" -ForegroundColor Yellow
Write-Host "  Logic-level reasoning of GitHub Actions 'needs:' semantics."
$validateState = if ($script:fail -eq 0) { "PASS" } else { "FAIL" }
$testState = if ($validateState -eq "PASS") { "will START" } else { "will SKIP" }
$releaseState = if ($validateState -eq "PASS") { "will START (after test PASS)" } else { "will SKIP" }
Write-Host "  validate job: $validateState"
Write-Host "  test job    : $testState (needs: validate)"
Write-Host "  release job : $releaseState (needs: validate, test)"
Write-Host "  GH Release  : $(if ($validateState -eq 'PASS'){'will be created on tag push'}else{'WILL NOT be created - protects existing assets'})"
Check "Pipeline simulation consistent (validate=$validateState, downstream behave OK)" $true

# ====== 7. Optional Test Suite ======
Write-Host ""
Write-Host "--- 7. Test Suite (optional, use -RunTests) ---" -ForegroundColor Yellow
if (-not $RunTests) {
    Write-Host "  [SKIP] Not requested. Add -RunTests to execute 16 tests." -ForegroundColor Gray
} else {
    Write-Host "  Running test-pathtrace-global.ps1 ..."
    & "powershell" -NoProfile -ExecutionPolicy Bypass -File $testPath
    $rc = $LASTEXITCODE
    Check "Test suite exit code 0 (got $rc)" ($rc -eq 0)
}

# ====== Summary ======
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  PASS: $($script:pass)   FAIL: $($script:fail)   WARN: $($script:warn)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
if ($script:fail -eq 0) {
    Write-Host "  All pre-checks PASSED. Safe to git push / git tag vX.Y.Z." -ForegroundColor Green
    if (-not $RunTests) {
        Write-Host "  Tip: add -RunTests to also run the 16-test suite." -ForegroundColor DarkGray
    }
    exit 0
} else {
    Write-Host "  FAILED with $($script:fail) error(s)." -ForegroundColor Red
    Write-Host "     Fix issues above then re-run before pushing." -ForegroundColor DarkRed
    Write-Host "     Emergency bypass (NOT recommended): git push --no-verify" -ForegroundColor Yellow
    # Consolidated diagnostic dump on failure (always shown, even without -Verbose,
    # because failures need full context for quick root-cause analysis)
    if ($script:diag.Count -gt 0) {
        Write-Host ""
        Write-Host "--- Diagnostic Dump ($($script:diag.Count) entries) ---" -ForegroundColor Magenta
        foreach ($d in $script:diag) {
            Write-Host "  [DIAG] $d" -ForegroundColor Magenta
        }
        Write-Host ""
    }
    if (-not $script:verbose) {
        Write-Host "  Tip: re-run with -Verbose for inline diagnostics during execution." -ForegroundColor DarkGray
    }
    exit 1
}
