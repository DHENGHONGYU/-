#Requires -Version 5.1
<#
.SYNOPSIS
    带 RPC 超时/连接重置自动重试的 git push 脚本。

.DESCRIPTION
    针对国内网络推送到 GitHub 时常见的 curl 55、RPC failed、
    "the remote end hung up unexpectedly" 等错误进行自动重试。
    支持指数退避，最大重试次数可配置。

.PARAMETER Branch
    要推送的分支名。默认为当前 git 分支。

.PARAMETER Remote
    远程仓库名。默认为 origin。

.PARAMETER MaxRetries
    最大重试次数（含第一次）。默认为 5。

.PARAMETER BaseDelaySeconds
    初始退避秒数。默认为 5，每次失败后翻倍。

.PARAMETER HttpBufferSize
    git http.postBuffer 大小（字节）。默认为 524288000（500 MB）。
    大仓库推送时可减少 "RPC failed" 概率。

.EXAMPLE
    .\scripts\git-push-with-retry.ps1
    .\scripts\git-push-with-retry.ps1 -Branch fix/phase1-hemostasis -MaxRetries 10
#>
[CmdletBinding()]
param(
    [string]$Branch = "",
    [string]$Remote = "origin",
    [int]$MaxRetries = 5,
    [int]$BaseDelaySeconds = 5,
    [long]$HttpBufferSize = 524288000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 获取当前分支（若未指定）
if ([string]::IsNullOrWhiteSpace($Branch)) {
    try {
        $Branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($Branch)) {
            throw "无法获取当前分支"
        }
    }
    catch {
        Write-Error "请在 git 仓库内运行，或通过 -Branch 指定分支名。"
        exit 1
    }
}

Write-Host "[git-push-retry] 目标: $Remote/$Branch" -ForegroundColor Cyan
Write-Host "[git-push-retry] 最大重试次数: $MaxRetries, 初始退避: ${BaseDelaySeconds}s"

# 临时增大 http.postBuffer，降低大仓库推送失败概率
try {
    $currentBuffer = git config --get http.postBuffer 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentBuffer)) {
        Write-Host "[git-push-retry] 设置 http.postBuffer = $HttpBufferSize" -ForegroundColor Yellow
        git config http.postBuffer $HttpBufferSize
    }
    else {
        Write-Host "[git-push-retry] 当前 http.postBuffer = $currentBuffer" -ForegroundColor DarkGray
    }
}
catch {
    Write-Warning "配置 http.postBuffer 失败: $_"
}

$retryablePatterns = @(
    "RPC failed",
    "Send failure",
    "Connection was reset",
    "the remote end hung up unexpectedly",
    "unable to access",
    "Could not resolve host",
    "Operation timed out",
    "Failed to connect to"
)

$attempt = 0
$success = $false
while ($attempt -lt $MaxRetries -and -not $success) {
    $attempt++
    Write-Host "`n[git-push-retry] 第 $attempt / $MaxRetries 次尝试..." -ForegroundColor Cyan

    $output = ""
    $exitCode = 0
    try {
        $output = git push -u $Remote $Branch 2>&1
        $exitCode = $LASTEXITCODE
    }
    catch {
        $output = $_.Exception.Message
        $exitCode = 1
    }

    if ($exitCode -eq 0) {
        $success = $true
        Write-Host "[git-push-retry] 推送成功。" -ForegroundColor Green
        break
    }

    Write-Host $output -ForegroundColor Red

    $isRetryable = $false
    foreach ($pattern in $retryablePatterns) {
        if ($output -match $pattern) {
            $isRetryable = $true
            break
        }
    }

    if (-not $isRetryable) {
        Write-Error "[git-push-retry] 遇到不可重试错误，终止。"
        exit $exitCode
    }

    if ($attempt -lt $MaxRetries) {
        $delay = $BaseDelaySeconds * [math]::Pow(2, $attempt - 1)
        Write-Host "[git-push-retry] 等待 ${delay}s 后重试..." -ForegroundColor Yellow
        Start-Sleep -Seconds $delay
    }
}

if (-not $success) {
    Write-Error "[git-push-retry] 已达到最大重试次数 ($MaxRetries)，推送失败。"
    exit 1
}

exit 0
