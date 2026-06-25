import { getLogger } from '@/lib/logger'
import type { EnvelopeAction, EnvelopeMeta, EnvelopeTarget, ModuleId } from '@/config/dbConfig'
import { ENVELOPE_TARGET } from '@/config/dbConfig'

const logger = getLogger()

export interface StandardEnvelope {
  meta: EnvelopeMeta
  payload: unknown
}

export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvelopeError'
  }
}

interface ValidationResult {
  valid: boolean
  error?: string
}

export class EnvelopeFactory {
  static create(
    meta: Omit<EnvelopeMeta, 'timestamp'> & { timestamp?: number },
    payload: unknown,
  ): StandardEnvelope {
    logger.debug(`[EnvelopeFactory] create() called: action="${meta.action}", source="${meta.source}", target="${meta.target}"`)

    const envelope: StandardEnvelope = {
      meta: {
        ...meta,
        timestamp: meta.timestamp ?? Date.now(),
      },
      payload,
    }

    logger.info(`[EnvelopeFactory] Envelope created: action="${meta.action}", source="${meta.source}", traceId="${meta.traceId}"`)
    return envelope
  }

  static validate(envelope: StandardEnvelope): ValidationResult {
    logger.debug(`[EnvelopeFactory] validate() called`)

    if (!envelope || typeof envelope !== 'object') {
      logger.warn(`[EnvelopeFactory] Validation failed: Envelope must be an object`)
      return { valid: false, error: 'Envelope must be an object' }
    }

    const { meta, payload } = envelope

    if (!meta || typeof meta !== 'object') {
      logger.warn(`[EnvelopeFactory] Validation failed: Envelope meta is required`)
      return { valid: false, error: 'Envelope meta is required' }
    }

    if (!meta.source || typeof meta.source !== 'string') {
      logger.warn(`[EnvelopeFactory] Validation failed: Envelope source is required`)
      return { valid: false, error: 'Envelope source is required' }
    }

    if (!Object.values(ENVELOPE_TARGET).includes(meta.target as EnvelopeTarget)) {
      logger.warn(`[EnvelopeFactory] Validation failed: Invalid envelope target "${meta.target}"`)
      return { valid: false, error: `Invalid envelope target: ${meta.target}` }
    }

    if (!meta.action || typeof meta.action !== 'string') {
      logger.warn(`[EnvelopeFactory] Validation failed: Envelope action is required`)
      return { valid: false, error: 'Envelope action is required' }
    }

    if (!meta.traceId || typeof meta.traceId !== 'string') {
      logger.warn(`[EnvelopeFactory] Validation failed: Envelope traceId is required`)
      return { valid: false, error: 'Envelope traceId is required' }
    }

    if (typeof meta.timestamp !== 'number' || meta.timestamp <= 0) {
      logger.warn(`[EnvelopeFactory] Validation failed: Envelope timestamp must be a positive number`)
      return { valid: false, error: 'Envelope timestamp must be a positive number' }
    }

    if (payload === undefined) {
      logger.warn(`[EnvelopeFactory] Validation failed: Envelope payload is required`)
      return { valid: false, error: 'Envelope payload is required (can be null)' }
    }

    logger.debug(`[EnvelopeFactory] Validation passed: action="${meta.action}", traceId="${meta.traceId}"`)
    return { valid: true }
  }
}

export type { ModuleId, EnvelopeTarget, EnvelopeAction, EnvelopeMeta }
