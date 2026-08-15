# ╔══════════════════════════════════════════════════════════╗
# ║  FinSightV9 Wiki → Confluence 一键部署脚本              ║
# ║                                                          ║
# ║  在已认证 gh CLI 的终端中运行:                           ║
# ║    powershell -ExecutionPolicy Bypass -File             ║
# ║      scripts/deploy/deploy-all.ps1                      ║
# ║      -ConfluenceUrl "..." -ConfluenceToken "..."        ║
# ║      -SpaceKey "ENG"                                    ║
# ╚══════════════════════════════════════════════════════════╝

param(
    [Parameter(Mandatory = $true, HelpMessage = "Confluence 实例 URL，如 https://company.atlassian.net")]
    [string]$ConfluenceUrl,

    [Parameter(Mandatory = $true, HelpMessage = "Confluence API Token (PAT)")]
    [string]$ConfluenceToken,

    [Parameter(Mandatory = $false, HelpMessage = "Confluence Space Key")]
    [string]$SpaceKey = "ENG",

    [Parameter(Mandatory = $false, HelpMessage = "父页面 ID")]
    [string]$ParentPageId = "",

    [Parameter(Mandatory = $false, HelpMessage = "跳过 GitHub Secrets 配置")]
    [switch]$SkipSecrets,

    [Parameter(Mandatory = $false, HelpMessage = "跳过工作流触发")]
    [switch]$SkipWorkflow,

    [Parameter(Mandatory = $false, HelpMessage = "跳过本地 Confluence 部署")]
    [switch]$SkipConfluence,

    [Parameter(Mandatory = $false, HelpMessage = "只生成部署包")]
    [switch]$PackageOnly
)

$ErrorActionPreference = "Continue"
$repo = "DHENGHONGYU/-"
$workflow = "wiki-naming-conventions-sync.yml"
$rootDir = $PSScriptRoot + "\..\.."

Set-Location $rootDir

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  FinSightV9 Wiki → Confluence 一键部署                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Step 0: 前置检查 ───
Write-Host "━━━ [0/6] 前置检查 ━━━" -ForegroundColor Yellow

# 检查 gh CLI
try {
    $ghStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ gh CLI 未认证，请先运行: gh auth login" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ gh CLI 已认证" -ForegroundColor Green
} catch {
    Write-Host "❌ gh CLI 不可用" -ForegroundColor Red
    exit 1
}

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js 未安装" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Node.js $(node --version)" -ForegroundColor Green

