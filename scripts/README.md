# scripts/ 目录说明

> **最后更新**: 2026-07-13  
> **总脚本数**: ~120 个  
> **已接入 package.json**: ~78 个  
> **孤立脚本**: 42 个（已分类处理）  

---

## 已接入 package.json 的脚本（~78 个）

### 架构审计

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `audit-layer-calls.ts` | 架构分层调用审计（跨层调用检测） | `npm run audit:layers` |
| `audit-hardcode.ts` | 硬编码值扫描（颜色/数字/字符串） | `npm run audit:hardcode` |
| `audit-dead-code.ts` | 死代码检测（未使用导出/变量） | `npm run audit:deadcode` |
| `audit-atomic.ts` | 原子性审计（组件/Store 原子规范） | `npm run audit:atomic` |
| `audit-mapping-integrity.ts` | 映射完整性审计（路由/Store/组件映射） | `npm run audit:mapping-integrity` |
| `audit-execution-paths.ts` | 执行路径审计 | `npm run audit:execution-paths` |
| `audit-split-quality.ts` | 代码拆分质量审计 | `npm run audit:split-quality` |
| `audit-reserved-stores.ts` | 保留 Store 名称审计 | `npm run audit:reserved-stores` |
| `audit-component-usage.ts` | 组件使用审计 | `npm run audit:component-usage` |
| `directory-audit.ts` | 目录结构审计 | `npm run audit:directory` |
| `audit-dependencies.ts` | 依赖审计 | `npm run audit:dependencies` |

### 文档与规范审计

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `audit-doc-sync.ts` | 文档同步状态审计 | `npm run audit:docs` |
| `audit-version-drift.ts` | 版本漂移检测 | `npm run audit:docs`（联动） |
| `audit-doc-integrity.ts` | 文档完整性审计 | `npm run audit:doc-integrity` |
| `semantic-validation.ts` | 语义级校验（代码-文档匹配） | `npm run audit:semantic` |
| `audit-jsdoc.ts` | JSDoc 覆盖审计 | `npm run audit:jsdoc` |
| `doc-freshness-score.ts` | 文档新鲜度评分 | `npm run doc:freshness` |
| `doc-freshness-alert.ts` | 文档过期预警 | `npm run doc:freshness-alert` |
| `doc-version-check.ts` | 文档版本检查 | `npm run doc:version-check` |
| `doc-arch-version-compare.ts` | 架构版本对比 | `npm run doc:arch-version-compare` |
| `doc-dict-ast-extract.ts` | 文档字典 AST 提取 | `npm run doc:dict-extract` |
| `doc-update-trigger.ts` | 文档更新触发器 | `npm run doc:trigger` |
| `doc-cross-ref-sync.ts` | 文档交叉引用同步 | `npm run daily-doc:cross-ref` |
| `doc-version-history.ts` | 文档版本历史 | `npm run daily-doc:history` |
| `daily-doc-validation.ts` | 每日文档验证 | `npm run daily-doc:validate` |
| `doc-auto-updater.ts` | 文档自动更新器 | `npm run doc:auto-update` |

### 代码质量审计

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `audit-typography.ts` | 排版规范审计 | `npm run audit:typography` |
| `fix-typography-violations.ts` | 排版违规自动修复 | `npm run audit:fix-typography` |
| `audit-inline-colors.ts` | 内联颜色审计 | `npm run audit:inlineColors` |
| `audit-color-tokens.ts` | 颜色令牌合规审计 | `npm run audit:colorTokens` |
| `audit-spacing.ts` | 间距规范审计 | `npm run audit:spacing` |
| `audit-visual.ts` | 视觉回归审计 | `npm run audit:visual` |
| `a11y-contrast.cjs` | 无障碍对比度检查 | `npm run a11y:contrast` |
| `codeQualityAudit.cjs` | 代码质量综合审计 | `npm run audit:code-qualityAudit` |
| `complexity-scan.ts` | 复杂度扫描 | `npm run complexity-scan` |
| `measure-complexity-now.ts` | 实时复杂度测量 | `npm run measure:complexityNow` |
| `detect-duplicate-tests.ts` | 重复测试检测 | `npm run detect:duplicateTests` |

