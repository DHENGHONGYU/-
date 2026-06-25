import { getLogger } from '@/lib/logger'
import type { WidgetMeta, WidgetConfig, WidgetRuntimeState } from '@/types/modules/widget.types'

const logger = getLogger()

type RegistryListener = (event: { type: string; widgetId?: string; instanceId?: string }) => void

export interface WidgetTemplate {
  meta: WidgetMeta
  component: () => Promise<{ default: React.ComponentType<{ config: WidgetConfig; data?: unknown }> }>
  configPanel?: () => Promise<{ default: React.ComponentType }>
}

export class WidgetRegistry {
  private templates = new Map<string, WidgetTemplate>()
  private instances = new Map<string, WidgetConfig>()
  private runtimeStates = new Map<string, WidgetRuntimeState>()
  private listeners = new Set<RegistryListener>()
  private instanceCounter = 0

  constructor() {
    logger.info('[WidgetRegistry] Initializing...')
  }

  register(template: WidgetTemplate): boolean {
    const { id } = template.meta
    logger.debug(`[WidgetRegistry] register() called: widgetId="${id}"`)

    if (this.templates.has(id)) {
      logger.warn(`[WidgetRegistry] Widget "${id}" already registered, overwriting`)
    }

    this.templates.set(id, template)
    logger.info(`[WidgetRegistry] Widget registered: id="${id}", name="${template.meta.name}", category="${template.meta.category}"`)
    this._emit({ type: 'registered', widgetId: id })
    return true
  }

  createInstance(widgetId: string, overrides?: Partial<Omit<WidgetConfig, 'instanceId' | 'widgetId'>>): WidgetConfig | null {
    logger.debug(`[WidgetRegistry] createInstance() called: widgetId="${widgetId}"`)

    const template = this.templates.get(widgetId)
    if (!template) {
      logger.error(`[WidgetRegistry] createInstance failed: Widget "${widgetId}" not found`)
      return null
    }

    this.instanceCounter++
    const instanceId = `${widgetId}_${this.instanceCounter}`
    const config: WidgetConfig = {
      instanceId,
      widgetId,
      size: overrides?.size ?? template.meta.defaultSize,
      position: overrides?.position,
      title: overrides?.title ?? template.meta.name,
      settings: { ...template.meta.defaultConfig, ...overrides?.settings },
      visible: overrides?.visible ?? true,
      collapsed: overrides?.collapsed ?? false,
    }

    this.instances.set(instanceId, config)
    this.runtimeStates.set(instanceId, { instanceId, widgetId, status: 'idle' })

    logger.info(`[WidgetRegistry] Instance created: instanceId="${instanceId}", widgetId="${widgetId}", size=${config.size.cols}x${config.size.rows}`)
    this._emit({ type: 'instanceAdded', widgetId, instanceId })
    return config
  }

  removeInstance(instanceId: string): boolean {
    logger.debug(`[WidgetRegistry] removeInstance() called: instanceId="${instanceId}"`)

    const config = this.instances.get(instanceId)
    if (!config) {
      logger.warn(`[WidgetRegistry] removeInstance failed: Instance "${instanceId}" not found`)
      return false
    }

    const widgetId = config.widgetId
    this.instances.delete(instanceId)
    this.runtimeStates.delete(instanceId)

    logger.info(`[WidgetRegistry] Instance removed: instanceId="${instanceId}", widgetId="${widgetId}"`)
    this._emit({ type: 'instanceRemoved', widgetId, instanceId })
    return true
  }

  getTemplate(widgetId: string): WidgetTemplate | undefined {
    const template = this.templates.get(widgetId)
    if (!template) {
      logger.debug(`[WidgetRegistry] getTemplate() not found: widgetId="${widgetId}"`)
    } else {
      logger.debug(`[WidgetRegistry] getTemplate() found: widgetId="${widgetId}"`)
    }
    return template
  }

  getInstance(instanceId: string): WidgetConfig | undefined {
    const config = this.instances.get(instanceId)
    if (!config) {
      logger.debug(`[WidgetRegistry] getInstance() not found: instanceId="${instanceId}"`)
    } else {
      logger.debug(`[WidgetRegistry] getInstance() found: instanceId="${instanceId}", widgetId="${config.widgetId}"`)
    }
    return config
  }

  getAllInstances(): WidgetConfig[] {
    const instances = Array.from(this.instances.values())
    logger.debug(`[WidgetRegistry] getAllInstances(): count=${instances.length}`)
    return instances
  }

  updateRuntimeState(instanceId: string, state: Partial<WidgetRuntimeState>): boolean {
    logger.debug(`[WidgetRegistry] updateRuntimeState() called: instanceId="${instanceId}", state=${JSON.stringify(state)}`)

    const existing = this.runtimeStates.get(instanceId)
    if (!existing) {
      logger.warn(`[WidgetRegistry] updateRuntimeState failed: Instance "${instanceId}" not found`)
      return false
    }

    const newState = { ...existing, ...state, instanceId, widgetId: existing.widgetId }
    this.runtimeStates.set(instanceId, newState)

    if (state.status) {
      logger.info(`[WidgetRegistry] Runtime state updated: instanceId="${instanceId}", status="${state.status}"`)
    }

    return true
  }

  getRuntimeState(instanceId: string): WidgetRuntimeState | undefined {
    const state = this.runtimeStates.get(instanceId)
    if (!state) {
      logger.debug(`[WidgetRegistry] getRuntimeState() not found: instanceId="${instanceId}"`)
    } else {
      logger.debug(`[WidgetRegistry] getRuntimeState() found: instanceId="${instanceId}", status="${state.status}"`)
    }
    return state
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener)
    logger.debug(`[WidgetRegistry] Listener added, total=${this.listeners.size}`)

    return () => {
      this.listeners.delete(listener)
      logger.debug(`[WidgetRegistry] Listener removed, total=${this.listeners.size}`)
    }
  }

  private _emit(event: { type: string; widgetId?: string; instanceId?: string }): void {
    logger.debug(`[WidgetRegistry] _emit(): type="${event.type}", widgetId="${event.widgetId}", instanceId="${event.instanceId}"`)
    this.listeners.forEach((listener) => {
      try { listener(event) } catch (err) { logger.error('[WidgetRegistry] Listener error', { error: err }) }
    })
  }

  getStats() {
    const stats = {
      templates: this.templates.size,
      instances: this.instances.size,
      states: Array.from(this.runtimeStates.entries()).map(([id, s]) => ({ instanceId: id, status: s.status })),
    }
    logger.debug(`[WidgetRegistry] getStats(): ${JSON.stringify(stats)}`)
    return stats
  }
}

export const widgetRegistry = new WidgetRegistry()