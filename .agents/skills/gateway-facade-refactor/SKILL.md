---
skill_id: V9-SKILL-GATEWAY-FACADE-REFACTOR
name: "gateway-facade-refactor"
description: "端到端执行 Gateway 门面化架构重构 6 阶段 SOP：过渡期白名单→方案选型→门面创建→核心迁移→业务重构→契约收尾与全绿验证。Invoke when 需要将散落在多层的直接数据访问（裸 db/IDBTransaction/dataLayer 调用）收敛到统一的门面层，或 audit:db-references/audit:layers 报告大量跨层违规。"
version: v1.0.4
last_updated: 2026-08-23
change_log:
  - version: v1.0.4
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 4 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.0.3
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.2 / 正文 v1.0.1) → 取真值 max=1.0.2 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 2 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-08-20
mandatory: false
---

# Gateway 门面化端到端重构 Skill — v1.0.4

> **版本**: v1.0.4 | **日期**: 2026-08-21 | **校验基准**: FinSightV9 code_version 2.0.0-rc.2 / DB_VERSION=35 / STORE_NAME=53
> **任务性质**: 大型架构重构与治理 SOP，允许修改门面目录结构/audit 脚本 RULE/过渡期白名单常量，**禁止**直接调整 DB_VERSION、删除已有 Store、在未跑 tsc:prod 前批量迁所有文件、绕过过渡期白名单清零直接提交
> **输出格式**: Phase 0~5 总览表 + 三方案选型矩阵 + 过渡期白名单清零记录 + 架构收益对比表 + 全量门禁验证表

---

## 一、触发条件（Invoke When · 5 条可判定规则）

触发任一条即应加载本 Skill：

- **显式触发 1**：`audit:db-references` 报告多处「非 data/ 层直接 import { db }」或「非豁免层直接使用 IDBTransaction」违规（违规数 ≥ 3 文件）
- **显式触发 2**：`audit:layers` 报告大量跨层调用违规（services/core 层直接依赖 data 层实体而非门面，N ≥ 10 处）
- **显式触发 3**：用户明确要求「把所有 xxx 访问统一收敛到门面层」或「做一轮架构重构消除散点数据访问」或「建立 Gateway 统一入口」
- **脚本/审计触发 4**：新增架构规范需要落地（如 AGENTS.md 新增某层为**唯一入口**但现有代码 100+ 处绕过），或 husky pre-commit 的 audit:layers/db-references stage 连续两次失败
- **设计/协议触发 5**：怀疑存在「绕过门面的 store.saveWithTx 后门」「门面 API 命名不一致（get vs query vs fetch）导致业务混淆」的隐性反模式扩散

**不触发场景**（减少误激活，至少 2 条）：
- 只改门面目录内的小修小补（如 API 注释、JSDoc 优化），不涉及裸访问收敛
- 单元测试或 CI 配置文件修改，不涉及业务端 import { db } / IDBTransaction 模式

**协作 Skill（链式调用）**：
- `architecture-cleanup`：修复零散跨层违规与命名一致性
- `databridge-migration`：将 dataLayer 调用迁移到信封协议（与门面改造双轨推进）
- `type-safety-contract`：门面 API 的类型修改 6 步安全契约（Phase 2 接口定义阶段强制加载）
- `db-reference-audit`：每次提交后复验数据库引用一致性（Phase 5 四端同步后必跑）

---

## 二、前置检查清单（先扫后改，必须先通过再动手）

| # | 检查项 | 命令/方法 | 通过标准 |
|---|-------|---------|---------|
| 1 | 契约基线版本 | 阅读 AGENTS.md 头部 version + code_version | 明确本轮 AGENTS 升级目标版本（如 v1.6.0 → v1.7.0） |
| 2 | 基线门禁四件套全绿 | 顺序跑 `tsc:prod`、`audit:db-references`、`audit:layers`、`audit:acl-consistency` | 4 项 **0 ERROR 0 WARN**，作为 Phase 3/5 回归对照 |
| 3 | 违规基线快照保存 | 运行目标违规审计（audit:db-references + audit:layers）并把输出保存为 `deliverables/YYYY-MM-DD-gateway-baseline.txt` | 记录「N 处违规 / M 文件」作为 Phase 3 清零对照，diff 不能越迁越多 |
| 4 | 过渡期白名单 vs 永久豁免区分 | grep 目标 audit 脚本 `EXEMPT_DIRS` / `WHITELIST_*` 常量 | 评估哪些是真豁免（基础设施）、哪些是过渡期白名单（Phase 3 必须清零） |
| 5 | 注册表与镜像一致性 | `npm run audit:skill-coverage` | 0 Missing / 0 Duplicate / 0 Path Not Exist |
| 6 | 门面目录存在性与占位检查 | `ls src/<domain>/<facade-name>/`（目标路径） | 已存在 = 进入 Phase 2 扩展；不存在 = 进入 Phase 2 创建 |
| 7 | 单元测试基线速查 | `npm run test:unit:quick`（或 `test:p0:core`） | 核心用例 100% 通过，作为 Phase 3 迁移后对照 |

