/**
 * @module useStockAdd
 * @description 股票添加流程可复用 Hook。
 *
 * 封装 InputDashboard 中"添加股票"的核心交互逻辑：
 *   - 表单状态管理（symbol/name/group）
 *   - 调用 inputService.addStock 并处理结果
 *   - 添加成功后自动调用 store.refresh 触发 UI 重渲染
 *   - 错误消息与 submitting 状态管理
 *   - 输入框清空逻辑
 *
 * 使用方式：
 *   const { symbol, name, group, setSymbol, setName, setGroup,
 *           submitting, message, handleAdd, resetForm } = useStockAdd()
 *
 *   // 在任意组件中
 *   <input value={symbol} onChange={(e) => setSymbol(e.target.value)} />
 *   <button onClick={() => handleAdd(false, false)}>仅录入</button>
 *
 * 设计原则：
 *   - 单一职责：只负责"添加股票到意向池"流程
 *   - 无副作用泄漏：不订阅任何事件，不添加 useEffect（除非调用方传入 autoReset）
 *   - 可测试：纯函数式接口，便于单元测试
 *
 * @see src/services/input/inputService.ts -- addStock 服务实现
 * @see src/store/intentionPoolStore.ts -- refresh 触发 UI 重渲染
  * @doc [V9-DOC-ATA-024, V9-DOC-PROJ-108]
 */

import { useState, useCallback, useRef } from 'react'
import { addStock } from '@/services/input/inputService'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface UseStockAddOptions {
  /**
   * 添加成功后是否自动清空表单（默认 true）
   * 调用方可在需要保留表单的场景设为 false
   */
  autoClearOnSuccess?: boolean
  /**
   * 添加成功后是否自动调用 store.refresh（默认 true）
   * 关闭后调用方需自行处理 UI 刷新
   */
  autoRefreshOnSuccess?: boolean
  /**
   * 外部传入的初始 group（默认 ''）
   */
  initialGroup?: string
}

export interface UseStockAddResult {
  /** 表单字段：股票代码 */
  symbol: string
  /** 表单字段：股票名称 */
  name: string
  /** 表单字段：目标分组 */
  group: string
  /** 表单字段 setter */
  setSymbol: (v: string) => void
  /** 表单字段 setter */
  setName: (v: string) => void
  /** 表单字段 setter */
  setGroup: (v: string) => void
  /** 是否正在提交中（禁用按钮用） */
  submitting: boolean
  /** 用户反馈消息（成功/错误/警告） */
  message: string
  /** 清空消息（调用方在合适时机调用） */
  clearMessage: () => void
  /** 直接设置消息（供外部事件如 StockSearch onSelect 使用） */
  setMessage: (msg: string) => void
  /**
   * 添加股票核心方法
   * @param fetchBasic 是否在添加后拉取基础数据
   * @param fetchKline 是否在添加后拉取 K 线数据
   * @returns 添加是否成功
   */
  handleAdd: (fetchBasic: boolean, fetchKline: boolean) => Promise<boolean>
  /** 重置整个表单状态 */
  resetForm: () => void
}

// ============================================================
// Hook 实现
// ============================================================

export function useStockAdd(options: UseStockAddOptions = {}): UseStockAddResult {
  const {
    autoClearOnSuccess = true,
    autoRefreshOnSuccess = true,
    initialGroup = '',
  } = options

  // 表单状态
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [group, setGroup] = useState(initialGroup)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  // 使用 ref 持有最新的 refresh 函数引用，避免依赖数组变化导致 handleAdd 重建
  const refreshRef = useRef(useIntentionPoolStore.getState().refresh)
  refreshRef.current = useIntentionPoolStore((s) => s.refresh)

  const clearMessage = useCallback(() => setMessage(''), [])

  // 暴露 setMessage 供外部事件（如 StockSearch onSelect）直接设置消息
  const setMessageExternal = useCallback((msg: string) => setMessage(msg), [])

  const resetForm = useCallback(() => {
    setSymbol('')
    setName('')
    setGroup(initialGroup)
    setMessage('')
  }, [initialGroup])

  const handleAdd = useCallback(
    async (fetchBasic: boolean, fetchKline: boolean): Promise<boolean> => {
      // 前置校验：代码和名称不能为空
      if (!symbol || !name) {
        setMessage('请输入代码和名称')
        return false
      }

      setSubmitting(true)
      logger.info('[useStockAdd] 开始添加股票', { symbol, name, fetchBasic, fetchKline })

      try {
        const result = await addStock(
          { symbol, name },
          {
            fetchBasicAfterAdd: fetchBasic,
            fetchKlineAfterAdd: fetchKline,
            group: group || undefined,
          },
        )

        if (result.success) {
          // 成功：组装反馈消息
          const successMsg = result.error
            ? `已添加 ${result.data?.symbol}，${result.error}`
            : `已添加 ${result.data?.symbol}`
          setMessage(successMsg)
          logger.info('[useStockAdd] 添加成功', {
            symbol,
            pool: result.data?.pool,
          })

          // 自动清空表单
          if (autoClearOnSuccess) {
            setSymbol('')
            setName('')
            setGroup(initialGroup)
          }

          // 自动触发 store.refresh，让订阅了 items 的组件重渲染
          if (autoRefreshOnSuccess) {
            try {
              await refreshRef.current()
            } catch (refreshErr) {
              // refresh 失败不影响添加成功的反馈，只记录日志
              logger.warn('[useStockAdd] 添加后 refresh 失败（不影响添加结果）', {
                symbol,
                error: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
              })
            }
          }

          return true
        }

        // 失败：显示错误消息，不触发 refresh
        setMessage(result.error ?? '添加失败')
        logger.warn('[useStockAdd] 添加失败', { symbol, error: result.error })
        return false
      } catch (err) {
        // 异常：兜底错误处理，避免崩溃整个页面
        const errMsg = err instanceof Error ? err.message : String(err)
        setMessage(`添加异常：${errMsg}`)
        logger.error('[useStockAdd] 添加异常', { symbol, error: errMsg })
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [symbol, name, group, autoClearOnSuccess, autoRefreshOnSuccess, initialGroup],
  )

  return {
    symbol,
    name,
    group,
    setSymbol,
    setName,
    setGroup,
    submitting,
    message,
    clearMessage,
    setMessage: setMessageExternal,
    handleAdd,
    resetForm,
  }
}
