# 失效文档链接审计报告（丢失型 + 迁移型）

> 生成时间：2026-07-19  |  数据来源：`scripts` 架构师全仓扫描 C.json

## 一、总览

- 扫描文档链接总数：**4638**
- 失效链接总数：**1275**（占比 27.49%）
  - 可能丢失（目标文件已不存在）：**934**
  - 可能迁移/改名（basename 仍存在，可重定向）：**341**

## 二、根因说明

失效链接主要来自两类历史操作：
1. **文档选择性提交丢失**：约 50 个 `.md`/`.cjs` 文件因历史选择性 git 提交策略未入库，
   导致大量指向这些文件的链接成为"可能丢失"型（basename 在全仓已无匹配）。
2. **文档目录重构（diataxis 重梳）**：文件从根目录/旧目录迁入 `docs/explanation`、`docs/reference`、
   `docs/how-to` 等分类目录，原相对路径失效，成为"可能迁移/改名"型。

> **整改原则**：丢失型链接无法自动修复（目标已消失），仅登记供人工决策（补回文件或删除链接）；
> 迁移型链接经重定向表/`basename` 唯一性解析后可安全重写，但因批量重写存在语义误判风险（如 basename
> 唯一但语义无关），本次未做全自动批量重写，改为清单登记 + 人工/定向重写。

## 三、可能丢失的链接（934 条）

> 目标文件在全仓已无同名文件，无法自动重定向。建议：补回源文件、或删除/改写该链接。

### docs/00-meta/README.md（1 条）
- L56: `ĵ嵥.md`

### docs/00-meta/REGISTRY_INDEX.md（35 条）
- L376: `../archive/00-meta-historical/23个核心文档重新检索报`
- L432: `../archive/NewsPage-迁移验收确认`
- L540: `../explanation/V9-体系化上线测`
- L868: `../explanation/b批次高价值孤儿集成状态报`
- L908: `../reports/audit/cockpit_整体设计一致性审`
- L1184: `../reference/databridge端点与数据映射清`
- L1796: `../explanation/design/p4-文档去重清单与执行方`
- L2064: `../reference/rm剩余任务全量盘点与整改方`
- L2336: `../reports/audit/typescript错误处理和类型安全检测报`
- L2380: `../explanation/design/ui改善部分检索报`
- L2384: `../reference/ui设计优化实施计划-详细`
- L2456: `../explanation/design/v6-v9界面设计优化可行性计`
- L2580: `../explanation/v9-l2状态层补齐路线`
- L2584: `../reference/v9-l2状态层补齐路线`
- L2632: `../reference/v9-数据血缘追`
- L2636: `../explanation/v9-架构缺陷与整改行动清`
- L2640: `../reports/audit/v9-架构缺陷与整改行动清`
- L2656: `../reference/v9核心数据字典与类型定`
- L2748: `../reports/audit/上线前全面校验报`
- L2772: `../explanation/双通道投研评分系统技术方`
- L2776: `../explanation/design/双通道投研评分系统技术方`
- L2780: `../explanation/design/发布计划与评`
- L2784: `../reference/changelogs/变更摘要-2026-06-28-phase0-数据层改`
- L2788: `../explanation/design/回滚方案与演`
- L2796: `../archive/改进路线图实施计`
- L2800: `../explanation/design/数据治理路线`
- L2804: `../reference/数据治理路线`
- L2808: `../archive/文件去重与整理治理方`
- L2840: `../archive/00-meta-historical/文档自动更新体系-架构梳理与任务清`
- L2844: `../archive/00-meta-historical/月度文档体检检查清`
- L2860: `../reports/retrospectives/综合验证与定位分析报`
- L2864: `../reference/网页测试检索校对纳入采集方案分`
- L2868: `../reports/audit/脚本与测试质量检查报`
- L2872: `../archive/诊断与重梳方案报`
- L2884: `../explanation/design/迁移风险复盘与应对策略文`

### docs/00-meta/deprecated-docs/old-versions/registry-index-v1.0.0-02-design.md（51 条）
- L29: `../../../reference/ģԼ.md`
- L33: `../../../reference/databridge˵ӳ嵥.md`
- L37: `../../../explanation/design/databridgeĽı.md`
- L41: `../../../reference/databridgeĽʵʩƻ.md`
- L45: `../../../explanation/design/databridge·ȫ.md`
- L49: `../../../explanation/v9-ʵַ.md`
- L53: `../../../explanation/v9-ܹǷ.md`
- L57: `../../../explanation/v9-ܹȱж嵥.md`
- L61: `../../../explanation/v9-Ŀ깦嵥.md`
- L65: `v9ֵͶ(ϰ`
- L69: `../../../reference/v9ݼܹ޶.md`
- L73: `../../../explanation/design/v9ʲ嵥.md`
- L117: `../../../reference/changelogs/ժҪ-2026-06-28-phase0-ݲ.md`
- L121: `../../../explanation/design/ȿӹŽָ.md`
- L125: `../../../explanation/design/·ͼ.md`
- L129: `../../../reference/ļ嵥.md`
- L133: `../../../explanation/design/ҵ䱨_ѡ춯_2026-07-09.md`
- L174: `../../../reports/audit/ȶԷȶԱ.md`
- L175: `../../../reports/audit/ȷ嵥ϢµϽ.md`
- L176: `../../../reports/audit/Ϲ鱨_2026-07-08.md`
- L177: `../../../reports/audit/عԱ_2026-07-08.md`
- L178: `../../../reports/audit/ģ鲹ȫձ.md`
- L179: `../../../reports/audit/ĵ-˫һԼⱨ_2026-07-08.md`
- L180: `../../../reports/audit/cockpit_һ.md`
- L181: `../../../reports/audit/cockpit_widget_40˲-ж.md`
- L188: `../../../reports/audit/typescriptͰȫⱨ.md`
- L191: `../../../explanation/v9-ܹȱж嵥.md`
- L204: `../../../explanation/bθ߼ֵ¶״̬-2026-07-08.md`
- L208: `../../../explanation/bɲԱ-b6-2026-07-08.md`
- L263: `../../../reference/code-review.md  V9 ׼`
- L314: `../architecture/architecture-version-comparison`
- L335: `../architecture/component-deprecation-policy`
- L385: `../architecture/v10-architecture-alignment`
- L431: `../../../explanation/design/p4-ĵȥ嵥ִз.md`
- L435: `../../../explanation/design/ƻ-r01.md`
- L436: `../../../explanation/design/ع-r03.md`
- L437: `../../../explanation/design/ǨƷոӦԲĵ.md`
- L438: `../../../explanation/˫ͨͶϵͳ.md`
- L439: `../../../reference/ҳԼУɼ.md`
- L442: `../../../reference/rmʣȫ̵ķ-2026-07-08.md`
- L444: `../../../explanation/design/uiƲּ.md`
- L445: `../../../reference/uiŻʵʩƻ-ϸ.md`
- L446: `../../../explanation/design/v6-v9ŻԼƻ.md`
- L447: `../../../explanation/design/v6-v9html.md`
- L455: `../../../explanation/rbacϿԷʵʩƻ-2026-07-08.md`
- L492: `../../../reports/ű鱨.md`
- L531: `../../../explanation/design/solo-review.md  ˿ָ`
- L549: `../../../explanation/design/tech-debt.md  ծĵ`
- L587: `../../../reference/v9-ѪԵ׷.md`
- L595: `../../../explanation/v9-l2״̬㲹·ͼ.md`
- L607: `../../../reference/v9ܷ.md`

### docs/00-meta/document-style-guide.md（2 条）
- L259: `../other-dir`
- L260: `../another-dir`

### docs/00-meta/p1-01-llm-management-split-report.md（1 条）
- L38: `file:///g:/FinSightV9/src/pages/command/agent/LlmManagementPage.tsx`

### docs/00-meta/registry-index.md（86 条）
- L31: `23ĵ¼.md`
- L32: `ĵϵͳֱ.md`
- L33: `ĵϵṹ.md`
- L34: `ĵ˲鱨.md`
- L35: `ĵϵ챨-v9.md`
- L36: `ĵϵ޸ִмƻ-v1.md`
- L37: `ĵ嵥.md`
- L38: `ĵԶϵ-ܹ嵥.md`
- L39: `¶ĵ嵥.md`
- L40: `ִУ鱨.md`
- L94: `V9-ĵ޸жƻ.md`
- L95: `V9-Ŀ״̬.md`
- L145: `../archive/-file-wandering-report.md`
- L146: `../archive/-optimization-prompt.md`
- L147: `../archive/-RCA-report.md`
- L148: `../archive/-task-list.md`
- L153: `../archive/00-meta-historical/23ĵ¼.md`
- L154: `../archive/00-meta-historical/ĵϵͳֱ.md`
- L155: `../archive/00-meta-historical/ĵϵṹ.md`
- L156: `../archive/00-meta-historical/ĵ˲鱨.md`
- L157: `../archive/00-meta-historical/ĵϵ챨-v9.md`
- L158: `../archive/00-meta-historical/ĵϵ޸ִмƻ-v1.md`
- L159: `../archive/00-meta-historical/ĵԶϵ-ܹ嵥.md`
- L160: `../archive/00-meta-historical/¶ĵ嵥.md`
- L161: `../archive/00-meta-historical/ִУ鱨.md`
- L196: `../archive/00-meta-historical/V9-ĵ޸жƻ.md`
- L197: `../archive/00-meta-historical/V9-Ŀ״̬.md`
- L203: `../archive/УԸ±-2026-07-12.md`
- L204: `../archive/Ľ·ͼʵʩƻ.md`
- L205: `../archive/ļȥ.md`
- L206: `../archive/᷽.md`
- L217: `../archive/DEPRECATED_ԭļ.md`
- L225: `../archive/NewsPage-Ǩȷ.md`
- L300: `../explanation/˫ͨͶϵͳ.md`
- L319: `../explanation/bθ߼ֵ¶״̬-2026-07-08.md`
- L320: `../explanation/bɲԱ-b6-2026-07-08.md`
- L348: `../explanation/design/ȿӹŽָ.md`
- L349: `../explanation/design/ƻ-r01.md`
- L350: `../explanation/design/ع-r03.md`
- L351: `../explanation/design/ǨƷոӦԲĵ.md`
- L352: `../explanation/design/·ͼ.md`
- L353: `../explanation/design/˫ͨͶϵͳ.md`
- L354: `../explanation/design/ҵ䱨_ѡ춯_2026-07-09.md`
- L375: `../explanation/design/databridgeĽı.md`
- L376: `../explanation/design/databridge·ȫ.md`
- L398: `../explanation/design/p4-ĵȥ嵥ִз.md`
- L414: `../explanation/design/uiƲּ.md`
- L418: `../explanation/design/v6-v9ŻԼƻ.md`
- L419: `../explanation/design/v6-v9html.md`
- L435: `../explanation/design/v9ʲ嵥.md`
- L460: `../explanation/rbacϿԷʵʩƻ-2026-07-08.md`
- L482: `../explanation/v9-ʵַ.md`
- L483: `../explanation/v9-ܹǷ.md`
- L484: `../explanation/v9-ܹȱж嵥.md`
- L485: `../explanation/v9-Ŀ깦嵥.md`
- L486: `../explanation/V9-ϵ߲-TODO-LIST.md`
- L491: `../explanation/v9-l2״̬㲹·ͼ.md`
- L562: `../reference/ȿӹŽָ.md`
- L563: `../reference/ģԼ.md`
- L564: `../reference/·ͼ.md`
- L565: `../reference/ҳԼУɼ.md`
- L566: `../reference/ļ嵥.md`
- L618: `../reference/changelogs/ժҪ-2026-06-28-phase0-ݲ.md`
- L642: `../reference/databridge˵ӳ嵥.md`
- L643: `../reference/databridgeĽʵʩƻ.md`
- L691: `../reference/rmʣȫ̵ķ-2026-07-08.md`
- L716: `../reference/uiŻʵʩƻ-ϸ.md`
- L723: `../reference/v9-ѪԵ׷.md`
- L729: `../reference/v9-l2״̬㲹·ͼ.md`
- L732: `../reference/v9ֵͶ(ϰ`
- L733: `../reference/v9ݼܹ޶.md`
- L734: `../reference/V9ܷ.md`
- L735: `../reference/V9ʲ嵥.md`
- L755: `../reports/audit/ȶԷȶԱ.md`
- L756: `../reports/audit/ȷ嵥ϢµϽ.md`
- L757: `../reports/audit/Ϲ鱨_2026-07-08.md`
- L758: `../reports/audit/عԱ_2026-07-08.md`
- L759: `../reports/audit/ű鱨.md`
- L760: `../reports/audit/ģ鲹ȫձ.md`
- L761: `../reports/audit/ǰȫУ鱨-v1.0.0.md`
- L762: `../reports/audit/ĵ-˫һԼⱨ_2026-07-08.md`
- L768: `../reports/audit/cockpit_һ.md`
- L769: `../reports/audit/cockpit_widget_40˲-ж.md`
- L799: `../reports/audit/typescriptͰȫⱨ.md`
- L803: `../reports/audit/v9-ܹȱж嵥.md`
- L836: `../reports/retrospectives/ۺ֤붨λ-v2.0.0.md`

