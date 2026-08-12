#!/usr/bin/env tsx
/**
 * @module scripts/sync/doc-sync
 * @description 文档自动校准模块 — 扫描代码变更，对比并更新文档内容
 *
 * 核心能力：
 *   1. 扫描路由定义，提取页面标题和路径
 *   2. 扫描组件定义，提取 props、接口和导出
 *   3. 扫描测试文件，提取测试用例和断言
 *   4. 对比现有文档，检测滞后内容
 *   5. 生成差异报告，支持 --fix 自动修复
 *
 * 用法：
 *   npx tsx scripts/sync/doc-sync.ts [选项]
 *
 * 选项：
 *   --watch          监听模式：启动开发服务器，监听代码变更自动重新校准
 *   --fix            自动修复可修复的不匹配项
 *   --report <path>  报告输出路径（缺省：docs/reports/doc-sync/）
 *   --dry-run        只检测不修复
 *   --since <ref>    git diff 起点（缺省：上次运行记录的 ref）
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const SRC_DIR = join(ROOT, 'src')
const REPORT_DIR = join(ROOT, 'docs/reports/doc-sync')
const STATE_FILE = join(REPORT_DIR, '.last-ref')

interface RouteDefinition {
  path: string
  title: string
  component: string
  file: string
}

interface ComponentDefinition {
  name: string
  props: string[]
  file: string
}

interface DocSection {
  title: string
  content: string
  file: string
}

interface DocMismatch {
  type: 'route' | 'component' | 'test' | 'api'
  docFile: string
  docSection: string
  actual: string | string[]
  expected: string | string[]
  fixable: boolean
}

function parseRoutes(): RouteDefinition[] {
  const routes: RouteDefinition[] = []
  const routeFiles = execSync(`npx glob "src/**/*route*.ts"`, { cwd: ROOT, encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean)

  for (const file of routeFiles) {
    const content = readFileSync(join(ROOT, file), 'utf-8')

    const routeBlocks = content.match(/\{\s*path:\s*['"]([^'"]+)['"][\s\S]*?\}/g) || []

    for (const block of routeBlocks) {
      const path = block.match(/path:\s*['"]([^'"]+)['"]/)?.[1]
      const description = block.match(/description:\s*['"]([^'"]+)['"]/)?.[1]

      if (path) {
        routes.push({
          path,
          title: description || '未命名',
          component: '',
          file,
        })
      }
    }
  }

  return routes
}

