# V9-TS-004 Batch 4 精细化治理计划
> **治理对象**：`enhancer.ts` 2 处非空断言（!）+ 全局 `@typescript-eslint/strict-boolean-expressions` 822 warn 遗留规范
> **版本**：v1.0 · 2026-07-24
> **项目经理**：V9 类型安全治理小组
> **预计工期**：24 人·小时（3 人·日），分 3 阶段 5 个工作日

---

## 1. 问题定位（现状基线）

### 1.1 enhancer.ts 2 处非空断言上下文

| # | 文件 | 行号 | 代码模式 | 风险等级 | 现有守卫 | 运行时是否安全 |
|---|------|------|----------|----------|----------|----------------|
| 1 | [enhancer.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/enhancer.ts#L137-L143) | L140 | `enhanced.score!.toFixed(2)` | 中（仅日志字符串） | `scoreChanged = typeof enhanced.score === 'number' && Math.abs(...) > 0.001` 组合判断，但 TS 控制流未窄化 | 逻辑语义上安全，但依赖人工阅读证明 |
| 2 | [enhancer.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/enhancer.ts#L251-L259) | L256 | `chat(messages, this.llmConfig!)` | 低（前置 3 层守卫） | ① `isEnabled(): this.enabled && this.llmConfig !== null` ② `if (!this.llmConfig) return baseResult` ③ caller 侧 `if (!this.isEnabled()) return baseResult` | 三重守卫下理论上**100% 安全**，仅 TS 窄化无法跨方法识别 |

### 1.2 strict-boolean-expressions 全局现状（822 warn）

**当前 eslint 配置**：`@typescript-eslint/strict-boolean-expressions': 'warn'`（允许在 if/&&/||/三元等布尔上下文使用字符串、数字、对象等 truthy 值，不报错）

**按位置分类的 warn 分布（抽样扫描）**：

| 代码位置 | 预估占比 | 典型数量 | 风险等级 | 说明 |
|----------|---------|---------|---------|------|
| `if (str)` / `if (obj)` 可选属性 | 42% | ≈345 处 | 中高 | 字符串空串/对象 null/undefined 在布尔上下文中被隐式转换，易产生 `null`/`''`/`0` 语义混淆 |
| `if (num)` / `if (arr.length)` 数字与长度 | 28% | ≈230 处 | 高 | `0` 合法值 vs 0 空判断混淆；`length` 可能是 undefined 未判断类型 |
| `val && foo` 短路/ `x ? a : b` 三元 | 18% | ≈148 处 | 中 | 复杂表达式中隐式 falsy 变化导致分支逻辑改变 |
| `const x = y || default` 默认值 | 7% | ≈58 处 | 中 | 0/空串等 falsy 合法值被错误 fallback（应使用 `??`） |
| 其他：循环条件/函数参数守卫 | 5% | ≈41 处 | 低 | 杂项分散，需个别处理 |
| **合计** | **100%** | **≈822** | — | 来源：scripts_tmp_lint_errors.cjs 2026-07-24 扫描 1303 文件 |

---

## 2. 技术方案

### 2.1 enhancer.ts 2 处非空断言：最小侵入式替代 + 类型可验证窄化

#### 方案 A1（推荐）：局部 const 窄化 + 显式 `typeof` 守卫（保留语义）

**修复 #1：L140 `enhanced.score!.toFixed(2)`**

```typescript
// 修复前
logger.warn(
  `[LLMScoreEnhancer] 层 ${calculator.layerId} 引证闸激活：` +
    `LLM 建议评分 ${enhanced.score!.toFixed(2)} 但未提供引用来源，已回退到规则评分 ${baseResult.score.toFixed(2)}`,
);

// 修复后（新增局部变量窄化，TypeScript 自动推断 number）
const adjustedScore = typeof enhanced.score === 'number' ? enhanced.score : baseResult.score
logger.warn(
  `[LLMScoreEnhancer] 层 ${calculator.layerId} 引证闸激活：` +
    `LLM 建议评分 ${adjustedScore.toFixed(2)} 但未提供引用来源，已回退到规则评分 ${baseResult.score.toFixed(2)}`,
);
```

**收益**：
- 完全消除非空断言
- 新增 fallback 分支（极端异常下 score 被删除），日志不会 NPE
- TS 类型收窄为 `number`，无需断言

#### 修复 #2：L256 `this.llmConfig!`

```typescript
// 修复前（chat 调用）
const response = await chat(messages, this.llmConfig!)

// 修复后（局部窄化 + 显式 isEnabled 语义守卫 + 回退返回）
if (!this.isEnabled() || !this.llmConfig) {
  // 理论不可达；保留回退保证 TS 路径完备
  return { citations: [] }
}
const llmConfig = this.llmConfig  // TS 已窄化为 LlmConfig（非 null）
const response = await chat(messages, llmConfig)
```

**收益**：
- 保持 3 层守卫语义一致性，新增代码路径显式化
- `llmConfig` 局部常量控制流收窄为非 null，不再需要 `!`
- 与调用方 `enhance()` 的早期返回语义对齐

#### 方案 A2（备选）：`@ts-expect-error` 保留断言 + 原因注释

仅在 A1 验证导致代码膨胀（>20 行改动/处）且运行时性能敏感时使用，但**不推荐**（违背 "零 `!` 断言" 治理目标）。

### 2.2 strict-boolean-expressions：6 类标准化修复模式（覆盖 100% 场景）

| 分类 | 原始代码（warn） | 标准化修复模式 | 备注 |
|------|-----------------|----------------|------|
| **可选字符串** | `if (user.name) ...` | `if (user.name != null && user.name.length > 0) ...` 或 `if ((user.name ?? '').trim() !== '')` | 区分"未提供"与"空串"语义 |
| **可选对象** | `if (result.payload) ...` | `if (result.payload != null && typeof result.payload === 'object') ...` | 避免数组/对象/字符串类型错判 |
| **数组长度** | `if (items.length) ...` | `if (Array.isArray(items) && items.length > 0) ...` | 防止 items 为 `null` 时抛 TypeError |
| **数字判断**  | `if (score) ...` | `if (score != null && typeof score === 'number' && !Number.isNaN(score)) ...` | 区分 `0`（合法值）与缺失；评分 0 是合法结果 |
| **短路默认值** | `const x = y || z` | `const x = y ?? z` 或 `const x = (y ?? 0) !== 0 ? y : z` | 仅在确定 `0`/`''` 非合法值时用 `??`，否则保留显式判断 |
| **三元/条件** | `flag ? a() : b()` 其中 `flag: string \| null` | `(flag != null && flag !== '') ? a() : b()` | 显式列出 falsy 语义分支 |

**批量修复辅助脚本策略**：
```
scripts/fix/ 目录下新增：
  ├─ fix-sbe-string.ts    # 模式 1：字符串长度守卫
  ├─ fix-sbe-array.ts     # 模式 3：Array.isArray + length > 0
  ├─ fix-sbe-num.ts       # 模式 4：typeof number + !NaN 守卫
  ├─ fix-sbe-defaults.ts  # 模式 5：|| → ?? 替换（需 dry-run）
  └─ sbe-audit.ts         # 分类统计 + 进度看板
```
**注意**：模式 5（`||`→`??`）必须 **dry-run + 人工 review**，因为大量 `||` 是历史依赖 falsy 语义，批量改为 `??` 会导致 `0/''` 不再回退，产生逻辑 bug。

---

## 3. 实施步骤（5 工作日）

### Phase 0：准备日（W1-D1，4 小时）
| 步骤 | 内容 | 产出 |
|------|------|------|
| P0-1 | 运行 `npm run lint` 产出 **822 条 strict-boolean-expressions warn 全清单**（JSON） | `outputs/sbe-warn-baseline.json` + 进度看板 0/822 |
| P0-2 | **修复 enhancer.ts 2 处非空断言**（方案 A1）+ 单元测试补 2 用例 | enhancer.ts 2 ! 清零；PR #V9-401 |
| P0-3 | 按 6 类修复模式编写 **4 个批量修复脚本**，在 5 个样例文件试跑 dry-run | `scripts/fix/fix-sbe-*.ts` |
| P0-4 | 风险评审：标注模式 5（`||`→`??`）需人工 review 的 200 处 | SRE flag 清单 |

### Phase 1：P0 核心模块治理（W1-D2~D3，8h）—— 目标 300/822 已修复
| 模块 | 数量 | 修复模式 | 修复责任人 | 验证方式 |
|------|------|---------|-----------|---------|
| 评分引擎 v6-engine（含 enhancer 周边） | ≈85 | 字符串/数字/数组 | 类型安全组 A | `vitest run src/services/scoring` |
| 数据采集 data-collector | ≈95 | 数组长度/数字 | 类型安全组 A | vitest data-collector.test.ts + tsc:prod |
| MCP 服务（trading/analysis/bridge 等） | ≈70 | 对象/字符串/可选 | 类型安全组 B | vitest mcp/__tests__ |
| core/ 核心模块（databridge/pipeline 等） | ≈50 | 全部 6 类 | 类型安全组 B | tsc:prod + core 全量测试 |
| **Phase 1 小计** | **≈300** | | | **进度 300/822 = 36.5%** |

### Phase 2：P1 通用模块治理（W1-D4，8h）—— 目标 722/822
| 模块 | 数量 | 修复模式 | 验证 |
|------|------|---------|------|
| services/ 通用服务（profile/skill/output/lifecycle 等） | ≈180 | 数字/默认值/数组 | vitest services 全量 |
| store/ 所有 Zustand stores（46 文件） | ≈125 | 可选属性/数组 | store 单测 46× + tsc:prod |
| components/atoms + widgets（84 组件） | ≈117 | 对象/字符串/短路 | ESLint 0 err + TS 0 err |
| hooks/ + lib/ + config/ 工具与配置 | ≈60 | 数字/默认值 | utils 全量单测 |
| **Phase 2 小计** | **≈482** | | | **进度 782/822 = 95.1%** |

### Phase 3：P2 页面 + 模式 5 Review（W1-D5，4h）—— 目标 822/822（100%）
| 步骤 | 内容 |
|------|------|
| P3-1 | 修复 pages/ + apps/ + cockpit/ UI 层剩余 ≈40 处 warn |
| P3-2 | 2 人交叉 review 模式 5（`||`→`??`）已修改的 200 处，回滚 15-20% 不应改的 falsy 依赖 |
| P3-3 | 剩余 10-20 个复杂语义处保留 `// eslint-disable-next-line strict-boolean-expressions -- 语义保留：XXX`（需注释说明） |
| P3-4 | 最终门禁：ESLint（`strict-boolean-expressions` 升级为 error）+ tsc:prod + vitest 全量 |
| **Phase 3 完成** | **进度 822/822 = 100%** ✅ 规则升级为 error |

### 交付清单（W1-D5 End of Day）
1. `enhancer.ts` 非空断言 0/2 完成 → 代码 PR + 测试用例补充
2. `strict-boolean-expressions` 822 warn → 0 error（规则 warn→error 升级 PR）
3. `docs/reports/sbe-fix-progress.csv` 每模块进度看板
4. `docs/how-to/sbe-patterns.md` 开发手册（6 类标准化模式速查）
5. 治理报告：回归测试结果（Vitest 106/106+，tsc:prod 0 error）

---

## 4. 风险评估

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| **语义回归：`if (num)` 本来依赖 `0` falsy 含义，被模式 4 改为 `!==NaN != null` 后 `0` 判断进入 true 分支产生业务错误** | 中（30%） | 高（评分/下单逻辑 0 值语义关键） | Phase 2-3 模式 4（数字）必须人工 review 清单；对 `score/quantity/price/pct` 等关键字段 100% 人工校对 |
| **`||` → `??` 不当替换导致默认值不再生效** | 高（40%） | 中（UI 显示异常、空串/0 替代默认值） | 模式 5 先 dry-run 输出变更，再 review 分 3 类：应改/不应改/改后补测试；必须先跑截图对比 |
| **批量替换破坏 JSX 结构**（if/三元在 JSX 中） | 低（5%） | 中（组件渲染崩溃） | `components/` 与 `pages/` 不跑脚本，全部手动修复；每 20 组件跑 Playwright 可视化回归 |
| **TS 类型收窄过度导致编译错误**（加了 `Array.isArray/typeof` 后下游变量使用冲突） | 中（25%） | 低（编译期即可发现，立即 tsc 修复） | 每 100 处批量替换 → `tsc:prod` 跑一遍 → 不超过 5 错误；>5 暂停，调整脚本 |
| **工期/进度偏差**（实际需要 7-10 人日，超预算） | 中（20%） | 低 | 规则升级可分阶段：P0 先升级 P1 P2 可延后 1 周，仅核心模块设为 error 其余 warn 渐进升级 |

**综合风险等级**：**中**（仅语义回归风险 1 项高影响，其余可通过 review + tsc 全量验证在编译期拦截）

**风险预留**：额外 4 人·小时（1/6 总工期）作为模式 5 re-review + TSC 类型修复缓冲。

---

## 5. 验收标准

### 5.1 功能与代码质量门禁（必须全部通过）

| 序号 | 验收项 | 验收标准 | 验证命令 |
|------|-------|---------|---------|
| A1 | **enhancer.ts 非空断言 0** | grep `enhancer.ts` / \`!\` 非 `!==/!=/!!/!!=/: ` 模式匹配为 0 | `rg -n '\w!\.|\w!$' src/services/scoring/v6-engine/enhancer.ts \| grep -v '!=' \| wc -l` → 0 |
| A2 | **strict-boolean-expressions 全仓 0 warn** | 该规则从 warn → error，且 ESLint 全仓 0 errors | `npm run lint \| Select-String "strict-boolean-expressions" \| Measure-Object -Line` → 0 |
| A3 | **ESLint 全仓 0 error** | `@typescript-eslint/*` + custom rules 全部 0 | `scripts/audit/run-lint-final.cjs` errorCount = 0 |
| A4 | **TypeScript 生产类型检查 0 error** | `tsc:prod` 在 tsconfig.prod.json 下 0 错误 | `npm run tsc:prod` → 0 error, 0 warning 中不含 blocking |
| A5 | **Vitest 单测 100% 通过（本批次未修改模块）** | 受影响模块（评分引擎/数据采集/MCP 等）单测通过率 100%，总体不低于当前基线 99.8% | `vitest run` → ≥ 8391/8432 passed（与项目基线持平） |

### 5.2 文档与可追溯性验收

| 序号 | 文档 | 标准 |
|------|------|------|
| B1 | 每类修复模式样例手册 | `docs/how-to/sbe-patterns.md` 存在，6 类模式均有"前/后/语义差异"三栏说明 |
| B2 | 进度看板与基线快照 | `outputs/sbe-warn-baseline.json` 保存 Day 0；最终 `sbe-warn-zero.json` 保存 0 warn 快照 |
| B3 | 复杂保留项清单 | 所有 `eslint-disable-next-line strict-boolean-expressions` 必须附注释说明保留原因；总数 ≤ 20 且编号登记 |
| B4 | 风险评估与 review 记录 | Phase 2-3 Review checklist 存档，2 人签字确认 |

### 5.3 量化收益指标（达到 2/3 即达标）

| 指标 | 基线（治理前） | 目标（治理后） | 测量方法 |
|------|--------------|--------------|---------|
| C1：类型访问违规（no-unsafe + 非空 + SBE） | 934 warn/error（112 + 2 + 822） | **≤ 20**（保留项） | scripts_tmp_lint_errors.cjs 全仓扫描 |
| C2：TS 编译时长 | ~180s | ≤ ~200s（不显著退化） | `time npm run tsc:prod` × 3 次取平均 |
| C3：Vitest 测试时间 | ~411s | ≤ ~450s | `time vitest run` |
| C4：SonarQube / 代码复杂度 Mainainability | 当前 Rating B | ≥ A- | Sonar 扫描 Rating |
| **通过条件** | — | **C1 + (C2 ∨ C3) + C4 任一** | — |

---

## 6. 附录：关键参考链接

- **规则官方文档**：`@typescript-eslint/strict-boolean-expressions`
  - https://typescript-eslint.io/rules/strict-boolean-expressions/
- **enhancer.ts 源码位置**：[enhancer.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/enhancer.ts)
- **ESLint 配置（待升级 L69）**：[eslint.config.js](file:///d:/FinSightV9/eslint.config.js#L68-L70)
- **V9-TS-004 结项总结报告（对应项目主文档）**：[V9-TS-004 结项总结报告.md](file:///d:/FinSightV9/docs/reports/V9-TS-004-结项总结报告.md)
