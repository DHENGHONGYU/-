---
title: code-review-training
type: explanation
domain: project
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "培训对象: V9 项目所有代码审查�?> 培训目标: 统一审查标准、提高审查效率、保证代码质�?"
tags: [project, plan, review, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-166
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 代码审查者培训材�?
> **Version**: v1.0.0 | **日期**: 2026-07-05
> **培训对象**: V9 项目所有代码审查�?> **培训目标**: 统一审查标准、提高审查效率、保证代码质�?
---

## 培训大纲

1. [代码审查基础](#一代码审查基础)
2. [审查标准详解](#二审查标准详�?
3. [审查流程实操](#三审查流程实�?
4. [常见场景与案例](#四常见场景与案例)
5. [审查工具使用](#五审查工具使�?
6. [考核与认证](#六考核与认�?

---

## 一、代码审查基础

### 1.1 什么是代码审查�?
**定义**: 代码审查（Code Review）是作者提交代码后，由其他开发者检查代码质量的过程�?
**目标**:
- �?发现缺陷（Bug、安全漏洞、性能问题�?- �?保证代码质量（可读性、可维护性）
- �?知识共享（团队成员了解代码变更）
- �?遵守规范（架构规则、编码标准）

### 1.2 三级审查体系

```
┌─────────────────────────────────────────────────────────�?�? L1: 自动化审查（强制�?                               �?�? ├── ESLint 自动修复 + 检�?                          �?�? ├── TypeScript 类型检�?                             �?�? ├── 单元测试（覆盖率 > 80%�?                        �?�? ├── 架构审计（audit:layers/hardcode/deadcode�?      �?�? └── Husky + lint-staged 提交前检�?                  �?└─────────────────────────────────────────────────────────�?                         �?自动通过
┌─────────────────────────────────────────────────────────�?�? L2: 同级审查（Mandatory�?                            �?�? ├── 所有业务代码必须至�?1 人审�?                   �?�? ├── 核心模块（services/store/core）必�?2 人审�?   �?�? └── 审查者使�?Checklist 检�?                       �?└─────────────────────────────────────────────────────────�?                         �?审查通过
┌─────────────────────────────────────────────────────────�?�? L3: 架构审查（特定场景）                              �?�? ├── 跨模块重构（3+ 模块�?                           �?�? ├── 数据�?Schema 变更                                �?�? ├── 接口签名变更                                      �?�? └── 技术栈变更（需技术评审委员会�?                   �?└─────────────────────────────────────────────────────────�?```

### 1.3 审查者角色与职责

| 角色 | 职责 | 权限 |
|------|------|------|
| **Author（作者）** | 编写代码、响应审查意见、修复问�?| 创建 PR、响应意�?|
| **Reviewer（审查者）** | 检查代码质量、提出改进建议、批�?拒绝 PR | 批准/拒绝 PR、请求修�?|
| **Architect（架构师�?* | 审查架构影响、技术决策合规�?| 否决架构违规 PR |
| **Maintainer（维护者）** | 最终合并权限、版本发布决�?| 合并 PR、管理分�?|

**审查者核心职�?*:
1. 及时响应�?4 小时内开始审查）
2. 全面检查（�?Checklist 逐项检查）
3. 建设性反馈（指出问题 + 提供修复建议�?4. 区分优先级（明确标注 P0/P1/P2 问题�?5. 批准标准（所�?P0 问题解决后才能批准）

---

## 二、审查标准详�?
### 2.1 P0 问题（必须修复）

#### �?架构合规�?
**检查项**:
- [ ] 无跨层调用违规（`npm run audit:layers` �?0 violations�?- [ ] 依赖方向正确（符�?AGENTS.md §1 依赖方向规则�?- [ ] 新模块按四步集成（类型定�?�?Store �?Service �?UI�?- [ ] 路由注册完整（routes.ts + App 分发�?+ docs/06-routing-specs.md�?
**常见违规案例**:

```typescript
// �?错误：pages/ 直接调用 db
// 路径: src/pages/AnalysisPage.tsx
import { db } from '@/data/db';  // 违规！pages/ 不能直接依赖 data/

// �?正确：通过 Store 获取数据
import { useAnalysisStore } from '@/store/analysisStore';
const data = useAnalysisStore(state => state.data);
```

```typescript
// �?错误：services/ 直接�?db
// 路径: src/services/analysisService.ts
db.analysis.put(data);  // 违规！应通过 DataBridge.forward()

// �?正确：通过 DataBridge 写入
import { DataBridge } from '@/core/DataBridge';
DataBridge.forward(ENVELOPE_ACTION.ANALYSIS_UPDATE, data);
```

#### �?类型安全

**检查项**:
- [ ] �?`any` 类型（ESLint `@typescript-eslint/no-explicit-any: error`�?- [ ] �?`@ts-ignore`（使�?`@ts-expect-error` + 注释�?- [ ] 所有数据结构有 TypeScript Interface
- [ ] 复杂泛型�?`Expect<Equals>` 类型测试

**常见违规案例**:

```typescript
// �?错误：使�?any
function processData(data: any) {  // 违规�?  return data.map((item: any) => item.value);  // 双重违规�?}

// �?正确：定�?Interface
interface ProcessDataInput {
  id: string;
  value: number;
  timestamp: number;
}

function processData(data: ProcessDataInput[]) {
  return data.map(item => item.value);
}
```

```typescript
// �?错误：使�?@ts-ignore
// @ts-ignore  // 违规！屏蔽了类型错误
const result = data as any;

// �?正确：使�?@ts-expect-error 并说明原�?// @ts-expect-error 第三方库类型定义不完整，已知问题：https://github.com/xxx/issues/123
const result = data as unknown as ExpectedType;
```

#### �?零硬编码

**检查项**:
- [ ] 颜色使用令牌（通过 `npm run audit:hardcode` �?0 violations�?- [ ] 魔法数字已提取为 const �?config
- [ ] 引擎层参数从 `config.ts` 注入

**常见违规案例**:

```tsx
// �?错误：直接使�?HEX 颜色
<div style={{ color: '#10b981' }}>文本</div>  // 违规�?
// �?错误：直接使�?Tailwind 颜色�?<span className="text-red-500">�?/span>  // 违规�?
// �?正确：使用颜色令�?import { COLOR_TOKENS } from '@/constants/theme.tokens';
<span className={COLOR_TOKENS.up.tailwind}>+3.2%</span>  // text-red-500
<div style={{ color: COLOR_TOKENS.up.hex }}>文本</div>  // #ef4444
```

```typescript
// �?错误：魔法数�?if (score > 85) {  // 违规�?5 是什么？
  return 'excellent';
}

// �?正确：提取为 const
const SCORE_THRESHOLD = {
  EXCELLENT: 85,
  GOOD: 60,
  POOR: 30,
} as const;

if (score > SCORE_THRESHOLD.EXCELLENT) {
  return 'excellent';
}
```

#### �?功能正确�?
**检查项**:
- [ ] 单元测试覆盖�?> 80%
- [ ] 边界处理（null/undefined/empty�?- [ ] 错误处理（try-catch + logger.error�?- [ ] 事件清理（useEffect cleanup�?
**常见违规案例**:

```typescript
// �?错误：未处理边界情况
function formatPrice(price: number) {
  return price.toFixed(2);  // 如果 price �?NaN 会报�?}

// �?正确：处理边界情�?function formatPrice(price: number) {
  if (isNaN(price) || price == null) {
    return '--';
  }
  return price.toFixed(2);
}
```

```tsx
// �?错误：未清理事件监听
useEffect(() => {
  window.addEventListener('resize', handleResize);  // 内存泄漏�?}, []);

// �?正确：清理事件监�?useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### 2.2 P1 问题（强烈建议）

#### 🔍 代码质量

- [ ] 命名规范（kebab-case / PascalCase / camelCase�?- [ ] 函数长度 < 50 行（超过需拆分�?- [ ] 文件长度 < 300 行（超过需拆分�?- [ ] 圈复杂度 < 10
- [ ] 无重复代�?
**案例**: 函数过长如何拆分

```typescript
// �?错误：函数过长（80 行）
function processAnalysisData(rawData: RawData[]) {
  // 1. 数据验证�?0 行）
  // 2. 数据清洗�?0 行）
  // 3. 数据转换�?0 行）
  // 4. 数据存储�?0 行）
}

// �?正确：拆分为多个函数
function processAnalysisData(rawData: RawData[]) {
  const validated = validateData(rawData);
  const cleaned = cleanData(validated);
  const transformed = transformData(cleaned);
  storeData(transformed);
}

function validateData(data: RawData[]): ValidatedData[] { /* ... */ }
function cleanData(data: ValidatedData[]): CleanedData[] { /* ... */ }
function transformData(data: CleanedData[]): TransformedData[] { /* ... */ }
function storeData(data: TransformedData[]): void { /* ... */ }
```

#### 🔍 性能优化

- [ ] React 组件使用 `React.memo` / `useMemo` / `useCallback`
- [ ] 大型组件使用 `React.lazy()` 或动�?import
- [ ] 搜索/滚动等高频操作有防抖/节流
- [ ] 定时�?订阅在组件卸载时清理

**案例**: 避免不必要的重渲�?
```tsx
// �?错误：每次渲染都创建新对�?函数
function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map(user => (
        <UserItem
          key={user.id}
          user={user}
          style={{ color: 'red' }}  // 每次渲染都创建新对象�?          onClick={() => console.log(user.id)}  // 每次渲染都创建新函数�?        />
      ))}
    </div>
  );
}

// �?正确：使�?useMemo / useCallback
function UserList({ users }: { users: User[] }) {
  const style = useMemo(() => ({ color: 'red' }), []);
  
  const handleClick = useCallback((userId: string) => {
    console.log(userId);
  }, []);
  
  return (
    <div>
      {users.map(user => (
        <UserItem
          key={user.id}
          user={user}
          style={style}
          onClick={() => handleClick(user.id)}
        />
      ))}
    </div>
  );
}
```

### 2.3 P2 问题（可选改进）

#### 代码风格

- [ ] 代码风格与项目现有代码一�?- [ ] 可以用更简洁方式实现（如数组方法替代循环）
- [ ] 可以利用 TypeScript 类型推导减少冗余类型注解

**案例**: 简化代�?
```typescript
// �?可以简化：使用 for 循环
const result: number[] = [];
for (let i = 0; i < data.length; i++) {
  if (data[i].score > 80) {
    result.push(data[i].value);
  }
}

// �?简化：使用数组方法
const result = data
  .filter(item => item.score > 80)
  .map(item => item.value);
```

---

## 三、审查流程实�?
### 3.1 标准流程（适用于大多数场景�?
```
┌──────────────────────────────────────────────────────────�?�?Step 1: 作者自检（Pre-Review�?                         �?├──────────────────────────────────────────────────────────�?�?1. 运行本地检查命�?                                     �?�?   npm run pre-review                                   �?�?2. 填写 PR 描述模板                                    �?�?   （使�?.github/pull_request_template.md�?            �?�?3. 自查 Checklist                                       �?�?   （docs/code-review.md §2�?                          �?�?4. 提交 PR 并指定审查�?                               �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 2: 审查者审查（Review�?                            �?├──────────────────────────────────────────────────────────�?�?1. 检�?PR 描述完整�?                                  �?�?2. 运行本地验证命令（确保可复现�?                       �?�?   npm run pre-review                                   �?�?3. �?Checklist 逐项检�?                               �?�?   （docs/code-review.md §2�?                          �?�?4. 使用审查意见模板提出意见                             �?�?   （docs/code-review.md §4.2�?                        �?�?5. 批准（Approve�? 请求修改（Request Changes�?          �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 3: 作者修改（Revision�?                            �?├──────────────────────────────────────────────────────────�?�?1. 响应所有审查意�?                                     �?�?2. 修改代码并回复审查意�?                               �?�?3. 重新提交审查（如需要）                                �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 4: 最终批准与合并（Approval & Merge�?               �?├──────────────────────────────────────────────────────────�?�?1. 所�?P0 问题解决                                     �?�?2. 审查者批准（Approved�?                               �?�?3. 维护者合并到主分�?                                   �?�?4. 删除功能分支（如适用�?                               �?└──────────────────────────────────────────────────────────�?```

### 3.2 审查者实操步�?
#### Step 1: 接收审查请求

**通知方式**:
- GitHub PR 审查请求（自动邮�?Slack 通知�?- 团队群消息（@审查者）

**响应时间**: 24 小时内开始审查（工作日）

#### Step 2: 拉取 PR 分支

```powershell
# 1. 查看 PR 信息
# �?GitHub PR 页面查看�?# - PR 编号
# - 源分支名
# - 目标分支

# 2. 拉取 PR 分支
git fetch origin
git checkout pr-branch-name

# 3. 运行本地验证
npm run pre-review
```

#### Step 3: 审查代码

**审查工具**:
- GitHub PR 页面（在线审查）
- VS Code + GitLens（本地审查）
- GitHub Desktop（可视化审查�?
**审查顺序**:
1. 先检�?PR 描述完整�?2. 运行本地验证命令（确保可复现�?3. �?Checklist 逐项检查（�?P0 �?P1 �?P2�?4. 重点审查�?   - 架构合规性（分层、依赖方向）
   - 类型安全（any、Interface�?   - 零硬编码（颜色令牌、魔法数字）
   - 功能正确性（测试、边界处理、错误处理）

**审查技�?*:
- 先看整体（架构、文件结构），再看细节（代码实现�?- 重点关注核心模块（services/store/core�?- 使用搜索快速定位关键模式（�?`any`、`db.`、`color:`�?- 运行代码并手动测试（涉及 UI 变更�?PR�?
#### Step 4: 提出审查意见

**意见模板**（见 `docs/code-review.md §4.2`�?

```markdown
�?**需要修�?* (P0 问题)

### P0 问题（必须修复）

1. **[架构违规]** `src/services/xxx.ts:45`
   - 问题: 直接调用�?`db`，应通过 `DataBridge.forward()`
   - 修复建议: 
     ```typescript
     // 修改�?     db.analysis.put(data);
     
     // 修改�?     import { DataBridge } from '@/core/DataBridge';
     DataBridge.forward(ENVELOPE_ACTION.ANALYSIS_UPDATE, data);
     ```

2. **[类型安全]** `src/components/XXX.tsx:23`
   - 问题: 使用 `any` 类型
   - 修复建议: 定义 `interface XXXProps { ... }` 替代 `any`

### P1 问题（强烈建议）

3. **[代码质量]** `src/services/contracts.ts`
   - 问题: 函数过长�?0 行）
   - 修复建议: 拆分�?`validateInput()` + `processData()` + `formatOutput()`

### P2 问题（可选改进）

4. **[最佳实践]** `src/components/XXX.tsx:15`
   - 问题: 内联对象导致重渲�?   - 修复建议: 提取�?`const style = useMemo(...)`

---

请修�?P0 问题后重新提交审查�?```

**意见标注规范**:
- 使用标签标明问题类别（如 `[架构违规]`、`[类型安全]`�?- 注明文件位置（文件路�?+ 行号�?- 提供修复建议（最好有代码示例�?- 明确优先级（P0/P1/P2�?
#### Step 5: 批准/拒绝 PR

**批准条件**:
- 所�?P0 问题已解�?- 代码质量符合要求
- 本地验证通过

**批准操作**:
```markdown
�?**LGTM** (Looks Good To Me)

所�?P0 检查项通过，代码质量符合要求。可以合并�?```

**拒绝条件**:
- 存在 P0 问题未解�?- 架构违规未修�?- 测试覆盖率不达标

**拒绝操作**:
```markdown
�?**需要修�?* (P0 问题未解�?

请修复以下问题后重新提交�?1. ...
2. ...
```

### 3.3 作者修改代�?
#### Step 1: 响应审查意见

**回复审查意见**:
```markdown
@reviewer 感谢审查！我已修复所�?P0 问题�?
1. **[架构违规]** 已改�?`DataBridge.forward()`
2. **[类型安全]** 已定�?`interface XXXProps`

P1 问题 3 我计划在下个 PR 中修复，�?PR 先聚焦核心功能�?```

#### Step 2: 修改代码

```powershell
# 1. �?PR 分支上修改代�?git checkout pr-branch-name
# 修改代码...

# 2. 本地验证
npm run pre-review

# 3. 提交修改
git add .
git commit -m "fix: 修复审查意见（P0 问题�?
git push origin pr-branch-name
```

#### Step 3: 重新提交审查

**触发重新审查**:
- 推送新提交后，GitHub 自动通知审查�?- 或手�?@审查�?请求重新审查

---

## 四、常见场景与案例

### 4.1 场景 1: 新功能开�?
**PR 特征**:
- 涉及多个模块（pages + store + services + types�?- 代码量大�?00-500 行）
- 需要完整审�?
**审查重点**:
1. 架构合规性（四步集成顺序�?2. 类型定义完整性（Interface�?3. 单元测试覆盖率（> 80%�?4. 文档同步（architecture.md / docs/06-routing-specs.md�?
**案例**: 新增"资金流向"模块

```typescript
// �?正确的四步集�?
// Step 1: 类型定义（src/types/modules/fund-flow.ts�?export interface FundFlowData {
  id: string;
  stockCode: string;
  mainFlow: number;
  retailFlow: number;
  timestamp: number;
}

// Step 2: Store（src/store/fundFlowStore.ts�?import { create } from 'zustand';
import { withBroadcast } from '@/lib/withBroadcast';
import { FundFlowData } from '@/types/modules/fund-flow';

interface FundFlowStore {
  data: FundFlowData[];
  loading: boolean;
  fetchData: () => Promise<void>;
}

export const useFundFlowStore = create<FundFlowStore>()(
  withBroadcast((set) => ({
    data: [],
    loading: false,
    fetchData: async () => {
      // ...
    },
  }))
);

// Step 3: Service（src/services/fundFlowService.ts�?import { DataBridge } from '@/core/DataBridge';
import { ENVELOPE_ACTION } from '@/core/Envelope';
import { FundFlowData } from '@/types/modules/fund-flow';

export async function fetchFundFlow(stockCode: string): Promise<FundFlowData[]> {
  const data = await api.fetch(`/fund-flow/${stockCode}`);
  DataBridge.forward(ENVELOPE_ACTION.FUND_FLOW_UPDATE, data);
  return data;
}

// Step 4: UI（src/pages/FundFlowPage.tsx�?import { useFundFlowStore } from '@/store/fundFlowStore';

export function FundFlowPage() {
  const data = useFundFlowStore((state) => state.data);
  // ...
}
```

### 4.2 场景 2: Bug 修复

**PR 特征**:
- 代码量小�? 50 行）
- 聚焦问题修复
- 需要回归测�?
**审查重点**:
1. 问题根因分析（是否彻底修复）
2. 测试用例（覆�?Bug 场景�?3. 回归测试（现有功能未受影响）

**案例**: 修复"资金流向数据不更�?Bug

```typescript
// �?Bug: useEffect 依赖项缺失，导致数据不更�?useEffect(() => {
  fetchData();  // 只在挂载时执行一�?}, []);  // 缺少 stockCode 依赖

// �?修复: 添加 stockCode 依赖
useEffect(() => {
  fetchData(stockCode);
}, [stockCode]);  // �?stockCode 变化时重新获取数�?```

**审查意见**:
```markdown
�?**Bug 修复正确**

建议补充测试用例�?```typescript
// tests/__tests__/fundFlowService.test.ts
test('�?stockCode 变化时，重新获取数据', async () => {
  const { rerender } = renderHook(
    ({ stockCode }) => useFundFlowStore((state) => state.fetchData(stockCode)),
    { initialProps: { stockCode: '600519' } }
  );
  
  // 第一次调�?  expect(fetchDataMock).toHaveBeenCalledTimes(1);
  
  // stockCode 变化
  rerender({ stockCode: '000001' });
  
  // 第二次调�?  expect(fetchDataMock).toHaveBeenCalledTimes(2);
});
```
```

### 4.3 场景 3: 重构

**PR 特征**:
- 不改变功能，只改进代码结�?- 可能涉及多个文件
- 需要完整回归测�?
**审查重点**:
1. 重构目标明确（为什么重构）
2. 无功能变更（通过单元测试验证�?3. 代码质量提升（复杂度降低、可读性提高）

**案例**: 重构"评分引擎"模块

```markdown
## PR 描述

**重构目标**: 降低评分引擎复杂度（�?1200 行拆分为 5 个独立模块）

**重构策略**:
1. 提取 `validateInput()` - 输入验证
2. 提取 `calculateScore()` - 评分计算
3. 提取 `normalizeScore()` - 分数归一�?4. 提取 `formatOutput()` - 输出格式�?5. 提取 `config.ts` - 配置注入

**验证方式**:
- 单元测试全部通过（覆盖率 95%�?- E2E 测试通过（评分流程端到端验证�?- 性能测试（评分速度提升 20%�?```

### 4.4 场景 4: 紧急修复（Hotfix�?
**PR 特征**:
- 必须快速合并（< 2 小时�?- 可能跳过部分审查流程
- 需要后续补充审查和测试

**审查策略**:
1. 先合并到 `main` 分支（修复线上问题）
2. 24 小时内补充完整审查和测试
3. 记录技术债（后续迭代修复�?
**案例**: 修复生产环境崩溃 Bug

```markdown
## 🚨 Hotfix PR

**问题**: 生产环境首页崩溃（TypeError: Cannot read property 'map' of undefined�?
**根因**: API 返回数据格式变更，缺少容错处�?
**修复**: 添加数据容错处理

**后续计划**:
- [ ] 补充单元测试（覆�?API 数据异常场景�?- [ ] 添加 E2E 测试（首页加载流程）
- [ ] 完善错误处理（全局 Error Boundary�?
---

**审查者意�?*:
�?**批准紧急合�?*

请确保在 24 小时内完成以下工作：
1. 补充单元测试（@author�?2. 提交后续修复 PR（@author�?3. 更新文档（docs/CHANGELOG.md�?```

---

## 五、审查工具使�?
### 5.1 本地验证命令

```powershell
# 完整验证（提交前必须全部通过�?npm run lint              # ESLint 检�?npx tsc --noEmit         # TypeScript 类型检�?npm test -- --run         # 单元测试
npm run build             # 生产构建

# 架构审计（提交前必须 0 violations�?npm run audit:layers      # 分层调用检�?npm run audit:hardcode    # 硬编码检�?npm run audit:deadcode    # 死代码检�?npm run audit:docs        # 文档同步检�?
# 快速自检（推荐）
npm run pre-review        # 一键执行所有检�?```

### 5.2 GitHub PR 审查功能

**在线审查**:
1. 打开 PR 页面（`https://github.com/xxx/xxx/pull/123`�?2. 点击 "Files changed" 标签�?3. 鼠标悬停在代码行号上，点�?"+" 号添加评�?4. 填写审查意见（使用模板）
5. 点击 "Review changes" 提交审查

**审查选项**:
- **Comment**: 提出意见（不阻塞合并�?- **Approve**: 批准 PR（可以合并）
- **Request changes**: 请求修改（阻塞合并，直到问题解决�?
### 5.3 VS Code 审查插件

**推荐插件**:
- **GitLens**: 查看代码历史、Blame、对比分�?- **GitHub Pull Requests**: �?VS Code 中审�?PR
- **Error Lens**: 实时显示 ESLint/TypeScript 错误

**使用 GitLens 审查**:
1. 安装 GitLens 插件
2. 打开 PR 分支（`git checkout pr-branch-name`�?3. 查看代码变更（Source Control 面板�?4. 使用 GitLens 查看代码历史（Code Lens �?"3 authors"�?5. �?VS Code 中添加评论（右键代码 �?"Add Comment"�?
---

## 六、考核与认�?
### 6.1 审查者认证流�?
**认证等级**:

| 等级 | 要求 | 权限 |
|------|------|------|
| **L1: 初级审查�?* | 通过培训 + 完成 5 次审�?| 可审�?UI 组件 |
| **L2: 中级审查�?* | 完成 20 次审�?+ 无重大遗�?| 可审查服务层代码 |
| **L3: 高级审查�?* | 完成 50 次审�?+ 架构师推�?| 可审查核心模�?+ 架构变更 |

**认证流程**:
1. 完成培训（阅读本文档 + 通过测验�?2. 跟随资深审查者学习（3 �?Pair Review�?3. 独立审查�? 次，由资深审查者复核）
4. 获得认证（更�?CODEOWNERS�?
### 6.2 审查质量指标

**个人指标**:
- 审查响应时间（目�? < 24h�?- P0 问题发现率（目标: 100%�?- 审查意见质量（建设性、有修复建议�?- 审查覆盖率（审查�?PR �?/ 团队 PR 总数�?
**团队指标**:
- PR 合并周期（目�? < 3 天）
- 返工率（Request Changes 次数 / �?PR 数，目标: < 20%�?- P0 问题逃逸率（合并后发现 P0 问题，目�? < 5%�?- 审查参与度（团队成员审查覆盖率，目标: 100%�?
### 6.3 持续学习

**学习资源**:
- 代码审查标准（docs/code-review.md�?- 项目规范（AGENTS.md�?- 优秀 PR 案例（GitHub PR #123, #456�?- 审查者培训材料（本文档）

**定期活动**:
- 每周代码审查复盘会（30 分钟�?- 每月优秀审查者评�?- 每季度审查标准更�?
---

## 七、附�?
### 7.1 审查意见标签规范

```markdown
[架构违规] - 分层规则/依赖方向问题
[类型安全] - any/ts-ignore/缺少 Interface
[硬编码] - 颜色/魔法数字/配置未注�?[功能错误] - 边界处理/错误处理/测试缺失
[代码质量] - 命名/长度/复杂�?重复代码
[性能优化] - 重渲�?懒加�?防抖节流
[可维护性] - 注释/日志/文档同步/TODO
```

### 7.2 快速参考卡

**打印建议**: 将以下表格打印并贴在显示器旁

| 优先�?| 检查项 | 验证命令 |
|--------|--------|----------|
| 🔴 P0 | 架构合规 | `npm run audit:layers` |
| 🔴 P0 | 类型安全 | ESLint `@typescript-eslint/no-explicit-any` |
| 🔴 P0 | 零硬编码 | `npm run audit:hardcode` |
| 🔴 P0 | 测试覆盖 | `npm test -- --coverage` |
| 🟡 P1 | 代码质量 | 手动检查（命名/长度/复杂度） |
| 🟡 P1 | 性能优化 | 手动检查（重渲�?懒加载） |
| 🟢 P2 | 代码风格 | 手动检查（一致�?简化） |

### 7.3 常见问题 FAQ

**Q1: 如何处理审查意见分歧�?*

A: 
1. 先沟通（评论区或线下讨论�?2. 查文档（�?AGENTS.md �?code-review.md 为准�?3. 升级（无法达成一致时，请架构师仲裁）
4. 记录（重要决策记录到 `docs/changelogs/YYYY-MM/`�?
**Q2: 审查者太忙，无法及时审查怎么办？**

A:
1. 提前协调（作者提�?PR 前，先与审查者沟通）
2. 轮换审查者（避免单点依赖�?3. 升级（超�?24 小时未响应，请求其他审查者或维护者介入）

**Q3: 如何平衡审查严格度与开发速度�?*

A:
- **P0 问题零容�?*（必须修复，否则拒绝合并�?- **P1 问题灵活处理**（可与作者讨论，决定是否�?PR 修复或后续迭代）
- **P2 问题记录跟进**（不阻塞合并，但记录�?Issue 后续修复�?- **紧急修复例�?*（Hotfix 可先合并，但需 24 小时内补充审查）

---

## 八、培训测�?
> **测验说明**: 完成以下测验，验证培训效�?
### 选择题（10 题）

1. 代码审查的目标是什么？
   - A. 发现缺陷、保证质量、知识共享、遵守规�?   - B. 挑刺、批评作�?   - C. 延迟合并、增加工作量
   - D. 展示自己的技术能�?
2. 以下哪个�?P0 问题�?   - A. 函数长度超过 50 �?   - B. 使用 `any` 类型
   - C. 代码风格不一�?   - D. 注释不够详细

3. 审查者必须在多长时间内开始审查？
   - A. 12 小时
   - B. 24 小时
   - C. 48 小时
   - D. 72 小时

4. 以下哪个做法是正确的�?   - A. pages/ 直接调用 db
   - B. services/ 通过 DataBridge.forward() 写入数据
   - C. 使用 @ts-ignore 屏蔽类型错误
   - D. 直接使用 HEX 颜色�?
5. 单元测试覆盖率目标是多少�?   - A. > 50%
   - B. > 60%
   - C. > 80%
   - D. > 90%

### 实操题（2 题）

1. **找出以下代码�?P0 问题并修�?*:

```typescript
// src/services/analysisService.ts
import { db } from '@/data/db';

export function saveAnalysis(data: any) {
  // 保存分析结果
  db.analysis.put(data);
  
  // 通知其他模块
  window.dispatchEvent(new Event('analysis-updated'));
}
```

2. **审查以下 PR 描述，提出改进建�?*:

```markdown
## 变更摘要
修复�?Bug

## 变更内容
改了一些代�?
## 自检清单
- [ ] 测试通过
```

---

## 九、培训总结

### 关键要点

1. **代码审查目标**: 发现缺陷、保证质量、知识共享、遵守规�?2. **三级审查体系**: L1 自动�?�?L2 同级 �?L3 架构
3. **P0 问题**: 架构合规、类型安全、零硬编码、功能正确（必须修复�?4. **审查流程**: 自检 �?审查 �?修改 �?批准合并
5. **审查者职�?*: 及时响应、全面检查、建设性反馈、区分优先级

### 下一步行�?
- [ ] 阅读 `../../reference/code-review.md`（完整审查标准）
- [ ] 阅读 `../../../AGENTS.md`（项目规范）
- [ ] 完成培训测验（验证学习效果）
- [ ] 跟随资深审查者学习（3 �?Pair Review�?- [ ] 独立审查�? 次，获得 L1 认证�?
---

**文档维护**: 本文档由架构师维护，重大变更需技术评审委员会批准�?
**反馈渠道**: 如有疑问或建议，请联�?@xiaoying-ying 或在 GitHub Discussion 中讨论�?