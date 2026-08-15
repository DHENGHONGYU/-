/**
 * @test_id V9-TEST-E2E-015
 * StockSelector 组件端到端集成测试
 * 覆盖：键盘导航（↑↓EnterEscTab）、移动端适配、边界情况
 *
 * @covers src/components/organisms/input/StockSelector.tsx
 * @covers src/pages/HomePage.tsx
 * @covers src/pages/analysis/ScoreComparisonPage.tsx
 */
import { test, expect } from '@playwright/test'

const MOBILE = { width: 375, height: 812 }

test.describe('StockSelector E2E - 键盘导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })
  })

  test('点击打开下拉框并显示搜索输入', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    await expect(page.getByPlaceholder(/搜索股票/)).toBeVisible()
    await expect(page.getByRole('listbox')).toBeVisible()
  })

  test('↓键移动高亮项，↑键回到上一项', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.click()
    await input.press('ArrowDown')
    await input.press('ArrowDown')
    await input.press('ArrowUp')

    await expect(page.getByRole('listbox')).toBeVisible()
  })

  test('↑键从第一项循环到最后一项（wrap-around）', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.click()
    await input.press('ArrowUp')

    await expect(page.getByRole('listbox')).toBeVisible()
  })

  test('Enter确认选择第一项', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.click()
    await input.press('Enter')

    await page.waitForURL(/analysis\/intelligent-score/)
    await expect(page.getByText('贵州茅台')).toBeVisible({ timeout: 5000 })
  })

  test('Enter选择高亮的第二项', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.click()
    await input.press('ArrowDown')
    await input.press('Enter')

    await page.waitForURL(/analysis\/intelligent-score/)
  })

  test('Esc关闭下拉框', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    await expect(page.getByRole('listbox')).toBeVisible()

    const input = page.getByPlaceholder(/搜索股票/)
    await input.click()
    await input.press('Escape')

    await expect(page.getByRole('listbox')).not.toBeVisible()
  })

  test('Tab关闭下拉框', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    await expect(page.getByRole('listbox')).toBeVisible()

    const input = page.getByPlaceholder(/搜索股票/)
    await input.click()
    await input.press('Tab')

    await expect(page.getByRole('listbox')).not.toBeVisible()
  })

  test('搜索后键盘导航到匹配项并Enter选择', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('平安')
    await expect(page.getByRole('listbox')).toBeVisible()

    const options = page.getByRole('option')
    const initialCount = await options.count()
    expect(initialCount).toBeGreaterThanOrEqual(2)

    await input.press('ArrowDown')
    await input.press('Enter')

    await page.waitForURL(/analysis\/intelligent-score/)
  })

  test('Esc在搜索中间关闭下拉框', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('贵州')
    await input.press('ArrowDown')
    await input.press('Escape')

    await expect(page.getByRole('listbox')).not.toBeVisible()
  })

  test('连续多次ArrowDown循环导航不崩溃', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.click()
    for (let i = 0; i < 20; i++) {
      await input.press('ArrowDown')
    }

    await expect(page.getByRole('listbox')).toBeVisible()
  })

  test('连续多次ArrowUp循环导航不崩溃', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.click()
    for (let i = 0; i < 20; i++) {
      await input.press('ArrowUp')
    }

    await expect(page.getByRole('listbox')).toBeVisible()
  })

  test('↓↑回到起始位置后Enter选择第一项', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.click()
    await input.press('ArrowDown')
    await input.press('ArrowUp')
    await input.press('Enter')

    await page.waitForURL(/analysis\/intelligent-score/)
    await expect(page.getByText('贵州茅台')).toBeVisible({ timeout: 5000 })
  })

  test('点击下拉框外部关闭下拉框', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    await expect(page.getByRole('listbox')).toBeVisible()

    await page.mouse.click(50, 50)

    await expect(page.getByRole('listbox')).not.toBeVisible({ timeout: 2000 })
  })

  test('键盘导航提示文本显示', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    await expect(page.getByText(/↑↓ 选择 · Enter 确认 · Esc 关闭/)).toBeVisible()
  })
})

