import axe from "axe-core"
import { expect } from "vitest"
import { AXE_TAGS } from "./axe-tags"

export { AXE_TAGS }

/**
 * Waits for finite, time-based animations to finish so axe samples colours
 * at rest. Scroll-driven animations never finish and infinite ones (spinners,
 * shimmer) never settle, so both are skipped; a cancelled animation rejects
 * and is ignored.
 */
export async function settle(): Promise<void> {
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
}

export type RunAxeOptions = Omit<axe.RunOptions, "runOnly">

/**
 * Runs axe with the repo's rule set after animations settle. axe disables
 * `target-size` (the only WCAG 2.2 AA rule) by default, so it is enabled here.
 */
export async function runAxe(
  context: axe.ElementContext = document.body,
  options: RunAxeOptions = {}
): Promise<axe.AxeResults> {
  await settle()
  return axe.run(context, {
    ...options,
    runOnly: { type: "tag", values: AXE_TAGS },
    rules: { "target-size": { enabled: true }, ...options.rules },
  })
}

/** One line per violation with impact, rule and the offending nodes. */
export function describeViolations(results: axe.AxeResults): string {
  return results.violations
    .map(
      (violation) =>
        `[${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help}\n` +
        violation.nodes
          .map(
            (node) =>
              `  ${node.target.join(" ")}\n    ${node.failureSummary ?? ""}`
          )
          .join("\n")
    )
    .join("\n")
}

/** Asserts zero violations and prints them readably when there are some. */
export async function expectNoViolations(
  context: axe.ElementContext = document.body,
  options: RunAxeOptions = {}
): Promise<void> {
  const results = await runAxe(context, options)
  expect(results.violations, describeViolations(results)).toEqual([])
}

/**
 * Sets or clears the `dark` class on `<html>` the way next-themes does with
 * `disableTransitionOnChange` (which `components/theme-provider.tsx` sets):
 * transitions are off while the class flips, so a theme switch never animates.
 * next-themes forces style on `<body>` only; here every element is forced,
 * because an element inside a skipped `content-visibility: auto` subtree
 * (every message scroller item) is not restyled by a document-wide flush and
 * would otherwise start its light-to-dark transition only when axe reads its
 * colour, frozen at the light value while the subtree stays skipped.
 */
function setDark(dark: boolean): void {
  const noTransitions = document.createElement("style")
  noTransitions.textContent = "*,*::before,*::after{transition:none!important}"
  document.head.append(noTransitions)
  document.documentElement.classList.toggle("dark", dark)
  for (const element of document.querySelectorAll("*")) {
    getComputedStyle(element).color
  }
  noTransitions.remove()
}

/**
 * Runs `fn` with the `dark` class on `<html>`, matching what next-themes sets,
 * and removes it afterwards even when `fn` throws.
 */
export async function withDark<T>(fn: () => Promise<T>): Promise<T> {
  setDark(true)
  try {
    return await fn()
  } finally {
    setDark(false)
  }
}
