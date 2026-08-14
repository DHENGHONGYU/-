// LLM Key 保密缺口验证：TTL 轮换 UI + 真实 API 调用
// 运行：node dogfood-output/scripts/verify-llm-ttl.mjs
// CI 可用 LLM_BASE_URL 覆盖前端地址（默认 http://localhost:5173）
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.LLM_BASE_URL ?? 'http://localhost:5173'
const LLM_URL = BASE + '/#/command/agents/llm'
const OUT = path.resolve('dogfood-output/screenshots-llm')
fs.mkdirSync(OUT, { recursive: true })

const DAY = 24 * 60 * 60 * 1000
const KEY_ENTRY = 'app:llm_api_key'
const KEY_META = 'app:llm_api_key_meta'
// 与 isLlmApiKeyConfigured 判定一致的加密占位（无需真实可解密值）
const FAKE_ENCRYPTED = '{"__encrypted":true,"iv":"AA==","data":"AA==","createdAt":0,"expiresAt":0,"version":1}'

// 沙箱规避：把 chrome 用户数据/临时文件/崩溃日志全部放到项目内，避免写入系统目录被拒
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

async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1200)
  return page
}

// ---------- 场景 1：Key 已过期（setAt = 31 天前）→ 应显示「建议更新轮换」 ----------
{
  const page = await freshPage()
  await page.evaluate(([keyEntry, keyMeta, enc]) => {
    localStorage.setItem(keyEntry, enc)
    localStorage.setItem(keyMeta, JSON.stringify({ setAt: Date.now() - 31 * 86400000, lastVerifiedAt: Date.now() - 31 * 86400000 }))
  }, [KEY_ENTRY, KEY_META, FAKE_ENCRYPTED])
  await page.goto(LLM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)

  const bodyText = await page.locator('body').innerText()
  const hasExpiredWarn = bodyText.includes('建议更新轮换')
  const hasFreshMsg = bodyText.includes('30 天内无需轮换')
  // 掩码是 input 的 value，需单独读取（innerText 不含 input 值）
  const apiKeyValue = await page.locator('input[placeholder="输入 API Key"]').first().inputValue().catch(() => '')
  const hasMask = apiKeyValue.includes('••••••••')
  await page.screenshot({ path: path.join(OUT, '01-ttl-expired.png'), fullPage: true })
  results.push({
    scenario: 'TTL 过期(31天) → 应显示「建议更新轮换」',
    pass: hasExpiredWarn && !hasFreshMsg && hasMask,
    expiredWarn: hasExpiredWarn,
    freshMsg: hasFreshMsg,
    mask: hasMask,
  })
  console.log('[1] TTL expired:', JSON.stringify(results[results.length - 1]))
  await page.close()
}

// ---------- 场景 2：Key 在有效期内（setAt = 5 天前）→ 应显示「30 天内无需轮换」 ----------
{
  const page = await freshPage()
  await page.evaluate(([keyEntry, keyMeta, enc]) => {
    localStorage.setItem(keyEntry, enc)
    localStorage.setItem(keyMeta, JSON.stringify({ setAt: Date.now() - 5 * 86400000, lastVerifiedAt: Date.now() - 5 * 86400000 }))
  }, [KEY_ENTRY, KEY_META, FAKE_ENCRYPTED])
  await page.goto(LLM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)

  const bodyText = await page.locator('body').innerText()
  const hasFreshMsg = bodyText.includes('30 天内无需轮换')
  const hasExpiredWarn = bodyText.includes('建议更新轮换')
  await page.screenshot({ path: path.join(OUT, '02-ttl-fresh.png'), fullPage: true })
  results.push({
    scenario: 'TTL 未过期(5天) → 应显示「30 天内无需轮换」',
    pass: hasFreshMsg && !hasExpiredWarn,
    freshMsg: hasFreshMsg,
    expiredWarn: hasExpiredWarn,
  })
  console.log('[2] TTL fresh:', JSON.stringify(results[results.length - 1]))
  await page.close()
}

// ---------- 场景 3：真实 API 调用（输入无效 Key → 应发起真实请求并报认证失败） ----------
{
  const page = await freshPage()
  await page.evaluate(([keyEntry, keyMeta]) => {
    localStorage.removeItem(keyEntry)
    localStorage.removeItem(keyMeta)
  }, [KEY_ENTRY, KEY_META])
  await page.goto(LLM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)

  // 捕获发往 LLM 提供商的请求（真实调用证据）
  const llmRequests = []
  page.on('request', (req) => {
    const u = req.url()
    if (/api\.(deepseek|moonshot|siliconflow|aliyuncs)\./i.test(u) || /\/v1\/chat\/completions/.test(u)) {
      llmRequests.push({ url: u, method: req.method(), status: 'pending' })
    }
  })
  page.on('response', (res) => {
    const u = res.url()
    if (/api\.(deepseek|moonshot|siliconflow|aliyuncs)\./i.test(u) || /\/v1\/chat\/completions/.test(u)) {
      const hit = llmRequests.find((r) => r.url === u && r.status === 'pending')
      if (hit) hit.status = String(res.status())
    }
  })

  // 输入无效 Key 并点击「测试连接」
  const apiKeyInput = page.locator('input[type="password"], input[placeholder="输入 API Key"]').first()
  await apiKeyInput.fill('sk-invalid-verify-test-12345')
  await page.getByRole('button', { name: '测试连接' }).click()

  // 等待测试结果出现
  let resultText = ''
  try {
    await page.waitForSelector('text=/连接成功|连接失败/', { timeout: 20000 })
    resultText = await page.locator('body').innerText()
  } catch { /* timeout */ }
  await page.waitForTimeout(500)

  const failMsg = resultText.split('\n').find((l) => l.includes('连接失败')) || ''
  const reqEvidence = llmRequests.filter((r) => r.url)
  await page.screenshot({ path: path.join(OUT, '03-real-call-failure.png'), fullPage: true })

  const pass = reqEvidence.length > 0 && failMsg.length > 0
  results.push({
    scenario: '真实调用（无效 Key → 发起真实请求 + 报错）',
    pass,
    realRequestCount: reqEvidence.length,
    requests: reqEvidence.slice(0, 3),
    failMsg: failMsg.slice(0, 200),
  })
  console.log('[3] real call:', JSON.stringify(results[results.length - 1]))
  await page.close()
}

fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(results, null, 2))
console.log('\n=== 汇总 ===')
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.scenario}`)
console.log(`通过 ${results.filter((r) => r.pass).length}/${results.length}`)
try { await browser.close() } catch (e) { console.error('[teardown] browser.close 异常（不影响结果）:', e && e.message) }
process.exit(results.every((r) => r.pass) ? 0 : 1)
