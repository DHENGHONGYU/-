---
skill_id: V9-SKILL-DEV-CHECKLIST
name: "dev-checklist"
description: "开发快速检查清单：新组件/新模块/PR Review 三场景，正向+逆向双向校验（正向防漏项保覆盖率，逆向防误判保准确率），自动化命令兜底。Invoke when 新增组件提交 PR 前、新功能模块开发完成、Review 他人 PR、或用户说'检查一下/过一下清单'时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-dev-checklist 归位（僵尸组件治理经验提炼）"
    date: 2026-08-23
mandatory: false
---

# 开发快速检查清单（Dev Checklist）— v1.0.0

> **核心原则**：正向检查不漏项，逆向校验防误判，双向验证保准确。
> 先自动化后人工；每一项正向结论都需要反向证据支撑。

---

## 一、触发条件

| 场景 | 触发 |
|------|------|
| 新增组件后提交 PR 前 | ✅ 必须执行 |
| 新功能模块开发完成时 | ✅ 必须执行 |
| Review 他人 PR 时 | ✅ 建议执行 |
| 用户说"检查一下"/"过一下清单" | ✅ 执行 |

**文件信号**：改动 `src/components/**`、`src/widgets/**`、`src/store/**`、`src/services/**`。

**协作 Skill**：`code-quality-audit`（深度合规审查）、`component-health-check`（组件健康度）、`module-sync-checklist`（交付闸口）。

---

## 二、前置检查

| # | 检查项 | 命令 | 通过标准 |
|---|--------|-----|---------|
| 1 | 识别场景 | 组件自查（A）/ 模块自查（B）/ PR Review（C） | 明确场景再选清单 |
| 2 | 基线门禁 | `npm run gate:quick` | 记录基线状态 |

---

## 三、阶段化 SOP

### 场景 A：新组件自查（8 项正向 + 5 项逆向）

**正向 8 项**：① 有明确消费方（能说出具体文件名）② 命名唯一（全局搜索不冲突）③ 层级正确（atoms/molecules/organisms/templates 不越界）④ 最小可用（无"预留 props"）⑤ componentRegistry.ts 已登记且 consumers 真实 ⑥ 有测试覆盖 ⑦ 有 JSDoc ⑧ `npm run gate:dev` 全绿。

**逆向 5 项**：

| 正向检查项 | 逆向校验方法 | 通过标准 |
|-----------|-------------|---------|
| 有消费方 | Grep 组件名 / import 路径（排除测试与 barrel 自身） | ≥1 处业务引用 |
| 命名唯一 | Grep `export.*组件名` 与 `from.*组件名` | 仅 1 处定义 |
| 层级正确 | `npm run audit:atomic` | 0 violation |
| 最小可用 | 统计未被消费方使用的 props | 未使用 props ≤ 1 |
| 门禁通过 | `npm run audit:deadcode -- --staged` | 0 增量零引用组件 |

### 场景 B：新模块自查（6 要素 DoD + 6 项逆向）

**正向 6 要素**：① 类型层（`src/types/modules/`，typecheck 通过）② 服务层（写操作走 DataBridge 信封，audit:layers 零违规）③ 状态层（Store 有 init/fetch/reset + withBroadcast + 测试）④ UI 层（三态齐全 + 设计令牌）⑤ 入口层（路由可达，首页 3 次点击内）⑥ 文档层（功能+技术文档，模块清单登记）。

**逆向 6 项**：

| 正向要素 | 逆向校验方法 | 通过标准 |
|---------|-------------|---------|
| 类型层 | 反查 any / 类型断言数量 | any = 0 |
| 服务层 | 反查直接操作 dataLayer 的代码 | 0 处直连 |
| 状态层 | 反查未被 UI 消费的 state/action | ≤ 2 个 |
| UI 层 | 三态是否真有对应分支代码 | 3 态都实现 |
| 入口层 | 从 routes.ts 追踪到模块入口 | 路径可达 |
| 文档层 | 文档描述与实际代码一致性 | 无偏差 |

覆盖率验证：`audit:layers` + `audit:routes` + `audit:deadcode -- --staged`。

### 场景 C：PR Review（5 项正向 + 3 招逆向）

**正向 5 项**：① 新增组件有消费方吗（无则打回）② componentRegistry 同步了吗 ③ 命名冲突吗 ④ 分层正确吗（molecule 不得 import store）⑤ 入口层验证了吗。

**逆向 3 招**：diff 内搜 `from '.*组件名'` 看非组件文件 import；全仓 Grep 组件名查重名；读组件 import 列表查跨层引入；对比新增组件文件数与 registry 新增条目数。收尾跑 `npm run gate:quick`。

### 输出模板（检查报告）

```
## ✅ 开发检查清单报告
**场景** / **检查时间** / **组件/模块名**
### 正向检查结果（# / 检查项 / 结果 / 证据）
### 逆向校验结果（# / 校验项 / 结果 / 方法）
### 自动化验证（gate:dev|gate:quick / audit:deadcode --staged / audit:atomic|audit:layers）
### 结论：通过率 X/Y / 是否通过 / 待改进项
```

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 只勾正向不做逆向 | 检查流于形式、僵尸组件入库 | 逆向校验是防误判关键，不可跳过 |
| 2 | 纯人工勾选不跑命令 | 结论不可复现 | 自动化验证优先，至少 2 条命令交叉印证 |
| 3 | 不确定的项硬判通过 | 准确率失真 | 标"待确认"，实事求是 |
| 4 | 检查不留痕 | 无法追溯 | 记录验证命令与结果 |
| 5 | 清单僵化不迭代 | 漏掉新缺陷模式 | 发现新检查点及时更新本技能 |

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | 检查报告（正向+逆向+自动化三表） | 按输出模板 |
| 2 | 自动化门禁结果（gate:dev/gate:quick） | 全绿 |
| 3 | 待改进项清单 | 逐项可执行 |

**关键文件**：`src/components/componentRegistry.ts` / `src/config/routes.ts` / `src/config/moduleManifest.ts`。
**参考文档**：`docs/guides/component-admission-policy.md`、`docs/guides/module-completion-standard.md`。
