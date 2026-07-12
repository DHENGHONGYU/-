/**
 * @module customAgentTypes
 * @description 自定义智能体类型（阶段 B-1）
 *
 * IDB 存储结构（keyPath: 'id'，索引 by-type / by-updated-at）。
 * 与 CustomAgentPage 现有 CustomAgentConfig 兼容：增加 id / isActive / apiConfig 必填字段。
 */
import type { ModuleId } from '@/config/dbConfig'

export type CustomAgentType = 'analysis' | 'trading' | 'risk' | 'data' | 'custom'

export interface CustomAgentApiConfig {
  provider: string
  apiKey?: string
  endpoint?: string
}

export interface CustomAgent {
  id: string
  name: string
  description: string
  type: CustomAgentType
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  capabilities: string[]
  apiConfig?: CustomAgentApiConfig
  createdAt: number
  updatedAt: number
  isActive: boolean
  /** 数据血缘：阶段 B-1 同期治理（默认 user 创建） */
  createdBy?: ModuleId | 'user'
}
