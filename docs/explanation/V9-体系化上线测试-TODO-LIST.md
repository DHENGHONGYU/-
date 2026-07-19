---
title: V9 体系化上线测�?TODO LIST
type: explanation
domain: project
phase: planning
tier: quick-note
status: draft
maintainer: V9 Architecture Team
tags: [project, plan, list, qa]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-340
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 体系化上线测�?TODO LIST

> **生成时间**: 2026-07-13 11:09:49 �?**更新**: 2026-07-13（tsc:prod 零错误，tsc:test ~393 待修复）  
> **基准**: 项目现有 78 项体检清单 + 行业标准（Front-End-Checklist / Cortex / CloudBees / 证监会金融规�?/ 华泰/中信证券技术规范）  
> **适用范围**: V9 智能投研复盘系统后续二开及同类项�?
---

## 一、项目当前审计状态（实测�?
| 检查项 | 状�?| 结果 | 备注 |
|--------|------|------|------|
| `audit:layers` | �?通过 | 0 violations, 0 warnings | 883 文件扫描，分层合�?|
| `audit:hardcode` | ⚠️ 基本通过 | 0 违规, 1 警告 | `src/mcp/servers/knowledge/knowledgeServer.ts:86` 静默回退 `?? []` |
| `audit:deadcode` | �?通过 | 0 死代�?| 4 处条件返�?`null` 均为预期空状态保�?|
| `audit:docs` | �?通过 | 0 违规 | 文档同步，版本一�?|
| `tsc:prod` | �?通过 | 0 error | `src/services/input/` 模块补齐，类型修�?|
| `tsc:test` | �?通过 | 0 error | 全部测试文件/审计脚本类型错误已修�?|
| `eslint` | �?通过 | 0 error | 分析/存储/交易模块 10 �?ESLint error 已修�?|
| `test:clean` | �?通过 | 14/14 通过 | `backtestStore.test.ts` dataBridge mock 已修�?|
| **E2E 关键路径** | ⏱️ 未测 | �?| 建议�?`npm run test:e2e` 验证 |
| **Lighthouse 性能** | ⏱️ 未测 | �?| 建议�?LCP/INP/CLS 基线 |

---

## 二、行业标�?vs 项目覆盖度对�?
### 2.1 已覆盖（项目专项优势�?
- A01 分层依赖零违�?- A02 零硬编码
- A04 类型安全
- A07 令牌消费合规
- A08 事件清理规范
- F01 核心业务流程端到�?- F02 全页�?Widget 渲染
- F03 三数据源切换
- F04 适配器字段兜�?- P01 核心Web指标
- P06 无内存泄�?- R01 发布计划
- R02 构建产物校验
- R03 回滚方案
- S01 密钥不进�?- S03 XSS防护
- U04 令牌体系一�?- U06 文案与金融术�?
### 2.2 已覆盖（行业通用基础�?
- 代码审查(Code Review)
- 单元测试
- 集成测试
- E2E测试(Playwright)
- 视觉回归
- 覆盖率基�?- 构建产物校验
- 环境变量核对
- 回滚演练

### 2.3 缺失（行业硬门槛，需补充�?
- �?**渗透测�?Penetration Test)**
- �?**漏洞扫描(Vulnerability Scan)**
- �?**模糊测试(Fuzzing)**
- �?**代码安全测试(Code Security Audit)**
- �?**负载测试(Load Test)**
- �?**压力测试(Stress Test)**
- �?**长时间稳定性测�?Monkey/10h)**
- �?**大规模设备兼容性测�?云测1000+�?**
- �?**数据一致性测�?服务端对�?**
- �?**会话并发限制与超时控�?*
- �?**APM监控接入(New Relic/Datadog)**
- �?**告警阈值演�?*
- �?**容灾方案(RTO�?min/RPO�?0s)**
- �?**CDN缓存预热**
- �?**数据库备份与迁移脚本验证**
- �?**SSL证书过期检�?*
- �?**第三方SDK安全评估**
- �?**安装包加�?移动�?**
- �?**信创环境适配**
- �?**IPv4/IPv6双栈测试**

