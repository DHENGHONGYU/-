/**
 * @module ArchitecturePage
 * @description 系统架构可视化页面（总控舱）。
 *   - 渲染 SystemArchitectureDiagram 组件（全宽），由该组件内部负责
 *     架构快照的拉取与渲染（分层节点、连接关系、V6 引擎层、Agent 节点）。
 *   - 本页为轻量壳层，仅提供标题与说明，不直接管理数据获取。
 *
 * 遵循 AGENTS.md 契约：
 *   - 页面层仅依赖 store/services，不直接调用 dataLayer 或 db
 *   - 禁止使用 any
 */

import React from 'react'
import SystemArchitectureDiagram from '@/components/system/SystemArchitectureDiagram'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

function ArchitecturePage(): React.JSX.Element {
  return (
    <div className="space-y-4 p-4">
      {/* 页面头部：标题 + 说明 */}
      <Card>
        <CardHeader>
          <CardTitle>系统架构可视化</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            V9 智能投研复盘系统分层架构与模块依赖关系
          </p>
        </CardContent>
      </Card>

      {/* 架构图（全宽，组件内部自管理数据拉取与渲染） */}
      <SystemArchitectureDiagram />
    </div>
  )
}

export default ArchitecturePage
