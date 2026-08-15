# ╔══════════════════════════════════════════════════════════════╗
# ║  FinSightV9 Wiki → Confluence 推送与验证一键脚本          ║
# ╚══════════════════════════════════════════════════════════════╝
#
# 在你的终端中运行:
#   powershell -ExecutionPolicy Bypass -File scripts/deploy/push-and-verify.ps1
#

param(
    [switch]$SkipPush,
    [switch]$SkipSecrets,
    [switch]$SkipTrigger,
    [string]$ConfluenceUrl = "",
    [string]$ConfluenceToken = "",
    [string]$SpaceKey = "ENG"
)

$ErrorActionPreference = "Continue"
$repo = "DHENGHONGYU/-"
$workflow = "wiki-naming-conventions-sync.yml"
$rootDir = Split-Path -Parent $PSScriptRoot

Set-Location $rootDir

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  FinSightV9 Wiki → GitHub → Confluence 一键部署            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: 推送本地提交到 GitHub ───
if (-not $SkipPush) {
    Write-Host "━━━ [1/5] 推送本地提交到 GitHub ━━━" -ForegroundColor Yellow

    # 检查暂存区
    $staged = git diff --cached --name-only 2>&1
    if ($staged) {
        Write-Host "   发现暂存文件:" -ForegroundColor Gray
        $staged | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }

        Write-Host "   提交中..." -ForegroundColor Gray
        git commit -m "feat(ci): add wiki naming conventions sync workflow and deploy scripts" 2>&1
    }

    # 推送
    Write-Host "   推送到 origin/main..." -ForegroundColor Gray
    $pushResult = git push origin main 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ 推送成功" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  推送可能需要认证" -ForegroundColor Yellow
        Write-Host "   错误: $pushResult" -ForegroundColor Red
        Write-Host ""
        Write-Host "   请尝试以下方式之一:" -ForegroundColor White
        Write-Host "   1. git config credential.helper manager" -ForegroundColor Cyan
        Write-Host "   2. 在 VS Code 中使用源代码管理面板推送" -ForegroundColor Cyan
        Write-Host "   3. 设置 Personal Access Token 作为密码" -ForegroundColor Cyan
    }
    Write-Host ""
} else {
    Write-Host "━━━ [1/5] 跳过推送 ━━━" -ForegroundColor Yellow
    Write-Host ""
}

# ─── Step 2: 验证工作流已在 GitHub 上存在 ───
Write-Host "━━━ [2/5] 验证 GitHub 工作流状态 ━━━" -ForegroundColor Yellow

Start-Sleep -Seconds 3

$workflowUrl = "https://github.com/$repo/actions/workflows/$workflow"
Write-Host "   检查 URL: $workflowUrl" -ForegroundColor Gray

# 使用 gh CLI 验证
try {
    $wfInfo = gh workflow view $workflow --repo $repo --json name,state,path 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ 工作流已在 GitHub 上注册" -ForegroundColor Green
        Write-Host "   $wfInfo" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  gh CLI 查询失败，可能工作流还未同步" -ForegroundColor Yellow
        Write-Host "   请手动访问: $workflowUrl" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ⚠️  无法验证 (gh CLI 可能需要认证)" -ForegroundColor Yellow
    Write-Host "   请在浏览器中打开: $workflowUrl" -ForegroundColor Cyan
}
Write-Host ""

# ─── Step 3: 配置 GitHub Secrets ───
if (-not $SkipSecrets -and $ConfluenceUrl -and $ConfluenceToken) {
    Write-Host "━━━ [3/5] 配置 Confluence GitHub Secrets ━━━" -ForegroundColor Yellow

    $secrets = @(
        @{ Name = "CONFLUENCE_URL"; Value = $ConfluenceUrl },
        @{ Name = "CONFLUENCE_TOKEN"; Value = $ConfluenceToken },
        @{ Name = "CONFLUENCE_SPACE"; Value = $SpaceKey }
    )

    foreach ($secret in $secrets) {
        Write-Host "   设置 $($secret.Name)..." -ForegroundColor Gray -NoNewline
        try {
            echo $secret.Value | gh secret set $secret.Name --repo $repo 2>&1
            Write-Host " ✅" -ForegroundColor Green
        } catch {
            Write-Host " ❌" -ForegroundColor Red
        }
    }
    Write-Host ""
} elseif (-not $SkipSecrets) {
    Write-Host "━━━ [3/5] 跳过 Secrets 配置（未提供 Confluence 凭证） ━━━" -ForegroundColor Yellow
    Write-Host "   后续手动配置:" -ForegroundColor Cyan
    Write-Host "     gh secret set CONFLUENCE_URL --repo $repo" -ForegroundColor White
    Write-Host "     gh secret set CONFLUENCE_TOKEN --repo $repo" -ForegroundColor White
    Write-Host "     gh secret set CONFLUENCE_SPACE --repo $repo" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "━━━ [3/5] 跳过 Secrets 配置 ━━━" -ForegroundColor Yellow
    Write-Host ""
}

