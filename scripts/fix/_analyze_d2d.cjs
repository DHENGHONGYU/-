// Quick analysis - reads latest audit report
const fs = require('node:fs')
const path = require('node:path')

const dir = path.join('scripts', 'docs', 'reports', 'audit')
const files = fs.readdirSync(dir).filter(f => /^audit-doc-code-references-\d{4}-\d{2}-\d{2}T/.test(f)).sort().reverse()
const LATEST = path.join(dir, files[0])
console.log(`Loading: ${files[0]}`)
const data = JSON.parse(fs.readFileSync(LATEST, 'utf-8'))
const d2d = data.brokenReferences.filter(r => r.type === 'doc-to-doc')
const c2d = data.brokenReferences.filter(r => r.type === 'code-to-doc')
const d2c = data.brokenReferences.filter(r => r.type === 'doc-to-code')

console.log(`Total refs: ${data.totalReferences}, Total broken: ${data.brokenReferences.length}, d2d: ${d2d.length}, c2d: ${c2d.length}, d2c: ${d2c.length}`)

// Group by target, sort desc
const byTarget = new Map()
for (const r of d2d) {
  byTarget.set(r.target, (byTarget.get(r.target) || 0) + 1)
}
const sorted = Array.from(byTarget.entries()).sort((a, b) => b[1] - a[1])
console.log(`\nUnique d2d targets: ${byTarget.size}`)
console.log('Top 50 d2d targets:')
sorted.slice(0, 50).forEach(([t, c]) => console.log(`  ${String(c).padStart(3)}  ${t}`))

console.log('\n\nTop 50 d2c targets:')
const d2cByTarget = new Map()
for (const r of d2c) {
  d2cByTarget.set(r.target, (d2cByTarget.get(r.target) || 0) + 1)
}
const sortedD2c = Array.from(d2cByTarget.entries()).sort((a, b) => b[1] - a[1])
console.log(`Unique d2c targets: ${d2cByTarget.size}`)
sortedD2c.slice(0, 50).forEach(([t, c]) => console.log(`  ${String(c).padStart(3)}  ${t}`))

console.log('\n\nTop 10 c2d:')
const c2dByTarget = new Map()
for (const r of c2d) {
  c2dByTarget.set(r.target, (c2dByTarget.get(r.target) || 0) + 1)
}
Array.from(c2dByTarget.entries()).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${String(c).padStart(3)}  ${t}`))
