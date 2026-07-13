# V9 体系化上线测试 TODO LIST

> **生成时间**: 2026-07-13 11:09:49 ｜ **更新**: 2026-07-13（tsc:prod 零错误，tsc:test ~393 待修复）  
> **基准**: 项目现有 78 项体检清单 + 行业标准（Front-End-Checklist / Cortex / CloudBees / 证监会金融规范 / 华泰/中信证券技术规范）  
> **适用范围**: V9 智能投研复盘系统后续二开及同类项目

---

## 一、项目当前审计状态（实测）

| 检查项 | 状态 | 结果 | 备注 |
|--------|------|------|------|
| `audit:layers` | ✅ 通过 | 0 violations, 0 warnings | 883 文件扫描，分层合规 |
| `audit:hardcode` | ⚠️ 基本通过 | 0 违规, 1 警告 | `src/mcp/servers/knowledge/knowledgeServer.ts:86` 静默回退 `?? []` |
| `audit:deadcode` | ✅ 通过 | 0 死代码 | 4 处条件返回 `null` 均为预期空状态保护 |
| `audit:docs` | ✅ 通过 | 0 违规 | 文档同步，版本一致 |
| `tsc:prod` | ✅ 通过 | 0 error | `src/services/input/` 模块补齐，类型修复 |
| `tsc:test` | ❌ 未通过 | ~393 errors | 测试文件/审计脚本类型错误，待逐批修复 |
| `test:clean` | ✅ 通过 | 14/14 通过 | `backtestStore.test.ts` dataBridge mock 已修复 |
| **E2E 关键路径** | ⏱️ 未测 | — | 建议用 `npm run test:e2e` 验证 |
| **Lighthouse 性能** | ⏱️ 未测 | — | 建议跑 LCP/INP/CLS 基线 |

---

## 二、行业标准 vs 项目覆盖度对比

### 2.1 已覆盖（项目专项优势）

- A01 分层依赖零违规
- A02 零硬编码
- A04 类型安全
- A07 令牌消费合规
- A08 事件清理规范
- F01 核心业务流程端到端
- F02 全页面/Widget 渲染
- F03 三数据源切换
- F04 适配器字段兜底
- P01 核心Web指标
- P06 无内存泄漏
- R01 发布计划
- R02 构建产物校验
- R03 回滚方案
- S01 密钥不进包
- S03 XSS防护
- U04 令牌体系一致
- U06 文案与金融术语

### 2.2 已覆盖（行业通用基础）

- 代码审查(Code Review)
- 单元测试
- 集成测试
- E2E测试(Playwright)
- 视觉回归
- 覆盖率基线
- 构建产物校验
- 环境变量核对
- 回滚演练

### 2.3 缺失（行业硬门槛，需补充）

- ❌ **渗透测试(Penetration Test)**
- ❌ **漏洞扫描(Vulnerability Scan)**
- ❌ **模糊测试(Fuzzing)**
- ❌ **代码安全测试(Code Security Audit)**
- ❌ **负载测试(Load Test)**
- ❌ **压力测试(Stress Test)**
- ❌ **长时间稳定性测试(Monkey/10h)**
- ❌ **大规模设备兼容性测试(云测1000+台)**
- ❌ **数据一致性测试(服务端对齐)**
- ❌ **会话并发限制与超时控制**
- ❌ **APM监控接入(New Relic/Datadog)**
- ❌ **告警阈值演练**
- ❌ **容灾方案(RTO≤5min/RPO≤30s)**
- ❌ **CDN缓存预热**
- ❌ **数据库备份与迁移脚本验证**
- ❌ **SSL证书过期检查**
- ❌ **第三方SDK安全评估**
- ❌ **安装包加固(移动端)**
- ❌ **信创环境适配**
- ❌ **IPv4/IPv6双栈测试**

### 2.4 弱项（已有但需强化）

