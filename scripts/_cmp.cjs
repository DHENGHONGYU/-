const b = require('./complexity-plan2.json')
const norm = (s) => s.replace(/\\/g, '/')
const baseline = { total: 93, deep: 64, dup: 29 }
const curDeep = b.violations.filter((v) => v.type === 'deep-nesting').length
const curDup = b.violations.filter((v) => v.type === 'dup-condition').length
const curTotal = b.violations.length
console.log('BASELINE total', baseline.total, 'deep', baseline.deep, 'dup', baseline.dup)
console.log('CURRENT  total', curTotal, 'deep', curDeep, 'dup', curDup)
console.log('REDUCED  total', baseline.total - curTotal, 'deep', baseline.deep - curDeep, 'dup', baseline.dup - curDup)
const remFiles = {}
for (const v of b.violations.filter((x) => x.type === 'deep-nesting')) remFiles[norm(v.file)] = (remFiles[norm(v.file)] || 0) + 1
console.log('--- remaining D4 files (' + Object.keys(remFiles).length + ') ---')
Object.entries(remFiles).sort((x, y) => y[1] - x[1]).forEach(([f, c]) => console.log('  ' + c + '  ' + f))
// dup files
const dupFiles = {}
for (const v of b.violations.filter((x) => x.type === 'dup-condition')) dupFiles[norm(v.file)] = (dupFiles[norm(v.file)] || 0) + 1
console.log('--- remaining DUP files (' + Object.keys(dupFiles).length + ') ---')
Object.entries(dupFiles).sort((x, y) => y[1] - x[1]).forEach(([f, c]) => console.log('  ' + c + '  ' + f))
