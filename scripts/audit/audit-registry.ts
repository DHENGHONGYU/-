#!/usr/bin/env tsx
/**
 * audit-registry.ts
 * 四层注册表一致性审计脚本 v1.1
 *
 * 检查目标：
 * 1. STORE_REGISTRY 中每个条目的 filePath 对应文件是否存在
 * 2. SERVICE_REGISTRY 中每个条目的 filePath 对应文件是否存在
 * 3. COMPONENT_REGISTRY 中每个条目的 sourcePath/targetPath 对应文件是否存在
 * 4. 反向检查：src/store/ 下所有 *Store.ts 文件是否都在 STORE_REGISTRY 中注册
 * 5. 反向检查：src/services/ 下所有 *Service.ts 文件是否都在 SERVICE_REGISTRY 中注册
 * 6. 反向检查：src/components/ 下所有业务组件文件是否都在 COMPONENT_REGISTRY 中注册
 * 7. 组件注册表质量：active 组件必须声明 consumers（warning）
 * 8. 组件注册表质量：deprecated 组件必须填写 supersededBy 和 removalTarget（warning）
 * 9. 组件注册表质量：wip 组件统计（信息输出）
 *
 * 输出：违规列表 + 汇总；退出码 0 表示通过，1 表示发现问题（warning 不影响退出码）。
 *
 * 使用示例：
 *   npm run audit:registry
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

// ============================================================
// 注册表文件路径
// ============================================================

const STORE_REGISTRY_PATH = path.join(SRC, 'store', 'storeRegistry.ts')
const SERVICE_REGISTRY_PATH = path.join(SRC, 'services', 'serviceRegistry.ts')
const COMPONENT_REGISTRY_PATH = path.join(SRC, 'components', 'componentRegistry.ts')

// ============================================================
// 类型定义
// ============================================================

interface RegistryEntry {
  id: string
  path: string       // filePath 或 importPath
  pathKey: string    // 'filePath' | 'importPath'
}

interface ComponentEntryRaw {
  name: string
  status: string
  hasConsumers: boolean
  consumersEmpty: boolean
  hasSupersededBy: boolean
  hasRemovalTarget: boolean
}

interface ComponentAuditResult {
  missingConsumers: Array<{ name: string }>      // active 组件 consumers 为空
  incompleteDeprecation: Array<{ name: string; missing: string[] }>  // deprecated 组件缺字段
  wipComponents: string[]                         // wip 组件列表
}

interface AuditResult {
  label: string
  registryExists: boolean
  totalEntries: number
  /** 正向检查：注册表条目指向的文件不存在 */
  missingFiles: Array<{ id: string; path: string; pathKey: string }>
  /** 反向检查：磁盘上的文件未在注册表中注册 */
  unregistered: string[]
  /** 组件注册表专属检查 */
  componentAudit?: ComponentAuditResult
}

// ============================================================
// 组件注册表专属：解析 status / consumers / deprecationMeta
// ============================================================

/**
 * 从组件注册表文件中解析每个条目的 status、consumers、deprecationMeta 信息。
 * 基于正则逐段匹配每个 { name: ..., ... } 对象块。
 */
function parseComponentEntries(content: string): ComponentEntryRaw[] {
  const entries: ComponentEntryRaw[] = []

  // 匹配每个组件对象块：从 { name: 到最近的 },
  // 使用非贪婪匹配，兼容多行
  const entryRegex = /\{\s*name:\s*['"]([^'"]+)['"][^}]*\}/g
  let m: RegExpExecArray | null

  while ((m = entryRegex.exec(content)) !== null) {
    const block = m[0]
    const name = m[1]

    // 解析 status
    const statusMatch = /status:\s*['"]([^'"]+)['"]/.exec(block)
    const status = statusMatch ? statusMatch[1] : 'active'

    // 解析 consumers：判断字段是否存在，以及数组是否为空
    const consumersMatch = /consumers:\s*\[([^\]]*)\]/.exec(block)
    const hasConsumers = consumersMatch !== null
    const consumersEmpty = consumersMatch ? consumersMatch[1].trim() === '' : true

    // 解析 deprecationMeta 中的 supersededBy 和 removalTarget
    const deprecationMetaMatch = /deprecationMeta:\s*\{([^}]*)\}/.exec(block)
    const hasSupersededBy = deprecationMetaMatch ? /supersededBy:/.test(deprecationMetaMatch[1]) : false
    const hasRemovalTarget = deprecationMetaMatch ? /removalTarget:/.test(deprecationMetaMatch[1]) : false

    entries.push({
      name,
      status,
      hasConsumers,
      consumersEmpty,
      hasSupersededBy,
      hasRemovalTarget,
    })
  }

  return entries
}

