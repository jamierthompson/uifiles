import { createRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { CarouselApi } from "@/components/ui/carousel"
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "@/registry/ai/inline-citation"
import { expectNoViolations, withDark } from "@/tests/a11y"
import "@/app/globals.css"

const sources = [
  {
    url: "https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data",
    title: "Streaming custom data",
    description: "Stream typed data parts alongside text.",
  },
  {
    url: "https://react.dev/reference/react/useTransition",
    title: "useTransition",
    description: "Keep the UI responsive during expensive updates.",
  },
  {
    url: "https://base-ui.com/react/components/preview-card",
    title: "Preview Card",
    description: "A popup that appears when a link is hovered.",
  },
]

const names = ["Alpha", "Beta", "Gamma"]

const popup = () =>
  document.querySelector<HTMLElement>('[data-slot="hover-card-content"]')

// Locators type their element as HTMLElement | SVGElement; the badge is a button.
const pressable = (locator: { element(): Element }) =>
  locator.element() as HTMLElement

// Two animation frames let React commit state set from a native event, so a
// negative assertion ("still open", "not reopened") looks at settled DOM.
const flush = async () => {
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
}

/** Polls to `expected`, then holds for `holdMs` and fails if it changes. */
async function settled<T>(read: () => T, expected: T, holdMs = 100) {
  await expect.poll(read).toBe(expected)
  const until = performance.now() + holdMs
  while (performance.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(read()).toBe(expected)
  }
}

// A tap: touch pointer events (which Base UI's mouse-only hover ignores)
// followed by the click the browser synthesizes for it.
const tap = (element: HTMLElement) => {
  for (const type of ["pointerdown", "pointerup"]) {
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        isPrimary: true,
        pointerType: "touch",
      })
    )
  }
  element.click()
}

/** A carousel with `n` slides, an index and optional prev/next controls. */
const Slides = ({
  n,
  controls = false,
  loop = false,
  setApi,
}: {
  n: number
  controls?: boolean
  loop?: boolean
  setApi?: (api: CarouselApi) => void
}) => (
  <InlineCitationCarousel
    {...(loop && { opts: { loop: true } })}
    {...(setApi && { setApi })}
  >
    <InlineCitationCarouselHeader>
      {controls && <InlineCitationCarouselPrev />}
      {controls && <InlineCitationCarouselNext />}
      <InlineCitationCarouselIndex data-testid="index" />
    </InlineCitationCarouselHeader>
    <InlineCitationCarouselContent>
      {names.slice(0, n).map((name) => (
        <InlineCitationCarouselItem key={name}>
          <InlineCitationSource title={name} />
        </InlineCitationCarouselItem>
      ))}
    </InlineCitationCarouselContent>
  </InlineCitationCarousel>
)

/**
 * The full composition from the preview: text, badge, card with a carousel.
 * `bracketed` puts a button on each side so Tab has somewhere to go.
 */
const Citation = ({
  items = sources.slice(0, 2),
  controls = true,
  bracketed = false,
  delay,
}: {
  items?: typeof sources
  controls?: boolean
  bracketed?: boolean
  delay?: number
}) => (
  <main>
    <h1>Inline citations</h1>
    {bracketed && <button type="button">before</button>}
    <p>
      <InlineCitation>
        <InlineCitationText>
          Streaming responses render progressively
        </InlineCitationText>
        <InlineCitationCard>
          <InlineCitationCardTrigger
            sources={items.map((s) => s.url)}
            {...(delay !== undefined && { delay })}
          />
          <InlineCitationCardBody>
            <InlineCitationCarousel>
              <InlineCitationCarouselHeader>
                {controls && <InlineCitationCarouselPrev />}
                {controls && <InlineCitationCarouselNext />}
                <InlineCitationCarouselIndex />
              </InlineCitationCarouselHeader>
              <InlineCitationCarouselContent>
                {items.map((source) => (
                  <InlineCitationCarouselItem key={source.url}>
                    <InlineCitationSource
                      description={source.description}
                      title={source.title}
                      url={source.url}
                    />
                    <InlineCitationQuote>Quoted passage.</InlineCitationQuote>
                  </InlineCitationCarouselItem>
                ))}
              </InlineCitationCarouselContent>
            </InlineCitationCarousel>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
      . The rest of the sentence keeps the badge inside running text.
    </p>
    {bracketed && <button type="button">after</button>}
  </main>
)

/**
 * A parent that owns `open` and accepts every change from onOpenChange;
 * `forceClosed` closes the card through the prop alone, as a parent that
 * resets its own UI would, without going through onOpenChange.
 */
const ControlledCitation = ({
  forceClosed = false,
}: {
  forceClosed?: boolean
}) => {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <h1>Citations</h1>
      <p>
        <InlineCitationCard
          onOpenChange={(next) => setOpen(next)}
          open={!forceClosed && open}
        >
          <InlineCitationCardTrigger sources={["https://example.com/a"]} />
          <InlineCitationCardBody>Controlled body</InlineCitationCardBody>
        </InlineCitationCard>
      </p>
    </main>
  )
}

/** A badge and a plain card body, with a heading to park the pointer on. */
const Simple = ({ body = "Card body" }: { body?: string }) => (
  <main>
    <h1>Citations</h1>
    <button type="button">before</button>
    <p>
      <InlineCitationCard>
        <InlineCitationCardTrigger sources={["https://example.com/a"]} />
        <InlineCitationCardBody>{body}</InlineCitationCardBody>
      </InlineCitationCard>
    </p>
  </main>
)

describe("InlineCitation", () => {
  it("renders children", async () => {
    const screen = await render(
      <main>
        <InlineCitation>Citation content</InlineCitation>
      </main>
    )
    await expect.element(screen.getByText("Citation content")).toBeVisible()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <InlineCitation className="custom">Text</InlineCitation>
      </main>
    )
    const element = screen.getByText("Text").element()
    expect(element.tagName).toBe("SPAN")
    expect(element).toHaveClass("group", "custom")
  })
})

