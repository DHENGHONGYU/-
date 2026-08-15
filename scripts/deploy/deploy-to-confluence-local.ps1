# 本地 Confluence 部署脚本（无需 GitHub Secrets）
# 使用方式: .\deploy-to-confluence-local.ps1
# 功能: 直接调用 Confluence REST API 上传文档

param(
    [Parameter(Mandatory = $true)]
    [string]$ConfluenceUrl,

    [Parameter(Mandatory = $true)]
    [string]$ConfluenceToken,

    [Parameter(Mandatory = $true)]
    [string]$SpaceKey,

    [Parameter(Mandatory = $false)]
    [string]$ParentPageId = "",

    [Parameter(Mandatory = $false)]
    [string]$PageTitle = "组件命名规范与文档模板标准",

    [Parameter(Mandatory = $false)]
    [string]$PayloadFile = "outputs/wiki-deploy/confluence-payload.html",

    [switch]$UpdateExisting
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FinSightV9 → Confluence 本地部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 读取 Payload
if (-not (Test-Path $PayloadFile)) {
    Write-Host "❌ 找不到 Payload 文件: $PayloadFile" -ForegroundColor Red
    Write-Host "   请先运行: npx tsx scripts/deploy/deploy-to-confluence.ts" -ForegroundColor Yellow
    exit 1
}

$payloadContent = Get-Content $PayloadFile -Raw
Write-Host "✅ 已读取 Payload ($($payloadContent.Length) bytes)" -ForegroundColor Green

# 2. 构建认证头
$basicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ConfluenceToken"))
$headers = @{
    "Authorization" = "Basic $basicAuth"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

$apiUrl = "$ConfluenceUrl/wiki/rest/api"

# 3. 查找现有页面
Write-Host ""
Write-Host "[1/4] 查找现有页面 '$PageTitle'..." -ForegroundColor Yellow
$existingPage = $null
try {
    $searchUrl = "$apiUrl/content?expand=version&limit=1&query=title=$([uri]::EscapeDataString($PageTitle)) AND space=$SpaceKey"
    $searchResponse = Invoke-RestMethod -Uri $searchUrl -Headers $headers -Method Get
    if ($searchResponse.results -and $searchResponse.results.Count -gt 0) {
        $existingPage = $searchResponse.results[0]
        Write-Host "   ✅ 找到现有页面: ID=$($existingPage.id), Version=$($existingPage.version.number)" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  未找到现有页面，将创建新页面" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  查询失败: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   将尝试直接创建新页面" -ForegroundColor Yellow
}

# 4. 创建或更新页面
if ($existingPage -and $UpdateExisting) {
    # 更新现有页面
    $newVersion = $existingPage.version.number + 1
    Write-Host ""
    Write-Host "[2/4] 更新页面 (v$newVersion)..." -ForegroundColor Yellow

    $body = @{
        version = @{ number = $newVersion }
        title = $PageTitle
        type = "page"
        body = @{
            storage = @{
                value = $payloadContent
                representation = "storage"
            }
        }
    } | ConvertTo-Json -Depth 10

    try {
        $updateUrl = "$apiUrl/content/$($existingPage.id)"
        $result = Invoke-RestMethod -Uri $updateUrl -Headers $headers -Method Put -Body $body
        Write-Host "   ✅ 页面已更新 (v$newVersion)" -ForegroundColor Green
        Write-Host "   页面 URL: $ConfluenceUrl/wiki$($result._links.webui)" -ForegroundColor Cyan
    } catch {
        Write-Host "   ❌ 更新失败: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "   服务器响应: $($reader.ReadToEnd())" -ForegroundColor Red
        }
        exit 1
    }
} else {
    # 创建新页面
    Write-Host ""
    Write-Host "[2/4] 创建新页面 '$PageTitle'..." -ForegroundColor Yellow

    $bodyObj = @{
        type = "page"
        title = $PageTitle
        space = @{ key = $SpaceKey }
        body = @{
            storage = @{
                value = $payloadContent
                representation = "storage"
            }
        }
    }

    if ($ParentPageId) {
        $bodyObj.ancestors = @(@{ id = $ParentPageId })
    }

    $body = $bodyObj | ConvertTo-Json -Depth 10

    try {
        $createUrl = "$apiUrl/content"
        $result = Invoke-RestMethod -Uri $createUrl -Headers $headers -Method Post -Body $body
        Write-Host "   ✅ 新页面已创建" -ForegroundColor Green
        Write-Host "   页面 ID: $($result.id)" -ForegroundColor Cyan
        Write-Host "   页面 URL: $ConfluenceUrl/wiki$($result._links.webui)" -ForegroundColor Cyan
    } catch {
        Write-Host "   ❌ 创建失败: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "   服务器响应: $($reader.ReadToEnd())" -ForegroundColor Red
        }
        exit 1
    }
}

# 5. 上传附件（如果有）
Write-Host ""
Write-Host "[3/4] 上传附件..." -ForegroundColor Yellow
$pageId = if ($existingPage) { $existingPage.id } else { $result.id }

$attachments = @(
    @{ Name = "wiki-metadata.json"; Path = "outputs/wiki-deploy/wiki-metadata.json" },
    @{ Name = "DEPLOY-GUIDE.md"; Path = "outputs/wiki-deploy/DEPLOY-GUIDE.md" }
)

foreach ($att in $attachments) {
    if (Test-Path $att.Path) {
        try {
            $boundary = [System.Guid]::NewGuid().ToString()
            $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $att.Path).Path)
            $fileContent = [System.Text.Encoding]::UTF8.GetString($fileBytes)

            $bodyLines = @(
                "--$boundary",
                "Content-Disposition: form-data; name=`"file`"; filename=`"$($att.Name)`"",
                "Content-Type: application/octet-stream",
                "",
                $fileContent,
                "--$boundary--"
            )
            $multipartBody = $bodyLines -join "`r`n"

            $attachmentHeaders = @{
                "Authorization" = "Basic $basicAuth"
                "Content-Type" = "multipart/form-data; boundary=$boundary"
            }

            $attachUrl = "$apiUrl/content/$pageId/child/attachment?filename=$($att.Name)"
            Invoke-RestMethod -Uri $attachUrl -Headers $attachmentHeaders -Method Post -Body $multipartBody
            Write-Host "   ✅ 附件已上传: $($att.Name)" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  附件上传跳过: $($att.Name)" -ForegroundColor Yellow
        }
    }
}

# 6. 完成
Write-Host ""
Write-Host "[4/4] 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 部署结果摘要:" -ForegroundColor White
Write-Host "   目标 URL: $ConfluenceUrl" -ForegroundColor Gray
Write-Host "   Space: $SpaceKey" -ForegroundColor Gray
Write-Host "   页面标题: $PageTitle" -ForegroundColor Gray
Write-Host "   Payload: $PayloadFile" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 后续操作:" -ForegroundColor White
Write-Host "   1. 在 Confluence 中打开页面确认内容" -ForegroundColor Gray
Write-Host "   2. 运行 npm run audit:naming 验证本地合规性" -ForegroundColor Gray
Write-Host "   3. 配置 GitHub Secrets 以启用 CI 自动部署" -ForegroundColor Gray