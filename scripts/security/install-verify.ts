/**
 * 安装完成标志验证脚本
 *
 * 4 维度验证安装是否真正完成：
 *   维度 1: 环境就绪验证（Node.js / npm / Playwright / 浏览器驱动）
 *   维度 2: 服务运行验证（preview 服务状态 / 进程 / 端口监听）
 *   维度 3: 配置一致性验证（MCP / 安全策略 / 工具链 / .gitignore）
 *   维度 4: 基础功能测试（页面加载 / DOM 渲染 / 截图能力 / 导航能力）
 *
 * 运行方式：
 *   npx tsx scripts/security/install-verify.ts
 *
 * 退出码：
 *   0 = 全部通过
 *   1 = 有失败项
 */

import { chromium, type Browser, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as net from 'net'
import { execSync, type ExecSyncOptions } from 'child_process'
import { loadSecurityPolicy, checkAuthorization, type SecurityPolicy } from '../../src/config/security-policy'

// ============================================================
// 常量
// ============================================================
const TARGET_URL = 'http://localhost:4173/#/input'
const TARGET_PORT = 4173
const TARGET_HOST = '127.0.0.1'
const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots')
const VERIFY_SCREENSHOT = path.join(SCREENSHOT_DIR, 'install-verify.png')

// 验证结果收集
type VerifyStatus = 'PASS' | 'FAIL' | 'SKIP'
interface VerifyResult {
  dimension: string
  check: string
  status: VerifyStatus
  detail: string
  durationMs?: number
}
const results: VerifyResult[] = []

function record(dimension: string, check: string, status: VerifyStatus, detail: string, durationMs?: number): void {
  results.push({ dimension, check, status, detail, durationMs })
  const symbol = status === 'PASS' ? '[OK]' : status === 'FAIL' ? '[FAIL]' : '[SKIP]'
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[37m'
  const timeStr = durationMs !== undefined ? ` (${durationMs}ms)` : ''
  console.log(`  ${color}${symbol}\x1b[0m ${check}: ${detail}${timeStr}`)
}

// ============================================================
// 工具函数
// ============================================================

/** 检查端口是否被监听 */
function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(3000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

/** 通过 fetch 检测 HTTP 服务是否响应（更可靠，兼容 IPv4/IPv6） */
async function checkHttpService(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return response.ok || response.status > 0
  } catch {
    return false
  }
}

/** 同步执行命令并返回输出 */
function runCmd(cmd: string, options?: ExecSyncOptions): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000, ...options }).trim()
  } catch {
    return ''
  }
}

// ============================================================
// 维度 1: 环境就绪验证
// ============================================================
async function verifyDimension1_Environment(): Promise<void> {
  console.log('\n--- 维度 1: 环境就绪验证 ---')

  // 1.1 Node.js 版本
  const nodeVersion = runCmd('node --version')
  if (nodeVersion) {
    record('环境就绪', 'Node.js 版本', 'PASS', nodeVersion)
  } else {
    record('环境就绪', 'Node.js 版本', 'FAIL', 'Node.js 未安装或不在 PATH')
    return
  }

  // 1.2 npm 版本
  const npmVersion = runCmd('npm --version')
  record('环境就绪', 'npm 版本', npmVersion ? 'PASS' : 'FAIL', npmVersion || 'npm 不可用')

  // 1.3 npx 可用性
  const npxVersion = runCmd('npx --version')
  record('环境就绪', 'npx 可用性', npxVersion ? 'PASS' : 'FAIL', npxVersion || 'npx 不可用')

  // 1.4 Playwright 安装
  const pwVersion = runCmd('npx playwright --version')
  record('环境就绪', 'Playwright 安装', pwVersion ? 'PASS' : 'FAIL', pwVersion || 'Playwright 未安装')

  // 1.5 Chromium 浏览器驱动
  const startTime = Date.now()
  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless: true })
    const version = browser.version()
    record('环境就绪', 'Chromium 驱动', 'PASS', version, Date.now() - startTime)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    record('环境就绪', 'Chromium 驱动', 'FAIL', `启动失败: ${errMsg}`, Date.now() - startTime)
  } finally {
    if (browser) await browser.close()
  }

  // 1.6 tsx 可用性（运行 TS 脚本）
  const tsxVersion = runCmd('npx tsx --version')
  record('环境就绪', 'tsx 可用性', tsxVersion ? 'PASS' : 'FAIL', tsxVersion || 'tsx 未安装')

  // 1.7 项目依赖安装状态
  const nodeModulesExists = fs.existsSync(path.join(process.cwd(), 'node_modules'))
  record('环境就绪', '项目依赖 (node_modules)', nodeModulesExists ? 'PASS' : 'FAIL', nodeModulesExists ? '已安装' : '未安装，需 npm install')

  // 1.8 dist 构建产物
  const distExists = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
  record('环境就绪', '构建产物 (dist)', distExists ? 'PASS' : 'FAIL', distExists ? '已构建' : '未构建，需 npm run build')
}

