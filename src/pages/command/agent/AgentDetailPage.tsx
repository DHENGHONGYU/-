import React, { useEffect, useState, useMemo, Suspense } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { PageSkeleton } from '@/components/PageSkeleton'
import { getLogger } from '@/lib/logger'
import { getAgentDetailComponent, hasAgentComponent } from '@/agents/agentComponentRegistry'
import { useAgentStore } from '@/store/agentStore'

const logger = getLogger()

interface AgentDetailPageProps {
  agentId: string
}

export default function AgentDetailPage({ agentId }: AgentDetailPageProps): React.JSX.Element {
  const [notFound, setNotFound] = useState(false)
  const registeredAgents = useAgentStore((state) => state.registeredAgents)

  useEffect(() => {
    logger.info('[AgentDetailPage] Mounted', { agentId })
    const exists = hasAgentComponent(agentId)
    setNotFound(!exists)
  }, [agentId])

  const DetailComponent = useMemo(() => getAgentDetailComponent(agentId), [agentId])
  const isRegistered = registeredAgents.includes(agentId)

  if (notFound) {
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
              <BreadcrumbPage>未找到</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-lg">智能体未找到</CardTitle>
            </CardHeader>
            <CardDescription className="max-w-md">
              没有找到 ID 为 <code className="rounded bg-muted px-1.5 py-0.5">{agentId}</code> 的智能体。
              该智能体可能不存在、尚未注册或已被移除。
            </CardDescription>
            <div className="mt-6 flex gap-3">
              <Button asChild>
                <Link to="/command/agents/registry">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回注册表
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/command/agents">返回总控台</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/command/agents/registry">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回注册表
          </Link>
        </Button>
        {!isRegistered && <Badge variant="destructive">未注册到运行时</Badge>}
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <DetailComponent agentId={agentId} />
      </Suspense>
    </div>
  )
}
