import { useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { WidgetStateShell, type WidgetVisualState } from '@/cockpit/widgets/components/WidgetStateShell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, twText } from '@/constants/theme.tokens'
import type { ShowcaseGroup } from './types'

export function buildWidgetStateShowcase(): ShowcaseGroup {
  return {
    id: 'widget-states',
    title: 'Widget 状态外壳',
    icon: LayoutTemplate,
    items: [
      {
        id: 'state-transitions',
        title: '四态切换',
        description: 'WidgetStateShell 统一封装 ready / loading / empty / error 四种视觉状态。',
        component: <WidgetStateTransitionDemo />,
        codeSnippet: `<WidgetStateShell\n  visualState={visualState}\n  title="自选股"\n  loadingLabel="加载自选行情…"\n  emptyTitle="暂无自选标的"\n  error={error}\n  onRetry={refresh}\n>\n  {children}\n</WidgetStateShell>`,
      },
      {
        id: 'state-grid',
        title: '状态并列展示',
        description: '各状态在固定宽度卡片下的渲染效果。',
        component: <WidgetStateGridDemo />,
      },
    ],
  }
}

function WidgetStateTransitionDemo(): React.JSX.Element {
  const [state, setState] = useState<WidgetVisualState>('ready')

  return (
    <div className={cn('space-y-4', THEME_TOKENS.stackGap.md)}>
      <div className={cn('flex flex-wrap gap-2', THEME_TOKENS.gap.sm)}>
        {(['ready', 'loading', 'empty', 'error'] as WidgetVisualState[]).map((s) => (
          <Button
            key={s}
            variant={state === s ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setState(s)}
          >
            {s}
          </Button>
        ))}
      </div>
      <WidgetStateShell
        title="示例 Widget"
        visualState={state}
        loadingLabel="正在加载行情…"
        emptyTitle="暂无数据"
        emptyDescription="请添加自选股后刷新"
        error={state === 'error' ? '网络异常，请稍后重试' : null}
        onRetry={() => setState('loading')}
      >
        <div className={cn('text-sm', twText('stone', 700))}>
          当前状态：<strong>{state}</strong>
        </div>
      </WidgetStateShell>
    </div>
  )
}

function WidgetStateGridDemo(): React.JSX.Element {
  const states: WidgetVisualState[] = ['ready', 'loading', 'empty', 'error']

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {states.map((s) => (
        <WidgetStateShell
          key={s}
          title={`状态：${s}`}
          visualState={s}
          loadingLabel="加载中…"
          emptyTitle="暂无数据"
          error={s === 'error' ? '请求失败' : null}
          onRetry={() => {}}
        >
          <span className={cn('text-sm', twText('stone', 600))}>正常内容区域</span>
        </WidgetStateShell>
      ))}
    </div>
  )
}
