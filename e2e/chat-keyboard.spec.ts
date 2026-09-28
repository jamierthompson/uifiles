import { expect, type Locator, type Page, test } from "@playwright/test"
import { collectPageProblems, gotoHydrated, waitForIdle } from "./helpers"

/** Presses `key` until `target` has focus, so the path taken is the real tab order. */
async function tabTo(
  page: Page,
  target: Locator,
  key: "Tab" | "Shift+Tab",
  limit = 40
): Promise<void> {
  for (let presses = 0; presses < limit; presses++) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return
    }
    await page.keyboard.press(key)
  }
  await expect(target).toBeFocused()
}

test("the chat preview is operable with the keyboard alone", async ({
  page,
}) => {
  const problems = collectPageProblems(page)
  await gotoHydrated(page, "/preview/chat")
  // The preview streams the scripted opening turn on load.
  await waitForIdle(page)
  const toolHeader = page.getByRole("button", { name: /readFile/ })
  await expect(toolHeader).toBeVisible()
  await expect(toolHeader).toHaveAttribute("aria-expanded", "false")

  // The skip link is the first tab stop and lands on <main>, past the header
  // and the component list; from there the composer is within reach.
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("link", { name: "Skip to content" })
  ).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator("main")).toBeFocused()

  const composer = page.getByRole("textbox")
  await tabTo(page, composer, "Tab")
  await page.keyboard.type("Can you give me the short version?")
  await page.keyboard.press("Enter")
  await expect(
    page.getByText("Can you give me the short version?")
  ).toBeVisible()
  await expect(composer).toHaveValue("")
  await waitForIdle(page)
  await expect(page.getByText(/Define it under/)).toBeVisible()

  // The transcript precedes the composer, so walk backwards to the tool header.
  await tabTo(page, toolHeader, "Shift+Tab")
  await page.keyboard.press("Enter")
  await expect(toolHeader).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByText("Parameters")).toBeVisible()

  expect(problems).toEqual([])
})
