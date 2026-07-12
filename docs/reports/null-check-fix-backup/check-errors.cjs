const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = process.cwd()
const tscBin = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

let out = ''
try {
  out = execSync(`node "${tscBin}" -p tsconfig.scripts.json --noEmit`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 50 * 1024 * 1024,
  })
} catch (e) {
  out = e.stdout || e.stderr || e.message || ''
}

fs.writeFileSync(path.join(ROOT, 'docs/reports/null-check-fix-backup/tsc-v5-verify-utf8.log'), out, 'utf-8')

const lines = out.split(/\r?\n/)
const all = lines.filter(l => l.includes('error TS'))
const nc = lines.filter(l => l.match(/error TS(18048|2532|2345)/))
const srcNc = lines.filter(l => l.match(/^src.*error TS(18048|2532|2345)/))
const scriptsNc = lines.filter(l => l.match(/^scripts.*error TS(18048|2532|2345)/))

console.log('Total errors:', all.length)
console.log('Null-check errors:', nc.length)
console.log('src/ null-check:', srcNc.length)
console.log('scripts/ null-check:', scriptsNc.length)
console.log('--- TS18048 errors ---')
lines.filter(l => l.includes('TS18048')).forEach(l => console.log(l.substring(0, 150)))
console.log('--- TS2532 errors (first 10) ---')
lines.filter(l => l.includes('TS2532')).slice(0, 10).forEach(l => console.log(l.substring(0, 150)))
console.log('--- src/ errors (first 5) ---')
lines.filter(l => l.match(/^src.*error TS/)).slice(0, 5).forEach(l => console.log(l.substring(0, 150)))