### 系统健康与监控

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `system-health-dashboard.ts` | 系统健康仪表盘 | `npm run system:health` |
| `system-check-loop.ts` | 系统检查循环 | `npm run system:check-loop` |
| `anomaly-detector.ts` | 异常检测（偏离基线） | `npm run anomaly:detect` |
| `audit-trend-monitor.ts` | 趋势监控审计 | `npm run audit:trend` |
| `build-health-report.ts` | 构建健康报告 | `npm run build:health` |
| `audit-ai-output.ts` | AI 输出质量审计 | `npm run audit:ai-output` |
| `audit-tests.ts` | 测试质量审计 | `npm run audit:tests` |
| `audit-token-consumption.ts` | Token 消耗审计 | `npm run audit:token` |

### 路由与数据验证

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `verify-all-routes.ts` | 全路由验证 | `npm run audit:routes` |
| `validate-data-blueprint.ts` | 数据蓝图验证 | `npm run validate:blueprint` |
| `validate-data-consistency.ts` | 数据一致性验证 | `npm run validate:dataConsistency` |
| `validate-json.ts` | JSON Schema 验证 | `npm run validate:json` |
| `validate-acl-impact.ts` | ACL 影响验证 | `npm run validate:aclImpact` |
| `verify-pipeline-output.ts` | 流水线输出验证 | `npm run verify:pipelineOutput` |
| `verify-design-tokens.ts` | 设计令牌验证 | `npm run verify:tokens` |

### 构建与生成

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `build-ai-memory-index.ts` | 构建 AI 记忆索引 | `npm run build:ai-memory` |
| `query-ai-memory.ts` | 查询 AI 记忆索引 | `npm run query:ai-memory` |
| `generate-store-graph.ts` | 生成 Store 依赖图 | `npm run generate:storeGraph` |
| `generate-tech-debt-report.ts` | 生成技术债务报告 | `npm run generate:techDebtReport` |
| `generate-pdf-report.ts` | 生成 PDF 报告 | `npm run generate:pdfReport` |
| `scaffold-widget.ts` | Widget 脚手架生成 | `npm run scaffold:widget` |
| `create-mcp-server.ts` | MCP 服务器创建 | `npm run create:mcp-server` |

### 修复与补丁

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `fix-p0-violations.ts` | P0 违规自动修复 | `npm run audit:fix-p0` |
| `fix-layer-violations.ts` | 分层违规修复 | `npm run fix:layerViolations` |
| `fix-silent-fallback.ts` | 静默回退修复 | `npm run fix:silentFallback` |
| `optimize-silent-fallback.ts` | 静默回退优化 | `npm run optimize:silentFallback` |
| `auto-fix-jsdoc.ts` | JSDoc 自动修复 | `npm run auto:jsdoc` |
| `dedup-jsdoc.ts` | JSDoc 去重 | `npm run dedup:jsdoc` |
| `patch-error-handling.ts` | 错误处理补丁 | — |
| `patch-error-handling-dynamic.ts` | 动态错误处理补丁 | — |

### 发布与变更管理

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `release-changelog-bump.ts` | 发布日志版本提升 | `npm run release:changelog-bump` / `postversion` |
| `changelog-query.ts` | 变更日志查询 | `npm run changelog:query` / `changelog:summary` |
| `lessons-learned.ts` | 经验教训总结 | `npm run lessons:learned` |
| `pre-review-check.ts` | 预审查检查 | `npm run pre-review` |
| `inject-frontmatter.ts` | Markdown 前置元数据注入 | `npm run inject:frontmatter` |
| `translate-test-descriptions.ts` | 测试描述翻译 | `npm run translate:testDescriptions` |
| `split-constants.ts` | 常量拆分 | `npm run split:constants` |
| `replace-date-now-ids.ts` | 替换 Date.now() ID | `npm run replace:dateNowIds` |

