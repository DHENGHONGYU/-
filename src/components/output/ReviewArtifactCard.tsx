/**
 * @fileoverview P5 复盘「成品卡」展示组件（纯展示，令牌化）
 *
 * 将一份 TradeReviewReport 渲染为可预览、可分享的精致「成品卡」。
 * 设计母题：墨色顶栏（宋韵克制）+ 翠绿签名锚点（复用 SignalSpectrum 难度谱语言）
 * + 四宫格摘要 + 逐维复盘 + 合规脚注。全部引用设计令牌，无任何硬编码颜色。
 *
 * @module components/output/ReviewArtifactCard
 */
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'
import type { TradeReviewReport } from '@/services/trading/tradeReviewAI'
import { SignalSpectrum } from '@/components/cockpit/SignalSpectrum'

export interface ReviewArtifactCardProps extends HTMLAttributes<HTMLDivElement> {
  /** 复盘报告数据 */
  report: TradeReviewReport
  /** 生成时间戳（ISO 字符串，用于脚注显示） */
  generatedAt: string
  /** 卡片最大宽度（默认 720px，适配移动与桌面） */
  maxWidth?: number
}

/** 数值正负着色：盈利/正向用 success，亏损/负向用 danger */
function signHex(value: number): string {
  if (value > 0) return COLOR_TOKENS.success.hex
  if (value < 0) return COLOR_TOKENS.danger.hex
  return COLOR_TOKENS.textSecondary.hex
}

/** 评分高低着色：>=80 优(success) / >=60 良(信号中蓝) / 其余 待改进(amber) */
function scoreHex(value: number): string {
  if (value >= 80) return COLOR_TOKENS.success.hex
  if (value >= 60) return COLOR_TOKENS.info.hex
  return COLOR_TOKENS.warning.hex
}

function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

interface MetricProps {
  label: string
  value: string
  /** 文本色（HEX），缺省使用主文字色 */
  colorHex?: string
}

function Metric({ label, value, colorHex }: MetricProps) {
  return (
    <div className={cn('flex flex-col gap-1')}>
      <span className={cn(THEME_TOKENS.typography.fontSize.xs, COLOR_TOKENS.textMuted.tailwind)}>
        {label}
      </span>
      <span
        className={cn(THEME_TOKENS.typography.fontSize['2xl'], THEME_TOKENS.typography.fontWeight.bold, THEME_TOKENS.typography.lineHeight.tight)}
        style={{ color: colorHex ?? COLOR_TOKENS.textPrimary.hex }}
      >
        {value}
      </span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2', THEME_TOKENS.spacing.pxSm)}>
      <span
        className={cn('inline-block h-4 w-1 rounded-full')}
        style={{ background: COLOR_TOKENS.emerald.hex }}
      />
      <h4 className={cn(THEME_TOKENS.typography.fontSize.base, THEME_TOKENS.typography.fontWeight.semibold, THEME_TOKENS.color.border)}>
        {children}
      </h4>
    </div>
  )
}

