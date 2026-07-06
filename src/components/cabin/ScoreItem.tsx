/**
 * 评分项组件
 * v0.9.11 P2-CMP-004a
 * 显示单个评分维度
 */
import { memo } from 'react'
import { twText } from '@/constants/theme.tokens'

interface ScoreItemProps {
  /** 评分维度名称 */
  name: string
  /** 评分值 */
  score: number | null
  /** 前一个评分值（用于计算变化） */
  prevScore?: number | null
}

/**
 * 单个评分维度项
 */
export const ScoreItem = memo(function ScoreItem({ name, score, prevScore }: ScoreItemProps): React.JSX.Element {
  const hasDelta = prevScore !== null && prevScore !== undefined && score !== null
  const delta = hasDelta ? score! - prevScore! : null
  const isPositive = delta !== null && delta > 0
  const isNegative = delta !== null && delta < 0

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{name}</span>
      <div className="flex items-center gap-2">
        <span className={score === null ? 'text-muted-foreground' : 'font-medium'}>
          {score === null ? 'N/A' : score.toFixed(2)}
        </span>
        {delta !== null && (
          <span
            className={`text-xs ${
              isPositive ? twText('green', 600) : isNegative ? twText('red', 600) : 'text-muted-foreground'
            }`}
          >
            {isPositive ? '+' : ''}{delta.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
})