> **铁律**：上表任一项未通过 → 先修复前置问题再推进。尤其 #2 基线门禁四件套与 #3 违规快照，Phase 5 需要对照"清零"；跳过 = 重构过程中不知道何时引入新旁路。

---

## 三、阶段化 SOP（6 Phase · 每 Phase 含目标 + 交付物清单 + 代码/文档模板）

### Phase 0 — 过渡期白名单与审计门禁建立

**目标**：让门禁在重构期间能**精准阻断新的违规**，同时放行已知的旧违规，避免重构过程中新混入旁路代码。

**交付物**：
1. **过渡期白名单清单**（按文件逐个列出，含责任人/预计清除阶段标记）
   ```
   示例（叶 → 根 5 层顺序）：
   - src/core/transaction.ts            → 清除阶段：Phase 3 Step 1
   - src/core/cascadeExecutor.ts        → 清除阶段：Phase 3 Step 2
   - src/core/dataBridge/databridge*.ts → 清除阶段：Phase 3 Step 3/4/5
   - src/services/portfolio/xxx.ts      → 清除阶段：Phase 4
   ```
2. **审计脚本 RULE 强化**（以 `audit-db-references.ts` 为例，通用规则模板）：
   - **RULE_N 导入检测**：正则 `import.*{.*db.*}.*from.*@/data/db`，匹配后若文件不在白名单 → `severity: 'error'`
   - **RULE_N+1 类型/API 检测**：正则匹配底层类型（如 `IDBTransaction`、`dataLayer\.\w+\.put`），排除注释/JSDoc 行，白名单以外报错
   - **允许的模式（allowedPatterns）**：给门面层回调签名开绿灯（如 `runInTransactionWithContext.*\(.*ctx.*=>`），避免误报合法封装
3. **运行基线快照**：执行目标审计（audit:db-references + audit:layers），将 0 ERROR（预期）保存，后续每阶段对比。

### Phase 1 — 架构方案评估与选型

**目标**：在「干净创建新门面」之前，先评估 2~3 种主流架构模式，选择**匹配项目现状的最小改造路径**，避免为了模式而模式。

**交付物**：
1. **三方案对比矩阵**（以 data 层门面为例）：

   | 维度 | Clean Architecture | DDD 六边形 | React BFF + UnitOfWork（实际推荐选型） |
   |------|-----------------|-----------|----------------------------------|
   | 依赖倒置 | 强（接口在 domain，实现在 data） | 强（端口/适配器分离） | 中（接口+实现同目录，单例导出租用） |
   | 改动量 | 大（需 domain 层下沉） | 很大（模块拆分） | 小（新建目录 + 逐文件迁移） |
   | 测试友好 | 强 | 强 | 中强（单例 + 接口可 mock） |
   | 学习成本 | 高 | 极高 | 低（BFF 模式前端熟悉） |
   | 与现有 Envelope/ACL 契合 | 需适配 | 需重写 | 零冲突（门面在 DataBridge 之下） |

2. **选型决策文档段落**：写入 AGENTS.md 变更摘要 + Wiki 架构说明，给出**为何选此方案**而不选其他（改动量、回归风险、团队熟悉度三维度说明）。

### Phase 2 — 创建门面层（接口 + 实现 + 类型）

**目标**：先把门面本身建对、跑通，再开始迁移。门面 API 签名必须**覆盖所有未来要迁移的读/写/事务/批量**操作，避免迁一半再改接口。

**交付物**：
1. **门面目录结构模板**（可直接套用）：
   ```
   src/<domain>/<facade-name>/
   ├── index.ts                 # 单例实现 + export const gateway = new Impl()
   ├── <facade-name>.types.ts   # 所有接口/类型定义（零实现）
   └── README.md                # 门面速查卡（非必须，复杂重构建）
   ```
