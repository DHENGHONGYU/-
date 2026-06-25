import React, { useMemo, useState } from 'react'
import { Search, LayoutGrid, List, Download, Upload, RefreshCw, Trash2, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { mockStocks, type MockStock } from './mockData'

function QualityDot({ status }: { status: MockStock['quality'] }): React.JSX.Element {
  const colors = {
    full: 'bg-emerald-400',
    partial: 'bg-yellow-400',
    missing: 'bg-red-400',
  }
  const labels = {
    full: '数据完整',
    partial: '部分缺失',
    missing: '未采集',
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  )
}

export default function DashboardProto(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'card' | 'list'>('card')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [autoCollect, setAutoCollect] = useState(true)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return mockStocks
    return mockStocks.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    )
  }, [query])

  const toggleSelect = (symbol: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">候选池标的</p>
            <p className="text-2xl font-bold">{mockStocks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">数据完整</p>
            <p className="text-2xl font-bold">
              {mockStocks.filter((s) => s.quality === 'full').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">待采集</p>
            <p className="text-2xl font-bold">
              {mockStocks.filter((s) => s.quality === 'missing').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">自动采集</p>
            <button
              onClick={() => setAutoCollect((v) => !v)}
              className={`mt-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoCollect ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  autoCollect ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>录入候选股票（原型）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索代码或名称，如 600519 / 茅台"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button>添加</Button>
            <Button variant="secondary">
              <Upload className="mr-1.5 h-4 w-4" />
              导入
            </Button>
            <Button variant="secondary">
              <Download className="mr-1.5 h-4 w-4" />
              导出
            </Button>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm">
              <span className="text-muted-foreground">已选 {selected.size} 只</span>
              <Button size="sm" variant="secondary">
                <RefreshCw className="mr-1.5 h-3 w-3" />
                批量采集
              </Button>
              <Button size="sm" variant="secondary">
                流转到初筛池
              </Button>
              <Button size="sm" variant="danger">
                <Trash2 className="mr-1.5 h-3 w-3" />
                删除
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">共 {filtered.length} 只</p>
            <div className="flex items-center gap-1 rounded-md border p-1">
              <button
                onClick={() => setView('card')}
                className={`rounded p-1 ${view === 'card' ? 'bg-accent' : ''}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={`rounded p-1 ${view === 'list' ? 'bg-accent' : ''}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {view === 'card' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((stock) => (
                <div
                  key={stock.symbol}
                  className={`rounded-md border bg-card p-3 transition-colors ${
                    selected.has(stock.symbol) ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <input
                      type="checkbox"
                      checked={selected.has(stock.symbol)}
                      onChange={() => toggleSelect(stock.symbol)}
                      className="mt-1"
                    />
                    <Badge variant="outline">{stock.status}</Badge>
                  </div>
                  <div className="mt-2">
                    <p className="font-mono font-medium">{stock.symbol}</p>
                    <p className="text-sm text-muted-foreground">{stock.name}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span>¥{stock.price.toFixed(2)}</span>
                    <span className={stock.change >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {stock.change >= 0 ? '+' : ''}
                      {stock.change.toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <QualityDot status={stock.quality} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                      <Play className="mr-1 h-3 w-3" />
                      采集
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      分析
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left"> </th>
                    <th className="px-3 py-2 text-left">代码</th>
                    <th className="px-3 py-2 text-left">名称</th>
                    <th className="px-3 py-2 text-right">现价</th>
                    <th className="px-3 py-2 text-right">涨跌</th>
                    <th className="px-3 py-2 text-left">数据质量</th>
                    <th className="px-3 py-2 text-left">状态</th>
                    <th className="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((stock) => (
                    <tr key={stock.symbol} className="border-t">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(stock.symbol)}
                          onChange={() => toggleSelect(stock.symbol)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono">{stock.symbol}</td>
                      <td className="px-3 py-2">{stock.name}</td>
                      <td className="px-3 py-2 text-right">{stock.price.toFixed(2)}</td>
                      <td
                        className={`px-3 py-2 text-right ${
                          stock.change >= 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {stock.change >= 0 ? '+' : ''}
                        {stock.change.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2">
                        <QualityDot status={stock.quality} />
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{stock.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          采集
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
