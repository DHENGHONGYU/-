import { readFileSync } from 'node:fs'

const r1 = JSON.parse(readFileSync('scripts/docs/reports/audit/audit-doc-code-references-2026-07-15T00-39-51-700Z.json', 'utf-8'))
const r2 = JSON.parse(readFileSync('scripts/docs/reports/audit/audit-doc-code-references-2026-07-15T00-45-06-063Z.json', 'utf-8'))

const key = (ref: any) => `${ref.source}|${ref.target}|${ref.line}|${ref.type}`
const set1 = new Set(r1.brokenReferences.map(key))
const set2 = new Set(r2.brokenReferences.map(key))

const added = r2.brokenReferences.filter((ref: any) => !set1.has(key(ref)))
const removed = r1.brokenReferences.filter((ref: any) => !set2.has(key(ref)))

console.log('新增断裂引用:', added.length)
for (const ref of added.slice(0, 30)) {
  console.log(`  ${ref.source}:${ref.line} [${ref.type}] ${ref.target}`)
}

console.log('\n修复的断裂引用:', removed.length)
for (const ref of removed.slice(0, 30)) {
  console.log(`  ${ref.source}:${ref.line} [${ref.type}] ${ref.target}`)
}
