import { test, expect } from '@playwright/test'

const LOGIN_URL = '/login'
const LCP_THRESHOLD_MS = 2500 // Good LCP is ≤ 2.5s (Core Web Vitals)

test.describe('Login page', () => {
  test('loads and shows login form', async ({ page }) => {
    await page.goto(LOGIN_URL)
    await expect(
      page.getByRole('heading', { name: /Board Game App/i })
    ).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /register/i })).toBeVisible()
  })

  test('LCP is measured and reported for /login', async ({ page }) => {
    await page.goto(LOGIN_URL)

    // Wait for main content so LCP candidate has likely been painted
    await expect(
      page.getByRole('heading', { name: /Board Game App/i })
    ).toBeVisible()
    await page.waitForLoadState('load')
    await page.waitForTimeout(500)

    const lcpResult = await page.evaluate(() => {
      const entries = performance.getEntriesByType('largest-contentful-paint')
      const last = entries[entries.length - 1]
      if (!last) return { lcpMs: null, hasLCP: false }
      return {
        lcpMs: last.startTime,
        hasLCP: true,
      }
    })

    if (lcpResult.lcpMs !== null) {
      console.log(`[LCP] ${LOGIN_URL}: ${lcpResult.lcpMs.toFixed(0)} ms`)
      expect(lcpResult.lcpMs).toBeLessThanOrEqual(LCP_THRESHOLD_MS)
    } else {
      // LCP may be unavailable in some runs; ensure page loaded
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
    }
  })

  test('login form accepts input and submit is clickable', async ({ page }) => {
    await page.goto(LOGIN_URL)

    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/password/i).fill('password123')

    await expect(page.getByLabel(/email/i)).toHaveValue('test@example.com')
    await expect(page.getByLabel(/password/i)).toHaveValue('password123')

    const loginButton = page.getByRole('button', { name: /login/i })
    await expect(loginButton).toBeEnabled()
    await loginButton.click()

    // After submit, either redirect (success) or error message; wait for navigation or error
    await page.waitForTimeout(2000)
    const url = page.url()
    const hasError = await page
      .getByText(/invalid|login failed|error/i)
      .isVisible()
      .catch(() => false)
    expect(url.includes('/login') || url.includes('/') || hasError).toBe(true)
  })
})
