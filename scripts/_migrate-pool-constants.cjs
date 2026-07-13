/**
 * 迁移脚本：将 RESEARCH_STATUS / ResearchStatus / DEFAULT_POOL_GROUP
 * 的导入路径从 @/config/dbConfig 改为 @/constants/stockpool.constants
 *
 * 支持单行/多行 import，保留其它符号在原路径。
 * 使用 [^{}]* 防止跨越其它 import 语句。
 */
const fs = require('fs')
const path = require('path')

const TARGETS = new Set(['RESEARCH_STATUS', 'ResearchStatus', 'DEFAULT_POOL_GROUP'])
const SRC_DIR = path.resolve(__dirname, '../src')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, files)
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

/**
 * 从 import source 语句中提取所有 specifier
 * 返回 { isTypeOnly, specifiers: [{ name, inlineType }] }
 */
function parseImportStatement(statement) {
  const headerMatch = statement.match(/^\s*(import\s+(type\s+)?)\{([\s\S]*)\}\s+from\s+['"]@\/config\/dbConfig['"]\s*;?\s*$/)
  if (!headerMatch) return null
  const isTypeOnly = !!headerMatch[2]
  const body = headerMatch[3]

  const specifiers = []
  // 匹配 name 或 type name，忽略 as 别名
  const regex = /\b(type\s+)?([A-Za-z0-9_$]+)\b/g
  let m
  while ((m = regex.exec(body)) !== null) {
    specifiers.push({
      name: m[2],
      inlineType: !!m[1],
      isTypeOnly,
    })
  }
  return { isTypeOnly, specifiers, fullStatement: statement }
}

function buildImportLine(source, specifiers) {
  if (specifiers.length === 0) return null
  const hasInlineType = specifiers.some(s => s.inlineType)
  const allType = specifiers.every(s => s.isTypeOnly || s.inlineType)
  if (allType && !hasInlineType) {
    return `import type { ${specifiers.map(s => s.name).join(', ')} } from '${source}'`
  }
  const parts = specifiers.map(s => {
    if (s.isTypeOnly || s.inlineType) return `type ${s.name}`
    return s.name
  })
  return `import { ${parts.join(', ')} } from '${source}'`
}

function migrateFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8')

  // 关键：使用 [^{}]* 限制不能跨越其它带大括号的 import；同时吞掉尾部换行，避免拼接
  const importRegex = /import\s+(type\s+)?\{[^{}]*\}\s+from\s+['"]@\/config\/dbConfig['"]\s*;?\r?\n?/gs
  const matches = [...original.matchAll(importRegex)]
  if (matches.length === 0) return false

  let changed = false
  const operations = []

  for (const match of matches) {
    const parsed = parseImportStatement(match[0])
    if (!parsed) continue

    const oldDbConfig = []
    const newConstants = []
    for (const spec of parsed.specifiers) {
      if (TARGETS.has(spec.name)) {
        newConstants.push(spec)
      } else {
        oldDbConfig.push(spec)
      }
    }

    if (newConstants.length === 0) continue

    const dbLine = buildImportLine('@/config/dbConfig', oldDbConfig)
    const constLine = buildImportLine('@/constants/stockpool.constants', newConstants)

    operations.push({
      start: match.index,
      end: match.index + match[0].length,
      replacement: [dbLine, constLine].filter(Boolean).join('\n') + '\n',
    })
    changed = true
  }

  if (!changed) return false

  // 倒序替换
  operations.sort((a, b) => b.start - a.start)
  let newContent = original
  for (const op of operations) {
    newContent = newContent.slice(0, op.start) + op.replacement + newContent.slice(op.end)
  }

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8')
    return true
  }
  return false
}

function main() {
  const files = walk(SRC_DIR)
  let migrated = 0
  for (const file of files) {
    try {
      if (migrateFile(file)) {
        console.log('Migrated:', path.relative(process.cwd(), file))
        migrated++
      }
    } catch (err) {
      console.error('Failed:', file, err.message)
      process.exitCode = 1
    }
  }
  console.log(`\nTotal migrated: ${migrated}`)
}

main()
