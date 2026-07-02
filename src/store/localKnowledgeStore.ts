/**
 * @module localKnowledgeStore
 * @lifecycle @Global
 * @description 本地知识库状态管理层（L2）。
 * 统一管理本地文档的浏览、搜索、统计、文件夹扫描与示例导入状态。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  createLocalDoc,
  listLocalDocs,
  searchLocalDocs,
  scanFolder,
} from '@/services/system/localDocService'
import type { LocalDoc } from '@/data/types'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'

const logger = getLogger()

export type LocalKnowledgeTab = 'browse' | 'search' | 'stats'

const SAMPLE_DOCS: Omit<LocalDoc, 'id' | 'addedAt'>[] = [
  {
    symbol: '600519.SH',
    name: '贵州茅台2024年研报',
    content:
      '贵州茅台2024年业绩稳健增长，白酒行业龙头地位稳固。公司持续推进产品结构升级，高端产品占比提升。渠道改革成效显著，直销比例持续扩大。',
    category: '研报',
    tags: ['白酒', '消费', '龙头'],
    sourcePath: '/samples/贵州茅台2024年研报.md',
    size: 2048,
  },
  {
    symbol: '00700.HK',
    name: '腾讯控股财报摘要',
    content:
      '腾讯控股最新季度财报显示，游戏业务恢复增长，广告业务受益于AI技术提升。视频号商业化加速，企业服务板块保持稳定。',
    category: '财报',
    tags: ['互联网', '游戏', '广告'],
    sourcePath: '/samples/腾讯控股财报摘要.md',
    size: 1536,
  },
  {
    symbol: 'ALL',
    name: '新能源行业策略笔记',
    content:
      '新能源行业处于政策与技术双轮驱动阶段。锂电产业链价格逐步企稳，储能需求保持高增。建议关注具备成本优势的龙头企业。',
    category: '策略笔记',
    tags: ['新能源', '储能', '策略'],
    sourcePath: '/samples/新能源行业策略笔记.md',
    size: 1024,
  },
]

interface LocalKnowledgeState {
  activeTab: LocalKnowledgeTab
  docs: LocalDoc[]
  symbolFilter: string
  keyword: string
  searchResults: LocalDoc[]
  message: string | null
  loading: boolean
  error: string | null

  // Actions
  setActiveTab: (tab: LocalKnowledgeTab) => void
  loadDocs: (symbolFilter?: string) => Promise<void>
  searchDocs: (keyword: string) => Promise<void>
  scanFolder: () => Promise<void>
  importSampleDocs: () => Promise<void>
  setSymbolFilter: (filter: string) => void
  setKeyword: (keyword: string) => void
  setMessage: (message: string | null, durationMs?: number) => void
  clearMessage: () => void
}

const initialState = {
  activeTab: 'browse' as LocalKnowledgeTab,
  docs: [] as LocalDoc[],
  symbolFilter: '全部',
  keyword: '',
  searchResults: [] as LocalDoc[],
  message: null as string | null,
  loading: false,
  error: null as string | null,
}

let messageTimer: ReturnType<typeof setTimeout> | null = null

function clearMessageTimer(): void {
  if (messageTimer) {
    clearTimeout(messageTimer)
    messageTimer = null
  }
}

function resolveSymbolFilter(filter: string): string | undefined {
  return filter === '全部' ? undefined : filter
}

export const useLocalKnowledgeStore = create<LocalKnowledgeState>((set, get) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadDocs: async (filter) => {
    const effectiveFilter = filter ?? get().symbolFilter
    set({ loading: true, error: null })

    try {
      const result = await listLocalDocs(resolveSymbolFilter(effectiveFilter))
      if (result.success && result.data) {
        set({ docs: result.data, loading: false })
      } else {
        const errorMsg = result.error ?? '无法加载本地文档'
        logger.error('[localKnowledgeStore] loadDocs failed', { error: errorMsg })
        set({ error: errorMsg, loading: false })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '无法加载本地文档'
      logger.error('[localKnowledgeStore] loadDocs error', { error: errorMsg })
      set({ error: errorMsg, loading: false })
    }
  },

  searchDocs: async (keyword) => {
    set({ loading: true })

    try {
      const result = await searchLocalDocs(keyword)
      if (result.success && result.data) {
        set({ searchResults: result.data, loading: false })
      } else {
        const errorMsg = result.error ?? '无法搜索本地文档'
        logger.error('[localKnowledgeStore] searchDocs failed', { error: errorMsg })
        set({ error: errorMsg, loading: false })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '无法搜索本地文档'
      logger.error('[localKnowledgeStore] searchDocs error', { error: errorMsg })
      set({ error: errorMsg, loading: false })
    }
  },

  scanFolder: async () => {
    try {
      const result = await scanFolder()
      if (result === null) {
        get().setMessage(
          '请使用支持 File System Access API 的浏览器导入文件夹，或使用导入示例数据按钮',
          5000,
        )
      } else if (result.files.length === 0 && result.errors.length === 0) {
        get().setMessage('未在选择的文件夹中找到支持的文件', 5000)
      } else {
        get().setMessage(`扫描完成，发现 ${result.files.length} 个文件`, 5000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '扫描文件夹失败'
      logger.error('[localKnowledgeStore] scanFolder error', { error: errorMsg })
      set({ error: errorMsg })
    }
  },

  importSampleDocs: async () => {
    set({ loading: true, error: null })
    let failed = 0
    let lastError: string | undefined

    try {
      for (const doc of SAMPLE_DOCS) {
        const result = await createLocalDoc(doc)
        if (!result.success) {
          failed += 1
          lastError = result.error
        }
      }

      await get().loadDocs()

      if (failed > 0) {
        const errorMsg = lastError ?? `${failed} 条示例数据导入失败`
        set({ error: errorMsg, loading: false })
      } else {
        set({ loading: false })
        get().setMessage('示例数据导入成功', 3000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '无法导入示例数据'
      logger.error('[localKnowledgeStore] importSampleDocs error', { error: errorMsg })
      set({ error: errorMsg, loading: false })
    }
  },

  setSymbolFilter: (filter) => set({ symbolFilter: filter }),

  setKeyword: (keyword) => set({ keyword }),

  setMessage: (message, durationMs = 5000) => {
    clearMessageTimer()
    set({ message })

    if (message && durationMs > 0) {
      messageTimer = setTimeout(() => {
        set({ message: null })
      }, durationMs)
    }
  },

  clearMessage: () => {
    clearMessageTimer()
    set({ message: null })
  },
}))

// ============================================================
// DataBridge 订阅（用于跨模块数据同步）
// ============================================================

let _unsubscribeLocalDocs: (() => void) | undefined

export function initLocalKnowledgeStoreSubscriptions(): () => void {
  destroyLocalKnowledgeStoreSubscriptions()
  logger.info('[localKnowledgeStore] 初始化 DataBridge local_docs 频道订阅')

  _unsubscribeLocalDocs = dataBridge.subscribe(
    'local_docs',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveLocalDocs) {
        logger.info('[localKnowledgeStore] DataBridge event received: saveLocalDoc', {
          traceId: envelope.meta.traceId,
        })
      }
    },
  )

  return () => destroyLocalKnowledgeStoreSubscriptions()
}

export function destroyLocalKnowledgeStoreSubscriptions(): void {
  if (_unsubscribeLocalDocs) {
    _unsubscribeLocalDocs()
    _unsubscribeLocalDocs = undefined
  }
}
