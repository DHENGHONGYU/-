#!/usr/bin/env tsx
/**
 * @module scripts/audit/audit-doc-duplicates
 * @description 文档内容去重审计
 * 
 * 功能：
 * 1. 扫描项目中所有 MD 文档
 * 2. 计算文件内容的 hash 值
 * 3. 检测内容相同但路径不同的重复文档
 * 4. 生成去重报告和建议
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const __filename = new URL(import.meta.url).pathname
const __dirname = dirname(__filename).replace(/^\/([A-Z]:)/, '$1')
const PROJECT_ROOT = join(__dirname, '..', '..')
const DOCS_DIR = join(PROJECT_ROOT, 'docs')

interface DuplicateGroup {
  hash: string
  files: string[]
  contentPreview: string
}

function calculateHash(content: string): string {
  return createHash('md5').update(content.trim().toLowerCase()).digest('hex')
}

function scanDocs(): DuplicateGroup[] {
  const hashMap = new Map<string, string[]>()
  
  function scanDir(dir: string): void {
    if (!existsSync(dir)) return
    
    const items = readdirSync(dir, { withFileTypes: true })
    
    for (const item of items) {
      const fullPath = join(dir, item.name)
      
      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && !item.name.startsWith('_')) {
          scanDir(fullPath)
        }
      } else {
        if (item.name.endsWith('.md')) {
          try {
            const content = readFileSync(fullPath, 'utf-8')
            const hash = calculateHash(content)
            
            if (!hashMap.has(hash)) {
              hashMap.set(hash, [])
            }
            hashMap.get(hash)!.push(relative(PROJECT_ROOT, fullPath))
          } catch (error) {
            console.error(`[2026-07-14] ❌ 读取文件失败: ${relative(PROJECT_ROOT, fullPath)}`)
          }
        }
      }
    }
  }
  
  scanDir(DOCS_DIR)
  
  const duplicates: DuplicateGroup[] = []
  
  for (const [hash, files] of hashMap.entries()) {
    if (files.length > 1) {
      const firstFile = files[0]
      const content = readFileSync(join(PROJECT_ROOT, firstFile), 'utf-8')
      const preview = content.substring(0, 100).replace(/\n/g, ' ')
      
      duplicates.push({
        hash,
        files,
        contentPreview: preview
      })
    }
  }
  
  return duplicates.sort((a, b) => b.files.length - a.files.length)
}

function printReport(duplicates: DuplicateGroup[]): void {
  console.log('\n' + '='.repeat(70))
  console.log('文档内容去重审计报告')
  console.log('='.repeat(70))
  
  console.log(`\n📊 统计:`)
  console.log(`  重复文档组: ${duplicates.length}`)
  console.log(`  涉及文件数: ${duplicates.reduce((sum, g) => sum + g.files.length, 0)}`)
  
  if (duplicates.length > 0) {
    console.log(`\n🔴 重复文档组:`)
    for (let i = 0; i < duplicates.length; i++) {
      const group = duplicates[i]
      console.log(`\n  [组 ${i + 1}] ${group.files.length} 个重复文件`)
      console.log(`  Hash: ${group.hash}`)
      console.log(`  预览: ${group.contentPreview}...`)
      console.log(`  文件:`)
      for (const file of group.files) {
        console.log(`    - ${file}`)
      }
    }
    
    console.log(`\n📋 去重建议:`)
    console.log(`  1. 保留一个版本，删除其他重复文件`)
    console.log(`  2. 优先保留标准位置的文件（如 reference/、explanation/、how-to/）`)
    console.log(`  3. 删除 archive/ 和 deprecated-docs/ 中的重复文件`)
    console.log(`  4. 更新引用这些文件的文档`)
  } else {
    console.log('\n✅ 未发现内容重复的文档')
  }
  
  console.log('\n' + '='.repeat(70))
}

function main(): void {
  try {
    console.log('[2026-07-14] 🔍 开始扫描文档内容...')
    const duplicates = scanDocs()
    printReport(duplicates)
    
    if (duplicates.length > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (error) {
    console.error('[2026-07-14] ❌ 审计失败:', error)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

export { scanDocs, DuplicateGroup }
