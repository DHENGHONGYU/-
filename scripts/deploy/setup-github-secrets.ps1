# GitHub Secrets 配置与 Wiki 工作流触发脚本
# 使用前必须先运行: gh auth login
# 仓库: https://github.com/DHENGHONGYU/-.git

param(
    [Parameter(Mandatory = $false)]
    [string]$ConfluenceUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$ConfluenceToken = "",

    [Parameter(Mandatory = $false)]
    [string]$ConfluenceSpace = "ENG",

    [Parameter(Mandatory = $false)]
    [string]$ConfluenceParentId = "",

    [Parameter(Mandatory = $false)]
    [switch]$SkipConfluenceSecrets = $false,

    [Parameter(Mandatory = $false)]
    [switch]$SkipWorkflowTrigger = $false
)

$ErrorActionPreference = "Stop"
$repo = "DHENGHONGYU/-"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FinSightV9 Wiki 自动同步配置脚本" -ForegroundColor Cyan
Write-Host "  仓库: $repo" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 0: 验证 GitHub CLI 认证
Write-Host "[Step 0] 验证 GitHub CLI 认证..." -ForegroundColor Yellow
try {
    $authStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 未检测到 GitHub CLI 认证" -ForegroundColor Red
        Write-Host ""
        Write-Host "请先在终端中运行:" -ForegroundColor White
        Write-Host "    gh auth login" -ForegroundColor Green
        Write-Host ""
        Write-Host "或使用 Token 登录:" -ForegroundColor White
        Write-Host "    `$env:GH_TOKEN='ghp_xxxxxx'" -ForegroundColor Green
        Write-Host "    gh auth login --with-token" -ForegroundColor Green
        Write-Host ""
        Write-Host "认证完成后，重新运行本脚本。" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ GitHub CLI 已认证" -ForegroundColor Green
    Write-Host "   $authStatus" -ForegroundColor Gray
} catch {
    Write-Host "❌ 认证检查失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 1: 配置 Confluence Secrets
if (-not $SkipConfluenceSecrets) {
    Write-Host "[Step 1] 配置 Confluence GitHub Secrets..." -ForegroundColor Yellow

    if ($ConfluenceUrl -and $ConfluenceToken) {
        Write-Host "   从参数读取凭证" -ForegroundColor Gray

        # CONFLUENCE_URL
        Write-Host "   设置 CONFLUENCE_URL..." -ForegroundColor Gray
        echo $ConfluenceUrl | gh secret set CONFLUENCE_URL --repo $repo
        Write-Host "   ✅ CONFLUENCE_URL 已设置" -ForegroundColor Green

        # CONFLUENCE_TOKEN
        Write-Host "   设置 CONFLUENCE_TOKEN..." -ForegroundColor Gray
        echo $ConfluenceToken | gh secret set CONFLUENCE_TOKEN --repo $repo
        Write-Host "   ✅ CONFLUENCE_TOKEN 已设置" -ForegroundColor Green

        # CONFLUENCE_SPACE
        Write-Host "   设置 CONFLUENCE_SPACE..." -ForegroundColor Gray
        echo $ConfluenceSpace | gh secret set CONFLUENCE_SPACE --repo $repo
        Write-Host "   ✅ CONFLUENCE_SPACE 已设置 ($ConfluenceSpace)" -ForegroundColor Green

        # CONFLUENCE_PARENT_ID (可选)
        if ($ConfluenceParentId) {
            Write-Host "   设置 CONFLUENCE_PARENT_ID..." -ForegroundColor Gray
            echo $ConfluenceParentId | gh secret set CONFLUENCE_PARENT_ID --repo $repo
            Write-Host "   ✅ CONFLUENCE_PARENT_ID 已设置" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  CONFLUENCE_PARENT_ID 未设置（可选，后续可通过" -ForegroundColor Gray
            Write-Host "      gh secret set CONFLUENCE_PARENT_ID --repo $repo" -ForegroundColor Gray
            Write-Host "      添加）" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  未提供 Confluence 凭证参数" -ForegroundColor Yellow
        Write-Host "   Secrets 将在工作流中作为可选变量使用" -ForegroundColor Gray
        Write-Host "   未配置时工作流仍会生成离线部署包作为 artifact" -ForegroundColor Gray
    }
    Write-Host ""
}

# 查看现有 Secrets
Write-Host "[Step 1b] 查看当前仓库 Secrets..." -ForegroundColor Yellow
try {
    $secrets = gh secret list --repo $repo 2>&1
    Write-Host "   当前 Secrets:" -ForegroundColor Gray
    Write-Host $secrets
} catch {
    Write-Host "   (无法获取 Secrets 列表，可能需要 `gh auth refresh`)" -ForegroundColor Gray
}
Write-Host ""

# Step 2: 确保工作流已启用
Write-Host "[Step 2] 检查 Wiki 同步工作流状态..." -ForegroundColor Yellow
$workflowFile = ".github/workflows/wiki-naming-conventions-sync.yml"
try {
    $workflowInfo = gh workflow view $workflowFile --repo $repo --json name,state,path 2>&1
    Write-Host "   工作流信息:" -ForegroundColor Gray
    Write-Host $workflowInfo

    if ($workflowInfo -match '"state": "disabled"') {
        Write-Host "   ⚠️  工作流已禁用，正在启用..." -ForegroundColor Yellow
        gh workflow enable $workflowFile --repo $repo
        Write-Host "   ✅ 工作流已启用" -ForegroundColor Green
    } else {
        Write-Host "   ✅ 工作流已启用" -ForegroundColor Green
    }
} catch {
    Write-Host "   (无法直接检查工作流状态，将在触发时验证)" -ForegroundColor Gray
}
Write-Host ""

# Step 3: 触发工作流
if (-not $SkipWorkflowTrigger) {
    Write-Host "[Step 3] 触发 Wiki 自动同步工作流..." -ForegroundColor Yellow

    $workflowId = "wiki-naming-conventions-sync.yml"
    Write-Host "   工作流: $workflowId" -ForegroundColor Gray
    Write-Host "   分支: main" -ForegroundColor Gray

    try {
        $runOutput = gh workflow run $workflowId --repo $repo --ref main 2>&1
        Write-Host "   ✅ 工作流已触发" -ForegroundColor Green
        Write-Host "   $runOutput" -ForegroundColor Gray
    } catch {
        Write-Host "   ❌ 工作流触发失败: $_" -ForegroundColor Red
        Write-Host "   可能原因:" -ForegroundColor Yellow
        Write-Host "   1. 工作流文件路径不正确" -ForegroundColor White
        Write-Host "   2. 分支名称不匹配" -ForegroundColor White
        Write-Host "   3. 权限不足" -ForegroundColor White
        Write-Host ""
        Write-Host "   手动触发方式:" -ForegroundColor Yellow
        Write-Host "   gh workflow run $workflowId --repo $repo --ref main" -ForegroundColor Green
        exit 1
    }
    Write-Host ""

    # Step 4: 监控工作流运行状态
    Write-Host "[Step 4] 查询最新工作流运行..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3

    try {
        $runs = gh run list --repo $repo --workflow $workflowId --limit 1 --json databaseId,status,conclusion,createdAt,headBranch 2>&1
        Write-Host "   最新运行:" -ForegroundColor Gray
        Write-Host $runs

        # 提取 run ID
        $runIdMatch = [regex]::Match($runs, '"databaseId":\s*(\d+)')
        if ($runIdMatch.Success) {
            $runId = $runIdMatch.Groups[1].Value
            Write-Host ""
            Write-Host "   Run ID: $runId" -ForegroundColor Cyan
            Write-Host "   查看运行详情:" -ForegroundColor Yellow
            Write-Host "     gh run view $runId --repo $repo" -ForegroundColor Green
            Write-Host "   查看运行日志:" -ForegroundColor Yellow
            Write-Host "     gh run view $runId --repo $repo --log" -ForegroundColor Green
            Write-Host "   实时监控:" -ForegroundColor Yellow
            Write-Host "     gh run watch $runId --repo $repo" -ForegroundColor Green
            Write-Host "   下载 artifact:" -ForegroundColor Yellow
            Write-Host "     gh run download $runId --repo $repo" -ForegroundColor Green

            # 尝试等待并查看结果
            Write-Host ""
            Write-Host "   等待工作流完成 (最多 60 秒)..." -ForegroundColor Gray
            $waited = 0
            while ($waited -lt 60) {
                Start-Sleep -Seconds 5
                $waited += 5
                $currentRun = gh run view $runId --repo $repo --json status,conclusion 2>&1
                $statusMatch = [regex]::Match($currentRun, '"status":\s*"(\w+)"')
                $conclusionMatch = [regex]::Match($currentRun, '"conclusion":\s*"(\w+)"')
                $status = if ($statusMatch.Success) { $statusMatch.Groups[1].Value } else { "unknown" }
                $conclusion = if ($conclusionMatch.Success) { $conclusionMatch.Groups[1].Value } else { "" }

                Write-Host "   [${waited}s] 状态: $status $conclusion" -ForegroundColor Gray

                if ($status -eq "completed" -or $status -eq "failure" -or $status -eq "cancelled") {
                    if ($conclusion -eq "success") {
                        Write-Host "   ✅ 工作流运行成功！" -ForegroundColor Green
                    } elseif ($conclusion -eq "failure") {
                        Write-Host "   ❌ 工作流运行失败，查看日志:" -ForegroundColor Red
                        Write-Host "     gh run view $runId --repo $repo --log" -ForegroundColor Green
                    } else {
                        Write-Host "   ⚠️  工作流结束: $conclusion" -ForegroundColor Yellow
                    }
                    break
                }
            }

            if ($waited -ge 60) {
                Write-Host "   ⏰ 等待超时，工作流可能仍在运行" -ForegroundColor Yellow
                Write-Host "   手动查看: gh run view $runId --repo $repo" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "   ⚠️  无法获取运行状态: $_" -ForegroundColor Yellow
        Write-Host "   手动查看: gh run list --repo $repo" -ForegroundColor Yellow
    }
    Write-Host ""
}

# 完成
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  配置完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 后续步骤:" -ForegroundColor White
Write-Host "  1. 在 GitHub 仓库 Settings → Secrets 页面确认 Secrets 已添加" -ForegroundColor Gray
Write-Host "  2. 在 Actions 页面查看工作流运行结果" -ForegroundColor Gray
Write-Host "  3. 下载 artifact (wiki-deployment-package) 查看部署包" -ForegroundColor Gray
Write-Host "  4. 若未配置 Confluence 凭证，可手动将" -ForegroundColor Gray
Write-Host "     outputs/wiki-deploy/confluence-payload.html 粘贴到 Confluence" -ForegroundColor Gray
Write-Host ""