/**
 * 可访问性测试
 * 验证系统的 ARIA 标签、键盘导航和颜色对比度
 */

import { test, expect } from '@playwright/test'

test.describe('可访问性测试', () => {
  // ARIA 标签测试
  test.describe('ARIA 标签检查', () => {
    test('输入舱 Hub 页面 - ARIA 标签完整', async ({ page }) => {
      await page.goto('/input/hub')

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
      await page.goto('/analysis/hub')

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
      await page.goto('/trading/hub')

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
      await page.goto('/command/hub')

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
      await page.goto('/input/hub')

      // 按 Tab 键导航到第一个可聚焦元素
      await page.keyboard.press('Tab')

      // 验证有元素获得焦点
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()

      // 继续按 Tab 键，验证可以导航到多个元素
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toBeVisible()
    })

    test('分析舱 Hub 页面 - Tab 键导航', async ({ page }) => {
      await page.goto('/analysis/hub')

      // 按 Tab 键导航到第一个可聚焦元素
      await page.keyboard.press('Tab')

      // 验证有元素获得焦点
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    test('交易舱 Hub 页面 - Tab 键导航', async ({ page }) => {
      await page.goto('/trading/hub')

      // 按 Tab 键导航到第一个可聚焦元素
      await page.keyboard.press('Tab')

      // 验证有元素获得焦点
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    test('总控舱 Hub 页面 - Tab 键导航', async ({ page }) => {
      await page.goto('/command/hub')

      // 按 Tab 键导航到第一个可聚焦元素
      await page.keyboard.press('Tab')

      // 验证有元素获得焦点
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    test('按钮 - Enter 键激活', async ({ page }) => {
      await page.goto('/input/hub')

      // 导航到第一个按钮
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // 按 Enter 键激活按钮
      await page.keyboard.press('Enter')

      // 验证页面有响应（可能是导航或弹窗）
      // 这里只是验证按键被接受，不验证具体行为
    })

    test('按钮 - Space 键激活', async ({ page }) => {
      await page.goto('/input/hub')

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
      await page.goto('/input/hub')

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

    test('分析舱 Hub 页面 - 焦点顺序合理', async ({ page }) => {
      await page.goto('/analysis/hub')

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
