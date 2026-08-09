# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: input-stock-pool.spec.ts >> 股票池管理功能测试 >> 单只股票添加功能 >> 应成功添加单只股票到默认分组
- Location: e2e\input-stock-pool.spec.ts:68:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=永福股份').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=永福股份').first()

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
  - text: 采集断连 信号弱 00:00:05 v1.2.0
- complementary:
  - text: 📦 输入舱 意向候选池
  - list:
    - listitem:
      - button "录入看板":
        - img
        - text: 录入看板
    - listitem:
      - button "研究候选池":
        - img
        - text: 研究候选池
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
  - paragraph: 意向候选池标的
  - paragraph: "4"
  - text: ↑ 0% 覆盖
  - paragraph: 已采行情
  - paragraph: "0"
  - text: ↓ 4 待采
  - img: "0"
  - paragraph: 采集服务
  - text: 检查中...
  - paragraph: 快捷操作
  - button "批量导入"
  - button "热门板块"
  - button "数据测试"
  - button "采集任务"
  - heading "录入候选股票" [level=3]
  - text: 搜索模式：
  - button "填充代码/名称"
  - button "直接录入意向候选池"
  - combobox "搜索代码 / 名称"
  - textbox "股票代码":
    - /placeholder: 股票代码，如 600519.SH
  - textbox "股票名称"
  - combobox "目标分组":
    - option "默认分组" [selected]
  - img
  - button "仅录入"
  - button "录入并拉基础"
  - button "录入并拉全部"
  - text: 采集服务状态： 检查中...
  - button "检查中..." [disabled]
  - paragraph: 已添加 300712
  - heading "意向候选池" [level=3]
  - text: 0/4 已采
  - button "采集全部"
  - checkbox "全选"
  - text: 已选 0 / 共 4 项
  - button "批量删除" [disabled]
  - table:
    - rowgroup:
      - row "选择 代码 名称 板块 三级分类 最新价 总市值 状态 操作":
        - columnheader "选择"
        - columnheader "代码"
        - columnheader "名称"
        - columnheader "板块"
        - columnheader "三级分类"
        - columnheader "最新价"
        - columnheader "总市值"
        - columnheader "状态"
        - columnheader "操作"
    - rowgroup:
      - row "选择 000001.SZ 000001.SZ 平安银行 深市 - 待采集 待采集 待采 采集 删除":
        - cell "选择 000001.SZ":
          - checkbox "选择 000001.SZ"
        - cell "000001.SZ"
        - cell "平安银行"
        - cell "深市"
        - cell "-"
        - cell "待采集"
        - cell "待采集"
        - cell "待采"
        - cell "采集 删除":
          - button "采集"
          - button "删除"
      - row "选择 300750.SZ 300750.SZ 宁德时代 深市 - 待采集 待采集 待采 采集 删除":
        - cell "选择 300750.SZ":
          - checkbox "选择 300750.SZ"
        - cell "300750.SZ"
        - cell "宁德时代"
        - cell "深市"
        - cell "-"
        - cell "待采集"
        - cell "待采集"
        - cell "待采"
        - cell "采集 删除":
          - button "采集"
          - button "删除"
      - row "选择 600519.SH 600519.SH 贵州茅台 沪市 - 待采集 待采集 待采 采集 删除":
        - cell "选择 600519.SH":
          - checkbox "选择 600519.SH"
        - cell "600519.SH"
        - cell "贵州茅台"
        - cell "沪市"
        - cell "-"
        - cell "待采集"
        - cell "待采集"
        - cell "待采"
        - cell "采集 删除":
          - button "采集"
          - button "删除"
      - row "选择 600584.SH 600584.SH 长电科技 沪市 - 待采集 待采集 待采 采集 删除":
        - cell "选择 600584.SH":
          - checkbox "选择 600584.SH"
        - cell "600584.SH"
        - cell "长电科技"
        - cell "沪市"
        - cell "-"
        - cell "待采集"
        - cell "待采集"
        - cell "待采"
        - cell "采集 删除":
          - button "采集"
          - button "删除"
