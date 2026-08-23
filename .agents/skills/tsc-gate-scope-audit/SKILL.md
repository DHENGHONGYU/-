---
skill_id: V9-SKILL-TSC-GATE-SCOPE
name: "tsc-gate-scope-audit"
description: "tsc 门禁误锁诊断与修复：当 pre-commit 的 tsc:prod（或 build/dev 的类型检查）报错阻塞提交，但错误全部位于 *.test.ts/*.spec.ts 等测试文件时，诊断为 tsconfig 作用域误配（生产类型检查越权扫描测试），并给出无需 --no-verify 的合规修复（收窄门禁作用域）。Invoke when tsc:prod 红灯但源码零错误、类型检查全在测试文件、门禁假红阻塞提交、或改动 tsconfig/package.json tsc 脚本后需回归验证时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-tsc-gate-scope-audit 归位项目单一物理源（2026-07-22 tsc:prod 红灯 106 错误/0 在源码实战提炼）"
    date: 2026-08-23
mandatory: false
---

# tsc 门禁误锁诊断与修复 — v1.0.0

> **核心铁律：类型门禁报错 ≠ 你的代码坏了。先分类、先归因，再决定修门禁还是修代码。**
> 门禁全红可能是「production 类型检查越权扫描了测试文件」——配置作用域缺陷，不是业务缺陷。
> **绝不因门禁假红而 `--no-verify`。** 合规修复是「收窄门禁作用域」，不是绕过门禁。

---

## 一、触发条件

满足任一即触发：
1. `husky` pre-commit 门禁 `npm run tsc:prod` 失败，阻塞 `git commit`
2. `npm run build`（`prebuild: "npm run generate:tokens && npm run tsc:prod"`）被类型检查阻塞
3. `npm run dev` 被 `predev` 类型检查阻塞
4. 错误输出反复出现 `*.test.ts` / `*.test-utils.ts` / `*.spec.ts` 路径

**不触发**：错误文件全是 `src/**` 非测试源码 → 真 prod 缺陷，直接修代码（配合 `module-sync-checklist`）。
**协作边界**：报错涉及 DataBridge/ACL/Mock 漂移 → `data-flow-integrity-audit` / `mock-data-diagnosis`；测试文件类型错误批处理 → `tsc-test-error-diagnosis`。

---

## 二、前置检查

| # | 检查项 | 方法 | 通过标准 |
|---|--------|-----|---------|
| 1 | 根因模型理解 | `tsconfig.json`（无测试排除）同时承担编辑器全量检查与 `tsc:prod` 入参 → 生产检查实际扫了测试；而 `vite build` 根本不检查测试文件 | 理解「门禁检查的东西 ≠ 实际要交付的东西」 |
| 2 | 退出码捕获 | `cmd > tsc.log 2>&1; echo EXIT=$?` | 禁止 `\| tail` 掩盖退出码 |
| 3 | 铁律确认 | 本项目约定不得擅自 `--no-verify` | 合规路径 = 收窄作用域 |

---

## 三、阶段化 SOP

### 阶段 1：诊断三步法（必须产出 file:line 证据）

**Step 1 — 抓全量错误**
```bash
npx tsc -p tsconfig.json --noEmit > tsc.log 2>&1; echo "EXIT=$?"
grep -c "error TS" tsc.log
```

**Step 2 — 按文件类型分类（核心判定）**
```bash
# 测试文件中的错误数
grep "error TS" tsc.log | grep -E "\.(test|test-utils|spec)\.(ts|tsx)\(" | wc -l
# 非测试源码中的错误数
grep "error TS" tsc.log | grep -E "^src/" | grep -vE "\.(test|test-utils|spec)\.(ts|tsx)\(" | wc -l
```
判定：非测试 = 0 且错误几乎全在测试 → **作用域误配（本技能场景）**；非测试 > 0 → 真缺陷，修源码。

