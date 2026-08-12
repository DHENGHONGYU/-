// V9 全量浏览器回归测试脚本
// 目标: http://localhost:3002/
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://localhost:3002'

const ROUTES = [
  { url: `${BASE}/`, name: '首页', path: '/' },
  { url: `${BASE}/#/cockpit`, name: '驾驶舱', path: '/cockpit' },
  { url: `${BASE}/#/input`, name: '输入舱', path: '/input' },
  { url: `${BASE}/#/analysis`, name: '分析舱', path: '/analysis' },
  { url: `${BASE}/#/analysis/stock-score`, name: '个股评分', path: '/analysis/stock-score' },
  { url: `${BASE}/#/analysis/sector`, name: '行业分析', path: '/analysis/sector' },
  { url: `${BASE}/#/analysis/industry-score`, name: 'V4 行业评分', path: '/analysis/industry-score' },
  { url: `${BASE}/#/analysis/intelligent-score`, name: 'V6 智能评分', path: '/analysis/intelligent-score' },
  { url: `${BASE}/#/analysis/hot-sector`, name: '热门板块', path: '/analysis/hot-sector' },
  { url: `${BASE}/#/analysis/value-pit`, name: '价值洼地', path: '/analysis/value-pit' },
  { url: `${BASE}/#/analysis/backtest`, name: '策略回测', path: '/analysis/backtest' },
  { url: `${BASE}/#/analysis/news`, name: '智能资讯', path: '/analysis/news' },
  { url: `${BASE}/#/analysis/score-docs`, name: '评分文档', path: '/analysis/score-docs' },
  { url: `${BASE}/#/trading`, name: '交易舱', path: '/trading' },
  { url: `${BASE}/#/trading/holdings`, name: '持仓管理', path: '/trading/holdings' },
  { url: `${BASE}/#/trading/strategy-snapshots`, name: '策略快照', path: '/trading/strategy-snapshots' },
  { url: `${BASE}/#/output`, name: '输出舱', path: '/output' },
  { url: `${BASE}/#/output/research`, name: '研究报告', path: '/output/research' },
  { url: `${BASE}/#/output/review`, name: '交易复盘', path: '/output/review' },
  { url: `${BASE}/#/output/export`, name: '数据导出', path: '/output/export' },
  { url: `${BASE}/#/command`, name: '总控舱', path: '/command' },
  { url: `${BASE}/#/command/monitor`, name: '系统监控', path: '/command/monitor' },
  { url: `${BASE}/#/command/config`, name: '配置管理', path: '/command/config' },
  { url: `${BASE}/#/mock-test`, name: 'Mock 测试页', path: '/mock-test' },
  { url: `${BASE}/#/nonexistent`, name: '404 页面', path: '/nonexistent' },
]

const FLOW = [
  { url: `${BASE}/`, name: '首页' },
  { url: `${BASE}/#/input`, name: '输入舱' },
  { url: `${BASE}/#/analysis`, name: '分析舱' },
  { url: `${BASE}/#/trading`, name: '交易舱' },
  { url: `${BASE}/#/output`, name: '输出舱' },
  { url: `${BASE}/#/command`, name: '总控舱' },
  { url: `${BASE}/#/cockpit`, name: '驾驶舱' },
  { url: `${BASE}/`, name: '首页' },
]

const EXPECTED_TITLE = '智能投研复盘系统 V9'

function classifyError(msg, url) {
  const lower = msg.toLowerCase()
  if (lower.includes('err_connection_refused') || lower.includes('net::err_connection_refused') || lower.includes('failed to fetch') && lower.includes('localhost')) return 'NETWORK_CONNECTION_REFUSED'
  if (lower.includes('net::err_')) return 'NETWORK_OTHER'
  if (lower.includes('404') && (lower.includes('load resource') || lower.includes('failed to load'))) return 'NETWORK_404'
  if (lower.includes('favicon')) return 'FAVICON'
  if (lower.includes('warning:')) return 'REACT_WARNING'
  if (lower.includes('uncaught') || lower.includes('typeerror') || lower.includes('referenceerror') || lower.includes('syntaxerror')) return 'JS_UNCAUGHT'
  if (lower.includes('error')) return 'JS_OTHER'
  return 'OTHER'
}

