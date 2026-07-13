import React from 'react'
import { Badge, Button, Checkbox } from '@/components/atoms'
import { QualityIndicator } from '@/components/organisms/input/QualityIndicator'
import { getPoolLabel, getPoolTransitionOptions } from '@/core/poolTransitionEngine'
import { DEFAULT_POOL_GROUP, POOL_TYPE } from '@/constants/pool.constants'
import type { ResearchStatus } from '@/constants/pool.constants'
import type { PoolItem } from '@/types/modules/pool.types'

export interface PoolListProps {
  items: PoolItem[]
  selectedSymbols: string[]
  allGroups?: string[]
  onSelectToggle: (symbol: string) => void
  onTransition: (symbol: string, toStatus: ResearchStatus) => void
  onChangeGroup?: (symbol: string, group: string) => void
  onRefreshKline?: (item: PoolItem) => void
  onAnalyze?: (symbol: string) => void
}

/**
 * PoolList
 */
export function PoolList({
  items,
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
          {items.length === 0 ? (
            <tr>
              <td colSpan={11} className="py-8 text-center text-muted-foreground">
                暂无标的
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const options = getPoolTransitionOptions(POOL_TYPE.research, item.status as ResearchStatus)
              const group = item.group ?? DEFAULT_POOL_GROUP
              const availableGroups = allGroups.filter((g) => g !== group)
              return (
                <tr key={item.symbol} className="border-t hover:bg-accent/30">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selectedSymbols.includes(item.symbol)}
                      onChange={() => onSelectToggle(item.symbol)}
                      aria-label={`选择 ${item.symbol}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{item.symbol}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">
                      {getPoolLabel(POOL_TYPE.research, item.status as ResearchStatus)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {onChangeGroup && availableGroups.length > 0 ? (
                      <select
                        className="h-7 rounded-md border bg-background px-2 text-xs"
                        value={group}
                        onChange={(e) => onChangeGroup(item.symbol, e.target.value)}
                        aria-label={`${item.symbol} 分组`}
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
                  <td className="px-3 py-2">{item.source}</td>
                  <td className="px-3 py-2 text-right">
                    {item.price !== undefined ? item.price.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.pe !== undefined ? item.pe.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.pb !== undefined ? item.pb.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <QualityIndicator quality={item.dataQuality} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {options.map((option) => (
                        <Button
                          key={`${option.pool}-${option.status}`}
                          variant="secondary"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => onTransition(item.symbol, option.status as ResearchStatus)}
                        >
                          {option.label}
                        </Button>
                      ))}
                      {onAnalyze && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => onAnalyze(item.symbol)}
                        >
                          分析
                        </Button>
                      )}
                      {onRefreshKline && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => onRefreshKline(item)}
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