// ============================================================
// 维度 2: 服务运行验证
// ============================================================
async function verifyDimension2_Service(): Promise<void> {
  console.log('\n--- 维度 2: 服务运行验证 ---')

  // 2.1 端口监听状态（优先使用 fetch，兼容 IPv4/IPv6）
  const portListening = await checkHttpService(`http://localhost:${TARGET_PORT}/`)
  record('服务运行', `端口 ${TARGET_PORT} 监听`, portListening ? 'PASS' : 'FAIL', portListening ? `已监听 localhost:${TARGET_PORT}` : '未监听，需启动 npm run preview')

  if (!portListening) {
    record('服务运行', '进程检查', 'SKIP', '端口未监听，跳过进程检查')
    record('服务运行', 'HTTP 响应', 'SKIP', '端口未监听，跳过 HTTP 检查')
    return
  }

  // 2.2 进程运行情况
  const taskList = runCmd(`netstat -ano | findstr ":${TARGET_PORT}"`)
  if (taskList) {
    const pidMatch = taskList.match(/(\d+)\s*$/m)
    record('服务运行', '进程 PID', pidMatch ? 'PASS' : 'WARN' ?? '', pidMatch ? `PID=${pidMatch[1]}` : '无法提取 PID')
  } else {
    record('服务运行', '进程 PID', 'WARN', 'netstat 未返回结果')
  }

  // 2.3 HTTP 响应验证
  const startTime = Date.now()
  try {
    const response = await fetch(TARGET_URL)
    const status = response.status
    const contentLength = response.headers.get('content-length') || '0'
    record('服务运行', 'HTTP 响应', status === 200 ? 'PASS' : 'FAIL', `status=${status}, content-length=${contentLength}`, Date.now() - startTime)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    record('服务运行', 'HTTP 响应', 'FAIL', `请求失败: ${errMsg}`, Date.now() - startTime)
  }
}

// ============================================================
// 维度 3: 配置一致性验证
// ============================================================
function verifyDimension3_Config(): void {
  console.log('\n--- 维度 3: 配置一致性验证 ---')

  // 3.1 安全策略可加载
  let policy: SecurityPolicy | null = null
  try {
    policy = loadSecurityPolicy()
    record('配置一致性', '安全策略加载', 'PASS', `v${policy.policyVersion}, ${policy.policyName}`)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    record('配置一致性', '安全策略加载', 'FAIL', errMsg)
    return
  }

  // 3.2 MCP 配置可解析
  const mcpJsonPath = path.join(process.cwd(), '.trae', 'mcp.json')
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const raw = fs.readFileSync(mcpJsonPath, 'utf-8').replace(/^\uFEFF/, '').trim()
      const mcpConfig = JSON.parse(raw)
      const servers = Object.keys(mcpConfig.mcpServers || {})
      record('配置一致性', 'MCP 配置解析', 'PASS', `已注册: ${servers.join(', ')}`)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      record('配置一致性', 'MCP 配置解析', 'FAIL', `JSON 解析失败: ${errMsg}`)
    }
  } else {
    record('配置一致性', 'MCP 配置解析', 'FAIL', '.trae/mcp.json 不存在')
  }

  // 3.3 授权策略完整性
  if (policy) {
    const allTools = [
      ...policy.authorizationRules.autoApprove,
      ...policy.authorizationRules.requireConfirmation,
      ...policy.authorizationRules.requireAdminApproval,
    ]
    const duplicates = allTools.filter((t, i) => allTools.indexOf(t) !== i)
    record('配置一致性', '授权策略完整性', duplicates.length === 0 ? 'PASS' : 'FAIL', duplicates.length === 0 ? `${allTools.length} 个工具，无重复` : `重复: ${duplicates.join(',')}`)

    // 3.4 授权检查器可用
    const navAuth = checkAuthorization(policy, 'playwright_navigate')
    record('配置一致性', '授权检查器', navAuth.authorized ? 'PASS' : 'FAIL', `navigate -> ${navAuth.level}`)

    const clickAuth = checkAuthorization(policy, 'playwright_click')
    record('配置一致性', '授权检查器 (click)', !clickAuth.authorized && clickAuth.level === 'requireConfirmation' ? 'PASS' : 'FAIL', `click -> ${clickAuth.level}`)
  }

  // 3.5 .npmrc 配置
  const npmrcPath = path.join(process.cwd(), '.npmrc')
  if (fs.existsSync(npmrcPath)) {
    const npmrc = fs.readFileSync(npmrcPath, 'utf-8')
    const hasIgnoreScripts = npmrc.includes('ignore-scripts=true')
    const hasRegistry = npmrc.includes('registry=')
    record('配置一致性', '.npmrc 配置', hasIgnoreScripts && hasRegistry ? 'PASS' : 'FAIL', `ignore-scripts=${hasIgnoreScripts}, registry=${hasRegistry}`)
  }

  // 3.6 .gitignore 日志保护
  const gitignorePath = path.join(process.cwd(), '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8')
    const hasLogIgnore = gitignore.includes('.trae/logs') || gitignore.includes('*.log')
    record('配置一致性', '.gitignore 日志保护', hasLogIgnore ? 'PASS' : 'FAIL', hasLogIgnore ? '已配置' : '未配置')
  }
}

