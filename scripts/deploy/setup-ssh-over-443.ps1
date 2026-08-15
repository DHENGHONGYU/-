# ╔══════════════════════════════════════════════════════════════════╗
# ║  FinSightV9 — SSH over 443 配置脚本 (绕开企业防火墙 22 端口封禁) ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# 使用方法 (在 PowerShell 中执行):
#   powershell -ExecutionPolicy Bypass -File scripts/deploy/setup-ssh-over-443.ps1
#
# 前置条件:
#   - 已安装 Git for Windows (含 ssh-keygen)
#   - 已安装 GitHub CLI (gh)
#   - GitHub 账号已登录: gh auth login
#

param(
    [string]$GitHost = "ssh.github.com",
    [int]$GitPort = 443,
    [string]$KeyType = "ed25519",
    [string]$KeyComment = "FinSightV9-Deploy",
    [string]$RemoteName = "origin"
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot

Set-Location $projectRoot

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  FinSightV9 — SSH over 443 配置脚本                              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 1: 检查前置依赖
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [1/6] 检查前置依赖 ━━━" -ForegroundColor Yellow

$sshKeygen = Get-Command ssh-keygen -ErrorAction SilentlyContinue
if (-not $sshKeygen) {
    Write-Host "   ❌ ssh-keygen 未找到，请安装 Git for Windows" -ForegroundColor Red
    Write-Host "   下载: https://git-scm.com/download/win" -ForegroundColor Cyan
    exit 1
}
Write-Host "   ✅ ssh-keygen 可用" -ForegroundColor Green

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Host "   ❌ GitHub CLI (gh) 未找到" -ForegroundColor Red
    Write-Host "   安装: winget install GitHub.cli" -ForegroundColor Cyan
    exit 1
}
Write-Host "   ✅ GitHub CLI 可用" -ForegroundColor Green

$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ GitHub CLI 未登录" -ForegroundColor Red
    Write-Host "   执行: gh auth login" -ForegroundColor Cyan
    exit 1
}
Write-Host "   ✅ GitHub CLI 已登录" -ForegroundColor Green

Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 2: 生成 SSH 密钥 (如不存在)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [2/6] 生成 SSH 密钥 ━━━" -ForegroundColor Yellow

$sshDir = "$env:USERPROFILE\.ssh"
$keyPath = "$sshDir\id_ed25519_finSightV9"
$pubKeyPath = "$keyPath.pub"

if (Test-Path $keyPath) {
    Write-Host "   密钥已存在: $keyPath" -ForegroundColor Gray
    $continue = Read-Host "   是否重新生成? (y/N)"
    if ($continue -ne "y") {
        Write-Host "   跳过密钥生成" -ForegroundColor Gray
    } else {
        Remove-Item $keyPath, $pubKeyPath -Force
        Write-Host "   已删除旧密钥" -ForegroundColor Yellow
        ssh-keygen -t $KeyType -C $KeyComment -f $keyPath -N '""'
        Write-Host "   ✅ 新密钥已生成" -ForegroundColor Green
    }
} else {
    Write-Host "   生成 $KeyType 密钥..." -ForegroundColor Gray
    ssh-keygen -t $KeyType -C $KeyComment -f $keyPath -N '""'
    Write-Host "   ✅ 密钥已生成: $keyPath" -ForegroundColor Green
}

$publicKey = Get-Content $pubKeyPath -ErrorAction SilentlyContinue
if (-not $publicKey) {
    Write-Host "   ❌ 无法读取公钥" -ForegroundColor Red
    exit 1
}
Write-Host "   公钥内容:" -ForegroundColor Gray
Write-Host "   $publicKey" -ForegroundColor Gray
Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 3: 添加公钥到 GitHub
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [3/6] 添加公钥到 GitHub ━━━" -ForegroundColor Yellow

$keys = gh ssh-key list 2>&1
if ($keys -match $KeyComment) {
    Write-Host "   公钥已存在于 GitHub" -ForegroundColor Gray
    $addAgain = Read-Host "   是否重新添加? (y/N)"
    if ($addAgain -ne "y") {
        Write-Host "   跳过" -ForegroundColor Gray
        $skipAdd = $true
    } else {
        $skipAdd = $false
    }
} else {
    $skipAdd = $false
}

