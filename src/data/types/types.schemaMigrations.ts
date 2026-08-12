/**
 * @fileoverview Schema 迁移追踪记录类型
 *
 * 对应 IndexedDB `schema_migrations` store，用于记录迁移框架状态与版本标记。
/** Schema 迁移追踪记录  * @doc [V9-DOC-QA-066]
*/
export interface SchemaMigrationRecord {
  /** 迁移记录 ID */
  id: string
  /** 版本号 */
  version: number
  /** 应用时间戳 */
  appliedAt: number
  /** 备注说明 */
  note?: string
}
