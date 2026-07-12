/**
 * @module HoldingsPage
 * @lifecycle @Route
 * @description 交易持仓与策略资产管理列表页。组装筛选区、数据表格、分页组件、交易确认弹窗。
 * 所有状态管理采用 useReducer + useCallback，确保数据流清晰可追溯。
 *
 * @compliance
 * - 所有颜色值从 @/constants/trade.constants 引用
 * - 所有枚举值从 @/constants/trade.constants 引用
 * - 所有字符串字面量从 @/constants/trade.constants 引用
 * - 组件内禁止出现 'BUY'、'CORE'、'#ef4444' 等硬编码
 */

import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { Link } from 'react-router'
import { FileText } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { useToast } from '@/hooks/useToast'
import HoldingsFilter from './components/HoldingsFilter'
import HoldingsTable from './components/HoldingsTable'
import Pagination from './components/Pagination'
import TradeModal from './components/TradeModal'
import { PAGINATION_DEFAULTS, HOLDING_ACTION } from '@/constants/trade.constants'
import type { HoldingItem } from '@/types/modules/trade.types'
import type { HoldingsQueryParams } from '@/types/modules/trade.types'
import type { HoldingAction } from '@/constants/trade.constants'
import { useHoldingsStore, buildHoldingsParams, initHoldingsStoreSubscriptions } from '@/store/holdingsStore'
import { usePageGuard } from '@/hooks/usePageGuard'
import { getLogger } from '@/lib/logger'
import { PageContainer, PageHeader } from '@/components/templates'

const logger = getLogger()

// ============================================================
// 组件
// ============================================================

/**
 * HoldingsPage
 */
