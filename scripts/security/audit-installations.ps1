# =============================================================================
# 自动安装活动审计脚本
# =============================================================================
# 作用范围：当前用户账户
# 功能：扫描近期 npm/pip 安装记录，生成审计报告
# 执行方式：PowerShell 中运行
#   .\scripts\security\audit-installations.ps1
#   .\scripts\security\audit-installations.ps1 -Days 7
# =============================================================================

#Requires -Version 5.1
<#
.SYNOPSIS
    审计近期自动安装活动，生成安全报告
.DESCRIPTION
    1. 扫描 npm 全局安装记录
    2. 扫描 pip 全局安装记录
    3. 检查 .trae/mcp.json 变更
    4. 检查环境变量是否被篡改
    5. 输出审计报告（含风险等级标记）
.PARAMETER Days
    回溯天数（默认 7 天）
#>

param(
    [int]$Days = 7
)

$ErrorActionPreference = 'Continue'
$SCRIPT_NAME = 'audit-installations'
$AUDIT_LOG_DIR = "$env:USERPROFILE\.trae-security\logs"
$AUDIT_LOG_FILE = "$AUDIT_LOG_DIR\install-audit.log"
$REPORT_FILE = "$AUDIT_LOG_DIR\audit-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"

# 确保日志目录存在
if (-not (Test-Path $AUDIT_LOG_DIR)) {
    New-Item -ItemType Directory -Force -Path $AUDIT_LOG_DIR | Out-Null
}

# 审计结果收集
$findings = [System.Collections.ArrayList]::new()

function Add-Finding {
    param(
        [string]$Category,
        [string]$Item,
        [string]$Status,      # OK / WARN / RISK
        [string]$Detail
    )
    $findings.Add([PSCustomObject]@{
        Timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        Category  = $Category
        Item      = $Item
        Status    = $Status
        Detail    = $Detail
    }) | Out-Null
}

Write-Host "正在审计最近 $Days 天的安装活动..." -ForegroundColor Cyan

# === 1. npm 全局包审计 ===
Write-Host "`n[1/5] 审计 npm 全局包..." -ForegroundColor Cyan
try {
    $npmGlobal = npm list -g --depth=0 --json 2>$null | ConvertFrom-Json
    $npmPackages = $npmGlobal.dependencies.PSObject.Properties
    foreach ($pkg in $npmPackages) {
        $pkgName = $pkg.Name
        $pkgVersion = $pkg.Value.version
        $installDate = $pkg.Value.'_resolved'

        # 检查是否为受信任包
        $trustedNpm = @('npm', 'pnpm', 'yarn', 'typescript', 'tsx', '@playwright/test', '@playwright/mcp')
        if ($trustedNpm -contains $pkgName) {
            Add-Finding 'npm-global' $pkgName 'OK' "版本 $pkgVersion（受信任包）"
        } else {
            Add-Finding 'npm-global' $pkgName 'WARN' "版本 $pkgVersion（非白名单包，请确认来源）"
        }
    }
    Write-Host "  发现 $($findings | Where-Object Category -eq 'npm-global' | Measure-Object | Select -ExpandProperty Count) 个全局包" -ForegroundColor Green
} catch {
    Add-Finding 'npm-global' 'npm-list' 'RISK' "无法读取 npm 全局包列表: $_"
    Write-Host "  读取失败: $_" -ForegroundColor Red
}

# === 2. pip 全局包审计 ===
Write-Host "`n[2/5] 审计 pip 全局包..." -ForegroundColor Cyan
try {
    $pipList = pip list --format=json 2>$null | ConvertFrom-Json
    $trustedPip = @('pip', 'setuptools', 'wheel', 'playwright', 'requests', 'numpy', 'pandas')
    foreach ($pkg in $pipList) {
        if ($trustedPip -contains $pkg.name) {
            Add-Finding 'pip-global' $pkg.name 'OK' "版本 $($pkg.version)（受信任包）"
        } else {
            Add-Finding 'pip-global' $pkg.name 'WARN' "版本 $($pkg.version)（非白名单包）"
        }
    }
    $pipCount = ($findings | Where-Object Category -eq 'pip-global' | Measure-Object).Count
    Write-Host "  发现 $pipCount 个全局包" -ForegroundColor Green
} catch {
    Add-Finding 'pip-global' 'pip-list' 'RISK' "无法读取 pip 全局包列表: $_"
    Write-Host "  读取失败: $_" -ForegroundColor Red
}

# === 3. Trae MCP 配置变更审计 ===
Write-Host "`n[3/5] 审计 Trae MCP 配置..." -ForegroundColor Cyan
$traeMcpFile = ".trae\mcp.json"
if (Test-Path $traeMcpFile) {
    $mcpContent = Get-Content $traeMcpFile -Raw | ConvertFrom-Json
    $mcpServers = $mcpContent.mcpServers.PSObject.Properties
    foreach ($server in $mcpServers) {
        $serverName = $server.Name
        $command = $server.Value.command
        $args = $server.Value.args -join ' '

        # 检查是否使用 npx（可能执行任意远程代码）
        if ($command -eq 'npx') {
            $trustedPackages = @('@playwright/mcp', '@modelcontextprotocol/server-github', '@executeautomation/playwright-mcp-server')
            $isTrusted = $false
            foreach ($trusted in $trustedPackages) {
                if ($args -like "*$trusted*") {
                    $isTrusted = $true
                    break
                }
            }
            if ($isTrusted) {
                Add-Finding 'trae-mcp' $serverName 'OK' "command=$command args=$args（受信任包）"
            } else {
                Add-Finding 'trae-mcp' $serverName 'RISK' "command=$command args=$args（非白名单 npx 包，可执行任意远程代码）"
            }
        } else {
            Add-Finding 'trae-mcp' $serverName 'WARN' "command=$command args=$args（非 npx 启动，需人工确认）"
        }
    }
    Write-Host "  发现 $(($findings | Where-Object Category -eq 'trae-mcp' | Measure-Object).Count) 个 MCP Server" -ForegroundColor Green
} else {
    Add-Finding 'trae-mcp' '.trae/mcp.json' 'OK' '文件不存在（无 MCP 配置）'
    Write-Host "  .trae/mcp.json 不存在" -ForegroundColor Yellow
}