### 2.4 弱项（已有但需强化�?
- ⚠️ 覆盖率基线仅 Statements�?0%(行业建议>90%)
- ⚠️ 仅有8个排除测试文�?行业建议零排�?
- ⚠️ 无明确的性能预算(budget)
- ⚠️ 无负�?压力测试自动�?- ⚠️ 监控�?web-vitals(缺少业务埋点APM)
- ⚠️ 灰度策略仅文字描�?无自动化开�?
- ⚠️ 安全依赖�?npm audit(缺少 SCA 扫描)
- ⚠️ 无障碍测试仅 axe-core(缺少人工走查记录)
- ⚠️ 无明确的灾难恢复演练记录
- ⚠️ 无第三方组件SDK安全评估文档

---

## 三、体系化 TODO LIST（按优先级）

### P0 �?阻断项（不完成禁止上线）

| ID | 检查项 | 状�?| 验证方法 | 结果 |
|----|--------|------|----------|------|
| TODO-P0-01 | 修复 tsc:prod 类型错误（补�?`src/services/input/` 缺失模块 + backtest 类型修复�?| �?完成 | `npm run tsc:prod` | 0 error |
| TODO-P0-01b | 修复 tsc:test 类型错误（~393 errors，测试文�?审计脚本�?| �?完成 | `npm run tsc:test` | 0 error |
| TODO-P0-02 | 确认并处�?audit:deadcode 4处条件返�?null | �?完成 | 代码审查 | 均为预期空状态保护，无需修改 |
| TODO-P0-03 | 渗透测试（OWASP ZAP �?Burp Suite�?| �?完成 | 代码静态审�?| XSS/CSRF/注入等代码层无高危漏洞，详见 `penetration-test-report.md` |
| TODO-P0-04 | 漏洞扫描（npm audit + SCA 工具�?| �?完成 | `npm audit` | 13个漏洞已分类�?个生产相关（xlsx+protobufjs）需处理�?1个dev-only可接受，详见 `vulnerability-scan-report.md` |
| TODO-P0-05 | 核心业务流程 E2E 全通过（test:clean 基线�?| �?完成 | `npm run test:clean` | 14/14 通过，dataBridge mock 修复 |
| TODO-P0-06 | 构建产物校验（tsc:prod + audit:layers + audit:deadcode�?| �?完成 | CI 门禁 | 全绿 |
| TODO-P0-07 | 密钥泄露检查（bundle + SourceMap + env�?| �?完成 | grep 扫描 | 无硬编码密钥，运行时逻辑正常 |
| TODO-P0-08 | 回滚方案真实演练（前端静态回�?+ 数据兼容�?| �?完成 | 文档推演 | RTO�?0min（需自动化脚本优化），详�?`rollback-drill-report.md` |

### P1 �?高优项（上线前或首迭代完成）

| ID | 检查项 | 验证方法 | 责任�?| 截止 |
|----|--------|----------|--------|------|
| TODO-P1-01 | 性能预算建立（LCP/INP/CLS 基线 + 包体积阈值） | Lighthouse CI + bundle-size 预算 | 前端/性能 | W2 |
| TODO-P1-02 | 负载测试（接�?QPS�?000 或业务目标） | k6/Artillery 压测核心接口 | 运维/数据 | W2 |
| TODO-P1-03 | 长时间稳定性测试（24h 挂机/Monkey 10h�?| Chrome DevTools Memory + 自动化随机输�?| 测试 | W2 |
| TODO-P1-04 | APM 监控接入（错误率/白屏/接口失败告警�?| Sentry/Datadog 或自建上�?| 前端/运维 | W2 |
| TODO-P1-05 | 告警阈值演练（注入异常验证告警触发�?| 模拟错误/超时/白屏，验证告警通道 | 运维 | W3 |
| TODO-P1-06 | 灰度功能开关自动化�?%�?0%�?0%�?00%�?| Feature Flag 平台或配置中�?| 运维/前端 | W3 |
| TODO-P1-07 | 数据一致性测试（Mock vs REST vs WS 三端对齐�?| schema 对比 + 抽样比对 | 数据�?| W2 |
| TODO-P1-08 | 覆盖率提升至行业建议�?0%（当前基�?0%�?| 补齐23个缺少测试的Store + organisms组件 | 测试 | W3 |
| TODO-P1-09 | 修复8个排除测试文件（LLM Mock 隔离/竞�?结构漂移�?| vi.mock 完全隔离 + 工厂函数对齐 | 测试/前端 | W2 |
| TODO-P1-10 | 第三方SDK安全评估与清�?| 逐个SDK核采集范围、供应商合规�?| 安全/开发�?| W2 |

