const fs = require('fs')
const path = require('path')
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const RGB = /rgba?\(\s*\d{1,3}\s*,/g
const EXCLUDE = [
  /tokens\.css$/,
  /constants.*\.ts$/,
  /token.*\.ts$/i,
  /\.test\./,
  /__tests__/,
  /stockColor.*\.ts$/i,
  /colorPalette.*\.ts$/i,
  /mockData.*\.ts$/i,
  /mock.*\.ts$/i,
  /[\\/]config[\\/]/,
  /[\\/]generated[\\/]/,
  /chartColors.*\.ts$/i,
  /themeRegistry.*\.ts$/i,
  /theme\.config\.ts$/i,
  /theme\.tokens.*\.ts$/i,
]
function shouldExclude(f) { return EXCLUDE.some(p => p.test(f)) }
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
console.log('files', files.length)
let hits = 0
for (let i = 0; i < files.length; i++) {
  const f = files[i]
  if (shouldExclude(rel(f))) continue
  const c = fs.readFileSync(f, 'utf-8')
  const lines = c.split('\n')
  for (let j = 0; j < lines.length; j++) {
    const line = lines[j]
    const m = [...(line.match(HEX)||[]), ...(line.match(RGB)||[])]
    if (m.length) { hits++; if (hits<=20) console.log(rel(f), j+1, m.join(',')); }
  }
}
console.log('hex hits', hits)
