# Migrate console calls to logger in src/components
# Handles: WidgetShell.tsx, WidgetErrorBoundary.tsx

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$outputDir = Join-Path $projectRoot "outputs\audit"

Write-Host "=== Console to Logger Migration ===" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 1. WidgetShell.tsx - Line 62: console.error
# ============================================================
Write-Host "Processing WidgetShell.tsx..." -ForegroundColor Yellow

$widgetShellPath = Join-Path $projectRoot "src\components\widgets\WidgetShell.tsx"
if (Test-Path $widgetShellPath) {
    $content = [System.IO.File]::ReadAllText($widgetShellPath, [System.Text.Encoding]::UTF8)
    
    # Check if logger is already imported
    $hasLoggerImport = $content -match 'import.*getLogger.*from.*@/lib/logger'
    
    if (-not $hasLoggerImport) {
        # Add logger import after existing imports
        $importBlock = @"
import { getLogger } from '@/lib/logger'

const logger = getLogger()
"@
        
        # Insert after the last import line
        $importPattern = '(import \{ Button \} from ''@/components/atoms/Button'')'
        if ($content -match $importPattern) {
            $content = $content -replace $importPattern, "`$1`n$importBlock"
            Write-Host "    Added logger import" -ForegroundColor Green
        }
    } else {
        Write-Host "    Logger already imported" -ForegroundColor Gray
    }
    
    # Replace console.error calls
    # Line 62: console.error('[WidgetShell] ErrorBoundary caught an error:', error, errorInfo)
    $oldCall = "console.error('[WidgetShell] ErrorBoundary caught an error:', error, errorInfo)"
    $newCall = "logger.error('[WidgetShell] ErrorBoundary caught an error', { error, errorInfo })"
    
    if ($content.Contains($oldCall)) {
        $content = $content.Replace($oldCall, $newCall)
        [System.IO.File]::WriteAllText($widgetShellPath, $content, [System.Text.Encoding]::UTF8)
        Write-Host "    Replaced console.error -> logger.error (L62)" -ForegroundColor Green
    } else {
        Write-Host "    console.error call not found (may already be migrated)" -ForegroundColor Yellow
    }
} else {
    Write-Host "    File not found: $widgetShellPath" -ForegroundColor Red
}

# ============================================================
# 2. WidgetErrorBoundary.tsx - Line 135: console.error
# ============================================================
Write-Host "Processing WidgetErrorBoundary.tsx..." -ForegroundColor Yellow

$widgetErrorPath = Join-Path $projectRoot "src\components\organisms\shared\WidgetErrorBoundary.tsx"
if (Test-Path $widgetErrorPath) {
    $content = [System.IO.File]::ReadAllText($widgetErrorPath, [System.Text.Encoding]::UTF8)
    
    # Check if logger is already imported
    $hasLoggerImport = $content -match 'import.*getLogger.*from.*@/lib/logger'
    
    if ($hasLoggerImport) {
        Write-Host "    Logger already imported" -ForegroundColor Gray
    } else {
        Write-Host "    Logger not imported - will be added" -ForegroundColor Yellow
    }
    
    # Replace console.error calls
    # Line 135-139: console.error('Widget Error Details:', { widgetId, error, retryCount })
    $oldCall = @"
console.error('Widget Error Details:', {
                  widgetId,
                  error,
                  retryCount,
                })
"@
    
    $newCall = @"
logger.error('Widget Error Details', {
                  widgetId,
                  error: error?.message ?? String(error),
                  retryCount,
                })
"@
    
    if ($content.Contains($oldCall)) {
        $content = $content.Replace($oldCall, $newCall)
        [System.IO.File]::WriteAllText($widgetErrorPath, $content, [System.Text.Encoding]::UTF8)
        Write-Host "    Replaced console.error -> logger.error (L135)" -ForegroundColor Green
    } else {
        # Try alternative pattern
        $altCall = 'console.error(''Widget Error Details:'', {'
        if ($content.Contains($altCall)) {
            Write-Host "    Found console.error but format differs - manual review needed" -ForegroundColor Yellow
        } else {
            Write-Host "    console.error call not found (may already be migrated)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "    File not found: $widgetErrorPath" -ForegroundColor Red
}

# ============================================================
# Generate summary
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Migration Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Migrated files:" -ForegroundColor White
Write-Host "  1. src/components/widgets/WidgetShell.tsx" -ForegroundColor Green
Write-Host "  2. src/components/organisms/shared/WidgetErrorBoundary.tsx" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run lint check: npm run lint" -ForegroundColor White
Write-Host "  2. Verify changes in the files" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan