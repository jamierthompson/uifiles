import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { loadRegistry } from "../lib/registry"
import {
  COLOR_SCHEMES,
  collectPageProblems,
  expectNoAxeViolations,
  gotoHydrated,
  waitForIdle,
} from "./helpers"

const dir = join(process.cwd(), "app/preview")
const previews = readdirSync(dir)
  .filter((name) => statSync(join(dir, name)).isDirectory())
  .sort()

const { items } = loadRegistry()
/** The registry item's title, which the preview's `<title>` and `<h1>` use. */
function titleOf(name: string) {
  const title = items.find((item) => item.name === name)?.title
  if (!title) throw new Error(`registry has no titled item "${name}"`)
  return title
}
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

for (const name of previews) {
  for (const scheme of COLOR_SCHEMES) {
    test(`preview/${name} in ${scheme} mode hydrates, passes axe, does not scroll sideways and logs nothing`, async ({
      page,
    }) => {
      const problems = collectPageProblems(page)
      await page.emulateMedia({ colorScheme: scheme })
      await gotoHydrated(page, `/preview/${name}`)
      // next-themes follows the system scheme, so axe measures the theme under test.
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${scheme}\\b`)
      )
      await waitForIdle(page)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      // Each preview names itself; the bare site name means the route set no
      // title (a client page needs a layout beside it that does).
      await expect(page).toHaveTitle(/^\S.* · uifiles$/)
      await expect(page).toHaveTitle(
        new RegExp(`^${escapeRegExp(titleOf(name))} · `)
      )
      await expectNoAxeViolations(page)
      // Wide code, tables and formulas scroll in their own boxes; the page
      // itself never does, at desktop or at 375 px in the chromium-mobile
      // project (WCAG 1.4.10 Reflow).
      const widths = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))
      expect(widths.page).toBeLessThanOrEqual(widths.viewport)
      expect(problems).toEqual([])
    })
  }
}

// The selector and its count come from the server, not from the first client
// render: a Server Component page hands MessageBranchContent over as a client
// reference, and the branch count must survive that. A raw request opens no
// page: nothing runs, so there is no console to collect, and the server
// renders the same HTML whatever color scheme the client prefers.
test("preview/branch serves its branch selector and count in the HTML", async ({
  request,
}) => {
  const response = await request.get("/preview/branch")
  expect(response.ok()).toBe(true)
  const html = await response.text()
  expect(html).toContain('aria-label="Next branch"')
  expect(html).toMatch(/>1<!-- --> of <!-- -->3</)
})

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  for (const scheme of COLOR_SCHEMES) {
    test(`preview/response in ${scheme} mode scrolls its wide formula in its own box instead of widening the page`, async ({
      page,
    }) => {
      const problems = collectPageProblems(page)
      await page.emulateMedia({ colorScheme: scheme })
      await gotoHydrated(page, "/preview/response")
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${scheme}\\b`)
      )
      await waitForIdle(page)
      const widths = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        formulaOverflow: Math.max(
          ...Array.from(
            document.querySelectorAll(".katex-display"),
            (display) => display.scrollWidth - display.clientWidth
          )
        ),
      }))
      // The preview's formula is wider than a phone, so the check is not vacuous.
      expect(widths.formulaOverflow).toBeGreaterThan(0)
      expect(widths.page).toBeLessThanOrEqual(widths.viewport)
      expect(problems).toEqual([])
    })
  }
})
