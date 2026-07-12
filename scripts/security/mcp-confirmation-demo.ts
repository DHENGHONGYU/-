/**
 * MCP 确认门禁演示脚本
 *
 * 模拟 Trae IDE 中 AI 调用 playwright_click 时的完整确认流程：
 *   1. AI 发起工具调用请求
 *   2. 门禁拦截，通过 checkAuthorization 检查授权策略
 *   3. 触发确认弹窗（模拟为控制台交互）
 *   4. 用户确认/拒绝
 *   5. 执行或跳过操作
 *   6. 写入 JSONL 审计日志（统一格式）
 *
 * 授权规则从 .trae/mcp-whitelist-policy.json 加载，零硬编码。
 *
 * 运行方式：
 *   npx tsx scripts/security/mcp-confirmation-demo.ts
 */

import { chromium, type Browser, type Page } from 'playwright'
import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'
import {
  loadSecurityPolicy,
  checkAuthorization,
  writeAuditLog,
  type SecurityPolicy,
  type AuthorizationLevel,
  type ToolCallRequest,
} from '../../src/config/security-policy'

// ============================================================
// 配置常量（仅路径，授权规则从 policy 加载）
// ============================================================
const TARGET_URL = 'http://localhost:4173/#/input'
const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots')

// ============================================================
// 类型定义（ToolCallRequest 从 security-policy 导入）
// ============================================================
interface ToolCallResult {
  request: ToolCallRequest
  authorized: boolean
  executed: boolean
  result?: string
  error?: string
  durationMs: number
  auditLevel: AuthorizationLevel | 'denied'
}

// ============================================================
// 审计日志（统一 JSONL 格式，委托给 security-policy.writeAuditLog）
// ============================================================
function logAudit(
  policy: SecurityPolicy,
  action: string,
  detail: string,
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO',
  toolName?: string,
  authorized?: boolean,
  auditLevel?: AuthorizationLevel | 'denied',
): void {
  writeAuditLog(policy, {
    level,
    module: 'mcp-confirmation-demo',
    action,
    detail,
    toolName,
    authorized,
    auditLevel,
  })
  console.log(`\x1b[36m[审计日志] ${action} | ${detail}\x1b[0m`)
}

// ============================================================
// 控制台交互（模拟 Trae 确认弹窗）
// ============================================================
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

// ============================================================
// 确认弹窗渲染（模拟 Trae IDE UI）
// ============================================================
function renderConfirmationDialog(request: ToolCallRequest): void {
  const boxWidth = 64
  const inner = (text: string) => `| ${text.padEnd(boxWidth - 2)} |`
  const border = (char: string) => `${char}${'-'.repeat(boxWidth)}${char}`

  console.log('\n')
  console.log(border('+'))
  console.log(inner(''))
  console.log(inner('  [!]  MCP 工具调用确认请求'))
  console.log(inner(''))
  console.log(border('+'))
  console.log(inner(`  工具名称 : ${request.toolName}`))
  console.log(inner(`  调用者   : ${request.caller}`))
  console.log(inner(`  时间戳   : ${request.timestamp}`))
  console.log(border('+'))
  console.log(inner('  参数列表 :'))
  for (const [key, value] of Object.entries(request.parameters)) {
    const valStr = typeof value === 'string' ? value : JSON.stringify(value)
    console.log(inner(`    ${key}: ${valStr}`))
  }
  console.log(border('+'))
  console.log(inner('  风险评估 :'))
  console.log(inner('    - 类型: 写操作（有副作用）'))
  console.log(inner('    - 可逆性: 不可逆（可能触发表单提交）'))
  console.log(inner('    - 信息流: AI -> 应用（写入）'))
  console.log(inner('    - 授权级别: requireConfirmation'))
  console.log(border('+'))
  console.log(inner('  请选择: [y] 确认执行  [n] 拒绝  [v] 查看详情'))
  console.log(border('+'))
}

