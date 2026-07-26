<#
.SYNOPSIS
  网络恢复后自动推送 Git 变更并验证远程状态
.DESCRIPTION
  持续检测 GitHub 443 端口连通性，网络恢复后自动执行：
  1. git push origin feat/cross-index-20260719
  2. git push origin v2.6.0（如有需要）
  3. 验证远程与本地同步状态
.PARAMETER CheckInterval
  网络检测间隔（秒），默认 10 秒
.PARAMETER MaxRetries
  最大重试次数，0 表示无限重试，默认 0
.PARAMETER RepoPath
  仓库路径，默认 L:\FinSightV9
.EXAMPLE
  .\auto-push-on-network.ps1
  .\auto-push-on-network.ps1 -CheckInterval 30 -MaxRetries 5
#>

param(
    [int]$CheckInterval = 10,
    [int]$MaxRetries = 0,
    [string]$RepoPath = "L:\FinSightV9",
    [string]$Branch = "feat/cross-index-20260719",
    [string]$Tag = "v2.6.0"
)

$ErrorActionPreference = "Continue"
$logFile = Join-Path $RepoPath ".workbuddy\push-auto.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

function Test-Network {
    param([int]$TimeoutMs = 5000)
    try {
        $result = Test-NetConnection -ComputerName "github.com" -Port 443 -WarningAction SilentlyContinue -InformationLevel Quiet -TimeoutMs $TimeoutMs
        return $result.TcpTestSucceeded
    }
    catch {
        return $false
    }
}

function Get-PendingCommits {
    param([string]$Repo, [string]$BranchName)
    Push-Location $Repo
    try {
        $ahead = git log "origin/$BranchName..HEAD" --oneline 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $ahead
        }
        return @()
    }
    catch {
        return @()
    }
    finally {
        Pop-Location
    }
}

function Get-TagNeedsPush {
    param([string]$Repo, [string]$TagName)
    Push-Location $Repo
    try {
        $localTag = git rev-parse "$TagName" 2>&1
        if ($LASTEXITCODE -ne 0) { return $false }
        $remoteTag = git rev-parse "origin/$TagName" 2>&1
        if ($LASTEXITCODE -ne 0) { return $true }
        return $localTag.Trim() -ne $remoteTag.Trim()
    }
    catch {
        return $false
    }
    finally {
        Pop-Location
    }
}

function Push-WithRetry {
    param([string]$Repo, [string]$BranchName, [int]$Retries = 2)
    Push-Location $Repo
    for ($i = 0; $i -lt $Retries; $i++) {
        Write-Log "执行 git push origin $BranchName (尝试 $($i+1)/$Retries)..."
        $output = & git push --no-verify origin $BranchName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ 推送成功: $output"
            return $true
        }
        if ($i -lt $Retries - 1) {
            Write-Log "推送失败，2 秒后重试..." "WARN"
            Start-Sleep -Seconds 2
        }
        else {
            Write-Log "❌ 推送失败: $output" "ERROR"
            return $false
        }
    }
    Pop-Location
}

function Push-Tag-WithRetry {
    param([string]$Repo, [string]$TagName, [int]$Retries = 2)
    Push-Location $Repo
    for ($i = 0; $i -lt $Retries; $i++) {
        Write-Log "执行 git push origin $TagName (尝试 $($i+1)/$Retries)..."
        $output = & git push --no-verify origin $TagName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ Tag 推送成功: $output"
            return $true
        }
        if ($i -lt $Retries - 1) {
            Write-Log "Tag 推送失败，2 秒后重试..." "WARN"
            Start-Sleep -Seconds 2
        }
        else {
            Write-Log "❌ Tag 推送失败: $output" "ERROR"
            return $false
        }
    }
    Pop-Location
}

