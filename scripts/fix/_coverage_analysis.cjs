// Check path-map coverage of high-freq broken targets
const fs = require('node:fs')
const path = require('node:path')

const LATEST = path.join('scripts', 'docs', 'reports', 'audit', 'audit-doc-code-references-2026-07-15T22-55-17-618Z.json')
const data = JSON.parse(fs.readFileSync(LATEST, 'utf-8'))
const d2d = data.brokenReferences.filter(r => r.type === 'doc-to-doc')

const pathMap = JSON.parse(fs.readFileSync('scripts/config/doc-ref-path-map.json', 'utf-8'))
const phantomMap = JSON.parse(fs.readFileSync('scripts/config/doc-phantom-map.json', 'utf-8'))
const combined = { ...pathMap.docPathMap, ...phantomMap.phantomDocs }

// Group by target
const byTarget = new Map()
for (const r of d2d) {
  byTarget.set(r.target, (byTarget.get(r.target) || 0) + 1)
}
const sorted = Array.from(byTarget.entries()).sort((a, b) => b[1] - a[1])

console.log('Coverage analysis:')
sorted.forEach(([target, count]) => {
  const direct = combined[target] ? '✓direct' : '✗'
  const basename = path.basename(target)
  const baseMatch = combined[basename] ? `✓basename(${combined[basename]})` : '✗'
  console.log(`  [${String(count).padStart(3)}] ${direct.padEnd(8)} ${baseMatch.padEnd(40)} ${target}`)
})
