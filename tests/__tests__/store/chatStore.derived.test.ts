import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  chatStoreNormalState,
  chatStoreStreamingState,
  chatStoreEmptyState,
  mockChatMessages,
  streamingChatMessages,
  emptyChatMessages,
} from '../../fixtures/store-mock-data'
import { resetCacheStats, getCacheStatsSnapshot, resetAllMemoCaches } from '@/lib/derivedCache'

/**
 * chatStore.derived.ts 单元测试
 *
 * 覆盖范围：
 *   1. 基础聚合（messageCount/hasMessages/isEmpty/isLoading/hasError）
 *   2. 消息访问（lastMessage/lastUserMessage/lastAssistantMessage/currentStreamingMessage）
 *   3. 发送状态（canSend/streamingProgress）
 *   4. 角色统计（getMessageStats/messagesByRole/conversationTurns）
 *   5. 上下文管理（estimatedTokenCount/isOverContextLimit/messagesToTruncate）
 *   6. 消息搜索（searchMessages/messagesByDate）
 *   7. memoizeByRef 缓存性能验证
 *   8. 边界情况（空状态）
 *   9. 循环依赖验证
 */

vi.mock('@/store/chatStore', () => ({
  useChatStore: {
    getState: vi.fn(),
  },
}))

import { useChatStore } from '@/store/chatStore'
import {
  messageCount,
  hasMessages,
  isEmpty,
  isLoading,
  hasError,
  lastMessage,
  lastUserMessage,
  lastAssistantMessage,
  currentStreamingMessage,
  canSend,
  streamingProgress,
  getMessageStats,
  messagesByRole,
  conversationTurns,
  estimatedTokenCount,
  isOverContextLimit,
  messagesToTruncate,
  searchMessages,
  messagesByDate,
  messageStatsMemo,
} from '@/store/chatStore.derived'

const mockGetState = vi.mocked(useChatStore.getState)