2. **接口定义铁律（IFacade 接口模板）**：
   - 读/写/事务/批量/级联/数据管理 全量分组，方法命名**动词开头**：`get` / `put` / `delete` / `batchPut` / `clearAll` / `runInTransaction`
   - **事务上下文接口**（如 `ITransactionContext`）务必单独定义，业务代码绝不直接裸传 `IDBTransaction`：
     ```typescript
     export interface ITransactionContext {
       readonly tx: IDBTransaction  // 暴露 readonly，禁止业务直接拿
       get<T>(store: StoreName, key: string): Promise<T | undefined>
       put<T>(store: StoreName, value: T): Promise<void>
       delete(store: StoreName, key: string): Promise<void>
       queryByIndex<T>(store: StoreName, index: string, value: string): Promise<T[]>
     }
     ```
   - 泛型 `<T>` 贯穿 API，消除业务端强制 `as T`。
3. **单例实现模板**：
   ```typescript
   class FacadeImpl implements IFacade {
     async runInTransactionWithContext<T>(
       stores: StoreName[],
       mode: IDBTransactionMode,
       callback: (ctx: ITransactionContext) => Promise<T> | T,
     ): Promise<T> {
       return db.withTransaction(stores, mode, async (tx) => {
         const ctx = new TxContextImpl(tx)
         return callback(ctx)
       })
     }
     // ... 其他方法
   }
   export const gateway = new FacadeImpl()
   ```
4. **类型检查验证**：`tsc:prod` 必过；门面文件本身零 `@ts-ignore` / `any`。

### Phase 3 — 核心文件逐个迁移（过渡期白名单清零）

**目标**：按「依赖链从叶到根」逐个迁移过渡期白名单中的文件，**每迁完一个从白名单删除并立即跑审计**，避免批量迁移后大面积回归不知道哪个文件引入。

**标准迁移顺序（叶 → 根 5 步）**：

```
Step 1: 工具封装层（transaction.ts / db 辅助函数）
   ↓ 被 Step 2 依赖
Step 2: 工具算法层（cascadeExecutor / 批量处理器）
   ↓ 被 Step 3/4 依赖
Step 3: Handler 层（databridgeHandlers / 单 store 写入逻辑）
   ↓ 被 Step 4 路由
Step 4: 路由/分发层（databridgeRouter）
   ↓ 被 Step 5 入口
Step 5: 入口桥接层（databridge 主入口）
```

**每步迁移的标准动作表**：

| # | 动作 | 完成验证 |
|---|------|---------|
| 1 | `import { db }` → `import { gateway }` | 确认 import 唯一门面，无二次导入底层 |
| 2 | 裸 `db.withTransaction(..., (tx) => {...store.saveWithTx(x, tx)})` | 改为 `gateway.runInTransactionWithContext(..., ctx => ctx.put(x))`，不再出现 IDBTransaction 裸传 |
| 3 | 删除白名单中该文件条目 | **立即重跑 audit:db-references + audit:layers**，确保「该文件不再触发 RULE」 |
| 4 | `tsc:prod` + 相关单元测试 | 0 错误 / `test:unit:quick` 核心用例 100% 通过 |

**Phase 3 完成标志**：过渡期白名单**条目数 = 0**；审计脚本中可删除「临时过渡期豁免」常量，留下永久基础设施豁免。

### Phase 4 — 业务模块重构 + 上下文 API 完善

**目标**：Phase 3 迁完核心封装层，Phase 4 迁散落在 services/useCases/store 中的业务代码。补充门面中 Phase 2 阶段没想到的上下文 API（通常是按索引查、批量删等）。

**交付物**：
1. **散点违规 Grep 清单**（按违规类型逐个列文件）：
   - 类型 A：直接 `import { db }` 的 services/useCase 文件
   - 类型 B：直接 `IDBTransaction` 作为参数类型（非门面内部）
   - 类型 C：`portfolioStore.saveWithTx` 这类「store 穿透门面的后门方法」——**直接删除后门方法**，强制全部走 ctx 上下文。
2. **上下文 API 增补**：在 `ITransactionContext` 补全所有实际迁移需要的方法，新增方法同步在 `TxContextImpl` 落地。
3. **审计脚本规则增强（如 RULE_8）**：针对新发现的旁路模式补充正则，**保证 Phase 4 完成后新增的模式也能被检测**。
4. **每迁移一个业务用例**：单独跑 `tsc:prod` + 该用例 vitest（若有），避免批量迁移后批量报错。