/**
 * 组件注册表质量审计：
 * 1. active 组件必须有非空 consumers（missing-consumers，warning）
 * 2. deprecated 组件必须有 supersededBy 和 removalTarget（incomplete-deprecation，warning）
 * 3. wip 组件统计（信息输出，不违规）
 */
function auditComponentRegistryQuality(entries: ComponentEntryRaw[]): ComponentAuditResult {
  const missingConsumers: Array<{ name: string }> = []
  const incompleteDeprecation: Array<{ name: string; missing: string[] }> = []
  const wipComponents: string[] = []

  for (const entry of entries) {
    // 1. active 组件 consumers 校验
    if (entry.status === 'active') {
      if (!entry.hasConsumers || entry.consumersEmpty) {
        missingConsumers.push({ name: entry.name })
      }
    }

    // 2. deprecated 组件完整性校验
    if (entry.status === 'deprecated') {
      const missing: string[] = []
      if (!entry.hasSupersededBy) missing.push('supersededBy')
      if (!entry.hasRemovalTarget) missing.push('removalTarget')
      if (missing.length > 0) {
        incompleteDeprecation.push({ name: entry.name, missing })
      }
    }

    // 3. wip 组件统计
    if (entry.status === 'wip') {
      wipComponents.push(entry.name)
    }
  }

  return { missingConsumers, incompleteDeprecation, wipComponents }
}

// ============================================================
// 工具函数
// ============================================================

/** 将 @/ 别名路径或 src/ 相对路径转为绝对文件路径（自动补全扩展名） */
function resolveRegistryPath(importPath: string): string {
  const cleaned = importPath.replace(/^@\//, 'src/').replace(/\\/g, '/')
  const basePath = path.join(ROOT, cleaned)

  // 精确路径存在则直接返回
  if (fs.existsSync(basePath)) return basePath

  // importPath 通常不含扩展名，尝试常见后缀
  const extensions = ['.tsx', '.ts', '.jsx', '.js']
  for (const ext of extensions) {
    const withExt = basePath + ext
    if (fs.existsSync(withExt)) return withExt
  }

  // 尝试作为目录下的 index 文件
  for (const ext of extensions) {
    const indexPath = path.join(basePath, `index${ext}`)
    if (fs.existsSync(indexPath)) return indexPath
  }

  return basePath
}

/**
 * 将注册表路径统一为 @/ 别名、去扩展名的形式，便于正反检查比对。
 * 兼容 'src/...' / '@/...' 前缀与 .tsx/.ts/.jsx/.js 扩展名。
 */
function normalizeRegistryPath(raw: string): string {
  let p = raw.trim().replace(/\\/g, '/')
  if (p.startsWith('@/')) p = 'src/' + p.slice(2)
  p = p.replace(/\.(tsx|ts|jsx|js)$/i, '')
  if (p.startsWith('src/')) p = '@/' + p.slice(4)
  return p
}

/**
 * 从 TypeScript 注册表文件中解析条目数组
 * 兼容 filePath / importPath / sourcePath / targetPath 多种路径字段，
 * 兼容 id / name 作为条目标识。
 */
function parseRegistryEntries(content: string): RegistryEntry[] {
  const entries: RegistryEntry[] = []

  // 匹配 id / name 字段（组件注册表用 name；Store/Service 注册表用 id）
  const idRegex = /(?:id|name):\s*['"]([^'"]+)['"]/g
  // 匹配 filePath / importPath / sourcePath / targetPath 字段（兼容多注册表 schema）
  const pathRegex = /(?:filePath|importPath|sourcePath|targetPath):\s*['"]([^'"]+)['"]/g
  // 检测路径字段类型（用于展示）
  const pathKeyMatch = /(?:filePath|importPath|sourcePath|targetPath)/.exec(content)
  const pathKey = pathKeyMatch ? pathKeyMatch[0] : 'sourcePath'

  // 收集所有 id 及其位置
  const idMatches: Array<{ value: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = idRegex.exec(content)) !== null) {
    idMatches.push({ value: m[1], index: m.index })
  }

  // 收集所有 path 及其位置（保留命中的字段名，便于回填 pathKey）
  const pathMatches: Array<{ value: string; key: string; index: number }> = []
  while ((m = pathRegex.exec(content)) !== null) {
    pathMatches.push({ value: m[1], key: m[0].split(':')[0], index: m.index })
  }

  // 按位置配对：每个 id 找最近的后续 path
  for (const idMatch of idMatches) {
    let closestPath: { value: string; index: number } | undefined
    let minDistance = Infinity

    for (const pathMatch of pathMatches) {
      const distance = pathMatch.index - idMatch.index
      if (distance > 0 && distance < minDistance) {
        minDistance = distance
        closestPath = pathMatch
      }
    }

    if (closestPath) {
      entries.push({
        id: idMatch.value,
        path: normalizeRegistryPath(closestPath.value),
        pathKey: closestPath.key,
      })
    }
  }

  return entries
}