if (-not $skipAdd) {
    Write-Host "   添加公钥到 GitHub..." -ForegroundColor Gray
    $pubKeyContent = Get-Content $pubKeyPath -Raw
    echo $pubKeyContent | gh ssh-key add -t "$KeyType" --title $KeyComment 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ 公钥已添加到 GitHub" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  自动添加失败，请手动操作:" -ForegroundColor Yellow
        Write-Host "   1. 打开 https://github.com/settings/ssh/new" -ForegroundColor White
        Write-Host "   2. Title: $KeyComment" -ForegroundColor White
        Write-Host "   3. Key type: Authentication Key" -ForegroundColor White
        Write-Host "   4. 粘贴以下公钥内容:" -ForegroundColor White
        Write-Host ""
        Write-Host $publicKey -ForegroundColor Cyan
        Write-Host ""
        Read-Host "   添加完成后按 Enter 继续"
    }
}
Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 4: 配置 SSH config (443 端口 + 主机别名)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [4/6] 配置 SSH config (端口 443) ━━━" -ForegroundColor Yellow

$configPath = "$sshDir\config"
$blockStart = "# >>> FinSightV9 SSH over 443 >>>"
$blockEnd = "# <<< FinSightV9 SSH over 443 <<<"

$sshConfigBlock = @"
$blockStart
Host github.com
    HostName $GitHost
    Port $GitPort
    User git
    IdentityFile $keyPath
    StrictHostKeyChecking accept-new
    ServerAliveInterval 60
    ServerAliveCountMax 3
$blockEnd
"@

if (Test-Path $configPath) {
    $existing = Get-Content $configPath -Raw
    if ($existing -match [regex]::Escape($blockStart)) {
        Write-Host "   SSH config 已存在配置块，跳过写入" -ForegroundColor Gray
    } else {
        Add-Content -Path $configPath -Value ""
        Add-Content -Path $configPath -Value $sshConfigBlock
        Write-Host "   ✅ SSH config 已追加" -ForegroundColor Green
    }
} else {
    $sshConfigBlock | Out-File -FilePath $configPath -Encoding UTF8
    Write-Host "   ✅ SSH config 已创建" -ForegroundColor Green
}

Write-Host "   配置预览:" -ForegroundColor Gray
Write-Host "   ┌─────────────────────────────────────────────┐" -ForegroundColor Gray
Get-Content $configPath | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-Host "   └─────────────────────────────────────────────┘" -ForegroundColor Gray
Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 5: 测试 SSH 连接
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [5/6] 测试 SSH over 443 连接 ━━━" -ForegroundColor Yellow

Write-Host "   尝试连接 $GitHost`:$GitPort ..." -ForegroundColor Gray
$sshTest = ssh -T -p $GitPort git@github.com -o ConnectTimeout=10 2>&1
$sshExit = $LASTEXITCODE

if ($sshTest -match "successfully|authenticated") {
    Write-Host "   ✅ SSH over 443 连接成功!" -ForegroundColor Green
    Write-Host "   $sshTest" -ForegroundColor Gray
} elseif ($sshExit -eq 0) {
    Write-Host "   ✅ SSH 连接建立" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  连接测试返回: $sshTest" -ForegroundColor Yellow
    Write-Host "   这可能是正常的 (首次连接会有警告)" -ForegroundColor Gray
    Write-Host "   如果看到 'Hi DHENGHONGYU!' 则表示完全成功" -ForegroundColor Cyan
}
Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 6: 切换远程为 SSH 并推送
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "━━━ [6/6] 切换 Git 远程并推送 ━━━" -ForegroundColor Yellow

$currentRemote = git remote get-url $RemoteName 2>&1
Write-Host "   当前远程: $currentRemote" -ForegroundColor Gray

$sshUrl = "git@github.com:DHENGHONGYU/-.git"
Write-Host "   切换为 SSH: $sshUrl" -ForegroundColor Gray

git remote set-url $RemoteName $sshUrl
$newRemote = git remote get-url $RemoteName 2>&1
Write-Host "   ✅ 远程已更新: $newRemote" -ForegroundColor Green

Write-Host ""
Write-Host "   推送本地提交..." -ForegroundColor Gray
git push origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "   🎉 推送成功!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "   ❌ 推送失败" -ForegroundColor Red
    Write-Host "   可能原因:" -ForegroundColor Yellow
    Write-Host "   1. SSH 密钥未添加到 GitHub — 重新执行 Step 3" -ForegroundColor White
    Write-Host "   2. 网络不通 — 确认企业网络允许 $GitHost`:$GitPort" -ForegroundColor White
    Write-Host "   3. 仓库权限 — 确认有 DHENGHONGYU/- 的 push 权限" -ForegroundColor White
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 完成
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  配置完成!                                                       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  密钥路径: $keyPath" -ForegroundColor White
Write-Host "  SSH Config: $configPath" -ForegroundColor White
Write-Host "  远程 URL: $sshUrl" -ForegroundColor White
Write-Host "  推送命令: git push origin main" -ForegroundColor White
Write-Host ""
Write-Host "  ⏮️  回退到 HTTPS (如需要):" -ForegroundColor Yellow
Write-Host "     git remote set-url origin https://github.com/DHENGHONGYU/-.git" -ForegroundColor Gray
Write-Host ""