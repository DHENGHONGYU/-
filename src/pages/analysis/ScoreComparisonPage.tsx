import React, { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Select } from '@/components/atoms/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/atoms/Table'
import { DataState } from '@/components/molecules/DataState'
import { BarChart } from '@/components/chart/BarChart'
import { LineChart } from '@/components/chart/LineChart'
import { PageContainer, PageHeader } from '@/components/templates'
import { useScoreDocStore } from '@/store/scoreDocStore'
import { getLogger } from '@/lib/logger'
import { CHART_PALETTE, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreComparisonResult, DimensionComparisonItem } from '@/types/modules/score.types'
import { cn } from '@/lib/utils'
import { StockSelector } from '@/components/organisms/input/StockSelector'
import { toStockOption } from '@/constants/stockList'

const logger = getLogger()

function formatDelta(delta: number): string {
  if (delta === 0) return '0.00'
  return delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)
}

function getDeltaColor(delta: number): string {
  if (delta > 0) return STOCK_COLOR_TOKENS.up.tailwind
  if (delta < 0) return STOCK_COLOR_TOKENS.down.tailwind
  return 'text-muted-foreground'
}

function ComparisonHeader({ result }: { result: ScoreComparisonResult }): React.JSX.Element {
  const { left, right, compositeDelta, l3vDelta, ratingChanged } = result

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {left.stockName}
            <Badge variant="outline" className="ml-2 text-xs">V{left.version}</Badge>
          </CardTitle>
          <CardDescription>{left.scoreDate} · {left.modelUsed}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-3xl font-bold">{left.composite.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">综合评分</div>
            <div className="pt-2 text-sm">
              <span className="text-muted-foreground">L3V: </span>
              <span className="font-medium">{left.l3v.toFixed(1)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">评级: </span>
              <span className="font-medium" style={{ color: left.recommendation.color }}>
                {left.recommendation.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-sm font-medium text-muted-foreground">比对结果</CardTitle>
          <CardDescription>综合分变化</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className={cn('text-4xl font-bold', getDeltaColor(compositeDelta))}>
            {formatDelta(compositeDelta)}
          </div>
          <div className="pt-1 text-sm text-muted-foreground">L3V 变化</div>
          <div className={cn('text-lg font-semibold', getDeltaColor(l3vDelta))}>
            {formatDelta(l3vDelta)}
          </div>
          {ratingChanged && (
            <Badge variant="destructive" className="mt-2">评级变化</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 text-right">
          <CardTitle className="text-sm font-medium">
            {right.stockName}
            <Badge variant="outline" className="ml-2 text-xs">V{right.version}</Badge>
          </CardTitle>
          <CardDescription>{right.scoreDate} · {right.modelUsed}</CardDescription>
        </CardHeader>
        <CardContent className="text-right">
          <div className="space-y-1">
            <div className="text-3xl font-bold">{right.composite.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">综合评分</div>
            <div className="pt-2 text-sm">
              <span className="text-muted-foreground">L3V: </span>
              <span className="font-medium">{right.l3v.toFixed(1)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">评级: </span>
              <span className="font-medium" style={{ color: right.recommendation.color }}>
                {right.recommendation.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DimensionBarChart({ dimensions }: { dimensions: DimensionComparisonItem[] }): React.JSX.Element {
  const chartData = dimensions.map((d) => ({
    code: d.code,
    左版: d.leftScore,
    右版: d.rightScore,
  }))

  return (
    <BarChart
      data={chartData}
      xKey="code"
      bars={[
        { dataKey: '左版', color: CHART_PALETTE.series2 },
        { dataKey: '右版', color: CHART_PALETTE.series1 },
      ]}
      height={280}
      showGrid
      showTooltip
    />
  )
}

function DimensionTable({ dimensions }: { dimensions: DimensionComparisonItem[] }): React.JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">维度</TableHead>
          <TableHead className="text-right">左版得分</TableHead>
          <TableHead className="text-right">右版得分</TableHead>
          <TableHead className="text-right">变化</TableHead>
          <TableHead className="text-right">左版权重</TableHead>
          <TableHead className="text-right">右版权重</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dimensions.map((d) => (
          <TableRow key={d.code}>
            <TableCell className="font-medium">{d.code}</TableCell>
            <TableCell className="text-right">{d.leftScore.toFixed(2)}</TableCell>
            <TableCell className="text-right">{d.rightScore.toFixed(2)}</TableCell>
            <TableCell className={cn('text-right font-medium', getDeltaColor(d.delta))}>
              {formatDelta(d.delta)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {(d.leftWeight * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {(d.rightWeight * 100).toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TopChangesSection({
  rising,
  falling,
}: {
  rising: DimensionComparisonItem[]
  falling: DimensionComparisonItem[]
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className={STOCK_COLOR_TOKENS.up.tailwind}>▲</span>
            上升幅度最大
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rising.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无上升维度</div>
          ) : (
            <div className="space-y-2">
              {rising.map((d) => (
                <div key={d.code} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.code}</span>
                  <span className={STOCK_COLOR_TOKENS.up.tailwind}>+{d.delta.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className={STOCK_COLOR_TOKENS.down.tailwind}>▼</span>
            下降幅度最大
          </CardTitle>
        </CardHeader>
        <CardContent>
          {falling.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无下降维度</div>
          ) : (
            <div className="space-y-2">
              {falling.map((d) => (
                <div key={d.code} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.code}</span>
                  <span className={STOCK_COLOR_TOKENS.down.tailwind}>{d.delta.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * ScoreComparisonPage
 */
export default function ScoreComparisonPage(): React.JSX.Element {
  const comparisonMode = useScoreDocStore((s) => s.comparisonMode)
  const comparisonLeft = useScoreDocStore((s) => s.comparisonLeft)
  const comparisonRight = useScoreDocStore((s) => s.comparisonRight)
  const comparisonResult = useScoreDocStore((s) => s.comparisonResult)
  const comparisonLoading = useScoreDocStore((s) => s.comparisonLoading)
  const comparisonError = useScoreDocStore((s) => s.comparisonError)
  const stocks = useScoreDocStore((s) => s.stocks)
  const versions = useScoreDocStore((s) => s.versions)
  const timelineData = useScoreDocStore((s) => s.timelineData)
  const timelineLoading = useScoreDocStore((s) => s.timelineLoading)
  const symbol = useScoreDocStore((s) => s.symbol)

  const setComparisonMode = useScoreDocStore((s) => s.setComparisonMode)
  const setComparisonLeft = useScoreDocStore((s) => s.setComparisonLeft)
  const setComparisonRight = useScoreDocStore((s) => s.setComparisonRight)
  const runVersionComparison = useScoreDocStore((s) => s.runVersionComparison)
  const runStockComparison = useScoreDocStore((s) => s.runStockComparison)
  const loadStocks = useScoreDocStore((s) => s.loadStocks)
  const loadVersions = useScoreDocStore((s) => s.loadVersions)
  const loadTimeline = useScoreDocStore((s) => s.loadTimeline)
  const setSymbol = useScoreDocStore((s) => s.setSymbol)

  useEffect(() => {
    logger.info('[ScoreComparisonPage] 初始化，加载股票列表')
    void loadStocks()
  }, [loadStocks])

  useEffect(() => {
    if (comparisonMode === 'same-stock-versions' && symbol) {
      logger.info('[ScoreComparisonPage] 模式切换为版本比对，加载版本列表', { symbol })
      void loadVersions()
      void loadTimeline(symbol)
    }
  }, [comparisonMode, symbol, loadVersions, loadTimeline])

  const handleModeChange = (mode: string): void => {
    logger.info('[ScoreComparisonPage] 切换比对模式', { mode })
    setComparisonMode(mode as 'same-stock-versions' | 'cross-stock-latest')
  }

  const handleCompare = (): void => {
    if (comparisonMode === 'same-stock-versions') {
      if (!symbol || !comparisonLeft || !comparisonRight) {
        logger.warn('[ScoreComparisonPage] 版本比对参数不完整')
        return
      }
      logger.info('[ScoreComparisonPage] 执行版本比对', {
        symbol,
        left: comparisonLeft,
        right: comparisonRight,
      })
      void runVersionComparison(symbol, Number(comparisonLeft), Number(comparisonRight))
    } else {
      if (!comparisonLeft || !comparisonRight) {
        logger.warn('[ScoreComparisonPage] 股票比对参数不完整')
        return
      }
      logger.info('[ScoreComparisonPage] 执行股票比对', {
        left: comparisonLeft,
        right: comparisonRight,
      })
      void runStockComparison(comparisonLeft, comparisonRight)
    }
  }

  const versionOptions = useMemo(
    () => versions.map((v) => ({ value: String(v.version), label: `V${v.version} - ${v.scoreDate}` })),
    [versions],
  )

  const timelineChartData = useMemo(
    () =>
      timelineData.map((t) => ({
        period: `V${t.version}`,
        score: t.composite,
      })),
    [timelineData],
  )

  const hasResult = comparisonResult !== null

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/analysis">分析舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>历史评分比对看板</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="历史评分比对看板"
        description="对比同股票不同版本或不同股票的最新评分，洞察维度变化与评级迁移"
      />

      <Card>
        <CardHeader>
          <CardTitle>比对设置</CardTitle>
          <CardDescription>选择比对模式和对象，查看详细差异</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={comparisonMode}
            onValueChange={handleModeChange}
          >
            <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
              <TabsTrigger value="same-stock-versions">同股票 · 版本比对</TabsTrigger>
              <TabsTrigger value="cross-stock-latest">跨股票 · 最新版比对</TabsTrigger>
            </TabsList>
          </Tabs>

          {comparisonMode === 'same-stock-versions' ? (
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择股票</label>
                <StockSelector
                  value={symbol}
                  onChange={(stock) => {
                    setSymbol(stock.symbol)
                    setComparisonLeft('')
                    setComparisonRight('')
                  }}
                  stocks={stocks.map(toStockOption)}
                  placeholder="搜索股票名称或代码..."
                  showIcon={false}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">左版本</label>
                <Select
                  value={comparisonLeft}
                  onValueChange={setComparisonLeft}
                  disabled={!symbol || versions.length === 0}
                >
                  <option value="">选择左侧版本</option>
                  {versionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">右版本</label>
                <Select
                  value={comparisonRight}
                  onValueChange={setComparisonRight}
                  disabled={!symbol || versions.length === 0}
                >
                  <option value="">选择右侧版本</option>
                  {versionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">左侧股票</label>
                <StockSelector
                  value={comparisonLeft}
                  onChange={(stock) => setComparisonLeft(stock.symbol)}
                  stocks={stocks.map(toStockOption)}
                  placeholder="搜索左侧股票..."
                  showIcon={false}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">右侧股票</label>
                <StockSelector
                  value={comparisonRight}
                  onChange={(stock) => setComparisonRight(stock.symbol)}
                  stocks={stocks.map(toStockOption)}
                  placeholder="搜索右侧股票..."
                  showIcon={false}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCompare}
              disabled={
                comparisonMode === 'same-stock-versions'
                  ? !symbol || !comparisonLeft || !comparisonRight
                  : !comparisonLeft || !comparisonRight
              }
            >
              开始比对
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataState
        isLoading={comparisonLoading}
        // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
        isError={(comparisonError ?? '') !== ''}
        // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
        isEmpty={!hasResult && !comparisonLoading && (comparisonError ?? '') === ''}
        data={comparisonResult}
        loadingProps={{ message: '正在计算比对结果...' }}
        errorProps={{ error: comparisonError ?? '比对失败', showErrorDetail: true }}
        emptyProps={{
          title: '暂无比对结果',
          description: '请选择比对对象并点击「开始比对」',
        }}
      >
        // 静默回退：确认数据源和兜底意图
        {hasResult && (
          <div className="space-y-6">
            <ComparisonHeader result={comparisonResult} />

            <TopChangesSection
              rising={comparisonResult.topRisingDimensions}
              falling={comparisonResult.topFallingDimensions}
            />

            <Card>
              <CardHeader>
                <CardTitle>维度得分对比</CardTitle>
                <CardDescription>各维度左右版本得分柱状图</CardDescription>
              </CardHeader>
              <CardContent>
                <DimensionBarChart dimensions={comparisonResult.dimensions} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>维度详细对比表</CardTitle>
                <CardDescription>得分、权重、变化量一览</CardDescription>
              </CardHeader>
              <CardContent>
                <DimensionTable dimensions={comparisonResult.dimensions} />
              </CardContent>
            </Card>

            {comparisonMode === 'same-stock-versions' && (
              <Card>
                <CardHeader>
                  <CardTitle>评分时间轴</CardTitle>
                  <CardDescription>该股票所有历史版本的综合评分走势</CardDescription>
                </CardHeader>
                <CardContent>
                  <DataState
                    isLoading={timelineLoading}
                    isError={false}
                    isEmpty={!timelineLoading && timelineData.length === 0}
                    data={timelineData}
                    loadingProps={{ message: '加载时间轴...' }}
                    emptyProps={{ title: '暂无历史数据', description: '该股票暂无评分历史' }}
                  >
                    <LineChart
                      data={timelineChartData}
                      xKey="period"
                      lines={[
                        { dataKey: 'score', name: '综合评分', color: CHART_PALETTE.series1 },
                      ]}
                      height={240}
                      showGrid
                      showTooltip
                    />
                  </DataState>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DataState>
    </PageContainer>
  )
}
