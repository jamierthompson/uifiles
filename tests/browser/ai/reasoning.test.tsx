import type { ComponentProps, ReactNode } from "react"
import { act, Component, StrictMode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import ReasoningPreview from "@/app/preview/reasoning/page"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  useReasoning,
} from "@/registry/ai/reasoning"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

const thought = "First I check the **cache headers**, then the origin."

// The response preview's regularized logistic loss
// (app/preview/response/page.tsx): about 500 px of formula, wider than a phone.
const WIDE_FORMULA = String.raw`$$
\mathcal{L}(\theta) = -\frac{1}{n} \sum_{i=1}^{n} \left[ y_i \log \sigma(\theta^\top x_i) + (1 - y_i) \log\left(1 - \sigma(\theta^\top x_i)\right) \right] + \lambda \lVert \theta \rVert_2^2
$$`
// Header cells never wrap, so the table is at least as wide as its headers.
const WIDE_TABLE = [
  "| Caching strategy | Freshness guarantee | Relative cost | Recommended for |",
  "| --- | --- | --- | --- |",
  "| no-store | Always fresh | Highest | Personalized dashboards |",
  "| force-cache | Until redeploy | Lowest | Reference data |",
].join("\n")

// One line of about 800 px of monospace, wider than a phone.
const WIDE_CODE =
  "```ts\nconst reallyLongIdentifierName = anotherReallyLongFunctionName(withArguments, andMore, andEvenMore)\n```"
const CODE_BLOCK_BODY = "[data-streamdown='code-block-body']"

const mathDisplays = () => [
  ...document.querySelectorAll<HTMLElement>(".katex-display"),
]
/** The attributes Message Response gives a scroller while it overflows. */
const scrollRegion = (element: Element | null) =>
  element && {
    tabindex: element.getAttribute("tabindex"),
    role: element.getAttribute("role"),
    label: element.getAttribute("aria-label"),
  }
const NAMED_CODE = { tabindex: "0", role: "group", label: "Code" }
const NAMED_MATH = { tabindex: "0", role: "group", label: "Math" }
const NAMED_TABLE = { tabindex: "0", role: "group", label: "Table" }

type FixtureProps = ComponentProps<typeof Reasoning>

// The harness page has no landmark of its own; <main> keeps axe's "region"
// rule about the component rather than the blank test page.
function Fixture(props: FixtureProps) {
  return (
    <main>
      <Reasoning {...props}>
        <ReasoningTrigger />
        <ReasoningContent>{thought}</ReasoningContent>
      </Reasoning>
    </main>
  )
}

/** Trigger only: no Streamdown, so every fake timer is the component's own. */
function TriggerOnly(props: FixtureProps) {
  return (
    <main>
      <Reasoning {...props}>
        <ReasoningTrigger />
      </Reasoning>
    </main>
  )
}

class Boundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    this.props.onError(error)
  }
  render() {
    return this.state.failed ? <p>render failed</p> : this.props.children
  }
}

/** Fakes timers and the clock only, leaving React's scheduler alone. */
function useFakeTimers() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  })
}

/**
 * Runs `fn` inside React's act. vitest-browser-react only flags the act
 * environment during its own render/rerender calls, so it is set here too.
 */
async function inAct(fn: () => void): Promise<void> {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean | undefined }
  const previous = env.IS_REACT_ACT_ENVIRONMENT
  env.IS_REACT_ACT_ENVIRONMENT = true
  try {
    await act(async () => {
      fn()
    })
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = previous
  }
}

/** Advances the fake clock inside act so React flushes the resulting updates. */
const advance = (ms: number) => inAct(() => vi.advanceTimersByTime(ms))

/** Clicks inside act; userEvent cannot be awaited while timers are faked. */
const click = (element: Element) =>
  inAct(() => (element as HTMLElement).click())

const expanded = (screen: {
  getByRole: (role: string) => { element: () => Element }
}) => screen.getByRole("button").element().getAttribute("aria-expanded")

const contentMounted = () =>
  document.querySelector("[data-slot='collapsible-content']") !== null

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await page.viewport(414, 896)
})

