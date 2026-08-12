/**
 * V9 组件原子层级注册表 — 统一入口
 *
 * 本文件为拆分后的薄入口模块，仅做：
 * 1. 从 4 个层级子注册表聚合 COMPONENT_REGISTRY
 * 2. 提供查询辅助函数（groupByLevel / getNamesByLevel / findByLevel / findByName）
 * 3. re-export 共享类型与 registerComponent 工厂函数
 *
 * 子模块结构：
 *   - registry/registryTypes.ts   → 类型定义 + registerComponent 工厂
 *   - registry/atomRegistry.ts    → Atom 层（24 条）
 *   - registry/moleculeRegistry.ts → Molecule 层（22 条）
 *   - registry/organismRegistry.ts → Organism 层（70+ 条）
 *   - registry/templateRegistry.ts → Template 层（4 条）
 *
 * @doc [V9-DOC-FRONT-046]
 */

// --- Re-export 共享类型与工厂函数 ---
export { type AtomicLevel, type ComponentEntry, registerComponent } from './registry/registryTypes'

// --- Import 子注册表 ---
import { ATOM_REGISTRY } from './registry/atomRegistry'
import { MOLECULE_REGISTRY } from './registry/moleculeRegistry'
import { ORGANISM_REGISTRY } from './registry/organismRegistry'
import { TEMPLATE_REGISTRY } from './registry/templateRegistry'
import type { AtomicLevel, ComponentEntry } from './registry/registryTypes'

/**
 * 全量组件注册表（聚合 4 个层级）
 */
export const COMPONENT_REGISTRY: ComponentEntry[] = [
  ...ATOM_REGISTRY,
  ...MOLECULE_REGISTRY,
  ...ORGANISM_REGISTRY,
  ...TEMPLATE_REGISTRY,
]

// ============================================================
// 查询辅助函数
// ============================================================

/** 按层级分组 */
export function groupByLevel(registry: ComponentEntry[] = COMPONENT_REGISTRY): Record<AtomicLevel, ComponentEntry[]> {
  const initial: Record<AtomicLevel, ComponentEntry[]> = {
    atom: [],
    molecule: [],
    organism: [],
    template: [],
  }
  return registry.reduce(
    (acc, entry) => {
      acc[entry.level].push(entry)
      return acc
    },
    initial,
  )
}

/** 获取指定层级的组件名列表 */
export function getNamesByLevel(level: AtomicLevel, registry: ComponentEntry[] = COMPONENT_REGISTRY): string[] {
  return registry.filter((e) => e.level === level).map((e) => e.name)
}

/** 按名称查找组件条目 */
export function findByName(name: string, registry: ComponentEntry[] = COMPONENT_REGISTRY): ComponentEntry | undefined {
  return registry.find((e) => e.name === name)
}

/** 获取指定层级的组件条目列表 */
export function findByLevel(level: AtomicLevel, registry: ComponentEntry[] = COMPONENT_REGISTRY): ComponentEntry[] {
  return registry.filter((e) => e.level === level)
}

/** 获取所有 active 状态的组件名 */
export function getActiveNames(registry: ComponentEntry[] = COMPONENT_REGISTRY): string[] {
  return registry.filter((e) => e.status === 'active').map((e) => e.name)
}

/** 获取所有 deprecated 状态的组件 */
export function getDeprecatedEntries(registry: ComponentEntry[] = COMPONENT_REGISTRY): ComponentEntry[] {
  return registry.filter((e) => e.status === 'deprecated')
}

/** 统计信息 */
export function getComponentStats(registry: ComponentEntry[] = COMPONENT_REGISTRY): {
  total: number
  active: number
  deprecated: number
  byLevel: Record<AtomicLevel, number>
} {
  const grouped = groupByLevel(registry)
  return {
    total: registry.length,
    active: registry.filter((e) => e.status === 'active').length,
    deprecated: registry.filter((e) => e.status === 'deprecated').length,
    byLevel: {
      atom: grouped.atom.length,
      molecule: grouped.molecule.length,
      organism: grouped.organism.length,
      template: grouped.template.length,
    },
  }
}
