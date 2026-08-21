/**
 * @fileoverview P5 向导式复盘（渐进披露）
 *
 * 将交易复盘拆解为四步渐进流程，逐段揭示信息，降低认知负荷：
 *   1) 选择范围  → 2) 生成复盘  → 3) 逐维复盘（一次只看一维）→ 4) 导出成品卡
 * 全程复用 P3 四态组件（Loading/Empty/Error/Skeleton）、motion 令牌与
 * SignalSpectrum 签名母题。组件层直接消费 disciplineStore（符合 AGENTS 分层）。
 *
 * @module components/output/ReviewWizard
 */
import { getSafeArray } from '@/lib/safeCoerce'
import { memo, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, FileBarChart, Sparkles, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Loading } from '@/components/molecules/states/Loading'
import { Empty } from '@/components/molecules/states/Empty'
import { ErrorState } from '@/components/molecules/states/ErrorState'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { SignalSpectrum } from '@/components/cockpit/SignalSpectrum'
import { useDisciplineStore } from '@/store/disciplineStore'
import { useToast } from '@/hooks/useToast'
import { usePageGuard } from '@/hooks/usePageGuard'
import type { Order } from '@/types'
import type { TradeReviewReport } from '@/services/trading/tradeReviewAI'
import { ReviewArtifactCard } from './ReviewArtifactCard'
import { downloadReviewArtifactHtml, openReviewArtifactPreview } from './reviewArtifact'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

const STEPS = ['选择范围', '生成复盘', '逐维复盘', '导出成品卡'] as const
const REVIEW_GENERATION_DELAY_MS = 480

interface ReviewData {
  report: TradeReviewReport
  generatedAt: string
}

interface WizardProps {
  /** 预置订单（可选，默认从 disciplineStore 加载） */
  initialOrders?: Order[]
}

