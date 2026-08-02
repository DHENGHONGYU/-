param(
    [int]$IntervalMinutes = 5,
    [string]$RepoPath = 'L:\FinSightV9',
    [string]$Branch = 'feat/cross-index-20260719',
    [string]$Tag = 'v2.6.0',
    [int]$CheckIntervalSeconds = 10,
    [int]$MaxRetries = 0,
    [int]$PushRetries = 3,
    [int]$PushRetryDelaySeconds = 2,
    [switch]$RunOnce,
    [switch]$InstallScheduledTask,
    [string]$TaskName = 'FinSightV9-GitAutoPush'
)

$modulePath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'GitAutoPush.psm1'
Import-Module $modulePath -Force

$logFile = Join-Path $RepoPath '.workbuddy\git-auto-push-scheduler.log'
$schedulerLog = Join-Path $RepoPath '.workbuddy\git-auto-push.log'

if ($InstallScheduledTask) {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -RunOnce"
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date)
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force
    Write-Host "Scheduled task '$TaskName' registered successfully. It will run once immediately."
    Write-Host "To create a recurring task every $IntervalMinutes minutes, use the Windows Task Scheduler GUI or:"
    Write-Host "  schtasks /create /tn `"$TaskName`" /tr `"powershell -File `"$PSCommandPath`" -RunOnce`" /sc minute /mo $IntervalMinutes /f"
    exit 0
}

Write-Host "===== Git Auto-Push Scheduler Started ====="
Write-Host "Repo: $RepoPath"
Write-Host "Branch: $Branch"
if ($Tag) { Write-Host "Tag: $Tag" }
Write-Host "Interval: ${IntervalMinutes}min"
Write-Host "Log: $schedulerLog"
Write-Host ''

if ($RunOnce) {
    Write-Host 'Running once...'
    $exitCode = Invoke-AutoPush `
        -RepoPath $RepoPath `
        -Branch $Branch `
        -Tag $Tag `
        -CheckIntervalSeconds $CheckIntervalSeconds `
        -MaxRetries $MaxRetries `
        -PushRetries $PushRetries `
        -PushRetryDelaySeconds $PushRetryDelaySeconds `
        -LogFile $schedulerLog
    Write-Host "Exit code: $exitCode"
    exit $exitCode
}

$intervalSeconds = $IntervalMinutes * 60
$runCount = 0

while ($true) {
    $runCount++
    $now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$now] === Scheduler iteration #$runCount ==="

    $pending = Get-PendingCommits -RepoPath $RepoPath -Branch $Branch
    $hasWork = ($pending -and $pending.Count -gt 0)

    if ($Tag) {
        $needsTagPush = Test-TagNeedsPush -RepoPath $RepoPath -Tag $Tag
        if ($needsTagPush) { $hasWork = $true }
    }

    if (-not $hasWork) {
        Write-Host "[$now] Nothing pending, skipping push attempt."
        Write-Host "[$now] Next check in ${IntervalMinutes}min..."
        Start-Sleep -Seconds $intervalSeconds
        continue
    }

    Write-Host "[$now] Pending work found, checking network..."
    $connected = Test-GitNetwork
    if ($connected) {
        Write-Host "[$now] Network is available, invoking push..."
        $exitCode = Invoke-AutoPush `
            -RepoPath $RepoPath `
            -Branch $Branch `
            -Tag $Tag `
            -CheckIntervalSeconds $CheckIntervalSeconds `
            -MaxRetries $MaxRetries `
            -PushRetries $PushRetries `
            -PushRetryDelaySeconds $PushRetryDelaySeconds `
            -LogFile $schedulerLog
        Write-Host "[$now] Push completed with exit code: $exitCode"
    }
    else {
        Write-Host "[$now] Network unavailable, will retry in ${IntervalMinutes}min..."
    }

    Write-Host "[$now] Next check in ${IntervalMinutes}min..."
    Start-Sleep -Seconds $intervalSeconds
}
