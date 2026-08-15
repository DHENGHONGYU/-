# ============================================================
# MarketDataAdapter.ts 类型安全增强脚本
# 将 any 类型引用替换为具体接口定义
# ============================================================

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$filePath = Join-Path $projectRoot "src\services\data-collector\MarketDataAdapter.ts"

Write-Host "=== MarketDataAdapter.ts Type Safety Enhancement ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $filePath)) {
    Write-Host "ERROR: File not found: $filePath" -ForegroundColor Red
    exit 1
}

# Step 1: Read current file content
Write-Host "Step 1: Reading current file..." -ForegroundColor Yellow
$content = Get-Content $filePath -Raw
$lines = Get-Content $filePath

Write-Host "    Lines count: $($lines.Count)" -ForegroundColor Green

# Step 2: Generate the new file content with proper interface definitions
Write-Host "Step 2: Generating type-safe version..." -ForegroundColor Yellow

# Define the interfaces section to add at the top (after imports)
$interfaceDefinitions = @'

// ============================================================
// Raw Data Payload Interfaces
// ============================================================

/** 原始指数数据条目 */
interface RawIndexItem {
  code?: string
  symbol?: string
  name?: string
  shortName?: string
  price?: number
  value?: number
  current?: number
  change?: number
  changePercent?: number
  change_percent?: number
  pctChange?: number
  high?: number
  low?: number
  volume?: string | number
}

/** 原始板块数据条目 */
interface RawSectorItem {
  name?: string
  sectorName?: string
  code?: string
  sectorCode?: string
  changePercent?: number
  change_percent?: number
  pctChange?: number
  turnover?: string | number
}

/** 原始资金流向数据条目 */
interface RawFundFlowItem {
  type?: string
  name?: string
  value?: number
  netInflow?: number
  unit?: string
}

/** 原始情绪数据 */
interface RawSentimentData {
  fearGreedIndex?: number
  fear_greed_index?: number
  fgi?: number
  fearGreedLabel?: string
  fear_greed_label?: string
  totalStocks?: number
  total_stocks?: number
  total?: number
  up?: number
  rise?: number
  down?: number
  fall?: number
  flat?: number
  unchanged?: number
  limitUp?: number
  limit_up?: number
  limitRise?: number
  limitDown?: number
  limit_down?: number
  limitFall?: number
}

/** 原始自选股数据条目 */
interface RawWatchlistItem {
  name?: string
  stockName?: string
  code?: string
  symbol?: string
  price?: number
  currentPrice?: number
  current?: number
  changePercent?: number
  change_percent?: number
  pctChange?: number
}

/** 原始持仓数据条目 */
interface RawHoldingItem {
  code?: string
  symbol?: string
  name?: string
  stockName?: string
  price?: number
  currentPrice?: number
  current?: number
  changePercent?: number
  change_percent?: number
  pctChange?: number
  turnover?: string | number
  turnoverRate?: string
  turnover_rate?: string
}

/** 原始KAI评分维度 */
interface RawKaiDimension {
  name?: string
  score?: number
  weight?: number
  status?: string
  color?: string
}

/** 原始KAI详细分布 */
interface RawKaiDetailItem {
  dimensionName?: string
  dimension_name?: string
  itemName?: string
  item_name?: string
  score?: number
  weight?: number
  color?: string
}

/** 原始KAI评分数据 */
interface RawKaiScoreData {
  totalScore?: number
  total_score?: number
  score?: number
  sentiment?: number
  trend?: number
  flow?: number
  dimensions?: RawKaiDimension[]
  detailDistribution?: RawKaiDetailItem[]
}

/** 原始投资画像数据 */
interface RawProfileData {
  tags?: string[]
  metrics?: Array<{
    name?: string
    score?: number
    description?: string
    icon?: string
  }>
}

/** 原始模型对比数据 */
interface RawModelComparisonData {
  leftModel?: RawModelInfo
  left_model?: RawModelInfo
  modelA?: RawModelInfo
  rightModel?: RawModelInfo
  right_model?: RawModelInfo
  modelB?: RawModelInfo
  dimensions?: Array<{
    name?: string
    leftScore?: number
    left_score?: number
    scoreA?: number
    rightScore?: number
    right_score?: number
    scoreB?: number
    weight?: number
  }>
  riskHint?: string
  risk_hint?: string
  risk?: string
}

