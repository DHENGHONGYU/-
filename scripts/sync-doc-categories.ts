import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS_ROOT = join(__dirname, '..', 'docs');
const CATEGORY_INDEX_PATH = join(DOCS_ROOT, '00-meta', 'ai-index', '.ai-index', 'category-index.json');

interface DocumentInfo {
  path: string;
  name: string;
  category: string;
  subCategory: string;
  lastModified: string;
  size: number;
  status: 'active' | 'stale' | 'deprecated';
}

interface CategoryMap {
  [key: string]: DocumentInfo[];
}

const normalizePath = (path: string): string => path.replace(/\\/g, '/');

const CATEGORY_RULES: Record<string, { pattern: RegExp; subCategory: string }[]> = {
  'A': [
    { pattern: /^00-meta\//, subCategory: 'A1-index-constitution' },
    { pattern: /^01-requirements\/(01-vision|02-functional|03-architecture)/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/V9数据宪法/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/v9-system-blueprint/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/action-list/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/completeness-profile/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/overview/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/README/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/RM剩余任务/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/v9-input-cabin-strategy/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/fourth-industrial-revolution/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/FILE-MANAGEMENT-GUIDE/, subCategory: 'A2-requirements' },
    { pattern: /^02-design\/completeness-profile-batch4/, subCategory: 'A2-requirements' },
    { pattern: /^00-meta\/REGISTRY_INDEX/, subCategory: 'A1-index-constitution' },
    { pattern: /^03-development\/plugins\//, subCategory: 'A3-plugins' },
  ],
  'B': [
    { pattern: /^02-design\/architecture\/(overview|cabins-overview|services-catalog)/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/architecture\/deployment/, subCategory: 'B2-subsystems' },
    { pattern: /^02-design\/architecture\/security-model/, subCategory: 'B2-subsystems' },
    { pattern: /^02-design\/architecture\/adr\//, subCategory: 'B3-adr' },
    { pattern: /^02-design\/architecture-compliance/, subCategory: 'B4-compliance' },
    { pattern: /^02-design\/v9-architecture-rectification/, subCategory: 'B4-compliance' },
    { pattern: /^05-deployment\/RELEASE_NOTES/, subCategory: 'B5-release' },
    { pattern: /^05-deployment\/PR_DESCRIPTION/, subCategory: 'B5-release' },
    { pattern: /^02-design\/v9-strategy-architecture/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/ARCHITECTURE/, subCategory: 'B2-subsystems' },
    { pattern: /^02-design\/architecture\/architecture-version-comparison/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/architecture\/v10-architecture-alignment/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/2026-06-20-pure-frontend-architecture/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/2026-06-27-dual-strategy-system/, subCategory: 'B2-subsystems' },
    { pattern: /^02-design\/2026-06-29-data-architecture-governance/, subCategory: 'B4-compliance' },
    { pattern: /^02-design\/v9-architecture-data-diff/, subCategory: 'B4-compliance' },
    { pattern: /^02-design\/v9-architecture-data-dictionary-validation/, subCategory: 'B4-compliance' },
    { pattern: /^02-design\/v6-v9-architecture-audit/, subCategory: 'B4-compliance' },
    { pattern: /^02-design\/v6-v9-rectification/, subCategory: 'B4-compliance' },
    { pattern: /^05-deployment\/2026-06-21-hashrouter/, subCategory: 'B2-subsystems' },
    { pattern: /^06-project-management\/2026-06-21-databridge/, subCategory: 'B3-adr' },
    { pattern: /^02-design\/ADR\/adr-mcp-server-lifecycle/, subCategory: 'B3-adr' },
    { pattern: /^02-design\/architecture\/component-deprecation-policy/, subCategory: 'B2-subsystems' },
    { pattern: /^01-requirements\/V9_L2状态层补齐路线图/, subCategory: 'B2-subsystems' },
  ],
  'C': [
    { pattern: /-cabin-spec\.md$/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/input-cabin-ui/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/atomic-component-system/, subCategory: 'C2-components' },
    { pattern: /^02-design\/investment-pipeline-stage-analysis/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/component-library-guide/, subCategory: 'C2-components' },
    { pattern: /^02-design\/component-deprecation/, subCategory: 'C2-components' },
    { pattern: /^02-design\/widget-/, subCategory: 'C3-cockpit' },
    { pattern: /^02-design\/cockpit\//, subCategory: 'C3-cockpit' },
    { pattern: /^02-design\/v6-cockpit-ui/, subCategory: 'C3-cockpit' },
    { pattern: /^02-design\/STATE_MANAGEMENT/, subCategory: 'C4-store' },
    { pattern: /^02-design\/migration-news-useState/, subCategory: 'C4-store' },
    { pattern: /^02-design\/V9_L2状态层/, subCategory: 'C4-store' },
    { pattern: /^02-design\/architecture\/services\//, subCategory: 'C5-services' },
    { pattern: /^02-design\/API_CONTRACT/, subCategory: 'C5-services' },
    { pattern: /^02-design\/V9_IndexedDB_Store_Schema/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/data-collection-architecture/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/data-collection-gap/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/V9_数据血缘追踪/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/modules\/data-layer-overview/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/DATA_DICTIONARY_INDEX/, subCategory: 'C7-data-dictionary' },
    { pattern: /^02-design\/standards\/.*-data-definition/, subCategory: 'C7-data-dictionary' },
    { pattern: /^02-design\/《V9核心数据字典/, subCategory: 'C7-data-dictionary' },
    { pattern: /^02-design\/data-flow-spec/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/data-interaction-protocols/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/data-collection-route-ui-audit/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/《V9现有数据资产清单/, subCategory: 'C7-data-dictionary' },
    { pattern: /^02-design\/《功能模块数据契约/, subCategory: 'C5-services' },
    { pattern: /^02-design\/ui-design-system/, subCategory: 'C2-components' },
    { pattern: /^02-design\/ui-design-agent-execution-plan/, subCategory: 'C2-components' },
    { pattern: /^02-design\/ui-remediation-tracker/, subCategory: 'C2-components' },
    { pattern: /^02-design\/ui-only-implementation-summary/, subCategory: 'C2-components' },
    { pattern: /^02-design\/UI改善/, subCategory: 'C2-components' },
    { pattern: /^02-design\/UI设计优化/, subCategory: 'C2-components' },
    { pattern: /^02-design\/V6-V9界面设计/, subCategory: 'C2-components' },
    { pattern: /^02-design\/v6pro-ui-page-diff/, subCategory: 'C2-components' },
    { pattern: /^02-design\/v6pro-v9-gap-analysis/, subCategory: 'C2-components' },
    { pattern: /^02-design\/05-engine-specs/, subCategory: 'C5-services' },
    { pattern: /^02-design\/06-routing-specs/, subCategory: 'C5-services' },
    { pattern: /^02-design\/analysis-screening-module-dev-plan/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/trading-core-factors/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/tradeReviewAI/, subCategory: 'C3-cockpit' },
    { pattern: /^02-design\/hot-momentum-strategy/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/stock-selection-strategy/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/value-bargain-strategy/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/watchlist-strategy/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/core-data-strategy/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/core-scarce-strategy/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/dual-strategy/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/seven-dim-advanced-config/, subCategory: 'C7-data-dictionary' },
    { pattern: /^02-design\/《V9数据架构修订建议/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/数据治理路线图/, subCategory: 'C6-data-layer' },
    { pattern: /^02-design\/业务能力补充报告/, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/双通道投研评分系统/, subCategory: 'C5-services' },
    { pattern: /^03-development\/dataflow-engine-spec/, subCategory: 'C5-services' },
    { pattern: /^03-development\/unified-pool-storage-spec/, subCategory: 'C4-store' },
    { pattern: /^03-development\/v9-data-relationship-er/, subCategory: 'C6-data-layer' },
    { pattern: /^03-development\/v9-data-timeline/, subCategory: 'C6-data-layer' },
    { pattern: /^03-development\/factor-tracking-roadmap/, subCategory: 'C6-data-layer' },
  ],
  'D': [
    { pattern: /^02-design\/standards\/coding-conventions/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/complexity-governance/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/development-workflow-sop/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/overview/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/templates\/task-graph-template/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/DATA_DICTIONARY_INDEX/, subCategory: 'D4-documentation' },
    { pattern: /^02-design\/design-tokens/, subCategory: 'D2-design-tokens' },
    { pattern: /^02-design\/design-token-mapping/, subCategory: 'D2-design-tokens' },
    { pattern: /^02-design\/spacing-tokens/, subCategory: 'D2-design-tokens' },
    { pattern: /^02-design\/song-aesthetics/, subCategory: 'D2-design-tokens' },
    { pattern: /^02-design\/04-ui-ux-specs/, subCategory: 'D2-design-tokens' },
    { pattern: /^03-development\/quality-gates-baseline/, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/09-quality-gates/, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/quality-assurance-strategy/, subCategory: 'D3-quality-gates' },
    { pattern: /^03-development\/jsdoc-convention/, subCategory: 'D4-documentation' },
    { pattern: /^03-development\/v6-to-v9-migration-spec/, subCategory: 'D5-migration' },
    { pattern: /^03-development\/db-migration-v4-to-v6/, subCategory: 'D5-migration' },
    { pattern: /^02-design\/07-operation-strategy/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/08-implementation-plan/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/implementation-governance/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/PAGE_STRUCTURE/, subCategory: 'D2-design-tokens' },
    { pattern: /^02-design\/HOOKS_GUIDE/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/token-usage-cookbook/, subCategory: 'D2-design-tokens' },
    { pattern: /^02-design\/standards\/DATA_DEFINITION/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/visual-regression-guide/, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/TECH-DEBT/, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/10-glossary/, subCategory: 'D4-documentation' },
    { pattern: /^02-design\/《V9 代码实现分析报告/, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/《V9 架构覆盖分析报告/, subCategory: 'D3-quality-gates' },
    { pattern: /^03-development\/code-review-guide/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/security/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/audit-b4-2-test-quality/, subCategory: 'D3-quality-gates' },
    { pattern: /^03-development\/audit-b4-4-security/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/gateway-write-permission-spec/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/RBAC整合/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/performance-baseline/, subCategory: 'D3-quality-gates' },
    { pattern: /^03-development\/optimization-progress/, subCategory: 'D3-quality-gates' },
    { pattern: /^03-development\/chart-integration/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/AI_CENTER_VUE3_EXAMPLES/, subCategory: 'D1-coding' },
    { pattern: /^01-requirements\/CODE-REVIEW/, subCategory: 'D1-coding' },
    { pattern: /^01-requirements\/audit-b4-1-code-quality/, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/audit-b4-3-performance/, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/refactor-impact-analysis/, subCategory: 'D5-migration' },
    { pattern: /^01-requirements\/v6pro-to-v9-migration/, subCategory: 'D5-migration' },
    { pattern: /^01-requirements\/2026-06-24-adopt-v6-core/, subCategory: 'D5-migration' },
    { pattern: /^01-requirements\/2026-07-01-v6-architecture/, subCategory: 'D5-migration' },
    { pattern: /^01-requirements\/rotation-score-spec/, subCategory: 'D5-migration' },
    { pattern: /^01-requirements\/stock-pool-board-migration/, subCategory: 'D5-migration' },
    { pattern: /^03-development\/2026-06-23-portalshell/, subCategory: 'D5-migration' },
    { pattern: /^03-development\/2026-06-24-input-cabin/, subCategory: 'D5-migration' },
    { pattern: /^03-development\/2026-06-24-pool-screening/, subCategory: 'D5-migration' },
    { pattern: /^03-development\/2026-06-25-v6-migration/, subCategory: 'D5-migration' },
    { pattern: /^03-development\/2026-06-29-data-relationship/, subCategory: 'D5-migration' },
    { pattern: /^01-requirements\/2026-06-20-indexeddb/, subCategory: 'D5-migration' },
  ],
  'E': [
    { pattern: /^04-testing\/testing-strategy/, subCategory: 'E1-test-layers' },
    { pattern: /^04-testing\/automation-test/, subCategory: 'E1-test-layers' },
    { pattern: /^04-testing\/test-catalog/, subCategory: 'E2-test-cases' },
    { pattern: /^04-testing\/feature-entry-list/, subCategory: 'E2-test-cases' },
    { pattern: /^03-development\/V9-TEST-CASES/, subCategory: 'E2-test-cases' },
    { pattern: /^04-testing\/regression-test-report/, subCategory: 'E3-reports' },
    { pattern: /^04-testing\/a11y-contrast-report/, subCategory: 'E3-reports' },
    { pattern: /^04-testing\/penetration-test-report/, subCategory: 'E3-reports' },
    { pattern: /^04-testing\/vulnerability-scan-report/, subCategory: 'E3-reports' },
    { pattern: /^04-testing\/production-release-checklist/, subCategory: 'E4-gates' },
    { pattern: /^04-testing\/rollback-drill-report/, subCategory: 'E4-gates' },
    { pattern: /^04-testing\/test-expansion-design/, subCategory: 'E2-test-cases' },
    { pattern: /^04-testing\/completeness-profile/, subCategory: 'E2-test-cases' },
    { pattern: /^04-testing\/complexity-remediation/, subCategory: 'E3-reports' },
    { pattern: /^04-testing\/optimization-plan/, subCategory: 'E3-reports' },
    { pattern: /^03-development\/completeness-profile-batch3/, subCategory: 'E2-test-cases' },
    { pattern: /^04-testing\/nested-code-review/, subCategory: 'E3-reports' },
    { pattern: /^04-testing\/databridge-split-plan/, subCategory: 'E3-reports' },
    { pattern: /^04-testing\/v9-issue-management/, subCategory: 'E4-gates' },
    { pattern: /^04-testing\/V9-体系化上线测试/, subCategory: 'E4-gates' },
    { pattern: /^04-testing\/B批次高价值孤儿/, subCategory: 'E3-reports' },
    { pattern: /^03-development\/B批次组件集成测试/, subCategory: 'E3-reports' },
    { pattern: /^03-development\/2026-07-05-exception-handling/, subCategory: 'E3-reports' },
    { pattern: /^01-requirements\/automation-test-plan/, subCategory: 'E1-test-layers' },
    { pattern: /^01-requirements\/v9-code-quality-audit/, subCategory: 'E3-reports' },
    { pattern: /^02-design\/2026-07-04-ui-testing/, subCategory: 'E1-test-layers' },
    { pattern: /^02-design\/regression-suite/, subCategory: 'E2-test-cases' },
    { pattern: /^03-development\/templates\/regression-suite/, subCategory: 'E2-test-cases' },
  ],
  'F': [
    { pattern: /^03-development\/ai\//, subCategory: 'F1-prompts' },
    { pattern: /^02-design\/ai-memory-layer/, subCategory: 'F3-memory' },
    { pattern: /^02-design\/ai-generate-audit-fix-loop/, subCategory: 'F3-memory' },
    { pattern: /^03-development\/ui-migration-checklist/, subCategory: 'F2-checklists' },
    { pattern: /^02-design\/widget-integration-checklist/, subCategory: 'F2-checklists' },
    { pattern: /^03-development\/feedback-loop-spec/, subCategory: 'F2-checklists' },
    { pattern: /^02-design\/《V9 架构缺陷与整改行动清单/, subCategory: 'F2-checklists' },
    { pattern: /^02-design\/P4-文档去重/, subCategory: 'F2-checklists' },
    { pattern: /^02-design\/pending-items-backlog/, subCategory: 'F2-checklists' },
    { pattern: /^01-requirements\/batchB-fix-plan/, subCategory: 'F2-checklists' },
    { pattern: /^01-requirements\/batchD-fix-plan/, subCategory: 'F2-checklists' },
    { pattern: /^01-requirements\/batchE-fix-plan/, subCategory: 'F2-checklists' },
    { pattern: /^01-requirements\/cockpit-news-doc-fix/, subCategory: 'F2-checklists' },
    { pattern: /^01-requirements\/agent-runtime-spec/, subCategory: 'F1-prompts' },
    { pattern: /^01-requirements\/autonomous-workflow/, subCategory: 'F1-prompts' },
    { pattern: /^02-design\/autonomous-workflow-optimization/, subCategory: 'F1-prompts' },
    { pattern: /^02-design\/mcp-coupling-analysis/, subCategory: 'F3-memory' },
  ],
  'G': [
    { pattern: /^04-testing\/audit-reports\//, subCategory: 'G1-audit-reports' },
    { pattern: /^06-project-management\/changelogs\//, subCategory: 'G2-changelogs' },
    { pattern: /^02-design\/CHANGELOG/, subCategory: 'G2-changelogs' },
    { pattern: /^02-design\/v9-post-dev-review/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/batch-merge-reports/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/v9-remediation-plan/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/发布计划与评审/, subCategory: 'G5-release-management' },
    { pattern: /^02-design\/回滚方案与演练/, subCategory: 'G5-release-management' },
    { pattern: /^02-design\/v9-p0-remediation/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/v9-current-state-review/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/v9-acceptance-report/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/v9-data-blueprint-task-tracking/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/v9-interaction-flows-review/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/optimization-summary/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/health-report/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/timeline-report/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/doc-cross-check/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/doc-sync-execution/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/doc-update-report/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/freshness-alerts/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/buildscoredocdiff-rollback/, subCategory: 'G5-release-management' },
    { pattern: /^02-design\/迁移风险复盘/, subCategory: 'G5-release-management' },
    { pattern: /^06-project-management\/lessons-learned/, subCategory: 'G3-retrospectives' },
    { pattern: /^06-project-management\/WEEKLY-TASKS/, subCategory: 'G3-retrospectives' },
    { pattern: /^06-project-management\/plans\/README/, subCategory: 'G5-release-management' },
    { pattern: /^03-development\/pending-tasks-inventory/, subCategory: 'G3-retrospectives' },
    { pattern: /^03-development\/v9-rectification-tasks/, subCategory: 'G3-retrospectives' },
    { pattern: /^03-development\/weekly-check/, subCategory: 'G3-retrospectives' },
    { pattern: /^01-requirements\/data-collection-task-list/, subCategory: 'G3-retrospectives' },
    { pattern: /^01-requirements\/walkthrough-scoredoc/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/投资阶段分析/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/投资阶段分析/, subCategory: 'G3-retrospectives' },
    { pattern: /^06-project-management\/mcp-zombie-server/, subCategory: 'G3-retrospectives' },
    { pattern: /^06-project-management\/mcp-disabled-server/, subCategory: 'G3-retrospectives' },
    { pattern: /^06-project-management\/mcp-module-status/, subCategory: 'G3-retrospectives' },
    { pattern: /^06-project-management\/data_link_sequence/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/《DataBridge改进建议整改报告/, subCategory: 'G3-retrospectives' },
    { pattern: /^02-design\/《DataBridge数据链路全景分析/, subCategory: 'G3-retrospectives' },
    { pattern: /^01-requirements\/《DataBridge改进建议整改实施计划/, subCategory: 'G3-retrospectives' },
    { pattern: /^01-requirements\/《DataBridge端点与数据映射清单/, subCategory: 'G3-retrospectives' },
  ],
  'H': [
    { pattern: /^03-development\/guides\/getting-started/, subCategory: 'H3-getting-started' },
    { pattern: /^03-development\/guides\/how-to-add/, subCategory: 'H3-getting-started' },
    { pattern: /^03-development\/guides\/mcp-acl-guide/, subCategory: 'H1-security' },
    { pattern: /^05-deployment\/ops\/runbook/, subCategory: 'H2-ops' },
    { pattern: /^05-deployment\/ops\/deployment/, subCategory: 'H2-ops' },
    { pattern: /^02-design\/a11y-i18n/, subCategory: 'H4-accessibility' },
    { pattern: /^03-development\/a11y-checklist/, subCategory: 'H4-accessibility' },
    { pattern: /^01-requirements\/pwa-offline-guide/, subCategory: 'H2-ops' },
    { pattern: /^02-design\/00-README/, subCategory: 'H3-getting-started' },
    { pattern: /^02-design\/blueprints\/README/, subCategory: 'H3-getting-started' },
    { pattern: /^02-design\/topics\/databridge\/README/, subCategory: 'H3-getting-started' },
    { pattern: /^02-design\/architecture\/adr\/README/, subCategory: 'H3-getting-started' },
    { pattern: /^07-archive\/README/, subCategory: 'H3-getting-started' },
    { pattern: /^07-archive\/deletion-log/, subCategory: 'H3-getting-started' },
    { pattern: /^README/, subCategory: 'H3-getting-started' },
    { pattern: /^assets\/articles\//, subCategory: 'H3-getting-started' },
    { pattern: /^report-generation-architecture/, subCategory: 'H3-getting-started' },
    { pattern: /^02-design\/踩坑规则门禁指南/, subCategory: 'H1-security' },
    { pattern: /^02-design\/文件整理清单/, subCategory: 'H3-getting-started' },
    { pattern: /^02-design\/网页测试检索校对/, subCategory: 'H3-getting-started' },
    { pattern: /^03-development\/《V9 目标功能清单/, subCategory: 'H3-getting-started' },
  ],
};

function classifyDocument(relativePath: string): { category: string; subCategory: string } {
  const normalizedPath = normalizePath(relativePath);
  for (const [category, rules] of Object.entries(CATEGORY_RULES)) {
    for (const rule of rules) {
      if (rule.pattern.test(normalizedPath)) {
        return { category, subCategory: rule.subCategory };
      }
    }
  }
  return { category: 'U', subCategory: 'unclassified' };
}

function getDocumentStatus(lastModified: Date): 'active' | 'stale' | 'deprecated' {
  const now = new Date();
  const daysSinceModified = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceModified > 90) return 'deprecated';
  if (daysSinceModified > 30) return 'stale';
  return 'active';
}

function scanDocs(directory: string, prefix: string = ''): DocumentInfo[] {
  const results: DocumentInfo[] = [];
  
  try {
    const entries = readdirSync(directory);
    
    for (const entry of entries) {
      const fullPath = join(directory, entry);
      const relativePath = join(prefix, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && !entry.startsWith('_')) {
          results.push(...scanDocs(fullPath, relativePath));
        }
      } else if (entry.endsWith('.md')) {
        const { category, subCategory } = classifyDocument(relativePath);
        const status = getDocumentStatus(new Date(stat.mtime));
        
        results.push({
          path: relativePath,
          name: entry,
          category,
          subCategory,
          lastModified: stat.mtime.toISOString(),
          size: stat.size,
          status,
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning ${directory}:`, err);
  }
  
  return results;
}

function buildCategoryMap(documents: DocumentInfo[]): CategoryMap {
  const map: CategoryMap = {};
  
  for (const doc of documents) {
    const key = `${doc.category}/${doc.subCategory}`;
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(doc);
  }
  
  return map;
}

function generateCategoryIndex(documents: DocumentInfo[]): string {
  const categoryMap = buildCategoryMap(documents);
  
  const index = {
    generatedAt: new Date().toISOString(),
    totalDocuments: documents.length,
    activeCount: documents.filter(d => d.status === 'active').length,
    staleCount: documents.filter(d => d.status === 'stale').length,
    deprecatedCount: documents.filter(d => d.status === 'deprecated').length,
    unclassifiedCount: documents.filter(d => d.category === 'U').length,
    categories: categoryMap,
  };
  
  return JSON.stringify(index, null, 2);
}

function writeCategoryIndex(content: string): void {
  const indexDir = dirname(CATEGORY_INDEX_PATH);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
  writeFileSync(CATEGORY_INDEX_PATH, content, 'utf-8');
  console.log(`Category index written to ${CATEGORY_INDEX_PATH}`);
}

function checkCategoryConsistency(documents: DocumentInfo[]): void {
  const unclassified = documents.filter(d => d.category === 'U');
  const stale = documents.filter(d => d.status === 'stale');
  const deprecated = documents.filter(d => d.status === 'deprecated');
  
  console.log('\n=== Category Consistency Check ===');
  console.log(`Total documents: ${documents.length}`);
  console.log(`Unclassified: ${unclassified.length}`);
  console.log(`Stale (30-90 days): ${stale.length}`);
  console.log(`Deprecated (>90 days): ${deprecated.length}`);
  
  if (unclassified.length > 0) {
    console.log('\nUnclassified documents:');
    unclassified.forEach(d => console.log(`  - ${d.path}`));
  }
  
  if (stale.length > 0) {
    console.log('\nStale documents (review recommended):');
    stale.forEach(d => console.log(`  - ${d.path} (last modified: ${new Date(d.lastModified).toLocaleDateString()})`));
  }
  
  if (deprecated.length > 0) {
    console.log('\nDeprecated documents (archive recommended):');
    deprecated.forEach(d => console.log(`  - ${d.path} (last modified: ${new Date(d.lastModified).toLocaleDateString()})`));
  }
}

function findDuplicateDocuments(documents: DocumentInfo[]): void {
  const nameMap = new Map<string, DocumentInfo[]>();
  
  for (const doc of documents) {
    const existing = nameMap.get(doc.name) || [];
    existing.push(doc);
    nameMap.set(doc.name, existing);
  }
  
  const duplicates = Array.from(nameMap.entries()).filter(([, docs]) => docs.length > 1);
  
  if (duplicates.length > 0) {
    console.log('\n=== Duplicate Documents ===');
    for (const [name, docs] of duplicates) {
      console.log(`\nDuplicate: ${name}`);
      docs.forEach(d => console.log(`  - ${d.path} [${d.category}]`));
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const fixMode = args.includes('--fix');
  
  if (checkOnly) {
    console.log('=== Checking Document Category Consistency ===');
    const documents = scanDocs(DOCS_ROOT);
    checkCategoryConsistency(documents);
    findDuplicateDocuments(documents);
    process.exit(0);
  }
  
  if (fixMode) {
    console.log('=== Fixing Document Category Issues ===');
    const documents = scanDocs(DOCS_ROOT);
    const unclassified = documents.filter(d => d.category === 'U');
    if (unclassified.length > 0) {
      console.log('\nUnclassified documents found - manual classification required:');
      unclassified.forEach(d => console.log(`  - ${d.path}`));
    }
    const indexContent = generateCategoryIndex(documents);
    writeCategoryIndex(indexContent);
    console.log('\n=== Done ===');
    process.exit(0);
  }
  
  console.log('=== Synchronizing Document Categories ===');
  console.log(`Scanning docs directory: ${DOCS_ROOT}`);
  
  const documents = scanDocs(DOCS_ROOT);
  const indexContent = generateCategoryIndex(documents);
  
  writeCategoryIndex(indexContent);
  checkCategoryConsistency(documents);
  findDuplicateDocuments(documents);
  
  console.log('\n=== Done ===');
}

main();

export { scanDocs, classifyDocument, buildCategoryMap, generateCategoryIndex, checkCategoryConsistency };