export function ReviewArtifactCard({
  report,
  generatedAt,
  maxWidth = 720,
  className,
  ...props
}: ReviewArtifactCardProps) {
  const { summary, errorAnalysis, disciplineAnalysis, skillDevelopment, actionPlan, aiInsight } = report
  const profile = errorAnalysis.psychologicalProfile

  return (
    <div
      className={cn('mx-auto w-full overflow-hidden border shadow-sm', THEME_TOKENS.radius.lg, COLOR_TOKENS.bgCard.tailwind, className)}
      style={{ maxWidth }}
      {...props}
    >
      {/* 墨色顶栏（宋韵克制 + 品牌翠绿点缀） */}
      <div
        className={cn('flex items-center justify-between px-6 py-4', THEME_TOKENS.color.border)}
        style={{ background: COLOR_TOKENS.textPrimary.hex, color: COLOR_TOKENS.bgCard.hex }}
      >
        <div className={cn('flex flex-col gap-0.5')}>
          <span className={cn(THEME_TOKENS.typography.fontSize.lg, THEME_TOKENS.typography.fontWeight.bold)}>
            交易复盘 · 成品卡
          </span>
          <span className={cn(THEME_TOKENS.typography.fontSize.xs, THEME_TOKENS.color.muted)} style={{ color: COLOR_TOKENS.bgCard.hex }}>
            V9 智能投研复盘系统 · {generatedAt}
          </span>
        </div>
        <span
          className={cn('rounded-full px-2.5 py-0.5', THEME_TOKENS.typography.fontSize.xs, THEME_TOKENS.typography.fontWeight.semibold)}
          style={{ background: COLOR_TOKENS.emerald.hex, color: COLOR_TOKENS.bgCard.hex }}
        >
          纪律 {summary.disciplineScore.toFixed(0)}
        </span>
      </div>

      <div className={cn('space-y-6 p-6')}>
        {/* 纪律评分签名谱（复用 SignalSpectrum 母题） */}
        <div className={cn('space-y-2')}>
          <SignalSpectrum value={summary.disciplineScore} label="综合纪律评分" size="md" />
        </div>

        {/* 摘要四宫格 */}
        <section className={cn('space-y-3')}>
          <SectionTitle>交易摘要</SectionTitle>
          <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-4')}>
            <Metric label="胜率" value={formatPercent(summary.winRate)} colorHex={scoreHex(summary.winRate)} />
            <Metric label="盈亏比" value={summary.profitLossRatio.toFixed(2)} colorHex={scoreHex(summary.profitLossRatio * 20)} />
            <Metric label="总盈亏" value={formatPercent(summary.totalPnLPercent)} colorHex={signHex(summary.totalPnL)} />
            <Metric label="交易笔数" value={String(summary.totalTrades)} />
          </div>
        </section>

        {/* 心理画像 */}
        <section className={cn('space-y-3')}>
          <SectionTitle>心理画像</SectionTitle>
          <div className={cn('flex flex-wrap items-center gap-2')}>
            <span
              className={cn('rounded-full px-2.5 py-0.5', THEME_TOKENS.typography.fontSize.xs, THEME_TOKENS.typography.fontWeight.semibold)}
              style={{ background: COLOR_TOKENS.emerald.hex, color: COLOR_TOKENS.bgCard.hex }}
            >
              {profile.name}
            </span>
            <span className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textSecondary.tailwind)}>
              {profile.rootCause}
            </span>
          </div>
        </section>

        {/* 纪律分析 */}
        <section className={cn('space-y-3')}>
          <SectionTitle>纪律分析</SectionTitle>
          <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-4')}>
            <Metric label="计划遵守率" value={formatPercent(disciplineAnalysis.planAdherenceRate)} colorHex={scoreHex(disciplineAnalysis.planAdherenceRate)} />
            <Metric label="止损执行率" value={formatPercent(disciplineAnalysis.stopLossExecutionRate)} colorHex={scoreHex(disciplineAnalysis.stopLossExecutionRate)} />
            <Metric label="仓位管理" value={disciplineAnalysis.positionManagementScore.toFixed(1)} colorHex={scoreHex(disciplineAnalysis.positionManagementScore * 10)} />
            <Metric label="情绪控制" value={disciplineAnalysis.emotionControlScore.toFixed(1)} colorHex={scoreHex(disciplineAnalysis.emotionControlScore * 10)} />
          </div>
        </section>

        {/* 技能发展 */}
        <section className={cn('space-y-3')}>
          <SectionTitle>技能发展</SectionTitle>
          <div className={cn('flex items-center justify-between rounded-md border px-4 py-3', THEME_TOKENS.color.border)}>
            <span className={cn(THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textSecondary.tailwind)}>当前综合技能等级</span>
            <span className={cn(THEME_TOKENS.typography.fontSize.lg, THEME_TOKENS.typography.fontWeight.semibold)} style={{ color: COLOR_TOKENS.emerald.hex }}>
              {skillDevelopment.overallLevel}
            </span>
          </div>
        </section>

        {/* 行动计划 */}
        <section className={cn('space-y-3')}>
          <SectionTitle>行动计划</SectionTitle>
          <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3')}>
            <PlanColumn title="立即执行" items={actionPlan.immediate} />
            <PlanColumn title="短期（1 个月）" items={actionPlan.shortTerm} />
            <PlanColumn title="长期（3 个月）" items={actionPlan.longTerm} />
          </div>
        </section>

        {/* AI 深度洞察 */}
        {(aiInsight.pnlAttribution.length > 0 || aiInsight.dataPatterns.length > 0 || aiInsight.personalizedAdvice.length > 0) && (
          <section className={cn('space-y-3')}>
            <SectionTitle>AI 深度洞察</SectionTitle>
            <div className={cn('space-y-2')}>
              {aiInsight.pnlAttribution.length > 0 && (
                <InsightGroup title="盈亏归因" items={aiInsight.pnlAttribution} />
              )}
              {aiInsight.dataPatterns.length > 0 && (
                <InsightGroup title="数据规律" items={aiInsight.dataPatterns} />
              )}
              {aiInsight.personalizedAdvice.length > 0 && (
                <InsightGroup title="个性化建议" items={aiInsight.personalizedAdvice} />
              )}
            </div>
          </section>
        )}
      </div>

      {/* 合规脚注 */}
      <div
        className={cn('border-t px-6 py-3', THEME_TOKENS.typography.fontSize.xs, THEME_TOKENS.color.muted, THEME_TOKENS.color.border)}
      >
        本成品卡由 AI 基于本地交易记录生成，仅供个人研究复盘参考，不构成任何投资建议。
      </div>
    </div>
  )
}

function PlanColumn({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className={cn('rounded-md border p-3', THEME_TOKENS.color.border, COLOR_TOKENS.bgCard.tailwind)}>
      <p className={cn(THEME_TOKENS.typography.fontSize.sm, THEME_TOKENS.typography.fontWeight.medium, COLOR_TOKENS.textSecondary.tailwind)}>
        {title}
      </p>
      <ul className={cn('mt-2 list-disc space-y-1 pl-4', THEME_TOKENS.typography.fontSize.xs, COLOR_TOKENS.textMuted.tailwind)}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function InsightGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn('space-y-1')}>
      <p className={cn(THEME_TOKENS.typography.fontSize.sm, THEME_TOKENS.typography.fontWeight.medium, COLOR_TOKENS.textSecondary.tailwind)}>
        {title}
      </p>
      <ul className={cn('list-disc space-y-1 pl-4', THEME_TOKENS.typography.fontSize.sm, COLOR_TOKENS.textMuted.tailwind)}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default ReviewArtifactCard