/**
 * 递归收集目录下所有匹配 pattern 的文件
 * @param dir       目标目录
 * @param suffix    文件名后缀匹配（如 'Store.ts'）
 * @param exclude   排除的目录名列表
 */
function collectFiles(dir: string, suffix: string, exclude: string[] = []): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue

    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, suffix, exclude))
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(full)
    }
  }
  return files
}

/** 获取文件相对于项目根目录的正斜杠路径 */
function relative(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, '/')
}

// ============================================================
// 正向检查：注册表条目 → 文件是否存在
// ============================================================

function checkForward(
  entries: RegistryEntry[],
  label: string
): Array<{ id: string; path: string; pathKey: string }> {
  const missing: Array<{ id: string; path: string; pathKey: string }> = []

  for (const entry of entries) {
    const resolved = resolveRegistryPath(entry.path)
    if (!fs.existsSync(resolved)) {
      missing.push({ id: entry.id, path: entry.path, pathKey: entry.pathKey })
    }
  }

  return missing
}

// ============================================================
// 反向检查：磁盘文件 → 是否在注册表中
// ============================================================

/** Store 反向检查 */
function checkUnregisteredStores(registeredIds: Set<string>): string[] {
  const storeDir = path.join(SRC, 'store')
  const allStoreFiles = collectFiles(storeDir, 'Store.ts', [
    'node_modules', 'dist', '__tests__', 'helpers',
  ])

  return allStoreFiles
    .filter(f => {
      const name = path.basename(f)
      // 排除测试文件
      if (name.includes('.test.') || name.includes('.spec.')) return false
      // 提取 store 标识：analysisStore.ts → analysisStore
      const baseName = name.replace(/\.ts$/, '')
      return !registeredIds.has(baseName)
    })
    .map(f => relative(f))
}

/** Service 反向检查 */
function checkUnregisteredServices(registeredIds: Set<string>): string[] {
  const serviceDir = path.join(SRC, 'services')
  const allServiceFiles = collectFiles(serviceDir, 'Service.ts', [
    'node_modules', 'dist', '__tests__',
  ])

  return allServiceFiles
    .filter(f => {
      const name = path.basename(f)
      // 排除测试文件
      if (name.includes('.test.') || name.includes('.spec.')) return false
      // 提取 service 标识：analysisService.ts → analysisService
      const baseName = name.replace(/\.ts$/, '')
      return !registeredIds.has(baseName)
    })
    .map(f => relative(f))
}

/** Component 反向检查 */
function checkUnregisteredComponents(registeredPaths: Set<string>): string[] {
  const componentDir = path.join(SRC, 'components')
  if (!fs.existsSync(componentDir)) return []

  const allComponentFiles: string[] = []

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue

      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scan(full)
      } else if (entry.isFile()) {
        // 只扫描 .tsx 文件和 .ts 业务组件文件
        const isComponent =
          (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) ||
          (entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.spec.ts') &&
            entry.name !== 'index.ts' &&
            entry.name !== 'componentRegistry.ts' &&
            // 排除 hooks / 工具文件
            !entry.name.startsWith('use') &&
            // 排除纯类型文件
            !entry.name.endsWith('.types.ts'))

        if (isComponent) {
          allComponentFiles.push(full)
        }
      }
    }
  }

  scan(componentDir)

  return allComponentFiles
    .filter(f => {
      // 将文件路径转为 importPath 格式进行比对
      // 例：src/components/organisms/system/LogStreamPanel.tsx → @/components/organisms/system/LogStreamPanel
      const rel = path.relative(SRC, f).replace(/\\/g, '/')
      const withoutExt = rel.replace(/\.tsx$/, '').replace(/\.ts$/, '')
      const importPath = `@/${withoutExt}`
      return !registeredPaths.has(importPath)
    })
    .map(f => relative(f))
}

