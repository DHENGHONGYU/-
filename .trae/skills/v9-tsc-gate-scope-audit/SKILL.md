---
skill_id: V9-SKILL-TSC-GATE-SCOPE
name: v9-tsc-gate-scope-audit
version: v1.0.0
last_updated: 2026-07-25
category: code-quality
tags: [tsc, gate, scope, typescript, pre-commit, husky, project:finsightv9]
title: "tsc 门禁误锁诊断与修复（测试文件越权扫描）"
description: "当 husky pre-commit 的 tsc:prod（或 npm run build / npm run dev 的类型检查）报错阻塞提交，但错误全部位于 *.test.ts / *.test-utils.ts 等测试文件，或位于工作树未跟踪/其他工作流生成的测试文件时，诊断是否为 tsconfig 作用域误配（production 类型检查越权扫描了测试），并给出无需 --no-verify 的合规修复：新建 tsconfig.prod.json 排除测试、将 tsc:prod 脚本指向它，同时保留 tsconfig.json 供编辑器全量检查、tsc:test 单独查测试。基于 2026-07-22 V9 tsc:prod 红灯（106 错误、0 在源码）实战提炼。"
agent_created: true
triggers:
  keywords: [tsc:prod 报错, tsc 门禁误锁, pre-commit tsc 失败, 类型检查全在测试文件, husky tsc 阻塞, tsconfig 范围过大, production 类型检查包含测试, build 被类型错误阻塞, 测试类型错误阻塞提交, gate 假红, 类型门禁误报, tsc 红灯, 未跟踪文件堆积, 工作树脏数据, 测试类型债务, 测试文件遗留债, 门禁作用域检查]
  files: ["tsconfig.json", "tsconfig.prod.json", "tsconfig.test.json", "package.json", ".gitignore", ".husky/pre-commit"]
  events: [tsc-gate-red, pre-commit-blocked, build-type-error]
gates: ["运行 tsc:prod 将原错误按 测试文件 / 非测试源码 分类，产出 file:line 证据", "对每个错误文件 git status --short 区分 untracked / modified / clean@HEAD 三种来源", "修复后 npm run tsc:prod（指向 tsconfig.prod.json）实测 0 错误并确认 vite build 不再被类型检查阻塞", "git status untracked 审计：扫描未跟踪测试文件（期望 0）及非测试生成物（期望白名单）"]
mandatory: false
covers_docs: ["AGENTS.md", "outputs/tsc-prod-attribution-report.md", "outputs/tsc-prod-remediation-plan.md"]
related_skills: [v9-bash-conventions, v9-tsc-test-error-diagnosis]
freshness_policy:
  review_cycle: quarterly
  trigger_events: [tsc-gate-red, pre-commit-blocked, build-type-error, tsconfig-change]
search_priority: high
search_keywords: [tsc门禁, tsc:prod报错, 类型检查阻塞, pre-commit失败, tsconfig作用域, 测试文件扫描, 门禁假红]
---

# tsc 门禁误锁诊断与修复（tsc-gate-scope-audit）

> **核心铁律：类型门禁报错 ≠ 你的代码坏了。先分类、先归因，再决定修门禁还是修代码。**
> 门禁全红可能是「production 类型检查越权扫描了测试文件」——这是配置作用域缺陷，不是业务缺陷。
> **绝不因门禁假红而 `--no-verify`。** 合规修复是「收窄门禁作用域」，不是绕过门禁。

---

## 〇、触发判定（何时加载本 skill）

满足任一即触发：
1. `husky` pre-commit 第 3 道门禁 `npm run tsc:prod` 失败，阻塞 `git commit`。
2. `npm run build` 在 `prebuild` 阶段被 `tsc:prod` 阻塞（`package.json` 中 `prebuild: "npm run generate:tokens && npm run tsc:prod"`）。
3. `npm run dev` 被 `predev: "tsc --noEmit"` 阻塞。
4. 错误输出里反复出现 `*.test.ts` / `*.test-utils.ts` / `*.spec.ts` 路径。

**不触发**：错误文件全是 `src/**` 非测试源码 → 那是真 prod 缺陷，直接修代码（可配合 `module-sync-checklist`）。

---

## 一、根因模型（为什么会假红）

本项目典型配置：
- `tsconfig.json`（`include: ["src/**/*"]`，**无测试排除**）同时承担两个职责：
  - 编辑器默认配置（希望全量检查，含测试）；
  - `tsc:prod` 脚本（`tsc -p tsconfig.json --noEmit`）的入参 → 即「生产类型检查」实际扫了测试。
