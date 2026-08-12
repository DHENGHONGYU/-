# deploy-pathtrace-module.ps1 - PathTrace Module One-Click Deployment
# Usage:
#   .\scripts\deploy-pathtrace-module.ps1              # Deploy to CurrentUser
#   .\scripts\deploy-pathtrace-module.ps1 -Scope AllUsers  # Deploy to AllUsers (needs admin)
#   .\scripts\deploy-pathtrace-module.ps1 -Verify       # Verify installation only
#   .\scripts\deploy-pathtrace-module.ps1 -Uninstall    # Uninstall

param(
    [ValidateSet("CurrentUser", "AllUsers")]
    [string]$Scope = "CurrentUser",

    [switch]$Verify,

    [switch]$Uninstall
)

$ErrorActionPreference = "Continue"
$script:pass = 0; $script:fail = 0

function Check($name, $result) {
    if ($result) { Write-Host "  [PASS] $name" -ForegroundColor Green; $script:pass++ }
    else { Write-Host "  [FAIL] $name" -ForegroundColor Red; $script:fail++ }
}

# ====== Locate source files ======
$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

$srcPsm1 = Join-Path $ScriptDir "PathTrace.psm1"
$srcPsd1 = Join-Path $ScriptDir "PathTrace.psd1"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  PathTrace Module Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ====== Verify mode ======
if ($Verify) {
    Write-Host "--- Verify Installation ---" -ForegroundColor Yellow
    Write-Host ""

    $mod = Get-Module -ListAvailable -Name PathTrace
    Check "Get-Module can find PathTrace" ($null -ne $mod)
    if ($mod) {
        Write-Host "       Name: $($mod.Name)  Version: $($mod.Version)  Path: $($mod.Path)"
    }

    try {
        Import-Module PathTrace -Force -ErrorAction Stop
        Check "Import-Module succeeded" $true
    } catch {
        Check "Import-Module succeeded" $false
    }

    $hasFunc = Get-Command Write-PathTrace -ErrorAction SilentlyContinue
    Check "Write-PathTrace available" ($null -ne $hasFunc)

    $hasFind = Get-Command Find-PythonExe -ErrorAction SilentlyContinue
    Check "Find-PythonExe available" ($null -ne $hasFind)

    $hasDebug = Get-Command Enable-PathTraceDebug -ErrorAction SilentlyContinue
    Check "Enable-PathTraceDebug available" ($null -ne $hasDebug)

    Write-Host ""
    Write-Host "  PASS: $($script:pass)  FAIL: $($script:fail)"
    if ($script:fail -eq 0) { Write-Host "  PathTrace module is correctly installed" -ForegroundColor Green }
    else { Write-Host "  PathTrace module is not installed or has issues" -ForegroundColor Red }
    exit $(if($script:fail -eq 0){0}else{1})
}

# ====== Uninstall mode ======
if ($Uninstall) {
    Write-Host "--- Uninstall PathTrace Module ---" -ForegroundColor Yellow
    Write-Host ""

    $targetDir = if ($Scope -eq "AllUsers") {
        Join-Path $env:ProgramFiles "WindowsPowerShell\Modules\PathTrace"
    } else {
        Join-Path $HOME "Documents\WindowsPowerShell\Modules\PathTrace"
    }

    if (Test-Path $targetDir) {
        Remove-Item $targetDir -Recurse -Force -ErrorAction SilentlyContinue
        Check "Deleted $targetDir" (-not (Test-Path $targetDir))
    } else {
        Write-Host "  Target directory does not exist, nothing to uninstall" -ForegroundColor DarkGray
        Check "Uninstall complete" $true
    }

    $mod = Get-Module -ListAvailable -Name PathTrace
    Check "Get-Module no longer finds PathTrace" ($null -eq $mod)

    Write-Host ""
    Write-Host "  PASS: $($script:pass)  FAIL: $($script:fail)"
    if ($script:fail -eq 0) { Write-Host "  PathTrace module has been uninstalled" -ForegroundColor Green }
    exit 0
}

# ====== Deploy mode ======
Write-Host "--- 1. Check Source Files ---" -ForegroundColor Yellow
Write-Host "  Source: $ScriptDir"
Check "PathTrace.psm1 exists" (Test-Path $srcPsm1)
Check "PathTrace.psd1 exists" (Test-Path $srcPsd1)

if (-not (Test-Path $srcPsm1)) {
    Write-Host ""
    Write-Host "Source file missing, cannot deploy" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "--- 2. Determine Target Directory ---" -ForegroundColor Yellow
if ($Scope -eq "AllUsers") {
    $targetDir = Join-Path $env:ProgramFiles "WindowsPowerShell\Modules\PathTrace"
    Write-Host "  Scope: AllUsers (Machine-level)"
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "  WARNING: AllUsers deployment requires admin privileges" -ForegroundColor Yellow
        Write-Host "  Tip: Run PowerShell as Administrator, or use default CurrentUser scope" -ForegroundColor Yellow
    }
} else {
    $targetDir = Join-Path $HOME "Documents\WindowsPowerShell\Modules\PathTrace"
    Write-Host "  Scope: CurrentUser (User-level)"
}
Write-Host "  Target: $targetDir"

Write-Host ""
Write-Host "--- 3. Create Target Directory ---" -ForegroundColor Yellow
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}
Check "Target directory created" (Test-Path $targetDir)

Write-Host ""
Write-Host "--- 4. Copy Module Files ---" -ForegroundColor Yellow
Copy-Item $srcPsm1 -Destination $targetDir -Force
if (Test-Path $srcPsd1) {
    Copy-Item $srcPsd1 -Destination $targetDir -Force
    Check "PathTrace.psd1 copied" (Test-Path (Join-Path $targetDir "PathTrace.psd1"))
}
Check "PathTrace.psm1 copied" (Test-Path (Join-Path $targetDir "PathTrace.psm1"))

Write-Host ""
Write-Host "--- 5. Registration Check ---" -ForegroundColor Yellow
$mod = Get-Module -ListAvailable -Name PathTrace
Check "Get-Module -ListAvailable can find it" ($null -ne $mod)
if ($mod) {
    Write-Host "       Name: $($mod.Name)  Version: $($mod.Version)"
    Write-Host "       Path: $($mod.Path)"
}

Write-Host ""
Write-Host "--- 6. Import Test ---" -ForegroundColor Yellow
Remove-Module PathTrace -ErrorAction SilentlyContinue
try {
    Import-Module PathTrace -Force -ErrorAction Stop
    Check "Import-Module succeeded" $true
} catch {
    Check "Import-Module succeeded" $false
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

$hasFunc = Get-Command Write-PathTrace -ErrorAction SilentlyContinue
Check "Write-PathTrace available" ($null -ne $hasFunc)

$hasFind = Get-Command Find-PythonExe -ErrorAction SilentlyContinue
Check "Find-PythonExe available" ($null -ne $hasFind)

$hasDebug = Get-Command Enable-PathTraceDebug -ErrorAction SilentlyContinue
Check "Enable-PathTraceDebug available" ($null -ne $hasDebug)

Write-Host ""
Write-Host "--- 7. Functional Test ---" -ForegroundColor Yellow
$py = Find-PythonExe -RepoRoot (Split-Path -Parent $ScriptDir)
Check "Find-PythonExe returns valid path" ($py -match "python\.exe")
if ($py) { Write-Host "       Python: $py" }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  PASS: $($script:pass)  FAIL: $($script:fail)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
if ($script:fail -eq 0) {
    Write-Host ""
    Write-Host "  PathTrace module deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Usage:"
    Write-Host "    Import-Module PathTrace"
    Write-Host "    \$py = Find-PythonExe -RepoRoot 'D:\FinSightV9'"
    Write-Host ""
    Write-Host "  Verify:"
    Write-Host "    .\scripts\deploy-pathtrace-module.ps1 -Verify"
    Write-Host ""
    Write-Host "  Uninstall:"
    Write-Host "    .\scripts\deploy-pathtrace-module.ps1 -Uninstall"
} else {
    Write-Host ""
    Write-Host "  Deployment failed, check errors above" -ForegroundColor Red
}
exit $(if($script:fail -eq 0){0}else{1})