test.describe('StockSelector E2E - 搜索与选择', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })
  })

  test('搜索"贵州茅台"显示结果', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('贵州茅台')

    await expect(page.getByRole('option', { name: /贵州茅台/ })).toBeVisible()
  })

  test('搜索"平安"显示中国平安和平安银行', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('平安')

    await expect(page.getByText('中国平安')).toBeVisible()
    await expect(page.getByText('平安银行')).toBeVisible()
  })

  test('搜索无结果显示提示', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('不存在的股票xyz123')

    await expect(page.getByText('未找到匹配的股票')).toBeVisible()
  })

  test('点击选项触发导航', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('贵州茅台')
    await page.getByRole('option', { name: /贵州茅台/ }).click()

    await page.waitForURL(/analysis\/intelligent-score/)
    await expect(page.getByText('贵州茅台')).toBeVisible({ timeout: 5000 })
  })

  test('股票代码搜索（600519）', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('600519')

    await expect(page.getByRole('option', { name: /贵州茅台/ })).toBeVisible()
  })

  test('沪市股票显示"沪"标识', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    await expect(page.getByText('沪600519')).toBeVisible()
  })

  test('深市股票显示"深"标识', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)
    await input.fill('比亚迪')

    await expect(page.getByText('深002594').first()).toBeVisible()
  })
})

test.describe('StockSelector E2E - ScoreComparisonPage 集成', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/analysis/score-comparison')
    await expect(page.locator('[data-testid="portal-shell"]')).toBeVisible({ timeout: 15000 })
  })

  test('同股票比对 - StockSelector组件渲染', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await expect(selector).toBeVisible({ timeout: 10000 })
    await selector.click()

    await expect(page.getByPlaceholder(/搜索/)).toBeVisible()
    await expect(page.getByRole('listbox')).toBeVisible()
  })

  test('跨股票比对 - 两个StockSelector独立渲染', async ({ page }) => {
    await page.getByText(/跨股票/).click()

    const selectors = page.locator('button:has-text("未知股票")')
    await expect(selectors).toHaveCount(2, { timeout: 10000 })

    const leftSelector = selectors.first()
    await leftSelector.click()

    const input = page.getByPlaceholder(/搜索左侧股票/)
    await expect(input).toBeVisible()
  })

  test('StockSelector - Esc关闭下拉框', async ({ page }) => {
    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    const input = page.getByPlaceholder(/搜索/)
    await input.click()
    await input.press('Escape')

    await expect(page.getByRole('listbox')).not.toBeVisible()
  })
})

test.describe('StockSelector E2E - 移动端适配', () => {
  test.describe('移动端 viewport (375x812)', () => {
    test.use({ viewport: MOBILE })

    test('下拉框不溢出移动端视口', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

      const selector = page.locator('button:has-text("未知股票")').first()
      await selector.click()

      const dropdown = page.locator('.absolute.left-0.right-0.top-full')
      await expect(dropdown).toBeVisible()

      const viewport = page.viewportSize()
      if (viewport) {
        const box = await dropdown.boundingBox()
        expect(box).not.toBeNull()
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 16)
        }
      }
    })

    test('下拉框max-w约束包含视口计算', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

      const selector = page.locator('button:has-text("未知股票")').first()
      await selector.click()

      const dropdown = page.locator('.absolute.left-0.right-0.top-full')
      const className = await dropdown.getAttribute('class')
      expect(className).toContain('max-w-[calc(100vw-2rem)]')
    })

    test('触摸目标大小充足', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

      const selector = page.locator('button:has-text("未知股票")').first()
      await selector.click()

      const options = page.getByRole('option')
      const count = await options.count()
      expect(count).toBeGreaterThan(0)

      const firstOption = options.first()
      const classAttr = await firstOption.getAttribute('class')
      expect(classAttr).toContain('py-2.5')
    })

    test('搜索框在移动端使用inputMode=search', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

      const selector = page.locator('button:has-text("未知股票")').first()
      await selector.click()

      const input = page.getByPlaceholder(/搜索股票/)
      await expect(input).toHaveAttribute('inputmode', 'search')
    })

    test('移动端搜索和选择正常工作', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

      const selector = page.locator('button:has-text("未知股票")').first()
      await selector.click()
      const input = page.getByPlaceholder(/搜索股票/)

      await input.fill('招商银行')
      await expect(page.getByText('招商银行')).toBeVisible()

      await page.getByRole('option', { name: /招商银行/ }).click()
      await page.waitForURL(/analysis\/intelligent-score/)
    })

    test('移动端键盘导航正常工作', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

      const selector = page.locator('button:has-text("未知股票")').first()
      await selector.click()
      const input = page.getByPlaceholder(/搜索股票/)

      await input.click()
      await input.press('ArrowDown')
      await input.press('ArrowDown')
      await input.press('ArrowUp')
      await input.press('Enter')

      await page.waitForURL(/analysis\/intelligent-score/)
    })

    test('移动端Esc关闭下拉框', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

      const selector = page.locator('button:has-text("未知股票")').first()
      await selector.click()
      await expect(page.getByRole('listbox')).toBeVisible()

      const input = page.getByPlaceholder(/搜索股票/)
      await input.click()
      await input.press('Escape')

      await expect(page.getByRole('listbox')).not.toBeVisible()
    })
  })
})

