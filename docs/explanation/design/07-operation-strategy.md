---
title: 07-operation-strategy
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# 07. 运营策略

> **Status**: Current  
> **Version**: v2.5.0  
> **Last Updated**: 2026-07-05
>
> 本文档定义 V9 的开发流程、版本策略、风险控制与架构决策记录（ADR）。  
> 目标读者：项目管理者、核心开发者、QA、未来维护者。

---

## 1. 开发流程

### 1.1 分支模型

采用 **GitHub Flow 简化版**：

```
main
  ↑
feature/xxx
  ↑
hotfix/xxx
```

| 分支 | 用途 | 生命周期 |
|------|------|----------|
| `main` | 始终可部署的稳定分支 | 长期 |
| `feature/xxx` | 新功能、文档完善、重构 | 合并后删除 |
| `hotfix/xxx` | 线上紧急修复 | 合并后删除 |

### 1.2 提交规范

使用语义化提交前缀：

```
feat:  新增功能
fix:   修复缺陷
docs:  文档更新
refactor: 重构（不改变行为）
test:  测试相关
chore: 构建/依赖/工具
```

### 1.3 合并前检查清单

每位开发者在发起 PR 前必须本地执行：

```bash
npm run lint
npm run test
npm run build
```

任何一项失败禁止合并。

### 1.4 文档先行原则

- 新增引擎/路由/质量门禁前，必须先更新或新增 `docs/` 规格文档。
- 修改 `src/config/dbConfig.ts` 中的 schema 前，必须同步更新 `../../reference/03-architecture-standards.md` 与 `../../reference/10-glossary.md`。
- 重构结束后必须产出 `POST_REFACTOR_AUDIT_REPORT.md` 与 `POST_REFACTOR_FIX_LOG_*.md`。

### 1.5 外部参考蓝图管控（跨代文件治理）

> **目的**：防止 V10 / v6-pro-cockpit 等外部参考文档被误读为 V9 当前必须遵循的规则。

`docs/implementation/` 中部分文档（如 `../v10-architecture-alignment.md`、`ui-module-alignment.md`、`../../reference/v6-cockpit-ui-reference.md`、`trading-core-factors.md`）属于**外部参考蓝图**，其状态统一标记为：

```
Status: Future Reference / Deferred
```

**治理规则**：

1. **仅作参考，禁止直接作为代码依据**。外部蓝图中的架构（如 V10 的 20 个 Store、三舱硬隔离、A2A Agent、真实券商 Gateway）必须经过 V9 架构评审，转化为新的 ADR 或 `docs/01~10` 规格后，方可落地。
2. **读取时必须交叉校验**。AI、开发者或维护者在引用外部参考文档时，必须同时核对：
   - `../../reference/03-architecture-standards.md` 当前实际架构分层；
   - `../../reference/08-implementation-plan.md` 当前 Phase 范围；
   - `../../reference/10-glossary.md` 当前术语定义；
   - 当前代码实际目录与路由。
3. **落地前必须新建 ADR**。若外部蓝图中的某项设计需要进入 V9，须先按 `./implementation-governance.md` 的 ADR 模板创建新的 ADR，状态从 `Proposal` → `Accepted` 后方可实施。
4. **文档首页必须标注状态**。所有外部参考蓝图在文件顶部和 `docs/README.md` 中必须显示 `Status: Future Reference / Deferred`。

**当前外部参考蓝图清单**：

| 文档 | 来源 | 状态 | 说明 |
|------|------|------|------|
| `../../reference/v10-architecture-alignment.md` | V10 白皮书 | Future Reference / Deferred | V10 框架思想对齐参考 |
| `../../archive/ui-module-alignment.md` | V6 Pro UI 比对 | Future Reference / Deferred | V6 Pro UI 模式吸收参考 |
| `../../reference/v6-cockpit-ui-reference.md` | v6 UI 参考 | Future Reference / Deferred | v6 可复用 UI 组件总结 |
| `../trading-core-factors.md` | v6 交易报告 | Future Reference / Deferred | v6 交易因子导入参考 |

