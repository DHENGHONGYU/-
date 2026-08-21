---
title: docs/retro/2026-04-08-ci-coverage-rollup-fix.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# CI 配置与覆盖率 Rollup 解析错误 - 技术复盘笔记

> 时间：2026-04-08
> 范围：.github/workflows/ci.yml、package.json scripts、vite.config.ts > test.coverage
> 触发：CI 流水线 npm run test:p0:core:ci 报 Missing script；本地覆盖率抛 RollupError PARSE_ERROR。

---

## 一、问题清单与影响面

| # | 问题 | 影响 | 严重度 |
| - | ---- | ---- | ------ |
| P1 | ci.yml 引用的 test:p0:core:ci / test:bootstrap:p0 / test:chart:industry / report:chart / test:databridge:* 等 8+ 脚本在 package.json 未定义 | CI push/pr 触发即红，门禁形同虚设 | P0 |
| P2 | 本地 vitest run --coverage 抛 RollupError: Expected a semicolon (PARSE_ERROR, pos: 65833/87462) | 覆盖率全量报告无法生成、CI coverage job 必红 | P0 |
| P3 | test:chart:industry 引用不存在的 tests/stockColorDebug.test.ts 并用 bash-only 的 2>/dev/null 分隔符 | PowerShell/Windows runner 既抛错又静默吞真实失败 | P1 |

---

## 二、根因分析（RCA）

### 2.1 P1：CI 脚本缺失

前期 ci.yml 快速迭代时，job 级 run: npm run xxx 直接写了脚本名，但忘记回写到 package.json scripts；随后把 P0 core 拆成本地 verbose 的 test:p0:core 和 CI 带 JUnit reporter 的 test:p0:core:ci，后者未落地。

### 2.2 P2：Rollup PARSE_ERROR（覆盖率）

@vitest/coverage-istanbul 在 coverage.all: true（默认）时，会把 coverage.include 下全部源文件（即使从未被任何测试 import）逐一送入 rollup 的 ssrTransformScript 做二次 parse 以便给未覆盖文件插桩。项目中：
- stockDictionary.ts (443KB) / swIndustryMap.ts (303KB) 等超大自动生成的常量字典；
- 若干 TSX / decorator / as const / satisfies 组合经 esbuild 转 JS 后在 ASI 边界出现 rollup parseAst 无法识别的片段。

pos 65833/87462 是相对拼接后 bundle 的偏移，不是文件绝对偏移，随 include/exclude 组合漂移，证明触发源不是单点。

### 2.3 P3：chart industry 脚本跨平台

bash 的 2>/dev/null 在 PowerShell 是无效语法（应为 2>$null）；且 tests/stockColorDebug.test.ts 不存在，2>/dev/null 本意静默吞错，但在 CI runner 上吞掉了真实的脚本失败。

---

## 三、修复方案与落地

### 3.1 package.json 新增脚本

- test:p0:core：本地跑 P0 core 全套（6 个测试文件 + --reporter=verbose）
- test:p0:core:ci：CI P0 core 门禁，JUnit XML 输出 reports/p0-core-junit.xml
- test:chart:industry：4 个真实行业测试，vitest 多 reporter 一次完成 default+json
- report:chart：scripts/generate-test-report.cjs 消费 JSON 生成 HTML
- test:bootstrap:p0：bootstrapService + seedService
- test:databridge:gate / integration / bootstrap / acl：DataBridge 分层回归

### 3.2 vite.config.ts test.coverage 调整（修复 Rollup PARSE_ERROR）

关键修复：
1. exclude 扩容：增加 stockDictionary.ts、swIndustryMap.ts、src/generated/**
2. all: false：仅统计被测试实际 import/执行过的文件，避免 istanbul 对未覆盖模块做 rollup ssrTransform 二次 parse
3. processingConcurrency: 1：降低个别大文件转码的并发风险

设计取舍：
- all: false 使覆盖率分母变小（未触达模块不计入），彻底解决 Rollup PARSE_ERROR。
- 风险控制：未触达模块原本就是 0%，用 audit:deadcode + audit:layers 配合扫 unused exports 作为补偿。
- 后续方向：若要恢复 all:true，可切到 @vitest/coverage-v8（v8 原生 coverage 不依赖 rollup ssrTransform）。

### 3.3 test:chart:industry 跨平台修复

用 vitest 原生多 reporter 一次执行替代"跑两次 + bash 重定向"：
- 旧：vitest run A B C 2>/dev/null; vitest run A B C --reporter=json
- 新：vitest run A B C --reporter=default --reporter=json --outputFile.json=xxx

好处：Windows runner 可直接运行；不吞错；省一半耗时。

---

## 四、验证结果

- test:p0:core:ci：6 个测试文件全部 PASS，reports/p0-core-junit.xml 正常生成（37KB）。
- npm run test:p0:core:ci -- --coverage：无 RollupError，覆盖率表格正常输出（仅阈值未达标，符合只跑 P0 子集预期）。
- 单文件 databridgeAdapter.branch-coverage.test.ts --coverage：先前必抛 PARSE_ERROR，修复后正常生成。

---

## 五、流程改进（预防再发）

1. CI 脚本一致性门禁：grep workflows 中所有 npm run xxx，与 package.json scripts 做 diff，不一致直接 fail。
2. 覆盖率 provider 评估：把 @vitest/coverage-v8 纳入 devDependencies 评估队列，A/B 对照 istanbul 的 branches 统计、CI 耗时、codecov 兼容。
3. 自动生成文件标注：所有 build 生成的大常量放 src/generated/，并在 tsconfig exclude + coverage.exclude 同步登记。
4. 跨平台脚本最小化：禁止 scripts 中出现 2>/dev/null、; 串联等 shell 扩展语法；复杂场景抽到 scripts/*.cjs。

---

## 六、变更索引

- package.json：scripts 新增 10 项、修正 test:chart:industry
- vite.config.ts：test.coverage.exclude 扩容 + all:false + processingConcurrency:1
- docs/retro/2026-04-08-ci-coverage-rollup-fix.md：本复盘笔记