describe("InlineCitationText", () => {
  it("renders text content", async () => {
    const screen = await render(
      <main>
        <InlineCitationText>Cited text</InlineCitationText>
      </main>
    )
    await expect.element(screen.getByText("Cited text")).toBeVisible()
  })

  it("has group hover effect class", async () => {
    const screen = await render(
      <main>
        <InlineCitationText className="custom">Text</InlineCitationText>
      </main>
    )
    expect(screen.getByText("Text").element()).toHaveClass(
      "transition-colors",
      "group-hover:bg-accent",
      "custom"
    )
  })
})

describe("InlineCitationCard", () => {
  it("renders card", async () => {
    const screen = await render(
      <main>
        <InlineCitationCard>
          <div>Card content</div>
        </InlineCitationCard>
      </main>
    )
    await expect.element(screen.getByText("Card content")).toBeVisible()
  })

  it("opens initially with defaultOpen", async () => {
    await render(
      <main>
        <InlineCitationCard defaultOpen>
          <InlineCitationCardTrigger sources={["https://example.com"]} />
          <InlineCitationCardBody>Body</InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    await expect.element(page.getByText("Body")).toBeVisible()
  })

  it("round-trips controlled open and onOpenChange with (open, eventDetails)", async () => {
    const onOpenChange = vi.fn()
    const ui = (open: boolean) => (
      <main>
        <InlineCitationCard onOpenChange={onOpenChange} open={open}>
          <InlineCitationCardTrigger sources={["https://example.com/a"]} />
          <InlineCitationCardBody>Controlled body</InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    const screen = await render(ui(false))

    await userEvent.hover(screen.getByRole("button", { name: "example.com" }))
    await vi.waitFor(() =>
      expect(onOpenChange).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ reason: "trigger-hover" })
      )
    )
    await expect
      .element(page.getByText("Controlled body"))
      .not.toBeInTheDocument()

    await screen.rerender(ui(true))
    await expect.element(page.getByText("Controlled body")).toBeVisible()
  })

  it("reports a press to onOpenChange as trigger-press and leaves a controlled open alone", async () => {
    const onOpenChange = vi.fn()
    const ui = (open: boolean) => (
      <main>
        <h1>Citations</h1>
        <InlineCitationCard onOpenChange={onOpenChange} open={open}>
          <InlineCitationCardTrigger sources={["https://example.com/a"]} />
          <InlineCitationCardBody>Controlled body</InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    const screen = await render(ui(false))
    const badge = screen.getByRole("button", { name: "example.com" })
    await userEvent.hover(screen.getByRole("heading"))

    pressable(badge).click()
    await vi.waitFor(() =>
      expect(onOpenChange).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({
          reason: "trigger-press",
          trigger: badge.element(),
          event: expect.any(MouseEvent),
        })
      )
    )
    await flush()
    expect(popup()).toBeNull()

    // The refused press leaves no pin behind: when the parent opens the card
    // later on its own, it is the non-modal peek and focus stays put.
    await screen.rerender(ui(true))
    await expect.element(page.getByText("Controlled body")).toBeVisible()
    await flush()
    expect(page.getByRole("dialog").query()).toBeNull()
    expect(popup()?.contains(document.activeElement)).toBe(false)

    // A press on the open card pins it without asking the parent again.
    const calls = onOpenChange.mock.calls.length
    pressable(badge).click()
    await expect
      .element(page.getByRole("dialog", { name: "example.com" }))
      .toBeVisible()
    await expect.poll(() => document.activeElement).toBe(popup())
    expect(onOpenChange).toHaveBeenCalledTimes(calls)

    // A second press asks to close; the parent keeps it open, unpinned.
    pressable(badge).click()
    await vi.waitFor(() =>
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "trigger-press" })
      )
    )
    await flush()
    await expect.element(page.getByText("Controlled body")).toBeVisible()
    expect(page.getByRole("dialog").query()).toBeNull()
  })

  it("pins a card its parent opens from onOpenChange, and drops the pin once the parent closes it through open", async () => {
    const screen = await render(<ControlledCitation />)
    const badge = screen.getByRole("button", { name: "example.com" })
    await userEvent.hover(screen.getByRole("heading"))

    pressable(badge).click()
    await expect
      .element(page.getByRole("dialog", { name: "example.com" }))
      .toBeVisible()
    await expect.poll(() => document.activeElement).toBe(popup())

    await screen.rerender(<ControlledCitation forceClosed />)
    await expect.poll(popup).toBeNull()

    // The parent's own state still says open, so dropping forceClosed
    // reopens the card: as the non-modal peek, not the old pinned dialog.
    await screen.rerender(<ControlledCitation />)
    await expect.element(page.getByText("Controlled body")).toBeVisible()
    await flush()
    expect(page.getByRole("dialog").query()).toBeNull()
    expect(popup()?.contains(document.activeElement)).toBe(false)
    // The peek is portaled outside <main> and has no dialog role, so it is
    // scanned on its own and its portal is excluded from the page scan.
    await expectNoViolations(popup() as Element)
    await expectNoViolations({
      exclude: ["[data-base-ui-portal]"],
      include: [document.body],
    })
  })
})