function Verify-RemoteSync {
    param([string]$Repo, [string]$BranchName)
    Push-Location $Repo
    Write-Log "===== 远程同步验证 ====="
    Write-Log "本地 HEAD: $(git rev-parse --short HEAD)"
    Write-Log "远程 HEAD (origin/$BranchName): $(git rev-parse --short "origin/$BranchName")"

    $aheadBehind = git rev-list --left-right --count "origin/$BranchName...HEAD" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $parts = $aheadBehind.Trim() -split '\s+'
        $behind = $parts[0]
        $ahead = $parts[1]
        if ($ahead -eq "0" -and $behind -eq "0") {
            Write-Log "✅ 完全同步: local == remote"
        }
        elseif ($ahead -gt 0) {
            Write-Log "⚠️ 本地领先远程 $ahead 个 commit" "WARN"
            return $false
        }
        elseif ($behind -gt 0) {
            Write-Log "⚠️ 远程领先本地 $behind 个 commit" "WARN"
        }
    }

    $tagLocal = git rev-parse "$Tag" 2>&1
    $tagRemote = git rev-parse "origin/$Tag" 2>&1
    if ($tagLocal -and $tagRemote -and $tagLocal.Trim() -eq $tagRemote.Trim()) {
        Write-Log "✅ Tag $Tag 已同步"
    }
    else {
        Write-Log "⚠️ Tag $Tag 未同步" "WARN"
        return $false
    }
    Pop-Location
    return $true
}

Write-Log "===== Git 自动推送脚本启动 ====="
Write-Log "仓库路径: $RepoPath"
Write-Log "目标分支: $Branch"
Write-Log "目标 Tag: $Tag"
Write-Log "检测间隔: ${CheckInterval}s"
Write-Log ""

Push-Location $RepoPath
Write-Log "当前本地状态:"
git log --oneline -3 | ForEach-Object { Write-Log "  $_" }
Write-Log ""

$pendingCommits = Get-PendingCommits -Repo $RepoPath -BranchName $Branch
if ($pendingCommits) {
    Write-Log "待推送 commit 列表:"
    $pendingCommits | ForEach-Object { Write-Log "  $_" }
}
else {
    Write-Log "无待推送 commit"
}

$tagNeedsPush = Get-TagNeedsPush -Repo $RepoPath -TagName $Tag
Write-Log "Tag $Tag 需推送: $tagNeedsPush"
Pop-Location

$attempt = 0
$networkReady = $false

while ($true) {
    $attempt++
    if ($MaxRetries -gt 0 -and $attempt -gt $MaxRetries) {
        Write-Log "已达到最大重试次数 ($MaxRetries)，退出" "ERROR"
        break
    }

    Write-Log "[检测 $attempt] 测试 github.com:443 连通性..."
    $connected = Test-Network

    if ($connected) {
        Write-Log "✅ 网络已恢复！"
        $networkReady = $true
        break
    }
    else {
        Write-Log "❌ 网络不可达，${CheckInterval}s 后重试..."
        Start-Sleep -Seconds $CheckInterval
    }
}

if (-not $networkReady) {
    Write-Log "网络始终未能恢复，脚本退出" "ERROR"
    exit 1
}

Push-Location $RepoPath
Write-Log "===== 开始推送 ====="
$branchOk = $true
if (-not (Push-WithRetry -Repo $RepoPath -BranchName $Branch -Retries 3)) {
    $branchOk = $false
}

if ($tagNeedsPush) {
    Push-Tag-WithRetry -Repo $RepoPath -TagName $Tag -Retries 3 | Out-Null
}
Pop-Location

Write-Log ""
Write-Log "===== 最终验证 ====="
$synced = Verify-RemoteSync -Repo $RepoPath -BranchName $Branch

if ($synced -and $branchOk) {
    Write-Log "✅✅✅ 全部完成！远程与本地完全同步。"
    exit 0
}
else {
    Write-Log "⚠️ 推送完成但验证未通过，请手动检查" "WARN"
    exit 2
}