// ============================================================
// 授权门禁（使用统一 checkAuthorization，消除硬编码）
// ============================================================
async function authorizeToolCall(
  policy: SecurityPolicy,
  request: ToolCallRequest,
): Promise<ToolCallResult> {
  const startTime = Date.now()
  const { toolName } = request

  // 阶段 1：通过统一授权检查器判断级别
  const authResult = checkAuthorization(policy, toolName)

  if (authResult.level === 'autoApprove') {
    console.log(`\n\x1b[32m[门禁] ${toolName} -> 自动批准（${authResult.reason}）\x1b[0m`)
    return {
      request,
      authorized: true,
      executed: false,
      durationMs: Date.now() - startTime,
      auditLevel: 'autoApprove',
    }
  }

  if (authResult.level === 'requireAdminApproval') {
    console.log(`\n\x1b[31m[门禁] ${toolName} -> 需要管理员审批（${authResult.reason}）\x1b[0m`)
    return {
      request,
      authorized: false,
      executed: false,
      durationMs: Date.now() - startTime,
      auditLevel: 'requireAdminApproval',
      error: '需要管理员审批，本次演示跳过',
    }
  }

  if (authResult.level === 'denied') {
    console.log(`\n\x1b[31m[门禁] ${toolName} -> 拒绝（${authResult.reason}）\x1b[0m`)
    return {
      request,
      authorized: false,
      executed: false,
      durationMs: Date.now() - startTime,
      auditLevel: 'denied',
      error: authResult.reason,
    }
  }

  // 阶段 2：requireConfirmation -> 触发确认弹窗
  console.log(`\n\x1b[33m[门禁] ${toolName} -> 需要用户确认（${authResult.reason}）\x1b[0m`)
  renderConfirmationDialog(request)

  // 阶段 3：等待用户输入
  const answer = await promptUser('\n  请输入选择 (y/n/v): ')

  if (answer === 'v') {
    console.log('\n  --- 详细参数 ---')
    console.log(JSON.stringify(request, null, 2))
    const answer2 = await promptUser('\n  请输入选择 (y/n): ')
    if (answer2 !== 'y') {
      console.log('\x1b[31m\n  [门禁] 用户拒绝执行\x1b[0m')
      return {
        request,
        authorized: false,
        executed: false,
        durationMs: Date.now() - startTime,
        auditLevel: 'denied',
      }
    }
  } else if (answer !== 'y') {
    console.log('\x1b[31m\n  [门禁] 用户拒绝执行\x1b[0m')
    return {
      request,
      authorized: false,
      executed: false,
      durationMs: Date.now() - startTime,
      auditLevel: 'denied',
    }
  }

  console.log('\x1b[32m\n  [门禁] 用户确认执行 [OK]\x1b[0m')

  return {
    request,
    authorized: true,
    executed: false,
    durationMs: Date.now() - startTime,
    auditLevel: 'requireConfirmation',
  }
}

