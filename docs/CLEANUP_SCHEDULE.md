# V9 自动产物清理周期表（CLEANUP SCHEDULE）

> **版本**: v1.0.0 | **日期**: 2026-07-12
> **适用范围**: 所有 CI 生成产物、审计报告、缓存文件
> **执行方式**: 本地手动 + CI 定时任务

---

## 一、产物保留矩阵

### 1.1 按类型分类

| 产物类型 | 生成命令 | 存储路径 | 保留期 | 清理频率 | 版本控制 |
|---------|---------|---------|--------|---------|---------|
| **审计报告** | `npm run audit:*` | `docs/reports/audit/` | 30 天 | 每周 | ❌ |
| **系统巡检报告** | CI `system-check-loop.yml` | `docs/reports/system-check-loop/` | 7 天 | 每日 | ❌ |
| **系统健康报告** | `npm run system:health` | `docs/reports/system-health/` | 7 天 | 每日 | ❌ |
| **文档保鲜度报告** | `npm run doc:freshness` | `docs/reports/doc-freshness/` | 7 天 | 每日 | ❌ |
| **Code Graph** | `npm run build:ai-memory` | `docs/reports/code-graph/` | 7 天 | 每次构建 | ❌ |
| **覆盖率报告** | `npm run test:ci` | `coverage/` | 14 天 | 每次 CI | ❌ |
| **依赖分析报告** | `npm run audit:dependencies` | `docs/reports/dependency-analysis.*` | 30 天 | 每周 | ❌ |
| **API 提取报告** | `npm run api:extract` | `docs/reports/api-report.md` | 7 天 | 每次构建 | ❌ |
| **快照测试基线** | `npm run test -- tests/__tests__/snapshot/` | `tests/__tests__/snapshot/__snapshots__/` | 永久 | 手动更新 | ✅ |
| **视觉回归基线** | `npm run test:e2e:visual:update` | `e2e/*-snapshots/` | 永久 | 手动更新 | ✅ |
| **变更日志** | 手动维护 | `CHANGELOG.md` (根) | 永久 | 每次发布 | ✅ |
| **构建产物** | `npm run build` | `dist/` | 7 天 | 每次构建 | ❌ |

### 1.2 按保留期分类

```
永久保留（∞）
├── CHANGELOG.md
├── e2e/*-snapshots/          ← 视觉回归基线
├── tests/__tests__/snapshot/__snapshots__/
└── docs/07-archive/          ← 归档文档

30 天保留
├── docs/reports/audit/       ← 全量审计报告
├── docs/reports/dependency-analysis.*
└── docs/reports/issues/      ← 系统检查发现的 issues

14 天保留
├── coverage/                 ← 覆盖率 HTML/JSON
└── docs/reports/coverage/    ← 覆盖率归档副本

7 天保留
├── docs/reports/system-check-loop/
├── docs/reports/system-health/
├── docs/reports/doc-freshness/
├── docs/reports/code-graph/
├── docs/reports/api-report.md
├── docs/reports/pre-review/
└── dist/                     ← 构建产物
```

---

## 二、目录结构规范

### 2.1 产物目录树

```
docs/reports/
├── audit/                        ← 审计报告（30 天）
│   ├── 2026-07-01-audit-layers.json
│   ├── 2026-07-01-audit-hardcode.json
│   └── ...
│
├── system-check-loop/            ← 系统巡检（7 天）
│   ├── 2026-07-01-check.json
│   └── latest.json → 软链到最新
│
├── system-health/                ← 健康报告（7 天）
│   ├── 2026-07-01-health.json
│   └── latest.json → 软链到最新
│
├── doc-freshness/                ← 保鲜度报告（7 天）
│   ├── 2026-07-01-freshness.json
│   └── latest.json → 软链到最新
│
├── code-graph/                   ← 知识图谱（7 天）
│   └── code-graph.json
│
├── dependency-analysis.*         ← 依赖分析（30 天）
│   ├── dependency-analysis.json
│   └── dependency-analysis.html
│
└── api-report.md                 ← API 提取（7 天）

coverage/                         ← 覆盖率（14 天，.gitignore）
├── html/
├── json/
└── lcov/
```

### 2.2 产物命名规范

| 产物 | 命名格式 | 示例 |
|------|---------|------|
| 审计报告 | `YYYY-MM-DD-audit-{type}.{ext}` | `2026-07-12-audit-layers.json` |
| 系统巡检 | `YYYY-MM-DD-check.json` | `2026-07-12-check.json` |
| 健康报告 | `YYYY-MM-DD-health.json` | `2026-07-12-health.json` |
| 依赖分析 | `dependency-analysis.{ext}` | `dependency-analysis.json` |
| 覆盖率 | `coverage/` 子目录 | `coverage/html/index.html` |

---

## 三、清理脚本

### 3.1 手动清理

```powershell
# 清理所有过期产物（根据保留期规则）
npm run doc:clean

# 或运行 TS 清理脚本
npx tsx scripts/cleanup-reports.ts
```

