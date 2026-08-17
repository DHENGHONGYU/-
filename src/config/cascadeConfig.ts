/**
 * @fileoverview 级联删除策略配置
 *
 * 定义所有 Object Store 之间的外键依赖关系及级联策略。
 * cascadeExecutor 在执行删除前读取此配置，自动处理关联数据。
 *
 * 策略说明：
 * - CASCADE: 删除主实体时同步删除子实体（强依赖，如映射表、日志）
 * - RESTRICT: 存在子实体时阻止删除（保护关键数据，如运行中的工作流）
 * - SET_NULL: 将子实体外键置空（弱依赖，保留历史记录）
 * - SOFT_DELETE: 软删除子实体（标记 deletedAt，保留审计轨迹）
 * - NONE: 无级联（默认，无依赖关系）
 *
 * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-ARCH-008]
 */
import { STORE_NAME, type StoreName } from '@/config/dbConfig'
import type { CascadeStrategy } from '@/types/modules/cascade.types'

/** 单个级联依赖定义 */
export interface CascadeDependency {
  /** 子 store（从表） */
  childStore: StoreName
  /** 外键索引名（用于查询子记录） */
  indexName: string
  /** 外键字段名 */
  foreignKey: string
  /** 级联策略 */
  strategy: CascadeStrategy
  /** 描述（用于日志） */
  description?: string
}

/** 级联配置映射：父 store → 依赖列表 */
export const CASCADE_CONFIG: Partial<Record<StoreName, CascadeDependency[]>> = {
  // ── 执行计划体系 ──
  [STORE_NAME.executionPlans]: [
    {
      childStore: STORE_NAME.executionLogs,
      indexName: 'by-plan',
      foreignKey: 'planId',
      strategy: 'CASCADE',
      description: '执行计划 → 执行日志',
    },
  ],

  // ── 八域资料体系 ──
  [STORE_NAME.profileItems]: [
    {
      childStore: STORE_NAME.scoreEvidence,
      indexName: 'by-profileItem',
      foreignKey: 'profileItemId',
      strategy: 'CASCADE',
      description: '资料条目 → 评分证据链',
    },
  ],

  // ── 评分文档体系 ──
  [STORE_NAME.scoreDocs]: [
    {
      childStore: STORE_NAME.scoreEvidence,
      indexName: 'by-scoreDoc',
      foreignKey: 'scoreDocId',
      strategy: 'CASCADE',
      description: '评分文档 → 评分证据',
    },
  ],

  // ── 资讯体系 ──
  [STORE_NAME.news]: [
    {
      childStore: STORE_NAME.newsStockMap,
      indexName: 'by-news',
      foreignKey: 'newsId',
      strategy: 'CASCADE',
      description: '新闻 → 股票映射',
    },
  ],

  // ── 工作流体系 ──
  [STORE_NAME.workflowDefs]: [
    {
      childStore: STORE_NAME.workflowSchedules,
      indexName: 'by-workflow-id',
      foreignKey: 'workflowId',
      strategy: 'CASCADE',
      description: '工作流定义 → 调度配置',
    },
    {
      childStore: STORE_NAME.workflowTriggers,
      indexName: 'by-workflow-id',
      foreignKey: 'workflowId',
      strategy: 'CASCADE',
      description: '工作流定义 → 触发器配置',
    },
    {
      childStore: STORE_NAME.workflowRuns,
      indexName: 'by-workflow-id',
      foreignKey: 'workflowId',
      strategy: 'RESTRICT',
      description: '工作流定义 → 运行实例（存在运行记录时阻止删除）',
    },
  ],

  // ── RBAC 体系 ──
  [STORE_NAME.rbacUsers]: [
    {
      childStore: STORE_NAME.rbacUserRoles,
      indexName: 'by-user-id',
      foreignKey: 'userId',
      strategy: 'CASCADE',
      description: '用户 → 角色分配',
    },
  ],

  [STORE_NAME.rbacRoles]: [
    {
      childStore: STORE_NAME.rbacUserRoles,
      indexName: 'by-role-id',
      foreignKey: 'roleId',
      strategy: 'CASCADE',
      description: '角色 → 用户分配',
    },
    {
      childStore: STORE_NAME.rbacRolePermissions,
      indexName: 'by-role-id',
      foreignKey: 'roleId',
      strategy: 'CASCADE',
      description: '角色 → 权限分配',
    },
  ],

  [STORE_NAME.rbacPermissions]: [
    {
      childStore: STORE_NAME.rbacRolePermissions,
      indexName: 'by-permission-id',
      foreignKey: 'permissionId',
      strategy: 'CASCADE',
      description: '权限 → 角色分配',
    },
  ],

  // ── 股票池体系（P0-2 修复：补充 stock_profiles/screening_results/generated_reports）──
  [STORE_NAME.stocks]: [
    {
      childStore: STORE_NAME.stockProfiles,
      indexName: 'by-symbol',
      foreignKey: 'symbol',
      strategy: 'CASCADE',
      description: '股票 → 八域资料包',
    },
    {
      childStore: STORE_NAME.screeningResults,
      indexName: 'by-symbol',
      foreignKey: 'symbol',
      strategy: 'CASCADE',
      description: '股票 → 筛选结果',
    },
    {
      childStore: STORE_NAME.generatedReports,
      indexName: 'by-symbol',
      foreignKey: 'symbol',
      strategy: 'CASCADE',
      description: '股票 → 生成报告',
    },
  ],
}

/**
 * 获取指定 store 的级联依赖列表
 */
export function getCascadeDependencies(store: StoreName): CascadeDependency[] {
  return CASCADE_CONFIG[store] ?? []
}