describe("reasoning", () => {
  it("renders children", async () => {
    const screen = await render(<Reasoning>Content</Reasoning>)
    await expect.element(screen.getByText("Content")).toBeInTheDocument()
  })

  it("throws when ReasoningTrigger is used outside Reasoning", async () => {
    allowConsole("error")
    const onError = vi.fn()
    await render(
      <Boundary onError={onError}>
        <ReasoningTrigger />
      </Boundary>
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0]?.[0].message).toBe(
      "Reasoning components must be used within Reasoning"
    )
  })

  it("starts closed by default when not streaming (old messages)", async () => {
    const screen = await render(<Fixture />)
    expect(expanded(screen)).toBe("false")
    expect(screen.getByText("cache headers").query()).toBeNull()
  })

  it("starts open when streaming", async () => {
    const screen = await render(<Fixture isStreaming />)
    expect(expanded(screen)).toBe("true")
    await expect.element(screen.getByText("cache headers")).toBeVisible()
  })

  it("can be forced open with defaultOpen", async () => {
    const screen = await render(<Fixture defaultOpen />)
    expect(expanded(screen)).toBe("true")
    await expect.element(screen.getByText("cache headers")).toBeVisible()
  })

  it("can be forced closed with defaultOpen={false} while streaming", async () => {
    const screen = await render(<Fixture defaultOpen={false} isStreaming />)
    expect(expanded(screen)).toBe("false")
    expect(screen.getByText("cache headers").query()).toBeNull()
  })

  it("calls onOpenChange with exactly one argument on a manual toggle", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <Fixture defaultOpen={false} onOpenChange={onOpenChange} />
    )
    await userEvent.click(screen.getByRole("button"))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]).toEqual([true])
    await expect.element(screen.getByText("cache headers")).toBeVisible()
  })

  it("is read-only when open is given without onOpenChange", async () => {
    const screen = await render(<Fixture open={false} />)
    const trigger = screen.getByRole("button")
    await userEvent.click(trigger)
    await expect
      .poll(() => trigger.element().getAttribute("aria-expanded"))
      .toBe("false")
    expect(screen.getByText("cache headers").query()).toBeNull()
  })

  it("asks a controlled parent to open once per stream even when it ignores the request and keeps re-rendering", async () => {
    const onOpenChange = vi.fn()
    const ui = () => (
      <Fixture isStreaming onOpenChange={onOpenChange} open={false} />
    )
    const screen = await render(ui())
    await expect.poll(() => onOpenChange.mock.calls).toEqual([[true]])
    for (let i = 0; i < 5; i += 1) {
      await screen.rerender(ui())
    }
    expect(onOpenChange.mock.calls).toEqual([[true]])
    expect(expanded(screen)).toBe("false")
  })

  it("asks a controlled parent to close once after the stream even when it ignores the request", async () => {
    useFakeTimers()
    const onOpenChange = vi.fn()
    const ui = (isStreaming: boolean) => (
      <TriggerOnly isStreaming={isStreaming} onOpenChange={onOpenChange} open />
    )
    const screen = await render(ui(true))
    await screen.rerender(ui(false))
    await advance(1000)
    expect(onOpenChange.mock.calls).toEqual([[false]])
    for (let i = 0; i < 3; i += 1) {
      await screen.rerender(ui(false))
      await advance(1000)
    }
    expect(onOpenChange.mock.calls).toEqual([[false]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it("auto-opens and auto-closes exactly once under StrictMode", async () => {
    useFakeTimers()
    const controlled = vi.fn()
    const uncontrolled = vi.fn()
    const ui = (isStreaming: boolean) => (
      <StrictMode>
        <main>
          <Reasoning
            isStreaming={isStreaming}
            onOpenChange={controlled}
            open={false}
          >
            <ReasoningTrigger />
          </Reasoning>
          <Reasoning isStreaming={isStreaming} onOpenChange={uncontrolled}>
            <ReasoningTrigger />
          </Reasoning>
        </main>
      </StrictMode>
    )
    const screen = await render(ui(true))
    expect(controlled.mock.calls).toEqual([[true]])
    expect(vi.getTimerCount()).toBe(0)

    await screen.rerender(ui(false))
    expect(vi.getTimerCount()).toBe(1)
    await advance(1000)
    expect(uncontrolled.mock.calls).toEqual([[false]])
    expect(controlled.mock.calls).toEqual([[true]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it("auto-opens when streaming starts after mount", async () => {
    const screen = await render(<Fixture isStreaming={false} />)
    expect(expanded(screen)).toBe("false")
    await screen.rerender(<Fixture isStreaming />)
    expect(expanded(screen)).toBe("true")
    await expect.element(screen.getByText("cache headers")).toBeVisible()
  })

  it("auto-closes one second after streaming stops", async () => {
    useFakeTimers()
    const screen = await render(<Fixture isStreaming />)
    expect(expanded(screen)).toBe("true")

    await screen.rerender(<Fixture isStreaming={false} />)
    expect(expanded(screen)).toBe("true")

    await advance(999)
    expect(expanded(screen)).toBe("true")

    await advance(1)
    expect(expanded(screen)).toBe("false")
    vi.useRealTimers()
    await expect
      .element(screen.getByText("cache headers"))
      .not.toBeInTheDocument()
  })

  it("keeps exactly one auto-close timer while the parent re-renders every 50 ms with a new inline onOpenChange", async () => {
    useFakeTimers()
    const calls: boolean[] = []
    const ui = (isStreaming: boolean) => (
      <TriggerOnly
        isStreaming={isStreaming}
        onOpenChange={(open) => calls.push(open)}
      />
    )
    const screen = await render(ui(true))
    for (let i = 0; i < 10; i += 1) {
      await advance(50)
      await screen.rerender(ui(true))
    }
    expect(vi.getTimerCount()).toBe(0)

    await screen.rerender(ui(false))
    expect(vi.getTimerCount()).toBe(1)
    for (let i = 0; i < 19; i += 1) {
      await advance(50)
      await screen.rerender(ui(false))
      expect(vi.getTimerCount()).toBe(1)
      expect(expanded(screen)).toBe("true")
    }

    await advance(50)
    expect(expanded(screen)).toBe("false")
    expect(calls).toEqual([false])
    expect(vi.getTimerCount()).toBe(0)
  })

  it("stays closed when the reader closes it mid-stream and re-opens only for a new stream", async () => {
    const screen = await render(<Fixture isStreaming />)
    const trigger = screen.getByRole("button")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    // Still streaming: a further render must not re-open it.
    await screen.rerender(<Fixture isStreaming />)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")

    await screen.rerender(<Fixture isStreaming={false} />)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")

    await screen.rerender(<Fixture isStreaming />)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("does not auto-close a panel the reader closed mid-stream and re-opened", async () => {
    useFakeTimers()
    const onOpenChange = vi.fn()
    const screen = await render(
      <Fixture isStreaming onOpenChange={onOpenChange} />
    )
    const trigger = screen.getByRole("button").element()
    await click(trigger)
    await click(trigger)
    expect(onOpenChange.mock.calls).toEqual([[false], [true]])

    await screen.rerender(
      <Fixture isStreaming={false} onOpenChange={onOpenChange} />
    )
    await advance(2000)
    expect(expanded(screen)).toBe("true")
    expect(onOpenChange).toHaveBeenCalledTimes(2)
  })

  it("does not auto-close a message that never streamed and was opened with defaultOpen", async () => {
    useFakeTimers()
    const onOpenChange = vi.fn()
    const screen = await render(
      <Fixture defaultOpen isStreaming={false} onOpenChange={onOpenChange} />
    )
    expect(expanded(screen)).toBe("true")

    await advance(1500)
    expect(expanded(screen)).toBe("true")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("does not auto-close again after the reader re-opens an auto-closed panel", async () => {
    useFakeTimers()
    const onOpenChange = vi.fn()
    const screen = await render(
      <Fixture isStreaming onOpenChange={onOpenChange} />
    )
    await screen.rerender(
      <Fixture isStreaming={false} onOpenChange={onOpenChange} />
    )
    await advance(1000)
    expect(expanded(screen)).toBe("false")
    expect(onOpenChange.mock.calls).toEqual([[false]])

    await click(screen.getByRole("button").element())
    expect(expanded(screen)).toBe("true")
    await advance(3000)
    expect(expanded(screen)).toBe("true")
    expect(onOpenChange.mock.calls).toEqual([[false], [true]])
  })

  it("keeps open a panel that a controlled parent re-opens after the auto-close", async () => {
    useFakeTimers()
    function Parent({ isStreaming }: { isStreaming: boolean }) {
      const [open, setOpen] = useState(true)
      return (
        <main>
          <button onClick={() => setOpen(true)} type="button">
            expand
          </button>
          <Reasoning
            isStreaming={isStreaming}
            onOpenChange={setOpen}
            open={open}
          >
            <ReasoningTrigger />
            <ReasoningContent>{thought}</ReasoningContent>
          </Reasoning>
        </main>
      )
    }
    const trigger = () =>
      document.querySelector("[data-slot='collapsible-trigger']")
    const screen = await render(<Parent isStreaming />)
    await screen.rerender(<Parent isStreaming={false} />)
    await advance(1000)
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false")

    // The parent re-opens programmatically, not through the trigger, so only
    // the timer callback's own "spent" mark keeps this open.
    await click(screen.getByRole("button", { name: "expand" }).element())
    expect(trigger()?.getAttribute("aria-expanded")).toBe("true")
    await advance(3000)
    expect(trigger()?.getAttribute("aria-expanded")).toBe("true")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("stays open when the reader closes and re-opens it inside the auto-close window", async () => {
    useFakeTimers()
    const onOpenChange = vi.fn()
    const ui = (isStreaming: boolean) => (
      <Fixture isStreaming={isStreaming} onOpenChange={onOpenChange} />
    )
    const screen = await render(ui(true))
    await screen.rerender(ui(false))
    await advance(500)
    const trigger = screen.getByRole("button").element()
    await click(trigger)
    expect(expanded(screen)).toBe("false")
    await click(trigger)
    expect(expanded(screen)).toBe("true")
    await advance(3000)
    expect(expanded(screen)).toBe("true")
    expect(onOpenChange.mock.calls).toEqual([[false], [true]])
  })

  it("auto-opens and auto-closes again for a second stream", async () => {
    useFakeTimers()
    const screen = await render(<Fixture isStreaming />)
    await screen.rerender(<Fixture isStreaming={false} />)
    await advance(1000)
    expect(expanded(screen)).toBe("false")

    await screen.rerender(<Fixture isStreaming />)
    expect(expanded(screen)).toBe("true")
    await screen.rerender(<Fixture isStreaming={false} />)
    await advance(1000)
    expect(expanded(screen)).toBe("false")
  })

  // The console guard in tests/setup.ts fails either test if React logs a
  // state update on an unmounted component.
  it("clears a pending auto-close timer on unmount", async () => {
    useFakeTimers()
    const onOpenChange = vi.fn()
    const screen = await render(
      <Fixture isStreaming onOpenChange={onOpenChange} />
    )
    await screen.rerender(
      <Fixture isStreaming={false} onOpenChange={onOpenChange} />
    )
    await screen.unmount()
    expect(vi.getTimerCount()).toBe(0)
    await advance(2000)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("unmounts cleanly mid-stream", async () => {
    useFakeTimers()
    const screen = await render(<Fixture isStreaming />)
    await advance(300)
    await screen.unmount()
    expect(vi.getTimerCount()).toBe(0)
    await advance(2000)
  })
})

describe("reasoningTrigger", () => {
  it("renders the default thinking message when streaming", async () => {
    const screen = await render(
      <Reasoning isStreaming>
        <ReasoningTrigger />
      </Reasoning>
    )
    await expect.element(screen.getByText("Thinking...")).toHaveClass("shimmer")
  })

  it("renders the duration message when not streaming", async () => {
    const screen = await render(
      <Reasoning duration={5} isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    await expect
      .element(screen.getByRole("button", { name: "Thought for 5 seconds" }))
      .toBeVisible()
  })

  it("renders the thinking message when duration is 0", async () => {
    const screen = await render(
      <Reasoning duration={0} isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    await expect.element(screen.getByText("Thinking...")).toHaveClass("shimmer")
  })

  it("renders the generic message when duration is undefined", async () => {
    const screen = await render(
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    await expect
      .element(screen.getByText("Thought for a few seconds"))
      .toBeVisible()
  })

  it("rounds a sub-second stream up to 1 second", async () => {
    useFakeTimers()
    const screen = await render(
      <Reasoning isStreaming>
        <ReasoningTrigger />
      </Reasoning>
    )
    expect(screen.getByText("Thinking...").query()).not.toBeNull()

    await advance(300)
    await screen.rerender(
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    expect(screen.getByText("Thought for 1 seconds").query()).not.toBeNull()
    expect(screen.getByText("Thinking...").query()).toBeNull()
  })

  it("reports at least one second for a stream that starts and ends within the same millisecond", async () => {
    useFakeTimers()
    const ui = (isStreaming: boolean) => (
      <TriggerOnly isStreaming={isStreaming} />
    )
    const screen = await render(ui(true))
    expect(screen.getByText("Thinking...").query()).not.toBeNull()
    // The clock is frozen: the start and end commits read the same Date.now().
    await screen.rerender(ui(false))
    expect(screen.getByText("Thinking...").query()).toBeNull()
    expect(screen.getByText("Thought for 1 seconds").query()).not.toBeNull()
  })

  it("reports the measured duration in whole seconds, rounded up", async () => {
    useFakeTimers()
    const screen = await render(
      <Reasoning isStreaming>
        <ReasoningTrigger />
      </Reasoning>
    )
    await advance(2500)
    await screen.rerender(
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    expect(screen.getByText("Thought for 3 seconds").query()).not.toBeNull()
  })

  it("prefers the duration prop over the measured value", async () => {
    useFakeTimers()
    const screen = await render(
      <Reasoning duration={9} isStreaming>
        <ReasoningTrigger />
      </Reasoning>
    )
    await advance(2500)
    await screen.rerender(
      <Reasoning duration={9} isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    expect(screen.getByText("Thought for 9 seconds").query()).not.toBeNull()
  })

  it("measures a second stream afresh", async () => {
    useFakeTimers()
    const screen = await render(
      <Reasoning isStreaming>
        <ReasoningTrigger />
      </Reasoning>
    )
    await advance(2500)
    await screen.rerender(
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    expect(screen.getByText("Thought for 3 seconds").query()).not.toBeNull()

    await screen.rerender(
      <Reasoning isStreaming>
        <ReasoningTrigger />
      </Reasoning>
    )
    expect(screen.getByText("Thinking...").query()).not.toBeNull()
    await advance(1200)
    await screen.rerender(
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>
    )
    expect(screen.getByText("Thought for 2 seconds").query()).not.toBeNull()
  })

  it("renders custom children instead of the default label", async () => {
    const screen = await render(
      <Reasoning duration={5}>
        <ReasoningTrigger>Custom trigger</ReasoningTrigger>
      </Reasoning>
    )
    await expect
      .element(screen.getByRole("button", { name: "Custom trigger" }))
      .toBeVisible()
    expect(screen.getByText("Thought for 5 seconds").query()).toBeNull()
    expect(document.querySelector("svg.lucide-brain")).toBeNull()
  })

  it("calls a custom getThinkingMessage with (isStreaming, duration)", async () => {
    const getThinkingMessage = vi.fn(() => "custom label")
    const screen = await render(
      <Reasoning duration={7}>
        <ReasoningTrigger getThinkingMessage={getThinkingMessage} />
      </Reasoning>
    )
    await expect
      .element(screen.getByRole("button", { name: "custom label" }))
      .toBeVisible()
    expect(getThinkingMessage).toHaveBeenCalledWith(false, 7)
  })

  it("has a brain icon and puts only phrasing content inside the button", async () => {
    const screen = await render(
      <Reasoning duration={2}>
        <ReasoningTrigger />
      </Reasoning>
    )
    const trigger = screen.getByRole("button").element()
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.querySelector("svg.lucide-brain")).not.toBeNull()
    expect(trigger.querySelector("p, div")).toBeNull()
    expect(trigger.querySelector("span")?.textContent).toBe(
      "Thought for 2 seconds"
    )
  })

  it("rotates the chevron while open", async () => {
    const screen = await render(<Fixture defaultOpen={false} />)
    const trigger = screen.getByRole("button")
    const chevron = () =>
      trigger.element().querySelector("svg.lucide-chevron-down")
    expect(chevron()?.classList.contains("rotate-0")).toBe(true)
    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    expect(chevron()?.classList.contains("rotate-180")).toBe(true)
  })

  it("toggles from the keyboard and names the panel through aria-controls", async () => {
    const screen = await render(<Fixture duration={2} />)
    const trigger = screen.getByRole("button")
    await userEvent.tab()
    expect(document.activeElement).toBe(trigger.element())

    await userEvent.keyboard("{Enter}")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    const panelId = trigger.element().getAttribute("aria-controls")
    expect(panelId).toBeTruthy()
    expect(
      document.getElementById(panelId ?? "")?.getAttribute("data-slot")
    ).toBe("collapsible-content")

    await userEvent.keyboard(" ")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("is at least 24px tall so it meets the WCAG 2.2 target size", async () => {
    const screen = await render(<Fixture duration={2} />)
    const { height } = screen
      .getByRole("button")
      .element()
      .getBoundingClientRect()
    expect(height).toBeGreaterThanOrEqual(24)
  })
})

describe("reasoningContent", () => {
  it("renders the reasoning text as markdown", async () => {
    const screen = await render(<Fixture defaultOpen />)
    const strong = screen.getByText("cache headers")
    await expect.element(strong).toBeVisible()
    // Streamdown renders emphasis as styled spans rather than <strong>.
    expect(strong.element().getAttribute("data-streamdown")).toBe("strong")
    expect(strong.element().classList.contains("font-semibold")).toBe(true)
  })

  it("applies custom className", async () => {
    await render(
      <Reasoning defaultOpen>
        <ReasoningContent className="custom">Content</ReasoningContent>
      </Reasoning>
    )
    const panel = document.querySelector("[data-slot='collapsible-content']")
    expect(panel?.classList.contains("custom")).toBe(true)
  })

  it("renders an empty string without crashing", async () => {
    const screen = await render(
      <Reasoning defaultOpen duration={2}>
        <ReasoningTrigger />
        <ReasoningContent>{""}</ReasoningContent>
      </Reasoning>
    )
    expect(expanded(screen)).toBe("true")
    expect(contentMounted()).toBe(true)
  })

  it("stays in the DOM but hidden when keepMounted is set", async () => {
    await render(
      <Reasoning duration={2}>
        <ReasoningTrigger />
        <ReasoningContent keepMounted>{thought}</ReasoningContent>
      </Reasoning>
    )
    const panel = document.querySelector("[data-slot='collapsible-content']")
    expect(panel).not.toBeNull()
    expect(panel?.hasAttribute("hidden")).toBe(true)
    expect(panel?.textContent).toContain("cache headers")
  })

  it("lets a custom trigger toggle the panel through useReasoning", async () => {
    function CustomTrigger() {
      const { isOpen, setIsOpen, isStreaming, duration } = useReasoning()
      return (
        <button onClick={() => setIsOpen(!isOpen)} type="button">
          {isStreaming ? "streaming" : `done in ${duration ?? "?"}s`}
        </button>
      )
    }
    const screen = await render(
      <Reasoning duration={4}>
        <CustomTrigger />
        <ReasoningContent>{thought}</ReasoningContent>
      </Reasoning>
    )
    const button = screen.getByRole("button", { name: "done in 4s" })
    expect(contentMounted()).toBe(false)
    await userEvent.click(button)
    await expect.element(screen.getByText("cache headers")).toBeVisible()
    await userEvent.click(button)
    await expect
      .element(screen.getByText("cache headers"))
      .not.toBeInTheDocument()
  })
})

describe("reasoningContent markdown surfaces", () => {
  /** Open reasoning holding `markdown`, as the chat block shows a finished part. */
  function OpenReasoning({ markdown }: { markdown: string }) {
    return (
      <main className="px-4">
        <Reasoning open>
          <ReasoningTrigger />
          <ReasoningContent>{markdown}</ReasoningContent>
        </Reasoning>
      </main>
    )
  }

  it("scrolls the response preview's regularized logistic loss inside a named Math tab stop at 375 px instead of leaving an unreachable scroll region", async () => {
    await page.viewport(375, 800)
    await render(<OpenReasoning markdown={WIDE_FORMULA} />)
    await expect.poll(() => mathDisplays().length).toBe(1)
    const [display] = mathDisplays()
    expect(display).toBeDefined()
    if (!display) return
    // app/globals.css gives .katex-display `overflow: auto hidden`, so the
    // formula scrolls in its own box; the page does not widen (WCAG 1.4.10).
    await expect
      .poll(() => display.scrollWidth > display.clientWidth)
      .toBe(true)
    const root = document.documentElement
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    // A scroll box the keyboard cannot reach fails axe
    // scrollable-region-focusable (serious); it must be a named tab stop.
    await expect.poll(() => scrollRegion(display)).toEqual(NAMED_MATH)
    await expect
      .element(page.getByRole("group", { name: "Math" }))
      .toBeVisible()
    await expectNoViolations()
    await withDark(() => expectNoViolations())

    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(display)
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    await expect.poll(() => display.scrollLeft).toBeGreaterThan(0)
  })

  it("scrolls a table wider than a phone inside a named Table tab stop", async () => {
    await page.viewport(375, 800)
    const screen = await render(<OpenReasoning markdown={WIDE_TABLE} />)
    await expect
      .element(screen.getByRole("cell", { name: "no-store" }))
      .toBeVisible()
    const scroller =
      document.querySelector("[data-streamdown='table']")?.parentElement ?? null
    expect(scroller).not.toBeNull()
    if (!scroller) return
    await expect
      .poll(() => scroller.scrollWidth > scroller.clientWidth)
      .toBe(true)
    const root = document.documentElement
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    await expect.poll(() => scrollRegion(scroller)).toEqual(NAMED_TABLE)
    await expect
      .element(screen.getByRole("group", { name: "Table" }))
      .toBeVisible()
    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("highlights a code fence with the high-contrast GitHub pair and scrolls a line wider than a phone inside a named Code tab stop", async () => {
    await page.viewport(375, 800)
    await render(<OpenReasoning markdown={WIDE_CODE} />)
    // Shiki writes each token's light and dark colors as custom properties.
    const keywordColors = () => {
      const token = [
        ...document.querySelectorAll<HTMLElement>(
          `${CODE_BLOCK_BODY} code span span`
        ),
      ].find((span) => span.textContent === "const")
      return token
        ? [
            token.style.getPropertyValue("--sdm-c"),
            token.style.getPropertyValue("--shiki-dark"),
          ]
        : undefined
    }
    // github-light-high-contrast and github-dark-high-contrast, inherited
    // from Message Response; plain github-light would give #D73A49.
    await expect
      .poll(keywordColors, { timeout: 10_000 })
      .toEqual(["#A0111F", "#FF9492"])
    const body = document.querySelector<HTMLElement>(CODE_BLOCK_BODY)
    expect(body).not.toBeNull()
    if (!body) return
    await expect.poll(() => body.scrollWidth > body.clientWidth).toBe(true)
    const root = document.documentElement
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    await expect.poll(() => scrollRegion(body)).toEqual(NAMED_CODE)
    await expect
      .element(page.getByRole("group", { name: "Code" }))
      .toBeVisible()
    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("scrolls the reasoning preview's code, table and formula in named tab stops at 375 px without widening the page", async () => {
    await page.viewport(375, 800)
    // The preview layout's main: px-4 inside the viewport.
    const screen = await render(
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
        <ReasoningPreview />
      </main>
    )
    // Only the finished demo, open by default, holds a fence, a table and a
    // formula; the streaming demo above it keeps changing, so axe scans the
    // finished one.
    const finished = screen
      .getByRole("heading", { name: "Finished, open" })
      .element()
      .closest("section")
    expect(finished).not.toBeNull()
    if (!finished) return
    const code = () => finished.querySelector(CODE_BLOCK_BODY)
    const table = () =>
      finished.querySelector("[data-streamdown='table']")?.parentElement ?? null
    const formula = () => finished.querySelector(".katex-display")
    await expect.poll(() => scrollRegion(code())).toEqual(NAMED_CODE)
    await expect.poll(() => scrollRegion(table())).toEqual(NAMED_TABLE)
    await expect.poll(() => scrollRegion(formula())).toEqual(NAMED_MATH)
    const root = document.documentElement
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    await expectNoViolations(finished)
    await withDark(() => expectNoViolations(finished))
  })

  it("confirms a link in a modal dialog that takes focus and gives it back to the link on Escape", async () => {
    const screen = await render(
      <OpenReasoning markdown="Checked [the caching guide](https://nextjs.org/docs/app/guides/caching) first." />
    )
    // Streamdown's link-safety button, not a plain anchor that would navigate
    // away without asking. Checked on the rendered text so a plain anchor
    // fails here at once instead of at a locator timeout.
    const label = screen.getByText("the caching guide")
    await expect.element(label).toBeVisible()
    expect(label.element().tagName).toBe("BUTTON")
    expect(label.element().getAttribute("data-streamdown")).toBe("link")
    const link = screen.getByRole("button", { name: "the caching guide" })
    await userEvent.click(link)
    const dialog = page.getByRole("dialog", { name: "Open external link?" })
    await expect.element(dialog).toBeVisible()
    expect(dialog.element().contains(document.activeElement)).toBe(true)
    await expect
      .element(page.getByRole("button", { name: "Close" }))
      .toHaveFocus()
    await expect
      .element(page.getByText("https://nextjs.org/docs/app/guides/caching"))
      .toBeVisible()
    // Streamdown's own modal (a role="button" backdrop around the dialog's
    // buttons, axe nested-interactive) is not rendered.
    expect(
      document.querySelector("[data-streamdown='link-safety-modal']")
    ).toBeNull()
    await expectNoViolations()
    await withDark(() => expectNoViolations())

    await userEvent.keyboard("{Escape}")
    await expect
      .poll(() => document.querySelector("[data-slot='link-safety-dialog']"))
      .toBeNull()
    await expect.element(link).toHaveFocus()
  })

  it("renders each formula once, with KaTeX's MathML copy visually hidden", async () => {
    const screen = await render(
      <OpenReasoning markdown={"Energy:\n\n$$\nE = mc^2\n$$\n"} />
    )
    await expect.element(screen.getByText("Energy:")).toBeVisible()
    await expect.poll(() => document.querySelectorAll(".katex").length).toBe(1)
    expect(mathDisplays()).toHaveLength(1)
    expect(document.querySelectorAll("math")).toHaveLength(1)
    expect(document.body.textContent).not.toContain("$$")
    const html = document.querySelector(".katex .katex-html")
    const mathml = document.querySelector(".katex .katex-mathml")
    expect(html?.getAttribute("aria-hidden")).toBe("true")
    expect(html?.getBoundingClientRect().width).toBeGreaterThan(0)
    // Without KaTeX's stylesheet the MathML fallback is painted too and the
    // formula shows twice.
    const fallback = mathml?.getBoundingClientRect()
    expect(fallback?.width).toBeLessThanOrEqual(1)
    expect(fallback?.height).toBeLessThanOrEqual(1)
  })
})

describe("accessibility", () => {
  it("passes axe closed, open, streaming and in dark mode", async () => {
    const screen = await render(<Fixture duration={4} />)
    await expectNoViolations()

    await userEvent.click(screen.getByRole("button"))
    await expect.element(screen.getByText("cache headers")).toBeVisible()
    await expectNoViolations()

    await screen.rerender(<Fixture isStreaming />)
    await expect.element(screen.getByText("Thinking...")).toBeVisible()
    await expectNoViolations()

    await withDark(async () => {
      await expectNoViolations()
    })
  })
})