// ============================================================
// 维度 4: 基础功能测试
// ============================================================
async function verifyDimension4_Function(): Promise<void> {
  console.log('\n--- 维度 4: 基础功能测试 ---')

  // 检查服务是否可用
  const portListening = await checkHttpService(`http://localhost:${TARGET_PORT}/`)
  if (!portListening) {
    record('基础功能', '页面加载', 'SKIP', '服务未启动')
    record('基础功能', 'DOM 渲染', 'SKIP', '服务未启动')
    record('基础功能', '截图能力', 'SKIP', '服务未启动')
    record('基础功能', '导航能力', 'SKIP', '服务未启动')
    return
  }

  let browser: Browser | null = null
  let page: Page | null = null

  try {
    // 4.1 浏览器启动
    const launchStart = Date.now()
    browser = await chromium.launch({ headless: true })
    record('基础功能', '浏览器启动', 'PASS', `Chromium ${browser.version()}`, Date.now() - launchStart)

    page = await browser.newPage()

    // 4.2 页面加载
    const loadStart = Date.now()
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const loadTime = Date.now() - loadStart
    if (response && response.status() === 200) {
      record('基础功能', '页面加载', 'PASS', `status=${response.status()}, ${loadTime}ms`, loadTime)
    } else {
      record('基础功能', '页面加载', 'FAIL', `status=${response?.status() || 'N/A'}`, loadTime)
      return
    }

    // 4.3 DOM 渲染验证
    const renderStart = Date.now()
    try {
      await page.waitForSelector('text=股票池看板', { timeout: 10000 })
      const titleVisible = await page.locator('text=股票池看板').isVisible()
      record('基础功能', 'DOM 渲染', titleVisible ? 'PASS' : 'FAIL', titleVisible ? '关键元素已渲染' : '关键元素不可见', Date.now() - renderStart)
    } catch {
      record('基础功能', 'DOM 渲染', 'FAIL', '等待选择器超时', Date.now() - renderStart)
    }

    // 4.4 截图能力验证
    const screenshotStart = Date.now()
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    }
    await page.screenshot({ path: VERIFY_SCREENSHOT, fullPage: true })
    const screenshotSize = fs.statSync(VERIFY_SCREENSHOT).size
    record('基础功能', '截图能力', screenshotSize > 1000 ? 'PASS' : 'FAIL', `${(screenshotSize / 1024).toFixed(1)} KB`, Date.now() - screenshotStart)

    // 4.5 导航能力验证
    const navStart = Date.now()
    await page.goto('http://localhost:4173/#/analysis', { waitUntil: 'domcontentloaded', timeout: 10000 })
    const analysisUrl = page.url()
    record('基础功能', '导航能力', analysisUrl.includes('analysis') ? 'PASS' : 'FAIL', `当前 URL: ${analysisUrl}`, Date.now() - navStart)

    // 4.6 授权门禁验证（模拟）
    const policy = loadSecurityPolicy()
    const navAuth = checkAuthorization(policy, 'playwright_navigate')
    const clickAuth = checkAuthorization(policy, 'playwright_click')
    const evalAuth = checkAuthorization(policy, 'playwright_evaluate')
    const allAuthCorrect = navAuth.authorized && !clickAuth.authorized && !evalAuth.authorized
    record('基础功能', '授权门禁', allAuthCorrect ? 'PASS' : 'FAIL', `navigate=${navAuth.level}, click=${clickAuth.level}, evaluate=${evalAuth.level}`)

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    record('基础功能', '浏览器测试', 'FAIL', `异常: ${errMsg}`)
  } finally {
    if (browser) await browser.close()
  }
}

