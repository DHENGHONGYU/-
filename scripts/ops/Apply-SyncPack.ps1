# ============================================================
# FinSightV9 远程校对同步包 v2026-08-21
# ------------------------------------------------------------
# 场景: 当 HTTPS 443 / SSH 到 GitHub 不通时，本脚本包实现：
#   1. 本地 apply bundle → 2. 网络恢复后一键 push → 3. stale 清理候选
# 产物清单 (同目录):
#   .gitbundle/FinSightV9-HEAD.bundle  (完整sha1历史 + 4分支 + 2 tags)
#   scripts/ops/Apply-SyncPack.ps1     (本脚本)
#
# 用法:
#   Step A (首次接包到已有仓库):
#     powershell -ExecutionPolicy Bypass -File .\scripts\ops\Apply-SyncPack.ps1 -Mode FetchIntoExisting
#   Step B (网络恢复后一键推送到 origin):
#     powershell -ExecutionPolicy Bypass -File .\scripts\ops\Apply-SyncPack.ps1 -Mode PushToOrigin
#   Step C (校对远程 stale 候选 - 默认只列表，加 -ExecuteCleanup 先归档再删):
#     powershell -ExecutionPolicy Bypass -File .\scripts\ops\Apply-SyncPack.ps1 -Mode CleanupStale
#     powershell -ExecutionPolicy Bypass -File .\scripts\ops\Apply-SyncPack.ps1 -Mode CleanupStale -ExecuteCleanup
# ============================================================
[CmdletBinding()]
param(
  [ValidateSet('FetchIntoExisting','PushToOrigin','CleanupStale')]
  [string]$Mode = 'FetchIntoExisting',
  [string]$RepoPath = 'D:\FinSightV9',
  [string]$BundlePath = $(Join-Path (Split-Path -Parent $PSScriptRoot | Split-Path -Parent) '.gitbundle\FinSightV9-HEAD.bundle'),
  [switch]$ExecuteCleanup = $false,
  [string]$Remote = 'origin'
)
$ErrorActionPreference = 'Stop'

$ExpectedRefs = @{
  'refs/heads/tech-debt/iteration-1'                        = 'bf9329b (当前迭代工作分支, 文档基准)'
  'refs/heads/main'                                         = '同步 origin/main 最新'
  'refs/heads/governance/round9-cleanup-zombie-components'  = '长活治理分支 (team-handbook §6.1 保留)'
  'refs/heads/wip/parallel-cockpit-redesign'                = 'WIP cockpit-redesign (未完成保留)'
  'refs/tags/v2.0.0-rc.2'                                   = '03b3d979 GA发布tag - 与 v2.0.0-GA-FINAL-RELEASE-REPORT.md §1 对齐'
  'refs/tags/v2.0.0-rc.2.2'                                 = '6174c5ba G3-B rc.2.2 · 筹码分布生产闭环'
}
$LegalBranchPrefix = @('main','master','develop','release/','feature/','bugfix/','hotfix/','fix/','refactor/','docs/','chore/','tech-debt/','governance/','wip/')

function Write-Step($m){Write-Host "`n==> $m" -ForegroundColor Cyan}
function Write-Ok($m)  {Write-Host "    [OK] $m" -ForegroundColor Green}
function Write-Warn($m){Write-Host "    [!]  $m" -ForegroundColor Yellow}
function Fail($m)     {Write-Host "    [FAIL] $m" -ForegroundColor Red; throw $m}

