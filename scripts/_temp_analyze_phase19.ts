import { readFileSync } from 'fs'
import { resolve } from 'path'

const reportPath = process.argv[2] || 'scripts/docs/reports/audit/audit-doc-code-references-2026-07-15T23-20-26-955Z.json'
const report = JSON.parse(readFileSync(resolve(reportPath), 'utf-8'))

const broken = report.brokenReferences as Array<{
  source: string
  target: string
  line: number
  type: 'doc-to-code' | 'doc-to-doc' | 'code-to-doc'
}>

const byTarget = new Map<string, { count: number; types: Record<string, number>; examples: Array<{ source: string; line: number }> }>()
for (const ref of broken) {
  const entry = byTarget.get(ref.target) || { count: 0, types: {}, examples: [] }
  entry.count++
  entry.types[ref.type] = (entry.types[ref.type] || 0) + 1
  if (entry.examples.length < 3) entry.examples.push({ source: ref.source, line: ref.line })
  byTarget.set(ref.target, entry)
}

const sorted = [...byTarget.entries()].sort((a, b) => b[1].count - a[1].count)

console.log(`共 ${broken.length} 条断裂引用，${sorted.length} 个唯一目标`)
console.log('')

// 分类统计
const categories = {
  placeholder: [] as string[], // 含 xxx/xxx.ts 或 feature-xxx 或 ModuleName.test.ts
  deletedCode: [] as string[], // src/ 开头且无扩展名异常或明显已删
  deletedDoc: [] as string[], // docs/ 开头
  externalAbsolute: [] as string[], // C:\ 或 file:///
  basenameOnly: [] as string[], // 无斜杠
  others: [] as string[],
}

for (const [target, info] of sorted) {
  if (/xxx|feature-xxx|ModuleName\.test|placeholder|nonexistent/i.test(target)) {
    categories.placeholder.push(`${target} (${info.count})`)
  } else if (/^[Cc]:\\|file:\/\//.test(target)) {
    categories.externalAbsolute.push(`${target} (${info.count})`)
  } else if (!target.includes('/') && !target.includes('\\')) {
    categories.basenameOnly.push(`${target} (${info.count})`)
  } else if (target.startsWith('src/') || target.startsWith('src\\')) {
    categories.deletedCode.push(`${target} (${info.count})`)
  } else if (target.startsWith('docs/') || target.startsWith('docs\\')) {
    categories.deletedDoc.push(`${target} (${info.count})`)
  } else {
    categories.others.push(`${target} (${info.count})`)
  }
}

console.log('=== 占位符目标 ===')
for (const item of categories.placeholder.slice(0, 40)) console.log(item)
console.log('')
console.log('=== 已删除/缺失代码目标 Top 60 ===')
for (const item of categories.deletedCode.slice(0, 60)) console.log(item)
console.log('')
console.log('=== 已删除/缺失文档目标 Top 40 ===')
for (const item of categories.deletedDoc.slice(0, 40)) console.log(item)
console.log('')
console.log('=== 外部绝对路径目标 ===')
for (const item of categories.externalAbsolute) console.log(item)
console.log('')
console.log('=== Basename-only 目标 ===')
for (const item of categories.basenameOnly) console.log(item)
console.log('')
console.log('=== 其他目标 ===')
for (const item of categories.others.slice(0, 40)) console.log(item)
