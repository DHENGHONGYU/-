/**
 * routeGuard 单元测试
 *
 * 覆盖：
 * 1. hasPermission —— route 级（合法/非法舱室类别）、button 级（白名单动作/越权动作/未注册模块默认放行）
 * 2. usePermission —— 与 hasPermission 行为一致
 * 3. RouteGuard 组件 —— 有权限时渲染 children；无权限时重定向到 redirectTo 并渲染兜底
 *
 * 注：routeGuard.tsx 另导出 GuardedRoute，但它是「返回 <Route> 的自定义组件」，
 * 在 react-router v6 中无法作为 <Routes> 的直接子节点（invariant 报错），且全仓未被使用
 * （App.tsx 改用 <Route> + <RouteGuard> 组合）。属待清理的死代码，已列入删除候选清单，不在本测试覆盖。
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

// 模拟 logger（须覆盖 routeGuard 实际调用的全部方法：debug/info/warn/error）
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const { hasPermission, usePermission, RouteGuard } = await import('@/core/routeGuard')

/** 探针组件：把 usePermission 结果渲染为 ALLOWED / DENIED */
function PermProbe({
  module,
  level,
  action,
}: {
  module: string
  level: 'route' | 'module' | 'button' | 'crud'
  action?: string
}): React.JSX.Element {
  const ok = usePermission(module, level, action)
  return <div>{ok ? 'ALLOWED' : 'DENIED'}</div>
}

describe('routeGuard - hasPermission（route 级）', () => {
  it('合法舱室类别放行', () => {
    expect(hasPermission({ module: 'trading', level: 'route' })).toBe(true)
    expect(hasPermission({ module: 'portal', level: 'route' })).toBe(true)
    expect(hasPermission({ module: 'command', level: 'route' })).toBe(true)
  })

  it('非法舱室类别拒绝', () => {
    expect(hasPermission({ module: 'not-a-real-cabin', level: 'route' })).toBe(false)
  })
})

describe('routeGuard - hasPermission（button 级）', () => {
  it('已注册模块的白名单动作放行', () => {
    expect(hasPermission({ module: 'trading', level: 'button', action: 'export' })).toBe(true)
    expect(hasPermission({ module: 'command', level: 'button', action: 'clearData' })).toBe(true)
  })

  it('已注册模块的越权动作拒绝', () => {
    expect(hasPermission({ module: 'trading', level: 'button', action: 'nuclearLaunch' })).toBe(false)
    expect(hasPermission({ module: 'analysis', level: 'button', action: 'unknownAction' })).toBe(false)
  })

  it('未注册模块默认拒绝（安全优先）', () => {
    expect(hasPermission({ module: 'ghostModule', level: 'button', action: 'anything' })).toBe(false)
  })
})

describe('routeGuard - usePermission', () => {
  it('白名单动作经 hook 返回 true', () => {
    render(
      <MemoryRouter>
        <PermProbe module="trading" level="button" action="export" />
      </MemoryRouter>,
    )
    expect(screen.getByText('ALLOWED')).toBeInTheDocument()
  })

  it('越权动作经 hook 返回 false', () => {
    render(
      <MemoryRouter>
        <PermProbe module="trading" level="button" action="nuclearLaunch" />
      </MemoryRouter>,
    )
    expect(screen.getByText('DENIED')).toBeInTheDocument()
  })
})

describe('routeGuard - RouteGuard 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有权限时渲染 children', () => {
    render(
      <MemoryRouter initialEntries={['/trading']}>
        <Routes>
          <Route
            path="/trading"
            element={
              <RouteGuard module="trading">
                <div>secret-content</div>
              </RouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('secret-content')).toBeInTheDocument()
  })

  it('无权限时重定向到 redirectTo 并渲染兜底', () => {
    render(
      <MemoryRouter initialEntries={['/trading']}>
        <Routes>
          <Route
            path="/trading"
            element={
              <RouteGuard module="not-a-real-cabin" redirectTo="/">
                <div>secret-content</div>
              </RouteGuard>
            }
          />
          <Route path="/" element={<div>redirected-home</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByText('secret-content')).not.toBeInTheDocument()
    expect(screen.getByText('redirected-home')).toBeInTheDocument()
  })
})
