import React from 'react'
import { Link } from 'react-router'
import {
  Bot,
  Activity,
  List,
  Zap,
  GitBranch,
  Settings,
  ArrowRight,
  Sparkles,
  MessageSquare,
  Tag,
  Key,
  ArrowUpCircle,
  Search,
} from 'lucide-react'
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
import { useAgentStore } from '@/store/agentStore'
import { twBg, twText } from '@/constants/theme.tokens'

interface MetricCard {
  label: string
  value: number
  icon: React.ElementType
  color: string
}

interface NavCard {
  title: string
  description: string
  path: string
  icon: React.ElementType
  badge?: string
}

const NAV_CARDS: NavCard[] = [
  {
    title: '智能体注册表',
    description: '查看所有已注册的智能体及其配置',
    path: '/command/agents/registry',
    icon: List,
    badge: '5 个 Agent',
  },
  {
    title: '任务触发',
    description: '手动触发智能体任务执行',
    path: '/command/agents/trigger',
    icon: Zap,
    badge: 'Phase C',
  },
  {
    title: '任务列表',
    description: '查看任务执行状态和历史',
    path: '/command/agents/tasks',
    icon: Activity,
    badge: 'Phase D',
  },
  {
    title: '自定义智能体',
    description: '创建和管理自定义智能体',
    path: '/command/agents/custom',
    icon: Bot,
    badge: 'Phase E',
  },
  {
    title: 'LLM 管理',
    description: '配置和管理 LLM 模型与 API Key',
    path: '/command/agents/llm',
    icon: Sparkles,
    badge: 'Phase E',
  },
  {
    title: '能力图谱',
    description: '可视化智能体能力依赖关系',
    path: '/command/agents/capability-graph',
    icon: GitBranch,
    badge: 'Phase D',
  },
  {
    title: 'DAG 调度器',
    description: '配置和管理 DAG 工作流调度',
    path: '/command/agents/dag-scheduler',
    icon: Settings,
    badge: 'Phase D',
  },
  {
    title: '反馈控制台',
    description: '查看和处理智能体反馈',
    path: '/command/agents/feedback',
    icon: MessageSquare,
    badge: 'Phase E',
  },
  {
    title: '数据标签管理',
    description: '管理智能体训练和微调所需的数据标签',
    path: '/command/agents/data-labels',
    icon: Tag,
    badge: 'Phase E',
  },
  {
    title: 'API配置管理',
    description: '管理智能体使用的API配置和密钥',
    path: '/command/agents/api-config',
    icon: Key,
    badge: 'Phase E',
  },
  {
    title: '模型升级流程',
    description: '管理模型版本升级、A/B测试和回滚策略',
    path: '/command/agents/model-upgrade',
    icon: ArrowUpCircle,
    badge: 'Phase F',
  },
  {
    title: 'Skill核查可视化',
    description: '监控和分析所有Skill的使用情况、性能和依赖关系',
    path: '/command/agents/skill-audit',
    icon: Search,
    badge: 'Phase F',
  },
]

export default function AgentHubPage(): React.JSX.Element {
  const stats = useAgentStore((state) => state.stats)

  const metricCards: MetricCard[] = [
    { label: '已注册智能体', value: stats.totalAgents, icon: Bot, color: `${twBg('emerald', 500)}/10 ${twText('emerald', 500)}` },
    { label: '运行中任务', value: stats.runningTasks, icon: Activity, color: `${twBg('blue', 500)}/10 ${twText('blue', 500)}` },
    { label: '已完成任务', value: stats.completedTasks, icon: Zap, color: 'bg-primary/10 text-primary' },
    { label: '失败任务', value: stats.failedTasks, icon: Settings, color: `${twBg('red', 500)}/10 ${twText('red', 500)}` },
  ]

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
            <BreadcrumbPage>智能体总控台</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">智能体总控台</h1>
          <p className="text-muted-foreground">
            注册、调度、监控 V9 系统中的所有智能体
          </p>
        </div>
        <Badge variant="secondary">Agent System</Badge>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">功能导航</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {NAV_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.title} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base">{card.title}</CardTitle>
                    </div>
                    {card.badge !== undefined && <Badge variant="outline">{card.badge}</Badge>}
                  </div>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                    <Link to={card.path}>
                      进入
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
