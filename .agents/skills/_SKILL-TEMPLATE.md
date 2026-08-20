---
name: "<skill-slug>"
description: "<做什么，一句话说明功能范围> Invoke when <4 个具体触发条件的摘要，例如：XXX 改动时、YYY 脚本失败时、用户要求 ZZZ 时或架构审计报告违规时>。"
version: "v1.0.0"
last_updated: "<YYYY-MM-DD>"
change_log:
  - version: v1.0.0
    changes: "初始版本，基于 S 级 Skill 5 段式骨架模板创建"
    date: "<YYYY-MM-DD>"
mandatory: false  # 若为 P0 治理类，改为 true；否则保留 false
---

# <Skill 标题（中文）> — vX.Y.Z

> **版本**: vX.Y.Z | **日期**: <YYYY-MM-DD> | **校验基准**: FinSightV9 code_version x.y.z（填当前版本号）
> **任务性质**: <审计验证 / 架构重构 / SOP 执行 / 开发模板>，允许 <什么修改>，禁止 <什么硬操作，如改 DB_VERSION/删 Store/绕过审计>
> **输出格式**: <阶段化 SOP 矩阵 / 风险清单 + 门禁结论 + 决策记录>

---

## 一、触发条件（Invoke When · **必须先列 4~8 条可判定规则**）

- **显式触发 1**：用户明确要求「<中文触发词 1>」「<中文触发词 2>」
- **显式触发 2**：<相关领域代码>（文件路径 glob）被改动，需要回归完整性
- **脚本/审计触发**：`npm run <audit:x / test:y>` 报告 `N>0` 错误，或 CI pipeline 对应 stage FAIL
- **设计/协议触发**：怀疑存在「<隐性反模式 1>」「<隐性反模式 2>」的案例

**不触发场景**（减少误激活，至少 2 条）：
- 与领域无关的小改小修、文案优化
- 一次性临时脚本或本地调试，不写入项目代码的

**协作 Skill（链式调用，至少 1~3 个）**：
- `architecture-cleanup`：跨层调用违规修复阶段
- `type-safety-contract`：类型改动阶段
- `db-reference-audit`：数据引用一致性阶段
- `audit:skill-coverage`：完成后核验注册完整性

---

## 二、前置检查清单（先扫后改，**先通过再动手**，按表格列出）

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 契约基线版本 | 阅读 AGENTS.md 头部 version / code_version | 明确本轮 SKILL.md last_updated 与 version 的目标号 |
| 2 | 基线门禁全绿 | `tsc:prod` / `audit:layers` / 相关 audit 脚本 | 3 项以上 **0 ERROR 0 WARN**，作为回归对照 |
| 3 | 违规基线快照 | 运行目标 audit 脚本并保存 N 处违规 / M 文件 | 记录数字作为 Phase 3 清零对照 |
| 4 | 豁免目录定义 | 查看对应 audit 脚本 `EXEMPT_DIRS` 常量 | 区分「永久基础设施」与「过渡期白名单（待清零）」|
| 5 | 注册表存在性 | `audit:skill-coverage` 输出：本 Skill slug 不应出现于 Missing/Duplicate | 无 Missing / 无 Duplicate |

> **铁律**：上表任一项未通过 → 先修复前置问题，再推进。禁止跳过检查直接改代码。

---

## 三、阶段化 SOP（按 Phase 0~N 组织，**每阶段必写目标 + 交付物清单 + 代码/文档模板**）

### Phase 0 — 过渡期白名单与审计门禁建立

**目标**：让门禁在重构期间**精准阻断新的违规**，同时放行已知旧违规，避免新旁路代码混入。

**交付物**：
1. **过渡期白名单清单**（按文件逐个列出，含清除阶段标记）：
   ```
   - src/core/<leaf>.ts            → Phase 3 Step 1 清除
   - src/core/<leaf>.ts            → Phase 3 Step 2 清除
   - src/<domain>/<root>*.ts       → Phase 3 Step 3/4/5 清除
   ```
2. **审计脚本 RULE 强化模板**（通用正则模板）：
   ```typescript
   // RULE_N <导入/类型检测>：只允许在白名单
   const regex = /<import.*{.*db.*}.*from|IDBTransaction|dataLayer\.\w+\.put>/g
   for (const file of walkFiles(ROOT, ['.ts', '.tsx'])) {
     if (EXEMPT_DIRS.some(d => rel.startsWith(d))) continue
     if (regex.test(content) && !allowedPatterns.some(p => p.test(content))) {
       issues.push({ severity: 'error', message: `RULE_N: ...: ${rel}` })
     }
   }
   ```
   - `allowedPatterns`：给门面层回调解绿灯（如 `runInTransactionWithContext.*(ctx)=>`），避免误报
3. **运行基线快照并保存**（目标审计 0 ERROR 预期）

### Phase 1 — 方案评估与选型

**目标**：在创建新代码前，先评估 2~3 种主流模式，选择**匹配项目现状的最小改造路径**。

**交付物**：三方案对比矩阵 + 选型决策段落（写入 AGENTS.md 变更摘要 + Wiki 架构说明）。

### Phase 2 — 创建门面/契约层

**目标**：先把门面本身建对（接口签名覆盖所有要迁移的读/写/事务/批量），再开始迁移。避免迁一半改接口。

**交付物目录结构模板**：
```
src/<domain>/<facade-name>/
├── index.ts                  # 单例实现 + export const facade = new Impl()
├── <facade>.types.ts         # 所有接口/类型（零实现）
└── README.md                 # 门面速查卡（复杂时建）
```

