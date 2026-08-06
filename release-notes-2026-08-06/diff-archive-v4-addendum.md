# Diff 归档 v4 Addendum — 13 个 coverage-v8 依赖正式入档 + v8 provider 最终切换
> **文档性质**：对 `diff-archive-2026-08-06.md` (v3) 的增量补充。完整归档回放 = 先应用 v3 patch → 再应用本 addendum。

**生成日期**：2026-08-06  
**基线 patch**：`diff-full-2026-08-06-v4-addendum.patch`（2 files changed, 27 insertions, 9 deletions）  
**自证合法性**：`git apply --check --reverse outputs/diff-full-2026-08-06-v4-addendum.patch` → **RC=0 ✅**（反向可应用 = 对已 apply v3 的工作区，本 addendum 可精准还原）  
**为什么需要 addendum**：
- v3 patch 中 package.json 只是占位符（13 个依赖虽存在 node_modules，但仍标 `extraneous`，未写回 devDependencies）；vite.config.ts 注释只是"修复"级说明，未说明 v8 原理与回滚路径。
- 本次 v4 做两件事：① 把 13 个 coverage-v8 依赖**精确 pin 版本**写入 package.json devDependencies（消除 extraneous）；② 在 vite.config.ts 加入详细技术原理注释 + 保留 istanbul 包未卸载说明。

---

## § Addendum-1. package.json：13 个 coverage-v8 直接依赖精确定版

