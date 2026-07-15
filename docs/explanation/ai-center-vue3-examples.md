---
title: ai-center-vue3-examples
code_version: 2.0.0

tier: important
---

---
title: docs/explanation/ai-center-vue3-examples.md
code_version: 2.0.0
tier: important
---

# AI 中心 Vue3 组件示例

> **注意**：`src/services/ai-center/mockAICenterProvider.ts` 已于 2026-07-05 作为零引用死代码删除。本文档中的代码示例仍保留 `MockAICenterProvider` 引用作为模式参考，实际开发中应替换为真实 Provider 或统一 Mock 开关。
>
> 配套文件：
> - `src/constants/ai-center.constants.ts`
> - `src/constants/health.constants.ts`
> - `src/types/modules/ai-center.types.ts`
> - `../reference/ai-center-data-definition.md`
>
> 规范：**组件内禁止出现任何硬编码状态、颜色、标签、轮询间隔**。所有 UI 元信息必须从 constants 文件读取。

---

## 一、目录约定（推荐）

```
src/
  ai-center/
    components/
      AgentDispatchPanel.vue
      HealthMonitorPanel.vue
      DiagnosticAnalysisPanel.vue
      IconRenderer.vue          # 图标名称 → 图标组件
    composables/
      useAICenter.ts            # 数据获取与自动刷新
    stores/
      aiCenterStore.ts          # Pinia 状态管理
    services/
      aiCenterService.ts        # REST/Mock 数据封装
```

---

## 二、图标渲染器（配置驱动）

组件不直接引入具体图标，只根据常量里的 `icon` 字段做映射。

```vue
<!-- src/ai-center/components/IconRenderer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  PauseCircle,
  HelpCircle,
  Brain,
  BookOpen,
  Wrench,
  TrendingUp,
  Bot,
  LineChart,
  BrainCircuit,
  Search,
  Zap,
  Bell,
} from 'lucide-vue-next'

const props = defineProps<{
  name: string
  class?: string
}>()

const iconMap: Record<string, Component> = {
  'check-circle': CheckCircle,
  'alert-triangle': AlertTriangle,
  'x-circle': XCircle,
  'pause-circle': PauseCircle,
  'help-circle': HelpCircle,
  brain: Brain,
  'book-open': BookOpen,
  wrench: Wrench,
  'trending-up': TrendingUp,
  bot: Bot,
  'line-chart': LineChart,
  'brain-circuit': BrainCircuit,
  search: Search,
  zap: Zap,
  bell: Bell,
}

const IconComponent = computed(() => iconMap[props.name])
</script>

<template>
  <component :is="IconComponent" :class="props.class" v-if="IconComponent" />
  <span v-else class="text-xs text-gray-400">?</span>
</template>
```

---

## 三、Pinia Store

