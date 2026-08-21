---
doc_id: V9-DOC-ARCH-052
title: "Security Model — V9 智能投研复盘系统安全架构"
domain: arch
status: active
last_updated: 2026-08-15
code_version: 2.0.0-rc.2
---

# Security Model — V9 智能投研复盘系统安全架构

> **版本**: v1.0.0 | **日期**: 2026-07-10
> **适用范围**: V9 全栈安全架构
> **安全等级**: 金融级（纵深防御 + 最小权限 + 全链路审计）

---

## 一、安全架构总览

V9 安全体系采用**纵深防御（Defense in Depth）**策略，在数据层、服务层、通信层、存储层分别设置独立安全闸：

```
┌─────────────────────────────────────────────────────────────────┐
│                        安全架构分层                              │
├─────────────────────────────────────────────────────────────────┤
│  L1 存储安全层 │ localStorage AES-GCM 256 加密 + 密钥派生       │
│  L2 数据访问层 │ ACL_MATRIX（17 模块 × 31 存储表 × 4 操作）     │
│  L3 通信协议层 │ Envelope 安全信封（不可伪造 + 溯源 traceId）    │
│  L4 桥接路由层 │ DataBridge（ACL 校验 + 缓存 + 审计 + 重试）    │
│  L5 服务权限层 │ MCP ACL 双端校验（4 角色 × 16 Server）         │
│  L6 权限管理层 │ RBAC 六表模型（用户/角色/权限/映射/审计）       │
│  L7 输出安全层 │ LLM 输出消毒 + XSS 防护                        │
└─────────────────────────────────────────────────────────────────┘
```

**安全设计原则**：

1. **最小权限**：每个模块仅能访问其职责所需的存储表（如 `holdingsStore` 只读 `orders`）
2. **显式拒绝**：默认无权限，任何访问必须通过 ACL 矩阵显式授权
3. **双端校验**：MCP 调用在 Client 和 Server 两端分别进行权限校验
4. **降级安全**：加密失败时不存储明文（防止明文回退攻击）
5. **审计追踪**：每个数据操作都写入 `research_logs` 或 `rbac_permission_audit_logs`

---

## 二、L2 数据访问层：ACL 矩阵

### 2.1 架构位置

- **定义文件**: `src/config/dbConfig.ts` (`ACL_MATRIX`)
- **引擎文件**: `src/core/acl.ts` (`AclEngine`)
- **消费位置**: `src/core/databridge.ts` (`forward()` / `query()` 入口)

### 2.2 权限模型

ACL 采用 **Module-Store-Operation** 三元组模型：

```typescript
interface AclPermission {
  readonly read: readonly StoreName[]    // 允许 SELECT 的存储表
  readonly write: readonly StoreName[]   // 允许 INSERT/UPDATE/DELETE 的存储表
  readonly actions: readonly DbOperation[] // 允许的操作类型
}
```

### 2.3 模块权限矩阵（核心模块）

| 模块 | 读权限 | 写权限 | 允许操作 | 说明 |
|------|--------|--------|---------|------|
| `fetcher` | `traceRecords`, `collectConfig` | `stocks`, `dailyQuotes`, `financialReports`, `collectConfig`, `traceRecords` | CRUD | 数据采集模块 |
| `stockpool` | `stocks`, `v6Scores` | `stocks` | CRUD | 股票池管理 |
| `analyzer` | `stocks`, `v6Scores`, `intelligentScores`, `industryScores`, `scoreDocs`, `hotSectorScores`, `valuePitScores`, `signals` | `v6Scores`, `intelligentScores`, `industryScores`, `scoreDocs`, `hotSectorScores`, `valuePitScores` | SELECT/INSERT/UPDATE | 评分引擎（无 DELETE） |
| `rotation` | `stocks`, `rotationScores`, `dailyQuotes` | `rotationScores` | CRUD | 轮动策略 |
| `sector` | `stocks`, `sectorScores` | `sectorScores` | CRUD | 板块策略 |
| `news` | `stocks`, `news`, `newsStockMap`, `sentimentCache`, `newsBookmarks` | `news`, `newsStockMap`, `sentimentCache`, `newsBookmarks` | CRUD | 资讯模块 |
| `tradinghub` | `stocks`, `v6Scores`, `orders`, `signals`, `strategySnapshots`, `hotSectorScores`, `valuePitScores` | `orders`, `signals`, `strategySnapshots`, `hotSectorScores`, `valuePitScores` | INSERT/UPDATE/DELETE | 交易中枢（无 SELECT） |
| `trading` | `stocks`, `orders`, `signals`, `strategySnapshots` | `orders`, `signals` | SELECT/INSERT/UPDATE | 交易执行 |
| `system` | **全部** | **全部** | **全部** | 系统管理 |
| `user` | `stocks`, `v6Scores`, `orders`, `customAgents` | `stocks`, `orders`, `customAgents` | INSERT/UPDATE/DELETE | 用户数据（无 SELECT） |
| `strategy` | `stocks`, `v6Scores`, `dailyQuotes`, `hotSectorScores`, `valuePitScores`, `rotationScores`, `signals` | `hotSectorScores`, `valuePitScores`, `signals` | SELECT/INSERT/UPDATE | 策略引擎 |
| `orderstore` | `orders` | `orders` | CRUD | 订单存储 |
| `holdingsStore` | `stocks`, `orders` | — | SELECT | 持仓查询（只读） |
| `datalayer` | **全部** | — | SELECT | 数据层（仅查询） |
| `rbac` | `rbacUsers`…`rbacPermissionAuditLogs`（6 表） | 同上 | CRUD | 权限管理 |

