import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Suggestion, Suggestions } from "@/registry/ai/suggestion"
import { expectNoViolations, withDark } from "@/tests/a11y"
import "@/app/globals.css"

const items = [
  "Summarize this repository",
  "Write a unit test for the parser",
  "Explain the auth flow",
]

const VIEWPORT = "[data-slot='scroll-area-viewport']"

afterEach(async () => {
  await page.viewport(414, 896)
  vi.restoreAllMocks()
})

describe("suggestions", () => {
  it("renders children", async () => {
    const screen = await render(
      <main>
        <Suggestions>
          <Suggestion suggestion="Test">Test</Suggestion>
        </Suggestions>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Test" }))
      .toBeVisible()
  })

  it("applies custom className", async () => {
    await render(
      <main>
        <Suggestions className="custom">
          <div>Content</div>
        </Suggestions>
      </main>
    )
    const row = document.querySelector(".custom")
    expect(row).not.toBeNull()
    expect(row?.className).toContain("flex")
    expect(row?.textContent).toBe("Content")
  })

  it("forwards rest props to the scroll area root", async () => {
    const screen = await render(
      <main>
        <Suggestions aria-label="Suggestions" data-testid="row" role="group">
          <Suggestion suggestion="One" />
        </Suggestions>
      </main>
    )
    const root = screen.getByRole("group", { name: "Suggestions" })
    await expect.element(root).toBeVisible()
    expect(root.element().getAttribute("data-slot")).toBe("scroll-area")
  })

  it("renders an accessible row of suggestions", async () => {
    const screen = await render(
      <main>
        <Suggestions>
          {items.map((item) => (
            <Suggestion key={item} suggestion={item} />
          ))}
        </Suggestions>
      </main>
    )
    for (const item of items) {
      await expect
        .element(screen.getByRole("button", { name: item }))
        .toBeVisible()
    }
    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("keeps the viewport out of the tab order when the row fits", async () => {
    await page.viewport(1280, 800)
    const screen = await render(
      <main>
        <Suggestions>
          <Suggestion suggestion="Short" />
          <Suggestion suggestion="Also short" />
        </Suggestions>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Short" }))
      .toBeVisible()
    const viewport = document.querySelector<HTMLElement>(VIEWPORT)
    expect(viewport).not.toBeNull()
    expect(viewport?.scrollWidth).toBe(viewport?.clientWidth)
    await expect.poll(() => viewport?.getAttribute("tabindex")).toBe("-1")
    await expectNoViolations()
  })

  it("makes the viewport a tab stop that arrow keys scroll when the row overflows", async () => {
    await page.viewport(375, 600)
    const long = Array.from(
      { length: 8 },
      (_, i) => `Suggestion number ${i + 1} is long`
    )
    const screen = await render(
      <main>
        <Suggestions>
          {long.map((s) => (
            <Suggestion key={s} suggestion={s} />
          ))}
        </Suggestions>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: long[0] ?? "" }))
      .toBeVisible()
    const viewport = document.querySelector<HTMLElement>(VIEWPORT)
    expect(viewport).not.toBeNull()
    if (!viewport) return
    expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth)
    await expect.poll(() => viewport.getAttribute("tabindex")).toBe("0")

    // The viewport precedes the pills in the tab order.
    await userEvent.tab()
    expect(document.activeElement).toBe(viewport)
    await userEvent.keyboard("{ArrowRight}")
    await expect.poll(() => viewport.scrollLeft).toBeGreaterThan(0)
    await userEvent.keyboard("{ArrowLeft}")
    await expect.poll(() => viewport.scrollLeft).toBe(0)

    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("scrolls a focused pill into view", async () => {
    await page.viewport(375, 600)
    const long = Array.from(
      { length: 8 },
      (_, i) => `Suggestion number ${i + 1} is long`
    )
    const screen = await render(
      <main>
        <Suggestions>
          {long.map((s) => (
            <Suggestion key={s} suggestion={s} />
          ))}
        </Suggestions>
      </main>
    )
    const viewport = document.querySelector<HTMLElement>(VIEWPORT)
    expect(viewport).not.toBeNull()
    const last = screen.getByRole("button", { name: long[7] ?? "" })
    await expect.element(last).toBeInTheDocument()
    last.element().focus()
    await expect.poll(() => viewport?.scrollLeft).toBeGreaterThan(0)
    expect(document.activeElement).toBe(last.element())
  })

  it("scrolls a pill that straddles the row's edge fully into view when it is tabbed to", async () => {
    await page.viewport(375, 600)
    const long = Array.from(
      { length: 8 },
      (_, i) => `Suggestion number ${i + 1} is long`
    )
    const onFocus = vi.fn()
    const screen = await render(
      <main>
        <Suggestions>
          {long.map((s) => (
            <Suggestion key={s} onFocus={onFocus} suggestion={s} />
          ))}
        </Suggestions>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: long[0] ?? "" }))
      .toBeVisible()
    const viewport = document.querySelector<HTMLElement>(VIEWPORT)
    expect(viewport).not.toBeNull()
    if (!viewport) return
    const [, before, straddling] = [
      ...viewport.querySelectorAll<HTMLButtonElement>("button"),
    ]
    expect(before).toBeDefined()
    expect(straddling).toBeDefined()
    if (!before || !straddling) return
    // Size the window so the third pill crosses the row's right edge whatever
    // the font metrics: the browser scrolls to a hidden pill on its own, but
    // not to one that is only partly visible.
    const rect = straddling.getBoundingClientRect()
    await page.viewport(Math.round((rect.left + rect.right) / 2), 600)
    // Scroll offsets are whole pixels, so allow a sub-pixel overhang.
    const inside = (pill: HTMLElement) => {
      const box = viewport.getBoundingClientRect()
      const own = pill.getBoundingClientRect()
      return own.left >= box.left - 1 && own.right <= box.right + 1
    }
    await expect.poll(() => inside(before) && !inside(straddling)).toBe(true)
    expect(straddling.getBoundingClientRect().left).toBeLessThan(
      viewport.getBoundingClientRect().right
    )

    before.focus()
    expect(viewport.scrollLeft).toBe(0)
    await userEvent.tab()
    expect(document.activeElement).toBe(straddling)
    await expect.poll(() => inside(straddling)).toBe(true)
    expect(onFocus).toHaveBeenCalledTimes(2)
  })

  it("does not scroll the page when a chip that is already in view receives focus", async () => {
    await page.viewport(375, 500)
    const long = Array.from(
      { length: 8 },
      (_, i) => `Suggestion number ${i + 1} is long`
    )
    function Page() {
      const [note, setNote] = useState("")
      return (
        <main>
          <div style={{ height: 300 }}>Above the fold</div>
          <Suggestions>
            {long.map((s) => (
              <Suggestion key={s} onClick={setNote} suggestion={s} />
            ))}
          </Suggestions>
          <div style={{ height: 1200 }}>{note || "Below the fold"}</div>
        </main>
      )
    }
    const screen = await render(<Page />)
    const first = screen.getByRole("button", { name: long[0] ?? "" })
    await expect.element(first).toBeVisible()
    window.scrollTo(0, 200)
    await expect.poll(() => window.scrollY).toBe(200)
    ;(first.element() as HTMLElement).focus()
    await userEvent.tab()
    expect(document.activeElement?.textContent).toBe(long[1])
    expect(window.scrollY).toBe(200)
    await expectNoViolations()
  })
})

describe("suggestion", () => {
  it("renders suggestion text", async () => {
    const screen = await render(
      <main>
        <Suggestion suggestion="Click me" />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Click me" }))
      .toBeVisible()
  })

  it("renders custom children", async () => {
    const screen = await render(
      <main>
        <Suggestion suggestion="test">Custom text</Suggestion>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Custom text" }))
      .toBeVisible()
    expect(screen.getByText("test").query()).toBeNull()
  })

  it("falls back to the suggestion when children is an empty string", async () => {
    const screen = await render(
      <main>
        <Suggestion suggestion="Fallback">{""}</Suggestion>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Fallback" }))
      .toBeVisible()
  })

  it("calls onClick with suggestion", async () => {
    const onClick = vi.fn<(suggestion: string) => void>()
    const screen = await render(
      <main>
        <Suggestions>
          {items.map((item) => (
            <Suggestion key={item} onClick={onClick} suggestion={item} />
          ))}
        </Suggestions>
      </main>
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Write a unit test for the parser" })
    )
    expect(onClick).toHaveBeenCalledExactlyOnceWith(
      "Write a unit test for the parser"
    )
  })

  it("activates from the keyboard", async () => {
    const onClick = vi.fn<(suggestion: string) => void>()
    const screen = await render(
      <main>
        <Suggestion onClick={onClick} suggestion="Press me" />
      </main>
    )
    const button = screen.getByRole("button", { name: "Press me" })
    button.element().focus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard(" ")
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(onClick).toHaveBeenLastCalledWith("Press me")
  })

  it("applies default variant and size", async () => {
    const screen = await render(
      <main>
        <Suggestion suggestion="Test" />
      </main>
    )
    const button = screen.getByRole("button", { name: "Test" })
    await expect.element(button).toHaveAttribute("type", "button")
    const className = button.element().className
    expect(className).toContain("rounded-full")
    expect(className).toContain("bg-background")
    expect(className).toContain("h-7")
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <Suggestion className="custom" suggestion="Test" />
      </main>
    )
    const button = screen.getByRole("button", { name: "Test" })
    expect(button.element().className).toContain("custom")
    expect(button.element().className).toContain("rounded-full")
  })

  it("forwards size and variant to the button and keeps a 24px target at every size", async () => {
    const screen = await render(
      <main className="flex gap-2 p-4">
        <Suggestion size="lg" suggestion="Large" variant="ghost" />
        <Suggestion size="xs" suggestion="Tiny" />
      </main>
    )
    const large = screen.getByRole("button", { name: "Large" })
    await expect.element(large).toBeVisible()
    expect(large.element().className).toContain("h-9")
    expect(large.element().className).not.toContain("bg-background")
    expect(large.element().className).toContain("rounded-full")
    const tiny = screen.getByRole("button", { name: "Tiny" })
    expect(
      tiny.element().getBoundingClientRect().height
    ).toBeGreaterThanOrEqual(24)
    await expectNoViolations()
  })

  it("can be disabled", async () => {
    const onClick = vi.fn()
    const screen = await render(
      <main>
        <Suggestion
          disabled
          onClick={onClick}
          suggestion="Nope"
          variant="secondary"
        />
      </main>
    )
    const button = screen.getByRole("button", { name: "Nope" })
    await expect.element(button).toBeDisabled()
    expect(button.element().className).toContain("bg-secondary")
    expect(onClick).not.toHaveBeenCalled()
    await expectNoViolations()
  })
})
