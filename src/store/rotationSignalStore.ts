/**
 * @module rotationSignalStore
 * @lifecycle @Global
 * @description 轮动信号检测状态管理。管理板块轮动信号列表，
 * 提供信号检测、单板块检测等操作，以及 triggeredSignals/bySector 等派生查询。
 *
 * @status 当前无 UI 消费方，但含完整板块轮动信号检测逻辑。
 * 保留以备未来板块轮动分析面板（如 SectorRotationHeatmap）使用。
 * 删除前需确认未来无板块轮动可视化需求。
 *
 * @compliance
 * - 所有数据展示来自 rotationSignalDetector 服务，禁止硬编码
 * - 核心分支包含 logger.info 打印
 * - 遵循现有 Zustand Store 风格
  * @doc [V9-DOC-BACK-012, V9-DOC-ARCH-007, V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-BACK-015]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { detect, type RotationSignalInput, type RotationSignal } from '@/services/scoring/rotationSignalDetector'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface RotationSignalState {
  /** 信号列表 */
  signals: RotationSignal[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number

  // Actions
  fetchSignals: (inputs?: RotationSignalInput[]) => void
  detectSignal: (sectorId: string, inputs?: RotationSignalInput[]) => void
  clearSignals: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  signals: [] as RotationSignal[],
  loading: false,
  error: null as string | null,
  lastUpdated: 0,
}

// ============================================================
// Store
// ============================================================

/**
 * useRotationSignalStore
 */
export const useRotationSignalStore = create<RotationSignalState>((set) => ({
  ...initialState,

  fetchSignals: (inputs) => {
    logger.info('[rotationSignalStore] fetchSignals 开始')
    set({ loading: true, error: null })

    try {
      if (!inputs || inputs.length === 0) {
        logger.info('[rotationSignalStore] fetchSignals: 无输入数据，返回空结果')
        set({ loading: false })
        return
      }
      const sourceInputs = inputs
      const results = sourceInputs.map((input) => {
        const signal = detect(input)
        logger.info(
          `[rotationSignalStore] ${input.sectorId} 检测: triggered=${signal.triggered} strength=${signal.strength}`,
        )
        return signal
      })

      set({
        signals: results,
        loading: false,
        lastUpdated: Date.now(),
      })
      logger.info(`[rotationSignalStore] fetchSignals 完成: ${results.length} 个板块`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[rotationSignalStore] fetchSignals 失败: ${message}`)
      set({ error: message, loading: false })
    }
  },

  detectSignal: (sectorId, inputs) => {
    logger.info(`[rotationSignalStore] detectSignal: ${sectorId}`)
    if (!inputs || inputs.length === 0) {
      logger.warn(`[rotationSignalStore] detectSignal: 无输入数据`)
      return
    }
    const sourceInputs = inputs
    const target = sourceInputs.find((i) => i.sectorId === sectorId)

    if (!target) {
      logger.warn(`[rotationSignalStore] detectSignal 未找到板块: ${sectorId}`)
      return
    }

    try {
      const newSignal = detect(target)
      set((state) => {
        const signals = state.signals.map((s) =>
          s.sectorId === sectorId ? newSignal : s,
        )
        return { signals, lastUpdated: Date.now() }
      })
      logger.info(
        `[rotationSignalStore] detectSignal 完成: ${sectorId} triggered=${newSignal.triggered} strength=${newSignal.strength}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[rotationSignalStore] detectSignal 失败: ${message}`)
      set({ error: message })
    }
  },

  clearSignals: () => {
    logger.info('[rotationSignalStore] clearSignals')
    set({ ...initialState })
  },
}))

// ============================================================
// 派生查询（从 .derived.ts 统一导出，含 memoizeByRef 缓存优化）
// 设计原则：派生查询独立函数模式，通过 getState() 访问状态，不存入 State
// 原 Store 中的 triggeredSignals/bySector 已由 .derived.ts 的缓存版本替代
// ============================================================
export * from './rotationSignalStore.derived'