### 流水线工具

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `_audit-pipeline.ts` | 审计脚本共享管道工具 | `npm run pipeline:audit` |
| `_verify-pipeline-child.ts` | 流水线子进程验证 | `npm run pipeline:verify-child` |
| `check-types.sh` | 类型检查 Shell 脚本 | `npm run script:checkTypes` |
| `batch-test-runner.sh` | 批量测试运行器 | `npm run script:batchTestRunner` |
| `quick-query.sh` | 快速查询 Shell 脚本 | `npm run script:quickQuery` |

### 令牌调试

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `token-scan.cjs` | 令牌扫描 | `npm run audit:tokens` |
| `token-debug.cjs` | 令牌调试 | `npm run token:debug` |
| `token-debug-size.cjs` | 令牌尺寸调试 | `npm run token:debugSize` |
| `token-debug-hex.cjs` | 令牌 HEX 调试 | `npm run token:debugHex` |

### 测试辅助

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `test-stock-color-debug.ts` | 股票颜色调试测试 | `npm run test:stockColorDebug` |
| `test-news-v6.cjs` | News v6 测试 | `npm run test:newsV6` |
| `test-hybrid-proofread.ts` | 混合校对测试 | `npm run test:hybridProofread` |
| `regression-test.mjs` | 回归测试 | `npm run regression:Test` |
| `regression_news_v6_test.cjs` | News v6 回归测试 | `npm run regression:_news_v6_test` |

### 图分析与提取

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `extract-code-graph.ts` | 代码依赖图提取 | `npm run extract:codeGraph` |
| `analyze-code-graph.cjs` | 代码图分析 | `npm run analyze:codeGraph` |
| `extract-violations.cjs` | 违规提取 | `npm run extract:violations` |

### 工作流与规则

| 脚本 | 用途 | 调用方式 |
|------|------|---------|
| `workflow-rule-engine.ts` | 工作流规则引擎 | `npm run workflow:decide` |

---

## 孤立脚本（42 个）— 按类别组织

> 以下脚本**未在 package.json 的 `scripts` 字段中注册**，按治理策略分类处理。

### 临时工具（`_` 前缀，保留）

| 脚本 | 用途 | 何时使用 |
|------|------|---------|
| `_cmp.cjs` | 组件对比工具 | 临时调试组件差异 |
| `_cx_filter.cjs` | 复杂条件过滤器 | 临时数据过滤 |
| `_debug_hash.py` | 哈希调试 | 调试哈希计算问题 |
| `_debug_url.py` | URL 调试 | 调试 URL 路由问题 |
| `_dupq.cjs` | 重复查询检测 | 临时检测重复查询 |
| `_extract_d4.cjs` | D4 数据提取 | 临时提取 D4 维度数据 |
| `_smoke_playwright.py` | Playwright 冒烟测试 | 快速验证 E2E 环境 |

### 部署/运维（保留）

| 脚本 | 用途 | 何时使用 |
|------|------|---------|
| `check-types.ps1` | PowerShell 类型检查 | Windows CI 环境 |
| `check-types.sh` | Bash 类型检查 | Linux/macOS CI 环境 |
| `deploy-rectification-toolkit.ts` | 整改工具包部署 | 向新项目部署整改工具包 |
| `git-push-with-retry.ps1` | Git 推送重试 | 网络不稳定时的推送保护 |
| `rotate-ark-api-key.ps1` | Ark API Key 轮换 | API Key 定期轮换 |
| `run_browser_test.ps1` | 浏览器测试运行 | Windows 浏览器测试 |
| `stress-test-realtime-quotes.sh` | 实时行情压力测试 | 验证行情推送性能 |

### 调试/验证（保留）

