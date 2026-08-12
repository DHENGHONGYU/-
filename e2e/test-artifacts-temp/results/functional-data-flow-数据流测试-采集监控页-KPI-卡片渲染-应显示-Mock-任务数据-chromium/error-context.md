# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\data-flow.spec.ts >> 数据流测试 >> 采集监控页 KPI 卡片渲染 >> 应显示 Mock 任务数据
- Location: functional\data-flow.spec.ts:148:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=TASK-20260701-001')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=TASK-20260701-001')

```

```yaml
- banner:
  - link "V9 智能投研复盘系统":
    - /url: "#/"
  - navigation:
    - button "📦输入舱"
    - button "🔬分析舱"
    - button "💹交易舱"
    - button "📊输出舱"
    - button "🎛️总控舱"
    - button "驾驶舱":
      - img
      - text: 驾驶舱
  - 'button "当前主题模式: 跟随系统，点击切换"':
    - img
    - text: system
  - text: 采集正常 信号强 00:00:10 v1.2.0
- complementary:
  - text: 📦 输入舱 意向候选池
  - list:
    - listitem:
      - button "录入看板":
        - img
        - text: 录入看板
    - listitem:
      - button "股票池看板（已迁分析舱）":
        - img
        - text: 股票池看板（已迁分析舱）
    - listitem:
      - button "批量导入":
        - img
        - text: 批量导入
    - listitem:
      - button "热门板块":
        - img
        - text: 热门板块
    - listitem:
      - button "本地知识库":
        - img
        - text: 本地知识库
  - text: 数据采集
  - list:
    - listitem:
      - button "采集测试":
        - img
        - text: 采集测试
    - listitem:
      - button "采集任务监控":
        - img
        - text: 采集任务监控
    - listitem:
      - button "七维采集配置":
        - img
        - text: 七维采集配置
    - listitem:
      - button "抓取引擎配置":
        - img
        - text: 抓取引擎配置
- main:
  - heading "输入舱" [level=1]
  - paragraph: 股票录入 · 批量导入 · 热门板块 · 采集测试
  - main:
    - navigation "breadcrumb":
      - list:
        - listitem:
          - link "首页":
            - /url: "#/"
        - listitem:
          - link "输入舱":
            - /url: "#/input"
        - listitem:
          - link "采集任务监控" [disabled]
    - heading "采集任务监控" [level=1]
    - paragraph: 任务列表 · 维度健康度 · 采集日志 · 链路可视化
    - text: D-1 框架
    - paragraph: 任务总数
    - paragraph: "0"
    - paragraph: 采集中
    - paragraph: "0"
    - paragraph: 已完成
    - paragraph: "0"
    - paragraph: 失败
    - paragraph: "0"
    - paragraph: 采集成功率
    - paragraph: 0%
    - paragraph: 平均延迟
    - paragraph: 0ms
    - paragraph: 降级次数
    - paragraph: "0"
    - paragraph: 写入成功率
    - paragraph: 0%
    - paragraph: 数据新鲜度
    - paragraph: 暂无
    - paragraph: 采集成功率
    - paragraph: 0%
    - tab "进度汇报" [selected]:
      - img
      - text: 进度汇报
    - tab "任务列表":
      - img
      - text: 任务列表
    - tab "评分分析":
      - img
      - text: 评分分析
    - tab "维度健康":
      - img
      - text: 维度健康
    - tab "采集日志":
      - img
      - text: 采集日志
    - tab "时间线":
      - img
      - text: 时间线
    - tab "泳道图":
      - img
      - text: 泳道图
    - tab "回放":
      - img
      - text: 回放
    - tab "数据质量":
      - img
      - text: 数据质量
    - tabpanel: "总体进度 0.0% 基本信息（01） 01 未就绪 成功 0 / 失败 0 / 总计 0 0.0% K线数据（02） 02 未就绪 成功 0 / 失败 0 / 总计 0 0.0% 筹码分布（03） 03 未就绪 成功 0 / 失败 0 / 总计 0 0.0% 重大事项（04） 04 未就绪 成功 0 / 失败 0 / 总计 0 0.0% 热点新闻（05） 05 未就绪 成功 0 / 失败 0 / 总计 0 0.0% 行业竞品（06） 06 未就绪 成功 0 / 失败 0 / 总计 0 0.0% 关联指数（07） 07 未就绪 成功 0 / 失败 0 / 总计 0 0.0% 研报中心（08） 08 未就绪 成功 0 / 失败 0 / 总计 0 0.0% 基本信息（01） 01 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: — K线数据（02） 02 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: — 筹码分布（03） 03 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: — 重大事项（04） 04 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: — 热点新闻（05） 05 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: — 行业竞品（06） 06 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: — 关联指数（07） 07 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: — 研报中心（08） 08 0.0% 已采集 0 / 0 无失败 开始: — 完成: — 最近采集: —"
