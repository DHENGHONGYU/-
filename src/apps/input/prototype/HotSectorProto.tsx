import React, { useState } from 'react'
import { Trophy, TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { mockSectors, type MockSector } from './mockData'

function SectorCard({
  sector,
  selected,
  onSelect,
}: {
  sector: MockSector
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const trendIcon =
    sector.trend === 'up' ? (
      <TrendingUp className="h-4 w-4 text-red-400" />
    ) : sector.trend === 'down' ? (
      <TrendingDown className="h-4 w-4 text-emerald-400" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    )

  return (
    <button
      onClick={onSelect}
      className={`rounded-lg border p-4 text-left transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'bg-card hover:bg-accent/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <span className="font-bold">#{sector.rank}</span>
            <span className="font-medium">{sector.name}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{sector.advice}</p>
        </div>
        <div className="flex items-center gap-1">
          {trendIcon}
          <Badge
            className={
              sector.total >= 75
                ? 'bg-emerald-500/20 text-emerald-400'
                : sector.total >= 60
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
            }
          >
            {sector.total}分
          </Badge>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {sector.factors.map((f) => {
          const pct = (f.value / f.max) * 100
          return (
            <div key={f.name} className="flex items-center gap-2 text-xs">
              <span className="w-10 text-muted-foreground">{f.name}</span>
              <div className="flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: f.color }}
                />
              </div>
              <span className="w-8 text-right">{f.value}</span>
            </div>
          )
        })}
      </div>
    </button>
  )
}

export default function HotSectorProto(): React.JSX.Element {
  const [selectedCode, setSelectedCode] = useState<string>(mockSectors[0]?.code ?? '')
  const activeSector = mockSectors.find((s) => s.code === selectedCode)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockSectors.map((sector) => (
          <SectorCard
            key={sector.code}
            sector={sector}
            selected={selectedCode === sector.code}
            onSelect={() => setSelectedCode(sector.code)}
          />
        ))}
      </div>

      {activeSector && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>#{activeSector.rank}</span>
              <span>{activeSector.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                关联股票
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-sm text-muted-foreground">
              轮动建议：{activeSector.advice}
            </div>
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">代码</th>
                    <th className="px-3 py-2 text-left">名称</th>
                    <th className="px-3 py-2 text-right">现价</th>
                    <th className="px-3 py-2 text-right">涨跌</th>
                    <th className="px-3 py-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSector.stocks.map((stock) => (
                    <tr key={stock.symbol} className="border-t">
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
                        <Button
                          size="sm"
                          variant={stock.added ? 'secondary' : 'primary'}
                          disabled={stock.added}
                          className="h-7 px-2 text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {stock.added ? '已加入' : '加入候选池'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
