// LLM Key 真实调用「成功路径」验证（与 verify-llm-ttl.mjs 互补）
// 覆盖：TC-D1-02 加密落库 / TC-D1-03 刷新掩码 / TC-D3-01 真实成功 / TC-D4-01/02/04 测试连接+lastVerifiedAt / TC-D6-01 日志脱敏
// 运行（需 dev server + 真实 Key 环境变量，Key 不落任何文件）：
//   $env:LLM_REAL_KEY='sk-xxx'; node dogfood-output/scripts/verify-llm-success.mjs
// CI 可用 LLM_BASE_URL 覆盖前端地址（默认 http://localhost:5173）
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const KEY = process.env.LLM_REAL_KEY
if (!KEY) {
  console.error('缺少 LLM_REAL_KEY 环境变量')
  process.exit(2)
}
const MASKED_KEY = KEY.slice(0, 4) + '****' + KEY.slice(-4)
const BASE = process.env.LLM_BASE_URL ?? 'http://localhost:5173'
const LLM_URL = BASE + '/#/command/agents/llm'
const OUT = path.resolve('dogfood-output/screenshots-llm')
fs.mkdirSync(OUT, { recursive: true })

// 沙箱规避：chrome 用户数据/临时文件/崩溃日志放到项目内
const PW_DIR = path.resolve('dogfood-output/.pw')
fs.mkdirSync(path.join(PW_DIR, 'userdata'), { recursive: true })

const results = []
const browser = await chromium.launch({
  headless: true,
  args: [
    '--disable-crash-reporter',
    '--disable-logging',
    '--log-level=3',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  env: {
    ...process.env,
    TMP: PW_DIR,
    TEMP: PW_DIR,
    TMPDIR: PW_DIR,
    CHROME_CRASHES_DIR: path.join(PW_DIR, 'crashes'),
  },
})

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(20000)
// 保存成功会触发 alert，自动接受
page.on('dialog', (d) => { d.accept().catch(() => {}) })
// 控制台捕获（TC-D6-01 脱敏检查）
const consoleTexts = []
page.on('console', (msg) => consoleTexts.push(msg.text()))
// 网络捕获（TC-D3/D4 真实请求证据）
const llmReqs = []
page.on('request', (req) => {
  if (/\/v1\/chat\/completions/.test(req.url())) {
    llmReqs.push({
      url: req.url(),
      method: req.method(),
      auth: req.headers()['authorization'] ?? '',
      status: 'pending',
    })
  }
})
page.on('response', (res) => {
  const hit = llmReqs.find((r) => r.status === 'pending' && res.url() === r.url)
  if (hit) hit.status = String(res.status())
})

// 清空旧 Key 配置后进入 LLM 管理页
await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  localStorage.removeItem('app:llm_api_key')
  localStorage.removeItem('app:llm_api_key_meta')
})
await page.goto(LLM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2500)

// ── 场景 A：TC-D1-02 保存真实 Key → AES-GCM 加密落库，无明文 ──
await page.locator('input[placeholder="输入 API Key"]').first().fill(KEY)
await page.getByRole('button', { name: '保存配置' }).click()
await page.waitForTimeout(1500)

const storedRaw = await page.evaluate(() => localStorage.getItem('app:llm_api_key'))
const metaRaw = await page.evaluate(() => localStorage.getItem('app:llm_api_key_meta'))
let stored = {}
let meta = {}
try { stored = JSON.parse(storedRaw ?? '{}') } catch { /* 非 JSON */ }
try { meta = JSON.parse(metaRaw ?? '{}') } catch { /* 非 JSON */ }

const d1 = {
  encryptedFlag: stored.__encrypted === true,
  noPlaintext: !(storedRaw ?? '').includes(KEY),
  hasSetAt: typeof meta.setAt === 'number' && meta.setAt > 0,
}
d1.pass = d1.encryptedFlag && d1.noPlaintext && d1.hasSetAt
results.push({ scenario: 'TC-D1-02 保存真实 Key → AES-GCM 加密落库(无明文)', ...d1, storedShape: Object.keys(stored), metaShape: Object.keys(meta) })
console.log('[A]', JSON.stringify(results[results.length - 1]))
await page.screenshot({ path: path.join(OUT, '11-save-encrypted.png'), fullPage: false })

// ── 场景 B：TC-D1-03 刷新后掩码 ──
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2500)
const maskValue = await page.locator('input[placeholder="输入 API Key"]').first().inputValue().catch(() => '')
const isMask = maskValue === '••••••••'
results.push({ scenario: 'TC-D1-03 刷新后掩码显示', pass: isMask })
console.log('[B]', JSON.stringify(results[results.length - 1]))
await page.screenshot({ path: path.join(OUT, '12-reload-mask.png'), fullPage: false })

// ── 场景 C：TC-D3-01 / TC-D4-01/02/04 测试连接成功（走解密存储路径）──
const metaBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('app:llm_api_key_meta') ?? '{}'))
await page.getByRole('button', { name: '测试连接' }).click()
let okText = ''
try {
  await page.waitForSelector('text=/连接成功/', { timeout: 25000 })
  const body = await page.locator('body').innerText()
  okText = body.split('\n').find((l) => l.includes('连接成功')) || ''
} catch { /* 超时，记录失败 */ }
await page.waitForTimeout(800)
const metaAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('app:llm_api_key_meta') ?? '{}'))

const realReq = llmReqs.find((r) => r.url.includes('api.deepseek.com'))
const d3 = {
  successMsg: okText.slice(0, 160),
  realRequestCount: llmReqs.length,
  statusOk: realReq ? realReq.status === '200' : false,
  authOk: realReq ? realReq.auth === `Bearer ${KEY}` : false,
  lastVerifiedAtUpdated:
    metaAfter.lastVerifiedAt > 0 &&
    (typeof metaBefore.lastVerifiedAt !== 'number' || metaAfter.lastVerifiedAt >= metaBefore.lastVerifiedAt),
}
d3.pass = d3.successMsg.includes('连接成功') && d3.statusOk && d3.authOk && d3.lastVerifiedAtUpdated
results.push({ scenario: 'TC-D3-01/TC-D4-01/02/04 真实调用成功+测试连接+lastVerifiedAt', ...d3, realReqUrl: realReq ? realReq.url : null, realReqStatus: realReq ? realReq.status : null })
console.log('[C]', JSON.stringify(results[results.length - 1]))
await page.screenshot({ path: path.join(OUT, '13-test-success.png'), fullPage: false })

// ── 场景 D：TC-D6-01 控制台日志不含明文 Key ──
const leaked = consoleTexts.filter((t) => t.includes(KEY))
results.push({
  scenario: 'TC-D6-01 控制台日志不含明文 Key',
  pass: leaked.length === 0,
  consoleCount: consoleTexts.length,
  leakedCount: leaked.length,
})
console.log('[D]', JSON.stringify(results[results.length - 1]))

// 输出结果（全量脱敏：任何出现真实 Key 的位置替换为掩码）
fs.writeFileSync(path.join(OUT, 'result-success.json'), JSON.stringify(results, null, 2).split(KEY).join(MASKED_KEY))
console.log('\n=== 汇总 ===')
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.scenario}`)
console.log(`通过 ${results.filter((r) => r.pass).length}/${results.length}`)
try { await browser.close() } catch (e) { console.error('[teardown] browser.close 异常（不影响结果）:', e && e.message) }
process.exit(results.every((r) => r.pass) ? 0 : 1)