- 而 `vite build` 本身**根本不类型检查测试文件**。
- 于是：`tsc:prod` 比真实产物更严，且把工作树里**未跟踪**的测试生成物一并扫进来 → 门禁假红，且**任何提交都会被拦**。

> 作用域不匹配 = 门禁检查的东西 ≠ 实际要交付的东西。

---

## 二、诊断三步法（必须产出 file:line 证据，禁止凭摘要下结论）

### Step 1 — 抓全量错误
```bash
cd L:/FinSightV9
npx tsc -p tsconfig.json --noEmit > /tmp/tsc.log 2>&1; echo "EXIT=$?"
grep -c "error TS" /tmp/tsc.log
```

### Step 2 — 按文件类型分类（核心判定）
```bash
# 测试文件中的错误数（.test. / .test-utils. / .spec.）
grep "error TS" /tmp/tsc.log | grep -E "\.(test|test-utils|spec)\.(ts|tsx)\(" | wc -l
# 非测试 src 源码中的错误数
grep "error TS" /tmp/tsc.log | grep -E "^src/" | grep -vE "\.(test|test-utils|spec)\.(ts|tsx)\(" | wc -l
```

**判定阈值**：
- 非测试 src = **0** 且错误几乎全在测试 → **作用域误配（本 skill 场景）**，不要 --no-verify，去修门禁。
- 非测试 src > 0 → **真 prod 缺陷**，去修源码。

### Step 3 — git 归因（区分「我的改动」vs「历史/生成物」）
```bash
for f in $(grep -oE "^src/[^(]+" /tmp/tsc.log | sort -u); do
  st=$(git -c core.quotepath=false status --short -- "$f" | awk '{print $1}')
  printf "%-4s %s\n" "${st:-HEAD}" "$f"
done | sort
```
输出 `??`=未跟踪（其他工作流生成、从未提交）、`M`=工作树已改、`HEAD`=干净（真正预存债）。
- 若绝大多数是 `??` → 主因是**工作树堆积的类型不通过测试文件**，被越权门禁一并拦下，与 HEAD 历史债无关。
- 仅个别 `HEAD` → 才是真预存，按 AGENTS.md 评估是否需 `--no-verify` 提交（本项目约定**不得擅自 --no-verify**）。

> 本 skill 的实战基线（2026-07-22）：106 错误 / 0 在源码；其中 79 未跟踪、26 已改、仅 1 干净@HEAD。

---

## 三、合规修复（无需 --no-verify）

### 3.1 新建 `tsconfig.prod.json`（已验证模板，实测 0 错误）
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "types": ["vite/client"] },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules", "dist",
    "src/**/*.test.ts", "src/**/*.test.tsx",
    "src/**/*.test-utils.ts", "src/**/*.test-utils.tsx",
    "src/**/*.spec.ts", "src/**/*.spec.tsx",
    "src/**/__tests__/**", "src/**/*.stories.tsx"
  ]
}
```
> 排除 `vitest/globals` 类型：prod 源码不应依赖测试全局（describe/it）；若误用会在此暴露。

### 3.2 将门禁脚本指向它（`package.json`）
```diff
- "tsc:prod": "tsc -p tsconfig.json --noEmit",
+ "tsc:prod": "tsc -p tsconfig.prod.json --noEmit",
```
可选（让 `build`/`dev` 也不被测试类型错误阻塞）：
```diff
- "prebuild": "npm run generate:tokens && npm run tsc:prod",
+ "prebuild": "npm run generate:tokens && npm run tsc:prod",
  （tsc:prod 已指向 prod 配置，prebuild 自动受益）
