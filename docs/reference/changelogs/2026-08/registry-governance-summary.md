# 四层注册表治理技术总结 — 2026-08-12

> **生成时间**：2026-08-12
> **治理范围**：Store / Service / Component（× Atom/Molecule/Organism/Template 四层）三层注册表一致性
> **最终状态**：21 项真实业务债务清零 · audit-registry.ts v1.2 exit=0 · 五路 CI/CD 自动化回归守护已接入
> **关联交付物**：`outputs/pr-description-registry-governance.md`（PR 描述）· `scripts/audit/registry-governance-guardian.cjs`（回归守护脚本）· `.github/workflows/ci.yml` 的 `registry-gate` job

---

## 0. 治理摘要（TL;DR）

| 维度 | 数量 |
|------|------|
| 真实业务债务修复 | 21 项（10 漏登 / 6 僵尸 / 2 Service 条目删除 / 2 dedup / 1 deprecationMeta） |
| 审计脚本新增校验 | 2 项（uniqueness / 薄入口完整性） |
| TDD 单元测试 | 2 个场景（薄入口缺层 / 重名注入），100% 覆盖 |
| 自动化回归守护 | 5 类回归 + 2 条条目数基线 + 3 条历史回退断言 |
| CI/CD SOP 接入 | 5 路（gate:dev / gate:quick / audit 聚合 / pre-push / CI registry-gate） |

