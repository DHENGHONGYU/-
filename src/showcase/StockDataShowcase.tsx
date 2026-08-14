import { TrendingUp, TrendingDown, Minus, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  THEME_TOKENS,
  COLOR_TOKENS,
  getStockColorHex,
} from '@/constants/theme.tokens'
import { Badge } from '@/components/atoms/Badge'
import { RealtimeQuoteShowcase } from './RealtimeQuoteShowcase'
import type { ShowcaseGroup } from './types'

export function buildStockDataShowcase(): ShowcaseGroup {
  return {
    id: 'stock-data',
    title: '股票数据展示',
    icon: Database,
    items: [
      {
        id: 'realtime-quote',
        title: '实时行情（支持选股）',
        description: '使用 useRealtimeQuote + useKline Hooks 展示实时行情和K线数据，支持股票选择器，可切换不同股票查看实时数据。',
        component: <RealtimeQuoteShowcase />,
        codeSnippet: `// 通用组件：支持股票选择器
const [symbol, setSymbol] = useState('600519')
const { data, loading, refresh } = useRealtimeQuote({ symbol, refreshIntervalMs: 30_000 })
const { data: kline } = useKline({ symbol, period: 'daily', count: 60 })`,
      },
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

// eslint-disable-next-line react-refresh/only-export-components
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
              'border-border',
              'bg-background',
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4" style={{ color }} />
              <div>
                <div className={cn('text-sm font-medium', 'text-foreground')}>{stock.name}</div>
                <div className={cn('text-xs', 'text-muted-foreground')}>{stock.code}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-sm font-semibold', 'text-foreground')}>
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

// eslint-disable-next-line react-refresh/only-export-components
function ScoreCardDemo(): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 gap-3', THEME_TOKENS.gap.md)}>
      {DEMO_SCORES.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-lg border p-3',
            'border-border',
            'bg-background',
          )}
        >
          <div className={cn('text-xs', 'text-muted-foreground')}>{item.label}</div>
          <div className="flex items-center justify-between mt-1">
            <span className={cn('text-xl font-bold', 'text-foreground')}>{item.score}</span>
            <Badge variant={getScoreVariant(item.score)}>
              {item.score >= 70 ? '优秀' : item.score >= 50 ? '一般' : '较弱'}
            </Badge>
          </div>
          <div className={cn('mt-2 h-1.5 rounded-full', 'bg-muted')}>
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
