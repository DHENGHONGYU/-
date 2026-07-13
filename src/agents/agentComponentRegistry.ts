import React from 'react'
import { Bot, Activity, Newspaper, Sparkles, Wifi, Filter, Database, type LucideIcon } from 'lucide-react'
import V6ScoringAgentDetail from '@/components/organisms/agent/V6ScoringAgentDetail'
import GenericAgentDetail from '@/components/organisms/agent/GenericAgentDetail'

export interface AgentDetailComponentProps {
  agentId: string
}

export interface AgentComponentEntry {
  agentId: string
  displayName: string
  icon: LucideIcon
  description: string
  tags: string[]
  detailComponent: React.ComponentType<AgentDetailComponentProps>
  priority: number
  mcpServerName: string
  defaultToolName: string
}

const AGENT_COMPONENT_REGISTRY: Map<string, AgentComponentEntry> = new Map()

function register(entry: AgentComponentEntry): void {
  AGENT_COMPONENT_REGISTRY.set(entry.agentId, entry)
}

register({
  agentId: 'v6-scoring-agent',
  displayName: 'V6 评分智能体',
  icon: Activity,
  description: '执行 V6 九维评分计算，返回评分结果与因子明细',
  tags: ['scoring', 'v6', 'system'],
  detailComponent: V6ScoringAgentDetail,
  priority: 100,
  mcpServerName: 'scoring:v6',
  defaultToolName: 'score_stock',
})

register({
  agentId: 'v4-industrial-agent',
  displayName: 'V4 行业评分智能体',
  icon: Sparkles,
  description: '执行 V4 行业评分计算，返回行业强弱与板块轮动信号',
  tags: ['scoring', 'v4', 'system'],
  detailComponent: GenericAgentDetail,
  priority: 90,
  mcpServerName: 'scoring:v6',
  defaultToolName: 'analyze_hot_sector',
})

register({
  agentId: 'llm-intelligent-agent',
  displayName: 'LLM 智能评分智能体',
  icon: Bot,
  description: '调用 LLM API 进行个股深度分析，返回智能评分与投资建议',
  tags: ['llm', 'ai', 'system'],
  detailComponent: GenericAgentDetail,
  priority: 80,
  mcpServerName: 'llm',
  defaultToolName: 'chat_completion',
})

register({
  agentId: 'fetcher-agent',
  displayName: '数据采集智能体',
  icon: Wifi,
  description: '执行股票基础数据/行情数据/财务数据的采集任务',
  tags: ['data', 'fetcher', 'system'],
  detailComponent: GenericAgentDetail,
  priority: 70,
  mcpServerName: 'fetcher',
  defaultToolName: 'fetch_stock_basic',
})

register({
  agentId: 'news-analyzer-agent',
  displayName: '新闻分析智能体',
  icon: Newspaper,
  description: '执行新闻情感分析、股票关联提取、热点识别任务',
  tags: ['news', 'analysis', 'system'],
  detailComponent: GenericAgentDetail,
  priority: 60,
  mcpServerName: 'news',
  defaultToolName: 'fetch_news',
})

register({
  agentId: 'screening-agent',
  displayName: '多因子筛选智能体',
  icon: Filter,
  description: '执行全量多因子筛选与单股评估，返回符合条件的股票列表',
  tags: ['screening', 'filter', 'system'],
  detailComponent: GenericAgentDetail,
  priority: 50,
  mcpServerName: 'screening:main',
  defaultToolName: 'run_screening',
})

register({
  agentId: 'stockpool-inspector',
  displayName: '股票池内省智能体',
  icon: Database,
  description: '查询股票池标的、研究状态流转与分组管理',
  tags: ['stockpool', 'pool', 'system'],
  detailComponent: GenericAgentDetail,
  priority: 45,
  mcpServerName: 'stockpool:main',
  defaultToolName: 'list_pool_stocks',
})

export function getAgentComponent(agentId: string): AgentComponentEntry | undefined {
  return AGENT_COMPONENT_REGISTRY.get(agentId)
}

export function getAllAgentComponents(): AgentComponentEntry[] {
  return Array.from(AGENT_COMPONENT_REGISTRY.values()).sort((a, b) => b.priority - a.priority)
}

export function getAgentDetailComponent(
  agentId: string,
): React.ComponentType<AgentDetailComponentProps> {
  const entry = AGENT_COMPONENT_REGISTRY.get(agentId)
  return entry?.detailComponent ?? GenericAgentDetail
}

export function hasAgentComponent(agentId: string): boolean {
  return AGENT_COMPONENT_REGISTRY.has(agentId)
}

export { V6ScoringAgentDetail, GenericAgentDetail }
