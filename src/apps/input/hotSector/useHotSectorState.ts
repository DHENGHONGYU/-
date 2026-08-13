import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getHotSectors,
  addHotSectorStock,
  addHotSectorStocks,
  type HotSector,
} from '@/services/input/hotSectorService'
import { useIntentionPoolStore, getIntentionPoolGroups } from '@/store/intentionPoolStore'
import { useToast } from '@/hooks/useToast'
import { getLogger } from '@/lib/logger'
import { createDebugLogger } from '@/lib/debugToolkit'
import { rankSectorsByDynamicScore, extractRepresentativeStocks, getTimeliness, type RepresentativePick } from '../hotSector.utils'
import type {
  RankedSector,
  SectorDetail,
  SectorBatchResult,
  StockSelectionDetail,
  StockAddResult,
} from '../hotSector.types'

const logger = getLogger()
/** 热门板块纳入流程的 Debug 日志（控制台筛选 [HotSector]） */
const debug = createDebugLogger('HotSector')

/** useHotSectorState 返回值类型，供子组件 Props 复用 */
export interface HotSectorState {
  // 数据
  hotSectors: HotSector[]
  allGroups: string[]
  targetGroup: string
  setTargetGroup: (group: string) => void
  addingAll: boolean
  addingHot: Set<string>
  message: string

  // 勾选状态
  selectedSectors: Set<string>
  expandedSectors: Set<string>
  selectedStocksBySector: Record<string, Set<string>>
  existingSymbols: Set<string>

  // 派生数据
  totalSelectedStocks: number
  rankedSectors: RankedSector[]
  /** 是否仅展示近一周内有评分的板块（考核标准·及时性） */
  timelyOnly: boolean
  setTimelyOnly: (v: boolean) => void
  /** 近一周内有评分的板块数 */
  timelySectorsCount: number
  /** 抽取出的热门赛道代表股（15-20 只筛选清单） */
  picks: RepresentativePick[]
  handleExtractRepresentatives: () => void
  handleAddPicks: () => Promise<void>

  // 板块勾选
  handleToggleSector: (sectorCode: string) => void
  handleToggleExpand: (sectorCode: string) => void
  handleToggleStock: (sectorCode: string, symbol: string) => void
  handleToggleSelectAllSectors: (checked: boolean) => void
  handleToggleSelectAllStocksInSector: (sectorCode: string, willCheck: boolean) => void

  // 加入意向候选池
  handleAddHotStock: (symbolToAdd: string) => Promise<void>
  handleAddAllHotStocks: (sectorCode: string) => Promise<void>
  handleAddSelectedSectors: () => Promise<void>
  handleAddSelectedStocks: () => Promise<void>
}

/**
 * 热门板块纳入意向候选池 - 状态与事件逻辑
 *
 * 包含：板块加载、板块/成分股勾选、批量加入等全部业务逻辑。
 * 渲染层由 HotSectorSection + 子组件负责。
 */
