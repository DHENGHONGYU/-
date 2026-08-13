import { useState } from 'react'
import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  THEME_TOKENS,
  COLOR_TOKENS,
  STOCK_COLOR_TOKENS,
} from '@/constants/theme.tokens'
import type { ShowcaseGroup } from './types'

export function buildColorTokenShowcase(): ShowcaseGroup {
  return {
    id: 'color-tokens',
    title: '颜色令牌',
    icon: Palette,
    items: [
      {
        id: 'theme-tokens',
        title: 'L1 THEME_TOKENS（通用状态色）',
        description: 'info / warning / success / destructive / muted / border',
        component: <ThemeTokensDemo />,
      },
      {
        id: 'color-tokens',
        title: 'L2 COLOR_TOKENS（业务语义色）',
        description: '上涨、下跌、评分等级、信号强度等',
        component: <ColorTokensDemo />,
      },
      {
        id: 'stock-colors',
        title: 'L5 股票红涨绿跌固定色',
        description: 'A 股市场标准，不随主题切换。',
        component: <StockColorsDemo />,
      },
    ],
  }
}

// eslint-disable-next-line react-refresh/only-export-components
function ThemeTokensDemo(): React.JSX.Element {
  const tokens = [
    { label: 'info', className: THEME_TOKENS.color.info },
    { label: 'warning', className: THEME_TOKENS.color.warning },
    { label: 'success', className: THEME_TOKENS.color.success },
    { label: 'destructive', className: THEME_TOKENS.color.destructive },
    { label: 'muted', className: THEME_TOKENS.color.muted },
    { label: 'border', className: THEME_TOKENS.color.border },
  ]

  return (
    <div className={cn('flex flex-wrap gap-3', THEME_TOKENS.gap.md)}>
      {tokens.map((t) => (
        <div
          key={t.label}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md border',
            'border-border',
            'bg-background',
          )}
        >
          <span className={cn('h-4 w-4 rounded-full', t.className)} />
          <span className={cn('text-sm', 'text-foreground')}>{t.label}</span>
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
function ColorTokensDemo(): React.JSX.Element {
  const tokens = [
    { label: 'up', className: COLOR_TOKENS.up.tailwind },
    { label: 'down', className: COLOR_TOKENS.down.tailwind },
    { label: 'scoreHigh', className: COLOR_TOKENS.scoreHigh.tailwind },
    { label: 'scoreMid', className: COLOR_TOKENS.scoreMid.tailwind },
    { label: 'scoreLow', className: COLOR_TOKENS.scoreLow.tailwind },
    { label: 'signalStrong', className: COLOR_TOKENS.signalStrong.tailwind },
    { label: 'signalWeak', className: COLOR_TOKENS.signalWeak.tailwind },
  ]

  return (
    <div className={cn('flex flex-wrap gap-3', THEME_TOKENS.gap.md)}>
      {tokens.map((t) => (
        <span
          key={t.label}
          className={cn(
            'text-sm px-3 py-1 rounded-md font-medium',
            t.className,
            'bg-muted',
          )}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
function StockColorsDemo(): React.JSX.Element {
  const [change] = useState(2.35)

  return (
    <div className={cn('space-y-4', THEME_TOKENS.stackGap.md)}>
      <div className={cn('flex flex-wrap gap-3', THEME_TOKENS.gap.md)}>
        <span className={cn('text-sm font-medium', STOCK_COLOR_TOKENS.up.tailwind)}>
          上涨 +{change.toFixed(2)}%
        </span>
        <span className={cn('text-sm font-medium', STOCK_COLOR_TOKENS.down.tailwind)}>
          下跌 -{change.toFixed(2)}%
        </span>
        <span className={cn('text-sm font-medium', STOCK_COLOR_TOKENS.neutral.tailwind)}>
          平盘 0.00%
        </span>
      </div>
      <div className={cn('text-sm', 'text-muted-foreground')}>
        推荐写法：{`<span className={STOCK_COLOR_TOKENS.up.tailwind}>+2.35%</span>`}
      </div>
    </div>
  )
}