describe("InlineCitationCardTrigger", () => {
  it("renders single source hostname", async () => {
    const screen = await render(
      <main>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={["https://example.com/page"]} />
        </InlineCitationCard>
      </main>
    )
    await expect.element(screen.getByText("example.com")).toBeVisible()
  })

  it("renders multiple sources count", async () => {
    const screen = await render(
      <main>
        <InlineCitationCard>
          <InlineCitationCardTrigger
            sources={[
              "https://example.com",
              "https://test.com",
              "https://demo.com",
            ]}
          />
        </InlineCitationCard>
      </main>
    )
    await expect.element(screen.getByText("example.com +2")).toBeVisible()
  })

  it("renders unknown for empty sources", async () => {
    const screen = await render(
      <main>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={[]} />
        </InlineCitationCard>
      </main>
    )
    await expect.element(screen.getByText("unknown")).toBeVisible()
  })

  it("shows a source that is not an absolute URL as given instead of throwing", async () => {
    const cases = [
      ["relative", "/docs/streaming", "/docs/streaming"],
      ["bare-host", "example.com", "example.com"],
      ["garbage", "not a url", "not a url"],
      ["no-host", "mailto:docs@example.com", "mailto:docs@example.com"],
      ["absolute", "https://example.com/page?q=1", "example.com"],
    ] as const
    const screen = await render(
      <main>
        {cases.map(([id, source]) => (
          <InlineCitationCard key={id}>
            <InlineCitationCardTrigger data-testid={id} sources={[source]} />
          </InlineCitationCard>
        ))}
      </main>
    )
    for (const [id, , label] of cases) {
      expect(screen.getByTestId(id).element().textContent).toBe(label)
    }
  })

  it("labels IPv6, localhost and credentialed sources by host only", async () => {
    const cases = [
      ["ipv6", "http://[::1]:3000/x", "[::1]"],
      ["local", "http://localhost:3000/x", "localhost"],
      ["creds", "https://user:pw@host.example/x", "host.example"],
      ["data", "data:text/plain,hi", "data:text/plain,hi"],
      ["scheme-relative", "//example.com/x", "//example.com/x"],
    ] as const
    const screen = await render(
      <main>
        {cases.map(([id, source]) => (
          <InlineCitationCard key={id}>
            <InlineCitationCardTrigger data-testid={id} sources={[source]} />
          </InlineCitationCard>
        ))}
      </main>
    )
    for (const [id, , label] of cases) {
      expect(screen.getByTestId(id).element().textContent).toBe(label)
    }
  })

  it("is a button named after its sources and forwards Badge props", async () => {
    const screen = await render(
      <main>
        <InlineCitationCard>
          <InlineCitationCardTrigger
            className="custom"
            data-testid="badge"
            sources={["https://example.com/a", "https://b.dev/x"]}
            variant="outline"
          />
        </InlineCitationCard>
      </main>
    )
    const badge = screen.getByRole("button", { name: "example.com +1" })
    await expect.element(badge).toBeVisible()
    const element = badge.element()
    expect(element.tagName).toBe("BUTTON")
    expect(element).toHaveAttribute("type", "button")
    expect(element).toHaveAttribute("data-testid", "badge")
    expect(element).toHaveAttribute("data-variant", "outline")
    expect(element).toHaveClass("ml-1", "rounded-full", "custom")
  })

  it("is reachable by Tab, opens the card on focus and closes it on Escape", async () => {
    const screen = await render(<Simple />)
    const badge = screen.getByRole("button", { name: "example.com" })
    await userEvent.click(screen.getByRole("button", { name: "before" }))
    await userEvent.tab()
    expect(document.activeElement).toBe(badge.element())
    await expect.element(page.getByText("Card body")).toBeVisible()

    await userEvent.keyboard("{Escape}")
    await expect.element(page.getByText("Card body")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(badge.element())
  })

  it("opens on hover and closes when the pointer leaves", async () => {
    const screen = await render(
      <main>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={["https://example.com/a"]} />
          <InlineCitationCardBody>Hover body</InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    const badge = screen.getByRole("button", { name: "example.com" })
    await userEvent.hover(badge)
    await expect.element(page.getByText("Hover body")).toBeVisible()
    await userEvent.unhover(badge)
    await expect.element(page.getByText("Hover body")).not.toBeInTheDocument()
  })

  it("waits for delay before opening and closeDelay before closing", async () => {
    const screen = await render(
      <main>
        <InlineCitationCard>
          <InlineCitationCardTrigger
            closeDelay={400}
            delay={400}
            sources={["https://example.com/a"]}
          />
          <InlineCitationCardBody>Delayed body</InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    const badge = screen.getByRole("button", { name: "example.com" })
    await userEvent.hover(badge)
    expect(document.body.textContent).not.toContain("Delayed body")
    await expect.element(page.getByText("Delayed body")).toBeVisible()

    await userEvent.unhover(badge)
    expect(document.body.textContent).toContain("Delayed body")
    await expect.element(page.getByText("Delayed body")).not.toBeInTheDocument()
  })

  it("opens the card from a click on the badge, not only from hover or focus", async () => {
    const screen = await render(<Simple />)
    // Park the pointer away from the badge so the hover path cannot open it.
    await userEvent.hover(screen.getByRole("heading"))
    expect(popup()).toBeNull()

    const badge = screen.getByRole("button", { name: "example.com" })
    pressable(badge).click()
    await expect.element(page.getByText("Card body")).toBeVisible()
    await expect
      .poll(() => popup()?.contains(document.activeElement))
      .toBe(true)

    pressable(badge).click()
    await expect.element(page.getByText("Card body")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(badge.element())
  })

  it("opens the card on a tap and closes it on a second tap", async () => {
    const screen = await render(<Simple />)
    await userEvent.hover(screen.getByRole("heading"))
    const badge = screen.getByRole("button", { name: "example.com" })

    tap(pressable(badge))
    await expect.element(page.getByText("Card body")).toBeVisible()
    await expect
      .poll(() => popup()?.contains(document.activeElement))
      .toBe(true)

    tap(pressable(badge))
    await expect.element(page.getByText("Card body")).not.toBeInTheDocument()
  })

  it("keeps a clicked card open after the pointer leaves and closes it on a second click", async () => {
    const screen = await render(<Simple />)
    const badge = screen.getByRole("button", { name: "example.com" })
    await userEvent.click(badge)
    await expect.element(page.getByText("Card body")).toBeVisible()
    await expect
      .poll(() => popup()?.contains(document.activeElement))
      .toBe(true)

    await userEvent.unhover(badge)
    await flush()
    await expect.element(page.getByText("Card body")).toBeVisible()

    await userEvent.click(badge)
    await expect.element(page.getByText("Card body")).not.toBeInTheDocument()
  })

  it("lets a consumer onClick run first and skip the toggle with preventDefault", async () => {
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault())
    const screen = await render(
      <main>
        <h1>Citations</h1>
        <InlineCitationCard>
          <InlineCitationCardTrigger
            onClick={onClick}
            sources={["https://example.com/a"]}
          />
          <InlineCitationCardBody>Card body</InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    await userEvent.hover(screen.getByRole("heading"))
    pressable(screen.getByRole("button", { name: "example.com" })).click()
    expect(onClick).toHaveBeenCalledTimes(1)
    await flush()
    expect(popup()).toBeNull()
  })

  it("moves focus into the card on Enter, pages to both ends without losing focus and returns focus on Escape", async () => {
    // The preview's two sources: the first Enter on Next reaches the end.
    const screen = await render(<Citation />)
    await userEvent.click(screen.getByRole("heading"))
    await userEvent.tab()
    const badge = screen.getByRole("button", { name: "ai-sdk.dev +1" })
    expect(document.activeElement).toBe(badge.element())
    await expect.element(page.getByText("1/2")).toBeVisible()
    expect(popup()?.contains(document.activeElement)).toBe(false)

    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())
    await expectNoViolations()

    // At an end an arrow is aria-disabled, not disabled, so it keeps its
    // place in the Tab order and keeps focus when it becomes the end.
    const prev = page.getByRole("button", { name: "Previous" })
    const next = page.getByRole("button", { name: "Next" })
    await userEvent.tab()
    expect(document.activeElement).toBe(prev.element())
    expect(prev.element()).toHaveAttribute("aria-disabled", "true")
    await userEvent.tab()
    expect(document.activeElement).toBe(next.element())

    await userEvent.keyboard("{Enter}")
    await expect.element(page.getByText("2/2")).toBeVisible()
    await expect.element(next).toHaveAttribute("aria-disabled", "true")
    expect(document.activeElement).toBe(next.element())
    expect(popup()?.contains(document.activeElement)).toBe(true)

    // Enter on the arrow at the end does nothing and keeps focus.
    await userEvent.keyboard("{Enter}")
    await flush()
    await expect.element(page.getByText("2/2")).toBeVisible()
    expect(document.activeElement).toBe(next.element())

    // Tab from the last control wraps to the first and back.
    await userEvent.tab()
    expect(document.activeElement).toBe(prev.element())
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(next.element())
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(prev.element())

    await userEvent.keyboard("{Enter}")
    await expect.element(page.getByText("1/2")).toBeVisible()
    await expect.element(prev).toHaveAttribute("aria-disabled", "true")
    expect(document.activeElement).toBe(prev.element())
    expect(popup()?.contains(document.activeElement)).toBe(true)
    await expectNoViolations()

    await userEvent.keyboard("{Escape}")
    await expect.element(page.getByText("1/2")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(badge.element())
    await flush()
    expect(popup()).toBeNull()

    // Tab leaves the badge without reopening it.
    await userEvent.tab()
    expect(document.activeElement).not.toBe(badge.element())
    await flush()
    expect(popup()).toBeNull()
  })

  it("keeps focus on Next when Space pages to the last slide, and Escape returns it to the badge", async () => {
    await render(<Citation bracketed />)
    const badge = page.getByRole("button", { name: "ai-sdk.dev +1" })
    await userEvent.click(page.getByRole("button", { name: "before" }))
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())
    await userEvent.tab()
    await userEvent.tab()
    const next = page.getByRole("button", { name: "Next" })
    expect(document.activeElement).toBe(next.element())

    await userEvent.keyboard(" ")
    await expect.element(page.getByText("2/2")).toBeVisible()
    await expect.element(next).toBeDisabled()
    expect(next.element().hasAttribute("disabled")).toBe(false)
    expect(document.activeElement).toBe(next.element())

    await userEvent.keyboard("{Escape}")
    await settled(popup, null)
    expect(document.activeElement).toBe(badge.element())
  })

  it("returns focus to the badge on Escape after focus inside a pinned card fell to the body", async () => {
    // Content that unmounts or disables its own focused control drops focus
    // to <body>; the pinned card still owns where focus goes back to.
    await render(<Citation bracketed />)
    const badge = page.getByRole("button", { name: "ai-sdk.dev +1" })
    await userEvent.click(page.getByRole("button", { name: "before" }))
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())
    await userEvent.tab()
    ;(document.activeElement as HTMLElement).blur()
    expect(document.activeElement).toBe(document.body)
    await flush()
    expect(popup()).not.toBeNull()

    await userEvent.keyboard("{Escape}")
    await settled(popup, null)
    expect(document.activeElement).toBe(badge.element())
  })

  it("leaves focus where it is when Escape closes a card that was only hovered", async () => {
    await render(<Citation bracketed />)
    const before = page.getByRole("button", { name: "before" })
    await userEvent.click(before)
    await userEvent.hover(page.getByRole("button", { name: "ai-sdk.dev +1" }))
    await expect.element(page.getByText("1/2")).toBeVisible()

    await userEvent.keyboard("{Escape}")
    await expect.element(page.getByText("1/2")).not.toBeInTheDocument()
    await flush()
    expect(document.activeElement).toBe(before.element())
  })

  it("marks the badge expanded and controlling the card, and makes only a pinned card a dialog named by the badge", async () => {
    const screen = await render(<Citation />)
    await userEvent.hover(screen.getByRole("heading"))
    const badge = screen.getByRole("button", { name: "ai-sdk.dev +1" })
    expect(badge.element()).toHaveAttribute("aria-expanded", "false")
    expect(badge.element().hasAttribute("aria-controls")).toBe(false)

    // A hover peek is non-modal: expanded, but no dialog.
    await userEvent.hover(badge)
    await expect.element(page.getByText("1/2")).toBeVisible()
    expect(badge.element()).toHaveAttribute("aria-expanded", "true")
    const id = popup()?.id ?? ""
    expect(id).not.toBe("")
    expect(badge.element()).toHaveAttribute("aria-controls", id)
    expect(page.getByRole("dialog").query()).toBeNull()

    // A press pins it: the card that receives focus is a named dialog.
    pressable(badge).click()
    const dialog = page.getByRole("dialog", { name: "ai-sdk.dev +1" })
    await expect.element(dialog).toBeVisible()
    expect(dialog.element()).toBe(popup())
    await expect.poll(() => document.activeElement).toBe(popup())
    expect(dialog.element().hasAttribute("aria-modal")).toBe(false)
    expect(badge.element()).toHaveAttribute("aria-expanded", "true")
    await expectNoViolations()

    pressable(badge).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(badge.element()).toHaveAttribute("aria-expanded", "false")
    expect(badge.element().hasAttribute("aria-controls")).toBe(false)
  })

  it("points aria-controls at a consumer id on the body and lets a consumer name the dialog", async () => {
    const screen = await render(
      <main>
        <h1>Citations</h1>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={["https://example.com/a"]} />
          <InlineCitationCardBody aria-label="Sources" id="sources-card">
            Card body
          </InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    await userEvent.hover(screen.getByRole("heading"))
    const badge = screen.getByRole("button", { name: "example.com" })
    pressable(badge).click()
    const dialog = page.getByRole("dialog", { name: "Sources" })
    await expect.element(dialog).toBeVisible()
    expect(dialog.element().id).toBe("sources-card")
    expect(dialog.element().hasAttribute("aria-labelledby")).toBe(false)
    expect(badge.element()).toHaveAttribute("aria-controls", "sources-card")
  })

  it("shows a focus ring on the pinned card when keyboard focus lands on it", async () => {
    await render(<Citation bracketed />)
    await userEvent.click(page.getByRole("button", { name: "before" }))
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())
    const card = popup() as HTMLElement
    const ring = () => getComputedStyle(card).boxShadow
    expect(card.matches(":focus-visible")).toBe(true)
    // The popup transitions every property for 100ms, the ring included.
    await expect.poll(ring).toContain("0px 0px 0px 3px")

    await userEvent.tab()
    expect(card.matches(":focus-visible")).toBe(false)
    await expect.poll(ring).toContain("0px 0px 0px 1px")
  })

  it("opens again from keyboard focus after Escape once the badge has been left and re-entered", async () => {
    await render(<Citation bracketed />)
    const badge = page.getByRole("button", { name: "ai-sdk.dev +1" })
    await userEvent.click(page.getByRole("button", { name: "before" }))
    await userEvent.tab()
    expect(document.activeElement).toBe(badge.element())
    await expect.element(page.getByText("1/2")).toBeVisible()

    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())
    await userEvent.keyboard("{Escape}")
    await expect.poll(() => document.activeElement).toBe(badge.element())
    await settled(popup, null)

    await userEvent.tab()
    expect(document.activeElement).toBe(
      page.getByRole("button", { name: "after" }).element()
    )
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(badge.element())
    await expect.element(page.getByText("1/2")).toBeVisible()
    expect(popup()?.contains(document.activeElement)).toBe(false)
  })

  it("does not reopen on a delayed focus timer after Escape returns focus to a delay={300} badge", async () => {
    await render(<Citation bracketed delay={300} />)
    const badge = page.getByRole("button", { name: "ai-sdk.dev +1" })
    await userEvent.click(page.getByRole("button", { name: "before" }))
    await userEvent.tab()
    expect(document.activeElement).toBe(badge.element())
    await expect
      .element(page.getByText("1/2"), { timeout: 2_000 })
      .toBeVisible()

    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())
    await userEvent.keyboard("{Escape}")
    await expect.poll(() => document.activeElement).toBe(badge.element())
    await settled(popup, null, 600)
  })

  it("moves Shift+Tab from the freshly focused card to its last control", async () => {
    await render(<Citation bracketed />)
    await userEvent.click(page.getByRole("button", { name: "before" }))
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())

    // Next is the header's last control; the index after it is text.
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(
      page.getByRole("button", { name: "Next" }).element()
    )
  })

  it("keeps Tab inside a card that has no controls", async () => {
    const screen = await render(<Simple />)
    await userEvent.click(screen.getByRole("button", { name: "before" }))
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement).toBe(popup())

    await userEvent.tab()
    expect(document.activeElement).toBe(popup())
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(popup())
    await expect.element(page.getByText("Card body")).toBeVisible()
  })
})

