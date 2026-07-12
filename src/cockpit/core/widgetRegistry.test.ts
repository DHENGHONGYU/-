/**
 * WidgetRegistry 单元测试
 *
 * 覆盖场景：
 * 1. 初始化默认 widget 模板与默认实例
 * 2. register 新增/覆盖模板
 * 3. createInstance 创建实例（成功/失败/overrides/计数器）
 * 4. removeInstance 删除实例（成功/失败）
 * 5. 查询方法（getTemplate/getInstance/getAllInstances 未知 ID）
 * 6. updateRuntimeState 更新状态（保留 ID/未知实例）
 * 7. subscribe 事件订阅与取消订阅
 * 8. getStats 统计信息
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type React from 'react'
import { WidgetRegistry, type WidgetTemplate } from './widgetRegistry'
import type { WidgetConfig, WidgetMeta, WidgetRuntimeState } from '@/types/modules/widget.types'

// 抑制 logger 输出，避免污染测试控制台
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

/** 构造一个最小可用的 WidgetTemplate */
function createMockTemplate(id: string, overrides: Partial<WidgetTemplate> = {}): WidgetTemplate {
  const meta: WidgetMeta = {
    id,
    name: `测试-${id}`,
    category: 'test',
    description: `测试 widget: ${id}`,
    defaultSize: { cols: 2, rows: 2 },
    ...overrides.meta,
  }
  return {
    meta,
    component:
      overrides.component ??
      (() =>
        Promise.resolve({
          default: vi.fn(() => null) as unknown as React.ComponentType<{
            config: WidgetConfig
          }>,
        })),
  }
}

