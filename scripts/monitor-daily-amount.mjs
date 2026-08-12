#!/usr/bin/env node
/**
 * 分钟级日成交额监控脚本 ★ v4.5.4
 *
 * 监控 BD-007.SZ（边界-3.01亿豁免）和 601857.SH（中国石油，3.20亿）
 * 一旦日累计成交额跌破 3 亿元（蓝筹豁免阈值），立即触发报警
 *
 * 报警条件：日成交额 < 3_0000_0000 元（v4.5.4 蓝筹豁免阈值，严格大于才豁免）
 *
 * 数据源：腾讯实时行情 API（https://qt.gtimg.cn/q=sh601857）
 *   - 返回 GBK 编码，fields[37] 为成交额（万元）
 *   - 日成交额(元) = fields[37] * 10000
 *
 * 用法：
 *   node scripts/monitor-daily-amount.mjs                  # 默认监控 BD-007.SZ + 601857.SH
 *   node scripts/monitor-daily-amount.mjs --dry-run         # 单次模拟测试（不轮询）
 *   node scripts/monitor-daily-amount.mjs --interval 30     # 自定义轮询间隔（秒）
 *   node scripts/monitor-daily-amount.mjs --force           # 非交易时段也强制查询
 *   node scripts/monitor-daily-amount.mjs --stocks 601857.SH,600519.SH  # 自定义股票列表
 *
 * 报警方式：
 *   1. 控制台彩色高亮输出（红色闪烁）
 *   2. 日志文件 outputs/monitor-daily-amount.log
 *   3. Windows Toast 桌面通知（通过 PowerShell）
 */

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ============================================================
// 配置
// ============================================================

const DAILY_AMOUNT_THRESHOLD = 3_0000_0000 // 3 亿元（元）— v4.5.4 蓝筹豁免阈值
const DEFAULT_INTERVAL_SEC = 60            // 默认轮询间隔 60 秒
const ALERT_REPEAT_INTERVAL_MIN = 5        // 持续报警时每 5 分钟重复一次
const TRADING_SESSIONS = [
  { start: '09:25', end: '11:30' },
  { start: '13:00', end: '15:00' },
]

// 默认监控股票（来自预警报告 §3.2 边界风险股）
const DEFAULT_STOCKS = [
  {
    code: '601857.SH',
    name: '中国石油',
    tencentCode: 'sh601857',
    baselineAmount: 3_2000_0000, // 基准日成交额 3.20 亿
    note: '蓝筹豁免，距阈值 0.20 亿',
    isMock: false,
  },
  {
    code: 'BD-007.SZ',
    name: '边界-3.01亿豁免',
    tencentCode: null, // 模拟代码，腾讯 API 无数据
    baselineAmount: 3_0100_0000, // 基准日成交额 3.01 亿
    note: '边界测试用例，距阈值 0.01 亿（高度警戒）',
    isMock: true, // 使用模拟数据（每分钟递减模拟缩量）
    mockDecayPerMin: 50_0000, // 模拟每分钟成交额递减 50 万（缩量场景）
  },
]

// ============================================================
// 参数解析
// ============================================================

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const intervalIdx = args.indexOf('--interval')
const intervalSec = intervalIdx >= 0 ? parseInt(args[intervalIdx + 1], 10) : DEFAULT_INTERVAL_SEC
const stocksIdx = args.indexOf('--stocks')
const customStocks = stocksIdx >= 0 ? args[stocksIdx + 1]?.split(',').map((s) => s.trim()).filter(Boolean) : null

// ============================================================
// 日志
// ============================================================

const logDir = resolve(projectRoot, 'outputs')
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
const logFile = resolve(logDir, 'monitor-daily-amount.log')

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  redBold: '\x1b[1;31m',
  redBlink: '\x1b[5;31m',
  green: '\x1b[32m',
  greenBold: '\x1b[1;32m',
  yellow: '\x1b[33m',
  yellowBold: '\x1b[1;33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

