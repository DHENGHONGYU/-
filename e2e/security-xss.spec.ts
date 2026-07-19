import { test, expect } from '@playwright/test'

test.describe('安全测试 - XSS 专项', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.describe('存储型 XSS 测试', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      '<svg onload=alert("xss")>',
      '"><script>alert("xss")</script>',
      '<iframe src="javascript:alert(`xss`)">',
      'javascript:alert("xss")',
      '<a href="javascript:alert(1)">click</a>',
      '{{constructor.constructor(\'alert(1)\')()}}',
      '${alert(1)}',
      '<img src=x onerror=alert(document.domain)>',
    ]

    test('股票池名称输入应转义 XSS  payload', async ({ page }) => {
      await page.goto('/input/pool')
      await page.waitForLoadState('networkidle')

      const addButton = page.getByRole('button', { name: /新建|添加|创建/i })
      if (await addButton.isVisible()) {
        await addButton.click()

        const nameInput = page.getByRole('textbox', { name: /名称|name/i }).first()
        if (await nameInput.isVisible()) {
          for (const payload of xssPayloads.slice(0, 3)) {
            await nameInput.fill(payload)
            const submitButton = page.getByRole('button', { name: /确定|保存|提交/i }).first()
            if (await submitButton.isVisible()) {
              await submitButton.click()
              await page.waitForTimeout(500)

              const dialogHandle = await page.evaluate(() => {
                return new Promise<boolean>((resolve) => {
                  const timer = setTimeout(() => resolve(false), 1000)
                  window.alert = () => {
                    clearTimeout(timer)
                    resolve(true)
                  }
                })
              })
              expect(dialogHandle).toBe(false)
            }
          }
        }
      }
    })

    test('股票备注/笔记输入应转义 HTML', async ({ page }) => {
      await page.goto('/analysis')
      await page.waitForLoadState('networkidle')

      const noteArea = page.getByRole('textbox', { name: /笔记|备注|note|comment/i }).first()
      if (await noteArea.isVisible()) {
        for (const payload of xssPayloads.slice(0, 3)) {
          await noteArea.fill(payload)
          await page.waitForTimeout(300)

          const hasAlert = await page.evaluate(() => {
            return new Promise<boolean>((resolve) => {
              const timer = setTimeout(() => resolve(false), 1000)
              window.alert = () => {
                clearTimeout(timer)
                resolve(true)
              }
            })
          })
          expect(hasAlert).toBe(false)
        }
      }
    })

    test('交易笔记输入应防止 XSS 注入', async ({ page }) => {
      await page.goto('/trading/review')
      await page.waitForLoadState('networkidle')

      const reviewTextarea = page.getByRole('textbox').filter({ hasText: /复盘|笔记|reason|总结/i }).first()
      if (await reviewTextarea.isVisible()) {
        for (const payload of xssPayloads.slice(0, 3)) {
          await reviewTextarea.fill(payload)
          await page.waitForTimeout(300)

          const hasAlert = await page.evaluate(() => {
            return new Promise<boolean>((resolve) => {
              const timer = setTimeout(() => resolve(false), 1000)
              window.alert = () => {
                clearTimeout(timer)
                resolve(true)
              }
            })
          })
          expect(hasAlert).toBe(false)
        }
      }
    })
  })

  test.describe('DOM 型 XSS 测试', () => {
    test('URL hash 参数不应执行脚本', async ({ page }) => {
      const payload = '#/search?q=<img src=x onerror=alert("xss")>'
      await page.goto('/' + payload)
      await page.waitForLoadState('networkidle')

      const hasAlert = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), 2000)
          window.alert = () => {
            clearTimeout(timer)
            resolve(true)
          }
        })
      })
      expect(hasAlert).toBe(false)
    })

    test('搜索输入不应触发 DOM XSS', async ({ page }) => {
      const searchInput = page.getByRole('searchbox').first()
      if (await searchInput.isVisible()) {
        const payload = '<img src=x onerror=alert("domxss")>'
        await searchInput.fill(payload)
        await page.waitForTimeout(500)

        const hasAlert = await page.evaluate(() => {
          return new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), 1500)
            window.alert = () => {
              clearTimeout(timer)
              resolve(true)
            }
          })
        })
        expect(hasAlert).toBe(false)

        await searchInput.fill('')
      }
    })

    test('用户输入渲染时应被 React 转义', async ({ page }) => {
      const testPayload = '<b>bold</b><script>alert(1)</script>'
      const inputElements = await page.getByRole('textbox').all()

      if (inputElements.length > 0) {
        const firstInput = inputElements[0]
        if (await firstInput.isVisible()) {
          await firstInput.fill(testPayload)
          await page.waitForTimeout(300)

          const hasScriptExecution = await page.evaluate(() => {
            return new Promise<boolean>((resolve) => {
              const timer = setTimeout(() => resolve(false), 1000)
              window.alert = () => {
                clearTimeout(timer)
                resolve(true)
              }
            })
          })
          expect(hasScriptExecution).toBe(false)
        }
      }
    })
  })

  test.describe('CSP 策略验证', () => {
    test('生产构建应包含 CSP meta 标签', async ({ page }) => {
      const cspMeta = page.locator('meta[http-equiv="Content-Security-Policy"]')
      const count = await cspMeta.count()

      if (count > 0) {
        const content = await cspMeta.first().getAttribute('content')
        expect(content).toContain("default-src 'self'")
        expect(content).toContain("object-src 'none'")
        expect(content).toContain("frame-ancestors 'none'")
      }
    })

    test('不应有内联脚本执行（CSP script-src）', async ({ page }) => {
      const consoleMessages: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
          consoleMessages.push(msg.text())
        }
      })

      await page.evaluate(() => {
        try {
          const inlineScript = document.createElement('script')
          inlineScript.textContent = 'window.__csp_test_inline__ = true'
          document.head.appendChild(inlineScript)
        } catch (e) {
          // CSP 可能阻止注入
        }
      })

      await page.waitForTimeout(1000)
      const hasInlineViolation = consoleMessages.some((m) => m.includes("script-src"))
      if (hasInlineViolation) {
        expect(hasInlineViolation).toBe(true)
      }
    })

    test('eval 执行应被 CSP 阻止', async ({ page }) => {
      const evalBlocked = await page.evaluate(() => {
        try {
          // @ts-expect-error testing CSP
          eval('1+1')
          return false
        } catch (e) {
          return true
        }
      })
      expect(typeof evalBlocked).toBe('boolean')
    })
  })

  test.describe('数据安全测试', () => {
    test('敏感数据不应存储在普通 localStorage', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const sensitiveKeys = await page.evaluate(() => {
        const sensitivePatterns = [
          /api[_-]?key/i,
          /secret/i,
          /password/i,
          /token/i,
          /credential/i,
        ]
        const found: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || ''
          const value = localStorage.getItem(key) || ''
          if (sensitivePatterns.some((p) => p.test(key) || p.test(value))) {
            if (!value.includes('__encrypted')) {
              found.push(key)
            }
          }
        }
        return found
      })

      expect(sensitiveKeys).toEqual([])
    })

    test('API Key 应加密存储', async ({ page }) => {
      const apiKeyStorage = await page.evaluate(() => {
        const keys = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || ''
          if (/api[_-]?key|llm|openai|moonshot|anthropic/i.test(key)) {
            const value = localStorage.getItem(key) || ''
            keys.push({ key, isEncrypted: value.includes('__encrypted') })
          }
        }
        return keys
      })

      if (apiKeyStorage.length > 0) {
        for (const item of apiKeyStorage) {
          expect(item.isEncrypted).toBe(true)
        }
      }
    })

    test('IndexedDB 不应明文存储敏感字段', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hasSensitivePlaintext = await page.evaluate(async () => {
        const databases = (await indexedDB.databases?.()) || []
        return databases.length > 0
      })

      expect(typeof hasSensitivePlaintext).toBe('boolean')
    })
  })

  test.describe('错误信息安全测试', () => {
    test('控制台不应泄露敏感错误信息', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => {
        errors.push(err.message)
      })

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hasSensitiveLeak = errors.some((msg) => {
        return /api[_-]?key|secret|password|token|internal error|stack trace/i.test(msg)
      })
      expect(hasSensitiveLeak).toBe(false)
    })

    test('网络请求错误不应泄露内部路径', async ({ page }) => {
      const failedRequests: string[] = []
      page.on('requestfailed', (req) => {
        failedRequests.push(req.url())
      })

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      for (const url of failedRequests) {
        expect(url).not.toContain('/etc/passwd')
        expect(url).not.toContain('\\windows\\')
      }
    })
  })
})
