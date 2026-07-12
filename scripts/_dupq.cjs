const b = require('./complexity-plan2.json')
const norm = (s) => s.replace(/\\/g, '/')
const files = ['src/services/input/batchImportParsers.ts', 'src/services/news/newsService.ts', 'src/lib/localStorageManager.ts', 'src/services/hybrid-proofread/localCollector.ts', 'src/store/signalQualityStore.derived.ts']
for (const f of files) {
  const items = b.violations.filter((v) => norm(v.file) === f && v.type === 'dup-condition')
  if (items.length) {
    console.log('### ' + f)
    items.forEach((i) => console.log('   dup x' + i.metric + ' :: ' + i.func + ' L' + i.line + (i.cond ? '  [' + i.cond + ']' : '')))
  } else {
    console.log('### ' + f + '  (no dup)')
  }
}
// also print first dup entry's full keys to know if cond is stored
console.log('--- sample violation keys ---')
console.log(Object.keys(b.violations[0]))
console.log(JSON.stringify(b.violations.find((v) => v.type === 'dup-condition'), null, 2))
