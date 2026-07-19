// Check raw bytes of specific broken ref target
const fs = require('node:fs')
const path = require('node:path')

const LATEST = path.join('scripts', 'docs', 'reports', 'audit', 'audit-doc-code-references-2026-07-15T22-55-17-618Z.json')
const data = JSON.parse(fs.readFileSync(LATEST, 'utf-8'))
const d2d = data.brokenReferences.filter(r => r.type === 'doc-to-doc')

// Find references containing 'NewsPage'
const newsRefs = d2d.filter(r => r.target.includes('NewsPage') || r.target.includes('NewsPage'))
console.log('NewsPage-related broken refs:')
newsRefs.forEach(r => {
  console.log(`  source: ${r.source}`)
  console.log(`  target: ${r.target}`)
  console.log(`  target hex: ${Buffer.from(r.target, 'utf-8').toString('hex').slice(0, 100)}...`)
  console.log(`  line: ${r.line}\n`)
})
