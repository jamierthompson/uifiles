import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"
import { AXE_TAGS } from "../tests/axe-tags"
import { isLocalRequest } from "./origin"

export { expectsPublicOrigin, publicOrigin } from "./origin"

export type ColorScheme = "light" | "dark"
export const COLOR_SCHEMES: readonly ColorScheme[] = ["light", "dark"]

/**
 * Records console errors and warnings plus uncaught exceptions. Attach before
 * navigating. Nothing is allow-listed: a React key, act or hydration warning
 * fails the test.
 */
export function collectPageProblems(page: Page): string[] {
  const problems: string[] = []
  page.on("console", (message) => {
    const type = message.type()
    if (type === "error" || type === "warning") {
      problems.push(`console.${type}: ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`)
  })
  return problems
}

/**
 * Aborts every request that leaves the server under test, so the network can
 * neither slow a run down nor decide its result. A page that needs a
 * third-party host fails the same way on every machine: the aborted resource
 * is logged as a console error, which `collectPageProblems` reports.
 */
export async function blockExternalRequests(page: Page): Promise<void> {
  await page.route(
    (url) => !isLocalRequest(url.href),
    (route) => route.abort("blockedbyclient")
  )
}

/** Waits for web fonts and every finite, time-based animation to finish. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.timeline === document.timeline &&
            animation.effect?.getTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => undefined))
    )
  })
  // Two frames so the last state change is laid out and painted before axe
  // samples colors and geometry.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
}

/**
 * Navigates and waits until the page is hydrated and at rest. `load` fires
 * before React runs, and the App Router records no hydration measure, so this
 * waits for React's fiber key on the `<main>` landmark (React attaches
 * `__reactFiber$…` to a host node when it hydrates it), then for fonts and
 * animations, which move the layout and colors axe samples. External
 * requests are blocked before the first navigation.
 */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await blockExternalRequests(page)
  await page.goto(path)
  await page.waitForLoadState("load")
  await expect(page.locator("main")).toBeVisible()
  await page.waitForFunction(() => {
    const main = document.querySelector("main")
    return (
      main !== null &&
      Object.keys(main).some((key) => key.startsWith("__reactFiber$"))
    )
  })
  await settle(page)
}

/**
 * Waits for a page that streams on load (the chat preview) to go quiet: no
 * busy live region, then every Reasoning that streamed has closed itself
 * (it does so one second after its stream ends, and its trigger reads
 * "Thought for …" once done), then fonts and animations at rest.
 */
export async function waitForIdle(page: Page): Promise<void> {
  const busy = page.locator('[aria-busy="true"]')
  const wasBusy = (await busy.count()) > 0
  await expect(busy).toHaveCount(0, { timeout: 30_000 })
  if (wasBusy) {
    await expect(
      page.getByRole("button", { name: /^Thought for/, expanded: true })
    ).toHaveCount(0, { timeout: 5_000 })
  }
  await settle(page)
}

/** Runs axe with the repo's rule set: WCAG 2.x AA + best practice, target-size on. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    // `options()` replaces the whole option object, so it precedes `withTags()`.
    .options({ rules: { "target-size": { enabled: true } } })
    .withTags([...AXE_TAGS])
    .analyze()
  const summary = results.violations
    .map(
      (violation) =>
        `[${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help}\n` +
        violation.nodes.map((node) => `  ${node.target.join(" ")}`).join("\n")
    )
    .join("\n")
  expect(results.violations, summary).toEqual([])
}
