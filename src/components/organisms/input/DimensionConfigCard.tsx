/**
 * @module DimensionConfigCard
 * @description 维度高级配置聚合卡片。
 *
 * 整合数据源优先级、字段选择、重试/超时/降级策略，供七维配置页复用。
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Switch } from '@/components/atoms/Switch'
import { Select, SelectItem } from '@/components/atoms/Select'
import { Label } from '@/components/atoms/Label'
import SourcePrioritySelect from './SourcePrioritySelect'
import FieldSelector from './FieldSelector'
import PolicyForm from './PolicyForm'
import {
  FREQUENCY_LABELS,
  DATA_SOURCE_LABELS,
  IMPORTANCE_LABELS,
  IMPORTANCE_BADGE_VARIANT,
} from '@/config/collectConfig'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type {
  DimensionPipelineConfig,
  UpdateFrequency,
  DataSourceType,
  SourcePriorityItem,
  RetryPolicy,
  TimeoutPolicy,
  FallbackPolicy,
} from '@/types/modules/collection.types'

interface DimensionConfigCardProps {
  dimension: DimensionPipelineConfig
  disabled?: boolean
  onToggle?: () => void
  onFrequencyChange?: (frequency: UpdateFrequency) => void
  onSourcesChange?: (sources: DataSourceType[]) => void
  onSourcePriorityChange?: (priority: SourcePriorityItem[]) => void
  onFieldsChange?: (fields: string[]) => void
  onPolicyChange?: (update: {
    retryPolicy?: RetryPolicy
    timeoutPolicy?: TimeoutPolicy
    fallbackPolicy?: FallbackPolicy
  }) => void
}

/**
 * DimensionConfigCard
 */
export default function DimensionConfigCard({
  dimension,
  disabled = false,
  onToggle,
  onFrequencyChange,
  onSourcesChange,
  onSourcePriorityChange,
  onFieldsChange,
  onPolicyChange,
}: DimensionConfigCardProps): React.JSX.Element {
  return (
    <Card className={dimension.enabled ? '' : 'opacity-60'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">
              {dimension.code} · {dimension.name}
            </CardTitle>
            <Badge variant={IMPORTANCE_BADGE_VARIANT[dimension.importance]}>
              {IMPORTANCE_LABELS[dimension.importance]}
            </Badge>
          </div>
          {onToggle && (
            <Switch
              checked={dimension.enabled}
              disabled={disabled}
              onChange={onToggle}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 频率与数据源 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">采集频率</Label>
            <Select
              value={dimension.frequency}
              disabled={disabled || !dimension.enabled}
              onValueChange={(value) =>
                onFrequencyChange?.(value as UpdateFrequency)
              }
              className="h-8 text-xs"
            >
              {(Object.keys(FREQUENCY_LABELS) as UpdateFrequency[]).map((freq) => (
                <SelectItem key={freq} value={freq}>
                  {FREQUENCY_LABELS[freq]}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">业务数据源</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(DATA_SOURCE_LABELS) as DataSourceType[]).map((src) => {
                const active = dimension.sources.includes(src)
                return (
                  <Badge
                    key={src}
                    variant={active ? 'default' : 'outline'}
                    className={
                      disabled || !dimension.enabled
                        ? 'pointer-events-none opacity-50 text-[10px]'
                        : 'cursor-pointer text-[10px] hover:scale-105'
                    }
                    onClick={() => {
                      if (disabled || !dimension.enabled) return
                      const next = active
                        ? dimension.sources.filter((s) => s !== src)
                        : [...dimension.sources, src]
                      onSourcesChange?.(next)
                    }}
                  >
                    {DATA_SOURCE_LABELS[src]}
                  </Badge>
                )
              })}
            </div>
          </div>
        </div>

        {/* 数据源优先级 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">直连数据源优先级</Label>
            {!dimension.fallbackPolicy.allowFallback && (
              <span className="text-[10px]" style={{ color: COLOR_TOKENS.warning.hex }}>
                已关闭降级
              </span>
            )}
          </div>
          <SourcePrioritySelect
            value={dimension.sourcePriority}
            onChange={onSourcePriorityChange ?? (() => {})}
            disabled={disabled || !dimension.enabled}
          />
        </div>

        {/* 字段选择 */}
        <div className="space-y-2">
          <Label className="text-xs">采集字段</Label>
          <FieldSelector
            dimensionCode={dimension.code}
            selected={dimension.fields}
            onChange={onFieldsChange ?? (() => {})}
            disabled={disabled || !dimension.enabled}
          />
        </div>

        {/* 策略表单 */}
        <div className="space-y-2">
          <Label className="text-xs">重试 / 超时 / 降级策略</Label>
          <PolicyForm
            retryPolicy={dimension.retryPolicy}
            timeoutPolicy={dimension.timeoutPolicy}
            fallbackPolicy={dimension.fallbackPolicy}
            onChange={onPolicyChange ?? (() => {})}
            disabled={disabled || !dimension.enabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}