**接口定义铁律模板（Facade API）**：
```typescript
export interface IFacade {
  // ① 生命周期
  open(): Promise<void>; close(): Promise<void>; isReady: boolean;
  // ② 事务（统一走 withTransaction）
  runInTransaction<T>(stores, mode, cb): Promise<T>;
  // ③ CRUD（动词开头）
  get<T>(store, key): Promise<T | undefined>;
  put<T>(store, value): Promise<void>;
  delete(store, key): Promise<void>;
  // ④ 批量 / 级联 / 数据管理
  batchPut(entries): Promise<void>; clearAll(scope): Promise<void>;
  // ⑤ 上下文事务（避免裸传 IDBTransaction）
  runInTransactionWithContext<T>(stores, mode, (ctx: ITransactionContext) => Promise<T>): Promise<T>;
}
```

### Phase 3 — 核心文件逐个迁移（叶到根，白名单清零）

**标准顺序**：Step 1 工具封装 → Step 2 算法层 → Step 3 Handler → Step 4 路由 → Step 5 入口桥接。

**每步动作表**：
| # | 动作 | 完成验证 |
|---|------|---------|
| 1 | `import { x }` → `import { facade }` | 确认仅导入门面 |
| 2 | 裸事务调用 → `facade.runInTransactionWithContext(ctx => ctx.put(...))` | 不再出现 `IDBTransaction` 裸传 |
| 3 | 删除白名单条目 → **立即重跑 audit** | 该文件不再触发 RULE |
| 4 | `tsc:prod` + 相关 vitest | 0 错误 / 核心测试通过 |

**Phase 3 完成标志**：过渡期白名单 = **空数组**。

### Phase 4 — 业务模块重构 + 上下文 API 增补

**交付物**：
1. 散点违规 Grep 清单（按类型分组列文件）
2. 上下文 API 增补（`ITransactionContext` 补齐 queryByIndex/batchDelete 等迁移需要的方法）
3. 审计脚本 RULE 增强（针对新发现的旁路模式补正则）
4. 每迁移一个 useCase：单独跑 `tsc:prod` + 该用例 vitest

### Phase 5 — 契约收尾 + 全量验证

**交付物打勾表（少一项都不算完）**：
- [ ] AGENTS.md：Frontmatter version/last_updated/code_version 升版 + 文首声明段 + §十一变更日志表 三端同步
- [ ] Wiki README：Frontmatter last_updated / version 升版 + 里程碑说明段 / 架构图更新
- [ ] audit 脚本 RULE 注释段：同步新增规则说明
- [ ] 全量门禁必跑：`tsc:prod`（0 错误） / `audit:layers`（0 违规） / `audit:db-references`（0 ERROR） / `audit:acl-consistency`（0 ERROR） / 核心单元测试（100% 通过）
- [ ] 总结报告：Phase 表 + 收益对比表 + 验证结果表

---

## 四、陷阱与经验教训（**至少 6 条，基于实战提炼，禁止空话**）

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 批量迁所有文件，白名单不清零 | 审计绿灯=假绿灯 | **逐文件迁移 + 每迁完一个删白名单条目并重跑 audit** |
| 2 | 只改代码不改 audit RULE | 新增模式无法被检测 | Phase 0/4 两次审视并补充正则，保证所有被迁移过的模式都被 RULE 覆盖 |
| 3 | Facade API 命名不一致（get vs query vs fetch） | 业务端混淆，重复代码 | Phase 2 统一动词表，接口定义评审后再启动 Phase 3 |
| 4 | 上下文接口只暴露 `tx` 字段，不提供 get/put | 等于没封装，业务仍裸操作 | `tx` 标 `readonly`，提供 `get/put/delete/queryByIndex` 强类型方法 |
| 5 | 只改 Frontmatter，不改文首声明段 / 改变更日志表 | 文档漂移，三版本号不一致 | Phase 5 打勾表逐项核对 |
| 6 | 过渡期白名单包含「业务层文件」而非核心封装 | 给 services/useCase 开白=纵容扩散 | 白名单只开放给**离 db 最近的 5 类封装**：transaction / cascade / handler / router / bridge |

---

## 五、完成交付物清单（**必要且充分条件，少一项 = 未完成**）

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 新门面目录 + 接口 + 单例实现 | `src/<domain>/<facade-name>/` | `tsc:prod` 0 错误，API 覆盖矩阵检查 |
| 2 | 过渡期白名单清零（常量删除或置空） | 对应 audit 脚本 | `audit:*` 输出 RULE_N 违规 = 0 |
| 3 | 散点违规 0 处（所有旧模式清除） | audit:* 报告 | `ERROR=0 / WARN=0` |
| 4 | AGENTS.md 升版（三端同步） | [AGENTS.md](file:///d:/FinSightV9/AGENTS.md) | 搜索版本号出现三处一致 |
| 5 | Wiki README 升版（架构图+里程碑） | `docs/wiki/README.md` | grep 新里程碑字样存在 |
| 6 | 生产类型检查通过 | `tsc:prod` | 0 error |
| 7 | 架构审计全绿 | `audit:layers` + `audit:db-references` + `audit:acl-consistency` | 0 ERROR 0 WARN |
| 8 | 核心单元测试通过 | `test:unit:quick` 或 `test:p0:core` | 100% PASS |
| 9 | 总结报告（阶段/收益/验证三表） | 最终用户回复 | 三张表均存在且数据匹配 |

> 推广说明：本模板基于 `gateway-facade-refactor`（S 级）、`type-safety-contract`（S 级）、`databridge-migration`（A+ 级，含 LESSONS.md）三个标杆 Skill 提炼，所有新增 A 级以上 Skill 强制采用此 5 段式结构。若 Skill 为特性运行时类（如 feature-window-context-doc），可适当删除 Phase 0/1/3 门面化段落，但**触发条件 §一、前置检查 §二、陷阱教训 §四、完成清单 §五 四段必须保留**。
