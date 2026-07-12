import React from 'react'
import { Link } from 'react-router'
import { Bot, Clock, Zap, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { getAgentComponent } from '@/agents/agentComponentRegistry'
import type { AgentDetailComponentProps } from '@/agents/agentComponentRegistry'
import { COLOR_TOKENS, COLOR_SHADES, twBg, twText } from '@/constants/theme.tokens'

/**
 * GenericAgentDetail
 */
export default function GenericAgentDetail({ agentId }: AgentDetailComponentProps): React.JSX.Element {
  const entry = getAgentComponent(agentId)
  const displayName = entry?.displayName ?? '未知智能体'
  const description = entry?.description ?? '暂无描述'
  const tags = entry?.tags ?? []
  const Icon = entry?.icon ?? Bot

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/command/hub">总控舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/command/agents">智能体</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/command/agents/registry">注册表</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>{displayName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">ID: {agentId}</Badge>
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${twBg('emerald', 500)}/10 ${twText('emerald', 500)}`}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">—</p>
              <p className="text-sm text-muted-foreground">默认超时</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${COLOR_TOKENS.info.tailwind}`} style={{ backgroundColor: `${COLOR_SHADES.blue.hex[500]}1a` }}>
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">—</p>
              <p className="text-sm text-muted-foreground">最大并发</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">功能说明</h2>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">通用智能体详情页</CardTitle>
            <CardDescription>
              该智能体使用通用详情模板。专用详情页将在后续版本中提供。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• 智能体 ID: <code className="rounded bg-muted px-1.5 py-0.5">{agentId}</code></p>
              <p>• 显示名称: {displayName}</p>
              <p>• 描述: {description}</p>
              <p>• 标签: {tags.length > 0 ? tags.join(', ') : '无'}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">更多功能开发中</CardTitle>
          </CardHeader>
          <CardDescription className="max-w-md">
            智能体任务触发、配置管理、执行日志等功能将在后续阶段陆续上线。
          </CardDescription>
          <div className="mt-6 flex gap-3">
            <Button asChild>
              <Link to="/command/agents/registry">返回注册表</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/command/agents">
                返回总控台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
