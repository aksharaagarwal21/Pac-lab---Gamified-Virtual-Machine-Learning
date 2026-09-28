import { test, expect } from '@playwright/test'

const equation = (page) => page.locator('.lr-eq-live').innerText()
const metric = (page, key) => page.locator(`.lr-metric[data-metric="${key}"] .lr-metric-value`).innerText()

async function drag(page, locator, dx, dy) {
  const box = await locator.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 8 })
  await page.mouse.up()
}

test.use({ viewport: { width: 1440, height: 1000 } })

test.beforeEach(async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.__errors = errors
  await page.goto('/tests/fixtures/regression-lab.html')
  await expect(page.locator('.lr-lab')).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([])
  const text = await page.locator('.lr-lab').innerText()
  expect(text).not.toMatch(/NaN|Infinity/)
})

test('edit data: dragging a point updates table, equation and metrics; undo restores', async ({ page }) => {
  await page.screenshot({ path: 'test-results/regression-initial.png', fullPage: true })
  const before = await equation(page)
  const mseBefore = await metric(page, 'MSE')
  const point = page.locator('[data-point="9"]')
  await drag(page, point, 0, 160)
  const after = await equation(page)
  expect(after).not.toEqual(before)
  expect(await metric(page, 'MSE')).not.toEqual(mseBefore)
  await expect(page.locator('.lr-table tbody tr').nth(8)).toHaveClass(/is-selected/)
  const yField = page.getByLabel('Actual Y of point 9')
  expect(Number(await yField.inputValue())).toBeLessThan(16)
  await expect(page.locator('.lr-inspector')).toContainText('Point 9 of 9')
  await expect(page.locator('.lr-hint')).toContainText(/slope|Data determines/)

  // Table → graph
  await yField.fill('16')
  await yField.press('Enter')
  const moved = await page.locator('[data-point="9"]').boundingBox()
  await yField.fill('abc')
  await expect(page.locator('.ix-number.is-invalid')).toHaveCount(1)
  await yField.press('Enter')
  await expect(yField).toHaveValue('16.00')
  expect(moved).toBeTruthy()

  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  expect(await equation(page)).toEqual(before)
  await page.getByRole('button', { name: 'Redo' }).click()
  expect(await equation(page)).not.toEqual(before)
})

test('edit model: centre shifts intercept, ends tilt slope, data stays fixed', async ({ page }) => {
  await page.getByRole('radio', { name: 'Edit Model' }).click()
  const pointBefore = await page.locator('[data-point="3"]').boundingBox()
  const tableBefore = await page.locator('.lr-table tbody tr').nth(2).locator('td').nth(2).innerText()
  const slopeBefore = await page.getByLabel('Slope m').inputValue()
  await drag(page, page.locator('[data-handle="centre"]'), 0, -60)
  await expect(page.locator('.lr-badge.is-b')).toBeVisible()
  expect(await page.getByLabel('Slope m').inputValue()).toEqual(slopeBefore)
  await page.waitForTimeout(1500)
  await drag(page, page.locator('[data-handle="right"]'), 0, 80)
  await expect(page.locator('.lr-badge.is-m')).toBeVisible()
  expect(await page.getByLabel('Slope m').inputValue()).not.toEqual(slopeBefore)
  expect(await page.locator('[data-point="3"]').boundingBox()).toEqual(pointBefore)
  expect(await page.locator('.lr-table tbody tr').nth(2).locator('td').nth(2).innerText()).toEqual(tableBefore)
  await page.locator('[data-handle="centre"]').focus()
  await page.keyboard.press('ArrowUp')
  await page.getByRole('button', { name: 'Snap to least squares' }).click()
  await page.screenshot({ path: 'test-results/regression-model.png', fullPage: true })
})

test('residuals, squares, prediction, outlier and challenge', async ({ page }) => {
  await page.getByRole('button', { name: 'Residuals' }).click()
  await page.getByRole('button', { name: 'Error Squares' }).click()
  await expect(page.locator('.lr-residual')).toHaveCount(9)
  expect(await page.locator('.lr-square').count()).toBeGreaterThan(5)
  await expect(page.locator('.lr-squares-note')).toContainText('minimizes the total squared error')

  await page.getByRole('button', { name: 'Prediction', exact: true }).click()
  const xField = page.getByLabel('X =')
  await xField.fill('7')
  await expect(page.locator('.lr-derivation')).toContainText('For x = 7.00')
  const handle = page.getByTestId('predict-handle')
  await drag(page, handle, -120, 0)
  expect(Number(await xField.inputValue())).toBeLessThan(7)

  const slopeBefore = await equation(page)
  await page.getByRole('button', { name: '+ Add Outlier' }).click()
  await expect(page.locator('.lr-outlier')).toBeVisible()
  expect(await equation(page)).not.toEqual(slopeBefore)
  await expect(page.locator('.lr-point.is-outlier')).toHaveCount(1)
  await page.screenshot({ path: 'test-results/regression-outlier.png', fullPage: true })
  await page.getByRole('button', { name: 'Remove Outlier' }).click()
  await expect(page.locator('.lr-point.is-outlier')).toHaveCount(0)

  await page.getByRole('button', { name: 'Try Fitting the Line' }).first().click()
  await expect(page.locator('.lr-line.is-best')).toHaveCount(0)
  await expect(page.locator('.lr-challenge')).toContainText('Your MSE')
  await expect(page.getByRole('button', { name: 'Snap to least squares' })).toHaveCount(0)
  await drag(page, page.locator('[data-handle="right"]'), 0, -120)
  await page.getByRole('button', { name: 'Reveal Best Fit' }).first().click()
  await expect(page.locator('.lr-line.is-best')).toHaveCount(1)
  await expect(page.locator('.lr-compare')).toContainText('Best-fit MSE')
  await page.screenshot({ path: 'test-results/regression-challenge.png', fullPage: true })
  await page.getByRole('button', { name: 'Try Again' }).first().click()
  await expect(page.locator('.lr-line.is-best')).toHaveCount(0)
})