> **完整矩阵**: 见 `src/config/dbConfig.ts` 第 302-460 行。DB_VERSION = 27（截至 2026-07-10）。

### 2.4 操作类型推断

`AclEngine` 通过 `inferOperation()` 从 Action 名称推断操作类型：

| Action 关键词 | 推断操作 |
|-------------|---------|
| `INSERT` / `SAVE` / `INGEST` | `INSERT` |
| `UPDATE` | `UPDATE` |
| `DELETE` / `CLEAR` | `DELETE` |
| 其他（含 `QUERY`） | `SELECT` |

### 2.5 校验 API

```typescript
// 静默检查（返回布尔）
aclEngine.check({ module, store, operation })  // → { allowed, reason }

// 断言检查（失败抛 AclError）
aclEngine.assert({ module, store, operation })   // → void | throws AclError

// 包装执行（权限通过后执行回调）
aclEngine.wrap({ module, store, operation }, async () => { ... })
```

---

## 三、L3 通信协议层：Envelope 安全信封

### 3.1 结构定义

```typescript
interface StandardEnvelope {
  meta: {
    source: ModuleId          // 发起模块（如 'analyzer'）
    target: EnvelopeTarget    // 目标模块（如 'db' / 'strategy:hotSector'）
    action: EnvelopeAction     // 操作动作（如 'SAVE_SCORES'）
    traceId: string            // 全链路追踪 ID（如 'nanoid(12)'）
    timestamp: number         // 毫秒时间戳（自动生成）
  }
  payload: unknown            // 业务载荷
}
```

### 3.2 验证规则

`EnvelopeFactory.validate()` 执行以下校验：

1. **结构校验**：必须是对象，包含 `meta` + `payload`
2. **source 校验**：必须是非空字符串
3. **target 校验**：必须在 `ENVELOPE_TARGET` 枚举中（禁止任意字符串）
4. **action 校验**：必须是非空字符串
5. **traceId 校验**：必须是非空字符串（全链路追踪用）
6. **timestamp 校验**：必须是正数（防止时间篡改）
7. **payload 校验**：不能为 `undefined`（允许 `null`）

> 验证失败会返回 `{ valid: false, error: string }`，`DataBridge.forward()` 据此拒绝处理。

### 3.3 安全特性

| 特性 | 实现 | 目的 |
|------|------|------|
| 不可伪造 | `target` 必须在枚举中 | 防止模块冒充目标 |
| 全链路追踪 | `traceId` 贯穿 `forward() → ACL → route → DB → audit` | 问题定位与审计 |
| 时间防篡改 | `timestamp` 必须为正数 | 检测异常时序 |
| 显式映射 | `ACTION_TO_STORE_MAP`（66 条映射） | 避免字符串包含歧义 |

---

## 四、L4 桥接路由层：DataBridge

### 4.1 架构职责

`DataBridge` 是**唯一**的数据操作入口，所有跨模块数据流必须经过此层：

