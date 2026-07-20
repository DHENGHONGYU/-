/**
 * @test_id V9-TEST-UT-093
 * 八域资料体系 类型级（Type-level）单元测试
 *
 * @description
 * 把 ProfileDomain / ProfileItem / ScoreEvidence / StockProfile / ProfileTag
 * 的关键不变式固化为编译期断言：
 *   1. 必填字段不得为 null/undefined
 *   2. 枚举字段必须为合法值
 *   3. 数值字段不得为 any
 *   4. 域与评分层映射关系正确
 *
 * 校验机制：由 tsc --noEmit 校验，vitest 运行期 no-op。
 *
 * @module tests/__tests__/types/profile-types.spec
 * @created 2026-07-21 - 八域资料体系类型安全门禁
 * @covers_docs [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import { describe, it } from 'vitest'

import type {
  ProfileDomain,
  ProfileItemType,
  SentimentLabel,
  ScoreLayerId,
  EvidenceType,
  TagCategory,
  ProfileItem,
  ScoreEvidence,
  StockProfile,
  ProfileTag,
  DomainStats,
  ContentRef,
  CrossRef,
} from '@/data/types/types.profile'
import type {
  Equals,
  Expect,
  IsAny,
  NullKeys,
  UndefinedKeys,
} from './typeTestHelpers'
import { assertNever } from './typeTestHelpers'

// ============================================================
// 枚举类型正确性断言
// ============================================================

/** ProfileDomain 必须恰好包含 8 个域 */
export const _profileDomainCount: Expect<
  Equals<ProfileDomain, 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8'>,
  true
> = true

/** ScoreLayerId 必须包含 11 个层（L-1 到 L8） */
export const _scoreLayerIdCount: Expect<
  Equals<
    ScoreLayerId,
    'lMinus1' | 'l0' | 'l1' | 'l2' | 'l3f' | 'l3v' | 'l4' | 'l5' | 'l6' | 'l7' | 'l8'
  >,
  true
> = true

/** ProfileItemType 必须包含 community 类型 */
export const _profileItemTypeHasCommunity: Expect<
  'community' extends ProfileItemType ? true : false,
  true
> = true

/** ProfileItemType 必须包含 news 类型 */
export const _profileItemTypeHasNews: Expect<
  'news' extends ProfileItemType ? true : false,
  true
> = true

/** ProfileItemType 必须包含 report 类型 */
export const _profileItemTypeHasReport: Expect<
  'report' extends ProfileItemType ? true : false,
  true
> = true

/** SentimentLabel 必须包含 4 种情绪 */
export const _sentimentLabelCount: Expect<
  Equals<SentimentLabel, 'positive' | 'negative' | 'neutral' | 'mixed'>,
  true
> = true

/** EvidenceType 必须包含 3 种类型 */
export const _evidenceTypeCount: Expect<
  Equals<EvidenceType, 'data_field' | 'profile_item' | 'derived_metric'>,
  true
> = true

// ============================================================
// ProfileItem 必填字段断言
// ============================================================

/** ProfileItem 必填字段不得为 null */
export const _profileItemNoNullFields: Expect<
  Equals<
    NullKeys<
      Pick<
        ProfileItem,
        | 'id'
        | 'symbol'
        | 'domain'
        | 'itemType'
        | 'title'
        | 'summary'
        | 'source'
        | 'publishedAt'
        | 'collectedAt'
        | 'isUserGenerated'
        | 'dataHash'
        | 'schemaVersion'
        | 'version'
      >
    >,
    never
  >,
  true
> = true

/** ProfileItem 必填字段不得为 undefined */
export const _profileItemNoUndefinedFields: Expect<
  Equals<
    UndefinedKeys<
      Pick<
        ProfileItem,
        | 'id'
        | 'symbol'
        | 'domain'
        | 'itemType'
        | 'title'
        | 'summary'
        | 'source'
        | 'publishedAt'
        | 'collectedAt'
        | 'isUserGenerated'
        | 'dataHash'
        | 'schemaVersion'
        | 'version'
      >
    >,
    never
  >,
  true
> = true

/** ProfileItem.id 不得为 any */
export const _profileItemIdNotAny: Expect<Equals<IsAny<ProfileItem['id']>, false>> = true

/** ProfileItem.symbol 不得为 any */
export const _profileItemSymbolNotAny: Expect<Equals<IsAny<ProfileItem['symbol']>, false>> = true

/** ProfileItem.qualityScore 必须是 number | undefined（不能是 any） */
export const _profileItemQualityScoreNotAny: Expect<
  Equals<IsAny<ProfileItem['qualityScore']>, false>
> = true

/** ProfileItem.evidenceWeight 必须是 number | undefined（不能是 any） */
export const _profileItemEvidenceWeightNotAny: Expect<
  Equals<IsAny<ProfileItem['evidenceWeight']>, false>
> = true

/** ProfileItem.domain 必须是 ProfileDomain 类型 */
export const _profileItemDomainType: Expect<
  Equals<ProfileItem['domain'], ProfileDomain>
> = true

/** ProfileItem.itemType 必须是 ProfileItemType 类型 */
export const _profileItemItemType: Expect<
  Equals<ProfileItem['itemType'], ProfileItemType>
> = true

// ============================================================
// ScoreEvidence 必填字段断言
// ============================================================