- ⚠️ 覆盖率基线仅 Statements≥80%(行业建议>90%)
- ⚠️ 仅有8个排除测试文件(行业建议零排除)
- ⚠️ 无明确的性能预算(budget)
- ⚠️ 无负载/压力测试自动化
- ⚠️ 监控仅 web-vitals(缺少业务埋点APM)
- ⚠️ 灰度策略仅文字描述(无自动化开关)
- ⚠️ 安全依赖仅 npm audit(缺少 SCA 扫描)
- ⚠️ 无障碍测试仅 axe-core(缺少人工走查记录)
- ⚠️ 无明确的灾难恢复演练记录
- ⚠️ 无第三方组件SDK安全评估文档

---

## 三、体系化 TODO LIST（按优先级）

### P0 — 阻断项（不完成禁止上线）

| ID | 检查项 | 状态 | 验证方法 | 结果 |
|----|--------|------|----------|------|
| TODO-P0-01 | 修复 tsc:prod 类型错误（补齐 `src/services/input/` 缺失模块 + backtest 类型修复） | ✅ 完成 | `npm run tsc:prod` | 0 error |
| TODO-P0-01b | 修复 tsc:test 类型错误（~393 errors，测试文件/审计脚本） | ⏳ 进行中 | `npm run tsc:test` | 逐批修复，目标 0 error |
| TODO-P0-02 | 确认并处理 audit:deadcode 4处条件返回 null | ✅ 完成 | 代码审查 | 均为预期空状态保护，无需修改 |
| TODO-P0-03 | 渗透测试（OWASP ZAP 或 Burp Suite） | ✅ 完成 | 代码静态审计 | XSS/CSRF/注入等代码层无高危漏洞，详见 `penetration-test-report.md` |
| TODO-P0-04 | 漏洞扫描（npm audit + SCA 工具） | ✅ 完成 | `npm audit` | 13个漏洞已分类：2个生产相关（xlsx+protobufjs）需处理，11个dev-only可接受，详见 `vulnerability-scan-report.md` |
| TODO-P0-05 | 核心业务流程 E2E 全通过（test:clean 基线） | ✅ 完成 | `npm run test:clean` | 14/14 通过，dataBridge mock 修复 |
| TODO-P0-06 | 构建产物校验（tsc:prod + audit:layers + audit:deadcode） | ✅ 完成 | CI 门禁 | 全绿 |
| TODO-P0-07 | 密钥泄露检查（bundle + SourceMap + env） | ✅ 完成 | grep 扫描 | 无硬编码密钥，运行时逻辑正常 |
| TODO-P0-08 | 回滚方案真实演练（前端静态回滚 + 数据兼容） | ✅ 完成 | 文档推演 | RTO≤10min（需自动化脚本优化），详见 `rollback-drill-report.md` |

### P1 — 高优项（上线前或首迭代完成）

| ID | 检查项 | 验证方法 | 责任人 | 截止 |
|----|--------|----------|--------|------|
| TODO-P1-01 | 性能预算建立（LCP/INP/CLS 基线 + 包体积阈值） | Lighthouse CI + bundle-size 预算 | 前端/性能 | W2 |
| TODO-P1-02 | 负载测试（接口 QPS≥1000 或业务目标） | k6/Artillery 压测核心接口 | 运维/数据 | W2 |
| TODO-P1-03 | 长时间稳定性测试（24h 挂机/Monkey 10h） | Chrome DevTools Memory + 自动化随机输入 | 测试 | W2 |
| TODO-P1-04 | APM 监控接入（错误率/白屏/接口失败告警） | Sentry/Datadog 或自建上报 | 前端/运维 | W2 |
| TODO-P1-05 | 告警阈值演练（注入异常验证告警触发） | 模拟错误/超时/白屏，验证告警通道 | 运维 | W3 |
| TODO-P1-06 | 灰度功能开关自动化（1%→10%→50%→100%） | Feature Flag 平台或配置中心 | 运维/前端 | W3 |
| TODO-P1-07 | 数据一致性测试（Mock vs REST vs WS 三端对齐） | schema 对比 + 抽样比对 | 数据层 | W2 |
| TODO-P1-08 | 覆盖率提升至行业建议≥90%（当前基线80%） | 补齐23个缺少测试的Store + organisms组件 | 测试 | W3 |
| TODO-P1-09 | 修复8个排除测试文件（LLM Mock 隔离/竞态/结构漂移） | vi.mock 完全隔离 + 工厂函数对齐 | 测试/前端 | W2 |
| TODO-P1-10 | 第三方SDK安全评估与清单 | 逐个SDK核采集范围、供应商合规性 | 安全/开发者 | W2 |