### docs/01-product/data-security-and-privacy.md（1 条）
- L276: `/script`

### docs/04-testing/pre-testing-checklist.md（6 条）
- L25: `./audit-reports/audit/APPǰ嵥_v9.html`
- L27: `../explanation/v9-ϵ߲-todo-list.md`
- L52: `../explanation/v9-Ŀ깦嵥.md`
- L390: `./audit-reports/audit/APPǰ嵥_v9.html`
- L391: `../explanation/v9-ϵ߲-todo-list.md`
- L393: `../explanation/v9-Ŀ깦嵥.md`

### docs/04-testing/security-test-plan.md（13 条）
- L138: `/script`
- L140: `/script`
- L148: `/script`
- L150: `/script`
- L165: `javascript:alert(1`
- L175: `/ScRiPt`
- L178: `/style`
- L189: `/script`
- L191: `/script`
- L194: `javascript:alert("xss"`
- L369: `/script`
- L377: `/ScRiPt`
- L385: `/script`

### docs/06-project-management/README.md（1 条）
- L35: `../00-meta/ĵ嵥.md`

### docs/archive/00-meta-historical/p1-01-llm-management-split-report.md（1 条）
- L23: `file:///g:/FinSightV9/src/pages/command/agent/LlmManagementPage.tsx`

### docs/archive/reference-historical/audit-b4-1-code-quality.md（2 条）
- L283: `LoadingState `
- L283: `PageSkeleton `

### docs/archive/reference-historical/data-collection-route-ui-audit.md（1 条）
- L76: `file:////src/pages/input/InputHubPage.tsx`

### docs/archive/reference-historical/refactor-research-pool-rename-plan.md（1 条）
- L329: `Navigate to="/analysis/research-pool" `

### docs/archive/reference-historical/stock-pool-board-migration-proposal.md（1 条）
- L138: `StockPoolBoardPage `

### docs/archive/reference-historical/v9-code-quality-audit-report-20260629.md（4 条）
- L274: ` 0.5/0.5-1.0`
- L277: ` -10`
- L280: `= 3`
- L290: `= 70`

### docs/archive/reference-historical/walkthrough-scoredoc-report.md（1 条）
- L73: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/tests/__tests__/integration/walkthroughTest.sampled.test.ts`

### docs/explanation/2026-07-05-exception-handling-test-report.md（2 条）
- L93: `/MemoryRouter`
- L98: `OutputApp `

### docs/explanation/A-H-INDEX.md（24 条）
- L45: `01-requirements`
- L52: `02-design/cabins`
- L52: `02-design/architecture/compliance`
- L53: `02-design/architecture/adr`
- L56: `02-design/cabins`
- L59: `02-design/standards`
- L63: `02-design/standards/design-tokens`
- L70: `04-testing/test-cases`
- L71: `04-testing/gates`
- L72: `04-testing/reports`
- L73: `04-testing/audit-reports`
- L78: `03-development/checklists`
- L79: `03-development/ai`
- L80: `03-development/migration`
- L82: `reports/audit`
- L83: `06-project-management/changelogs`
- L83: `reports/changelogs`
- L84: `reports/retrospectives`
- L85: `reports/drafts`
- L86: `reports/release-management`
- L89: `05-deployment/ops`
- L90: `03-development/guides`
- L91: `03-development/plugins`
- L92: `03-development/templates`

### docs/explanation/ai-center-vue3-examples.md（12 条）
- L105: `/script`
- L108: `component :is="IconComponent" :class="props.class" v-if="IconComponent" `
- L110: `/template`
- L241: `/script`
- L255: `IconRenderer :name="card.icon" class="h-4 w-4" `
- L297: `IconRenderer :name="AGENT_TAG_MAP[tag].icon" class="h-3 w-3" `
- L317: `/template`
- L364: `/script`
- L375: `IconRenderer :name="HEALTH_STATUS_MAP[healthMetrics.overallStatus].icon" class="h-4 w-4" `
- L420: `/template`
- L446: `/script`
- L492: `/template`

### docs/explanation/b批次组件集成测试报告-b6-2026-07-08.md（1 条）
- L41: `SectorRotationHeatmap `

### docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md（1 条）
- L40: `SectorRotationHeatmap `

### docs/explanation/design-tokens.md（1 条）
- L75: `ThemeToggle `

### docs/explanation/design/06-routing-specs.md（1 条）
- L276: `Outlet `

### docs/explanation/design/component-library-guide.md（42 条）
- L99: `/SelectItem`
- L100: `/SelectItem`
- L101: `/Select`
- L123: `/TabsTrigger`
- L124: `/TabsTrigger`
- L125: `/TabsList`
- L126: `/TabsContent`
- L127: `/TabsContent`
- L128: `/Tabs`
- L139: `DownloadIcon `
- L141: `/Tooltip`
- L210: `BreadcrumbLink href="/"`
- L210: `/BreadcrumbLink`
- L211: `/BreadcrumbItem`
- L212: `BreadcrumbSeparator `
- L214: `BreadcrumbLink href="/input"`
- L214: `/BreadcrumbLink`
- L215: `/BreadcrumbItem`
- L216: `BreadcrumbSeparator `
- L218: `/BreadcrumbPage`
- L219: `/BreadcrumbItem`
- L220: `/BreadcrumbList`
- L221: `/Breadcrumb`
- L260: `Input label="股票名称" required placeholder="请输入股票名`
- L262: `/SelectItem`
- L263: `/SelectItem`
- L264: `/Select`
- L265: `Switch label="加入自`
- L274: `RefreshCw className="h-4 w-4" `
- L276: `/Tooltip`
- L283: `/TabsTrigger`
- L284: `/TabsTrigger`
- L285: `/TabsList`
- L288: `/TabsContent`
- L291: `/TabsContent`
- L292: `/Tabs`
- L307: `/Breadcrumb`
- L309: `StrategyCard `
- L312: `DimensionRow `
- L315: `Input `
- L315: `Progress `
- L321: `/SevenDimConfigPage`

### docs/explanation/design/data-collection-route-ui-audit.md（1 条）
- L89: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/pages/input/InputHubPage.tsx`

### docs/explanation/design/design-tokens.md（1 条）
- L75: `ThemeToggle `

### docs/explanation/design/registry-index.md（22 条）
- L31: `../../reference/databridge端点与数据映射清`
- L55: `../v9-架构缺陷与整改行动清`
- L63: `../../reference/v9核心数据字典与类型定`
- L115: `../../reference/changelogs/变更摘要-2026-06-28-phase0-数据层改`
- L123: `数据治理路线`
- L178: `../../reports/audit/cockpit_整体设计一致性审`
- L186: `../../reports/audit/typescript错误处理和类型安全检测报`
- L189: `../v9-架构缺陷与整改行动清`
- L202: `../b批次高价值孤儿集成状态报`
- L429: `p4-文档去重清单与执行方`
- L433: `发布计划与评`
- L434: `回滚方案与演`
- L435: `迁移风险复盘与应对策略文`
- L436: `双通道投研评分系统技术方`
- L437: `../../reference/网页测试检索校对纳入采集方案分`
- L440: `../../reference/rm剩余任务全量盘点与整改方`
- L442: `ui改善部分检索报`
- L443: `../../reference/ui设计优化实施计划-详细`
- L444: `v6-v9界面设计优化可行性计`
- L490: `../../reports/audit/脚本与测试质量检查报`
- L585: `../../reference/v9-数据血缘追`
- L593: `../v9-l2状态层补齐路线`

### docs/explanation/design/v9-code-quality-kanban-20260629.md（2 条）
- L59: ` 0.5/0.5-1.0`
- L62: ` -5`

### docs/explanation/design/踩坑规则门禁指南.md（3 条）
- L241: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/.husky/pre-commit`
- L242: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/.husky/_/pre-commit`
- L417: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/.husky/pre-commit`

### docs/explanation/v9-code-quality-audit-report-20260629.md（4 条）
- L282: ` 0.5/0.5-1.0`
- L285: ` -10`
- L288: `= 3`
- L298: `= 70`

### docs/how-to/FILE-MANAGEMENT-GUIDE.md（1 条）
- L198: `../07-archive`

### docs/how-to/hooks-guide.md（1 条）
- L42: `/ToastProvider`

### docs/how-to/how-to-add-store.md（1 条）
- L244: `Loading `

### docs/how-to/how-to-add-widget.md（3 条）
- L205: `/WidgetShell`
- L329: `MyWidgetContent `
- L330: `/WidgetShell`

### docs/how-to/widget-development-guide.md（14 条）
- L145: `/CardTitle`
- L145: `/CardHeader`
- L148: `/CardContent`
- L149: `/Card`
- L163: `/CardTitle`
- L163: `/CardHeader`
- L166: `/CardContent`
- L167: `/Card`
- L365: `Gem className="h-4 w-4" `
- L367: `/CardTitle`
- L368: `/CardHeader`
- L375: `/CardContent`
- L376: `/Card`
- L453: `/WidgetErrorBoundary`

### docs/prompts/service-integration-guide.md（1 条）
- L245: `Spinner `

### docs/prompts/store-integration-guide.md（1 条）
- L488: `Component `

### docs/reference/09-quality-gates.md（1 条）
- L49: `ȿӹŽָ.md`

### docs/reference/2026-07-01-v6-architecture-dominance-batch-a.md（3 条）
- L310: `InputHubPage `
- L311: `Navigate to="hub" replace `
- L318: `InputHubPage `

### docs/reference/2026-07-04-ui-testing-optimization.md（83 条）
- L122: `a href="/test"`
- L183: `Input placeholder="" `
- L196: `Input type="text" `
- L199: `Input type="password" `
- L204: `Input disabled `
- L209: `Input `
- L216: `Input type="file" `
- L222: `Input className="custom-class" `
- L270: `/DialogTitle`
- L271: `/DialogDescription`
- L272: `/DialogHeader`
- L273: `/DialogContent`
- L274: `/Dialog`
- L283: `/DialogTitle`
- L284: `/DialogContent`
- L285: `/Dialog`
- L295: `/DialogTitle`
- L296: `/DialogContent`
- L297: `/Dialog`
- L313: `/DialogTitle`
- L314: `/DialogContent`
- L315: `/Dialog`
- L330: `/DialogTitle`
- L331: `/DialogDescription`
- L332: `/DialogHeader`
- L334: `/DialogContent`
- L335: `/Dialog`
- L347: `/DialogTitle`
- L348: `/DialogContent`
- L349: `/Dialog`
- L397: `/Card`
- L405: `/CardTitle`
- L406: `/CardDescription`
- L407: `/CardHeader`
- L408: `/Card`
- L418: `/CardContent`
- L419: `/Card`
- L428: `/CardFooter`
- L429: `/Card`
- L439: `/CardTitle`
- L440: `/CardHeader`
- L441: `/CardContent`
- L442: `/CardFooter`
- L443: `/Card`
- L455: `/CardTitle`
- L456: `/CardHeader`
- L457: `/Card`
- L509: `/BrowserRouter`
- L515: `InputHubPage `
- L521: `InputHubPage `
- L527: `InputHubPage `
- L543: `InputHubPage `
- L550: `InputHubPage `
- L562: `InputHubPage `
- L610: `/BrowserRouter`
- L616: `AnalysisHubPage `
- L621: `AnalysisHubPage `
- L641: `AnalysisHubPage `
- L651: `AnalysisHubPage `
- L699: `/BrowserRouter`
- L705: `TradingHubPage `
- L710: `TradingHubPage `
- L718: `TradingHubPage `
- L728: `TradingHubPage `
- L769: `/BrowserRouter`
- L775: `OutputHubPage `
- L780: `OutputHubPage `
- L788: `OutputHubPage `
- L795: `OutputHubPage `
- L836: `/BrowserRouter`
- L842: `CommandHubPage `
- L847: `CommandHubPage `
- L856: `CommandHubPage `
- L866: `CommandHubPage `
- L1091: `div className="h-8 w-48 animate-pulse rounded bg-muted" `
- L1098: `div className="h-5 w-24 animate-pulse rounded bg-muted" `
- L1099: `/CardHeader`
- L1102: `div className="h-4 w-full animate-pulse rounded bg-muted" `
- L1103: `div className="h-4 w-3/4 animate-pulse rounded bg-muted" `
- L1105: `/CardContent`
- L1106: `/Card`
- L1152: `AlertCircle className="h-12 w-12 text-destructive mb-4" `
- L1212: `Icon className="h-8 w-8 text-muted-foreground" `

