---
title: V9 项目文件系统全局诊断报告
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "扫描范围：D:\FinSightV9（排除 node_modules/.git/dist/build/coverage/.venv） 统计时间：2026-07-20 文件总数：~4,400+（非..."
tags: [qa, audit, report]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 项目文件系统全局诊断报告

> **扫描范围**：D:\FinSightV9（排除 node_modules/.git/dist/build/coverage/.venv）
> **统计时间**：2026-07-20
> **文件总数**：~4,400+（非 node_modules 源文件）

---

## 一、目录树（深度3层）与核心用途

```
FinSightV9/
├── .agents/              # AI Agent 运行时技能文件（自动管理，不手动修改）
├── .codebuddy/           # AI 辅助编码工具本地配置（临时文件）
├── .dbg/                 # 调试截图（自动产出，应定期清理）
├── .github/              # GitHub 工作流（CI/CD 自动化）?
├── .husky/               # Git 钩子（pre-commit 等）?
├── .playwright-mcp/      # MCP 浏览器测试临时数据（过期数据）
├── .trae/                # Trae AI 工具本地配置与日志（临时文件）
├── .vscode/              # VSCode 配置（插件、snippet）?
├── .workbuddy/           # WorkBuddy 工具日志（大量 log 文件，应清理）
├── build-artifacts/      # 构建产物备份（可清理）
├── code-quality-compliance/  # 独立 Skill 包（已安装插件）
├── design-tokens/        # Figma 设计令牌同步数据 ?
├── docs/                 # 文档主目录（需重构）??
├── e2e/                  # Playwright 端到端测试 ?
├── eslint-rules/         # 自定义 ESLint 规则（颜色硬编码检查）?
├── outputs/              # AI 产出物目录（临时文件）
├── packages/             # 子包（audit-utils, store-audit）?
├── plugins/              # Kimi 插件安装目录（运行时）?
├── prompts/              # 系统提示词模板（AI 开发工具）?
├── public/               # 静态资源（图标、manifest）?
├── python/               # Python 数据服务端点（轻量服务）?
├── releases/             # 发布包 ZIP（可清理旧版本）
├── scripts/              # 项目脚本（120+ 文件，42 个孤立）??
├── src/                  # 源代码主目录（规范良好）?
├── temp/                 # 临时文件目录（80+ 文件，~180MB）??
├── test-output/          # 测试输出（proofread-report 等）??
├── tests/                # 测试目录（138 个测试文件）?
├── AGENTS.md             # AI 行为约束契约（根级白名单）?
├── architecture.md       # 架构文档（应移入 docs/）??
├── CHANGELOG.md          # 变更日志（根级白名单）?
├── README.md             # 项目自述（根级白名单）?
├── overview.md           # 项目概览（应移入 docs/）??
├── index.html            # 入口文件（根级白名单）?
├── package.json          # 包配置（根级白名单）?
├── eslint.config.js      # ESLint 配置 ?
├── eslint.colors.config.js  # 颜色专用 ESLint 配置 ?
├── tsconfig.json         # TS 主配置 ?
├── tsconfig.api.json     # TS API 配置 ?
├── tsconfig.scripts.json # TS 脚本配置 ?
├── tsconfig.test.json    # TS 测试配置 ?
├── vite.config.ts        # Vite 构建配置 ?
└── playwright.config.ts  # Playwright 配置 ?
```

---

## 二、文件类型分布统计

| 类型 | 数量 | 占比 | 说明 |
|------|------|------|------|
| json | 1,317 | 30% | 大量测试数据、配置、API 响应 |
| ts | 808 | 18% | 核心源码（含测试） |
| md | 799 | 18% | 文档（大量重复/过时） |
| tsx | 219 | 5% | React 组件 |
| png | 91 | 2% | 截图、报告图表 |
| log | 87 | 2% | 日志文件（需清理） |
| py | 42 | 1% | 脚本、工具 |
| yml | 40 | 1% | CI/CD 配置 |
| html | 21 | 0.5% | 报告、演示页面 |
| cjs/js | 41 | 1% | 配置、脚本 |
| zip | 10 | 0.2% | 发布包 |
| 其他 | ~1,000 | ~23% | sh, ps1, svg, mmd, mjs, txt 等 |

