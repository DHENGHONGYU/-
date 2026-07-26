param(
    [int]$CheckInterval = 10,
    [int]$MaxRetries = 0,
    [string]$RepoPath = 'L:\FinSightV9',
    [string]$Branch = 'feat/cross-index-20260719',
    [string]$Tag = 'v2.6.0'
)

$ErrorActionPreference = 'Continue'
$logFile = Join-Path $RepoPath '.workbuddy\push-auto.log'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = '[' + $ts + '] [' + $Level + '] ' + $Message
    Write-Host $line
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

Write-Log '===== Git auto-push script started ====='
Write-Log "Repo: $RepoPath"
Write-Log "Branch: $Branch"
Write-Log "Tag: $Tag"
Write-Log "Interval: ${CheckInterval}s"
Write-Log ''

Set-Location $RepoPath

Write-Log 'Current local state:'
git log --oneline -3 2>&1 | ForEach-Object { Write-Log "  $_" }

Write-Log ''
Write-Log 'Checking pending commits...'
$pending = git log "origin/$Branch..HEAD" --oneline 2>&1
if ($LASTEXITCODE -eq 0 -and $pending) {
    Write-Log 'Pending commits:'
    $pending | ForEach-Object { Write-Log "  $_" }
} else {
    Write-Log 'No pending commits'
}

Write-Log ''
Write-Log "Checking tag $Tag..."
$localTag = git rev-parse "$Tag" 2>&1
if ($LASTEXITCODE -eq 0) {
    $remoteTag = git rev-parse "origin/$Tag" 2>&1
    if ($LASTEXITCODE -eq 0) {
        if ($localTag.Trim() -eq $remoteTag.Trim()) {
            Write-Log "Tag $Tag already on remote, skip"
            $tagNeedsPush = $false
        } else {
            Write-Log "Tag $Tag differs, need push"
            $tagNeedsPush = $true
        }
    } else {
        Write-Log "Tag $Tag not on remote, need push"
        $tagNeedsPush = $true
    }
} else {
    Write-Log "No local tag $Tag"
    $tagNeedsPush = $false
}

Write-Log ''
Write-Log '===== Network check ====='

$attempt = 0
$networkReady = $false

while ($true) {
    $attempt++
    if ($MaxRetries -gt 0 -and $attempt -gt $MaxRetries) {
        Write-Log "Max retries ($MaxRetries) reached, exit" 'ERROR'
        exit 1
    }

    Write-Log "[Check $attempt] Testing github.com:443..."
    try {
        $result = Test-NetConnection -ComputerName 'github.com' -Port 443 -WarningAction SilentlyContinue
        if ($result.TcpTestSucceeded) {
            Write-Log 'Network is back!'
            $networkReady = $true
            break
        }
        Write-Log 'Network unreachable, retry in ' + $CheckInterval + 's...'
    }
    catch {
        Write-Log "Network check error: $_" 'WARN'
    }

    Start-Sleep -Seconds $CheckInterval
}

if (-not $networkReady) {
    Write-Log 'Network never recovered, exit' 'ERROR'
    exit 1
}

Write-Log ''
Write-Log '===== Pushing ====='

$branchOk = $false
for ($i = 0; $i -lt 3; $i++) {
    Write-Log "Push branch (attempt $($i+1)/3)..."
    $output = git push --no-verify origin $Branch 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Branch pushed: $output"
        $branchOk = $true
        break
    }
    if ($i -lt 2) {
        Write-Log 'Push failed, retry in 2s...' 'WARN'
        Start-Sleep -Seconds 2
    } else {
        Write-Log 'Branch push ultimately failed' 'ERROR'
    }
}

$tagOk = $true
if ($tagNeedsPush) {
    $tagOk = $false
    for ($i = 0; $i -lt 3; $i++) {
        Write-Log "Push tag $Tag (attempt $($i+1)/3)..."
        $output = git push --no-verify origin $Tag 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Tag pushed: $output"
            $tagOk = $true
            break
        }
        if ($i -lt 2) {
            Write-Log 'Tag push failed, retry in 2s...' 'WARN'
            Start-Sleep -Seconds 2
        } else {
            Write-Log 'Tag push ultimately failed' 'ERROR'
        }
    }
}

Write-Log ''
Write-Log '===== Final verification ====='

Write-Log 'Local HEAD: ' + (git rev-parse --short HEAD)
Write-Log 'Remote HEAD: ' + (git rev-parse --short "origin/$Branch")

$aheadBehind = git rev-list --left-right --count "origin/$Branch...HEAD" 2>&1
if ($LASTEXITCODE -eq 0) {
    $parts = $aheadBehind.Trim() -split '\s+'
    $behind = $parts[0]
    $ahead = $parts[1]
    if ($ahead -eq '0' -and $behind -eq '0') {
        Write-Log 'Fully synced: local == remote'
    } elseif ($ahead -gt 0) {
        Write-Log "Local ahead by $ahead commits" 'WARN'
    } elseif ($behind -gt 0) {
        Write-Log "Remote ahead by $behind commits" 'WARN'
    }
}

if ($tagNeedsPush -and $tagOk) {
    $tagLocal = git rev-parse "$Tag" 2>&1
    $tagRemote = git rev-parse "origin/$Tag" 2>&1
    if ($tagLocal -and $tagRemote -and $tagLocal.Trim() -eq $tagRemote.Trim()) {
        Write-Log "Tag $Tag synced"
    } else {
        Write-Log "Tag $Tag not synced" 'WARN'
    }
}

if ($branchOk -and $tagOk) {
    Write-Log 'All done! Remote and local fully synced.'
    exit 0
} else {
    Write-Log 'Push completed but verification failed, check manually' 'WARN'
    exit 2
}