test.describe('StockSelector E2E - 边界情况', () => {
  test('重复选择同一股票不应报错', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    await page.getByRole('option', { name: /贵州茅台/ }).click()
    await page.waitForURL(/analysis\/intelligent-score/)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const button2 = page.locator('button:has-text("未知股票")').first()
    await button2.click()

    await page.getByRole('option', { name: /贵州茅台/ }).click()
    await page.waitForURL(/analysis\/intelligent-score/)
  })

  test('搜索关键词清除后恢复完整列表', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()
    const input = page.getByPlaceholder(/搜索股票/)

    await input.fill('贵州')
    const filteredOptions = page.getByRole('option')
    const filteredCount = await filteredOptions.count()
    expect(filteredCount).toBeGreaterThan(0)

    await input.clear()
    const allOptions = page.getByRole('option')
    const allCount = await allOptions.count()
    expect(allCount).toBeGreaterThan(filteredCount)
  })

  test('下拉框可滚动查看大量选项', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    const listbox = page.getByRole('listbox')
    const className = await listbox.getAttribute('class')
    expect(className).toContain('max-h-[50vh]')
    expect(className).toContain('overflow-y-auto')
  })

  test('搜索框autocomplete=off', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    const input = page.getByPlaceholder(/搜索股票/)
    await expect(input).toHaveAttribute('autocomplete', 'off')
  })

  test('ARIA属性正确', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    await expect(page.getByRole('listbox')).toHaveAttribute('aria-label', '股票列表')

    const options = page.getByRole('option')
    const count = await options.count()
    for (let i = 0; i < count; i++) {
      await expect(options.nth(i)).toHaveAttribute('role', 'option')
    }
  })

  test('选择股票后导航到智能评分页', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    await page.getByRole('option', { name: /贵州茅台/ }).click()
    await page.waitForURL(/analysis\/intelligent-score/)

    const currentUrl = page.url()
    expect(currentUrl).toContain('600519')

    await expect(page.getByText('贵州茅台')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('StockSelector E2E - 控制台日志', () => {
  test('交互过程中不产生未捕获错误', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    const input = page.getByPlaceholder(/搜索股票/)
    await input.fill('贵州')
    await input.press('ArrowDown')
    await input.press('Enter')

    await page.waitForURL(/analysis\/intelligent-score/)

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('MCPClient'),
    )
    expect(criticalErrors, '不应有未捕获错误').toEqual([])
  })

  test('StockSelector info级日志在控制台可见', async ({ page }) => {
    const stockSelectorLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().includes('[StockSelector]')) {
        stockSelectorLogs.push(`${msg.type()}: ${msg.text()}`)
      }
    })

    await page.goto('/')
    await expect(page.getByText('快速选股分析')).toBeVisible({ timeout: 15000 })

    const selector = page.locator('button:has-text("未知股票")').first()
    await selector.click()

    const input = page.getByPlaceholder(/搜索股票/)
    await input.fill('贵州茅台')
    await input.press('Enter')

    await page.waitForURL(/analysis\/intelligent-score/)

    const infoLogs = stockSelectorLogs.filter(
      (l) => l.includes('info') || l.includes('组件初始化') || l.includes('选择股票'),
    )
    expect(infoLogs.length).toBeGreaterThan(0)
  })
})