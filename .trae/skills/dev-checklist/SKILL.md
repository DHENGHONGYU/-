---
name: "dev-checklist"
description: "开发快速检查清单 — 新组件/新模块/PR Review 三场景，正向+逆向双向校验，确保准确率与覆盖率。在提交PR、新增组件模块、代码Review时调用。"
---

# 开发快速检查清单（Dev Checklist）

> **版本**: v1.0.0 | **创建**: 2026-07-25 | **更新**: 2026-07-25
> **来源**: V9 僵尸组件治理经验提炼
> **核心原则**: 正向检查不漏项，逆向校验防误判，双向验证保准确

---

## 一、何时调用

| 场景 | 触发 |
|------|------|
| 新增组件后提交 PR 前 | ✅ 必须执行 |
| 新功能模块开发完成时 | ✅ 必须执行 |
| Review 他人 PR 时 | ✅ 建议执行 |
| 季度代码质量盘点时 | ✅ 建议执行 |
| 用户说"检查一下" / "过一下清单" | ✅ 执行 |

---

## 二、三大检查场景

### 场景 A：新组件自查（8 项 + 逆向校验）

#### A1. 正向检查（8 项）
开发完成后，逐项确认：

1. **有明确消费方** — 至少 1 个页面/上层组件实际 import 使用（能说出具体文件名）
2. **命名唯一** — 全局搜索组件名，不与现有组件冲突
3. **层级正确** — 放在 atoms/molecules/organisms/templates 正确层级，不跨层越界
4. **最小可用** — 只实现当前需求功能，无多余"预留 props"或"未来扩展"
5. **注册登记** — componentRegistry.ts 中已登记，consumers 字段填写实际消费方
6. **有测试覆盖** — 核心交互有单元测试（Atom: 快照+事件 / Molecule: 功能+边界 / Organism: Store交互+主流程）
7. **有文档注释** — 组件顶部有 JSDoc，Props 有注释
8. **门禁通过** — `npm run gate:dev` 全绿（含 audit:deadcode --staged, audit:atomic, lint:colors）

#### A2. 逆向校验（5 项，防止误判）
> 从反方向验证，确保每项检查不流于形式

| 正向检查项 | 逆向校验方法 | 通过标准 |
|-----------|-------------|---------|
| 有消费方 | Grep 组件名 / import 路径，排除测试文件和 barrel 自身 | 至少 1 处业务代码引用 |
| 命名唯一 | Grep `export.*ComponentName` 和 `from.*ComponentName` | 仅 1 处定义 |
| 层级正确 | 运行 `npm run audit:atomic` | 0 violation |
| 最小可用 | 检查 props 数量，统计未被消费方使用的 props | 未使用 props ≤ 1 个 |
| 门禁通过 | 运行 `npm run audit:deadcode -- --staged` | 0 增量零引用组件 |

#### A3. 覆盖率验证
检查完成后确认：
- [ ] 8 项正向全部通过
- [ ] 5 项逆向全部通过
- [ ] 至少运行了 2 条自动化命令验证（audit:atomic + audit:deadcode --staged）

---

### 场景 B：新模块自查（6 要素 + 逆向校验）

#### B1. 正向检查（6 要素 DoD）
新功能模块完成后，对照 DoD 确认：

1. **类型层** — 核心数据结构有类型定义，存放在 `src/types/modules/`，typecheck 通过
2. **服务层** — 业务逻辑封装在 Service，写操作走 DataBridge 信封协议，audit:layers 零 violation
3. **状态层** — Store 完整，有 init/fetch/reset 方法，有 withBroadcast 中间件，有测试覆盖
4. **UI 层** — 页面/组件完整，有 loading/empty/error 三态，颜色使用设计令牌
5. **入口层** — 有明确访问入口（路由/菜单/按钮），首页 3 次点击内可达，audit:routes 通过
6. **文档层** — 有功能说明文档 + 技术文档，模块在功能清单/moduleManifest 中有登记

#### B2. 逆向校验（6 项，防止"自认为完成"）

| 正向要素 | 逆向校验方法 | 通过标准 |
|---------|-------------|---------|
| 类型层 | 反向检查：有多少 any 类型 / 类型断言 | any 数量 = 0 |
| 服务层 | 反向检查：是否有直接操作 dataLayer 的代码（绕过 DataBridge） | 0 处直连 dataLayer |
| 状态层 | 反向检查：Store 中是否有未被 UI 消费的 state/action | 未消费字段 ≤ 2 个 |
| UI 层 | 反向检查：三态（loading/empty/error）是否真的有对应分支代码 | 3 态都有实现 |
| 入口层 | 反向检查：从 routes.ts 出发追踪到模块入口，是否可到达 | 路径可达 |
| 文档层 | 反向检查：文档描述与实际代码是否一致（字段名、流程） | 一致无偏差 |

#### B3. 覆盖率验证
- [ ] 6 要素正向全部通过
- [ ] 6 项逆向全部通过
- [ ] 运行了 `npm run audit:layers` 和 `npm run audit:routes`
- [ ] 运行了 `npm run audit:deadcode -- --staged`（验证新增文件零僵尸）

---

