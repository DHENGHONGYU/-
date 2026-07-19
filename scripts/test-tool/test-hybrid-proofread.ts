import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { getLogger } from '@/lib/logger'
import { runFullProofread, ruleEngine, cloudSyncClient, hashService } from '@/services/hybrid-proofread'

const logger = getLogger()

async function createMockProject(): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-proofread-test-'))
  
  const testFiles = [
    {
      name: 'src/index.ts',
      content: `const api_key = 'sk-proj-abcdef1234567890abcdef1234567890'
const password = 'superSecret123!'
const url = 'http://localhost:3000'

export function getData() {
  return fetch(url, {
    headers: { Authorization: \`Bearer \${api_key}\` }
  })
}
`,
    },
    {
      name: 'src/config/env.ts',
      content: `export const config = {
  database: {
    host: 'localhost',
    port: 5432,
    username: 'admin',
    password: 'admin123',
  },
  api: {
    key: 'test-api-key-12345',
  }
}
`,
    },
    {
      name: '.env',
      content: `API_KEY=sk-secret-key-1234567890
DATABASE_URL=postgresql://user:pass@localhost:5432/db
SECRET_TOKEN=my-secret-token-value
`,
    },
    {
      name: 'build.gradle',
      content: `dependencies {
    implementation 'com.example:vulnerable-lib:1.0.0'
    implementation 'org.apache.commons:commons-lang3:3.12.0'
}
`,
    },
    {
      name: 'package.json',
      content: `{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "^4.17.21",
    "axios": "^1.6.0"
  }
}
`,
    },
    {
      name: 'docs/explanation/README.md',
      content: `# Test Project
This is a test project for hybrid proofreading.
`,
    },
  ]

  for (const file of testFiles) {
    const filePath = path.join(tempDir, file.name)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, file.content, 'utf-8')
    logger.info(`[Test] 创建测试文件: ${file.name}`)
  }

  return tempDir
}

async function cleanupMockProject(tempDir: string): Promise<void> {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
    logger.info(`[Test] 清理临时目录: ${tempDir}`)
  } catch (error) {
    logger.warn(`[Test] 清理临时目录失败: ${error}`)
  }
}

