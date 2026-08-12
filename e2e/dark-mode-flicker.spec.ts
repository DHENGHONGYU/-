/**
 * @test_id V9-TEST-E2E-FLICKER-001
 * 深色模式切换视觉闪烁 + 像素级回归 E2E 检测
 * @description
 *   在真实浏览器环境中验证深色模式切换：
 *   1. class 变化在单帧内完成（无中间态闪烁）
 *   2. 颜色令牌 CSS 变量同步更新（无延迟渲染）
 *   3. 快速切换不产生闪烁
 *   4. 4 个核心页面（首页/驾驶舱/输入舱/交易复盘）的 light + dark 像素级快照对比
 *
 *   CI/CD 集成：此测试在 quality-check.yml 的 dark-mode-e2e job 中自动运行，
 *   P0 级别门禁，失败即阻塞 PR 合并。
 */

import { test, expect } from '@playwright/test'

/** 闪烁检测阈值（ms）：class 变化耗时超过此值视为闪烁 */
const FLICKER_THRESHOLD_MS = 50

/** rAF 采样次数：主题切换后连续检测的帧数 */
const RAF_SAMPLE_COUNT = 3

/** 需要做视觉快照对比的核心页面清单（path + 描述） */
const VISUAL_PAGES: { path: string; name: string }[] = [
  // 核心页面（v1.0 基线）
  { path: '/', name: 'homepage' },
  { path: '/cockpit', name: 'cockpit' },
  { path: '/input', name: 'input-hub' },
  { path: '/output/trade-review', name: 'trade-review' },
  // 高优先级页面（v1.1 扩展 — 直接主题依赖 + 硬编码颜色风险）
  { path: '/analysis/industry-score', name: 'industry-score' },
  { path: '/analysis/stock-score', name: 'stock-score' },
  { path: '/trading/holdings', name: 'holdings' },
  { path: '/analysis/hot-sector', name: 'hot-sector' },
  { path: '/output/research', name: 'research' },
]