### 场景 C：PR Review 检查（5 项 + 逆向校验）

#### C1. 正向检查（5 项）
Review 他人 PR 时重点关注：

1. **新增组件有消费方吗？** — 只有组件没有调用方的，打回
2. **componentRegistry 同步了吗？** — 新增/修改/删除组件时，registry 是否同步变更
3. **命名有冲突吗？** — 新组件名是否与现有重名，是否符合命名规范
4. **分层正确吗？** — 组件在正确层级吗？有没有跨层依赖（molecule import store）
5. **入口层验证了吗？** — 新功能模块有没有路由注册和导航入口

#### C2. 逆向校验（Reviewer 视角，3 招防遗漏）

| 检查项 | 逆向方法（Reviewer 怎么验证） |
|-------|------------------------------|
| 有消费方 | 在 PR diff 中搜索 `from '.*组件名'`，看有没有非组件文件的 import |
| 命名冲突 | 用 Grep 全仓搜组件名，看是否有重名 |
| 分层正确 | 读组件的 import 列表，看有没有引入 store/service/业务层文件 |
| 入口层 | 搜索 routes.ts 和导航组件，看新路径是否真的被注册和链接 |
| Registry 同步 | 对比 PR 中新增组件文件数与 componentRegistry 新增条目数 |

#### C3. 覆盖率验证
- [ ] 5 项正向全部检查
- [ ] 至少做了 3 项逆向验证
- [ ] 运行了 `npm run gate:quick` 确认核心门禁通过

---

## 三、双向校验原理

### 为什么需要双向校验？
- **正向检查**：从"应该有什么"出发，防止漏项 → 保证覆盖率
- **逆向校验**：从"有没有假的"出发，防止自欺欺人 → 保证准确率

### 准确率保障机制
1. **自动化验证优先**：能用命令行验证的，不只靠人工勾选
2. **反向证据要求**：每一项正向结论都需要有反向证据支撑
3. **交叉验证**：至少运行 2 条独立的审计命令互相印证
4. **可复现**：所有检查项都有明确的验证方法，任何人按步骤都能得出相同结论

### 覆盖率保障机制
1. **三维覆盖**：组件层 / 模块层 / Review 层，三层各有清单
2. **每层双轨**：正向 + 逆向，双向验证无死角
3. **自动化兜底**：gate:dev 全量门禁作为最后防线
4. **文档闭环**：检查结果与相关文档交叉引用

---

## 四、使用方法

### 快速调用（推荐）
```
调用本 SKILL → 选择场景（A/B/C）→ 正向逐项过 → 逆向交叉验 → 输出结果
```

### 完整调用
```
1. 用户触发检查
2. 识别场景（组件/模块/Review）
3. 执行正向 Checklist
4. 执行逆向校验
5. 运行自动化审计命令
6. 输出检查报告（通过项 / 未通过项 / 建议）
```

---

## 五、输出模板

### 检查报告格式
```
## ✅ 开发检查清单报告

**场景**：新组件自查 / 新模块自查 / PR Review
**检查时间**：YYYY-MM-DD HH:MM
**组件/模块名**：xxx

### 正向检查结果
| # | 检查项 | 结果 | 证据 |
|---|--------|------|------|
| 1 | xxx | ✅/❌ | 命令输出 / Grep 结果 |

### 逆向校验结果
| # | 校验项 | 结果 | 方法 |
|---|--------|------|------|
| 1 | xxx | ✅/❌ | 具体验证步骤 |

### 自动化验证
- [ ] gate:dev / gate:quick
- [ ] audit:deadcode --staged
- [ ] audit:atomic / audit:layers
- [ ] audit:registry

### 结论
- **通过率**：X / Y 项通过
- **是否通过**：✅ 通过 / ❌ 不通过
- **待改进项**：列出具体问题和建议
```

---

## 六、相关资源

### 快速命令速查
```bash
# 组件级
npm run audit:deadcode -- --staged   # 增量死代码检查
npm run audit:atomic                  # 原子分层合规
npm run audit:registry                # 注册表一致性

# 模块级
npm run audit:layers                  # 分层架构合规
npm run audit:routes                  # 路由一致性
npm run gate:dev                      # 开发门禁全量
npm run gate:quick                    # 快速门禁
```

### 参考文档
- 组件准入政策：`docs/guides/component-admission-policy.md`
- 模块完成标准：`docs/guides/module-completion-standard.md`
- 生命周期 SOP：`docs/guides/component-lifecycle-sop.md`
- 经验教训手册：`docs/guides/lessons-learned-component-governance.md`

### 关键文件
- 组件注册表：`src/components/componentRegistry.ts`
- 路由注册表：`src/config/routes.ts`
- 模块清单：`src/config/moduleManifest.ts`

---

## 七、注意事项

1. **先自动化后人工**：优先运行命令行检查，再做人工确认
2. **不跳过逆向**：不要只勾选正向着，逆向校验是防误判的关键
3. **实事求是**：不确定的项标记为"待确认"，不要硬判通过
4. **留痕**：重要检查要记录验证命令和结果，方便追溯
5. **持续迭代**：发现新的检查点或校验方法，更新本 SKILL