# ─── Step 4: 触发工作流 ───
if (-not $SkipTrigger) {
    Write-Host "━━━ [4/5] 触发 Wiki 同步工作流 ━━━" -ForegroundColor Yellow

    try {
        $runResult = gh workflow run $workflow --repo $repo --ref main 2>&1
        Write-Host "   ✅ 工作流已触发" -ForegroundColor Green
        Write-Host "   $runResult" -ForegroundColor Gray
        Write-Host ""

        # 查询最近运行
        Start-Sleep -Seconds 5
        Write-Host "   查询最近运行..." -ForegroundColor Gray
        $runs = gh run list --repo $repo --workflow $workflow --limit 5 --json databaseId,status,conclusion,createdAt,headBranch,event 2>&1
        Write-Host "   最近运行:" -ForegroundColor Gray
        Write-Host $runs

        # 提取最新 run ID
        $runIdMatch = [regex]::Match($runs, '"databaseId":\s*(\d+)')
        if ($runIdMatch.Success) {
            $runId = $runIdMatch.Groups[1].Value
            Write-Host ""
            Write-Host "   ┌─────────────────────────────────────────────┐" -ForegroundColor Cyan
            Write-Host "   │  Run ID: $runId" -ForegroundColor Cyan
            Write-Host "   │  查看: gh run view $runId --repo $repo" -ForegroundColor Cyan
            Write-Host "   │  日志: gh run view $runId --repo $repo --log" -ForegroundColor Cyan
            Write-Host "   │  监控: gh run watch $runId --repo $repo" -ForegroundColor Cyan
            Write-Host "   │  下载: gh run download $runId --repo $repo" -ForegroundColor Cyan
            Write-Host "   └─────────────────────────────────────────────┘" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "   ❌ 工作流触发失败: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   手动触发:" -ForegroundColor Yellow
        Write-Host "     gh workflow run $workflow --repo $repo --ref main" -ForegroundColor Cyan
        Write-Host "   或访问:" -ForegroundColor Yellow
        Write-Host "     https://github.com/$repo/actions/workflows/$workflow" -ForegroundColor Cyan
    }
    Write-Host ""
} else {
    Write-Host "━━━ [4/5] 跳过工作流触发 ━━━" -ForegroundColor Yellow
    Write-Host ""
}

# ─── Step 5: 快速 Confluence 手动上传指引 ───
Write-Host "━━━ [5/5] Confluence 手动上传指引 ━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "   如果 GitHub Secrets 未配置，可手动上传:" -ForegroundColor White
Write-Host ""
Write-Host "   1. 打开: outputs/wiki-deploy/confluence-payload.html" -ForegroundColor Gray
Write-Host "   2. 全选复制文件内容 (Ctrl+A, Ctrl+C)" -ForegroundColor Gray
Write-Host "   3. 登录 Confluence，进入目标 Space" -ForegroundColor Gray
Write-Host "   4. 创建/编辑页面 → 右上角 ··· → 存储格式" -ForegroundColor Gray
Write-Host "   5. 粘贴内容 → 保存" -ForegroundColor Gray
Write-Host ""
Write-Host "   使用本地 PowerShell 脚本自动上传:" -ForegroundColor White
Write-Host "   .\scripts\deploy\deploy-to-confluence-local.ps1 \" -ForegroundColor Gray
Write-Host "       -ConfluenceUrl \"https://your-instance.atlassian.net\" \" -ForegroundColor Gray
Write-Host "       -ConfluenceToken \"your-api-token\" \" -ForegroundColor Gray
Write-Host "       -SpaceKey \"ENG\" -UpdateExisting" -ForegroundColor Gray
Write-Host ""

Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  完成！" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🔗 GitHub Actions: https://github.com/$repo/actions" -ForegroundColor Cyan
Write-Host "  📦 部署包: outputs/confluence-deployment-package.zip" -ForegroundColor Cyan
Write-Host "  📄 Payload: outputs/wiki-deploy/confluence-payload.html" -ForegroundColor Cyan
Write-Host ""