/**
 * @fileoverview 注册表自动修复脚本
 *
 * 检测未注册的组件文件，并自动补充注册条目到对应的 registry 文件中。
 * 支持 dry-run 预览模式和 --apply 写入模式。
 *
 * Usage:
 *   npx tsx scripts/audit/fix-unregistered-components.ts          # dry-run 预览
 *   npx tsx scripts/audit/fix-unregistered-components.ts --apply   # 实际写入
 *   npx tsx scripts/audit/fix-unregistered-components.ts --json    # JSON 输出
 *
 * @module scripts/audit/fix-unregistered-components
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, relative, extname, basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const SRC = join(ROOT, 'src')
const REGISTRY_DIR = join(SRC, 'components', 'registry')

interface RegistryEntry {
  name: string
  level: string
  sourcePath: string
  targetPath: string
  status: 'active' | 'deprecated' | 'wip'
  description: string
  consumers: string[]
  deprecationMeta?: { version: string; replacement: string }
}

interface RegistryInfo {
  file: string
  level: string
  entries: RegistryEntry[]
}

interface FixReport {
  timestamp: string
  mode: 'dry-run' | 'applied'
  totalUnregistered: number
  fixes: Array<{
    component: string
    registry: string
    sourcePath: string
    consumers: string[]
    description: string
    action: 'added'
  }>
  errors: string[]
}

const LEVEL_MAP: Record<string, { registry: string; dir: string }> = {
  atom: { registry: 'atomRegistry.ts', dir: 'atoms' },
  molecule: { registry: 'moleculeRegistry.ts', dir: 'molecules' },
  organism: { registry: 'organismRegistry.ts', dir: 'organisms' },
  template: { registry: 'templateRegistry.ts', dir: 'templates' },
}

function toFileURL(absPath: string): string {
  return pathToFileURL(absPath).href
}

/** 从文件内容解析注册表条目（逐行解析，鲁棒性更强） */
function parseRegistry(content: string): RegistryEntry[] {
  const entries: RegistryEntry[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const nameMatch = line.match(/name:\s*'([^']+)'/)
    if (!nameMatch) continue
    if (!line.includes('sourcePath')) continue

    const levelMatch = line.match(/level:\s*'([^']+)'/)
    const sourcePathMatch = line.match(/sourcePath:\s*'([^']+)'/)
    const targetPathMatch = line.match(/targetPath:\s*'([^']+)'/)
    const statusMatch = line.match(/status:\s*'([^']+)'/)
    const descMatch = line.match(/description:\s*'([^']*)'/)
    const consumersMatch = line.match(/consumers:\s*\[([^\]]*)\]/)
    const versionMatch = line.match(/version:\s*'([^']+)'/)
    const replacementMatch = line.match(/replacement:\s*'([^']+)'/)

    const consumers = consumersMatch
      ? consumersMatch[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean)
      : []

    const entry: RegistryEntry = {
      name: nameMatch[1],
      level: levelMatch?.[1] ?? '',
      sourcePath: sourcePathMatch?.[1] ?? '',
      targetPath: targetPathMatch?.[1] ?? '',
      status: (statusMatch?.[1] ?? 'active') as RegistryEntry['status'],
      description: descMatch?.[1] ?? '',
      consumers,
    }

    if (versionMatch && replacementMatch) {
      entry.deprecationMeta = { version: versionMatch[1], replacement: replacementMatch[1] }
    }

    if (entry.sourcePath) {
      entries.push(entry)
    }
  }

  return entries
}

/** 扫描指定层级目录下的组件文件 */
function scanComponentsByLevel(level: string): Array<{ name: string; path: string }> {
  const dir = join(SRC, 'components', LEVEL_MAP[level].dir)
  if (!existsSync(dir)) return []

  const results: Array<{ name: string; path: string }> = []
  const entries = walkDir(dir)

  for (const entry of entries) {
    if (extname(entry) !== '.tsx') continue
    if (entry.endsWith('.test.tsx')) continue
    if (entry.endsWith('.spec.tsx')) continue
    if (entry.endsWith('.stories.tsx')) continue

    const componentName = basename(entry, '.tsx')
    results.push({
      name: componentName,
      path: relative(ROOT, entry).replace(/\\/g, '/'),
    })
  }

  return results
}

