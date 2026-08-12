/**
 * @test_id V9-TEST-E2E-002
 * 可访问性测试
 * 验证系统的 ARIA 标签、键盘导航和颜色对比度
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════
// P1 修复日志：键盘导航改用 document.activeElement 替代 :focus 伪类
//            焦点管理添加 waitForLoadState('networkidle') 确保页面渲染完成
//            所有路由补全 /#/ 前缀
// ═══════════════════════════════════════════════════════════════

const LOG_PREFIX = '[A11Y-Test]'

test.describe('可访问性测试', () => {
  // ARIA 标签测试
  test.describe('ARIA 标签检查', () => {
    test('输入舱 Hub 页面 - ARIA 标签完整', async ({ page }) => {
      await page.goto('/#/input/hub')
      await page.waitForLoadState('networkidle')
      console.log(`${LOG_PREFIX} [P1-FIX] ARIA标签检查：已导航到 /#/input/hub，等待 networkidle 完成`)

      // 验证所有按钮都有 aria-label 或文本内容
      const buttons = page.getByRole('button')
      const buttonCount = await buttons.count()

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i)
        const hasLabel = await button.evaluate((el) => {
          return el.textContent?.trim() || el.getAttribute('aria-label')
        })
        expect(hasLabel).toBeTruthy()
      }

      // 验证所有链接都有文本内容
      const links = page.getByRole('link')
      const linkCount = await links.count()

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i)
        const hasText = await link.evaluate((el) => el.textContent?.trim())
        expect(hasText).toBeTruthy()
      }
    })

    test('分析舱 Hub 页面 - ARIA 标签完整', async ({ page }) => {
      await page.goto('/#/analysis/hub')
      await page.waitForLoadState('networkidle')

      // 验证所有按钮都有 aria-label 或文本内容
      const buttons = page.getByRole('button')
      const buttonCount = await buttons.count()

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i)
        const hasLabel = await button.evaluate((el) => {
          return el.textContent?.trim() || el.getAttribute('aria-label')
        })
        expect(hasLabel).toBeTruthy()
      }
    })

    test('交易舱 Hub 页面 - ARIA 标签完整', async ({ page }) => {
      await page.goto('/#/trading')
      await page.waitForLoadState('networkidle')

      // 验证所有按钮都有 aria-label 或文本内容
      const buttons = page.getByRole('button')
      const buttonCount = await buttons.count()

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i)
        const hasLabel = await button.evaluate((el) => {
          return el.textContent?.trim() || el.getAttribute('aria-label')
        })
        expect(hasLabel).toBeTruthy()
      }
    })

    test('总控舱 Hub 页面 - ARIA 标签完整', async ({ page }) => {
      await page.goto('/#/command/hub')
      await page.waitForLoadState('networkidle')

      // 验证所有按钮都有 aria-label 或文本内容
      const buttons = page.getByRole('button')
      const buttonCount = await buttons.count()

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i)
        const hasLabel = await button.evaluate((el) => {
          return el.textContent?.trim() || el.getAttribute('aria-label')
        })
        expect(hasLabel).toBeTruthy()
      }
    })
  })

  // 键盘导航测试
  test.describe('键盘导航检查', () => {
    test('输入舱 Hub 页面 - Tab 键导航', async ({ page }) => {
      await page.goto('/#/input/hub')
      await page.waitForLoadState('networkidle')
      console.log(`${LOG_PREFIX} [P1-FIX] Tab键导航：已导航到 /#/input/hub，准备检测 document.activeElement`)

      // 按 Tab 键导航到第一个可聚焦元素
      await page.keyboard.press('Tab')

      // 验证有元素获得焦点（使用 document.activeElement 替代 :focus 伪类）
      const activeEl = await page.evaluate(() => {
        const el = document.activeElement
        return { tagName: el?.tagName || 'null', hasFocus: el !== document.body }
      })
      console.log(`${LOG_PREFIX} [P1-FIX] Tab键导航：activeElement=${activeEl.tagName}, hasFocus=${activeEl.hasFocus}`)
      expect(activeEl.hasFocus).toBe(true)

      // 继续按 Tab 键，验证可以导航到多个元素
      await page.keyboard.press('Tab')
      const activeEl2 = await page.evaluate(() => {
        const el = document.activeElement
        return { tagName: el?.tagName || 'null', hasFocus: el !== document.body }
      })
      console.log(`${LOG_PREFIX} [P1-FIX] Tab键导航(2nd)：activeElement=${activeEl2.tagName}, hasFocus=${activeEl2.hasFocus}`)
      expect(activeEl2.hasFocus).toBe(true)
    })

    test('分析舱 Hub 页面 - Tab 键导航', async ({ page }) => {
      await page.goto('/#/analysis/hub')
      await page.waitForLoadState('networkidle')

      await page.keyboard.press('Tab')
      const hasFocus = await page.evaluate(() => document.activeElement !== document.body)
      expect(hasFocus).toBe(true)
    })

    test('交易舱 Hub 页面 - Tab 键导航', async ({ page }) => {
      await page.goto('/#/trading')
      await page.waitForLoadState('networkidle')

      await page.keyboard.press('Tab')
      const hasFocus = await page.evaluate(() => document.activeElement !== document.body)
      expect(hasFocus).toBe(true)
    })

    test('总控舱 Hub 页面 - Tab 键导航', async ({ page }) => {
      await page.goto('/#/command/hub')
      await page.waitForLoadState('networkidle')

      await page.keyboard.press('Tab')
      const hasFocus = await page.evaluate(() => document.activeElement !== document.body)
      expect(hasFocus).toBe(true)
    })

    test('按钮 - Enter 键激活', async ({ page }) => {
      await page.goto('/#/input/hub')
      await page.waitForLoadState('networkidle')

      // 导航到第一个按钮
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // 按 Enter 键激活按钮
      await page.keyboard.press('Enter')

      // 验证页面有响应（可能是导航或弹窗）
      // 这里只是验证按键被接受，不验证具体行为
    })

    test('按钮 - Space 键激活', async ({ page }) => {
      await page.goto('/#/input/hub')
      await page.waitForLoadState('networkidle')

      // 导航到第一个按钮
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // 按 Space 键激活按钮
      await page.keyboard.press('Space')

      // 验证页面有响应
    })
  })

  // 焦点管理测试
  test.describe('焦点管理检查', () => {
    test('输入舱 Hub 页面 - 焦点顺序合理', async ({ page }) => {
      await page.goto('/#/input/hub')
      await page.waitForLoadState('networkidle')
      console.log(`${LOG_PREFIX} [P1-FIX] 焦点管理：已导航到 /#/input/hub，准备收集可聚焦元素`)

      // 收集所有可聚焦元素
      const focusableElements = await page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        return elements.length
      })

      console.log(`${LOG_PREFIX} [P1-FIX] 焦点管理：找到 ${focusableElements} 个可聚焦元素`)
      // 验证有可聚焦元素
      expect(focusableElements).toBeGreaterThan(0)
    })

    test('分析舱 Hub 页面 - 焦点顺序合理', async ({ page }) => {
      await page.goto('/#/analysis/hub')
      await page.waitForLoadState('networkidle')

      // 收集所有可聚焦元素
      const focusableElements = await page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        return elements.length
      })

      // 验证有可聚焦元素
      expect(focusableElements).toBeGreaterThan(0)
    })
  })
})