- heading "编排器状态" [level=3]
- text: "运行中: 10/10 RegistrationOrchestrator running QualityGate running ScoreCalibrator running CatalystTracker running WatchListTrigger running StrategyReportGenerator running TimelinessSyncAnalyzer running WeeklyReviewScheduler running VolatilityAlertPush running ChipAnomalyDetector running"
```

# Test source

```ts
  1   | /**
  2   |  * @test_id V9-TEST-E2E-009
  3   |  * @covers_docs [V9-DOC-DATA-024, V9-DOC-PROJ-108, V9-DOC-BACK-011]
  4   |  */
  5   | import { test, expect } from '@playwright/test'
  6   | 
  7   | const TEST_STOCKS = [
  8   |   { code: '300712.SZ', name: '永福股份' },
  9   |   { code: '600519.SH', name: '贵州茅台' },
  10  |   { code: '000858.SZ', name: '五粮液' },
  11  |   { code: '002594.SZ', name: '比亚迪' },
  12  | ]
  13  | 
  14  | const TEST_GROUP_NAME = '测试分组'
  15  | const NEW_GROUP_NAME = '新建分组'
  16  | 
  17  | test.describe('股票池管理功能测试', () => {
  18  |   test.beforeEach(async ({ page }) => {
  19  |     await page.goto('/#/input')
  20  |     await expect(page.getByRole('heading', { name: '意向候选池', exact: true })).toBeVisible({ timeout: 10000 })
  21  |   })
  22  | 
  23  |   test.describe('界面基础验证', () => {
  24  |     test('应显示股票池看板标题', async ({ page }) => {
  25  |       await expect(page.getByRole('heading', { name: '意向候选池', exact: true })).toBeVisible()
  26  |     })
  27  | 
  28  |     test('应显示分组筛选器', async ({ page }) => {
  29  |       await expect(page.getByLabel('分组筛选')).toBeVisible()
  30  |     })
  31  | 
  32  |     test('应显示新建分组按钮', async ({ page }) => {
  33  |       await expect(page.getByRole('button', { name: '新建分组' })).toBeVisible()
  34  |     })
  35  | 
  36  |     test('应显示批量导入快捷按钮', async ({ page }) => {
  37  |       await expect(page.locator('button:has-text("批量导入")').first()).toBeVisible()
  38  |     })
  39  | 
  40  |     test('应显示股票代码和名称输入框', async ({ page }) => {
  41  |       await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible()
  42  |       await expect(page.getByRole('textbox', { name: '股票名称' })).toBeVisible()
  43  |     })
  44  | 
  45  |     test('应显示录入操作按钮', async ({ page }) => {
  46  |       await expect(page.getByRole('button', { name: '仅录入' })).toBeVisible()
  47  |       await expect(page.getByRole('button', { name: '录入并拉基础' })).toBeVisible()
  48  |       await expect(page.getByRole('button', { name: '录入并拉全部' })).toBeVisible()
  49  |     })
  50  | 
  51  |     test('应显示股票池看板五大池子', async ({ page }) => {
  52  |       await expect(page.getByRole('heading', { name: '意向候选池', exact: true })).toBeVisible()
  53  |       await expect(page.locator('text=研究精选池')).toBeVisible()
  54  |       await expect(page.locator('text=深度研究池')).toBeVisible()
  55  |       await expect(page.locator('text=观察池')).toBeVisible()
  56  |       await expect(page.locator('text=归档池')).toBeVisible()
  57  |     })
  58  | 
  59  |     test('应显示看板视图切换按钮', async ({ page }) => {
  60  |       await expect(page.getByRole('button', { name: '看板视图' })).toBeVisible()
  61  |       await expect(page.getByRole('button', { name: '列表视图' })).toBeVisible()
  62  |     })
  63  |   })
  64  | 
  65  |   // TODO(test-alignment): 选择器已从"股票池看板"对齐为"意向候选池"（2026-08-08）。
  66  |   //   注意：界面基础验证组的"五大池子"测试可能仍需对齐（InputDashboard 无"研究精选池"等文本）。
  67  |   test.describe('单只股票添加功能', () => {
  68  |     test('应成功添加单只股票到默认分组', async ({ page }) => {
  69  |       await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
  70  |       await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
  71  |       await page.getByRole('button', { name: '仅录入' }).click()
  72  | 
  73  |       // 验证添加成功提示
  74  |       await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })
  75  | 
  76  |       // 验证股票出现在意向候选池中
> 77  |       await expect(page.locator('text=永福股份').first()).toBeVisible()
      |                                                       ^ Error: expect(locator).toBeVisible() failed
  78  |       await expect(page.locator('text=300712').first()).toBeVisible()
  79  | 
  80  |       // 验证候选池标的计数更新
  81  |       await expect(page.locator('text=候选池标的').locator('..').locator('text=1')).toBeVisible({ timeout: 3000 })
  82  |     })
  83  | 
  84  |     test('重复添加已存在股票应提示反馈', async ({ page }) => {
  85  |       // 第一次添加
  86  |       await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
  87  |       await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
  88  |       await page.getByRole('button', { name: '仅录入' }).click()
  89  |       await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })
  90  | 
  91  |       // 第二次添加（重复）
  92  |       await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
  93  |       await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
  94  |       await page.getByRole('button', { name: '仅录入' }).click()
  95  | 
  96  |       // 验证有反馈（成功或错误提示）
  97  |       await expect(page.locator('text=已添加')).toBeVisible({ timeout: 5000 })
  98  |     })
  99  | 
  100 |     test('空代码和名称时应有验证提示', async ({ page }) => {
  101 |       // 空代码和名称
  102 |       await page.getByRole('textbox', { name: '股票代码' }).fill('')
  103 |       await page.getByRole('textbox', { name: '股票名称' }).fill('')
  104 |       await page.getByRole('button', { name: '仅录入' }).click()
  105 | 
  106 |       await expect(page.locator('text=请输入代码和名称')).toBeVisible({ timeout: 3000 })
  107 |     })
  108 | 
  109 |     test('添加后代码名称输入框应清空', async ({ page }) => {
  110 |       await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
  111 |       await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
  112 |       await page.getByRole('button', { name: '仅录入' }).click()
  113 |       await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })
  114 | 
  115 |       // 输入框应该被清空
  116 |       await expect(page.getByRole('textbox', { name: '股票代码' })).toHaveValue('')
  117 |       await expect(page.getByRole('textbox', { name: '股票名称' })).toHaveValue('')
  118 |     })
  119 |   })
  120 | 
  121 |   test.describe('分组管理功能', () => {
  122 |     test('应成功新建分组', async ({ page }) => {
  123 |       await page.getByRole('button', { name: '新建分组' }).click()
  124 | 
  125 |       // 填写分组名称
  126 |       await page.getByRole('textbox', { name: '分组名称' }).fill(NEW_GROUP_NAME)
  127 | 
  128 |       // 确认创建
  129 |       await page.getByRole('button', { name: '创建' }).click()
  130 | 
  131 |       // 验证成功（对话框关闭即表示成功）
  132 |       await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  133 | 
  134 |       // 验证分组出现在筛选器中
  135 |       await expect(page.getByLabel('分组筛选').locator(`option[value="${NEW_GROUP_NAME}"]`)).toBeAttached()
  136 |     })
  137 | 
  138 |     test('空分组名称时点击创建应有验证提示', async ({ page }) => {
  139 |       await page.getByRole('button', { name: '新建分组' }).click()
  140 |       await page.getByRole('textbox', { name: '分组名称' }).clear()
  141 |       await page.getByRole('button', { name: '创建' }).click()
  142 | 
  143 |       // 对话框应该仍然打开（未关闭）= 验证失败
  144 |       await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
  145 |     })
  146 | 
  147 |     test('重复创建同名分组应有提示', async ({ page }) => {
  148 |       // 第一次创建
  149 |       await page.getByRole('button', { name: '新建分组' }).click()
  150 |       await page.getByRole('textbox', { name: '分组名称' }).fill(TEST_GROUP_NAME)
  151 |       await page.getByRole('button', { name: '创建' }).click()
  152 |       await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  153 | 
  154 |       // 第二次创建
  155 |       await page.getByRole('button', { name: '新建分组' }).click()
  156 |       await page.getByRole('textbox', { name: '分组名称' }).fill(TEST_GROUP_NAME)
  157 |       await page.getByRole('button', { name: '创建' }).click()
  158 | 
  159 |       // 验证错误提示（toast或内联）
  160 |       await expect(page.getByText(/已存在|重复|分组名称已存在/)).toBeVisible({ timeout: 5000 })
  161 |     })
  162 | 
  163 |     test('取消按钮应关闭对话框', async ({ page }) => {
  164 |       await page.getByRole('button', { name: '新建分组' }).click()
  165 |       await expect(page.getByRole('dialog')).toBeVisible()
  166 | 
  167 |       await page.getByRole('button', { name: '取消' }).click()
  168 |       await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 })
  169 |     })
  170 |   })
  171 | 
  172 |   test.describe('分组筛选功能', () => {
  173 |     test.beforeEach(async ({ page }) => {
  174 |       // 创建测试分组
  175 |       await page.getByRole('button', { name: '新建分组' }).click()
  176 |       await page.getByRole('textbox', { name: '分组名称' }).fill(TEST_GROUP_NAME)
  177 |       await page.getByRole('button', { name: '创建' }).click()
```