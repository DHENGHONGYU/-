---
name: "architecture-cleanup"
description: "执行项目架构清理：识别并修复跨层调用违规、合并/迁移错位目录中的重复服务、统一领域命名与 UI 文案。强调先扫描真相源、再小步重构、每步验证的飞轮。Invoke when user asks to clean up architecture smells, fix layer violations, consolidate duplicate services, or align domain naming across UI and services."
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# 架构清理技能 (Architecture Cleanup Skill) — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-07-13 | **校验基准**: V9 AGENTS.md §一 分层规则 + §十三 模块分拆评估框架
> **适用性质**: 架构债务清理、跨层调用修复、目录归位、领域命名统一
> **输出格式**: 扫描报告 → 分阶段执行清单 → 验证结果 → 经验教训

---

## 一、触发条件（Invoke When）

- 用户要求**分析或修复架构问题**（跨层调用、目录错位、重复服务、命名不一致）
- `audit:layers` 报告 `store/` 或 `components/` 直接依赖 `data/`
- 发现同一领域代码分散在两个以上目录（如 `services/fetcher/` 与 `services/input/` 并存）
- UI 文案与类型/状态机命名不一致（如界面写「候选池」而 `poolTransitionEngine.ts` 定义「意向候选池」）
- 新增功能后需要归位旧文件、清理旧引用

---

## 二、核心原则

### 原则 1：Truth-First — 先扫描，再判断

> 重构前必须用工具读取真实代码状态，不能凭记忆或文件名推断。

**强制行为**：
- ✅ 运行 `npm run audit:layers`（或 `tsx scripts/audit-layer-calls.ts`）确认违规点
- ✅ 用 `Grep` 扫描所有 `dataLayer` / `db` 导入，区分**服务层合法读取**与**Store/组件层违规读取**
- ✅ 用 `Grep` 扫描同名/同职责文件是否分散在多个目录
- ✅ 用 `diff` 比对疑似重复文件，确认是否真的重复还是只是相似
- ✅ 读取 `AGENTS.md` 当前版本，确认各层依赖方向与目录职责

**禁止行为**：
- ❌ 不扫描就下结论「这些文件是重复的」
- ❌ 只改一个引用路径就认为「目录已归位」
- ❌ 用 `audit:layers` 0 违规反推「没有架构问题」（脚本可能不检测语义重复）

---

### 原则 2：分层原子修复 — 先修违规，再整理目录，最后统一命名

**标准三阶段顺序**：

1. **P0 — 修复跨层调用违规**
   - 目标：`store/` 不再直接 `import { dataLayer } from '@/data/dataLayer'`；`components/` 不再直接 `import { db } from '@/data/db'`
   - 做法：在 `src/services/` 下新建/复用 Service，将 Store 的 CRUD 委托给 Service
   - 验证：`audit:layers` → 0 violations；`tsc --noEmit`

2. **P1 — 归位错位/重复服务**
   - 目标：同一领域文件只保留一份，放在 `AGENTS.md` 规定的目录
   - 做法：
     - 用 `diff -u` 确认重复文件差异
     - 保留功能最全/引用最多的一份作为 canonical
     - 用 `mv` 移动到正确目录，必要时重命名（如 `fetcherInputService.ts` → `inputService.ts`）
     - 批量更新 `src/` 与 `tests/` 中的 import 路径
   - 验证：全量 `tsc --noEmit` + 相关测试

3. **P2 — 统一领域命名与 UI 文案**
   - 目标：类型/状态机/服务注释/界面文案使用同一术语
   - 做法：
     - 以 `src/config/dbConfig.ts` 枚举或 `src/core/poolTransitionEngine.ts` 标签为「真相源」
     - 将 UI 中的旧统称（如「候选池」）替换为精确名称（如「意向候选池」）
     - 同步更新测试中断言的文案
   - 验证：相关 UI 测试通过

---

### 原则 3：每次变更后必须验证

| 阶段 | 最小验证命令 | 通过标准 |
|------|-------------|---------|
| P0 跨层修复 | `tsx scripts/audit-layer-calls.ts` + `tsc --noEmit` + 相关 Store 测试 | 0 violations, 0 errors |
| P1 目录归位 | `tsc --noEmit` + 移动涉及的全部测试 | 0 errors, 相关测试全绿 |
| P2 文案统一 | `tsc --noEmit` + 相关 UI 测试 | 0 errors, UI 测试全绿 |
| 最终回归 | `audit:layers` + `audit:deadcode` + `tsc --noEmit` + `vitest run` | 全通过 |

