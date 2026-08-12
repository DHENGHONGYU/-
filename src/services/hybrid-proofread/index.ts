/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { getLogger } from '@/lib/logger'

const logger = getLogger()

async function evaluateFileForMatches(
  fileHash: { file_path: string; file_type: string },
  fs: typeof import('fs'),
  ruleEngine: { evaluateFile(path: string, content: string): Promise<import('@/data/types').RuleMatchResult[]> },
  logger: ReturnType<typeof getLogger>,
): Promise<import('@/data/types').RuleMatchResult[]> {
  if (fileHash.file_type !== 'source_code' && fileHash.file_type !== 'config_file') {
    return []
  }
  try {
    const content = await fs.promises.readFile(fileHash.file_path, 'utf-8')
    return await ruleEngine.evaluateFile(fileHash.file_path, content)
  } catch (error) {
    logger.warn(`[HybridProofread] runFullProofread - 跳过文件评估`, {
      file_path: fileHash.file_path,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export { LocalCollector, localCollector, type ScanOptions } from './localCollector'
export { RuleEngine, ruleEngine } from './ruleEngine'
export { HashService, hashService } from './hashService'
export { CloudSyncClient, cloudSyncClient } from './cloudSyncClient'
export { ReportGenerator, reportGenerator } from './reportGenerator'

export async function runFullProofread(
  projectId: string,
  projectName: string,
  projectPath: string,
): Promise<{
  success: boolean
  report?: import('@/data/types').ProofreadReport
  error?: string
}> {
  const totalStartTime = Date.now()
  logger.info(`[HybridProofread] runFullProofread - 开始完整校对流程`, {
    project_id: projectId,
    project_name: projectName,
    project_path: projectPath,
    timestamp: new Date().toISOString(),
  })

  const { localCollector } = await import('./localCollector')
  const { ruleEngine } = await import('./ruleEngine')
  const { cloudSyncClient } = await import('./cloudSyncClient')
  const { reportGenerator } = await import('./reportGenerator')

  try {
    const syncRulesStart = Date.now()
    logger.info(`[HybridProofread] runFullProofread - Step 1/4: 同步规则`)
    await ruleEngine.syncRules()
    const syncRulesDuration = Date.now() - syncRulesStart
    logger.info(`[HybridProofread] runFullProofread - Step 1/4: 规则同步完成`, {
      duration_ms: syncRulesDuration,
      rule_version: ruleEngine.getCurrentVersion(),
      rule_count: ruleEngine.getRules().length,
    })

    const localScanStart = Date.now()
    logger.info(`[HybridProofread] runFullProofread - Step 2/4: 本地扫描`, {
      project_path: projectPath,
    })
    const localScan = await localCollector.scan({ projectId, projectPath })
    const localScanDuration = Date.now() - localScanStart
    logger.info(`[HybridProofread] runFullProofread - Step 2/4: 本地扫描完成`, {
      total_files: localScan.total_files,
      scanned_files: localScan.scanned_files,
      skipped_files: localScan.skipped_files,
      hash_count: localScan.hashes.length,
      duration_ms: localScanDuration,
      avg_per_file_ms: localScan.scanned_files > 0 ? (localScanDuration / localScan.scanned_files).toFixed(2) : '0',
    })

    const fs = await import('fs')
    const ruleMatches: import('@/data/types').RuleMatchResult[] = []
    const ruleEvalStart = Date.now()

    logger.info(`[HybridProofread] runFullProofread - Step 3/4: 规则评估`, {
      source_code_files: localScan.hashes.filter((h) => h.file_type === 'source_code').length,
      config_files: localScan.hashes.filter((h) => h.file_type === 'config_file').length,
    })

    for (const fileHash of localScan.hashes) {
      const matches = await evaluateFileForMatches(fileHash, fs, ruleEngine, logger)
      ruleMatches.push(...matches)
    }

    localScan.rule_matches = ruleMatches
    const ruleEvalDuration = Date.now() - ruleEvalStart

    const criticalMatches = ruleMatches.filter((m) => m.severity === 'critical').length
    const highMatches = ruleMatches.filter((m) => m.severity === 'high').length
    const mediumMatches = ruleMatches.filter((m) => m.severity === 'medium').length
    const lowMatches = ruleMatches.filter((m) => m.severity === 'low' || m.severity === 'warning').length

    logger.info(`[HybridProofread] runFullProofread - Step 3/4: 规则评估完成`, {
      total_matches: ruleMatches.length,
      critical_matches: criticalMatches,
      high_matches: highMatches,
      medium_matches: mediumMatches,
      low_matches: lowMatches,
      duration_ms: ruleEvalDuration,
    })

    const cloudCheckStart = Date.now()
    logger.info(`[HybridProofread] runFullProofread - Step 4/4: 云端风险检查`, {
      hash_count: localScan.hashes.length,
    })

    const hashList = localScan.hashes.map((h) => h.file_hash)
    logger.info(`[HybridProofread] runFullProofread - 上传哈希至云端`, {
      hash_count: hashList.length,
    })

    const batchVerifyStart = Date.now()
    const batchVerifyResponse = await cloudSyncClient.batchVerifyHashes({
      hash_list: hashList,
      project_id: projectId,
    })
    const batchVerifyDuration = Date.now() - batchVerifyStart
    logger.info(`[HybridProofread] runFullProofread - 云端批量验证完成`, {
      response_count: Object.keys(batchVerifyResponse.results).length,
      risky_count: Object.values(batchVerifyResponse.results).filter((r) => r.status === 'risky').length,
      duration_ms: batchVerifyDuration,
    })

    const riskyHashes = Object.entries(batchVerifyResponse.results)
      .filter(([, v]) => v.status === 'risky')
      .map(([hash]) => hash)

    logger.info(`[HybridProofread] runFullProofread - 获取风险详情`, {
      risky_hash_count: riskyHashes.length,
    })

    const riskDetailsStart = Date.now()
    const riskDetailsResponse = await cloudSyncClient.getRiskDetails({
      hash_list: riskyHashes,
    })
    const riskDetailsDuration = Date.now() - riskDetailsStart
    logger.info(`[HybridProofread] runFullProofread - 风险详情获取完成`, {
      risk_count: riskDetailsResponse.risks.length,
      duration_ms: riskDetailsDuration,
    })

    const cloudRisk: import('@/data/types').CloudRiskResult = {
      project_id: projectId,
      checked_at: Date.now(),
      hash_count: hashList.length,
      risky_count: riskyHashes.length,
      risks: riskDetailsResponse.risks,
    }

    const cloudCheckDuration = Date.now() - cloudCheckStart
    logger.info(`[HybridProofread] runFullProofread - Step 4/4: 云端风险检查完成`, {
      hash_count: cloudRisk.hash_count,
      risky_count: cloudRisk.risky_count,
      risk_detail_count: cloudRisk.risks.length,
      duration_ms: cloudCheckDuration,
      batch_verify_ms: batchVerifyDuration,
      risk_details_ms: riskDetailsDuration,
    })

    const reportStart = Date.now()
    logger.info(`[HybridProofread] runFullProofread - 生成校对报告`)
    const report = reportGenerator.generateReport(projectId, projectName, localScan, cloudRisk)
    const reportDuration = Date.now() - reportStart
    logger.info(`[HybridProofread] runFullProofread - 报告生成完成`, {
      report_id: report.id,
      total_issues: report.total_issues,
      critical_issues: report.critical_issues,
      high_issues: report.high_issues,
      medium_issues: report.medium_issues,
      low_issues: report.low_issues,
      overall_risk_level: report.overall_risk_level,
      duration_ms: reportDuration,
    })

    const totalDuration = Date.now() - totalStartTime
    logger.info(`[HybridProofread] runFullProofread - 完整校对流程结束`, {
      success: true,
      project_id: projectId,
      project_name: projectName,
      total_duration_ms: totalDuration,
      breakdown: {
        sync_rules_ms: syncRulesDuration,
        local_scan_ms: localScanDuration,
        rule_evaluation_ms: ruleEvalDuration,
        cloud_check_ms: cloudCheckDuration,
        report_generation_ms: reportDuration,
      },
      results: {
        total_files_scanned: localScan.scanned_files,
        total_hashes_computed: localScan.hashes.length,
        total_rule_matches: ruleMatches.length,
        total_cloud_risks: cloudRisk.risks.length,
        overall_risk_level: report.overall_risk_level,
        total_issues: report.total_issues,
      },
    })

    return { success: true, report }
  } catch (error) {
    const totalDuration = Date.now() - totalStartTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error(`[HybridProofread] runFullProofread - 校对流程失败`, {
      success: false,
      project_id: projectId,
      project_name: projectName,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      total_duration_ms: totalDuration,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}
