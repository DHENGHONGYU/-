/**
 * @module ArchitectureService
 * @description 系统架构元数据服务，为架构可视化提供分层节点、层间连接关系与 V6 引擎层状态。
 *
 * 职责：
 * - 将 `SYSTEM_ARCHITECTURE_LAYERS` 映射为带实时状态的 `ArchitectureNode[]`
 * - 声明分层依赖方向（config→core→data→services→agents→store→pages→components，含 services→data 反馈）
 * - 将 `V6_ENGINE_LAYERS` 映射为 `EngineLayerNode[]`
 * - 从 AgentRegistry 读取已注册 Agent，映射为可视化节点
 *
 * 变更记录：
 * - v1.0.0 (2026-07-02): 初始版本
 */

import { SYSTEM_ARCHITECTURE_LAYERS, V6_ENGINE_LAYERS } from '@/constants/health.constants'
import { getLogger } from '@/lib/logger'
import { getAgentSystemStatus } from '@/agents'
import { useEngineStore } from '@/store/engineStore'
import { getAgentRegistry } from '@/agents/agentRegistry'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 架构分层节点 */
export interface ArchitectureNode {
  id: string
  name: string
  description: string
  modules: string[]
  color: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  moduleCount: number
}

/** 分层间连接关系 */
export interface ArchitectureConnection {
  from: string
  to: string
  label: string
}

/** V6 引擎层节点 */
export interface EngineLayerNode {
  id: string
  name: string
  deterministic: boolean
  llmEnhanceable: boolean
  weight: number
  status: 'active' | 'idle' | 'error'
}

/** Agent 可视化节点 */
export interface AgentNode {
  id: string
  name: string
  status: string
  type: string
}

/** 架构快照（一次性聚合所有可视化数据） */
export interface ArchitectureSnapshot {
  layers: ArchitectureNode[]
  connections: ArchitectureConnection[]
  engineLayers: EngineLayerNode[]
  agentNodes: AgentNode[]
  timestamp: number
}

// ============================================================
// 服务实现
// ============================================================

export class ArchitectureService {
  /**
   * 解析单个分层的实时运行状态。
   *
   * - services / agents 层：依据 `useEngineStore.started` 判断
   * - agents 层：叠加 Agent 系统初始化状态与注册表统计
   * - 其余分层为静态基础设施，恒为 healthy
   */
  private resolveLayerStatus(layerId: string): ArchitectureNode['status'] {
    const engineStarted = useEngineStore.getState().started

    if (layerId === 'services') {
      return engineStarted ? 'healthy' : 'warning'
    }

    if (layerId === 'agents') {
      const agentSystemStatus = getAgentSystemStatus()
      const registryStats = getAgentRegistry().getStats()

      if (!agentSystemStatus.initialized) {
        return 'warning'
      }
      if (registryStats.total === 0) {
        return 'warning'
      }
      return engineStarted ? 'healthy' : 'warning'
    }

    // config / core / data / store / pages / components 为静态基础设施
    return 'healthy'
  }

  /**
   * 构建分层节点列表（映射 SYSTEM_ARCHITECTURE_LAYERS 并注入实时状态）
   */
  private buildLayers(): ArchitectureNode[] {
    return SYSTEM_ARCHITECTURE_LAYERS.map((layer) => ({
      id: layer.id,
      name: layer.name,
      description: layer.description,
      // `as const` 产生 readonly 元组，需展开为可变 string[]
      modules: [...layer.modules],
      color: layer.color,
      status: this.resolveLayerStatus(layer.id),
      moduleCount: layer.modules.length,
    }))
  }

  /**
   * 构建分层间连接关系。
   *
   * 主链：config → core → data → services → agents → store → pages → components
   * 反馈：services → data（服务层通过 DataBridge 回写数据）
   */
  private buildConnections(): ArchitectureConnection[] {
    return [
      { from: 'config', to: 'core', label: '注入配置' },
      { from: 'core', to: 'data', label: '数据桥接路由' },
      { from: 'data', to: 'services', label: '数据读写' },
      { from: 'services', to: 'agents', label: '任务派发' },
      { from: 'agents', to: 'store', label: '状态广播' },
      { from: 'store', to: 'pages', label: '状态订阅' },
      { from: 'pages', to: 'components', label: '组件渲染' },
      { from: 'services', to: 'data', label: '数据回写（反馈）' },
    ]
  }

