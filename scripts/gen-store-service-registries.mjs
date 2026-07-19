/**
 * gen-store-service-registries.mjs
 *
 * 一次性 / 按需生成 Store 与 Service 注册表，作为 audit:registry 的 Store/Service 层数据源。
 *
 * 背景：
 *   - docs/reference/03-architecture-standards.md 注明原 storeRegistry.ts 因数据损坏已移除、标注"待重建"；
 *     serviceRegistry.ts 同样缺失。audit:registry 因此对这两层静默跳过（假绿灯）。
 *   - 本脚本扫描 src/store、src/services 真实文件，生成与 componentRegistry 同风格的注册表，
 *     使 audit:registry 成为真正的 3 层一致性门禁。
 *
 * 用法：
 *   node scripts/gen-store-service-registries.mjs
 *
 * 注意：
 *   - 仅收录 audit:registry 反向检查所扫描的同集合（排除 node_modules/dist/__tests__/helpers）。
 *   - 新增/删除 Store/Service 后重新运行本脚本即可同步。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const STORE_DIR = path.join(SRC, 'store')
const SERVICE_DIR = path.join(SRC, 'services')
const STORE_REGISTRY_PATH = path.join(STORE_DIR, 'storeRegistry.ts')
const SERVICE_REGISTRY_PATH = path.join(SERVICE_DIR, 'serviceRegistry.ts')

/** 与 audit:registry 反向检查保持一致的排除目录 */
const STORE_EXCLUDE = ['node_modules', 'dist', '__tests__', 'helpers']
const SERVICE_EXCLUDE = ['node_modules', 'dist', '__tests__']

/** 文件名（去扩展名）→ PascalCase id（与 audit:registry 反向检查 camelCase 映射互补） */
function pascalCase(baseNameWithoutExt) {
  return baseNameWithoutExt
    .replace(/(^\w|_\w)/g, (m) => m.replace('_', '').toUpperCase())
}

/** 递归收集匹配后缀的文件，排除指定目录名 */
function collectFiles(dir, suffix, exclude) {
  const out = []
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, suffix, exclude))
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      out.push(full)
    }
  }
  return out
}

/** 生成单个注册表文件内容 */
function buildRegistryContent({ kind, entries, generatedAt, collisionNote }) {
  const header = `/**
 * ${kind} 注册表（自动生成 — 单一事实源）
 *
 * @description
 * 本文件为 audit:registry 的 ${kind} 层数据源，与 componentRegistry 同为注册表门禁的单一事实源。
 * 原 storeRegistry 因数据损坏被移除，本文档依 docs/reference/03-architecture-standards.md 标注"待重建"重新生成。
 *
 * 生成方式：node scripts/gen-store-service-registries.mjs
 * 维护约定：新增 / 移除 ${kind} 后重新运行上述脚本同步本文件；
 *           audit:registry 正向校验条目指向文件存在、反向校验磁盘文件均已登记。
 *${collisionNote}
 * 生成时间：${generatedAt}
 */

export interface ${kind}RegistryEntry {
  /** 条目标识（PascalCase，与文件名 camelCase 对应） */
  id: string
  /** 相对 src 的路径（不含扩展名，供 resolveRegistryPath 解析） */
  filePath: string
  /** 状态（默认 active） */
  status: 'active'
}

export const ${kind.toUpperCase()}_REGISTRY: ReadonlyArray<${kind}RegistryEntry> = [
`

  const body = entries
    .map(
      (e) =>
        `  { id: '${e.id}', filePath: '${e.filePath}', status: 'active' },`,
    )
    .join('\n')

  const footer = `\n]\n`

  return header + body + footer
}

function main() {
  const generatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')

  // ---- Store ----
  const storeFiles = collectFiles(STORE_DIR, 'Store.ts', STORE_EXCLUDE)
  const storeEntries = storeFiles
    .map((f) => {
      const rel = path.relative(SRC, f).replace(/\\/g, '/').replace(/\.ts$/, '')
      const base = path.basename(f).replace(/\.ts$/, '')
      return { id: pascalCase(base), filePath: 'src/' + rel }
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  // 检测 id 冲突（同 id 来自不同文件）
  const seen = new Map()
  const collisions = []
  for (const e of storeEntries) {
    if (seen.has(e.id)) collisions.push(`${e.id}: ${seen.get(e.id)} vs ${e.filePath}`)
    else seen.set(e.id, e.filePath)
  }

  const storeCollisionNote = collisions.length
    ? ` ⚠️ 同名 id 冲突 ${collisions.length} 条（不同目录下同名文件，保留多条 id 相同条目；audit 反向检查按文件名匹配，不影响校验）：\n *   - ${collisions.join('\n *   - ')}`
    : ''

  fs.writeFileSync(STORE_REGISTRY_PATH, buildRegistryContent({ kind: 'Store', entries: storeEntries, generatedAt, collisionNote: storeCollisionNote }))

  // ---- Service ----
  const serviceFiles = collectFiles(SERVICE_DIR, 'Service.ts', SERVICE_EXCLUDE)
  const serviceEntries = serviceFiles
    .map((f) => {
      const rel = path.relative(SRC, f).replace(/\\/g, '/').replace(/\.ts$/, '')
      const base = path.basename(f).replace(/\.ts$/, '')
      return { id: pascalCase(base), filePath: 'src/' + rel }
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  const seenS = new Map()
  const collisionsS = []
  for (const e of serviceEntries) {
    if (seenS.has(e.id)) collisionsS.push(`${e.id}: ${seenS.get(e.id)} vs ${e.filePath}`)
    else seenS.set(e.id, e.filePath)
  }

  const serviceCollisionNote = collisionsS.length
    ? ` ⚠️ 同名 id 冲突 ${collisionsS.length} 条（不同目录下同名文件，保留多条 id 相同条目；audit 反向检查按文件名匹配，不影响校验）：\n *   - ${collisionsS.join('\n *   - ')}`
    : ''

  fs.writeFileSync(SERVICE_REGISTRY_PATH, buildRegistryContent({ kind: 'Service', entries: serviceEntries, generatedAt, collisionNote: serviceCollisionNote }))

  console.log(`✅ 生成 storeRegistry.ts：${storeEntries.length} 条` + (collisions.length ? `  ⚠️ id 冲突 ${collisions.length} 条` : ''))
  console.log(`✅ 生成 serviceRegistry.ts：${serviceEntries.length} 条` + (collisionsS.length ? `  ⚠️ id 冲突 ${collisionsS.length} 条` : ''))
  if (collisions.length) console.log('   Store 冲突:', collisions.join(' | '))
  if (collisionsS.length) console.log('   Service 冲突:', collisionsS.join(' | '))
}

main()