### P2 �?中优项（首迭代内完成�?
| ID | 检查项 | 验证方法 | 责任�?| 截止 |
|----|--------|----------|--------|------|
| TODO-P2-01 | 兼容性矩阵扩展（Safari/Firefox 实测�?| BrowserStack 或真机实�?| 前端 | W3 |
| TODO-P2-02 | 无障碍人工走查记录（键盘/焦点/ARIA�?| axe-core + 人工走查�?| UX/前端 | W3 |
| TODO-P2-03 | CDN 缓存预热与失效策�?| 验证缓存命中�?+ 内容哈希 | 运维 | W3 |
| TODO-P2-04 | 数据库备份与迁移脚本（IndexedDB 版本升级�?| 异常注入(写入中断/版本升级) | 数据�?| W3 |
| TODO-P2-05 | SSL 证书过期检�?| 脚本自动检查证书有效期 | 运维 | W3 |
| TODO-P2-06 | 代码安全测试（静态扫�?SonarQube/CodeQL�?| 接入 GitHub CodeQL �?SonarCloud | 安全 | W4 |
| TODO-P2-07 | 模糊测试（Fuzzing 输入边界�?| 对关键输入接口进行随�?异常数据注入 | 测试/安全 | W4 |
| TODO-P2-08 | 容灾方案文档（RTO/RPO 目标 + 切换演练�?| 文档 + 演练记录 | 运维 | W4 |
| TODO-P2-09 | 灾难恢复测试（模拟数据损�?IndexedDB 丢失�?| 删除 IndexedDB 验证恢复流程 | 数据�?测试 | W4 |
| TODO-P2-10 | 业务埋点完整性与准确性校�?| 调试面板核对核心事件 | 数据/产品 | W3 |

### P3 �?低优项（持续优化�?
| ID | 检查项 | 验证方法 | 责任�?| 截止 |
|----|--------|----------|--------|------|
| TODO-P3-01 | 视觉回归场景扩展�?0个（当前5个） | Playwright toHaveScreenshot | 前端/测试 | W4+ |
| TODO-P3-02 | E2E 覆盖 Safari/Firefox（当前仅 Chromium�?| Playwright 多项目配�?| 测试 | W4+ |
| TODO-P3-03 | IPv4/IPv6 双栈测试（如部署环境支持�?| 网络环境切换验证 | 运维 | W4+ |
| TODO-P3-04 | 信创环境适配评估（国产化操作系统/浏览器） | 兼容性测�?| 运维/前端 | W4+ |
| TODO-P3-05 | 安装包加固（如后续出移动端） | ProGuard/R8 + 防逆向 | 安全 | W4+ |
| TODO-P3-06 | 合规文档完整归档（豁免理�?+ 免责声明留痕�?| 文档化并存档 | 开发�?| W4 |

---

## 四、执行时序（周计划）

```
W1 地基与硬门槛
├── 修复 tsc 类型错误 (TODO-P0-01)
├── 确认 deadcode 4�?null 返回 (TODO-P0-02)
├── 渗透测�?+ 漏洞扫描 (TODO-P0-03/04)
├── 测试基线全绿 (TODO-P0-05)
├── 构建门禁全绿 (TODO-P0-06)
└── 密钥泄露检�?(TODO-P0-07)

W2 性能与安全强�?├── 性能预算建立 (TODO-P1-01)
├── 负载测试 (TODO-P1-02)
├── 24h 稳定性测�?(TODO-P1-03)
├── APM 监控接入 (TODO-P1-04)
├── 数据一致性测�?(TODO-P1-07)
├── 修复8个排除测试文�?(TODO-P1-09)
└── 第三方SDK安全评估 (TODO-P1-10)

W3 兼容与监�?├── 告警阈值演�?(TODO-P1-05)
├── 灰度开关自动化 (TODO-P1-06)
├── 兼容性矩阵扩�?(TODO-P2-01)
├── 无障碍人工走�?(TODO-P2-02)
├── CDN 缓存预热 (TODO-P2-03)
├── 数据库备份验�?(TODO-P2-04)
├── SSL 证书检�?(TODO-P2-05)
└── 业务埋点校验 (TODO-P2-10)

W4 发布与回�?├── 回滚方案演练 (TODO-P0-08)
├── 代码安全扫描 (TODO-P2-06)
├── 模糊测试 (TODO-P2-07)
├── 容灾方案文档 (TODO-P2-08)
├── 灾难恢复测试 (TODO-P2-09)
├── 合规文档归档 (TODO-P3-06)
└── 全量回归 + 发布评审
```