### docs/reference/audit-b4-1-code-quality.md（2 条）
- L296: `LoadingState `
- L296: `PageSkeleton `

### docs/reference/changelogs/2026-07/2026-07-05-p0-5-and-legacy-bugs-jira-tickets.md（2 条）
- L411: `/Select`
- L416: `/Select`

### docs/reference/changelogs/2026-07/pr-8-dedup-audit-report.md（1 条）
- L608: `../../reports/audit/audit-split-quality-optimized.json`

### docs/reference/completeness-profile-batch1.md（1 条）
- L32: `Link to="/input/hub"`

### docs/reference/data-collection-route-ui-audit.md（1 条）
- L89: `file:////src/pages/input/InputHubPage.tsx`

### docs/reference/meta/registry-index.md（24 条）
- L203: `../../00-meta/23个核心文档重新检索报`
- L231: `../../explanation/b批次高价值孤儿集成状态报`
- L319: `../../explanation/design/p4-文档去重清单与执行方`
- L383: `../rm剩余任务全量盘点与整改方`
- L399: `../../reports/audit/typescript错误处理和类型安全检测报`
- L403: `../../explanation/design/ui改善部分检索报`
- L407: `../ui设计优化实施计划-详细`
- L415: `../../explanation/design/v6-v9界面设计优化可行性计`
- L419: `../../explanation/v9-架构缺陷与整改行动清`
- L431: `../../explanation/v9-体系化上线测`
- L447: `../../explanation/v9-l2状态层补齐路线`
- L451: `../v9-数据血缘追`
- L647: `../../reports/audit/cockpit_整体设计一致性审`
- L1527: `../databridge端点与数据映射清`
- L1535: `../../explanation/v9-架构缺陷与整改行动清`
- L1551: `../v9核心数据字典与类型定`
- L1579: `../../explanation/双通道投研评分系统技术方`
- L1583: `../../explanation/design/发布计划与评`
- L1587: `../../explanation/design/回滚方案与演`
- L1595: `../../explanation/design/数据治理路线`
- L1627: `../../00-meta/文档自动更新体系-架构梳理与任务清`
- L1631: `../../00-meta/月度文档体检检查清`
- L1643: `../网页测试检索校对纳入采集方案分`
- L1651: `../../explanation/design/迁移风险复盘与应对策略文`

### docs/reference/refactor-research-pool-rename-plan.md（1 条）
- L301: `Navigate to="/analysis/research-pool" `

### docs/reference/registry-index.md（8 条）
- L31: `databridge端点与数据映射清`
- L43: `../explanation/v9-架构缺陷与整改行动清`
- L51: `v9核心数据字典与类型定`
- L103: `changelogs/变更摘要-2026-06-28-phase0-数据层改`
- L111: `数据治理路线`
- L358: `../reports/audit/脚本与测试质量检查报`
- L423: `v9-数据血缘追`
- L431: `v9-l2状态层补齐路线`

### docs/reference/seven-dim-advanced-config-implementation.md（21 条）
- L129: `/CardTitle`
- L132: `/Badge`
- L134: `/CardHeader`
- L146: `/Badge`
- L161: `Separator `
- L193: `/Badge`
- L204: `Separator `
- L216: `/Badge`
- L238: `Separator `
- L258: `/CardContent`
- L259: `/Card`
- L413: `/Badge`
- L415: `/Badge`
- L417: `/Badge`
- L425: `/DialogTitle`
- L426: `/DialogHeader`
- L473: `/CardContent`
- L474: `/Card`
- L479: `/DialogContent`
- L480: `/Dialog`
- L508: `CollectionPlanPanel `

### docs/reference/stock-pool-board-migration-proposal.md（1 条）
- L101: `StockPoolBoardPage `

### docs/reference/testing-strategy.md（1 条）
- L171: `Badge label="" variant="success" `

### docs/reference/ui设计优化实施计划-详细版.md（158 条）
- L214: `/AlertDescription`
- L215: `/Alert`
- L234: `/Badge`
- L239: `Activity className="h-3 w-3" `
- L243: `Clock className="h-3 w-3" `
- L249: `/CardContent`
- L250: `/Card`
- L344: `/CardTitle`
- L345: `/CardDescription`
- L346: `/CardHeader`
- L352: `SelectValue placeholder="选择模型预设" `
- L353: `/SelectTrigger`
- L358: `/SelectItem`
- L360: `/SelectContent`
- L361: `/Select`
- L367: `/Label`
- L375: `/Label`
- L393: `/Label`
- L414: `/AlertTitle`
- L415: `/AlertDescription`
- L416: `/Alert`
- L418: `/CardContent`
- L419: `/Card`
- L433: `/CardTitle`
- L434: `/CardDescription`
- L445: `/CardHeader`
- L459: `/Label`
- L462: `Brain className="mr-1 h-3 w-3" `
- L464: `/Badge`
- L476: `/CardContent`
- L477: `/Card`
- L492: `/CardTitle`
- L494: `/CardHeader`
- L501: `/CardContent`
- L502: `/Card`
- L507: `/CardContent`
- L508: `/Card`
- L513: `/CardContent`
- L514: `/Card`
- L519: `/CardContent`
- L520: `/Card`
- L527: `/TabsTrigger`
- L528: `/TabsList`
- L541: `/TabsContent`
- L544: `/TabsContent`
- L547: `/TabsContent`
- L548: `/Tabs`
- L549: `/CardContent`
- L550: `/Card`
- L636: `/CardTitle`
- L637: `/CardDescription`
- L638: `/CardHeader`
- L657: `/Badge`
- L663: `Target className="h-4 w-4" `
- L667: `TrendingUp className="h-4 w-4" `
- L671: `Clock className="h-4 w-4" `
- L686: `/CardContent`
- L687: `/Card`
- L689: `/CardContent`
- L690: `/Card`
- L704: `/CardTitle`
- L706: `/CardHeader`
- L711: `/Label`
- L719: `/Label`
- L725: `SelectValue `
- L726: `/SelectTrigger`
- L728: `/SelectItem`
- L729: `/SelectItem`
- L730: `/SelectContent`
- L731: `/Select`
- L758: `/Label`
- L764: `RadioGroupItem value="limit" id="limit" `
- L768: `RadioGroupItem value="market" id="market" `
- L771: `/RadioGroup`
- L777: `/form`
- L793: `/Badge`
- L813: `/CardContent`
- L814: `/Card`
- L817: `/CardContent`
- L818: `/Card`
- L831: `/CardTitle`
- L833: `/CardHeader`
- L845: `/CardContent`
- L846: `/Card`
- L856: `/CardContent`
- L857: `/Card`
- L864: `/CardContent`
- L865: `/Card`
- L920: `/CardContent`
- L921: `/Card`
- L924: `/CardContent`
- L925: `/Card`
- L939: `/CardTitle`
- L941: `/CardHeader`
- L948: `/CardContent`
- L949: `/Card`
- L954: `/CardContent`
- L955: `/Card`
- L960: `/CardContent`
- L961: `/Card`
- L968: `/Label`
- L977: `/Label`
- L990: `/AlertTitle`
- L997: `/AlertDescription`
- L998: `/Alert`
- L1000: `/CardContent`
- L1001: `/Card`
- L1070: `/CardTitle`
- L1072: `Plus className="h-4 w-4 mr-1" `
- L1076: `/CardHeader`
- L1087: `SelectValue `
- L1088: `/SelectTrigger`
- L1090: `/SelectItem`
- L1091: `/SelectItem`
- L1092: `/SelectItem`
- L1093: `/SelectItem`
- L1094: `/SelectContent`
- L1095: `/Select`
- L1112: `/Badge`
- L1120: `Clock className="h-3 w-3" `
- L1124: `Eye className="h-3 w-3" `
- L1130: `/Badge`
- L1135: `/CardContent`
- L1136: `/Card`
- L1139: `/CardContent`
- L1140: `/Card`
- L1154: `/CardTitle`
- L1157: `/CardDescription`
- L1166: `Download className="h-4 w-4 mr-1" `
- L1169: `/DropdownMenuTrigger`
- L1173: `/DropdownMenuItem`
- L1176: `/DropdownMenuItem`
- L1179: `/DropdownMenuItem`
- L1180: `/DropdownMenuContent`
- L1181: `/DropdownMenu`
- L1183: `Share2 className="h-4 w-4 mr-1" `
- L1188: `/CardHeader`
- L1216: `/ReactMarkdown`
- L1219: `/CardContent`
- L1220: `/Card`
- L1232: `/CardHeader`
- L1235: `/Label`
- L1239: `/Label`
- L1243: `/Label`
- L1248: `/Badge`
- L1253: `Separator `
- L1256: `/Label`
- L1262: `SelectValue `
- L1263: `/SelectTrigger`
- L1265: `/SelectItem`
- L1266: `/SelectItem`
- L1267: `/SelectItem`
- L1268: `/SelectContent`
- L1269: `/Select`
- L1272: `Separator `
- L1275: `/Label`
- L1299: `/CardContent`
- L1300: `/Card`

### docs/reference/v9-code-quality-audit-report-20260629.md（4 条）
- L282: ` 0.5/0.5-1.0`
- L285: ` -10`
- L288: `= 3`
- L298: `= 70`

### docs/reference/v9-数据血缘追踪.md（43 条）
- L50: `br`
- L51: `br`
- L52: `br`
- L53: `br`
- L60: `br`
- L61: `br`
- L62: `br`
- L68: `br`
- L69: `br`
- L70: `br`
- L71: `br`
- L72: `br`
- L82: `br`
- L83: `br`
- L89: `br`
- L90: `br`
- L91: `br`
- L98: `br`
- L99: `br`
- L100: `br`
- L109: `br`
- L110: `br`
- L111: `br`
- L112: `br`
- L399: `br`
- L399: `br`
- L399: `br`
- L404: `br`
- L437: `br`
- L437: `br`
- L437: `br`
- L479: `br`
- L479: `br`
- L615: `br`
- L615: `br`
- L615: `br`
- L615: `br`
- L615: `br`
- L680: `br`
- L681: `br`
- L685: `br`
- L686: `br`
- L687: `br`

### docs/reference/walkthrough-scoredoc-report.md（1 条）
- L86: `file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/tests/__tests__/integration/walkthroughTest.sampled.test.ts`

### docs/reference/widget-development-guide.md（14 条）
- L144: `/CardTitle`
- L144: `/CardHeader`
- L147: `/CardContent`
- L148: `/Card`
- L162: `/CardTitle`
- L162: `/CardHeader`
- L165: `/CardContent`
- L166: `/Card`
- L364: `Gem className="h-4 w-4" `
- L366: `/CardTitle`
- L367: `/CardHeader`
- L374: `/CardContent`
- L375: `/Card`
- L452: `/WidgetErrorBoundary`

### docs/reference/widget-error-handling.md（9 条）
- L53: `/ErrorBoundary`
- L75: `AlertTriangle className="h-4 w-4" `
- L77: `/CardTitle`
- L78: `/CardHeader`
- L89: `RefreshCw className="mr-2 h-3 w-3" `
- L92: `/CardContent`
- L93: `/Card`
- L111: `/WidgetErrorBoundary`
- L114: `/GridLayout`

### docs/reference/踩坑规则门禁指南.md（3 条）
- L282: `.husky/pre-commit`
- L283: `.husky/_/pre-commit`
- L486: `.husky/pre-commit`

### docs/reports/audit/2026-07-09-collection-plan-panel-v6-audit.md（3 条）
- L57: `5000/ɫ`
- L180: `70%/ɫ`
- L242: `/Badge`

### docs/reports/audit/code-quality-audit-report.md（3 条）
- L336: `computer://hardcode_analysis_final_report.json`
- L337: `computer://c:\Users\Huawei\Documents\kimi\Workspaces\ͶиϵͳV9\code_quality_report.json`
- L338: `computer://c:\Users\Huawei\Documents\kimi\Workspaces\ͶиϵͳV9\typescript_analysis_results.json`