```ts
// src/ai-center/stores/aiCenterStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  AgentListData,
  HealthMetricsData,
  DiagnosticReportsData,
} from '@/types/modules/ai-center.types'
import { MockAICenterProvider } from '@/services/ai-center/mockAICenterProvider'
import { AI_CENTER_DATA_SOURCE } from '@/constants/ai-center.constants'

export const useAICenterStore = defineStore('aiCenter', () => {
  // state
  const agents = ref<AgentListData | null>(null)
  const healthMetrics = ref<HealthMetricsData | null>(null)
  const diagnosticReports = ref<DiagnosticReportsData | null>(null)
  const loading = ref({ agents: false, health: false, diagnostics: false })
  const error = ref({ agents: '', health: '', diagnostics: '' })

  // getters
  const totalCallCount = computed(() =>
    (agents.value?.agents ?? []).reduce((sum, a) => sum + a.callCount, 0),
  )

  // actions
  async function fetchAgents() {
    loading.value.agents = true
    error.value.agents = ''
    try {
      agents.value = await MockAICenterProvider.getAgentList()
    } catch (e) {
      error.value.agents = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value.agents = false
    }
  }

  async function fetchHealth() {
    loading.value.health = true
    error.value.health = ''
    try {
      healthMetrics.value = await MockAICenterProvider.getHealthMetrics()
    } catch (e) {
      error.value.health = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value.health = false
    }
  }

  async function fetchDiagnostics() {
    loading.value.diagnostics = true
    error.value.diagnostics = ''
    try {
      diagnosticReports.value = await MockAICenterProvider.getDiagnosticReports()
    } catch (e) {
      error.value.diagnostics = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value.diagnostics = false
    }
  }

  function startPolling() {
    fetchAgents()
    fetchHealth()
    fetchDiagnostics()

    const agentsTimer = setInterval(fetchAgents, AI_CENTER_DATA_SOURCE.agents.interval)
    const healthTimer = setInterval(fetchHealth, AI_CENTER_DATA_SOURCE.healthMetrics.interval)
    const diagTimer = setInterval(
      fetchDiagnostics,
      AI_CENTER_DATA_SOURCE.diagnosticReports.interval,
    )

    return () => {
      clearInterval(agentsTimer)
      clearInterval(healthTimer)
      clearInterval(diagTimer)
    }
  }

  return {
    agents,
    healthMetrics,
    diagnosticReports,
    loading,
    error,
    totalCallCount,
    fetchAgents,
    fetchHealth,
    fetchDiagnostics,
    startPolling,
  }
})
```

---

## 四、AI 智能体调度中心 Panel

```vue
<!-- src/ai-center/components/AgentDispatchPanel.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAICenterStore } from '../stores/aiCenterStore'
import {
  AGENT_OVERVIEW_CARDS,
  AI_AGENT_STATUS_MAP,
  AGENT_TAG_MAP,
  AGENT_TYPE_MAP,
} from '@/constants/ai-center.constants'
import IconRenderer from './IconRenderer.vue'

const store = useAICenterStore()
const { agents, loading } = storeToRefs(store)

let stopPolling: (() => void) | undefined
onMounted(() => {
  stopPolling = store.startPolling()
})
onUnmounted(() => {
  stopPolling?.()
})
</script>

<template>
  <div class="space-y-4 p-4">
    <h2 class="text-lg font-semibold">AI 智能体调度中心</h2>

    <!-- 总览卡片 -->
    <div class="grid grid-cols-4 gap-3">
      <div
        v-for="card in AGENT_OVERVIEW_CARDS"
        :key="card.key"
        class="rounded-lg border p-3"
      >
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <IconRenderer :name="card.icon" class="h-4 w-4" />
          <span>{{ card.label }}</span>
        </div>
        <div class="mt-1 text-2xl font-bold" :style="{ color: card.color }">
          {{ agents?.overview[card.key as keyof typeof agents.value.overview] ?? 0 }}
        </div>
      </div>
    </div>

    <!-- Agent 列表 -->
    <div class="rounded-lg border">
      <div class="grid grid-cols-12 gap-2 border-b bg-gray-50 p-3 text-sm font-medium">
        <div class="col-span-3">智能体</div>
        <div class="col-span-2">类型</div>
        <div class="col-span-3">标签</div>
        <div class="col-span-2">状态</div>
        <div class="col-span-2">调用次数</div>
      </div>

      <div
        v-for="agent in agents?.agents ?? []"
        :key="agent.id"
        class="grid grid-cols-12 gap-2 border-b p-3 text-sm last:border-0"
      >
        <div class="col-span-3">
          <div class="font-medium">{{ agent.name }}</div>
          <div class="text-xs text-gray-400">{{ agent.description }}</div>
        </div>
        <div class="col-span-2 flex items-center gap-1">
          <IconRenderer
            :name="AGENT_TYPE_MAP[agent.type]?.icon ?? 'bot'"
            class="h-4 w-4"
          />
          <span>{{ AGENT_TYPE_MAP[agent.type]?.name ?? agent.type }}</span>
        </div>
        <div class="col-span-3 flex flex-wrap gap-1">
          <span
            v-for="tag in agent.tags"
            :key="tag"
            class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-white"
            :class="AGENT_TAG_MAP[tag].bgClass"
          >
            <IconRenderer :name="AGENT_TAG_MAP[tag].icon" class="h-3 w-3" />
            {{ AGENT_TAG_MAP[tag].label }}
          </span>
        </div>
        <div class="col-span-2 flex items-center gap-1">
          <IconRenderer
            :name="AI_AGENT_STATUS_MAP[agent.status].icon"
            class="h-4 w-4"
            :class="AI_AGENT_STATUS_MAP[agent.status].textClass"
          />
          <span :class="AI_AGENT_STATUS_MAP[agent.status].textClass">
            {{ AI_AGENT_STATUS_MAP[agent.status].label }}
          </span>
        </div>
        <div class="col-span-2">{{ agent.callCount.toLocaleString() }}</div>
      </div>

      <div v-if="loading.agents" class="p-4 text-center text-sm text-gray-400">加载中...</div>
    </div>
  </div>
</template>
```