### 3.2 自动化清理（CI）

在 `.github/workflows/system-check-loop.yml` 中集成清理步骤：

```yaml
- name: Cleanup stale reports
  run: npx tsx scripts/cleanup-reports.ts
  continue-on-error: true
```

### 3.3 清理脚本参考实现

```typescript
// scripts/cleanup-reports.ts（建议实现）
import { readdirSync, statSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'

interface CleanupRule {
  path: string
  maxAgeDays: number
  pattern?: RegExp
}

const RULES: CleanupRule[] = [
  { path: 'docs/reports/audit', maxAgeDays: 30 },
  { path: 'docs/reports/system-check-loop', maxAgeDays: 7 },
  { path: 'docs/reports/system-health', maxAgeDays: 7 },
  { path: 'docs/reports/doc-freshness', maxAgeDays: 7 },
  { path: 'docs/reports/code-graph', maxAgeDays: 7 },
  { path: 'coverage', maxAgeDays: 14 },
  { path: 'dist', maxAgeDays: 7 },
]

function cleanup(rule: CleanupRule): void {
  const now = Date.now()
  const maxAge = rule.maxAgeDays * 24 * 60 * 60 * 1000
  
  try {
    const entries = readdirSync(rule.path)
    let removed = 0
    
    for (const entry of entries) {
      if (entry === 'latest.json') continue // 保护软链
      
      const fullPath = join(rule.path, entry)
      const stats = statSync(fullPath)
      const age = now - stats.mtimeMs
      
      if (age > maxAge) {
        unlinkSync(fullPath)
        removed++
      }
    }
    
    console.log(`[cleanup] ${rule.path}: removed ${removed} stale entries`)
  } catch (err) {
    console.warn(`[cleanup] ${rule.path}: ${err}`)
  }
}

RULES.forEach(cleanup)
```

---

## 四、根级产物迁移计划

### 4.1 待迁移清单

以下根级产物应逐步迁移到 `docs/reports/`：

| 当前位置 | 目标位置 | 状态 | 优先级 |
|---------|---------|------|--------|
| 根 `audit-*-result.txt` | `docs/reports/audit/` | ✅ **已清理**（根级无残留） | — |
| 根 `*.audit-report.md` | `docs/reports/audit/` | ✅ **已归档** | — |

> **状态更新（2026-07-12）**：经扫描确认，项目根目录已无 `audit-*-result.txt` 文件残留。现有审计产物均已落入 `docs/audit/` 或 `docs/reports/` 对应子目录。`docs/reports/audit/` 目录已创建，供后续 `audit:*` 脚本输出使用。

以下根级产物应逐步迁移到 `docs/reports/`：

| 当前位置 | 目标位置 | 状态 | 优先级 |
|---------|---------|------|--------|
| 根 `audit-*-result.txt` | `docs/reports/audit/` | 🔴 待实施 | P1 |
| 根 `*.audit-report.md` | `docs/reports/audit/` | 🔴 待实施 | P2 |

### 4.2 迁移检查清单

```powershell
# ✅ 迁移前自查
[ ] 新产物目录已创建（docs/reports/{type}/）
[ ] 生成脚本已更新输出路径
[ ] .gitignore 已排除新产物目录
[ ] docs/GOVERNANCE.md 已更新产物索引
[ ] CI workflow 已更新产物上传路径
[ ] 旧产物已清理（保留最近 1 份作为过渡）
```

---

## 五、Git 管理规则

### 5.1 .gitignore 配置

```gitignore
# 自动产物（不纳入版本控制）
docs/reports/audit/*
docs/reports/system-check-loop/*
docs/reports/system-health/*
docs/reports/doc-freshness/*
docs/reports/code-graph/*
docs/reports/api-report.md
docs/reports/pre-review/*
coverage/
dist/

# 保留产物目录结构（.gitkeep）
!docs/reports/audit/.gitkeep
!docs/reports/system-check-loop/.gitkeep
!docs/reports/system-health/.gitkeep
```

### 5.2 CI Artifact 保留

GitHub Actions 产物通过 `actions/upload-artifact` 上传，保留期与本地保留期独立：

| Artifact | CI 保留期 | 说明 |
|---------|----------|------|
| `coverage-report` | 7 天 | `quality-check.yml` |
| `dependency-analysis-report` | 7 天 | `quality-check.yml` |
| `system-check-reports` | 7 天 | `system-check-loop.yml` |
| `snapshot-report` | 7 天 | `quality-check.yml` |
| `api-report` | 7 天 | `quality-check.yml` |

---

## 六、相关文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| 文档治理宪法 | `docs/GOVERNANCE.md` | 文档体系全局规则 |
| 文档主控索引 | `docs/README.md` | A–H 八类导航 |
| 测试策略 | `docs/04-testing/testing-strategy.md` | 覆盖率基线与测试命令 |
| 运维基线 | `docs/ops/runbook.md` | CI/CD 流水线配置 |
| 变更日志 | `CHANGELOG.md` | 版本变更记录 |