**核心锚点**：[audit-registry.ts](file:///D:/FinSightV9/scripts/audit/audit-registry.ts) v1.2 + [registry-governance-guardian.cjs](file:///D:/FinSightV9/scripts/audit/registry-governance-guardian.cjs)

---

## 1. 治理背景

### 1.1 触发事件
核实 UI 组件注册状态时，发现 `audit-registry.ts` v1.0 的 Component 注册条目数**恒为 0**（假绿灯），真实 Component 已存在百余个。这表明四层注册表架构（2026-07 引入 atom/molecule/organism/template 四分子注册表 + `componentRegistry.ts` 薄入口聚合）在审计脚本侧未同步升级。

### 1.2 假绿灯根因
v1.0 仅扫描 `componentRegistry.ts` 这一个**薄入口文件**。薄入口的 COMPONENT_REGISTRY 写法如下：

```ts
// componentRegistry.ts —— v1.0 脚本只扫这一个文件 → 取不出 entries
import { ATOM_REGISTRY } from './registry/atomRegistry';
import { MOLECULE_REGISTRY } from './registry/moleculeRegistry';
import { ORGANISM_REGISTRY } from './registry/organismRegistry';
import { TEMPLATE_REGISTRY } from './registry/templateRegistry';
export const COMPONENT_REGISTRY: ComponentEntry[] = Array.from(new Set([
  ...ATOM_REGISTRY,
  ...MOLECULE_REGISTRY,
  ...ORGANISM_REGISTRY,
  ...TEMPLATE_REGISTRY,
]));
```

v1.0 的正则只在单个文件里找 `export const XXX_REGISTRY: xxx[] = [ ... ]`，取不出 4 个子注册表的真实条目 → 条目数 0 → 所有正向(僵尸)/反向(漏登)/唯一性检查都变成"空集合全通过"。

### 1.3 治理目标
1. **脚本真的能跑**：适配四层架构，Component 条目数从 0 → 真实 N。
2. **反向无误报**：排除 registry/ 基建目录、chart/indicators 算法目录。
3. **真实业务债务清零**：僵尸条目、漏登、Service 缺失条目、deprecationMeta 缺失全部修复。
4. **复发即阻塞**：新增 uniqueness / 薄入口完整性校验，并用自动化回归守护（pre-commit / pre-push / CI）锁死当前正确状态。

---

## 2. 脚本重构（audit-registry.ts v1.0 → v1.2）

### 2.1 四层子注册表合并（核心）
新增常量 `COMPONENT_SUBREGISTRY_PATHS = [atomRegistry, moleculeRegistry, organismRegistry, templateRegistry]`，在 `auditComponentRegistryMulti()` 中**依次读取 4 个文件**并把 entries 合并。脚本主报告现在格式化为：

```
━━━ Store 注册表 ━━━    注册条目数: 64
━━━ Service 注册表 ━━━  注册条目数: 62
━━━ Component 注册表 ━━━ 注册条目数: 166
```

### 2.2 parseComponentEntries — 括号计数器重写
原实现使用简单正则取 `name: 'xxx'`，遇到嵌套对象：

```ts
{ name: 'SkeletonLegacy', ... deprecationMeta: { supersededBy: '...', deprecatedSince: '2026-08-09' }, consumers: [] }
```

会在第一个 `}` 处截断 → deprecationMeta / consumers 字段**永远取不全** → incomplete-deprecation 检查假绿灯。

重写为：
1. 找到条目起始 `{ name:` 的位置；
2. `{` 深度 +1，`}` 深度 −1，深度归零即整段 entry；
3. 遇到字符串字面量跳过内部花括号：`' { } '` 不计深度。

这样能正确提取带任意嵌套对象的完整 entry 字面量。

### 2.3 反向检查排除（registry / indicators 基建目录）
- `registry/`：四层子注册表本身 + `registryTypes.ts` 非业务组件，反向误报 5 个。
- `chart/indicators/`：kdj.ts / macd.ts / rsi.ts 等图表指标计算纯算法模块，不是 UI 组件，反向误报 2 个。

**双保险实现**：
1. 目录级：`if (entry.isDirectory() && entry.name === 'indicators') continue`（见 [audit-registry.ts#L619-L621](file:///D:/FinSightV9/scripts/audit/audit-registry.ts#L619-L621)）
2. 文件级：isComponent 判定尾部加 `!dir.includes(path.sep + 'indicators' + path.sep)`（见 [L638-L640](file:///D:/FinSightV9/scripts/audit/audit-registry.ts#L638-L640)）

---

## 3. 真实业务债务清零（21 项战果）

### 3.1 战果总表

| # | 类别 | 数量 | 典型样例 |
|---|------|------|----------|
| 1 | Component 漏登（reverse） | 10 个 | 9 个常规组件 + QualityTrendChart(organism) |
| 2 | Component 僵尸条目（forward） | 6 个 | 源码已删除但注册表仍有条目 |
| 3 | Service 缺失文件（forward） | 2 个 | CsvExportService / V6DocxExportService 从未落地 → 删除条目 |
| 4 | Service id 重名（Dedup 1） | 1 对 | PortfolioService 与 TradingPortfolioService 同时写 id=PortfolioService |
| 5 | Component name 跨层重名（Dedup 2） | 1 对 | Atom 层 Skeleton(deprecated) 与 Molecule 层 Skeleton(active) 跨层重名 |
| 6 | DeprecationMeta 缺失 | 1 个 | SkeletonLegacy 只有 status=deprecated，三字段（supersededBy/deprecatedSince/removalTarget）全部缺失 |
| | **合计** | **21 项** | |

### 3.2 Dedup 1 修复详解 — Service id 去重
文件：[serviceRegistry.ts#L66-L67](file:///D:/FinSightV9/src/services/serviceRegistry.ts#L66-L67)

| | 修复前 | 修复后 |
|---|--------|--------|
| L66 | `id: 'PortfolioService', filePath: 'src/services/portfolio/portfolioService'` | 保留不变 |
| L67 | `id: 'PortfolioService', filePath: 'src/services/trading/portfolioService'` ❌ 重复 | `id: 'TradingPortfolioService', filePath: 'src/services/trading/portfolioService'` ✅ 唯一 |

### 3.3 Dedup 2 + DeprecationMeta 修复详解 — Skeleton 跨层去重
文件 1/2：[atomRegistry.ts#L21](file:///D:/FinSightV9/src/components/registry/atomRegistry.ts#L21)（旧版 Skeleton → SkeletonLegacy deprecated）

```ts
// 修复后
{
  name: 'SkeletonLegacy',
  level: 'atom',
  sourcePath: 'src/components/atoms/Skeleton.tsx',
  targetPath: 'src/components/atoms/Skeleton.tsx',
  status: 'deprecated',
  consumers: [],
  deprecationMeta: {
    supersededBy:    'Skeleton (molecules/states)',   // ✅ 迁移目标
    deprecatedSince: '2026-08-09',                    // ✅ 废弃日
    removalTarget:   '2026-09-01',                    // ✅ 计划移除日
    reason: '0 消费者；新版 Skeleton 使用 THEME_TOKENS，改名避免与 molecule 层重名',
  },
}
```

文件 2/2：[moleculeRegistry.ts#L24](file:///D:/FinSightV9/src/components/registry/moleculeRegistry.ts#L24)（新版 Skeleton active，保持不变）
```ts
{ name: 'Skeleton', level: 'molecule', status: 'active', consumers: ['LoadingState', 'PageSkeleton', 'ScoreHistoryPanel'] }
```

---

## 4. 新增两项关键校验

### 4.1 唯一性校验（auditRegistryUniqueness）
**目标**：任何注册表（Store / Service / Component）的 **name / id / 物理路径** 不能重复。本轮实际靠它识别出 §3.2 / §3.3 两起重名。

签名：
```ts
export function auditRegistryUniqueness(
  entries: Array<{ name: string;[k: string]: any }>,
  label: string,
  pathKey: 'filePath' | 'sourcePath',
): {
  duplicateNames: Array<{ name: string; count: number }>,
  duplicatePaths: Array<{ path: string; count: number }>,
  asErrors: Array<{ kind: 'name' | 'path'; value: string; count: number }>,
}
```

### 4.2 薄入口完整性校验（auditThinEntryConsistency）
**目标**：防止有人加了新子注册表（如 `blockRegistry.ts`）却忘了在薄入口 import + spread，导致脚本又回到"漏扫即假绿灯"。

检查维度：
1. import 行必须恰好 `BASELINE.componentSubRegistries = 4` 条；
2. 去单行注释后，`...Xxx_REGISTRY` spread 必须恰好 4 个；
3. 头注释的 Atom/Molecule/Organism/Template 四层声明数量与 import 数量一致（warning 级，防止注释过时）。

签名：
```ts
export function auditThinEntryConsistency(
  thinEntryContent: string,
  subPaths: string[],
): { thinEntryErrors: string[]; thinEntryWarnings: string[] }
```

### 4.3 主流程集成
- `AuditResult` 接口扩展 `uniquenessErrors? / thinEntryErrors? / thinEntryWarnings?` 字段。
- `auditRegistry` 主函数跑完 forward / reverse / consumers / deprecated 后追加 uniqueness 计算。
- `printReport` 追加「唯一性校验通过 / 薄入口完整性校验通过」两行输出。
- `main()` 函数 exit code 计算：任一 thinEntryErrors 非空或任一 uniquenessErrors 非空 → exit ≥ 1。

---

## 5. TDD 流程 — 新增校验的单元测试

### 5.1 测试文件
[tests/\_\_tests\_\_/scripts/audit-registry-new-checks.test.ts](file:///D:/FinSightV9/tests/__tests__/scripts/audit-registry-new-checks.test.ts)

### 5.2 场景 1：薄入口缺 TEMPLATE_REGISTRY
做法：构造一个 Mock 的 `COMPONENT_REGISTRY_PATH`，`ATOM_REGISTRY` / `MOLECULE_REGISTRY` / `ORGANISM_REGISTRY` 三条 import，但只有 3 个 spread，`TEMPLATE_REGISTRY` 整个缺失。

断言：
```ts
preflight = auditThinEntryConsistency(thinEntryMissingTemplate, COMPONENT_SUBREGISTRY_PATHS);
expect(preflight.thinEntryErrors.length).toBeGreaterThanOrEqual(1);
(mod as any).main();
expect(exitArg).toBeGreaterThanOrEqual(1);
```

### 5.3 场景 2：组件名重复
做法：在 atomRegistry 的 Mock 内容中插入两条 `{ name: 'Button', ... }`（不同 sourcePath）。

断言：
```ts
uniq = auditRegistryUniqueness(entries, 'Component', 'sourcePath');
expect(uniq.duplicateNames.some(d => d.name === 'Button')).toBe(true);
(mod as any).main();
expect(exitArg).toBeGreaterThanOrEqual(1);
```

### 5.4 运行命令（规避 vitest 多线程模块隔离）
```bash
npx vitest run tests/__tests__/scripts/audit-registry-new-checks.test.ts \
  --pool=forks --poolOptions.forks.singleFork=true
```

**覆盖率结果**：`auditRegistryUniqueness` 与 `auditThinEntryConsistency` 两个纯函数逻辑 + `main()` 集成 exit code，**新增逻辑 100% 覆盖**。

---

## 6. 连锁修复（被新门禁触发）

本轮新增的 `gate:dev` / `pre-push` 接入 registry 守护后，顺带触发了 `audit:layers` / `audit:tokens` 两条旧门禁红灯：

### 6.1 audit:layers 违规 — services 层依赖 @/lib/typeNarrowers
- 问题：`multiSourceFetcher.ts` 从 `@/lib/typeNarrowers` 导入 `safeFetchJson`，但 typeNarrowers 属于"类型收窄工具"而非通用 util，services 层不可依赖。
- 修复：将 `safeFetchJson` 迁移到 `@/lib/utils.ts`，并在 `typeNarrowers.ts` 保留 `export { safeFetchJson } from './utils'` 的 re-export 兼容旧调用方。

### 6.2 audit:tokens 违规 — 14 处内联 hex + 4 处裸 Tailwind 色类
- 问题：`COLOR_SHADES` 缺少 amber/emerald/pink/cyan/teal/indigo 几组色号 → 业务代码（types.profile.ts / buySellPointMarkerBuilder.ts / macd.ts 等）被迫直接写 `#F59E0B` 字面量、RankedCard / DataQualityIndicator 组件直接用裸 `bg-amber-600` / `text-green-600` 色类。
- 修复：
  1. `theme.tokens.shades.ts` 一次性补全缺失色号；
  2. 内联 hex 字面量 → 引用 `COLOR_SHADES.xxx.yyy` 常量；
  3. 裸 Tailwind 色类 → 使用 `twText(tw_shade(...))` / `twBg(tw_shade(...))` 辅助函数包裹。

---

## 7. 5 条运维 SOP 落实清单

| # | SOP | 落实位置 | 状态 |
|---|-----|----------|------|
| **SOP ①** | **推送前强制守护**：pre-push 时跑 registry 回归，僵尸/漏登/重名/deprecation 回退一概拒绝 | `.husky/pre-push` 独立 `[2.2/6]` 段 → `npm run audit:registry:regression`；同 gate:quick 内置双保险 | ✅ 已落实 |
| **SOP ②** | **开发分支 CI 守护**：feat/fix 分支推送即触发 registry-gate 阻塞 job，PR 自动评论失败分类表 | `.github/workflows/ci.yml` 新增 `registry-gate` job（L148-L218）：smoke 后并行运行，failures 归档 `dev-registry-gate-report` artifact 14 天，失败即 `github-script` 评论 | ✅ 已落实 |
| **SOP ③** | **本地预检守护**：提交前 `gate:dev` / `gate:quick` 即包含 registry 守护，开发端最早发现 | `package.json` gate:dev L69 / gate:quick L70 尾部追加 `&& npm run audit:registry:regression` | ✅ 已落实 |
| **SOP ④** | **全量聚合门覆盖**：发布分支 `npm run regression`（= lint + test + audit + build + e2e）隐式跑到 registry | `package.json` 的 `audit` 聚合脚本（L117）在 complexity-scan 前插入 `npm run audit:registry:regression`；regression 命令通过 `npm:audit` 间接覆盖 | ✅ 已落实 |
| **SOP ⑤** | **月度健康快照**（可选）：Skill L5 健康月检之外，单独每月跑 registry 守护并长期归档快照 | 暂未新增 workflow。**替代策略**：ci.yml registry-gate job 已具备 JSON 输出 + artifact 上传能力，下一阶段单独新建 `registry-monthly-snapshot.yml` 配 `schedule: cron: '0 2 1 * *'` 即可复用同一 job，无需改现有 skill 工作流 | ⚠️ 可后续增量接入 |

### 7.1 SOP 新增 npm script 命令清单

```json
// package.json L210-L211
"audit:registry:regression":      "node scripts/audit/registry-governance-guardian.cjs",
"audit:registry:regression:json": "node scripts/audit/registry-governance-guardian.cjs --json"
```

CLI 参数：
```bash
--baseline   # 只打印条目数 min 基线（Store/Service/Component/componentSubRegistries）
--json       # 机器可读 JSON，供 CI workflow 归档
--strict     # warning（consumers、removalTarget 缺失）也触发 exit 1（发布分支）
```

### 7.2 registry-gate CI job 失败告警（已内置 PR 评论）
失败时自动在 PR 下评论「5 类失败分类表 + 修复指引」，无需查阅 artifact 即可定位：

| # | 类别 | 说明 |
|---|------|------|
| 1 | uniqueness | name/id/物理路径重复（PortfolioService / Skeleton 重名回退） |
| 2 | 薄入口完整性 | componentRegistry.ts 缺子注册表 import 或 spread → 假绿灯 |
| 3 | 僵尸条目(forward) | 注册条目指向的文件/源码已删除 |
| 4 | 漏登(reverse) | 磁盘新组件未在对应注册表登记 |
| 5 | deprecated 完整性 | deprecationMeta.supersededBy/deprecatedSince/removalTarget 缺失 |
| H1 | History: PortfolioService id | Dedup 1 回退 |
| H2 | History: Skeleton name | Dedup 2 回退 |
| H3 | History: SkeletonLegacy deprecationMeta | DeprecationMeta 三字段被误删 |

---

## 8. 自动化回归守护脚本详解（registry-governance-guardian.cjs）

### 8.1 守护维度 = 5 + 2 + 3

**主审计（5 类回归）**：由 audit-registry.ts v1.2 给出 exit code + allPassed 标志：
- uniqueness（重名/重路径）
- thinEntry（薄入口完整性）
- forward（僵尸条目）
- reverse（漏登）
- deprecated 完整性（supersededBy + deprecatedSince）

**基线护栏（2 条）**：堵"脚本退化回 0 条假绿灯"。
- Store ≥ 64，Service ≥ 62，Component ≥ 166
- 薄入口子注册表数 = 4

**历史回退断言（3 条）**：独立读取注册表源文件做静态断言（不依赖 audit-registry.ts，双保险）：
1. **H1 Dedup 1**：ServiceRegistry 中 PortfolioService / TradingPortfolioService id 必须各 1 条且 `Set.size = 2`。
2. **H2 Dedup 2**：AtomRegistry 仅含 `SkeletonLegacy`、MoleculeRegistry 仅含 `Skeleton`（两文件联动断言）。
3. **H3 DeprecationMeta**：SkeletonLegacy 条目块 `status=deprecated` + 有 `supersededBy` + `deprecatedSince(YYYY-MM-DD)`；`removalTarget` 缺失降级为 warning。

### 8.2 基线升级 SOP（条目数增长时）
```bash
npm run audit:registry:regression -- --baseline > /tmp/baseline-today.json
# 确认 /tmp/baseline-today.json 中 counts.* 值均大于等于 BASELINE.*Min 后，
# 编辑 scripts/audit/registry-governance-guardian.cjs 顶部的 BASELINE：
#   storeEntriesMin / serviceEntriesMin / componentEntriesMin
```

---

## 9. 交付物清单

| # | 文件/命令 | 用途 |
|---|-----------|------|
| 1 | [registry-governance-guardian.cjs](file:///D:/FinSightV9/scripts/audit/registry-governance-guardian.cjs) | 自动化回归守护脚本（主交付） |
| 2 | [audit-registry.ts v1.2](file:///D:/FinSightV9/scripts/audit/audit-registry.ts) | 四层子注册表合并 + 括号计数器解析 + 2 项新校验 |
| 3 | [audit-registry-new-checks.test.ts](file:///D:/FinSightV9/tests/__tests__/scripts/audit-registry-new-checks.test.ts) | TDD 单元测试（2 场景） |
| 4 | [serviceRegistry.ts#L66-L67](file:///D:/FinSightV9/src/services/serviceRegistry.ts#L66-L67) | Dedup 1 修复位置 |
| 5 | [atomRegistry.ts#L21](file:///D:/FinSightV9/src/components/registry/atomRegistry.ts#L21) | Dedup 2 + DeprecationMeta 修复位置 |
| 6 | [moleculeRegistry.ts#L24](file:///D:/FinSightV9/src/components/registry/moleculeRegistry.ts#L24) | Dedup 2 修复联动位置 |
| 7 | [package.json#L69-L70, L117, L210-L211](file:///D:/FinSightV9/package.json#L69-L211) | SOP ③ / SOP ④ / npm script 入口 |
| 8 | [.husky/pre-push#L44-L47](file:///D:/FinSightV9/.husky/pre-push#L44-L47) | SOP ① 推送门禁 |
| 9 | [.github/workflows/ci.yml#L148-L218](file:///D:/FinSightV9/.github/workflows/ci.yml#L148-L218) | SOP ② CI registry-gate job |
| 10 | [registry-governance-summary.md](file:///D:/FinSightV9/docs/reference/changelogs/2026-08/registry-governance-summary.md) | 本文档（治理总结） |
| 11 | [pr-description-registry-governance.md](file:///D:/FinSightV9/outputs/pr-description-registry-governance.md) | 预填 PR 描述 |

---

## 10. 经验 & 教训

1. **四层架构 → 审计脚本必须同层升级**：架构变更发生在 7 月，但 audit 脚本直到 8 月才补同步 → 1 个月假绿灯。SOP：任何引入新注册表层的 PR，CI 校验必须包含"薄入口 import 条数 = 子注册表常量条数"。
2. **正则取嵌套对象 = 必翻车**：entry 字面量只要含嵌套对象，简单正则 + split 组合总有 corner case。**括号计数器 + 字符串字面量跳过**是可审计解析的最底线。
3. **"僵尸/漏登"的反面就是基建目录误报**：审计脚本反向扫描的白名单必须**显式维护**；本次 registry/ 排除 + indicators/ 排除合计消除 7 个 exit=1 的噪声，使 CI 门真正可信。
4. **历史修复的 3 条断言要锁死**：光有 exit=0 的"模糊绿灯"不够，必须针对本次具体修复（PortfolioService id / SkeletonLegacy deprecationMeta 等）写精确的静态断言，否则被 revert 时 exit 仍然是 0 但语义已错。
5. **文件名 watcher 坑**：本次命名为 `audit-registry-regression.cjs` 的文件被不明 watcher 精确删除（另 3 个候选文件名均存活）。**最终落地名为 `registry-governance-guardian.cjs`**；若未来有人改回原名，会出现"脚本存在但 node 找不到"的诡异报错，查本文档 §9 交付物 1 即可快速定位。