describe("InlineCitationCardBody", () => {
  it("renders body content", async () => {
    await render(
      <main>
        <InlineCitationCard defaultOpen>
          <InlineCitationCardTrigger sources={["https://example.com"]} />
          <InlineCitationCardBody>Body</InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    await expect.element(page.getByText("Body")).toBeVisible()
  })

  it("merges className, forwards side, align and a ref to the popup", async () => {
    const ref = createRef<HTMLDivElement>()
    await render(
      // Room above the trigger, or Base UI flips `side="top"` to bottom.
      <main style={{ paddingTop: 400 }}>
        <InlineCitationCard defaultOpen>
          <InlineCitationCardTrigger sources={["https://example.com"]} />
          <InlineCitationCardBody
            align="start"
            className="custom"
            ref={ref}
            side="top"
          >
            Placed body
          </InlineCitationCardBody>
        </InlineCitationCard>
      </main>
    )
    const body = page.getByText("Placed body")
    await expect.element(body).toBeVisible()
    const element = body.element()
    expect(element).toHaveClass("relative", "w-80", "p-0", "custom")
    expect(element).toHaveAttribute("data-side", "top")
    expect(element).toHaveAttribute("data-align", "start")
    expect(ref.current).toBe(element)
  })
})

describe("InlineCitationCarousel", () => {
  it("renders carousel", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarousel>
          <InlineCitationCarouselContent>
            <InlineCitationCarouselItem>Item 1</InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    await expect.element(screen.getByText("Item 1")).toBeVisible()
    const region = screen.getByRole("region")
    expect(region.element()).toHaveAttribute("aria-roledescription", "carousel")
    expect(region.element()).toHaveClass("w-full")
  })

  it("passes setApi through and still tracks the index", async () => {
    const setApi = vi.fn()
    const screen = await render(
      <main>
        <InlineCitationCarousel setApi={setApi}>
          <InlineCitationCarouselHeader>
            <InlineCitationCarouselIndex data-testid="index" />
          </InlineCitationCarouselHeader>
          <InlineCitationCarouselContent>
            <InlineCitationCarouselItem>Item 1</InlineCitationCarouselItem>
            <InlineCitationCarouselItem>Item 2</InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    await expect.element(screen.getByTestId("index")).toHaveTextContent("1/2")
    expect(setApi).toHaveBeenCalledWith(
      expect.objectContaining({ scrollNext: expect.any(Function) })
    )
  })

  it("keeps both controls enabled and wraps when opts.loop is set", async () => {
    const screen = await render(
      <main>
        <Slides controls loop n={2} />
      </main>
    )
    const index = screen.getByTestId("index")
    const prev = screen.getByRole("button", { name: "Previous" })
    const next = screen.getByRole("button", { name: "Next" })
    await expect.element(index).toHaveTextContent("1/2")
    await expect.element(prev).toBeEnabled()
    await userEvent.click(next)
    await expect.element(index).toHaveTextContent("2/2")
    await expect.element(next).toBeEnabled()
    await userEvent.click(next)
    await expect.element(index).toHaveTextContent("1/2")
  })

  it("disables both controls for a single looping slide", async () => {
    const screen = await render(
      <main>
        <Slides controls loop n={1} />
      </main>
    )
    await expect.element(screen.getByTestId("index")).toHaveTextContent("1/1")
    await expect
      .element(screen.getByRole("button", { name: "Next" }))
      .toBeDisabled()
    await expect
      .element(screen.getByRole("button", { name: "Previous" }))
      .toBeDisabled()
  })

  it("unsubscribes every carousel listener it registered when it unmounts", async () => {
    const on = vi.fn()
    const off = vi.fn()
    const setApi = (api: CarouselApi) => {
      if (!api) return
      const originalOn = api.on.bind(api)
      const originalOff = api.off.bind(api)
      api.on = (event, handler) => {
        on(event, handler)
        return originalOn(event, handler)
      }
      api.off = (event, handler) => {
        off(event, handler)
        return originalOff(event, handler)
      }
    }
    const screen = await render(
      <main>
        <Slides controls n={2} setApi={setApi} />
      </main>
    )
    await expect.element(screen.getByTestId("index")).toHaveTextContent("1/2")
    // Only the snap hook listens to slidesChanged, so its handlers identify
    // the listeners this component owns (the wrapper's are not its concern).
    const owned = on.mock.calls
      .filter(([event]) => event === "slidesChanged")
      .map(([, handler]) => handler)
    expect(owned.length).toBeGreaterThanOrEqual(3)

    await screen.unmount()
    for (const handler of owned) {
      for (const event of ["select", "reInit", "slidesChanged"]) {
        expect(off).toHaveBeenCalledWith(event, handler)
      }
    }
  })
})

describe("InlineCitationCarouselContent and InlineCitationCarouselItem", () => {
  it("renders the embla viewport with slides marked as groups", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarousel>
          <InlineCitationCarouselContent className="custom-content">
            <InlineCitationCarouselItem className="custom-item">
              Slide
            </InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    const viewport = screen.container.querySelector(
      '[data-slot="carousel-content"]'
    )
    expect(viewport).not.toBeNull()
    expect(viewport?.querySelector(".custom-content")).not.toBeNull()
    const slide = screen.getByText("Slide").element()
    expect(slide).toHaveAttribute("role", "group")
    expect(slide).toHaveAttribute("aria-roledescription", "slide")
    expect(slide).toHaveClass(
      "w-full",
      "space-y-2",
      "p-4",
      "pl-8",
      "custom-item"
    )
  })
})