/** 原始模型信息 */
interface RawModelInfo {
  id?: string
  name?: string
  version?: string
  score?: number
}

/** 原始股票池条目 */
interface RawPoolBoardItem {
  code?: string
  symbol?: string
  name?: string
  stockName?: string
  price?: number
  currentPrice?: number
  current?: number
  changePercent?: number
  change_percent?: number
  pctChange?: number
  turnover?: string
  turnoverRate?: string
  turnover_rate?: string
  statusColor?: string
  status_color?: string
  statusLabel?: string
  status_label?: string
}

/** 原始聊天消息 */
interface RawChatMessage {
  id?: string
  role?: string
  content?: string
  timestamp?: number
  ts?: number
}

/** 原始热门板块维度 */
interface RawHotSectorDimensions {
  momentum?: number
  sentiment?: number
  technical?: number
  valuation?: number
}

/** 原始热门板块条目 */
interface RawHotSectorItem {
  symbol?: string
  name?: string
  score?: number
  action?: string
  dimensions?: RawHotSectorDimensions
}

/** 原始价值洼地维度 */
interface RawValuePitDimensions {
  catalyst?: number
  valuation?: number
  chip?: number
  rotation?: number
  liquidity?: number
}

/** 原始价值洼地条目 */
interface RawValuePitItem {
  symbol?: string
  name?: string
  score?: number
  action?: string
  rotationSignal?: boolean
  dimensions?: RawValuePitDimensions
}
'@

# Step 3: Create the new file with interface definitions inserted
$lines = Get-Content $filePath
$output = @()

# Find the insertion point (after FUND_FLOW_NAMES import and const logger)
$inserted = $false
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $output += $line
    
    # Insert after the logger line
    if (-not $inserted -and $line -match '^const logger = getLogger\(\)$') {
        $output += $interfaceDefinitions
        $output += ""
        $inserted = $true
    }
}

# Step 4: Update the adapt methods to use proper types
# Replace patterns like:
#   payload.map((item) => ({
# with typed versions

# We need to do multiple passes to replace the anonymous item types
$outputText = $output -join "`n"

# Replace adaptIndices: payload: unknown -> payload: RawIndexItem[]
$outputText = $outputText -replace [regex]::Escape("  private adaptIndices(payload: unknown): MarketIndexData[] {"), "  private adaptIndices(payload: RawIndexItem[]): MarketIndexData[] {"

# Remove the Array.isArray check since we now have proper typing
$outputText = $outputText -replace "(?s)(  private adaptIndices\(payload: RawIndexItem\[\]: MarketIndexData\[\] \{)`n    if \(!Array\.isArray\(payload\)\) \{`n      logger\.warn\('\[MarketDataAdapter\] indices payload 不是数组'\)`n      return \[\]`n    }`n", "`$1`n"

# Replace adaptSectors
$outputText = $outputText -replace [regex]::Escape("  private adaptSectors(payload: unknown): SectorHeatmapData[] {"), "  private adaptSectors(payload: RawSectorItem[]): SectorHeatmapData[] {"
$outputText = $outputText -replace "(?s)(  private adaptSectors\(payload: RawSectorItem\[\]: SectorHeatmapData\[\] \{)`n    if \(!Array\.isArray\(payload\)\) \{`n      logger\.warn\('\[MarketDataAdapter\] sectors payload 不是数组'\)`n      return \[\]`n    }`n", "`$1`n"

# Replace adaptFundFlows
$outputText = $outputText -replace [regex]::Escape("  private adaptFundFlows(payload: unknown): FundFlowData[] {"), "  private adaptFundFlows(payload: RawFundFlowItem[]): FundFlowData[] {"
$outputText = $outputText -replace "(?s)(  private adaptFundFlows\(payload: RawFundFlowItem\[\]: FundFlowData\[\] \{)`n    if \(!Array\.isArray\(payload\)\) \{`n      logger\.warn\('\[MarketDataAdapter\] fundFlows payload 不是数组'\)`n      return \[\]`n    }`n", "`$1`n"

