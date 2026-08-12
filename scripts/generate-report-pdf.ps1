<#
.SYNOPSIS
    将 Markdown 报告转换为带版本号的 PDF 文件

.DESCRIPTION
    基于 md-to-pdf 工具，将指定的 Markdown 文件转换为 PDF，
    并按 "主题-vX.Y-日期.pdf" 的命名规范重命名。
    首次使用前需运行: npx puppeteer browsers install chrome

.PARAMETER Version
    版本号，如 v1.1、v2.0（必填）

.PARAMETER Date
    日期，格式 YYYY-MM-DD（可选，默认今天）

.PARAMETER SourceFile
    源 Markdown 文件路径（可选，默认 Mock隔离治理总结报告-2026-08-10.md）

.EXAMPLE
    .\scripts\generate-report-pdf.ps1 -Version v1.1 -Date 2026-08-15
    生成 Mock隔离治理总结报告-v1.1-2026-08-15.pdf

.EXAMPLE
    .\scripts\generate-report-pdf.ps1 -Version v1.2
    使用今天的日期生成 v1.2 版本
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^v\d+\.\d+$')]
    [string]$Version,

    [string]$Date = (Get-Date -Format 'yyyy-MM-dd'),

    [string]$SourceFile = 'Mock隔离治理总结报告-2026-08-10.md'
)

$ErrorActionPreference = 'Stop'

# ============================================================
# 1. 验证源文件存在
# ============================================================
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourcePath = Join-Path $projectRoot $SourceFile

if (-not (Test-Path $sourcePath)) {
    Write-Host "错误: 源文件不存在: $sourcePath" -ForegroundColor Red
    exit 1
}

# ============================================================
# 2. 构造输出文件名
#    移除源文件名中已有的版本号和日期后缀，再加上新版本号
# ============================================================
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($SourceFile)
# 移除已有的 -vX.Y 后缀
$cleanBaseName = $baseName -replace '-v\d+\.\d+.*$', ''
# 移除已有的 -YYYY-MM-DD 后缀
$cleanBaseName = $cleanBaseName -replace '-\d{4}-\d{2}-\d{2}$', ''
$pdfFileName = "$cleanBaseName-$Version-$Date.pdf"
$tempPdfName = "$baseName.pdf"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "报告 PDF 生成脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "源文件:     $SourceFile"
Write-Host "版本号:     $Version"
Write-Host "日期:       $Date"
Write-Host "输出文件名: $pdfFileName"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 3. 切换到项目根目录并运行 md-to-pdf 转换
# ============================================================
Set-Location $projectRoot

Write-Host "[1/3] 正在生成 PDF（首次运行可能需要下载 Chrome）..." -ForegroundColor Yellow
$output = npx md-to-pdf $SourceFile 2>&1
$output | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempPdfName)) {
    Write-Host ""
    Write-Host "PDF 生成失败！" -ForegroundColor Red
    Write-Host "可能原因:" -ForegroundColor Red
    Write-Host "  1. Chrome 浏览器未安装（运行: npx puppeteer browsers install chrome）" -ForegroundColor Red
    Write-Host "  2. 源文件路径包含特殊字符" -ForegroundColor Red
    Write-Host "  3. npx 首次下载 md-to-pdf 依赖超时（重试即可）" -ForegroundColor Red
    exit 1
}

# ============================================================
# 4. 重命名为带版本号的文件名
# ============================================================
Write-Host ""
Write-Host "[2/3] 正在重命名为带版本号的文件名..." -ForegroundColor Yellow

if (Test-Path $pdfFileName) {
    Write-Host "  目标文件已存在，覆盖旧文件: $pdfFileName" -ForegroundColor DarkYellow
    Remove-Item $pdfFileName -Force
}

Rename-Item -Path $tempPdfName -NewName $pdfFileName

# ============================================================
# 5. 输出结果
# ============================================================
Write-Host ""
Write-Host "[3/3] 生成完成！" -ForegroundColor Green
Write-Host ""

$pdfInfo = Get-ChildItem $pdfFileName
$sizeKB = [math]::Round($pdfInfo.Length / 1KB, 1)

Write-Host "========================================" -ForegroundColor Green
Write-Host "生成成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "文件名:   $($pdfInfo.Name)"
Write-Host "大小:     $sizeKB KB"
Write-Host "路径:     $($pdfInfo.FullName)"
Write-Host "修改时间: $($pdfInfo.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "========================================" -ForegroundColor Green