### docs/reports/audit/color-remediation-summary-report-20260703.md（8 条）
- L129: `../../src/apps/input/prototype/mockData.ts`
- L143: `../../tests/mockData.colors.test.ts`
- L201: `BacktestPage `
- L215: `BacktestPage `
- L252: `/defs`
- L253: `path d="M 0 50 L 1 47.5 L 2 45 L 3 46" fill="none" stroke="`
- L254: `path d="..." fill="url(`
- L255: `line x1="0" y1="50" x2="3" y2="50" stroke="`

### docs/reports/audit/debug-output-cabin-not-rendering.md（19 条）
- L54: `OutputHubPage `
- L69: `route.component `
- L71: `NotFoundPage `
- L72: `/Routes`
- L75: `Route path="/output"`
- L75: `PortalShell`
- L75: `OutputApp`
- L78: `OutputHubPage `
- L79: `OutputHubPage `
- L81: `/Routes`
- L118: `DataExportPanel `
- L120: `ResearchReportPage `
- L122: `TradeReviewPage `
- L125: `OutputHubPage `
- L131: `/React.Suspense`
- L149: `BulkImportPanel `
- L151: `HotSectorPanel `
- L153: `DataTestPanel `
- L155: `InputDashboard `

### docs/reports/audit/mcp-integration-test-report-2026-07-08-v2.md（1 条）
- L307: `./test-logs/integration-rerun-2026-07-08.txt`

### docs/reports/audit/test-failure-analysis-report.md（1 条）
- L161: `/MarketDataProvider`

### docs/reports/audit/v9-code-quality-kanban-20260629.md（2 条）
- L59: ` 0.5/0.5-1.0`
- L62: ` -5`

### docs/reports/changelogs/2026-07-09-update-log.md（2 条）
- L32: `v9-homepage-2026-07-09.png`
- L40: `v9-analysis-cabin-2026-07-09.png`

### docs/reports/changelogs/pr-8-dedup-audit-report.md（1 条）
- L608: `../../reports/audit/audit-split-quality-optimized.json`

### docs/reports/doc-sync/latest-summary.md（69 条）
- L26201: `../00-meta/governance.md`
- L26208: `../00-meta/governance.md`
- L26215: `../00-meta/governance.md`
- L26222: `../00-meta/governance.md`
- L26229: `../00-meta/governance.md`
- L26236: `../00-meta/governance.md`
- L26243: `../00-meta/governance.md`
- L26250: `../00-meta/governance.md`
- L26257: `../00-meta/governance.md`
- L26264: `../00-meta/governance.md`
- L26271: `../00-meta/governance.md`
- L26278: `../00-meta/governance.md`
- L26285: `../00-meta/governance.md`
- L26292: `../00-meta/governance.md`
- L26299: `../00-meta/governance.md`
- L26306: `../00-meta/governance.md`
- L26313: `../00-meta/governance.md`
- L26320: `../00-meta/governance.md`
- L26327: `../00-meta/governance.md`
- L26334: `../00-meta/governance.md`
- L26341: `../00-meta/governance.md`
- L26348: `../00-meta/governance.md`
- L26355: `../00-meta/governance.md`
- L26362: `../00-meta/governance.md`
- L26369: `../00-meta/governance.md`
- L26376: `../00-meta/governance.md`
- L26383: `../00-meta/governance.md`
- L26390: `../00-meta/governance.md`
- L26397: `../00-meta/governance.md`
- L26404: `../00-meta/governance.md`
- L26411: `../00-meta/governance.md`
- L26418: `../00-meta/governance.md`
- L26425: `../00-meta/governance.md`
- L26432: `../00-meta/governance.md`
- L26439: `../00-meta/governance.md`
- L26446: `../00-meta/governance.md`
- L26453: `../00-meta/governance.md`
- L26460: `../00-meta/governance.md`
- L26467: `../00-meta/governance.md`
- L26474: `../00-meta/governance.md`
- L26481: `../00-meta/governance.md`
- L26488: `../00-meta/governance.md`
- L26495: `../00-meta/governance.md`
- L26502: `../00-meta/governance.md`
- L26509: `../00-meta/governance.md`
- L26516: `../00-meta/governance.md`
- L26523: `../00-meta/governance.md`
- L26530: `../00-meta/governance.md`
- L26537: `../00-meta/governance.md`
- L26544: `../00-meta/governance.md`
- L26551: `../00-meta/governance.md`
- L26558: `../00-meta/governance.md`
- L26565: `../00-meta/governance.md`
- L26572: `../00-meta/governance.md`
- L26579: `../00-meta/governance.md`
- L26586: `../00-meta/governance.md`
- L26593: `../00-meta/governance.md`
- L26600: `../00-meta/governance.md`
- L26607: `../00-meta/governance.md`
- L26614: `../00-meta/governance.md`
- L26621: `../00-meta/governance.md`
- L26628: `../00-meta/governance.md`
- L26635: `../00-meta/governance.md`
- L26642: `../00-meta/governance.md`
- L26649: `../00-meta/governance.md`
- L26656: `../00-meta/governance.md`
- L26663: `../00-meta/governance.md`
- L26670: `../00-meta/governance.md`
- L26677: `../00-meta/governance.md`

### docs/reports/lessons-learned/token-optimization-best-practices.md（2 条）
- L1353: `../../reference/v9ݼܹ޶.md`
- L1354: `../../reference/v9ֵͶ(ϰ`

### docs/reports/retrospectives/2026-07-09-p0-p1-fix-code-plan.md（10 条）
- L84: `ExecutionPlanPanel `
- L85: `/Suspense`
- L120: `StrategySnapshotPage `
- L121: `/Suspense`
- L126: `HoldingsPage `
- L127: `/Suspense`
- L132: `ExecutionPlanPanel `
- L133: `/Suspense`
- L138: `ExecutionPlanPanel `
- L139: `/Suspense`

### docs/reports/retrospectives/2026-07-09-p1-gaps-fix-technical-review.md（3 条）
- L131: `PortfolioPage `
- L132: `RiskControlPage `
- L144: `DashboardPage `

### docs/reports/retrospectives/2026-07-09-remaining-p1-gaps-fix-plan.md（71 条）
- L65: `BreadcrumbLink to="/"`
- L65: `/BreadcrumbLink`
- L65: `/BreadcrumbItem`
- L66: `BreadcrumbLink to="/trading"`
- L66: `/BreadcrumbItem`
- L67: `/BreadcrumbPage`
- L67: `/BreadcrumbItem`
- L68: `/BreadcrumbList`
- L69: `/Breadcrumb`
- L75: `/CardTitle`
- L76: `/CardHeader`
- L100: `/CardContent`
- L101: `/Card`
- L103: `/ErrorBoundary`
- L149: `ExecutionPlanPanel `
- L150: `/Suspense`
- L155: `PortfolioPage `
- L156: `/Suspense`
- L217: `BreadcrumbLink to="/"`
- L217: `/BreadcrumbLink`
- L217: `/BreadcrumbItem`
- L218: `BreadcrumbLink to="/trading"`
- L218: `/BreadcrumbItem`
- L219: `/BreadcrumbPage`
- L219: `/BreadcrumbItem`
- L220: `/BreadcrumbList`
- L221: `/Breadcrumb`
- L228: `/CardTitle`
- L229: `/CardHeader`
- L236: `/Badge`
- L241: `/CardContent`
- L242: `/Card`
- L247: `/CardTitle`
- L248: `/CardHeader`
- L262: `/CardContent`
- L263: `/Card`
- L268: `/CardTitle`
- L272: `/CardHeader`
- L286: `/Badge`
- L291: `/CardContent`
- L292: `/Card`
- L294: `/ErrorBoundary`
- L339: `PortfolioPage `
- L340: `/Suspense`
- L345: `RiskControlPage `
- L346: `/Suspense`
- L390: `BreadcrumbLink to="/"`
- L390: `/BreadcrumbLink`
- L390: `/BreadcrumbItem`
- L391: `BreadcrumbLink to="/output"`
- L391: `/BreadcrumbItem`
- L392: `/BreadcrumbItem`
- L393: `/BreadcrumbList`
- L394: `/Breadcrumb`
- L400: `/CardTitle`
- L400: `/CardHeader`
- L405: `/CardContent`
- L406: `/Card`
- L408: `/CardTitle`
- L408: `/CardHeader`
- L409: `/CardContent`
- L410: `/Card`
- L412: `/CardTitle`
- L412: `/CardHeader`
- L413: `/CardContent`
- L414: `/Card`
- L417: `/ErrorBoundary`
- L450: `ResearchReportPage `
- L451: `/Suspense`
- L456: `DashboardPage `
- L457: `/Suspense`

### docs/reports/retrospectives/design-tokens-implementation-report.md（1 条）
- L173: `ThemeToggle `

### docs/reports/retrospectives/e2e-verify-25stocks-report.md（1 条）
- L23: `../../outputs/e2e-verify-25stocks.report.json`

### docs/reports/retrospectives/project-development-journey.md（4 条）
- L221: `file:///g:/FinSightV9/docs/reference/V9%E6%95%B0%E6%8D%AE%E5%AE%AA%E6%B3%95.md`
- L343: `file:///g:/FinSightV9/docs/reference/%E8%B8%A9%E5%9D%91%E8%A7%84%E5%88%99%E9%97%A8%E7%A6%81%E6%8C%87%E5%8D%97.md`
- L454: `file:///g:/FinSightV9/docs/explanation/adr`
- L910: `file:///g:/FinSightV9/docs/reference/V9%E6%95%B0%E6%8D%AE%E5%AE%AA%E6%B3%95.md`

### docs/reports/retrospectives/system-rectification-report-2026-07-12.md（1 条）
- L108: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/.husky/pre-commit`

### docs/reports/retrospectives/walkthrough-scoredoc-report.md（1 条）
- L86: `tests/__tests__/integration/walkthroughTest.sampled.test.ts`

### docs/reports/retrospectives/综合验证与定位分析报告-v2.0.0.md（1 条）
- L617: `../../explanation/v9-Ŀ깦嵥.md`

### docs/team-handbook/04-model-runtime.md（1 条）
- L45: `/Badge`

## 四、可能迁移/改名的链接（341 条）

> `basename` 仍存在，列出候选目标（basename_hits）。若唯一即可安全重写为该路径；若多值需人工消歧。

### AGENTS.md（5 条）
- L89: `docs/01-requirements/FILE-MANAGEMENT-GUIDE.md` → 建议重写为 `docs/how-to/FILE-MANAGEMENT-GUIDE.md`
- L1061: `../docs/03-development/templates/task-graph-template.md` → 歧义，候选：['docs/explanation/task-graph-template.md', 'docs/reference/templates/task-graph-template.md']
- L1062: `../docs/03-development/templates/regression-suite.md` → 歧义，候选：['docs/explanation/regression-suite.md', 'docs/reference/templates/regression-suite.md']
- L1105: `../../AGENTS.md` → 建议重写为 `AGENTS.md`
- L1105: `../00-meta/trae-file-management-review.md` → 歧义，候选：['docs/00-meta/trae-file-management-review.md', 'docs/archive/00-meta-historical/trae-file-management-review.md']

### README.md（1 条）
- L55: `docs/changelogs/2026-07/pr-5-build-optimization-summary.md` → 歧义，候选：['docs/reference/changelogs/2026-07/pr-5-build-optimization-summary.md', 'docs/reports/changelogs/pr-5-build-optimization-summary.md']

### docs/00-meta/V9-PRE-LAUNCH-AUDIT-REPORT-20260713.md（4 条）
- L41: `file:///d:/FinSightV9/archive/ARCHIVE_INDEX.md` → 建议重写为 `archive/ARCHIVE_INDEX.md`
- L87: `file:///d:/FinSightV9/src/types/role.types.ts` → 建议重写为 `src/types/role.types.ts`
- L88: `file:///d:/FinSightV9/src/lib/rolePermissionMapper.ts` → 建议重写为 `src/lib/rolePermissionMapper.ts`
- L89: `file:///d:/FinSightV9/tests/unit/rolePermissionMapper.test.ts` → 建议重写为 `tests/unit/rolePermissionMapper.test.ts`

