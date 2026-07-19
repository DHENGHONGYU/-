import { getLogger } from '@/lib/logger'
import { safeRegex } from '@/lib/safeRegex'
import type { RuleConfig, RulePackage, RuleMatchResult, RulesSyncResult } from '@/data/types'
import { HYBRID_PROOFREAD_CONFIG, HYBRID_PROOFREAD_DEFAULT_RULES } from '@/config/hybridProofreadConfig'
import { defaultStorage } from '@/lib/localStorageManager'

const logger = getLogger()

/**
 * RuleEngine
 */
export class RuleEngine {
  private rules: RuleConfig[] = []
  private currentVersion: string = HYBRID_PROOFREAD_CONFIG.rules.defaultVersion
  private lastSyncTime: number = 0

  constructor() {
    void this.loadRules()
  }

  async loadRules(): Promise<void> {
    const startTime = Date.now()
    logger.info(`[RuleEngine] loadRules - 开始加载规则`)

    try {
      const cachedRules = defaultStorage.get(HYBRID_PROOFREAD_CONFIG.rules.cacheKey)
      if (typeof cachedRules === 'string') {
        const parsed = JSON.parse(cachedRules) as RulePackage
        this.rules = parsed.rules
        this.currentVersion = parsed.version

        logger.info(`[RuleEngine] loadRules - 从缓存加载规则成功`, {
          version: parsed.version,
          rule_count: parsed.rules.length,
          cache_key: HYBRID_PROOFREAD_CONFIG.rules.cacheKey,
          duration_ms: Date.now() - startTime,
        })
      } else {
        this.rules = HYBRID_PROOFREAD_DEFAULT_RULES

        logger.info(`[RuleEngine] loadRules - 缓存未命中，使用默认规则`, {
          version: this.currentVersion,
          rule_count: this.rules.length,
          duration_ms: Date.now() - startTime,
        })
      }
    } catch (error) {
      logger.error(`[RuleEngine] loadRules - 加载规则失败，使用默认规则`, {
        error: error instanceof Error ? error.message : String(error),
        cache_key: HYBRID_PROOFREAD_CONFIG.rules.cacheKey,
        duration_ms: Date.now() - startTime,
      })
      this.rules = HYBRID_PROOFREAD_DEFAULT_RULES
    }
  }

  async syncRules(): Promise<RulesSyncResult> {
    const startTime = Date.now()
    const now = Date.now()

    if (now - this.lastSyncTime < HYBRID_PROOFREAD_CONFIG.rules.syncIntervalMs) {
      const timeUntilNextSync = HYBRID_PROOFREAD_CONFIG.rules.syncIntervalMs - (now - this.lastSyncTime)
      logger.info(`[RuleEngine] syncRules - 规则同步未到时间间隔`, {
        last_sync_time: new Date(this.lastSyncTime).toISOString(),
        sync_interval_ms: HYBRID_PROOFREAD_CONFIG.rules.syncIntervalMs,
        time_until_next_sync_ms: timeUntilNextSync,
        current_version: this.currentVersion,
      })

      return {
        current_version: this.currentVersion,
        latest_version: this.currentVersion,
        updated: false,
        downloaded_rules: 0,
        skipped_rules: 0,
      }
    }

    logger.info(`[RuleEngine] syncRules - 开始同步规则`, {
      current_version: this.currentVersion,
      last_sync_time: new Date(this.lastSyncTime).toISOString(),
      sync_interval_ms: HYBRID_PROOFREAD_CONFIG.rules.syncIntervalMs,
    })

    try {
      const versionStart = Date.now()
      const versionResponse = await this.fetchLatestVersion()
      const latestVersion = versionResponse.version
      const versionFetchDuration = Date.now() - versionStart

      logger.info(`[RuleEngine] syncRules - 获取最新版本完成`, {
        current_version: this.currentVersion,
        latest_version: latestVersion,
        fetch_duration_ms: versionFetchDuration,
      })

      if (latestVersion === this.currentVersion) {
        this.lastSyncTime = now

        logger.info(`[RuleEngine] syncRules - 当前规则已是最新版本`, {
          version: latestVersion,
          total_duration_ms: Date.now() - startTime,
        })

        return {
          current_version: this.currentVersion,
          latest_version: latestVersion,
          updated: false,
          downloaded_rules: 0,
          skipped_rules: 0,
        }
      }

      const downloadStart = Date.now()
      const rulesResponse = await this.downloadRules(latestVersion)
      const downloadDuration = Date.now() - downloadStart

      logger.info(`[RuleEngine] syncRules - 规则下载完成`, {
        version: rulesResponse.version,
        rule_count: rulesResponse.rules.length,
        download_duration_ms: downloadDuration,
        checksum: rulesResponse.checksum,
      })

      this.rules = rulesResponse.rules
      this.currentVersion = rulesResponse.version

      const cacheStart = Date.now()
      await this.cacheRules(rulesResponse)
      const cacheDuration = Date.now() - cacheStart

      logger.info(`[RuleEngine] syncRules - 规则缓存完成`, {
        cache_key: HYBRID_PROOFREAD_CONFIG.rules.cacheKey,
        cache_duration_ms: cacheDuration,
      })

      this.lastSyncTime = now

      const totalDuration = Date.now() - startTime
      logger.info(`[RuleEngine] syncRules - 规则更新成功`, {
        previous_version: this.currentVersion,
        new_version: latestVersion,
        rule_count: rulesResponse.rules.length,
        version_fetch_ms: versionFetchDuration,
        download_ms: downloadDuration,
        cache_ms: cacheDuration,
        total_duration_ms: totalDuration,
      })

      return {
        current_version: this.currentVersion,
        latest_version: latestVersion,
        updated: true,
        downloaded_rules: rulesResponse.rules.length,
        skipped_rules: 0,
      }
    } catch (error) {
      logger.error(`[RuleEngine] syncRules - 同步规则失败，继续使用当前规则`, {
        error: error instanceof Error ? error.message : String(error),
        current_version: this.currentVersion,
        total_duration_ms: Date.now() - startTime,
      })

      return {
        current_version: this.currentVersion,
        latest_version: this.currentVersion,
        updated: false,
        downloaded_rules: 0,
        skipped_rules: 0,
      }
    }
  }

