import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3002' })

test('验证输入舱结构', async ({ page }) => {
  await page.goto('/#/input')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  
  // 获取页面上所有可见的heading
  const headings = await page.getByRole('heading').all()
  console.log('=== Headings ===')
  for (const h of headings) {
    const text = await h.textContent()
    if (text?.trim()) console.log('  H:', text.trim())
  }
  
  // 获取所有可见的button
  const buttons = await page.getByRole('button').all()
  console.log('=== Buttons (first 20) ===')
  let count = 0
  for (const b of buttons) {
    if (count >= 20) break
    const text = await b.textContent()
    const visible = await b.isVisible()
    if (visible && text?.trim()) {
      console.log('  Btn:', text.trim())
      count++
    }
  }
  
  // 获取所有tab
  const tabs = await page.getByRole('tab').all()
  console.log('=== Tabs ===')
  for (const t of tabs) {
    const text = await t.textContent()
    if (text?.trim()) console.log('  Tab:', text.trim())
  }
  
  console.log('=== Page URL:', page.url())
})