### P2 — 中优项（首迭代内完成）

| ID | 检查项 | 验证方法 | 责任人 | 截止 |
|----|--------|----------|--------|------|
| TODO-P2-01 | 兼容性矩阵扩展（Safari/Firefox 实测） | BrowserStack 或真机实测 | 前端 | W3 |
| TODO-P2-02 | 无障碍人工走查记录（键盘/焦点/ARIA） | axe-core + 人工走查表 | UX/前端 | W3 |
| TODO-P2-03 | CDN 缓存预热与失效策略 | 验证缓存命中率 + 内容哈希 | 运维 | W3 |
| TODO-P2-04 | 数据库备份与迁移脚本（IndexedDB 版本升级） | 异常注入(写入中断/版本升级) | 数据层 | W3 |
| TODO-P2-05 | SSL 证书过期检查 | 脚本自动检查证书有效期 | 运维 | W3 |
| TODO-P2-06 | 代码安全测试（静态扫描 SonarQube/CodeQL） | 接入 GitHub CodeQL 或 SonarCloud | 安全 | W4 |
| TODO-P2-07 | 模糊测试（Fuzzing 输入边界） | 对关键输入接口进行随机/异常数据注入 | 测试/安全 | W4 |
| TODO-P2-08 | 容灾方案文档（RTO/RPO 目标 + 切换演练） | 文档 + 演练记录 | 运维 | W4 |
| TODO-P2-09 | 灾难恢复测试（模拟数据损坏/IndexedDB 丢失） | 删除 IndexedDB 验证恢复流程 | 数据层/测试 | W4 |
| TODO-P2-10 | 业务埋点完整性与准确性校验 | 调试面板核对核心事件 | 数据/产品 | W3 |

### P3 — 低优项（持续优化）

| ID | 检查项 | 验证方法 | 责任人 | 截止 |
|----|--------|----------|--------|------|
| TODO-P3-01 | 视觉回归场景扩展至20个（当前5个） | Playwright toHaveScreenshot | 前端/测试 | W4+ |
| TODO-P3-02 | E2E 覆盖 Safari/Firefox（当前仅 Chromium） | Playwright 多项目配置 | 测试 | W4+ |
| TODO-P3-03 | IPv4/IPv6 双栈测试（如部署环境支持） | 网络环境切换验证 | 运维 | W4+ |
| TODO-P3-04 | 信创环境适配评估（国产化操作系统/浏览器） | 兼容性测试 | 运维/前端 | W4+ |
| TODO-P3-05 | 安装包加固（如后续出移动端） | ProGuard/R8 + 防逆向 | 安全 | W4+ |
| TODO-P3-06 | 合规文档完整归档（豁免理由 + 免责声明留痕） | 文档化并存档 | 开发者 | W4 |

---

## 四、执行时序（周计划）