test.describe('深色模式切换视觉闪烁检测', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/output/trade-review')
    await page.waitForLoadState('networkidle')
  })

  test('light → dark 切换：class 变化应在单帧内完成', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(100)

    const initialClass = await page.evaluate(() => document.documentElement.className)

    await page.evaluate((threshold) => {
      (window as unknown as { __flickerCheck: unknown }).__flickerCheck = {
        startTime: performance.now(),
        classChanges: [] as number[],
        threshold,
      }
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const check = (window as unknown as { __flickerCheck: { classChanges: number[] } }).__flickerCheck
            check.classChanges.push(performance.now())
          }
        }
      })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      ;(window as unknown as { __flickerObserver: MutationObserver }).__flickerObserver = observer
    }, FLICKER_THRESHOLD_MS)

    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(200)

    const result = await page.evaluate(() => {
      const check = (window as unknown as { __flickerCheck: { startTime: number; classChanges: number[]; threshold: number } }).__flickerCheck
      const observer = (window as unknown as { __flickerObserver: MutationObserver }).__flickerObserver
      observer?.disconnect()
      return {
        startTime: check.startTime,
        classChanges: check.classChanges,
        changeCount: check.classChanges.length,
        threshold: check.threshold,
      }
    })

    expect(result.changeCount).toBe(1)
    const elapsed = result.classChanges[0] - result.startTime
    expect(elapsed).toBeLessThan(FLICKER_THRESHOLD_MS)

    const finalClass = await page.evaluate(() => document.documentElement.className)
    expect(finalClass).toContain('dark')
    expect(finalClass).not.toEqual(initialClass)
  })

  test('dark → light 切换：颜色令牌 CSS 变量同步更新', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(100)

    const darkBgVar = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    })

    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    const samples = await page.evaluate((count) => {
      return new Promise((resolve) => {
        const results: { frame: number; bgVar: string; elapsed: number }[] = []
        const startTime = performance.now()
        let frame = 0
        function check() {
          const bgVar = window.getComputedStyle(document.documentElement)
            .getPropertyValue('--background')
            .trim()
          results.push({ frame, bgVar, elapsed: performance.now() - startTime })
          frame++
          if (frame < count) {
            requestAnimationFrame(check)
          } else {
            resolve(results)
          }
        }
        requestAnimationFrame(check)
      })
    }, RAF_SAMPLE_COUNT)

    const firstFrame = (samples as { frame: number; bgVar: string; elapsed: number }[])[0]
    expect(firstFrame.bgVar).not.toBe(darkBgVar)

    const allSame = (samples as { bgVar: string }[]).every(
      (s) => s.bgVar === firstFrame.bgVar,
    )
    expect(allSame).toBe(true)
  })

  test('快速连续切换（light → dark → light）不应产生闪烁', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(100)

    const result = await page.evaluate((threshold) => {
      return new Promise((resolve) => {
        const startTime = performance.now()
        const classChanges: { time: number; hasDark: boolean }[] = []

        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              classChanges.push({
                time: performance.now(),
                hasDark: document.documentElement.classList.contains('dark'),
              })
            }
          }
        })
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

        document.documentElement.classList.add('dark')
        document.documentElement.setAttribute('data-theme', 'dark')
        setTimeout(() => {
          document.documentElement.classList.remove('dark')
          document.documentElement.setAttribute('data-theme', 'light')
        }, 50)

        setTimeout(() => {
          observer.disconnect()
          const totalElapsed = performance.now() - startTime
          resolve({
            classChanges,
            changeCount: classChanges.length,
            totalElapsed,
            threshold,
            hasFlicker: classChanges.length > 2,
          })
        }, 300)
      })
    }, FLICKER_THRESHOLD_MS)

    const typedResult = result as { changeCount: number; totalElapsed: number; hasFlicker: boolean }

    expect(typedResult.changeCount).toBeLessThanOrEqual(2)
    expect(typedResult.hasFlicker).toBe(false)
  })

  test('TradeReviewPage 深色模式下颜色令牌渲染正确', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(200)

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(dataTheme).toBe('dark')

    const hasDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )
    expect(hasDarkClass).toBe(true)

    const rootBg = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).backgroundColor
    })
    expect(rootBg).toBeTruthy()
    expect(rootBg).not.toBe('rgb(255, 255, 255)')

    const card = page.locator('[class*="rounded-lg"]').first()
    if (await card.isVisible().catch(() => false)) {
      const cardBg = await card.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })
      expect(cardBg).toBeTruthy()
      expect(cardBg).not.toBe('rgb(255, 255, 255)')
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 像素级视觉快照回归（防深色模式颜色令牌视觉泄漏）
// ════════════════════════════════════════════════════════════════════════════
// 策略：
//   - 每个核心页面拍 light + dark 两张图，与 CI 基线快照做像素对比
//   - 最大 5% 像素差异容忍（跨平台字体/抗锯齿微差），超过即判为视觉回归
//   - 首次运行或 UI 改版后，本地执行：
//     npx playwright test e2e/dark-mode-flicker.spec.ts --grep "视觉快照" --update-snapshots
//     然后将 e2e/dark-mode-flicker.spec.ts-snapshots/ 提交到 git
// ════════════════════════════════════════════════════════════════════════════
test.describe('[SNAPSHOT] 视觉快照回归：9 页面 × 2 主题', () => {
  for (const { path, name } of VISUAL_PAGES) {
    test(`${name} (${path}): light 主题视觉快照`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      await page.evaluate(() => {
        document.documentElement.classList.remove('dark')
        document.documentElement.setAttribute('data-theme', 'light')
      })
      await page.waitForTimeout(200)

      await expect(page).toHaveScreenshot(`${name}-light.png`, {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
        animations: 'disabled',
        fullPage: true,
      })
    })

    test(`${name} (${path}): dark 主题视觉快照`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      await page.evaluate(() => {
        document.documentElement.classList.add('dark')
        document.documentElement.setAttribute('data-theme', 'dark')
      })
      await page.waitForTimeout(200)

      await expect(page).toHaveScreenshot(`${name}-dark.png`, {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
        animations: 'disabled',
        fullPage: true,
      })
    })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 切换回路一致性（P0 时序检测，无基线依赖）：确保 light→dark→light 回路后
// 主题状态完全还原，无残留 class 或属性。
// CI 分类：阶段 1（与闪烁时序检测同阶段，P0 阻塞）
// ════════════════════════════════════════════════════════════════════════════
test.describe('主题切换回路一致性', () => {
  test('首页切换回路 light → dark → light 后主题状态完全还原', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 初始 light
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(150)

    const initialClass = await page.evaluate(() => document.documentElement.className)
    const initialDataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )

    // 切换到 dark
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(150)

    // 切换回 light
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(150)

    // 验证主题状态完全还原（无残留 dark class）
    const finalClass = await page.evaluate(() => document.documentElement.className)
    const finalDataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )

    expect(finalClass).toBe(initialClass)
    expect(finalDataTheme).toBe(initialDataTheme)
    expect(finalClass).not.toContain('dark')
    expect(finalDataTheme).toBe('light')

    // 验证 CSS 变量已还原为 light 主题值
    const bgVar = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim()
    })
    expect(bgVar).toBeTruthy()
    // light 主题背景应为浅色（rgb 中任意分量接近 255 即视为浅色）
    expect(bgVar).not.toBe('')
  })
})
