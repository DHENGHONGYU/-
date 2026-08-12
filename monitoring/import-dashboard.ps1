# import-dashboard.ps1 — 导入 chip-flow 仪表盘到 Grafana
# 适用于 PowerShell 5.1+
#
# 功能：
#   1. 拷贝最新的 .prom 文件到 monitoring/textfile/
#   2. 等待 Grafana 就绪
#   3. 通过 Grafana HTTP API 导入仪表盘（剥离 __inputs，替换 ${DS_PROMETHEUS}）
#   4. 打印仪表盘 URL

$ErrorActionPreference = 'Stop'

# ── 路径与配置 ──
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$OutputsDir = Join-Path $ProjectRoot 'outputs'
$TextfileDir = Join-Path $ScriptDir 'textfile'
$DashboardJsonPath = Join-Path $OutputsDir 'grafana-chip-flow-dashboard.json'

$GrafanaUrl = 'http://localhost:3000'
$GrafanaAuth = 'Basic YWRtaW46YWRtaW4='  # admin:admin base64
$DashboardUid = 'chip-flow-low-liq-v454'

# ── 步骤 1：拷贝最新的 .prom 文件到 textfile 目录 ──
Write-Host ''
Write-Host '[1/4] 拷贝 .prom 文件到 monitoring/textfile/...' -ForegroundColor Cyan
$promFiles = Get-ChildItem -Path $OutputsDir -Filter 'chip-flow-intercept-prometheus-*.prom' -ErrorAction SilentlyContinue | Sort-Object Name -Descending
if ($promFiles -and $promFiles.Count -gt 0) {
    $latestProm = $promFiles[0].FullName
    $destProm = Join-Path $TextfileDir 'chip-flow-intercept.prom'
    # 读取 .prom 文件，去除 client-side timestamps（node-exporter textfile collector 不支持）
    $promContent = [System.IO.File]::ReadAllText($latestProm)
    $promLines = $promContent -split "`r?`n"
    $fixedLines = @()
    foreach ($line in $promLines) {
        if ($line -match '^(chip_flow_\S+(?:\{[^}]*\})?\s+\S+)\s+\d+\s*$') {
            $fixedLines += $Matches[1]
        } else {
            $fixedLines += $line
        }
    }
    $promOutput = ($fixedLines -join "`n") + "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($destProm, $promOutput, $utf8NoBom)
    Write-Host "  已拷贝(去时间戳): $($promFiles[0].Name) -> chip-flow-intercept.prom" -ForegroundColor Green
} else {
    Write-Warning '未找到 outputs/chip-flow-intercept-prometheus-*.prom 文件，跳过拷贝。'
}

# ── 步骤 2：等待 Grafana 就绪 ──
Write-Host ''
Write-Host '[2/4] 等待 Grafana 就绪...' -ForegroundColor Cyan
$maxRetries = 30
$retryCount = 0
$ready = $false
while (-not $ready -and $retryCount -lt $maxRetries) {
    $retryCount++
    try {
        $response = Invoke-RestMethod -Uri "$GrafanaUrl/api/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
        if ($response.database -eq 'ok') {
            $ready = $true
            Write-Host "  Grafana 已就绪 (尝试 $retryCount 次)" -ForegroundColor Green
        }
    } catch {
        Write-Host "  等待中... ($retryCount/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}
if (-not $ready) {
    Write-Error 'Grafana 未就绪，请检查容器是否正常运行。'
    exit 1
}

# ── 步骤 3：读取并处理 dashboard JSON ──
Write-Host ''
Write-Host '[3/4] 处理并导入仪表盘...' -ForegroundColor Cyan
if (-not (Test-Path $DashboardJsonPath)) {
    Write-Error "仪表盘 JSON 文件不存在: $DashboardJsonPath"
    exit 1
}

# 读取原始 JSON
$dashboardJson = Get-Content -Path $DashboardJsonPath -Raw -Encoding UTF8

# 移除 __inputs 段（如果存在，用正则匹配 "  "__inputs": [...],"）
$processedJson = $dashboardJson -replace '(?s)\s*"__inputs"\s*:\s*\[.*?\],', ''

# 替换数据源变量引用为已置备的数据源 UID
$processedJson = $processedJson -replace '\$\{DS_PROMETHEUS\}', 'Prometheus'
$processedJson = $processedJson -replace '\$\{DS_CSV_INFINITY\}', 'Prometheus'

# 构建 Grafana 导入 payload（用字符串拼接避免 ConvertTo-Json 深度截断）
$importPayload = '{"dashboard": ' + $processedJson + ', "folderId": 0, "overwrite": true}'

# 转换为 UTF-8 字节（确保中文字符正确传输）
$bytes = [System.Text.Encoding]::UTF8.GetBytes($importPayload)

# 导入仪表盘
$headers = @{
    'Authorization' = $GrafanaAuth
}

try {
    $importResponse = Invoke-RestMethod -Uri "$GrafanaUrl/api/dashboards/db" -Method Post -Headers $headers -Body $bytes -ContentType 'application/json' -TimeoutSec 30
    if ($importResponse.status -eq 'success') {
        Write-Host "  仪表盘导入成功!" -ForegroundColor Green
        Write-Host "  URL: $($importResponse.url)" -ForegroundColor Green
    } else {
        Write-Warning "导入返回状态: $($importResponse.status)"
    }
} catch {
    $errorMsg = $_.Exception.Message
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
            Write-Error "导入仪表盘失败: $errorMsg`nResponse: $errorBody"
        } catch {
            Write-Error "导入仪表盘失败: $errorMsg"
        }
    } else {
        Write-Error "导入仪表盘失败: $errorMsg"
    }
    exit 1
}

# ── 步骤 4：打印仪表盘 URL ──
Write-Host ''
Write-Host '[4/4] 完成!' -ForegroundColor Cyan
$dashboardUrl = "$GrafanaUrl/d/$DashboardUid/chip-flow-dashboard"
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host "  仪表盘 URL: $dashboardUrl" -ForegroundColor White
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host "  Grafana:       $GrafanaUrl (admin/admin)" -ForegroundColor Gray
Write-Host "  Prometheus:    http://localhost:9090" -ForegroundColor Gray
Write-Host "  Node Exporter: http://localhost:9100" -ForegroundColor Gray
Write-Host ''
