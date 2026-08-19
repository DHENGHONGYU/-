/**
 * 意向输入池独立页（输入舱子页面）
 *
 * 从「录入看板」底部的意向池清单区块拆分出的独立路由页：
 * 双源输入（自行意向录入 + 热门板块）注入的标的在此集中管理，
 * 支持单只/批量采集、勾选批量删除、送入分析舱。
 *
 * 页面复用 useInputDashboardData Hook 与 InputDashboardPoolTable 表格，
 * 录入看板底部保留快捷视图，本页提供完整的池管理操作。
 *
 * @module apps/input/IntentionPoolPage
 */

import React from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { PageContainer, PageHeader } from '@/components/templates'
import { Flame, ArrowRight } from 'lucide-react'
import { useInputDashboardData } from './hooks/useInputDashboardData'
import InputDashboardStats from './components/InputDashboardStats'
import InputDashboardPoolTable from './components/InputDashboardPoolTable'

export default function IntentionPoolPage(): React.JSX.Element {
  // 数据层 Hook：与录入看板共享 intentionPoolStore（zustand 全局状态）
  const {
    loading,
    allStocks,
    fetcherOk,
    collectingSymbols,
    selectedSymbols,
    selectAllRef,
    stats,
    handleCollectStock,
    handleCollectAll,
    handleDeleteStock,
    handleToggleSelect,
    handleToggleSelectAll,
    handleBatchDelete,
  } = useInputDashboardData()

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="意向输入池"
        description="双源输入（自行录入 + 热门板块）注入的候选标的，采集完成后自动晋升研究候选池"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/input/hot-sectors">
              <Button variant="ghost" size="sm">
                <Flame className="mr-1.5 h-3.5 w-3.5" />
                热门板块
              </Button>
            </Link>
            <Link to="/input/pool-board">
              <Button variant="outline" size="sm" className="shadow-sm">
                研究候选池
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* ─── 统计概览 ─── */}
      <InputDashboardStats loading={loading} stats={stats} fetcherOk={fetcherOk} />

      {/* ─── 意向池清单（完整管理） ─── */}
      <InputDashboardPoolTable
        allStocks={allStocks}
        collectingSymbols={collectingSymbols}
        selectedSymbols={selectedSymbols}
        selectAllRef={selectAllRef}
        onCollectAll={handleCollectAll}
        onToggleSelectAll={handleToggleSelectAll}
        onBatchDelete={handleBatchDelete}
        onToggleSelect={handleToggleSelect}
        onCollectStock={handleCollectStock}
        onDeleteStock={handleDeleteStock}
      />
    </PageContainer>
  )
}
