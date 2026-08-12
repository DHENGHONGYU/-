/**
 * @fileoverview 八域资料体系 Store（v32 新增，ADR-010）
 *
 * 从 dataLayer.ts 拆分而来，包含 4 个资料域 Store：
 * - profileItemStore: 资料条目 save/bulkSave/get/listBySymbol/listBySymbolType/...
 * - scoreEvidenceStore: 评分证据 save/bulkSave/get/listBySymbol/listByLayer/...
 * - stockProfileStore: 股票资料包元数据 save/get/list
 * - profileTagStore: 资料标签 save/get/listByCategory/getByName/...
 *
 * @module data/dataLayerProfileStores
 * @created 2026-08-09
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */
import { STORE_NAME } from '@/config/dbConfig'
import type {
  DataLayerResult,
  ProfileItem,
  ScoreEvidence,
  StockProfile,
  ProfileTag,
} from './types'
import { sendWriteEnvelope, queryGet, queryList, queryByIndex } from './dataLayerHelpers'

// ============================================================
// profileItemStore — 资料条目
// ============================================================

export const profileItemStore = {
  /** 保存单条资料条目 */
  async save(item: ProfileItem): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveProfileItem', item, 'analyzer')
  },

  /** 批量保存资料条目 */
  async bulkSave(items: ProfileItem[]): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('bulkSaveProfileItems', items, 'analyzer')
  },

  /** 按主键查询 */
  async get(id: string): Promise<ProfileItem | undefined> {
    return queryGet<ProfileItem>(STORE_NAME.profileItems, id)
  },

  /** 查询全部 */
  async list(): Promise<ProfileItem[]> {
    return queryList<ProfileItem>(STORE_NAME.profileItems)
  },

  /** 按股票代码查询 */
  async listBySymbol(symbol: string): Promise<ProfileItem[]> {
    return queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol', symbol)
  },

  /** 按股票+类型查询 */
  async listBySymbolType(symbol: string, itemType: string): Promise<ProfileItem[]> {
    return queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol-type', [symbol, itemType])
  },

  /** 按股票+域+质量查询 */
  async listBySymbolDomainQuality(symbol: string, domain: string): Promise<ProfileItem[]> {
    return queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol-domain-quality', [symbol, domain])
  },

  /** 按数据哈希查询（去重用） */
  async getByHash(dataHash: number): Promise<ProfileItem | undefined> {
    const items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-hash', dataHash)
    return items[0]
  },

  /** 按来源查询 */
  async listBySource(source: string): Promise<ProfileItem[]> {
    return queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-source', source)
  },

  /** 删除资料条目 */
  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteProfileItem', { id }, 'analyzer')
  },
}

// ============================================================
// scoreEvidenceStore — 评分证据
// ============================================================

export const scoreEvidenceStore = {
  /** 保存单条评分证据 */
  async save(evidence: ScoreEvidence): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveScoreEvidence', evidence, 'analyzer')
  },

  /** 批量保存评分证据 */
  async bulkSave(evidences: ScoreEvidence[]): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('bulkSaveScoreEvidence', evidences, 'analyzer')
  },

  /** 按主键查询 */
  async get(id: string): Promise<ScoreEvidence | undefined> {
    return queryGet<ScoreEvidence>(STORE_NAME.scoreEvidence, id)
  },

  /** 查询全部 */
  async list(): Promise<ScoreEvidence[]> {
    return queryList<ScoreEvidence>(STORE_NAME.scoreEvidence)
  },

  /** 按股票代码查询 */
  async listBySymbol(symbol: string): Promise<ScoreEvidence[]> {
    return queryByIndex<ScoreEvidence>(STORE_NAME.scoreEvidence, 'by-symbol', symbol)
  },

  /** 按股票+评分层查询 */
  async listBySymbolLayer(symbol: string, layer: string): Promise<ScoreEvidence[]> {
    return queryByIndex<ScoreEvidence>(STORE_NAME.scoreEvidence, 'by-symbol-layer', [symbol, layer])
  },

  /** 按关联资料条目查询 */
  async listByProfileItem(profileItemId: string): Promise<ScoreEvidence[]> {
    return queryByIndex<ScoreEvidence>(STORE_NAME.scoreEvidence, 'by-profile-item', profileItemId)
  },

  /** 删除评分证据 */
  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteScoreEvidence', { id }, 'analyzer')
  },
}

// ============================================================
// stockProfileStore — 股票资料包元数据
// ============================================================

export const stockProfileStore = {
  /** 保存/更新股票资料包元数据 */
  async save(profile: StockProfile): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveStockProfile', profile, 'analyzer')
  },

  /** 按主键（股票代码）查询 */
  async get(symbol: string): Promise<StockProfile | undefined> {
    return queryGet<StockProfile>(STORE_NAME.stockProfiles, symbol)
  },

  /** 查询全部 */
  async list(): Promise<StockProfile[]> {
    return queryList<StockProfile>(STORE_NAME.stockProfiles)
  },
}

// ============================================================
// profileTagStore — 资料标签
// ============================================================

export const profileTagStore = {
  /** 保存/更新资料标签 */
  async save(tag: ProfileTag): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveProfileTag', tag, 'analyzer')
  },

  /** 按主键查询 */
  async get(id: string): Promise<ProfileTag | undefined> {
    return queryGet<ProfileTag>(STORE_NAME.profileTags, id)
  },

  /** 查询全部 */
  async list(): Promise<ProfileTag[]> {
    return queryList<ProfileTag>(STORE_NAME.profileTags)
  },

  /** 按类别查询 */
  async listByCategory(category: string): Promise<ProfileTag[]> {
    return queryByIndex<ProfileTag>(STORE_NAME.profileTags, 'by-category', category)
  },

  /** 按名称查询（唯一索引） */
  async getByName(name: string): Promise<ProfileTag | undefined> {
    const tags = await queryByIndex<ProfileTag>(STORE_NAME.profileTags, 'by-name', name)
    return tags[0]
  },

  /** 按父标签查询 */
  async listByParent(parentId: string): Promise<ProfileTag[]> {
    return queryByIndex<ProfileTag>(STORE_NAME.profileTags, 'by-parent', parentId)
  },

  /** 删除资料标签 */
  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteProfileTag', { id }, 'analyzer')
  },
}