describe("InlineCitationCarouselHeader", () => {
  it("renders header", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarouselHeader className="custom">
          Header
        </InlineCitationCarouselHeader>
      </main>
    )
    const header = screen.getByText("Header")
    await expect.element(header).toBeVisible()
    expect(header.element()).toHaveClass("bg-secondary", "custom")
  })
})

describe("InlineCitationCarouselIndex", () => {
  // Upstream's "renders index component" passes `count`/`current` as DOM
  // attributes the component never reads, so it is not ported.

  it("renders custom children", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarousel>
          <InlineCitationCarouselHeader>
            <InlineCitationCarouselIndex>
              Custom Index
            </InlineCitationCarouselIndex>
          </InlineCitationCarouselHeader>
          <InlineCitationCarouselContent>
            <InlineCitationCarouselItem>Item</InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    await expect.element(screen.getByText("Custom Index")).toBeVisible()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarousel>
          <InlineCitationCarouselHeader>
            <InlineCitationCarouselIndex className="custom-index" />
          </InlineCitationCarouselHeader>
          <InlineCitationCarouselContent>
            <InlineCitationCarouselItem>Item</InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    expect(screen.container.querySelector(".custom-index")).not.toBeNull()
  })

  it("shows the current slide and the count", async () => {
    const screen = await render(
      <main>
        <Slides controls n={3} />
      </main>
    )
    const index = screen.getByTestId("index")
    await expect.element(index).toHaveTextContent("1/3")
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await expect.element(index).toHaveTextContent("2/3")
  })

  it("updates when slides are added or removed", async () => {
    const screen = await render(
      <main>
        <Slides n={2} />
      </main>
    )
    const index = screen.getByTestId("index")
    await expect.element(index).toHaveTextContent("1/2")
    await screen.rerender(
      <main>
        <Slides n={3} />
      </main>
    )
    await expect.element(index).toHaveTextContent("1/3")
    await screen.rerender(
      <main>
        <Slides n={1} />
      </main>
    )
    await expect.element(index).toHaveTextContent("1/1")
  })

  it("clamps the index when the current slide is removed", async () => {
    const screen = await render(
      <main>
        <Slides controls n={3} />
      </main>
    )
    const index = screen.getByTestId("index")
    const next = screen.getByRole("button", { name: "Next" })
    await userEvent.click(next)
    await userEvent.click(next)
    await expect.element(index).toHaveTextContent("3/3")

    await screen.rerender(
      <main>
        <Slides controls n={2} />
      </main>
    )
    await expect.element(index).toHaveTextContent("2/2")
    await expect.element(next).toBeDisabled()
  })

  it("shows 0/0 with no slides, also after the last slide is removed", async () => {
    const screen = await render(
      <main>
        <Slides n={0} />
      </main>
    )
    const index = screen.getByTestId("index")
    await expect.element(index).toHaveTextContent("0/0")

    // Removing the only slide re-initializes embla with an empty snap list,
    // where selectedScrollSnap() is still 0 and must not read as slide 1.
    await screen.rerender(
      <main>
        <Slides n={1} />
      </main>
    )
    await expect.element(index).toHaveTextContent("1/1")
    await screen.rerender(
      <main>
        <Slides n={0} />
      </main>
    )
    await expect.element(index).toHaveTextContent("0/0")
  })
})

