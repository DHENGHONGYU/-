/** @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。 */
import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { runFullProofread, ruleEngine } from '@/services/hybrid-proofread'
import type {
  ProofreadReport,
  LocalScanResult,
  CloudRiskResult,
  RuleConfig,
  RulesSyncResult,
} from '@/data/types'

const logger = getLogger()

interface HybridProofreadState {
  report: ProofreadReport | null
  localScan: LocalScanResult | null
  cloudRisk: CloudRiskResult | null
  rules: RuleConfig[]
  rulesVersion: string
  isScanning: boolean
  isSyncingRules: boolean
  isUploadingHashes: boolean
  error: string | null
  lastScanTime: number
  scanProgress: number
  scanStatus: 'idle' | 'scanning' | 'rule-evaluating' | 'cloud-checking' | 'generating-report' | 'completed' | 'error'

  startScan: (projectId: string, projectName: string, projectPath: string) => void
  cancelScan: () => void
  syncRules: () => void
  refreshRules: () => void
  clearReport: () => void
}

/**
 * useHybridProofreadStore
 */
export const useHybridProofreadStore = create<HybridProofreadState>((set, get) => ({
  report: null,
  localScan: null,
  cloudRisk: null,
  rules: [],
  rulesVersion: '1.0.0',
  isScanning: false,
  isSyncingRules: false,
  isUploadingHashes: false,
  error: null,
  lastScanTime: 0,
  scanProgress: 0,
  scanStatus: 'idle',

  startScan: async (projectId: string, projectName: string, projectPath: string) => {
    if (get().isScanning) {
      logger.warn('[HybridProofreadStore] Scan already in progress')
      return
    }

    set({
      isScanning: true,
      error: null,
      scanStatus: 'scanning',
      scanProgress: 0,
      report: null,
      localScan: null,
      cloudRisk: null,
    })

    try {
      logger.info(`[HybridProofreadStore] Starting full proofread for project: ${projectId}`)

      const result = await runFullProofread(projectId, projectName, projectPath)

      if (result.success && result.report) {
        set({
          report: result.report,
          localScan: result.report.local_scan,
          cloudRisk: result.report.cloud_risk,
          scanStatus: 'completed',
          scanProgress: 100,
          lastScanTime: Date.now(),
        })

        logger.info(`[HybridProofreadStore] Proofread completed`, {
          totalIssues: result.report.total_issues,
          riskLevel: result.report.overall_risk_level,
        })
      } else {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        throw new Error(result.error || 'Unknown error during proofread')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('[HybridProofreadStore] Scan failed', { error: message })
      set({
        error: message,
        scanStatus: 'error',
        scanProgress: 0,
      })
    } finally {
      set({ isScanning: false })
    }
  },

  cancelScan: () => {
    set({
      isScanning: false,
      scanStatus: 'idle',
      scanProgress: 0,
      error: 'Scan cancelled',
    })
    logger.info('[HybridProofreadStore] Scan cancelled')
  },

  syncRules: async () => {
    if (get().isSyncingRules) {
      logger.warn('[HybridProofreadStore] Rules sync already in progress')
      return
    }

    set({ isSyncingRules: true })

    try {
      const result: RulesSyncResult = await ruleEngine.syncRules()

      set({
        rulesVersion: result.latest_version,
        rules: ruleEngine.getRules(),
      })

      logger.info('[HybridProofreadStore] Rules synced', {
        updated: result.updated,
        version: result.latest_version,
        ruleCount: ruleEngine.getRules().length,
      })
    } catch (error) {
      logger.error('[HybridProofreadStore] Rules sync failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      set({ isSyncingRules: false })
    }
  },

  refreshRules: () => {
    set({
      rules: ruleEngine.getRules(),
      rulesVersion: ruleEngine.getCurrentVersion(),
    })
    logger.info('[HybridProofreadStore] Rules refreshed', {
      ruleCount: ruleEngine.getRules().length,
      version: ruleEngine.getCurrentVersion(),
    })
  },

  clearReport: () => {
    set({
      report: null,
      localScan: null,
      cloudRisk: null,
      error: null,
      scanStatus: 'idle',
      scanProgress: 0,
    })
    logger.info('[HybridProofreadStore] Report cleared')
  },
}))