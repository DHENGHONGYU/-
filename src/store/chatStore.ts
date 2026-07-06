/**
 * @module store/chatStore
 * @description  cockpit 侧边栏 LLM 聊天状态
 *
 * 原属于 marketDataStore，因属于独立 UI 状态域，拆分至此。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { streamingChat } from '@/services/llm/llmGateway'
import type { LlmConfig } from '@/config/llmConfig'

const logger = getLogger()

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null

  sendMessage: (content: string, config: LlmConfig) => Promise<void>
  clearMessages: () => void
  addSystemMessage: (content: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  error: null,

  sendMessage: async (content, config) => {
    const userMessage: ChatMessage = {
      id: `chat-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    set((state) => ({
      messages: [...state.messages, userMessage],
      isStreaming: true,
      error: null,
    }))

    logger.info('[chatStore] sendMessage', { messageLength: content.length, model: config.model })

    try {
      const assistantMessage: ChatMessage = {
        id: `chat-${Date.now()}-assistant`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }))

      let fullContent = ''
      await streamingChat(
        [
          { role: 'system', content: '你是 V9 智能投研复盘系统的 AI 助手，擅长股票分析与投资复盘。' },
          { role: 'user', content },
        ],
        (chunk) => {
          if (!chunk.isDone) {
            fullContent += chunk.content
            set((state) => ({
              messages: state.messages.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: fullContent }
                  : msg,
              ),
            }))
          }
        },
        { ...config, caller: 'chatStore' },
      )

      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessage.id
            ? { ...msg, content: fullContent, isStreaming: false }
            : msg,
        ),
        isStreaming: false,
      }))

      logger.info('[chatStore] sendMessage completed', { responseLength: fullContent.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[chatStore] sendMessage failed', { error: message })
      set({ error: message, isStreaming: false })
    }
  },

  clearMessages: () => {
    logger.info('[chatStore] clearMessages')
    set({ messages: [], error: null })
  },

  addSystemMessage: (content) => {
    const message: ChatMessage = {
      id: `chat-${Date.now()}-system`,
      role: 'system',
      content,
      timestamp: Date.now(),
    }
    set((state) => ({ messages: [...state.messages, message] }))
  },
}))
