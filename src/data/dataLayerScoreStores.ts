/**
 * @fileoverview 评分类 Store
 *
 * 从 dataLayer.ts 拆分而来，包含 8 个评分 Store：
 * - v6ScoreStore: V6 评分 save/get/list
 * - intelligentScoreStore: 智能评分 save/listBySymbol/getLatestBySymbol/list
 * - industryScoreStore: 行业评分 save/listByCode/getLatestByCode/list
 * - rotationScoreStore: 轮动评分 save/get/list/listBySector/getLatestBySector
 * - hotSectorScoreStore: 热门板块评分 save/get/list
 * - valuePitScoreStore: 价值洼地评分 save/get/list
 * - sectorScoreStore: 板块评分 save/get/list/listBySector/getLatestBySector
 * - scoreDocStore: 评分文档 save/get/list/listBySymbol/getLatestBySymbol
  * @doc [V9-DOC-BACK-010, V9-DOC-BACK-012, V9-DOC-PROJ-002, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
*/
import { STORE_NAME } from '@/config/dbConfig'
import type {
  DataLayerResult,
  HotSectorScore,
  IndustryScore,
  IntelligentScore,
  RotationSectorScore,
  ScoreDocVersion,
  SectorScoreRecord,
  ValuePitScore,
  V6Score,
} from './types'
import { sendWriteEnvelope, queryGet, queryList, queryByIndex } from './dataLayerHelpers'

export const v6ScoreStore = {
  async save(score: V6Score): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<V6Score | undefined> {
    return queryGet<V6Score>(STORE_NAME.v6Scores, symbol)
  },

  async list(): Promise<V6Score[]> {
    return queryList<V6Score>(STORE_NAME.v6Scores)
  },
}

export const intelligentScoreStore = {
  async save(score: IntelligentScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveIntelligentScores', score, 'analyzer')
  },

  async listBySymbol(symbol: string): Promise<IntelligentScore[]> {
    return queryByIndex<IntelligentScore>(STORE_NAME.intelligentScores, 'by-symbol', symbol)
  },

  async getLatestBySymbol(symbol: string): Promise<IntelligentScore | undefined> {
    const list = await this.listBySymbol(symbol)
    return list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
  },

  async list(): Promise<IntelligentScore[]> {
    return queryList<IntelligentScore>(STORE_NAME.intelligentScores)
  },
}

export const industryScoreStore = {
  async save(score: IndustryScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveIndustryScores', score, 'analyzer')
  },

  async listByCode(code: string): Promise<IndustryScore[]> {
    return queryByIndex<IndustryScore>(STORE_NAME.industryScores, 'by-code', code)
  },

  async getLatestByCode(code: string): Promise<IndustryScore | undefined> {
    const list = await this.listByCode(code)
    return list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
  },

  async list(): Promise<IndustryScore[]> {
    return queryList<IndustryScore>(STORE_NAME.industryScores)
  },
}

export const rotationScoreStore = {
  async save(score: RotationSectorScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveRotationScores', score, 'rotation')
  },

  async get(id: string): Promise<RotationSectorScore | undefined> {
    return queryGet<RotationSectorScore>(STORE_NAME.rotationScores, id)
  },

  async list(): Promise<RotationSectorScore[]> {
    return queryList<RotationSectorScore>(STORE_NAME.rotationScores)
  },

  async listBySector(sectorCode: string): Promise<RotationSectorScore[]> {
    return queryByIndex<RotationSectorScore>(STORE_NAME.rotationScores, 'by-sector', sectorCode)
  },

  async getLatestBySector(sectorCode: string): Promise<RotationSectorScore | undefined> {
    const list = await this.listBySector(sectorCode)
    return list.sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime())[0]
  },
}

export const hotSectorScoreStore = {
  async save(score: HotSectorScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveHotSectorScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<HotSectorScore | undefined> {
    return queryGet<HotSectorScore>(STORE_NAME.hotSectorScores, symbol)
  },

  async list(): Promise<HotSectorScore[]> {
    return queryList<HotSectorScore>(STORE_NAME.hotSectorScores)
  },
}

export const valuePitScoreStore = {
  async save(score: ValuePitScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveValuePitScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<ValuePitScore | undefined> {
    return queryGet<ValuePitScore>(STORE_NAME.valuePitScores, symbol)
  },

  async list(): Promise<ValuePitScore[]> {
    return queryList<ValuePitScore>(STORE_NAME.valuePitScores)
  },
}

export const sectorScoreStore = {
  async save(score: SectorScoreRecord): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveSectorScores', score, 'sector')
  },

  async get(id: string): Promise<SectorScoreRecord | undefined> {
    return queryGet<SectorScoreRecord>(STORE_NAME.sectorScores, id)
  },

  async list(): Promise<SectorScoreRecord[]> {
    return queryList<SectorScoreRecord>(STORE_NAME.sectorScores)
  },

  async listBySector(sectorCode: string): Promise<SectorScoreRecord[]> {
    return queryByIndex<SectorScoreRecord>(STORE_NAME.sectorScores, 'by-sector', sectorCode)
  },

  async getLatestBySector(sectorCode: string): Promise<SectorScoreRecord | undefined> {
    const list = await this.listBySector(sectorCode)
    return list.sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime())[0]
  },
}

export const scoreDocStore = {
  async save(doc: ScoreDocVersion): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveScoreDocs', doc, 'analyzer')
  },

  async get(docId: string): Promise<ScoreDocVersion | undefined> {
    return queryGet<ScoreDocVersion>(STORE_NAME.scoreDocs, docId)
  },

  async list(): Promise<ScoreDocVersion[]> {
    return queryList<ScoreDocVersion>(STORE_NAME.scoreDocs)
  },

  async listBySymbol(symbol: string): Promise<ScoreDocVersion[]> {
    return queryByIndex<ScoreDocVersion>(STORE_NAME.scoreDocs, 'by-symbol', symbol)
  },

  async getLatestBySymbol(symbol: string): Promise<ScoreDocVersion | undefined> {
    const list = await this.listBySymbol(symbol)
    return list.sort((a, b) => b.version - a.version)[0]
  },
}