export function useHotSectorState(): HotSectorState {
  const refresh = useIntentionPoolStore((s) => s.refresh)
  const items = useIntentionPoolStore((s) => s.items)
  const allGroups = useMemo(() => getIntentionPoolGroups(), [items]) // eslint-disable-line react-hooks/exhaustive-deps -- items is a reactivity trigger for store-driven getIntentionPoolGroups()

  const [hotSectors, setHotSectors] = useState<HotSector[]>([])
  const [targetGroup, setTargetGroup] = useState('')
  const [addingHot, setAddingHot] = useState<Set<string>>(new Set())
  const [addingAll, setAddingAll] = useState(false)
  const [message, setMessage] = useState('')
  const { toast } = useToast()

  // 考核标准·及时性：仅看近一周内有评分的板块
  const [timelyOnly, setTimelyOnly] = useState(false)
  // 抽取出的热门赛道代表股（15-20 只筛选清单）
  const [picks, setPicks] = useState<RepresentativePick[]>([])

  // 板块级勾选状态
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set())
  // 展开的板块（用于展示成分股逐项选择）
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set())
  // 成分股级勾选状态（按板块分组）
  const [selectedStocksBySector, setSelectedStocksBySector] = useState<Record<string, Set<string>>>({})

  const existingSymbols = useMemo(
    () => new Set(items.map((s) => s.symbol)),
    [items],
  )

  const addOptions = useMemo(
    () => ({ fetchBasicAfterAdd: false, group: targetGroup || undefined }),
    [targetGroup],
  )

  // 异步加载热门板块（按 hot-momentum-strategy.md §2.5.3，数据源为 rotationScores store）
  useEffect(() => {
    void (async () => {
      try {
        const sectors = await getHotSectors()
        setHotSectors(sectors)
        logger.info('[HotSectorSection] 热门板块加载完成', { count: sectors.length })
      } catch (err) {
        logger.error('[HotSectorSection] 热门板块加载失败', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })()
  }, [])

  useEffect(() => {
    logger.info('[HotSectorSection] 组件初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  // ── 板块勾选 ──
  const handleToggleSector = useCallback((sectorCode: string): void => {
    setSelectedSectors((prev) => {
      const next = new Set(prev)
      if (next.has(sectorCode)) {
        next.delete(sectorCode)
      } else {
        next.add(sectorCode)
      }
      return next
    })
  }, [])

  const handleToggleExpand = useCallback((sectorCode: string): void => {
    setExpandedSectors((prev) => {
      const next = new Set(prev)
      if (next.has(sectorCode)) {
        next.delete(sectorCode)
      } else {
        next.add(sectorCode)
      }
      return next
    })
  }, [])

  const handleToggleStock = useCallback((sectorCode: string, symbol: string): void => {
    setSelectedStocksBySector((prev) => {
      const sectorSet = new Set(prev[sectorCode] ?? [])
      if (sectorSet.has(symbol)) {
        sectorSet.delete(symbol)
      } else {
        sectorSet.add(symbol)
      }
      return { ...prev, [sectorCode]: sectorSet }
    })
  }, [])

  // 全选/取消全选板块
  const handleToggleSelectAllSectors = useCallback((checked: boolean): void => {
    if (checked) {
      setSelectedSectors(new Set(hotSectors.map((s) => s.code)))
    } else {
      setSelectedSectors(new Set())
    }
  }, [hotSectors])

  // 全选/取消全选某板块的成分股
  const handleToggleSelectAllStocksInSector = useCallback((sectorCode: string, willCheck: boolean): void => {
    const sector = hotSectors.find((s) => s.code === sectorCode)
    if (!sector) return
    setSelectedStocksBySector((prev) => {
      const next = { ...prev }
      if (willCheck) {
        next[sectorCode] = new Set(sector.stocks.map((s) => s.symbol))
      } else {
        next[sectorCode] = new Set()
      }
      return next
    })
  }, [hotSectors])

  // ── 加入意向候选池 ──
  const handleAddHotStock = async (symbolToAdd: string): Promise<void> => {
    const sector = hotSectors.find((s) => s.stocks.some((st) => st.symbol === symbolToAdd))
    if (!sector) {
      logger.warn('[HotSectorSection] handleAddHotStock 中断: 未找到板块', { symbol: symbolToAdd })
      return
    }

    const startTime = Date.now()
    logger.info('[HotSectorSection] handleAddHotStock 开始', {
      symbol: symbolToAdd,
      sectorCode: sector.code,
      targetGroup: addOptions.group ?? '默认分组',
    })

    setAddingHot((prev) => new Set(prev).add(symbolToAdd))

    try {
      const result = await addHotSectorStock(sector.code, symbolToAdd, addOptions)

      setAddingHot((prev) => {
        const next = new Set(prev)
        next.delete(symbolToAdd)
        return next
      })

      if (result.success) {
        logger.info('[HotSectorSection] handleAddHotStock 成功', {
          symbol: symbolToAdd,
          elapsedMs: Date.now() - startTime,
        })
        setMessage(`已将 ${symbolToAdd} 加入意向候选池`)
        await refresh()
      } else {
        logger.error('[HotSectorSection] handleAddHotStock 失败', {
          symbol: symbolToAdd,
          error: result.error,
        })
        setMessage(result.error ?? '加入失败')
      }
    } catch (err) {
      logger.error('[HotSectorSection] handleAddHotStock 异常', {
        symbol: symbolToAdd,
        error: err instanceof Error ? err.message : String(err),
      })
      setAddingHot((prev) => {
        const next = new Set(prev)
        next.delete(symbolToAdd)
        return next
      })
      setMessage(err instanceof Error ? err.message : '加入失败')
    }
  }

  // 加入单个板块的全部成分股
  const handleAddAllHotStocks = async (sectorCode: string): Promise<void> => {
    const sector = hotSectors.find((s) => s.code === sectorCode)
    if (!sector || addingAll) {
      debug.log('handleAddAllHotStocks 中断', { sectorCode, hasSector: !!sector, addingAll })
      return
    }

    debug.log('handleAddAllHotStocks 开始', {
      sectorCode,
      sectorName: sector.name,
      stockCount: sector.stocks.length,
      stockSymbols: sector.stocks.map((s) => s.symbol),
      targetGroup: addOptions.group ?? '默认分组',
      existingInPool: sector.stocks.filter((s) => existingSymbols.has(s.symbol)).map((s) => s.symbol),
    })

    setAddingAll(true)
    setAddingHot((prev) => {
      const next = new Set(prev)
      sector.stocks.forEach((s) => next.add(s.symbol))
      debug.log('handleAddAllHotStocks 设置 addingHot', { count: next.size })
      return next
    })
    try {
      const result = await addHotSectorStocks(sectorCode, addOptions)
      debug.log('handleAddAllHotStocks addHotSectorStocks 返回', {
        sectorCode,
        success: result.success,
        added: result.data?.added ?? [],
        failed: result.data?.failed ?? [],
        error: result.error,
      })
      if (result.success && result.data) {
        toast({
          title: '批量加入完成',
          description: `板块 ${sector.name}：成功 ${result.data.added.length} 只，失败 ${result.data.failed.length} 只`,
          variant: 'success',
        })
        setMessage(
          `板块 ${sector.name}：成功加入 ${result.data.added.length} 只，失败 ${result.data.failed.length} 只`,
        )
        debug.log('handleAddAllHotStocks 刷新候选池前')
        await refresh()
        debug.log('handleAddAllHotStocks 刷新候选池后', { poolSize: useIntentionPoolStore.getState().items.length })
      } else {
        toast({ title: '批量加入失败', description: result.error ?? '未知错误', variant: 'error' })
        setMessage(result.error ?? '批量加入失败')
      }
    } finally {
      setAddingAll(false)
      setAddingHot((prev) => {
        const next = new Set(prev)
        sector.stocks.forEach((s) => next.delete(s.symbol))
        return next
      })
    }
  }

  // 加入选中板块的全部成分股（多板块批量）
  const handleAddSelectedSectors = async (): Promise<void> => {
    if (selectedSectors.size === 0 || addingAll) {
      debug.log('handleAddSelectedSectors 中断', {
        selectedCount: selectedSectors.size,
        addingAll,
      })
      return
    }

    // 展开选中板块的所有成分股
    const allSymbols: Set<string> = new Set()
    const sectorDetails: SectorDetail[] = []
    selectedSectors.forEach((code) => {
      const sector = hotSectors.find((s) => s.code === code)
      if (!sector) return
      const symbols = sector.stocks.map((s) => s.symbol)
      symbols.forEach((s) => allSymbols.add(s))
      sectorDetails.push({ code, name: sector.name, stockSymbols: symbols })
    })

    debug.log('handleAddSelectedSectors 开始', {
      selectedSectorCount: selectedSectors.size,
      selectedSectorCodes: Array.from(selectedSectors),
      sectorDetails,
      totalStockCount: allSymbols.size,
      allSymbols: Array.from(allSymbols),
      targetGroup: addOptions.group ?? '默认分组',
      existingInPool: Array.from(allSymbols).filter((s) => existingSymbols.has(s)),
    })

    setAddingAll(true)
    setAddingHot(allSymbols)

    try {
      let totalAdded = 0
      let totalFailed = 0
      const sectorResults: SectorBatchResult[] = []
      for (const sectorCode of selectedSectors) {
        debug.log('handleAddSelectedSectors 处理板块', { sectorCode, index: sectorResults.length + 1 })
        const result = await addHotSectorStocks(sectorCode, addOptions)
        const added = result.data?.added ?? []
        const failed = result.data?.failed ?? []
        debug.log('handleAddSelectedSectors 板块结果', {
          sectorCode,
          success: result.success,
          added,
          failed,
          error: result.error,
        })
        if (result.success && result.data) {
          totalAdded += added.length
          totalFailed += failed.length
        }
        sectorResults.push({ code: sectorCode, added: added.map((s) => s.symbol), failed: failed.map((f) => f.symbol) })
      }
      debug.log('handleAddSelectedSectors 汇总', {
        sectorResults,
        totalAdded,
        totalFailed,
      })
      toast({
        title: '批量加入完成',
        description: `已选 ${selectedSectors.size} 个板块：成功 ${totalAdded} 只，失败 ${totalFailed} 只`,
        variant: 'success',
      })
      setMessage(`已选 ${selectedSectors.size} 个板块：成功加入 ${totalAdded} 只，失败 ${totalFailed} 只`)
      await refresh()
      debug.log('handleAddSelectedSectors 刷新后候选池', {
        poolSize: useIntentionPoolStore.getState().items.length,
      })
    } finally {
      setAddingAll(false)
      setAddingHot(new Set())
    }
  }

  // 加入勾选的成分股（跨板块逐项选择）
  const handleAddSelectedStocks = async (): Promise<void> => {
    const allSelected: string[] = []
    const selectionDetail: StockSelectionDetail[] = []
    Object.entries(selectedStocksBySector).forEach(([sectorCode, symbols]) => {
      const sector = hotSectors.find((s) => s.code === sectorCode)
      if (!sector) return
      const validSymbols: string[] = []
      symbols.forEach((symbol) => {
        if (sector.stocks.some((s) => s.symbol === symbol)) {
          allSelected.push(symbol)
          validSymbols.push(symbol)
        }
      })
      if (validSymbols.length > 0) {
        selectionDetail.push({ sectorCode, sectorName: sector.name, symbols: validSymbols })
      }
    })

    debug.log('handleAddSelectedStocks 选中明细', {
      selectionDetail,
      totalSelected: allSelected.length,
      targetGroup: addOptions.group ?? '默认分组',
      existingInPool: allSelected.filter((s) => existingSymbols.has(s)),
    })

    if (allSelected.length === 0 || addingAll) {
      debug.log('handleAddSelectedStocks 中断', {
        selectedCount: allSelected.length,
        addingAll,
      })
      return
    }

    setAddingAll(true)
    setAddingHot(new Set(allSelected))

    try {
      let added = 0
      let failed = 0
      const results: StockAddResult[] = []
      for (const symbol of allSelected) {
        const sector = hotSectors.find((s) => s.stocks.some((st) => st.symbol === symbol))
        if (!sector) {
          debug.log('handleAddSelectedStocks 跳过（未找到板块）', { symbol })
          continue
        }
        debug.log('handleAddSelectedStocks 加入个股', {
          symbol,
          sectorCode: sector.code,
          index: results.length + 1,
        })
        const result = await addHotSectorStock(sector.code, symbol, addOptions)
        debug.log('handleAddSelectedStocks 个股结果', {
          symbol,
          sectorCode: sector.code,
          success: result.success,
          error: result.error,
        })
        results.push({ symbol, sectorCode: sector.code, success: result.success, error: result.error })
        if (result.success) {
          added++
        } else {
          failed++
        }
      }
      debug.log('handleAddSelectedStocks 汇总', {
        totalProcessed: results.length,
        added,
        failed,
        results,
      })
      toast({
        title: '逐项加入完成',
        description: `成功 ${added} 只，失败 ${failed} 只`,
        variant: added > 0 ? 'success' : 'error',
      })
      setMessage(`逐项加入完成：成功 ${added} 只，失败 ${failed} 只`)
      await refresh()
      debug.log('handleAddSelectedStocks 刷新后候选池', {
        poolSize: useIntentionPoolStore.getState().items.length,
      })
      // 清空成分股勾选
      setSelectedStocksBySector({})
    } finally {
      setAddingAll(false)
      setAddingHot(new Set())
    }
  }

  // 统计选中成分股数
  const totalSelectedStocks = useMemo(() => {
    return Object.values(selectedStocksBySector).reduce((sum, set) => sum + set.size, 0)
  }, [selectedStocksBySector])

  // ── 动态权重排序（先按及时性过滤，再按动态分降序） ──
  const filteredSectors = useMemo(
    () => (timelyOnly ? hotSectors.filter((s) => getTimeliness(s.scoreDate).timely) : hotSectors),
    [hotSectors, timelyOnly],
  )
  const rankedSectors = useMemo(
    () => rankSectorsByDynamicScore(filteredSectors),
    [filteredSectors],
  )
  // 近一周内有评分的板块数（用于展示"仅看近一周"开关状态）
  const timelySectorsCount = useMemo(
    () => hotSectors.filter((s) => getTimeliness(s.scoreDate).timely).length,
    [hotSectors],
  )

  // ── 抽取热门赛道代表股（15-20 只） ──
  const handleExtractRepresentatives = useCallback((): void => {
    const extracted = extractRepresentativeStocks(rankedSectors, { limit: 20, timelyOnly })
    setPicks(extracted)
    logger.info('[HotSectorSection] 抽取代表股完成', { count: extracted.length, timelyOnly })
    if (extracted.length === 0) {
      setMessage('当前条件下无可抽取的代表股（可关闭"仅看近一周"后重试）')
      return
    }
    setMessage(`已抽取 ${extracted.length} 只热门赛道代表股，请确认后加入候选池`)
  }, [rankedSectors, timelyOnly])

  // 将抽取的代表股全部加入意向候选池
  const handleAddPicks = async (): Promise<void> => {
    if (picks.length === 0 || addingAll) return
    debug.log('handleAddPicks 开始', {
      count: picks.length,
      symbols: picks.map((p) => p.symbol),
      targetGroup: addOptions.group ?? '默认分组',
      existingInPool: picks.filter((p) => existingSymbols.has(p.symbol)).map((p) => p.symbol),
    })
    setAddingAll(true)
    setAddingHot(new Set(picks.map((p) => p.symbol)))
    try {
      let added = 0
      let failed = 0
      for (const pick of picks) {
        const result = await addHotSectorStock(pick.sectorCode, pick.symbol, addOptions)
        if (result.success) added++
        else failed++
      }
      debug.log('handleAddPicks 汇总', { total: picks.length, added, failed })
      toast({
        title: '代表股入池完成',
        description: `成功 ${added} 只，失败 ${failed} 只`,
        variant: added > 0 ? 'success' : 'error',
      })
      setMessage(`代表股入池完成：成功 ${added} 只，失败 ${failed} 只`)
      await refresh()
    } finally {
      setAddingAll(false)
      setAddingHot(new Set())
    }
  }

  return {
    hotSectors,
    allGroups,
    targetGroup,
    setTargetGroup,
    addingAll,
    addingHot,
    message,
    selectedSectors,
    expandedSectors,
    selectedStocksBySector,
    existingSymbols,
    totalSelectedStocks,
    rankedSectors,
    timelyOnly,
    setTimelyOnly,
    timelySectorsCount,
    picks,
    handleExtractRepresentatives,
    handleAddPicks,
    handleToggleSector,
    handleToggleExpand,
    handleToggleStock,
    handleToggleSelectAllSectors,
    handleToggleSelectAllStocksInSector,
    handleAddHotStock,
    handleAddAllHotStocks,
    handleAddSelectedSectors,
    handleAddSelectedStocks,
  }
}