```
Service/Store → EnvelopeFactory.create() → DataBridge.forward()
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              Envelope.validate()         ACL.assert()            routeToAction()
                    │                         │                         │
                    ▼                         ▼                         ▼
              失败→拒绝                失败→fallbackQueue            策略/查询/事件/DB
                                                                     │
                                                                     ▼
                                                              writeAuditLog()
```

### 4.2 安全机制

| 机制 | 实现 | 说明 |
|------|------|------|
| **ACL 校验** | `assertAclWithFallback()` | 市场类 envelope（如 `saveDailyQuotes`）被拒绝时入队重试，非市场类直接抛错 |
| **缓存一致性** | `invalidateCache()` | 写操作成功后自动清除读缓存，防止脏读 |
| **fallback 重试** | `FallbackQueue` | 市场类 ACL 失败后入队，支持 `retryFailed()` 批量重试 |
| **慢调用告警** | `FORWARD_SLOW_THRESHOLD_MS = 50` | 超过 50ms 记录 warn 日志 |
| **审计日志** | `writeAuditLog()` | 写入 `research_logs` 表，含 `traceId/actor/action/targetType/payload` |

### 4.3 路由分类

DataBridge 将 Action 分为 5 类，每类走不同路由：

| 类型 | 判定条件 | 路由目标 | 示例 |
|------|---------|---------|------|
| 策略路由 | `STRATEGY_ACTIONS` | `routeToStrategy()` | `strategyHotSectorRefresh` |
| 查询路由 | `QUERY_ACTIONS` | `routeToQuery()` | `queryGet`, `queryList` |
| 事件路由 | `EVENT_ACTIONS` | `routeToEvent()` | `newsArticleLoaded` |
| 管理路由 | `resetAll/importAll/exportAll` | `routeToManager()` | `resetAll` |
| DB 路由 | 其他 | `routeToDB()` | `saveScores` |

### 4.4 查询操作 ACL

`query()` 入口独立校验 SELECT 权限：

```typescript
// 1. 生成缓存 key
// 2. 查缓存（命中直接返回）
// 3. ACL 校验（assertQueryAcl）
// 4. 执行数据库操作
// 5. 缓存结果
// 6. 写入审计日志（异步，不阻塞主流程）
```

---

## 五、L1 存储安全层：localStorage 加密

### 5.1 加密方案

| 属性 | 配置 |
|------|------|
| 算法 | AES-GCM 256 |
| 密钥派生 | PBKDF2 (SHA-256, 100,000 iterations) |
| 密钥材料 | `namespace + window.location.origin` |
| Salt | `v9-local-storage-encryption-salt-v1`（应用级固定） |
| IV | 12 字节随机（`crypto.getRandomValues()`） |

### 5.2 API

```typescript
// 加密写入（敏感配置如 API Key）
await storage.setEncrypted('openai_api_key', 'sk-...')

// 解密读取
const key = await storage.getEncrypted('openai_api_key')
```

### 5.3 安全策略

| 策略 | 实现 | 原因 |
|------|------|------|
| 降级为不存储 | 加密失败时抛出错误 | 防止明文回退攻击 |
| 明文检测清除 | 旧版非加密条目检测到后删除 | 兼容旧数据但强制升级 |
| 过期自动清理 | TTL 支持，过期条目返回 null | 防止密钥长期滞留 |
| 容量监控 | 5MB 上限，80% 阈值告警 | 防止存储溢出 |
| 命名空间隔离 | `ns:key` 前缀隔离 | 防止 key 冲突 |

### 5.4 适用场景

- ✅ LLM API Key（OpenAI/Claude/Kimi）
- ✅ 用户认证 Token
- ✅ 交易账户敏感配置（如券商 API 凭证）
- ❌ 非敏感配置（如主题设置、缓存数据）应使用明文 `set()`/`get()`

---

## 六、L6 权限管理层：RBAC 六表模型

### 6.1 表结构

DB_VERSION 24 引入 RBAC 权限管理（6 张表）：

| 表名 | 用途 | 写入规则 |
|------|------|---------|
| `rbac_users` | 用户基础信息 | 用户管理模块 |
| `rbac_roles` | 角色定义（如 `admin`/`trader`/`viewer`） | 角色管理模块 |
| `rbac_permissions` | 权限原子定义（如 `trading:execute`） | 权限管理模块 |
| `rbac_user_roles` | 用户-角色多对多映射 | 用户管理模块 |
| `rbac_role_permissions` | 角色-权限多对多映射 | 角色管理模块 |
| `rbac_permission_audit_logs` | 权限变更审计日志 | **append-only**（仅归档服务可删除） |

