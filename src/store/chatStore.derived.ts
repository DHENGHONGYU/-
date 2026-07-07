/**
 * @module chatStore.derived
 * @description chatStore 派生查询函数集合
 *
 * 设计原则：
 *   1. 纯函数：通过 useChatStore.getState() 访问状态
 *   2. 性能优化：memoizeByRef 缓存无参数派生（messages 引用未变时直接返回缓存）
 *   3. 派生不调用派生：messageStats 直接遍历 messages，避免调用 messagesByRole
 *   4. 空状态安全
 *
 * @compliance AGENTS.md §一 分层规则
 */

import { useChatStore } from '@/store/chatStore'
import type { ChatMessage } from '@/store/chatStore'
import { memoizeByRef, safeLength } from '@/lib/derivedCache'

// ============================================================
// 类型定义
// ============================================================

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 消息统计 */
export interface MessageStats {
  user: number
  assistant: number
  system: number
  total: number
}

// ============================================================
// 派生查询：基础聚合
// ============================================================

/**
 * 消息总数
 */
export function messageCount(): number {
  return safeLength(useChatStore.getState().messages)
}

/**
 * 是否有消息
 */
export function hasMessages(): boolean {
  return useChatStore.getState().messages.length > 0
}

/**
 * 是否为空（无消息）
 */
export function isEmpty(): boolean {
  return useChatStore.getState().messages.length === 0
}

/**
 * 综合加载状态（正在流式接收）
 */
export function isLoading(): boolean {
  return useChatStore.getState().isStreaming
}

/**
 * 综合错误
 */
export function hasError(): boolean {
  return useChatStore.getState().error !== null
}

// ============================================================
// 派生查询：消息访问（必需）
// ============================================================

/**
 * 最后一条消息
 */
export function lastMessage(): ChatMessage | null {
  const messages = useChatStore.getState().messages
  if (messages.length === 0) return null
  return messages[messages.length - 1]!
}

/**
 * 最后一条用户消息
 */
export function lastUserMessage(): ChatMessage | null {
  const messages = useChatStore.getState().messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') return messages[i]!
  }
  return null
}

/**
 * 最后一条 assistant 消息
 */
export function lastAssistantMessage(): ChatMessage | null {
  const messages = useChatStore.getState().messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'assistant') return messages[i]!
  }
  return null
}

/**
 * 当前正在流式接收的消息
 */
export function currentStreamingMessage(): ChatMessage | null {
  const messages = useChatStore.getState().messages
  if (!useChatStore.getState().isStreaming) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.isStreaming) return messages[i]!
  }
  return null
}

// ============================================================
// 派生查询：发送状态（必需）
// ============================================================

/**
 * 是否可发送消息（!isStreaming && !error）
 * UI 场景：StockChatWidget 发送按钮的禁用判定
 */
export function canSend(): boolean {
  const state = useChatStore.getState()
  return !state.isStreaming && state.error === null
}

/**
 * 流式响应进度（已接收字符数/总预估字符数）
 * 注意：此为粗略估算，实际进度需 LLM 服务支持
 */
export function streamingProgress(): number {
  const state = useChatStore.getState()
  if (!state.isStreaming) return 1

  const streamingMsg = currentStreamingMessage()
  if (!streamingMsg) return 0

  // 粗略估算：基于已接收字符数
  // 实际场景中应由 LLM 服务提供 totalLength
  const receivedLength = streamingMsg.content.length
  const estimatedTotal = Math.max(receivedLength * 2, 100)  // 粗略估计
  return Math.min(receivedLength / estimatedTotal, 0.99)
}

// ============================================================
// 派生查询：角色统计（memoizeByRef 缓存）
// ============================================================

/**
 * 各角色消息数统计
 * 性能优化：基于 messages 引用记忆化，单次遍历完成所有计数
 */
export const messageStatsMemo = memoizeByRef((messages: readonly ChatMessage[]): MessageStats => {
  const stats: MessageStats = {
    user: 0,
    assistant: 0,
    system: 0,
    total: messages.length,
  }
  for (const m of messages) {
    if (m.role === 'user') stats.user++
    else if (m.role === 'assistant') stats.assistant++
    else if (m.role === 'system') stats.system++
  }
  return stats
}, 'messageStats')

/**
 * 获取消息统计（自动传入最新 messages）
 */
export function getMessageStats(): MessageStats {
  return messageStatsMemo(useChatStore.getState().messages)
}

/**
 * 按角色筛选消息
 */
export function messagesByRole(role: MessageRole): ChatMessage[] {
  return useChatStore.getState().messages.filter(m => m.role === role)
}

/**
 * 对话轮次（user-assistant 配对数）
 * 计算：user 消息数（每条 user 消息对应一轮对话）
 */
export function conversationTurns(): number {
  return getMessageStats().user
}

// ============================================================
// 派生查询：上下文管理
// ============================================================

/**
 * 估算 token 数（粗略：字符数/4）
 * 注意：此为粗略估算，实际 token 数需 tokenizer 计算
 */
export function estimatedTokenCount(): number {
  const messages = useChatStore.getState().messages
  let charCount = 0
  for (const m of messages) {
    charCount += m.content.length
  }
  return Math.ceil(charCount / 4)
}

/**
 * 是否超过上下文长度限制
 */
export function isOverContextLimit(maxTokens: number = 8000): boolean {
  return estimatedTokenCount() > maxTokens
}

/**
 * 需要截断的历史消息数（超出限制时）
 * 保留最近的消息，截断最早的消息
 */
export function messagesToTruncate(maxTokens: number = 8000): number {
  const messages = useChatStore.getState().messages
  let charCount = 0
  for (const m of messages) {
    charCount += m.content.length
  }
  const estimatedTokens = Math.ceil(charCount / 4)
  if (estimatedTokens <= maxTokens) return 0

  // 计算需要截断的消息数
  const overflowTokens = estimatedTokens - maxTokens
  const overflowChars = overflowTokens * 4

  let truncateCount = 0
  let charsTruncated = 0
  for (const m of messages) {
    if (charsTruncated >= overflowChars) break
    charsTruncated += m.content.length
    truncateCount++
  }

  return truncateCount
}

// ============================================================
// 派生查询：消息搜索
// ============================================================

/**
 * 搜索消息（按关键词）
 */
export function searchMessages(keyword: string): ChatMessage[] {
  if (!keyword.trim()) return []
  const lowerKeyword = keyword.toLowerCase()
  return useChatStore.getState().messages.filter(
    m => m.content.toLowerCase().includes(lowerKeyword)
  )
}

/**
 * 按日期筛选消息
 * @param date YYYY-MM-DD 格式
 */
export function messagesByDate(date: string): ChatMessage[] {
  return useChatStore.getState().messages.filter(m => {
    const msgDate = new Date(m.timestamp).toISOString().split('T')[0]
    return msgDate === date
  })
}

// ============================================================
// React Hook 形式派生（可选）
// ============================================================

/**
 * Hook：订阅是否可发送
 */
export function useCanSend(): boolean {
  return useChatStore(state => !state.isStreaming && state.error === null)
}

/**
 * Hook：订阅最后一条消息
 */
export function useLastMessage(): ChatMessage | null {
  const messages = useChatStore(state => state.messages)
  if (messages.length === 0) return null
  return messages[messages.length - 1]!
}

/**
 * Hook：订阅消息统计
 */
export function useMessageStats(): MessageStats {
  const messages = useChatStore(state => state.messages)
  return messageStatsMemo(messages)
}

/**
 * Hook：订阅是否为空
 */
export function useIsEmpty(): boolean {
  return useChatStore(state => state.messages.length === 0)
}
