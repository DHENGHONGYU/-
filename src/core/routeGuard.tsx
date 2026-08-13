/**
 * @module core/routeGuard
 * @lifecycle @Global
 * @description 模块化边界检查器 — 提供路由级舱室隔离和按钮级敏感操作防护
 *
 * ⚠️ 架构定位：这是**模块化边界检查器**，不是完整的 RBAC 权限系统。
 * - 路由级：确保路由属于已注册的舱室类别（防止非法路径注入）
 * - 按钮级：保护各舱室的敏感操作（导出/删除/重置等）
 * - 无用户身份概念：所有检查对所有访问者一视同仁（静态白名单）
 *
 * 与其他访问控制体系的关系（三层防护）：
 *   L1 路由守卫  ← 本文件（前端舱室边界 + 敏感按钮防护）
 *   L2 数据 ACL  ← acl.ts / ACL_MATRIX（DataBridge 层模块-存储-操作矩阵）
 *   L3 RBAC 体系  ← services/rbac/（用户-角色-权限，服务层可用，前端待集成）
 *
 * 安全原则：
 * - 默认拒绝：未注册的模块/按钮一律拒绝访问
 * - 白名单模式：仅显式注册的操作才放行
 * - 深度防御：路由守卫是第一道防线，数据 ACL 是核心防线
 *
 * 使用方式：
 * 1. 在 App.tsx 中用 <GuardedRoute> 替换 <Route>
 * 2. 在组件中调用 hasPermission({ module: 'trading', level: 'button', action: 'export' })
 * 3. 新模块接入时调用 registerButtonPermission() 注册敏感操作
 *
 * @doc [V9-DOC-SEC-001, V9-DOC-ARCH-008, V9-DOC-BACK-012]
 */

import React, { type ReactNode } from 'react'
import { Navigate, Route, useLocation } from 'react-router'
import { getLogger } from '@/lib/logger'
import { ROUTE_WHITELIST } from '@/config/routes'

const logger = getLogger()

// ============================================================================
// 权限类型定义
// ============================================================================

export type PermissionLevel = 'route' | 'module' | 'button' | 'crud'
export type CrudAction = 'create' | 'read' | 'update' | 'delete'

export interface PermissionContext {
  module: string
  level: PermissionLevel
  action?: string
  storeName?: string
}

export type PermissionChecker = (ctx: PermissionContext) => boolean

// ============================================================================
// 按钮级权限注册表
// ============================================================================

/** 按钮级权限规则：module → action[]（白名单模式） */
const buttonPermissionRegistry: Record<string, Set<string>> = {}

/**
 * 注册按钮级权限规则
/**
 * registerButtonPermission
 * @param module
 * @param actions
 * @returns void
 */
export function registerButtonPermission(module: string, actions: string[]): void {
  buttonPermissionRegistry[module] = new Set(actions)
  logger.debug(`[routeGuard] 注册按钮权限: module=${module}, actions=${actions.join(',')}`)
}

/**
 * 路由级白名单 — 与 routes.ts 的 RouteCategory 保持一致
 * 不使用 MODULE_ID（数据库模块ID），因为路由类别与数据库模块是不同概念
 */
const ALLOWED_ROUTE_CATEGORIES: ReadonlyArray<string> = [
  'portal',
  'input',
  'analysis',
  'trading',
  'output',
  'command',
  'system',
  'other',
]

/**
 * 检查是否拥有指定权限
/**
 * hasPermission
 */
export const hasPermission: PermissionChecker = (ctx): boolean => {
  // Route 级：检查模块是否在路由白名单中，同时验证路径合法性
  if (ctx.level === 'route') {
    if (!ALLOWED_ROUTE_CATEGORIES.includes(ctx.module)) return false
    // 若提供了 storeName（此处复用为路径前缀），检查是否在 ROUTE_WHITELIST 中
    const sn = ctx.storeName ?? ''
    if (sn !== '' && ROUTE_WHITELIST.size > 0 && !ROUTE_WHITELIST.has(sn)) {
      return false
    }
    return true
  }

  // Module 级：检查模块是否已注册
  if (ctx.level === 'module') {
    return Object.keys(buttonPermissionRegistry).includes(ctx.module)
  }

  // Button 级：检查 action 是否在模块白名单中
  if (ctx.level === 'button') {
    const act = ctx.action ?? ''
    if (act === '') return false
    const actions = buttonPermissionRegistry[ctx.module]
    if (!actions) return false // 未注册的模块默认拒绝（安全优先）
    return actions.has(act)
  }

  // CRUD 级：委托给 ACL_MATRIX（已在 acl.ts 中实现）
  if (ctx.level === 'crud') {
    return true // ACL_MATRIX 已处理
  }

  return true
}

/**
 * React Hook：在组件中检查按钮级权限
 *
 * @example
 * const canExport = usePermission('trading', 'button', 'export')
 * if (!canExport) return <Button disabled>导出（无权限）</Button>
/**
 * usePermission
 */
export function usePermission(
  module: string,
  level: PermissionLevel = 'button',
  action?: string,
): boolean {
  return hasPermission({ module, level, action })
}

// ============================================================================
// 路由守卫组件
// ============================================================================

export interface RouteGuardProps {
  children: ReactNode
  /** 模块ID，用于路由级鉴权 */
  module?: string
  /** 未授权时重定向到哪个路径 */
  redirectTo?: string
}

/**
 * 路由守卫组件 — 包裹在 Route element 中使用
 *
 * @example
 * <Route path="/trading" element={
 *   <RouteGuard module="trading">
 *     <TradingApp />
 *   </RouteGuard>
 * } />
 */
export function RouteGuard({
  children,
  module,
  redirectTo = '/',
}: RouteGuardProps): React.JSX.Element | null {
  const location = useLocation()

  // 如果指定了模块，检查路由级权限
  if ((module ?? '') !== '' && !hasPermission({ module: module!, level: 'route' })) {
    logger.warn(`[RouteGuard] 访问被拒绝: path="${location.pathname}", module="${module}"`)
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  return <>{children}</>
}

/**
 * 受保护的路由组件 — 替代原有的 <Route> 直接渲染
 *
 * @example
 * <GuardedRoute path="/trading" module="trading" component={TradingApp} />
 */
export interface GuardedRouteProps {
  path: string
  component: React.ComponentType
  module?: string
  redirectTo?: string
}

/**
 * GuardedRoute
 */
export function GuardedRoute({
  path,
  component: Component,
  module,
  redirectTo,
}: GuardedRouteProps): React.JSX.Element {
  return (
    <Route
      path={path}
      element={
        <RouteGuard module={module} redirectTo={redirectTo}>
          <Component />
        </RouteGuard>
      }
    />
  )
}

// ============================================================================
// 初始化：注册各舱室的按钮级敏感操作权限
// 统一使用路由类别字符串（portal/input/analysis/trading/output/command）
// 安全原则：仅显式注册的敏感操作才放行，未注册的模块默认拒绝
// ============================================================================

// ── 门户舱（portal）──
// 门户舱主要是展示类页面，敏感操作较少
registerButtonPermission('portal', [
  'exportLayout',    // 导出驾驶舱布局
  'resetLayout',     // 重置驾驶舱布局
  'addWidget',       // 添加自定义 Widget
  'removeWidget',    // 移除 Widget
])

// ── 输入舱（input）──
// 输入舱涉及数据导入、采集配置等敏感操作
registerButtonPermission('input', [
  'import',          // 数据导入
  'batchImport',     // 批量导入
  'export',          // 导出配置/数据
  'deleteImport',    // 删除导入记录
  'collectStart',    // 启动采集
  'collectStop',     // 停止采集
  'collectReset',    // 重置采集状态
  'configEdit',      // 修改采集配置
  'templateExport',  // 导出模板
])

// ── 分析舱（analysis）──
registerButtonPermission('analysis', [
  'export',          // 导出分析结果
  'batchScore',      // 批量评分
  'deleteScore',     // 删除评分数据
  'refreshAll',      // 全量刷新分析
  'customAnalysis',  // 自定义分析
])

// ── 交易舱（trading）──
registerButtonPermission('trading', [
  'export',          // 导出交易数据
  'batchDelete',     // 批量删除订单/持仓
  'reset',           // 重置交易数据
  'forceExecute',    // 强制执行计划
  'placeOrder',      // 下单操作
  'cancelOrder',     // 撤单操作
  'strategyEdit',    // 修改策略配置
])

// ── 输出舱（output）──
// 输出舱主要是查看/导出，写操作较少
registerButtonPermission('output', [
  'export',          // 导出报告
  'batchExport',     // 批量导出
  'deleteReport',    // 删除报告
  'generateReport',  // 生成新报告
  'shareReport',     // 分享报告
])

// ── 总控舱（command）──
// 总控舱权限最多，涉及系统级敏感操作
registerButtonPermission('command', [
  'resetAll',        // 重置全部数据
  'clearData',       // 清理数据
  'migration',       // 数据迁移
  'exportDB',        // 导出数据库
  'importDB',        // 导入数据库
  // Agent 智能体权限
  'agentTrigger',    // 触发评分/赛道分析智能体
  'agentConfig',     // 修改智能体配置
  'sectorDialogue',  // 赛道交互对话
  // MCP 服务管理
  'mcpServerManage', // MCP 服务管理
  'mcpServerRestart',// 重启 MCP 服务
  // 系统管理
  'userManage',      // 用户管理
  'roleManage',      // 角色管理
  'systemConfig',    // 系统配置
])

logger.info('[routeGuard] 模块化边界检查器初始化完成，已注册 6 个舱室的按钮级权限规则')
