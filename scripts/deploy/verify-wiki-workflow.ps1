# 快速验证 Wiki 同步工作流脚本
# 前提: gh auth login 已完成

param(
    [switch]$Watch,
    [switch]$DownloadArtifacts
)

$ErrorActionPreference = "Continue"
$repo = "DHENGHONGYU/-"
$workflow = "wiki-naming-conventions-sync.yml"

Write-Host "=== FinSightV9 Wiki 工作流验证 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 查看工作流列表
Write-Host "[1] 查看所有工作流..." -ForegroundColor Yellow
gh workflow list --repo $repo 2>&1
Write-Host ""

# 2. 查看指定工作流详情
Write-Host "[2] 查看 Wiki 同步工作流详情..." -ForegroundColor Yellow
gh workflow view $workflow --repo $repo 2>&1
Write-Host ""

# 3. 查看最近运行
Write-Host "[3] 查看最近工作流运行 (最近 5 条)..." -ForegroundColor Yellow
gh run list --repo $repo --workflow $workflow --limit 5 2>&1
Write-Host ""

# 4. 查看最新运行详情
Write-Host "[4] 最新运行详情..." -ForegroundColor Yellow
$runs = gh run list --repo $repo --workflow $workflow --limit 1 --json databaseId,status,conclusion,createdAt 2>&1
Write-Host $runs

$runIdMatch = [regex]::Match($runs, '"databaseId":\s*(\d+)')
if ($runIdMatch.Success) {
    $runId = $runIdMatch.Groups[1].Value
    Write-Host "   Run ID: $runId" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "[5] 查看运行 Jobs..." -ForegroundColor Yellow
    gh run view $runId --repo $repo 2>&1
    Write-Host ""

    if ($Watch) {
        Write-Host "[Watch] 实时监控运行..." -ForegroundColor Cyan
        Write-Host "   (Ctrl+C 退出)" -ForegroundColor Gray
        gh run watch $runId --repo $repo
    }

    if ($DownloadArtifacts) {
        Write-Host "[6] 下载 Artifacts..." -ForegroundColor Yellow
        $downloadDir = "outputs/github-artifacts-$runId"
        New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
        gh run download $runId --repo $repo --dir $downloadDir 2>&1
        Write-Host "   ✅ Artifacts 已下载到: $downloadDir" -ForegroundColor Green

        # 列出下载的文件
        Get-ChildItem -Path $downloadDir -Recurse | ForEach-Object {
            Write-Host "     $($_.FullName.Replace((Get-Location).Path + '\', ''))" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   ⚠️  未找到历史运行记录" -ForegroundColor Yellow
    Write-Host "   请手动触发: gh workflow run $workflow --repo $repo --ref main" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 验证完成 ===" -ForegroundColor Cyan