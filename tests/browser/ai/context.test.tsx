import type { LanguageModelUsage } from "ai"
import { Component, type ReactNode } from "react"
import { getUsage } from "tokenlens"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/registry/ai/context"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

const MODEL_ID = "openai:gpt-4o"

// ai@7 usage: cached reads are part of inputTokens and reasoning is part of
// outputTokens, so the builder derives the "details" from the totals.
function usageOf({
  input = 0,
  cacheRead = 0,
  output = 0,
  reasoning = 0,
}: Partial<
  Record<"input" | "cacheRead" | "output" | "reasoning", number>
> = {}): LanguageModelUsage {
  return {
    inputTokens: input,
    inputTokenDetails: {
      noCacheTokens: input - cacheRead,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: 0,
    },
    outputTokens: output,
    outputTokenDetails: {
      textTokens: output - reasoning,
      reasoningTokens: reasoning,
    },
    totalTokens: input + output,
  }
}

const usage = usageOf({
  input: 62_000,
  cacheRead: 20_000,
  output: 18_000,
  reasoning: 6_000,
})

const Body = () => (
  <ContextContent>
    <ContextContentHeader />
    <ContextContentBody>
      <ContextInputUsage />
      <ContextOutputUsage />
      <ContextReasoningUsage />
      <ContextCacheUsage />
    </ContextContentBody>
    <ContextContentFooter />
  </ContextContent>
)

/** The four rows with test ids, so an omitted row can be asserted absent. */
const Rows = () => (
  <ContextContent>
    <ContextContentHeader />
    <ContextContentBody>
      <ContextInputUsage data-testid="input" />
      <ContextOutputUsage data-testid="output" />
      <ContextReasoningUsage data-testid="reasoning" />
      <ContextCacheUsage data-testid="cache" />
    </ContextContentBody>
    <ContextContentFooter />
  </ContextContent>
)

function Demo({
  usedTokens,
  modelId = MODEL_ID,
  ...props
}: {
  usedTokens: number
  modelId?: string | undefined
  defaultOpen?: boolean
}) {
  return (
    <Context
      maxTokens={200_000}
      modelId={modelId}
      usage={usage}
      usedTokens={usedTokens}
      {...props}
    >
      <ContextTrigger />
      <Body />
    </Context>
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

const popup = () =>
  document.querySelector<HTMLElement>('[data-slot="hover-card-content"]')

// A card from the previous test can still be animating out in <body>.
const noPopups = () => vi.waitFor(() => expect(popup()).toBeNull())

const rowText = (label: string) =>
  page.getByText(label).element().parentElement?.textContent ?? ""

const dollars = (text: string) => {
  const match = /\$(\d+\.\d\d)/.exec(text)
  if (!match?.[1]) throw new Error(`no dollar amount in "${text}"`)
  return Number(match[1])
}

const money = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
})
const cents = (usd: number) => Math.round(usd * 100) / 100
const priced = (breakdown: {
  input: number
  output: number
  cacheReads?: number
}) =>
  cents(
    getUsage({ modelId: MODEL_ID, usage: breakdown }).costUSD?.totalUSD ?? 0
  )

const dashOffset = () =>
  Number(
    document
      .querySelector('svg[role="img"] circle:last-of-type')
      ?.getAttribute("stroke-dashoffset")
  )
const CIRCUMFERENCE = 2 * Math.PI * 10

beforeEach(noPopups)

