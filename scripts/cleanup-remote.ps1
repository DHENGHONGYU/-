# ============================================================
# GitHub 远程仓库清理脚本 — 删除冗余分支 + 标签
# 仓库: DHENGHONGYU/-   日期: 2026-08-13
# 用法: 在 d:\FinSightV9 下用 PowerShell 执行
# 说明: 全部为"删除远端"操作，不触碰本地工作区/提交，可重复执行（幂等）
# 运行模式:
#   .\scripts\cleanup-remote.ps1 -Simulate    # 仅模拟，输出当前远端清单，不删除
#   .\scripts\cleanup-remote.ps1 -Execute     # 正式执行删除
# ============================================================

param(
    [switch]$Simulate,
    [switch]$Execute
)

$ErrorActionPreference = 'Continue'

Write-Host "===== 前置检查: fetch --prune =====" -ForegroundColor Cyan
git fetch --prune origin

Write-Host "`n===== 当前远端分支清单 =====" -ForegroundColor Cyan
git ls-remote --heads origin
Write-Host "`n===== 当前远端标签清单 =====" -ForegroundColor Cyan
git ls-remote --tags origin

if (-not $Simulate -and -not $Execute) {
    Write-Host "`n未指定运行模式，仅输出清单。使用 -Execute 正式删除，-Simulate 仅模拟。" -ForegroundColor Yellow
    exit 0
}

# 待删除的冗余分支（保留 main）
$branches = @(
    'feat/release-2026-08-08',
    'feat/test-embedding-trigger',
    'fix/autorecover-test-comment',
    'fix/p1p3-csv-column-order',
    'main-cleaned',
    'release/v2.1.0-prerelease',
    'release/v9.2-rc1'
)

# 待删除的冗余标签
$tags = @(
    'v1.2.0',
    'v1.2.0-fix-doc-links',
    'v2.0.0-rc.1',
    'v2.0.0-rc.2',
    'v2.1.0',
    'v2.1.0-prerelease',
    'v2.6.0',
    'v9.2-rc1'
)

if ($Simulate) {
    Write-Host "`n===== [模拟模式] 待删除分支 ($($branches.Count) 个) =====" -ForegroundColor Yellow
    $branches | ForEach-Object { Write-Host "  - $_" }
    Write-Host "===== [模拟模式] 待删除标签 ($($tags.Count) 个) =====" -ForegroundColor Yellow
    $tags | ForEach-Object { Write-Host "  - $_" }
    Write-Host "`n[模拟] 未执行任何删除。请确认清单后使用 -Execute 正式执行。" -ForegroundColor Green
    exit 0
}

if ($Execute) {
    Write-Host "`n===== 执行删除远端分支 =====" -ForegroundColor Red
    foreach ($b in $branches) {
        Write-Host "删除分支: $b"
        git push origin --delete $b
    }

    Write-Host "`n===== 执行删除远端标签 =====" -ForegroundColor Red
    foreach ($t in $tags) {
        Write-Host "删除标签: $t"
        git push origin --delete $t
    }

    Write-Host "`n===== 复核: 清理后远端清单 =====" -ForegroundColor Cyan
    git ls-remote --heads origin
    git ls-remote --tags origin
}
