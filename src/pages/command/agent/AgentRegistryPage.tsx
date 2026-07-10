import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  List,
  Search,
  ArrowRight,
  Bot,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { getLogger } from '@/lib/logger'
import { getAllAgentComponents } from '@/agents/agentComponentRegistry'
import type { AgentComponentEntry } from '@/agents/agentComponentRegistry'
import { useAgentStore } from '@/store/agentStore'

const logger = getLogger()

const FILTER_TABS = [
  { id: 'all', label: '全部' },
  { id: 'system', label: '系统 Agent' },
  { id: 'scoring', label: '评分类' },
  { id: 'data', label: '数据类' },
  { id: 'llm', label: 'LLM 类' },
  { id: 'analysis', label: '分析类' },
] as const

type FilterTab = typeof FILTER_TABS[number]['id']

function matchesFilter(entry: AgentComponentEntry, filter: FilterTab): boolean {
  if (filter === 'all') return true
  if (filter === 'system') return entry.tags.includes('system')
  return entry.tags.includes(filter)
}

/**
 * AgentRegistryPage
 */
export default function AgentRegistryPage(): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const registeredAgents = useAgentStore((state) => state.registeredAgents)

  useEffect(() => {
    logger.info('[AgentRegistryPage] Mounted', { registeredCount: registeredAgents.length })
  }, [registeredAgents.length])

  const allAgents = useMemo(() => getAllAgentComponents(), [])

  const filteredAgents = useMemo(() => {
    let result = allAgents.filter((a) => matchesFilter(a, activeFilter))
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (a) =>
          a.displayName.toLowerCase().includes(term) ||
          a.agentId.toLowerCase().includes(term) ||
          a.description.toLowerCase().includes(term),
      )
    }
    return result
  }, [allAgents, activeFilter, searchTerm])

  const handleFilterChange = (value: string): void => {
    setActiveFilter(value as FilterTab)
    logger.info('[AgentRegistryPage] Filter changed', { filter: value })
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
            <BreadcrumbPage>注册表</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <List className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">智能体注册表</h1>
            <p className="text-muted-foreground">
              系统中所有已注册的智能体及其配置信息
            </p>
          </div>
        </div>
        <Badge variant="secondary">{allAgents.length} 个智能体</Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={activeFilter} onValueChange={handleFilterChange} className="w-full sm:w-auto">
          <TabsList className="flex flex-wrap">
            {FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索智能体..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-lg">注册表为空</CardTitle>
            </CardHeader>
            <CardDescription className="max-w-md">
              没有找到符合条件的智能体。请尝试调整筛选条件或搜索关键词。
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAgents.map((agent) => {
            const Icon = agent.icon
            const isRegistered = registeredAgents.includes(agent.agentId)
            return (
              <Card key={agent.agentId} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.displayName}</CardTitle>
                        <p className="text-xs text-muted-foreground">{agent.agentId}</p>
                      </div>
                    </div>
                    <Badge variant={isRegistered ? 'default' : 'outline'}>
                      {isRegistered ? '已注册' : '未注册'}
                    </Badge>
                  </div>
                  <CardDescription className="pt-2">{agent.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 pb-3">
                    {agent.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                    <Link to={`/command/agents/registry/${agent.agentId}`}>
                      查看详情
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