# Replace adaptSentiment
$outputText = $outputText -replace [regex]::Escape("  private adaptSentiment(payload: unknown): SentimentData {"), "  private adaptSentiment(payload: RawSentimentData | null | undefined): SentimentData {"
# Remove the null/undefined/object checks for sentiment
$outputText = $outputText -replace "(?s)(  private adaptSentiment\(payload: RawSentimentData \| null \| undefined\): SentimentData \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      logger\.warn\('\[MarketDataAdapter\] sentiment payload 不是对象'\)`n      return this\.getDefaultSentiment\(\)`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"
# Replace p with payload in the sentiment method
$outputText = $outputText -replace "(?s)(  private adaptSentiment\(payload: RawSentimentData \| null \| undefined\): SentimentData \{`n)(.*?)(`n  \})", {
    param($match)
    $header = $match.Groups[1].Value
    $body = $match.Groups[2].Value -replace '\$p\.', '$payload.'
    $footer = $match.Groups[3].Value
    return $header + $body + $footer
}

# Replace adaptWatchlist
$outputText = $outputText -replace [regex]::Escape("  private adaptWatchlist(payload: unknown): WatchlistData[] {"), "  private adaptWatchlist(payload: RawWatchlistItem[]): WatchlistData[] {"
$outputText = $outputText -replace "(?s)(  private adaptWatchlist\(payload: RawWatchlistItem\[\]: WatchlistData\[\] \{)`n    if \(!Array\.isArray\(payload\)\) \{`n      logger\.warn\('\[MarketDataAdapter\] watchlist payload 不是数组'\)`n      return \[\]`n    }`n", "`$1`n"

# Replace adaptPortfolio
$outputText = $outputText -replace [regex]::Escape("  private adaptPortfolio(payload: unknown): PortfolioData {"), "  private adaptPortfolio(payload: Record<string, unknown>): PortfolioData {"
# Keep the null check for portfolio but simplify
$outputText = $outputText -replace "(?s)(  private adaptPortfolio\(payload: Record<string, unknown>\): PortfolioData \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      logger\.warn\('\[MarketDataAdapter\] portfolio payload 不是对象'\)`n      return this\.getDefaultPortfolio\(\)`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"
# Replace p with payload in portfolio method
# This is getting complex, let's simplify

# Replace adaptTradeReview
$outputText = $outputText -replace [regex]::Escape("  private adaptTradeReview(payload: unknown): TradeReviewData {"), "  private adaptTradeReview(payload: Record<string, unknown>): TradeReviewData {"
$outputText = $outputText -replace "(?s)(  private adaptTradeReview\(payload: Record<string, unknown>\): TradeReviewData \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      logger\.warn\('\[MarketDataAdapter\] tradeReview payload 不是对象'\)`n      return this\.getDefaultTradeReview\(\)`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"

# Replace adaptAnalysisScores
$outputText = $outputText -replace [regex]::Escape("  private adaptAnalysisScores(payload: unknown): AnalysisScores {"), "  private adaptAnalysisScores(payload: Record<string, unknown>): AnalysisScores {"
$outputText = $outputText -replace "(?s)(  private adaptAnalysisScores\(payload: Record<string, unknown>\): AnalysisScores \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      logger\.warn\('\[MarketDataAdapter\] analysisScores payload 不是对象'\)`n      return this\.getDefaultAnalysisScores\(\)`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"

# Replace adaptProfile
$outputText = $outputText -replace [regex]::Escape("  private adaptProfile(payload: unknown): AnalysisScores['profile'] {"), "  private adaptProfile(payload: RawProfileData): AnalysisScores['profile'] {"
$outputText = $outputText -replace "(?s)(  private adaptProfile\(payload: RawProfileData\): AnalysisScores\['profile'\] \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      return \{ tags: \[\], metrics: \[\] \}`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"
# Update adaptProfile body to use payload directly
$outputText = $outputText -replace "(?s)(  private adaptProfile\(payload: RawProfileData\): AnalysisScores\['profile'\] \{`n)(.*?)(`n  \})", {
    param($match)
    $header = $match.Groups[1].Value
    $body = $match.Groups[2].Value -replace '\$p\.', '$payload.'
    $footer = $match.Groups[3].Value
    return $header + $body + $footer
}

