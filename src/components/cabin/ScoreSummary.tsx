/**
 * 评分摘要组件
 * v0.9.11 P2-CMP-004b
 * 显示评分结论依据和缺失数据
 */
import { memo } from 'react'

interface ScoreSummaryProps {
  /** 评分结论依据 */
  basis: string
  /** 缺失字段列表 */
  missingFields: string[]
}

/**
 * 评分摘要区域
 */
export const ScoreSummary = memo(function ScoreSummary({ basis, missingFields }: ScoreSummaryProps): React.JSX.Element {
  return (
    <>
      {/* 评分结论 */}
      <div className="rounded-md bg-muted p-3">
        <p className="text-sm font-medium">评分结论依据</p>
        <p className="text-sm text-muted-foreground">{basis}</p>
      </div>

      {/* 缺失数据 */}
      <div className="rounded-md border p-3">
        <p className="text-sm font-medium">缺失数据</p>
        {missingFields.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">无缺失字段</p>
        )}
      </div>
    </>
  )
})