async function runTests() {
  logger.info(`\n========== 开始混合校对模块测试 ==========\n`)

  logger.info(`\n--- 测试 1: HashService 哈希计算 ---\n`)
  const testData = 'test data for hash'
  const hash = await hashService.computeHash(testData)
  logger.info(`原始数据: "${testData}"`)
  logger.info(`SHA3-256 哈希: ${hash}`)
  logger.info(`哈希长度: ${hash.length}`)
  logger.info(`测试通过: ${hash.length === 64}`)

  const hash2 = await hashService.computeHash(testData)
  logger.info(`重复计算一致性: ${hash === hash2}`)

  logger.info(`\n--- 测试 2: RuleEngine 规则加载 ---\n`)
  const rules = ruleEngine.getRules()
  logger.info(`规则版本: ${ruleEngine.getCurrentVersion()}`)
  logger.info(`规则总数: ${rules.length}`)
  logger.info(`规则列表:`)
  rules.forEach((rule) => {
    logger.info(`  - ${rule.rule_id}: ${rule.name} (${rule.severity})`)
  })

  const criticalRules = ruleEngine.getRulesBySeverity('critical')
  logger.info(`严重级别规则数: ${criticalRules.length}`)

  logger.info(`\n--- 测试 3: RuleEngine 规则评估 ---\n`)
  const testContent = `const api_key = 'sk-proj-abcdef1234567890abcdef1234567890'
const secret = 'password123'
`
  const matches = await ruleEngine.evaluateFile('/test/file.ts', testContent)
  logger.info(`测试内容包含 ${matches.length} 个规则匹配`)
  matches.forEach((match) => {
    logger.info(`  - ${match.rule_name} (${match.severity}) [行${match.line_number}:列${match.column_number}]`)
    logger.info(`    匹配内容: "${match.match_text}"`)
  })

  logger.info(`\n--- 测试 4: CloudSyncClient 哈希验证 ---\n`)
  const verifyResult = await cloudSyncClient.verifyHash({
    file_hash: 'mock-risky-hash-1',
    file_type: 'source_code',
    project_id: 'test-project-1',
  })
  logger.info(`风险哈希验证结果: ${verifyResult.status}`)
  logger.info(`风险等级: ${verifyResult.risk_level}`)
  logger.info(`关联 CVE: ${verifyResult.cve_ids?.join(', ') || '无'}`)

  const safeResult = await cloudSyncClient.verifyHash({
    file_hash: 'safe-hash-abc123',
    file_type: 'source_code',
    project_id: 'test-project-1',
  })
  logger.info(`安全哈希验证结果: ${safeResult.status}`)

  logger.info(`\n--- 测试 5: CloudSyncClient 批量验证 ---\n`)
  const batchResult = await cloudSyncClient.batchVerifyHashes({
    hash_list: ['mock-risky-hash-1', 'mock-risky-hash-2', 'safe-hash-1', 'safe-hash-2'],
    project_id: 'test-project-1',
  })
  const riskyCount = Object.values(batchResult.results).filter((r) => r.status === 'risky').length
  logger.info(`批量验证结果: ${Object.keys(batchResult.results).length} 个哈希`)
  logger.info(`风险哈希数: ${riskyCount}`)

  logger.info(`\n--- 测试 6: CloudSyncClient 风险详情 ---\n`)
  const riskDetails = await cloudSyncClient.getRiskDetails({
    hash_list: ['mock-risky-hash-1', 'mock-risky-hash-2'],
  })
  logger.info(`风险详情数: ${riskDetails.risks.length}`)
  riskDetails.risks.forEach((risk) => {
    logger.info(`  - CVE: ${risk.cve_id}`)
    logger.info(`    严重级别: ${risk.severity}`)
    logger.info(`    描述: ${risk.description}`)
    logger.info(`    修复建议: ${risk.remediation_advice}`)
  })

  logger.info(`\n--- 测试 7: CloudSyncClient 规则同步 ---\n`)
  const syncResult = await cloudSyncClient.syncRules()
  logger.info(`规则同步结果:`)
  logger.info(`  当前版本: ${syncResult.current_version}`)
  logger.info(`  最新版本: ${syncResult.latest_version}`)
  logger.info(`  是否更新: ${syncResult.updated}`)

  logger.info(`\n--- 测试 8: 完整校对流程（使用 Mock 项目） ---\n`)
  const tempDir = await createMockProject()
  logger.info(`测试项目目录: ${tempDir}`)

  try {
    const result = await runFullProofread('test-project-1', '测试项目', tempDir)

    logger.info(`\n校对结果: ${result.success ? '成功' : '失败'}`)
    
    if (result.success && result.report) {
      const report = result.report
      
      logger.info(`\n报告摘要:`)
      logger.info(`  报告ID: ${report.id}`)
      logger.info(`  项目名称: ${report.project_name}`)
      logger.info(`  扫描时间: ${new Date(report.scan_time).toLocaleString('zh-CN')}`)
      logger.info(`  总体风险等级: ${report.overall_risk_level}`)
      logger.info(`\n问题统计:`)
      logger.info(`  严重: ${report.critical_issues}`)
      logger.info(`  高危: ${report.high_issues}`)
      logger.info(`  中危: ${report.medium_issues}`)
      logger.info(`  低危: ${report.low_issues}`)
      logger.info(`  总计: ${report.total_issues}`)
      
      logger.info(`\n摘要描述: ${report.summary}`)
      
      if (report.recommendations.length > 0) {
        logger.info(`\n修复建议:`)
        report.recommendations.forEach((rec, index) => {
          logger.info(`  ${index + 1}. ${rec}`)
        })
      }

      logger.info(`\n本地扫描详情:`)
      logger.info(`  扫描文件数: ${report.local_scan.scanned_files}`)
      logger.info(`  跳过文件数: ${report.local_scan.skipped_files}`)
      logger.info(`  规则匹配数: ${report.local_scan.rule_matches.length}`)

      if (report.cloud_risk) {
        logger.info(`\n云端风险详情:`)
        logger.info(`  验证哈希数: ${report.cloud_risk.hash_count}`)
        logger.info(`  风险文件数: ${report.cloud_risk.risky_count}`)
        logger.info(`  风险条目数: ${report.cloud_risk.risks.length}`)
      }

      logger.info(`\n--- 测试 9: 导出报告 ---\n`)
      const { reportGenerator } = await import('@/services/hybrid-proofread')
      
      const mdReport = reportGenerator.exportReport(report, 'markdown')
      logger.info(`Markdown 报告长度: ${mdReport.length} 字符`)
      
      const htmlReport = reportGenerator.exportReport(report, 'html')
      logger.info(`HTML 报告长度: ${htmlReport.length} 字符`)
      
      const jsonReport = reportGenerator.exportReport(report, 'json')
      logger.info(`JSON 报告长度: ${jsonReport.length} 字符`)

      const reportOutputDir = path.join(__dirname, '../test-output')
      if (!fs.existsSync(reportOutputDir)) {
        fs.mkdirSync(reportOutputDir, { recursive: true })
      }
      
      fs.writeFileSync(path.join(reportOutputDir, 'proofread-report.md'), mdReport, 'utf-8')
      fs.writeFileSync(path.join(reportOutputDir, 'proofread-report.html'), htmlReport, 'utf-8')
      fs.writeFileSync(path.join(reportOutputDir, 'proofread-report.json'), jsonReport, 'utf-8')
      
      logger.info(`报告已导出至: ${reportOutputDir}`)
    } else {
      logger.error(`校对失败: ${result.error}`)
    }
  } finally {
    await cleanupMockProject(tempDir)
  }

  logger.info(`\n========== 混合校对模块测试完成 ==========\n`)
}

runTests().catch((error) => {
  logger.error(`测试执行失败: ${error}`, { stack: error.stack })
  process.exit(1)
})