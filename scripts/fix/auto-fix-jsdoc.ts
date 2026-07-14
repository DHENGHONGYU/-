import fs from 'node:fs'
import path from 'node:path'

/**
 * 自动为缺少 JSDoc 的导出实体补充基础 JSDoc 注释。
 *
 * 说明：本脚本仅生成占位式注释，后续应人工补全参数与返回值语义。
 * 运行后会生成修改后的文件，但不会删除原有实现。
 */

interface MissingEntry {
  file: string
  line: number
  name: string
  type: 'function' | 'component' | 'class' | 'constant'
}

function extractParams(line: string): string[] {
  // 匹配 function foo(a: T, b: U) 或 const foo = (a: T, b: U) => ...
  const match = line.match(/\(([^)]*)\)/)
  if (!match) return []
  const params = match[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return params.map((p) => {
    const parts = p.split(/\s*:\s*/, 2)
    const [name] = parts
    // 解构参数如 { a, b } 直接跳过
    if (name.startsWith('{') || name.startsWith('[')) return ''
    // 去掉默认值
    return name.split('=')[0].trim().replace(/^\.\.\./, '')
  }).filter(Boolean)
}

function generateJSDoc(name: string, type: string, line: string): string {
  const params = type === 'function' || type === 'component' ? extractParams(line) : []
  const isAsync = line.includes('async')
  const returnType = line.match(/:\s*([A-Za-z0-9_<>,\[\]|{}\s]+)\s*=>/)?.[1]?.trim() ??
    line.match(/:\s*([A-Za-z0-9_<>,\[\]|{}\s]+)\s*\{/)?.[1]?.trim() ??
    line.match(/:\s*([A-Za-z0-9_<>,\[\]|{}\s]+)\s*$/)?.[1]?.trim() ??
    ''

  const lines: string[] = ['/**']

  if (type === 'class') {
    lines.push(` * ${name}`)
  } else if (type === 'constant') {
    lines.push(` * ${name}`)
  } else {
    lines.push(` * ${name}`)
  }

  for (const param of params) {
    lines.push(` * @param ${param}`)
  }

  if ((type === 'function' || type === 'component') && returnType) {
    lines.push(` * @returns ${returnType}`)
  }

  lines.push(' */')
  return lines.join('\n')
}

function main(): void {
  const reportPath = process.argv[2] ?? 'docs/reports/audit/jsdoc-audit-2026-07-10.json'
  if (!fs.existsSync(reportPath)) {
    console.error(`报告不存在：${reportPath}`)
    process.exit(1)
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as { entries: MissingEntry[] }
  const entries = report.entries

  // 按文件分组，避免重复读写
  const grouped = new Map<string, MissingEntry[]>()
  for (const entry of entries) {
    const fullPath = path.resolve(entry.file)
    if (!grouped.has(fullPath)) grouped.set(fullPath, [])
    grouped.get(fullPath)!.push(entry)
  }

  let fixed = 0
  for (const [fullPath, fileEntries] of grouped) {
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    // 从后往前插入，避免行号偏移
    const sorted = [...fileEntries].sort((a, b) => b.line - a.line)
    for (const entry of sorted) {
      const lineIndex = entry.line - 1
      const lineContent = lines[lineIndex] ?? ''
      const jsdoc = generateJSDoc(entry.name, entry.type, lineContent)
      lines.splice(lineIndex, 0, jsdoc)
      fixed++
    }

    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8')
  }

  console.log(`✅ 已为 ${fixed} 个导出实体补充 JSDoc 占位符`)
  console.log('⚠️  请后续人工补全参数说明与返回值语义')
}

main()