describe('chatStore.derived.ts 派生查询单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
    mockGetState.mockReturnValue(chatStoreNormalState as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
  })

  // ============================================================
  // 1. 基础聚合
  // ============================================================
  describe('基础聚合', () => {
    it('messageCount 应返回消息总数', () => {
      expect(messageCount()).toBe(5)
    })

    it('hasMessages 应正确判断是否有消息', () => {
      expect(hasMessages()).toBe(true)
      mockGetState.mockReturnValue(chatStoreEmptyState as never)
      expect(hasMessages()).toBe(false)
    })

    it('isEmpty 应正确判断空状态', () => {
      expect(isEmpty()).toBe(false)
      mockGetState.mockReturnValue(chatStoreEmptyState as never)
      expect(isEmpty()).toBe(true)
    })

    it('isLoading 应返回流式加载状态', () => {
      expect(isLoading()).toBe(false)
      mockGetState.mockReturnValue(chatStoreStreamingState as never)
      expect(isLoading()).toBe(true)
    })

    it('hasError 应正确判断是否有错误', () => {
      expect(hasError()).toBe(false)
      mockGetState.mockReturnValue({ ...chatStoreNormalState, error: '网络错误' } as never)
      expect(hasError()).toBe(true)
    })
  })

  // ============================================================
  // 2. 消息访问
  // ============================================================
  describe('消息访问', () => {
    it('lastMessage 应返回最后一条消息', () => {
      const last = lastMessage()
      expect(last).not.toBeNull()
      expect(last!.id).toBe('msg-5')
      expect(last!.role).toBe('system')
    })

    it('lastMessage 空状态应返回 null', () => {
      mockGetState.mockReturnValue(chatStoreEmptyState as never)
      expect(lastMessage()).toBeNull()
    })

    it('lastUserMessage 应返回最后一条 user 消息', () => {
      const last = lastUserMessage()
      expect(last).not.toBeNull()
      expect(last!.id).toBe('msg-3')
      expect(last!.role).toBe('user')
    })

    it('lastUserMessage 无 user 消息时应返回 null', () => {
      mockGetState.mockReturnValue({
        ...chatStoreEmptyState,
        messages: [{ id: 'only-assistant', role: 'assistant', content: 'hi', timestamp: 1 }],
      } as never)
      expect(lastUserMessage()).toBeNull()
    })

    it('lastAssistantMessage 应返回最后一条 assistant 消息', () => {
      const last = lastAssistantMessage()
      expect(last).not.toBeNull()
      expect(last!.id).toBe('msg-4')
      expect(last!.role).toBe('assistant')
    })

    it('currentStreamingMessage 非流式状态应返回 null', () => {
      expect(currentStreamingMessage()).toBeNull()
    })

    it('currentStreamingMessage 流式状态应返回正在流式接收的消息', () => {
      mockGetState.mockReturnValue(chatStoreStreamingState as never)
      const streaming = currentStreamingMessage()
      expect(streaming).not.toBeNull()
      expect(streaming!.id).toBe('msg-6')
      expect(streaming!.isStreaming).toBe(true)
    })
  })

  // ============================================================
  // 3. 发送状态
  // ============================================================
  describe('发送状态', () => {
    it('canSend 在空闲无错误状态应返回 true', () => {
      expect(canSend()).toBe(true)
    })

    it('canSend 在流式接收中应返回 false', () => {
      mockGetState.mockReturnValue(chatStoreStreamingState as never)
      expect(canSend()).toBe(false)
    })

    it('canSend 在有错误时应返回 false', () => {
      mockGetState.mockReturnValue({ ...chatStoreNormalState, error: '错误' } as never)
      expect(canSend()).toBe(false)
    })

    it('streamingProgress 非流式状态应返回 1', () => {
      expect(streamingProgress()).toBe(1)
    })

    it('streamingProgress 流式状态应返回 0-1 之间的值', () => {
      mockGetState.mockReturnValue(chatStoreStreamingState as never)
      const progress = streamingProgress()
      expect(progress).toBeGreaterThan(0)
      expect(progress).toBeLessThanOrEqual(0.99)
    })

    it('streamingProgress 流式但无流式消息时应返回 0', () => {
      // isStreaming=true 但没有 isStreaming 标记的消息
      mockGetState.mockReturnValue({
        ...chatStoreNormalState,
        isStreaming: true,
      } as never)
      expect(streamingProgress()).toBe(0)
    })
  })

  // ============================================================
  // 4. 角色统计
  // ============================================================
  describe('角色统计', () => {
    it('getMessageStats 应正确统计各角色消息数', () => {
      const stats = getMessageStats()
      expect(stats.user).toBe(2)       // msg-1, msg-3
      expect(stats.assistant).toBe(2)  // msg-2, msg-4
      expect(stats.system).toBe(1)     // msg-5
      expect(stats.total).toBe(5)
    })

    it('messagesByRole 应按角色筛选消息', () => {
      expect(messagesByRole('user')).toHaveLength(2)
      expect(messagesByRole('assistant')).toHaveLength(2)
      expect(messagesByRole('system')).toHaveLength(1)
    })

    it('conversationTurns 应返回 user 消息数', () => {
      // user 消息数 = 2
      expect(conversationTurns()).toBe(2)
    })
  })

  // ============================================================
  // 5. 上下文管理
  // ============================================================
  describe('上下文管理', () => {
    it('estimatedTokenCount 应估算 token 数（字符数/4）', () => {
      const tokenCount = estimatedTokenCount()
      expect(tokenCount).toBeGreaterThan(0)
      // mockChatMessages 总字符数约 60+，token 数应 < 50
      expect(tokenCount).toBeLessThan(100)
    })

    it('isOverContextLimit 默认阈值（8000）应返回 false', () => {
      expect(isOverContextLimit()).toBe(false)
    })

    it('isOverContextLimit 极小阈值应返回 true', () => {
      // 5 条消息估算 token 数 > 1
      expect(isOverContextLimit(1)).toBe(true)
    })

    it('messagesToTruncate 未超限应返回 0', () => {
      expect(messagesToTruncate()).toBe(0)
    })

    it('messagesToTruncate 超限应返回需截断的消息数', () => {
      // 设置极小阈值强制触发截断
      const truncateCount = messagesToTruncate(1)
      expect(truncateCount).toBeGreaterThan(0)
      expect(truncateCount).toBeLessThanOrEqual(5)
    })
  })

  // ============================================================
  // 6. 消息搜索
  // ============================================================
  describe('消息搜索', () => {
    it('searchMessages 应按关键词搜索', () => {
      // "平安银行" 出现在 msg-1, msg-2, msg-4
      const results = searchMessages('平安银行')
      expect(results).toHaveLength(3)
      expect(results.map(m => m.id).sort()).toEqual(['msg-1', 'msg-2', 'msg-4'])
    })

    it('searchMessages "V6" 应匹配 msg-3, msg-4', () => {
      const results = searchMessages('V6')
      expect(results).toHaveLength(2)
    })

    it('searchMessages 空关键词应返回空数组', () => {
      expect(searchMessages('')).toEqual([])
      expect(searchMessages('   ')).toEqual([])
    })

    it('searchMessages 不存在的关键词应返回空数组', () => {
      expect(searchMessages('不存在的关键词XYZ')).toEqual([])
    })

    it('searchMessages 应大小写不敏感', () => {
      // 小写 v6 也应匹配 V6
      const results = searchMessages('v6')
      expect(results).toHaveLength(2)
    })

    it('messagesByDate 应按日期筛选（YYYY-MM-DD）', () => {
      const today = new Date(Date.now()).toISOString().split('T')[0]!
      const results = messagesByDate(today)
      // mockChatMessages 的 timestamp 都是 now-N分钟，应在今天
      expect(results).toHaveLength(5)
    })

    it('messagesByDate 不存在的日期应返回空数组', () => {
      expect(messagesByDate('1999-01-01')).toEqual([])
    })
  })

  // ============================================================
  // 7. memoizeByRef 缓存性能验证
  // ============================================================
  describe('memoizeByRef 缓存性能验证', () => {
    it('messageStats 相同引用应命中缓存', () => {
      const messages = mockChatMessages
      messageStatsMemo(messages)  // miss
      messageStatsMemo(messages)  // hit
      messageStatsMemo(messages)  // hit

      const stats = getCacheStatsSnapshot()['messageStats']
      expect(stats).toBeDefined()
      expect(stats!.totalCalls).toBe(3)
      expect(stats!.hits).toBe(2)
      expect(stats!.misses).toBe(1)
    })

    it('messageStats 不同引用应失效缓存', () => {
      const messages1 = mockChatMessages
      const messages2 = [...mockChatMessages]

      messageStatsMemo(messages1)  // miss
      messageStatsMemo(messages1)  // hit
      messageStatsMemo(messages2)  // miss（引用不同）

      const stats = getCacheStatsSnapshot()['messageStats']
      expect(stats!.misses).toBe(2)
      expect(stats!.hits).toBe(1)
    })

    it('getMessageStats 多次调用应命中缓存（相同状态）', () => {
      // 同一状态引用，多次调用 getMessageStats
      getMessageStats()
      getMessageStats()
      getMessageStats()

      const stats = getCacheStatsSnapshot()['messageStats']
      expect(stats).toBeDefined()
      expect(stats!.hits).toBeGreaterThanOrEqual(2)
    })
  })

  // ============================================================
  // 8. 边界情况
  // ============================================================
  describe('边界情况', () => {
    beforeEach(() => {
      mockGetState.mockReturnValue(chatStoreEmptyState as never)
    })

    it('空状态：messageCount 应为 0', () => {
      expect(messageCount()).toBe(0)
    })

    it('空状态：hasMessages 应为 false', () => {
      expect(hasMessages()).toBe(false)
    })

    it('空状态：isEmpty 应为 true', () => {
      expect(isEmpty()).toBe(true)
    })

    it('空状态：lastMessage 应为 null', () => {
      expect(lastMessage()).toBeNull()
    })

    it('空状态：lastUserMessage 应为 null', () => {
      expect(lastUserMessage()).toBeNull()
    })

    it('空状态：lastAssistantMessage 应为 null', () => {
      expect(lastAssistantMessage()).toBeNull()
    })

    it('空状态：currentStreamingMessage 应为 null', () => {
      expect(currentStreamingMessage()).toBeNull()
    })

    it('空状态：canSend 应为 true（无流式、无错误）', () => {
      expect(canSend()).toBe(true)
    })

    it('空状态：getMessageStats 应返回全零统计', () => {
      const stats = getMessageStats()
      expect(stats.user).toBe(0)
      expect(stats.assistant).toBe(0)
      expect(stats.system).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('空状态：conversationTurns 应为 0', () => {
      expect(conversationTurns()).toBe(0)
    })

    it('空状态：estimatedTokenCount 应为 0', () => {
      expect(estimatedTokenCount()).toBe(0)
    })

    it('空状态：isOverContextLimit 应为 false', () => {
      expect(isOverContextLimit()).toBe(false)
    })

    it('空状态：messagesToTruncate 应为 0', () => {
      expect(messagesToTruncate()).toBe(0)
    })

    it('空状态：searchMessages 应返回空数组', () => {
      expect(searchMessages('任意关键词')).toEqual([])
    })

    it('单条消息状态：lastMessage 应正确返回', () => {
      const singleMessageState = {
        ...chatStoreEmptyState,
        messages: [mockChatMessages[0]],
      }
      mockGetState.mockReturnValue(singleMessageState as never)
      const last = lastMessage()
      expect(last).not.toBeNull()
      expect(last!.id).toBe('msg-1')
    })
  })

  // ============================================================
  // 9. 循环依赖验证
  // ============================================================
  describe('循环依赖验证', () => {
    it('派生函数应能独立调用不产生循环', () => {
      expect(() => messageCount()).not.toThrow()
      expect(() => hasMessages()).not.toThrow()
      expect(() => isEmpty()).not.toThrow()
      expect(() => lastMessage()).not.toThrow()
      expect(() => lastUserMessage()).not.toThrow()
      expect(() => lastAssistantMessage()).not.toThrow()
      expect(() => currentStreamingMessage()).not.toThrow()
      expect(() => canSend()).not.toThrow()
      expect(() => streamingProgress()).not.toThrow()
      expect(() => getMessageStats()).not.toThrow()
      expect(() => conversationTurns()).not.toThrow()
      expect(() => estimatedTokenCount()).not.toThrow()
      expect(() => isOverContextLimit()).not.toThrow()
      expect(() => messagesToTruncate()).not.toThrow()
      expect(() => searchMessages('test')).not.toThrow()
    })

    it('100 次连续调用 getMessageStats 不应栈溢出', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          getMessageStats()
        }
      }).not.toThrow()
    })

    it('派生链：conversationTurns → getMessageStats → messageStatsMemo 不应循环', () => {
      // conversationTurns 内部调用 getMessageStats，getMessageStats 调用 messageStatsMemo
      const turns = conversationTurns()
      expect(turns).toBe(2)
      // 多次调用不应产生循环
      expect(conversationTurns()).toBe(2)
      expect(conversationTurns()).toBe(2)
    })

    it('派生链：streamingProgress → currentStreamingMessage 不应循环', () => {
      mockGetState.mockReturnValue(chatStoreStreamingState as never)
      const progress = streamingProgress()
      expect(typeof progress).toBe('number')
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(1)
    })
  })
})
