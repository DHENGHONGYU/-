# scripts/simulate-hook-permission-failure.ps1
# Simulates pre-push hook execution failure due to missing execute permission.
# Demonstrates: symptom -> diagnosis -> fix -> verification.
# This is a one-shot demo script, safe to delete after use.

$ErrorActionPreference = "Continue"
$hookPath = Join-Path (git rev-parse --git-dir 2>$null) "hooks/pre-push"
if (-not (Test-Path $hookPath)) {
    Write-Host "[SETUP] Hook not found, installing first..." -ForegroundColor Yellow
    & powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/pre-push-pathtrace-check.ps1" -InstallHook
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SIMULATION: pre-push Hook 'No Execute Permission' Failure" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# --- Step 1: Show healthy state ---
Write-Host ""
Write-Host "--- Step 1: Healthy State (hook works) ---" -ForegroundColor Green
$acl = Get-Acl $hookPath
$execRule = $acl.Access | Where-Object { $_.FileSystemRights -match "Execute" -or $_.FileSystemRights -match "FullControl" -or $_.FileSystemRights -match "ReadAndExecute" }
Write-Host "  Hook path: $hookPath"
Write-Host "  File size: $((Get-Item $hookPath).Length) bytes"
Write-Host "  ACL rules with Execute/ReadAndExecute:"
foreach ($r in $execRule) {
    Write-Host "    $($r.IdentityReference): $($r.FileSystemRights) ($($r.AccessControlType))"
}

# --- Step 2: Simulate permission removal ---
Write-Host ""
Write-Host "--- Step 2: Simulate 'No Execute Permission' (deny Execute) ---" -ForegroundColor Yellow
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$denyRule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $currentUser,
    [System.Security.AccessControl.FileSystemRights]::ExecuteFile,
    [System.Security.AccessControl.AccessControlType]::Deny
)
$acl.AddAccessRule($denyRule)
Set-Acl -Path $hookPath -AclObject $acl
Write-Host "  Added DENY ExecuteFile rule for: $currentUser"
Write-Host "  (This simulates 'chmod -x' on Linux/macOS)"

# --- Step 3: Show what git push would see ---
Write-Host ""
Write-Host "--- Step 3: Symptom — what happens when you 'git push' ---" -ForegroundColor Red
Write-Host "  When Git tries to execute the pre-push hook, it will fail with:"
Write-Host "    error: cannot spawn .git/hooks/pre-push: Permission denied"
Write-Host "    OR"
Write-Host "    fatal: 'pre-push' hook exited with permission error"
Write-Host "    error: failed to push some refs to 'origin'"
Write-Host ""
Write-Host "  Attempting to execute the hook directly to demonstrate..."
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = "powershell"
$psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$hookPath`""
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
try {
    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit(5000)
    Write-Host "  Exit code: $($proc.ExitCode)" -ForegroundColor Red
    if ($stdout) { Write-Host "  stdout: $stdout" }
    if ($stderr) { Write-Host "  stderr: $stderr" -ForegroundColor Red }
} catch {
    Write-Host "  EXCEPTION: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  (This is the 'Permission denied' symptom)" -ForegroundColor Red
}

# --- Step 4: Diagnosis ---
Write-Host ""
Write-Host "--- Step 4: Diagnosis — how to identify the root cause ---" -ForegroundColor Yellow
Write-Host "  1. Check if the hook file exists:"
Write-Host "     Test-Path .git/hooks/pre-push  => $(Test-Path $hookPath)"
Write-Host "  2. Check ACL for DENY rules:"
$acl2 = Get-Acl $hookPath
$denyRules = $acl2.Access | Where-Object { $_.AccessControlType -eq "Deny" }
if ($denyRules) {
    foreach ($r in $denyRules) {
        Write-Host "     DENY: $($r.IdentityReference) -> $($r.FileSystemRights)" -ForegroundColor Red
    }
} else {
    Write-Host "     No DENY rules found" -ForegroundColor Green
}
Write-Host "  3. On Linux/macOS, check with: ls -la .git/hooks/pre-push"
Write-Host "     Look for '-rw-r--r--' (missing 'x' = no execute)"
Write-Host "  4. Check git hook list: git config --get core.hooksPath"

# --- Step 5: Fix ---
Write-Host ""
Write-Host "--- Step 5: Fix — restore execute permission ---" -ForegroundColor Green
$acl3 = Get-Acl $hookPath
$toRemove = $acl3.Access | Where-Object {
    $_.AccessControlType -eq "Deny" -and $_.IdentityReference.Value -eq $currentUser
}
foreach ($r in $toRemove) {
    $acl3.RemoveAccessRule($r) | Out-Null
    Write-Host "  Removed DENY rule: $($r.IdentityReference) -> $($r.FileSystemRights)"
}
Set-Acl -Path $hookPath -AclObject $acl3
Write-Host "  Execute permission restored." -ForegroundColor Green

# Alternative fix: re-install the hook
Write-Host ""
Write-Host "  Alternative fix (re-install from scratch):"
Write-Host "    .\scripts\pre-push-pathtrace-check.ps1 -UninstallHook"
Write-Host "    .\scripts\pre-push-pathtrace-check.ps1 -InstallHook"
Write-Host ""
Write-Host "  On Linux/macOS:"
Write-Host "    chmod +x .git/hooks/pre-push"

# --- Step 6: Verify ---
Write-Host ""
Write-Host "--- Step 6: Verification — hook is executable again ---" -ForegroundColor Green
$acl4 = Get-Acl $hookPath
$denyAfter = $acl4.Access | Where-Object { $_.AccessControlType -eq "Deny" }
if (-not $denyAfter) {
    Write-Host "  [PASS] No DENY rules remain. Hook is executable." -ForegroundColor Green
} else {
    Write-Host "  [FAIL] DENY rules still present:" -ForegroundColor Red
    foreach ($r in $denyAfter) { Write-Host "    $($r.IdentityReference) -> $($r.FileSystemRights)" }
}
Write-Host ""
Write-Host "  To fully verify, run the pre-check directly:"
Write-Host "    .\scripts\pre-push-pathtrace-check.ps1 -SkipSyntax"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Simulation Complete" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