export default memo(function ReviewWizard({ initialOrders }: WizardProps): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [orders, setOrders] = useState<Order[]>(getSafeArray(initialOrders))
  const [loadingOrders, setLoadingOrders] = useState(!initialOrders)
  const [review, setReview] = useState<ReviewData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [dimensionIndex, setDimensionIndex] = useState(0)
  const { toast } = useToast()
  const { guardProps } = usePageGuard('trade-review-wizard')
  const { loadOrders: loadOrdersFromStore, generateReviewReport } = useDisciplineStore()
  const genStartedRef = useRef(false)

  // 首屏加载订单（仅当未注入预置订单时）
  useEffect(() => {
    if (initialOrders) {
      setLoadingOrders(false)
      return
    }
    let active = true
    const setIfActive = (setter: () => void) => {
      if (active) setter()
    }
    void (async () => {
      setLoadingOrders(true)
      try {
        const list = await loadOrdersFromStore()
        setIfActive(() => setOrders(list))
      } catch (error) {
        setIfActive(() =>
          toast({
            variant: 'error',
            title: '加载交易记录失败',
            description: error instanceof Error ? error.message : '未知错误',
          }),
        )
      } finally {
        setIfActive(() => setLoadingOrders(false))
      }
    })()
    return () => {
      active = false
    }
  }, [initialOrders, loadOrdersFromStore, toast])

  // 进入「生成复盘」步骤时自动生成（渐进披露：先见 Loading，再揭示结果）
  useEffect(() => {
    if (step !== 1 || review || genStartedRef.current) return
    genStartedRef.current = true
    setGenerating(true)
    setGenError(null)
    logger.info('[ReviewWizard] 开始生成复盘报告', { orders: orders.length })
    const timer = setTimeout(() => {
      try {
        const report = generateReviewReport(orders)
        const generatedAt = new Date().toISOString()
        setReview({ report, generatedAt })
        logger.info('[ReviewWizard] 复盘报告生成完成', { totalTrades: report.summary.totalTrades })
      } catch (error) {
        setGenError(error instanceof Error ? error.message : '未知错误')
        logger.error('[ReviewWizard] 生成复盘报告失败', { message: error instanceof Error ? error.message : String(error) })
      } finally {
        setGenerating(false)
      }
    }, REVIEW_GENERATION_DELAY_MS)
    return () => clearTimeout(timer)
  }, [step, review, orders, generateReviewReport])

  const goNext = (): void => setStep((s) => Math.min(STEPS.length - 1, s + 1))
  const goPrev = (): void => setStep((s) => Math.max(0, s - 1))

  const handleExportHtml = (): void => {
    if (!review) return
    downloadReviewArtifactHtml(review.report, review.generatedAt)
    toast({ title: '已导出', description: '成品卡 HTML 已下载' })
  }
  const handlePreview = (): void => {
    if (!review) return
    openReviewArtifactPreview(review.report, review.generatedAt)
  }

  return (
    <div className={cn('mx-auto w-full max-w-3xl space-y-6')}>
      <Stepper current={step} />

      <div className={cn(THEME_TOKENS.motion.fadeIn)}>
        {step === 0 && (
          <StepScope
            orders={orders}
            loading={loadingOrders}
            onStart={() => {
              logger.info('[ReviewWizard] 进入生成步骤', { orders: orders.length })
              goNext()
            }}
            guardProps={guardProps}
          />
        )}

        {step === 1 && (
          <StepGenerate generating={generating} error={genError} hasData={!!review} />
        )}

        {step === 2 && review && (
          <StepDimensions
            report={review.report}
            index={dimensionIndex}
            onIndexChange={setDimensionIndex}
            onNext={goNext}
          />
        )}

        {step === 3 && review && (
          <StepArtifact
            report={review.report}
            generatedAt={review.generatedAt}
            onExport={handleExportHtml}
            onPreview={handlePreview}
          />
        )}
      </div>

      {/* 全局底部导航 */}
      <div className={cn('flex items-center justify-between', THEME_TOKENS.gap.md)}>
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          上一步
        </Button>
        {step < STEPS.length - 1 ? (
          <span className={cn(THEME_TOKENS.typography.fontSize.xs, COLOR_TOKENS.textMuted.tailwind)}>
            步骤 {step + 1} / {STEPS.length} · {STEPS[step]}
          </span>
        ) : (
          <Badge variant="success">已完成</Badge>
        )}
        {step === 0 && (
          <Button
            variant="primary"
            size="sm"
            {...guardProps}
            disabled={guardProps.disabled || orders.length === 0 || loadingOrders}
            onClick={() => {
              logger.info('[ReviewWizard] 进入生成步骤（底部）', { orders: orders.length })
              goNext()
            }}
          >
            开始复盘
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
        {step === 1 && !generating && review && (
          <Button variant="primary" size="sm" onClick={goNext}>
            逐维复盘
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
        {step === 2 && (
          <Button variant="primary" size="sm" onClick={goNext}>
            导出成品卡
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
})

// ============================================================
// 步骤指示器
// ============================================================
function Stepper({ current }: { current: number }) {
  return (
    <div className={cn('flex items-center')}>
      {STEPS.map((label, i) => {
        const active = i === current
        const done = i < current
        return (
          <div key={label} className={cn('flex flex-1 items-center', i < STEPS.length - 1 && 'flex-1')}>
            <div className={cn('flex items-center gap-2')}>
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  THEME_TOKENS.radius.full,
                )}
                style={{
                  background: active || done ? COLOR_TOKENS.emerald.hex : COLOR_TOKENS.bgMuted.hex,
                  color: active || done ? COLOR_TOKENS.bgCard.hex : COLOR_TOKENS.textMuted.hex,
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={cn(
                  THEME_TOKENS.typography.fontSize.xs,
                  THEME_TOKENS.typography.fontWeight.medium,
                  active ? COLOR_TOKENS.textPrimary.tailwind : COLOR_TOKENS.textMuted.tailwind,
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn('mx-2 h-px flex-1')}
                style={{ background: done ? COLOR_TOKENS.emerald.hex : COLOR_TOKENS.border.hex }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// 步骤 1：选择范围
// ============================================================
function StepScope({
  orders,
  loading,
  onStart,
  guardProps,
}: {
  orders: Order[]
  loading: boolean
  onStart: () => void
  guardProps: { disabled: boolean; title?: string }
}) {
  return (
    <div className={cn('rounded-lg border p-6', THEME_TOKENS.color.border, COLOR_TOKENS.bgCard.tailwind)}>
      <div className={cn('mb-4 flex items-center gap-2')}>
        <Wand2 className={cn('h-5 w-5')} style={{ color: COLOR_TOKENS.emerald.hex }} />
        <h3 className={cn(THEME_TOKENS.typography.fontSize.lg, THEME_TOKENS.typography.fontWeight.semibold)}>选择复盘范围</h3>
      </div>
      {loading ? (
        <div className={cn('space-y-3')}>
          <Skeleton variant="text" />
          <Skeleton variant="rect" />
        </div>
      ) : orders.length === 0 ? (
        <Empty
          title="暂无可复盘的交易记录"
          description="请先在交易舱录入订单，或返回数据导入补充样本后再开始复盘。"
        />
      ) : (
        <div className={cn('space-y-4')}>
          <p className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textSecondary.tailwind)}>
            将基于以下交易记录生成六维复盘报告：
          </p>
          <div className={cn('flex items-center justify-between rounded-md border px-4 py-3', THEME_TOKENS.color.border)}>
            <span className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textMuted.tailwind)}>交易记录数量</span>
            <span className={cn(THEME_TOKENS.typography.fontSize['2xl'], THEME_TOKENS.typography.fontWeight.bold)} style={{ color: COLOR_TOKENS.emerald.hex }}>
              {orders.length}
            </span>
          </div>
          <Button variant="primary" size="md" {...guardProps} disabled={guardProps.disabled} onClick={onStart}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            开始复盘
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 步骤 2：生成复盘
// ============================================================
function StepGenerate({
  generating,
  error,
  hasData,
}: {
  generating: boolean
  error: string | null
  hasData: boolean
}) {
  if (error) {
    return <ErrorState title="生成失败" description={error} />
  }
  if (generating || !hasData) {
    return (
      <div className={cn('rounded-lg border p-6', THEME_TOKENS.color.border, COLOR_TOKENS.bgCard.tailwind)}>
        <Loading label="正在生成六维复盘报告…" size="lg" />
        <div className={cn('mt-4 space-y-3')}>
          <Skeleton variant="text" />
          <Skeleton variant="rect" />
        </div>
      </div>
    )
  }
  return (
    <div className={cn('rounded-lg border p-6 text-center', THEME_TOKENS.color.border, COLOR_TOKENS.bgCard.tailwind)}>
      <CheckCircle2 className={cn('mx-auto h-10 w-10')} style={{ color: COLOR_TOKENS.success.hex }} />
      <p className={cn('mt-3', THEME_TOKENS.typography.fontSize.base, THEME_TOKENS.typography.fontWeight.medium)}>复盘报告已生成</p>
      <p className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textMuted.tailwind)}>点击下方「逐维复盘」逐段查看每个维度。</p>
    </div>
  )
}

// ============================================================
// 步骤 3：逐维复盘（渐进披露核心）
// ============================================================
const DIMENSION_LABELS = ['交易摘要', '心理画像', '纪律分析', '技能发展', '行动计划', 'AI 深度洞察'] as const

function StepDimensions({
  report,
  index,
  onIndexChange,
  onNext,
}: {
  report: TradeReviewReport
  index: number
  onIndexChange: (i: number) => void
  onNext: () => void
}) {
  const total = DIMENSION_LABELS.length
  const goDim = (dir: 1 | -1): void => {
    const next = Math.min(total - 1, Math.max(0, index + dir))
    if (next !== index) {
      logger.info('[ReviewWizard] 切换复盘维度', { from: index, to: next })
      onIndexChange(next)
    }
  }

  return (
    <div className={cn('space-y-4')}>
      <div className={cn('flex items-center justify-between')}>
        <span className={cn(THEME_TOKENS.typography.fontSize.xs, COLOR_TOKENS.textMuted.tailwind)}>
          第 {index + 1} / {total} 维 · {DIMENSION_LABELS[index]}
        </span>
        <div className={cn('flex items-center gap-1')}>
          {DIMENSION_LABELS.map((_, i) => (
            <span
              key={i}
              className={cn('h-1.5 w-6 rounded-full')}
              style={{ background: i <= index ? COLOR_TOKENS.emerald.hex : COLOR_TOKENS.bgMuted.hex }}
            />
          ))}
        </div>
      </div>

      <div className={cn(THEME_TOKENS.motion.fadeIn, 'rounded-lg border p-5', THEME_TOKENS.color.border, COLOR_TOKENS.bgCard.tailwind)}>
        {renderDimension(report, index)}
      </div>

      <div className={cn('flex items-center justify-between')}>
        <Button variant="outline" size="sm" onClick={() => goDim(-1)} disabled={index === 0}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          上一维
        </Button>
        {index < total - 1 ? (
          <Button variant="primary" size="sm" onClick={() => goDim(1)}>
            下一维
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onNext}>
            导出成品卡
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function renderDimension(report: TradeReviewReport, index: number): React.ReactNode {
  const { summary, errorAnalysis, disciplineAnalysis, skillDevelopment, actionPlan, aiInsight } = report
  const profile = errorAnalysis.psychologicalProfile

  switch (index) {
    case 0:
      return (
        <div className={cn('space-y-4')}>
          <SignalSpectrum value={summary.disciplineScore} label="综合纪律评分" />
          <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-4')}>
            <DimMetric label="胜率" value={`${summary.winRate.toFixed(1)}%`} />
            <DimMetric label="盈亏比" value={summary.profitLossRatio.toFixed(2)} />
            <DimMetric label="总盈亏" value={`${summary.totalPnLPercent.toFixed(1)}%`} />
            <DimMetric label="交易笔数" value={String(summary.totalTrades)} />
          </div>
        </div>
      )
    case 1:
      return (
        <div className={cn('space-y-3')}>
          <div className={cn('flex flex-wrap items-center gap-2')}>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold')} style={{ background: COLOR_TOKENS.emerald.hex, color: COLOR_TOKENS.bgCard.hex }}>
              {profile.name}
            </span>
          </div>
          <p className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textSecondary.tailwind)}>{profile.rootCause}</p>
          <p className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textMuted.tailwind)}>改进方向：{profile.improvementDirection}</p>
        </div>
      )
    case 2:
      return (
        <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-4')}>
          <DimMetric label="计划遵守率" value={`${disciplineAnalysis.planAdherenceRate.toFixed(1)}%`} />
          <DimMetric label="止损执行率" value={`${disciplineAnalysis.stopLossExecutionRate.toFixed(1)}%`} />
          <DimMetric label="仓位管理" value={disciplineAnalysis.positionManagementScore.toFixed(1)} />
          <DimMetric label="情绪控制" value={disciplineAnalysis.emotionControlScore.toFixed(1)} />
        </div>
      )
    case 3:
      return (
        <div className={cn('flex items-center justify-between')}>
          <span className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textSecondary.tailwind)}>当前综合技能等级</span>
          <span className={cn(THEME_TOKENS.typography.fontSize.lg, THEME_TOKENS.typography.fontWeight.semibold)} style={{ color: COLOR_TOKENS.emerald.hex }}>
            {skillDevelopment.overallLevel}
          </span>
        </div>
      )
    case 4:
      return (
        <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3')}>
          <PlanList title="立即执行" items={actionPlan.immediate} />
          <PlanList title="短期（1 个月）" items={actionPlan.shortTerm} />
          <PlanList title="长期（3 个月）" items={actionPlan.longTerm} />
        </div>
      )
    case 5:
      return (
        <div className={cn('space-y-2')}>
          {aiInsight.pnlAttribution.length > 0 && <Insight title="盈亏归因" items={aiInsight.pnlAttribution} />}
          {aiInsight.dataPatterns.length > 0 && <Insight title="数据规律" items={aiInsight.dataPatterns} />}
          {aiInsight.personalizedAdvice.length > 0 && <Insight title="个性化建议" items={aiInsight.personalizedAdvice} />}
        </div>
      )
    default:
      return null
  }
}

function DimMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('flex flex-col gap-1')}>
      <span className={cn(THEME_TOKENS.typography.fontSize.xs, COLOR_TOKENS.textMuted.tailwind)}>{label}</span>
      <span className={cn(THEME_TOKENS.typography.fontSize.xl, THEME_TOKENS.typography.fontWeight.bold)} style={{ color: COLOR_TOKENS.textPrimary.hex }}>
        {value}
      </span>
    </div>
  )
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className={cn('rounded-md border p-3', THEME_TOKENS.color.border)}>
      <p className={cn(THEME_TOKENS.typography.fontSize.sm, THEME_TOKENS.typography.fontWeight.medium, COLOR_TOKENS.textSecondary.tailwind)}>{title}</p>
      <ul className={cn('mt-2 list-disc space-y-1 pl-4', THEME_TOKENS.typography.fontSize.xs, COLOR_TOKENS.textMuted.tailwind)}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

function Insight({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn('space-y-1')}>
      <p className={cn(THEME_TOKENS.typography.fontSize.sm, THEME_TOKENS.typography.fontWeight.medium, COLOR_TOKENS.textSecondary.tailwind)}>{title}</p>
      <ul className={cn('list-disc space-y-1 pl-4', THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textMuted.tailwind)}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================
// 步骤 4：导出成品卡
// ============================================================
function StepArtifact({
  report,
  generatedAt,
  onExport,
  onPreview,
}: {
  report: TradeReviewReport
  generatedAt: string
  onExport: () => void
  onPreview: () => void
}) {
  return (
    <div className={cn('space-y-4')}>
      <div className={cn('flex items-center gap-2', THEME_TOKENS.spacing.pxSm)}>
        <FileBarChart className={cn('h-5 w-5')} style={{ color: COLOR_TOKENS.emerald.hex }} />
        <h3 className={cn(THEME_TOKENS.typography.fontSize.lg, THEME_TOKENS.typography.fontWeight.semibold)}>复盘成品卡</h3>
      </div>
      <div className={cn('max-h-[52vh] overflow-auto rounded-md border p-2', THEME_TOKENS.color.border)}>
        <ReviewArtifactCard report={report} generatedAt={generatedAt} />
      </div>
      <div className={cn('flex flex-wrap items-center justify-end gap-2')}>
        <Button variant="outline" size="sm" onClick={onPreview}>
          新标签页预览
        </Button>
        <Button variant="primary" size="sm" onClick={onExport}>
          下载 HTML
        </Button>
      </div>
    </div>
  )
}
