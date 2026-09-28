import { test, expect } from '@playwright/test'

// Every experiment's Simulation step must fit a phone: nothing may stick out of the content card.
// Wide content is fine only inside its own sideways-scrolling box (tables, the decision tree).

const progress = {
  cleared: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, { stars: 3 }])),
  typing: { 1: { completions: 1 }, 2: { completions: 1 }, 3: { completions: 1 } },
  xp: 0, coins: 0, tasks: {}, quizzes: {}, savedAt: 1,
}

test.use({ viewport: { width: 360, height: 800 } })

test.beforeEach(async ({ page }) => {
  page.__errors = []
  page.on('pageerror', (error) => page.__errors.push(error.message))
  await page.route('**/api/**', (route) => route.fulfill({ json: { ok: true, state: null } }))
  await page.addInitScript((p) => {
    sessionStorage.setItem('pac-lab-student', 'LAYOUT-TEST')
    sessionStorage.setItem('pac-lab-student-auth', JSON.stringify({ token: 'x', name: 'Layout Test', className: 'AIML-A' }))
    for (let i = 1; i <= 10; i++) sessionStorage.setItem(`pac-lab-step-${i}`, '4')
    localStorage.setItem('ml-maze-progress:LAYOUT-TEST', JSON.stringify(p))
  }, progress)
})

test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]))

const overflowing = (page) =>
  page.evaluate(() => {
    const body = document.querySelector('.lab-card-body').getBoundingClientRect()
    // Inside a box that clips or scrolls sideways, only that box's own edges matter.
    // An <svg> clips its drawing, so a drawing element is fine when its <svg> is.
    const contained = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p instanceof SVGElement && !(p instanceof SVGSVGElement)) continue
        if (getComputedStyle(p).overflowX === 'visible') continue
        if (p instanceof SVGSVGElement) return p.getBoundingClientRect().right <= body.right + 2 || contained(p)
        return p.getBoundingClientRect().right <= body.right + 2
      }
      return false
    }
    return [...document.querySelectorAll('.lab-card-body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 0 && s.visibility !== 'hidden' && s.opacity !== '0' && (r.right > body.right + 2 || r.left < body.left - 2) && !contained(el)
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
  })

for (let id = 1; id <= 10; id++) {
  test(`experiment ${id} simulation fits a 360px phone`, async ({ page }) => {
    await page.goto(`/student/lab/${id}`)
    await page.locator('.lab-card-body').waitFor()
    await page.waitForTimeout(800)
    expect(await overflowing(page)).toEqual([])
    if (id === 1) {
      for (let room = 2; room <= 6; room++) {
        await page.locator('.pa-rooms button').nth(room - 1).click()
        await page.waitForTimeout(300)
        expect(await overflowing(page), `room ${room}`).toEqual([])
      }
    }
    const text = await page.evaluate(() => [...document.querySelectorAll('.lab-chart .lab-chart-tick')].map((t) => t.getBoundingClientRect().height))
    for (const height of text) expect(height, 'chart tick labels stay readable').toBeGreaterThanOrEqual(8)
  })
}
