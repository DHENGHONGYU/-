# Mock 数据清理全流程：经验教训与开发规范

> **日期**: 2026-07-18 | **范围**: FinSightV9 全项目 | **涉众**: 全体开发团队
> **关联**: `outputs/mock-diagnosis-report-2026-07-18.html`（诊断报告）、`.workbuddy/skills/mock-data-diagnosis/SKILL.md`（诊断 Skill）

---

## 一、清理成果总览

| 阶段 | 修复数量 | 改动文件 | 测试状态 |
|------|----------|----------|----------|
| 诊断报告 | 17 项问题（P0:4 / P1:8 / P2:5）| 0（诊断）| — |
| Phase 1 P0 修复 | 4 项 | 8 文件 | 43/43 ✅ |
| 深度检索 + 增量修复 | 4 项 | 5 文件 | 73/73 ✅ |

### 已修复的全部 Mock 残留清单

| # | 文件 | 问题 | 严重级 |
|---|------|------|--------|
| 1 | `src/store/dualStrategyStore.ts` | 直接 import fixtures Mock 数据作为空股票池回退 | P0 |
| 2 | `src/store/hotSectorStore.ts` | 内联 4 个板块硬编码 Mock 数据（~40 行）| P0 |
| 3 | `src/store/rotationSignalStore.ts` | 内联 3 个板块硬编码 Mock 数据 + `inputs ?? DEFAULT_SAMPLES` | P0 |
| 4 | `src/store/valuePitStore.ts` | 内联 6 组硬编码 Mock 数据 + `inputs ?? DEFAULT` ×3 | P0 |
| 5 | `src/config/collectConfig.ts` | `allowMockFallback: true` 生产环境静默切假数据 | P0 |
| 6 | `src/services/input/inputService.ts` | `searchStocks()` 搜索 `MOCK_STOCK_LIBRARY` 10 只假股票 | P1 |
| 7 | `src/store/collectionWizardStore.ts` | `savedConfigs: MOCK_CONFIGS` 初始值用假配置 | P1 |
| 8 | `src/store/analysisNewsStore.ts` | `generateMockArticles` 持久化假新闻到 DB | P1 |

---

## 二、Mock 残留的 5 种形态（诊断手册）

本轮清理中发现的 Mock 残留可归纳为 5 种固定形态。以后的代码审查应以此为检查清单。

### 形态 1：直接引用（Direct Import）

**特征**: Store/Service/Component 直接 import `fixtures/` 或 `__mocks__/` 中的数据。

```typescript
// ❌ 反例
import { HOT_SECTOR_DEFAULT_SAMPLES } from '@/fixtures/dualStrategyMockData'
// ✅ 正例：要么移除 import，数据来源从真实的 Store/DB 获取
```

**修复**: 移除 import，数据来源改为 DB/Store/Context。

---

### 形态 2：内联硬编码样本（Inline Default Samples）

**特征**: Store 文件中定义 `const DEFAULT_SAMPLES: XxxInput[] = [...]`，在 `fetchScores(inputs)` 中用 `inputs ?? DEFAULT_SAMPLES` 作为静默回退。

```typescript
// ❌ 反例（hotSectorStore / rotationSignalStore / valuePitStore）
const DEFAULT_SAMPLES = [{ symbol: '银行', ... }, ...]
const sourceInputs = inputs ?? DEFAULT_SAMPLES  // ← 静默回退到假数据

// ✅ 正例
if (!inputs || inputs.length === 0) {
  logger.info('[XxxStore] 无输入数据，返回空结果')
  set({ loading: false })
  return
}
```

**修复**: 删除 `DEFAULT_SAMPLES`，无输入时返回空结果。

---

### 形态 3：全局降级允许 Mock（Global allowMockFallback）

**特征**: 配置层中 `allowMockFallback: true` 导致任何 API 失败都静默切换到假数据。

```typescript
// ❌ 反例
DEFAULT_FALLBACK_POLICY = { allowFallback: true, allowMockFallback: true }
// ✅ 正例
DEFAULT_FALLBACK_POLICY = { allowFallback: true, allowMockFallback: !import.meta.env.PROD }
```

**修复**: 生产构建关闭 `allowMockFallback`。

---

### 形态 4：Mock 库代替真实数据（Mock Library as Data Source）

**特征**: 功能链路中使用硬编码 Mock 数据库而非用户已导入的真实数据。

```typescript
// ❌ 反例
import { MOCK_STOCK_LIBRARY } from './mockStockLibrary'
searchStocks(query) { return MOCK_STOCK_LIBRARY.filter(...) }

// ✅ 正例
searchStocks(query) {
  const result = await dataBridge.query<Stock[]>({ action: QUERY_LIST, store: STORE_NAME.stocks })
  return result.data?.filter(...) ?? []
}
```

**修复**: 改为从 DB/用户数据源查询。

---

### 形态 5：Mock 数据写入持久化（Persistence Pollution）

**特征**: Store action 调用 `generateMock*()` 将假数据写入 IndexedDB，混入真实存储。