describe("context", () => {
  it("renders children", async () => {
    await render(
      <main>
        <Context defaultOpen maxTokens={100} usedTokens={50}>
          <ContextTrigger />
          <ContextContent>Content</ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Content")).toBeInTheDocument()
  })

  it("displays percentage", async () => {
    const screen = await render(
      <main>
        <Context maxTokens={100} usedTokens={50}>
          <ContextTrigger />
        </Context>
      </main>
    )
    await expect.element(screen.getByText("50%")).toBeInTheDocument()
  })

  it("throws error when components used outside Context provider", async () => {
    // React reports the boundary-caught error through console.error.
    allowConsole("error")
    const spy = vi.spyOn(console, "error")
    const onError = vi.fn()
    await render(
      <Boundary onError={onError}>
        <ContextTrigger />
      </Boundary>
    )
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onError.mock.calls[0]?.[0]?.message).toBe(
      "Context components must be used within Context"
    )
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("shows usage details on hover and passes axe closed, open and in dark mode", async () => {
    const screen = await render(
      <main>
        <Demo usedTokens={80_000} />
      </main>
    )

    const trigger = screen.getByRole("button", { name: /40%/ })
    await expect.element(trigger).toBeVisible()
    await expect.element(page.getByText("Total cost")).not.toBeInTheDocument()
    await expectNoViolations()

    await userEvent.hover(trigger)

    await expect.element(page.getByText("80K / 200K")).toBeVisible()
    await expect.element(page.getByRole("progressbar")).toBeVisible()
    await expect.element(page.getByText("Input")).toBeVisible()
    await expect.element(page.getByText("Output")).toBeVisible()
    await expect.element(page.getByText("Reasoning")).toBeVisible()
    await expect.element(page.getByText("Cache")).toBeVisible()
    await expect.element(page.getByText("Total cost")).toBeVisible()

    // The popup is portaled outside every landmark, so the open-state check
    // is scoped to it; axe's page-level `region` rule does not apply to a
    // subtree and every WCAG rule still runs.
    const open = popup()
    expect(open).not.toBeNull()
    await expectNoViolations(open as HTMLElement)
    await withDark(() => expectNoViolations(open as HTMLElement))
  })

  it("supports controlled open state with (open, eventDetails)", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <main>
        <Context
          maxTokens={100}
          onOpenChange={onOpenChange}
          open={false}
          usedTokens={50}
        >
          <ContextTrigger />
          <ContextContent>Controlled</ContextContent>
        </Context>
      </main>
    )
    await userEvent.hover(screen.getByRole("button"))
    await vi.waitFor(() =>
      expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything())
    )
    expect(document.body.textContent).not.toContain("Controlled")

    await screen.rerender(
      <main>
        <Context
          maxTokens={100}
          onOpenChange={onOpenChange}
          open
          usedTokens={50}
        >
          <ContextTrigger />
          <ContextContent>Controlled</ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Controlled")).toBeVisible()
  })

  it("renders 0% instead of NaN% or ∞% when the window size is unknown", async () => {
    const screen = await render(
      <main>
        <Context defaultOpen maxTokens={0} usedTokens={0}>
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
          </ContextContent>
        </Context>
      </main>
    )
    const trigger = screen.getByRole("button")
    await expect.element(trigger).toBeVisible()
    expect(trigger.element().textContent).toBe("0%")
    await expect.element(page.getByText("0 / 0")).toBeVisible()
    await expect
      .element(page.getByRole("progressbar"))
      .toHaveAttribute("aria-valuenow", "0")
    expect(dashOffset()).toBeCloseTo(CIRCUMFERENCE)
    expect(document.body.textContent).not.toMatch(/NaN|∞/)

    const windows: [number, number, string][] = [
      [80_000, 0, "80K / 0"],
      [80_000, Number.POSITIVE_INFINITY, "80K / 0"],
      [Number.NaN, 200_000, "0 / 200K"],
      [-5, 200_000, "0 / 200K"],
    ]
    for (const [usedTokens, maxTokens, header] of windows) {
      await screen.rerender(
        <main>
          <Context defaultOpen maxTokens={maxTokens} usedTokens={usedTokens}>
            <ContextTrigger />
            <ContextContent>
              <ContextContentHeader />
            </ContextContent>
          </Context>
        </main>
      )
      expect(screen.getByRole("button").element().textContent).toBe("0%")
      await expect.element(page.getByText(header)).toBeVisible()
      expect(popup()?.textContent).not.toMatch(/NaN|∞|-/)
    }
  })

  it("draws an empty ring for NaN, infinite and negative counts on either side", async () => {
    const ui = (usedTokens: number, maxTokens: number) => (
      <main>
        <Context maxTokens={maxTokens} usedTokens={usedTokens}>
          <ContextTrigger />
        </Context>
      </main>
    )
    const screen = await render(ui(Number.NaN, 200_000))
    const cases: [number, number][] = [
      [Number.NaN, 200_000],
      [Number.POSITIVE_INFINITY, 200_000],
      [-1, 200_000],
      [80_000, Number.POSITIVE_INFINITY],
      [80_000, -1],
      [80_000, Number.NaN],
    ]
    for (const [usedTokens, maxTokens] of cases) {
      await screen.rerender(ui(usedTokens, maxTokens))
      expect(screen.getByRole("button").element().textContent).toBe("0%")
      expect(dashOffset()).toBeCloseTo(CIRCUMFERENCE)
    }
  })

  it("renders 0 in the header when the window size or the used count is undefined", async () => {
    // The prop type is `number`; a JS consumer, or metadata that has not
    // loaded, still reaches the formatter with undefined.
    const ui = (usedTokens: number, maxTokens: number) => (
      <main>
        <Context defaultOpen maxTokens={maxTokens} usedTokens={usedTokens}>
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
          </ContextContent>
        </Context>
      </main>
    )
    const missing = undefined as unknown as number
    const screen = await render(ui(80_000, missing))
    await expect.element(screen.getByRole("button")).toHaveTextContent("0%")
    await expect.element(page.getByText("80K / 0")).toBeVisible()
    expect(popup()?.textContent).not.toMatch(/NaN|∞/)

    await screen.rerender(ui(missing, 200_000))
    expect(screen.getByRole("button").element().textContent).toBe("0%")
    await expect.element(page.getByText("0 / 200K")).toBeVisible()
    expect(popup()?.textContent).not.toMatch(/NaN|∞/)
  })

  it("shows usage above the window as >100% and clamps the bar and the ring", async () => {
    const screen = await render(
      <main>
        <Context defaultOpen maxTokens={100} usedTokens={150}>
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
          </ContextContent>
        </Context>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /150%/ }))
      .toBeVisible()
    await expect
      .element(page.getByRole("progressbar"))
      .toHaveAttribute("aria-valuenow", "100")
    expect(dashOffset()).toBe(0)
  })

  it("formats very large windows compactly", async () => {
    const screen = await render(
      <main>
        <Context
          defaultOpen
          maxTokens={2_000_000_000}
          usedTokens={1_500_000_000}
        >
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
          </ContextContent>
        </Context>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /75%/ }))
      .toBeVisible()
    await expect.element(page.getByText("1.5B / 2B")).toBeVisible()
  })

  it("omits a row whose partition would be negative instead of showing a minus", async () => {
    // Cached reads above the input total and reasoning above the output
    // total cannot happen in a consistent usage, but a consumer that builds
    // the details by hand can produce them.
    await render(
      <main>
        <Context
          defaultOpen
          maxTokens={100}
          modelId={MODEL_ID}
          usage={usageOf({
            cacheRead: 30,
            input: 20,
            output: 5,
            reasoning: 10,
          })}
          usedTokens={50}
        >
          <ContextTrigger />
          <Rows />
        </Context>
      </main>
    )
    await expect.element(page.getByTestId("cache")).toBeVisible()
    await expect.element(page.getByTestId("reasoning")).toBeVisible()
    expect(document.querySelector('[data-testid="input"]')).toBeNull()
    expect(document.querySelector('[data-testid="output"]')).toBeNull()
    expect(popup()?.textContent).not.toContain("-")
    expect(page.getByTestId("cache").element().textContent).toContain("30")
    expect(page.getByTestId("reasoning").element().textContent).toContain("10")
  })

  it("omits a row whose own count is negative or NaN", async () => {
    const broken: LanguageModelUsage = {
      ...usageOf({ input: 20, output: 5 }),
      inputTokenDetails: {
        noCacheTokens: 25,
        cacheReadTokens: -5,
        cacheWriteTokens: 0,
      },
      outputTokenDetails: { textTokens: 5, reasoningTokens: Number.NaN },
    }
    await render(
      <main>
        <Context
          defaultOpen
          maxTokens={100}
          modelId={MODEL_ID}
          usage={broken}
          usedTokens={25}
        >
          <ContextTrigger />
          <Rows />
        </Context>
      </main>
    )
    await expect.element(page.getByTestId("input")).toBeVisible()
    await expect.element(page.getByTestId("output")).toBeVisible()
    expect(document.querySelector('[data-testid="cache"]')).toBeNull()
    expect(document.querySelector('[data-testid="reasoning"]')).toBeNull()
    expect(popup()?.textContent).not.toMatch(/-|NaN/)
    expect(page.getByTestId("input").element().textContent).toContain("20")
    expect(page.getByTestId("output").element().textContent).toContain("5")
  })

  it("drops a NaN usage field instead of rendering NaN", async () => {
    await render(
      <main>
        <Context
          defaultOpen
          maxTokens={100}
          modelId={MODEL_ID}
          usage={{ ...usageOf({ output: 10 }), inputTokens: Number.NaN }}
          usedTokens={10}
        >
          <ContextTrigger />
          <Rows />
        </Context>
      </main>
    )
    await expect.element(page.getByTestId("output")).toBeVisible()
    expect(document.querySelector('[data-testid="input"]')).toBeNull()
    expect(popup()?.textContent).not.toMatch(/NaN/)
  })

  it("prices nothing for an empty modelId", async () => {
    await render(
      <main>
        <Context
          defaultOpen
          maxTokens={100}
          modelId=""
          usage={usageOf({ input: 50, output: 20 })}
          usedTokens={70}
        >
          <ContextTrigger />
          <Rows />
        </Context>
      </main>
    )
    await expect.element(page.getByTestId("input")).toBeVisible()
    expect(page.getByTestId("input").element().textContent).toContain("$0.00")
    expect(page.getByTestId("output").element().textContent).toContain("$0.00")
    expect(popup()?.textContent).toContain("Total cost$0.00")
  })
})

