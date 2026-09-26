import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("home lists the catalog and passes axe", async ({ page }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { level: 1, name: "uifiles" })
  ).toBeVisible()
  await expect(page.getByText("@uifiles/button", { exact: true })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test("serves the registry index and base item", async ({ request }) => {
  const index = await request.get("/r/registry.json")
  expect(index.ok()).toBe(true)
  const body = await index.json()
  expect(body.name).toBe("uifiles")
  expect(body.items.some((i: { name: string }) => i.name === "base")).toBe(true)

  const base = await request.get("/r/base.json")
  expect(base.ok()).toBe(true)
  expect((await base.json()).type).toBe("registry:base")
})

test("serves llms.txt", async ({ request }) => {
  const res = await request.get("/llms.txt")
  expect(res.ok()).toBe(true)
  expect(await res.text()).toContain("# uifiles")
})
