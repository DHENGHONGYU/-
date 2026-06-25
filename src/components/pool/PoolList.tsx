import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { QualityIndicator } from '@/components/input/QualityIndicator'
import { getPoolLabel } from '@/core/poolTransitionEngine'
import { getPoolTransitionOptions } from '@/services/stockpool/stockpoolService'
import { DEFAULT_POOL_GROUP } from '@/config/dbConfig'
import type { ResearchStatus } from '@/config/dbConfig'
import type { Stock } from '@/data/types'

export interface PoolListProps {
  stocks: Stock[]
  selectedSymbols: string[]
  allGroups?: string[]
  onSelectToggle: (symbol: string) => void
  onTransition: (symbol: string, toStatus: ResearchStatus) => void
  onChangeGroup?: (symbol: string, group: string) => void
  onRefreshKline?: (stock: Stock) => void
  onAnalyze?: (symbol: string) => void
}

export function PoolList({
  stocks,
  selectedSymbols,
  allGroups = [],
  onSelectToggle,
  onTransition,
  onChangeGroup,
  onRefreshKline,
  onAnalyze,
}: PoolListProps): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">选择</th>
            <th className="px-3 py-2 text-left font-medium">代码</th>
            <th className="px-3 py-2 text-left font-medium">名称</th>
            <th className="px-3 py-2 text-left font-medium">状态</th>
            <th className="px-3 py-2 text-left font-medium">分组</th>
            <th className="px-3 py-2 text-left font-medium">来源</th>
            <th className="px-3 py-2 text-right font-medium">价格</th>
            <th className="px-3 py-2 text-right font-medium">PE</th>
            <th className="px-3 py-2 text-right font-medium">PB</th>
            <th className="px-3 py-2 text-left font-medium">数据质量</th>
            <th className="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {stocks.length === 0 ? (
            <tr>
              <td colSpan={11} className="py-8 text-center text-muted-foreground">
                暂无标的
              </td>
            </tr>
          ) : (
            stocks.map((stock) => {
              const options = getPoolTransitionOptions(stock.researchStatus)
              const group = stock.group ?? DEFAULT_POOL_GROUP
              const availableGroups = allGroups.filter((g) => g !== group)
              return (
                <tr key={stock.symbol} className="border-t hover:bg-accent/30">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selectedSymbols.includes(stock.symbol)}
                      onChange={() => onSelectToggle(stock.symbol)}
                      aria-label={`选择 ${stock.symbol}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{stock.symbol}</td>
                  <td className="px-3 py-2">{stock.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">
                      {getPoolLabel(stock.researchStatus)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {onChangeGroup && availableGroups.length > 0 ? (
                      <select
                        className="h-7 rounded-md border bg-background px-2 text-xs"
                        value={group}
                        onChange={(e) => onChangeGroup(stock.symbol, e.target.value)}
                        aria-label={`${stock.symbol} 分组`}
                      >
                        <option value={group}>{group}</option>
                        {availableGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {group}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">{stock.source}</td>
                  <td className="px-3 py-2 text-right">
                    {stock.price !== undefined ? stock.price.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {stock.pe !== undefined ? stock.pe.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {stock.pb !== undefined ? stock.pb.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <QualityIndicator quality={stock.dataQuality} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {options.map((option) => (
                        <Button
                          key={option.value}
                          variant="secondary"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => onTransition(stock.symbol, option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                      {onAnalyze && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => onAnalyze(stock.symbol)}
                        >
                          分析
                        </Button>
                      )}
                      {onRefreshKline && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => onRefreshKline(stock)}
                        >
                          刷新行情
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