async function testRoute(page, route) {
  const consoleErrors = []
  const pageErrors = []
  const networkFails = []

  const consoleHandler = msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // 忽略 favicon 与连接拒绝类网络错误
      if (text.includes('favicon')) return
      if (text.includes('ERR_CONNECTION_REFUSED') || text.includes('net::ERR_CONNECTION_REFUSED')) {
        networkFails.push(text)
        return
      }
      consoleErrors.push(text)
    }
  }
  const pageErrorHandler = err => {
    const msg = err.message
    if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('net::ERR_CONNECTION_REFUSED')) {
      networkFails.push(msg)
      return
    }
    pageErrors.push(msg)
  }
  const requestFailHandler = req => {
    const url = req.url()
    if (url.includes('favicon')) return
    const failure = req.failure()?.errorText || ''
    if (failure.includes('ERR_CONNECTION_REFUSED') || failure.includes('net::ERR_CONNECTION_REFUSED')) {
      networkFails.push(`${url} -> ${failure}`)
    }
  }

  page.on('console', consoleHandler)
  page.on('pageerror', pageErrorHandler)
  page.on('requestfailed', requestFailHandler)

  let navOk = true
  let navError = null
  try {
    await page.goto(route.url, { waitUntil: 'networkidle', timeout: 30000 })
  } catch (e) {
    // 网络空闲可能因后端不可达超时，但页面可能已渲染
    try {
      await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch (e2) {
      navOk = false
      navError = e2.message
    }
  }

  // 等待渲染稳定
  await page.waitForTimeout(1500)

  const title = await page.title().catch(() => '')
  const bodyText = await page.evaluate(() => {
    return (document.body?.innerText || '').trim()
  }).catch(() => '')
  const bodyHTMLLength = await page.evaluate(() => {
    return (document.body?.innerHTML || '').length
  }).catch(() => 0)
  const hasRootContent = await page.evaluate(() => {
    const root = document.getElementById('root') || document.querySelector('#app')
    if (!root) return false
    return (root.children.length > 0) && ((root.innerHTML || '').length > 100)
  }).catch(() => false)

  // 检测错误页特征
  const isErrorPage = /Error|Oops|出错了|无法加载|页面不存在|Cannot read|is not defined|undefined is not/i.test(bodyText)
  const isWhiteScreen = bodyHTMLLength < 200 || bodyText.length < 5

  // 404 路由特殊处理: 期望显示 404 提示而不是崩溃
  const is404Route = route.path === '/nonexistent'
  const routeOk = is404Route
    ? (hasRootContent && !isWhiteScreen)
    : (hasRootContent && !isWhiteScreen && !isErrorPage)

  // 标题检查
  const titleOk = title === EXPECTED_TITLE

  page.off('console', consoleHandler)
  page.off('pageerror', pageErrorHandler)
  page.off('requestfailed', requestFailHandler)

  return {
    route,
    navOk,
    navError,
    title,
    titleOk,
    bodyTextPreview: bodyText.slice(0, 200).replace(/\s+/g, ' '),
    bodyHTMLLength,
    isWhiteScreen,
    isErrorPage,
    routeOk,
    is404Route,
    consoleErrors,
    pageErrors,
    networkFails,
    totalErrors: consoleErrors.length + pageErrors.length,
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  })

  const results = []
  console.log('========== V9 全量浏览器回归测试开始 ==========\n')
  console.log(`目标: ${BASE}\n`)

  // 单页测试
  for (let i = 0; i < ROUTES.length; i++) {
    const route = ROUTES[i]
    const page = await context.newPage()
    process.stdout.write(`[${i + 1}/${ROUTES.length}] 测试: ${route.name} (${route.path}) ... `)
    const r = await testRoute(page, route)
    results.push(r)
    const status = r.routeOk && r.titleOk && r.totalErrors === 0 ? 'PASS' : (r.routeOk && r.titleOk ? 'WARN' : 'FAIL')
    console.log(`${status}  渲染:${r.routeOk ? 'OK' : 'NG'} 标题:${r.titleOk ? 'OK' : 'NG'}(${r.title || '空'}) 控制台错误:${r.totalErrors} 网络:${r.networkFails.length}`)
    if (r.navError) console.log(`   导航警告: ${r.navError.slice(0, 150)}`)
    if (r.consoleErrors.length) {
      r.consoleErrors.slice(0, 3).forEach((e, idx) => console.log(`   控制台错误[${idx + 1}]: ${e.slice(0, 200)}`))
    }
    if (r.pageErrors.length) {
      r.pageErrors.slice(0, 3).forEach((e, idx) => console.log(`   页面异常[${idx + 1}]: ${e.slice(0, 200)}`))
    }
    await page.close()
  }

  // 路由切换流程测试
  console.log('\n========== 路由切换流程测试 ==========\n')
  const flowPage = await context.newPage()
  const flowErrors = []
  const flowConsoleHandler = msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (text.includes('favicon')) return
      if (text.includes('ERR_CONNECTION_REFUSED')) return
      flowErrors.push(text)
    }
  }
  const flowPageHandler = err => {
    if (err.message.includes('ERR_CONNECTION_REFUSED')) return
    flowErrors.push('[pageerror] ' + err.message)
  }
  flowPage.on('console', flowConsoleHandler)
  flowPage.on('pageerror', flowPageHandler)

  const flowSteps = []
  let flowOk = true
  for (let i = 0; i < FLOW.length; i++) {
    const step = FLOW[i]
    process.stdout.write(`[流程 ${i + 1}/${FLOW.length}] -> ${step.name} ... `)
    try {
      await flowPage.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await flowPage.waitForTimeout(800)
      const title = await flowPage.title()
      const hasContent = await flowPage.evaluate(() => {
        const root = document.getElementById('root') || document.querySelector('#app')
        return root && root.children.length > 0 && ((root.innerHTML || '').length > 100)
      })
      const white = await flowPage.evaluate(() => (document.body?.innerText || '').trim().length < 5)
      const stepOk = hasContent && !white
      flowSteps.push({ ...step, title, hasContent, white, ok: stepOk })
      console.log(`${stepOk ? 'OK' : 'NG'}  标题:${title}`)
      if (!stepOk) flowOk = false
    } catch (e) {
      flowSteps.push({ ...step, ok: false, error: e.message })
      console.log(`NG  异常:${e.message.slice(0, 100)}`)
      flowOk = false
    }
  }
  await flowPage.close()

  await browser.close()

  // ====== 报告生成 ======
  const report = {
    base: BASE,
    timestamp: new Date().toISOString(),
    routes: results,
    flow: { ok: flowOk, steps: flowSteps, errors: flowErrors },
  }
  fs.writeFileSync('regression-report.json', JSON.stringify(report, null, 2), 'utf8')

  // 汇总
  const pass = results.filter(r => r.routeOk && r.titleOk && r.totalErrors === 0).length
  const warn = results.filter(r => r.routeOk && r.titleOk && r.totalErrors > 0).length
  const fail = results.filter(r => !(r.routeOk && r.titleOk)).length

  // 错误分类
  const errorCategories = {}
  for (const r of results) {
    for (const e of r.consoleErrors) {
      const c = classifyError(e, r.route.url)
      errorCategories[c] = (errorCategories[c] || 0) + 1
    }
    for (const e of r.pageErrors) {
      const c = classifyError(e, r.route.url)
      errorCategories[c] = (errorCategories[c] || 0) + 1
    }
  }

  console.log('\n========== 测试汇总 ==========')
  console.log(`总路由数: ${results.length}`)
  console.log(`PASS: ${pass}  WARN(渲染OK但有控制台错误): ${warn}  FAIL: ${fail}`)
  console.log(`路由切换流程: ${flowOk ? 'PASS' : 'FAIL'}  流程中累计控制台错误: ${flowErrors.length}`)
  console.log('\n控制台错误分类汇总:')
  Object.entries(errorCategories).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`)
  })

  console.log('\n========== 路由明细表 ==========')
  console.log('名称 | 路径 | 渲染 | 标题 | 控制台错误 | 网络 | 状态')
  for (const r of results) {
    const status = r.routeOk && r.titleOk && r.totalErrors === 0 ? 'PASS' : (r.routeOk && r.titleOk ? 'WARN' : 'FAIL')
    console.log(`${r.route.name} | ${r.route.path} | ${r.routeOk ? 'OK' : 'NG'} | ${r.titleOk ? 'OK' : 'NG'} | ${r.totalErrors} | ${r.networkFails.length} | ${status}`)
  }

  console.log('\n报告已写入: regression-report.json')
}

main().catch(e => {
  console.error('测试脚本异常:', e)
  process.exit(1)
})
