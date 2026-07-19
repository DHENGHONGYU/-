param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

$rewrites = @{
    "00-meta/23-core-docs-functional-match-report.md" = "23 个核心文档按功能/内容匹配（非文件名）的最终核查报告，含统计汇总与缺口清单。"
    "00-meta/23-core-docs-v2-final-report.md" = "23 个核心文档二次校对的最终报告，确认各文档版本一致性与内容完整性。"
    "00-meta/23个核心文档重新检索报告.md" = "对 23 个核心文档重新检索定位的结果报告，确认文档实际路径与索引一致性。"
    "00-meta/directory-audit-todo.md" = "目录结构文档诊断阶段的 TODO 清单（交付物 2/2），记录待办整改项。"
    "00-meta/FILE-MANAGEMENT-GUIDE-cleanup-decisions.md" = "FILE-MANAGEMENT-GUIDE 相关代码清理决策报告，记录各文件的保留/删除/合并判定。"
    "00-meta/FILE-MANAGEMENT-GUIDE-file-wandering-report.md" = "文件漂移排查报告：识别同名/重复文件散落多目录的问题（如 toolkit 与 src/lib 重复的 safeCoerce.ts）。"
    "00-meta/src-directories-evaluation-report.md" = "src 各目录职责与结构合理性评估报告，含 DataBridgeAdapter 等适配器定位分析。"
    "04-testing/performance-baseline.md" = "V9 性能测试基线报告（v1.1.0）：P0/B1 优化后的构建与运行时性能指标基线。"
    "explanation/design/06-routing-specs.md" = "V9 路由规范：路由定义、命名与导航规则（事实源 src/config/routes.ts）。"
    "explanation/design/data-definition.md" = "Widget 数据定义说明（类型源自 widget.types.ts），含各组件数据结构。"
    "explanation/design/news-data-definition.md" = "NewsPage 智能资讯中心数据字典：资讯实体的字段、类型与来源定义。"
    "explanation/design/pending-items-backlog-20260704.md" = "V9 待处理事项清单（2026-07-04 快照）：未完成的缺陷、优化与文档项。"
    "explanation/design/trading-core-factors.md" = "交易核心因子与复盘指标导入蓝图（外部参考，Deferred）：凯利公式等因子转化自 v6pro 策略报告。"
    "explanation/design/ui改善部分检索报告.md" = "UI 改善专项检索报告：定位 V9 界面改善相关的文档与代码锚点。"
    "explanation/design/v9-code-quality-kanban-20260629.md" = "代码质量看板（2026-06-29）：追踪架构违规（调用方向铁律等）与整改进度。"
    "explanation/design/v9现有数据资产清单.md" = "V9 现有数据资产清单：盘点已接入的数据源、实体与存储结构。"
    "explanation/a11y-checklist.md" = "可访问性（A11y）检查清单：对比度、键盘导航、屏幕阅读器等验收项。"
    "explanation/dual-strategy-gap-analysis.md" = "V9 双策略规格与现有实现的差异分析报告，识别缺口与对齐路径。"
    "explanation/news-data-definition.md" = "已废弃：NewsPage 数据字典旧版，请改用 explanation/design/ 下新版文档。"
    "explanation/pending-items-backlog-20260704.md" = "V9 待处理事项清单（2026-07-04 快照）：未完成的缺陷、优化与文档项。"
    "explanation/trading-core-factors.md" = "交易核心因子与复盘指标导入蓝图（外部参考，Deferred）：凯利公式等因子转化自 v6pro 策略报告。"
    "explanation/v9-架构缺陷与整改行动清单.md" = "V9 架构缺陷盘点与整改行动清单（总工期 5-10 天），按优先级排列。"
    "explanation/weekly-check-2026-06-30.md" = "每周数据蓝图一致性检查（2026-06-30）：34/34 项通过的执行记录。"
    "reference/changelogs/2026-07/pr-7-trade-error-classifier-split-plan.md" = "PR-7：tradeErrorClassifier（767 行）拆分方案的依赖分析与边界修订记录。"
    "reference/cockpit/data-definition.md" = "Cockpit 驾驶舱数据定义：Widget 类型与数据结构说明。"
    "reference/03-architecture-standards.md" = "V9 架构标准：分层规则、调用方向铁律与交易计算纯函数模块规范。"
    "reference/06-routing-specs.md" = "V9 路由规范（事实源 src/config/routes.ts）：路由清单与导航规则。"
    "reference/agent-runtime-spec.md" = "Agent 运行时规范：多 Agent 注册、任务调度、队列与超时机制。"
    "reference/batchB-fix-plan.md" = "Batch B 修复计划：清理已删除路由的残留链接（/input/prototype 404 等）。"
    "reference/batchD-fix-plan.md" = "Batch D 修复计划：区分交易信号与模拟持仓两个混淆入口。"
    "reference/batchE-fix-plan.md" = "Batch E 修复计划：区分系统监控与配置管理两个混淆入口。"
    "reference/cockpit-news-doc-fix-plan.md" = "Cockpit 与 News 相关文档的修复计划（目标文件与整改项清单）。"
    "reference/dataflow-engine-spec.md" = "Dataflow 引擎规范：统一管理实时/准实时数据通道的数据感知层核心组件。"
    "reference/deprecated-ui-module-alignment.md" = "V6 Pro UI 模块与 V9 新旧比对及吸收报告（已废弃，仅存档）。"
    "reference/news-data-definition.md" = "NewsPage 智能资讯中心数据字典：资讯实体字段、类型与来源定义。"
    "reference/README.md" = "reference 目录索引：八类文档的现有锚点与缺口标记。"
    "reference/release-notes.md" = "发布说明：汇总各已发布版本的核心变更、质量指标与升级须知。"
    "reference/rm剩余任务全量盘点与整改方案-2026-07-08.md" = "RM 剩余任务全量盘点与整改方案（2026-07-08）：含各测试与源文件收口安排。"
    "reference/rotation-score-spec.md" = "板块轮动量化评分模型规范：从景气、资金、估值、相关性、量能五个维度对板块打分。"
    "reference/v9数据架构修订建议.md" = "V9 数据架构修订建议：补齐蓝图中 L2 数据层职责与实体规模描述。"
    "reference/文件整理清单.md" = "V9 项目文件整理清单：各目录文件的归类、保留与处置记录。"
}

$fixed = 0
$notFound = @()

foreach ($rel in $rewrites.Keys) {
    $path = Join-Path $DocsPath ($rel -replace '/', '\')
    if (-not (Test-Path $path)) { $notFound += $rel; continue }
    $content = Get-Content $path -Raw -Encoding UTF8
    if (-not $content) { continue }
    $newSummary = $rewrites[$rel]
    $newContent = $content -replace '(?m)^summary\s*:.*$', ('summary: "' + ($newSummary -replace '"', "'") + '"')
    if ($newContent -ne $content) {
        if ($Apply) {
            [System.IO.File]::WriteAllText($path, $newContent, (New-Object System.Text.UTF8Encoding $false))
        }
        $fixed++
    }
}

Write-Host "===== Summary Rewrite =====" -ForegroundColor Yellow
Write-Host "Rewrites defined: $($rewrites.Count)"
Write-Host "Matched & updated: $fixed"
if ($notFound.Count -gt 0) { Write-Host "Not found: $($notFound.Count)"; $notFound | ForEach-Object { Write-Host "  $_" } }
if ($Apply) { Write-Host "Applied: $fixed" -ForegroundColor Green }