### docs/00-meta/deprecated-docs/old-versions/registry-index-v1.0.0-02-design.md（47 条）
- L85: `../../../explanation/03-architecture-standards.md` → 建议重写为 `docs/reference/03-architecture-standards.md`
- L471: `../../../reports/2026-07-05-document-update-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-05-document-update-report.md', 'docs/reports/changelogs/2026-07-05-document-update-report.md']
- L472: `../../../reports/2026-07-08-document-update-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-08-document-update-report.md', 'docs/reports/changelogs/2026-07-08-document-update-report.md']
- L473: `../../../reports/2026-07-08-documentation-summary-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-08-documentation-summary-report.md', 'docs/reports/changelogs/2026-07-08-documentation-summary-report.md']
- L474: `../../../reports/2026-07-08-store-derived-documentation-analysis.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-08-store-derived-documentation-analysis.md', 'docs/reports/retrospectives/2026-07-08-store-derived-documentation-analysis.md']
- L475: `../../../reports/2026-07-08-undocumented-files-jsdoc-templates.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-08-undocumented-files-jsdoc-templates.md', 'docs/reports/audit/2026-07-08-undocumented-files-jsdoc-templates.md']
- L476: `../../../reports/2026-07-08-undocumented-files-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-08-undocumented-files-report.md', 'docs/reports/audit/2026-07-08-undocumented-files-report.md']
- L477: `../../../reports/2026-07-09-collection-plan-panel-v6-audit.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-collection-plan-panel-v6-audit.md', 'docs/reports/audit/2026-07-09-collection-plan-panel-v6-audit.md']
- L478: `../../../reports/2026-07-09-email-body.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-email-body.md', 'docs/reports/retrospectives/2026-07-09-email-body.md']
- L479: `../../../reports/2026-07-09-four-category-problem-analysis.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-four-category-problem-analysis.md', 'docs/reports/retrospectives/2026-07-09-four-category-problem-analysis.md']
- L480: `../../../reports/2026-07-09-jira-tasks.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-jira-tasks.md', 'docs/reports/retrospectives/2026-07-09-jira-tasks.md']
- L481: `../../../reports/2026-07-09-p0-p1-fix-code-plan.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-p0-p1-fix-code-plan.md', 'docs/reports/retrospectives/2026-07-09-p0-p1-fix-code-plan.md']
- L482: `../../../reports/2026-07-09-p0-todo-list.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-p0-todo-list.md', 'docs/reports/retrospectives/2026-07-09-p0-todo-list.md']
- L483: `../../../reports/2026-07-09-p1-fix-technical-summary.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-p1-fix-technical-summary.md', 'docs/reports/retrospectives/2026-07-09-p1-fix-technical-summary.md']
- L484: `../../../reports/2026-07-09-p1-gaps-fix-technical-review.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-p1-gaps-fix-technical-review.md', 'docs/reports/retrospectives/2026-07-09-p1-gaps-fix-technical-review.md']
- L485: `../../../reports/2026-07-09-remaining-p1-gaps-fix-plan.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-remaining-p1-gaps-fix-plan.md', 'docs/reports/retrospectives/2026-07-09-remaining-p1-gaps-fix-plan.md']
- L486: `../../../reports/2026-07-09-rm-audit-diff-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-rm-audit-diff-report.md', 'docs/reports/audit/2026-07-09-rm-audit-diff-report.md']
- L487: `../../../reports/2026-07-09-route-registration-gap-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-route-registration-gap-report.md', 'docs/reports/retrospectives/2026-07-09-route-registration-gap-report.md']
- L488: `../../../reports/2026-07-09-store-derived-documentation-analysis.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-store-derived-documentation-analysis.md', 'docs/reports/retrospectives/2026-07-09-store-derived-documentation-analysis.md']
- L489: `../../../reports/2026-07-09-technical-sharing-ppt-outline.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-technical-sharing-ppt-outline.md', 'docs/reports/retrospectives/2026-07-09-technical-sharing-ppt-outline.md']
- L490: `../../../reports/2026-07-09-undocumented-files-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-undocumented-files-report.md', 'docs/reports/audit/2026-07-09-undocumented-files-report.md']
- L491: `../../../reports/2026-07-09-update-log.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-update-log.md', 'docs/reports/changelogs/2026-07-09-update-log.md']
- L493: `../../../reports/audit-batch-c-analysis.md` → 建议重写为 `docs/reports/audit/audit-batch-c-analysis.md`
- L494: `../../../reports/audit-findings-2026-07-05.md` → 歧义，候选：['archive/docs/reports/reports/audit-findings-2026-07-05.md', 'docs/reports/audit/audit-findings-2026-07-05.md']
- L495: `../../../reports/audit-hardcode-warning-distribution.md` → 歧义，候选：['archive/docs/reports/reports/audit-hardcode-warning-distribution.md', 'docs/reports/audit/audit-hardcode-warning-distribution.md']
- L496: `../../../reports/batch-b-input-audit.md` → 建议重写为 `docs/reports/audit/batch-b-input-audit.md`
- L497: `../../../reports/changelog-2026-07-04t06-45-59.md` → 建议重写为 `docs/reports/changelogs/changelog-2026-07-04t06-45-59.md`
- L498: `../../../reports/code-quality-report-2026-07-06.md` → 歧义，候选：['archive/docs/reports/reports/code-quality-report-2026-07-06.md', 'docs/reports/audit/code-quality-report-2026-07-06.md']
- L499: `../../../reports/code-review-wip-2026-07-11.md` → 歧义，候选：['archive/docs/reports/reports/code-review-wip-2026-07-11.md', 'docs/reports/audit/code-review-wip-2026-07-11.md']
- L500: `../../../reports/design-tokens-implementation-report.md` → 歧义，候选：['archive/docs/reports/reports/design-tokens-implementation-report.md', 'docs/reports/retrospectives/design-tokens-implementation-report.md']
- L501: `../../../reports/full-audit-inventory-2026-07-05.md` → 歧义，候选：['archive/docs/reports/reports/full-audit-inventory-2026-07-05.md', 'docs/reports/audit/full-audit-inventory-2026-07-05.md']
- L502: `../../../reports/hardcode-warning-root-cause-analysis.md` → 歧义，候选：['archive/docs/reports/reports/hardcode-warning-root-cause-analysis.md', 'docs/reports/audit/hardcode-warning-root-cause-analysis.md']
- L503: `../../../reports/knowledge-graph-token-optimization-report.md` → 歧义，候选：['archive/docs/reports/reports/knowledge-graph-token-optimization-report.md', 'docs/reports/lessons-learned/knowledge-graph-token-optimization-report.md']
- L506: `../../../reports/mcp-acl-fix-plan-2026-07-08.md` → 歧义，候选：['archive/docs/reports/reports/mcp-acl-fix-plan-2026-07-08.md', 'docs/reports/retrospectives/mcp-acl-fix-plan-2026-07-08.md']
- L507: `../../../reports/mcp-architecture-audit-report-2026-07-08.md` → 歧义，候选：['archive/docs/reports/reports/mcp-architecture-audit-report-2026-07-08.md', 'docs/reports/audit/mcp-architecture-audit-report-2026-07-08.md']
- L508: `../../../reports/mcp-architecture-remediation-plan-2026-07-08.md` → 歧义，候选：['archive/docs/reports/reports/mcp-architecture-remediation-plan-2026-07-08.md', 'docs/reports/retrospectives/mcp-architecture-remediation-plan-2026-07-08.md']
- L509: `../../../reports/mcp-integration-test-report-2026-07-08-v2.md` → 歧义，候选：['archive/docs/reports/reports/mcp-integration-test-report-2026-07-08-v2.md', 'docs/reports/audit/mcp-integration-test-report-2026-07-08-v2.md']
- L510: `../../../reports/monthly-2026-07.md` → 歧义，候选：['archive/docs/reports/reports/monthly-2026-07.md', 'docs/reports/changelogs/monthly-2026-07.md']
- L511: `../../../reports/refactoring-plan-2026-07-04.md` → 歧义，候选：['archive/docs/reports/reports/refactoring-plan-2026-07-04.md', 'docs/reports/retrospectives/refactoring-plan-2026-07-04.md']
- L512: `../../../reports/t11-compliance-audit-report.md` → 建议重写为 `docs/reports/audit/t11-compliance-audit-report.md`
- L513: `../../../reports/test-artifacts-cleanup-list.md` → 歧义，候选：['archive/docs/reports/reports/test-artifacts-cleanup-list.md', 'docs/reports/retrospectives/test-artifacts-cleanup-list.md']
- L514: `../../../reports/test-coverage-comparison-v2.2.1.md` → 歧义，候选：['archive/docs/reports/reports/test-coverage-comparison-v2.2.1.md', 'docs/reports/audit/test-coverage-comparison-v2.2.1.md']
- L515: `../../../reports/test-failure-analysis-report.md` → 歧义，候选：['archive/docs/reports/reports/test-failure-analysis-report.md', 'docs/reports/audit/test-failure-analysis-report.md']
- L516: `../../../reports/token-consumption-analysis-2026-07-04.md` → 歧义，候选：['archive/docs/reports/reports/token-consumption-analysis-2026-07-04.md', 'docs/reports/lessons-learned/token-consumption-analysis-2026-07-04.md']
- L517: `../../../reports/token-optimization-best-practices.md` → 歧义，候选：['archive/docs/reports/reports/token-optimization-best-practices.md', 'docs/reports/lessons-learned/token-optimization-best-practices.md']
- L518: `../../../reports/type-error-diagnosis-report.md` → 歧义，候选：['archive/docs/reports/reports/type-error-diagnosis-report.md', 'docs/reports/audit/type-error-diagnosis-report.md']
- L519: `../../../reports/v2.2.1-test-coverage-comparison.md` → 歧义，候选：['archive/docs/reports/reports/v2.2.1-test-coverage-comparison.md', 'docs/reports/audit/v2.2.1-test-coverage-comparison.md']

### docs/00-meta/metadata-governance-phased-plan.md（1 条）
- L213: `../type-domain-audit-worksheet.md` → 建议重写为 `docs/00-meta/type-domain-audit-worksheet.md`

### docs/00-meta/p1-debt-cleanup-todo.md（1 条）
- L26: `../.trae/skills/architecture-debt-remediation/SKILL.md` → 歧义，候选：['.agents/skills/architecture-cleanup/SKILL.md', '.agents/skills/architecture-radar-scan/SKILL.md', '.agents/skills/constant-migration/SKILL.md']

### docs/00-meta/type-domain-audit-worksheet.md（67 条）
- L37: `explanation/design/ui-design-agent-execution-plan.md` → 歧义，候选：['docs/explanation/ui-design-agent-execution-plan.md', 'docs/explanation/design/ui-design-agent-execution-plan.md']
- L38: `explanation/ui-design-agent-execution-plan.md` → 歧义，候选：['docs/explanation/ui-design-agent-execution-plan.md', 'docs/explanation/design/ui-design-agent-execution-plan.md']
- L39: `how-to/mcp-acl-guide.md` → 建议重写为 `docs/how-to/mcp-acl-guide.md`
- L40: `00-meta/agent-app-docs-classification.md` → 建议重写为 `docs/00-meta/agent-app-docs-classification.md`
- L41: `00-meta/FILE-MANAGEMENT-GUIDE-optimization-prompt.md` → 歧义，候选：['docs/00-meta/FILE-MANAGEMENT-GUIDE-optimization-prompt.md', 'docs/archive/00-meta-historical/FILE-MANAGEMENT-GUIDE-optimization-prompt.md']
- L42: `reference/ai-memory-layer.md` → 歧义，候选：['docs/explanation/ai-memory-layer.md', 'docs/reference/ai-memory-layer.md']
- L43: `reference/ai-center-contract.md` → 建议重写为 `docs/reference/ai-center-contract.md`
- L44: `reports/audit/mcp-usage/mcp-usage-report-1784135579861.md` → 建议重写为 `docs/reports/audit/mcp-usage/mcp-usage-report-1784135579861.md`
- L45: `reports/retrospectives/mcp-zombie-server-audit-report.md` → 建议重写为 `docs/reports/retrospectives/mcp-zombie-server-audit-report.md`
- L51: `explanation/design/blueprints/README.md` → 歧义，候选：['README.md', 'archive/docs/07-archive/README.md', 'archive/docs/reports/reports/audit/README.md']
- L52: `explanation/adr-004-hashrouter-static-hosting.md` → 建议重写为 `docs/explanation/adr-004-hashrouter-static-hosting.md`
- L53: `00-meta/markdown-reorg-framework.md` → 建议重写为 `docs/00-meta/markdown-reorg-framework.md`
- L54: `00-meta/lessons-architecture-review-2026-07-16.md` → 歧义，候选：['docs/00-meta/lessons-architecture-review-2026-07-16.md', 'docs/archive/00-meta-historical/lessons-architecture-review-2026-07-16.md']
- L55: `reference/03-architecture-standards.md` → 建议重写为 `docs/reference/03-architecture-standards.md`
- L56: `reference/v9-architecture-data-dictionary-validation-report.md` → 歧义，候选：['docs/archive/reference-historical/v9-architecture-data-dictionary-validation-report.md', 'docs/reference/v9-architecture-data-dictionary-validation-report.md']
- L57: `reports/retrospectives/mcp-architecture-remediation-plan-2026-07-08.md` → 歧义，候选：['archive/docs/reports/reports/mcp-architecture-remediation-plan-2026-07-08.md', 'docs/reports/retrospectives/mcp-architecture-remediation-plan-2026-07-08.md']
- L58: `reports/retrospectives/complexity-optimization-plan.md` → 建议重写为 `docs/reports/retrospectives/complexity-optimization-plan.md`
- L64: `explanation/design/value-bargain-strategy.md` → 建议重写为 `docs/explanation/design/value-bargain-strategy.md`
- L65: `explanation/design/core-scarce-strategy.md` → 建议重写为 `docs/explanation/design/core-scarce-strategy.md`
- L66: `how-to/how-to-add-service.md` → 歧义，候选：['docs/guides/how-to-add-service.md', 'docs/how-to/how-to-add-service.md']
- L67: `guides/how-to-add-service.md` → 歧义，候选：['docs/guides/how-to-add-service.md', 'docs/how-to/how-to-add-service.md']
- L68: `reference/rotation-score-spec.md` → 建议重写为 `docs/reference/rotation-score-spec.md`
- L69: `reports/release-management/buildscoredocdiff-rollback-plan.md` → 歧义，候选：['docs/explanation/design/buildscoredocdiff-rollback-plan.md', 'docs/reports/release-management/buildscoredocdiff-rollback-plan.md']
- L70: `reports/retrospectives/walkthrough-scoredoc-report.md` → 歧义，候选：['docs/archive/reference-historical/walkthrough-scoredoc-report.md', 'docs/reference/walkthrough-scoredoc-report.md', 'docs/reports/retrospectives/walkthrough-scoredoc-report.md']
- L76: `explanation/data-layer-overview.md` → 歧义，候选：['docs/explanation/data-layer-overview.md', 'docs/modules/data-layer-overview.md']
- L77: `explanation/design/dataflow-data-definition.md` → 歧义，候选：['docs/explanation/dataflow-data-definition.md', 'docs/explanation/design/dataflow-data-definition.md', 'docs/reference/dataflow-data-definition.md']
- L78: `how-to/how-to-add-store.md` → 歧义，候选：['docs/guides/how-to-add-store.md', 'docs/how-to/how-to-add-store.md']
- L79: `00-meta/deprecated-docs/old-versions/data-definition-v1.0.0-cockpit.md` → 建议重写为 `docs/00-meta/deprecated-docs/old-versions/data-definition-v1.0.0-cockpit.md`
- L80: `00-meta/deprecated-docs/old-versions/data-dictionary-index-v1.6.0.md` → 建议重写为 `docs/00-meta/deprecated-docs/old-versions/data-dictionary-index-v1.6.0.md`
- L81: `reference/data-collection/data-definition.md` → 歧义，候选：['docs/explanation/design/data-definition.md', 'docs/reference/data-definition.md', 'docs/reference/cockpit/data-definition.md']
- L82: `modules/data-layer-overview.md` → 歧义，候选：['docs/explanation/data-layer-overview.md', 'docs/modules/data-layer-overview.md']
- L83: `reports/retrospectives/data-collection-task-list.md` → 歧义，候选：['docs/reference/data-collection-task-list.md', 'docs/reports/retrospectives/data-collection-task-list.md']
- L84: `reports/retrospectives/v9-data-blueprint-task-tracking.md` → 歧义，候选：['docs/explanation/design/v9-data-blueprint-task-tracking.md', 'docs/reports/retrospectives/v9-data-blueprint-task-tracking.md']
- L90: `explanation/kimi-webbridge.md` → 建议重写为 `docs/explanation/kimi-webbridge.md`
- L91: `explanation/design/widget-integration-checklist.md` → 歧义，候选：['docs/explanation/design/widget-integration-checklist.md', 'docs/reference/widget-integration-checklist.md']
- L92: `how-to/widget-development-guide.md` → 歧义，候选：['docs/how-to/widget-development-guide.md', 'docs/reference/widget-development-guide.md']
- L93: `how-to/how-to-add-widget.md` → 歧义，候选：['docs/guides/how-to-add-widget.md', 'docs/how-to/how-to-add-widget.md']
- L94: `reference/chart-integration.md` → 建议重写为 `docs/reference/chart-integration.md`
- L95: `reference/ui-remediation-tracker.md` → 歧义，候选：['docs/archive/reference-historical/ui-remediation-tracker.md', 'docs/reference/ui-remediation-tracker.md']
- L96: `reports/retrospectives/design-tokens-implementation-report.md` → 歧义，候选：['archive/docs/reports/reports/design-tokens-implementation-report.md', 'docs/reports/retrospectives/design-tokens-implementation-report.md']
- L97: `reports/retrospectives/2026-07-09-route-registration-gap-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-route-registration-gap-report.md', 'docs/reports/retrospectives/2026-07-09-route-registration-gap-report.md']
- L103: `explanation/production-release-checklist-SKILL.md` → 建议重写为 `docs/explanation/production-release-checklist-SKILL.md`
- L104: `explanation/01-vision-and-goals.md` → 歧义，候选：['docs/explanation/01-vision-and-goals.md', 'docs/reference/01-vision-and-goals.md']
- L105: `reference/autonomous-workflow-user-guide.md` → 歧义，候选：['docs/prompts/autonomous-workflow-user-guide.md', 'docs/reference/autonomous-workflow-user-guide.md']
- L106: `team-handbook/05-competitive-analysis.md` → 建议重写为 `docs/team-handbook/05-competitive-analysis.md`
- L112: `explanation/completeness-profile-batch2.md` → 歧义，候选：['docs/explanation/completeness-profile-batch2.md', 'docs/how-to/testing/completeness-profile-batch2.md']
- L113: `explanation/README.md` → 歧义，候选：['README.md', 'archive/docs/07-archive/README.md', 'archive/docs/reports/reports/audit/README.md']
- L114: `how-to/README.md` → 歧义，候选：['README.md', 'archive/docs/07-archive/README.md', 'archive/docs/reports/reports/audit/README.md']
- L115: `how-to/hooks-guide.md` → 建议重写为 `docs/how-to/hooks-guide.md`
- L116: `00-meta/deprecated-docs/old-versions/deployment-v1.0.0.md` → 建议重写为 `docs/00-meta/deprecated-docs/old-versions/deployment-v1.0.0.md`
- L117: `00-meta/23-core-docs-final-verification-report.md` → 歧义，候选：['docs/00-meta/23-core-docs-final-verification-report.md', 'docs/archive/00-meta-historical/23-core-docs-final-verification-report.md']
- L118: `reference/changelogs/2026-07/pr-8-dedup-plan.md` → 歧义，候选：['docs/reference/changelogs/2026-07/pr-8-dedup-plan.md', 'docs/reports/changelogs/pr-8-dedup-plan.md']
- L119: `reference/trade-contract.md` → 建议重写为 `docs/reference/trade-contract.md`
- L120: `reports/retrospectives/2026-07-09-technical-sharing-ppt-outline.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-09-technical-sharing-ppt-outline.md', 'docs/reports/retrospectives/2026-07-09-technical-sharing-ppt-outline.md']
- L121: `reports/changelogs/2026-07-08-documentation-summary-report.md` → 歧义，候选：['archive/docs/reports/reports/2026-07-08-documentation-summary-report.md', 'docs/reports/changelogs/2026-07-08-documentation-summary-report.md']
- L122: `tutorials/getting-started.md` → 歧义，候选：['docs/guides/getting-started.md', 'docs/tutorials/getting-started.md']
- L123: `tutorials/README.md` → 歧义，候选：['README.md', 'archive/docs/07-archive/README.md', 'archive/docs/reports/reports/audit/README.md']
- L129: `explanation/design/v9-code-quality-kanban-20260629.md` → 歧义，候选：['docs/explanation/design/v9-code-quality-kanban-20260629.md', 'docs/reports/audit/v9-code-quality-kanban-20260629.md']
- L130: `explanation/design/automation-test-evaluation.md` → 建议重写为 `docs/explanation/design/automation-test-evaluation.md`
- L131: `how-to/visual-regression-guide.md` → 建议重写为 `docs/how-to/visual-regression-guide.md`
- L132: `how-to/testing/complexity-remediation-plan.md` → 歧义，候选：['docs/explanation/complexity-remediation-plan.md', 'docs/how-to/testing/complexity-remediation-plan.md']
- L133: `00-meta/directory-audit-report-v1.4.3.md` → 歧义，候选：['docs/00-meta/directory-audit-report-v1.4.3.md', 'docs/archive/00-meta-historical/directory-audit-report-v1.4.3.md']
- L134: `00-meta/directory-structure-audit-report.md` → 歧义，候选：['docs/00-meta/directory-structure-audit-report.md', 'docs/archive/00-meta-historical/directory-structure-audit-report.md']
- L135: `reference/changelogs/2026-07/test-cache-fix-summary.md` → 建议重写为 `docs/reference/changelogs/2026-07/test-cache-fix-summary.md`
- L136: `04-testing/security-test-plan.md` → 建议重写为 `docs/04-testing/security-test-plan.md`
- L137: `reports/audit/audit-warning-report.md` → 歧义，候选：['archive/docs/reports/reports/audit/audit-warning-report.md', 'docs/reports/audit/audit-warning-report.md']
- L138: `reports/retrospectives/e2e-verify-redundancy-report.md` → 建议重写为 `docs/reports/retrospectives/e2e-verify-redundancy-report.md`

### docs/archive/00-meta-historical/FILE-MANAGEMENT-GUIDE-RCA-report.md（1 条）
- L197: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`

