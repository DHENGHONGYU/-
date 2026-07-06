/**
 * defaultWidgetBuilder 单元测试
 *
 * 覆盖场景：
 * 1. buildDefaultMeta - WidgetMeta 结构、不同 widgetId、空字符串边界
 * 2. buildDefaultConfig - WidgetConfig 结构、instanceId 格式、默认值、唯一性
 * 3. buildDefaultRuntimeState - idle 状态
 * 4. buildFallbackRuntimeState - error 状态
 * 5. defaultWidgetBuilder 单例
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  DefaultWidgetBuilder,
  defaultWidgetBuilder,
} from '@/cockpit/defaultWidgetBuilder'
import type {
  WidgetConfig,
  WidgetMeta,
  WidgetRuntimeState,
} from '@/types/modules/widget.types'

describe('DefaultWidgetBuilder', () => {
  let builder: DefaultWidgetBuilder

  beforeEach(() => {
    builder = new DefaultWidgetBuilder()
  })

  // ============================================================
  // buildDefaultMeta
  // ============================================================

  describe('buildDefaultMeta', () => {
    it('返回完整的 WidgetMeta 结构（含 id/name/category/description/defaultSize）', () => {
      const meta: WidgetMeta = builder.buildDefaultMeta('marketIndices')

      expect(meta.id).toBe('marketIndices')
      expect(meta.name).toBe('Widget marketIndices')
      expect(meta.category).toBe('default')
      expect(meta.description).toBe('默认 Widget 元数据')
      expect(meta.defaultSize).toEqual({ cols: 2, rows: 2 })
    })

    it('不同 widgetId 生成对应 id 和 name', () => {
      const meta1 = builder.buildDefaultMeta('widgetA')
      const meta2 = builder.buildDefaultMeta('widgetB')

      expect(meta1.id).toBe('widgetA')
      expect(meta1.name).toBe('Widget widgetA')
      expect(meta2.id).toBe('widgetB')
      expect(meta2.name).toBe('Widget widgetB')
    })

    it('空字符串 widgetId 也能生成合法 meta（边界情况）', () => {
      const meta = builder.buildDefaultMeta('')

      expect(meta.id).toBe('')
      expect(meta.name).toBe('Widget ')
      expect(meta.category).toBe('default')
      expect(meta.defaultSize).toEqual({ cols: 2, rows: 2 })
    })
  })

  // ============================================================
  // buildDefaultConfig
  // ============================================================

  describe('buildDefaultConfig', () => {
    it('返回完整的 WidgetConfig 结构（含所有必填字段）', () => {
      const config: WidgetConfig = builder.buildDefaultConfig('marketIndices')

      expect(config.widgetId).toBe('marketIndices')
      // instanceId 格式为 ${widgetId}_${timestamp}
      expect(config.instanceId).toMatch(/^marketIndices_\d+$/)
      expect(config.size).toEqual({ cols: 2, rows: 2 })
      expect(config.title).toBe('Widget marketIndices')
      expect(config.settings).toEqual({})
      expect(config.visible).toBe(true)
      expect(config.collapsed).toBe(false)
    })

    it('instanceId 的 timestamp 部分与调用时刻的 Date.now() 一致', () => {
      const before = Date.now()
      const config = builder.buildDefaultConfig('testWidget')
      const after = Date.now()

      const timestampStr = config.instanceId.split('testWidget_')[1]
      expect(timestampStr).toBeDefined()
      const timestamp = Number(timestampStr)
      expect(Number.isFinite(timestamp)).toBe(true)
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('默认配置 visible=true, collapsed=false, settings={}', () => {
      const config = builder.buildDefaultConfig('defaults')

      expect(config.visible).toBe(true)
      expect(config.collapsed).toBe(false)
      expect(config.settings).toEqual({})
      expect(Object.keys(config.settings)).toHaveLength(0)
    })

    it('不同 widgetId 生成不同的 instanceId', () => {
      const config1 = builder.buildDefaultConfig('widgetA')
      const config2 = builder.buildDefaultConfig('widgetB')

      expect(config1.instanceId).not.toBe(config2.instanceId)
      expect(config1.widgetId).toBe('widgetA')
      expect(config2.widgetId).toBe('widgetB')
    })
  })

  // ============================================================
  // buildDefaultRuntimeState
  // ============================================================

  describe('buildDefaultRuntimeState', () => {
    it('返回 idle 状态的 WidgetRuntimeState（无 error/lastRefresh）', () => {
      const state: WidgetRuntimeState = builder.buildDefaultRuntimeState(
        'inst_001',
        'marketIndices',
      )

      expect(state.instanceId).toBe('inst_001')
      expect(state.widgetId).toBe('marketIndices')
      expect(state.status).toBe('idle')
      expect(state.error).toBeUndefined()
      expect(state.lastRefresh).toBeUndefined()
    })
  })

  // ============================================================
  // buildFallbackRuntimeState
  // ============================================================

  describe('buildFallbackRuntimeState', () => {
    it('返回 error 状态并携带错误信息', () => {
      const state: WidgetRuntimeState = builder.buildFallbackRuntimeState(
        'inst_002',
        'fundFlow',
        '网络异常',
      )

      expect(state.instanceId).toBe('inst_002')
      expect(state.widgetId).toBe('fundFlow')
      expect(state.status).toBe('error')
      expect(state.error).toBe('网络异常')
    })
  })

  // ============================================================
  // defaultWidgetBuilder 单例
  // ============================================================

  describe('defaultWidgetBuilder 单例', () => {
    it('defaultWidgetBuilder 是 DefaultWidgetBuilder 的实例', () => {
      expect(defaultWidgetBuilder).toBeInstanceOf(DefaultWidgetBuilder)
    })
  })
})
