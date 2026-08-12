import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Checkbox } from '@/components/atoms/Checkbox'
import { Select, SelectItem } from '@/components/atoms/Select'
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
import { twText, twBg, twBorder, DARK, HOVER, DIVIDE } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'

const logger = getLogger()
/** 热门板块纳入流程的 Debug 日志（控制台筛选 [HotSector]） */
const debug = createDebugLogger('HotSector')

/**
 * 热门板块纳入意向候选池 - 嵌入式区块
 *
 * 增强：
 * - 板块级多选勾选（批量导入多个板块）
 * - 板块成分股展开逐项选择
 * - 选中板块/选中成分股两种粒度的批量加入
 */
export default function HotSectorSection(): React.JSX.Element {
  const refresh = useIntentionPoolStore((s) => s.refresh)
  const items = useIntentionPoolStore((s) => s.items)
  const allGroups = useMemo(() => getIntentionPoolGroups(), [items])

  const [hotSectors, setHotSectors] = useState<HotSector[]>([])
  const [targetGroup, setTargetGroup] = useState('')
  const [addingHot, setAddingHot] = useState<Set<string>>(new Set())
  const [addingAll, setAddingAll] = useState(false)
  const [message, setMessage] = useState('')
  const { toast } = useToast()

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
    const sectorDetails: Array<{ code: string; name: string; stockSymbols: string[] }> = []
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
      const sectorResults: Array<{ code: string; added: string[]; failed: string[] }> = []
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
    const selectionDetail: Array<{ sectorCode: string; sectorName: string; symbols: string[] }> = []
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
      const results: Array<{ symbol: string; sectorCode: string; success: boolean; error?: string }> = []
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

  // ── 动态权重排序：综合原始评分(60%) + 资金热度(30%) + 动量强度(10%) ──
  const rankedSectors = useMemo(() => {
    const ranked = hotSectors.map((sector) => {
      // 资金权重：资金因子(fundFlow) 与 动量因子(momentum) 的加权均值
      const capitalWeight = (sector.factors.fundFlow + sector.factors.momentum) / 2
      // 动量权重：情绪因子(sentiment) 与 估值因子(valuation) 的加权
      const momentumWeight = sector.factors.sentiment * 0.6 + sector.factors.valuation * 0.4
      // 动态综合评分
      const dynamicScore = sector.score * 0.6 + capitalWeight * 0.3 + momentumWeight * 0.1

      logger.info('[HotSectorSection][动态权重]', {
        sectorCode: sector.code,
        sectorName: sector.name,
        originalScore: sector.score,
        capitalWeight: capitalWeight.toFixed(2),
        momentumWeight: momentumWeight.toFixed(2),
        dynamicScore: dynamicScore.toFixed(2),
      })

      return { ...sector, dynamicScore }
    })

    return ranked.sort((a, b) => b.dynamicScore - a.dynamicScore)
  }, [hotSectors])

  return (
    <div className="space-y-4">
      {/* ── 板块级操作工具条 ── */}
      <div className={cn('flex flex-wrap items-center gap-3 rounded-md border px-3 py-2', twBorder('stone', 200), twBg('stone', 50) + '/50', DARK.borderNeutral700, DARK.bgNeutral900Half)}>
        {/* 包裹可点击区域确保 checkbox 点击可靠。
            注意：外层 onClick 已处理所有点击事件，内部 Checkbox 仅做视觉展示，
            内部 onClick/onChange 都做屏蔽，避免 <label> 标签再次触发 click 事件导致双重 toggle。 */}
        <div
          className="cursor-pointer"
          role="checkbox"
          aria-checked={hotSectors.length > 0 && selectedSectors.size === hotSectors.length}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            handleToggleSelectAllSectors(!(hotSectors.length > 0 && selectedSectors.size === hotSectors.length))
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Checkbox
            checked={hotSectors.length > 0 && selectedSectors.size === hotSectors.length}
            onChange={() => { /* 由外层 div onClick 统一处理 */ }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
            aria-label="全选板块"
          />
        </div>
        <span className={cn('text-xs', twText('stone', 500), DARK.textNeutral400)}>
          已选 {selectedSectors.size} / {hotSectors.length} 个板块
          {totalSelectedStocks > 0 && (
            <span className={cn('ml-2', twText('blue', 600))}>· 成分股 {totalSelectedStocks} 只</span>
          )}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            className="h-8 w-auto min-w-[140px]"
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
            aria-label="热门板块目标分组"
            disabled={addingAll}
          >
            <SelectItem value="">默认分组</SelectItem>
            {allGroups.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </Select>
          {selectedSectors.size > 0 && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => void handleAddSelectedSectors()}
              disabled={addingAll}
            >
              {addingAll ? '加入中...' : `加入选中板块 (${selectedSectors.size})`}
            </Button>
          )}
          {totalSelectedStocks > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleAddSelectedStocks()}
              disabled={addingAll}
            >
              {addingAll ? '加入中...' : `加入选中成分股 (${totalSelectedStocks})`}
            </Button>
          )}
        </div>
      </div>

      {/* ── 板块列表（按动态权重排序） ── */}
      <div className="space-y-2">
        {rankedSectors.map((sector) => {
          const isSelected = selectedSectors.has(sector.code)
          const isExpanded = expandedSectors.has(sector.code)
          const selectedStocks = selectedStocksBySector[sector.code] ?? new Set()
          return (
            <div
              key={sector.code}
              className={cn(
                'rounded-md border transition-colors',
                isSelected
                  ? [twBorder('blue', 400), twBg('blue', 50) + '/30', DARK.borderBlue700, DARK.bgBlue950_30]
                  : [twBorder('stone', 200), DARK.borderNeutral700],
              )}
            >
              {/* 板块头部：勾选 + 名称 + 评分 + 展开按钮 + 全部加入 */}
              <div className="flex items-center gap-3 p-3">
                {/* 包裹可点击区域确保 checkbox 点击可靠。
                    注意：外层 onClick 已处理所有点击事件，内部 Checkbox 仅做视觉展示，
                    将 onClick 绑定到原生 input 避免外层 <label> 再次触发 click */}
                <div
                  className="cursor-pointer"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`选择板块 ${sector.name} (${sector.code})`}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleToggleSector(sector.code)
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => { /* 由外层 div onClick 统一处理，避免 label 触发二次 toggle */ }}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    aria-label={`选择板块 ${sector.name} (${sector.code})`}
                  />
                </div>
                <button
                  onClick={() => handleToggleExpand(sector.code)}
                  className={cn('flex flex-1 items-center gap-2 text-left', HOVER.textStone700, DARK.hoverTextNeutral200)}
                >
                  <span className={cn('font-medium', twText('stone', 800), DARK.textNeutral100)}>
                    {sector.name}
                  </span>
                  <Badge
                    className={
                      sector.trend === 'up'
                        ? `${twBg('green', 100)} ${twText('green', 800)}`
                        : sector.trend === 'down'
                          ? `${twBg('red', 100)} ${twText('red', 800)}`
                          : `${twBg('gray', 100)} ${twText('gray', 600)}`
                    }
                  >
                    {sector.score}
                  </Badge>
                  <span className={cn('text-xs', twText('stone', 400), DARK.textNeutral500)}>
                    {sector.stocks.length} 只成分股
                  </span>
                  <svg
                    className={cn('h-4 w-4 transition-transform', isExpanded ? 'rotate-90' : '', twText('stone', 400))}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleAddAllHotStocks(sector.code)}
                  disabled={addingAll}
                  className="h-7 px-2 text-xs"
                >
                  {addingAll ? '...' : '全部加入'}
                </Button>
              </div>

              {/* 成分股展开区（逐项选择） */}
              {isExpanded && (
                <div className={cn('border-t', twBorder('stone', 100), DARK.borderNeutral800)}>
                  <div className="px-3 py-2">
                    <div className={cn('mb-2 flex items-center gap-2 text-xs', twText('stone', 500), DARK.textNeutral400)}>
                      {/* 包裹可点击区域确保 checkbox 点击可靠。
                          外层 onClick 统一处理所有点击事件，内部 Checkbox 仅做视觉展示。 */}
                      <div
                        className="cursor-pointer"
                        role="checkbox"
                        aria-checked={sector.stocks.length > 0 && selectedStocks.size === sector.stocks.length}
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          const willCheck = !(sector.stocks.length > 0 && selectedStocks.size === sector.stocks.length)
                          setSelectedStocksBySector((prev) => {
                            const next = { ...prev }
                            if (willCheck) {
                              next[sector.code] = new Set(sector.stocks.map((s) => s.symbol))
                            } else {
                              next[sector.code] = new Set()
                            }
                            return next
                          })
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <Checkbox
                          checked={sector.stocks.length > 0 && selectedStocks.size === sector.stocks.length}
                          onChange={() => { /* 由外层 div onClick 统一处理 */ }}
                          onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
                          aria-label={`全选 ${sector.name} 成分股`}
                        />
                      </div>
                      <span>全选成分股</span>
                    </div>
                    <div className={cn('grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3', DIVIDE.stone100)}>
                      {sector.stocks.map((stock) => {
                        const isAdded = existingSymbols.has(stock.symbol)
                        const isAdding = addingHot.has(stock.symbol)
                        const isChecked = selectedStocks.has(stock.symbol)
                        return (
                          <div
                            key={stock.symbol}
                            className={cn(
                              'flex items-center gap-2 rounded px-2 py-1.5 text-sm',
                              HOVER.bgStone50Half, DARK.hoverBgNeutral900Half,
                            )}
                          >
                            {/* 包裹可点击区域确保 checkbox 点击可靠。
                                外层 onClick 统一处理所有点击事件，内部 Checkbox 仅做视觉展示。 */}
                            <div
                              className={cn(isAdded ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
                              role="checkbox"
                              aria-checked={isChecked}
                              aria-disabled={isAdded}
                              onClick={(e) => {
                                if (isAdded) return
                                e.stopPropagation()
                                e.preventDefault()
                                handleToggleStock(sector.code, stock.symbol)
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              <Checkbox
                                checked={isChecked}
                                onChange={() => { /* 由外层 div onClick 统一处理 */ }}
                                onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
                                disabled={isAdded}
                                aria-label={`选择 ${stock.symbol}`}
                              />
                            </div>
                            <span className={cn('font-mono text-xs', twText('stone', 700), DARK.textNeutral200)}>
                              {stock.symbol}
                            </span>
                            <span className={cn('flex-1 truncate text-xs', twText('stone', 500), DARK.textNeutral400)}>
                              {stock.name}
                            </span>
                            {isAdded ? (
                              <Badge variant="secondary" className="text-[10px]">已加入</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleAddHotStock(stock.symbol)}
                                disabled={isAdding}
                                className="h-6 px-1.5 text-[11px]"
                              >
                                {isAdding ? '...' : '加入'}
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {message && (
        <p className={cn('rounded-md px-3 py-2 text-sm', twBg('stone', 50), twText('stone', 600), DARK.bgNeutral900, DARK.textNeutral400)}>
          {message}
        </p>
      )}
    </div>
  )
}
