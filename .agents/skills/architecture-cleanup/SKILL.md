---
name: "architecture-cleanup"
description: "执行项目架构清理：识别并修复跨层调用违规、合并/迁移错位目录中的重复服务、统一领域命名与 UI 文案。强调先扫描真相源、再小步重构、每步验证的飞轮。Invoke when user asks to clean up architecture smells, fix layer violations, consolidate duplicate services, or align domain naming across UI and services，audit:layers 报 store/components 直接依赖 data/、audit:deadcode 报残影目录、或怀疑同职责服务 2+ 份拷贝并存。"
version: "v1.0.2"
last_updated: "2026-08-21"
change_log:
  - version: v1.0.2
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×1），词命中 ≥4，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.0.1
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构，原 6 段自定义标题（触发条件+核心原则+执行清单+典型错误+验证模板+关联文档）合并重映射为标准一~五段；§二前置检查合并原则+检查项并表格化（7 项）；§三清理 SOP 拆 4 个 Phase（跨层→归位→命名→回归）；§四扩展至 8 条教训（后果+规避双字段）；§五交付物≥10 项+必要且充分条件声明；补 mandatory 字段对齐 registry。"
    date: 2026-08-21
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
mandatory: false
---

# 架构清理技能 — v1.0.1

> **版本**: v1.0.1 | **日期**: 2026-08-21 | **校验基准**: V9 AGENTS.md §一 分层规则 + §十三 模块分拆评估框架
> **适用性质**: 架构债务清理、跨层调用修复、目录归位、领域命名统一，禁止修改业务逻辑
> **输出格式**: 扫描报告 → 分阶段执行清单 → 四级验证结果 → 反模式教训 → 交付物勾表

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求分析或修复架构问题（跨层调用违规清理、残影目录归位、错位重复服务合并、领域命名 / UI 文案双轨统一、旧文件归档 + 引用同步清除）
- **显式触发 2**：版本迭代前一次性技术债务清扫、模块评审要求目录归位、或发现同一领域代码分散在 2+ 个目录但职责重叠（如 services/fetcher 与 services/input 同职责拷贝并存）
- **脚本/审计触发 3**：`npm run audit:layers` 报出 `store/` 或 `components/` 直接依赖 `data/` 层（store/components → dataLayer/db 裸访问违规）；或 `npm run audit:deadcode` 报残影目录 / 死代码 / 路由漂移；或 `npm run audit:component-usage` 报僵尸组件 / 命名冲突 / 注册不一致
- **脚本/审计触发 4**：Grep 全仓硬编码扫描（`npm run audit:hardcode`）报 `/src/config.*RESEARCH_STATUS/`、`/src/config.*DEFAULT_POOL_GROUP/` 这类业务常量泄漏模式（需联动 constant-migration）
- **设计/协议触发 5**：AGENTS.md 分层规则更新 / 六层架构职责边界重申 / 新模块新增目录需要同步四端（磁盘 + README 导航表 + skill-registry.json + AGENTS.md 索引）一致性；或命名契约（枚举/UI 文案/状态机）版本变更后存量术语归一

**不触发场景 · 减少误激活**：
- 纯业务功能开发（未涉及跨层、目录、命名变更范畴）；
- 单次 lint / tsc 报错修复（不属于架构清理范围）。

**协作 Skill / 链式调用**：
- 审计前置→`architecture-radar-scan`（六层无损探测建立热力风险基线）；
- 跨层写访问违规→`databridge-migration`（DataBridge 信封协议迁移）；
- 常量双层重复→`constant-migration`；
- 文档同步→`docs-as-mirror` + `doc-management-principles`（目录/命名变更后同步文档）。

---

## 二、前置检查

> **铁律: Truth-First（先扫后改，禁止凭记忆下结论）；分层原子修复：先修跨层违规 → 再整理目录 → 最后统一命名，顺序不得颠倒。每次变更后必须验证，禁止批量改完一次性跑测试。**

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 跨层调用违规定位 | `npm run audit:layers` 或 `tsx scripts/audit-layer-calls.ts`；Grep `import { dataLayer } from '@/data/dataLayer'` / `import { db } from '@/data/db'` 于 `src/store`、`src/components` | 列出所有违规文件路径+行号，按 Store/组件分组 |
| 2 | 重复/错位服务扫描 | Grep 同名/同职责模块（如 `inputService`、`hotSectorService`）于全仓；用 `diff -u` 比对疑似重复文件 | 输出「重复 / 疑似重复 / 残影」三类清单（含路径+相似度说明） |
| 3 | 领域命名真相源确认 | 读 `src/config/dbConfig.ts` 枚举 + `src/core/poolTransitionEngine.ts` 标签 / 状态机（若涉及）+ `src/constants/**.ts` 业务常量 | 真相源术语清单列齐（例：意向候选池 vs 候选池），与 UI 现用术语对比 |
| 4 | 测试基线保存 | 先跑一次相关测试：`tsc --noEmit`、`npm run audit:layers`、`vitest run <相关路径>` | 有「变更前」FAIL/PASS 数快照，避免把历史残差归因到本次 |
| 5 | 目录职责边界复核 | 读 AGENTS.md §一 分层规则 + 对应目录 README（如存在） | 本次归位目标目录职责与源文件职责 100% 匹配，不得跨职责搬家 |
| 6 | 迁移前快照 | `git status --short > outputs/arch-cleanup-before.txt`；若涉及 10+ 文件，先开独立分支 | 有变更前磁盘状态快照 + 分支保护 |
| 7 | 并发在途残差确认 | 记录 `tsc --noEmit` 当前既有错误清单（文件路径+错误码） | 仅本次改动引入的错误计入 FAIL 判定 |

