<#
.SYNOPSIS
  GitAutoPush - Reusable PowerShell module for post-network-recovery git operations
.DESCRIPTION
  Provides reusable functions for:
  - Testing network connectivity to GitHub
  - Detecting pending commits and tags
  - Auto-pushing branches and tags with retry logic
  - Verifying remote sync state
.USAGE
  Import-Module .\GitAutoPush.psm1
  Test-GitNetwork -HostName 'github.com' -Port 443
  Get-PendingCommits -RepoPath 'C:\MyRepo' -Branch 'main'
  Invoke-AutoPush -RepoPath 'C:\MyRepo' -Branch 'main' -Tag 'v1.0.0'
.NOTES
  Compatible with Windows PowerShell 5.1+ and PowerShell Core 7+
#>

[CmdletBinding()]
param()

function Write-GitLog {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR', 'SUCCESS')]
        [string]$Level = 'INFO',
        [string]$LogFile
    )
    if ([string]::IsNullOrEmpty($Message)) {
        $line = ''
    }
    else {
        $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        $line = "[$ts] [$Level] $Message"
    }
    Write-Host $line
    if ($LogFile) {
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    }
}

function Test-GitNetwork {
    param(
        [string]$HostName = 'github.com',
        [int]$Port = 443,
        [int]$TimeoutSeconds = 5
    )
    $connected = $false
    try {
        $result = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue
        $connected = $result.TcpTestSucceeded
    }
    catch {
        $connected = $false
    }
    return $connected
}

function Get-PendingCommits {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoPath,
        [Parameter(Mandatory = $true)]
        [string]$Branch,
        [string]$LogFile
    )
    Set-Location $RepoPath
    $result = @()
    try {
        $ahead = git log "origin/$Branch..HEAD" --oneline 2>&1
        if ($LASTEXITCODE -eq 0 -and $ahead) {
            $result = @($ahead)
            Write-GitLog "Pending commits ($($result.Count)):" 'INFO' $LogFile
            $result | ForEach-Object { Write-GitLog "  $_" 'INFO' $LogFile }
        }
        else {
            Write-GitLog 'No pending commits' 'INFO' $LogFile
        }
    }
    catch {
        Write-GitLog "Error checking pending commits: $_" 'ERROR' $LogFile
    }
    return $result
}

function Test-TagNeedsPush {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoPath,
        [Parameter(Mandatory = $true)]
        [string]$Tag,
        [string]$LogFile
    )
    Set-Location $RepoPath
    $needsPush = $false
    try {
        $localTag = git rev-parse "$Tag" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-GitLog "No local tag $Tag" 'INFO' $LogFile
            $needsPush = $false
        }
        else {
            $remoteTag = git rev-parse "origin/$Tag" 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-GitLog "Tag $Tag not on remote, need push" 'INFO' $LogFile
                $needsPush = $true
            }
            elseif ($localTag.Trim() -ne $remoteTag.Trim()) {
                Write-GitLog "Tag $Tag differs, need push" 'INFO' $LogFile
                $needsPush = $true
            }
            else {
                Write-GitLog "Tag $Tag already synced" 'INFO' $LogFile
                $needsPush = $false
            }
        }
    }
    catch {
        Write-GitLog "Error checking tag: $_" 'ERROR' $LogFile
    }
    return $needsPush
}

function Push-BranchWithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoPath,
        [Parameter(Mandatory = $true)]
        [string]$Branch,
        [int]$Retries = 3,
        [int]$RetryDelaySeconds = 2,
        [string]$LogFile
    )
    Set-Location $RepoPath
    $success = $false
    for ($i = 0; $i -lt $Retries; $i++) {
        Write-GitLog "Pushing branch (attempt $($i + 1)/$Retries)..." 'INFO' $LogFile
        $output = git push --no-verify origin $Branch 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-GitLog "Branch pushed: $output" 'SUCCESS' $LogFile
            $success = $true
            break
        }
        if ($i -lt $Retries - 1) {
            Write-GitLog "Push failed, retry in ${RetryDelaySeconds}s..." 'WARN' $LogFile
            Start-Sleep -Seconds $RetryDelaySeconds
        }
        else {
            Write-GitLog "Branch push ultimately failed" 'ERROR' $LogFile
        }
    }
    return $success
}

function Push-TagWithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoPath,
        [Parameter(Mandatory = $true)]
        [string]$Tag,
        [int]$Retries = 3,
        [int]$RetryDelaySeconds = 2,
        [string]$LogFile
    )
    Set-Location $RepoPath
    $success = $false
    for ($i = 0; $i -lt $Retries; $i++) {
        Write-GitLog "Pushing tag $Tag (attempt $($i + 1)/$Retries)..." 'INFO' $LogFile
        $output = git push --no-verify origin $Tag 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-GitLog "Tag pushed: $output" 'SUCCESS' $LogFile
            $success = $true
            break
        }
        if ($i -lt $Retries - 1) {
            Write-GitLog "Tag push failed, retry in ${RetryDelaySeconds}s..." 'WARN' $LogFile
            Start-Sleep -Seconds $RetryDelaySeconds
        }
        else {
            Write-GitLog "Tag push ultimately failed" 'ERROR' $LogFile
        }
    }
    return $success
}

