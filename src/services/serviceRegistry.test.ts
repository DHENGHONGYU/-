/**
 * @test_id V9-TEST-SERVICE-REGISTRY-001
 * @covers_code [src/services/serviceRegistry.ts, src/services/storage/DataCleanupService.ts, src/services/storage/DeduplicationService.ts, src/services/validation/ParseAccuracyService.ts, src/services/quality/QualityMetricsService.ts]
 * @covers_docs []
 *
 * Service 注册表契约单测：
 *
 * 目的：覆盖 2026-08-13 注册表反向修复新增的 4 个 Service 注册条目
 *      （DataCleanupService / DeduplicationService / ParseAccuracyService /
 *       QualityMetricsService）的注册逻辑，保证：
 *   1. 新增条目 id / filePath / status 与预期完全一致
 *   2. 新增条目 filePath 指向的磁盘文件真实存在（正向完整性）
 *   3. 新增条目 id 与文件名 basename 对应
 *   4. 新增条目未引入 id / filePath 重复
 *   5. 全注册表 filePath 与 id 唯一（回归防护）
 *   6. 全注册表 active 条目 filePath 均指向存在的文件（整体正向完整性）
 *   7. 新增服务模块均可通过 '@/' 别名动态导入（间接加载契约）
 *   8-10. 三个已实现服务的模块导出公开 API（证明注册指向真实可用模块）
 *   11. QualityMetricsService（wip 在制品）导出桩 API 并返回空数据
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { SERVICE_REGISTRY, type ServiceRegistryEntry } from './serviceRegistry'

/** 项目根目录（d:\FinSightV9） */
const PROJECT_ROOT = dirname(dirname(__dirname)) // src/services -> src -> 项目根

/** 2026-08-13 反向修复新增的 4 个 Service 注册条目（QualityMetricsService 为 wip 在制品） */
const NEW_ENTRIES: ReadonlyArray<ServiceRegistryEntry> = [
  { id: 'DataCleanupService', filePath: 'src/services/storage/DataCleanupService', status: 'active' },
  { id: 'DeduplicationService', filePath: 'src/services/storage/DeduplicationService', status: 'active' },
  { id: 'ParseAccuracyService', filePath: 'src/services/validation/ParseAccuracyService', status: 'active' },
  { id: 'QualityMetricsService', filePath: 'src/services/quality/QualityMetricsService', status: 'wip' },
]

/** 按 id 查找注册条目 */
function findById(entry: ServiceRegistryEntry): ServiceRegistryEntry | undefined {
  return SERVICE_REGISTRY.find((e) => e.id === entry.id)
}

/** 解析 filePath 对应的磁盘绝对路径（补 .ts 扩展名） */
function resolveSourcePath(filePath: string): string {
  return join(PROJECT_ROOT, `${filePath}.ts`)
}

/** '@/' 别名动态导入路径（剥离 filePath 中已有的 src/ 前缀，因 @ 已指向 ./src） */
function aliasImportPath(filePath: string): string {
  return `@/${filePath.replace(/^src\//, '')}`
}

describe('Service 注册表契约：新增 4 个注册条目（2026-08-13 反向修复）', () => {
  it('1. 4 个新增条目均已登记，且 id/filePath/status 与预期一致', () => {
    for (const entry of NEW_ENTRIES) {
      const actual = findById(entry)
      expect(actual, `${entry.id} 未在 SERVICE_REGISTRY 中登记`).toBeDefined()
      expect(actual?.filePath).toBe(entry.filePath)
      expect(actual?.status).toBe(entry.status)
    }
  })

  it('2. 新增条目 filePath 指向的磁盘文件均存在（正向完整性）', () => {
    for (const entry of NEW_ENTRIES) {
      expect(
        existsSync(resolveSourcePath(entry.filePath)),
        `${entry.id} 的注册目标文件不存在: ${entry.filePath}.ts`,
      ).toBe(true)
    }
  })

  it('3. 新增条目 id 与文件名 basename 一致（id ↔ 文件名映射约定）', () => {
    for (const entry of NEW_ENTRIES) {
      expect(basename(entry.filePath), `${entry.id} 的 id 与文件名不一致`).toBe(entry.id)
    }
  })

  it('4. 新增条目未引入 id / filePath 重复', () => {
    const ids = SERVICE_REGISTRY.map((e) => e.id)
    const paths = SERVICE_REGISTRY.map((e) => e.filePath)
    for (const entry of NEW_ENTRIES) {
      // id 恰好出现 1 次（唯一）
      expect(ids.filter((id) => id === entry.id).length, `${entry.id} 的 id 在注册表中重复`).toBe(1)
      // filePath 恰好出现 1 次（唯一）
      expect(
        paths.filter((p) => p === entry.filePath).length,
        `${entry.id} 的 filePath 在注册表中重复: ${entry.filePath}`,
      ).toBe(1)
    }
  })
})

