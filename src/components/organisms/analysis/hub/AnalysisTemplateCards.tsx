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
    <Card className="group flex h-full flex-col transition hover:shadow-elevation-2">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-lg bg-muted text-card-foreground group-hover:bg-muted')}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={cn('text-base font-semibold text-foreground')}>
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
        <p className={cn('text-sm text-muted-foreground')}>{template.description}</p>
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
      <h2 className={cn('text-lg font-semibold text-foreground')}>{title}</h2>
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
