import React from 'react'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { widgetRegistry } from './widgetRegistry'
import { defaultWidgetBuilder } from '../defaultWidgetBuilder'
import type { MarketData } from '@/types/modules/widget.types'

const logger = getLogger()

const componentCache = new Map<string, React.ComponentType<{ config: unknown; data?: MarketData }>>()

/**
 * WidgetEngine
 */
export class WidgetEngine {
  constructor() {
    logger.info('[WidgetEngine] Initializing...')
  }

  async loadComponent(widgetId: string): Promise<React.ComponentType<{ config: unknown; data?: MarketData }> | null> {
    const startTs = Date.now()
    logger.debug(`[WidgetEngine] loadComponent() called: widgetId="${widgetId}"`)

    const cached = componentCache.get(widgetId)
    if (cached) {
      logger.debug(`[WidgetEngine] loadComponent() cache hit: widgetId="${widgetId}"`)
      return cached
    }

    const template = widgetRegistry.getTemplate(widgetId)
    if (!template) {
      logger.error(`[WidgetEngine] loadComponent failed: Template "${widgetId}" not found`)
      eventBus.emit('WIDGET_LOAD_ERROR', { widgetId, error: 'Template not found' })
      return null
    }

    try {
      logger.debug(`[WidgetEngine] Loading component module: widgetId="${widgetId}"`)
      const module = await template.component()
      const component = module.default as React.ComponentType<{ config: unknown; data?: MarketData }>

      if (!component) {
        throw new Error(`Widget "${widgetId}" component is empty`)
      }

      // P0-2 全局防御：包裹所有 widget 组件，防止 props 为 null 时解构崩溃
      const SafeWrapper = (props: { config: unknown; data?: MarketData }): React.JSX.Element | null => {
        if (!props?.config) {
          logger.warn(`[WidgetEngine] Widget "${widgetId}" received null props, rendering fallback`)
          return null
        }
        return React.createElement(component, props)
      }
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      SafeWrapper.displayName = `Safe(${component.displayName || component.name || 'Widget'})`

      componentCache.set(widgetId, SafeWrapper)
      const duration = Date.now() - startTs

      logger.info(`[WidgetEngine] Component loaded: widgetId="${widgetId}", duration=${duration}ms`)
      eventBus.emit('WIDGET_LOAD_SUCCESS', { widgetId })
      return SafeWrapper
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error(`[WidgetEngine] Failed to load component: widgetId="${widgetId}", error="${errorMsg}"`)
      eventBus.emit('WIDGET_LOAD_ERROR', { widgetId, error: errorMsg })
      throw err
    }
  }

  async mountInstance(instanceId: string): Promise<boolean> {
    const startTs = Date.now()
    logger.debug(`[WidgetEngine] mountInstance() called: instanceId="${instanceId}"`)

    const config = widgetRegistry.getInstance(instanceId)
    if (!config) {
      logger.error(`[WidgetEngine] mountInstance failed: Instance "${instanceId}" not found`)
      return false
    }

    logger.info(`[WidgetEngine] Mounting instance: instanceId="${instanceId}", widgetId="${config.widgetId}"`)
    widgetRegistry.updateRuntimeState(instanceId, { status: 'loading' })
    eventBus.emit('WIDGET_MOUNT_START', { instanceId, widgetId: config.widgetId })

    try {
      await this.loadComponent(config.widgetId)
      widgetRegistry.updateRuntimeState(instanceId, { status: 'ready', lastRefresh: Date.now() })

      const duration = Date.now() - startTs
      logger.info(`[WidgetEngine] Instance mounted: instanceId="${instanceId}", duration=${duration}ms`)
      eventBus.emit('WIDGET_MOUNT_SUCCESS', { instanceId, widgetId: config.widgetId })
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const fallbackState = defaultWidgetBuilder.buildFallbackRuntimeState(instanceId, config.widgetId, errorMsg)
      widgetRegistry.updateRuntimeState(instanceId, fallbackState)

      logger.error(`[WidgetEngine] Failed to mount instance: instanceId="${instanceId}", error="${errorMsg}"`)
      eventBus.emit('WIDGET_MOUNT_ERROR', { instanceId, widgetId: config.widgetId, error: errorMsg })
      return false
    }
  }

  unmountInstance(instanceId: string): void {
    logger.debug(`[WidgetEngine] unmountInstance() called: instanceId="${instanceId}"`)

    const config = widgetRegistry.getInstance(instanceId)
    widgetRegistry.updateRuntimeState(instanceId, { status: 'idle' })

    logger.info(`[WidgetEngine] Instance unmounted: instanceId="${instanceId}", widgetId="${config?.widgetId}"`)
    eventBus.emit('WIDGET_UNMOUNT', { instanceId, widgetId: config?.widgetId })
  }

  async refreshInstance(instanceId: string): Promise<boolean> {
    const startTs = Date.now()
    logger.debug(`[WidgetEngine] refreshInstance() called: instanceId="${instanceId}"`)

    const config = widgetRegistry.getInstance(instanceId)
    if (!config) {
      logger.error(`[WidgetEngine] refreshInstance failed: Instance "${instanceId}" not found`)
      return false
    }

    logger.info(`[WidgetEngine] Refreshing instance: instanceId="${instanceId}", widgetId="${config.widgetId}"`)
    widgetRegistry.updateRuntimeState(instanceId, { status: 'loading' })
    eventBus.emit('WIDGET_REFRESH_START', { instanceId, widgetId: config.widgetId })

    try {
      await this.loadComponent(config.widgetId)
      widgetRegistry.updateRuntimeState(instanceId, { status: 'ready', lastRefresh: Date.now() })

      const duration = Date.now() - startTs
      logger.info(`[WidgetEngine] Instance refreshed: instanceId="${instanceId}", duration=${duration}ms`)
      eventBus.emit('WIDGET_REFRESH_SUCCESS', { instanceId, widgetId: config.widgetId })
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      widgetRegistry.updateRuntimeState(instanceId, { status: 'error', error: errorMsg })

      logger.error(`[WidgetEngine] Failed to refresh instance: instanceId="${instanceId}", error="${errorMsg}"`)
      eventBus.emit('WIDGET_REFRESH_ERROR', { instanceId, widgetId: config.widgetId, error: errorMsg })
      return false
    }
  }

  preloadComponent(widgetId: string): void {
    if (componentCache.has(widgetId)) {
      logger.debug(`[WidgetEngine] preloadComponent() skipped: widgetId="${widgetId}" already cached`)
      return
    }

    logger.debug(`[WidgetEngine] Preloading component: widgetId="${widgetId}"`)
    this.loadComponent(widgetId).catch((err) => {
      logger.warn(`[WidgetEngine] Preload failed: widgetId="${widgetId}"`, { error: err })
    })
  }

  clearCache(widgetId?: string): void {
    if (widgetId) {
      const existed = componentCache.has(widgetId)
      componentCache.delete(widgetId)
      logger.info(`[WidgetEngine] Cache cleared for: widgetId="${widgetId}", existed=${existed}`)
    } else {
      const prevSize = componentCache.size
      componentCache.clear()
      logger.info(`[WidgetEngine] All cache cleared: ${prevSize} components`)
    }
  }

  getStats() {
    const stats = {
      cachedComponents: componentCache.size,
    }
    logger.debug(`[WidgetEngine] getStats(): ${JSON.stringify(stats)}`)
    return stats
  }
}

/**
 * widgetEngine
 */
export const widgetEngine = new WidgetEngine()