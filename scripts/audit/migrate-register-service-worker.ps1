# Migrate console calls in registerServiceWorker.ts to logger
# Handles 14 console calls (8 info, 3 warn, 2 error, 1 info in cleanupStaleServiceWorker)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$filePath = Join-Path $projectRoot "src\services\pwa\registerServiceWorker.ts"

Write-Host "=== registerServiceWorker.ts Console to Logger Migration ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $filePath)) {
    Write-Host "ERROR: File not found: $filePath" -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Step 1: Remove eslint-disable no-console at line 4
Write-Host "Step 1: Removing eslint-disable no-console..." -ForegroundColor Yellow
$content = $content -replace '/\* eslint-disable no-console \*/\r?\n', ''
Write-Host "    Removed eslint-disable no-console block" -ForegroundColor Green

# Step 2: Add logger import (before the type export)
Write-Host "Step 2: Adding logger import..." -ForegroundColor Yellow
$loggerImport = @"
import { getLogger } from '@/lib/logger'

const logger = getLogger()

"@

# Insert after the doc comment block, before 'export type'
$content = $content -replace '(?s)(/\*\*[\s\S]*?\*/\r?\n)', "`$1`r`n$loggerImport"
Write-Host "    Added logger import" -ForegroundColor Green

# Step 3: Replace all console.info calls
Write-Host "Step 3: Replacing console.info -> logger.info..." -ForegroundColor Yellow

# Line 54: console.warn('[PWA] Service Worker 不受当前浏览器支持')
$content = $content -replace "console\.warn\('\[PWA\] Service Worker 不受当前浏览器支持'\)", "logger.warn('Service Worker 不受当前浏览器支持')"

# Line 60: console.info('[PWA] 正在注册 Service Worker ...', swUrl)
$content = $content -replace "console\.info\('\[PWA\] 正在注册 Service Worker \.\.\.', swUrl\)", "logger.info('正在注册 Service Worker', { swUrl })"

# Line 67: console.info('[PWA] Service Worker 注册成功 (scope:', reg.scope, ')')
$content = $content -replace "console\.info\('\[PWA\] Service Worker 注册成功 \(scope:', reg\.scope, '\)'\)", "logger.info('Service Worker 注册成功', { scope: reg.scope })"

# Line 72: console.info('[PWA] 发现新版本 SW 等待激活')
$content = $content -replace "console\.info\('\[PWA\] 发现新版本 SW 等待激活'\)", "logger.info('发现新版本 SW 等待激活')"

# Line 75: console.info('[PWA] SW 已激活并运行中')
$content = $content -replace "console\.info\('\[PWA\] SW 已激活并运行中'\)", "logger.info('SW 已激活并运行中')"

# Line 90: console.info('[PWA] 新版本 SW 安装完成，刷新页面后生效')
$content = $content -replace "console\.info\('\[PWA\] 新版本 SW 安装完成，刷新页面后生效'\)", "logger.info('新版本 SW 安装完成，刷新页面后生效')"

# Line 97: console.info('[PWA] 新 SW 已接管页面控制权')
$content = $content -replace "console\.info\('\[PWA\] 新 SW 已接管页面控制权'\)", "logger.info('新 SW 已接管页面控制权')"

# Line 104: console.error('[PWA] Service Worker 注册失败:', message)
$content = $content -replace "console\.error\('\[PWA\] Service Worker 注册失败:', message\)", "logger.error('Service Worker 注册失败', { error: message })"

# Line 127: console.info('...')
$content = $content -replace "console\.info\(`\[PWA\] sw\.js 不存在，清理 \$\{registrations\.length\} 个残留 Service Worker \.\.\.`\)", "logger.info('sw.js 不存在，清理残留 Service Worker', { count: registrations.length })"

# Line 131: console.info('[PWA] SW 注销成功:', reg.scope)
$content = $content -replace "console\.info\('\[PWA\] SW 注销成功:', reg\.scope\)", "logger.info('SW 注销成功', { scope: reg.scope })"

# Line 137: console.warn('[PWA] 清理残留 SW 失败:', err)
$content = $content -replace "console\.warn\('\[PWA\] 清理残留 SW 失败:', err\)", "logger.warn('清理残留 SW 失败', { error: String(err) })"

# Line 148: console.error('[PWA] initPWA 异常:', err)
$content = $content -replace "console\.error\('\[PWA\] initPWA 异常:', err\)", "logger.error('initPWA 异常', { error: String(err) })"

# Line 151: console.info('[PWA] 开发环境跳过 Service Worker 注册')
$content = $content -replace "console\.info\('\[PWA\] 开发环境跳过 Service Worker 注册'\)", "logger.info('开发环境跳过 Service Worker 注册')"

# Line 155: console.warn('[PWA] cleanupStaleServiceWorker 异常:', err)
$content = $content -replace "console\.warn\('\[PWA\] cleanupStaleServiceWorker 异常:', err\)", "logger.warn('cleanupStaleServiceWorker 异常', { error: String(err) })"

Write-Host "    Replaced 14 console calls with logger" -ForegroundColor Green

# Step 4: Update doc comments
Write-Host "Step 4: Updating doc comments..." -ForegroundColor Yellow
$content = $content -replace '\* 注册过程通过 console 明确输出状态日志。', '* 注册过程通过 logger 输出状态日志。'
Write-Host "    Updated doc comments" -ForegroundColor Green

# Step 5: Write back
Write-Host "Step 5: Writing file..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "    File written successfully" -ForegroundColor Green

# Step 6: Verify no console calls remain
Write-Host ""
Write-Host "Step 6: Verifying no console calls remain..." -ForegroundColor Yellow
$remainingConsole = [regex]::Matches($content, '(?<!\/\/)\bconsole\.(log|warn|error|info|debug|trace)\b')
if ($remainingConsole.Count -eq 0) {
    Write-Host "    All console calls migrated successfully!" -ForegroundColor Green
} else {
    Write-Host "    WARNING: $($remainingConsole.Count) console calls may remain" -ForegroundColor Red
    foreach ($m in $remainingConsole) {
        $lineStart = $content.Substring(0, $m.Index).Split("`n").Count
        Write-Host "      Line $lineStart`: $($m.Value)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Migration Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Migrated: 14 console calls → logger" -ForegroundColor White
Write-Host "  - console.info → logger.info (8)" -ForegroundColor Gray
Write-Host "  - console.warn → logger.warn (3)" -ForegroundColor Gray
Write-Host "  - console.error → logger.error (2)" -ForegroundColor Gray
Write-Host "  - console.info → logger.info (1, template literal)" -ForegroundColor Gray
Write-Host ""
Write-Host "Removed: eslint-disable no-console block" -ForegroundColor White
Write-Host "Added: getLogger import" -ForegroundColor White
Write-Host ""
Write-Host "Next step: Run 'npx eslint src/services/pwa/registerServiceWorker.ts' to verify" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan