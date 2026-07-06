/**
 * @module core/routeGuard
 * @lifecycle @Global
 * @description 路由守卫 — 提供路由级鉴权拦截和按钮级权限检查
 *
 * 解决问题：
 * - App.tsx 无路由守卫，所有路由直接渲染
 * - ACL 仅模块级+CRUD级，无按钮级权限
 *
 * 使用方式：
 * 1. 在 App.tsx 中用 <GuardedRoute> 替换 <Route>
 * 2. 在组件中调用 hasPermission('trading', 'button', 'export') 检查按钮级权限
 */

import React, { type ReactNode } from 'react'
import { Navigate, Route, useLocation } from 'react-router'
import { getLogger } from '@/lib/logger'
import { MODULE_ID } from '@/config/dbConfig'
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
 */
export const hasPermission: PermissionChecker = (ctx): boolean => {
  // Route 级：检查模块是否在路由白名单中，同时验证路径合法性
  if (ctx.level === 'route') {
    if (!ALLOWED_ROUTE_CATEGORIES.includes(ctx.module)) return false
    // 若提供了 storeName（此处复用为路径前缀），检查是否在 ROUTE_WHITELIST 中
    if (ctx.storeName && ROUTE_WHITELIST.size > 0 && !ROUTE_WHITELIST.has(ctx.storeName)) {
      return false
    }
    return true
  }

  // Module 级：检查模块是否已注册
  if (ctx.level === 'module') {
    return Object.keys(buttonPermissionRegistry).includes(ctx.module)
  }

  // Button 级：检查 action 是否在模块白名单中
  if (ctx.level === 'button' && ctx.action) {
    const actions = buttonPermissionRegistry[ctx.module]
    if (!actions) return true // 未注册的模块默认允许（渐进式启用）
    return actions.has(ctx.action)
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
  if (module && !hasPermission({ module, level: 'route' })) {
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
// 初始化：注册默认按钮权限规则
// ============================================================================

// 交易舱敏感操作
registerButtonPermission(MODULE_ID.trading, [
  'export',
  'batchDelete',
  'reset',
  'forceExecute',
])

// 命令舱敏感操作（使用路由类别字符串，不使用 MODULE_ID）
registerButtonPermission('command', [
  'resetAll',
  'clearData',
  'migration',
  'exportDB',
  'importDB',
])

// 分析舱敏感操作（使用路由类别字符串，不使用 MODULE_ID）
registerButtonPermission('analysis', [
  'export',
  'batchScore',
  'deleteScore',
])

logger.info('[routeGuard] 路由守卫初始化完成，已注册按钮级权限规则')
