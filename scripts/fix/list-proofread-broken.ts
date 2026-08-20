/**
 * 一次性脚本：列出 proofread 范围内（core+important）断裂引用明细
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFullAudit, type Reference } from '../docs-tool/cross-ref-engine'
import { PROOFREADING_STRATEGY, resolveDocTier, type DocTier } from '../docs-tool/doc-proofreading-strategy'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DOCS_ROOT = join(ROOT, 'docs')

function refScopeTier(ref: Reference): DocTier {
  const docPath = ref.target.startsWith('docs/')
    ? resolve(ROOT, ref.target)
    : resolve(ROOT, dirname(ref.source), ref.target)
  return resolveDocTier(docPath.replace(/\\/g, '/'), DOCS_ROOT)
}

const result = runFullAudit(ROOT)
const inScope = new Set<DocTier>(PROOFREADING_STRATEGY.appliesToTiers)
const broken = result.brokenReferences.filter((r) => inScope.has(refScopeTier(r)))
console.log(`范围内断裂: ${broken.length}`)
for (const b of broken) {
  console.log(`- [${b.type}] ${b.source} → ${b.target} | ${(b as { reason?: string }).reason ?? ''}`)
}
