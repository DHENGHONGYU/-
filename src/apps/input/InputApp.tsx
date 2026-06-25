import React from 'react'
import { useLocation } from 'react-router'
import InputDashboard from './InputDashboard'
import BulkImportPanel from './BulkImportPanel'
import HotSectorPanel from './HotSectorPanel'
import DataTestPanel from './DataTestPanel'
import InputPrototype from './prototype/InputPrototype'

export default function InputApp(): React.JSX.Element {
  const { pathname } = useLocation()

  let content: React.ReactNode
  if (pathname === '/input' || pathname.startsWith('/input/')) {
    if (pathname === '/input/bulk-import') {
      content = <BulkImportPanel />
    } else if (pathname === '/input/hot-sectors') {
      content = <HotSectorPanel />
    } else if (pathname === '/input/data-test') {
      content = <DataTestPanel />
    } else if (pathname === '/input/prototype') {
      content = <InputPrototype />
    } else {
      content = <InputDashboard />
    }
  } else {
    content = <InputDashboard />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">输入舱</h1>
          <p className="text-sm text-muted-foreground">股票录入 · 批量导入 · 热门板块 · 采集测试</p>
        </div>
      </div>
      {content}
    </div>
  )
}
