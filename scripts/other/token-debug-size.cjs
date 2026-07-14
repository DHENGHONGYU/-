const fs = require('fs')
const path = require('path')
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
function rel(s) { return path.relative(ROOT, s).replace(/\\/g, '/') }
function walk(d, arr) {
  let e
  try { e = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const x of e) {
    const f = path.join(d, x.name)
    if (x.isDirectory()) walk(f, arr)
    else if (/\.(ts|tsx)$/.test(x.name)) arr.push(f)
  }
}
const files = []
walk(SRC, files)
const sizes = files.map(f => ({ file: rel(f), size: fs.statSync(f).size })).sort((a,b)=>b.size-a.size)
for (const s of sizes.slice(0, 30)) console.log(s.size, s.file)