// ============================================================
// 审计单个注册表
// ============================================================

function auditRegistry(
  registryPath: string,
  label: string,
  reverseCheck: (ids: Set<string>) => string[],
  isComponentRegistry: boolean = false,
  subRegistryPaths: string[] = []
): AuditResult {
  if (!fs.existsSync(registryPath)) {
    return {
      label,
      registryExists: false,
      totalEntries: 0,
      missingFiles: [],
      unregistered: [],
    }
  }

  let content = fs.readFileSync(registryPath, 'utf-8')
  // 组件注册表为「薄入口 + 4 层级子注册表」结构：
  // 薄入口只做 ...Xxx_REGISTRY 展开、不内联条目，因此需额外读取
  // 各子注册表文件（atom/molecule/organism/template）才能解析到真实条目。
  if (isComponentRegistry && subRegistryPaths.length > 0) {
    for (const sub of subRegistryPaths) {
      if (fs.existsSync(sub)) content += '\n' + fs.readFileSync(sub, 'utf-8')
    }
  }
  const entries = parseRegistryEntries(content)

  // 正向检查
  const missingFiles = checkForward(entries, label)

  // 反向检查：构建已注册 ID 集合
  const registeredIds = new Set(entries.map(e => {
    // 从 id 字段提取的值直接作为标识
    return e.id
  }))

  // 对于 Store/Service，id 是 PascalCase（如 AnalysisStore），
  // 但文件名是 camelCase（如 analysisStore.ts），需要做映射
  // 策略：同时注册 id 的小写首字母版本
  const idSet = new Set<string>()
  for (const id of registeredIds) {
    idSet.add(id)
    // 首字母小写：AnalysisStore → analysisStore
    idSet.add(id.charAt(0).toLowerCase() + id.slice(1))
  }

  // 对于 Component，用 importPath 做比对
  const registeredPaths = new Set(entries.map(e => e.path))

  const unregistered = label.includes('Component')
    ? checkUnregisteredComponents(registeredPaths)
    : reverseCheck(idSet)

  // 组件注册表专属质量审计
  let componentAudit: ComponentAuditResult | undefined
  if (isComponentRegistry) {
    const componentEntries = parseComponentEntries(content)
    componentAudit = auditComponentRegistryQuality(componentEntries)
  }

  return {
    label,
    registryExists: true,
    totalEntries: entries.length,
    missingFiles,
    unregistered,
    componentAudit,
  }
}

// ============================================================
// 输出报告
// ============================================================