| 脚本 | 用途 | 何时使用 |
|------|------|---------|
| `audit-path-match.mjs` | 文档目录-内容匹配审计（MJS 版） | 验证文档目录结构合规 |
| `audit-path-match.ts` | 文档目录-内容匹配审计（TS 版） | 验证文档目录结构合规 |
| `browser_verify_agent_b.py` | 浏览器 Agent B 验证 | 验证浏览器自动化 Agent |
| `test_browser.py` | 浏览器测试 | Python 浏览器环境测试 |
| `test_connectivity.py` | 连通性测试 | 测试外部服务连通性 |
| `test_diag.py` | 诊断测试 | 运行基础诊断 |
| `test_file.py` | 文件系统测试 | 验证文件 IO 操作 |
| `verify-m1.ts` | 验收 M1（RAG 向量检索） | M1 里程碑验收 |
| `verify-m2-m3.ts` | 验收 M2/M3（校验关/v6 因子） | M2/M3 里程碑验收 |

### 数据处理/分析（评估后接入）

| 脚本 | 用途 | 何时使用 |
|------|------|---------|
| `batch-add-jsdoc.ts` | 批量补齐 JSDoc 缺失 | 基于 audit-jsdoc 报告批量修复 |
| `batch-fix-tsc.ts` | 批量修复 tsc 错误 | 批量修复 TypeScript 类型错误 |
| `cleanup-reports.ts` | 清理过期自动产物 | 定期清理报告/覆盖率/构建目录 |
| `file-dedup-scan.mjs` | 文件去重扫描 | 识别完全相同及命名近似碰撞文件 |
| `gen-cleanup-list.py` | 生成清理清单 | 列出测试/构建产物待删项 |
| `generate-doc-list-simple.ts` | 生成简单文档更新清单 | 全量扫描生成符号缺失清单 |
| `generate-doc-update-list.ts` | 生成文档更新清单（增强版） | 全量扫描 + Markdown 草稿导出 |
| `generate-rectification-pdf.ts` | 生成整改报告 PDF | 输出系统整改完成报告 |
| `generate_data_link_diagram.py` | 数据链路图生成 | 可视化数据流向 |
| `llm-doc-generator.ts` | LLM 辅助文档更新生成 | 基于语义校验自动生成文档草稿 |
| `p1-1-migrate.py` | P1-1 迁移脚本 | 执行特定版本数据迁移 |
| `pitfall_check.py` | 陷阱检查 | 扫描常见代码陷阱 |
| `regression_news_v6.py` | News v6 回归分析 | News v6 模块回归验证 |
| `regression_news_v6_test.cjs` | News v6 回归测试（CJS） | News v6 回归测试入口 |

### 其他（保留）

| 脚本 | 用途 | 何时使用 |
|------|------|---------|
| `compare-visual-baselines.sh` | 视觉基线对比 | 比较视觉回归基线 |
| `run-with-log.ts` | 带日志捕获的脚本执行器 | 自动保存脚本输出到 docs/drafts/ |

### 已归档（移至 `archive/scripts/`）

| 脚本 | 用途 | 归档原因 |
|------|------|---------|
| `doc-notify.ts` | 文档变更通知 | 功能被 `doc-auto-updater.ts` 覆盖 |
| `doc-pipeline.ts` | 文档处理管道 | 功能被 `doc-auto-updater.ts` 覆盖 |
| `doc-retry.ts` | 文档操作重试 | 功能被 `doc-auto-updater.ts` 覆盖 |

> **归档说明**: 上述 3 个脚本的功能已被 `doc-auto-updater.ts` 统一覆盖，不再单独维护。如需恢复，可从 `archive/scripts/` 还原。

---

## 脚本治理策略

| 类别 | 策略 | 数量 |
|------|------|------|
| 临时工具（`_` 前缀） | 保留，按需使用 | 7 |
| 部署/运维 | 保留，CI/CD 备用 | 7 |
| 调试/验证 | 保留，里程碑验收用 | 9 |
| 数据处理 | 评估后接入审计流水线 | 14 |
| 其他 | 保留，特定场景使用 | 2 |
| 已归档 | 移至 `archive/scripts/` | 3 |

---

## 新增脚本 SOP

