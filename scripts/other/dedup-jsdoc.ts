import fs from 'node:fs'
import path from 'node:path'

/**
 * 删除相邻的重复 JSDoc 块。
 *
 * 自动修复 JSDoc 时，若原函数已有较长 JSDoc（如包含 @example），
 * 审计脚本可能因只回溯 10 行而误判为缺失，从而在真实 JSDoc 前
 * 插入占位符。本脚本移除这些占位符。
 */

const TARGET_DIRS = ['src', 'scripts']

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      yield* walk(fullPath)
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield fullPath
    }
  }
}

function removeDuplicateJSDoc(content: string): { content: string; removed: number } {
  const lines = content.split('\n')
  const result: string[] = []
  let i = 0
  let removed = 0

  while (i < lines.length) {
    const line = lines[i]

    // 检查当前行是否是 JSDoc 结束行
    if (line.trim() === '*/') {
      // 向前找到 JSDoc 开始行
      let start = i
      while (start >= 0 && !lines[start].trim().startsWith('/**')) {
        start--
      }
      if (start < 0) {
        result.push(line)
        i++
        continue
      }

      // 检查紧随其后的非空行是否是另一个 JSDoc 开始
      let next = i + 1
      while (next < lines.length && lines[next].trim() === '') {
        next++
      }

      if (next < lines.length && lines[next].trim().startsWith('/**')) {
        // 跳过第一个 JSDoc 块（占位符）
        removed++
        i = next
        continue
      }
    }

    result.push(line)
    i++
  }

  return { content: result.join('\n'), removed }
}

function main(): void {
  let totalRemoved = 0
  for (const dir of TARGET_DIRS) {
    for (const file of walk(path.resolve(dir))) {
      const content = fs.readFileSync(file, 'utf-8')
      const { content: newContent, removed } = removeDuplicateJSDoc(content)
      if (removed > 0) {
        fs.writeFileSync(file, newContent, 'utf-8')
        totalRemoved += removed
        console.log(`🧹 ${file}: 移除 ${removed} 个重复 JSDoc 块`)
      }
    }
  }
  console.log(`\n✅ 共移除 ${totalRemoved} 个重复 JSDoc 块`)
}

main()
