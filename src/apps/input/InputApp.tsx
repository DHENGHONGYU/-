import React from 'react'
import { Route, Routes } from 'react-router'
import InputDashboard from './InputDashboard'
import BulkImportPanel from './BulkImportPanel'
import HotSectorPanel from './HotSectorPanel'
import DataTestPanel from './DataTestPanel'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 输入舱子路由分发
 * @description 使用声明式 <Routes> 替代 if/else 链，新增子面板仅需在此添加 <Route> 即可
 */
export default function InputApp(): React.JSX.Element {
  logger.info('[InputApp] Rendering input cabin with declarative sub-routes')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">输入舱</h1>
          <p className="text-sm text-muted-foreground">股票录入 · 批量导入 · 热门板块 · 采集测试</p>
        </div>
      </div>
      <Routes>
        <Route path="/input/bulk-import" element={<BulkImportPanel />} />
        <Route path="/input/hot-sectors" element={<HotSectorPanel />} />
        <Route path="/input/data-test" element={<DataTestPanel />} />
        <Route path="/input" element={<InputDashboard />} />
      </Routes>
    </div>
  )
}