function printReport(results: AuditResult[]): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  四层注册表一致性审计 — audit-registry.ts v1.1             ║')
  console.log('╚════════════════════════════════════════════════════════════\n')

  let totalIssues = 0

  for (const result of results) {
    console.log(`━━━ ${result.label} ━━━`)

    if (!result.registryExists) {
      console.log(`  ⚠️  注册表文件不存在（跳过审计）`)
      console.log()
      continue
    }

    console.log(`  注册条目数: ${result.totalEntries}`)

    // 正向检查
    if (result.missingFiles.length === 0) {
      console.log(`  ✅ 正向检查通过：所有注册条目的目标文件均存在`)
    } else {
      console.log(`  ❌ 正向检查：${result.missingFiles.length} 个条目的目标文件不存在`)
      for (const item of result.missingFiles) {
        console.log(`     - ${item.id} (${item.pathKey}: ${item.path})`)
      }
      totalIssues += result.missingFiles.length
    }

    // 反向检查
    if (result.unregistered.length === 0) {
      console.log(`  ✅ 反向检查通过：磁盘文件均已注册`)
    } else {
      console.log(`  ❌ 反向检查：${result.unregistered.length} 个文件未在注册表中注册`)
      for (const file of result.unregistered) {
        console.log(`     - ${file}`)
      }
      totalIssues += result.unregistered.length
    }

    // 组件注册表专属检查
    if (result.componentAudit) {
      const ca = result.componentAudit

      // consumers 校验（warning 级别）
      if (ca.missingConsumers.length === 0) {
        console.log(`  ✅ consumers 校验通过：所有 active 组件均声明消费方`)
      } else {
        console.log(`  ⚠️  [missing-consumers] ${ca.missingConsumers.length} 个 active 组件未声明 consumers`)
        for (const item of ca.missingConsumers) {
          console.log(`     - ${item.name}`)
        }
      }

      // deprecated 完整性校验（warning 级别）
      if (ca.incompleteDeprecation.length === 0) {
        console.log(`  ✅ deprecated 完整性校验通过`)
      } else {
        console.log(`  ⚠️  [incomplete-deprecation] ${ca.incompleteDeprecation.length} 个 deprecated 组件缺少必填字段`)
        for (const item of ca.incompleteDeprecation) {
          console.log(`     - ${item.name} (缺少: ${item.missing.join(', ')})`)
        }
      }

      // wip 组件统计（信息输出）
      if (ca.wipComponents.length === 0) {
        console.log(`  ℹ️  wip 组件：0 个`)
      } else {
        console.log(`  ℹ️  wip 组件：${ca.wipComponents.length} 个（开发中暂未接入）`)
        for (const name of ca.wipComponents) {
          console.log(`     - ${name}`)
        }
      }
    }

    console.log()
  }

  // 统计摘要
  const existingRegistries = results.filter(r => r.registryExists)
  const missingRegistries = results.filter(r => !r.registryExists)
  const totalEntries = existingRegistries.reduce((sum, r) => sum + r.totalEntries, 0)
  const totalMissingFiles = existingRegistries.reduce((sum, r) => sum + r.missingFiles.length, 0)
  const totalUnregistered = existingRegistries.reduce((sum, r) => sum + r.unregistered.length, 0)

  // 组件注册表专属统计
  const componentResult = results.find(r => r.componentAudit)
  const wipComponents = componentResult?.componentAudit?.wipComponents.length ?? 0
  const missingConsumersCount = componentResult?.componentAudit?.missingConsumers.length ?? 0
  const incompleteDeprecationCount = componentResult?.componentAudit?.incompleteDeprecation.length ?? 0

  console.log('────────────────────────────────────────────────────────────')
  console.log('统计摘要')
  console.log('────────────────────────────────────────────────────────────')
  console.log(`  注册表文件存在: ${existingRegistries.length}/${results.length}`)
  if (missingRegistries.length > 0) {
    for (const r of missingRegistries) {
      console.log(`    ⚠️  ${r.label} — 注册表文件尚未创建`)
    }
  }
  console.log(`  注册条目总数: ${totalEntries}`)
  console.log(`  正向问题（文件缺失）: ${totalMissingFiles}`)
  console.log(`  反向问题（未注册）: ${totalUnregistered}`)
  console.log(`  问题总数: ${totalIssues}`)
  if (componentResult?.componentAudit) {
    console.log(`  wip 组件数: ${wipComponents}`)
    console.log(`  missing-consumers 警告: ${missingConsumersCount}`)
    console.log(`  incomplete-deprecation 警告: ${incompleteDeprecationCount}`)
  }
  console.log('────────────────────────────────────────────────────────────\n')

  if (totalIssues > 0) {
    console.log(`❌ 发现 ${totalIssues} 个注册表一致性问题`)
  } else {
    console.log('✅ 四层注册表一致性检查全部通过')
  }

  console.log()
}

// ============================================================
// 主函数
// ============================================================

function main(): void {
  const results: AuditResult[] = []

  // 1. Store 注册表
  results.push(
    auditRegistry(STORE_REGISTRY_PATH, 'Store 注册表', checkUnregisteredStores)
  )

  // 2. Service 注册表
  results.push(
    auditRegistry(SERVICE_REGISTRY_PATH, 'Service 注册表', checkUnregisteredServices)
  )

  // 3. Component 注册表（薄入口 + 4 层级子注册表）
  const componentSubRegistries = [
    path.join(SRC, 'components', 'registry', 'atomRegistry.ts'),
    path.join(SRC, 'components', 'registry', 'moleculeRegistry.ts'),
    path.join(SRC, 'components', 'registry', 'organismRegistry.ts'),
    path.join(SRC, 'components', 'registry', 'templateRegistry.ts'),
  ]
  results.push(
    auditRegistry(COMPONENT_REGISTRY_PATH, 'Component 注册表', () => [], true, componentSubRegistries)
  )

  // 输出报告
  printReport(results)

  // 退出码：有问题返回 1
  const totalIssues = results.reduce(
    (sum, r) => sum + r.missingFiles.length + r.unregistered.length, 0
  )
  process.exit(totalIssues > 0 ? 1 : 0)
}

main()
