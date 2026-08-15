#Requires -Version 5.1
<#
api-restart-regression.ps1 - FinSightV9 API 重启回归测试

目的（2026-08-16 部署验证）：
  验证 docker compose 全链路（frontend / data-collector / embedding）在容器重启后
  所有 API 接口依然正常响应。上线前必跑（真实数据，禁止 MOCK）。

覆盖矩阵：
  1. collector  /health                 （直连 8000）
  2. embedding  /health                 （直连 8001）
  3. frontend   /                       （Vite 页面，经 5199）
  4. frontend   /health                 （Vite 代理 -> data-collector）
  5. frontend   POST /api/collect/basic （真实行情：腾讯/AKShare 多源回退）
  6. frontend   POST /api/collect/kline （真实 K 线：腾讯 ifzq 接口）
  7. frontend   POST /api/collect/sectors（申万板块评分，较慢，默认包含）
  8. frontend   POST /api/embed         （embedding sidecar，返回 384 维向量）
  -IncludeSlow 追加：POST /api/collect/financial（财报 PDF 解析，外部依赖大）

用法：
  # 仅测试（不重启容器）
  powershell -ExecutionPolicy Bypass -File scripts/api-restart-regression.ps1

  # 重启容器后自动测试（推荐：验证重启恢复能力）
  powershell -ExecutionPolicy Bypass -File scripts/api-restart-regression.ps1 -Restart

  # 自定义地址 / 加慢接口
  powershell -ExecutionPolicy Bypass -File scripts/api-restart-regression.ps1 -Restart -IncludeSlow

退出码：
  0 = 全部通过
  1 = 存在失败项
  2 = 健康等待超时（服务未恢复）
#>
[CmdletBinding()]
param(
    [string]$FrontendUrl = "http://127.0.0.1:5199",
    [string]$CollectorUrl = "http://127.0.0.1:8000",
    [string]$EmbedUrl = "http://127.0.0.1:8001",
    [string]$Symbol = "000001",

    # 先重启容器再测试（docker compose restart + embedding 容器 restart）
    [switch]$Restart,

    # 健康等待上限（秒），重启后 uvicorn/模型加载需要时间
    [int]$TimeoutSec = 180,

    # 追加慢接口（financial：财报 PDF 抓取 + 解析）
    [switch]$IncludeSlow
)

$ErrorActionPreference = 'Continue'
$script:Results = New-Object System.Collections.Generic.List[object]

function Write-Section([string]$msg) {
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor DarkGray
    Write-Host $msg -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor DarkGray
}

function Invoke-JsonTest {
    <#
    通用测试项：GET/POST + HTTP 200 断言 + 可选业务字段断言
    返回 $true/$false，并记录到 $script:Results
    #>
    param(
        [string]$Name,
        [string]$Method = 'GET',
        [string]$Url,
        [string]$Body = $null,
        [scriptblock]$Validate = $null,   # 接收响应对象，返回 $true/$false
        [int]$ReqTimeoutSec = 60
    )
    $t0 = Get-Date
    $ok = $false
    $detail = ''
    try {
        $params = @{
            Uri             = $Url
            Method          = $Method
            TimeoutSec      = $ReqTimeoutSec
            UseBasicParsing = $true
            ErrorAction     = 'Stop'
        }
        if ($Body) { $params.ContentType = 'application/json; charset=utf-8'; $params.Body = $Body }
        $resp = Invoke-WebRequest @params
        if ($resp.StatusCode -eq 200) {
            if ($Validate) {
                $parsed = $null
                try { $parsed = $resp.Content | ConvertFrom-Json } catch {}
                $ok = & $Validate $parsed $resp
                if (-not $ok) { $detail = "业务断言失败: $($resp.Content.Substring(0, [Math]::Min(120, $resp.Content.Length)))" }
            } else {
                $ok = $true
            }
        } else {
            $detail = "HTTP $($resp.StatusCode)"
        }
    } catch {
        $detail = $_.Exception.Message
        if ($detail.Length -gt 160) { $detail = $detail.Substring(0, 160) }
    }
    $elapsed = [int]((Get-Date) - $t0).TotalMilliseconds
    $status = if ($ok) { 'PASS' } else { 'FAIL' }
    $color = if ($ok) { 'Green' } else { 'Red' }
    Write-Host ("[{0}] {1,-42} {2,5}ms  {3}" -f $status, $Name, $elapsed, $detail) -ForegroundColor $color
    $script:Results.Add([pscustomobject]@{ Name = $Name; Status = $status; Ms = $elapsed; Detail = $detail })
    return $ok
}

# ---------------------------------------------------------------------------
# 0. 可选：重启容器
# ---------------------------------------------------------------------------
if ($Restart) {
    Write-Section "重启容器（docker compose restart + embedding 容器）"
    # frontend 依赖 data-collector 健康检查，顺序 restart 会自动级联等待
    docker compose restart data-collector frontend 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) { Write-Host "[FATAL] docker compose restart 失败" -ForegroundColor Red; exit 2 }
    # embedding-service 是同网络的独立容器（不在当前 compose 服务清单中）
    docker restart v9-embedding-service 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    Write-Host "容器重启指令已发出，等待服务恢复..." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 1. 等待健康（重启后 uvicorn 启动 / embedding 模型加载 / Vite dev server 就绪）
# ---------------------------------------------------------------------------
Write-Section "等待服务健康（上限 ${TimeoutSec}s）"
$healthy = $false
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    $c = $e = $f = $false
    try { $c = ((Invoke-WebRequest -Uri "$CollectorUrl/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop).Content | ConvertFrom-Json).status -eq 'ok' } catch {}
    try { $e = ((Invoke-WebRequest -Uri "$EmbedUrl/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop).Content | ConvertFrom-Json).status -eq 'ok' } catch {}
    try { $f = (Invoke-WebRequest -Uri "$FrontendUrl/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop).StatusCode -eq 200 } catch {}
    if ($c -and $e -and $f) { $healthy = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $healthy) {
    Write-Host "[TIMEOUT] ${TimeoutSec}s 内服务未恢复健康（collector/embedding/frontend）" -ForegroundColor Red
    Write-Host "排查：docker compose ps && docker compose logs --tail 50 data-collector frontend"
    exit 2
}
Write-Host ("健康就绪，耗时 {0:N0}s" -f $sw.Elapsed.TotalSeconds) -ForegroundColor Green

# ---------------------------------------------------------------------------
# 2. API 回归矩阵
# ---------------------------------------------------------------------------
Write-Section "API 回归测试矩阵（symbol=$Symbol）"

# 1) collector /health 直连
Invoke-JsonTest -Name 'collector /health (direct 8000)' -Url "$CollectorUrl/health" `
    -Validate { param($j) $j.status -eq 'ok' } | Out-Null

# 2) embedding /health 直连
Invoke-JsonTest -Name 'embedding /health (direct 8001)' -Url "$EmbedUrl/health" `
    -Validate { param($j) $j.status -eq 'ok' -and $j.model_loaded } | Out-Null

# 3) frontend 首页
Invoke-JsonTest -Name 'frontend / (vite, 5199)' -Url "$FrontendUrl/" | Out-Null

# 4) frontend /health 经 Vite 代理
Invoke-JsonTest -Name 'frontend /health (vite proxy)' -Url "$FrontendUrl/health" `
    -Validate { param($j) $j.status -eq 'ok' -and $j.service -eq 'v9-data-collector' } | Out-Null

# 5) POST /api/collect/basic（真实行情）
$basicBody = @{ symbol = $Symbol } | ConvertTo-Json -Compress
Invoke-JsonTest -Name 'POST /api/collect/basic (real quote)' -Url "$FrontendUrl/api/collect/basic" `
    -Method POST -Body $basicBody -ReqTimeoutSec 60 `
    -Validate { param($j) $j.success -eq $true -and $j.data.name } | Out-Null

# 6) POST /api/collect/kline（真实 K 线）
$klineBody = @{ symbol = $Symbol; period = 'daily'; count = 30 } | ConvertTo-Json -Compress
Invoke-JsonTest -Name 'POST /api/collect/kline (real kline)' -Url "$FrontendUrl/api/collect/kline" `
    -Method POST -Body $klineBody -ReqTimeoutSec 60 `
    -Validate { param($j) $j.success -eq $true -and $j.records -gt 0 } | Out-Null

# 7) POST /api/collect/sectors（申万板块，较慢）
$sectorBody = @{ topN = 5 } | ConvertTo-Json -Compress
Invoke-JsonTest -Name 'POST /api/collect/sectors (SW industries)' -Url "$FrontendUrl/api/collect/sectors" `
    -Method POST -Body $sectorBody -ReqTimeoutSec 120 `
    -Validate { param($j) $j.success -eq $true } | Out-Null

# 8) POST /api/embed（embedding 向量）
$embedBody = @{ text = "api restart regression $Symbol" } | ConvertTo-Json -Compress
Invoke-JsonTest -Name 'POST /api/embed (vector 384d)' -Url "$FrontendUrl/api/embed" `
    -Method POST -Body $embedBody -ReqTimeoutSec 30 `
    -Validate { param($j) $j.vector -is [array] -and $j.vector.Count -gt 0 } | Out-Null

# 可选慢接口：financial（财报 PDF）
if ($IncludeSlow) {
    $finBody = @{ symbol = $Symbol } | ConvertTo-Json -Compress
    Invoke-JsonTest -Name 'POST /api/collect/financial (slow)' -Url "$FrontendUrl/api/collect/financial" `
        -Method POST -Body $finBody -ReqTimeoutSec 180 `
        -Validate { param($j) $j.success -eq $true } | Out-Null
}

# ---------------------------------------------------------------------------
# 3. 汇总
# ---------------------------------------------------------------------------
Write-Section "汇总"
$pass = @($script:Results | Where-Object Status -eq 'PASS').Count
$fail = @($script:Results | Where-Object Status -eq 'FAIL').Count
$totalMs = ($script:Results | Measure-Object Ms -Sum).Sum
Write-Host ("通过 {0} / {1}，失败 {2}，总耗时 {3:N0}ms" -f $pass, $script:Results.Count, $fail, $totalMs) `
    -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "失败项：" -ForegroundColor Red
    $script:Results | Where-Object Status -eq 'FAIL' | ForEach-Object { Write-Host ("  - {0}: {1}" -f $_.Name, $_.Detail) -ForegroundColor Red }
    Write-Host ""
    Write-Host "排查建议：docker compose logs --tail 100 data-collector frontend"
    exit 1
}
Write-Host "全部通过 - 重启回归 OK" -ForegroundColor Green
exit 0