export default function HoldingsPage(): React.JSX.Element {
  const {
    data, filter, pagination, loading, modal,
    setData, setPage, setPageSize, setLoading,
    openModal, closeModal, resetFilter, setFilter,
    fetchData, executeTrade, exportCSV,
  } = useHoldingsStore()
  const { toast } = useToast()
  const isMountedRef = useRef(true)
  const { guardProps } = usePageGuard('holdings')

  // 清理标记
  useEffect(() => {
    isMountedRef.current = true
    logger.info('[HoldingsPage] 挂载，初始化订阅与数据加载')
    return () => {
      isMountedRef.current = false
      logger.info('[HoldingsPage] 卸载，清理挂载状态')
    }
  }, [])

  // 仅在组件仍挂载时更新 loading 状态，避免卸载后 setState 警告
  const setLoadingIfMounted = (patch: Parameters<typeof setLoading>[0]): void => {
    if (isMountedRef.current) {
      setLoading(patch)
    }
  }

  /** 初始化 DataBridge 订阅（组件卸载时自动清理） */
  useEffect(() => {
    return initHoldingsStoreSubscriptions()
  }, [])

  // 构建查询参数
  const buildParams = useCallback((): HoldingsQueryParams => {
    return buildHoldingsParams()
  }, [])

  // 加载数据
  const loadData = useCallback(async () => {
    const params = buildParams()
    logger.info('[HoldingsPage] 开始加载持仓数据', { params })
    setLoading({ isListLoading: true })
    let error: Error | null = null
    let responseCode = 0
    let responseMessage = ''
    try {
      const response = await fetchData(params)
      responseCode = response.code
      responseMessage = response.message
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err))
    }

    if (!isMountedRef.current) {
      return
    }

    if (error) {
      logger.error('[HoldingsPage] 持仓数据加载异常', {
        error: error.message,
      })
      toast({
        title: '加载失败',
        description: error.message || '网络请求异常',
        variant: 'error',
      })
    } else if (responseCode === 200) {
      logger.info('[HoldingsPage] 持仓数据加载完成', {
        total: pagination.total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        recordCount: data.length,
      })
    } else {
      logger.warn('[HoldingsPage] 持仓数据加载返回异常code', {
        code: responseCode,
        message: responseMessage,
      })
      toast({ title: '加载失败', description: responseMessage || '未知错误', variant: 'error' })
    }
    setLoading({ isListLoading: false })
  }, [buildParams, setData, setLoading, toast, pagination, data])

  // 初始加载 & 依赖变化时重新加载
  useEffect(() => {
    void loadData()
  }, [loadData])

  // 筛选操作
  const handleSearch = useCallback(() => {
    logger.info('[HoldingsPage] 执行筛选搜索', { filter })
    setPage(PAGINATION_DEFAULTS.DEFAULT_PAGE)
    void loadData()
  }, [loadData, filter, setPage])

  const handleReset = useCallback(() => {
    logger.info('[HoldingsPage] 重置筛选条件', { currentFilter: filter })
    resetFilter()
  }, [filter, resetFilter])

  // 分页操作
  const handlePageChange = useCallback((page: number) => {
    setPage(page)
  }, [setPage])

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setPageSize(pageSize)
  }, [setPageSize])

  // 导出
  const handleExport = useCallback(async () => {
    const params = buildParams()
    logger.info('[HoldingsPage] 开始导出持仓数据', { params })
    setLoading({ isExporting: true })
    try {
      await exportCSV(params)
      logger.info('[HoldingsPage] 导出成功')
      toast({ title: '导出成功', description: '持仓数据已导出为 CSV 文件', variant: 'success' })
    } catch (err) {
      logger.error('[HoldingsPage] 导出失败', {
        error: err instanceof Error ? err.message : String(err),
      })
      toast({
        title: '导出失败',
        description: err instanceof Error ? err.message : '导出异常',
        variant: 'error',
      })
    } finally {
      setLoadingIfMounted({ isExporting: false })
    }
  }, [buildParams, setLoading, toast])

  // 操作列点击
  const handleAction = useCallback(
    (item: HoldingItem, action: HoldingAction) => {
      openModal(item, action)
    },
    [openModal],
  )

  const handleCloseModal = useCallback(() => {
    closeModal()
  }, [closeModal])

  // 确认交易
  const handleConfirmTrade = useCallback(
    async (item: HoldingItem, action: HoldingAction, quantity: number) => {
      const tradeQuantity = action === HOLDING_ACTION.CLOSE_POSITION ? item.quantity : quantity
      logger.info('[HoldingsPage] 确认交易操作', {
        code: item.code,
        name: item.name,
        action,
        quantity: tradeQuantity,
        currentPrice: item.currentPrice,
        totalAmount: item.currentPrice * tradeQuantity,
      })
      setLoading({ isActionLoading: true })
      try {
        const response = await executeTrade({
          code: item.code,
          action,
          quantity: tradeQuantity,
        })

        if (response.success) {
          logger.info('[HoldingsPage] 交易操作成功', {
            code: item.code,
            action,
            message: response.message,
          })
          toast({ title: '操作成功', description: response.message, variant: 'success' })
          closeModal()
          await loadData()
        } else {
          logger.warn('[HoldingsPage] 交易操作失败', {
            code: item.code,
            action,
            message: response.message,
          })
          toast({ title: '操作失败', description: response.message, variant: 'error' })
        }
      } catch (err) {
        logger.error('[HoldingsPage] 交易操作异常', {
          code: item.code,
          action,
          error: err instanceof Error ? err.message : String(err),
        })
        toast({
          title: '操作异常',
          description: err instanceof Error ? err.message : '网络请求异常',
          variant: 'error',
        })
      } finally {
      setLoadingIfMounted({ isActionLoading: false })
      }
    },
    [loadData, setLoading, closeModal, toast],
  )

  return (
    <PageContainer className="space-y-4">
      {/* 面包屑导航 */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/trading">交易舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>持仓管理</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题 */}
      <PageHeader
        title="交易持仓管理"
        description="统一管理投资组合持仓，支持策略评分对比与资产配置全局视图"
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            共 {pagination.total} 条持仓记录
          </div>
        }
      />

      {/* 筛选区 */}
      <HoldingsFilter
        filter={filter}
        handlers={{
          onSearch: handleSearch,
          onReset: handleReset,
          onExport: () => void handleExport(),
          onUpdateFilter: setFilter,
        }}
        isExporting={loading.isExporting}
        disabled={guardProps.disabled}
      />

      {/* 数据表格 */}
      <HoldingsTable
        data={data}
        isLoading={loading.isListLoading}
        onAction={handleAction}
      />

      {/* 分页 */}
      <Pagination
        pagination={pagination}
        handlers={{
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
        }}
      />

      {/* 交易确认弹窗 */}
      <TradeModal
        modal={modal}
        isActionLoading={loading.isActionLoading}
        onClose={handleCloseModal}
        onConfirm={(item, action, quantity) => void handleConfirmTrade(item, action, quantity)}
      />
    </PageContainer>
  )
}