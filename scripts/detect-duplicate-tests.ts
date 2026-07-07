/**
 * 重复测试文件检测工具
 * @description 查找相同 basename 但不同路径的测试文件，避免测试冗余
 */

import { glob } from 'glob'
import path from 'path'

interface DuplicateGroup {
  basename: string
  paths: string[]
}

async function detectDuplicateTests(): Promise<void> {
  const testFiles = await glob('**/*.test.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: false,
  })

  const groups = new Map<string, string[]>()

  for (const file of testFiles) {
    const basename = path.basename(file)
    const existing = groups.get(basename) ?? []
    existing.push(file)
    groups.set(basename, existing)
  }

  const duplicates: DuplicateGroup[] = []
  for (const [basename, paths] of groups) {
    if (paths.length > 1) {
      duplicates.push({ basename, paths: paths.sort() })
    }
  }

  duplicates.sort((a, b) => a.basename.localeCompare(b.basename))

  if (duplicates.length === 0) {
    console.log('✅ 未发现重复测试文件')
    return
  }

  console.log(`❌ 发现 ${duplicates.length} 组重复测试文件：\n`)

  for (const group of duplicates) {
    console.log(`📄 ${group.basename}`)
    for (const p of group.paths) {
      console.log(`  - ${p}`)
    }
    console.log()
  }
}

detectDuplicateTests().catch((err) => {
  console.error('[detect-duplicate-tests] 执行失败', { error: String(err) })
  process.exit(1)
})