### 1.6 代码变更前的架构自诘（守护者检查清单）

任何涉及 L3 引擎、L2 数据、跨模块通信、schema 变更的 PR，作者必须先回答以下 3 个问题，并在 PR 描述中显式写出答案：

1. **我的建议是否触及 `../../reference/03-architecture-standards.md` 中的调用方向铁律？**
   - 若触及，必须调整方案，确保 L5/L4 不直接写 `dataLayer`，L3 写操作经 `DataBridge.forward()`。

2. **我的建议是否新增或修改了 IndexedDB 的 Store 或字段？**
   - 如果是，必须同步更新 `../../reference/03-architecture-standards.md` 的 Schema 章节、`../../reference/10-glossary.md` 的字段/术语表，并评估是否需要 DB 版本迁移。

3. **我建议的功能对应哪个文档？**
   - 必须引用 `../../reference/02-functional-specs.md` 的用户故事，或提供新的 ADR / implementation 文件草案，并带状态标签：`Proposal` / `Accepted` / `Deferred`。

未通过上述检查清单的 PR，禁止进入 Code Review。

---

## 2. 版本策略

### 2.1 SemVer

| 位 | 触发条件 | 示例 |
|----|----------|------|
| MAJOR | 数据 Schema 不兼容、架构范式变更 | 1.0.0 → 2.0.0 |
| MINOR | 新增舱室、引擎、核心功能模块 | 0.9.0 → 0.10.0 |
| PATCH | 缺陷修复、文档更新、性能优化、因子权重微调 | 0.9.0 → 0.9.1 |

### 2.2 版本发布流程

1. 在 `../../../CHANGELOG.md` 顶部新增版本条目，填写 Added/Changed/Fixed/Architecture/Quality/Known Issues。
2. 更新 `package.json` 的 `version` 字段。
3. 更新 `docs/README.md` 的「文档版本」。
4. 执行完整质量门禁（见 `../../reference/09-quality-gates.md`）。
5. 打 tag：`git tag -a v0.9.0 -m "release v0.9.0"`。
6. 构建并部署到 GitHub Pages（v1.0.0 目标）。

### 2.3 里程碑规划

| 版本 | 目标 | 关键交付 |
|------|------|----------|
| v0.9.0 | 核心骨架可用 | 五舱框架、DataBridge、评分、模拟交易、测试通过 |
| v0.10.0 | 数据与池流转 | AKShare 接入、真实评分、股票池流转 UI、V6 Pro → V9 JSON 数据迁移 |
| v0.11.0 | 分析与回测 | 板块轮动、行业分析、策略回测引擎 |
| v0.12.0 | 输出与复盘 | 研究报告导出、交易复盘笔记 |
| v1.0.0 | 发布准备 | 质量门禁全绿、PWA、E2E、CI、GitHub Pages 部署 |

---

## 3. 风险控制

### 3.1 风险登记表

| 编号 | 风险 | 概率 | 影响 | 应对措施 | 回滚方案 |
|------|------|------|------|----------|----------|
| R01 | IndexedDB schema 升级导致用户数据丢失 | 中 | 高 | 升级前导出 JSON 备份；升级脚本使用 `onupgradeneeded` 逐版本迁移 | 提供「从备份恢复」功能 |
| R02 | LLM 服务不可用导致智能评分失败 | 高 | 中 | 离线回退到自动评分；UI 明确提示网络依赖 | 关闭 LLM 增强开关，默认使用自动评分 |
| R03 | 真实数据源（AKShare）接口变更 | 中 | 中 | 抽象数据适配器层；配置驱动字段映射；增加 mock 降级 | 切换回手动录入/模拟数据 |
| R04 | 引擎层直接调用 dataLayer 破坏架构 | 中 | 高 | Code Review + 自动扫描脚本禁止跨层调用 | 重构为 DataBridge 调用 |
| R05 | 硬编码阈值/颜色导致维护困难 | 高 | 中 | ESLint 规则 + 架构审计 | 抽取到 `src/config/` 或 `theme.config.ts` |
| R06 | 测试覆盖率不足导致回归缺陷 | 中 | 高 | 覆盖率门禁；关键引擎函数必须附测试 | 补充测试并修复缺陷 |
| R07 | GitHub Pages 部署后路由刷新 404 | 低 | 高 | 使用 HashRouter；构建产物验证 | 回退到上一版本 tag |

