import { expect, test } from '@playwright/test'

test('production pages render and transform without CSP violations', async ({ page }) => {
  const violations: string[] = []
  await page.exposeFunction('recordCspViolation', (message: string) => violations.push(message))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      void (window as unknown as { recordCspViolation: (message: string) => Promise<void> })
        .recordCspViolation(`${event.effectiveDirective}: ${event.blockedURI}`)
    })
  })
  page.on('console', (message) => {
    if (message.type() === 'error') violations.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tools for SOC analysts' })).toBeVisible()
  await page.goto('/tools/base64')
  await expect(page.getByRole('heading', { name: 'Base64 encode/decode' })).toBeVisible()
  await page.locator('#base64-input').fill('SOC')
  await expect(page.locator('#base64-output')).toHaveValue('U09D')
  expect(violations).toEqual([])
})
