/**
 * 组件注册表共享类型定义
 *
 * 从 componentRegistry.ts 拆分，供所有层级注册表子模块共用。
 * @doc [V9-DOC-FRONT-046]
 */

/** 原子层级 */
export type AtomicLevel = 'atom' | 'molecule' | 'organism' | 'template'

export interface ComponentEntry {
  name: string
  level: AtomicLevel
  sourcePath: string
  targetPath: string
  status: 'active' | 'migrating' | 'deprecated' | 'wip'
  description: string
  /** 消费方承诺：至少声明一个业务消费方（页面/上层组件/功能模块） */
  consumers: string[]
  /** 废弃元数据（status === 'deprecated' 或 'wip' 时必填） */
  deprecationMeta?: {
    supersededBy?: string
    deprecatedSince?: string
    removalTarget?: string
    reason?: string
  }
}

/**
 * registerComponent 工厂函数：强制注入 name / level / sourcePath 三要素。
 * 避免手写字面量漏填字段，统一入口。
 */
export function registerComponent(
  name: string,
  level: AtomicLevel,
  sourcePath: string,
  options: {
    targetPath?: string
    status?: ComponentEntry['status']
    description: string
    consumers: string[]
    deprecationMeta?: ComponentEntry['deprecationMeta']
  },
): ComponentEntry {
  return {
    name,
    level,
    sourcePath,
    targetPath: options.targetPath ?? sourcePath,
    status: options.status ?? 'active',
    description: options.description,
    consumers: options.consumers,
    ...(options.deprecationMeta ? { deprecationMeta: options.deprecationMeta } : {}),
  }
}