### Phase 5 — 契约收尾 + 全量验证

**目标**：代码改完≠完成，**契约/Wiki/版本号/门禁四端同步**后才算真完成。

**交付物打勾表（逐项打勾，少一项都不算完）**：
- [ ] **AGENTS.md 三端同步升版**（PATCH++ 或 MINOR++，依重构规模）：
  - Frontmatter：`version`、`last_updated`、`code_version`、`change_log` 头部新增本轮条目
  - 文首版本声明段：新增本轮「v1.x.0 变更」摘要段落，明确铁律（如"所有业务代码 100% 通过 xxx 门面访问"）
  - §十一 变更日志表顶部：新增本轮里程碑条目
- [ ] **Wiki README 同步**：
  - 文档 Frontmatter：`last_updated`、`version` 与 AGENTS.md 对齐
  - 版本声明段：新增里程碑说明（契约版本号一致）
  - 架构图/一图速览：增加「门面层」节点，标注为唯一数据入口
- [ ] **审计脚本 RULE 说明同步**：在 audit 脚本文件末尾 RULE 注释段补充新增规则编号/检测内容
- [ ] **全量门禁验证（最后必跑，按顺序，不允许跳）**：

  | 命令 | 通过标准 |
  |------|---------|
  | `npm run tsc:prod` | 0 错误 |
  | `npm run audit:layers` | 0 违规 / 0 警告 |
  | `npm run audit:db-references` | 0 ERROR / 0 WARN（过渡期白名单=0） |
  | `npm run audit:acl-consistency` | 0 ERROR / 0 WARN（ACL 映射/枚举/handler/forward 四方一致） |
  | `npm run test:unit:quick`（或 `test:p0:core`） | 核心用例 100% 通过 |

- [ ] **总结报告（最终用户回复三张表）**：Phase 0~5 总览表 + 架构收益对比表 + 全量门禁验证结果表。

---

## 四、陷阱与经验教训（12 条实战提炼，含后果 + 规避路径）

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 一次性批量迁所有文件，白名单不清零 | 审计绿灯=假绿灯，旁路代码混着过 → 几周后违规再次扩散 | **逐文件迁移 + 每迁完一个删白名单条目并重跑 audit:db-references**（Phase 3 标准动作） |
| 2 | 只改代码不改审计 RULE | 新发现的旁路模式无法被检测 → 提交后违规以相同模式回来 | Phase 0 建立+Phase 4 结束前两次审视 RULE 正则，保证所有被迁移过的模式都被 RULE 覆盖 |
| 3 | 门面 API 命名不一致（get vs query vs fetch混用） | 业务端混淆，重复代码增加，团队不知道用哪个 → 迁移后期 API 大改 | Phase 2 阶段统一动词表（get/put/delete/batchPut/clearAll/runInTransaction），接口定义评审后再启动 Phase 3 |
| 4 | 把 ITransactionContext 设计成空壳，只暴露 tx 字段 | 等于没封装，业务代码仍裸操作 IDBTransaction → 类型安全收益归零 | `tx` 标 `readonly`，提供 get/put/delete/queryByIndex 强类型方法；禁止 Phase 2 阶段仅空壳实现 |
| 5 | 改了 frontmatter 不改文首声明段 / 改了文首不改变更日志表 | 文档漂移，契约版本号三端不一致 → 下一轮 AI 按旧契约写代码 | 用本 Skill §Phase 5 的打勾清单逐项核对（AGENTS.md 三处同步+Wiki 两处同步） |
| 6 | 过渡期白名单包含「业务层文件」而非「离 db 最近的核心封装」 | 给 services/useCase 开白 = 纵容违规扩散 → 门面迁移无法闭环 | **白名单只开给 5 类封装**：transaction / cascadeExecutor / handler / router / bridge 入口 |
| 7 | RULE 检测匹配 JSDoc 注释，误报导致人厌弃审计 | 误报率高 = 没人理 RULE → 失去门禁意义 → 团队绕过 husky | RULE 正则务必加「跳过 // 行 / * 行 / JSDoc */结尾」三重过滤逻辑；allowedPatterns 明确给门面回调解绿灯 |
| 8 | 迁移前不保存基线违规数 | Phase 3 完成后不知道是清零了还是又多了 → 「比基线更多」时无法及时回滚 | Phase 0 必跑 audit 并记录「N 文件 / M 违规」数字，作为 Phase 3/5 两次对照 |
| 9 | 迁移用例测试跑通就认为 OK，不跑 tsc:prod | 类型未覆盖的参数在业务端运行时爆炸 → 重构被回滚 | **tsc:prod 永远是第一个验证**，每 Phase 0/2/3/4/5 都要单独跑 1 次，必须 0 错误 |
| 10 | 门面 API 泛型 T 写得不严，到处 as unknown as T | 类型安全收益归零 → 门面层和裸用 db 没区别 | 接口签名务必 `<T>(store, key): Promise<T \| undefined>`，禁止 Promise<any> / 返回 unknown；Phase 2 阶段 type-safety-contract 强制加载评审 |
| 11 | 只改代码不改 AGENTS.md | 下一轮 AI 不知道新契约，继续按旧方式写代码 → 重构白做，几周后违规又扩散 | **契约升级是 Phase 5 铁律**，AGENTS 三端同步+Wiki 双端同步不做=项目级收益丢失 |
| 12 | 完成后不标注「旁路代码违规后果」到文档 | 团队不知道什么会被拦截，提交全红灯 → 团队绕过 husky 提交 | 在 AGENTS.md v1.x.0 变更摘要明确写出「X 模式会被 audit:y 门禁拦截，请走门面」字样 |

