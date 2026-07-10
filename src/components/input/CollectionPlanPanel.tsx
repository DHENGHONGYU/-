/**
 * @module CollectionPlanPanel
 * @description 采集方案整合面板 - 展示四层数据源架构和维度接口映射
 * @status 框架代码 - 待实现真实 API 调用
 */

import { memo, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/Separator'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { DATA_SOURCE_ENDPOINTS } from '@/config/dataSourceRegistry'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'
import {
  DEFAULT_DIMENSIONS,
  FREQUENCY_LABELS,
  DATA_SOURCE_LABELS,
  GLOBAL_LIMITS,
  DIMENSION_API_MAPPING,
  STORAGE_TYPE_LABELS,
  IMPORTANCE_LABELS,
  IMPORTANCE_BADGE_VARIANT,
  DIMENSION_COLORS,
} from '@/config/collectConfig'

// 真实数据源端点 → 展示层级与状态色映射
const DATA_SOURCE_LAYERS = DATA_SOURCE_ENDPOINTS.map((endpoint, index) => ({
  layer: `L${index + 1}`,
  id: endpoint.id,
  name: endpoint.name,
  description: endpoint.description,
  status: endpoint.enabled ? 'available' : 'disabled',
  latency: `~${endpoint.timeoutMs}ms`,
  color: resolveLayerColor(endpoint.id),
}))

function resolveLayerColor(id: QuoteDataSourceId) {
  switch (id) {
    case 'tencent':
    case 'sina':
      return COLOR_TOKENS.success
    case 'netease':
      return COLOR_TOKENS.info
    case 'akshare':
      return COLOR_TOKENS.warning
    case 'mock':
    default:
      return COLOR_TOKENS.bgMuted
  }
}

export const CollectionPlanPanel = memo(() => {
  const dimensions = useSevenDimConfigStore((s) => s.dimensions)
  const enabledCount = dimensions.filter((d) => d.enabled).length

  // 计算每个维度的预估调用次数（增强版：含存储策略/重要性/字段）
  const dimensionEstimates = useMemo(() => {
    return dimensions
      .filter((d) => d.enabled)
      .map((dim) => {
        const frequencyLabel = FREQUENCY_LABELS[dim.frequency]
        const sources = dim.sources.map((s) => DATA_SOURCE_LABELS[s]).join(' → ')
        const storageLabel = STORAGE_TYPE_LABELS[dim.storageType]
        const importanceLabel = IMPORTANCE_LABELS[dim.importance]
        const importanceVariant = IMPORTANCE_BADGE_VARIANT[dim.importance]
        const displayFields = dim.fields.slice(0, 5)
        const extraFieldCount = Math.max(0, dim.fields.length - 5)
        return {
          code: dim.code,
          name: dim.name,
          frequency: frequencyLabel,
          sources,
          batchSize: dim.batchSize,
          cacheTtl: dim.cacheTtl,
          storageType: storageLabel,
          importance: importanceLabel,
          importanceVariant,
          fields: displayFields,
          extraFieldCount,
          totalFieldCount: dim.fields.length,
        }
      })
  }, [dimensions])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>采集方案整合</CardTitle>
          <Badge variant="secondary">
            {enabledCount} / {DEFAULT_DIMENSIONS.length} 维度启用
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 四层数据源架构图 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">四层数据源架构</h3>
          <div className="space-y-2">
            {DATA_SOURCE_LAYERS.map((layer) => (
              <div
                key={layer.layer}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge className={layer.color.tailwind}>{layer.layer}</Badge>
                  <div>
                    <p className="text-sm font-medium">{layer.name}</p>
                    <p className="text-xs text-muted-foreground">{layer.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">延迟</p>
                  <p className="text-sm font-medium">{layer.latency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* 维度接口映射表（增强版：含点击跳转和颜色标识） */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">维度接口映射</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">维度</th>
                  <th className="px-2 py-2 text-left font-medium">接口</th>
                  <th className="px-2 py-2 text-left font-medium">方法</th>
                  <th className="px-2 py-2 text-left font-medium">缓存</th>
                </tr>
              </thead>
              <tbody>
                {DIMENSION_API_MAPPING.map((mapping) => {
                  const dim = dimensions.find((d) => d.code === mapping.code)
                  const isEnabled = dim?.enabled ?? false
                  return (
                    <tr
                      key={mapping.code}
                      onClick={() => {
                        const element = document.getElementById(`dimension-${mapping.code}`)
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                      className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        !isEnabled ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={DIMENSION_COLORS[mapping.code]}
                          >
                            {mapping.code}
                          </Badge>
                          <span className="text-muted-foreground">{mapping.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{mapping.api}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline">{mapping.method}</Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{mapping.cache}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Separator />

        {/* 8维度频率配置表（增强版：含存储策略/重要性/字段） */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">维度频率配置</h3>
          <div className="space-y-3">
            {dimensionEstimates.map((est) => (
              <div
                key={est.code}
                id={`dimension-${est.code}`}
                className="rounded-md border p-4"
              >
                {/* 第一行：维度代码（带颜色）+ 名称 + 重要性 */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={DIMENSION_COLORS[est.code]}
                    >
                      {est.code}
                    </Badge>
                    <span className="text-sm font-medium">{est.name}</span>
                    <Badge variant={est.importanceVariant}>
                      {est.importance}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {est.storageType}
                  </div>
                </div>

                {/* 第二行：频率/批次/数据源 */}
                <div className="mb-2 flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">频率：</span>
                    <span>{est.frequency}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">批次：</span>
                    <span>{est.batchSize}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">数据源：</span>
                    <span>{est.sources}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">缓存：</span>
                    <span>{est.cacheTtl}分钟</span>
                  </div>
                </div>

                {/* 第三行：字段列表 */}
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1">字段：</span>
                  {est.fields.map((field) => (
                    <Badge key={field} variant="secondary" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                  {est.extraFieldCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      +{est.extraFieldCount}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* 限流配置展示 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">限流配置</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">分钟限流</p>
              <p className="text-lg font-bold">{GLOBAL_LIMITS.rateLimitPerMinute}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">小时限流</p>
              <p className="text-lg font-bold">{GLOBAL_LIMITS.rateLimitPerHour}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">日限流</p>
              <p className="text-lg font-bold">{GLOBAL_LIMITS.rateLimitPerDay}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

CollectionPlanPanel.displayName = 'CollectionPlanPanel'