> **审计日志 append-only 原则**：`saveRbacAuditLog` 只能追加，删除需通过 `deleteRbacAuditLog`（仅限 RBAC-S3 归档服务）。

### 6.2 与 ACL 矩阵的关系

| 层级 | ACL 矩阵 | RBAC 六表 |
|------|---------|----------|
| 作用域 | 模块级（17 模块） | 用户级（角色/权限细粒度） |
| 校验时机 | DataBridge 路由时 | 用户界面操作前 |
| 控制粒度 | 模块-存储-操作 | 用户-角色-权限 |
| 适用场景 | 代码层面的模块隔离 | 用户层面的权限分配 |
| 动态性 | 静态配置（代码常量） | 动态管理（数据库表） |

ACL 矩阵与 RBAC 是**互补而非替代**：ACL 保护模块间通信，RBAC 管理用户权限。

---

## 七、L5 服务权限层：MCP ACL 双端校验

### 7.1 架构

```
调用方 context ──→ MCPBridge ──→ MCPClientImpl（检查点 1）──→ MCPServerBase（检查点 2）──→ tool.handler
                      │                    │                        │
                      │              Client 主拦截              Server 深度防御
                      │              （防君子）                    （防小人）
                      │                    │                        │
                      └─────────  mcpAclInterceptor.check() ───────┘
```

### 7.2 四角色权限矩阵

| Server\角色 | `agent` | `ui` | `ci` | `system` |
|------------|---------|------|------|----------|
| fetcher | ✅ | ✅ | ❌ | ✅ |
| stockpool | ✅ | ✅ | ❌ | ✅ |
| scoring:v6 | ✅ | ✅ | ❌ | ✅ |
| analysis | ✅ | ✅ | ❌ | ✅ |
| news | ✅ | ✅ | ❌ | ✅ |
| llm | ✅ | ✅ | ❌ | ✅ |
| portfolio | ✅ | ✅ | ❌ | ✅ |
| screening | ✅ | ✅ | ❌ | ✅ |
| backtest | ✅ | ✅ | ❌ | ✅ |
| trading | ✅ | ❌ | ❌ | ✅ |
| execution | ✅ | ❌ | ❌ | ✅ |
| trade | ✅ | ❌ | ❌ | ✅ |
| input | ✅ | ❌ | ❌ | ✅ |
| export | ✅ | ❌ | ❌ | ✅ |
| data-collector | ✅ | ❌ | ❌ | ✅ |
| system | ✅ | ❌ | ✅（仅查询） | ✅ |

> **测试覆盖**: 72 个单元测试用例（`src/mcp/__tests__/mcpAclInterceptor.test.ts`）

### 7.3 禁止清单

- ❌ 禁止 `mcpRegistry.getServer().server.callTool()` 直接调用（绕过 Client）
- ❌ 禁止省略 `context` 参数
- ❌ 禁止 UI 组件用 `caller: 'agent'` 规避权限
- ❌ 禁止用 `caller: 'system'` 掩盖 UI 调用

---

## 八、L7 输出安全层：LLM 输出消毒

### 8.1 评分引擎消毒

`src/services/scoring/v6-engine/engine.ts`：

```typescript
function sanitizeScore(score: unknown, layerId: string, context: string): number {
  // 1. 必须是 number 类型
  // 2. 必须是有限值（非 Infinity/NaN）
  // 3.  clamp 到 [0, 100] 范围
  // 4. 返回前记录 warn（如果原始值被截断）
}
```

### 8.2 XSS 防护

- AGENTS.md §六 要求：LLM 输出必须经 `sanitizeLlmOutput` 消毒后渲染
- 渲染层禁止直接 `dangerouslySetInnerHTML` 未消毒的 LLM 内容
- 所有用户输入经 `sanitizeLlmOutput` 处理后再进入 DOM

---

## 九、审计追踪体系

### 9.1 审计日志表

| 表 | 用途 | 字段 |
|---|------|------|
| `research_logs` | 数据操作审计 | `traceId`, `timestamp`, `actor`, `action`, `targetType`, `targetCode`, `payload` |
| `rbac_permission_audit_logs` | 权限变更审计 | `userId`, `roleId`, `permissionId`, `action`, `timestamp`, `operator` |
| `command_audit_logs` | 命令审计（DB_VERSION 18） | 命令执行记录 |

