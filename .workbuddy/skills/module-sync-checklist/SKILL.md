---
skill_id: V9-SKILL-MODULE-SYNC
name: module-sync-checklist
title: "模块改动同步校对清单（严禁代码先行）"
description: "任何代码改动交付前的强制同步校对流程。核心目标：严禁'代码先行、卫星产物未及时同步'——类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆 十域必须与代码同批落地，证据化验证 + 门禁全绿方可声称完成。基于 2026-07-20/21 采集域 P0 改造巩固校对实战提炼。"
agent_created: true
triggers:
  keywords: [模块同步, 代码校对, 交付前检查, 同步校对, module-sync, sync-checklist, 重构, 接口变更, 重命名, 四步集成, 巩固成果, 代码先行, 模块改动]
  files:
    - "src/services/**"
    - "src/store/**"
    - "src/core/**"
    - "src/pages/**"
    - "src/components/**"
    - ".workbuddy/skills/**"
  events: [pre-delivery, refactor, rename, interface-change]
gates:
  - "npx tsc --noEmit"
  - "npm run tsc:prod"
  - "npm run audit:layers"
  - "npm run audit:acl-consistency"
mandatory: true
covers_docs: [AGENTS.md, V9-DOC-DATA-050, V9-DOC-QA-046]
---

# 模块改动同步校对清单（module-sync-checklist）

> **核心铁律（唯一目标）：严禁代码先行。**
> 代码改动的落地时间，不得早于其全部卫星产物的同步完成时间。
> **"代码已改、其他待补" = 未完成。** 禁止在此状态下声称"完成/已交付/已修复"。
> 门禁全绿 ≠ 同步完成；同步完成也必须门禁全绿。**不验证就不信任。**

---

## 〇、反模式清单：代码先行 10 宗罪

以下每一条都在本项目真实发生过（2026-07 采集域审计实证），改动交付前逐条自查：

| # | 反模式（代码先行） | 真实后果 | 正确做法 |
|---|---|---|---|
| 1 | 改了接口/函数签名，消费者没全量 grep | 调用方行为漂移或运行时才炸 | 阶段 1 域 2：全量 grep 附 file:line 证据 |
| 2 | 新增 `ENVELOPE_ACTION`，没注册 handler / 没补 ACL_MATRIX | fallback 裸 put → keyPath 失败 / Permission denied | 阶段 1 域 6 + `audit:acl-consistency` |
| 3 | 改了 store 字段，测试种子/initialState/reset 没同步 | 测试假绿或假红 | 阶段 1 域 3 + 域 9 |
| 4 | 指标已计算但 UI 没消费（realSuccessRate 算好没人用） | 假绿灯 KPI 长期失真 | 阶段 1 域 5：新指标必须挂消费方 |
| 5 | 统计/校验函数已存在但生产零调用（recordCompleteness） | 监控字段恒 0，告警形同虚设 | 阶段 1 域 5：grep 生产调用点 ≥1 |
| 6 | 目录/文件迁移，AGENTS.md 与 docs 还写旧路径 | AI 按旧契约生成错误代码 | 阶段 1 域 7：全文件类型扫描旧路径残留 |
| 7 | 新增 skill/模块/路由，registry/路由表没注册 | 触发不到、审计报漂移 | 阶段 1 域 6（含本 skill 自身） |
| 8 | Mock 口径变了，监控 KPI 没跟上 | mock 计入成功率 → 假绿灯 | 阶段 1 域 4 + 域 5 |
| 9 | 改了 payload 形状，handler 期望没核对 | `{store,data}` 包装被当记录写入 | 阶段 2 残留 grep = 0 |
| 10 | 新增可选参数未声明向后兼容，缺省值改变旧行为 | 静默行为变更，回归难追 | 阶段 1 域 8：缺省值必须保持旧行为并写入 JSDoc |

---

## 一、执行流程

### 阶段 0：改动前 —— 声明改动面（未声明不动手）

```bash
git status --short          # 确认基线（区分本次改动与历史未提交）
git diff --name-only        # 本次改动文件全集
```

- [ ] 列出改动文件清单，并按四步契约标注所属层（types/store/services/pages）
- [ ] 对每个改动模块，**改动前** grep 出消费者预告清单：
  `grep -rn "from '.*{模块名}'" src/ tests/`
- [ ] 类型定义是否先行？（四步契约：types → store → services → UI，严禁顺序倒置）

**输出**：改动面声明（文件 × 层 × 消费者预告），写入交付说明。

### 阶段 1：十域同步清单（逐项打勾，每项附证据）

