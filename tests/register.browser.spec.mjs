import { test, expect } from '@playwright/test'

// The API is mocked: this checks the page itself and never writes to a database.
const CLASSES = [
  { code: 'AIML-A', department: 'Artificial Intelligence & ML', section: 'A', semester: 5 },
  { code: 'CSE-A', department: 'Computer Science', section: 'A', semester: 5 },
]

test.beforeEach(async ({ page }) => {
  page.__errors = []
  page.on('pageerror', (error) => page.__errors.push(error.message))
  page.__posted = []
  await page.route('**/api/student/classes', (route) => route.fulfill({ json: { classes: CLASSES } }))
  await page.route('**/api/student/register', async (route) => {
    const body = route.request().postDataJSON()
    page.__posted.push(body)
    if (body.studentId === 'ML-2026-901') return route.fulfill({ status: 409, json: { error: 'This roll number is already registered. Sign in instead.' } })
    return route.fulfill({ status: 201, json: { token: 'mock.token', student: { id: body.studentId, name: `${body.firstName} ${body.lastName}`, className: body.classCode }, state: null } })
  })
  await page.route('**/api/student/state', (route) => route.fulfill({ json: { ok: true, state: null } }))
})

test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]))

async function fill(page, overrides = {}) {
  const v = { studentId: 'ml-2026-777', firstName: 'Test', lastName: 'Player', email: 'Test.Player@Example.com', password: 'secret123', confirm: 'secret123', ...overrides }
  await page.getByLabel('ROLL NUMBER').fill(v.studentId)
  await page.getByLabel('FIRST NAME').fill(v.firstName)
  await page.getByLabel('LAST NAME').fill(v.lastName)
  await page.getByLabel('EMAIL').fill(v.email)
  await page.getByLabel('CLASS').selectOption('AIML-A')
  await page.getByLabel('PASSWORD', { exact: true }).fill(v.password)
  await page.getByLabel('CONFIRM').fill(v.confirm)
}

test('reachable from the sign-in pages', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'REGISTER HERE' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await page.goto('/login/student')
  await page.getByRole('link', { name: 'CREATE AN ACCOUNT' }).click()
  await expect(page.getByRole('heading', { name: 'NEW PLAYER' })).toBeVisible()
})

test('shows field errors and blocks an invalid form', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: 'CREATE PLAYER' }).click()
  await expect(page.locator('.auth-field-error')).toHaveCount(6)
  await fill(page, { email: 'not-an-email', confirm: 'different1' })
  await page.getByRole('button', { name: 'CREATE PLAYER' }).click()
  await expect(page.locator('.auth-field-error')).toHaveText(['Enter a valid email address.', 'Passwords do not match.'])
  expect(page.__posted).toHaveLength(0)
  await page.screenshot({ path: 'test-results/register-errors.png', fullPage: true })
})

test('a taken roll number shows the server message', async ({ page }) => {
  await page.goto('/register')
  await fill(page, { studentId: 'ML-2026-901' })
  await page.getByRole('button', { name: 'CREATE PLAYER' }).click()
  await expect(page.getByRole('alert')).toHaveText('This roll number is already registered. Sign in instead.')
})

test('a valid form registers, signs in and opens the student home', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByLabel('CLASS').locator('option')).toHaveCount(3)
  await fill(page)
  await page.screenshot({ path: 'test-results/register-filled.png', fullPage: true })
  await page.getByRole('button', { name: 'CREATE PLAYER' }).click()
  await expect(page).toHaveURL(/\/student\/?$/, { timeout: 5000 })
  expect(page.__posted[0]).toMatchObject({ studentId: 'ML-2026-777', email: 'test.player@example.com', classCode: 'AIML-A' })
  expect(page.__posted[0]).not.toHaveProperty('confirm')
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 800 } })
  test('fits a phone', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByLabel('CLASS').locator('option')).toHaveCount(3)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: 'test-results/register-phone.png', fullPage: true })
  })
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 375, height: 800 } })
  for (const path of ['/register', '/login/student', '/login/faculty']) {
    test(`every field stays inside the card on ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.locator('.auth-card input').first().waitFor()
      const outside = await page.evaluate(() => {
        const card = document.querySelector('.auth-card').getBoundingClientRect()
        return [...document.querySelectorAll('.auth-card input, .auth-card select, .auth-card button, .auth-links a')]
          .filter((el) => el.getBoundingClientRect().right > card.right + 0.5)
          .map((el) => el.name || el.textContent)
      })
      expect(outside).toEqual([])
    })
  }
})
