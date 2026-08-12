/**
 * @module AnalysisTemplateCards
 * @description 分析舱模板快捷入口卡片组：快速个股评分、行业对比、回测向导。
 * 所有卡片数据来自 analysisTemplatesConfig，组件中零硬编码。
 */

import { Link } from 'react-router'
import { Zap, Scale, FlaskConical } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  ANALYSIS_TEMPLATES,
  ANALYSIS_TEMPLATE_GRID_COLUMNS,
  type AnalysisTemplate,
} from '@/config/analysisTemplatesConfig'
import { cn } from '@/lib/utils'
import { twBg, twText, DARK } from '@/constants/theme.tokens'

const ICON_MAP = {
  Zap,
  Scale,
  FlaskConical,
}

function buildQueryString(params: Record<string, string>): string {
  const searchParams = new URLSearchParams(params)
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function TemplateCard({ template }: { template: AnalysisTemplate }) {
  const Icon = ICON_MAP[template.iconName]
  const to = `${template.path}${buildQueryString(template.params)}`

  return (
    <Card className="group flex h-full flex-col transition hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg ${twBg('slate', 100)} ${twText('slate', 700)} group-hover:${twBg('slate', 200)} ${DARK.bgSlate800} ${DARK.textSlate200}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={`text-base font-semibold ${twText('slate', 900)} ${DARK.textSlate100}`}>
            {template.title}
          </h3>
        </div>
        {template.badge != null && template.badge !== '' && (
          <Badge variant="secondary" className="shrink-0">
            {template.badge}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <p className={`text-sm ${twText('slate', 600)} ${DARK.textSlate400}`}>{template.description}</p>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={to}>进入</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export interface AnalysisTemplateCardsProps {
  title?: string
}

/**
 * AnalysisTemplateCards
 */
export function AnalysisTemplateCards({ title = '分析模板快捷入口' }: AnalysisTemplateCardsProps) {
  return (
    <section className="space-y-3">
      <h2 className={`text-lg font-semibold ${twText('slate', 900)} ${DARK.textSlate100}`}>{title}</h2>
      <div
        className={cn('grid gap-4')}
        style={{ gridTemplateColumns: `repeat(${ANALYSIS_TEMPLATE_GRID_COLUMNS}, minmax(0, 1fr))` }}
      >
        {ANALYSIS_TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </section>
  )
}