// ============================================================
// 报告生成
// ============================================================
function generateReport(): boolean {
  const passCount = results.filter((r) => r.status === 'PASS').length
  const failCount = results.filter((r) => r.status === 'FAIL').length
  const skipCount = results.filter((r) => r.status === 'SKIP').length

  console.log('\n')
  console.log('+============================================================+')
  console.log('|            安装完成标志验证报告                            |')
  console.log('+============================================================+')
  console.log(`|  PASS: ${passCount}  |  FAIL: ${failCount}  |  SKIP: ${skipCount}  |  Total: ${results.length}`)
  console.log('+============================================================+')

  // 按维度汇总
  const dimensions = [...new Set(results.map((r) => r.dimension))]
  console.log('\n按维度汇总:')
  for (const dim of dimensions) {
    const dimResults = results.filter((r) => r.dimension === dim)
    const dimPass = dimResults.filter((r) => r.status === 'PASS').length
    const dimFail = dimResults.filter((r) => r.status === 'FAIL').length
    const dimSkip = dimResults.filter((r) => r.status === 'SKIP').length
    const status = dimFail > 0 ? 'FAIL' : dimSkip > 0 && dimPass === 0 ? 'SKIP' : 'PASS'
    const symbol = status === 'PASS' ? '[OK]' : status === 'FAIL' ? '[FAIL]' : '[SKIP]'
    const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[37m'
    console.log(`  ${color}${symbol}\x1b[0m ${dim}: ${dimPass} PASS, ${dimFail} FAIL, ${dimSkip} SKIP`)
  }

  if (failCount > 0) {
    console.log('\n\x1b[31m[失败项详情]\x1b[0m')
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`  - [${r.dimension}] ${r.check}: ${r.detail}`)
    })
  }

  // 最终结论
  const allPassed = failCount === 0
  console.log('\n+============================================================+')
  if (allPassed) {
    console.log('|  结论: 安装验证通过，系统可投入使用                        |')
  } else {
    console.log(`|  结论: 安装未完成，有 ${failCount} 项失败，请修复后重新验证         |`)
  }
  console.log('+============================================================+')

  // 生成 Markdown 报告
  const reportDir = path.join(process.cwd(), '.trae', 'logs')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }
  const reportPath = path.join(reportDir, `install-verify-${Date.now()}.md`)
  const md = [
    `# 安装完成标志验证报告`,
    ``,
    `**时间**: ${new Date().toISOString()}`,
    `**结论**: ${allPassed ? 'PASS (安装完成)' : 'FAIL (安装未完成)'}`,
    `**统计**: PASS=${passCount} FAIL=${failCount} SKIP=${skipCount}`,
    ``,
    `## 按维度汇总`,
    ``,
    `| 维度 | PASS | FAIL | SKIP | 结论 |`,
    `|------|------|------|------|------|`,
    ...dimensions.map((dim) => {
      const dr = results.filter((r) => r.dimension === dim)
      const dp = dr.filter((r) => r.status === 'PASS').length
      const df = dr.filter((r) => r.status === 'FAIL').length
      const ds = dr.filter((r) => r.status === 'SKIP').length
      return `| ${dim} | ${dp} | ${df} | ${ds} | ${df > 0 ? 'FAIL' : 'PASS'} |`
    }),
    ``,
    `## 详细检查项`,
    ``,
    `| 维度 | 检查项 | 状态 | 详情 | 耗时 |`,
    `|------|--------|------|------|------|`,
    ...results.map((r) => `| ${r.dimension} | ${r.check} | ${r.status} | ${r.detail} | ${r.durationMs || '-'}ms |`),
    ``,
  ].join('\n')
  fs.writeFileSync(reportPath, md, 'utf-8')
  console.log(`\n\x1b[36m[报告] Markdown 报告: ${reportPath}\x1b[0m`)
  if (fs.existsSync(VERIFY_SCREENSHOT)) {
    console.log(`\x1b[36m[截图] 验证截图: ${VERIFY_SCREENSHOT}\x1b[0m`)
  }

  return allPassed
}

// ============================================================
// 主流程
// ============================================================
async function main(): Promise<void> {
  console.log('+============================================================+')
  console.log('|     V9 安装完成标志验证                                    |')
  console.log('|     4 维度 x 22 检查点                                     |')
  console.log('+============================================================+')
  console.log(`|  目标: ${TARGET_URL}`)
  console.log(`|  时间: ${new Date().toISOString()}`)
  console.log('+============================================================+')

  // 维度 1: 环境就绪
  await verifyDimension1_Environment()

  // 维度 2: 服务运行
  await verifyDimension2_Service()

  // 维度 3: 配置一致性
  verifyDimension3_Config()

  // 维度 4: 基础功能测试
  await verifyDimension4_Function()

  // 生成报告
  const allPassed = generateReport()
  process.exit(allPassed ? 0 : 1)
}

main().catch((error) => {
  console.error(`\x1b[31m[FATAL] ${error}\x1b[0m`)
  process.exit(1)
})