### docs/archive/00-meta-historical/FILE-MANAGEMENT-GUIDE-file-wandering-report.md（1 条）
- L11: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`

### docs/archive/00-meta-historical/FILE-MANAGEMENT-GUIDE-optimization-prompt.md（1 条）
- L35: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`

### docs/archive/00-meta-historical/FILE-MANAGEMENT-GUIDE-task-list.md（2 条）
- L139: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`
- L140: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`

### docs/archive/00-meta-historical/V9-PRE-LAUNCH-AUDIT-REPORT-20260713.md（4 条）
- L31: `file:///d:/FinSightV9/archive/ARCHIVE_INDEX.md` → 建议重写为 `archive/ARCHIVE_INDEX.md`
- L79: `file:///d:/FinSightV9/src/types/role.types.ts` → 建议重写为 `src/types/role.types.ts`
- L80: `file:///d:/FinSightV9/src/lib/rolePermissionMapper.ts` → 建议重写为 `src/lib/rolePermissionMapper.ts`
- L81: `file:///d:/FinSightV9/tests/unit/rolePermissionMapper.test.ts` → 建议重写为 `tests/unit/rolePermissionMapper.test.ts`

### docs/archive/reference-historical/data-collection-route-ui-audit.md（10 条）
- L77: `../../src/pages/input/SevenDimConfigPage.tsx` → 建议重写为 `src/pages/input/SevenDimConfigPage.tsx`
- L78: `../../src/pages/input/LocalKnowledgePage.tsx` → 建议重写为 `src/pages/input/LocalKnowledgePage.tsx`
- L79: `../../src/apps/input/InputDashboard.tsx` → 建议重写为 `src/apps/input/InputDashboard.tsx`
- L80: `../../src/apps/input/DataTestPanel.tsx` → 建议重写为 `src/apps/input/DataTestPanel.tsx`
- L81: `../../src/apps/input/HotSectorPanel.tsx` → 建议重写为 `src/apps/input/HotSectorPanel.tsx`
- L82: `../../src/apps/input/BulkImportPanel.tsx` → 建议重写为 `src/apps/input/BulkImportPanel.tsx`
- L83: `../../src/components/organisms/input/StockSearch.tsx` → 建议重写为 `src/components/organisms/input/StockSearch.tsx`
- L232: `file:////src/config/routes.ts` → 建议重写为 `src/config/routes.ts`
- L233: `../../src/apps/output/OutputApp.tsx` → 建议重写为 `src/apps/output/OutputApp.tsx`
- L234: `../../../reference/06-routing-specs.md` → 歧义，候选：['docs/explanation/design/06-routing-specs.md', 'docs/reference/06-routing-specs.md']

