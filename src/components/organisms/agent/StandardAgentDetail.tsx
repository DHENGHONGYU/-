import React from 'react'
import { Link } from 'react-router'
import { ArrowRight, Zap } from 'lucide-react'
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

/**
 * StandardAgentDetail
 *
 * 标准智能体详情面板：配置驱动，从 registry entry 读取展示信息与「关联功能页」链接。
 * 用于替代逐 Agent 建 bespoke 详情组件，统一 UX 与令牌合规面。
 * 仅 V6 这类富交互详情保留专属组件（V6ScoringAgentDetail）。
 */
export default function StandardAgentDetail({ agentId }: AgentDetailComponentProps): React.JSX.Element {
  const entry = getAgentComponent(agentId)
  const displayName = entry?.displayName ?? '未知智能体'
  const description = entry?.description ?? '暂无描述'
  const tags = entry?.tags ?? []
  const Icon = entry?.icon ?? Zap
  const detailLink = entry?.detailLink

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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">关联功能</h2>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{displayName} · 关联功能页</CardTitle>
            <CardDescription>
              该智能体的核心能力已在对应功能域页提供，点击下方前往使用。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detailLink ? (
              <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                <Link to={detailLink.to}>
                  {detailLink.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">暂无关联功能页。</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <CardDescription className="max-w-md">
            可在「任务触发」页调用默认工具{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">{entry?.defaultToolName ?? '—'}</code>{' '}
            直接执行该智能体。
          </CardDescription>
          <div className="mt-6 flex gap-3">
            <Button asChild>
              <Link to="/command/agents/registry">返回注册表</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/command/agents/trigger">
                前往触发页
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
