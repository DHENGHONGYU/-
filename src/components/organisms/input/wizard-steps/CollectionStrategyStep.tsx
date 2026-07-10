/**
 * @module CollectionStrategyStep
 * @description 数据采集向导第二步：采集策略
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { Card, CardContent } from '@/components/ui/Card'
import { COLOR_SHADES } from '@/constants/theme.tokens'

/**
 * CollectionStrategyStep
 */
export function CollectionStrategyStep(): React.JSX.Element {
  const frequency = useCollectionWizardStore((s) => s.frequency)
  const setFrequency = useCollectionWizardStore((s) => s.setFrequency)
  const cronExpression = useCollectionWizardStore((s) => s.cronExpression)
  const setCronExpression = useCollectionWizardStore((s) => s.setCronExpression)
  const priority = useCollectionWizardStore((s) => s.priority)
  const setPriority = useCollectionWizardStore((s) => s.setPriority)
  const cacheTTL = useCollectionWizardStore((s) => s.cacheTTL)
  const setCacheTTL = useCollectionWizardStore((s) => s.setCacheTTL)
  const cacheStrategy = useCollectionWizardStore((s) => s.cacheStrategy)
  const setCacheStrategy = useCollectionWizardStore((s) => s.setCacheStrategy)

  return (
    <div className="space-y-4">
      <div className={cn('text-sm', COLOR_SHADES.gray[500])}>
        配置采集频率、优先级、缓存策略等参数。
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <label className="text-sm font-medium">采集频率</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className="w-full rounded border border-input px-2 py-1"
            >
              <option value="once">单次</option>
              <option value="hourly">每小时</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
            </select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <label className="text-sm font-medium">Cron 表达式</label>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              className="w-full rounded border border-input px-2 py-1"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <label className="text-sm font-medium">任务优先级</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full rounded border border-input px-2 py-1"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <label className="text-sm font-medium">缓存策略</label>
            <select
              value={cacheStrategy}
              onChange={(e) => setCacheStrategy(e.target.value as typeof cacheStrategy)}
              className="w-full rounded border border-input px-2 py-1"
            >
              <option value="no-cache">不缓存</option>
              <option value="stale-while-revalidate">过期后异步刷新</option>
              <option value="force-cache">强制缓存</option>
            </select>
            <label className="text-sm font-medium">缓存 TTL（秒）</label>
            <input
              type="number"
              value={cacheTTL}
              onChange={(e) => setCacheTTL(Number(e.target.value))}
              className="w-full rounded border border-input px-2 py-1"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
