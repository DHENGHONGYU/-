import { renameSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_DIR = join(__dirname, '../docs');

interface RenameRule {
  oldPath: string;
  newPath: string;
  description: string;
}

const renameRules: RenameRule[] = [
  {
    oldPath: 'A/INDEX.md',
    newPath: 'A/a-navigation-governance.md',
    description: 'A类导航与治理主索引 - 定义文档体系全局导航、治理规则与需求规格'
  },
  {
    oldPath: 'A/A1/INDEX.md',
    newPath: 'A/A1/a1-index-constitution.md',
    description: 'A1索引与宪法 - 文档体系入口、治理规则、全局注册索引'
  },
  {
    oldPath: 'A/A2/INDEX.md',
    newPath: 'A/A2/a2-requirements-spec.md',
    description: 'A2需求规格 - 项目愿景、功能需求、规格定义'
  },
  {
    oldPath: 'A/A3/INDEX.md',
    newPath: 'A/A3/a3-plugin-integration.md',
    description: 'A3插件集成 - 外部插件、数据源集成文档'
  },
  {
    oldPath: 'B/INDEX.md',
    newPath: 'B/b-architecture-design.md',
    description: 'B类架构设计主索引 - 架构决策、模块关系、接口定义'
  },
  {
    oldPath: 'B/B1/INDEX.md',
    newPath: 'B/B1/b1-architecture-overview.md',
    description: 'B1架构概览 - 全局架构、舱室、服务、引擎'
  },
  {
    oldPath: 'B/B2/INDEX.md',
    newPath: 'B/B2/b2-subsystems-architecture.md',
    description: 'B2子系统架构 - 各子系统架构设计'
  },
  {
    oldPath: 'B/B3/INDEX.md',
    newPath: 'B/B3/b3-architecture-decision-records.md',
    description: 'B3架构决策记录 - ADR索引与管理'
  },
  {
    oldPath: 'B/B4/INDEX.md',
    newPath: 'B/B4/b4-compliance-audit.md',
    description: 'B4合规审计 - 架构合规与审计报告'
  },
  {
    oldPath: 'B/B5/INDEX.md',
    newPath: 'B/B5/b5-release-management.md',
    description: 'B5发布管理 - 版本说明与发布计划'
  },
  {
    oldPath: 'C/INDEX.md',
    newPath: 'C/c-functional-modules.md',
    description: 'C类功能模块主索引 - 功能规格、业务流程、UI映射'
  },
  {
    oldPath: 'C/C1/INDEX.md',
    newPath: 'C/C1/c1-cabin-specs.md',
    description: 'C1舱室规格 - 各舱室功能规格'
  },
  {
    oldPath: 'C/C2/INDEX.md',
    newPath: 'C/C2/c2-component-system.md',
    description: 'C2组件体系 - UI组件设计体系'
  },
  {
    oldPath: 'C/C3/INDEX.md',
    newPath: 'C/C3/c3-cockpit.md',
    description: 'C3驾驶舱 - Widget开发与集成'
  },
  {
    oldPath: 'C/C4/INDEX.md',
    newPath: 'C/C4/c4-state-management.md',
    description: 'C4状态管理 - Store规范与实现'
  },
  {
    oldPath: 'C/C5/INDEX.md',
    newPath: 'C/C5/c5-service-contracts.md',
    description: 'C5服务契约 - API接口定义'
  },
  {
    oldPath: 'C/C6/INDEX.md',
    newPath: 'C/C6/c6-data-layer.md',
    description: 'C6数据层 - 数据架构与存储'
  },
  {
    oldPath: 'C/C7/INDEX.md',
    newPath: 'C/C7/c7-data-dictionary.md',
    description: 'C7数据字典 - 数据定义与字段契约'
  },
  {
    oldPath: 'D/INDEX.md',
    newPath: 'D/d-technical-standards.md',
    description: 'D类技术规范主索引 - 分层规则、令牌规范、门禁标准'
  },
  {
    oldPath: 'D/D1/INDEX.md',
    newPath: 'D/D1/d1-coding-conventions.md',
    description: 'D1编码规范 - 代码风格与约定'
  },
  {
    oldPath: 'D/D2/INDEX.md',
    newPath: 'D/D2/d2-design-tokens.md',
    description: 'D2设计令牌 - 设计系统令牌规范'
  },
  {
    oldPath: 'D/D3/INDEX.md',
    newPath: 'D/D3/d3-quality-gates.md',
    description: 'D3质量门禁 - 代码质量与测试门禁'
  },
  {
    oldPath: 'D/D4/INDEX.md',
    newPath: 'D/D4/d4-documentation-standards.md',
    description: 'D4文档规范 - 文档编写标准'
  },
  {
    oldPath: 'D/D5/INDEX.md',
    newPath: 'D/D5/d5-migration-specs.md',
    description: 'D5迁移规范 - 版本迁移与升级'
  },
  {
    oldPath: 'E/INDEX.md',
    newPath: 'E/e-testing-strategy.md',
    description: 'E类测试策略主索引 - 测试分层、覆盖率、清理义务'
  },
  {
    oldPath: 'E/E1/INDEX.md',
    newPath: 'E/E1/e1-test-layers.md',
    description: 'E1测试分层 - 单元/集成/e2e测试分层'
  },
  {
    oldPath: 'E/E2/INDEX.md',
    newPath: 'E/E2/e2-test-cases.md',
    description: 'E2测试用例 - 测试用例管理'
  },
  {
    oldPath: 'E/E3/INDEX.md',
    newPath: 'E/E3/e3-test-reports.md',
    description: 'E3测试报告 - 测试结果与覆盖率报告'
  },
  {
    oldPath: 'E/E4/INDEX.md',
    newPath: 'E/E4/e4-test-gates.md',
    description: 'E4测试门禁 - 测试质量门禁'
  },
  {
    oldPath: 'F/INDEX.md',
    newPath: 'F/f-ai-engineering-governance.md',
    description: 'F类AI辅助工程治理主索引 - AI约束、提示词工程、飞轮流程'
  },
  {
    oldPath: 'F/F1/INDEX.md',
    newPath: 'F/F1/f1-prompt-engineering.md',
    description: 'F1提示词工程 - 提示词模板与优化'
  },
  {
    oldPath: 'F/F2/INDEX.md',
    newPath: 'F/F2/f2-checklists.md',
    description: 'F2检查清单 - 开发与治理检查清单'
  },
  {
    oldPath: 'F/F3/INDEX.md',
    newPath: 'F/F3/f3-memory-layer.md',
    description: 'F3记忆层 - AI记忆与知识管理'
  },
  {
    oldPath: 'G/INDEX.md',
    newPath: 'G/g-process-quality-products.md',
    description: 'G类过程与质量产物主索引 - 自动产物、变更日志、质量报告'
  },
  {
    oldPath: 'G/G1/INDEX.md',
    newPath: 'G/G1/g1-audit-reports.md',
    description: 'G1审计报告 - 代码与架构审计报告'
  },
  {
    oldPath: 'G/G2/INDEX.md',
    newPath: 'G/G2/g2-changelogs.md',
    description: 'G2变更日志 - 版本变更记录'
  },
  {
    oldPath: 'G/G3/INDEX.md',
    newPath: 'G/G3/g3-retrospectives.md',
    description: 'G3复盘报告 - 项目复盘与总结'
  },
  {
    oldPath: 'G/G4/INDEX.md',
    newPath: 'G/G4/g4-drafts.md',
    description: 'G4草稿 - 临时草稿与讨论稿'
  },
  {
    oldPath: 'G/G5/INDEX.md',
    newPath: 'G/G5/g5-release-management.md',
    description: 'G5发布管理 - 发布计划与流程'
  },
  {
    oldPath: 'H/INDEX.md',
    newPath: 'H/h-cross-domain-supplement.md',
    description: 'H类跨域补充主索引 - 操作指南、How-to、Runbook'
  },
  {
    oldPath: 'H/H1/INDEX.md',
    newPath: 'H/H1/h1-security-guide.md',
    description: 'H1安全指南 - 安全最佳实践'
  },
  {
    oldPath: 'H/H2/INDEX.md',
    newPath: 'H/H2/h2-operations.md',
    description: 'H2运维文档 - 部署与运维指南'
  },
  {
    oldPath: 'H/H3/INDEX.md',
    newPath: 'H/H3/h3-getting-started.md',
    description: 'H3入门指南 - 新成员上手指南'
  },
  {
    oldPath: 'H/H4/INDEX.md',
    newPath: 'H/H4/h4-accessibility.md',
    description: 'H4无障碍 - 无障碍与国际化'
  }
];

function main(): void {
  console.log(`=== Renaming A-H Index Files ===\n`);
  
  let renamed = 0;
  let skipped = 0;
  const renameLog: { old: string; new: string; status: string; reason?: string }[] = [];
  
  for (const rule of renameRules) {
    const oldFullPath = join(DOCS_DIR, rule.oldPath);
    const newFullPath = join(DOCS_DIR, rule.newPath);
    
    if (!existsSync(oldFullPath)) {
      console.log(`❌ Skipped: ${rule.oldPath} (file not found)`);
      skipped++;
      renameLog.push({ old: rule.oldPath, new: rule.newPath, status: 'skipped', reason: 'file not found' });
      continue;
    }
    
    if (existsSync(newFullPath)) {
      console.log(`❌ Skipped: ${rule.oldPath} (target already exists)`);
      skipped++;
      renameLog.push({ old: rule.oldPath, new: rule.newPath, status: 'skipped', reason: 'target exists' });
      continue;
    }
    
    try {
      renameSync(oldFullPath, newFullPath);
      console.log(`✅ Renamed: ${rule.oldPath} → ${rule.newPath}`);
      console.log(`   Description: ${rule.description}`);
      renamed++;
      renameLog.push({ old: rule.oldPath, new: rule.newPath, status: 'renamed' });
    } catch (err) {
      console.log(`❌ Failed: ${rule.oldPath} → ${rule.newPath}`);
      console.log(`   Error: ${err}`);
      skipped++;
      renameLog.push({ old: rule.oldPath, new: rule.newPath, status: 'failed', reason: String(err) });
    }
    
    console.log();
  }
  
  console.log(`=== Rename Complete ===`);
  console.log(`Renamed: ${renamed}`);
  console.log(`Skipped: ${skipped}`);
  
  const logPath = join(DOCS_DIR, '00-meta/deprecated-docs/temporary/rename-log.json');
  writeFileSync(logPath, JSON.stringify(renameLog, null, 2), 'utf-8');
  console.log(`\nRename log written to: ${logPath}`);
}

if (process.argv[1] && process.argv[1].endsWith('rename-ah-index-files.ts')) {
  main();
}