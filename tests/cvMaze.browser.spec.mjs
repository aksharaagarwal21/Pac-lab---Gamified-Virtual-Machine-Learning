import { test, expect } from '@playwright/test'

const arcade = (page) => page.locator('.cvm-arcade')
const clearDialog = (page) => page.locator('.cvm-clear')

async function startGame(page, k = 3) {
  await page.getByRole('button', { name: /START GAME/ }).click()
  await page.getByRole('button', { name: new RegExp(`${k} FOLDS`) }).click()
  await page.getByRole('button', { name: /ENTER THE MAZE/ }).click()
}

// Fast-forwards whatever phase is running until the round's result card appears.
async function skipToClear(page) {
  const skip = page.locator('.cvm-controls > button').nth(1)
  for (let i = 0; i < 8 && !(await clearDialog(page).isVisible()); i++) {
    if (await skip.isEnabled()) await skip.click()
    await page.waitForTimeout(80)
  }
  await expect(clearDialog(page)).toBeVisible()
}

async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test.beforeEach(async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.__errors = errors
  await page.goto('/tests/fixtures/cv-maze.html')
  await expect(arcade(page)).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([])
  expect(await arcade(page).innerText()).not.toMatch(/NaN|Infinity|undefined/)
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('plays a full 3-fold run: training, unseen zone, results, bonus and quiz', async ({ page }) => {
    await page.screenshot({ path: 'test-results/cvmaze-intro.png', fullPage: true })
    await startGame(page, 3)
    await expect(page.locator('.cvm-round')).toHaveText(/ROUND 1 \/ 3/)

    // Training: the player really eats pellets and the ML view counts them.
    await expect(page.locator('.cvm-board .cvm-svg')).toBeVisible()
    await expect.poll(() => page.locator('.cvm-pellet.is-eaten').count()).toBeGreaterThan(3)
    await page.screenshot({ path: 'test-results/cvmaze-training.png', fullPage: true })

    // Pause explains what is happening, and the clock stops.
    await page.keyboard.press('p')
    await expect(page.getByRole('dialog', { name: /WHAT IS HAPPENING/ })).toContainText('Fold 1 is hidden from training')
    const eaten = await page.locator('.cvm-pellet.is-eaten').count()
    await page.waitForTimeout(500)
    expect(await page.locator('.cvm-pellet.is-eaten').count()).toBe(eaten)
    await page.getByRole('button', { name: 'Resume' }).first().click()

    // Unseen zone at 3× speed, played to the end.
    await page.getByRole('button', { name: '3×' }).click()
    await expect(page.locator('.cvm-test-board')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.cvm-node.is-defeated, .cvm-node.is-missed').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/cvmaze-test.png', fullPage: true })
    await expect(clearDialog(page)).toBeVisible({ timeout: 20000 })
    await page.screenshot({ path: 'test-results/cvmaze-clear.png', fullPage: true })
    await expect(page.locator('.cvm-scoreboard li').first()).toHaveClass(/is-done/)

    for (const round of [2, 3]) {
      await page.getByRole('button', { name: /NEXT LEVEL|SEE CV RESULTS/ }).click()
      await expect(page.locator('.cvm-round')).toHaveText(new RegExp(`ROUND ${round} / 3`))
      await skipToClear(page)
    }
    await page.getByRole('button', { name: /SEE CV RESULTS/ }).click()

    // Final: the formula averages the three fold scores into the CV score.
    await expect(page.locator('.cvm-join-tiles li')).toHaveCount(3)
    await expect(page.locator('.cvm-formula-total')).toHaveText(/= \d+(\.\d)?%/)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'test-results/cvmaze-results.png', fullPage: true })

    await page.getByRole('button', { name: 'Save to Results' }).click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled()
    const saved = await page.evaluate(() => window.__saved)
    expect(saved).toHaveLength(1)
    expect(saved[0].title).toContain('3-fold')
    expect(saved[0].metrics.find((m) => m.label === 'CV score').value).toMatch(/%$/)
    await page.getByRole('button', { name: 'Use this in Python' }).click()
    expect(await page.evaluate(() => window.__python)).toContain('K = 3')

    // Bonus level and quiz.
    await page.getByRole('button', { name: /BONUS LEVEL/ }).click()
    await page.getByRole('button', { name: 'RUN ONE RANDOM SPLIT' }).click()
    await page.getByRole('button', { name: 'NO', exact: true }).click()
    await expect(page.locator('.cvm-feedback.is-good')).toBeVisible()
    await page.screenshot({ path: 'test-results/cvmaze-lucky.png', fullPage: true })
    await page.getByRole('button', { name: /BONUS ROUND: QUIZ/ }).click()
    for (const answer of [2, 1, 1]) {
      await page.locator('.cvm-quiz-options .cvm-answer').nth(answer).click()
      await page.getByRole('button', { name: /NEXT QUESTION|FINISH/ }).click()
    }
    await expect(page.locator('.cvm-complete')).toContainText('EXPERIMENT COMPLETE')
    await expect(page.locator('.cvm-complete')).toContainText('3 / 3')
  })

  test('replaying as the overfitted model shows the overfitting warning', async ({ page }) => {
    await page.getByRole('button', { name: /START GAME/ }).click()
    await page.getByRole('button', { name: /OVERFITTED/ }).click()
    await page.getByRole('button', { name: /ENTER THE MAZE/ }).click()
    await expect(page.locator('.cvm-power-tag')).toBeVisible({ timeout: 5000 })
    for (let round = 0; round < 5; round++) {
      await skipToClear(page)
      await page.getByRole('button', { name: /NEXT LEVEL|SEE CV RESULTS/ }).click()
    }
    await expect(page.locator('.cvm-diagnosis')).toContainText('OVERFITTING')
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test('every screen fits a phone without horizontal scrolling', async ({ page }) => {
    await noHorizontalScroll(page)
    await startGame(page, 5)
    await noHorizontalScroll(page)
    await expect(page.locator('.cvm-board .cvm-svg')).toBeVisible({ timeout: 5000 })
    await noHorizontalScroll(page)
    await page.screenshot({ path: 'test-results/cvmaze-phone-training.png', fullPage: true })
    await skipToClear(page)
    await noHorizontalScroll(page)
    await page.screenshot({ path: 'test-results/cvmaze-phone-clear.png', fullPage: true })
  })
})
