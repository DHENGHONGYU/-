# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\data-flow.spec.ts >> 数据流测试 >> 采集监控页 KPI 卡片渲染 >> 任务列表应正常渲染（无任务时显示空状态或表格）
- Location: functional\data-flow.spec.ts:148:5

# Error details

```
Error: expect(locator).toBeAttached() failed

Locator: locator('table').first()
Expected: attached
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeAttached" with timeout 10000ms
  - waiting for locator('table').first()

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
  - text: 采集正常 信号强 00:00:11 v1.2.0
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
    - tab "进度汇报":
      - img
      - text: 进度汇报
    - tab "任务列表" [selected]:
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
    - tabpanel:
      - heading "采集任务列表" [level=3]
      - paragraph: 来自 collectionRuntimeStore 的实时任务状态
      - img
      - heading "暂无采集任务" [level=3]
      - paragraph: 尚未发起任何采集任务，请前往数据测试面板执行
      - button "前往数据测试"
```

# Test source

```ts
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
  88  |       await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
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
  148 |     test('任务列表应正常渲染（无任务时显示空状态或表格）', async ({ page }) => {
  149 |       // 验证任务列表区域正常渲染
  150 |       await expect(page.getByRole('tab', { name: '任务列表' })).toBeVisible()
  151 |       await page.getByRole('tab', { name: '任务列表' }).click()
  152 |       // 表格或空状态应有渲染
> 153 |       await expect(page.locator('table').first()).toBeAttached()
      |                                                   ^ Error: expect(locator).toBeAttached() failed
  154 |     })
  155 | 
  156 |     test('Tab 切换应正常工作', async ({ page }) => {
  157 |       // 切换到评分分析 Tab
  158 |       await page.getByRole('tab', { name: '评分分析' }).click()
  159 |       await expect(page.getByRole('tab', { name: '评分分析', selected: true })).toBeVisible()
  160 |       // 切换到采集日志 Tab
  161 |       await page.getByRole('tab', { name: '采集日志' }).click()
  162 |       await expect(page.getByRole('tab', { name: '采集日志', selected: true })).toBeVisible()
  163 |       // 切回任务列表
  164 |       await page.getByRole('tab', { name: '任务列表' }).click()
  165 |       await expect(page.locator('table')).toBeVisible()
  166 |     })
  167 |   })
  168 | 
  169 |   // ============================================================
  170 |   // 跨舱室数据一致性
  171 |   // ============================================================
  172 |   test.describe('跨舱室数据一致性', () => {
  173 |     test.beforeEach(async ({ page }) => {
  174 |       // 输入舱录入股票
  175 |       await navigateTo(page, ROUTES.input)
  176 |       await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  177 | 
  178 |       // 录入一只股票
  179 |       await page.getByRole('textbox', { name: '股票代码' }).fill(SAMPLE_STOCKS[0]!.code)
  180 |       await page.getByRole('textbox', { name: '股票名称' }).fill(SAMPLE_STOCKS[0]!.name)
  181 |       await page.getByRole('button', { name: '仅录入' }).click()
  182 |       await expect(page.locator(`text=已添加 ${SAMPLE_STOCKS[0]!.code}`)).toBeVisible({ timeout: 5000 })
  183 |     })
  184 | 
  185 |     test('输入舱导入股票后分析舱应可查看', async ({ page }) => {
  186 |       // 导航到分析舱
  187 |       await navigateTo(page, ROUTES.analysis)
  188 |       await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
  189 | 
  190 |       // 验证加载标的按钮存在
  191 |       await expect(page.getByRole('button', { name: '加载标的' })).toBeVisible()
  192 |     })
  193 | 
  194 |     test('输入舱导入股票后交易舱应可加载观察池', async ({ page }) => {
  195 |       // 导航到交易舱
  196 |       await navigateTo(page, ROUTES.trading)
  197 |       await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible({ timeout: 10000 })
  198 | 
  199 |       // 加载观察池按钮应可交互
  200 |       await expect(page.getByRole('button', { name: '加载观察池' })).toBeVisible()
  201 |     })
  202 | 
  203 |     test('输入舱导入股票后总控舱应展示更新后的统计', async ({ page }) => {
  204 |       // 导航到总控舱
  205 |       await navigateTo(page, ROUTES.command)
  206 |       await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })
  207 | 
  208 |       // 总控舱应展示全局统计信息
  209 |       await expect(page.getByRole('heading', { name: '总控舱 · 系统监控' })).toBeVisible()
  210 |       // 统计卡片应可见
  211 |       await expect(page.getByText('stocks', { exact: true })).toBeVisible()
  212 |     })
  213 |   })
  214 | })
  215 | 
```