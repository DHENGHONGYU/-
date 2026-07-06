/**
 * 安全模块协同健康检查脚本
 *
 * 验证所有安全模块之间的协同状态：
 *   1. 配置文件存在性检查
 *   2. 授权策略一致性验证
 *   3. 审计日志路径一致性验证
 *   4. 工具链配置一致性验证
 *   5. MCP 信任包白名单跨文件一致性
 *   6. .gitignore 日志保护
 *
 * 运行方式：
 *   npx tsx scripts/security/health-check.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { loadSecurityPolicy, TOOLCHAIN_CONFIG, type SecurityPolicy } from '../../src/config/security-policy'

// ============================================================
// 类型定义
// ============================================================
type CheckStatus = 'PASS' | 'FAIL' | 'WARN'

interface CheckResult {
  category: string
  check: string
  status: CheckStatus
  detail: string
}

const results: CheckResult[] = []

function addResult(category: string, check: string, status: CheckStatus, detail: string): void {
  results.push({ category, check, status, detail })
  const symbol = status === 'PASS' ? '[OK]' : status === 'FAIL' ? '[FAIL]' : '[!]'
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m'
  console.log(`${color}${symbol}\x1b[0m ${category} > ${check}: ${detail}`)
}

// ============================================================
// 检查 1：配置文件存在性
// ============================================================
function checkFileExistence(): void {
  console.log('\n=== 检查 1: 配置文件存在性 ===')

  const requiredFiles = [
    { p: '.npmrc', d: 'npm 安全配置' },
    { p: 'pip.conf', d: 'pip 安全配置' },
    { p: '.trae/mcp.json', d: 'MCP 配置' },
    { p: '.trae/mcp-whitelist-policy.json', d: 'MCP 白名单策略' },
    { p: 'src/config/security-policy.ts', d: '统一配置总线' },
    { p: 'scripts/security/setup-install-policy.ps1', d: 'Windows 安装策略' },
    { p: 'scripts/security/audit-installations.ps1', d: '审计脚本' },
    { p: 'scripts/security/mcp-confirmation-demo.ts', d: '确认门禁演示' },
    { p: '.github/workflows/quality-check.yml', d: 'CI/CD 配置' },
  ]

  for (const file of requiredFiles) {
    const fullPath = path.resolve(process.cwd(), file.p)
    if (fs.existsSync(fullPath)) {
      addResult('文件存在性', file.d, 'PASS', file.p)
    } else {
      addResult('文件存在性', file.d, 'FAIL', `${file.p} 不存在`)
    }
  }
}

// ============================================================
// 检查 2：授权策略一致性
// ============================================================
function checkAuthorizationConsistency(policy: SecurityPolicy): void {
  console.log('\n=== 检查 2: 授权策略一致性 ===')

  const allTools = [
    ...policy.authorizationRules.autoApprove,
    ...policy.authorizationRules.requireConfirmation,
    ...policy.authorizationRules.requireAdminApproval,
  ]

  const duplicates = allTools.filter((tool, index) => allTools.indexOf(tool) !== index)
  if (duplicates.length === 0) {
    addResult('授权策略', '工具唯一性', 'PASS', '无工具跨级别重复')
  } else {
    addResult('授权策略', '工具唯一性', 'FAIL', `重复工具: ${duplicates.join(', ')}`)
  }

  const consoleLogsDefined =
    policy.authorizationRules.autoApprove.includes('playwright_console_logs') ||
    policy.authorizationRules.requireConfirmation.includes('playwright_console_logs') ||
    policy.authorizationRules.requireAdminApproval.includes('playwright_console_logs')
  addResult('授权策略', 'console_logs 授权级别', consoleLogsDefined ? 'PASS' : 'FAIL', consoleLogsDefined ? '已定义' : '授权级别悬空')

  const evaluateInAdmin = policy.authorizationRules.requireAdminApproval.includes('playwright_evaluate')
  addResult('授权策略', 'evaluate 授权级别', evaluateInAdmin ? 'PASS' : 'FAIL', evaluateInAdmin ? 'requireAdminApproval（正确）' : '应在 requireAdminApproval 中')

  const readOnlyTools = ['playwright_navigate', 'playwright_screenshot', 'playwright_get_visible_text']
  const autoToolsValid = policy.authorizationRules.autoApprove.every((t) => readOnlyTools.includes(t))
  addResult('授权策略', 'autoApprove 只读性', autoToolsValid ? 'PASS' : 'WARN', autoToolsValid ? '全部为只读工具' : '包含非只读工具')
}

// ============================================================
// 检查 3：审计日志路径一致性
// ============================================================
function checkAuditLogConsistency(policy: SecurityPolicy): void {
  console.log('\n=== 检查 3: 审计日志路径一致性 ===')

  const policyLogPath = path.resolve(process.cwd(), policy.audit.logPath)
  const demoContent = fs.readFileSync(path.resolve(process.cwd(), 'scripts/security/mcp-confirmation-demo.ts'), 'utf-8')
  const demoUsesPolicyLog = demoContent.includes('writeAuditLog') || demoContent.includes('policy.audit.logPath')
  addResult('日志路径', 'TS demo 使用统一路径', demoUsesPolicyLog ? 'PASS' : 'FAIL', demoUsesPolicyLog ? '通过 writeAuditLog 委托' : '未引用 policy.audit.logPath')

  const logDir = path.dirname(policyLogPath)
  addResult('日志路径', '日志目录存在', fs.existsSync(logDir) ? 'PASS' : 'WARN', fs.existsSync(logDir) ? logDir : `${logDir} 尚未创建`)

  if (fs.existsSync(policyLogPath)) {
    const logLines = fs.readFileSync(policyLogPath, 'utf-8').trim().split('\n')
    const lastLine = logLines[logLines.length - 1] || ''
    try {
      JSON.parse(lastLine)
      addResult('日志路径', '日志格式 JSONL', 'PASS', '最近一条记录可解析为 JSON')
    } catch {
      addResult('日志路径', '日志格式 JSONL', 'WARN', '最近一条记录非 JSON 格式（旧格式残留）')
    }
  }
}

// ============================================================
// 检查 4：工具链配置一致性
// ============================================================
function checkToolchainConsistency(): void {
  console.log('\n=== 检查 4: 工具链配置一致性 ===')

  const npmrcPath = path.resolve(process.cwd(), '.npmrc')
  if (fs.existsSync(npmrcPath)) {
    const npmrc = fs.readFileSync(npmrcPath, 'utf-8')
    const registryMatch = npmrc.match(/^registry=(.+)$/m)
    if (registryMatch && registryMatch[1].trim() === TOOLCHAIN_CONFIG.npm.registry) {
      addResult('工具链', 'npm registry 一致', 'PASS', registryMatch[1].trim())
    } else if (registryMatch) {
      addResult('工具链', 'npm registry 一致', 'FAIL', `.npmrc=${registryMatch[1]}, config=${TOOLCHAIN_CONFIG.npm.registry}`)
    }
    addResult('工具链', 'npm ignore-scripts', npmrc.includes('ignore-scripts=true') ? 'PASS' : 'FAIL', npmrc.includes('ignore-scripts=true') ? '已启用' : '未启用')
  }

  const pipConfPath = path.resolve(process.cwd(), 'pip.conf')
  if (fs.existsSync(pipConfPath)) {
    const pipConf = fs.readFileSync(pipConfPath, 'utf-8')
    addResult('工具链', 'pip index-url 一致', pipConf.includes(TOOLCHAIN_CONFIG.pip.indexUrl) ? 'PASS' : 'FAIL', TOOLCHAIN_CONFIG.pip.indexUrl)
  }
}

// ============================================================
// 检查 5：MCP 配置一致性
// ============================================================
function checkMcpConsistency(policy: SecurityPolicy): void {
  console.log('\n=== 检查 5: MCP 配置一致性 ===')

  const mcpJsonPath = path.resolve(process.cwd(), '.trae/mcp.json')
  if (fs.existsSync(mcpJsonPath)) {
    try {
      // 去除 BOM 字符后解析
      const rawContent = fs.readFileSync(mcpJsonPath, 'utf-8').replace(/^\uFEFF/, '').trim()
      const mcpConfig = JSON.parse(rawContent)
      const registeredServers = Object.keys(mcpConfig.mcpServers || {})

      for (const server of registeredServers) {
        if (server in policy.trustedMcpServers) {
          addResult('MCP 配置', `${server} 信任状态`, 'PASS', '在 trustedMcpServers 中')
        } else {
          addResult('MCP 配置', `${server} 信任状态`, 'FAIL', '已注册但未在 trustedMcpServers 中')
        }
      }

      for (const blockedServer of Object.keys(policy.blockedMcpServers)) {
        if (blockedServer in (mcpConfig.mcpServers || {})) {
          addResult('MCP 配置', `${blockedServer} 阻止状态`, 'FAIL', '在 blockedMcpServers 中但仍在 mcp.json 注册')
        } else {
          addResult('MCP 配置', `${blockedServer} 阻止状态`, 'PASS', '已阻止且未注册')
        }
      }
    } catch (parseError) {
      const errMsg = parseError instanceof Error ? parseError.message : String(parseError)
      addResult('MCP 配置', 'mcp.json 解析', 'FAIL', `JSON 解析失败: ${errMsg}`)
    }
  }

  // 5.3: TS demo 不应硬编码 AUTHORIZATION_RULES
  const demoContent = fs.readFileSync(path.resolve(process.cwd(), 'scripts/security/mcp-confirmation-demo.ts'), 'utf-8')
  addResult('MCP 配置', 'TS demo 零硬编码', !demoContent.includes('AUTHORIZATION_RULES') ? 'PASS' : 'FAIL', !demoContent.includes('AUTHORIZATION_RULES') ? '通过 checkAuthorization 加载' : '仍包含硬编码 AUTHORIZATION_RULES')
}

// ============================================================
// 检查 6：.gitignore 日志保护
// ============================================================
function checkGitignore(): void {
  console.log('\n=== 检查 6: .gitignore 日志保护 ===')

  const gitignorePath = path.resolve(process.cwd(), '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8')
    const hasTraeLogs = gitignore.includes('.trae/logs') || gitignore.includes('*.log')
    addResult('Git 保护', '日志文件忽略', hasTraeLogs ? 'PASS' : 'WARN', hasTraeLogs ? '.gitignore 包含日志忽略规则' : '.gitignore 未包含 .trae/logs 或 *.log')
  } else {
    addResult('Git 保护', '.gitignore 存在', 'FAIL', '.gitignore 不存在')
  }
}

// ============================================================
// 报告生成
// ============================================================
function generateReport(): void {
  const passCount = results.filter((r) => r.status === 'PASS').length
  const failCount = results.filter((r) => r.status === 'FAIL').length
  const warnCount = results.filter((r) => r.status === 'WARN').length

  console.log('\n')
  console.log('+============================================================+')
  console.log('|               协同健康检查报告                             |')
  console.log('+============================================================+')
  console.log(`|  PASS: ${passCount}  |  FAIL: ${failCount}  |  WARN: ${warnCount}  |  Total: ${results.length}`)
  console.log('+============================================================+')

  if (failCount > 0) {
    console.log('\n\x1b[31m[失败项]\x1b[0m')
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`  - ${r.category} > ${r.check}: ${r.detail}`)
    })
  }

  if (warnCount > 0) {
    console.log('\n\x1b[33m[警告项]\x1b[0m')
    results.filter((r) => r.status === 'WARN').forEach((r) => {
      console.log(`  - ${r.category} > ${r.check}: ${r.detail}`)
    })
  }

  // 生成 Markdown 报告
  const reportDir = path.resolve(process.cwd(), '.trae', 'logs')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }
  const reportPath = path.join(reportDir, `health-check-${Date.now()}.md`)
  const md = [
    `# 安全模块协同健康检查报告`,
    ``,
    `**时间**: ${new Date().toISOString()}`,
    `**结果**: PASS=${passCount} FAIL=${failCount} WARN=${warnCount}`,
    ``,
    `| 类别 | 检查项 | 状态 | 详情 |`,
    `|------|--------|------|------|`,
    ...results.map((r) => `| ${r.category} | ${r.check} | ${r.status} | ${r.detail} |`),
    ``,
  ].join('\n')
  fs.writeFileSync(reportPath, md, 'utf-8')
  console.log(`\n\x1b[36m[报告] Markdown 报告已生成: ${reportPath}\x1b[0m`)
}

// ============================================================
// 主流程
// ============================================================
function main(): void {
  console.log('+============================================================+')
  console.log('|     V9 安全模块协同健康检查                                |')
  console.log('+============================================================+')

  let policy: SecurityPolicy
  try {
    policy = loadSecurityPolicy()
    console.log(`[INFO] 策略版本: ${policy.policyVersion}, 策略名: ${policy.policyName}`)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error(`\x1b[31m[FATAL] 无法加载安全策略: ${errMsg}\x1b[0m`)
    process.exit(1)
  }

  checkFileExistence()
  checkAuthorizationConsistency(policy)
  checkAuditLogConsistency(policy)
  checkToolchainConsistency()
  checkMcpConsistency(policy)
  checkGitignore()
  generateReport()
}

main()