---

## 五、完成交付物清单（必要且充分条件 · 14 项 · 少一项 = 未完成）

重构工作全部完成的**必要且充分条件**（少一项都算未完成）：

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 新门面目录（index.ts + types.ts 结构完整） | `src/<domain>/<facade-name>/` | `ls` 目录存在，`tsc:prod` 0 错误，门面 API 动词表覆盖完整 |
| 2 | IFacade 接口（含事务上下文 ITransactionContext 不暴露裸 tx） | `<facade-name>.types.ts` | grep `readonly tx: IDBTransaction` 存在 + `get/put/delete/queryByIndex` 强类型方法存在 |
| 3 | 过渡期白名单清零（常量删除或置空数组） | 对应 audit 脚本文件 | `audit:db-references` + `audit:layers` 输出 RULE_N 过渡期违规 = 0 |
| 4 | 所有散点违规文件 0 处（import { db } / IDBTransaction 裸传模式清光） | audit:* 输出报告 | audit:db-references ERROR=0 / WARN=0；audit:layers 违规=0 |
| 5 | AGENTS.md 三端同步升版（Frontmatter / 文首声明段 / §十一变更日志表三处版本号一致） | [AGENTS.md](file:///d:/FinSightV9/AGENTS.md) | grep 目标版本号出现三处一致 |
| 6 | Wiki README 升版（架构图 + 里程碑说明段） | `docs/wiki/README.md` 或对应 Wiki 文件 | grep 新里程碑字样存在，架构图含门面节点 |
| 7 | audit 脚本 RULE 注释段同步新增规则说明 | 对应 audit-db-references / audit-layers 脚本末尾 | grep 新增 RULE_N 编号与检测内容注释存在 |
| 8 | tsc:prod 全绿（0 error） | 命令输出 | 最后一次执行 0 错误 |
| 9 | 架构审计三件套全绿（audit:layers + audit:db-references + audit:acl-consistency） | 命令输出 | 每项都是 0 ERROR / 0 WARN |
| 10 | 核心单元测试通过（test:unit:quick 或 test:p0:core） | 命令输出 | 核心用例 100% PASS |
| 11 | 基线违规 vs 清零违规对比快照 | `deliverables/YYYY-MM-DD-gateway-baseline.txt` vs `deliverables/YYYY-MM-DD-gateway-final.txt` | 两者 diff 显示违规从 N→0 清零 |
| 12 | 最终总结报告（Phase 总览表 + 收益对比表 + 验证表三张） | 最终用户回复 | 三张表均存在且数据与门禁输出一致 |
| 13 | 镜像同步 skill:mirror 完成 + audit:skill-coverage 通过 | `.workbuddy/skills/gateway-facade-refactor/SKILL.md` 存在 | `npm run audit:skill-coverage` 0 Missing/Duplicate/NotExist |
| 14 | skill-registry mandatory 与 frontmatter 对齐检查 | `.trae/skills/skill-registry.json` 中 `mandatory=false` 与本 Skill Frontmatter `mandatory=false` | grep 两者一致（均为 false） |

> **必要且充分条件声明**：仅当上述 14 项全部满足，才算 Gateway 门面化重构**完整交付**；任一不满足 = 「重构未完成」，不允许标记为交付结束。
