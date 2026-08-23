---
skill_id: V9-SKILL-MODULE-SYNC
name: "module-sync-checklist"
description: "模块改动十域同步校对清单（交付闸口）：严禁代码先行，类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆十域必须与代码同批落地，证据化验证+门禁全绿方可声称完成。Invoke when 任何代码改动交付前、重构/接口变更/重命名、新增 skill 或注册表变更、或怀疑卫星产物未同步时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-module-sync-checklist 归位项目单一物理源，内容忠实保留（十域清单+反模式 10 宗罪+证据化验证）"
    date: 2026-08-23
mandatory: true
---

# 模块改动同步校对清单 — v1.0.0

> **核心铁律（唯一目标）：严禁代码先行。**
> 代码改动的落地时间，不得早于其全部卫星产物的同步完成时间。
> **"代码已改、其他待补" = 未完成。** 禁止在此状态下声称"完成/已交付/已修复"。
> 门禁全绿 ≠ 同步完成；同步完成也必须门禁全绿。**不验证就不信任。**

---

## 一、触发条件

- **显式触发**：用户要求「模块同步」「代码校对」「交付前检查」「同步校对」
- **文件信号**：改动 `src/services/**`、`src/store/**`、`src/core/**`、`src/pages/**`、`src/components/**`、`.trae/skills/**`
- **事件触发**：重构、接口变更、重命名、任何改动交付前（本技能是**一切专项技能的交付闸口**）

**不触发场景**：与领域无关的文案小改；不落盘的临时调试脚本。

**协作 Skill**：`bash-conventions`（命令选择）、`collection-pipeline-testing`（采集链路）、`data-flow-integrity-audit`（数据流）、`mock-data-diagnosis`（Mock 残留）。

---

## 二、前置检查

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 改动基线 | `git status --short` + `git diff --name-only` | 区分本次改动与历史未提交 |
| 2 | 改动面声明 | 按四步契约标注所属层（types/store/services/pages） | 清单写入交付说明 |
| 3 | 消费者预告 | `grep -rn "from '.*{模块名}'" src/ tests/` | 每个改动模块有消费者清单 |
| 4 | 类型先行 | 四步契约：types → store → services → UI | 顺序无倒置 |

> **铁律**：未声明改动面不动手。

---

## 三、阶段化 SOP

### 反模式清单：代码先行 10 宗罪（每一条都在本项目真实发生过）

| # | 反模式 | 真实后果 | 正确做法 |
|---|---|---|---|
| 1 | 改接口签名，消费者没全量 grep | 调用方行为漂移 | 阶段 2 全量 grep 附 file:line 证据 |
| 2 | 新增 `ENVELOPE_ACTION` 没注册 handler/ACL | fallback 裸 put 失败 / Permission denied | 域 6 + `audit:acl-consistency` |
| 3 | 改 store 字段，测试种子/initialState 没同步 | 测试假绿或假红 | 域 3 + 域 9 |
| 4 | 指标已计算但 UI 没消费（realSuccessRate） | 假绿灯 KPI 长期失真 | 域 5：新指标必须挂消费方 |
| 5 | 统计函数生产零调用（recordCompleteness） | 监控字段恒 0 | 域 5：grep 生产调用点 ≥1 |
| 6 | 目录迁移，AGENTS.md/docs 还写旧路径 | AI 按旧契约生成错误代码 | 域 7：全文件类型扫旧路径残留 |
| 7 | 新增 skill/模块/路由，registry 没注册 | 触发不到、审计报漂移 | 域 6 |
| 8 | Mock 口径变了，监控 KPI 没跟上 | mock 计入成功率 → 假绿灯 | 域 4 + 域 5 |
| 9 | 改 payload 形状，handler 期望没核对 | `{store,data}` 包装被当记录写入 | 阶段 2 残留 grep = 0 |
| 10 | 新增可选参数缺省值改变旧行为 | 静默行为变更 | 域 8：缺省值保持旧行为并写 JSDoc |

### 阶段 1：十域同步清单（逐项打勾，每项附证据）

| 域 | 同步项 | 验证方式 |
|---|---|---|
| 1. 类型定义 | Interface 先行、零 any | `tsc --noEmit` |
| 2. 消费者调用点 | 全部消费方逐一核对 | grep 逐条确认，禁止"声称 N 处" |
| 3. 测试 | 新功能必有新测试；种子数据同步 | vitest 相关套件 |
| 4. Mock 与 fixtures | mock 口径与真实一致；归位 `src/fixtures/` | grep mock 改动链路 |
| 5. 监控与指标 | 新统计函数有生产调用点；新指标有消费方 | grep 调用点 ≥1 + 消费点 ≥1 |
| 6. 注册表 | handler/ACL_MATRIX/路由表/skill-registry 同步 | `audit:acl-consistency` + `audit:skill-coverage` |
| 7. 文档 | AGENTS.md/数据字典同步；**中文文档写入后必须重读验证** | 重读 + 旧路径残留 grep |
| 8. 配置与常量 | 零硬编码；缺省值保持旧行为 | 逐参数核对 |
| 9. Store 与状态 | initialState/reset 含新字段；禁裸 getState 派生 | grep + 测试 |
| 10. 记忆与变更 | CHANGELOG / 记忆文件记录改动意图 | 文件落盘 |

### 阶段 2：证据化验证（不信声称，全量 grep）

```bash
grep -rn '{旧名称}' src/ tests/ docs/ prompts/ AGENTS.md   # 旧签名/旧字段/旧路径 0 残留
grep -rn '{ store, data }' src/services/                   # 禁止 payload 包装
grep -rn '{新函数名}' src/ --include='*.ts' | grep -v test  # 新函数不得零调用
```

### 阶段 3：门禁验证（全绿方可交付）

```bash
npx tsc --noEmit && npm run tsc:prod && npm run audit:layers && npm run audit:acl-consistency
npm run audit:skill-coverage   # 改动涉及技能时
```

### 阶段 4：交付定义（DoD）

- [ ] 十域清单全部打勾且每项有证据（grep/测试/门禁输出）
- [ ] 门禁全绿；存量错误须证明与本次改动无关
- [ ] 交付说明含：改动面声明、同步证据、未执行项如实声明
- [ ] **未完成以上全部，回复中禁止出现"完成/已交付/已修复"**

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | realSuccessRate 算好但页面没消费 | 假绿灯潜伏数月 | 新指标必须挂消费方 |
| 2 | recordCompleteness 生产零调用 | completeness 恒 0 | 死代码即代码先行 |
| 3 | 指数退避写好但生产零引用 | 线上 tight-loop 重试 | 阶段 2 死代码检查 |
| 4 | mock 强制 push 进降级链 | `allowMockFallback:!PROD` 配置失效 | 配置契约不得被绕过 |
| 5 | 中文文档编码写入事故全毁（`?` 替换） | 文档不可读 | 写入后必须重读验证 |
| 6 | 子代理超时但改动已落盘 | 接管者误信摘要 | Trust but verify 独立验证 |
| 7 | 治理产物自身未同步 | 新 skill 触发不到 | 同批注册 registry + 索引 |

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | 改动面声明（文件 × 层 × 消费者预告） | 写入交付说明 |
| 2 | 十域同步证据（每项 grep/测试/门禁输出） | 逐项可复现 |
| 3 | `tsc:prod` / `audit:layers` / `audit:acl-consistency` | 0 ERROR 0 WARN |
| 4 | 相关 vitest 套件 | 全绿 |
| 5 | 交付说明（含未执行项如实声明） | 存在且完整 |

> 上游契约：`AGENTS.md` §二 四步集成编码契约、§七 验证命令。
