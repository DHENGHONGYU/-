/**
 * @module PolicyForm
 * @description 维度级重试/超时/降级策略表单。
 */

import { Label } from '@/components/atoms/Label'
import { Input } from '@/components/atoms/Input'
import { Switch } from '@/components/atoms/Switch'
import type {
  RetryPolicy,
  TimeoutPolicy,
  FallbackPolicy,
} from '@/types/modules/collection.types'

interface PolicyFormProps {
  retryPolicy: RetryPolicy
  timeoutPolicy: TimeoutPolicy
  fallbackPolicy: FallbackPolicy
  onChange: (update: {
    retryPolicy?: RetryPolicy
    timeoutPolicy?: TimeoutPolicy
    fallbackPolicy?: FallbackPolicy
  }) => void
  disabled?: boolean
}

/**
 * PolicyForm
 */
export default function PolicyForm({
  retryPolicy,
  timeoutPolicy,
  fallbackPolicy,
  onChange,
  disabled = false,
}: PolicyFormProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">最大重试次数</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={retryPolicy.maxRetries}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                retryPolicy: { ...retryPolicy, maxRetries: Number(e.target.value) || 0 },
              })
            }
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">退避倍数</Label>
          <Input
            type="number"
            min={1}
            step={0.5}
            value={retryPolicy.backoffMultiplier}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                retryPolicy: {
                  ...retryPolicy,
                  backoffMultiplier: Number(e.target.value) || 1,
                },
              })
            }
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">初始间隔 (ms)</Label>
          <Input
            type="number"
            min={0}
            step={100}
            value={retryPolicy.initialDelayMs}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                retryPolicy: {
                  ...retryPolicy,
                  initialDelayMs: Number(e.target.value) || 0,
                },
              })
            }
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">单次请求超时 (ms)</Label>
          <Input
            type="number"
            min={500}
            step={500}
            value={timeoutPolicy.requestTimeoutMs}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                timeoutPolicy: {
                  ...timeoutPolicy,
                  requestTimeoutMs: Number(e.target.value) || 500,
                },
              })
            }
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">维度采集超时 (ms)</Label>
          <Input
            type="number"
            min={1000}
            step={1000}
            value={timeoutPolicy.dimensionTimeoutMs}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                timeoutPolicy: {
                  ...timeoutPolicy,
                  dimensionTimeoutMs: Number(e.target.value) || 1000,
                },
              })
            }
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label className="text-xs">允许降级到次优先级源</Label>
          <Switch
            checked={fallbackPolicy.allowFallback}
            disabled={disabled}
            onChange={() =>
              onChange({
                fallbackPolicy: {
                  ...fallbackPolicy,
                  allowFallback: !fallbackPolicy.allowFallback,
                },
              })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label className="text-xs">允许最终降级到 Mock</Label>
          <Switch
            checked={fallbackPolicy.allowMockFallback}
            disabled={disabled}
            onChange={() =>
              onChange({
                fallbackPolicy: {
                  ...fallbackPolicy,
                  allowMockFallback: !fallbackPolicy.allowMockFallback,
                },
              })
            }
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">失败率告警阈值 (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={fallbackPolicy.alertFailureRate}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              fallbackPolicy: {
                ...fallbackPolicy,
                alertFailureRate: Math.min(
                  100,
                  Math.max(0, Number(e.target.value) || 0),
                ),
              },
            })
          }
          className="h-8 text-xs"
        />
      </div>
    </div>
  )
}