describe("InlineCitationCarouselPrev", () => {
  it("renders previous button", async () => {
    const screen = await render(
      <main>
        <Slides controls n={1} />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /previous/i }))
      .toBeInTheDocument()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarousel>
          <InlineCitationCarouselHeader>
            <InlineCitationCarouselPrev className="custom-prev" />
          </InlineCitationCarouselHeader>
          <InlineCitationCarouselContent>
            <InlineCitationCarouselItem>Item</InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    expect(
      screen.getByRole("button", { name: /previous/i }).element()
    ).toHaveClass("custom-prev")
  })

  it("renders ArrowLeftIcon", async () => {
    const screen = await render(
      <main>
        <Slides controls n={1} />
      </main>
    )
    const button = screen.getByRole("button", { name: /previous/i }).element()
    expect(button.querySelector("svg.lucide-arrow-left")).not.toBeNull()
  })

  it("navigates to previous item when clicked", async () => {
    const screen = await render(
      <main>
        <Slides controls n={2} />
      </main>
    )
    const index = screen.getByTestId("index")
    await userEvent.click(screen.getByRole("button", { name: /next/i }))
    await expect.element(index).toHaveTextContent("2/2")
    await userEvent.click(screen.getByRole("button", { name: /previous/i }))
    await expect.element(index).toHaveTextContent("1/2")
  })

  it("is aria-disabled, focusable and inert on the first slide and with a single slide", async () => {
    const screen = await render(
      <main>
        <Slides controls n={2} />
      </main>
    )
    const index = screen.getByTestId("index")
    const prev = screen.getByRole("button", { name: "Previous" })
    await expect.element(index).toHaveTextContent("1/2")
    await expect.element(prev).toBeDisabled()
    expect(prev.element()).toHaveAttribute("aria-disabled", "true")
    expect(prev.element().hasAttribute("disabled")).toBe(false)
    ;(prev.element() as HTMLElement).focus()
    expect(document.activeElement).toBe(prev.element())
    ;(prev.element() as HTMLElement).click()
    await flush()
    await expect.element(index).toHaveTextContent("1/2")

    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await expect.element(prev).toBeEnabled()
    expect(prev.element()).toHaveAttribute("aria-disabled", "false")

    await screen.rerender(
      <main>
        <Slides controls n={1} />
      </main>
    )
    await expect.element(prev).toBeDisabled()
  })

  it("forwards button props, so a consumer disabled or aria-disabled wins", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarousel>
          <InlineCitationCarouselHeader>
            <InlineCitationCarouselNext data-testid="next" disabled />
            <InlineCitationCarouselPrev
              aria-disabled={false}
              data-testid="prev"
            />
          </InlineCitationCarouselHeader>
          <InlineCitationCarouselContent>
            <InlineCitationCarouselItem>Item 1</InlineCitationCarouselItem>
            <InlineCitationCarouselItem>Item 2</InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    const next = screen.getByTestId("next")
    await expect.element(next).toBeDisabled()
    expect(next.element().hasAttribute("disabled")).toBe(true)
    await expect.element(screen.getByTestId("prev")).toBeEnabled()
  })
})

