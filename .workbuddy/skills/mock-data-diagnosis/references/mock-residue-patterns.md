# Mock 残留 5 种经典形态（诊断速查手册）

> 来源：FinSightV9 2026-07-18 全量 Mock 诊断实战，25 个生产代码文件扫描总结

---

## 形态 1：直接引用（Direct Import）

**定义**：生产代码（Store/Service/Component）直接 import `fixtures/` 或 `__mocks__/` 中的数据

**检测命令**：
```bash
grep -rn "from.*fixtures" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v "/tests/"
```

**典型案例**：
```typescript
// src/store/dualStrategyStore.ts:41 — P0 阻塞
import { HOT_SECTOR_DEFAULT_SAMPLES, ROTATION_DEFAULT_SAMPLES }
  from '@/fixtures/dualStrategyMockData'

// 第 230 行：股票池为空时用 Mock 数据回退
hotSectorScores = HOT_SECTOR_DEFAULT_SAMPLES.map(analyzeHotSector)
```

**修复方向**：将常量移入 `src/constants/` 或 `src/data/`，或改为抛错误 + UI 空状态处理

**严重级判定**：Store 级引用 → P0；Service 级引用 → P1；Component 级引用 → P2

---

## 形态 2：初始值污染（Initial Value Pollution）

**定义**：Store 初始状态用 MOCK_* 常量，用户首次打开即看到假数据

**检测命令**：
```bash
grep -rn "MOCK_\|mockConfig\|mockState" src/store/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
grep -rn "from.*\.mock" src/store/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**典型案例**：
```typescript
// src/store/collectionWizardStore.ts:73 — 用户首次打开看到假配置
savedConfigs: MOCK_CONFIGS  // from '@/store/collectionWizardStore.mock'

// src/store/hotSectorStore.ts:26-61 — 内联 Mock 数据与 fixtures 重复
const HOT_SECTOR_DEFAULT_SAMPLES = [
  { name: 'AI算力', ... },
  { name: '半导体', ... },
  ...
]
```

**修复方向**：改为空数组 + 首次渲染时从 DB 加载；若 DB 为空展示空状态引导

**严重级判定**：用户首次打开即看到假数据 → P0；初始化后可被真实数据覆盖 → P1

---

## 形态 3：默认策略污染（Default Strategy Pollution）⚠️ 最危险

**定义**：DI/Provider 模式中，未注入真实策略时静默使用 Mock 实现，且真实策略全量空桩

**检测命令**：
```bash
# 找 Mock* 类的实例化
grep -rn "new Mock[A-Z]" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 找策略方法是否 throw 'not implemented'
grep -rn "throw.*not implemented\|throw.*unimplemented\|throw.*TODO" src/services/ --include="*.ts" | grep -A2 "class Real"
```

**典型案例**：
```typescript
// src/services/ai-center/aiCenterProvider.ts:49 — 默认 new Mock 策略
getAIHealthScoringStrategy(): AIHealthScoringStrategy {
  return this.injectedStrategy ?? new MockAIHealthScoringStrategy() // ← 危险
}

// src/services/stock-analysis/scoringStrategy.ts:390 — 真实策略全量空桩
class RealStockAnalysisScoringStrategy {
  analyze(): Score { throw 'not implemented' }     // ← 全部 throw
  score(): Score { throw 'not implemented' }
  rank(): Rank[] { throw 'not implemented' }
  // ... 7 个方法全部空桩
}
```

**修复方向**：实现真实策略 → Provider 移除默认 Mock 赋值 → 改为构造时强制注入，未注入时抛 Error

**严重级判定**：真实实现全量空桩 → P0；部分空桩 → P1

---

## 形态 4：静默降级（Silent Degradation）

**定义**：全局回退策略允许 Mock、或页面在 DEV 模式下有完整的 Mock 数据分支

**检测命令**：
```bash
# 全局回退策略
grep -rn "allowMockFallback\|allowMock\|mockFallback" src/config/ src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# DEV mock 分支
grep -rn "USE_MOCK\|isMock\|\.DEV.*mock\|NODE_ENV.*mock" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**典型案例**：
```typescript
// src/config/collectConfig.ts:358 — 全局默认允许 Mock 降级
DEFAULT_FALLBACK_POLICY = {
  allowFallback: true,
  allowMockFallback: true,  // ← 生产环境也生效！
  alertFailureRate: 80
}

// src/pages/trading/TradingFlowPage.tsx:25
const USE_MOCK_DATA = import.meta.env.DEV  // DEV 模式走 Mock
```

**修复方向**：生产构建 `allowMockFallback: false`；DEV Mock 分支由 feature flag 控制，添加空状态处理

**严重级判定**：生产环境生效且无 UI 提示 → P0；仅 DEV 生效 → P2

---

## 形态 5：持久化污染（Persistence Pollution）

**定义**：Store action 调用 generateMock* 函数将假数据写入持久化存储（IndexedDB/DataBridge）

**检测命令**：
```bash
grep -rn "generateMock\|createMock.*Articles\|mockData.*write\|mockData.*persist" src/store/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**典型案例**：
```typescript
// src/store/analysisNewsStore.ts:104-125
generateMockArticles: async () => {
  const articles = newsService.generateMockArticles()  // 生成假新闻
  const envelope = createEnvelope({ articles })         // 包装
  await DataBridge.forward(envelope)                    // ← 写入 DB！
}
```

**修复方向**：action 加 DEV 守卫（`if (!import.meta.env.DEV) return`）；生产环境改为 no-op

**严重级判定**：写入主存储表 → P1；写入独立 dev 表 → P2

---

## 复合案例（多形态叠加）

在实际诊断中，同一个问题可能同时呈现多种形态。例：

| 文件 | 形态 | P 级 |
|------|------|------|
| `dualStrategyStore.ts` | 形态 1（直接引用）+ 形态 2（初始值污染）| P0 |
| `collectionWizardStore.ts` | 形态 2（初始值污染）+ 形态 5（持久化污染）| P0 |
| `TradingFlowPage.tsx` | 形态 4（静默降级）+ 形态 1（直接引用）| P1 |

复合形态 → P0 的判定标准：用户是否会在无感知情况下看到或存储假数据？是 → P0。
