import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'

interface PageState {
  currentPage: string
  pageData: Map<string, unknown>
  loading: boolean
  error: string | null
  isVisible: boolean
  isClickable: boolean
  tooltipText: string
  setCurrentPage: (page: string) => void
  setPageData: (key: string, data: unknown) => void
  resetPageData: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setVisibility: (isVisible: boolean) => void
  setClickable: (isClickable: boolean, tooltip?: string) => void
}

/**
 * usePageStore
 */
export const usePageStore = create<PageState>((set) => ({
  currentPage: '',
  pageData: new Map(),
  loading: false,
  error: null,
  isVisible: true,
  isClickable: true,
  tooltipText: '',
  setCurrentPage: (page) => set({ currentPage: page, error: null }),
  setPageData: (key, data) => set((state) => {
    const pageData = new Map(state.pageData)
    pageData.set(key, data)
    return { pageData }
  }),
  resetPageData: () => set({ pageData: new Map(), loading: false, error: null }),
  setLoading: (loading) => set({ loading, isClickable: !loading, tooltipText: loading ? '加载中...' : '' }),
  setError: (error) => set({ error, loading: false }),
  setVisibility: (isVisible) => set({ isVisible }),
  setClickable: (isClickable, tooltip = '') => set({ isClickable, tooltipText: isClickable ? '' : tooltip }),
}))

const pageSubscriptions: Array<() => void> = []

/**
 * initPageSubscriptions
 */
export function initPageSubscriptions(): () => void {
  destroyPageSubscriptions()
  pageSubscriptions.push(
    eventBus.on('PAGE_DATA_LOADED', (payload) => {
      const { page, data } = payload as { page: string; data: Record<string, unknown> }
      usePageStore.getState().setCurrentPage(page)
      Object.entries(data).forEach(([key, value]) => {
        usePageStore.getState().setPageData(key, value)
      })
      usePageStore.getState().setLoading(false)
    }),
    eventBus.on('PAGE_ERROR', (payload) => {
      const { error } = payload as { error: string }
      usePageStore.getState().setError(error)
    }),
    eventBus.on('PAGE_RESET', () => {
      usePageStore.getState().resetPageData()
    }),
  )
  return () => destroyPageSubscriptions()
}

/**
 * destroyPageSubscriptions
 * @returns void
 */
export function destroyPageSubscriptions(): void {
  pageSubscriptions.forEach((unsubscribe) => unsubscribe())
  pageSubscriptions.length = 0
}

initPageSubscriptions()