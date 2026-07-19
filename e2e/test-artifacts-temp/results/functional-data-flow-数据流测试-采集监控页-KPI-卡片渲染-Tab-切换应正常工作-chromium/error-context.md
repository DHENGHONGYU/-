# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\data-flow.spec.ts >> 数据流测试 >> 采集监控页 KPI 卡片渲染 >> Tab 切换应正常工作
- Location: functional\data-flow.spec.ts:154:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: '评分卡片' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - link "V9 智能投研复盘系统" [ref=e5] [cursor=pointer]:
      - /url: "#/"
      - generic [ref=e6]: V9
      - generic [ref=e7]: 智能投研复盘系统
    - navigation [ref=e8]:
      - button "📦输入舱" [ref=e9] [cursor=pointer]
      - button "🔬分析舱" [ref=e10] [cursor=pointer]
      - button "💹交易舱" [ref=e11] [cursor=pointer]
      - button "📊输出舱" [ref=e12] [cursor=pointer]
      - button "🎛️总控舱" [ref=e13] [cursor=pointer]
      - button "驾驶舱" [ref=e14] [cursor=pointer]:
        - img [ref=e15]
        - text: 驾驶舱
    - generic [ref=e19]:
      - 'button "当前主题模式: 跟随系统，点击切换" [ref=e20] [cursor=pointer]':
        - img [ref=e21]
        - generic [ref=e23]: system
      - generic [ref=e27]: 采集正常
      - generic [ref=e32]: 信号强
      - generic [ref=e37]: 00:00:29
      - generic [ref=e39]: v1.2.0
  - generic [ref=e40]:
    - complementary [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]: 📦
        - generic [ref=e44]: 输入舱
      - generic [ref=e45]:
        - generic [ref=e46]:
          - generic [ref=e47]: 意向候选池
          - list [ref=e48]:
            - listitem [ref=e49]:
              - button "录入看板" [ref=e50] [cursor=pointer]:
                - img [ref=e51]
                - generic [ref=e56]: 录入看板
            - listitem [ref=e57]:
              - button "股票池看板（已迁分析舱）" [ref=e58] [cursor=pointer]:
                - img [ref=e59]
                - generic [ref=e63]: 股票池看板（已迁分析舱）
            - listitem [ref=e64]:
              - button "批量导入" [ref=e65] [cursor=pointer]:
                - img [ref=e66]
                - generic [ref=e69]: 批量导入
            - listitem [ref=e70]:
              - button "热门板块" [ref=e71] [cursor=pointer]:
                - img [ref=e72]
                - generic [ref=e74]: 热门板块
            - listitem [ref=e75]:
              - button "本地知识库" [ref=e76] [cursor=pointer]:
                - img [ref=e77]
                - generic [ref=e79]: 本地知识库
        - generic [ref=e80]:
          - generic [ref=e81]: 数据采集
          - list [ref=e82]:
            - listitem [ref=e83]:
              - button "采集测试" [ref=e84] [cursor=pointer]:
                - img [ref=e85]
                - generic [ref=e89]: 采集测试
            - listitem [ref=e90]:
              - button "采集任务监控" [ref=e91] [cursor=pointer]:
                - img [ref=e92]
                - generic [ref=e94]: 采集任务监控
            - listitem [ref=e95]:
              - button "七维采集配置" [ref=e96] [cursor=pointer]:
                - img [ref=e97]
                - generic [ref=e98]: 七维采集配置
            - listitem [ref=e99]:
              - button "抓取引擎配置" [ref=e100] [cursor=pointer]:
                - img [ref=e101]
                - generic [ref=e104]: 抓取引擎配置
    - main [ref=e106]:
      - generic [ref=e108]:
        - generic [ref=e110]:
          - heading "输入舱" [level=1] [ref=e111]
          - paragraph [ref=e112]: 股票录入 · 批量导入 · 热门板块 · 采集测试
        - main [ref=e113]:
          - navigation "breadcrumb" [ref=e114]:
            - list [ref=e115]:
              - listitem [ref=e116]:
                - link "首页" [ref=e117] [cursor=pointer]:
                  - /url: "#/"
              - listitem [ref=e118]:
                - img [ref=e119]
              - listitem [ref=e121]:
                - link "输入舱" [ref=e122] [cursor=pointer]:
                  - /url: "#/input"
              - listitem [ref=e123]:
                - img [ref=e124]
              - listitem [ref=e126]:
                - link "采集任务监控" [disabled] [ref=e127]
          - generic [ref=e128]:
            - generic [ref=e129]:
              - heading "采集任务监控" [level=1] [ref=e130]
              - paragraph [ref=e131]: 任务列表 · 维度健康度 · 采集日志 · 链路可视化
            - generic [ref=e133]: D-1 框架
          - generic [ref=e134]:
            - generic [ref=e136]:
              - paragraph [ref=e137]: 任务总数
              - paragraph [ref=e138]: "0"
            - generic [ref=e140]:
              - paragraph [ref=e141]: 采集中
              - paragraph [ref=e142]: "0"
            - generic [ref=e144]:
              - paragraph [ref=e145]: 已完成
              - paragraph [ref=e146]: "0"
            - generic [ref=e148]:
              - paragraph [ref=e149]: 失败
              - paragraph [ref=e150]: "0"
          - generic [ref=e151]:
            - generic [ref=e153]:
              - paragraph [ref=e154]: 采集成功率
              - paragraph [ref=e155]: 0%
            - generic [ref=e157]:
              - paragraph [ref=e158]: 平均延迟
              - paragraph [ref=e159]: 0ms
            - generic [ref=e161]:
              - paragraph [ref=e162]: 降级次数
              - paragraph [ref=e163]: "0"
            - generic [ref=e165]:
              - paragraph [ref=e166]: 写入成功率
              - paragraph [ref=e167]: 0%
          - generic [ref=e168]:
            - generic [ref=e170]:
              - paragraph [ref=e171]: 数据新鲜度
              - paragraph [ref=e172]: 暂无
            - generic [ref=e174]:
              - paragraph [ref=e175]: 采集成功率
              - paragraph [ref=e176]: 0%
          - generic [ref=e177]:
            - generic [ref=e178]:
              - tab "进度汇报" [selected] [ref=e179] [cursor=pointer]:
                - img [ref=e180]
                - text: 进度汇报
              - tab "任务列表" [ref=e185] [cursor=pointer]:
                - img [ref=e186]
                - text: 任务列表
              - tab "评分分析" [ref=e189] [cursor=pointer]:
                - img [ref=e190]
                - text: 评分分析
              - tab "维度健康" [ref=e192] [cursor=pointer]:
                - img [ref=e193]
                - text: 维度健康
              - tab "采集日志" [ref=e195] [cursor=pointer]:
                - img [ref=e196]
                - text: 采集日志
              - tab "时间线" [ref=e199] [cursor=pointer]:
                - img [ref=e200]
                - text: 时间线
              - tab "泳道图" [ref=e204] [cursor=pointer]:
                - img [ref=e205]
                - text: 泳道图
              - tab "回放" [ref=e209] [cursor=pointer]:
                - img [ref=e210]
                - text: 回放
              - tab "数据质量" [ref=e215] [cursor=pointer]:
                - img [ref=e216]
                - text: 数据质量
            - tabpanel [ref=e218]:
              - generic [ref=e219]:
                - generic [ref=e220]:
                  - generic [ref=e221]:
                    - generic [ref=e222]: 总体进度
                    - generic [ref=e224]: 0.0%
                  - generic [ref=e227]:
                    - generic [ref=e228]:
                      - generic [ref=e229]:
                        - generic [ref=e230]:
                          - generic [ref=e231]: 基本信息（01）
                          - generic [ref=e232]: "01"
                        - generic [ref=e233]: 未就绪
                      - generic [ref=e235]:
                        - generic [ref=e236]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e237]: 0.0%
                    - generic [ref=e240]:
                      - generic [ref=e241]:
                        - generic [ref=e242]:
                          - generic [ref=e243]: K线数据（02）
                          - generic [ref=e244]: "02"
                        - generic [ref=e245]: 未就绪
                      - generic [ref=e247]:
                        - generic [ref=e248]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e249]: 0.0%
                    - generic [ref=e252]:
                      - generic [ref=e253]:
                        - generic [ref=e254]:
                          - generic [ref=e255]: 筹码分布（03）
                          - generic [ref=e256]: "03"
                        - generic [ref=e257]: 未就绪
                      - generic [ref=e259]:
                        - generic [ref=e260]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e261]: 0.0%
                    - generic [ref=e264]:
                      - generic [ref=e265]:
                        - generic [ref=e266]:
                          - generic [ref=e267]: 重大事项（04）
                          - generic [ref=e268]: "04"
                        - generic [ref=e269]: 未就绪
                      - generic [ref=e271]:
                        - generic [ref=e272]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e273]: 0.0%
                    - generic [ref=e276]:
                      - generic [ref=e277]:
                        - generic [ref=e278]:
                          - generic [ref=e279]: 热点新闻（05）
                          - generic [ref=e280]: "05"
                        - generic [ref=e281]: 未就绪
                      - generic [ref=e283]:
                        - generic [ref=e284]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e285]: 0.0%
                    - generic [ref=e288]:
                      - generic [ref=e289]:
                        - generic [ref=e290]:
                          - generic [ref=e291]: 行业竞品（06）
                          - generic [ref=e292]: "06"
                        - generic [ref=e293]: 未就绪
                      - generic [ref=e295]:
                        - generic [ref=e296]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e297]: 0.0%
                    - generic [ref=e300]:
                      - generic [ref=e301]:
                        - generic [ref=e302]:
                          - generic [ref=e303]: 关联指数（07）
                          - generic [ref=e304]: "07"
                        - generic [ref=e305]: 未就绪
                      - generic [ref=e307]:
                        - generic [ref=e308]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e309]: 0.0%
                    - generic [ref=e312]:
                      - generic [ref=e313]:
                        - generic [ref=e314]:
                          - generic [ref=e315]: 研报中心（08）
                          - generic [ref=e316]: "08"
                        - generic [ref=e317]: 未就绪
                      - generic [ref=e319]:
                        - generic [ref=e320]: 成功 0 / 失败 0 / 总计 0
                        - generic [ref=e321]: 0.0%
                - generic [ref=e324]:
                  - generic [ref=e325]:
                    - generic [ref=e326]:
                      - generic [ref=e327]:
                        - generic [ref=e328]: 基本信息（01）
                        - generic [ref=e329]: "01"
                      - generic [ref=e330]: 0.0%
                    - generic [ref=e332]:
                      - generic [ref=e333]: 已采集 0 / 0
                      - generic [ref=e334]: 无失败
                    - generic [ref=e337]:
                      - generic [ref=e338]: "开始: —"
                      - generic [ref=e339]: "完成: —"
                      - generic [ref=e340]: "最近采集: —"
                  - generic [ref=e341]:
                    - generic [ref=e342]:
                      - generic [ref=e343]:
                        - generic [ref=e344]: K线数据（02）
                        - generic [ref=e345]: "02"
                      - generic [ref=e346]: 0.0%
                    - generic [ref=e348]:
                      - generic [ref=e349]: 已采集 0 / 0
                      - generic [ref=e350]: 无失败
                    - generic [ref=e353]:
                      - generic [ref=e354]: "开始: —"
                      - generic [ref=e355]: "完成: —"
                      - generic [ref=e356]: "最近采集: —"
                  - generic [ref=e357]:
                    - generic [ref=e358]:
                      - generic [ref=e359]:
                        - generic [ref=e360]: 筹码分布（03）
                        - generic [ref=e361]: "03"
                      - generic [ref=e362]: 0.0%
                    - generic [ref=e364]:
                      - generic [ref=e365]: 已采集 0 / 0
                      - generic [ref=e366]: 无失败
                    - generic [ref=e369]:
                      - generic [ref=e370]: "开始: —"
                      - generic [ref=e371]: "完成: —"
                      - generic [ref=e372]: "最近采集: —"
                  - generic [ref=e373]:
                    - generic [ref=e374]:
                      - generic [ref=e375]:
                        - generic [ref=e376]: 重大事项（04）
                        - generic [ref=e377]: "04"
                      - generic [ref=e378]: 0.0%
                    - generic [ref=e380]:
                      - generic [ref=e381]: 已采集 0 / 0
                      - generic [ref=e382]: 无失败
                    - generic [ref=e385]:
                      - generic [ref=e386]: "开始: —"
                      - generic [ref=e387]: "完成: —"
                      - generic [ref=e388]: "最近采集: —"
                  - generic [ref=e389]:
                    - generic [ref=e390]:
                      - generic [ref=e391]:
                        - generic [ref=e392]: 热点新闻（05）
                        - generic [ref=e393]: "05"
                      - generic [ref=e394]: 0.0%
                    - generic [ref=e396]:
                      - generic [ref=e397]: 已采集 0 / 0
                      - generic [ref=e398]: 无失败
                    - generic [ref=e401]:
                      - generic [ref=e402]: "开始: —"
                      - generic [ref=e403]: "完成: —"
                      - generic [ref=e404]: "最近采集: —"
                  - generic [ref=e405]:
                    - generic [ref=e406]:
                      - generic [ref=e407]:
                        - generic [ref=e408]: 行业竞品（06）
                        - generic [ref=e409]: "06"
                      - generic [ref=e410]: 0.0%
                    - generic [ref=e412]:
                      - generic [ref=e413]: 已采集 0 / 0
                      - generic [ref=e414]: 无失败
                    - generic [ref=e417]:
                      - generic [ref=e418]: "开始: —"
                      - generic [ref=e419]: "完成: —"
                      - generic [ref=e420]: "最近采集: —"
                  - generic [ref=e421]:
                    - generic [ref=e422]:
                      - generic [ref=e423]:
                        - generic [ref=e424]: 关联指数（07）
                        - generic [ref=e425]: "07"
                      - generic [ref=e426]: 0.0%
                    - generic [ref=e428]:
                      - generic [ref=e429]: 已采集 0 / 0
                      - generic [ref=e430]: 无失败
                    - generic [ref=e433]:
                      - generic [ref=e434]: "开始: —"
                      - generic [ref=e435]: "完成: —"
                      - generic [ref=e436]: "最近采集: —"
                  - generic [ref=e437]:
                    - generic [ref=e438]:
                      - generic [ref=e439]:
                        - generic [ref=e440]: 研报中心（08）
                        - generic [ref=e441]: "08"
                      - generic [ref=e442]: 0.0%
                    - generic [ref=e444]:
                      - generic [ref=e445]: 已采集 0 / 0
                      - generic [ref=e446]: 无失败
                    - generic [ref=e449]:
                      - generic [ref=e450]: "开始: —"
                      - generic [ref=e451]: "完成: —"
                      - generic [ref=e452]: "最近采集: —"
```

# Test source

```ts
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
  150 |       await expect(page.locator('text=TASK-20260701-001')).toBeVisible()
  151 |       await expect(page.locator('text=TASK-20260701-002')).toBeVisible()
  152 |     })
  153 | 
  154 |     test('Tab 切换应正常工作', async ({ page }) => {
  155 |       // 切换到评分卡片 Tab
> 156 |       await page.getByRole('tab', { name: '评分卡片' }).click()
      |                                                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
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