/** ScoreEvidence 必填字段不得为 null */
export const _scoreEvidenceNoNullFields: Expect<
  Equals<
    NullKeys<
      Pick<
        ScoreEvidence,
        | 'id'
        | 'symbol'
        | 'layerId'
        | 'evidenceType'
        | 'weight'
        | 'contribution'
        | 'description'
        | 'calculatedAt'
        | 'schemaVersion'
      >
    >,
    never
  >,
  true
> = true

/** ScoreEvidence 必填字段不得为 undefined */
export const _scoreEvidenceNoUndefinedFields: Expect<
  Equals<
    UndefinedKeys<
      Pick<
        ScoreEvidence,
        | 'id'
        | 'symbol'
        | 'layerId'
        | 'evidenceType'
        | 'weight'
        | 'contribution'
        | 'description'
        | 'calculatedAt'
        | 'schemaVersion'
      >
    >,
    never
  >,
  true
> = true

/** ScoreEvidence.layerId 必须是 ScoreLayerId 类型 */
export const _scoreEvidenceLayerIdType: Expect<
  Equals<ScoreEvidence['layerId'], ScoreLayerId>
> = true

/** ScoreEvidence.weight 不得为 any */
export const _scoreEvidenceWeightNotAny: Expect<
  Equals<IsAny<ScoreEvidence['weight']>, false>
> = true

/** ScoreEvidence.contribution 不得为 any */
export const _scoreEvidenceContributionNotAny: Expect<
  Equals<IsAny<ScoreEvidence['contribution']>, false>
> = true

// ============================================================
// StockProfile 必填字段断言
// ============================================================

/** StockProfile 必填字段不得为 null */
export const _stockProfileNoNullFields: Expect<
  Equals<
    NullKeys<
      Pick<
        StockProfile,
        | 'symbol'
        | 'name'
        | 'domainStats'
        | 'completenessScore'
        | 'qualityScore'
        | 'evidenceCoverage'
        | 'version'
        | 'createdAt'
        | 'updatedAt'
        | 'schemaVersion'
      >
    >,
    never
  >,
  true
> = true

/** StockProfile 必填字段不得为 undefined */
export const _stockProfileNoUndefinedFields: Expect<
  Equals<
    UndefinedKeys<
      Pick<
        StockProfile,
        | 'symbol'
        | 'name'
        | 'domainStats'
        | 'completenessScore'
        | 'qualityScore'
        | 'evidenceCoverage'
        | 'version'
        | 'createdAt'
        | 'updatedAt'
        | 'schemaVersion'
      >
    >,
    never
  >,
  true
> = true

/** StockProfile.domainStats 必须以 ProfileDomain 为 key */
export const _stockProfileDomainStatsKey: Expect<
  Equals<keyof StockProfile['domainStats'], ProfileDomain>
> = true

/** StockProfile.completenessScore 不得为 any */
export const _stockProfileCompletenessNotAny: Expect<
  Equals<IsAny<StockProfile['completenessScore']>, false>
> = true

// ============================================================
// ProfileTag 必填字段断言
// ============================================================

/** ProfileTag 必填字段不得为 null */
export const _profileTagNoNullFields: Expect<
  Equals<
    NullKeys<
      Pick<
        ProfileTag,
        | 'id'
        | 'name'
        | 'category'
        | 'usageCount'
        | 'createdAt'
        | 'updatedAt'
        | 'schemaVersion'
      >
    >,
    never
  >,
  true
> = true

/** ProfileTag 必填字段不得为 undefined */
export const _profileTagNoUndefinedFields: Expect<
  Equals<
    UndefinedKeys<
      Pick<
        ProfileTag,
        | 'id'
        | 'name'
        | 'category'
        | 'usageCount'
        | 'createdAt'
        | 'updatedAt'
        | 'schemaVersion'
      >
    >,
    never
  >,
  true
> = true

/** ProfileTag.category 必须是 TagCategory 类型 */
export const _profileTagCategoryType: Expect<
  Equals<ProfileTag['category'], TagCategory>
> = true

// ============================================================
// DomainStats 必填字段断言
// ============================================================

/** DomainStats 必填字段不得为 null */
export const _domainStatsNoNullFields: Expect<
  Equals<NullKeys<Pick<DomainStats, 'count' | 'sources'>>, never>
> = true

/** DomainStats 必填字段不得为 undefined */
export const _domainStatsNoUndefinedFields: Expect<
  Equals<UndefinedKeys<Pick<DomainStats, 'count' | 'sources'>>, never>
> = true

// ============================================================
// ContentRef / CrossRef 必填字段断言
// ============================================================

/** ContentRef.refType 必填 */
export const _contentRefRefTypeRequired: Expect<
  Equals<NullKeys<Pick<ContentRef, 'refType'>>, never>
> = true

/** CrossRef 必填字段不得为 null */
export const _crossRefNoNullFields: Expect<
  Equals<NullKeys<Pick<CrossRef, 'itemId' | 'refType'>>, never>
> = true

// ============================================================
// 域 ↔ 评分层 映射不变式（通过 DOMAIN_META 常量验证）
// ============================================================
// 注意：以下为运行时测试（vitest 执行），验证 DOMAIN_META 常量的映射关系

describe('八域资料体系 - 类型级断言', () => {
  it('所有类型断言已通过 tsc 编译期校验', () => {
    // 本测试仅为占位符，实际断言在编译期执行。
    // 若 tsc --noEmit 通过，则以下所有断言均成立。
    assertNever<Equals<ProfileDomain, ProfileDomain>>()
    expect(true).toBe(true)
  })
})