# 检查部署脚本
$deployScript = "scripts/deploy/deploy-to-confluence.ts"
if (-not (Test-Path $deployScript)) {
    Write-Host "❌ 找不到部署脚本: $deployScript" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 部署脚本就绪" -ForegroundColor Green

# 检查工作流文件
$workflowPath = ".github/workflows/$workflow"
if (-not (Test-Path $workflowPath)) {
    Write-Host "❌ 找不到工作流: $workflowPath" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 工作流就绪: $workflowPath" -ForegroundColor Green

# 执行模式
if ($PackageOnly) {
    Write-Host "   模式: 仅生成部署包" -ForegroundColor Cyan
}
Write-Host ""

# ─── Step 1: 生成最新审计报告 ───
Write-Host "━━━ [1/6] 生成命名规范审计报告 ━━━" -ForegroundColor Yellow
Set-Location $rootDir
npm run audit:naming:json 2>&1 | ForEach-Object { Write-Host "   $_" }
Write-Host ""

# ─── Step 2: 生成 Confluence 部署包 ───
Write-Host "━━━ [2/6] 生成 Confluence 部署包 ━━━" -ForegroundColor Yellow
npx tsx $deployScript 2>&1 | ForEach-Object { Write-Host "   $_" }

$deployDir = "outputs/wiki-deploy"
if (Test-Path $deployDir) {
    $files = Get-ChildItem $deployDir
    Write-Host "   ✅ 部署包已生成 ($($files.Count) 个文件)" -ForegroundColor Green
    foreach ($f in $files) {
        $size = if ($f.Length -gt 1024) { "$([math]::Round($f.Length/1024, 1)) KB" } else { "$($f.Length) B" }
        Write-Host "      • $($f.Name) ($size)" -ForegroundColor Gray
    }
}
Write-Host ""

# ─── Step 3: 打包部署包为 zip ───
Write-Host "━━━ [3/6] 打包部署包 ━━━" -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "outputs/confluence-deployment-$timestamp.zip"
$tempDir = "outputs/confluence-package-$timestamp"

# 创建临时目录
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# 复制核心文件
Copy-Item "$rootDir\outputs\wiki-deploy\*" $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$rootDir\docs\guides\standards\component-naming-conventions.md" $tempDir -Force -ErrorAction SilentlyContinue
Copy-Item "$rootDir\outputs\naming-conventions-report.json" $tempDir -Force -ErrorAction SilentlyContinue

# 创建说明文件
$readmeContent = @"
# FinSightV9 Confluence 部署包

生成时间: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
项目: FinSightV9
文档: 组件命名规范与文档模板标准

## 文件说明

| 文件 | 用途 |
|------|------|
| confluence-payload.html | 文档内容（Confluence Storage Format，直接粘贴使用） |
| wiki-metadata.json | 部署元数据 |
| DEPLOY-GUIDE.md | 详细部署指南 |
| component-naming-conventions.md | 原始 Markdown 文档 |
| naming-conventions-report.json | 命名规范审计报告 |

## 快速 Confluence 部署

### 方式 A：手动粘贴（推荐）

1. 登录 Confluence，进入目标 Space
2. 创建新页面或编辑现有页面
3. 点击页面右上角「···」→「存储格式」(Storage Format)
4. 将 confluence-payload.html 的内容全部复制粘贴到文本框
5. 点击「保存」

### 方式 B：PowerShell 脚本自动部署

```
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy-to-confluence-local.ps1 `
    -ConfluenceUrl "https://your-instance.atlassian.net" `
    -ConfluenceToken "your-api-token" `
    -SpaceKey "ENG" `
    -UpdateExisting
```

### 方式 C：GitHub Actions CI/CD

已配置自动部署工作流: .github/workflows/wiki-naming-conventions-sync.yml

触发条件:
- push 到 main 分支
- 每日北京时间 03:00 定时任务
- 手动 workflow_dispatch

## CI 命令

```
npm run audit:naming        # 交互式命名规范检查
npm run audit:naming:json   # JSON 格式输出
npm run fix:fileoverview    # 自动修复 @fileoverview 缺失
```
"@

Set-Content -Path "$tempDir\README.txt" -Value $readmeContent -Encoding UTF8

# 创建 zip
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force
Remove-Item $tempDir -Recurse -Force

$zipSize = [math]::Round((Get-Item $zipName).Length / 1024, 1)
Write-Host "   ✅ 部署包已打包: $zipName ($zipSize KB)" -ForegroundColor Green
Write-Host ""

# ─── Step 4: 配置 GitHub Secrets ───
if (-not $SkipSecrets -and -not $PackageOnly) {
    Write-Host "━━━ [4/6] 配置 GitHub Secrets ━━━" -ForegroundColor Yellow

    $secrets = @(
        @{ Name = "CONFLUENCE_URL"; Value = $ConfluenceUrl },
        @{ Name = "CONFLUENCE_TOKEN"; Value = $ConfluenceToken },
        @{ Name = "CONFLUENCE_SPACE"; Value = $SpaceKey }
    )

    if ($ParentPageId) {
        $secrets += @{ Name = "CONFLUENCE_PARENT_ID"; Value = $ParentPageId }
    }

    foreach ($secret in $secrets) {
        Write-Host "   设置 $($secret.Name)..." -ForegroundColor Gray -NoNewline
        try {
            echo $secret.Value | gh secret set $secret.Name --repo $repo 2>&1
            Write-Host " ✅" -ForegroundColor Green
        } catch {
            Write-Host " ❌ ($($_.Exception.Message))" -ForegroundColor Red
        }
    }

    Write-Host "   查看所有 Secrets: gh secret list --repo $repo" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "━━━ [4/6] 跳过 GitHub Secrets 配置 ━━━" -ForegroundColor Yellow
    Write-Host ""
}

# ─── Step 5: 触发工作流 ───
if (-not $SkipWorkflow -and -not $PackageOnly) {
    Write-Host "━━━ [5/6] 触发 Wiki 同步工作流 ━━━" -ForegroundColor Yellow

    try {
        $runOutput = gh workflow run $workflow --repo $repo --ref main 2>&1
        Write-Host "   ✅ 工作流已触发" -ForegroundColor Green
        Write-Host "   $runOutput" -ForegroundColor Gray

        # 查询运行状态
        Start-Sleep -Seconds 5
        $runs = gh run list --repo $repo --workflow $workflow --limit 3 2>&1
        Write-Host "   最近运行:" -ForegroundColor Gray
        Write-Host $runs

        # 提供监控命令
        Write-Host ""
        Write-Host "   🔍 监控命令:" -ForegroundColor Cyan
        Write-Host "      gh run watch <RUN_ID> --repo $repo" -ForegroundColor White
        Write-Host "      gh run view <RUN_ID> --repo $repo --log" -ForegroundColor White
        Write-Host "      gh run download <RUN_ID> --repo $repo --dir outputs/github-artifacts" -ForegroundColor White
    } catch {
        Write-Host "   ⚠️  工作流触发失败: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "   手动触发: gh workflow run $workflow --repo $repo --ref main" -ForegroundColor Cyan
    }
    Write-Host ""
} else {
    Write-Host "━━━ [5/6] 跳过工作流触发 ━━━" -ForegroundColor Yellow
    Write-Host ""
}

# ─── Step 6: 本地 Confluence 部署 ───
if (-not $SkipConfluence -and -not $PackageOnly) {
    Write-Host "━━━ [6/6] 本地 Confluence 部署 ━━━" -ForegroundColor Yellow

    $localScript = "scripts/deploy/deploy-to-confluence-local.ps1"
    if (Test-Path $localScript) {
        $args = @{
            ConfluenceUrl = $ConfluenceUrl
            ConfluenceToken = $ConfluenceToken
            SpaceKey = $SpaceKey
            UpdateExisting = $true
        }
        if ($ParentPageId) { $args.ParentPageId = $ParentPageId }

        & $localScript @args
    } else {
        Write-Host "   ⚠️  找不到本地部署脚本" -ForegroundColor Yellow
        Write-Host "   手动部署: 将 outputs/wiki-deploy/confluence-payload.html 粘贴到 Confluence" -ForegroundColor Cyan
    }
    Write-Host ""
} else {
    Write-Host "━━━ [6/6] 跳过本地 Confluence 部署 ━━━" -ForegroundColor Yellow
    Write-Host ""
}

# ─── 完成 ───
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  部署流程完成！                                         ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 产物位置:" -ForegroundColor White
Write-Host "   部署包: $zipName" -ForegroundColor Gray
Write-Host "   工作目录: outputs/wiki-deploy/" -ForegroundColor Gray
Write-Host ""
Write-Host "🎯 快速 Confluence 上传（无需 API）:" -ForegroundColor White
Write-Host "   1. 打开 $zipName → 解压" -ForegroundColor Gray
Write-Host "   2. 打开 confluence-payload.html → 全选复制" -ForegroundColor Gray
Write-Host "   3. Confluence → 目标页面 → 存储格式 → 粘贴 → 保存" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 后续操作:" -ForegroundColor White
Write-Host "   • 查看工作流: gh workflow list --repo $repo" -ForegroundColor Gray
Write-Host "   • 查看运行: gh run list --repo $repo" -ForegroundColor Gray
Write-Host "   • 本地审计: npm run audit:naming" -ForegroundColor Gray
Write-Host ""