---

## 五、系统健康监控 Panel

```vue
<!-- src/ai-center/components/HealthMonitorPanel.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAICenterStore } from '../stores/aiCenterStore'
import {
  HEALTH_STATUS_MAP,
  HEALTH_MODULE_CATEGORY,
  HEALTH_MODULE_CATEGORY_MAP,
  HEALTH_SCORE_THRESHOLDS,
} from '@/constants/health.constants'
import IconRenderer from './IconRenderer.vue'

const store = useAICenterStore()
const { healthMetrics, loading } = storeToRefs(store)

const selectedCategory = ref<string>('ALL')
const categories = computed(() => [
  { key: 'ALL', label: '全部' },
  ...Object.values(HEALTH_MODULE_CATEGORY).map((k) => ({
    key: k,
    label: HEALTH_MODULE_CATEGORY_MAP[k],
  })),
])

const filteredMetrics = computed(() => {
  if (selectedCategory.value === 'ALL') return healthMetrics.value?.metrics ?? []
  return (healthMetrics.value?.metrics ?? []).filter(
    (m) => m.category === selectedCategory.value,
  )
})

let stopPolling: (() => void) | undefined
onMounted(() => {
  stopPolling = store.startPolling()
})
onUnmounted(() => {
  stopPolling?.()
})
</script>

<template>
  <div class="space-y-4 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">系统健康监控</h2>
      <div
        v-if="healthMetrics"
        class="flex items-center gap-2 rounded-full px-3 py-1 text-sm text-white"
        :class="HEALTH_STATUS_MAP[healthMetrics.overallStatus].bgClass"
      >
        <IconRenderer :name="HEALTH_STATUS_MAP[healthMetrics.overallStatus].icon" class="h-4 w-4" />
        综合健康分 {{ healthMetrics.overallScore }}
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="flex gap-2">
      <button
        v-for="c in categories"
        :key="c.key"
        class="rounded border px-3 py-1 text-sm"
        :class="selectedCategory === c.key ? 'bg-gray-800 text-white' : 'bg-white'"
        @click="selectedCategory = c.key"
      >
        {{ c.label }}
      </button>
    </div>

    <!-- 指标卡片 -->
    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="metric in filteredMetrics"
        :key="metric.id"
        class="rounded-lg border p-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ metric.name }}</span>
          <span
            class="rounded px-2 py-0.5 text-xs text-white"
            :class="HEALTH_STATUS_MAP[metric.status].bgClass"
          >
            {{ HEALTH_STATUS_MAP[metric.status].label }}
          </span>
        </div>
        <div class="mt-2 text-3xl font-bold">
          {{ metric.healthScore }}
        </div>
        <div class="mt-1 text-xs text-gray-400">
          {{ HEALTH_MODULE_CATEGORY_MAP[metric.category] }}
        </div>
      </div>
    </div>

    <div v-if="loading.health" class="text-center text-sm text-gray-400">加载中...</div>
  </div>
</template>
```

---

## 六、诊断分析 Panel