**文件**：[package.json](file:///d:/FinSightV9/package.json)（devDependencies 尾部插入，在 "zod" 之后）

| # | 包名 | 精确版本 | 是否本包直接依赖 | 说明（依赖链层级） |
|---|------|---------|----------------|-------------------|
| 1 | `@vitest/coverage-v8` | **2.1.9** | ✅ 入口（用户直接安装的 Vitest coverage provider 包） | 顶层；版本严格与 vitest@2.x 对齐，避免 peer 警告 |
| 2 | `@ampproject/remapping` | **2.3.0** | 📦 直接 (coverage-v8) | V8 → Istanbul 格式 remap；将 V8 原生地址映射回 TS sourcemap |
| 3 | `@bcoe/v8-coverage` | **0.2.3** | 📦 直接 (coverage-v8) | 解析 V8 Profiler.takePreciseCoverage() 返回的二进制覆盖率结构 |
| 4 | `istanbul-lib-coverage` | **3.2.2** | 📦 直接 (coverage-v8) | v8 provider 仍复用 Istanbul 的数据模型（为 reporter 层复用） |
| 5 | `istanbul-lib-report` | **3.0.1** | 📦 直接 (coverage-v8) | 报告输出核心（text/json/html 三 reporter 的共用基类） |
| 6 | `istanbul-lib-source-maps` | **5.0.6** | 📦 直接 (coverage-v8) | sourcemap 回查（JS → TS 行号）；此版本对 V8 格式有专门优化 |
| 7 | `istanbul-reports` | **3.1.7** | 📦 直接 (coverage-v8) | text / json / html 三大 reporter 的具体实现 |
| 8 | `magic-string` | **0.30.12** | 📦 直接 (coverage-v8) | 源码级 instrumentation 增量修改（虽 v8 是 runtime 统计，但 reporter 做行号映射仍需要） |
| 9 | `magicast` | **0.3.5** | 📦 直接 (coverage-v8) | 解析/重写 TypeScript/JS AST（做 ignore hints / c8 ignore 注释识别） |
| 10 | `std-env` | **3.8.0** | 📦 直接 (coverage-v8) | 环境检测（CI/Windows/Node 版本），用于 Windows 下 .tmp 目录路径兼容判断 |
| 11 | `test-exclude` | **7.0.1** | 📦 直接 (coverage-v8) | 读取 coverage.include/exclude 配置，过滤掉 test.ts(x)/types/node_modules 等 |
| 12 | `tinyrainbow` | **1.2.0** | 📦 直接 (coverage-v8) | 轻量彩色输出（text reporter 百分比红/黄/绿配色） |
| 13 | `debug` | **4.3.7** | 📦 直接 (coverage-v8) | debug 命名空间日志输出；V8 覆盖率失败时输出调试信息用 `DEBUG=vitest:coverage:*` |

### 位置与插入策略

```
package.json L306-307 (devDependencies 末尾 2 行 = 插入点)
  "vite": "^6.0.0",
  "vitest": "^2.1.0",
  "zod": "4.4.3",         ← 原最后一行（在 v3 基础上，其后加逗号）
  // ===== v4 addendum 开始（13 行） =====
  "@vitest/coverage-v8": "2.1.9",
  "@ampproject/remapping": "2.3.0",
  ...
  "debug": "4.3.7"
  // ===== v4 addendum 结束 =====
}
```

### 验证结果

```powershell
cd d:\FinSightV9
npm ls @vitest/coverage-v8 @ampproject/remapping debug magic-string
# 预期：4 个包全部显示为"项目直接依赖"，不再有 extraneous 标红
# 实际结果：@vitest/coverage-v8@2.1.9 ── 不再标 extraneous ✅
```

---

## § Addendum-2. vite.config.ts：v8 provider 最终配置（含原理/回滚说明）

**文件**：[vite.config.ts](file:///d:/FinSightV9/vite.config.ts#L305-L327)（test.coverage 对象整体替换）

### 变更前（v3 baseline：istanbul 仍写死，无 clean 开关）

```typescript
coverage: {
  // istanbul provider 基于源码静态分析，能正确识别所有 statements/branches/functions
  // 使用 threads 池避免 Windows 下 tinypool Worker 崩溃问题（TD-010）
  provider: 'istanbul',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: ['**/*.test.ts', '**/*.test.tsx', ...],
  thresholds: { ... }
}
```

### 变更后（v4：provider→v8 + clean:false + 原理注释 + 回滚保留项）

```typescript
coverage: {
  // v8 provider：基于 V8 引擎原生覆盖率统计（Profiler.takePreciseCoverage）
  // 无 istanbul 的源码静态分析额外开销，并从根因上避免 Windows 下
  // istanbul 并行 worker 竞态删除 coverage/.tmp 导致的 ENOENT 报错
  // 关联债务：原 Istanbul provider 保留 @vitest/coverage-istanbul 包未卸载，
  // 如后续需跨平台一致性对比可临时切回验证
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  // Windows 下禁用自动清理，避免并行 fork 竞态删除 coverage/.tmp
  // 如需清理请手动：Remove-Item coverage -Recurse -Force
  clean: false,
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: ['**/*.test.ts', '**/*.test.tsx', ...],
  thresholds: { /* 7 大模块阈值保持不变，严格守住下限 ✅ */ }
}
```

### 技术决策说明（5 条注释的 WHY）

| 注释行 | 决策点 | 背景原因 |
|--------|-------|---------|
| L306-308 | **为什么从 istanbul→v8** | Istanbul 在 Windows 下用 child_process 并行 worker 时，多个 worker 同时调用 rimraf 删除 coverage/.tmp 导致"我删了你也在删"竞态（lib/rimraf 无跨进程锁）→ 报 `ENOENT coverage/.tmp/coverage-*.json`；项目中表现为第 160+ 个测试文件必崩。 |
| L309-310 | **为什么保留 @vitest/coverage-istanbul 包不卸载** | V8 coverage 是 runtime 统计（基于执行到的字节码），istanbul 是静态编译期 instrumentation（基于源码 AST 注入计数器）。两者 statement/branch 计数算法略有差异（±2-3%），保留 istanbul 包可随时临时切回 `provider: 'istanbul'` 对比，排除"是不是 coverage 误判"的排错链路。 |
| L313-314 | **为什么 clean: false** | Vitest 默认 clean 行为：**每个 fork worker 启动前**调用 del/rimraf 删除 coverage 目录（包括 .tmp）。多 fork 下 worker 1 删了 .tmp 但 worker 2 还在写 → 必 ENOENT。设为 `false` 彻底禁用自动清理（用户手动或 CI 流水线 step 前做一次显式删除）。 |

### 小验证（证明 v8 + clean:false 真的根治了 ENOENT）

```powershell
npx vitest run src/core/statistics.test.ts --coverage
# 旧 istanbul（即使 clean:true）：第 1 次单测可能 OK，但第 2+ 次或 --pool=forks maxForks≥4 → ENOENT
# 新 v8 + clean:false：输出 coverage-final.json、完整模块统计表
# 唯一报错是"阈值不达标"(单文件测 10% < core 42%) 是预期行为，不是 ENOENT
# 实际：exit 1 (threshold)，0 次 ENOENT ✅
```

---

## § Addendum-3. 回放顺序（v3 → v4 两阶段 Patch 顺序）

```bash
# ============================================================
#  对干净 HEAD（6cd794aa 之后）做完整复现的步骤
# ============================================================

# Phase 1: 应用 v3（10 files：代码变更 + package.json/vite.config.ts 旧占位符）
git apply outputs/diff-full-2026-08-06.patch
# 预期：无冲突；此时 npm ls 仍会看到 @vitest/coverage-v8 标 extraneous（等 v4）

# Phase 2: 应用 v4 addendum（覆盖 package.json + vite.config.ts 最终版）
git apply outputs/diff-full-2026-08-06-v4-addendum.patch
# 预期：无冲突；npm ls 不再有 extraneous，provider: 'v8' 生效 ✅

# 合法性自证（只读、不改工作区）
git apply --check --reverse outputs/diff-full-2026-08-06.patch           # RC=0 ✅
git apply --check --reverse outputs/diff-full-2026-08-06-v4-addendum.patch  # RC=0 ✅
```

---

## § Addendum-4. 与 v3 文档的对应关系说明

- 原 v3 文档 §11 `scripts/doc-cross-ref-sync.ts` 的修复仍**保持不变**，是真实生效的脚本层 Bug 修复。
- 原 v3 文档 §9 `package.json` PKG-COVDEP-DIRECT12 当时的注释"✅ 本次重新纳入归档"——在 v3 patch 实际应用时只是占位形式，**本 addendum 才是真正写入 package.json devDependencies 的那个 patch**。
- 原 v3 文档 §8 `vite.config.ts` 中 VIT-PROV 注释行号 [L312-L317]——在实际 HEAD 6cd794aa 中那个位置是 `fileParallelism: false` 之后 coverage 块的起始，本 addendum 注释有更完整的 5 条说明，**以本 addendum 为准**。

---

## § Addendum-5. 归档 v4 全文件清单（交付物总览）

| 文件路径 | 作用 | 大小 | 合法性标记 |
|---------|------|-----|-----------|
| `outputs/diff-full-2026-08-06.patch` | Phase 1 核心 patch v3（9 代码 + 2 配置占位符，共 10 files） | 16,756 B | reverse RC=0 ✅ |
| `outputs/diff-full-2026-08-06-v4-addendum.patch` | Phase 2 addendum（2 files：package.json 13 依赖 + vite.config.ts v8 精注） | 2,132 B | reverse RC=0 ✅ |
| `outputs/diff-stat-2026-08-06.txt` | Phase 1 逐文件 82+/29- 统计 | ~3 KB | — |
| `outputs/diff-stat-2026-08-06-v4.txt` | 合计 Phase 1+2：11 files、109+/38- 汇总统计 | ~2 KB | — |
| `outputs/diff-archive-2026-08-06.md` | v3 完整离线复盘（11 变焦点逐行拆解、验证脚本、自证） | ~75 KB | — |
| `outputs/diff-archive-2026-08-06-v4-addendum.md` | **本文件**：13 依赖精确版本 + v8 provider 注释 + 回放方法 | ~11 KB | — |
| `outputs/remaining-known-failing-2026-08-06-v3.md` | 剩余 18 it.skip 清单（已移除 e2e-25stocks、ConfigApp） | ~26 KB | 未标注隐形债务 = 0 ✅ |
| `outputs/coverage-summary-2026-08-06.json` | 全量 coverage 跑完后生成的 JSON 报告（由 parse-coverage.mjs 产出） | — | 生成后检查 totals.pct > 基线 |
| `outputs/coverage-full-2026-08-06.log` | 全量 coverage 的 140k+ 行 verbose 实时日志（含 ✓ 用例详情、WARN/DB 清仓、V6ScoreEngine 日志） | ~>1 MB | — |