if(-not (Test-Path $BundlePath)){Fail "bundle不存在: $BundlePath"}
Push-Location $RepoPath
try {
  if(-not (Test-Path '.git')){Fail "RepoPath 非Git仓库: $RepoPath"}
  git bundle verify $BundlePath 2>$null
  if($LASTEXITCODE -ne 0){Fail "bundle 校验失败, 请重新生成或拷贝"}
  $bSize = [Math]::Round((Get-Item $BundlePath).Length/1MB,2)
  Write-Ok "bundle verify 通过 (${bSize}MB)"

  switch ($Mode) {
    'FetchIntoExisting' {
      Write-Step "Fetch bundle 到当前仓库 (本地 fetch, 不触碰远程)"
      $name = "bundle-sync-$(Get-Date -Format yyyyMMdd)"
      git fetch $BundlePath `
        "refs/heads/tech-debt/iteration-1:refs/remotes/$name/tech-debt/iteration-1" `
        "refs/heads/governance/round9-cleanup-zombie-components:refs/remotes/$name/governance/round9-cleanup-zombie-components" `
        "refs/heads/wip/parallel-cockpit-redesign:refs/remotes/$name/wip/parallel-cockpit-redesign" `
        "refs/tags/v2.0.0-rc.2:refs/tags/v2.0.0-rc.2" `
        "refs/tags/v2.0.0-rc.2.2:refs/tags/v2.0.0-rc.2.2"
      if($LASTEXITCODE -ne 0){Fail "fetch bundle 失败"}

      $newHead = (git ls-remote $BundlePath refs/heads/tech-debt/iteration-1) -split '\s+' | Select-Object -First 1
      Write-Ok "bundle tech-debt/iteration-1 HEAD: $newHead"
      git checkout tech-debt/iteration-1 *>$null
      git merge --ff-only $newHead
      if($LASTEXITCODE -ne 0){Write-Warn "ff-only跳过(当前不在bundle历史链). 可手动: git reset --hard $newHead"}

      'governance/round9-cleanup-zombie-components','wip/parallel-cockpit-redesign' | ForEach-Object {
        $sha = (git ls-remote $BundlePath "refs/heads/$_") -split '\s+' | Select-Object -First 1
        git branch -f $_ $sha | Out-Null
        Write-Ok "本地分支 $_ -> $($sha.Substring(0,7))"
      }
      Write-Host "`nMode-A 完成. 下一步网络OK后运行 -Mode PushToOrigin" -ForegroundColor Green
    }

    'PushToOrigin' {
      Write-Step "Step 0 - 验证可达 $Remote"
      git ls-remote --heads $Remote tech-debt/iteration-1 | Out-Null
      if($LASTEXITCODE -ne 0){Fail "无法连接 $Remote 。请先解决网络/SSH公钥后再运行此模式."}

      Write-Step "Step 1 - push tech-debt/iteration-1 (ahead 48 = rc.2 23 + 本周迭代 25 commits)"
      git push $Remote tech-debt/iteration-1
      if($LASTEXITCODE -ne 0){Fail "push tech-debt/iteration-1 失败"}

      Write-Step "Step 2 - push 2 个保留长活分支"
      git push $Remote governance/round9-cleanup-zombie-components
      git push $Remote wip/parallel-cockpit-redesign
      Write-Ok "2 个保留分支推送完成"

      Write-Step "Step 3 - push tags (rc.2 可能报 already exist - 正常)"
      git push $Remote v2.0.0-rc.2
      git push $Remote v2.0.0-rc.2.2
      Write-Ok "Tags 推送完成"

      Write-Step "Step 4 - fetch/prune 对齐远程"
      git fetch --prune --tags $Remote
      Write-Host "    status: $(git status -sb)"
      Write-Host "`nMode-B 全部完成。再执行 -Mode CleanupStale 校对远程命名合规性" -ForegroundColor Green
    }

    'CleanupStale' {
      Write-Step "校对: 文档声明基准 vs 远程实际"
      Write-Host "  文档基准 (Expected):"
      $ExpectedRefs.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "    - $($_.Key) => $($_.Value)" }

      $remotes = @(git ls-remote --heads $Remote)
      $tags    = @(git ls-remote --tags  $Remote)
      Write-Host "`n  远程实际 ($($remotes.Count) branches / $($tags.Count) tags):"
      $remotes | ForEach-Object { Write-Host "    B $_" }
      $tags    | ForEach-Object { Write-Host "    T $_" }

      # 分支命名合规筛选 (S02 §2.A 7型 + team-handbook §6.1 治理保留前缀)
      $stale = New-Object System.Collections.Generic.List[string]
      foreach($r in $remotes){
        $ref = ($r -split '\t',2)[1] -replace '^refs/heads/',''
        $ok = $false
        foreach($p in $LegalBranchPrefix){ if($ref -like "$p*"){$ok=$true;break} }
        if(-not $ok){ $stale.Add($ref) }
      }
      Write-Host ""
      if($stale.Count -eq 0){ Write-Ok "未发现不合规命名远程分支" }
      else {
        Write-Warn "$($stale.Count) 个远程分支不符合 S02 §2.A 7型/治理保留前缀命名, 候选清理:"
        $stale | ForEach-Object { Write-Host "    (需确认) origin/$_" }
        if($ExecuteCleanup){
          Write-Step "执行清理候选: 先 push 到 refs/archive/<name> 冷归档，再 delete"
          foreach($b in $stale){
            $sha = ((git ls-remote --heads $Remote $b) -split '\s+' | Select-Object -First 1)
            git push $Remote "${sha}:refs/archive/$b" | Out-Null
            git push $Remote --delete $b
            Write-Ok "archive+delete: origin/$b (refs/archive/$b)"
          }
        }
      }

      # Tag 校对
      Write-Step "标签一致性校对 (v2.0.0-rc.2 / v2.0.0-rc.2.2)"
      $want = @{
        'v2.0.0-rc.2'   = '03b3d9798d0ae6701347363528c26c707023446d'
        'v2.0.0-rc.2.2' = '6174c5bac75773226cf21344590400743b00068e'
      }
      $have = @{}
      foreach($t in $tags){
        $p = $t -split '\t'
        $n = $p[1] -replace '^refs/tags/' -replace '\^\{\}$',''
        if(-not $have.ContainsKey($n)){ $have[$n] = $p[0] }
      }
      foreach($k in $want.Keys){
        if(-not $have.ContainsKey($k)){ Write-Warn "远程缺失 tag: $k (本地=$($want[$k].Substring(0,7)), PushToOrigin阶段推送)" }
        elseif($have[$k] -ne $want[$k]){ Write-Warn "远程 tag $k 不一致! 远程=$($have[$k].Substring(0,7)) 本地=$($want[$k].Substring(0,7)). 需带 -f 谨慎强推" }
        else { Write-Ok "tag $k 一致 ($($want[$k].Substring(0,7)))" }
      }
      if(-not $ExecuteCleanup){ Write-Host "`n提示: 此模式默认仅列出差异. 确认后加 -ExecuteCleanup 执行归档+删除." -ForegroundColor Yellow }
    }
  }
} finally { Pop-Location }