/** 递归遍历目录 */
function walkDir(dir: string): string[] {
  const results: string[] = []
  try {
    const items = readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      const fullPath = join(dir, item.name)
      if (item.isDirectory()) {
        results.push(...walkDir(fullPath))
      } else if (item.isFile()) {
        results.push(fullPath)
      }
    }
  } catch {
    // 目录不可读，跳过
  }
  return results
}

/** 推断组件的 consumers */
function inferConsumers(componentName: string, componentPath: string): string[] {
  const consumers: string[] = []

  // 策略 1: 检查 showcase 目录引用
  const showcaseDir = join(SRC, 'showcase')
  if (existsSync(showcaseDir)) {
    const showcaseFiles = walkDir(showcaseDir)
    for (const file of showcaseFiles) {
      if (extname(file) !== '.tsx') continue
      const content = readFileSync(file, 'utf-8')
      if (content.includes(componentName)) {
        consumers.push('Showcase')
        break
      }
    }
  }

  // 策略 2: 检查 page 目录引用
  const pageDir = join(SRC, 'pages')
  if (existsSync(pageDir)) {
    const pageFiles = walkDir(pageDir)
    for (const file of pageFiles) {
      if (extname(file) !== '.tsx') continue
      const content = readFileSync(file, 'utf-8')
      if (content.includes(componentName)) {
        const pageName = basename(file, '.tsx')
        if (!consumers.includes(pageName)) consumers.push(pageName)
      }
    }
  }

  // 策略 3: 检查其他组件引用
  const componentDir = join(SRC, 'components')
  const scanDirs = ['organisms', 'templates']
  for (const d of scanDirs) {
    const dir = join(componentDir, d)
    if (!existsSync(dir)) continue
    const files = walkDir(dir)
    for (const file of files) {
      if (extname(file) !== '.tsx') continue
      const relPath = relative(ROOT, file).replace(/\\/g, '/')
      if (relPath === componentPath) continue
      const content = readFileSync(file, 'utf-8')
      // 检查 import 语句中是否引用了此组件
      const importPattern = new RegExp(
        `import\\s+\\{[^}]*${componentName}[^}]*\\}\\s+from\\s+['"][^'"]*${componentName}['"]`,
      )
      if (importPattern.test(content)) {
        const consumerName = basename(file, '.tsx')
        if (!consumers.includes(consumerName)) consumers.push(consumerName)
      }
    }
  }

  if (consumers.length === 0) {
    consumers.push('TBD')
  }

  return consumers
}

/** 从文件内容推断组件描述 */
function inferDescription(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const overviewMatch = content.match(/@fileoverview\s+(.+)/)
    if (overviewMatch) {
      return overviewMatch[1].trim()
    }
    const commentMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+)\s*\n/)
    if (commentMatch) {
      return commentMatch[1].trim()
    }
  } catch {
    // 读取失败
  }
  return '待补充描述'
}

/** 生成注册条目代码 */
function generateEntry(entry: RegistryEntry): string {
  const consumersStr = entry.consumers.map((c) => `'${c}'`).join(', ')
  const desc = entry.description.replace(/'/g, "\\'")
  return `  { name: '${entry.name}', level: '${entry.level}', sourcePath: '${entry.sourcePath}', targetPath: '${entry.targetPath}', status: '${entry.status}', description: '${desc}', consumers: [${consumersStr}] },`
}

/** 查找注册表中最后一个条目位置 */
function findLastEntryPosition(content: string): number {
  // 查找最后一个注册条目的结束位置
  const regex = /\{[^}]*name:\s*'[^']+'[^}]*sourcePath:\s*'[^']+'[^}]*\}/g
  let lastIndex = -1
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    lastIndex = match.index + match[0].length
  }
  return lastIndex
}