  /**
   * 构建 V6 引擎层节点列表。
   * 引擎可用时所有层标记为 active。
   */
  private buildEngineLayers(): EngineLayerNode[] {
    return V6_ENGINE_LAYERS.map((layer) => ({
      id: layer.id,
      name: layer.name,
      deterministic: layer.deterministic,
      llmEnhanceable: layer.llmEnhanceable,
      weight: layer.weight,
      status: 'active',
    }))
  }

  /**
   * 构建已注册 Agent 的可视化节点列表。
   *
   * 状态优先取自健康监控报告，无报告时依据 Agent 系统初始化状态回退为 active/idle；
   * 类型由注册标签推导（system / default / 自定义标签）。
   */
  private buildAgentNodes(): AgentNode[] {
    const registry = getAgentRegistry()
    const agentSystemStatus = getAgentSystemStatus()

    // 建立 agentId → 健康状态 的索引，避免 O(n*m) 查找
    const healthMap = new Map<string, string>()
    for (const report of agentSystemStatus.healthReports) {
      healthMap.set(report.agentId, report.status)
    }

    return registry.getAll().map((entry) => {
      const type = entry.tags.includes('system')
        ? 'system'
        : entry.tags.includes('default')
          ? 'default'
          : (entry.tags[0] ?? 'custom')

      return {
        id: entry.config.id,
        name: entry.config.name,
        status:
          healthMap.get(entry.config.id) ??
          (agentSystemStatus.initialized ? 'active' : 'idle'),
        type,
      }
    })
  }

  /**
   * 构建完整的架构快照。
   *
   * 聚合分层节点、连接关系、引擎层节点与 Agent 节点，
   * 任何异常均被捕获并返回空快照，保证可视化调用方不致崩溃。
   */
  getArchitectureSnapshot(): ArchitectureSnapshot {
    try {
      const layers = this.buildLayers()
      const connections = this.buildConnections()
      const engineLayers = this.buildEngineLayers()
      const agentNodes = this.buildAgentNodes()

      const snapshot: ArchitectureSnapshot = {
        layers,
        connections,
        engineLayers,
        agentNodes,
        timestamp: Date.now(),
      }

      logger.info('[ArchitectureService] getArchitectureSnapshot() completed', {
        layerCount: layers.length,
        connectionCount: connections.length,
        engineLayerCount: engineLayers.length,
        agentCount: agentNodes.length,
      })

      return snapshot
    } catch (err) {
      logger.error('[ArchitectureService] getArchitectureSnapshot() failed', { error: err })
      return {
        layers: [],
        connections: [],
        engineLayers: [],
        agentNodes: [],
        timestamp: Date.now(),
      }
    }
  }

  /**
   * 获取指定分层的实时状态节点。
   *
   * @param layerId 分层标识（如 'config' / 'services' / 'agents'）
   * @returns 命中返回 `ArchitectureNode`，未命中返回 `null`
   */
  getLayerStatus(layerId: string): ArchitectureNode | null {
    try {
      const layers = this.buildLayers()
      const layer = layers.find((l) => l.id === layerId)

      if (!layer) {
        logger.warn('[ArchitectureService] getLayerStatus() layer not found', { layerId })
        return null
      }

      logger.info('[ArchitectureService] getLayerStatus() resolved', {
        layerId,
        status: layer.status,
        moduleCount: layer.moduleCount,
      })

      return layer
    } catch (err) {
      logger.error('[ArchitectureService] getLayerStatus() failed', { layerId, error: err })
      return null
    }
  }
}

// ============================================================
// 单例导出
// ============================================================

let architectureServiceInstance: ArchitectureService | null = null

/**
 * 获取 ArchitectureService 单例。
 */
export function getArchitectureService(): ArchitectureService {
  architectureServiceInstance ??= new ArchitectureService()
  return architectureServiceInstance
}
