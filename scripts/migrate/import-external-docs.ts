#!/usr/bin/env tsx
/**
 * @module scripts/migrate/import-external-docs
 * @description 从外部目录导入文档到项目 docs/ 目录
 * 
 * 功能：
 * 1. 扫描外部 docs 目录（桌面 docs）
 * 2. 比对项目 docs 目录中已有的文档
 * 3. 将缺失的文档复制到项目中对应的位置
 * 4. 更新 registry-index.md 索引
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const __filename = new URL(import.meta.url).pathname
const __dirname = dirname(__filename).replace(/^\/([A-Z]:)/, '$1')
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const PROJECT_DOCS_DIR = join(PROJECT_ROOT, 'docs')
// 外部文档目录默认当前用户桌面 docs；可用 EXTERNAL_DOCS_DIR 覆盖（不再硬编码用户目录）
const EXTERNAL_DOCS_DIR = process.env.EXTERNAL_DOCS_DIR || path.join(os.homedir(), 'Desktop', 'docs')

interface DocMapping {
  externalPattern: string[]
  targetDir: string
  category: string
}

const DOC_MAPPINGS: DocMapping[] = [
  {
    externalPattern: ['01-requirements/*.md'],
    targetDir: 'reference',
    category: '需求文档'
  },
  {
    externalPattern: ['02-design/*.md'],
    targetDir: 'explanation/design',
    category: '设计文档'
  },
  {
    externalPattern: ['03-development/*.md'],
    targetDir: 'explanation',
    category: '开发文档'
  },
  {
    externalPattern: ['04-testing/*.md'],
    targetDir: 'how-to/testing',
    category: '测试文档'
  },
  {
    externalPattern: ['05-deployment/*.md'],
    targetDir: 'reference',
    category: '部署文档'
  },
  {
    externalPattern: ['06-project-management/*.md'],
    targetDir: 'reference/project',
    category: '项目管理文档'
  },
  {
    externalPattern: ['07-archive/*.md'],
    targetDir: 'archive',
    category: '归档文档'
  },
  {
    externalPattern: ['audit/*.md'],
    targetDir: 'reports/audit',
    category: '审计报告'
  },
  {
    externalPattern: ['reports/*.md'],
    targetDir: 'reports',
    category: '报告文档'
  },
  {
    externalPattern: ['reports/audit/*.md'],
    targetDir: 'reports/audit',
    category: '审计报告'
  },
  {
    externalPattern: ['changelogs/**/*.md'],
    targetDir: 'reference/project/changelogs',
    category: '变更日志'
  },
  {
    externalPattern: ['drafts/*.md'],
    targetDir: 'drafts',
    category: '草稿文档'
  },
  {
    externalPattern: ['implementation/adr/*.md'],
    targetDir: 'explanation',
    category: 'ADR 文档'
  },
  {
    externalPattern: ['architecture/*.md'],
    targetDir: 'explanation',
    category: '架构文档'
  },
  {
    externalPattern: ['guides/*.md'],
    targetDir: 'how-to',
    category: '指南文档'
  },
  {
    externalPattern: ['strategy/*.md'],
    targetDir: 'explanation',
    category: '策略文档'
  },
  {
    externalPattern: ['*.md'],
    targetDir: 'reference',
    category: '其他文档'
  }
]

function getProjectPath(externalPath: string): string {
  const normalizedExternal = externalPath.replace(/\\/g, '/')
  const normalizedBase = EXTERNAL_DOCS_DIR.replace(/\\/g, '/')
  
  let relativePath = normalizedExternal.substring(normalizedBase.length)
  relativePath = relativePath.replace(/^[\\/]/, '')
  
  for (const mapping of DOC_MAPPINGS) {
    for (const pattern of mapping.externalPattern) {
      const patternWithoutExt = pattern.replace('/*.md', '').replace('/**/*.md', '')
      if (relativePath.startsWith(patternWithoutExt)) {
        let fileName = relativePath.substring(patternWithoutExt.length)
        if (fileName.startsWith('/')) fileName = fileName.substring(1)
        if (!fileName) continue
        return join(PROJECT_DOCS_DIR, mapping.targetDir, fileName)
      }
    }
  }
  
  return join(PROJECT_DOCS_DIR, 'reference', relativePath)
}

function importDocs(): { imported: string[]; skipped: string[]; errors: string[] } {
  const imported: string[] = []
  const skipped: string[] = []
  const errors: string[] = []
  
  console.log('[2026-07-14] 🔍 开始扫描外部文档目录...')
  
  function scanDir(dir: string): void {
    if (!existsSync(dir)) {
      console.error(`[2026-07-14] ❌ 目录不存在: ${dir}`)
      return
    }
    
    const items = readdirSync(dir, { withFileTypes: true })
    
    for (const item of items) {
      const fullPath = join(dir, item.name)
      
      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && !item.name.startsWith('_')) {
          scanDir(fullPath)
        }
      } else {
        if (item.name.endsWith('.md')) {
          const projectPath = getProjectPath(fullPath)
          
          if (existsSync(projectPath)) {
            skipped.push(relative(PROJECT_ROOT, projectPath))
            continue
          }
          
          try {
            const targetDir = dirname(projectPath)
            if (!existsSync(targetDir)) {
              mkdirSync(targetDir, { recursive: true })
            }
            
            copyFileSync(fullPath, projectPath)
            imported.push(relative(PROJECT_ROOT, projectPath))
            console.log(`[2026-07-14] ✅ 导入: ${relative(PROJECT_ROOT, projectPath)}`)
          } catch (error) {
            errors.push(`${relative(PROJECT_ROOT, projectPath)}: ${(error as Error).message}`)
            console.error(`[2026-07-14] ❌ 导入失败: ${relative(PROJECT_ROOT, projectPath)}`)
          }
        }
      }
    }
  }
  
  scanDir(EXTERNAL_DOCS_DIR)
  
  return { imported, skipped, errors }
}

function printReport(result: { imported: string[]; skipped: string[]; errors: string[] }): void {
  console.log('\n' + '='.repeat(70))
  console.log('外部文档导入报告')
  console.log('='.repeat(70))
  
  console.log(`\n📊 统计:`)
  console.log(`  已导入: ${result.imported.length}`)
  console.log(`  已存在跳过: ${result.skipped.length}`)
  console.log(`  导入失败: ${result.errors.length}`)
  
  if (result.imported.length > 0) {
    console.log(`\n✅ 已导入文档:`)
    for (const path of result.imported) {
      console.log(`  ${path}`)
    }
  }
  
  if (result.errors.length > 0) {
    console.log(`\n❌ 导入失败:`)
    for (const error of result.errors) {
      console.log(`  ${error}`)
    }
  }
  
  console.log('\n' + '='.repeat(70))
}

function main(): void {
  try {
    const result = importDocs()
    printReport(result)
    
    if (result.errors.length > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (error) {
    console.error('[2026-07-14] ❌ 导入失败:', error)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

export { importDocs }