- "predev": "tsc --noEmit",
+ "predev": "tsc -p tsconfig.prod.json --noEmit",
```

### 3.3 实测验收
```bash
npx tsc -p tsconfig.prod.json --noEmit; echo "EXIT=$?"   # 必须 0
npm run build                                       # 确认不再被类型检查阻塞
```
> 受管 Node 22 的 tsx 有段错误风险；tsc 本身不受影响。若用脚本驱动，优先 `C:/Program Files/nodejs/node.exe ./node_modules/typescript/bin/tsc`。

### 3.4 不要丢测试类型安全
`tsconfig.json`（含测试）保留给编辑器全量检查；`tsc:test`（`tsconfig.test.json`）保留给测试。
把 `tsc:test` 接入 **CI / 一个 warn 级 husky 步骤**，待 3.2 修复测试类型错误后升级为阻断门禁，避免类型安全静默流失。

---

## 四、预防（下次二次开发避坑）

1. **门禁作用域必须镜像构建现实**：production 类型门禁排除测试；测试类型门禁单独存在。新增任何 tsconfig 驱动的门禁前先问「vite/真实构建到底查什么」，让门禁与之对齐。
2. **工作树禁止堆积未跟踪 `*.test.ts`**：宽 `tsconfig.json` 会一并扫入。要么随改动类型清洁地提交，要么 `gitignore`。定期 `git status --short | grep '??.*\.test\.'` 清账。
3. **改 tsconfig / package.json 的 tsc 脚本 / husky 门禁时，必跑本 skill 三步法 + 实测 0 错误**，并同步更新 `tsconfig.prod.json`（若存在）。
4. **类型门禁假红时，第一反应是「分类+归因」，不是 `--no-verify`**。合规路径永远存在：收窄作用域即可，无需绕过。

---

## 五、与其他 skill 的边界

- 错误在**非测试源码** → 真缺陷，走 `module-sync-checklist`（交付前十域同步）。
- 报错涉及 **DataBridge/ACL/Mock 漂移** → 走 `data-flow-integrity-audit` / `mock-data-diagnosis`。
- 本 skill 只负责「类型门禁作用域误配」这一类假红的诊断与收窄修复。

---

## 六、未跟踪生成物治理（2026-07-22 新增）

> 门禁作用域修正确保 `tsc:prod` 不再误扫测试文件，但仅解决 Phase 1 的阻塞。
> **Phase 2 转移债务（测试类型静默流失 + 非测试生成物堆积）需单独治理。**

### 6.1 两阶段债务放大回忆

```
Phase 1 — 原始问题（宽 tsconfig + 未跟踪测试文件 → gate 假红 → 全量阻塞）
         → 已通过 tsconfig.prod.json + 门禁作用域收窄修复

Phase 2 — 转移债务（tsc:prod 排除测试后，测试类型错误成为静默累积；
          非测试生成物未 gitignore → 工作树脏数据堆积）
         → 本 § 治理
```

### 6.2 工件分类框架

| 类型 | 示例 | 策略 |
|---|---|---|
| 一次性生成目录 | `cache/`, `_ref-*/`, `.workbuddy/tmp/` | 追加 `.gitignore` |
| 一次性修复脚本 | `*restore*.py`, `parse_coverage.py`（条件性） | 若不复用：追加 `.gitignore`；若通用：提交到 `scripts/` |
| 长期自动维护 | `.workbuddy/memory/*.md` | 保持未跟踪（AI 自动写入，不纳入版本管理） |
| 测试文件遗留债 | `*.test.ts` 类型错误（tracked） | 走 `tsc:test` 渐进修复 |

### 6.3 清账命令备忘

```bash
# 扫描未跟踪测试文件（期望 0）
git status --porcelain | grep '??.*\.\(test\|test-utils\|spec\)\.\(ts\|tsx\)$'

# 扫描未跟踪非测试工件（期望 0 或白名单）
git status --porcelain | grep '^??'

# 统计测试类型债务趋势
npx tsc -p tsconfig.test.json --noEmit | grep -c 'error TS'
```

### 6.4 铁律

> **任何 tsconfig / package.json / husky 的 tsc 配置变动后，必须执行本 skill 三步诊断 + 实测 tsc:prod 0 错误 + git untracked 审计。** 
> 新增门禁前先问：「vite build / 实际构建真的查这个吗？」让门禁作用域镜像构建现实。

---

## 七、测试类型债务渐进恢复路径（2026-07-22 新增）

### 7.1 当前基线（实测 2026-07-22）

```
tsc:test = 307 错误
top 5 文件：
  1. tests/__tests__/scripts/audit-mapping-integrity.test.ts      (60 err)
  2. tests/__tests__/types/profile-types.spec.ts                   (39 err)
  3. tests/services/profileService.test.ts                         (33 err)
  4. tests/__tests__/scripts/audit-hardcode.test.ts                (19 err)
  5. tests/bridge-integration.test.ts                              (16 err)
```

### 7.2 恢复路径

```
Phase 0: warn 接入 husky（立即执行）
  └── pre-commit 末尾追加: npm run tsc:test || echo "⚠️ 测试类型错误 N 个"
Phase 1: Top 5 漂移项清零（按错误集中度排序修复）
  └── 目标：307 → < 100
Phase 2: tsconfig.test.json 严格化
  └── 补全 exclude: ["e2e", "node_modules", "dist"]（已正确，验证即可）
Phase 3: 升至阻断门禁
  └── 当 tsc:test < 50 且稳定 → 改为阻断（false-alarm 允许 --no-verify 但需加备注）
```

### 7.3 趋势监控

```bash
# 每周运行一次，追加到趋势文件
echo "$(date '+%Y-%m-%d') $(npx tsc -p tsconfig.test.json --noEmit 2>&1 | grep -c 'error TS')" >> outputs/tsc-test-debt-trend.txt
```