---

## 三、执行清单

### Step 1：扫描违规点

```powershell
# 1. 跨层调用审计
node_modules/.bin/tsx scripts/audit-layer-calls.ts

# 2. 查找 Store/组件层直接引入 data/ 的违规点
rg "import\s+\{\s*dataLayer\s*\}\s+from\s+['\"]@/data/dataLayer['\"]" src/store src/components
rg "import\s+\{\s*db\s*\}\s+from\s+['\"]@/data/db['\"]" src/store src/components

# 3. 查找疑似重复/错位的服务目录
rg "from\s+['\"]@/services/[a-zA-Z]+/(inputService|hotSectorService|batchImport)" src tests
```

### Step 2：修复跨层调用

```typescript
// ❌ 禁止：Store 直接引入 dataLayer
import { dataLayer } from '@/data/dataLayer'

// ✅ 正确：Store 只依赖 services/ 和 core/
import { loadCustomAgents, saveCustomAgent } from '@/services/system/customAgentService'
```

**Service 实现要点**：
- Service 内部可以调用 `dataLayer`（服务层允许依赖 `data/`）
- 对于写操作，优先通过 `dataBridge.forward()` 发送信封，确保 ACL 与审计
- 保持原 Store 的接口签名不变，避免 UI 改动

### Step 3：归位错位服务

```powershell
# 示例：将 input 域服务从 fetcher/ 迁移到 input/
mv src/services/fetcher/fetcherInputService.ts src/services/input/inputService.ts
mv src/services/fetcher/batchImportExecutor.ts src/services/input/batchImportExecutor.ts
mv src/services/fetcher/hotSectorService.ts src/services/input/hotSectorService.ts
# ... 其他 input 域文件
```

**批量更新 import（谨慎操作）**：
```powershell
find src tests -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 |
  xargs -0 perl -pi -e \
  's|@/services/fetcher/fetcherInputService|@/services/input/inputService|g; \
   s|@/services/fetcher/hotSectorService|@/services/input/hotSectorService|g; \
   s|@/services/fetcher/batchImportExecutor|@/services/input/batchImportExecutor|g'
```

> 执行后必须再次运行 `tsc --noEmit` 和测试，确认没有遗漏引用。

### Step 4：统一 UI 文案

1. 找到状态机/类型中的官方命名（如 `poolTransitionEngine.ts` 中的 `label`）
2. 在 UI 文件和 constants 中替换旧统称
3. **同步更新测试中断言的文案**，否则测试会失败

---

## 四、典型错误模式

| 错误 | 后果 | 预防 |
|------|------|------|
| 只改生产代码，不改测试中断言 | 测试大面积失败 | 文案统一必须包含 `tests/` |
| 用 `audit:layers` 0 违规就认为无重复代码 | 语义重复未被检测 | 额外做文件对比与 import 路径扫描 |
| 移动文件后保留旧目录残影 | 引用混乱、死代码 | 移动后删除旧文件，运行 `audit:deadcode` |
| 新增 Service 时修改 Store 接口 | 引发 UI 级联改动 | Service 仅替换实现，保持 Store action 签名 |
| 不验证就批量替换字符串 | 误伤注释或无关文案 | 使用精确匹配，改后 `tsc` + 测试 |

---

## 五、验证模板

```markdown
## 架构清理验证报告

- [ ] `audit:layers` → 0 violations
- [ ] `audit:deadcode` → 0 violations（允许既有 warnings）
- [ ] `tsc --noEmit` → 0 errors
- [ ] 相关单元测试通过
- [ ] 全量 `vitest run` 通过
- [ ] 旧目录无残留相关文件
- [ ] 测试文案已同步更新
```

---

## 六、关联文档

- [V9 AGENTS.md](../../../../AGENTS.md) — 分层规则与自主决策边界
- [FILE-MANAGEMENT-GUIDE.md](../../../../docs/01-requirements/FILE-MANAGEMENT-GUIDE.md) — 文件入-移-出全生命周期
- [docs-as-mirror Skill](../docs-as-mirror/SKILL.md) — 文档编写需与代码状态一致
- [type-safety-contract Skill](../type-safety-contract/SKILL.md) — 类型变更前的安全契约
