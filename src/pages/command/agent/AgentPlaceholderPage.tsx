import React from 'react'
import { Link, useLocation } from 'react-router'
import { Construction } from 'lucide-react'
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

const PLACEHOLDER_MAP: Record<string, { title: string; description: string; phase: string }> = {
  '/command/agents/trigger': {
    title: '任务触发',
    description: '手动选择智能体并触发任务执行，支持自定义 Payload 和超时设置',
    phase: 'Phase C',
  },
  '/command/agents/tasks': {
    title: '任务列表',
    description: '查看所有智能体任务的执行状态、历史记录和详细日志',
    phase: 'Phase D',
  },
  '/command/agents/custom': {
    title: '自定义智能体',
    description: '创建、编辑和管理自定义智能体，配置执行逻辑和参数',
    phase: 'Phase E',
  },
  '/command/agents/llm': {
    title: 'LLM 管理',
    description: '配置 LLM 模型、API Key 和调用参数，管理模型选择和评分因子',
    phase: 'Phase E',
  },
  '/command/agents/capability-graph': {
    title: '能力图谱',
    description: '可视化展示智能体之间的能力依赖关系和调用链路',
    phase: 'Phase D',
  },
  '/command/agents/dag-scheduler': {
    title: 'DAG 调度器',
    description: '配置和管理有向无环图工作流，支持任务依赖和并行调度',
    phase: 'Phase D',
  },
  '/command/agents/feedback': {
    title: '反馈控制台',
    description: '收集和处理智能体执行反馈，优化评分模型和任务流程',
    phase: 'Phase E',
  },
}

export default function AgentPlaceholderPage(): React.JSX.Element {
  const location = useLocation()
  const pathname = location.pathname
  const info = PLACEHOLDER_MAP[pathname] ?? {
    title: '功能开发中',
    description: '该功能正在开发中，敬请期待',
    phase: 'TBD',
  }

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
            <BreadcrumbPage>{info.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
          <p className="text-muted-foreground">{info.description}</p>
        </div>
        <Badge variant="outline">{info.phase}</Badge>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Construction className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-lg">功能建设中</CardTitle>
          </CardHeader>
          <CardDescription className="max-w-md">
            {info.title}功能正在按计划开发中，预计在 {info.phase} 阶段上线。
            您可以先体验已上线的智能体注册表功能。
          </CardDescription>
          <div className="mt-6 flex gap-3">
            <Button asChild>
              <Link to="/command/agents/registry">查看注册表</Link>
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