**Step 3 — git 归因（我的改动 vs 历史/生成物）**
```bash
for f in $(grep -oE "^src/[^(]+" tsc.log | sort -u); do
  st=$(git -c core.quotepath=false status --short -- "$f" | awk '{print $1}')
  printf "%-4s %s\n" "${st:-HEAD}" "$f"
done | sort
```
`??`=未跟踪（其他工作流生成）、`M`=工作树已改、`HEAD`=干净（真预存债）。绝大多数 `??` → 主因是工作树堆积的类型不通过测试文件，与 HEAD 历史债无关。

> 实战基线（2026-07-22）：106 错误 / 0 在源码；79 未跟踪、26 已改、仅 1 干净@HEAD。

### 阶段 2：合规修复（无需 --no-verify）

1. **`tsconfig.prod.json`**（已验证模板）：`extends tsconfig.json`，`include: ["src/**/*"]`，`exclude` 全部 `*.test.*` / `*.test-utils.*` / `*.spec.*` / `__tests__` / `*.stories.tsx`；排除 `vitest/globals` 类型（prod 源码不应依赖测试全局）
2. **`package.json`**：`"tsc:prod": "tsc -p tsconfig.prod.json --noEmit"`；可选 `predev` 同步指向
3. **实测验收**：`npx tsc -p tsconfig.prod.json --noEmit; echo EXIT=$?` 必须 0；`npm run build` 不再被阻塞

### 阶段 3：测试类型债务渐进恢复（不丢测试类型安全）

- `tsconfig.json` 保留给编辑器全量检查；`tsc:test`（`tsconfig.test.json`）单独查测试
- 恢复路径：Phase 0 `tsc:test` warn 接入 husky → Phase 1 按 top 5 错误文件分批修复 → Phase 2 升级为阻断门禁
- 基线参考（2026-07-22）：`tsc:test` = 307 错误，集中在 `tests/__tests__/scripts/audit-mapping-integrity.test.ts`（60）、`tests/__tests__/types/profile-types.spec.ts`（39）等

### 阶段 4：未跟踪生成物治理

| 类型 | 示例 | 策略 |
|---|---|---|
| 一次性生成目录 | `cache/`, `_ref-*/` | 追加 `.gitignore` |
| 一次性修复脚本 | `*restore*.py` | 不复用→gitignore；通用→提交到 `scripts/` |
| 长期自动维护 | `.workbuddy/memory/*.md` | 保持未跟踪 |
| 测试文件遗留债 | `*.test.ts` 类型错误（tracked） | 走 `tsc:test` 渐进修复 |

清账命令：`git status --porcelain | grep '^??'`（未跟踪测试文件期望 0）。

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 门禁假红第一反应 `--no-verify` | 绕过门禁、债务滚雪球 | 先分类归因，收窄作用域即合规 |
| 2 | 工作树堆积未跟踪 `*.test.ts` | 宽 `tsconfig.json` 一并扫入，全量阻塞 | 定期 `git status` 清账或 `.gitignore` |
| 3 | 收窄门禁后放任测试类型 | 类型安全静默流失 | `tsc:test` 保留并渐进升级为阻断 |
| 4 | 新增门禁不问构建现实 | 作用域再次漂移 | 先问「vite build 真的查这个吗」，门禁镜像构建现实 |
| 5 | 凭错误摘要下结论 | 误判根因 | 必须产出 file:line + git 归因证据 |

---

## 五、完成交付物清单

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 错误分类证据（测试/源码 + `??/M/HEAD` 归因） | 诊断日志 | 每项错误有 file:line |
| 2 | `tsconfig.prod.json` 作用域收窄 | 仓库根 | `tsc:prod` 实测 EXIT=0 |
| 3 | `package.json` 脚本指向更新 | 仓库根 | `npm run build` 不被类型检查阻塞 |
| 4 | `tsc:test` 债务基线与恢复计划 | 报告/AGENTS.md | top 5 文件错误数登记 |
| 5 | git untracked 审计结果 | 诊断日志 | 未跟踪测试文件 = 0 |
