import { useState } from 'react'
import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'
import type { ShowcaseGroup } from './types'

export function buildUIComponentShowcase(): ShowcaseGroup {
  return {
    id: 'ui-components',
    title: '基础 UI 组件',
    icon: Layers,
    items: [
      {
        id: 'button-variants',
        title: 'Button 变体',
        description: '所有 Button 变体必须使用 theme.tokens 中的颜色令牌。',
        component: <ButtonVariantsDemo />,
        codeSnippet: `<Button variant="primary">主要</Button>\n<Button variant="danger">危险</Button>\n<Button variant="success">成功</Button>`,
      },
      {
        id: 'badge-variants',
        title: 'Badge 变体',
        description: 'Badge 用于状态标签、评分等级、信号强度等场景。',
        component: <BadgeVariantsDemo />,
        codeSnippet: `<Badge variant="success">红涨</Badge>\n<Badge variant="destructive">绿跌</Badge>`,
      },
      {
        id: 'form-controls',
        title: '表单控件',
        description: 'Label、Input、Checkbox、Switch 组合。',
        component: <FormControlsDemo />,
      },
    ],
  }
}

function ButtonVariantsDemo(): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap gap-3', THEME_TOKENS.gap.md)}>
      <Button variant="primary">主要</Button>
      <Button variant="secondary">次要</Button>
      <Button variant="outline">描边</Button>
      <Button variant="ghost">幽灵</Button>
      <Button variant="danger">危险</Button>
      <Button variant="success">成功</Button>
    </div>
  )
}

function BadgeVariantsDemo(): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap gap-2', THEME_TOKENS.gap.sm)}>
      <Badge variant="default">默认</Badge>
      <Badge variant="secondary">次要</Badge>
      <Badge variant="outline">描边</Badge>
      <Badge variant="destructive">错误</Badge>
      <Badge variant="success">上涨</Badge>
      <Badge variant="warning">警告</Badge>
    </div>
  )
}

function FormControlsDemo(): React.JSX.Element {
  const [checked, setChecked] = useState(false)
  const [enabled, setEnabled] = useState(true)

  return (
    <div className={cn('space-y-4', THEME_TOKENS.stackGap.md)}>
      <div className="space-y-2">
        <Label htmlFor="demo-input">示例输入</Label>
        <Input id="demo-input" placeholder="请输入股票代码…" />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox
          id="demo-checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <Label htmlFor="demo-checkbox">已阅读 AI 免责声明</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="demo-switch"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <Label htmlFor="demo-switch">实时行情推送：{enabled ? '开启' : '关闭'}</Label>
      </div>
    </div>
  )
}
