import { Bot } from 'lucide-react'
import { getAllAgentComponents } from '@/agents/agentComponentRegistry'
import type { ShowcaseGroup } from './types'

/**
 * 智能体详情面板示例
 *
 * 遍历 UI 注册表，渲染每个 Agent 的标准/专属详情组件，
 * 作为 AI 生成与人工复用参考（替代逐 Agent 维护示例）。
 */
export function buildAgentDetailShowcase(): ShowcaseGroup {
  const items = getAllAgentComponents().map((entry) => {
    const Detail = entry.detailComponent
    return {
      id: `agent-detail-${entry.agentId}`,
      title: entry.displayName,
      description: entry.description,
      component: <Detail agentId={entry.agentId} />,
    }
  })

  return {
    id: 'agent-details',
    title: '智能体详情面板',
    icon: Bot,
    items,
  }
}