```

# Test source

```ts
  50  |     test('重复添加同一股票应有反馈', async ({ page }) => {
  51  |       // 第一次添加
  52  |       await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
  53  |       await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
  54  |       await page.getByRole('button', { name: '仅录入' }).click()
  55  |       await expect(page.locator('text=已添加 000001')).toBeVisible({ timeout: 5000 })
  56  | 
  57  |       // 第二次添加（重复）
  58  |       await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
  59  |       await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
  60  |       await page.getByRole('button', { name: '仅录入' }).click()
  61  | 
  62  |       // 应有反馈信息
  63  |       await expect(page.locator('text=已添加')).toBeVisible({ timeout: 5000 })
  64  |     })
  65  |   })
  66  | 
  67  |   // ============================================================
  68  |   // 首页状态卡片显示
  69  |   // ============================================================
  70  |   test.describe('首页状态卡片显示', () => {
  71  |     test('首页应显示数据统计区域', async ({ page }) => {
  72  |       await navigateTo(page, ROUTES.home)
  73  |       await waitForAppReady(page)
  74  | 
  75  |       // 首页应展示系统数据统计卡片
  76  |       // 可能的统计维度：股票池计数、信号数、评分、持仓等
  77  |       await expect(page.locator('#root')).toBeAttached()
  78  | 
  79  |       // 检查是否有统计类文本（如 stocks、orders、scores）
  80  |       const hasStats = await page.getByText(/stock|order|score|信号|持仓|评分/i).first().count()
  81  |       // 首页应至少展示一个统计类卡片
  82  |       expect(hasStats).toBeGreaterThanOrEqual(0)
  83  |     })
  84  | 
  85  |     test('导入股票后首页状态应更新', async ({ page }) => {
  86  |       // 先在输入舱导入一只股票
  87  |       await navigateTo(page, ROUTES.input)
  88  |       await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  89  | 
  90  |       await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
  91  |       await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
  92  |       await page.getByRole('button', { name: '仅录入' }).click()
  93  |       await expect(page.locator('text=已添加 000001')).toBeVisible({ timeout: 5000 })
  94  | 
  95  |       // 回到首页
  96  |       await navigateTo(page, ROUTES.home)
  97  |       await waitForAppReady(page)
  98  | 
  99  |       // 首页应正常渲染
  100 |       await expect(page.locator('#root')).toBeAttached()
  101 |       // 首页可能有更新后的统计显示
  102 |     })
  103 | 
  104 |     test('首页应显示核心功能入口卡片', async ({ page }) => {
  105 |       await navigateTo(page, ROUTES.home)
  106 |       await waitForAppReady(page)
  107 | 
  108 |       // 首页应有核心入口（如驾驶舱、输入舱入口按钮）
  109 |       const hasEntrance = await page.locator('button:has-text("驾驶舱"), button:has-text("输入舱"), a:has-text("驾驶舱"), a:has-text("输入舱")').first().count()
  110 |       expect(hasEntrance).toBeGreaterThanOrEqual(0)
  111 |     })
  112 |   })
  113 | 
  114 |   // ============================================================
  115 |   // 采集监控页 KPI 卡片渲染
  116 |   // ============================================================
  117 |   test.describe('采集监控页 KPI 卡片渲染', () => {
  118 |     test.beforeEach(async ({ page }) => {
  119 |       await navigateTo(page, ROUTES.inputCollectTasks)
  120 |       await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
  121 |     })
  122 | 
  123 |     test('应显示四个 KPI 统计卡片', async ({ page }) => {
  124 |       // 任务总数卡片
  125 |       await expect(page.getByText('任务总数')).toBeVisible()
  126 |       // 采集中卡片（使用 .first() 解决 strict mode）
  127 |       await expect(page.getByText('采集中').first()).toBeVisible()
  128 |       // 已完成卡片
  129 |       await expect(page.getByText('已完成').first()).toBeVisible()
  130 |       // 失败卡片
  131 |       await expect(page.getByText('失败').first()).toBeVisible()
  132 |     })
  133 | 
  134 |     test('KPI 卡片数值应为数字格式', async ({ page }) => {
  135 |       // 查找卡片中的数值（格式应为数字）
  136 |       const taskTotal = page.locator('text=任务总数').locator('..')
  137 |       await expect(taskTotal).toBeVisible()
  138 |     })
  139 | 
  140 |     test('应显示任务列表表格', async ({ page }) => {
  141 |       await expect(page.locator('table')).toBeVisible()
  142 |       await expect(page.getByRole('columnheader', { name: '任务ID' })).toBeVisible()
  143 |       await expect(page.getByRole('columnheader', { name: '维度' })).toBeVisible()
  144 |       await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
  145 |       await expect(page.getByRole('columnheader', { name: '进度' })).toBeVisible()
  146 |     })
  147 | 
  148 |     test('应显示 Mock 任务数据', async ({ page }) => {
  149 |       // 验证预置任务数据渲染
> 150 |       await expect(page.locator('text=TASK-20260701-001')).toBeVisible()
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  151 |       await expect(page.locator('text=TASK-20260701-002')).toBeVisible()
  152 |     })
  153 | 
  154 |     test('Tab 切换应正常工作', async ({ page }) => {
  155 |       // 切换到评分卡片 Tab
  156 |       await page.getByRole('tab', { name: '评分卡片' }).click()
  157 |       await expect(page.locator('text=评分卡片')).toBeVisible()
  158 |       // 切换到采集日志 Tab
  159 |       await page.getByRole('tab', { name: '采集日志' }).click()
  160 |       await expect(page.getByRole('tab', { name: '采集日志', selected: true })).toBeVisible()
  161 |       // 切回任务列表
  162 |       await page.getByRole('tab', { name: '任务列表' }).click()
  163 |       await expect(page.locator('table')).toBeVisible()
  164 |     })
  165 |   })
  166 | 
  167 |   // ============================================================
  168 |   // 跨舱室数据一致性
  169 |   // ============================================================
  170 |   test.describe('跨舱室数据一致性', () => {
  171 |     test.beforeEach(async ({ page }) => {
  172 |       // 输入舱录入股票
  173 |       await navigateTo(page, ROUTES.input)
  174 |       await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  175 | 
  176 |       // 录入一只股票
  177 |       await page.getByRole('textbox', { name: '股票代码' }).fill(SAMPLE_STOCKS[0]!.code)
  178 |       await page.getByRole('textbox', { name: '股票名称' }).fill(SAMPLE_STOCKS[0]!.name)
  179 |       await page.getByRole('button', { name: '仅录入' }).click()
  180 |       await expect(page.locator(`text=已添加 ${SAMPLE_STOCKS[0]!.code}`)).toBeVisible({ timeout: 5000 })
  181 |     })
  182 | 
  183 |     test('输入舱导入股票后分析舱应可查看', async ({ page }) => {
  184 |       // 导航到分析舱
  185 |       await navigateTo(page, ROUTES.analysis)
  186 |       await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
  187 | 
  188 |       // 验证加载标的按钮存在
  189 |       await expect(page.getByRole('button', { name: '加载标的' })).toBeVisible()
  190 |     })
  191 | 
  192 |     test('输入舱导入股票后交易舱应可加载观察池', async ({ page }) => {
  193 |       // 导航到交易舱
  194 |       await navigateTo(page, ROUTES.trading)
  195 |       await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible({ timeout: 10000 })
  196 | 
  197 |       // 加载观察池按钮应可交互
  198 |       await expect(page.getByRole('button', { name: '加载观察池' })).toBeVisible()
  199 |     })
  200 | 
  201 |     test('输入舱导入股票后总控舱应展示更新后的统计', async ({ page }) => {
  202 |       // 导航到总控舱
  203 |       await navigateTo(page, ROUTES.command)
  204 |       await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })
  205 | 
  206 |       // 总控舱应展示全局统计信息
  207 |       await expect(page.getByRole('heading', { name: '总控舱 · 系统监控' })).toBeVisible()
  208 |       // 统计卡片应可见
  209 |       await expect(page.getByText('stocks', { exact: true })).toBeVisible()
  210 |     })
  211 |   })
  212 | })
  213 | 
```