function parseComponents(): ComponentDefinition[] {
  const components: ComponentDefinition[] = []
  const componentFiles = execSync(`npx glob "src/**/*.tsx"`, { cwd: ROOT, encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean)

  for (const file of componentFiles) {
    const content = readFileSync(join(ROOT, file), 'utf-8')

    const componentMatches = content.match(/export\s+(?:default\s+)?function\s+(\w+)/g) || []
    const interfaceMatches = content.match(/export\s+interface\s+(\w+Props)/g) || []

    for (const match of componentMatches) {
      const name = match.match(/function\s+(\w+)/)?.[1]
      if (name) {
        const props: string[] = []
        const propsMatch = content.match(new RegExp(`${name}\\(\\s*(\\{[^}]*\\})\\s*\\)`, 's'))
        if (propsMatch) {
          const propsStr = propsMatch[1]
          const propNames = propsStr.match(/\w+:/g) || []
          props.push(...propNames.map((p) => p.replace(':', '')))
        }

        components.push({ name, props, file })
      }
    }

    for (const match of interfaceMatches) {
      const name = match.match(/interface\s+(\w+)/)?.[1]
      if (name) {
        const props: string[] = []
        const interfaceMatch = content.match(new RegExp(`interface\\s+${name}\\s*\\{([^}]+)\\}`, 's'))
        if (interfaceMatch) {
          const propLines = interfaceMatch[1].split('\n')
          for (const line of propLines) {
            const propMatch = line.match(/(\w+)\s*:/)
            if (propMatch) {
              props.push(propMatch[1])
            }
          }
        }

        components.push({ name, props, file })
      }
    }
  }

  return components
}

function parseDocs(): DocSection[] {
  const sections: DocSection[] = []
  const docFiles = execSync(`npx glob "docs/**/*.md"`, { cwd: ROOT, encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean)

  for (const file of docFiles) {
    const content = readFileSync(join(ROOT, file), 'utf-8')

    const headingMatches = content.match(/^(#{1,6})\s+(.+)$/gm) || []
    for (const match of headingMatches) {
      const level = match.match(/^(#+)/)?.[1].length
      const title = match.match(/^#{1,6}\s+(.+)$/)?.[1]

      if (title) {
        sections.push({
          title,
          content: '',
          file,
        })
      }
    }
  }

  return sections
}

function findDocMismatches(
  routes: RouteDefinition[],
  components: ComponentDefinition[],
  docs: DocSection[]
): DocMismatch[] {
  const mismatches: DocMismatch[] = []

  const docTitles = docs.map((d) => d.title.toLowerCase())

  for (const route of routes) {
    if (!docTitles.includes(route.title.toLowerCase()) && !docTitles.includes(route.path.toLowerCase())) {
      mismatches.push({
        type: 'route',
        docFile: '未知文档',
        docSection: route.title,
        actual: ['文档中未找到此路由'],
        expected: route.path,
        fixable: true,
      })
    }
  }

  for (const component of components) {
    const hasDoc = docTitles.some(
      (t) => t.includes(component.name.toLowerCase()) || t.includes(component.name.replace('Props', '').toLowerCase())
    )

    if (!hasDoc && component.name.length > 3) {
      mismatches.push({
        type: 'component',
        docFile: '未知文档',
        docSection: component.name,
        actual: ['文档中未找到此组件'],
        expected: `组件 ${component.name} (${component.props.length} 个 props)`,
        fixable: true,
      })
    }
  }

  const routeDocs = docs.filter((d) => d.title.toLowerCase().includes('路由') || d.title.toLowerCase().includes('导航'))
  for (const doc of routeDocs) {
    const docContent = readFileSync(join(ROOT, doc.file), 'utf-8')
    for (const route of routes) {
      if (!docContent.includes(route.path) && !docContent.includes(route.title)) {
        mismatches.push({
          type: 'route',
          docFile: doc.file,
          docSection: doc.title,
          actual: ['文档中未包含此路由'],
          expected: `${route.path} - ${route.title}`,
          fixable: true,
        })
      }
    }
  }

  return mismatches
}

function generateDocStub(mismatch: DocMismatch): string {
  if (mismatch.type === 'route') {
    return `## ${mismatch.expected}\n\n**路径**: ${mismatch.expected}\n\n**功能描述**: 待补充\n\n`
  } else if (mismatch.type === 'component') {
    return `## ${mismatch.docSection}\n\n**文件路径**: 待补充\n\n**Props**: \n\n| 属性名 | 类型 | 默认值 | 说明 |\n|--------|------|--------|------|\n| - | - | - | 待补充 |\n\n`
  }
  return ''
}

interface SyncReport {
  timestamp: string
  totalRoutes: number
  totalComponents: number
  totalDocs: number
  totalMismatches: number
  fixableMismatches: number
  fixedCount: number
  mismatches: DocMismatch[]
  summary: string
}

async function runSync(fix: boolean): Promise<SyncReport> {
  console.log('🔍 扫描路由定义...')
  const routes = parseRoutes()
  console.log(`   发现 ${routes.length} 个路由`)

  console.log('🔍 扫描组件定义...')
  const components = parseComponents()
  console.log(`   发现 ${components.length} 个组件`)

  console.log('🔍 扫描文档...')
  const docs = parseDocs()
  console.log(`   发现 ${docs.length} 个文档章节`)

  console.log('🔍 对比差异...')
  const mismatches = findDocMismatches(routes, components, docs)

  for (const m of mismatches) {
    console.log(`   ❌ ${m.type}: ${m.docSection}`)
    console.log(`      期望: ${m.expected}`)
    console.log(`      实际: ${Array.isArray(m.actual) ? m.actual.join(', ') : m.actual}`)
  }

  let fixedCount = 0

  if (fix) {
    const overviewFile = join(DOCS_DIR, 'reference', 'route-overview.md')
    if (!existsSync(overviewFile)) {
      writeFileSync(overviewFile, `# 路由概览\n\n> 自动生成的路由文档\n\n## 路由列表\n\n`)
    }

    let overviewContent = readFileSync(overviewFile, 'utf-8')

    for (const m of mismatches) {
      if (m.fixable && m.type === 'route') {
        if (!overviewContent.includes(m.expected)) {
          overviewContent += `\n### ${m.expected}\n\n- **路径**: ${m.expected}\n- **标题**: ${m.docSection}\n\n`
          fixedCount++
          console.log(`✅ 已添加路由文档: ${m.expected}`)
        }
      }
    }

    writeFileSync(overviewFile, overviewContent)
  }

  return {
    timestamp: new Date().toISOString(),
    totalRoutes: routes.length,
    totalComponents: components.length,
    totalDocs: docs.length,
    totalMismatches: mismatches.length,
    fixableMismatches: mismatches.filter((m) => m.fixable).length,
    fixedCount,
    mismatches,
    summary: `扫描 ${routes.length} 个路由, ${components.length} 个组件, ${docs.length} 个文档章节, 发现 ${mismatches.length} 个不匹配（${mismatches.filter((m) => m.fixable).length} 个可自动修复，已修复 ${fixedCount} 个）`,
  }
}

function generateReport(report: SyncReport, outputPath: string): void {
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true })
  }

  const reportFile = join(outputPath, `doc-sync-${Date.now()}.json`)
  writeFileSync(reportFile, JSON.stringify(report, null, 2))

  const summaryFile = join(outputPath, 'docs/reports/doc-sync/latest-summary.md')
  const markdown = `# 文档同步报告\n\n**时间**: ${report.timestamp}\n\n## 摘要\n${report.summary}\n\n## 统计\n\n| 类别 | 数量 |\n|------|------|\n| 路由 | ${report.totalRoutes} |\n| 组件 | ${report.totalComponents} |\n| 文档章节 | ${report.totalDocs} |\n| 不匹配 | ${report.totalMismatches} |\n| 可修复 | ${report.fixableMismatches} |\n| 已修复 | ${report.fixedCount} |\n\n## 不匹配详情\n\n${
    report.mismatches.length > 0
      ? report.mismatches
          .map(
            (m) => `### ${m.docSection}\n- 类型: ${m.type}\n- 期望: ${m.expected}\n- 实际: ${Array.isArray(m.actual) ? m.actual.join(', ') : m.actual}\n- 可修复: ${m.fixable ? '是' : '否'}\n- 文档: ${m.docFile}\n`
          )
          .join('\n')
      : '无不匹配项'
  }`

  writeFileSync(summaryFile, markdown)

  console.log(`📊 报告已输出: ${reportFile}`)
}

async function main() {
  const args = process.argv.slice(2)
  const watchMode = args.includes('--watch')
  const fix = args.includes('--fix')
  const dryRun = args.includes('--dry-run')
  const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : REPORT_DIR

  console.log('🚀 文档同步模块启动')
  console.log(`   模式: ${watchMode ? '监听模式' : '按需模式'}`)
  console.log(`   自动修复: ${fix}`)
  console.log(`   报告路径: ${reportPath}`)

  if (watchMode) {
    const runCycle = async () => {
      console.log(`\n🔄 开始校准周期 (${new Date().toLocaleTimeString()})`)

      const report = await runSync(fix && !dryRun)
      generateReport(report, reportPath)

      console.log(`\n📋 ${report.summary}`)
    }

    await runCycle()

    watch(SRC_DIR, { recursive: true }, async (eventType, filename) => {
      if (extname(filename) === '.tsx' || extname(filename) === '.ts') {
        console.log(`\n📝 检测到源码变更: ${filename}`)
        await runCycle()
      }
    })

    watch(DOCS_DIR, { recursive: true }, async (eventType, filename) => {
      if (extname(filename) === '.md') {
        console.log(`\n📝 检测到文档变更: ${filename}`)
        await runCycle()
      }
    })

    console.log(`\n✅ 监听模式运行中，按 Ctrl+C 退出`)
  } else {
    const report = await runSync(fix && !dryRun)
    generateReport(report, reportPath)

    console.log(`\n📋 ${report.summary}`)

    if (report.totalMismatches > 0) {
      process.exitCode = 1
    }
  }
}

main().catch((error) => {
  console.error('❌ 文档同步模块执行失败:', error)
  process.exit(1)
})