### docs/archive/reference-historical/databridge-split-plan.md（4 条）
- L21: `../../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L31: `../../src/core/databridgeHandlers.ts` → 建议重写为 `src/core/databridgeHandlers.ts`
- L32: `../../src/core/databridgeStrategyRouter.ts` → 建议重写为 `src/core/databridgeStrategyRouter.ts`
- L60: `../../src/core/databridgeStrategyRouter.ts` → 建议重写为 `src/core/databridgeStrategyRouter.ts`

### docs/archive/reference-historical/v9-code-quality-audit-report-20260629.md（2 条）
- L673: `../../../reference/completeness-profile.md` → 歧义，候选：['docs/explanation/completeness-profile.md', 'docs/reference/completeness-profile.md']
- L675: `../audit/dynamic_analysis_report.json` → 歧义，候选：['docs/04-testing/audit-reports/audit/dynamic_analysis_report.json', 'docs/how-to/testing/audit-reports/audit/dynamic_analysis_report.json', 'scripts/reports/dynamic_analysis_report.json']

### docs/archive/reference-historical/walkthrough-scoredoc-report.md（13 条）
- L12: `../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts` → 建议重写为 `tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts`
- L233: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L428: `../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` → 建议重写为 `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx`
- L428: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/services/analysis/__tests__/scoreDocService.test.ts` → 歧义，候选：['src/services/analysis/__tests__/scoreDocService.test.ts', 'tests/scoreDocService.test.ts']
- L432: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L558: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L559: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L647: `../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts` → 建议重写为 `tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts`
- L648: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L649: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/services/scoring/v6-engine/config.ts` → 建议重写为 `src/services/scoring/v6-engine/config.ts`
- L650: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/data/types.ts` → 歧义，候选：['src/data/types.ts', 'src/lib/store-audit/types.ts', 'src/mcp/core/types.ts']
- L651: `../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` → 建议重写为 `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx`
- L652: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/services/analysis/__tests__/scoreDocService.test.ts` → 歧义，候选：['src/services/analysis/__tests__/scoreDocService.test.ts', 'tests/scoreDocService.test.ts']

### docs/explanation/design/buildscoredocdiff-rollback-plan.md（4 条）
- L36: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L384: `../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` → 建议重写为 `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx`
- L385: `file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/services/analysis/__tests__/scoreDocService.test.ts` → 歧义，候选：['src/services/analysis/__tests__/scoreDocService.test.ts', 'tests/scoreDocService.test.ts']
- L386: `../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts` → 建议重写为 `tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts`

### docs/explanation/design/data-collection-route-ui-audit.md（9 条）
- L90: `../../src/pages/input/SevenDimConfigPage.tsx` → 建议重写为 `src/pages/input/SevenDimConfigPage.tsx`
- L91: `../../src/pages/input/LocalKnowledgePage.tsx` → 建议重写为 `src/pages/input/LocalKnowledgePage.tsx`
- L92: `../../src/apps/input/InputDashboard.tsx` → 建议重写为 `src/apps/input/InputDashboard.tsx`
- L93: `../../src/apps/input/DataTestPanel.tsx` → 建议重写为 `src/apps/input/DataTestPanel.tsx`
- L94: `../../src/apps/input/HotSectorPanel.tsx` → 建议重写为 `src/apps/input/HotSectorPanel.tsx`
- L95: `../../src/apps/input/BulkImportPanel.tsx` → 建议重写为 `src/apps/input/BulkImportPanel.tsx`
- L96: `../../src/components/organisms/input/StockSearch.tsx` → 建议重写为 `src/components/organisms/input/StockSearch.tsx`
- L245: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/config/routes.ts` → 建议重写为 `src/config/routes.ts`
- L246: `../../src/apps/output/OutputApp.tsx` → 建议重写为 `src/apps/output/OutputApp.tsx`

### docs/explanation/design/databridge改进建议整改报告.md（18 条）
- L40: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`
- L42: `../src/core/databridgeHandlers.ts` → 建议重写为 `src/core/databridgeHandlers.ts`
- L45: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L47: `../src/core/databridgeHandlers.ts` → 建议重写为 `src/core/databridgeHandlers.ts`
- L54: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L55: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L57: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L68: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L69: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L71: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L79: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L80: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L81: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L84: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L165: `../src/core/pipelineScheduler.ts` → 建议重写为 `src/core/pipelineScheduler.ts`
- L166: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L167: `../src/core/databridgeHandlers.ts` → 建议重写为 `src/core/databridgeHandlers.ts`
- L168: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`

### docs/explanation/design/databridge数据链路全景分析报告.md（17 条）
- L30: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L31: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L32: `../src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L33: `../src/core/fallbackQueue.ts` → 建议重写为 `src/core/fallbackQueue.ts`
- L139: `../src/core/databridgeHandlers.ts` → 建议重写为 `src/core/databridgeHandlers.ts`
- L150: `../src/core/databridgeHandlers.ts` → 建议重写为 `src/core/databridgeHandlers.ts`
- L231: `../src/services/scoring/v6ScoreService.ts` → 建议重写为 `src/services/scoring/v6ScoreService.ts`
- L295: `../src/services/scoring/hotSectorDimensions.ts` → 建议重写为 `src/services/scoring/hotSectorDimensions.ts`
- L313: `../src/services/scoring/valuePitAnalyzer.ts` → 建议重写为 `src/services/scoring/valuePitAnalyzer.ts`
- L333: `../src/services/scoring/rotationSignalDetector.ts` → 建议重写为 `src/services/scoring/rotationSignalDetector.ts`
- L431: `../src/services/trading/signalGenerator.ts` → 建议重写为 `src/services/trading/signalGenerator.ts`
- L448: `../src/services/trading/positionSizer.ts` → 建议重写为 `src/services/trading/positionSizer.ts`
- L457: `../src/services/trading/riskEngine.ts` → 建议重写为 `src/services/trading/riskEngine.ts`
- L469: `../src/services/analysis/screeningEngine.ts` → 建议重写为 `src/services/analysis/screeningEngine.ts`
- L476: `../src/services/trading/tradingService.ts` → 建议重写为 `src/services/trading/tradingService.ts`
- L567: `../src/core/pipelineScheduler.ts` → 建议重写为 `src/core/pipelineScheduler.ts`
- L1007: `../src/core/pipelineScheduler.ts` → 建议重写为 `src/core/pipelineScheduler.ts`

### docs/explanation/design/踩坑规则门禁指南.md（7 条）
- L243: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/package.json` → 歧义，候选：['package.json', 'packages/audit-utils/package.json', 'tools/file-management-system/scripts/package.json']
- L268: `../.github/workflows/quality-check.yml` → 建议重写为 `.github/workflows/quality-check.yml`
- L416: `../scripts/pitfall_check.py` → 建议重写为 `scripts/monitor/pitfall_check.py`
- L418: `../.github/workflows/quality-check.yml` → 建议重写为 `.github/workflows/quality-check.yml`
- L419: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/python/data_service/lib/timeout_utils.py` → 建议重写为 `python/data_service/lib/timeout_utils.py`
- L420: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/python/data_service/lib/cache_utils.py` → 建议重写为 `python/data_service/lib/cache_utils.py`
- L421: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/python/data_service/lib/dynamic_match.py` → 建议重写为 `python/data_service/lib/dynamic_match.py`

### docs/explanation/v9-code-quality-audit-report-20260629.md（1 条）
- L683: `../audit/dynamic_analysis_report.json` → 歧义，候选：['docs/04-testing/audit-reports/audit/dynamic_analysis_report.json', 'docs/how-to/testing/audit-reports/audit/dynamic_analysis_report.json', 'scripts/reports/dynamic_analysis_report.json']

### docs/reference/V9数据宪法.md（21 条）
- L192: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`
- L192: `../src/core/envelope.ts` → 建议重写为 `src/core/envelope.ts`
- L212: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`
- L235: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`
- L250: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`
- L281: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`
- L308: `../src/config/dualStrategyRules.ts` → 建议重写为 `src/config/dualStrategyRules.ts`
- L359: `../src/services/scoring/rotationSignalDetector.ts` → 建议重写为 `src/services/scoring/rotationSignalDetector.ts`
- L450: `../src/types/modules/tradeReview.types.ts` → 建议重写为 `src/types/modules/tradeReview.types.ts`
- L451: `../src/services/trading/tradeErrorClassifier.ts` → 建议重写为 `src/services/trading/tradeErrorClassifier.ts`
- L472: `../src/services/trading/tradeReviewAI.ts` → 建议重写为 `src/services/trading/tradeReviewAI.ts`
- L488: `../src/types/modules/ai-center.types.ts` → 建议重写为 `src/types/modules/ai-center.types.ts`
- L489: `../src/constants/ai-center.constants.ts` → 建议重写为 `src/constants/ai-center.constants.ts`
- L511: `../src/types/modules/ai-center.types.ts` → 建议重写为 `src/types/modules/ai-center.types.ts`
- L512: `../src/constants/health.constants.ts` → 建议重写为 `src/constants/health.constants.ts`
- L640: `../src/core/memoryCache.ts` → 建议重写为 `src/core/memoryCache.ts`
- L767: `../src/config/dbConfig.ts` → 建议重写为 `src/config/dbConfig.ts`
- L772: `../src/types/modules/ai-center.types.ts` → 建议重写为 `src/types/modules/ai-center.types.ts`
- L773: `../src/types/modules/tradeReview.types.ts` → 建议重写为 `src/types/modules/tradeReview.types.ts`
- L775: `../src/core/dataflow/dataflowTypes.ts` → 建议重写为 `src/core/dataflow/dataflowTypes.ts`
- L776: `../src/core/memoryCache.ts` → 建议重写为 `src/core/memoryCache.ts`

### docs/reference/changelogs/2026-07/jsdoc-combined-report-20260712.md（3 条）
- L54: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/collectors/BaseCollector.ts` → 建议重写为 `src/services/data-collector/collectors/BaseCollector.ts`
- L55: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/collectors/WebSocketCollector.ts` → 建议重写为 `src/services/data-collector/collectors/WebSocketCollector.ts`
- L56: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/TaskScheduler.ts` → 建议重写为 `src/services/data-collector/TaskScheduler.ts`

### docs/reference/changelogs/2026-07/jsdoc-update-summary-data-collector-20260712.md（3 条）
- L47: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/collectors/BaseCollector.ts` → 建议重写为 `src/services/data-collector/collectors/BaseCollector.ts`
- L48: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/collectors/WebSocketCollector.ts` → 建议重写为 `src/services/data-collector/collectors/WebSocketCollector.ts`
- L49: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/src/services/data-collector/TaskScheduler.ts` → 建议重写为 `src/services/data-collector/TaskScheduler.ts`

### docs/reference/changelogs/2026-07/pr-5-build-optimization-summary.md（4 条）
- L32: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/vite.config.ts` → 建议重写为 `vite.config.ts`
- L45: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/vite.config.ts` → 建议重写为 `vite.config.ts`
- L74: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/vite.config.ts` → 建议重写为 `vite.config.ts`
- L75: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/.gitignore` → 歧义，候选：['.gitignore', 'archive/docs/reports/reports/.gitignore']

### docs/reference/changelogs/2026-07/pr-8-dedup-audit-report.md（1 条）
- L607: `../../../scripts/audit-split-quality.ts` → 建议重写为 `scripts/audit/audit-split-quality.ts`

### docs/reference/data-collection-route-ui-audit.md（1 条）
- L245: `file:////src/config/routes.ts` → 建议重写为 `src/config/routes.ts`

### docs/reference/v9-code-quality-audit-report-20260629.md（1 条）
- L683: `../audit/dynamic_analysis_report.json` → 歧义，候选：['docs/04-testing/audit-reports/audit/dynamic_analysis_report.json', 'docs/how-to/testing/audit-reports/audit/dynamic_analysis_report.json', 'scripts/reports/dynamic_analysis_report.json']

### docs/reference/walkthrough-scoredoc-report.md（4 条）
- L441: `file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/services/analysis/__tests__/scoreDocService.test.ts` → 歧义，候选：['src/services/analysis/__tests__/scoreDocService.test.ts', 'tests/scoreDocService.test.ts']
- L662: `file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/services/scoring/v6-engine/config.ts` → 建议重写为 `src/services/scoring/v6-engine/config.ts`
- L663: `file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/data/types.ts` → 歧义，候选：['src/data/types.ts', 'src/lib/store-audit/types.ts', 'src/mcp/core/types.ts']
- L665: `file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/services/analysis/__tests__/scoreDocService.test.ts` → 歧义，候选：['src/services/analysis/__tests__/scoreDocService.test.ts', 'tests/scoreDocService.test.ts']