describe("contextTrigger", () => {
  it("renders trigger button", async () => {
    const screen = await render(
      <main>
        <Context maxTokens={100} usedTokens={25}>
          <ContextTrigger />
        </Context>
      </main>
    )
    await expect.element(screen.getByRole("button")).toBeInTheDocument()
  })

  it("displays formatted percentage", async () => {
    const screen = await render(
      <main>
        <Context maxTokens={100} usedTokens={33}>
          <ContextTrigger />
        </Context>
      </main>
    )
    await expect.element(screen.getByText("33%")).toBeInTheDocument()
    await screen.rerender(
      <main>
        <Context maxTokens={3} usedTokens={1}>
          <ContextTrigger />
        </Context>
      </main>
    )
    await expect.element(screen.getByText("33.3%")).toBeInTheDocument()
  })

  it("opens the card from keyboard focus", async () => {
    const screen = await render(
      <main>
        <button type="button">before</button>
        <Context maxTokens={100} usedTokens={25}>
          <ContextTrigger />
          <ContextContent>Focus-opened</ContextContent>
        </Context>
      </main>
    )
    await userEvent.click(screen.getByRole("button", { name: "before" }))
    await userEvent.tab()
    expect(document.activeElement?.textContent).toContain("25%")
    await expect.element(page.getByText("Focus-opened")).toBeVisible()
  })

  it("forwards delay and closeDelay to the hover trigger", async () => {
    const screen = await render(
      <main>
        <Context maxTokens={100} usedTokens={25}>
          <ContextTrigger closeDelay={600} delay={600} />
          <ContextContent>Delayed</ContextContent>
        </Context>
      </main>
    )
    const trigger = screen.getByRole("button")
    await userEvent.hover(trigger)
    expect(document.body.textContent).not.toContain("Delayed")
    await expect
      .element(page.getByText("Delayed"), { timeout: 3000 })
      .toBeVisible()

    await userEvent.unhover(trigger)
    expect(document.body.textContent).toContain("Delayed")
    await expect
      .element(page.getByText("Delayed"), { timeout: 3000 })
      .not.toBeInTheDocument()
  })

  it("passes Button props to the default button", async () => {
    const screen = await render(
      <main>
        <Context maxTokens={100} usedTokens={25}>
          <ContextTrigger className="custom-trigger" disabled />
        </Context>
      </main>
    )
    const button = screen.getByRole("button")
    await expect.element(button).toHaveClass("custom-trigger")
    await expect.element(button).toBeDisabled()
  })

  it("lets a custom element child replace the default button", async () => {
    const screen = await render(
      <main>
        <Context maxTokens={100} usedTokens={25}>
          <ContextTrigger>
            <a href="#usage">Usage link</a>
          </ContextTrigger>
        </Context>
      </main>
    )
    await expect
      .element(screen.getByRole("link", { name: "Usage link" }))
      .toBeVisible()
    expect(screen.container.querySelector("button")).toBeNull()
  })

  it("renders text children inside the default button", async () => {
    const screen = await render(
      <main>
        <Context maxTokens={100} usedTokens={25}>
          <ContextTrigger>Usage</ContextTrigger>
        </Context>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Usage" }))
      .toBeVisible()
  })
})

describe("contextContent", () => {
  it("renders content", async () => {
    await render(
      <main>
        <Context defaultOpen maxTokens={100} usedTokens={50}>
          <ContextTrigger />
          <ContextContent>Details</ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Details")).toBeInTheDocument()
  })

  it("forwards side and align to the positioner", async () => {
    // Headroom above the trigger, or Base UI flips `top` to `bottom`.
    await render(
      <main style={{ paddingTop: 300 }}>
        <Context defaultOpen maxTokens={100} usedTokens={50}>
          <ContextTrigger />
          <ContextContent align="start" side="top">
            Placed
          </ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Placed")).toBeVisible()
    const content = popup()
    expect(content?.dataset.side).toBe("top")
    expect(content?.dataset.align).toBe("start")
  })
})

describe("contextContentHeader", () => {
  it("renders default header with stats", async () => {
    await render(
      <main>
        <Context defaultOpen maxTokens={1000} usedTokens={500}>
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
          </ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("500 / 1K")).toBeVisible()
    expect(popup()?.textContent).toContain("50%")
    await expect
      .element(page.getByRole("progressbar", { name: "Context window usage" }))
      .toHaveAttribute("aria-valuenow", "50")
  })

  it("sets the progress bar to the percentage, not the fraction", async () => {
    await render(
      <main>
        <Demo defaultOpen usedTokens={80_000} />
      </main>
    )
    await expect
      .element(page.getByRole("progressbar"))
      .toHaveAttribute("aria-valuenow", "40")
  })

  it("renders custom children", async () => {
    await render(
      <main>
        <Context defaultOpen maxTokens={100} usedTokens={50}>
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader>Custom Header</ContextContentHeader>
          </ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Custom Header")).toBeInTheDocument()
    expect(document.querySelector('[role="progressbar"]')).toBeNull()
  })
})

describe("contextContentBody", () => {
  it("renders body content", async () => {
    await render(
      <main>
        <Context defaultOpen maxTokens={100} usedTokens={50}>
          <ContextContent>
            <ContextContentBody>Body content</ContextContentBody>
          </ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Body content")).toBeInTheDocument()
  })
})

describe("contextContentFooter", () => {
  it("renders default footer with cost", async () => {
    await render(
      <main>
        <Context defaultOpen maxTokens={100} modelId="gpt-4" usedTokens={50}>
          <ContextContent>
            <ContextContentFooter />
          </ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Total cost")).toBeInTheDocument()
    await expect.element(page.getByText("$0.00")).toBeInTheDocument()
  })

  it("renders custom children", async () => {
    await render(
      <main>
        <Context defaultOpen maxTokens={100} usedTokens={50}>
          <ContextContent>
            <ContextContentFooter>Custom Footer</ContextContentFooter>
          </ContextContent>
        </Context>
      </main>
    )
    await expect.element(page.getByText("Custom Footer")).toBeInTheDocument()
  })

  it("totals the four rows without double counting cached input or reasoning", async () => {
    await render(
      <main>
        <Demo defaultOpen usedTokens={80_000} />
      </main>
    )
    await expect.element(page.getByText("Total cost")).toBeVisible()

    // Rows partition the usage: uncached input, cached reads, text output and
    // reasoning, each at its own rate, so the counts add up to the 80K used.
    expect(rowText("Input")).toMatch(/^Input42K• \$/)
    expect(rowText("Output")).toMatch(/^Output12K• \$/)
    expect(rowText("Reasoning")).toMatch(/^Reasoning6K• \$/)
    expect(rowText("Cache")).toMatch(/^Cache20K• \$/)

    const expected = {
      cache: priced({ cacheReads: 20_000, input: 0, output: 0 }),
      input: priced({ input: 42_000, output: 0 }),
      output: priced({ input: 0, output: 12_000 }),
      reasoning: priced({ input: 0, output: 6_000 }),
    }
    for (const value of Object.values(expected)) {
      expect(value).toBeGreaterThan(0)
    }
    expect(rowText("Input")).toContain(money.format(expected.input))
    expect(rowText("Output")).toContain(money.format(expected.output))
    expect(rowText("Reasoning")).toContain(money.format(expected.reasoning))
    expect(rowText("Cache")).toContain(money.format(expected.cache))

    const footer = rowText("Total cost")
    const rowsTotal = cents(
      dollars(rowText("Input")) +
        dollars(rowText("Output")) +
        dollars(rowText("Reasoning")) +
        dollars(rowText("Cache"))
    )
    expect(dollars(footer)).toBe(rowsTotal)
    expect(footer).toContain(
      money.format(
        expected.input + expected.cache + expected.output + expected.reasoning
      )
    )
  })

  it("shows $0.00 everywhere for a model tokenlens cannot price", async () => {
    await render(
      <main>
        <Demo defaultOpen modelId="not-a-real-model" usedTokens={80_000} />
      </main>
    )
    await expect.element(page.getByText("Total cost")).toBeVisible()
    for (const label of [
      "Input",
      "Output",
      "Reasoning",
      "Cache",
      "Total cost",
    ]) {
      expect(rowText(label)).toContain("$0.00")
    }
    expect(rowText("Input")).toMatch(/^Input42K/)
  })
})

describe("usage rows", () => {
  const rows = [
    { Component: ContextInputUsage, label: "Input", usage: { input: 50 } },
    { Component: ContextOutputUsage, label: "Output", usage: { output: 25 } },
    {
      Component: ContextReasoningUsage,
      label: "Reasoning",
      usage: { output: 10, reasoning: 10 },
    },
    {
      Component: ContextCacheUsage,
      label: "Cache",
      usage: { cacheRead: 20, input: 20 },
    },
  ] as const

  for (const { Component: Row, label, usage: partial } of rows) {
    describe(`context${label}Usage`, () => {
      it(`renders ${label.toLowerCase()} usage`, async () => {
        await render(
          <main>
            <Context
              defaultOpen
              maxTokens={100}
              modelId={MODEL_ID}
              usage={usageOf(partial)}
              usedTokens={75}
            >
              <ContextTrigger />
              <ContextContent>
                <Row />
              </ContextContent>
            </Context>
          </main>
        )
        await expect.element(page.getByText(label)).toBeInTheDocument()
        expect(rowText(label)).toMatch(/• \$\d+\.\d\d$/)
      })

      it(`renders ${label.toLowerCase()} usage without modelId`, async () => {
        await render(
          <main>
            <Context
              defaultOpen
              maxTokens={100}
              usage={usageOf(partial)}
              usedTokens={50}
            >
              <ContextContent>
                <Row />
              </ContextContent>
            </Context>
          </main>
        )
        await expect.element(page.getByText(label)).toBeInTheDocument()
        expect(rowText(label)).toContain("$0.00")
      })

      it(`renders nothing when no ${label.toLowerCase()} tokens`, async () => {
        const screen = await render(
          <main>
            <Context defaultOpen maxTokens={100} usedTokens={0}>
              <ContextTrigger />
              <ContextContent>
                <Row className="usage-row" />
              </ContextContent>
            </Context>
          </main>
        )
        await expect.element(page.getByText("0%")).toBeVisible()
        await vi.waitFor(() => expect(popup()).not.toBeNull())
        expect(document.querySelector(".usage-row")).toBeNull()
        expect(document.body.textContent).not.toContain(label)

        for (const empty of [
          undefined,
          {} as LanguageModelUsage,
          usageOf(),
          {
            ...usageOf(),
            inputTokens: undefined,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokens: undefined,
            outputTokenDetails: {
              textTokens: undefined,
              reasoningTokens: undefined,
            },
          },
        ]) {
          await screen.rerender(
            <main>
              <Context
                defaultOpen
                maxTokens={100}
                modelId={MODEL_ID}
                usage={empty}
                usedTokens={0}
              >
                <ContextTrigger />
                <ContextContent>
                  <Row className="usage-row" />
                </ContextContent>
              </Context>
            </main>
          )
          expect(document.querySelector(".usage-row")).toBeNull()
          expect(document.body.textContent).not.toMatch(/NaN|∞/)
        }
      })

      it("renders custom children", async () => {
        await render(
          <main>
            <Context defaultOpen maxTokens={100} usedTokens={50}>
              <ContextContent>
                <Row>Custom {label}</Row>
              </ContextContent>
            </Context>
          </main>
        )
        await expect
          .element(page.getByText(`Custom ${label}`))
          .toBeInTheDocument()
      })

      it("forwards className and other div props", async () => {
        await render(
          <main>
            <Context
              defaultOpen
              maxTokens={100}
              usage={usageOf(partial)}
              usedTokens={50}
            >
              <ContextContent>
                <Row className="custom-row" data-testid="row" />
              </ContextContent>
            </Context>
          </main>
        )
        const row = page.getByTestId("row")
        await expect.element(row).toBeVisible()
        await expect.element(row).toHaveClass("custom-row")
      })
    })
  }
})
