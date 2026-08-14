/**
 * @fileoverview 交易复盘页面
 */

import { memo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, BarChart3, Download, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { PageContainer } from '@/components/templates/PageContainer'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage } from '@/components/atoms/Breadcrumb'
import { PageHeader } from '@/components/templates/PageHeader'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { BuySellPointReviewPanel } from '@/components/organisms/output/BuySellPointReviewPanel'
import { ReviewArtifactModal } from '@/components/organisms/output/ReviewArtifactModal'
import { usePageGuard } from '@/hooks/usePageGuard'
import { useTradeReviewReport } from '@/pages/output/hooks/useTradeReviewReport'
import { TradeReviewSummary } from '@/pages/output/components/TradeReviewSummary'
import { TradeReviewPsychProfile } from '@/pages/output/components/TradeReviewPsychProfile'
import { TradeReviewErrorList } from '@/pages/output/components/TradeReviewErrorList'
import { TradeReviewActionPlan } from '@/pages/output/components/TradeReviewActionPlan'
import { TradeReviewKlineChart } from '@/pages/output/components/TradeReviewKlineChart'

const TRADE_REVIEW_PAGE_KEY = 'trade-review'

const TradeReviewPage: React.FC = () => {
  const { guardProps } = usePageGuard(TRADE_REVIEW_PAGE_KEY)
  const {
    orders,
    loading,
    generating,
    review,
    generateReport,
    downloadReport,
  } = useTradeReviewReport()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
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

        <PageHeader
          title="交易复盘"
          description="基于交易记录生成六维复盘报告"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/output/wizard">
                  <Sparkles className="mr-2 h-4 w-4" />
                  向导模式
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/output">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          }
        />

        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">交易记录</span>
              <Badge variant="secondary" className="tabular-nums">
                {loading ? '...' : orders.length}
              </Badge>
            </div>
            <Button
              {...guardProps}
              size="sm"
              onClick={() => void generateReport()}
              disabled={guardProps.disabled || orders.length === 0 || generating}
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  生成中
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成复盘报告
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {review && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">复盘报告已生成</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.generatedAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" {...guardProps} onClick={() => setModalOpen(true)} disabled={guardProps.disabled}>
                  导出成品卡
                </Button>
                <Button variant="outline" size="sm" {...guardProps} onClick={downloadReport} disabled={guardProps.disabled}>
                  <Download className="mr-2 h-4 w-4" />
                  下载报告
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-5">
                <TradeReviewSummary
                  totalTrades={review.report.summary.totalTrades}
                  winRate={review.report.summary.winRate}
                  profitLossRatio={review.report.summary.profitLossRatio}
                  disciplineScore={review.report.summary.disciplineScore}
                />
                {review.report.buySellPointReview && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        买卖点复盘分析
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BuySellPointReviewPanel review={review.report.buySellPointReview} />
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6 lg:col-span-7">
                <TradeReviewPsychProfile profile={review.report.errorAnalysis.psychologicalProfile} />
                <TradeReviewErrorList analysis={review.report.disciplineAnalysis} />
                <TradeReviewActionPlan plan={review.report.actionPlan} />
              </div>
            </div>
          </>
        )}

        {orders.length > 0 && (
          <TradeReviewKlineChart orders={orders} />
        )}

        <ReviewArtifactModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          report={review?.report ?? null}
          generatedAt={review ? new Date(review.generatedAt).toLocaleString('zh-CN') : ''}
        />
      </PageContainer>
    </ErrorBoundary>
  )
}

export default memo(TradeReviewPage)
