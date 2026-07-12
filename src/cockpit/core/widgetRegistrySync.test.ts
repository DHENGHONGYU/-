import { describe, it, expect } from 'vitest'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { DEFAULT_WIDGET_CONFIG, WIDGET_DEFAULT_DATA_SOURCE } from '@/constants/cockpit.constants'

/**
 * Widget 注册三处同步集成测试
 *
 * 覆盖场景：
 * 1. widgetRegistry 中已创建的每个 widget 实例必须在 DEFAULT_WIDGET_CONFIG 中存在配置
 * 2. widgetRegistry 中已创建的每个 widget 实例必须在 WIDGET_DEFAULT_DATA_SOURCE 中存在数据源
 * 3. 配置和数据源中多出的 widgetId 允许存在（表示未启用或预占位）
 */
describe('Widget registration three-way sync', () => {
  const instanceIds = widgetRegistry.getAllInstances().map((i) => i.widgetId)
  const uniqueWidgetIds = Array.from(new Set(instanceIds))

  it('every registered widget instance has DEFAULT_WIDGET_CONFIG', () => {
    const missing = uniqueWidgetIds.filter(
      (id) => !(id in DEFAULT_WIDGET_CONFIG),
    )
    expect(missing).toEqual([])
  })

  it('every registered widget instance has WIDGET_DEFAULT_DATA_SOURCE', () => {
    const missing = uniqueWidgetIds.filter(
      (id) => !(id in WIDGET_DEFAULT_DATA_SOURCE),
    )
    expect(missing).toEqual([])
  })
})
