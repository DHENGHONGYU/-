import { readFileSync } from 'node:fs'

const reportPath = 'scripts/docs/reports/audit/audit-doc-code-references-2026-07-15T00-39-51-700Z.json'
const r = JSON.parse(readFileSync(reportPath, 'utf-8'))

const bySource: Record<string, number> = {}
for (const ref of r.brokenReferences) {
  bySource[ref.source] = (bySource[ref.source] || 0) + 1
}
const sorted = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 30)
console.log('Top 30 断裂源文件:')
for (const [s, c] of sorted) {
  console.log(`  ${c}: ${s}`)
}

const targetCounts: Record<string, number> = {}
for (const ref of r.brokenReferences) {
  targetCounts[ref.target] = (targetCounts[ref.target] || 0) + 1
}
const sortedTargets = Object.entries(targetCounts).sort((a, b) => b[1] - a[1]).slice(0, 30)
console.log('\nTop 30 被引用目标:')
for (const [t, c] of sortedTargets) {
  console.log(`  ${c}: ${t}`)
}