### 9.2 审计字段

每条 `research_logs` 记录包含 `audit` 对象：

```typescript
{
  audit: {
    createdAt: number   // 创建时间
    updatedAt: number   // 更新时间
    version: 1          // 数据版本
    operator: ModuleId  // 操作者
  }
}
```

### 9.3 TraceId 链路

```
EnvelopeFactory.create(traceId) → DataBridge.forward(traceId) → ACL.assert(traceId) → routeToDB(traceId) → writeAuditLog(traceId) → DB put(traceId)
```

同一条请求的 `traceId` 贯穿整个链路，确保可追溯。

---

## 十、安全合规检查清单

### 10.1 提交前自查

```typescript
// ✅ 安全自查清单
[ ] 新增模块是否在 ACL_MATRIX 中注册了权限？
[ ] 新增存储表是否在 ACL 的 read/write 列表中？
[ ] 新增 Action 是否添加了 `ACTION_TO_STORE_MAP` 映射？
[ ] 新增 Envelope Target 是否在 `ENVELOPE_TARGET` 枚举中？
[ ] 敏感配置是否使用 `setEncrypted()` / `getEncrypted()`？
[ ] 新增 MCP Server/Tool 是否在 `MCP_ACL_MATRIX` 中注册？
[ ] LLM 输出是否经过 `sanitizeLlmOutput` 消毒？
[ ] 事件监听是否在 cleanup 中移除？（AGENTS.md §三）
[ ] 是否运行 `npm run audit:layers` 确认无跨层违规？
[ ] 是否运行 `npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts` 确认 MCP ACL 通过？
```

### 10.2 安全验证命令

```powershell
# 1. 架构分层审计（确保无跨层违规）
npm run audit:layers
# 期望: 0 violations, 0 warnings

# 2. MCP ACL 单元测试（72 用例）
npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts
# 期望: 72 passed

# 3. 类型安全
tsc --noEmit
# 期望: 0 errors

# 4. 全量测试
npm run test -- --run
# 期望: 全部通过
```

### 10.3 安全基线（Ratchet）

| 指标 | 基线 | 说明 |
|------|------|------|
| ACL 校验覆盖率 | 100% 数据操作 | 所有 `forward()` / `query()` 都经过 ACL |
| MCP ACL 测试 | 72 用例 | 新增 Server/Tool 必须补充测试 |
| 加密存储字段 | API Key, 用户 Token | 新增敏感字段必须评估是否需要加密 |
| 审计日志覆盖 | 100% 写操作 | 所有 `forward()` 都写 `research_logs` |
| 跨层违规 | 0 | `audit:layers` 必须零违规 |

---

## 十一、相关文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| ACL 矩阵定义 | `src/config/dbConfig.ts` | ACL_MATRIX + ENVELOPE_TARGET + ENVELOPE_ACTION |
| ACL 引擎 | `src/core/acl.ts` | AclEngine + inferOperation |
| Envelope 信封 | `src/core/envelope.ts` | EnvelopeFactory + validate |
| DataBridge | `src/core/databridge.ts` | forward + query + routeToAction |
| 加密存储 | `src/lib/localStorageCrypto.ts` | AES-GCM + PBKDF2 |
| 存储管理 | `src/lib/localStorageManager.ts` | LocalStorageManager + setEncrypted |
| MCP ACL 矩阵 | `src/config/mcpAclMatrix.ts` | MCP_ACL_MATRIX |
| MCP ACL 拦截器 | `src/mcp/core/mcpAclInterceptor.ts` | mcpAclInterceptor |
| MCP 开发指南 | `../how-to/mcp-acl-guide.md` | 双端校验 + 角色决策树 |
| AGENTS.md 安全约束 | `AGENTS.md` §三/六/八 | 代码风格 + LLM 约束 + DB 版本 |

---

> **⚠️ 待确认项（请补充）**：
> 1. 当前框架版本（React / Vite / TypeScript 版本号）？
> 2. 部署环境（内网/云厂商/容器化方案）？
> 3. 是否接入外部 SSO/OAuth（如企业微信/钉钉/飞书）？
> 4. 是否需补充 HTTPS/CSP 配置规范？
> 5. 是否需要 WAF 或 DDoS 防护策略？
> 
> 请确认上述信息后，继续生成 `deployment.md`。