async function main(): Promise<void> {
  const isApply = process.argv.includes('--apply')
  const isJson = process.argv.includes('--json')

  console.log('━━━ 注册表自动修复脚本 ━━━')
  console.log(`模式: ${isApply ? '应用写入' : 'dry-run 预览'}`)
  console.log()

  // 加载所有注册表
  const registries: RegistryInfo[] = []
  for (const [level, config] of Object.entries(LEVEL_MAP)) {
    const filePath = join(REGISTRY_DIR, config.registry)
    if (!existsSync(filePath)) continue
    const content = readFileSync(filePath, 'utf-8')
    const entries = parseRegistry(content)
    registries.push({ file: filePath, level, entries })
  }

  // 检测未注册组件
  const report: FixReport = {
    timestamp: new Date().toISOString(),
    mode: isApply ? 'applied' : 'dry-run',
    totalUnregistered: 0,
    fixes: [],
    errors: [],
  }

  for (const { level, entries } of registries) {
    const scanned = scanComponentsByLevel(level)
    const registered = new Set(entries.map((e) => e.name))
    // 同时用 sourcePath 检测（处理文件名与注册名不一致的场景）
    const registeredPaths = new Set(entries.map((e) => e.sourcePath))

    for (const component of scanned) {
      // 1. 按文件名匹配
      if (registered.has(component.name)) continue
      // 2. 按 sourcePath 匹配（处理 Error.tsx → ErrorStateBase 等重命名场景）
      if (registeredPaths.has(component.path)) continue

      const consumers = inferConsumers(component.name, component.path)
      const description = inferDescription(join(ROOT, component.path))

      report.fixes.push({
        component: component.name,
        registry: LEVEL_MAP[level].registry,
        sourcePath: component.path,
        consumers,
        description,
        action: 'added',
      })
      report.totalUnregistered++

      if (!isJson) {
        console.log(`  ⚠️  发现未注册组件: ${component.name}`)
        console.log(`     层级: ${level}`)
        console.log(`     路径: ${component.path}`)
        console.log(`     描述: ${description}`)
        console.log(`     推断 consumers: [${consumers.join(', ')}]`)
        console.log()
      }
    }
  }

  // 应用修复
  if (isApply && report.fixes.length > 0) {
    for (const fix of report.fixes) {
      const registryInfo = registries.find((r) => r.file.endsWith(fix.registry))
      if (!registryInfo) {
        report.errors.push(`找不到注册表文件: ${fix.registry}`)
        continue
      }

      const registryContent = readFileSync(registryInfo.file, 'utf-8')
      const newEntry: RegistryEntry = {
        name: fix.component,
        level: registryInfo.level,
        sourcePath: fix.sourcePath,
        targetPath: fix.sourcePath,
        status: 'active',
        description: fix.description,
        consumers: fix.consumers,
      }

      const entryCode = generateEntry(newEntry)
      const lastPos = findLastEntryPosition(registryContent)

      if (lastPos === -1) {
        report.errors.push(`无法找到 ${fix.registry} 的插入点`)
        continue
      }

      const updatedContent =
        registryContent.substring(0, lastPos) + '\n' + entryCode + registryContent.substring(lastPos)

      writeFileSync(registryInfo.file, updatedContent, 'utf-8')
      console.log(`  ✅ 已写入: ${fix.component} → ${fix.registry}`)
    }
  }

  // 输出
  if (isJson) {
    mkdirSync(join(ROOT, 'outputs'), { recursive: true })
    const outputPath = join(ROOT, 'outputs', 'fix-unregistered.json')
    writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('────────────────────────────────────────────')
    console.log(`摘要:`)
    console.log(`  发现未注册组件: ${report.totalUnregistered}`)
    console.log(`  修复模式: ${isApply ? '已应用' : '预览（使用 --apply 实际写入）'}`)
    console.log(`  错误: ${report.errors.length}`)
    if (report.errors.length > 0) {
      report.errors.forEach((e) => console.log(`    - ${e}`))
    }
    console.log('────────────────────────────────────────────')

    if (report.totalUnregistered === 0) {
      console.log('  ✅ 所有组件均已注册！')
    }
  }

  process.exit(report.errors.length > 0 ? 1 : report.totalUnregistered > 0 && isApply ? 1 : 0)
}

main().catch((e) => {
  console.error('❌ fix-unregistered-components 执行异常:', e)
  process.exit(2)
})