# === 4. 环境变量完整性检查 ===
Write-Host "`n[4/5] 审计环境变量..." -ForegroundColor Cyan
$expectedRegistry = 'https://registry.npmmirror.com'
$actualRegistry = [Environment]::GetEnvironmentVariable('npm_config_registry', 'User')
if ($actualRegistry -eq $expectedRegistry) {
    Add-Finding 'env-var' 'npm_config_registry' 'OK' "值符合预期: $actualRegistry"
} elseif ($null -eq $actualRegistry) {
    Add-Finding 'env-var' 'npm_config_registry' 'WARN' '未设置（使用 npm 默认 registry）'
} else {
    Add-Finding 'env-var' 'npm_config_registry' 'RISK' "值被篡改: $actualRegistry（预期: $expectedRegistry）"
}

# === 5. PowerShell 执行策略检查 ===
Write-Host "`n[5/5] 审计执行策略..." -ForegroundColor Cyan
$execPolicy = Get-ExecutionPolicy -Scope CurrentUser
if ($execPolicy -eq 'RemoteSigned') {
    Add-Finding 'exec-policy' 'CurrentUser' 'OK' "RemoteSigned（安全）"
} elseif ($execPolicy -eq 'Unrestricted' -or $execPolicy -eq 'Bypass') {
    Add-Finding 'exec-policy' 'CurrentUser' 'RISK' "$execPolicy（不安全！允许运行未签名脚本）"
} else {
    Add-Finding 'exec-policy' 'CurrentUser' 'WARN' "$execPolicy（需评估）"
}

# === 生成审计报告 ===
$report = @"
# 自动安装活动审计报告

- **生成时间**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- **回溯天数**: $Days 天
- **审计范围**: 当前用户账户
- **策略版本**: 1.0.0

## 审计摘要

| 状态 | 数量 |
|------|------|
| OK   | $(($findings | Where-Object Status -eq 'OK' | Measure-Object).Count) |
| WARN | $(($findings | Where-Object Status -eq 'WARN' | Measure-Object).Count) |
| RISK | $(($findings | Where-Object Status -eq 'RISK' | Measure-Object).Count) |

## 详细发现

| 时间 | 类别 | 项目 | 状态 | 详情 |
|------|------|------|------|------|
"@

foreach ($f in $findings) {
    $statusEmoji = switch ($f.Status) {
        'OK'   { '✓' }
        'WARN' { '⚠' }
        'RISK' { '✗' }
    }
    $report += "`n| $($f.Timestamp) | $($f.Category) | $($f.Item) | $statusEmoji $($f.Status) | $($f.Detail) |"
}

$report += @"

## 风险项处置建议

"@

$riskItems = $findings | Where-Object Status -eq 'RISK'
if ($riskItems) {
    foreach ($r in $riskItems) {
        $report += "`n- **[$($r.Category)] $($r.Item)**: $($r.Detail)"
        $report += "`n  - 建议立即检查来源，确认为受信任包后加入白名单，否则卸载"
    }
} else {
    $report += "`n无高风险项。"
}

$report += @"

## 回滚方式

如需回滚安全策略，执行：
```powershell
.\scripts\security\setup-install-policy.ps1  # 重新运行会覆盖配置
```

或手动回滚（参见 setup-install-policy.ps1 末尾回滚段）
"@

Set-Content -Path $REPORT_FILE -Value $report -Encoding UTF8

# 追加审计日志
$auditEntry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] [$SCRIPT_NAME] 审计完成 | 报告: $REPORT_FILE | 发现: OK=$(($findings | Where-Object Status -eq 'OK' | Measure-Object).Count) WARN=$(($findings | Where-Object Status -eq 'WARN' | Measure-Object).Count) RISK=$(($findings | Where-Object Status -eq 'RISK' | Measure-Object).Count)"
Add-Content -Path $AUDIT_LOG_FILE -Value $auditEntry -Encoding UTF8

# 控制台输出
Write-Host "`n========================================" -ForegroundColor Green
Write-Host " 审计完成" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "报告已保存: $REPORT_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "摘要:" -ForegroundColor Yellow
Write-Host "  OK  : $(($findings | Where-Object Status -eq 'OK' | Measure-Object).Count)" -ForegroundColor Green
Write-Host "  WARN: $(($findings | Where-Object Status -eq 'WARN' | Measure-Object).Count)" -ForegroundColor Yellow
Write-Host "  RISK: $(($findings | Where-Object Status -eq 'RISK' | Measure-Object).Count)" -ForegroundColor Red
Write-Host ""
