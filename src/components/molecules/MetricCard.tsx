import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/atoms'
import { COLOR_TOKENS, type ColorTokenKey, getColorHex } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** ColorTokenKey 字面量集合（运行时集合，与类型 ColorTokenKey 保持同构） */
const TOKEN_KEY_SET = new Set<ColorTokenKey>(Object.keys(COLOR_TOKENS) as ColorTokenKey[])

export interface MetricCardProps {
  /** 指标标题 */
  title: string
  /** 指标数值 */
  value: string | number
  /** 单位 */
  unit?: string
  /** 趋势方向 */
  trend?: 'up' | 'down' | 'neutral'
  /** 变化文本 */
  change?: string
  /** 是否加载中 */
  loading?: boolean
  /**
   * 强调色
   * - 推荐传入 `ColorTokenKey`（如 `'success'`、`'danger'`、`'scoreHigh'`），自动对齐主题色与深色模式
   * - 兼容直接传 HEX 字符串（`#ef4444`），但会在开发环境触发一次告警，请尽快迁移到 Token 键
   * @example
   * <MetricCard title="智能评分" value={92} color="scoreHigh" border />
   */
  color?: ColorTokenKey | string
  /** 是否以左边框强调（需配合 color） */
  border?: boolean
  /** 容器 className */
  className?: string
}

/**
 * 解析 MetricCard.color 参数，统一返回 HEX 颜色值
 * - ColorTokenKey → 通过 getColorHex 取主题色（自动兼容红涨绿跌 + 深色模式）
 * - HEX 字符串 → 原样返回（记录一次 warn 提醒迁移）
 * - undefined / null → undefined（走默认渲染）
 */
function resolveColorToken(raw: ColorTokenKey | string | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw === 'string' && TOKEN_KEY_SET.has(raw as ColorTokenKey)) {
    return getColorHex(raw as ColorTokenKey)
  }
  // 向后兼容：HEX 字面量，但打一次日志提醒迁移（避免 UI 层硬编码扩散）
  logger.warn('[MetricCard] color 参数使用了字面量 HEX，请迁移到 ColorTokenKey 键以对齐主题令牌与深色模式', {
    raw,
    suggestion: '例如：将 color="HEX绿" 改为 color="emerald"',
  })
  return raw
}

/**
 * 指标卡分子
 *
 * 组合：Card + 标题 + 数值 + 趋势变化
 */
export function MetricCard({
  title,
  value,
  unit,
  trend = 'neutral',
  change,
  loading,
  color,
  border = false,
  className,
}: MetricCardProps) {
  const trendColor =
    trend === 'up'
      ? COLOR_TOKENS.success.tailwind
      : trend === 'down'
        ? COLOR_TOKENS.danger.tailwind
        : COLOR_TOKENS.textMuted.tailwind

  const resolvedColor = resolveColorToken(color)

  const isLoading = loading === true
  const showUnit = unit != null && unit.length > 0
  const showChange = !isLoading && change != null && change.length > 0

  return (
    <Card
      className={cn('p-4', border ? 'border-l-4' : '', className)}
      style={border && resolvedColor ? { borderLeftColor: resolvedColor } : undefined}
    >
      <CardContent className="p-0">
        <p className="text-sm text-muted-foreground">{title}</p>
        {isLoading ? (
          <div className="mt-1 h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className="text-2xl font-semibold tracking-tight"
              style={resolvedColor ? { color: resolvedColor } : undefined}
            >
              {value}
            </span>
            {showUnit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
        )}
        {showChange && (
          <p className={cn('mt-2 text-xs', trendColor)}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'} {change}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
