#!/usr/bin/env tsx
/**
 * @module scripts/sync/test-sync
 * @description 测试期望自动校准模块 — 捕获实际页面结构，对比并更新测试用例中的期望
 *
 * 核心能力：
 *   1. 解析 Playwright 测试文件，提取路由和期望的元素（heading/button/link/text）
 *   2. 使用 Playwright 导航到实际页面，捕获真实的 accessibility snapshot
 *   3. 对比差异：heading level 不匹配、按钮名称不匹配、路由路径不匹配、元素数量不匹配
 *   4. 生成差异报告，支持 --fix 自动修复
 *
 * 用法：
 *   npx tsx scripts/sync/test-sync.ts [选项]
 *
 * 选项：
 *   --watch          监听模式：启动开发服务器，监听代码变更自动重新校准
 *   --fix            自动修复可修复的不匹配项
 *   --report <path>  报告输出路径（缺省：e2e/reports/test-sync/）
 *   --files <glob>   指定待校准的测试文件（缺省：e2e/**/*.spec.ts）
 *   --dry-run        只检测不修复
 *   --port <n>       开发服务器端口（缺省：3000）
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const E2E_DIR = join(ROOT, 'e2e')
const REPORT_DIR = join(ROOT, 'e2e/reports/test-sync')

interface ExtractedTest {
  filePath: string
  route: string
  expectedElements: ExpectedElement[]
}

interface ExpectedElement {
  type: 'heading' | 'button' | 'link' | 'text'
  name: string
  level?: number
}

interface ActualElement {
  type: 'heading' | 'button' | 'link' | 'text'
  name: string
  level?: number
  role?: string
}

interface Mismatch {
  route: string
  elementType: string
  expected: string
  actual: string | string[]
  fixable: boolean
  file: string
  line: number
}

