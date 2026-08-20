#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
// 审计脚本位于 scripts/audit/，需上溯 2 级到项目根；fallback 到 process.cwd() 保持与 npm 脚本一致
const ROOT = resolve(__dirname, '..', '..')

interface VisualIssue {
  type: 'error' | 'warning' | 'info'
  message: string
  file: string
  line?: number
}

function scanCharts(): VisualIssue[] {
  const issues: VisualIssue[] = []
  const chartsDir = join(ROOT, 'src', 'components', 'chart')
  
  if (!existsSync(chartsDir)) {
    issues.push({ type: 'error', message: '图表组件目录不存在', file: chartsDir })
    return issues
  }

  try {
    const output = execSync(`git ls-files "${chartsDir}" --recurse-submodules`, {
      encoding: 'utf-8',
      cwd: ROOT,
    })
    const files = output.split('\n').filter((f) => f.trim().endsWith('.tsx'))
    
    for (const file of files) {
      if (!file.trim()) continue
      const filePath = join(ROOT, file.trim())
      const content = readFileSync(filePath, 'utf-8')
      
      if (!content.includes('colors={')) {
        issues.push({ type: 'warning', message: '图表组件未配置颜色属性', file: filePath })
      }
      
      if (content.includes('text-red-') || content.includes('text-green-')) {
        issues.push({ type: 'warning', message: '图表组件存在硬编码颜色', file: filePath })
      }
    }
  } catch {
    issues.push({ type: 'error', message: '扫描图表组件失败', file: chartsDir })
  }

  return issues
}

function scanDashboardLayout(): VisualIssue[] {
  const issues: VisualIssue[] = []
  const cockpitDir = join(ROOT, 'src', 'cockpit')
  
  if (!existsSync(cockpitDir)) {
    issues.push({ type: 'warning', message: '驾驶舱目录不存在', file: cockpitDir })
    return issues
  }

  try {
    const output = execSync(`git ls-files "${cockpitDir}" --recurse-submodules`, {
      encoding: 'utf-8',
      cwd: ROOT,
    })
    const files = output.split('\n').filter((f) => f.trim().endsWith('.tsx'))
    
    for (const file of files) {
      if (!file.trim()) continue
      const filePath = join(ROOT, file.trim())
      const content = readFileSync(filePath, 'utf-8')
      
      if (content.includes('width:') && content.includes('px')) {
        issues.push({ type: 'warning', message: '布局组件存在硬编码宽度', file: filePath })
      }
    }
  } catch {
    issues.push({ type: 'error', message: '扫描驾驶舱布局失败', file: cockpitDir })
  }

  return issues
}

function scanColorTokens(): VisualIssue[] {
  const issues: VisualIssue[] = []
  
  try {
    const result = execSync('npm run audit:tokens', {
      encoding: 'utf-8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    
    if (result.includes('violation')) {
      issues.push({ type: 'warning', message: '存在颜色令牌违规', file: '全局' })
    }
  } catch {
    issues.push({ type: 'info', message: '颜色令牌审计跳过', file: '全局' })
  }

  return issues
}

function scanResponsiveDesign(): VisualIssue[] {
  const issues: VisualIssue[] = []
  const pagesDir = join(ROOT, 'src', 'pages')
  
  try {
    const output = execSync(`git ls-files "${pagesDir}" --recurse-submodules`, {
      encoding: 'utf-8',
      cwd: ROOT,
    })
    const files = output.split('\n').filter((f) => f.trim().endsWith('.tsx'))
    
    for (const file of files) {
      if (!file.trim()) continue
      const filePath = join(ROOT, file.trim())
      const content = readFileSync(filePath, 'utf-8')
      
      if (!content.includes('useMediaQuery') && !content.includes('sm:') && !content.includes('md:') && !content.includes('lg:')) {
        issues.push({ type: 'info', message: '页面组件可能缺少响应式处理', file: filePath })
      }
    }
  } catch {
    issues.push({ type: 'error', message: '扫描响应式设计失败', file: pagesDir })
  }

  return issues
}

function main(): void {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║         数据展示效果审计 — Visual Audit                  ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log('')

  const allIssues: VisualIssue[] = [
    ...scanCharts(),
    ...scanDashboardLayout(),
    ...scanColorTokens(),
    ...scanResponsiveDesign(),
  ]

  const errors = allIssues.filter((i) => i.type === 'error')
  const warnings = allIssues.filter((i) => i.type === 'warning')
  const infos = allIssues.filter((i) => i.type === 'info')

  console.log(`扫描结果: ${errors.length} 错误 | ${warnings.length} 警告 | ${infos.length} 提示`)
  console.log('')

  if (errors.length > 0) {
    console.log('❌ 错误:')
    for (const issue of errors) {
      console.log(`  - ${issue.message} [${issue.file}]`)
    }
    console.log('')
  }

  if (warnings.length > 0) {
    console.log('⚠️  警告:')
    for (const issue of warnings) {
      console.log(`  - ${issue.message} [${issue.file}]`)
    }
    console.log('')
  }

  if (infos.length > 0) {
    console.log('ℹ️  提示:')
    for (const issue of infos) {
      console.log(`  - ${issue.message} [${issue.file}]`)
    }
    console.log('')
  }

  if (allIssues.length === 0) {
    console.log('✅ 未发现数据展示效果问题')
    process.exit(0)
  }

  if (errors.length > 0) {
    process.exit(1)
  }
  
  process.exit(0)
}

main()