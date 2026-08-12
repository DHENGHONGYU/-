/** @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。  * @doc [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-DATA-031]
*/
/**
 * @module tradingHubStore
 * @lifecycle @Global
 * @description 交易舱 Hub 页面状态管理。
 * 当前 Hub 页面为纯静态导航页，Store 预留导航与加载状态扩展。
 */

import { create } from 'zustand'

export interface TradingHubState {
  /** 当前选中的模块路径（预留） */
  activeModule: string
  /** 页面加载状态（预留） */
  loading: boolean
  /** 设置当前选中模块 */
  setActiveModule: (path: string) => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
  /** 重置 */
  reset: () => void
}

const initialState = {
  activeModule: '',
  loading: false,
}

/**
 * useTradingHubStore
 */
export const useTradingHubStore = create<TradingHubState>()((set) => ({
  ...initialState,
  setActiveModule: (path: string) => set({ activeModule: path }),
  setLoading: (loading: boolean) => set({ loading }),
  reset: () => set({ ...initialState }),
}))