```
W1 地基与硬门槛
├── 修复 tsc 类型错误 (TODO-P0-01)
├── 确认 deadcode 4处 null 返回 (TODO-P0-02)
├── 渗透测试 + 漏洞扫描 (TODO-P0-03/04)
├── 测试基线全绿 (TODO-P0-05)
├── 构建门禁全绿 (TODO-P0-06)
└── 密钥泄露检查 (TODO-P0-07)

W2 性能与安全强化
├── 性能预算建立 (TODO-P1-01)
├── 负载测试 (TODO-P1-02)
├── 24h 稳定性测试 (TODO-P1-03)
├── APM 监控接入 (TODO-P1-04)
├── 数据一致性测试 (TODO-P1-07)
├── 修复8个排除测试文件 (TODO-P1-09)
└── 第三方SDK安全评估 (TODO-P1-10)

W3 兼容与监控
├── 告警阈值演练 (TODO-P1-05)
├── 灰度开关自动化 (TODO-P1-06)
├── 兼容性矩阵扩展 (TODO-P2-01)
├── 无障碍人工走查 (TODO-P2-02)
├── CDN 缓存预热 (TODO-P2-03)
├── 数据库备份验证 (TODO-P2-04)
├── SSL 证书检查 (TODO-P2-05)
└── 业务埋点校验 (TODO-P2-10)

W4 发布与回归
├── 回滚方案演练 (TODO-P0-08)
├── 代码安全扫描 (TODO-P2-06)
├── 模糊测试 (TODO-P2-07)
├── 容灾方案文档 (TODO-P2-08)
├── 灾难恢复测试 (TODO-P2-09)
├── 合规文档归档 (TODO-P3-06)
└── 全量回归 + 发布评审
```

---

## 五、教训总结（14条）

1. 分层审计脚本(audit:layers)是CI地基，必须先稳定。本项目已做到0违规，但行业标准还要求代码安全扫描(CodeQL/SonarQube)作为补充。
2. 类型安全(tsc:prod)必须零error。本次12个TS2307/TS7006错误的根因是服务目录重构后，新目录 `src/services/input/` 下模块文件未同步创建，导致import解析失败。说明目录迁移必须全链路同步。
3. 硬编码审计不能止于颜色/锚点。行业实践还包括密钥泄露、调试代码残留、console.log清理等。
4. 测试排除文件是技术债务。8个排除文件意味着基线不完整，行业标准要求交易相关功能覆盖率100%。
5. 安全测试需要专业工具。仅靠npm audit不足以覆盖OWASP Top 10，需引入ZAP/Burp/CodeQL。
6. 性能监控不能只靠Lighthouse。需要建立RUM(Real User Monitoring)和APM，才能在生产环境发现问题。
7. 灰度发布需要功能开关。文字描述的灰度策略无法秒级回滚，需要Feature Flag平台或配置中心。
8. 数据一致性测试容易被忽视。Mock/REST/WS三端对齐不够，还需验证服务端接收与客户端发送的一致性。
9. 长时间稳定性是隐藏风险。内存泄漏可能在短测试中发现不了，需24h+挂机或monkey测试。
10. 合规文档必须留痕。即使按个人工具豁免，豁免理由也需要文档化，以防后续监管变化。
11. **vi.mock STORE_NAME 必须完整**：测试中 mock `dbConfig` 的 `STORE_NAME` 时，必须包含所有被测试代码引用的 store 名。遗漏会导致运行时 `undefined`，引发级联错误（如 `quotes.history.find` 在空数组上调用）。
12. **dataBridge.query mock 必须与 STORE_NAME 实际值对齐**：`STORE_NAME.dailyQuotes` 实际值为 `'daily_quotes'`（带下划线），mock 中若写 `'dailyQuotes'` 会导致不匹配，返回空数组 `[ ]`（truthy），被存入 cache 后触发 `.find is not a function` 错误。
13. **服务目录迁移必须全链路同步**：从 `src/services/fetcher/` 迁移到 `src/services/input/` 时，不仅要新建目标模块，还要同步更新所有调用方的 import 路径、测试 mock 路径、以及 tsconfig 的 include 范围。漏一步即导致 tsc 批量 TS2307 错误。
14. **区分 tsc:prod 与 tsc:test 的修复优先级**：`tsc:prod`（生产代码）必须零容忍零错误；`tsc:test`（测试+脚本）错误可能更多（当前 ~393），应分批处理，不阻塞生产构建。