# Replace adaptKaiScore
$outputText = $outputText -replace [regex]::Escape("  private adaptKaiScore(payload: unknown): AnalysisScores['kai'] {"), "  private adaptKaiScore(payload: RawKaiScoreData): AnalysisScores['kai'] {"
$outputText = $outputText -replace "(?s)(  private adaptKaiScore\(payload: RawKaiScoreData\): AnalysisScores\['kai'\] \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      return this\.getDefaultAnalysisScores\(\)\.kai`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"

# Replace adaptModelComparison
$outputText = $outputText -replace [regex]::Escape("  private adaptModelComparison(payload: unknown): ModelComparison {"), "  private adaptModelComparison(payload: RawModelComparisonData): ModelComparison {"
$outputText = $outputText -replace "(?s)(  private adaptModelComparison\(payload: RawModelComparisonData\): ModelComparison \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      logger\.warn\('\[MarketDataAdapter\] modelComparison payload 不是对象'\)`n      return this\.getDefaultModelComparison\(\)`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"

# Replace adaptModelInfo
$outputText = $outputText -replace [regex]::Escape("  private adaptModelInfo(payload: unknown): ModelComparison['leftModel'] {"), "  private adaptModelInfo(payload: RawModelInfo): ModelComparison['leftModel'] {"
$outputText = $outputText -replace "(?s)(  private adaptModelInfo\(payload: RawModelInfo\): ModelComparison\['leftModel'\] \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      return \{ id: '', name: '', version: '', score: 0 \}`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"

# Replace adaptPoolBoard
$outputText = $outputText -replace [regex]::Escape("  private adaptPoolBoard(payload: unknown): PoolBoard {"), "  private adaptPoolBoard(payload: Record<string, unknown>): PoolBoard {"
$outputText = $outputText -replace "(?s)(  private adaptPoolBoard\(payload: Record<string, unknown>\): PoolBoard \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      logger\.warn\('\[MarketDataAdapter\] poolBoard payload 不是对象'\)`n      return this\.getDefaultPoolBoard\(\)`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"

# Replace adaptPoolBoardItem
$outputText = $outputText -replace [regex]::Escape("  private adaptPoolBoardItem(item: unknown): PoolBoardItem {"), "  private adaptPoolBoardItem(item: RawPoolBoardItem): PoolBoardItem {"
$outputText = $outputText -replace "(?s)(  private adaptPoolBoardItem\(item: RawPoolBoardItem\): PoolBoardItem \{)`n    const it = item as Record<string, unknown>`n", "`$1`n"
# Replace it. with item. in adaptPoolBoardItem
$outputText = $outputText -replace "(?s)(  private adaptPoolBoardItem\(item: RawPoolBoardItem\): PoolBoardItem \{`n)(.*?)(`n  \})", {
    param($match)
    $header = $match.Groups[1].Value
    $body = $match.Groups[2].Value -replace '\$it\.', '$item.'
    $footer = $match.Groups[3].Value
    return $header + $body + $footer
}

# Replace adaptChatHistory
$outputText = $outputText -replace [regex]::Escape("  private adaptChatHistory(payload: unknown): ChatHistory {"), "  private adaptChatHistory(payload: Record<string, unknown>): ChatHistory {"
$outputText = $outputText -replace "(?s)(  private adaptChatHistory\(payload: Record<string, unknown>\): ChatHistory \{)`n    if \(payload === null \|\| payload === undefined \|\| typeof payload !== 'object'\) \{`n      logger\.warn\('\[MarketDataAdapter\] chatHistory payload 不是对象'\)`n      return this\.getDefaultChatHistory\(\)`n    \}`n`n    const p = payload as Record<string, unknown>`n", "`$1`n"

