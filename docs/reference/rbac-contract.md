---
title: rbac-contract
code_version: 2.0.0

tier: important
---

---
title: rbac-contract.md
status: draft
owner: 架构组
updated: 2026-07-12
code_version: 2.0.0
tier: important
---

# rbac-contract.md — RBAC 权限管理子域接口契约

> **定位**：定义 `rbac` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **实体 CRUD 管理**：负责用户（`UserEntity`）、角色（`RoleEntity`）、权限（`PermissionEntity`）三大实体的创建、更新、软删除与查询。所有写操作通过 `DataBridge.forward()` 路由，禁止直接操作 IndexedDB。
2. **角色授予与撤销**：管理用户-角色映射（`UserRoleMapping`）和角色-权限映射（`RolePermissionMapping`），支持带有效期（TTL）的角色授予、手动撤销，以及软删除状态的维护。
3. **用户有效权限组合查询**：通过 `getUserEffectivePermissions()` 聚合用户所有活跃角色的权限并集，为上层提供统一的权限校验能力。
4. **权限自动回收与僵尸账号检测**：通过 `PermissionRevocationService` 定时扫描过期角色映射（`effectiveEnd`）和长期未活跃用户（`lastActiveAt`），自动回收权限并更新审计日志，解决"权限膨胀"与"僵尸账号"风险。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `core/databridge` | 核心基础设施：数据写入与查询路由 | `rbac` → `DataBridge.forward()` → `IndexedDB` |
| `core/envelope` | 核心基础设施：信封封装 | `rbac` → `EnvelopeFactory.create()` → `DataBridge` |
| `config/dbConfig` | 配置层：信封动作、目标、Store 名注册 | `config` → `rbac`（只读引用常量） |
| `config/rbacThresholds` | 配置层：RBAC 阈值与内置角色常量 | `config` → `rbac`（只读引用配置） |
| `types/modules/rbac.types` | 类型层：零依赖类型定义 | `types` → `rbac`（类型导入） |
| `store/` | 下游：消费事件与数据 | `rbac` → `eventBus` → `store/`（状态同步） |
| `pages/` | 下游：UI 调用服务接口 | `pages/` → `rbac`（经 Store 或直接调用） |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/types/modules/rbac.types.ts

export type AuditAction = 'grant' | 'revoke' | 'modify' | 'archive' | 'delete'
export type RevocationReason = 'expired' | 'inactive_user' | 'policy_violation' | 'manual_revoke'
export type AuditTargetType = 'user_role' | 'role_permission' | 'user' | 'role' | 'permission'
export type EntityStatus = 'active' | 'inactive' | 'suspended' | 'deleted'
export type MappingStatus = 'active' | 'expired' | 'revoked' | 'pending'

export interface UserEntity {
  readonly id: string
  readonly username: string
  readonly email: string
  readonly status: EntityStatus
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastActiveAt: number
  readonly department?: string
  readonly displayName?: string
}

export interface RoleEntity {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly status: EntityStatus
  readonly isBuiltIn: boolean
  readonly parentRoleId?: string
  readonly createdAt: number
  readonly updatedAt: number
}

export interface PermissionEntity {
  readonly id: string
  readonly name: string
  readonly resource: string
  readonly action: string
  readonly description: string
  readonly status: EntityStatus
  readonly createdAt: number
  readonly updatedAt: number
}

export interface UserRoleMapping {
  readonly id: string
  readonly userId: string
  readonly roleId: string
  readonly status: MappingStatus
  readonly effectiveStart: number
  readonly effectiveEnd: number
  readonly grantedAt: number
  readonly grantedBy: string
  readonly grantReason: string
  readonly revocationReason?: RevocationReason
  readonly revokedAt?: number
  readonly revokedBy?: string
}

export interface RolePermissionMapping {
  readonly id: string
  readonly roleId: string
  readonly permissionId: string
  readonly status: MappingStatus
  readonly grantedAt: number
  readonly grantedBy: string
  readonly grantReason: string
  readonly revocationReason?: RevocationReason
  readonly revokedAt?: number
  readonly revokedBy?: string
}

export interface PermissionAuditLog {
  readonly id: string
  readonly action: AuditAction
  readonly targetType: AuditTargetType
  readonly targetId: string
  readonly operatorId: string
  readonly affectedUserId?: string
  readonly beforeState?: Record<string, unknown>
  readonly afterState?: Record<string, unknown>
  readonly reason: string
  readonly timestamp: number
  readonly traceId: string
}

export interface RevocationTaskResult {
  readonly executedAt: number
  readonly totalChecked: number
  readonly expiredRevoked: number
  readonly inactiveUserRevoked: number
  readonly policyViolationRevoked: number
  readonly details: ReadonlyArray<{
    mappingId: string
    userId: string
    roleId: string
    reason: RevocationReason
    revokedAt: number
  }>
  readonly durationMs: number
  readonly error?: string
}

