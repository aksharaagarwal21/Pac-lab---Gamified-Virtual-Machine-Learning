import { test, expect } from '@playwright/test'

const human = (code) => code.split('\n').map((line) => line.trimStart())

// Types code line by line like a student: text, then Enter (indentation is filled in by the app).
async function typeCode(page, code, delay = 0) {
  const lines = human(code)
  for (const [i, line] of lines.entries()) {
    await page.keyboard.type(line, { delay })
    if (i < lines.length - 1) await page.keyboard.press('Enter')
  }
}

const progressState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ml-maze-progress:guest') || '{}'))

test.beforeEach(async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.__errors = errors
})

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([])
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('experiment 1: the whole program is typed part by part, paste is refused, mistakes must be fixed', async ({ page }) => {
    await page.goto('/tests/fixtures/speed-code.html')
    await expect(page.locator('.lab-speed-callout')).toContainText('Required: Speed Code')
    await page.getByRole('button', { name: 'Open Speed Code' }).click()
    await expect(page.locator('.sc-badge')).toHaveText('REQUIRED')
    await expect(page.locator('.sc-parts li')).toHaveCount(6)
    await page.screenshot({ path: 'test-results/speed-overview.png', fullPage: true })

    await page.getByRole('button', { name: /START SPEED CODE/ }).click()
    await expect(page.locator('.sc-part-title')).toHaveText('Load the raw data')
    const input = page.locator('.sc-input')
    await expect(input).toBeFocused()

    // Paste is refused.
    await input.evaluate((el) => {
      const data = new DataTransfer()
      data.setData('text/plain', 'rows = []')
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await expect(page.locator('.sc-notice')).toContainText('Paste is turned off')
    await expect(page.locator('.sc-ok')).toHaveCount(0)

    // A mistake shows in red and too many block input until fixed.
    await page.keyboard.type('rowz')
    await expect(page.locator('.sc-bad')).toHaveCount(1)
    await page.keyboard.type('zzzzzzzzzzzz')
    await expect(page.locator('.sc-notice')).toContainText('Fix the red characters')
    await page.keyboard.press('Control+Backspace')
    await page.keyboard.press('Control+Backspace')
    await expect(page.locator('.sc-bad')).toHaveCount(0)

    const part1 = 'rows = [\n    {"age": 25, "salary": 40000, "city": "Pune"},\n    {"age": None, "salary": 52000, "city": "Delhi"},'
    await typeCode(page, part1, 5)
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'test-results/speed-typing.png', fullPage: true })
    expect(Number(await page.locator('.sc-hud dd.is-wpm').innerText())).toBeGreaterThan(0)

    await page.keyboard.press('Enter')
    await typeCode(page, `{"age": 31, "salary": None, "city": "Pune"},
{"age": 45, "salary": 91000, "city": "Mumbai"},
{"age": 38, "salary": 64000, "city": None},
]
print("rows:", len(rows))`)
    await expect(page.locator('.sc-part-done')).toContainText('PART 1 / 6 COMPLETE')
    await page.screenshot({ path: 'test-results/speed-part-done.png', fullPage: true })

    // Progress is saved: leaving and coming back resumes at part 2.
    const saved = await progressState(page)
    expect(saved.typing['1'].attempt.parts[0].keys).toBeGreaterThan(100)
    await page.reload()
    await page.getByRole('button', { name: 'Open Speed Code' }).click()
    await expect(page.getByRole('button', { name: /CONTINUE WITH PART 2/ })).toBeVisible()
  })

  test('finishing every part runs the program and records the requirement', async ({ page }) => {
    await page.goto('/tests/fixtures/speed-code.html?short')
    await page.getByRole('button', { name: 'Open Speed Code' }).click()
    await page.getByRole('button', { name: /START SPEED CODE/ }).click()
    await typeCode(page, 'x = [\n    1,\n]')
    await page.getByRole('button', { name: /NEXT PART/ }).click()
    await typeCode(page, 'print("done")')
    await expect(page.locator('.sc-finished')).toContainText('SPEED CODE COMPLETE')
    await expect(page.locator('.sc-unlock')).toContainText('Pass this experiment’s posttest')
    const saved = await progressState(page)
    expect(saved.typing['1'].completions).toBe(1)
    expect(saved.typing['1'].attempt).toBeNull()
    await expect(page.locator('.lab-console pre')).toContainText('done', { timeout: 90000 })
    await page.screenshot({ path: 'test-results/speed-finished.png', fullPage: true })

    // With the posttest also passed, the next experiment opens.
    await page.evaluate(() => {
      const key = 'ml-maze-progress:guest'
      const state = JSON.parse(localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify({ ...state, cleared: { 1: { stars: 3 } }, savedAt: Date.now() }))
    })
    await page.reload()
    await expect(page.locator('.lab-speed-callout')).toHaveCount(0)
    await page.getByRole('tab', { name: /Speed Code/ }).click()
    await expect(page.locator('.sc-badge')).toHaveText('✓ COMPLETED')
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test('speed code fits a phone', async ({ page }) => {
    await page.goto('/tests/fixtures/speed-code.html')
    await page.getByRole('button', { name: 'Open Speed Code' }).click()
    await page.getByRole('button', { name: /START SPEED CODE/ }).click()
    await page.keyboard.type('rows = [')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: 'test-results/speed-phone.png', fullPage: true })
  })
})
