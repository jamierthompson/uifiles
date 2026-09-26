import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const dir = join(process.cwd(), "app/preview")
const previews = readdirSync(dir)
  .filter((n) => statSync(join(dir, n)).isDirectory())
  .sort()

for (const name of previews) {
  test(`preview/${name} renders and passes axe`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto(`/preview/${name}`)
    // Axe must see the hydrated page: client effects add focus targets.
    await page.waitForLoadState("networkidle")
    await expect(page.locator("main")).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2)
    ).toEqual([])
    expect(errors).toEqual([])
  })
}
