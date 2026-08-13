import React from 'react'
import { cn } from '@/lib/utils'
import { useHotSectorState } from './hotSector/useHotSectorState'
import { HotSectorToolbar } from './hotSector/HotSectorToolbar'
import { SectorCard } from './hotSector/SectorCard'

/**
 * 热门板块纳入意向候选池 - 嵌入式区块
 *
 * 增强：
 * - 板块级多选勾选（批量导入多个板块）
 * - 板块成分股展开逐项选择
 * - 选中板块/选中成分股两种粒度的批量加入
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
      {/* ── 板块级操作工具条 ── */}
      <HotSectorToolbar
        hotSectorsCount={hotSectors.length}
        selectedSectorsCount={selectedSectors.size}
        totalSelectedStocks={totalSelectedStocks}
        targetGroup={targetGroup}
        allGroups={allGroups}
        addingAll={addingAll}
        onToggleSelectAllSectors={handleToggleSelectAllSectors}
        onTargetGroupChange={setTargetGroup}
        onAddSelectedSectors={() => void handleAddSelectedSectors()}
        onAddSelectedStocks={() => void handleAddSelectedStocks()}
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
      </div>

      {message && (
        <p className={cn('rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground')}>
          {message}
        </p>
      )}
    </div>
  )
}