export interface ZombieAccountDetectionResult {
  readonly detectedAt: number
  readonly zombieUserIds: readonly string[]
  readonly totalScanned: number
  readonly inactivityThresholdDays: number
  readonly details: ReadonlyArray<{
    userId: string
    username: string
    lastActiveAt: number
    inactiveDays: number
    activePermissionCount: number
  }>
}
```

```typescript
// 文件：src/services/rbac/rbacManagementService.ts（输入/输出 DTO）

export interface CreateUserInput {
  username: string
  email: string
  department?: string
  displayName?: string
}

export interface UpdateUserInput {
  id: string
  username?: string
  email?: string
  displayName?: string
  department?: string
}

export interface CreateRoleInput {
  name: string
  description: string
  parentRoleId?: string
  isBuiltIn?: boolean
}

export interface CreatePermissionInput {
  name: string
  resource: string
  action: string
  description: string
}

export interface GrantUserRoleInput {
  userId: string
  roleId: string
  grantedBy: string
  grantReason: string
  ttlMs?: number // 默认 90 天
}

export interface GrantRolePermissionInput {
  roleId: string
  permissionId: string
  grantedBy: string
  grantReason: string
}

export interface CrudResult {
  success: boolean
  id?: string
  error?: string
}

export interface QueryResult<T> {
  success: boolean
  data: T
  error?: string
}
```

### 2.2 主入口函数

#### `rbacManagementService.ts` 导出函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `createUser()` | `(input: CreateUserInput, operatorId: string, parentTraceId?: string) => Promise<CrudResult>` | 创建用户并记录审计日志 | `DataBridge.forward()` 错误包装 + logger.error + 返回 CrudResult |
| `updateUser()` | `(input: UpdateUserInput, operatorId: string) => Promise<CrudResult>` | 更新用户字段并记录审计日志 | 同上 |
| `deleteUser()` | `(userId: string, operatorId: string) => Promise<CrudResult>` | 软删除用户（status='deleted'）并记录审计 | 同上 |
| `getUser()` | `(userId: string) => Promise<QueryResult<UserEntity \| null>>` | 按 ID 查询单个用户 | `dataBridge.query()` catch 包装 |
| `listUsers()` | `(onlyActive = true) => Promise<QueryResult<UserEntity[]>>` | 按状态索引查询用户列表 | 同上 |
| `createRole()` | `(input: CreateRoleInput, operatorId: string) => Promise<CrudResult>` | 创建角色 | 同上 |
| `updateRole()` | `(role: RoleEntity) => Promise<CrudResult>` | 更新角色 | 同上 |
| `deleteRole()` | `(roleId: string) => Promise<CrudResult>` | 软删除角色 | 同上 |
| `getRole()` | `(roleId: string) => Promise<QueryResult<RoleEntity \| null>>` | 按 ID 查询角色 | 同上 |
| `listRoles()` | `(onlyActive = true) => Promise<QueryResult<RoleEntity[]>>` | 按状态索引查询角色列表 | 同上 |
| `createPermission()` | `(input: CreatePermissionInput) => Promise<CrudResult>` | 创建权限 | 同上 |
| `updatePermission()` | `(perm: PermissionEntity) => Promise<CrudResult>` | 更新权限 | 同上 |
| `listPermissions()` | `(onlyActive = true) => Promise<QueryResult<PermissionEntity[]>>` | 按状态索引查询权限列表 | 同上 |
| `grantUserRole()` | `(input: GrantUserRoleInput, parentTraceId?: string) => Promise<CrudResult>` | 授予用户角色（含有效期 TTL） | 同上 + 审计日志 |
| `revokeUserRole()` | `(mappingId: string, operatorId: string, reason: string) => Promise<CrudResult>` | 撤销用户角色映射 | 同上 + 审计日志 |
| `getUserRoles()` | `(userId: string) => Promise<QueryResult<UserRoleMapping[]>>` | 查询用户的所有角色映射 | 同上 |
| `grantRolePermission()` | `(input: GrantRolePermissionInput) => Promise<CrudResult>` | 授予角色权限 | 同上 + 审计日志 |
| `revokeRolePermission()` | `(mappingId: string, operatorId: string) => Promise<CrudResult>` | 撤销角色权限映射 | 同上 |
| `getRolePermissions()` | `(roleId: string) => Promise<QueryResult<RolePermissionMapping[]>>` | 查询角色的所有权限映射 | 同上 |
| `getUserEffectivePermissions()` | `(userId: string) => Promise<QueryResult<PermissionEntity[]>>` | 聚合用户所有活跃角色的权限并集 | 同上 |

#### `permissionRevocationService.ts` 导出

| 符号 | 类型 | 说明 |
|------|------|------|
| `PermissionRevocationService` | Class | 权限自动回收服务类，含定时任务管理 |
| `permissionRevocationService` | Instance | 全局单例实例 |

| 方法 | 签名 | 职责 |
|------|------|------|
| `start()` | `(expiryIntervalMs?, zombieIntervalMs?) => void` | 启动过期回收与僵尸检测双定时任务 |
| `stop()` | `() => void` | 停止所有定时任务 |
| `runOnce()` | `() => Promise<RevocationTaskResult>` | 手动触发一次完整回收（过期 + 僵尸） |
| `getLastExpiryResult()` | `() => RevocationTaskResult \| null` | 获取最近一次过期回收结果 |
| `getLastZombieResult()` | `() => ZombieAccountDetectionResult \| null` | 获取最近一次僵尸检测结果 |
| `isRunning()` | `() => boolean` | 检查定时任务是否运行中 |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `rbac:user-created` | `rbacManagementService` | `store/rbacStore` / 监听方 | 用户创建成功 |
| `rbac:user-updated` | `rbacManagementService` | `store/rbacStore` / 监听方 | 用户更新成功 |
| `rbac:user-deleted` | `rbacManagementService` | `store/rbacStore` / 监听方 | 用户软删除成功 |
| `rbac:role-granted` | `rbacManagementService` | `store/rbacStore` / 监听方 | 角色授予成功 |
| `rbac:role-revoked` | `rbacManagementService` | `store/rbacStore` / 监听方 | 角色撤销成功 |
| `rbac:permission-revoked` | `PermissionRevocationService` | `store/rbacStore` / 监听方 | 权限自动回收完成 |
| `rbac:user-status-changed` | `PermissionRevocationService` | `store/rbacStore` / 监听方 | 用户状态变更（如僵尸标记为 inactive） |

---

## 3. 数据流

### 3.1 管理操作数据流

```
[UI 调用 / 系统调用]
    ↓