---

## 三、阶段化 SOP

按 4 个 Phase 顺序执行，严格遵循「先修违规 → 再归位 → 最后统一命名」的分层原子顺序，禁止跳 Phase 或逆序。

### **目标**：`audit:layers` 0 违规；同领域代码单一真相源；UI/类型/常量/测试四术语零漂移。

### Phase 1 · P0 修复跨层调用违规

**交付物**: 违规点修复清单 + 新增 Service 代码 + 验证报告

标准做法：
1. **目标**：让 `store/` 不再直接 `import { dataLayer } from '@/data/dataLayer'`；`components/` 不再直接 `import { db } from '@/data/db'`。
2. **实现**：在 `src/services/<对应子域>/` 下新建/复用 Service，将 Store 的 CRUD 委托给 Service。写操作优先通过 `dataBridge.forward()` 发送信封（对齐 `databridge-migration`）。
3. **关键约束**：保持原 Store 的 action 签名不变，禁止级联改动 UI。

### Phase 2 · P1 归位错位/重复服务

**交付物**: 重复文件差异对比表 + 移动清单 + import 批量替换脚本 + 人工抽查记录

标准做法：
1. **单一真相源选择**：用 `diff -u` 确认重复文件差异，保留功能最全/被引用最多一份为 canonical，其余拷贝删除。
2. **目录归位**：用 `mv` 将文件移动到 AGENTS.md 规定的正确目录，必要时重命名（例：`fetcherInputService.ts` → `inputService.ts`）。
3. **批量更新 import**：使用「防跨越正则」（参考 `constant-migration` Phase 2）脚本批量替换 `src/` 与 `tests/` 中导入路径；完成后人工抽查 5 个文件，确认没有跨 import 行拼接。

### Phase 3 · P2 统一领域命名与 UI 文案

**交付物**: 术语映射表（旧→新）+ UI 替换清单 + 测试断言同步清单 + Grep 清零验证

标准做法：
1. **真相源**：以 `src/config/dbConfig.ts` 枚举、`src/core/poolTransitionEngine.ts` 标签、`src/constants/**.ts` 定义为权威术语。
2. **替换**：将 UI 中旧统称（例：「候选池」）替换为精确名称（例：「意向候选池」）。
3. **测试同步**：**强制同步更新 `*.test.ts(x)` 中断言的文案**，否则测试直接失败。
4. **注释/JSDoc**：同步替换注释中旧术语，Grep 清零验证。

### Phase 4 · 四级验证 + 回归 + 快照

**交付物**: 四项验证全绿报告 + 残影清理审计报告 + 迁移后快照

| 级别 | 命令 | 通过标准 |
|------|------|---------|
| L1 类型 | `node node_modules/typescript/bin/tsc --noEmit` | 0 errors（历史残差排除说明） |
| L2 架构 | `npm run audit:layers` + `npm run audit:deadcode` | 0 violations；旧目录残影 0 个（audit:deadcode 确认） |
| L3 单元 | `vitest run <Phase 1~3 涉及的所有测试路径>` | 全绿；若移动 10+ 文件，至少覆盖 3+ 核心测试 |
| L4 回归 | `npm run build` + 相关 UI 测试（若涉及命名） | 构建成功；UI 文案同步通过 |

最后输出 `git status --short > outputs/arch-cleanup-after.txt`，与 before 对比，确认未越权修改无关文件。

---

## 四、陷阱与经验教训

