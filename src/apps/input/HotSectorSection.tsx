import React from 'react'
import { cn } from '@/lib/utils'
import { useHotSectorState } from './hotSector/useHotSectorState'
import { HotSectorToolbar } from './hotSector/HotSectorToolbar'
import { SectorCard } from './hotSector/SectorCard'
import { RepresentativePanel } from './hotSector/RepresentativePanel'

/**
 * 热门板块纳入意向候选池 - 嵌入式区块（来源一·热门赛道）
 *
 * 增强（考核标准 + 及时性）：
 * - 板块级多选勾选（批量导入多个板块）
 * - 板块成分股展开逐项选择
 * - 考核标准图例：综合评分 / 动量 / 资金 / 估值 / 情绪 五因子
 * - 及时性要求：仅看近一周评分板块，板块卡片标注评分日期
 * - 一键抽取 15-20 只热门赛道代表股筛选入池
 *
 * 状态与事件逻辑见 useHotSectorState；
 * 子组件见 hotSector/ 目录。
 */
export default function HotSectorSection(): React.JSX.Element {
  const {
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
  } = useHotSectorState()

  return (
    <div className="space-y-4">
      {/* ── 考核标准图例（板块评分维度 + 及时性要求） ── */}
      <div className={cn('rounded-md border border-border bg-card px-4 py-3 text-xs text-muted-foreground')}>
        <div className="mb-1 font-medium text-foreground">考核标准</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>综合评分：五因子加权总分（0-100）</span>
          <span>动量强度（景气+量能）</span>
          <span>资金热度</span>
          <span>估值风险</span>
          <span>情绪热度</span>
          <span className="text-success">及时性：近一周（&lt;=7 天）内有评分</span>
        </div>
      </div>

      {/* ── 板块级操作工具条 ── */}
      <HotSectorToolbar
        hotSectorsCount={hotSectors.length}
        selectedSectorsCount={selectedSectors.size}
        totalSelectedStocks={totalSelectedStocks}
        targetGroup={targetGroup}
        allGroups={allGroups}
        addingAll={addingAll}
        timelyOnly={timelyOnly}
        setTimelyOnly={setTimelyOnly}
        timelySectorsCount={timelySectorsCount}
        picks={picks}
        handleExtractRepresentatives={handleExtractRepresentatives}
        handleAddPicks={() => void handleAddPicks()}
        onToggleSelectAllSectors={handleToggleSelectAllSectors}
        onTargetGroupChange={setTargetGroup}
        onAddSelectedSectors={() => void handleAddSelectedSectors()}
        onAddSelectedStocks={() => void handleAddSelectedStocks()}
      />

      {/* ── 代表股筛选面板（15-20 只） ── */}
      <RepresentativePanel
        picks={picks}
        timelyOnly={timelyOnly}
        onReExtract={handleExtractRepresentatives}
      />

      {/* ── 板块列表（按动态权重排序） ── */}
      <div className="space-y-2">
        {rankedSectors.map((sector) => (
          <SectorCard
            key={sector.code}
            sector={sector}
            isSelected={selectedSectors.has(sector.code)}
            isExpanded={expandedSectors.has(sector.code)}
            selectedStocks={selectedStocksBySector[sector.code] ?? new Set()}
            addingAll={addingAll}
            addingHot={addingHot}
            existingSymbols={existingSymbols}
            onToggleSector={handleToggleSector}
            onToggleExpand={handleToggleExpand}
            onToggleStock={handleToggleStock}
            onToggleSelectAllStocksInSector={handleToggleSelectAllStocksInSector}
            onAddAllHotStocks={(code) => void handleAddAllHotStocks(code)}
            onAddHotStock={(symbol) => void handleAddHotStock(symbol)}
          />
        ))}
        {rankedSectors.length === 0 && (
          <p className="rounded-md bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
            {hotSectors.length > 0 && timelyOnly
              ? '当前没有近一周内有评分的板块，可关闭"仅看近一周"查看全部'
              : '暂无热门板块数据'}
          </p>
        )}
      </div>

      {message && (
        <p className={cn('rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground')}>
          {message}
        </p>
      )}
    </div>
  )
}