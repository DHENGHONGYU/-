#requires -Version 5.1
<#
.SYNOPSIS
  安全轮换 .trae/mcp.json 中硬编码的 ARK_API_KEY。

.DESCRIPTION
  1. 读取当前 .trae/mcp.json，提取旧的 ARK_API_KEY。
  2. 提示输入从 Ark 控制台获取的新 API Key。
  3. 将新 Key 写入项目根目录 .env（PowerShell / Node 进程均可读取）。
  4. 生成使用环境变量引用的 .trae/mcp.json.new 提案文件。
  5. 打印后续手动步骤（废弃旧 Key、替换 mcp.json、验证 MCP Server）。

  注意：根据项目约束，AI 不能直接修改已存在的 .trae/mcp.json，
  因此本脚本仅生成 .trae/mcp.json.new，需用户手动确认后重命名覆盖。

.EXAMPLE
  .\scripts\rotate-ark-api-key.ps1
#>

[CmdletBinding()]
param(
  [string]$McpJsonPath = (Join-Path $PSScriptRoot '..' '.trae' 'mcp.json'),
  [string]$NewMcpJsonPath = (Join-Path $PSScriptRoot '..' '.trae' 'mcp.json.new'),
  [string]$EnvPath = (Join-Path $PSScriptRoot '..' '.env')
)

$ErrorActionPreference = 'Stop'

function Read-SecureStringAsPlain {
  param([string]$Prompt = '请输入新 API Key')
  Write-Host $Prompt -NoNewline
  $secure = Read-Host -AsSecureString
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Test-ArkKeyFormat {
  param([string]$Key)
  if ([string]::IsNullOrWhiteSpace($Key)) { return $false }
  return $Key -match '^ark-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]{5}$'
}

# 1. 读取并解析当前 mcp.json
$mcpJsonPath = Resolve-Path $McpJsonPath
Write-Host "[1/5] 读取当前 MCP 配置: $mcpJsonPath"
$mcpContent = Get-Content -Path $mcpJsonPath -Raw -Encoding UTF8
$mcp = $mcpContent | ConvertFrom-Json -Depth 10

$oldKey = $mcp.mcpServers.doubao.env.ARK_API_KEY
if (-not $oldKey) {
  throw '未在 .trae/mcp.json 的 mcpServers.doubao.env 中找到 ARK_API_KEY。'
}

if ($oldKey -eq '${ARK_API_KEY}') {
  Write-Host '当前 mcp.json 已经使用环境变量引用，无需替换。请直接修改 .env 中的 ARK_API_KEY。' -ForegroundColor Green
  return
}

Write-Host "  发现旧 Key: $oldKey" -ForegroundColor Yellow
Write-Host '  提醒：该 Key 已存在泄露风险，请立即在 Ark 控制台废弃。' -ForegroundColor Red

# 2. 输入新 Key
Write-Host "`n[2/5] 请输入新的 ARK_API_KEY（从 Ark 控制台重新生成）："
$newKey = Read-SecureStringAsPlain

if (-not (Test-ArkKeyFormat $newKey)) {
  throw "新 Key 格式不符合 Ark API Key 规范（示例：ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-xxxxx）。"
}

if ($newKey -eq $oldKey) {
  throw '新 Key 与旧 Key 相同，请确认已在 Ark 控制台完成轮换。'
}

# 3. 写入 .env
Write-Host "`n[3/5] 写入环境变量文件: $EnvPath"
$envLines = @(
  '# Ark（豆包）大模型 API Key'
  '# 本文件不进入版本控制，仅用于本地 MCP Server 启动时注入环境变量。'
  "ARK_API_KEY=$newKey"
  ''
)
$envLines | Set-Content -Path $EnvPath -Encoding UTF8 -NoNewline
Write-Host '  .env 已创建/更新。' -ForegroundColor Green

# 4. 生成新的 mcp.json 提案
Write-Host "`n[4/5] 生成环境变量化 MCP 配置提案: $NewMcpJsonPath"
$newMcp = $mcp | ConvertTo-Json -Depth 10
$newMcp = $newMcp -replace [regex]::Escape('"ARK_API_KEY": "' + $oldKey + '"'), '"ARK_API_KEY": "${ARK_API_KEY}"'
$newMcp | Set-Content -Path $NewMcpJsonPath -Encoding UTF8 -NoNewline
Write-Host '  .trae/mcp.json.new 已生成。' -ForegroundColor Green

# 5. 打印后续步骤
Write-Host "`n[5/5] 后续手动操作步骤（必须由用户执行）：" -ForegroundColor Cyan
Write-Host '  1. 登录 Ark 控制台 (https://console.volcengine.com/ark/)，废弃旧 Key：' -NoNewline
Write-Host $oldKey -ForegroundColor Yellow
Write-Host '  2. 确认 .env 中 ARK_API_KEY 已为新 Key。'
Write-Host "  3. 对比 .trae/mcp.json 与 .trae/mcp.json.new，确认无误后执行："
Write-Host "     Move-Item -Path '$NewMcpJsonPath' -Destination '$mcpJsonPath' -Force" -ForegroundColor Green
Write-Host '  4. 重启 Trae / MCP Server，验证 doubao MCP Server 可正常连接。'
Write-Host '  5. 将 .env 添加到 .gitignore（如尚未添加），避免再次泄露。'
Write-Host "`n完成。"
