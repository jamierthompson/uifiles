import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { cleanup, render } from "vitest-browser-react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Spinner } from "@/components/ui/spinner"
import {
  describeViolations,
  expectNoViolations,
  runAxe,
  settle,
  withDark,
} from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

const isInfinite = (animation: Animation) =>
  animation.effect?.getTiming().iterations === Infinity

function TinyTargets() {
  return (
    <main>
      <h1>Tiny targets</h1>
      <button type="button" style={{ width: 10, height: 10, padding: 0 }}>
        a
      </button>
      <button type="button" style={{ width: 10, height: 10, padding: 0 }}>
        b
      </button>
    </main>
  )
}

function Hover() {
  return (
    <main>
      <h1>Hover</h1>
      <HoverCard>
        <HoverCardTrigger delay={0}>Usage</HoverCardTrigger>
        <HoverCardContent>
          <p>80K / 200K</p>
        </HoverCardContent>
      </HoverCard>
    </main>
  )
}

describe("settle()", () => {
  it("resolves while an infinite animation (a spinner) runs on the page", async () => {
    await render(
      <main>
        <Spinner />
        <p>Loading</p>
      </main>
    )
    await expect
      .poll(() => document.getAnimations().some(isInfinite))
      .toBe(true)
    const outcome = await Promise.race([
      settle().then(() => "settled"),
      new Promise<string>((resolve) => setTimeout(() => resolve("hung"), 1500)),
    ])
    expect(outcome).toBe("settled")
  })

  it("waits for a finite animation to finish", async () => {
    await render(
      <main>
        <p className="animate-in duration-300 fade-in">Fading in</p>
      </main>
    )
    const running = document
      .getAnimations()
      .filter((animation) => !isInfinite(animation))
    expect(running.some((animation) => animation.playState === "running")).toBe(
      true
    )
    await settle()
    expect(
      running.every((animation) => animation.playState === "finished")
    ).toBe(true)
  })
})

describe("runAxe() and expectNoViolations()", () => {
  it("runs WCAG 2.2's target-size rule, which axe leaves off by default", async () => {
    await render(<TinyTargets />)
    const plain = await axe.run(document.body)
    expect(plain.violations.map((v) => v.id)).not.toContain("target-size")
    const results = await runAxe()
    expect(results.violations.map((v) => v.id)).toContain("target-size")
    expect(describeViolations(results)).toMatch(
      /\] target-size: .+\n {2}.*button/
    )
  })

  it("expectNoViolations() rejects with the readable summary", async () => {
    await render(<TinyTargets />)
    await expect(expectNoViolations()).rejects.toThrow(/target-size/)
  })

  it("expectNoViolations() passes a clean landmark", async () => {
    await render(
      <main>
        <h1>Clean</h1>
        <button type="button">Save</button>
      </main>
    )
    await expectNoViolations()
  })
})

describe("withDark()", () => {
  it("adds the dark class while fn runs and removes it afterwards", async () => {
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    const result = await withDark(async () => {
      expect(document.documentElement.classList.contains("dark")).toBe(true)
      return "done"
    })
    expect(result).toBe("done")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("removes the dark class when fn throws", async () => {
    await expect(
      withDark(async () => {
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})

describe("cleanup between tests (vitest-browser-react runs cleanup in beforeEach)", () => {
  it("unmounting removes a portaled hover-card popup from <body> immediately", async () => {
    const screen = await render(<Hover />)
    await userEvent.hover(screen.getByText("Usage"))
    await expect.element(page.getByText("80K / 200K")).toBeVisible()
    expect(
      document.querySelector('[data-slot="hover-card-content"]')
    ).not.toBeNull()

    await cleanup()

    expect(
      document.querySelector('[data-slot="hover-card-content"]')
    ).toBeNull()
    expect(document.body.querySelectorAll("main").length).toBe(0)
  })

  it("a whole-body axe run passes right after a hover test, once the pointer leaves the trigger", async () => {
    const screen = await render(<Hover />)
    const trigger = screen.getByText("Usage")
    await expect.element(trigger).toBeVisible()
    // The previous test parked the pointer where its trigger was.
    await userEvent.unhover(trigger)
    await expect.element(page.getByText("80K / 200K")).not.toBeInTheDocument()
    await expectNoViolations()
  })
})

describe("locator semantics the suite relies on", () => {
  // Vitest sets `browser.locators.exact` to true, so unlike Playwright a bare
  // getByText is whole-string and case-sensitive.
  it("getByText is whole-string and case-sensitive by default; exact: false opts into substring", async () => {
    await render(<p>Hello Then: world</p>)
    expect(page.getByText("Then:").query()).toBeNull()
    expect(page.getByText("hello then: world").query()).toBeNull()
    expect(page.getByText("Hello Then: world").query()).not.toBeNull()
    expect(page.getByText("Then:", { exact: false }).query()).not.toBeNull()
    expect(page.getByText("then:", { exact: false }).query()).not.toBeNull()
  })
})

describe("console guard (tests/setup.ts)", () => {
  it("allowConsole() lets a test that asserts a warning log it", () => {
    allowConsole("warn")
    console.warn("expected: this test opted out of the console guard")
  })
})