```vue
<!-- src/ai-center/components/DiagnosticAnalysisPanel.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAICenterStore } from '../stores/aiCenterStore'
import { DIAGNOSTIC_LEVEL_MAP, HEALTH_SCORE_THRESHOLDS } from '@/constants/health.constants'
import IconRenderer from './IconRenderer.vue'

const store = useAICenterStore()
const { diagnosticReports } = storeToRefs(store)

let stopPolling: (() => void) | undefined
onMounted(() => {
  stopPolling = store.startPolling()
})
onUnmounted(() => {
  stopPolling?.()
})
</script>

<template>
  <div class="space-y-4 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">诊断分析</h2>
      <div
        v-if="diagnosticReports"
        class="rounded px-3 py-1 text-sm text-white"
        :class="DIAGNOSTIC_LEVEL_MAP[diagnosticReports.overallLevel].bgClass"
      >
        整体等级：{{ DIAGNOSTIC_LEVEL_MAP[diagnosticReports.overallLevel].label }}
      </div>
    </div>

    <div class="rounded-lg border">
      <div class="grid grid-cols-12 gap-2 border-b bg-gray-50 p-3 text-sm font-medium">
        <div class="col-span-2">诊断项</div>
        <div class="col-span-2">模块</div>
        <div class="col-span-2">健康分</div>
        <div class="col-span-2">成功率</div>
        <div class="col-span-2">稳定性</div>
        <div class="col-span-2">等级</div>
      </div>

      <div
        v-for="report in diagnosticReports?.reports ?? []"
        :key="report.id"
        class="grid grid-cols-12 gap-2 border-b p-3 text-sm last:border-0"
      >
        <div class="col-span-2 font-medium">{{ report.name }}</div>
        <div class="col-span-2 text-gray-500">{{ report.module }}</div>
        <div class="col-span-2">{{ report.healthScore }}</div>
        <div class="col-span-2">{{ report.successRate }}%</div>
        <div class="col-span-2">{{ report.stabilityScore }}</div>
        <div class="col-span-2">
          <span
            class="rounded px-2 py-0.5 text-xs text-white"
            :class="DIAGNOSTIC_LEVEL_MAP[report.level].bgClass"
          >
            {{ DIAGNOSTIC_LEVEL_MAP[report.level].label }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
```

---

## 七、数据服务封装（可选）

```ts
// src/ai-center/services/aiCenterService.ts
import type {
  AgentListData,
  HealthMetricsData,
  DiagnosticReportsData,
} from '@/types/modules/ai-center.types'
import { MockAICenterProvider } from '@/services/ai-center/mockAICenterProvider'

export class AICenterService {
  static async fetchAgents(): Promise<AgentListData> {
    return MockAICenterProvider.getAgentList()
  }

  static async fetchHealthMetrics(): Promise<HealthMetricsData> {
    return MockAICenterProvider.getHealthMetrics()
  }

  static async fetchDiagnosticReports(): Promise<DiagnosticReportsData> {
    return MockAICenterProvider.getDiagnosticReports()
  }
}
```

---

## 八、硬编码检查清单

在提交前，请确保 Panel 组件中未出现以下硬编码：

- [ ] `'正常'` / `'异常'` / `'预警'` / `'已暂停'` / `'未知'`
- [ ] `'LLM模型'` / `'知识库'` / `'工具链'` / `'策略'`
- [ ] `'优秀'` / `'良好'` / `'一般'` / `'较差'`
- [ ] 任何十六进制颜色，如 `#22c55e`、`#ef4444`
- [ ] 任何 Tailwind 颜色类，如 `bg-green-500`、`text-red-500`
- [ ] 图标组件直接 import 并硬编码使用
- [ ] 轮询间隔数字，如 `5000`、`10000`

---

## 九、与 React 项目的关系

当前主项目为 React 18/19 + TypeScript。本 Vue3 示例用于：

1. 后续若引入 Vue3 子应用（微前端）或独立管理后台，可直接复用常量与类型。
2. 作为跨技术栈团队共享的规范参考：状态、颜色、标签、数据源配置完全复用同一套 constants/types。
3. Mock 数据生成器 `MockAICenterProvider` 在 Vue3 与 React 中均可直接 import 使用。