**关键发现**：
- log 文件 87 个，大部分在 `temp/`（~62 个，~180MB）和 `.workbuddy/`（10 个）
- html 文件仅 5 个（含 dist/index.html 构建产物），影响面小
- md 文件 799 个，分布在 `docs/`（~500+）和 `.agents/skills/`（~100+）

---

## 三、问题区域详细识别

### 3.1 测试文件分布（332 个）

| 位置 | 数量 | 说明 | 问题等级 |
|------|------|------|---------|
| src/ 下（含子目录） | 194 | 与源码混放，如 `src/components/atoms/Badge.test.tsx` | ?? 中等 |
| tests/ 下 | 138 | 独立测试目录，结构良好 | ? 正常 |
| e2e/ 下 | 15+ | 端到端测试，结构良好 | ? 正常 |
| **根目录** | 0 | 无散落 | ? 正常 |

**分析**：`src/` 下 194 个测试文件占总数 58%，但这是在 src/ 内共置（co-location）模式，是 Vitest 的推荐实践。迁移到 `tests/` 会改变开发习惯，需要权衡。建议保留共置，但需清理重复测试。

### 3.2 临时文件（~80+ 个，~180MB）

| 位置 | 文件数 | 大小 | 问题 |
|------|--------|------|------|
| temp/*.log | 50+ | ~90MB | 大量重复 coverage 测试日志，无保留价值 |
| temp/*.txt | 10+ | ~5MB | 测试输出、验证报告 |
| temp/*.json | 5+ | ~0.5MB | 后端验证报告 |
| temp/*.png | 5 | ~0.5MB | 路由分析图 |
| temp/*.svg | 2 | ~0.1MB | 雷达图 |
| temp/*.py | 5 | ~0.1MB | 验证脚本 |
| temp/*.mjs | 5 | ~0.1MB | 测试脚本 |
| temp/降级链测试报告.md | 1 | ~0.1MB | 中文测试报告 |
| .workbuddy/*.log | 10 | ~20MB | 工作日志 |
| .workbuddy/memory/*.md | 8 | ~1MB | 每日记忆 |
| coverage/.tmp | 1 | ~5MB | 临时覆盖率数据 |
| e2e/snapshot-baseline-*.log | 1 | ~0.1MB | 快照基线日志 |
| test-output/ | 3 | ~0.01MB | proofread 报告 |
| build-artifacts/_backup/ | 1 | ~0.1MB | 构建备份 |
| outputs/ | 35 | ~5MB | AI 产出物（部分可归档） |

**问题等级**：?? 高 — temp/ 目录大量日志无版本控制价值，占用 180MB

### 3.3 HTML 文件（5 个，非构建产物）

| 文件 | 路径 | 说明 | 建议 |
|------|------|------|------|
| P1-P2落实追踪报告 | docs/P1-P2落实追踪报告_2026-07-09.html | 项目追踪报告 | 移入 docs/reports/ |
| v9-interaction-flows | docs/v9-interaction-flows.html | 交互流演示 | 移入 docs/reports/design/ |
| proofread-report | test-output/proofread-report.html | 校对报告 | 移入 docs/reports/test/ |
| index.html | 根目录 | 入口文件 | ? 保留 |
| dist/index.html | 构建产物 | 自动生成 | ? 忽略 |

### 3.4 孤立脚本（42 个，占 scripts/ 35%）

**已引用脚本（~78 个，通过 package.json scripts）**：
- `audit:*` 系列：audit-layers, audit-hardcode, audit-deadcode, audit-docs...（约 20 个）
- `test:*` 系列：test, test:watch, test:ci, test:e2e...（约 10 个）
- `doc:*` 系列：doc-update-trigger, doc-freshness-alert...（约 5 个）
- `generate:*` 系列：generate-tokens, generate-doc-list...（约 5 个）
- 其他：complexity-scan, fix-layer-violations, pre-review-check...（约 38 个）

**孤立脚本分类（42 个）**：

| 类别 | 文件 | 建议 |
|------|------|------|
| 临时工具（前缀 `_`） | _cmp.cjs, _cx_filter.cjs, _debug_hash.py, _debug_url.py, _dupq.cjs, _extract_d4.cjs, _smoke_playwright.py | 保留或归档（可能为临时诊断） |
| 未接入审计流水线 | batch-add-jsdoc.ts, batch-fix-tsc.ts, cleanup-reports.ts, file-dedup-scan.mjs, gen-cleanup-list.py, generate-doc-list-simple.ts, generate-doc-update-list.ts, generate-rectification-pdf.ts | 评估是否接入 CI |
| 部署/工具脚本 | check-types.ps1, check-types.sh, deploy-rectification-toolkit.ts, git-push-with-retry.ps1, rotate-ark-api-key.ps1, run_browser_test.ps1, stress-test-realtime-quotes.sh | 保留（运维用） |
| 调试/验证 | audit-path-match.mjs, audit-path-match.ts, browser_verify_agent_b.py, test_browser.py, test_connectivity.py, test_diag.py, test_file.py, verify-m1.ts, verify-m2-m3.ts | 保留（开发调试） |
| 数据处理 | component-audit-data.json, component-audit-report.txt, generate_data_link_diagram.py, llm-doc-generator.ts, p1-1-migrate.py, pitfall_check.py, regression_news_v6.py, regression_news_v6_test.cjs | 评估是否接入自动化 |
| 文档/通知 | doc-notify.ts, doc-pipeline.ts, doc-retry.ts | 若 doc-auto-updater 已覆盖，可归档 |
| 其他 | compare-visual-baselines.sh, run-with-log.ts | 保留（CI 用） |

### 3.5 配置文件去重检查

| 配置 | 文件 | 状态 | 建议 |
|------|------|------|------|
| ESLint | `eslint.config.js`（主）, `eslint.colors.config.js`（颜色专用）, `eslint-rules/no-hardcoded-colors.js`（自定义规则） | ?? 3 个文件 | 可合并为一个，颜色专用用 extends |
| TypeScript | `tsconfig.json`（主）, `tsconfig.api.json`, `tsconfig.scripts.json`, `tsconfig.test.json` | ? 分层合理 | 保留，各场景隔离 |
| Tailwind | `tailwind.config.js` | ? 唯一 | 保留 |
| Vite | `vite.config.ts` | ? 唯一 | 保留 |

**结论**：ESLint 配置可合并简化，但非紧急。TypeScript 分层配置合理。

### 3.6 docs/ 非 SDLC 目录识别

```
docs/
├── 00-meta/              ? SDLC Phase 0（元数据）
├── 01-requirements/      ? SDLC Phase 1
├── 02-design/            ? SDLC Phase 2
├── 03-development/       ? SDLC Phase 3
├── 04-testing/           ? SDLC Phase 4
├── 05-deployment/        ? SDLC Phase 5
├── 06-project-management/ ? SDLC Phase 6
├── 07-archive/           ? SDLC Phase 7
├── .ai-index/            ?? AI 索引（移入 00-meta/）
├── ai/                   ?? AI 集成指南（移入 03-development/）
├── architecture/         ?? 架构文档（移入 02-design/ADR/）
├── architecture-radar-v2/ ?? 架构雷达（移入 02-design/）
├── assets/               ?? 静态资源（保留，但需 README）
├── audit/                ?? 审计报告（移入 04-testing/ 或 06-project-management/）
├── blueprints/           ?? 蓝图（移入 02-design/）
├── changelogs/           ?? 变更日志（移入 06-project-management/）
├── cockpit/              ?? 驾驶舱数据定义（移入 02-design/ 或 standards/）
├── drafts/               ?? 草稿（移入 playground/ 或 07-archive/）
├── guides/               ?? 开发指南（移入 03-development/）
├── implementation/       ?? 实施截图（移入 03-development/ 或 07-archive/）
├── modules/              ?? 模块文档（移入 02-design/）
├── ops/                  ?? 运维文档（移入 05-deployment/）
├── plans/                ?? 计划（移入 06-project-management/）
├── plugins/              ?? 插件文档（移入 03-development/）
├── reports/              ?? 报告（移入 04-testing/ 或 06-project-management/）
├── standards/            ?? 标准（移入 02-design/ 或 03-development/）
├── testing/              ?? 测试目录（与 04-testing/ 合并）
└── topics/               ?? 主题（移入 02-design/）
```

**docs/ 根级散落文件**：
- `23-core-docs-functional-match-report.json` → 移入 00-meta/
- `../../00-meta/cleanup-schedule.md` → 已有 07-archive/../../00-meta/cleanup-schedule.md，此根级为副本，删除
- `../../00-meta/GOVERNANCE.md` → 移入 00-meta/（或合并到现有 ../../00-meta/GOVERNANCE.md）
- `P1-P2落实追踪报告_2026-07-09.html` → 移入 docs/reports/ 或 06-project-management/
- `../../../README.md` → 保留（docs 目录入口）
- `../../00-meta/registry-index.md` → 已有 00-meta/../../00-meta/registry-index.md，此根级为副本，删除
- `v9-interaction-flows.html` → 移入 docs/reports/design/

---

## 四、可行性论证

### 4.1 可安全执行（低风险）

| 操作 | 风险 | 理由 |
|------|------|------|
| 清理 temp/*.log | ?? 无风险 | 日志文件无版本控制价值，无引用 |
| 清理 .workbuddy/*.log | ?? 无风险 | 工作日志，可重建 |
| 删除 coverage/.tmp | ?? 无风险 | 临时覆盖率数据 |
| 删除 docs/ 根级重复文件（../../00-meta/cleanup-schedule.md, registry-index.md） | ?? 无风险 | 子目录已有正式版本 |
| 移动 architecture.md → docs/02-design/ | ?? 无风险 | 无文件引用此路径 |
| 移动 overview.md → docs/01-requirements/ | ?? 无风险 | 无引用 |
| 移动 HTML 报告到 docs/reports/ | ?? 低风险 | 需更新内部链接（如存在） |

### 4.2 需谨慎执行（中等风险）

| 操作 | 风险 | 理由 |
|------|------|------|
| 合并 docs/standards/ → 02-design/ | ?? 中低 | 可能有外部链接引用 |
| 合并 docs/guides/ → 03-development/ | ?? 中低 | 可能有外部链接引用 |
| 合并 docs/audit/ → 04-testing/ | ?? 中等 | 报告文件可能被其他文档引用 |
| 整理 scripts/ 孤立脚本 | ?? 中等 | 脚本可能被手动调用，非 package.json 引用 |
| 整理 src/ 下测试文件 | ?? 中等 | 共置模式是 Vitest 推荐，迁移需改配置 |

### 4.3 不可执行（高风险）

| 操作 | 风险 | 理由 |
|------|------|------|
| 合并 ESLint 配置 | ?? 高风险 | 可能破坏 lint 规则，需单独测试 |
| 迁移 src/ 测试到 tests/ | ?? 高风险 | 194 个测试文件，需改 import 路径和 vitest 配置，工作量巨大 |
| 删除 .agents/ 或 .trae/ 文件 | ?? 高风险 | AI 工具运行时文件，可能正在使用 |
| 删除 build-artifacts/ 内容 | ?? 中低 | 可能为最近备份，需确认 |

---

## 五、执行优先级与阶段规划

基于可行性论证，将六阶段调整为以下执行顺序：

```
阶段 1：诊断报告（已完成）
    ↓
阶段 2A：安全清理（无风险）
    - 清理 temp/*.log + .workbuddy/*.log + coverage/.tmp
    - 删除 docs/ 根级重复文件
    - 移动根级 .md 到 docs/
    ↓
阶段 2B：文档迁移（低风险）
    - HTML 报告 → docs/reports/
    - 非 SDLC 目录整合（standards → 02-design, guides → 03-development）
    - docs/ 根级散落文件归位
    ↓
阶段 3：脚本治理（中等风险）
    - 孤立脚本分类标注
    - 废弃脚本移入 archive/
    - 保留脚本添加 README 说明
    ↓
阶段 4：经验教训萃取（知识沉淀）
    - 扫描 docs/audit/ 和 docs/reports/lessons-learned/
    - 生成结构化 lessons-learned.md
    ↓
阶段 5：MCP 固化（已完成）
    - Registry 已调整为 12 enabled / 6 disabled
    ↓
阶段 6：自动化机制
    - 添加 file:check 脚本到 package.json
    - 添加 Husky 钩子（白名单检查）
```

---

## 六、立即执行清单（阶段 2A + 2B）

### 2A-1：清理临时文件（无风险）

```bash
# 清理 temp/ 日志（保留最近7天）
find temp/ -name "*.log" -mtime +7 -delete

# 清理 .workbuddy/ 日志（保留最近7天）
find .workbuddy/ -name "*.log" -mtime +7 -delete

# 删除 coverage/.tmp
coverage/.tmp

# 删除 docs/ 根级重复文件
rm docs/../../00-meta/cleanup-schedule.md  # 已有 docs/07-archive/../../00-meta/cleanup-schedule.md
rm docs/registry-index.md     # 已有 docs/00-meta/registry-index.md
```

### 2A-2：迁移根级散落文件

```bash
# 移动根级 .md 到 docs/
mv architecture.md docs/02-design/
mv overview.md docs/01-requirements/

# 移动 HTML 报告到 docs/reports/
mv docs/P1-P2落实追踪报告_2026-07-09.html docs/reports/
mv docs/v9-interaction-flows.html docs/reports/design/
mv test-output/proofread-report.html docs/reports/test/
```

### 2B：非 SDLC 目录整合

| 源目录 | 目标目录 | 操作 |
|--------|---------|------|
| docs/standards/ | docs/02-design/standards/ | 移动 |
| docs/guides/ | docs/03-development/guides/ | 移动 |
| docs/audit/ | docs/04-testing/audit-reports/ | 移动 |
| docs/reports/ | docs/04-testing/reports/ + docs/06-project-management/reports/ | 按内容拆分 |
| docs/plans/ | docs/06-project-management/plans/ | 移动 |
| docs/changelogs/ | docs/06-project-management/changelogs/ | 移动 |
| docs/ops/ | docs/05-deployment/ops/ | 移动 |
| docs/blueprints/ | docs/02-design/blueprints/ | 移动 |
| docs/modules/ | docs/02-design/modules/ | 移动 |
| docs/topics/ | docs/02-design/topics/ | 移动 |
| docs/testing/ | docs/04-testing/ | 合并 |
| docs/.ai-index/ | docs/00-meta/ai-index/ | 移动 |
| docs/ai/ | docs/03-development/ai/ | 移动 |
| docs/drafts/ | docs/playground/ | 移动 |
| docs/implementation/ | docs/07-archive/implementation/ | 移动（过时截图） |
| docs/cockpit/ | docs/02-design/cockpit/ | 移动 |
| docs/assets/ | docs/assets/ | 保留（添加 README） |
| docs/architecture/ | docs/02-design/architecture/ | 移动 |
| docs/architecture-radar-v2/ | docs/02-design/architecture-radar/ | 移动 |
| docs/plugins/ | docs/03-development/plugins/ | 移动 |

---

## 七、验证清单（执行后）

- [ ] temp/ 目录只剩 7 天内日志（或完全清理）
- [ ] .workbuddy/*.log 清理至 7 天内
- [ ] coverage/.tmp 已删除
- [ ] docs/ 根级无重复文件（README.md 保留）
- [ ] architecture.md 和 overview.md 已移入 docs/
- [ ] 5 个 HTML 文件已分类到 docs/reports/
- [ ] 20 个非 SDLC 目录已整合到 SDLC 结构
- [ ] 每个 SDLC 子目录有 README.md
- [ ] npm run file:check 通过（阶段 6 添加）
- [ ] MCP Registry getStats() 返回 totalServers: 12
- [ ] 启动日志无 module not found 错误
- [ ] lessons-learned.md 已生成