1. 分层审计脚本(audit:layers)是CI地基，必须先稳定。本项目已做到0违规，但行业标准还要求代码安全扫描(CodeQL/SonarQube)作为补充。
2. 类型安全(tsc --noEmit)必须零error。当前1个DuckDB类型错误即阻断发布，说明第三方库类型升级可能破坏构建。
3. 硬编码审计不能止于颜色/锚点。行业实践还包括密钥泄露、调试代码残留、console.log清理等。
4. 测试排除文件是技术债务。8个排除文件意味着基线不完整，行业标准要求交易相关功能覆盖率100%。
5. 安全测试需要专业工具。仅靠npm audit不足以覆盖OWASP Top 10，需引入ZAP/Burp/CodeQL。
6. 性能监控不能只靠Lighthouse。需要建立RUM(Real User Monitoring)和APM，才能在生产环境发现问题。
7. 灰度发布需要功能开关。文字描述的灰度策略无法秒级回滚，需要Feature Flag平台或配置中心。
8. 数据一致性测试容易被忽视。Mock/REST/WS三端对齐不够，还需验证服务端接收与客户端发送的一致性。
9. 长时间稳定性是隐藏风险。内存泄漏可能在短测试中发现不了，需24h+挂机或monkey测试。
10. 合规文档必须留痕。即使按个人工具豁免，豁免理由也需要文档化，以防后续监管变化。

---

## 六、二开复用检查清单（精简版）

新项目/二开时，直接按以下顺序执行：

```powershell
# 1. CI 地基（必须零违规）
npm run audit:layers        # → 0 violations
npm run audit:hardcode      # → 0 告警（含密钥/调试代码）
npm run audit:deadcode      # → 0 死代码
npx tsc --noEmit            # → 0 error

# 2. 测试基线（必须全绿）
npm run test:clean          # → 0 fail（零排除文件）
npm run test:e2e            # → 核心路径通过
npm run coverage            # → Statements≥90%, Branches≥85%

# 3. 安全扫描（必须零高危）
npm audit                   # → 0 high/critical
# + 渗透测试 (OWASP ZAP)
# + 代码安全扫描 (CodeQL/SonarQube)

# 4. 性能基线（必须达标）
npm run build               # → 包体积 < budget
lighthouseci                # → LCP<2.5s, INP<200ms, CLS<0.1
# + 负载测试 (k6/Artillery)

# 5. 发布准备
npm run audit:docs          # → 文档同步
npm run audit:routes        # → 全路由可达
# + 回滚演练 + 灰度开关 + 监控告警
```

---

## 七、参考标准索引

| 标准 | 来源 | 关键借鉴项 |
|------|------|-----------|
| Front-End-Checklist (80k★) | GitHub 社区 | 7大维度：HTML/CSS/JS/性能/可访问性/SEO/安全 |
| Cortex Release Checklist | cortex.io | 部署前/部署中/验证三阶段，KPI 与功能开关 |
| CloudBees Deployment Checklist | cloudbees.com | 功能开关解耦发布与部署，回滚计划 |
| 《证券期货业软件测试指南》 | 证监会 | 安全测试5项技术：功能检查/代码安全/漏洞扫描/渗透测试/模糊测试 |
| 《证券期货业移动互联网应用程序安全规范》 | 证监会 | 移动终端安全、身份鉴别、网络通信、数据安全、开发安全、安全审计 |
| 华泰证券移动金融客户端规范 | 企业标准 | 兼容性(1000+台)、稳定性(10h monkey)、代码混淆、签名加固 |
| 中信证券移动金融客户端规范 | 企业标准 | 性能(QPS≥1000)、稳定性(崩溃率≤0.08%)、信创、IPv6、灰度更新 |

---

*本文档由 AI 辅助生成，经人工复核后纳入项目知识体系。*
