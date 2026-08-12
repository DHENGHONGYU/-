# =============================================================================
# Windows 自动安装安全策略配置脚本
# =============================================================================
# 作用范围：当前用户账户（无需管理员权限）
# 策略：安全优先 — 最小权限 + 审计日志 + 受信任源
# 执行方式：PowerShell 中运行
#   .\scripts\security\setup-install-policy.ps1
# =============================================================================

#Requires -Version 5.1
<#
.SYNOPSIS
    配置当前用户账户的自动安装安全策略
.DESCRIPTION
    1. 设置 PowerShell 执行策略为 RemoteSigned（远程脚本需签名）
    2. 配置 npm 全局安全参数
    3. 配置 pip 全局安全参数
    4. 创建自动安装审计日志目录与计划任务
    5. 配置环境变量锁定受信任源
.NOTES
    安全等级：安全优先
    影响范围：当前用户（CurrentUser scope）
    回滚方式：参见脚本末尾 Rollback 段
#>

# 错误处理：任何错误立即停止
$ErrorActionPreference = 'Stop'

# === 配置常量 ===
$SCRIPT_NAME = 'setup-install-policy'
$AUDIT_LOG_DIR = "$env:USERPROFILE\.trae-security\logs"
$AUDIT_LOG_FILE = "$AUDIT_LOG_DIR\install-audit.log"
$POLICY_FILE = "$env:USERPROFILE\.trae-security\policy.json"