  async fetchLatestVersion(): Promise<{ version: string }> {
    const startTime = Date.now()
    logger.debug(`[RuleEngine] fetchLatestVersion - 开始获取最新版本`)

    const response = { version: this.currentVersion }

    logger.debug(`[RuleEngine] fetchLatestVersion - 获取完成`, {
      version: response.version,
      duration_ms: Date.now() - startTime,
    })

    return response
  }

  async downloadRules(version: string): Promise<RulePackage> {
    const startTime = Date.now()
    logger.debug(`[RuleEngine] downloadRules - 开始下载规则`, {
      version,
    })

    const response: RulePackage = {
      version,
      release_date: new Date().toISOString(),
      rules: HYBRID_PROOFREAD_DEFAULT_RULES,
      checksum: '',
    }

    logger.debug(`[RuleEngine] downloadRules - 下载完成`, {
      version: response.version,
      rule_count: response.rules.length,
      duration_ms: Date.now() - startTime,
    })

    return response
  }

  async cacheRules(packageData: RulePackage): Promise<void> {
    const startTime = Date.now()
    const cacheKey = HYBRID_PROOFREAD_CONFIG.rules.cacheKey

    logger.debug(`[RuleEngine] cacheRules - 开始缓存规则`, {
      cache_key: cacheKey,
      version: packageData.version,
      rule_count: packageData.rules.length,
    })

    defaultStorage.set(cacheKey, JSON.stringify(packageData))

    logger.debug(`[RuleEngine] cacheRules - 缓存完成`, {
      cache_key: cacheKey,
      duration_ms: Date.now() - startTime,
    })
  }

  async evaluateFile(filePath: string, content: string): Promise<RuleMatchResult[]> {
    const startTime = Date.now()
    logger.debug(`[RuleEngine] evaluateFile - 开始评估文件`, {
      file_path: filePath,
      content_length: content.length,
      rule_count: this.rules.length,
    })

    const results: RuleMatchResult[] = []
    let matchedRules = 0
    let skippedRules = 0

    for (const rule of this.rules) {
      if (rule.file_pattern && !this.matchesFilePattern(filePath, rule.file_pattern)) {
        skippedRules++
        continue
      }

      const matches = this.findMatches(content, rule.pattern)
      for (const match of matches) {
        results.push({
          rule_id: rule.rule_id,
          rule_name: rule.name,
          severity: rule.severity,
          category: rule.category,
          file_path: filePath,
          line_number: match.lineNumber,
          column_number: match.column,
          match_text: match.text,
          description: rule.description,
          action_type: rule.action_type,
        })
      }

      if (matches.length > 0) {
        matchedRules++
        logger.debug(`[RuleEngine] evaluateFile - 规则匹配`, {
          rule_id: rule.rule_id,
          rule_name: rule.name,
          match_count: matches.length,
          severity: rule.severity,
        })
      }
    }

    const duration = Date.now() - startTime
    logger.debug(`[RuleEngine] evaluateFile - 评估完成`, {
      file_path: filePath,
      total_rules: this.rules.length,
      matched_rules: matchedRules,
      skipped_rules: skippedRules,
      total_matches: results.length,
      duration_ms: duration,
      avg_rule_ms: this.rules.length > 0 ? (duration / this.rules.length).toFixed(2) : '0',
    })

    return results
  }

  private matchesFilePattern(filePath: string, filePattern: string): boolean {
    const regex = safeRegex(filePattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
    return regex.test(filePath)
  }

  private findMatches(content: string, pattern: string): Array<{ text: string; lineNumber: number; column: number }> {
    const results: Array<{ text: string; lineNumber: number; column: number }> = []
    const regex = safeRegex(pattern, 'g')
    let match: RegExpExecArray | null

    while ((match = regex.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index)
      const lineNumber = beforeMatch.split('\n').length
      const lastNewlineIndex = beforeMatch.lastIndexOf('\n')
      const column = match.index - (lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1) + 1

      results.push({
        text: match[0],
        lineNumber,
        column,
      })
    }

    return results
  }

  getRules(): RuleConfig[] {
    return [...this.rules]
  }

  getCurrentVersion(): string {
    return this.currentVersion
  }

  getRuleById(ruleId: string): RuleConfig | undefined {
    return this.rules.find((r) => r.rule_id === ruleId)
  }

  getRulesByCategory(category: RuleConfig['category']): RuleConfig[] {
    return this.rules.filter((r) => r.category === category)
  }

  getRulesBySeverity(severity: RuleConfig['severity']): RuleConfig[] {
    return this.rules.filter((r) => r.severity === severity)
  }
}

/**
 * ruleEngine
 */
export const ruleEngine = new RuleEngine()