// ============================================================
// 主流程
// ============================================================
async function main(): Promise<void> {
  // 加载安全策略（单一数据源）
  const policy = loadSecurityPolicy()

  console.log('\n')
  console.log('+------------------------------------------------------------+')
  console.log('|  MCP 确认门禁演示 — playwright_click 点击提交按钮          |')
  console.log('+------------------------------------------------------------+')
  console.log(`|  策略版本: ${policy.policyVersion}  |  策略名: ${policy.policyName}`)
  console.log(`+------------------------------------------------------------+`)

  logAudit(policy, '演示开始', '模拟 playwright_click 调用流程')

  // ----------------------------------------------------------
  // 步骤 1：AI 发起 navigate 请求（自动批准，无需确认）
  // ----------------------------------------------------------
  console.log('\n+---------------------------------------------------------+')
  console.log('| 步骤 1: AI 调用 playwright_navigate（自动批准）        |')
  console.log('+---------------------------------------------------------+')

  const navRequest: ToolCallRequest = {
    toolName: 'playwright_navigate',
    parameters: { url: TARGET_URL },
    caller: 'AI-Agent',
    timestamp: new Date().toISOString(),
  }

  const navResult = await authorizeToolCall(policy, navRequest)
  logAudit(policy, '授权检查', `playwright_navigate -> ${navResult.auditLevel}`, 'INFO', 'playwright_navigate', navResult.authorized, navResult.auditLevel)

  // ----------------------------------------------------------
  // 步骤 2：启动浏览器并执行 navigate
  // ----------------------------------------------------------
  console.log('\n+---------------------------------------------------------+')
  console.log('| 步骤 2: 启动浏览器，执行 navigate                      |')
  console.log('+---------------------------------------------------------+')

  const browser: Browser = await chromium.launch({ headless: true })
  const page: Page = await browser.newPage()

  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=股票池看板', { timeout: 10000 })
    console.log('\x1b[32m  [OK] 导航成功: 已打开输入舱\x1b[0m')

    // 截图：点击前
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    }
    const beforePath = path.join(SCREENSHOT_DIR, 'click-before.png')
    await page.screenshot({ path: beforePath, fullPage: true })
    console.log(`\x1b[32m  [OK] 点击前截图: ${beforePath}\x1b[0m`)

    // ----------------------------------------------------------
    // 步骤 3：AI 发起 click 请求（需要用户确认）
    // ----------------------------------------------------------
    console.log('\n+---------------------------------------------------------+')
    console.log('| 步骤 3: AI 调用 playwright_click（需用户确认）         |')
    console.log('+---------------------------------------------------------+')

    const clickRequest: ToolCallRequest = {
      toolName: 'playwright_click',
      parameters: {
        selector: 'button:has-text("新建分组")',
        target: '新建分组按钮',
        intent: '打开新建分组对话框',
      },
      caller: 'AI-Agent',
      timestamp: new Date().toISOString(),
    }

    const clickAuth = await authorizeToolCall(policy, clickRequest)

    if (!clickAuth.authorized) {
      console.log('\n\x1b[33m  [结果] 用户拒绝执行点击操作，流程终止\x1b[0m')
      logAudit(policy, '授权检查', `playwright_click -> ${clickAuth.auditLevel}（用户拒绝）`, 'WARN', 'playwright_click', false, clickAuth.auditLevel)
      return
    }

    logAudit(policy, '授权检查', `playwright_click -> ${clickAuth.auditLevel}（用户确认）`, 'SUCCESS', 'playwright_click', true, clickAuth.auditLevel)

    // ----------------------------------------------------------
    // 步骤 4：执行点击操作
    // ----------------------------------------------------------
    console.log('\n+---------------------------------------------------------+')
    console.log('| 步骤 4: 执行点击操作                                   |')
    console.log('+---------------------------------------------------------+')

    const clickButton = page.locator('button:has-text("新建分组")').first()
    await clickButton.click()
    console.log('\x1b[32m  [OK] 已点击"新建分组"按钮\x1b[0m')

    // 等待对话框出现
    await page.waitForTimeout(1000)

    // 截图：点击后
    const afterPath = path.join(SCREENSHOT_DIR, 'click-after.png')
    await page.screenshot({ path: afterPath, fullPage: true })
    console.log(`\x1b[32m  [OK] 点击后截图: ${afterPath}\x1b[0m`)

    // ----------------------------------------------------------
    // 步骤 5：验证点击效果
    // ----------------------------------------------------------
    console.log('\n+---------------------------------------------------------+')
    console.log('| 步骤 5: 验证点击效果                                   |')
    console.log('+---------------------------------------------------------+')

    const hasDialog = await page.locator('input[placeholder*="分组名称"]').isVisible().catch(() => false)
    if (hasDialog) {
      console.log('\x1b[32m  [OK] 验证成功: 新建分组对话框已弹出\x1b[0m')
      logAudit(policy, '执行结果', 'playwright_click 执行成功: 对话框已弹出', 'SUCCESS', 'playwright_click')
    } else {
      console.log('\x1b[33m  [!] 验证: 对话框未检测到（可能 UI 结构不同）\x1b[0m')
      logAudit(policy, '执行结果', 'playwright_click 执行完成: 对话框未检测到', 'WARN', 'playwright_click')
    }

    // ----------------------------------------------------------
    // 步骤 6：关闭对话框（清理）
    // ----------------------------------------------------------
    console.log('\n+---------------------------------------------------------+')
    console.log('| 步骤 6: 清理 — 关闭对话框                              |')
    console.log('+---------------------------------------------------------+')

    await page.keyboard.press('Escape')
    console.log('\x1b[32m  [OK] 已关闭对话框\x1b[0m')

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error(`\x1b[31m  [FAIL] 执行失败: ${errMsg}\x1b[0m`)
    logAudit(policy, '执行失败', errMsg, 'ERROR')
  } finally {
    await browser.close()
    logAudit(policy, '演示结束', '浏览器已关闭')
    console.log('\n\x1b[36m[审计日志] JSONL 格式日志已写入: ' + policy.audit.logPath + '\x1b[0m')
  }
}

// 启动演示
main().catch(console.error)