test('generate data: line drags move data, noise and sample size reshape it, presets work', async ({ page }) => {
  await page.getByRole('button', { name: /Negative relationship/ }).click()
  await expect(page.locator('.lr-eq-live')).toContainText('−')
  await page.getByRole('radio', { name: 'Generate Data' }).click()
  await expect(page.locator('.lr-line.is-gen')).toHaveCount(1)
  const pointBefore = await page.locator('[data-point="1"]').boundingBox()
  await drag(page, page.locator('[data-handle="centre"]'), 0, 50)
  expect((await page.locator('[data-point="1"]').boundingBox()).y).toBeGreaterThan(pointBefore.y + 20)

  const size = page.getByLabel('Number of Data Points')
  await size.fill('60')
  await expect(page.locator('.lr-point')).toHaveCount(60)
  const r2Low = Number(await metric(page, 'R²'))
  await page.getByLabel('Noise').fill('1')
  await page.waitForTimeout(400)
  expect(Number(await metric(page, 'R²'))).toBeLessThan(r2Low)
  await expect(page.locator('.lr-hint')).toContainText('noise')
  await page.screenshot({ path: 'test-results/regression-generate.png', fullPage: true })

  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.locator('.lr-point')).toHaveCount(9)
  await expect(page.getByRole('radio', { name: 'Edit Data' })).toHaveAttribute('aria-checked', 'true')
})

test('data controls respect limits; edge case of identical X values', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Point' }).click()
  await expect(page.locator('.lr-point')).toHaveCount(10)
  await page.getByRole('button', { name: 'Delete Selected' }).click()
  await expect(page.locator('.lr-point')).toHaveCount(9)
  for (let i = 9; i > 3; i--) {
    await page.locator(`[data-point="${i}"]`).click()
    await page.getByRole('button', { name: 'Delete Selected' }).click()
  }
  await expect(page.locator('.lr-point')).toHaveCount(3)
  await page.locator('[data-point="1"]').click()
  await expect(page.getByRole('button', { name: 'Delete Selected' })).toBeDisabled()
  for (const n of [1, 2, 3]) {
    const field = page.getByLabel(`X of point ${n}`)
    await field.fill('5')
    await field.press('Enter')
  }
  await expect(page.locator('.lr-warn')).toContainText('identical')
  await page.getByRole('button', { name: 'Random Dataset' }).click()
  expect(await page.locator('.lr-point').count()).toBeGreaterThanOrEqual(12)
})

test('full screen lab uses a 65/35 split and saves results', async ({ page }) => {
  await page.getByRole('button', { name: /Full Screen/ }).click()
  await expect(page.locator('.lr-lab.is-full')).toBeVisible()
  await page.waitForTimeout(300)
  const stage = await page.locator('.lr-stage').boundingBox()
  const side = await page.locator('.lr-side').boundingBox()
  const ratio = stage.width / (stage.width + side.width)
  expect(ratio).toBeGreaterThan(0.6)
  expect(ratio).toBeLessThan(0.7)
  await page.screenshot({ path: 'test-results/regression-fullscreen.png' })
  await page.getByRole('button', { name: 'Exit Full Screen' }).click()
  await expect(page.locator('.lr-lab.is-full')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save to Results' }).click()
  const saved = await page.evaluate(() => window.__saved)
  expect(saved[0].title).toContain('Ŷ =')
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('stacks graph, controls, then dataset without horizontal scroll', async ({ page }) => {
    const stage = await page.locator('.lr-stage').boundingBox()
    const tools = await page.locator('.lr-tools').boundingBox()
    const side = await page.locator('.lr-side').boundingBox()
    expect(tools.y).toBeGreaterThan(stage.y + stage.height - 1)
    expect(side.y).toBeGreaterThan(tools.y)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await drag(page, page.locator('[data-point="5"]'), 0, -40)
    await page.screenshot({ path: 'test-results/regression-mobile.png', fullPage: true })
  })
})