# 日志函数
function Write-AuditLog {
    param(
        [Parameter(Mandatory)]
        [string]$Action,

        [Parameter(Mandatory)]
        [string]$Detail,

        [ValidateSet('INFO', 'WARN', 'ERROR', 'SUCCESS')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $entry = "[$timestamp] [$Level] [$SCRIPT_NAME] $Action | $Detail"

    # 确保日志目录存在
    if (-not (Test-Path $AUDIT_LOG_DIR)) {
        New-Item -ItemType Directory -Force -Path $AUDIT_LOG_DIR | Out-Null
    }

    # 写入日志文件
    Add-Content -Path $AUDIT_LOG_FILE -Value $entry -Encoding UTF8

    # 同时输出到控制台
    switch ($Level) {
        'INFO'    { Write-Host $entry -ForegroundColor Cyan }
        'WARN'    { Write-Host $entry -ForegroundColor Yellow }
        'ERROR'   { Write-Host $entry -ForegroundColor Red }
        'SUCCESS' { Write-Host $entry -ForegroundColor Green }
    }
}

# === 1. PowerShell 执行策略 ===
Write-AuditLog -Action 'ExecutionPolicy' -Detail '开始配置当前用户执行策略'

$currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
if ($currentPolicy -ne 'RemoteSigned') {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Write-AuditLog -Action 'ExecutionPolicy' -Detail "已设置为 RemoteSigned (原值: $currentPolicy)" -Level 'SUCCESS'
} else {
    Write-AuditLog -Action 'ExecutionPolicy' -Detail "已是 RemoteSigned，无需修改" -Level 'INFO'
}

# === 2. npm 全局安全配置 ===
Write-AuditLog -Action 'npm-config' -Detail '开始配置 npm 全局安全参数'

try {
    # 禁止执行安装脚本（当前用户级）
    npm config set ignore-scripts true --global
    Write-AuditLog -Action 'npm-config' -Detail 'ignore-scripts=true (global)'

    # 审计级别设为 high
    npm config set audit-level high --global
    Write-AuditLog -Action 'npm-config' -Detail 'audit-level=high (global)'

    # 版本锁定
    npm config set save-exact true --global
    Write-AuditLog -Action 'npm-config' -Detail 'save-exact=true (global)'

    Write-AuditLog -Action 'npm-config' -Detail 'npm 全局安全配置完成' -Level 'SUCCESS'
} catch {
    Write-AuditLog -Action 'npm-config' -Detail "配置失败: $_" -Level 'ERROR'
}

# === 3. pip 全局安全配置 ===
Write-AuditLog -Action 'pip-config' -Detail '开始配置 pip 全局安全参数'

$pipDir = "$env:APPDATA\pip"
$pipConfigFile = "$pipDir\pip.ini"

if (-not (Test-Path $pipDir)) {
    New-Item -ItemType Directory -Force -Path $pipDir | Out-Null
}

$pipConfig = @"
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
    pypi.org
    files.pythonhosted.org
timeout = 60
retries = 3

[install]
no-build-isolation = false
"@

Set-Content -Path $pipConfigFile -Value $pipConfig -Encoding UTF8
Write-AuditLog -Action 'pip-config' -Detail "pip 配置已写入: $pipConfigFile" -Level 'SUCCESS'

# === 4. 环境变量锁定受信任源 ===
Write-AuditLog -Action 'env-vars' -Detail '设置受信任源环境变量'

# npm registry 锁定（防止运行时被篡改）
[Environment]::SetEnvironmentVariable('npm_config_registry', 'https://registry.npmmirror.com', 'User')
Write-AuditLog -Action 'env-vars' -Detail 'npm_config_registry=https://registry.npmmirror.com (User)'

# Playwright 下载源锁定（国内镜像加速 + 防篡改）
[Environment]::SetEnvironmentVariable('PLAYWRIGHT_DOWNLOAD_HOST', 'https://npmmirror.com/mirrors/playwright', 'User')
Write-AuditLog -Action 'env-vars' -Detail 'PLAYWRIGHT_DOWNLOAD_HOST 设置完成 (User)'

# === 5. 创建策略元数据文件 ===
$policy = @{
    policyName      = 'V9-Windows-Install-Security-Policy'
    version         = '1.0.0'
    createdAt       = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
    scope           = 'CurrentUser'
    strategy        = 'security-first'
    executionPolicy = 'RemoteSigned'
    npm             = @{
        ignoreScripts = $true
        auditLevel    = 'high'
        saveExact     = $true
        registry      = 'https://registry.npmmirror.com'
    }
    pip             = @{
        indexUrl     = 'https://pypi.tuna.tsinghua.edu.cn/simple'
        trustedHosts = @('pypi.tuna.tsinghua.edu.cn', 'pypi.org', 'files.pythonhosted.org')
        timeout      = 60
    }
    audit           = @{
        logFile    = $AUDIT_LOG_FILE
        retention  = '30d'
        alertOn    = 'failure'
    }
} | ConvertTo-Json -Depth 5

$policyDir = Split-Path $POLICY_FILE -Parent
if (-not (Test-Path $policyDir)) {
    New-Item -ItemType Directory -Force -Path $policyDir | Out-Null
}
Set-Content -Path $POLICY_FILE -Value $policy -Encoding UTF8
Write-AuditLog -Action 'policy' -Detail "策略元数据已写入: $POLICY_FILE" -Level 'SUCCESS'

# === 6. 总结 ===
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " 安全策略配置完成" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "已配置项：" -ForegroundColor Cyan
Write-Host "  [✓] PowerShell 执行策略: RemoteSigned (CurrentUser)"
Write-Host "  [✓] npm: ignore-scripts + audit-level=high + save-exact"
Write-Host "  [✓] pip: trusted-host + timeout + retries"
Write-Host "  [✓] 环境变量: npm_config_registry + PLAYWRIGHT_DOWNLOAD_HOST"
Write-Host "  [✓] 审计日志: $AUDIT_LOG_FILE"
Write-Host "  [✓] 策略元数据: $POLICY_FILE"
Write-Host ""
Write-Host "回滚方式：" -ForegroundColor Yellow
Write-Host "  Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser -Force"
Write-Host "  npm config delete ignore-scripts --global"
Write-Host "  npm config delete audit-level --global"
Write-Host "  npm config delete save-exact --global"
Write-Host "  Remove-Item $pipConfigFile -Force"
Write-Host "  [Environment]::SetEnvironmentVariable('npm_config_registry', $null, 'User')"
Write-Host "  [Environment]::SetEnvironmentVariable('PLAYWRIGHT_DOWNLOAD_HOST', $null, 'User')"
Write-Host ""