describe('Service 注册表契约：整体一致性（回归防护）', () => {
  it('5. 全注册表 filePath 与 id 均唯一', () => {
    const filePaths = SERVICE_REGISTRY.map((e) => e.filePath)
    const ids = SERVICE_REGISTRY.map((e) => e.id)
    const dupPaths = filePaths.filter((p, i) => filePaths.indexOf(p) !== i)
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupPaths, `存在重复 filePath: ${[...new Set(dupPaths)].join(', ')}`).toEqual([])
    expect(dupIds, `存在重复 id: ${[...new Set(dupIds)].join(', ')}`).toEqual([])
  })

  it('6. 全注册表 active 条目 filePath 均指向存在的文件（整体正向完整性）', () => {
    const missing = SERVICE_REGISTRY.filter((e) => e.status === 'active')
      .filter((e) => !existsSync(resolveSourcePath(e.filePath)))
      .map((e) => `${e.id} -> ${e.filePath}.ts`)
    expect(missing, `以下注册条目的目标文件缺失:\n${missing.join('\n')}`).toEqual([])
  })
})

describe('Service 注册表契约：新增模块可解析性与 API 面', () => {
  it('7. 4 个新增服务模块均可通过 @/ 别名动态导入（间接加载契约）', async () => {
    for (const entry of NEW_ENTRIES) {
      await expect(import(aliasImportPath(entry.filePath))).resolves.toBeDefined()
    }
  })

  it('8. DataCleanupService 导出公开 API（保留策略 / 清理 / 存储估算）', async () => {
    const mod = (await import('@/services/storage/DataCleanupService')) as Record<string, unknown>
    for (const fn of ['getRetentionPolicy', 'findExpiredRecords', 'cleanupExpiredRecords', 'getStorageEstimate', 'getCleanupStats']) {
      expect(typeof mod[fn], `DataCleanupService 缺少导出: ${fn}`).toBe('function')
    }
  })

  it('9. DeduplicationService 导出公开 API（查重 / 去重 / 统计）', async () => {
    const mod = (await import('@/services/storage/DeduplicationService')) as Record<string, unknown>
    for (const fn of ['isDuplicate', 'dedupRecords', 'getDedupStats', 'resetDedupStats']) {
      expect(typeof mod[fn], `DeduplicationService 缺少导出: ${fn}`).toBe('function')
    }
  })

  it('10. ParseAccuracyService 导出公开 API（解析统计 / 成功率 / 报告）', async () => {
    const mod = (await import('@/services/validation/ParseAccuracyService')) as Record<string, unknown>
    for (const fn of ['recordParse', 'getParseStats', 'getParseSuccessRate', 'getHighNullRecords', 'getParseStatsBySource', 'resetParseStats', 'generateParseReport']) {
      expect(typeof mod[fn], `ParseAccuracyService 缺少导出: ${fn}`).toBe('function')
    }
  })

  it('11. QualityMetricsService（wip）导出桩 API（指标函数与空数据返回值）', async () => {
    const mod = (await import('@/services/quality/QualityMetricsService')) as Record<string, unknown>
    // 桩函数导出
    for (const fn of ['getQualityMetrics', 'getRecentRecords']) {
      expect(typeof mod[fn], `QualityMetricsService 缺少导出: ${fn}`).toBe('function')
    }
    // 桩返回值验证
    const metrics = (mod.getQualityMetrics as () => { writeTotal: number })()
    expect(metrics.writeTotal).toBe(0)
    expect(metrics.writeSuccess).toBe(0)
    expect(metrics.writeFailure).toBe(0)
    const records = (mod.getRecentRecords as () => unknown[])()
    expect(records).toEqual([])
  })
})