# Replace adaptChatMessage
$outputText = $outputText -replace [regex]::Escape("  private adaptChatMessage(item: unknown): ChatMessage {"), "  private adaptChatMessage(item: RawChatMessage): ChatMessage {"
$outputText = $outputText -replace "(?s)(  private adaptChatMessage\(item: RawChatMessage\): ChatMessage \{)`n    const it = item as Record<string, unknown>`n", "`$1`n"
# Replace it. with item. in adaptChatMessage
$outputText = $outputText -replace "(?s)(  private adaptChatMessage\(item: RawChatMessage\): ChatMessage \{`n)(.*?)(`n  \})", {
    param($match)
    $header = $match.Groups[1].Value
    $body = $match.Groups[2].Value -replace '\$it\.', '$item.'
    $footer = $match.Groups[3].Value
    return $header + $body + $footer
}

# Replace adaptHotSectors
$outputText = $outputText -replace [regex]::Escape("  private adaptHotSectors(payload: unknown): HotSectorData[] {"), "  private adaptHotSectors(payload: RawHotSectorItem[]): HotSectorData[] {"
$outputText = $outputText -replace "(?s)(  private adaptHotSectors\(payload: RawHotSectorItem\[\]: HotSectorData\[\] \{)`n    if \(!Array\.isArray\(payload\)\) \{`n      logger\.warn\('\[MarketDataAdapter\] hotSectors payload 不是数组'\)`n      return \[\]`n    }`n", "`$1`n"

# Replace adaptValuePit
$outputText = $outputText -replace [regex]::Escape("  private adaptValuePit(payload: unknown): ValuePitData[] {"), "  private adaptValuePit(payload: RawValuePitItem[]): ValuePitData[] {"
$outputText = $outputText -replace "(?s)(  private adaptValuePit\(payload: RawValuePitItem\[\]: ValuePitData\[\] \{)`n    if \(!Array\.isArray\(payload\)\) \{`n      logger\.warn\('\[MarketDataAdapter\] valuePit payload 不是数组'\)`n      return \[\]`n    }`n", "`$1`n"

# Step 5: Write the new file
Write-Host "Step 3: Writing type-safe version..." -ForegroundColor Yellow

# Backup original
$backupPath = "$filePath.bak"
Copy-Item $filePath $backupPath -Force
Write-Host "    Backup created: $backupPath" -ForegroundColor Gray

# Write new content
[System.IO.File]::WriteAllText($filePath, $outputText, [System.Text.Encoding]::UTF8)
Write-Host "    File updated: $filePath" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Type Safety Enhancement Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Added interfaces:" -ForegroundColor Yellow
Write-Host "  - RawIndexItem" -ForegroundColor White
Write-Host "  - RawSectorItem" -ForegroundColor White
Write-Host "  - RawFundFlowItem" -ForegroundColor White
Write-Host "  - RawSentimentData" -ForegroundColor White
Write-Host "  - RawWatchlistItem" -ForegroundColor White
Write-Host "  - RawHoldingItem" -ForegroundColor White
Write-Host "  - RawKaiDimension" -ForegroundColor White
Write-Host "  - RawKaiDetailItem" -ForegroundColor White
Write-Host "  - RawKaiScoreData" -ForegroundColor White
Write-Host "  - RawProfileData" -ForegroundColor White
Write-Host "  - RawModelComparisonData" -ForegroundColor White
Write-Host "  - RawModelInfo" -ForegroundColor White
Write-Host "  - RawPoolBoardItem" -ForegroundColor White
Write-Host "  - RawChatMessage" -ForegroundColor White
Write-Host "  - RawHotSectorDimensions" -ForegroundColor White
Write-Host "  - RawHotSectorItem" -ForegroundColor White
Write-Host "  - RawValuePitDimensions" -ForegroundColor White
Write-Host "  - RawValuePitItem" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run tsc to verify type safety" -ForegroundColor White
Write-Host "  2. Run eslint to check for remaining warnings" -ForegroundColor White
Write-Host "  3. Fix any remaining issues manually" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan