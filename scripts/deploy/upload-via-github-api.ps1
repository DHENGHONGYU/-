# ╔══════════════════════════════════════════════════════════════╗
# ║  FinSightV9 — GitHub REST API 上传脚本 (绕过 git push 限制) ║
# ╚══════════════════════════════════════════════════════════════╝
#
# 使用方法:
#   powershell -ExecutionPolicy Bypass -File scripts/deploy/upload-via-github-api.ps1 `
#       -GitHubToken "ghp_your_personal_access_token"
#
# 原理: 使用 GitHub REST API 的 "Create/Update file" 端点
#       通过 HTTPS PUT 请求直接上传文件到仓库
#       不依赖 git 协议，仅需 HTTPS 443 访问 api.github.com
#

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,

    [string]$RepoOwner = "DHENGHONGYU",
    [string]$RepoName = "-",
    [string]$Branch = "main",
    [string]$CommitMessage = "feat(ci): add wiki naming conventions sync workflow via API"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

Set-Location $projectRoot

$repo = "$RepoOwner/$RepoName"
$apiBase = "https://api.github.com/repos/$repo"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  FinSightV9 — GitHub REST API 文件上传                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  仓库: $repo" -ForegroundColor White
Write-Host "  分支: $Branch" -ForegroundColor White
Write-Host "  API:  $apiBase" -ForegroundColor White
Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 0: 验证 Token 和 API 连通性
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [0/4] 验证 API 连通性 ━━━" -ForegroundColor Yellow

$headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
    "Content-Type" = "application/json"
    "User-Agent" = "FinSightV9-Uploader"
}

try {
    $userInfo = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers -TimeoutSec 15
    Write-Host "   ✅ Token 有效: $($userInfo.login)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Token 验证失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

try {
    $repoInfo = Invoke-RestMethod -Uri "$apiBase" -Headers $headers -TimeoutSec 15
    Write-Host "   ✅ 仓库可访问: $($repoInfo.full_name)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 仓库访问失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 1: 获取当前文件 SHA (用于更新)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [1/4] 获取远程文件状态 ━━━" -ForegroundColor Yellow

$filesToUpload = @(
    @{
        LocalPath = ".github/workflows/wiki-naming-conventions-sync.yml"
        RemotePath = ".github/workflows/wiki-naming-conventions-sync.yml"
        Label = "工作流 YAML"
    },
    @{
        LocalPath = "docs/guides/standards/component-naming-conventions.md"
        RemotePath = "docs/guides/standards/component-naming-conventions.md"
        Label = "命名规范文档"
    }
)

$shas = @{}

foreach ($file in $filesToUpload) {
    $encodedPath = [System.Uri]::EscapeDataString($file.RemotePath)
    try {
        $existing = Invoke-RestMethod -Uri "$apiBase/contents/$encodedPath`?ref=$Branch" -Headers $headers -TimeoutSec 15
        $shas[$file.RemotePath] = $existing.sha
        Write-Host "   $($file.Label): 已存在 (SHA: $($existing.sha.Substring(0,7))...) → 将更新" -ForegroundColor Gray
    } catch {
        $shas[$file.RemotePath] = $null
        Write-Host "   $($file.Label): 不存在 → 将创建" -ForegroundColor Gray
    }
}

Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 2: 读取本地文件并编码
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [2/4] 读取本地文件 ━━━" -ForegroundColor Yellow

$fileContents = @{}
foreach ($file in $filesToUpload) {
    $fullLocalPath = Join-Path $projectRoot $file.LocalPath
    if (-not (Test-Path $fullLocalPath)) {
        Write-Host "   ❌ 本地文件不存在: $fullLocalPath" -ForegroundColor Red
        exit 1
    }
    $rawContent = [System.IO.File]::ReadAllText($fullLocalPath)
    $base64Content = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($rawContent))
    $fileContents[$file.RemotePath] = $base64Content
    Write-Host "   ✅ $($file.Label): 已读取 ($($rawContent.Length) 字节)" -ForegroundColor Green
}

Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 3: 上传文件到 GitHub
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [3/4] 上传文件到 GitHub ━━━" -ForegroundColor Yellow

$results = @()

foreach ($file in $filesToUpload) {
    $body = @{
        message = $CommitMessage
        content = $fileContents[$file.RemotePath]
        branch = $Branch
    }

    if ($shas[$file.RemotePath]) {
        $body["sha"] = $shas[$file.RemotePath]
    }

    $bodyJson = $body | ConvertTo-Json -Depth 10

    $encodedPath = [System.Uri]::EscapeDataString($file.RemotePath)
    $url = "$apiBase/contents/$encodedPath"

    try {
        $response = Invoke-RestMethod -Uri $url -Method Put -Headers $headers -Body $bodyJson -TimeoutSec 30

        if ($response.commit -and $response.commit.sha) {
            Write-Host "   ✅ $($file.Label): 上传成功 (Commit: $($response.commit.sha.Substring(0,7)))" -ForegroundColor Green
            $results += @{ File = $file.Label; Status = "Success"; SHA = $response.commit.sha }
        } elseif ($response.content) {
            Write-Host "   ✅ $($file.Label): 文件已存在 (SHA: $($response.content.sha.Substring(0,7)))" -ForegroundColor Green
            $results += @{ File = $file.Label; Status = "Exists"; SHA = $response.content.sha }
        } else {
            Write-Host "   ⚠️  $($file.Label): 响应异常" -ForegroundColor Yellow
            $results += @{ File = $file.Label; Status = "Unknown"; SHA = "" }
        }
    } catch {
        Write-Host "   ❌ $($file.Label): 上传失败 — $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            Write-Host "      详情: $($sr.ReadToEnd())" -ForegroundColor Red
        }
        $results += @{ File = $file.Label; Status = "Failed"; SHA = "" }
    }
}

Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 4: 验证上传结果
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [4/4] 验证上传结果 ━━━" -ForegroundColor Yellow

Start-Sleep -Seconds 5

$allSuccess = $true
foreach ($file in $filesToUpload) {
    $encodedPath = [System.Uri]::EscapeDataString($file.RemotePath)
    try {
        $verify = Invoke-RestMethod -Uri "$apiBase/contents/$encodedPath`?ref=$Branch" -Headers $headers -TimeoutSec 15
        Write-Host "   ✅ $($file.Label): 已在远程 (SHA: $($verify.sha.Substring(0,7)))" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ $($file.Label): 远程验证失败" -ForegroundColor Red
        $allSuccess = $false
    }
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($allSuccess) {
    Write-Host "  🎉 所有文件上传成功!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  下一步:" -ForegroundColor White
    Write-Host "  1. 配置 Confluence Secrets:" -ForegroundColor White
    Write-Host "     gh secret set CONFLUENCE_URL --repo $repo" -ForegroundColor Gray
    Write-Host "     gh secret set CONFLUENCE_TOKEN --repo $repo" -ForegroundColor Gray
    Write-Host "     gh secret set CONFLUENCE_SPACE --repo $repo" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. 触发工作流:" -ForegroundColor White
    Write-Host "     gh workflow run wiki-naming-conventions-sync.yml --repo $repo --ref $Branch" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. 或在浏览器中手动触发:" -ForegroundColor White
    Write-Host "     https://github.com/$repo/actions/workflows/wiki-naming-conventions-sync.yml" -ForegroundColor Cyan
} else {
    Write-Host "  ❌ 部分文件上传失败" -ForegroundColor Red
    Write-Host "  请检查上方错误信息" -ForegroundColor Yellow
}

Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  结果摘要:" -ForegroundColor White
$results | Format-Table -Property File, Status, SHA -AutoSize | Out-String | Write-Host
Write-Host ""