### docs/reference/踩坑规则门禁指南.md（3 条）
- L313: `../.github/workflows/quality-check.yml` → 建议重写为 `.github/workflows/quality-check.yml`
- L485: `../scripts/pitfall_check.py` → 建议重写为 `scripts/monitor/pitfall_check.py`
- L487: `../.github/workflows/quality-check.yml` → 建议重写为 `.github/workflows/quality-check.yml`

### docs/reports/audit/color-remediation-summary-report-20260703.md（6 条）
- L90: `../../src/cockpit/widgets/FundFlowWidget.tsx` → 建议重写为 `src/cockpit/widgets/FundFlowWidget.tsx`
- L100: `../../src/cockpit/widgets/SignalMonitorWidget.tsx` → 建议重写为 `src/cockpit/widgets/SignalMonitorWidget.tsx`
- L110: `../../src/cockpit/widgets/MarketSentimentWidget.tsx` → 建议重写为 `src/cockpit/widgets/MarketSentimentWidget.tsx`
- L118: `../../src/pages/analysis/BacktestPage.tsx` → 建议重写为 `src/pages/analysis/BacktestPage.tsx`
- L151: `../../tests/color-remediation.widgets.test.tsx` → 建议重写为 `tests/color-remediation.widgets.test.tsx`
- L158: `../../tests/BacktestPage.colors.test.tsx` → 建议重写为 `tests/BacktestPage.colors.test.tsx`

### docs/reports/audit/mcp-architecture-audit-report-2026-07-08.md（10 条）
- L46: `../../src/mcp/core/client.ts` → 建议重写为 `src/mcp/core/client.ts`
- L46: `../../src/mcp/bridge/mcpBridge.ts` → 建议重写为 `src/mcp/bridge/mcpBridge.ts`
- L53: `file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/mcp/core/server.ts` → 建议重写为 `src/mcp/core/server.ts`
- L60: `../../src/mcp/servers/scoring/v6ScoringServer.ts` → 建议重写为 `src/mcp/servers/scoring/v6ScoringServer.ts`
- L76: `../../src/apps/input/InputDashboard.tsx` → 建议重写为 `src/apps/input/InputDashboard.tsx`
- L78: `../../src/mcp/core/transport.ts` → 建议重写为 `src/mcp/core/transport.ts`
- L79: `../../src/mcp/bridge/mcpBridge.ts` → 建议重写为 `src/mcp/bridge/mcpBridge.ts`
- L82: `../../src/components/organisms/system/migration/useMcpMigration.ts` → 建议重写为 `src/components/organisms/system/migration/useMcpMigration.ts`
- L89: `../../src/types/modules/mcp.types.ts` → 建议重写为 `src/types/modules/mcp.types.ts`
- L90: `../../src/types/modules/mcp.types.ts` → 建议重写为 `src/types/modules/mcp.types.ts`

### docs/reports/audit/mcp-integration-test-report-2026-07-08-v2.md（3 条）
- L57: `../../src/services/fetcher/fetcherClient.ts` → 建议重写为 `src/services/fetcher/fetcherClient.ts`
- L85: `../../src/data/db.ts` → 建议重写为 `src/data/db.ts`
- L86: `../../src/data/db-migrations.ts` → 建议重写为 `src/data/db-migrations.ts`

### docs/reports/audit/test-failure-analysis-report.md（3 条）
- L263: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`
- L264: `../../../reference/CHANGELOG.md` → 歧义，候选：['CHANGELOG.md', 'docs/reference/CHANGELOG.md', 'docs/reports/changelogs/CHANGELOG.md']
- L265: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/CHANGELOG.md` → 歧义，候选：['CHANGELOG.md', 'docs/reference/CHANGELOG.md', 'docs/reports/changelogs/CHANGELOG.md']

### docs/reports/audit/test-report-2026-07-12.md（4 条）
- L44: `file:///C:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/tests/__tests__/scripts/color-tokens-audit-suite.test.ts` → 建议重写为 `tests/__tests__/scripts/color-tokens-audit-suite.test.ts`
- L60: `file:///C:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/tests/__tests__/scripts/audit-hardcode.test.ts` → 建议重写为 `tests/__tests__/scripts/audit-hardcode.test.ts`
- L72: `file:///C:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/tests/__tests__/scripts/audit-layer-calls.test.ts` → 建议重写为 `tests/__tests__/scripts/audit-layer-calls.test.ts`
- L85: `file:///C:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/tests/__tests__/scripts/verify-all-routes.test.ts` → 建议重写为 `tests/__tests__/scripts/verify-all-routes.test.ts`

### docs/reports/changelogs/pr-5-build-optimization-summary.md（1 条）
- L75: `.gitignore` → 歧义，候选：['.gitignore', 'archive/docs/reports/reports/.gitignore']

### docs/reports/changelogs/pr-8-dedup-audit-report.md（1 条）
- L607: `../../../scripts/audit-split-quality.ts` → 建议重写为 `scripts/audit/audit-split-quality.ts`

### docs/reports/lessons-learned/token-optimization-best-practices.md（1 条）
- L1355: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`

### docs/reports/release-management/buildscoredocdiff-rollback-plan.md（3 条）
- L36: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L384: `../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` → 建议重写为 `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx`
- L386: `../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts` → 建议重写为 `tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts`

### docs/reports/retrospectives/2026-07-09-p1-fix-technical-summary.md（3 条）
- L109: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/playwright.config.ts` → 歧义，候选：['playwright.config.ts', 'e2e/full-coverage/playwright.config.ts']
- L120: `../../src/portal/PortalShell.tsx` → 建议重写为 `src/portal/PortalShell.tsx`
- L184: `../../tests/__tests__/regression/p1-fix-regression.test.ts` → 建议重写为 `tests/__tests__/regression/p1-fix-regression.test.ts`

### docs/reports/retrospectives/2026-07-09-p1-gaps-fix-technical-review.md（4 条）
- L58: `file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/config/routes.ts` → 建议重写为 `src/config/routes.ts`
- L59: `../../src/apps/trading/TradingApp.tsx` → 建议重写为 `src/apps/trading/TradingApp.tsx`
- L60: `../../src/apps/output/OutputApp.tsx` → 建议重写为 `src/apps/output/OutputApp.tsx`
- L61: `../../tests/__tests__/regression/p1-fix-regression.test.ts` → 建议重写为 `tests/__tests__/regression/p1-fix-regression.test.ts`

### docs/reports/retrospectives/design-tokens-implementation-report.md（1 条）
- L406: `../../../../AGENTS.md` → 建议重写为 `AGENTS.md`

### docs/reports/retrospectives/e2e-verify-25stocks-report.md（1 条）
- L23: `../../tests/e2e-verify-25stocks.integration.test.ts` → 建议重写为 `tests/e2e-verify-25stocks.integration.test.ts`

### docs/reports/retrospectives/project-development-journey.md（2 条）
- L158: `file:///g:/FinSightV9/docs/explanation/design/v6pro-to-v9-migration-analysis.md` → 歧义，候选：['docs/archive/reference-historical/v6pro-to-v9-migration-analysis.md', 'docs/explanation/v6pro-to-v9-migration-analysis.md', 'docs/reference/v6pro-to-v9-migration-analysis.md']
- L342: `file:///g:/FinSightV9/docs/reports/audit/v9-code-quality-audit-report-20260629.md` → 歧义，候选：['docs/archive/reference-historical/v9-code-quality-audit-report-20260629.md', 'docs/explanation/v9-code-quality-audit-report-20260629.md', 'docs/reference/v9-code-quality-audit-report-20260629.md']

### docs/reports/retrospectives/system-rectification-final-report.md（23 条）
- L43: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/file-management-system/scripts/auto-register-scripts.js` → 建议重写为 `tools/file-management-system/scripts/auto-register-scripts.js`
- L68: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/scripts/patch-error-handling-dynamic.ts` → 建议重写为 `scripts/other/patch-error-handling-dynamic.ts`
- L72: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/lib/safeCoerce.ts` → 建议重写为 `src/lib/safeCoerce.ts`
- L102: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L120: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/widgets/WidgetShell.tsx` → 建议重写为 `src/components/widgets/WidgetShell.tsx`
- L180: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/lib/safeCoerce.ts` → 建议重写为 `src/lib/safeCoerce.ts`
- L183: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/cockpit/widgets/components/WidgetStateShell.tsx` → 建议重写为 `src/cockpit/widgets/components/WidgetStateShell.tsx`
- L184: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/cockpit/widgets/HotSectorWidget.tsx` → 建议重写为 `src/cockpit/widgets/HotSectorWidget.tsx`
- L185: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/molecules/ErrorState.tsx` → 建议重写为 `src/components/molecules/ErrorState.tsx`
- L186: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/organisms/analysis/news/NewsSentimentTrend.tsx` → 建议重写为 `src/components/organisms/analysis/news/NewsSentimentTrend.tsx`
- L187: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/organisms/input/wizard-steps/ExecutionMonitorStep.tsx` → 歧义，候选：['archive/unused-components/wizard-steps/ExecutionMonitorStep.tsx', 'src/components/organisms/input/wizard-steps/ExecutionMonitorStep.tsx']
- L188: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/organisms/localDoc/LocalDocCard.tsx` → 建议重写为 `src/components/organisms/localDoc/LocalDocCard.tsx`
- L189: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/organisms/output/ReviewWizard.tsx` → 建议重写为 `src/components/organisms/output/ReviewWizard.tsx`
- L190: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/organisms/system/EngineStatusCard.tsx` → 建议重写为 `src/components/organisms/system/EngineStatusCard.tsx`
- L191: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/components/widgets/WidgetShell.tsx` → 建议重写为 `src/components/widgets/WidgetShell.tsx`
- L192: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/config/llmConfig.ts` → 建议重写为 `src/config/llmConfig.ts`
- L193: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/core/databridge.ts` → 建议重写为 `src/core/databridge.ts`
- L194: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/core/dataflow/dataflowEngine.ts` → 建议重写为 `src/core/dataflow/dataflowEngine.ts`
- L195: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/pages/analysis/HotSectorPage.tsx` → 建议重写为 `src/pages/analysis/HotSectorPage.tsx`
- L196: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/pages/command/health/HealthDashboardPage.tsx` → 建议重写为 `src/pages/command/health/HealthDashboardPage.tsx`
- L197: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/pages/trading/components/TradeModal.tsx` → 建议重写为 `src/pages/trading/components/TradeModal.tsx`
- L198: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/store/marketDataStore.ts` → 建议重写为 `src/store/marketDataStore.ts`
- L201: `file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/package.json` → 歧义，候选：['package.json', 'packages/audit-utils/package.json', 'tools/file-management-system/scripts/package.json']

### docs/reports/retrospectives/system-rectification-report-2026-07-12.md（5 条）
- L52: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/file-management-system/scripts/batch-migrate-docs.js` → 建议重写为 `tools/file-management-system/scripts/batch-migrate-docs.js`
- L56: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/file-management-system/scripts/batch-migrate-docs.js` → 建议重写为 `tools/file-management-system/scripts/batch-migrate-docs.js`
- L61: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/file-management-system/scripts/batch-migrate-docs.js` → 建议重写为 `tools/file-management-system/scripts/batch-migrate-docs.js`
- L75: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/file-management-system/scripts/fix-broken-links.js` → 建议重写为 `tools/file-management-system/scripts/fix-broken-links.js`
- L80: `file:///C:/Users/huawei/Documents/kimi/Workspaces/%E6%99%BA%E8%83%BD%E6%8A%95%E7%A0%94%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9FV9/file-management-system/scripts/fix-broken-links.js` → 建议重写为 `tools/file-management-system/scripts/fix-broken-links.js`

### docs/reports/retrospectives/walkthrough-scoredoc-report.md（9 条）
- L25: `../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts` → 建议重写为 `tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts`
- L246: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L441: `../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` → 建议重写为 `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx`
- L445: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L571: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L572: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L660: `../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts` → 建议重写为 `tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts`
- L661: `../../src/services/analysis/scoreDocService.ts` → 建议重写为 `src/services/analysis/scoreDocService.ts`
- L664: `../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` → 建议重写为 `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx`

## 五、代码侧（A 类）整改结果

- 双轨/畸形嵌套路径已修复：`audit-split-quality.ts:863`、`doc-cross-ref-sync.ts:249`、
  `update-registry-index.py:5,47`、`generate-tech-debt-report.ts:51`（共 5 处路径去重）。
- 其余 A 类失效硬编码（11 处）此前已由定向脚本 `fix_code_paths.py` 修复。
- `audit-doc-sync` 门禁复验：扫描 820 文件 / 807 文档，仅 2 处真实违规，
  根因正则 `ROOT` 误报问题已闭环，门禁不再对全量 src 误红。