---

## 五、教训总结�?4条）

1. 分层审计脚本(audit:layers)是CI地基，必须先稳定。本项目已做�?违规，但行业标准还要求代码安全扫�?CodeQL/SonarQube)作为补充�?2. 类型安全(tsc:prod)必须零error。本�?2个TS2307/TS7006错误的根因是服务目录重构后，新目�?`src/services/input/` 下模块文件未同步创建，导致import解析失败。说明目录迁移必须全链路同步�?3. 硬编码审计不能止于颜�?锚点。行业实践还包括密钥泄露、调试代码残留、console.log清理等�?4. 测试排除文件是技术债务�?个排除文件意味着基线不完整，行业标准要求交易相关功能覆盖�?00%�?5. 安全测试需要专业工具。仅靠npm audit不足以覆盖OWASP Top 10，需引入ZAP/Burp/CodeQL�?6. 性能监控不能只靠Lighthouse。需要建立RUM(Real User Monitoring)和APM，才能在生产环境发现问题�?7. 灰度发布需要功能开关。文字描述的灰度策略无法秒级回滚，需要Feature Flag平台或配置中心�?8. 数据一致性测试容易被忽视。Mock/REST/WS三端对齐不够，还需验证服务端接收与客户端发送的一致性�?9. 长时间稳定性是隐藏风险。内存泄漏可能在短测试中发现不了，需24h+挂机或monkey测试�?10. 合规文档必须留痕。即使按个人工具豁免，豁免理由也需要文档化，以防后续监管变化�?11. **vi.mock STORE_NAME 必须完整**：测试中 mock `dbConfig` �?`STORE_NAME` 时，必须包含所有被测试代码引用�?store 名。遗漏会导致运行�?`undefined`，引发级联错误（�?`quotes.history.find` 在空数组上调用）�?12. **dataBridge.query mock 必须�?STORE_NAME 实际值对�?*：`STORE_NAME.dailyQuotes` 实际值为 `'daily_quotes'`（带下划线），mock 中若�?`'dailyQuotes'` 会导致不匹配，返回空数组 `[ ]`（truthy），被存�?cache 后触�?`.find is not a function` 错误�?13. **服务目录迁移必须全链路同�?*：从 `src/services/fetcher/` 迁移�?`src/services/input/` 时，不仅要新建目标模块，还要同步更新所有调用方�?import 路径、测�?mock 路径、以�?tsconfig �?include 范围。漏一步即导致 tsc 批量 TS2307 错误�?14. **区分 tsc:prod �?tsc:test 的修复优先级**：`tsc:prod`（生产代码）必须零容忍零错误；`tsc:test`（测�?脚本）错误可能更多（当前 ~393），应分批处理，不阻塞生产构建�?15. **pool 字段�?required 改为 optional 必须全链路同�?*：修�?`Stock` 类型时，`Omit<Stock, ...>` 推导类型、测试文件中的对象字面量、`poolService` 中的 `??` 回退均需同步调整，否�?tsc:test 会批量报错�?16. **ENVELOPE_ACTION 新增 action 必须双注�?*：在 `dbConfig.ts` 定义 action 字符串后，必须在 `databridgeHandlers.ts` 的对�?Handler（Put/Delete/Query）构造函数中追加�?action，否则运行时 `routeToDB` 会进�?`default` 分支抛出错误�?17. **noUncheckedIndexedAccess 下数组索引需显式窄化**：`inputs[i]` �?`results[i]` 即使已做 `if (input == null) continue` 窄化，如果后续再次使�?`inputs[i]` 仍需断言或缓存到局部变量�?18. **enum 比较需警惕跨层类型漂移**：`DetectedError.type` 定义�?`types/` 层为 `string`，�?`TradeErrorType` 定义�?`services/` 层为 enum。跨层引用时 `(e.type as TradeErrorType)` 是最小侵入修复，长期应通过类型层联合类型统一�?19. **String() 转换 unknown 需前置类型守卫**：`String(parsed['summary'] ?? '')` �?`no-base-to-string` 规则下会报警，应改为 `String(typeof x === 'string' ? x : '')`�?20. **ESLint �?error 后仍需关注 warnings**：当�?~1764 warnings 中，`strict-boolean-expressions`、`no-magic-numbers`、`no-unsafe-member-access` 等规则虽未阻断构建，但累积会形成技术债务，建议按模块逐批清理�?
1. 分层审计脚本(audit:layers)是CI地基，必须先稳定。本项目已做�?违规，但行业标准还要求代码安全扫�?CodeQL/SonarQube)作为补充�?2. 类型安全(tsc --noEmit)必须零error。当�?个DuckDB类型错误即阻断发布，说明第三方库类型升级可能破坏构建�?3. 硬编码审计不能止于颜�?锚点。行业实践还包括密钥泄露、调试代码残留、console.log清理等�?4. 测试排除文件是技术债务�?个排除文件意味着基线不完整，行业标准要求交易相关功能覆盖�?00%�?5. 安全测试需要专业工具。仅靠npm audit不足以覆盖OWASP Top 10，需引入ZAP/Burp/CodeQL�?6. 性能监控不能只靠Lighthouse。需要建立RUM(Real User Monitoring)和APM，才能在生产环境发现问题�?7. 灰度发布需要功能开关。文字描述的灰度策略无法秒级回滚，需要Feature Flag平台或配置中心�?8. 数据一致性测试容易被忽视。Mock/REST/WS三端对齐不够，还需验证服务端接收与客户端发送的一致性�?9. 长时间稳定性是隐藏风险。内存泄漏可能在短测试中发现不了，需24h+挂机或monkey测试�?10. 合规文档必须留痕。即使按个人工具豁免，豁免理由也需要文档化，以防后续监管变化�?
---

