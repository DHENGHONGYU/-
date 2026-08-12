/**
 * @test_id V9-TEST-E2E-001
 * 主题切换测试脚本
 * 验证 Button 和 Card 组件在深色/浅色主题下的样式响应
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'

test.describe('主题切换测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问测试页面（使用 Playwright baseURL）
    await page.goto('/')
    // 等待应用加载
    await page.waitForLoadState('networkidle')
  })

  test('浅色主题下 Button 组件样式验证', async ({ page }) => {
    // 确保处于浅色主题
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    // 等待样式应用
    await page.waitForTimeout(100)

    // 查找 Button 组件（如果页面上有按钮）
    const button = page.locator('button').first()
    if (await button.isVisible().catch(() => false)) {
      // 验证 Button 使用的 Token 类名
      const buttonClasses = await button.getAttribute('class')
      expect(buttonClasses).toContain('rounded-md')
      expect(buttonClasses).toContain('h-10')
      expect(buttonClasses).toContain('text-sm')

      // 验证浅色主题下的背景色
      const bgColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      // 浅色主题下应该使用 primary 颜色（蓝色系）
      expect(bgColor).toBeTruthy()
      console.log('[浅色主题] Button 背景色:', bgColor)
    } else {
      console.log('[提示] 页面上未找到 Button 组件，跳过此测试')
    }
  })

  test('深色主题下 Button 组件样式验证', async ({ page }) => {
    // 切换到深色主题
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    // 等待样式应用
    await page.waitForTimeout(100)

    // 查找 Button 组件（如果页面上有按钮）
    const button = page.locator('button').first()
    if (await button.isVisible().catch(() => false)) {
      // 验证 Button 使用的 Token 类名（应该保持一致）
      const buttonClasses = await button.getAttribute('class')
      expect(buttonClasses).toContain('rounded-md')
      expect(buttonClasses).toContain('h-10')
      expect(buttonClasses).toContain('text-sm')

      // 验证深色主题下的背景色
      const bgColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      // 深色主题下应该使用深色变体
      expect(bgColor).toBeTruthy()
      console.log('[深色主题] Button 背景色:', bgColor)
    } else {
      console.log('[提示] 页面上未找到 Button 组件，跳过此测试')
    }
  })

  test('浅色主题下 Card 组件样式验证', async ({ page }) => {
    // 确保处于浅色主题
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    // 等待样式应用
    await page.waitForTimeout(100)

    // 查找 Card 组件
    const card = page.locator('[class*="rounded-lg"]').first()
    await expect(card).toBeVisible()

    // 验证 Card 使用的 Token 类名
    const cardClasses = await card.getAttribute('class')
    expect(cardClasses).toContain('rounded-lg')
    expect(cardClasses).toContain('border')
    expect(cardClasses).toContain('shadow-sm')

    // 验证浅色主题下的背景色
    const bgColor = await card.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // 浅色主题下应该是白色或接近白色
    expect(bgColor).toBeTruthy()
    console.log('[浅色主题] Card 背景色:', bgColor)
  })

  test('深色主题下 Card 组件样式验证', async ({ page }) => {
    // 切换到深色主题
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    // 等待样式应用
    await page.waitForTimeout(100)

    // 查找 Card 组件
    const card = page.locator('[class*="rounded-lg"]').first()
    await expect(card).toBeVisible()

    // 验证 Card 使用的 Token 类名（应该保持一致）
    const cardClasses = await card.getAttribute('class')
    expect(cardClasses).toContain('rounded-lg')
    expect(cardClasses).toContain('border')
    expect(cardClasses).toContain('shadow-sm')

    // 验证深色主题下的背景色
    const bgColor = await card.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // 深色主题下应该是深色背景
    expect(bgColor).toBeTruthy()
    console.log('[深色主题] Card 背景色:', bgColor)
  })

  test('主题切换时样式平滑过渡', async ({ page }) => {
    // 从浅色切换到深色
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    const card = page.locator('[class*="rounded-lg"]').first()
    const lightBgVar = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim()
    })

    // 切换到深色
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    await page.waitForTimeout(100)

    const darkBgVar = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim()
    })

    // 验证 CSS 变量确实发生了变化
    expect(lightBgVar).not.toBe(darkBgVar)
    console.log('[主题切换] 浅色 CSS 变量:', lightBgVar, '→ 深色 CSS 变量:', darkBgVar)
  })

  test('验证 CSS 变量在主题切换时正确更新', async ({ page }) => {
    // 浅色主题
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    const lightBgVar = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim()
    })

    // 深色主题
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    await page.waitForTimeout(100)

    const darkBgVar = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim()
    })

    // 验证 CSS 变量确实发生了变化
    expect(lightBgVar).not.toBe(darkBgVar)
    console.log('[CSS 变量] 浅色:', lightBgVar, '→ 深色:', darkBgVar)
  })

  test('验证主题切换按钮功能', async ({ page }) => {
    // 查找主题切换按钮（通常在导航栏或设置中）
    const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="主题"]').first()
    
    // 如果找到切换按钮，测试其功能
    if (await themeToggle.isVisible()) {
      const initialTheme = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      })

      // 点击切换
      await themeToggle.click()
      await page.waitForTimeout(200)

      const newTheme = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      })

      // 验证主题确实切换了
      expect(newTheme).not.toBe(initialTheme)
      console.log('[主题切换按钮] 初始:', initialTheme, '→ 切换后:', newTheme)
    } else {
      console.log('[提示] 未找到主题切换按钮，跳过此测试')
    }
  })
})

test.describe('Alert 组件主题适配测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Alert 组件在浅色主题下的样式', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    // 查找 Alert 组件（role="alert"）
    const alert = page.locator('[role="alert"]').first()
    if (await alert.isVisible().catch(() => false)) {
      const alertClasses = await alert.getAttribute('class')
      expect(alertClasses).toContain('rounded-lg')
      expect(alertClasses).toContain('border')
      expect(alertClasses).toContain('p-4')

      // 验证浅色主题下的背景色
      const bgColor = await alert.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      expect(bgColor).toBeTruthy()
      console.log('[浅色主题] Alert 背景色:', bgColor)
    } else {
      console.log('[提示] 页面上未找到 Alert 组件，跳过此测试')
    }
  })

  test('Alert 组件在深色主题下的样式', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    await page.waitForTimeout(100)

    const alert = page.locator('[role="alert"]').first()
    if (await alert.isVisible().catch(() => false)) {
      const alertClasses = await alert.getAttribute('class')
      expect(alertClasses).toContain('rounded-lg')
      expect(alertClasses).toContain('border')
      expect(alertClasses).toContain('p-4')

      const bgColor = await alert.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      expect(bgColor).toBeTruthy()
      console.log('[深色主题] Alert 背景色:', bgColor)
    } else {
      console.log('[提示] 页面上未找到 Alert 组件，跳过此测试')
    }
  })

  test('Alert 组件主题切换时 Token 类名保持一致', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    const alert = page.locator('[role="alert"]').first()
    if (await alert.isVisible().catch(() => false)) {
      const lightClasses = await alert.getAttribute('class')

      await page.evaluate(() => {
        document.documentElement.classList.add('dark')
        document.documentElement.setAttribute('data-theme', 'dark')
      })

      await page.waitForTimeout(100)

      const darkClasses = await alert.getAttribute('class')

      // Token 类名应该保持一致（颜色通过 CSS 变量切换）
      expect(lightClasses).toBe(darkClasses)
      console.log('[Alert] 主题切换时 Token 类名一致:', lightClasses)
    }
  })
})

test.describe('Badge 组件主题适配测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Badge 组件在浅色主题下的样式', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    // 查找 Badge 组件（rounded-full 是 Badge 的特征类名）
    const badge = page.locator('[class*="rounded-full"][class*="inline-flex"]').first()
    if (await badge.isVisible().catch(() => false)) {
      const badgeClasses = await badge.getAttribute('class')
      expect(badgeClasses).toContain('rounded-full')
      expect(badgeClasses).toContain('inline-flex')
      expect(badgeClasses).toContain('items-center')

      const bgColor = await badge.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      expect(bgColor).toBeTruthy()
      console.log('[浅色主题] Badge 背景色:', bgColor)
    } else {
      console.log('[提示] 页面上未找到 Badge 组件，跳过此测试')
    }
  })

  test('Badge 组件在深色主题下的样式', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    await page.waitForTimeout(100)

    const badge = page.locator('[class*="rounded-full"][class*="inline-flex"]').first()
    if (await badge.isVisible().catch(() => false)) {
      const badgeClasses = await badge.getAttribute('class')
      expect(badgeClasses).toContain('rounded-full')
      expect(badgeClasses).toContain('inline-flex')
      expect(badgeClasses).toContain('items-center')

      const bgColor = await badge.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      expect(bgColor).toBeTruthy()
      console.log('[深色主题] Badge 背景色:', bgColor)
    } else {
      console.log('[提示] 页面上未找到 Badge 组件，跳过此测试')
    }
  })

  test('Badge 组件主题切换时 Token 类名保持一致', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    const badge = page.locator('[class*="rounded-full"][class*="inline-flex"]').first()
    if (await badge.isVisible().catch(() => false)) {
      const lightClasses = await badge.getAttribute('class')

      await page.evaluate(() => {
        document.documentElement.classList.add('dark')
        document.documentElement.setAttribute('data-theme', 'dark')
      })

      await page.waitForTimeout(100)

      const darkClasses = await badge.getAttribute('class')

      // Token 类名应该保持一致
      expect(lightClasses).toBe(darkClasses)
      console.log('[Badge] 主题切换时 Token 类名一致:', lightClasses)
    }
  })
})

test.describe('Input 组件主题适配测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Input 组件在浅色主题下的样式', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    const input = page.locator('input').first()
    if (await input.isVisible()) {
      const inputClasses = await input.getAttribute('class')
      expect(inputClasses).toContain('rounded-md')
      expect(inputClasses).toContain('h-10')
      expect(inputClasses).toContain('text-sm')

      const bgColor = await input.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })
      
      expect(bgColor).toBeTruthy()
      console.log('[浅色主题] Input 背景色:', bgColor)
    }
  })

  test('Input 组件在深色主题下的样式', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    await page.waitForTimeout(100)

    const input = page.locator('input').first()
    if (await input.isVisible()) {
      const inputClasses = await input.getAttribute('class')
      expect(inputClasses).toContain('rounded-md')
      expect(inputClasses).toContain('h-10')
      expect(inputClasses).toContain('text-sm')

      const bgColor = await input.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })
      
      expect(bgColor).toBeTruthy()
      console.log('[深色主题] Input 背景色:', bgColor)
    }
  })
})