describe("InlineCitationCarouselNext", () => {
  it("renders next button", async () => {
    const screen = await render(
      <main>
        <Slides controls n={1} />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /next/i }))
      .toBeInTheDocument()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <InlineCitationCarousel>
          <InlineCitationCarouselHeader>
            <InlineCitationCarouselNext className="custom-next" />
          </InlineCitationCarouselHeader>
          <InlineCitationCarouselContent>
            <InlineCitationCarouselItem>Item</InlineCitationCarouselItem>
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </main>
    )
    expect(screen.getByRole("button", { name: /next/i }).element()).toHaveClass(
      "custom-next"
    )
  })

  it("renders ArrowRightIcon", async () => {
    const screen = await render(
      <main>
        <Slides controls n={1} />
      </main>
    )
    const button = screen.getByRole("button", { name: /next/i }).element()
    expect(button.querySelector("svg.lucide-arrow-right")).not.toBeNull()
  })

  it("navigates to next item when clicked", async () => {
    const screen = await render(
      <main>
        <Slides controls n={2} />
      </main>
    )
    const index = screen.getByTestId("index")
    await expect.element(index).toHaveTextContent("1/2")
    await userEvent.click(screen.getByRole("button", { name: /next/i }))
    await expect.element(index).toHaveTextContent("2/2")
  })

  it("is aria-disabled and dimmed on the last slide so the carousel has a visible end", async () => {
    const screen = await render(
      <main>
        <Slides controls n={2} />
      </main>
    )
    const index = screen.getByTestId("index")
    const next = screen.getByRole("button", { name: "Next" })
    await expect.element(next).toBeEnabled()
    expect(getComputedStyle(next.element()).opacity).toBe("1")
    await userEvent.click(next)
    await expect.element(index).toHaveTextContent("2/2")
    await expect.element(next).toBeDisabled()
    expect(next.element()).toHaveAttribute("aria-disabled", "true")
    expect(next.element().hasAttribute("disabled")).toBe(false)
    await expect
      .poll(() => getComputedStyle(next.element()).opacity)
      .toBe("0.5")
    // Playwright will not click an aria-disabled button; the DOM click still
    // reaches it, as a screen reader's activation would.
    ;(next.element() as HTMLElement).click()
    await flush()
    await expect.element(index).toHaveTextContent("2/2")
    await expect
      .element(screen.getByRole("button", { name: "Previous" }))
      .toBeEnabled()
  })

  it("has a 24px hit area and a visible focus ring", async () => {
    const screen = await render(
      <main>
        <Slides controls n={2} />
      </main>
    )
    const next = screen.getByRole("button", { name: "Next" }).element()
    const rect = next.getBoundingClientRect()
    expect(rect.width).toBeGreaterThanOrEqual(24)
    expect(rect.height).toBeGreaterThanOrEqual(24)
    expect(next).toHaveClass("focus-visible:ring-3")
  })
})