describe('WidgetRegistry', () => {
  let registry: WidgetRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new WidgetRegistry()
  })

  // ============================================================
  // 初始化
  // ============================================================

  describe('初始化', () => {
    it('构造函数应注册默认 widget 模板并创建默认实例', () => {
      // 默认模板应存在
      expect(registry.getTemplate('marketIndices')).toBeDefined()
      expect(registry.getTemplate('sectorHeatmap')).toBeDefined()
      expect(registry.getTemplate('fundFlow')).toBeDefined()
      expect(registry.getTemplate('watchlist')).toBeDefined()
      expect(registry.getTemplate('portfolioOverview')).toBeDefined()
      expect(registry.getTemplate('aiTradeReview')).toBeDefined()

      // 默认实例应已创建
      const instances = registry.getAllInstances()
      expect(instances.length).toBeGreaterThan(0)
      expect(instances.some((i) => i.widgetId === 'marketIndices')).toBe(true)
      expect(instances.some((i) => i.widgetId === 'signalMonitor')).toBe(true)
    })

    it('getStats 应返回正确的模板数、实例数和状态列表', () => {
      const stats = registry.getStats()
      expect(stats.templates).toBeGreaterThan(0)
      expect(stats.instances).toBeGreaterThan(0)
      expect(Array.isArray(stats.states)).toBe(true)
      expect(stats.states.length).toBe(stats.instances)
      // 每个状态项应包含 instanceId 和 status
      const first = stats.states[0]
      expect(first).toHaveProperty('instanceId')
      expect(first).toHaveProperty('status')
    })
  })

  // ============================================================
  // register
  // ============================================================

  describe('register', () => {
    it('register 应注册新 widget 模板', () => {
      const template = createMockTemplate('customWidget_test')
      const result = registry.register(template)
      expect(result).toBe(true)
      expect(registry.getTemplate('customWidget_test')).toBe(template)
    })

    it('register 重复 widgetId 时应覆盖旧模板', () => {
      const t1 = createMockTemplate('dup_widget', {
        meta: {
          id: 'dup_widget',
          name: 'V1',
          category: 'cat',
          description: 'd1',
          defaultSize: { cols: 1, rows: 1 },
        },
      })
      const t2 = createMockTemplate('dup_widget', {
        meta: {
          id: 'dup_widget',
          name: 'V2',
          category: 'cat',
          description: 'd2',
          defaultSize: { cols: 3, rows: 3 },
        },
      })
      registry.register(t1)
      registry.register(t2)
      const got = registry.getTemplate('dup_widget')
      expect(got).toBe(t2)
      expect(got?.meta.name).toBe('V2')
      expect(got?.meta.defaultSize).toEqual({ cols: 3, rows: 3 })
    })
  })

  // ============================================================
  // createInstance
  // ============================================================

  describe('createInstance', () => {
    it('createInstance 应成功创建实例并生成递增的 instanceId', () => {
      const c1 = registry.createInstance('marketIndices')
      const c2 = registry.createInstance('marketIndices')

      expect(c1).not.toBeNull()
      expect(c2).not.toBeNull()
      expect(c1?.instanceId).toMatch(/^marketIndices_\d+$/)
      expect(c2?.instanceId).toMatch(/^marketIndices_\d+$/)
      // 两次创建的 instanceId 必须不同
      expect(c1?.instanceId).not.toBe(c2?.instanceId)
      // 后创建的计数器应更大
      const n1 = Number(c1!.instanceId.split('_')[1])
      const n2 = Number(c2!.instanceId.split('_')[1])
      expect(n2).toBeGreaterThan(n1)
    })

    it('createInstance 未知 widgetId 应返回 null', () => {
      const result = registry.createInstance('nonExistentWidget_xyz')
      expect(result).toBeNull()
    })

    it('createInstance 应正确应用 overrides 并保留默认值', () => {
      const overrides = {
        title: '自定义标题',
        visible: false,
        collapsed: true,
        position: { x: 99, y: 99 },
        size: { cols: 4, rows: 4 },
      }
      const config = registry.createInstance('marketIndices', overrides)

      expect(config).not.toBeNull()
      // overrides 应生效
      expect(config?.title).toBe('自定义标题')
      expect(config?.visible).toBe(false)
      expect(config?.collapsed).toBe(true)
      expect(config?.position).toEqual({ x: 99, y: 99 })
      expect(config?.size).toEqual({ cols: 4, rows: 4 })
      // 默认值应保留
      expect(config?.widgetId).toBe('marketIndices')
      expect(config?.settings).toEqual({})
    })

    it('createInstance 后 getRuntimeState 应返回 idle 状态', () => {
      const config = registry.createInstance('marketIndices')
      const state = registry.getRuntimeState(config!.instanceId)
      expect(state).toBeDefined()
      expect(state?.status).toBe('idle')
      expect(state?.widgetId).toBe('marketIndices')
      expect(state?.instanceId).toBe(config!.instanceId)
    })
  })

  // ============================================================
  // removeInstance
  // ============================================================

  describe('removeInstance', () => {
    it('removeInstance 应删除实例和运行时状态', () => {
      const config = registry.createInstance('marketIndices')
      const instanceId = config!.instanceId

      // 删除前应存在
      expect(registry.getInstance(instanceId)).toBeDefined()
      expect(registry.getRuntimeState(instanceId)).toBeDefined()

      const result = registry.removeInstance(instanceId)
      expect(result).toBe(true)

      // 删除后应不存在
      expect(registry.getInstance(instanceId)).toBeUndefined()
      expect(registry.getRuntimeState(instanceId)).toBeUndefined()
    })

    it('removeInstance 未知 instanceId 应返回 false', () => {
      const result = registry.removeInstance('unknown_instance_xyz')
      expect(result).toBe(false)
    })
  })

  // ============================================================
  // 查询方法
  // ============================================================

  describe('查询方法', () => {
    it('getTemplate/getInstance 未知 ID 应返回 undefined', () => {
      expect(registry.getTemplate('nonExistent')).toBeUndefined()
      expect(registry.getInstance('nonExistent')).toBeUndefined()
      expect(registry.getRuntimeState('nonExistent')).toBeUndefined()
    })

    it('getAllInstances 应返回所有实例数组', () => {
      const before = registry.getAllInstances().length
      registry.createInstance('marketIndices')
      registry.createInstance('sectorHeatmap')
      const after = registry.getAllInstances().length
      expect(after).toBe(before + 2)
    })
  })

  // ============================================================
  // updateRuntimeState
  // ============================================================

  describe('updateRuntimeState', () => {
    it('updateRuntimeState 应更新状态且保留 instanceId/widgetId 不被覆盖', () => {
      const config = registry.createInstance('marketIndices')
      const instanceId = config!.instanceId

      // 传入错误的 instanceId/widgetId（运行时防御）
      registry.updateRuntimeState(instanceId, {
        instanceId: 'wrong_id',
        widgetId: 'wrong_widget',
        status: 'loading',
        error: 'test',
      })

      const state = registry.getRuntimeState(instanceId)
      expect(state?.status).toBe('loading')
      expect(state?.error).toBe('test')
      // instanceId 和 widgetId 不应被覆盖
      expect(state?.instanceId).toBe(instanceId)
      expect(state?.widgetId).toBe('marketIndices')
    })

    it('updateRuntimeState 未知 instanceId 应返回 false', () => {
      const result = registry.updateRuntimeState('unknown_instance', {
        status: 'ready' as WidgetRuntimeState['status'],
      })
      expect(result).toBe(false)
    })

    it('updateRuntimeState 应支持 lastRefresh 字段更新', () => {
      const config = registry.createInstance('marketIndices')
      const instanceId = config!.instanceId
      const ts = Date.now()

      registry.updateRuntimeState(instanceId, { lastRefresh: ts })
      const state = registry.getRuntimeState(instanceId)
      expect(state?.lastRefresh).toBe(ts)
    })
  })

  // ============================================================
  // subscribe
  // ============================================================

  describe('subscribe', () => {
    it('subscribe 应在 register/createInstance/removeInstance 时接收事件并支持取消订阅', () => {
      const listener = vi.fn()
      const unsubscribe = registry.subscribe(listener)
      expect(typeof unsubscribe).toBe('function')

      // register 事件
      registry.register(createMockTemplate('sub_test_widget'))
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'registered',
          widgetId: 'sub_test_widget',
        }),
      )

      // createInstance 事件
      listener.mockClear()
      const config = registry.createInstance('sub_test_widget')
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'instanceAdded',
          widgetId: 'sub_test_widget',
          instanceId: config!.instanceId,
        }),
      )

      // removeInstance 事件
      listener.mockClear()
      registry.removeInstance(config!.instanceId)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'instanceRemoved',
          widgetId: 'sub_test_widget',
          instanceId: config!.instanceId,
        }),
      )

      // 取消订阅后不再接收
      listener.mockClear()
      unsubscribe()
      registry.register(createMockTemplate('after_unsub'))
      expect(listener).not.toHaveBeenCalled()
    })

    it('多个 listener 应独立接收事件', () => {
      const l1 = vi.fn()
      const l2 = vi.fn()
      const unsub1 = registry.subscribe(l1)
      const unsub2 = registry.subscribe(l2)

      registry.register(createMockTemplate('multi_listener_test'))
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)

      // 取消 l1 后，l2 仍应接收
      unsub1()
      l1.mockClear()
      l2.mockClear()
      registry.register(createMockTemplate('multi_listener_test2'))
      expect(l1).not.toHaveBeenCalled()
      expect(l2).toHaveBeenCalledTimes(1)

      unsub2()
    })
  })
})