rbacManagementService.{createUser|updateUser|grantUserRole|...}()
    ↓ (DataBridge.forward())
EnvelopeFactory.create() → dataBridge.forward() → routeToDB()
    ↓
IndexedDB (rbacUsers / rbacRoles / rbacPermissions / rbacUserRoles / rbacRolePermissions)
    ↓ (EventBus)
rbacStore (Zustand + withBroadcast) ← 订阅 rbac:* 事件
    ↓
components/pages (仅经 Store 取数)
```

### 3.2 自动回收数据流

```
[定时器触发 / runOnce() 手动触发]
    ↓
PermissionRevocationService
    ├── runExpiryRevocation() ──→ 查询 rbacUserRoles (active) → 过滤 expired → 批量撤销 → 写审计日志
    └── runZombieDetection() ──→ 查询 rbacUsers (active) → 过滤 inactive → 撤销角色 → 更新用户状态 → 写审计日志
    ↓
dataBridge.forward() → IndexedDB (rbacUserRoles / rbacUsers / rbacPermissionAuditLogs)
    ↓ (EventBus)
rbac:permission-revoked / rbac:user-status-changed
    ↓
rbacStore → UI 组件
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（info/debug/error/warn） |
| eventBus | `@/lib/eventBus` | 事件发布/订阅（rbac:* 事件） |

### 4.2 核心与配置依赖

| 依赖 | 路径 | 用途 |
|------|------|------|
| dataBridge | `@/core/databridge` | 数据路由转发（禁止直写 DB） |
| EnvelopeFactory | `@/core/envelope` | 信封封装（source/target/action/traceId） |
| ENVELOPE_ACTION / ENVELOPE_TARGET / STORE_NAME | `@/config/dbConfig` | 信封动作枚举、Store 名称常量 |
| DEFAULT_RBAC_THRESHOLDS / getRbacThresholds | `@/config/rbacThresholds` | 权限回收阈值、内置角色常量 |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `defaultPermissionTtlMs` | 90 天 | 角色默认有效期 | `src/config/rbacThresholds.ts` |
| `maxPermissionTtlMs` | 365 天 | 角色最大有效期硬上限 | `src/config/rbacThresholds.ts` |
| `inactivityThresholdDays` | 30 天 | 僵尸账号检测阈值（未活跃天数） | `src/config/rbacThresholds.ts` |
| `zombieDetectionIntervalMs` | 24 小时 | 僵尸检测定时任务间隔 | `src/config/rbacThresholds.ts` |
| `expiryRevocationIntervalMs` | 1 小时 | 过期权限回收定时任务间隔 | `src/config/rbacThresholds.ts` |
| `revocationBatchSize` | 100 | 单次回收任务最大处理记录数 | `src/config/rbacThresholds.ts` |
| `maxRoleInheritanceDepth` | 3 | 角色继承最大深度（防权限蔓延） | `src/config/rbacThresholds.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/rbac/` | **待实现**：纯函数（如 `_filterExpiredMappings`、`_filterZombieUsers`）的独立测试 |
| 集成测试 | `tests/services/rbac.integration.test.ts` | **待实现**：DataBridge 交互、Store 联动、事件发布验证 |
| Mock 策略 | `__mocks__/rbacService.ts` | **待实现**：隔离 `dataBridge` 与 `eventBus` 外部依赖 |
| 定时任务测试 | `src/services/rbac/permissionRevocationService.test.ts` | **待实现**：`start/stop/runOnce` 生命周期、批量回收逻辑、边界条件（空数据、超时） |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 补充 `src/services/rbac/` 目录及单元测试（覆盖 CRUD 与回收逻辑）。
> 2. 确认 `rbacStore` 已订阅所有 `rbac:*` 事件并正确同步状态。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
