/**
 * LoopBanner — 投研闭环横幅（V9 蓝图 §7.2 V6 Pro 组件）
 *
 * PortalShell 顶栏下方的 slim 横幅，可视化「采集 → 评分 → 信号 → 交易 → 复盘」
 * 五阶段的实时状态：最近事件相对时间、当日事件计数、健康状态
 * （idle 无数据 / active 近期有事件 / stale 超阈值无新事件）。
 *
 * 响应式约束（AGENTS.md §二 Zustand 铁律）：
 * - 通过字段级 selector 订阅 stages / updatedAt，禁止裸用 getState() 派生函数
 * - useEffect 空依赖仅做订阅注册 + 初始 refresh + 定时刷新，cleanup 配对销毁
 * - 快照派生使用 store 导出的纯函数 buildLoopSnapshot（类型 B），在 useMemo 中计算
 *
 * 颜色约束（AGENTS.md §三.5）：全部颜色经 COLOR_TOKENS / THEME_TOKENS 引用，禁裸色类/HEX。
 */
import { useEffect, useMemo } from 'react'
import { Database, BarChart3, Zap, TrendingUp, FileText, ChevronRight, RefreshCw, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLOR_TOKENS, THEME_TOKENS } from '@/constants/theme.tokens'
import { formatRelativeTime } from '@/lib/format'
import { getDefaultLoopConfig } from '@/config/loopConfig'
import type { LoopStage, LoopStageHealth, LoopStageId } from '@/types/modules/loop.types'
import { buildLoopSnapshot, useLoopStatusStore } from '@/store/loopStatusStore'
import { initLoopStatusSubscriptions } from '@/store/loopStatusSubscriptions'

/** 阶段图标映射（与 PortalShell 导航语义对齐：采集=数据库、评分=图表、信号=闪电、交易=趋势、复盘=文档） */
const STAGE_ICONS: Readonly<Record<LoopStageId, LucideIcon>> = {
  collect: Database,
  score: BarChart3,
  signal: Zap,
  trade: TrendingUp,
  review: FileText,
}

/** 健康状态 → 状态点配色（令牌引用） */
const HEALTH_DOT_CLASS: Readonly<Record<LoopStageHealth, string>> = {
  active: COLOR_TOKENS.success.bgClass,
  stale: COLOR_TOKENS.warning.bgClass,
  idle: COLOR_TOKENS.neutral.bgClass,
}

/** 健康状态 → 状态点 aria 文案 */
const HEALTH_LABELS: Readonly<Record<LoopStageHealth, string>> = {
  active: '活跃',
  stale: '停滞',
  idle: '无数据',
}

/**
 * 单个阶段 chip：图标 + 名称 + 当日计数 + 最近事件相对时间
 *
 * @param stage 阶段状态
 */
function StageChip({ stage }: { stage: LoopStage }): React.JSX.Element {
  const Icon = STAGE_ICONS[stage.id]
  return (
    <span
      className="flex items-center gap-1.5"
      title={`${stage.label}：${HEALTH_LABELS[stage.health]}，今日 ${stage.todayCount} 次事件`}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', HEALTH_DOT_CLASS[stage.health])}
        aria-hidden="true"
      />
      <Icon className={cn('h-3.5 w-3.5', THEME_TOKENS.color.muted)} />
      <span className={cn('font-medium', COLOR_TOKENS.textPrimary.tailwind)}>{stage.label}</span>
      <span className={cn('font-mono', COLOR_TOKENS.textSecondary.tailwind)}>{stage.todayCount}</span>
      <span className={COLOR_TOKENS.textMuted.tailwind}>
        {stage.lastEventAt === null ? '暂无事件' : formatRelativeTime(stage.lastEventAt)}
      </span>
    </span>
  )
}

/**
 * LoopBanner 闭环横幅
 *
 * @returns slim 横条：5 个阶段 chip 以 → 连接；闭环达成时末端显示 emerald 徽标
 */
export function LoopBanner(): React.JSX.Element {
  // 字段级 selector 订阅（响应式，铁律 1/3）
  const stages = useLoopStatusStore((s) => s.stages)
  const updatedAt = useLoopStatusStore((s) => s.updatedAt)
  const refresh = useLoopStatusStore((s) => s.refresh)

  // useEffect 仅用于初始加载与订阅注册；定时器每分钟重算 stale 状态
  useEffect(() => {
    const { refreshIntervalMs } = getDefaultLoopConfig()
    const disposeSubscriptions = initLoopStatusSubscriptions()
    refresh()
    const timer = setInterval(() => {
      refresh()
    }, refreshIntervalMs)
    return () => {
      clearInterval(timer)
      disposeSubscriptions()
    }
  }, [refresh])

  // 快照派生：纯函数 + useMemo（updatedAt 变化触发重算，保证相对时间随刷新更新）
  const snapshot = useMemo(
    () => buildLoopSnapshot(stages, updatedAt > 0 ? updatedAt : Date.now()),
    [stages, updatedAt],
  )

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto border-b bg-card px-4 py-1.5 text-xs"
      data-testid="loop-banner"
      aria-label="投研闭环状态横幅"
    >
      <RefreshCw className={cn('h-3 w-3 shrink-0', THEME_TOKENS.color.muted)} aria-hidden="true" />
      {snapshot.stages.map((stage, index) => (
        <span key={stage.id} className="flex shrink-0 items-center gap-2">
          {index > 0 && (
            <ChevronRight className={cn('h-3 w-3', COLOR_TOKENS.textMuted.tailwind)} aria-hidden="true" />
          )}
          <StageChip stage={stage} />
        </span>
      ))}
      {snapshot.loopComplete && (
        <span
          className={cn(
            'ml-auto shrink-0 rounded-full px-2 py-0.5 font-medium text-primary-foreground',
            COLOR_TOKENS.emerald.bgClass,
          )}
          data-testid="loop-complete-badge"
        >
          闭环达成
        </span>
      )}
    </div>
  )
}