| # | 教训 | 后果 | 规避方法 |
|---|------|------|---------|
| 1 | 只改生产代码，不改测试断言/文案 | 文案统一后测试大面积 FAIL，回滚成本极高 | §三 Phase 3 强制包含「测试断言同步」环节；相关测试一个不落 |
| 2 | 用 `audit:layers` 0 违规反推无重复代码 | 脚本不覆盖语义重复（同职责不同名）、残影目录、重复 Service | §二 1+2 必须人工做文件对比 + import 路径全仓 Grep，不只信脚本 |
| 3 | 移动文件后保留旧目录残影 | 引用混乱 + 新人以为两套都有效 + audit:deadcode 永久黄灯 | 移动后立即删除旧文件/空目录；Phase 4 L2 必跑 audit:deadcode |
| 4 | 新增 Service 时修改 Store 接口签名 | 引发 UI 级联改动，一次清理变半版重构 | Store action 签名不变，只替换内部实现为 Service 委托 |
| 5 | 不验证就批量替换 import 字符串 | 误伤注释/无关文案/字符串字面量，或跨 import 行拼接 | 用 `constant-migration` 防跨越正则；脚本后人工抽查 5 个文件 |
| 6 | Phase 顺序颠倒：先改名、后修跨层 | 跨层违规在新路径下更难定位，归因失败 | 严格 Phase 1→2→3 顺序；每步独立验证 |
| 7 | 未做迁移前快照，直接大量提交 | 失败回滚时无法区分清理前/后状态；`git diff` 淹没在噪音中 | §二 6 强制 before 快照；小步分批 commit（`git commit --only`） |
| 8 | 文档/注释未同步 | 新人按文档去旧路径找文件 → 找不到 → 时间浪费 + 文档失信 | 清理完成后立即跑 `docs-as-mirror`，同步更新 FILE-MANAGEMENT-GUIDE / README 目录职责表 |

---

## 五、完成交付物清单

### 5.1 交付物清单（≥10 项 · 完成打勾）

- [x] **1. 跨层违规点清单**：`audit:layers` + Grep dataLayer/db 输出的文件路径+行号表
- [x] **2. 重复/错位服务差异表**：疑似重复文件的 `diff -u` 相似度 + canonical 选择理由
- [x] **3. 领域术语映射表**：真相源术语 → UI/注释 旧术语的双向映射
- [ ] **4. 变更前快照与基线**：`outputs/arch-cleanup-before.txt` + tsc/audit:layers/测试 历史残差清单
- [ ] **5. Phase 1 新增/复用 Service 代码**：Store → Service 委托实现（含写操作 DataBridge 对齐说明）
- [ ] **6. Phase 2 移动清单 + import 脚本**：mv 命令列表 + 防跨越正则脚本 + 人工抽查 5 文件记录
- [ ] **7. Phase 3 术语替换清单**：UI/注释/测试中的替换位置（旧路径 → 新路径对照表）
- [ ] **8. Phase 4-1 tsc 报告**：`tsc --noEmit` 0 errors + 历史残差排除说明
- [ ] **9. Phase 4-2 架构审计报告**：`audit:layers` 0 violations + `audit:deadcode` 残影清零
- [ ] **10. Phase 4-3 单元测试报告**：相关测试路径全绿
- [ ] **11. Phase 4-4 构建与 UI 测试报告**：`npm run build` 成功 + 文案同步通过
- [ ] **12. 迁移后快照**：`outputs/arch-cleanup-after.txt`，与 before 对比无越权文件
- [ ] **13. 文档同步证明**：目录职责 README / FILE-MANAGEMENT-GUIDE / doc-registry 同步更新位置
- [ ] **14. 四端一致性同步**（若 FM/描述变更）：skill-registry.json / README 导航表 / AGENTS.md 索引更新

### 5.2 必要且充分条件

> **当且仅当**以下 4 条**同时成立**，方可声称本次架构清理完成并允许关闭对应 Issue / PR：
> 1. `audit:layers` **0 violations**（跨层违规归零），且 `audit:deadcode` 报告旧目录残影、死代码、路由漂移 3 项均不再亮红灯；
> 2. Phase 2 选定的 canonical 文件之外，旧重复拷贝路径在文件系统中已删除（空目录也要删），全仓 Grep 旧 import 路径 0 命中 导入/定义 点（注释保留兼容说明除外）；
> 3. Phase 3 术语替换在 UI、常量、类型、测试、注释 5 处 Grep 清零一致（旧术语 0 命中或仅保留兼容说明）；Phase 4 四级验证（L1 tsc / L2 两项审计 / L3 单元 / L4 构建+UI）全绿无 FAIL；
> 4. 本次提交范围严格限定在架构清理相关文件（通过 `git commit --only <paths>` 强制隔离，不得与功能开发代码混合）；若涉及 10+ 文件必须拆 3+ 小批 commit：P0 跨层修复一批、P1 归位一批、P2 命名+文档一批。

---

## 六、相关参考

- AGENTS.md §一（项目分层规则）· §十三（模块分拆评估框架）
- `docs/01-requirements/FILE-MANAGEMENT-GUIDE.md`（文件入-移-出全生命周期）
- 关联 Skill：`architecture-radar-scan`（扫描基线）· `databridge-migration`（DataBridge 迁移）· `constant-migration`（常量归位）· `docs-as-mirror`（文档同步）· `type-safety-contract`（类型变更安全契约）
