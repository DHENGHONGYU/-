/**
 * @fileoverview SampleDataBadge - 示例数据标记徽章（common 层组件）
 * @module components/common/SampleDataBadge
 *
 * 用于标识当前展示的数据为合成/示例数据（如首次启动种子数据、
 * 演示用历史评分等），避免用户将示例数据误认为真实行情或真实分析结果。
 *
 * 使用项目既有 Badge 原子组件 + 语义令牌（warning 变体），
 * 不硬编码任何 Tailwind 颜色调色板（如 text-red-500 等）。
 */

import { type HTMLAttributes } from 'react'
import { Badge } from '@/components/atoms/Badge'

export interface SampleDataBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** 可选：覆盖展示文案，默认「示例数据」 */
  label?: string
}

/**
 * SampleDataBadge —— 在渲染合成/示例数据的组件上条件挂载。
 * 仅作标记，不做任何数据判断（是否示例由调用方依据 isSampleData 决定）。
 */
export function SampleDataBadge({ label = '示例数据', className, ...props }: SampleDataBadgeProps): React.JSX.Element {
  return (
    <Badge variant="warning" className={className} title="当前展示的为示例/合成数据，非真实行情或真实分析结果" {...props}>
      {label}
    </Badge>
  )
}

export default SampleDataBadge
