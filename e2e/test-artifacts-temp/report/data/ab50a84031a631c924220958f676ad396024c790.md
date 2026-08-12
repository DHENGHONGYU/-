# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\buttons.spec.ts >> 按钮交互测试 >> 采集完成后"继续导入"和"前往采集配置"按钮 >> 采集任务监控页应显示任务列表和操作按钮
- Location: functional\buttons.spec.ts:142:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: '刷新' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('button', { name: '刷新' })

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
  46  | 
  47  |     test('点击"进入输入舱"按钮应跳转到输入舱', async ({ page }) => {
  48  |       await page.getByRole('button', { name: '进入输入舱' }).click()
  49  |       await page.waitForLoadState('networkidle')
  50  |       await page.waitForTimeout(1000)
  51  |       expect(page.url()).toContain('/input')
  52  |       await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  53  |     })
  54  |   })
  55  | 
  56  |   // ============================================================
  57  |   // "重置为默认"按钮
  58  |   // ============================================================
  59  |   test.describe('"重置为默认"按钮', () => {
  60  |     test.beforeEach(async ({ page }) => {
  61  |       await navigateTo(page, ROUTES.inputSevenDim)
  62  |       await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  63  |     })
  64  | 
  65  |     test('"重置为默认"按钮应存在且可见', async ({ page }) => {
  66  |       await expect(page.getByRole('button', { name: '重置为默认' })).toBeVisible()
  67  |     })
  68  | 
  69  |     test('点击"重置为默认"按钮后配置应恢复默认状态', async ({ page }) => {
  70  |       // 先切换到价值投资模板改变配置
  71  |       await page.getByRole('heading', { name: '价值投资' }).click()
  72  |       await page.getByRole('button', { name: '重置为默认' }).click()
  73  |       // 重置后页面应保持正常渲染，维度区和全局参数区保持可见
  74  |       await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  75  |       await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
  76  |       // 策略模板区域应仍可见
  77  |       await expect(page.getByRole('heading', { name: '策略模板' })).toBeVisible()
  78  |     })
  79  |   })
  80  | 
  81  |   // ============================================================
  82  |   // "保存配置"按钮状态
  83  |   // ============================================================
  84  |   test.describe('"保存配置"按钮 disabled/enabled 状态', () => {
  85  |     test.beforeEach(async ({ page }) => {
  86  |       await navigateTo(page, ROUTES.inputSevenDim)
  87  |       await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  88  |     })
  89  | 
  90  |     test('"开始采集"按钮应可点击（配置已就绪）', async ({ page }) => {
  91  |       // 七维页面有"开始采集"按钮，验证其存在且可交互
  92  |       const startBtn = page.getByRole('button', { name: '开始采集' })
  93  |       await expect(startBtn).toBeVisible()
  94  |       await expect(startBtn).toBeEnabled()
  95  |     })
  96  | 
  97  |     test('"开始采集"按钮点击后应有响应', async ({ page }) => {
  98  |       await page.getByRole('button', { name: '开始采集' }).click()
  99  |       // 点击后应有 loading 或进度提示
  100 |       await page.waitForTimeout(2000)
  101 |       // 页面不崩溃即为通过
  102 |       await expect(page.locator('#root')).toBeAttached()
  103 |     })
  104 | 
  105 |     test('重置后"开始采集"按钮仍应可用', async ({ page }) => {
  106 |       await page.getByRole('heading', { name: '价值投资' }).click()
  107 |       await page.getByRole('button', { name: '重置为默认' }).click()
  108 |       await expect(page.getByRole('button', { name: '开始采集' })).toBeEnabled()
  109 |     })
  110 |   })
  111 | 
  112 |   // ============================================================
  113 |   // 主题切换按钮
  114 |   // ============================================================
  115 |   test.describe('主题切换按钮', () => {
  116 |     test.beforeEach(async ({ page }) => {
  117 |       await navigateTo(page, ROUTES.home)
  118 |       await waitForAppReady(page)
  119 |     })
  120 | 
  121 |     test('主题切换控件应存在', async ({ page }) => {
  122 |       // 查找主题切换相关控件：可能是 button/combobox 包含主题/暗色/亮色相关文本
  123 |       const themeControl = page.locator('button').filter({ hasText: /主题|theme|dark|light|暗色|亮色/i }).first()
  124 |       const exists = await themeControl.count()
  125 |       // 至少根元素存在（主题控件可能在导航栏或设置中）
  126 |       await expect(page.locator('#root')).toBeAttached()
  127 |     })
  128 | 
  129 |     test('页面在默认主题下应正常渲染', async ({ page }) => {
  130 |       // 验证页面颜色相关样式已加载
  131 |       const html = page.locator('html')
  132 |       const className = await html.getAttribute('class')
  133 |       // 主题样式可能通过 class 或 data 属性控制
  134 |       expect(className !== null).toBe(true)
  135 |     })
  136 |   })
  137 | 
  138 |   // ============================================================
  139 |   // 采集完成后按钮
  140 |   // ============================================================
  141 |   test.describe('采集完成后"继续导入"和"前往采集配置"按钮', () => {
  142 |     test('采集任务监控页应显示任务列表和操作按钮', async ({ page }) => {
  143 |       await navigateTo(page, ROUTES.inputCollectTasks)
  144 |       await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
  145 |       // 应该存在操作按钮
> 146 |       await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
      |                                                              ^ Error: expect(locator).toBeVisible() failed
  147 |     })
  148 | 
  149 |     test('采集测试页应包含开始批量采集按钮', async ({ page }) => {
  150 |       await navigateTo(page, ROUTES.inputDataTest)
  151 |       await expect(page.getByRole('heading', { name: '数据采集测试' })).toBeVisible({ timeout: 10000 })
  152 |       await expect(page.getByRole('button', { name: '开始批量采集测试' })).toBeVisible()
  153 |     })
  154 | 
  155 |     test('采集测试页空输入时批量采集按钮应禁用', async ({ page }) => {
  156 |       await navigateTo(page, ROUTES.inputDataTest)
  157 |       await expect(page.getByRole('heading', { name: '数据采集测试' })).toBeVisible({ timeout: 10000 })
  158 |       const batchBtn = page.getByRole('button', { name: '开始批量采集测试' })
  159 |       // 空输入时按钮应禁用
  160 |       await expect(batchBtn).toBeDisabled()
  161 |     })
  162 | 
  163 |     test('输入测试代码后批量采集按钮应启用', async ({ page }) => {
  164 |       await navigateTo(page, ROUTES.inputDataTest)
  165 |       await expect(page.getByRole('heading', { name: '数据采集测试' })).toBeVisible({ timeout: 10000 })
  166 |       const batchBtn = page.getByRole('button', { name: '开始批量采集测试' })
  167 |       // 填入代码
  168 |       await page.getByPlaceholder(/每行一个股票代码/).fill('600519,贵州茅台')
  169 |       // 按钮应启用
  170 |       await expect(batchBtn).toBeEnabled()
  171 |     })
  172 |   })
  173 | })
  174 | 
```