```typescript
// ❌ 反例
generateMockArticles: async () => {
  const articles = generateMockArticles(5)
  await saveNewsArticles(articles)  // ← 假数据写入 DB
}

// ✅ 正例
generateMockArticles: async () => {
  if (import.meta.env.PROD) return  // 生产环境守卫
  const articles = generateMockArticles(5)
  await saveNewsArticles(articles)
}
```

**修复**: 加 `import.meta.env.PROD` 守卫，生产环境直接 return。

---

## 三、本轮诊断发现的门禁盲区

以下两项违规**均未被 `audit:layers` 扫描到**，在门禁全绿的前提下真实存在：

| 盲区 | 违规 | 影响 |
|------|------|------|
| `store → fixtures/` 依赖 | `audit:layers` 只扫 services/config/core/lib，不扫 store 对其他目录的引用 | `dualStrategyStore` 的 fixtures import 不被检测 |
| `services → cockpit/` 依赖 | `audit:layers` 规则 5 只检测 services→store，不检测 services→cockpit | `MockCollector` 跨层 import 不被检测 |

**建议**: 在 Phase 2 扩展 `scripts/audit-layer-calls.ts` 补充这两条规则。

---

## 四、开发规范（团队预防措施）

### 4.1 新模块开发时禁用 Mock 数据

- **Store 中禁止定义 `DEFAULT_SAMPLES` / `DEFAULT_*` 内联数据**
- **Store 无输入时必须返回空状态**，不能静默 fallback 到假数据
- **搜索/查询功能必须从 DB 读取**，不能依赖 `MOCK_*_LIBRARY`

### 4.2 Mock 数据使用规范

- Mock 数据**仅允许**在以下场景使用：
  - `tests/` 目录的测试代码
  - `src/fixtures/` 目录（仅被 tests 引用）
  - 降级链最末端（`mockProvider.ts`），且生产环境不可达
- **禁止**: Store 初始值、默认策略、全局回退策略中的 Mock 数据

### 4.3 Pull Request 检查清单

提交 PR 前自查以下项目：

- [ ] `grep -rn "from.*fixtures" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."` → 0 结果
- [ ] `grep -rn "inputs ?? DEFAULT" src/store/` → 0 结果
- [ ] `grep -rn "allowMockFallback.*true" src/config/` → 仅 `!import.meta.env.PROD` 修饰
- [ ] `grep -rn "generateMock.*write\|generateMock.*save\|generateMock.*persist" src/store/` → 0 结果或已加 PROD 守卫

### 4.4 使用诊断 Skill

项目中已安装 `mock-data-diagnosis` Skill，可通过以下方式触发：

```
"对项目做 Mock 数据残留诊断"
"排查 Mock 数据到真实数据过渡链路"
"数据流健康度检查"
```

具体检查项和 Grep 命令详见 `.workbuddy/skills/mock-data-diagnosis/SKILL.md`。

---

## 五、剩余的已知 Mock 数据（Phase 2 跟踪）

以下 Mock 数据已评估为 P2（不阻塞上线但需后续处理）：

| 文件 | 内容 | 计划 |
|------|------|------|
| `src/services/ai-center/` | MockAIHealthScoringStrategy 默认策略 | 实现 Real 策略后移除 |
| `src/services/stock-analysis/` | MockStockAnalysisScoringStrategy 默认策略 | 实现 Real 策略后移除 |
| `src/services/data-collector/collectionPipeline.ts` | 维度 03-08 generateMock* 函数 | 逐个对接真实 API |
| `src/cockpit/data/mockDataProvider.ts` | UI 演示用 Mock 数据 | 标记 demo-only |
| `src/services/trading/mockDataGenerator.ts` | 被 MCP Server 调用的 Mock 生成器 | MCP 区分 dev/prod |
| `src/store/collectionWizardStore.mock.ts` | MOCK_CONFIGS 定义（仅 test 引用） | 保留作为测试 seed |
| `src/services/input/mockStockLibrary.ts` | MOCK_STOCK_LIBRARY 定义（无生产引用） | 可清理或保留作为 offline 降级 |

---

## 六、总结

本轮 Mock 数据清理完成了从诊断 → 修复 → 验证 → 规范沉淀的完整链路：

1. **诊断**: 三维并行扫描（Mock 残留 + 信息孤岛 + 兼容性）→ 17 项问题
2. **修复**: 两轮深度修复，共清除 8 处生产代码中的 Mock 残留
3. **验证**: `tsc --noEmit` 0 错误，73 个相关测试全绿
4. **沉淀**: `mock-data-diagnosis` Skill + 本文档（团队开发规范）

**关键教训**: Mock 数据的最大危险不是它的存在，而是它作为**默认/回退路径**时的静默行为。用户无法区分真实数据和 Mock 数据，而门禁也无法检测这类问题（当前存在 2 个盲区）。修复的核心原则是：**任何 Mock 数据都不应成为生产环境中无用户提示的默认数据来源。**

---

*本文档由 Mock 数据诊断工作流自动生成，供开发团队后续查阅。更新日期: 2026-07-18。*