function parseTestFile(filePath: string): ExtractedTest[] {
  const content = readFileSync(filePath, 'utf-8')
  const tests: ExtractedTest[] = []

  const describeBlocks = content.match(/test\.describe\(['"]([^'"]+)['"],\s*async \(\) => \{([\s\S]*?)\}\)/g) || []

  for (const block of describeBlocks) {
    const routeMatches = block.match(/await page\.goto\(['"]([^'"]+)['"]\)/g)
    if (!routeMatches) continue

    const route = routeMatches[0].match(/await page\.goto\(['"]([^'"]+)['"]\)/)?.[1]
    if (!route) continue

    const expectedElements: ExpectedElement[] = []

    const headingMatches = block.match(/getByRole\(['"]heading['"],\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*\}/g) || []
    for (const match of headingMatches) {
      const name = match.match(/name:\s*['"]([^'"]+)['"]/)?.[1]
      const level = match.match(/level:\s*(\d+)/)?.[1]
      if (name) {
        expectedElements.push({
          type: 'heading',
          name,
          level: level ? parseInt(level) : undefined,
        })
      }
    }

    const buttonMatches = block.match(/getByRole\(['"]button['"],\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*\}/g) || []
    for (const match of buttonMatches) {
      const name = match.match(/name:\s*['"]([^'"]+)['"]/)?.[1]
      if (name) {
        expectedElements.push({ type: 'button', name })
      }
    }

    const textMatches = block.match(/getByText\(['"]([^'"]+)['"]\)/g) || []
    for (const match of textMatches) {
      const name = match.match(/getByText\(['"]([^'"]+)['"]\)/)?.[1]
      if (name) {
        expectedElements.push({ type: 'text', name })
      }
    }

    if (expectedElements.length > 0) {
      tests.push({ filePath, route, expectedElements })
    }
  }

  return tests
}

async function captureActualPage(page: Page, route: string): Promise<ActualElement[]> {
  try {
    await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(2000)

    const snapshot = await page.accessibility.snapshot({ interestingOnly: true })

    const elements: ActualElement[] = []

    function extractElements(node: any) {
      if (!node) return

      if (node.role === 'heading') {
        elements.push({
          type: 'heading',
          name: node.name || '',
          level: node.level ? parseInt(node.level) : undefined,
          role: node.role,
        })
      } else if (node.role === 'button') {
        elements.push({
          type: 'button',
          name: node.name || '',
          role: node.role,
        })
      } else if (node.role === 'link') {
        elements.push({
          type: 'link',
          name: node.name || '',
          role: node.role,
        })
      } else if (node.name && node.name.length > 0 && node.role !== 'document') {
        elements.push({
          type: 'text',
          name: node.name || '',
          role: node.role,
        })
      }

      if (node.children) {
        for (const child of node.children) {
          extractElements(child)
        }
      }
    }

    extractElements(snapshot)
    return elements
  } catch (error) {
    console.error(`❌ 捕获页面失败 ${route}:`, error)
    return []
  }
}

function findMismatches(
  expected: ExpectedElement[],
  actual: ActualElement[],
  route: string,
  filePath: string
): Mismatch[] {
  const mismatches: Mismatch[] = []

  for (const exp of expected) {
    if (exp.type === 'heading') {
      const found = actual.filter((a) => a.type === 'heading' && a.name === exp.name)

      if (found.length === 0) {
        const actualNames = actual.filter((a) => a.type === 'heading').map((a) => a.name)
        mismatches.push({
          route,
          elementType: 'heading',
          expected: exp.name,
          actual: actualNames.length > 0 ? actualNames : ['未找到'],
          fixable: false,
          file: filePath,
          line: 0,
        })
      } else if (exp.level && found[0].level !== exp.level) {
        mismatches.push({
          route,
          elementType: 'heading',
          expected: `${exp.name} (level ${exp.level})`,
          actual: `${found[0].name} (level ${found[0].level})`,
          fixable: true,
          file: filePath,
          line: 0,
        })
      }
    } else if (exp.type === 'button') {
      const found = actual.filter((a) => a.type === 'button' && a.name === exp.name)

      if (found.length === 0) {
        const actualNames = actual.filter((a) => a.type === 'button').map((a) => a.name)
        mismatches.push({
          route,
          elementType: 'button',
          expected: exp.name,
          actual: actualNames.slice(0, 10),
          fixable: false,
          file: filePath,
          line: 0,
        })
      }
    } else if (exp.type === 'text') {
      const found = actual.filter((a) => a.name && a.name.includes(exp.name))

      if (found.length === 0) {
        mismatches.push({
          route,
          elementType: 'text',
          expected: exp.name,
          actual: ['文本未找到'],
          fixable: false,
          file: filePath,
          line: 0,
        })
      }
    }
  }

  return mismatches
}

function applyFix(content: string, mismatch: Mismatch): string {
  if (!mismatch.fixable) return content

  if (mismatch.elementType === 'heading') {
    const expectedLevel = parseInt(mismatch.expected.match(/level (\d+)/)?.[1] || '0')
    const actualLevel = parseInt(mismatch.actual.match(/level (\d+)/)?.[1] || '0')

    if (expectedLevel && actualLevel) {
      return content.replace(
        new RegExp(`getByRole\\(['"]heading['"],\\s*\\{[^}]*name:\\s*['"]${escapeRegex(mismatch.expected.replace(/ \(level \d+\)/, ''))}['"][^}]*level:\\s*${expectedLevel}[^}]*\\}`, 'g'),
        (match) => match.replace(`level: ${expectedLevel}`, `level: ${actualLevel}`)
      )
    }
  }

  return content
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface SyncReport {
  timestamp: string
  totalRoutes: number
  totalMismatches: number
  fixableMismatches: number
  fixedCount: number
  mismatches: Mismatch[]
  summary: string
}

async function runSync(browser: Browser, testFiles: string[], fix: boolean): Promise<SyncReport> {
  const mismatches: Mismatch[] = []
  let fixedCount = 0

  for (const file of testFiles) {
    console.log(`🔍 解析测试文件: ${file}`)
    const tests = parseTestFile(file)

    for (const test of tests) {
      console.log(`   📄 路由: ${test.route}`)
      const page = await browser.newPage()
      const actualElements = await captureActualPage(page, test.route)
      await page.close()

      const fileMismatches = findMismatches(test.expectedElements, actualElements, test.route, file)
      mismatches.push(...fileMismatches)

      for (const m of fileMismatches) {
        console.log(`      ❌ ${m.elementType}: 期望 "${m.expected}"`)
        if (Array.isArray(m.actual)) {
          console.log(`         实际: ${m.actual.join(', ')}`)
        } else {
          console.log(`         实际: ${m.actual}`)
        }
      }
    }
  }

  if (fix) {
    const filesToFix = new Set(mismatches.filter((m) => m.fixable).map((m) => m.file))

    for (const file of filesToFix) {
      let content = readFileSync(file, 'utf-8')
      const fileMismatches = mismatches.filter((m) => m.file === file && m.fixable)

      for (const m of fileMismatches) {
        const originalContent = content
        content = applyFix(content, m)
        if (content !== originalContent) {
          fixedCount++
          console.log(`✅ 已修复: ${file} - ${m.expected} -> ${m.actual}`)
        }
      }

      writeFileSync(file, content)
    }
  }

  const totalRoutes = new Set(mismatches.map((m) => m.route)).size
  const fixableMismatches = mismatches.filter((m) => m.fixable).length

  return {
    timestamp: new Date().toISOString(),
    totalRoutes,
    totalMismatches: mismatches.length,
    fixableMismatches,
    fixedCount,
    mismatches,
    summary: `检测 ${totalRoutes} 个路由，发现 ${mismatches.length} 个不匹配（${fixableMismatches} 个可自动修复，已修复 ${fixedCount} 个）`,
  }
}

function generateReport(report: SyncReport, outputPath: string): void {
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true })
  }

  const reportFile = join(outputPath, `test-sync-${Date.now()}.json`)
  writeFileSync(reportFile, JSON.stringify(report, null, 2))

  const summaryFile = join(outputPath, 'docs/reports/doc-sync/latest-summary.md')
  const markdown = `# 测试同步报告\n\n**时间**: ${report.timestamp}\n\n## 摘要\n${report.summary}\n\n## 不匹配详情\n\n${
    report.mismatches.length > 0
      ? report.mismatches
          .map(
            (m) => `### ${m.route}\n- 类型: ${m.elementType}\n- 期望: ${m.expected}\n- 实际: ${Array.isArray(m.actual) ? m.actual.join(', ') : m.actual}\n- 可修复: ${m.fixable ? '是' : '否'}\n- 文件: ${m.file}\n`
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
  const filesArg = args.includes('--files') ? args[args.indexOf('--files') + 1] : 'e2e/**/*.spec.ts'
  const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 3000

  console.log('🚀 测试同步模块启动')
  console.log(`   模式: ${watchMode ? '监听模式' : '按需模式'}`)
  console.log(`   自动修复: ${fix}`)
  console.log(`   报告路径: ${reportPath}`)

  if (watchMode) {
    console.log(`\n🔄 启动开发服务器 (端口 ${port})...`)
    const devServer = execSync(`npm run dev`, {
      cwd: ROOT,
      stdio: 'ignore',
      detached: true,
    })

    console.log(`\n👀 监听模式启动，等待开发服务器就绪...`)
    await new Promise((resolve) => setTimeout(resolve, 15000))

    const browser = await chromium.launch({ headless: true })

    const runCycle = async () => {
      console.log(`\n🔄 开始校准周期 (${new Date().toLocaleTimeString()})`)

      const testFiles = execSync(`npx glob ${filesArg}`, { cwd: ROOT, encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(Boolean)

      const report = await runSync(browser, testFiles, fix && !dryRun)
      generateReport(report, reportPath)

      console.log(`\n📋 ${report.summary}`)
    }

    await runCycle()

    watch(E2E_DIR, { recursive: true }, async (eventType, filename) => {
      if (extname(filename) === '.ts' && eventType === 'change') {
        console.log(`\n📝 检测到测试文件变更: ${filename}`)
        await runCycle()
      }
    })

    watch(join(ROOT, 'src'), { recursive: true }, async (eventType, filename) => {
      if (extname(filename) === '.tsx') {
        console.log(`\n📝 检测到源码变更: ${filename}`)
        await runCycle()
      }
    })

    console.log(`\n✅ 监听模式运行中，按 Ctrl+C 退出`)
  } else {
    const testFiles = execSync(`npx glob ${filesArg}`, { cwd: ROOT, encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean)

    console.log(`\n🔍 发现 ${testFiles.length} 个测试文件`)

    console.log(`\n🖥️ 启动开发服务器...`)
    const devServer = execSync(`npm run dev`, {
      cwd: ROOT,
      stdio: 'ignore',
      detached: true,
    })

    await new Promise((resolve) => setTimeout(resolve, 15000))

    const browser = await chromium.launch({ headless: true })
    const report = await runSync(browser, testFiles, fix && !dryRun)
    await browser.close()

    execSync(`taskkill /f /im node.exe`, { stdio: 'ignore' })

    generateReport(report, reportPath)

    console.log(`\n📋 ${report.summary}`)

    if (report.totalMismatches > 0) {
      process.exitCode = 1
    }
  }
}

main().catch((error) => {
  console.error('❌ 测试同步模块执行失败:', error)
  process.exit(1)
})