| 域 | 同步项 | 验证方式 |
|---|---|---|
| 1. 类型定义 | Interface 先行、零 any、新字段全量标注 | `tsc --noEmit` |
| 2. 消费者调用点 | 全部消费方逐一核对兼容性 | grep 结果逐条确认，禁止"声称 N 处" |
| 3. 测试 | 新增功能必有新测试；受影响测试全绿；种子数据同步 | vitest 相关套件 |
| 4. Mock 与 fixtures | mock 口径与真实一致；mock 文件归位 `src/fixtures/`；血缘标记完整 | grep `mock` 改动链路 |
| 5. 监控与指标 | 新统计函数有生产调用点；新指标有 UI/告警消费方 | grep 调用点 ≥1 + 消费点 ≥1 |
| 6. 注册表 | handler 注册、ACL_MATRIX、路由表、skill-registry.json 同步 | `audit:acl-consistency` + `audit:skill-coverage` |
| 7. 文档 | AGENTS.md/路由 specs/数据字典同步；**中文文档写入后必须重读验证**（防编码事故，2026-07 两份文档全毁教训） | 重读 + 旧路径残留 grep |
| 8. 配置与常量 | 零硬编码；新增可选参数缺省值保持旧行为并写 JSDoc | 逐参数核对 |
| 9. Store 与状态 | initialState/reset 含新字段；selector 订阅规范（禁裸 getState 派生）；withBroadcast 配对 | grep + 测试 |
| 10. 记忆与变更 | CHANGELOG / `.workbuddy/memory/` 记录改动意图与影响面 | 文件落盘 |

### 阶段 2：证据化验证（不信声称，全量 grep）

```bash
# 2.1 消费者残留：旧签名/旧字段/旧路径 0 残留
grep -rn '{旧名称}' src/ tests/ docs/ prompts/ AGENTS.md

# 2.2 payload 形状：禁止 {store, data} 包装
grep -rn '{ store, data }' src/services/

# 2.3 统计对称：每个 try 的 recordWrite(true) 必须有 catch 的 recordWrite(false)
grep -B5 -A10 'recordWrite' {改动文件}

# 2.4 生产调用点：新函数不得零调用（死代码即代码先行）
grep -rn '{新函数名}' src/ --include='*.ts' --include='*.tsx' | grep -v test
```

### 阶段 3：门禁验证（全绿方可交付）

```bash
npx tsc --noEmit                # 类型检查（与下行双检，教训 L4）
npm run tsc:prod                # 生产构建检查
npm run audit:layers            # 分层审计：0 violations
npm run audit:acl-consistency   # ACL 一致性：0 ERROR 0 WARN
node scripts/audit/audit-skill-coverage.cjs   # 当且仅当改动涉及 .workbuddy/skills/
node ./node_modules/vitest/vitest.mjs run {相关测试文件}
```

### 阶段 4：交付定义（DoD）

- [ ] 十域同步清单全部打勾且每项有证据（grep 输出 / 测试输出 / 门禁输出）
- [ ] 阶段 3 门禁全绿；历史存量错误须证明与本次改动无关（过滤改动文件 = 0）
- [ ] 交付说明包含：改动面声明、同步证据、未执行项（如实声明，如 live E2E）
- [ ] **未完成以上全部，回复中禁止出现"完成/已交付/已修复"字样**

---

## 二、经验教训速查（2026-07-20/21 采集域 P0 实战）

| # | 教训 | 来源 |
|---|---|---|
| S1 | realSuccessRate 算好但页面没消费 → 假绿灯潜伏数月 | 反模式 4 |
| S2 | recordCompleteness 生产零调用 → completeness 恒 0 | 反模式 5 |
| S3 | 指数退避写好但生产零引用，线上 tight-loop 重试 | 阶段 2.4 死代码检查 |
| S4 | mock 强制 push 进降级链，使 `allowMockFallback:!PROD` 配置失效 | 反模式 10 |
| S5 | 两份中文文档编码写入事故全毁（`?` 替换）→ 文档写入后必须重读 | 阶段 1 域 7 |
| S6 | 子代理超时但改动已落盘 → 接管者必须独立验证（Trust but verify） | 阶段 2 |
| S7 | 治理产物自身也要同步：新增 skill 必须同批注册 registry + AGENTS.md 索引 | 反模式 7 |

## 三、关联

- 上游契约：`AGENTS.md` §二 四步集成编码契约、§七 验证命令
- 姊妹 skill：`collection-pipeline-testing`（采集链路怎么测）、`data-flow-integrity-audit`（数据流从哪查到哪）、`mock-data-diagnosis`（Mock 残留查什么）
- 本 skill 定位：**以上一切的交付闸口**——任何改动无论用了哪个专项 skill，交付前必须过本清单