function Test-RemoteSync {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoPath,
        [Parameter(Mandatory = $true)]
        [string]$Branch,
        [string]$Tag,
        [string]$LogFile
    )
    Set-Location $RepoPath
    $synced = $true
    Write-GitLog '===== Final Verification =====' 'INFO' $LogFile

    $localHead = git rev-parse --short HEAD
    $remoteHead = git rev-parse --short "origin/$Branch" 2>&1
    Write-GitLog "Local HEAD: $localHead" 'INFO' $LogFile
    Write-GitLog "Remote HEAD: $remoteHead" 'INFO' $LogFile

    $aheadBehind = git rev-list --left-right --count "origin/$Branch...HEAD" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $parts = $aheadBehind.Trim() -split '\s+'
        $behind = $parts[0]
        $ahead = $parts[1]
        if ($ahead -eq '0' -and $behind -eq '0') {
            Write-GitLog 'Fully synced: local == remote' 'SUCCESS' $LogFile
        }
        elseif ($ahead -gt 0) {
            Write-GitLog "Local ahead by $ahead commits" 'WARN' $LogFile
            $synced = $false
        }
        elseif ($behind -gt 0) {
            Write-GitLog "Remote ahead by $behind commits" 'WARN' $LogFile
        }
    }

    if ($Tag) {
        $tagLocal = git rev-parse "$Tag" 2>&1
        $tagRemote = git rev-parse "origin/$Tag" 2>&1
        if ($tagLocal -and $tagRemote -and $tagLocal.Trim() -eq $tagRemote.Trim()) {
            Write-GitLog "Tag $Tag synced" 'SUCCESS' $LogFile
        }
        else {
            Write-GitLog "Tag $Tag not synced" 'WARN' $LogFile
            $synced = $false
        }
    }
    return $synced
}

function Invoke-AutoPush {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoPath,
        [Parameter(Mandatory = $true)]
        [string]$Branch,
        [string]$Tag,
        [int]$CheckIntervalSeconds = 10,
        [int]$MaxRetries = 0,
        [int]$PushRetries = 3,
        [int]$PushRetryDelaySeconds = 2,
        [string]$LogFile
    )

    $ErrorActionPreference = 'Continue'
    if (-not $LogFile) {
        $LogFile = Join-Path $RepoPath '.workbuddy\git-auto-push.log'
    }

    Write-GitLog '===== Git Auto-Push Started =====' 'INFO' $LogFile
    Write-GitLog "Repo: $RepoPath" 'INFO' $LogFile
    Write-GitLog "Branch: $Branch" 'INFO' $LogFile
    if ($Tag) { Write-GitLog "Tag: $Tag" 'INFO' $LogFile }
    Write-GitLog "Network check interval: ${CheckIntervalSeconds}s" 'INFO' $LogFile

    Set-Location $RepoPath
    Write-GitLog 'Current local state:' 'INFO' $LogFile
    git log --oneline -3 2>&1 | ForEach-Object { Write-GitLog "  $_" 'INFO' $LogFile }
    Write-GitLog '' 'INFO' $LogFile

    $pending = Get-PendingCommits -RepoPath $RepoPath -Branch $Branch -LogFile $LogFile
    $tagNeedsPush = $false
    if ($Tag) {
        $tagNeedsPush = Test-TagNeedsPush -RepoPath $RepoPath -Tag $Tag -LogFile $LogFile
    }

    if (-not $pending -and -not $tagNeedsPush) {
        Write-GitLog 'Nothing to push. Already synced.' 'SUCCESS' $LogFile
        return 0
    }

    Write-GitLog '' 'INFO' $LogFile
    Write-GitLog '===== Network Check =====' 'INFO' $LogFile

    $attempt = 0
    $networkReady = $false

    while ($true) {
        $attempt++
        if ($MaxRetries -gt 0 -and $attempt -gt $MaxRetries) {
            Write-GitLog "Max retries ($MaxRetries) reached, exit" 'ERROR' $LogFile
            return 1
        }

        Write-GitLog "[Check $attempt] Testing github.com:443..." 'INFO' $LogFile
        $connected = Test-GitNetwork

        if ($connected) {
            Write-GitLog 'Network is back!' 'SUCCESS' $LogFile
            $networkReady = $true
            break
        }
        else {
            Write-GitLog "Network unreachable, retry in ${CheckIntervalSeconds}s..." 'WARN' $LogFile
        }
        Start-Sleep -Seconds $CheckIntervalSeconds
    }

    if (-not $networkReady) {
        Write-GitLog 'Network never recovered, exit' 'ERROR' $LogFile
        return 1
    }

    Write-GitLog '' 'INFO' $LogFile
    Write-GitLog '===== Pushing =====' 'INFO' $LogFile

    $branchOk = Push-BranchWithRetry -RepoPath $RepoPath -Branch $Branch -Retries $PushRetries -RetryDelaySeconds $PushRetryDelaySeconds -LogFile $LogFile

    $tagOk = $true
    if ($tagNeedsPush) {
        $tagOk = Push-TagWithRetry -RepoPath $RepoPath -Tag $Tag -Retries $PushRetries -RetryDelaySeconds $PushRetryDelaySeconds -LogFile $LogFile
    }

    $synced = Test-RemoteSync -RepoPath $RepoPath -Branch $Branch -Tag $Tag -LogFile $LogFile

    if ($synced -and $branchOk -and $tagOk) {
        Write-GitLog 'All done! Remote and local fully synced.' 'SUCCESS' $LogFile
        return 0
    }
    else {
        Write-GitLog 'Push completed but verification failed, check manually' 'WARN' $LogFile
        return 2
    }
}

Export-ModuleMember -Function @(
    'Write-GitLog',
    'Test-GitNetwork',
    'Get-PendingCommits',
    'Test-TagNeedsPush',
    'Push-BranchWithRetry',
    'Push-TagWithRetry',
    'Test-RemoteSync',
    'Invoke-AutoPush'
)