function fmtTime(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtAmount(yuan) {
  const yi = yuan / 1_0000_0000
  return `${yi.toFixed(4)} 亿（${yuan.toLocaleString('zh-CN')} 元）`
}

function log(level, msg, data = '') {
  const ts = fmtTime()
  const prefix = level === 'ALERT' ? '[ALERT]' : level === 'WARN' ? '[WARN]' : level === 'INFO' ? '[INFO]' : '[DEBUG]'
  const line = `${ts} ${prefix} ${msg}${data ? ` | ${data}` : ''}`

  // 控制台彩色输出
  let color = COLORS.reset
  if (level === 'ALERT') color = COLORS.redBlink
  else if (level === 'WARN') color = COLORS.yellowBold
  else if (level === 'INFO') color = COLORS.cyan
  else if (level === 'RECOVERY') color = COLORS.greenBold
  console.log(`${color}${line}${COLORS.reset}`)

  // 日志文件
  appendFileSync(logFile, line + '\n', 'utf-8')
}

// ============================================================
// 交易时段判定
// ============================================================

function isInTradingSession(now = new Date()) {
  // 周末不交易
  const day = now.getDay()
  if (day === 0 || day === 6) return false

  const pad = (n) => String(n).padStart(2, '0')
  const hhmm = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return TRADING_SESSIONS.some((s) => {
    const start = s.start.replace(':', '')
    const end = s.end.replace(':', '')
    return hhmm >= start && hhmm <= end
  })
}

// ============================================================
// 腾讯实时行情查询
// ============================================================

const TENCENT_QUOTE_API = 'https://qt.gtimg.cn/q='

/**
 * 查询腾讯实时行情，返回日成交额（元）
 * 返回格式：v_sh601857="名称~开盘~昨收~现价~...~fields[37]=成交额(万元)"
 */
async function fetchDailyAmount(tencentCode) {
  const url = `${TENCENT_QUOTE_API}${tencentCode}`
  const resp = await fetch(url, {
    headers: {
      'Referer': 'https://finance.qq.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })
  if (!resp.ok) {
    throw new Error(`腾讯 API HTTP ${resp.status}`)
  }
  // 腾讯 API 返回 GBK 编码，用 TextDecoder 解码
  const buffer = await resp.arrayBuffer()
  const text = new TextDecoder('gbk').decode(buffer)

  // 解析：v_sh601857="field1~field2~...~field37"
  const match = text.match(/v_\w+="([^"]+)"/)
  if (!match || !match[1]) {
    throw new Error('腾讯行情解析失败：无匹配数据')
  }
  const fields = match[1].split('~')
  if (fields.length < 38) {
    throw new Error(`腾讯行情字段不足：${fields.length}/38`)
  }

  const name = fields[1] ?? ''
  const price = parseFloat(fields[3]) || 0
  const amountWan = parseFloat(fields[37]) || 0 // 成交额（万元）
  const amountYuan = amountWan * 10000 // 转为元

  return { name, price, amountYuan, rawFields: fields.length }
}

// ============================================================
// 模拟数据（用于 BD-007 等边界测试用例）
// ============================================================

const mockState = new Map() // code -> { currentAmount, lastUpdate }

function getMockAmount(stock) {
  const now = Date.now()
  let state = mockState.get(stock.code)
  if (!state) {
    // 初始化为基准日成交额
    state = { currentAmount: stock.baselineAmount, lastUpdate: now }
    mockState.set(stock.code, state)
    return state.currentAmount
  }
  // 按每分钟递减模拟缩量
  const elapsedMin = Math.floor((now - state.lastUpdate) / 60000)
  if (elapsedMin > 0) {
    state.currentAmount = Math.max(0, state.currentAmount - stock.mockDecayPerMin * elapsedMin)
    state.lastUpdate = now
  }
  return state.currentAmount
}

// ============================================================
// Windows Toast 通知
// ============================================================

function sendWindowsToast(title, body) {
  if (process.platform !== 'win32') return
  try {
    const psScript = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
      $textNodes = $template.GetElementsByTagName("text")
      $textNodes.Item(0).AppendChild($template.CreateTextNode("${title.replace(/"/g, '')}")) | Out-Null
      $textNodes.Item(1).AppendChild($template.CreateTextNode("${body.replace(/"/g, '')}")) | Out-Null
      $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("FinSightV9 Monitor")
      $notifier.Show([Windows.UI.Notifications.ToastNotification]::new($template))
    `
    execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 5000, stdio: 'ignore' })
  } catch {
    // Toast 失败不影响主流程，尝试备用方案
    try {
      execSync(`powershell -NoProfile -Command "[console]::beep(800, 500); [console]::beep(600, 500)"`, { timeout: 3000, stdio: 'ignore' })
    } catch { /* 静默忽略 */ }
  }
}

// ============================================================
// 报警状态管理
// ============================================================

const alertState = new Map() // code -> { isAlerting, lastAlertTime, lastAmount }

function getAlertState(code) {
  if (!alertState.has(code)) {
    alertState.set(code, { isAlerting: false, lastAlertTime: 0, lastAmount: 0, alertCount: 0 })
  }
  return alertState.get(code)
}

function processStock(stock, amountYuan, price) {
  const state = getAlertState(stock.code)
  const wasAlerting = state.isAlerting
  const now = Date.now()
  const belowThreshold = amountYuan < DAILY_AMOUNT_THRESHOLD
  const distanceYi = (amountYuan - DAILY_AMOUNT_THRESHOLD) / 1_0000_0000

  state.lastAmount = amountYuan

  // 距阈值 0.10 亿以内的预警提示（未跌破但接近）
  const isNearThreshold = !belowThreshold && distanceYi < 0.10
  if (isNearThreshold) {
    log('WARN',
      `${stock.code} ${stock.name} 接近阈值！距 3 亿仅 ${distanceYi.toFixed(4)} 亿`,
      `成交额=${fmtAmount(amountYuan)} 价格=${price} ${stock.note}`)
  }

  if (belowThreshold) {
    // 跌破阈值
    if (!wasAlerting) {
      // 首次跌破 → 触发 ALERT
      state.isAlerting = true
      state.alertCount++
      state.lastAlertTime = now
      const msg = `${stock.code} ${stock.name} 日成交额跌破 3 亿！蓝筹豁免失效，将触发低流动性拦截`
      const detail = `成交额=${fmtAmount(amountYuan)} | 阈值=3.00 亿 | 差额=${(-distanceYi).toFixed(4)} 亿 | 价格=${price} | ${stock.note}`
      log('ALERT', msg, detail)
      sendWindowsToast(`ALERT: ${stock.name} 跌破 3 亿`, `成交额 ${(amountYuan / 1_0000_0000).toFixed(2)}亿 | 将触发低流动性拦截`)
    } else {
      // 持续低于阈值 → 每 ALERT_REPEAT_INTERVAL_MIN 分钟重复
      const sinceLastAlert = (now - state.lastAlertTime) / 60000
      if (sinceLastAlert >= ALERT_REPEAT_INTERVAL_MIN) {
        state.alertCount++
        state.lastAlertTime = now
        log('ALERT',
          `${stock.code} ${stock.name} 持续低于阈值（第 ${state.alertCount} 次报警）`,
          `成交额=${fmtAmount(amountYuan)} | 距上次报警 ${sinceLastAlert.toFixed(1)} 分钟 | 价格=${price}`)
      }
    }
  } else if (wasAlerting) {
    // 从低于阈值恢复到高于阈值
    state.isAlerting = false
    log('RECOVERY',
      `${stock.code} ${stock.name} 成交额恢复至 3 亿以上`,
      `成交额=${fmtAmount(amountYuan)} | 恢复差额=+${distanceYi.toFixed(4)} 亿 | 价格=${price}`)
    sendWindowsToast(`RECOVERY: ${stock.name} 恢复`, `成交额 ${(amountYuan / 1_0000_0000).toFixed(2)}亿 | 蓝筹豁免重新生效`)
  } else if (!isNearThreshold) {
    // 正常状态（高于阈值且距阈值 > 0.10 亿，接近阈值时已由 WARN 输出）
    log('INFO',
      `${stock.code} ${stock.name} 成交额正常`,
      `成交额=${fmtAmount(amountYuan)} | 距阈值 +${distanceYi.toFixed(4)} 亿 | 价格=${price} | ${stock.note}`)
  }
}

// ============================================================
// 单次查询
// ============================================================

async function queryOnce(stocks) {
  for (const stock of stocks) {
    try {
      let amountYuan, price, name

      if (stock.isMock) {
        // 模拟模式（BD-007 等边界测试用例）
        amountYuan = getMockAmount(stock)
        price = 0 // 模拟代码无真实价格
        name = stock.name
      } else {
        // 真实查询腾讯 API
        const result = await fetchDailyAmount(stock.tencentCode)
        amountYuan = result.amountYuan
        price = result.price
        name = result.name || stock.name
      }

      processStock(stock, amountYuan, price)
    } catch (err) {
      log('WARN', `${stock.code} ${stock.name} 查询失败`, err.message)
      // 查询失败不改变报警状态
    }
  }
  console.log(`${COLORS.gray}${'─'.repeat(80)}${COLORS.reset}`)
}

// ============================================================
// 主循环
// ============================================================

async function main() {
  // 解析监控股票列表
  let stocks = DEFAULT_STOCKS
  if (customStocks) {
    stocks = customStocks.map((code) => ({
      code,
      name: code,
      tencentCode: code.startsWith('6') ? `sh${code.split('.')[0]}` : `sz${code.split('.')[0]}`,
      baselineAmount: 0,
      note: '自定义监控',
      isMock: code.startsWith('BD-'),
      mockDecayPerMin: 50_0000,
    }))
  }

  // 打印启动横幅
  console.log(`
${COLORS.cyan}╔══════════════════════════════════════════════════════════════════════╗
║  日成交额分钟级监控 ★ v4.5.4                                          ║
║  阈值：日成交额 < 3 亿元 → 触发报警（蓝筹豁免失效 → 低流动性拦截）    ║
╚══════════════════════════════════════════════════════════════════════╝${COLORS.reset}
${COLORS.gray}监控股票：${stocks.map((s) => `${s.code}(${s.name})`).join(', ')}
轮询间隔：${intervalSec} 秒
日志文件：${logFile}
数据源：${stocks.some((s) => !s.isMock) ? '腾讯实时行情 API' : ''}${stocks.some((s) => s.isMock) ? ' + 模拟数据' : ''}
模式：${dryRun ? 'DRY-RUN（单次测试）' : force ? '强制（忽略交易时段）' : '生产（仅交易时段查询）'}${COLORS.reset}
`)

  // 初始化日志
  log('INFO', '监控脚本启动', `监控 ${stocks.length} 只股票 | 间隔 ${intervalSec}s | 阈值 ${fmtAmount(DAILY_AMOUNT_THRESHOLD)}`)

  if (dryRun) {
    // Dry-run 模式：单次查询后退出
    console.log(`${COLORS.yellowBold}[DRY-RUN] 执行单次查询测试...${COLORS.reset}`)
    await queryOnce(stocks)
    console.log(`\n${COLORS.greenBold}[DRY-RUN] 完成。日志已写入：${logFile}${COLORS.reset}`)

    // 模拟测试：手动触发一次报警
    console.log(`\n${COLORS.yellow}[DRY-RUN] 模拟报警测试（强制 BD-007 跌破阈值）...${COLORS.reset}`)
    const testStock = stocks.find((s) => s.code === 'BD-007.SZ') || stocks[0]
    processStock({ ...testStock, baselineAmount: 2_9500_0000 }, 2_9500_0000, 0)
    console.log(`\n${COLORS.greenBold}[DRY-RUN] 全部测试完成。${COLORS.reset}`)
    return
  }

  // 生产模式：循环轮询
  let cycleCount = 0
  const loop = async () => {
    cycleCount++
    const inSession = isInTradingSession()
    if (!inSession && !force) {
      const now = new Date()
      const day = now.getDay()
      if (day === 0 || day === 6) {
        log('INFO', `非交易日（周末），跳过第 ${cycleCount} 次查询`, '使用 --force 可强制查询')
      } else {
        log('INFO', `非交易时段（${fmtTime(now)}），跳过第 ${cycleCount} 次查询`, '交易时段：09:25-11:30, 13:00-15:00')
      }
    } else {
      await queryOnce(stocks)
    }
  }

  // 首次立即执行
  await loop()

  // 定时轮询
  console.log(`${COLORS.gray}定时轮询已启动，按 Ctrl+C 停止...${COLORS.reset}\n`)
  setInterval(loop, intervalSec * 1000)
}

main().catch((err) => {
  log('WARN', '监控脚本异常退出', err.message)
  console.error(err)
  process.exit(1)
})