1. **创建脚本** → 在 `scripts/` 目录下新建文件
2. **添加注释头部** → 使用标准 JSDoc 头部（含 `@file`、`@description`、`@status`）
3. **注册到 package.json** → 在 `scripts` 字段添加 `npm run xxx` 入口
4. **更新本 README** → 在对应分类表中添加一行
5. **更新分类目录 README** → 在对应分类目录（`audit/`、`verify/`、`generate/`、`fix/`、`build/`、`docs-tool/`、`migrate/`、`monitor/`、`quality/`、`security/`、`test-tool/`、`other/`）的 README 中添加条目
6. **验证** → 运行 `npx tsc --noEmit` 确保类型安全

---

## 分类目录结构

> **说明**: 由于根目录脚本包含内部相对路径引用（如 `../src/config/routes.ts`、`./_debug/_audit-pipeline`），直接移动脚本会导致路径失效。因此采用**文档化分类方案**：保持根级别文件位置不变，通过分类目录中的 README.md 进行逻辑分类。

| 分类目录 | 说明 | 脚本数量 |
|----------|------|----------|
| `audit/` | 审计脚本（代码质量、架构规范、文档完整性等） | ~30 |
| `verify/` | 验证脚本（路由验证、数据一致性、接口契约等） | ~10 |
| `generate/` | 生成脚本（代码、文档、报告、配置等） | ~8 |
| `fix/` | 修复脚本（代码违规、文档问题、配置错误等） | ~10 |
| `build/` | 构建脚本（项目产物、索引、报告等） | ~3 |
| `docs-tool/` | 文档工具脚本（文档管理、验证、同步、更新等） | ~14 |
| `migrate/` | 迁移脚本（数据迁移、文档迁移、代码迁移等） | ~2 |
| `monitor/` | 监控脚本（系统健康、异常检测、趋势分析等） | ~5 |
| `quality/` | 质量脚本（代码质量评估、复杂度分析等） | ~4 |
| `security/` | 安全脚本（安全审计、ACL 验证、安装策略等） | ~7 |
| `test-tool/` | 测试工具脚本（测试运行、压力测试等） | ~12 |
| `other/` | 其他脚本（未归类的辅助工具） | ~30 |

### 目录结构示意

```
scripts/
├── audit/              # 审计脚本
│   ├── docs/           # 审计报告输出
│   ├── _debug/         # 调试工具（内部引用）
│   └── README.md       # 分类说明文档
├── verify/             # 验证脚本
│   ├── _debug/
│   └── README.md
├── generate/           # 生成脚本
│   ├── _debug/
│   └── README.md
├── fix/                # 修复脚本
│   ├── _debug/
│   └── README.md
├── build/              # 构建脚本
│   ├── _debug/
│   └── README.md
├── docs-tool/          # 文档工具脚本
│   ├── _debug/
│   └── README.md
├── migrate/            # 迁移脚本
│   ├── _debug/
│   └── README.md
├── monitor/            # 监控脚本
│   ├── _debug/
│   └── README.md
├── quality/            # 质量脚本
│   ├── _debug/
│   └── README.md
├── security/           # 安全脚本
│   ├── _debug/
│   └── README.md
├── test-tool/          # 测试工具脚本
│   ├── _debug/
│   └── README.md
├── other/              # 其他脚本
│   └── README.md
├── _debug/             # 根级别调试工具
├── README.md           # 总目录说明
└── *.ts                # 实际执行脚本（保留在根目录）
```

### 为什么采用文档化分类？

**风险评估**：
- **高风险操作**：直接移动脚本文件会导致内部相对路径引用失效（如 `../src/config/routes.ts`、`./_debug/_audit-pipeline`）
- **影响范围**：涉及 ~120 个脚本文件，部分脚本被 CI/CD 流水线和 npm scripts 引用
- **回滚成本**：需要同步更新 package.json 和所有引用路径

**解决方案**：
- **逻辑分类**：通过分类目录中的 README.md 进行逻辑分类，不改变文件物理位置
- **兼容性保障**：所有现有引用路径保持有效
- **渐进式改进**：后续可逐步重构脚本中的相对路径引用，实现物理分类
