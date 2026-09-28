import { expect, test } from "@playwright/test"
import {
  blockExternalRequests,
  COLOR_SCHEMES,
  collectPageProblems,
  expectNoAxeViolations,
  expectsPublicOrigin,
  gotoHydrated,
  publicOrigin,
} from "./helpers"

type Index = {
  name: string
  homepage: string
  items: Array<{ name: string; files?: Array<{ content?: string }> }>
}

for (const scheme of COLOR_SCHEMES) {
  test(`home lists the catalog in ${scheme} mode, passes axe and logs nothing`, async ({
    page,
  }) => {
    const problems = collectPageProblems(page)
    await page.emulateMedia({ colorScheme: scheme })
    await gotoHydrated(page, "/")
    await expect(page.locator("html")).toHaveClass(
      new RegExp(`\\b${scheme}\\b`)
    )
    await expect(
      page.getByRole("heading", { level: 1, name: "uifiles" })
    ).toBeVisible()
    await expect(
      page.getByText("@uifiles/button", { exact: true })
    ).toBeVisible()
    await expectNoAxeViolations(page)
    expect(problems).toEqual([])
  })
}

for (const scheme of COLOR_SCHEMES) {
  test(`the components index in ${scheme} mode lists every group, passes axe, does not scroll sideways and logs nothing`, async ({
    page,
  }) => {
    const problems = collectPageProblems(page)
    await page.emulateMedia({ colorScheme: scheme })
    await gotoHydrated(page, "/preview")
    await expect(page.locator("html")).toHaveClass(
      new RegExp(`\\b${scheme}\\b`)
    )
    await expect(
      page.getByRole("heading", { level: 1, name: "Components" })
    ).toBeVisible()
    for (const group of ["Chat", "Agent", "Code", "Media", "Blocks"]) {
      await expect(
        page.getByRole("heading", { level: 2, name: new RegExp(`^${group}`) })
      ).toBeVisible()
    }
    await expect(page).toHaveTitle("Components · uifiles")
    await expectNoAxeViolations(page)
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(widths.page).toBeLessThanOrEqual(widths.viewport)
    expect(problems).toEqual([])
  })
}

test("the home install command uses the public origin", async ({
  page,
  baseURL,
}) => {
  const origin = publicOrigin(baseURL)
  await gotoHydrated(page, "/")
  const install = page.locator("pre").first()
  await expect(install).toContainText(
    `pnpm dlx shadcn@latest init ${origin}/r/base.json`
  )
  // Always in CI (publicOrigin throws there when the origin is unset).
  if (expectsPublicOrigin()) {
    await expect(install).not.toContainText("localhost")
  }
})

test("serves the registry index without file content and every item as JSON with content", async ({
  request,
}) => {
  const response = await request.get("/r/registry.json")
  expect(response.ok()).toBe(true)
  expect(response.headers()["content-type"]).toMatch(/application\/json/)
  const index = (await response.json()) as Index
  expect(index.name).toBe("uifiles")
  expect(index.homepage).toMatch(/^https:\/\//)
  expect(index.items.length).toBeGreaterThan(0)
  expect(index.items.some((item) => item.name === "base")).toBe(true)
  for (const item of index.items) {
    expect(
      item.files?.some((file) => "content" in file) ?? false,
      `${item.name} carries file content in the index`
    ).toBe(false)
  }

  for (const item of index.items) {
    const res = await request.get(`/r/${item.name}.json`)
    expect(res.ok(), item.name).toBe(true)
    expect(res.headers()["content-type"], item.name).toMatch(
      /application\/json/
    )
    const json = (await res.json()) as {
      name: string
      type: string
      files?: Array<{ path: string; content?: string }>
    }
    expect(json.name).toBe(item.name)
    if (item.name === "base") expect(json.type).toBe("registry:base")
    for (const file of json.files ?? []) {
      expect(typeof file.content, `${item.name}: ${file.path}`).toBe("string")
    }
  }
})

test("llms.txt links every item at the public origin", async ({
  request,
  baseURL,
}) => {
  const origin = publicOrigin(baseURL)
  const response = await request.get("/llms.txt")
  expect(response.ok()).toBe(true)
  expect(response.headers()["content-type"]).toMatch(/text\/plain/)
  const text = await response.text()
  expect(text).toContain("# uifiles")

  const links = [...text.matchAll(/\]\((https?:\/\/[^)]*\/r\/[^)]+)\)/g)]
    .map((match) => match[1])
    .filter((link): link is string => link !== undefined)
  expect(links.length).toBeGreaterThan(0)
  for (const link of links) {
    expect(link.startsWith(`${origin}/r/`), link).toBe(true)
  }

  const index = (await (await request.get("/r/registry.json")).json()) as Index
  for (const item of index.items) {
    expect(text, item.name).toContain(`${origin}/r/${item.name}.json`)
  }
  if (expectsPublicOrigin()) {
    expect(text).not.toContain("localhost")
  }
})

for (const path of ["/nope", "/preview/nope"]) {
  test(`${path} answers 404 with the not-found page under its own title`, async ({
    page,
  }) => {
    await blockExternalRequests(page)
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(page).toHaveTitle("Page not found · uifiles")
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible()
  })
}