### 3.2 回滚原则

- 任何发布必须有对应 tag，回滚时直接重新部署上一 tag。
- 数据 schema 变更必须在升级脚本中保证可逆（先备份再升级）。
- 重大重构必须保留旧代码开关，灰度开启新实现。

---

## 4. 架构决策记录（ADR）

### ADR-001：纯前端无后端

**背景**：个人投资者数据隐私敏感，且希望离线使用。

**决策**：V9 为纯前端应用，数据存储在本地 IndexedDB，不上传服务器。

**后果**：
- ✅ 数据主权归用户，无需登录与后端运维。
- ✅ 支持离线核心功能。
- ❌ 无法跨设备同步，用户需自行导入/导出备份。

### ADR-002：IndexedDB 作为本地数据库

**背景**：需要存储结构化股票、评分、订单、日志数据，且数据量可达数万条。

**决策**：使用浏览器原生 IndexedDB，封装在 `src/data/db.ts`。

**后果**：
- ✅ 容量大、支持索引、事务。
- ✅ 与 PWA 离线目标一致。
- ❌ API 较底层，需自行处理版本迁移。

### ADR-003：DataBridge 信封化通信

**背景**：跨模块数据写操作需要统一入口、权限控制与审计追踪。

**决策**：所有跨模块写操作通过 `DataBridge.forward(StandardEnvelope)`，配套 ACL 矩阵与审计日志。

**后果**：
- ✅ 明确调用边界，防止跨层污染。
- ✅ 支持数据血缘与调试追踪。
- ❌ 增加少量样板代码。

### ADR-004：React Router HashRouter

**背景**：计划部署到 GitHub Pages 等静态托管。

**决策**：使用 HashRouter，避免刷新 404。

**后果**：
- ✅ 静态托管零配置。
- ❌ URL 带 `#`，SEO 不友好（本项目为工具型应用，可接受）。

### ADR-005：Zustand 作为局部状态管理

**背景**：需要跨组件共享少量 UI 状态（如当前舱室、选中股票）。

**决策**：使用 Zustand，避免引入 Redux 过重生态。

**后果**：
- ✅ 轻量、TypeScript 友好。
- ✅ 持久化中间件可选。

### ADR-006：配置驱动因子与阈值

**背景**：评分模型需要持续调优，阈值需要随市场变化调整。

**决策**：因子定义、权重、阈值全部集中到 `src/config/`，禁止引擎层硬编码。

**后果**：
- ✅ 调参无需改引擎代码。
- ✅ 便于版本化与 A/B 测试。

---

## 5. 沟通与协作

- **每日同步**：简短同步当前 Phase 阻塞点与风险。
- **架构变更评审**：任何涉及分层、Schema、DataBridge 协议的变更须经过文档评审。
- **发布复盘**：每个 MINOR 版本发布后进行复盘，更新风险登记表与实施计划。

---

## 6. 附录：关键文档索引

| 文档 | 用途 |
|------|------|
| `../../reference/03-architecture-standards.md` | 分层与调用规则 |
| `../../reference/05-engine-specs.md` | 引擎与信封协议 |
| `../../reference/06-routing-specs.md` | 路由与懒加载 |
| `../../reference/08-implementation-plan.md` | 阶段计划与验收 |
| `../../reference/09-quality-gates.md` | 上线前 checklist |
| `../../../CHANGELOG.md` | 版本变更记录 |