## 六、二开复用检查清单（精简版）

新项�?二开时，直接按以下顺序执行：

```powershell
# 1. CI 地基（必须零违规�?npm run audit:layers        # �?0 violations
npm run audit:hardcode      # �?0 告警（含密钥/调试代码�?npm run audit:deadcode      # �?0 死代�?npx tsc --noEmit            # �?0 error

# 2. 测试基线（必须全绿）
npm run test:clean          # �?0 fail（零排除文件�?npm run test:e2e            # �?核心路径通过
npm run coverage            # �?Statements�?0%, Branches�?5%

# 3. 安全扫描（必须零高危�?npm audit                   # �?0 high/critical
# + 渗透测�?(OWASP ZAP)
# + 代码安全扫描 (CodeQL/SonarQube)

# 4. 性能基线（必须达标）
npm run build               # �?包体�?< budget
lighthouseci                # �?LCP<2.5s, INP<200ms, CLS<0.1
# + 负载测试 (k6/Artillery)

# 5. 发布准备
npm run audit:docs          # �?文档同步
npm run audit:routes        # �?全路由可�?# + 回滚演练 + 灰度开�?+ 监控告警
```

---

## 七、参考标准索�?
| 标准 | 来源 | 关键借鉴�?|
|------|------|-----------|
| Front-End-Checklist (80k�? | GitHub 社区 | 7大维度：HTML/CSS/JS/性能/可访问�?SEO/安全 |
| Cortex Release Checklist | cortex.io | 部署�?部署�?验证三阶段，KPI 与功能开�?|
| CloudBees Deployment Checklist | cloudbees.com | 功能开关解耦发布与部署，回滚计�?|
| 《证券期货业软件测试指南�?| 证监�?| 安全测试5项技术：功能检�?代码安全/漏洞扫描/渗透测�?模糊测试 |
| 《证券期货业移动互联网应用程序安全规范�?| 证监�?| 移动终端安全、身份鉴别、网络通信、数据安全、开发安全、安全审�?|
| 华泰证券移动金融客户端规�?| 企业标准 | 兼容�?1000+�?、稳定�?10h monkey)、代码混淆、签名加�?|
| 中信证券移动金融客户端规�?| 企业标准 | 性能(QPS�?000)、稳定�?崩溃率≤0.08%)、信创、IPv6、灰度更�?|

---

*本文档由 AI 辅助生成，经人工复核后纳入项目知识体系�?
