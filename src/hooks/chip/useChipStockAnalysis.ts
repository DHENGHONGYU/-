/**
 * useChipStockAnalysis — 个股筹码分析业务逻辑 Hook
 *
 * 从 ChipStrategyReviewPage 提取，封装：
 * - 三池合并（意向/研究/持仓）+ 模拟示例
 * - 股票选择与自动填充（模拟示例）
 * - 筹码分析引擎调用
 * - 结果状态管理
 * - 重置逻辑
 *
 * @see src/pages/output/ChipStrategyReviewPage.tsx — 原消费方
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { usePositionPoolStore } from '@/store/positionPoolStore'
import { useToast } from '@/hooks/useToast'
import { MOCK_EXAMPLES, type MockExample } from '@/fixtures/chipStrategyMockData'
import type { ChipAnalysisResult, StockChipInput } from '@/domain/chip/types'
import { analyzeStockChips, logGrayZoneDecision } from '@/domain/chip/analysis'
import { getDebugLogCount } from '@/domain/chip/debugLog'
import type { PoolItem } from '@/types/modules/pool.types'

export interface PoolOption {
  item: PoolItem
  label: string // 来源标签：模拟示例 / 持仓池 / 研究池 / 意向池
}

export function useChipStockAnalysis() {
  const { toast } = useToast()

  // === state ===
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [turnover, setTurnover] = useState<string>('')
  const [volumeRatio, setVolumeRatio] = useState<string>('')
  const [return60d, setReturn60d] = useState<string>('')
  const [priceChange, setPriceChange] = useState<string>('')
  const [analysisResult, setAnalysisResult] = useState<ChipAnalysisResult | null>(null)
  const [debugLogCount, setDebugLogCount] = useState<number>(0)

  // === 三池数据 ===
  const intentionItems = useIntentionPoolStore((s) => s.items)
  const researchItems = useResearchPoolStore((s) => s.items)
  const positionItems = usePositionPoolStore((s) => s.items)
  const refreshIntention = useIntentionPoolStore((s) => s.refresh)
  const refreshResearch = useResearchPoolStore((s) => s.refresh)
  const refreshPosition = usePositionPoolStore((s) => s.refresh)

  useEffect(() => {
    void refreshIntention()
    void refreshResearch()
    void refreshPosition()
  }, [refreshIntention, refreshResearch, refreshPosition])

  // === 派生：模拟示例 → PoolItem ===
  const mockPoolItems = useMemo<PoolItem[]>(
    () =>
      MOCK_EXAMPLES.map((ex) => ({
        symbol: ex.stock.symbol,
        name: ex.stock.name,
        pool: 'intention',
        status: 'screening',
        price: ex.stock.price,
        pe: ex.stock.pe,
        pb: ex.stock.pb,
        roe: undefined,
        marketCap: undefined,
        source: 'manual',
        dataVersion: 0,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
        industryCode: undefined,
        theme: [],
        sector: ex.stock.sector,
        group: 'mock',
        screenReason: ex.scenario,
      })),
    [],
  )

  // === 派生：模拟示例索引 ===
  const mockChipMap = useMemo(() => {
    const m = new Map<string, MockExample>()
    for (const ex of MOCK_EXAMPLES) m.set(ex.stock.symbol, ex)
    return m
  }, [])

  // === 派生：合并去重的下拉选项 ===
  const poolOptions = useMemo<PoolOption[]>(() => {
    const map = new Map<string, PoolOption>()
    for (const item of mockPoolItems) {
      map.set(item.symbol, { item, label: '模拟示例' })
    }
    for (const item of positionItems) {
      map.set(item.symbol, { item, label: '持仓池' })
    }
    for (const item of researchItems) {
      if (!map.has(item.symbol)) map.set(item.symbol, { item, label: '研究池' })
    }
    for (const item of intentionItems) {
      if (!map.has(item.symbol)) map.set(item.symbol, { item, label: '意向池' })
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.label === '模拟示例' && b.label !== '模拟示例') return -1
      if (a.label !== '模拟示例' && b.label === '模拟示例') return 1
      return a.item.symbol.localeCompare(b.item.symbol)
    })
  }, [mockPoolItems, intentionItems, researchItems, positionItems])

  // === 派生：当前选中项 ===
  const selectedOption = useMemo(
    () => poolOptions.find((o) => o.item.symbol === selectedSymbol) ?? null,
    [poolOptions, selectedSymbol],
  )

  // === 操作：选择股票 ===
  const handleSelectStock = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol)
      setAnalysisResult(null)
      const mock = mockChipMap.get(symbol)
      if (mock) {
        setTurnover(String(mock.chip.turnover))
        setVolumeRatio(String(mock.chip.volumeRatio))
        setReturn60d(String(mock.chip.return60d))
        setPriceChange(String(mock.chip.priceChange))
      }
    },
    [mockChipMap],
  )

  // === 操作：执行分析 ===
  const handleAnalyze = useCallback(() => {
    if (!selectedOption) {
      toast({ title: '请先选择股票', variant: 'error' })
      return
    }
    const t = parseFloat(turnover)
    const v = parseFloat(volumeRatio)
    const r60 = parseFloat(return60d)
    const pc = parseFloat(priceChange)
    if (Number.isNaN(t) || Number.isNaN(v) || Number.isNaN(r60) || Number.isNaN(pc)) {
      toast({ title: '请填入有效的换手率/量比/60日收益/当日涨跌', variant: 'error' })
      return
    }
    const input: StockChipInput = {
      symbol: selectedOption.item.symbol,
      name: selectedOption.item.name,
      turnover: t,
      volumeRatio: v,
      return60d: r60,
      priceChange: pc,
      pe: selectedOption.item.pe,
      pb: selectedOption.item.pb,
      industryCode: selectedOption.item.industryCode,
      sector: selectedOption.item.sector,
      poolLabel: selectedOption.label,
    }
    const result = analyzeStockChips(input)
    logGrayZoneDecision(input, result)
    setDebugLogCount(getDebugLogCount())
    setAnalysisResult(result)
    toast({
      title: '分析完成',
      description: `${selectedOption.item.name} → ${result.tradeSignal}`,
    })
  }, [selectedOption, turnover, volumeRatio, return60d, priceChange, toast])

  // === 操作：重置 ===
  const handleReset = useCallback(() => {
    setSelectedSymbol('')
    setTurnover('')
    setVolumeRatio('')
    setReturn60d('')
    setPriceChange('')
    setAnalysisResult(null)
  }, [])

  // === 操作：快速载入模拟示例并分析 ===
  const handleQuickExample = useCallback(
    (ex: MockExample) => {
      setSelectedSymbol(ex.stock.symbol)
      setTurnover(String(ex.chip.turnover))
      setVolumeRatio(String(ex.chip.volumeRatio))
      setReturn60d(String(ex.chip.return60d))
      setPriceChange(String(ex.chip.priceChange))
      const input: StockChipInput = {
        symbol: ex.stock.symbol,
        name: ex.stock.name,
        turnover: ex.chip.turnover,
        volumeRatio: ex.chip.volumeRatio,
        return60d: ex.chip.return60d,
        priceChange: ex.chip.priceChange,
        pe: ex.stock.pe,
        pb: ex.stock.pb,
        industryCode: undefined,
        sector: ex.stock.sector,
        poolLabel: '模拟示例',
      }
      const result = analyzeStockChips(input)
      logGrayZoneDecision(input, result)
      setDebugLogCount(getDebugLogCount())
      setAnalysisResult(result)
      toast({
        title: `示例分析完成：${ex.scenario}`,
        description: `${ex.stock.name} → ${result.tradeSignal}`,
      })
    },
    [toast],
  )

  return {
    // state
    selectedSymbol,
    turnover,
    volumeRatio,
    return60d,
    priceChange,
    analysisResult,
    setAnalysisResult,
    debugLogCount,
    setDebugLogCount,
    // derived
    poolOptions,
    selectedOption,
    // actions
    setSelectedSymbol,
    setTurnover,
    setVolumeRatio,
    setReturn60d,
    setPriceChange,
    handleSelectStock,
    handleAnalyze,
    handleReset,
    handleQuickExample,
  }
}
