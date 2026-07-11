import { memo, useState, useEffect } from 'react'
import { Link } from 'react-router'
import { BarChart3, Download, RefreshCw, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useDisciplineStore } from '@/store/disciplineStore'
import type { TradeReviewReport } from '@/services/trading/tradeReviewAI'
import { useToast } from '@/hooks/useToast'
import { usePageGuard } from '@/hooks/usePageGuard'
import { ReviewArtifactModal } from '@/components/organisms/output/ReviewArtifactModal'
import type { Order } from '@/data/types'

interface ReviewData {
  report: TradeReviewReport
  generatedAt: string
}

export default memo(function TradeReviewPage(): React.JSX.Element {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const { toast } = useToast()
  const { guardProps } = usePageGuard('trade-review')
  // 阶段 B-2：从 store 读取 latestReport（持久化在 IDB.trade_reviews），不再维护本地 review state
  const latestReport = useDisciplineStore((s) => s.latestReport)
  const { loadOrders: loadOrdersFromStore, generateReviewReport } = useDisciplineStore()

  // 将 store 中的 latestReport 转成 UI 用的 ReviewData
  const review: ReviewData | null = latestReport
    ? { report: latestReport, generatedAt: new Date().toISOString() }
    : null

  useEffect(() => {
    void loadOrders()
  }, [])

  const loadOrders = async (): Promise<void> => {
    setLoading(true)
    try {
      const ordersList = await loadOrdersFromStore()
      setOrders(ordersList)
    } catch (error) {
      toast({
        variant: 'error',
        title: '加载交易记录失败',
        description: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  const generateReviewReportHandler = async (): Promise<void> => {
    if (orders.length === 0) {
      toast({
        variant: 'error',
        title: '无交易记录',
        description: '请先添加交易记录再生成复盘报告',
      })
      return
    }

    setGenerating(true)
    try {
      // 阶段 B-2：generateReviewReport 内部已 store.set({ latestReport: report }) + dataBridge.saveTradeReview 落库
      // 不再本地 setReview，UI 直接订阅 store.latestReport
      generateReviewReport(orders)
      toast({
        title: '复盘报告生成成功',
        description: `已分析 ${orders.length} 笔交易记录`,
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '生成复盘报告失败',
        description: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = (): void => {
    if (!review) return

    const content = buildReportMarkdown(review.report)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `交易复盘报告_${new Date(review.generatedAt).toLocaleDateString('zh-CN')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({
      title: '下载成功',
      description: '交易复盘报告已下载',
    })
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/output">输出舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>交易复盘</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">交易复盘</h1>
            <p className="text-muted-foreground">基于交易记录生成六维复盘报告</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/output">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              生成复盘报告
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">交易记录数量</p>
                <p className="text-2xl font-bold">{loading ? '...' : orders.length}</p>
              </div>
              <Button
                {...guardProps}
                onClick={() => void generateReviewReportHandler()}
                disabled={guardProps.disabled || orders.length === 0 || generating}
              >
                {generating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    生成复盘报告
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {review && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>交易摘要</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" {...guardProps} onClick={() => setModalOpen(true)} disabled={guardProps.disabled}>
                      导出成品卡
                    </Button>
                    <Button variant="outline" size="sm" {...guardProps} onClick={downloadReport} disabled={guardProps.disabled}>
                      <Download className="mr-2 h-4 w-4" />
                      下载报告
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">总交易笔数</p>
                    <p className="text-2xl font-bold">{review.report.summary.totalTrades}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">胜率</p>
                    <p className="text-2xl font-bold">{review.report.summary.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">盈亏比</p>
                    <p className="text-2xl font-bold">{review.report.summary.profitLossRatio.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">纪律评分</p>
                    <p className="text-2xl font-bold">{review.report.summary.disciplineScore.toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>心理画像</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{review.report.errorAnalysis.psychologicalProfile.name}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {review.report.errorAnalysis.psychologicalProfile.rootCause}
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">特征：</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {review.report.errorAnalysis.psychologicalProfile.characteristics.map((char, i) => (
                      <li key={i}>{char}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">改进方向：</p>
                  <p className="text-sm text-muted-foreground">
                    {review.report.errorAnalysis.psychologicalProfile.improvementDirection}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>纪律分析</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">计划遵守率</p>
                    <p className="text-xl font-bold">{review.report.disciplineAnalysis.planAdherenceRate.toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">止损执行率</p>
                    <p className="text-xl font-bold">{review.report.disciplineAnalysis.stopLossExecutionRate.toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">仓位管理</p>
                    <p className="text-xl font-bold">{review.report.disciplineAnalysis.positionManagementScore.toFixed(1)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">情绪控制</p>
                    <p className="text-xl font-bold">{review.report.disciplineAnalysis.emotionControlScore.toFixed(1)}</p>
                  </div>
                </div>
                {review.report.disciplineAnalysis.improvements.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">改善建议：</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {review.report.disciplineAnalysis.improvements.map((imp, i) => (
                        <li key={i}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>行动计划</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.report.actionPlan.immediate.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">立即执行：</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {review.report.actionPlan.immediate.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {review.report.actionPlan.shortTerm.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">短期（1个月）：</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {review.report.actionPlan.shortTerm.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {review.report.actionPlan.longTerm.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">长期（3个月）：</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {review.report.actionPlan.longTerm.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <ReviewArtifactModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          report={review?.report ?? null}
          generatedAt={review ? new Date(review.generatedAt).toLocaleString('zh-CN') : ''}
        />
      </div>
    </ErrorBoundary>
  )
})

function buildReportMarkdown(report: TradeReviewReport): string {
  const lines: string[] = []
  lines.push('# 交易复盘报告')
  lines.push(`- 生成时间：${new Date(report.generatedAt).toLocaleString('zh-CN')}`)
  lines.push('')

  lines.push('## 交易摘要')
  lines.push(`- 总交易笔数：${report.summary.totalTrades}`)
  lines.push(`- 盈利笔数：${report.summary.profitableTrades}`)
  lines.push(`- 亏损笔数：${report.summary.losingTrades}`)
  lines.push(`- 胜率：${report.summary.winRate.toFixed(1)}%`)
  lines.push(`- 盈亏比：${report.summary.profitLossRatio.toFixed(2)}`)
  lines.push(`- 平均盈利：${report.summary.avgProfit.toFixed(2)}%`)
  lines.push(`- 平均亏损：${report.summary.avgLoss.toFixed(2)}%`)
  lines.push(`- 总盈亏：${report.summary.totalPnL.toFixed(2)} (${report.summary.totalPnLPercent.toFixed(2)}%)`)
  lines.push(`- 纪律评分：${report.summary.disciplineScore.toFixed(1)}`)
  lines.push(`- 错误总数：${report.summary.totalErrors}`)
  lines.push('')

  lines.push('## 心理画像')
  lines.push(`- 类型：${report.errorAnalysis.psychologicalProfile.name}`)
  lines.push(`- 心理根源：${report.errorAnalysis.psychologicalProfile.rootCause}`)
  lines.push('- 特征：')
  for (const char of report.errorAnalysis.psychologicalProfile.characteristics) {
    lines.push(`  - ${char}`)
  }
  lines.push(`- 改进方向：${report.errorAnalysis.psychologicalProfile.improvementDirection}`)
  lines.push('')

  lines.push('## 纪律分析')
  lines.push(`- 计划遵守率：${report.disciplineAnalysis.planAdherenceRate.toFixed(1)}%`)
  lines.push(`- 止损执行率：${report.disciplineAnalysis.stopLossExecutionRate.toFixed(1)}%`)
  lines.push(`- 仓位管理评分：${report.disciplineAnalysis.positionManagementScore.toFixed(1)}`)
  lines.push(`- 情绪控制评分：${report.disciplineAnalysis.emotionControlScore.toFixed(1)}`)
  lines.push(`- 综合纪律评分：${report.disciplineAnalysis.overallScore.toFixed(1)}`)
  if (report.disciplineAnalysis.improvements.length > 0) {
    lines.push('- 改善建议：')
    for (const imp of report.disciplineAnalysis.improvements) {
      lines.push(`  - ${imp}`)
    }
  }
  lines.push('')

  lines.push('## 行动计划')
  if (report.actionPlan.immediate.length > 0) {
    lines.push('### 立即执行')
    for (const item of report.actionPlan.immediate) {
      lines.push(`- ${item}`)
    }
  }
  if (report.actionPlan.shortTerm.length > 0) {
    lines.push('### 短期（1个月）')
    for (const item of report.actionPlan.shortTerm) {
      lines.push(`- ${item}`)
    }
  }
  if (report.actionPlan.longTerm.length > 0) {
    lines.push('### 长期（3个月）')
    for (const item of report.actionPlan.longTerm) {
      lines.push(`- ${item}`)
    }
  }

  return lines.join('\n')
}
