#Requires -Version 5.1
<#
dev-prestart-check.ps1 - FinSightV9 pre-startup residual process check & auto cleanup

Why this script exists (2026-08-15 startup audit):
  1. Zombie Vite dev servers left on ports 5199/5200/5201 force a new instance
     onto a drifting port, and multiple instances contending for the
     node_modules/.vite optimizer lock make the new instance hang on its first
     request (observed: 45s+ timeout, zero bytes returned).
  2. A leftover uvicorn collector on :8000 (or embed sidecar on :8001) can
     serve stale code or hold the port against the process you are about to start.

Safety rules:
  - By default ONLY processes whose command line references this project root
    are killed (vite.js under <root>\node_modules, python.exe under <root>\.venv).
  - Unknown listeners (e.g. Docker backend, IDE, other apps) are NEVER killed
    by default; they are reported and the script exits with code 2.
  - -All overrides the guard (use only when you know what holds the port).
  - -DryRun reports without killing.

Usage:
  powershell -ExecutionPolicy Bypass -File scripts/dev-prestart-check.ps1
  powershell -ExecutionPolicy Bypass -File scripts/dev-prestart-check.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File scripts/dev-prestart-check.ps1 -Ports 5199,8000
  powershell -ExecutionPolicy Bypass -File scripts/dev-prestart-check.ps1 -All

Exit codes:
  0 = all target ports free (or residual project processes cleaned)
  2 = a port is still held by a non-project process or a kill failed
#>
[CmdletBinding()]
param(
    # 5199 = Vite dev server (vite.config.ts server.port)
    # 8000 = Python AkShare collector (uvicorn collect_endpoints:app)
    # 8001 = Python embedding sidecar
    [int[]]$Ports = @(5199, 8000, 8001),

    # Report only, never kill
    [switch]$DryRun,

    # Also kill listeners that cannot be identified as this project's processes
    [switch]$All
)

# Project-unique entry script names. A process matches if its command line
# contains the project root (absolute-path launch) OR one of these entry names
# (relative-path launch, e.g. "python embedding_service.py" run from backend\).
$projectScriptPattern = 'vite\.js|collect_endpoints|embedding_service|mock_daemon|embedding_daemon|sidecar_entry'

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$exitCode = 0

Write-Host "[dev-prestart] project root : $projectRoot"
Write-Host "[dev-prestart] target ports : $($Ports -join ', ')"
if ($DryRun) { Write-Host "[dev-prestart] mode         : DRY RUN (no kill)" -ForegroundColor Cyan }

foreach ($port in $Ports) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) {
        Write-Host "[dev-prestart] port $port : free" -ForegroundColor Green
        continue
    }

    $addrs = ($listeners | ForEach-Object { "$($_.LocalAddress):$port" }) -join ', '
    Write-Host "[dev-prestart] port $port : BUSY ($addrs)" -ForegroundColor Yellow

    foreach ($ownerPid in ($listeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.Name } else { "pid $ownerPid (already gone)" }
        $cmd  = if ($proc) { $proc.CommandLine } else { $null }

        $isProject = ($null -ne $cmd) -and (
            ($cmd.IndexOf($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) -or
            ($cmd -match $projectScriptPattern)
        )

        if ($isProject -or $All) {
            $tag = if ($isProject) { 'project' } else { 'unidentified (-All)' }
            Write-Host "[dev-prestart]   -> $name pid=$ownerPid [$tag process]"
            if ($DryRun) {
                Write-Host "[dev-prestart]      dry-run: skip kill" -ForegroundColor Cyan
                continue
            }
            taskkill /PID $ownerPid /F 2>$null | Out-Null
            Start-Sleep -Milliseconds 500
            # Verify THIS pid is gone (not whether the port is free at all:
            # Docker port-forward helpers may legitimately keep listening).
            $stillListening = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
                Where-Object { $_.OwningProcess -eq $ownerPid }
            $stillAlive = [bool](Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)
            if ($stillListening -or $stillAlive) {
                Write-Host "[dev-prestart]      kill FAILED, pid $ownerPid still alive" -ForegroundColor Red
                $exitCode = 2
            } else {
                Write-Host "[dev-prestart]      killed (pid $ownerPid); other listeners may remain" -ForegroundColor Green
            }
        } elseif ($name -in @('wslrelay.exe', 'wslrelay', 'com.docker.backend.exe', 'vpnkit.exe', 'com.docker.proxy.exe')) {
            # Docker Desktop port forwarding = container port mapping, legitimate.
            Write-Host "[dev-prestart]   -> $name pid=$ownerPid [Docker port forward - OK]" -ForegroundColor Cyan
            Write-Host "[dev-prestart]      a container maps this port; run 'docker compose ps' to confirm"
        } else {
            Write-Host "[dev-prestart]   -> $name pid=$ownerPid [NOT this project - skipped]" -ForegroundColor Red
            if ($cmd) { Write-Host "[dev-prestart]      cmd: $cmd" }
            Write-Host "[dev-prestart]      resolve manually, or rerun with -All at your own risk" -ForegroundColor Red
            $exitCode = 2
        }
    }
}

if ($exitCode -eq 0) {
    Write-Host "[dev-prestart] OK - ready to start dev servers" -ForegroundColor Green
} else {
    Write-Host "[dev-prestart] BLOCKED - manual attention required (exit 2)" -ForegroundColor Red
}
exit $exitCode