describe("InlineCitationSource", () => {
  it("renders source with all props", async () => {
    const screen = await render(
      <main>
        <InlineCitationSource
          description="Description text"
          title="Source Title"
          url="https://example.com"
        />
      </main>
    )
    await expect.element(screen.getByText("Source Title")).toBeVisible()
    await expect.element(screen.getByText("https://example.com")).toBeVisible()
    await expect.element(screen.getByText("Description text")).toBeVisible()
  })

  it("renders custom children", async () => {
    const screen = await render(
      <main>
        <InlineCitationSource>Custom content</InlineCitationSource>
      </main>
    )
    await expect.element(screen.getByText("Custom content")).toBeVisible()
  })

  it("renders only the fields it is given, with the title as a paragraph", async () => {
    const screen = await render(
      <main>
        <InlineCitationSource data-testid="src" url="https://example.com/a" />
        <InlineCitationSource data-testid="titled" title="Only title" />
      </main>
    )
    expect(
      screen.getByTestId("src").element().querySelectorAll("p").length
    ).toBe(1)
    const titled = screen.getByTestId("titled").element()
    expect(titled.querySelector("h4")).toBeNull()
    expect(titled.querySelector("p")?.textContent).toBe("Only title")
    expect(titled.querySelectorAll("p").length).toBe(1)
  })

  it("renders nothing without content", async () => {
    const screen = await render(
      <main>
        <InlineCitationSource data-testid="empty" />
        <InlineCitationSource data-testid="blank" description="" title="" />
      </main>
    )
    expect(screen.container.querySelector("[data-testid]")).toBeNull()
  })

  it("renders nothing for an empty array, null children or whitespace", async () => {
    const screen = await render(
      <main>
        <InlineCitationSource data-testid="array">
          {[].map(() => null)}
        </InlineCitationSource>
        <InlineCitationSource data-testid="nulls">
          {null}
          {false}
        </InlineCitationSource>
        <InlineCitationSource data-testid="space">
          {"  \n "}
        </InlineCitationSource>
        <InlineCitationSource data-testid="zero">{0}</InlineCitationSource>
      </main>
    )
    const rendered = [
      ...screen.container.querySelectorAll("[data-testid]"),
    ].map((element) => element.getAttribute("data-testid"))
    expect(rendered).toEqual(["zero"])
  })
})

describe("InlineCitationQuote", () => {
  it("renders quote", async () => {
    const screen = await render(
      <main>
        <InlineCitationQuote>Quote text</InlineCitationQuote>
      </main>
    )
    await expect.element(screen.getByText("Quote text")).toBeVisible()
  })

  it("renders as blockquote element", async () => {
    const screen = await render(
      <main>
        <InlineCitationQuote className="custom">Quote</InlineCitationQuote>
      </main>
    )
    const quote = screen.container.querySelector("blockquote")
    expect(quote).not.toBeNull()
    expect(quote).toHaveClass("italic", "custom")
  })

  it("renders nothing when empty, for an empty array or for whitespace", async () => {
    const screen = await render(
      <main>
        <InlineCitationQuote data-testid="quote" />
        <InlineCitationQuote data-testid="blank">{""}</InlineCitationQuote>
        <InlineCitationQuote data-testid="array">{[]}</InlineCitationQuote>
        <InlineCitationQuote data-testid="space">{"   "}</InlineCitationQuote>
        <InlineCitationQuote data-testid="nulls">
          {[null, false]}
        </InlineCitationQuote>
      </main>
    )
    expect(screen.container.querySelector("blockquote")).toBeNull()
  })
})

describe("composition", () => {
  it("opens the source card on hover and pages through sources", async () => {
    const screen = await render(<Citation />)

    const badge = screen.getByRole("button", { name: "ai-sdk.dev +1" })
    await expect.element(badge).toBeVisible()
    await expect
      .element(page.getByText("Streaming custom data"))
      .not.toBeInTheDocument()
    await expectNoViolations()

    await userEvent.hover(badge)

    await expect.element(page.getByText("Streaming custom data")).toBeVisible()
    await expect.element(page.getByText("1/2")).toBeVisible()
    await expectNoViolations()

    await userEvent.click(page.getByRole("button", { name: "Next" }))
    await expect.element(page.getByText("2/2")).toBeVisible()
    await expect.element(page.getByText("useTransition")).toBeVisible()
    await expect
      .element(page.getByRole("button", { name: "Next" }))
      .toBeDisabled()
    await expectNoViolations()
  })

  it("passes axe with a single source and no paging controls", async () => {
    const screen = await render(
      <Citation controls={false} items={sources.slice(0, 1)} />
    )
    await userEvent.hover(screen.getByRole("button", { name: "ai-sdk.dev" }))
    await expect.element(page.getByText("1/1")).toBeVisible()
    await expectNoViolations()
  })

  it("passes axe in dark mode with the card open", async () => {
    await withDark(async () => {
      const screen = await render(<Citation />)
      await userEvent.hover(
        screen.getByRole("button", { name: "ai-sdk.dev +1" })
      )
      await expect
        .element(page.getByText("Streaming custom data"))
        .toBeVisible()
      await expectNoViolations()
    })
  })
})
