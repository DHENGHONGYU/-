import { useMemo } from 'react'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageContainer, PageHeader } from '@/components/templates'
import { THEME_TOKENS } from '@/constants/theme.tokens'
import {
  ShowcaseSection,
  buildUIComponentShowcase,
  buildWidgetStateShowcase,
  buildColorTokenShowcase,
  buildStockDataShowcase,
  buildAgentDetailShowcase,
} from '@/showcase'

/**
 * 组件示例库首页
 *
 * @description
 * 为 UI 组件、Widget 状态外壳、颜色令牌、股票数据展示提供可视化示例。
 * 新增组件或 Widget 时，应在此添加对应示例，作为 AI 生成与后续复用的参照。
 */
export default function ComponentShowcasePage(): React.JSX.Element {
  const groups = useMemo(
    () => [
      buildUIComponentShowcase(),
      buildWidgetStateShowcase(),
      buildColorTokenShowcase(),
      buildStockDataShowcase(),
      buildAgentDetailShowcase(),
    ],
    [],
  )

  return (
    <PageContainer
      centered={false}
      className={cn('min-h-screen space-y-6', 'bg-muted')}
    >
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BookOpen className={cn('h-6 w-6', 'text-success')} />
            <span className={cn('text-foreground')}>组件示例库</span>
          </span>
        }
        description={
          <span className={cn('text-muted-foreground')}>
            汇总项目常用 UI 组件、驾驶舱 Widget 状态、颜色令牌与股票数据展示模式，用于 AI 生成样例与人工复用参考。
          </span>
        }
      />

      <div className={cn('grid gap-6', THEME_TOKENS.stackGap.lg)}>
        {groups.map((group) => (
          <ShowcaseSection key={group.id} group={group} />
        ))}
      </div>

      <footer
        className={cn(
          'text-xs border-t pt-4',
          'text-muted-foreground/70',
          'border-border',
        )}
      >
        提示：新增组件示例时，请同步更新 src/showcase/ 下对应文件，并在 ComponentShowcasePage 中注册。
      </footer>
    </PageContainer>
  )
}
