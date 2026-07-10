import { useMemo } from 'react'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, twText, twBg, twBorder } from '@/constants/theme.tokens'
import {
  ShowcaseSection,
  buildUIComponentShowcase,
  buildWidgetStateShowcase,
  buildColorTokenShowcase,
  buildStockDataShowcase,
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
    ],
    [],
  )

  return (
    <div className={cn('min-h-screen p-6 space-y-6', twBg('stone', 50))}>
      <header className={cn('space-y-2', THEME_TOKENS.stackGap.sm)}>
        <div className="flex items-center gap-2">
          <BookOpen className={cn('h-6 w-6', twText('emerald', 600))} />
          <h1 className={cn('text-2xl font-bold', twText('stone', 800))}>
            组件示例库
          </h1>
        </div>
        <p className={cn('text-sm', twText('gray', 500))}>
          汇总项目常用 UI 组件、驾驶舱 Widget 状态、颜色令牌与股票数据展示模式，用于 AI 生成样例与人工复用参考。
        </p>
      </header>

      <div className={cn('grid gap-6', THEME_TOKENS.stackGap.lg)}>
        {groups.map((group) => (
          <ShowcaseSection key={group.id} group={group} />
        ))}
      </div>

      <footer
        className={cn(
          'text-xs border-t pt-4',
          twText('gray', 400),
          twBorder('gray', 200),
        )}
      >
        提示：新增组件示例时，请同步更新 src/showcase/ 下对应文件，并在 ComponentShowcasePage 中注册。
      </footer>
    </div>
  )
}
