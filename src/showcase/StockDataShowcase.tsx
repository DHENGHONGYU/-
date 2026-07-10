import { TrendingUp, TrendingDown, Minus, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  THEME_TOKENS,
  COLOR_TOKENS,
  getStockColorHex,
  twText,
  twBg,
  twBorder,
} from '@/constants/theme.tokens'
import { Badge } from '@/components/ui/Badge'
import type { ShowcaseGroup } from './types'

export function buildStockDataShowcase(): ShowcaseGroup {
  return {
    id: 'stock-data',
    title: '股票数据展示',
    icon: Database,
    items: [
      {
        id: 'watchlist-row',
        title: '自选股列表行',
        description: '展示名称、代码、价格、涨跌幅，颜色严格走 STOCK_COLOR_TOKENS。',
        component: <WatchlistRowDemo />,
        codeSnippet: `const color = getStockColorHex(changePercent)\n<span style={{ color }}>{changePercent}%</span>`,
      },
      {
        id: 'score-card',
        title: '评分卡片',
        description: 'KAI 评分等级使用 COLOR_TOKENS.score* 系列。',
        component: <ScoreCardDemo />,
      },
    ],
  }
}

const DEMO_STOCKS = [
  { code: '600519', name: '贵州茅台', price: 1688.88, changePercent: 1.25 },
  { code: '000858', name: '五粮液', price: 142.5, changePercent: -0.82 },
  { code: '300750', name: '宁德时代', price: 198.2, changePercent: 0.0 },
  { code: '002594', name: '比亚迪', price: 258.6, changePercent: 2.78 },
]

function WatchlistRowDemo(): React.JSX.Element {
  return (
    <div className={cn('space-y-2', THEME_TOKENS.stackGap.sm)}>
      {DEMO_STOCKS.map((stock) => {
        const color = getStockColorHex(stock.changePercent)
        const Icon = stock.changePercent > 0 ? TrendingUp : stock.changePercent < 0 ? TrendingDown : Minus
        return (
          <div
            key={stock.code}
            className={cn(
              'flex items-center justify-between rounded-md border px-3 py-2',
              twBorder('gray', 200),
              twBg('white', 0),
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4" style={{ color }} />
              <div>
                <div className={cn('text-sm font-medium', twText('stone', 800))}>{stock.name}</div>
                <div className={cn('text-xs', twText('gray', 500))}>{stock.code}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-sm font-semibold', twText('stone', 800))}>
                ¥{stock.price.toFixed(2)}
              </div>
              <div className="text-sm font-medium" style={{ color }}>
                {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DEMO_SCORES = [
  { label: '竞争力', score: 85 },
  { label: '技术面', score: 72 },
  { label: '基本面', score: 68 },
  { label: '情绪面', score: 55 },
  { label: '资金面', score: 45 },
  { label: '行业面', score: 30 },
]

function getScoreVariant(score: number): 'success' | 'warning' | 'destructive' {
  if (score >= 70) return 'success'
  if (score >= 50) return 'warning'
  return 'destructive'
}

function ScoreCardDemo(): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 gap-3', THEME_TOKENS.gap.md)}>
      {DEMO_SCORES.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-lg border p-3',
            twBorder('gray', 200),
            twBg('white', 0),
          )}
        >
          <div className={cn('text-xs', twText('gray', 500))}>{item.label}</div>
          <div className="flex items-center justify-between mt-1">
            <span className={cn('text-xl font-bold', twText('stone', 800))}>{item.score}</span>
            <Badge variant={getScoreVariant(item.score)}>
              {item.score >= 70 ? '优秀' : item.score >= 50 ? '一般' : '较弱'}
            </Badge>
          </div>
          <div className={cn('mt-2 h-1.5 rounded-full', twBg('gray', 200))}>
            <div
              className={cn('h-1.5 rounded-full', COLOR_TOKENS.scoreHigh.bgClass)}
              style={{ width: `${item.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
