const fs = require('fs')
const path = require('path')
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const COLOR_FAMILIES = ['red','green','blue','yellow','amber','gray','slate','purple','orange','cyan','emerald','indigo','teal','pink','rose','violet','fuchsia','lime','sky','zinc','neutral','stone']
const UTILS = ['text','bg','border','ring','divide','from','to','via','fill','stroke','outline']
const P = '(?:hover:|focus:|focus-visible:|active:|disabled:|visited:|dark:|md:|lg:|xl:)?'
const CLS = UTILS.map((u) => P + u + '-(?:' + COLOR_FAMILIES.join('|') + ')-\\d+').join('|')
const BARE = new RegExp('(?:^|\\s|"|\'|`|\\()(' + CLS + ')', 'g')
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
for (let i = 0; i < files.length; i++) {
  const f = files[i]
  try {
    const c = fs.readFileSync(f, 'utf-8')
    BARE.lastIndex = 0
    const m = c.match(BARE)
    if (m && m.length > 50) console.log(rel(f), m.length)
  } catch (e) {
    console.log('ERR', rel(f), e.message)
  }
}
console.log('done')
