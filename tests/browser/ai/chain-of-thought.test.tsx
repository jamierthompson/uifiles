import { SearchIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Component, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  type ChainOfThoughtHeaderProps,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/registry/ai/chain-of-thought"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

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
    return this.state.failed ? <p>render crashed</p> : this.props.children
  }
}

/** Tab through the page until `target` owns focus (keyboard-only reach). */
async function tabTo(target: Element, max = 8) {
  for (let i = 0; i < max; i += 1) {
    await userEvent.tab()
    if (document.activeElement === target) return
  }
  throw new Error("could not reach the target with Tab")
}

const rotateOf = (el: Element) => getComputedStyle(el).rotate
const UNROTATED = /^(none|0deg)$/

function Demo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <main>
      <ChainOfThought defaultOpen={defaultOpen}>
        <ChainOfThoughtHeader>Investigating slow checkout</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep
            description="Looking for recent reports."
            icon={SearchIcon}
            label="Searching incident history"
            status="complete"
          >
            <ChainOfThoughtSearchResults>
              <ChainOfThoughtSearchResult>INC-2291</ChainOfThoughtSearchResult>
              <ChainOfThoughtSearchResult>PR #4410</ChainOfThoughtSearchResult>
            </ChainOfThoughtSearchResults>
          </ChainOfThoughtStep>
          <ChainOfThoughtStep label="Comparing regions" status="active">
            <ChainOfThoughtImage caption="p95 latency by region">
              <svg aria-label="latency chart" role="img" viewBox="0 0 10 10">
                <title>latency chart</title>
                <rect height="10" width="10" />
              </svg>
            </ChainOfThoughtImage>
          </ChainOfThoughtStep>
          <ChainOfThoughtStep label="Proposing a fix" status="pending" />
        </ChainOfThoughtContent>
      </ChainOfThought>
    </main>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ChainOfThought", () => {
  it("renders children", async () => {
    const screen = await render(<ChainOfThought>Content</ChainOfThought>)
    await expect.element(screen.getByText("Content")).toBeInTheDocument()
  })

  it("throws when a part is used outside ChainOfThought", async () => {
    allowConsole("error")
    const onError = vi.fn()
    const screen = await render(
      <Boundary onError={onError}>
        <ChainOfThoughtHeader>Test</ChainOfThoughtHeader>
      </Boundary>
    )
    await expect.element(screen.getByText("render crashed")).toBeVisible()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]?.message).toBe(
      "ChainOfThought components must be used within ChainOfThought"
    )
  })

  it("starts closed by default", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent>Hidden content</ChainOfThoughtContent>
      </ChainOfThought>
    )
    expect(screen.getByText("Hidden content").query()).toBeNull()
    const header = screen.getByRole("button", { name: "Chain of Thought" })
    await expect.element(header).toHaveAttribute("aria-expanded", "false")
    expect(header.element().hasAttribute("aria-controls")).toBe(false)
  })

  it("can start open", async () => {
    const screen = await render(
      <ChainOfThought defaultOpen>
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent>Visible content</ChainOfThoughtContent>
      </ChainOfThought>
    )
    await expect.element(screen.getByText("Visible content")).toBeVisible()
    const header = screen.getByRole("button", { name: "Chain of Thought" })
    await expect.element(header).toHaveAttribute("aria-expanded", "true")
    const panel = document.querySelector("[data-slot='collapsible-content']")
    expect(header.element().getAttribute("aria-controls")).toBe(panel?.id)
  })

  it("calls onOpenChange with the next open state and nothing else", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <ChainOfThought onOpenChange={onOpenChange}>
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent>Content</ChainOfThoughtContent>
      </ChainOfThought>
    )
    const trigger = screen.getByRole("button")
    await userEvent.click(trigger)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]).toEqual([true])
    await userEvent.click(trigger)
    expect(onOpenChange.mock.calls[1]).toEqual([false])
  })

  it("is read-only when open is given without onOpenChange", async () => {
    const screen = await render(
      <ChainOfThought open={false}>
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent>Content</ChainOfThoughtContent>
      </ChainOfThought>
    )
    const trigger = screen.getByRole("button")
    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("Content").query()).toBeNull()
  })

  it("follows a controlled open prop and reports toggles to the parent", async () => {
    function Controlled() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <output>{open ? "open" : "closed"}</output>
          <ChainOfThought onOpenChange={setOpen} open={open}>
            <ChainOfThoughtHeader />
            <ChainOfThoughtContent>Content</ChainOfThoughtContent>
          </ChainOfThought>
        </>
      )
    }
    const screen = await render(<Controlled />)
    const trigger = screen.getByRole("button", { name: "Chain of Thought" })
    await expect.element(screen.getByText("Content")).toBeVisible()
    await userEvent.click(trigger)
    await expect.element(screen.getByText("closed")).toBeVisible()
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    await expect.element(screen.getByText("open")).toBeVisible()
    await expect.element(screen.getByText("Content")).toBeVisible()
  })

  it("keeps the header from re-rendering when the parent re-renders with an inline onOpenChange", async () => {
    let headerRenders = 0
    const countingTrigger: NonNullable<ChainOfThoughtHeaderProps["render"]> = (
      props
    ) => {
      headerRenders += 1
      return <button {...props} />
    }
    function ChattyParent() {
      const [ticks, tick] = useState(0)
      return (
        <main>
          <button onClick={() => tick((t) => t + 1)} type="button">
            tick {ticks}
          </button>
          <ChainOfThought onOpenChange={() => {}}>
            <ChainOfThoughtHeader render={countingTrigger} />
            <ChainOfThoughtContent>Content</ChainOfThoughtContent>
          </ChainOfThought>
        </main>
      )
    }
    const screen = await render(<ChattyParent />)
    const rendersAfterMount = headerRenders
    expect(rendersAfterMount).toBeGreaterThan(0)
    for (let i = 1; i <= 3; i += 1) {
      await userEvent.click(screen.getByRole("button", { name: /tick/ }))
      await expect.element(screen.getByText(`tick ${i}`)).toBeVisible()
    }
    expect(headerRenders).toBe(rendersAfterMount)
    // The counter is live: a real state change still re-renders the header.
    await userEvent.click(
      screen.getByRole("button", { name: "Chain of Thought" })
    )
    await expect.element(screen.getByText("Content")).toBeVisible()
    expect(headerRenders).toBeGreaterThan(rendersAfterMount)
  })

  it("calls the latest onOpenChange after the parent swaps the handler", async () => {
    const first = vi.fn()
    const second = vi.fn()
    const ui = (onOpenChange: (open: boolean) => void) => (
      <ChainOfThought onOpenChange={onOpenChange}>
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent>Content</ChainOfThoughtContent>
      </ChainOfThought>
    )
    const screen = await render(ui(first))
    await screen.rerender(ui(second))
    await userEvent.click(screen.getByRole("button"))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(true)
  })

  it("renders one collapsible root with the trigger and panel as direct children", async () => {
    const screen = await render(
      <ChainOfThought className="cot">
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent>Content</ChainOfThoughtContent>
      </ChainOfThought>
    )
    const roots = document.querySelectorAll("[data-slot='collapsible']")
    expect(roots).toHaveLength(1)
    const root = roots[0] as HTMLElement
    expect(root.tagName).toBe("DIV")
    expect(root.classList.contains("cot")).toBe(true)
    expect(root.classList.contains("space-y-4")).toBe(true)
    const trigger = screen.getByRole("button", { name: "Chain of Thought" })
    expect(trigger.element().parentElement).toBe(root)
    await userEvent.click(trigger)
    const panel = document.querySelector("[data-slot='collapsible-content']")
    expect(panel?.parentElement).toBe(root)
  })
})

describe("ChainOfThoughtHeader", () => {
  it("renders the default label", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtHeader />
      </ChainOfThought>
    )
    await expect.element(screen.getByText("Chain of Thought")).toBeVisible()
  })

  it("renders custom children", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtHeader className="custom-header">
          Custom Header
        </ChainOfThoughtHeader>
      </ChainOfThought>
    )
    const header = screen.getByRole("button", { name: "Custom Header" })
    await expect.element(header).toBeVisible()
    await expect.element(header).toHaveClass("custom-header")
    await expect.element(header).toHaveClass("text-muted-foreground")
  })

  it("meets the 24 px target size while keeping its text-sm weight", async () => {
    const screen = await render(<Demo />)
    const trigger = screen.getByRole("button", {
      name: "Investigating slow checkout",
    })
    const { height } = trigger.element().getBoundingClientRect()
    expect(height).toBeGreaterThanOrEqual(24)
    await expect.element(trigger).toHaveClass("text-sm")
    await expect.element(trigger).not.toHaveClass("font-medium")
    await expectNoViolations()
  })

  it("toggles from the keyboard, names the panel, and rotates the chevron", async () => {
    const screen = await render(<Demo />)
    const trigger = screen
      .getByRole("button", { name: "Investigating slow checkout" })
      .element() as HTMLElement
    const chevron = trigger.querySelector("svg:last-of-type") as SVGElement
    expect(rotateOf(chevron)).toMatch(UNROTATED)

    await tabTo(trigger)
    await userEvent.keyboard("{Enter}")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    const panelId = trigger.getAttribute("aria-controls")
    expect(panelId).toBeTruthy()
    const panel = document.getElementById(panelId ?? "")
    expect(panel?.getAttribute("data-slot")).toBe("collapsible-content")
    await expect.poll(() => rotateOf(chevron)).toBe("180deg")

    await userEvent.keyboard(" ")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger.hasAttribute("aria-controls")).toBe(false)
    await expect.poll(() => rotateOf(chevron)).toMatch(UNROTATED)
  })
})

describe("ChainOfThoughtStep", () => {
  it("renders the label", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtStep label="Step 1" />
      </ChainOfThought>
    )
    await expect.element(screen.getByText("Step 1")).toBeVisible()
  })

  it("renders the description only when given", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtStep description="Details" label="Step" />
        <ChainOfThoughtStep data-testid="bare" label="Bare" />
      </ChainOfThought>
    )
    await expect.element(screen.getByText("Details")).toBeVisible()
    const bareColumn = screen
      .getByTestId("bare")
      .element()
      .querySelector(":scope > div:last-child")
    expect(bareColumn?.children).toHaveLength(1)
    expect(bareColumn?.textContent).toBe("Bare")
  })

  it("renders a custom icon and the default dot otherwise", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtStep data-testid="custom" icon={SearchIcon} label="A" />
        <ChainOfThoughtStep data-testid="default" label="B" />
      </ChainOfThought>
    )
    expect(
      screen.getByTestId("custom").element().querySelector("svg.lucide-search")
    ).not.toBeNull()
    expect(
      screen.getByTestId("default").element().querySelector("svg.lucide-dot")
    ).not.toBeNull()
  })

  it("renders children under the label", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtStep className="custom-step" label="Step">
          <span>nested</span>
        </ChainOfThoughtStep>
      </ChainOfThought>
    )
    await expect.element(screen.getByText("nested")).toBeVisible()
    expect(document.querySelector(".custom-step")?.textContent).toBe(
      "Stepnested"
    )
  })

  it("styles every status and falls back to neutral for an unknown one", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtStep data-testid="complete" label="Complete" />
        <ChainOfThoughtStep
          data-testid="active"
          label="Active"
          status="active"
        />
        <ChainOfThoughtStep
          data-testid="pending"
          label="Pending"
          status="pending"
        />
        <ChainOfThoughtStep
          data-testid="unknown"
          label="Unknown"
          status={"from-the-future" as never}
        />
      </ChainOfThought>
    )
    const step = (id: string) => screen.getByTestId(id).element()
    const iconOpacity = (id: string) =>
      getComputedStyle(step(id).querySelector("svg") as SVGElement).opacity

    expect(step("complete").className).toContain("text-muted-foreground")
    expect(step("active").className).toContain("text-foreground")
    expect(step("pending").className).toContain("text-muted-foreground")
    expect(step("pending").className).not.toContain("text-muted-foreground/50")
    expect(step("unknown").className).toContain("text-muted-foreground")

    expect(iconOpacity("pending")).toBe("0.5")
    expect(
      getComputedStyle(screen.getByText("Pending").element()).opacity
    ).toBe("1")
    expect(iconOpacity("complete")).toBe("1")
    expect(iconOpacity("unknown")).toBe("1")
    await expect.element(screen.getByText("Unknown")).toBeVisible()
  })
})

describe("ChainOfThoughtSearchResults", () => {
  it("renders search results", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtSearchResults className="results">
          <span>Result 1</span>
        </ChainOfThoughtSearchResults>
      </ChainOfThought>
    )
    await expect.element(screen.getByText("Result 1")).toBeVisible()
    const container = screen.getByText("Result 1").element().parentElement
    expect(container).toHaveClass("results")
    expect(container).toHaveClass("flex-wrap")
  })

  it("renders nothing without results", async () => {
    const results: string[] = []
    await render(
      <ChainOfThought>
        <ChainOfThoughtSearchResults className="mapped">
          {results.map((r) => (
            <ChainOfThoughtSearchResult key={r}>{r}</ChainOfThoughtSearchResult>
          ))}
        </ChainOfThoughtSearchResults>
        <ChainOfThoughtSearchResults className="conditional">
          {results.length > 0 && <span>never</span>}
        </ChainOfThoughtSearchResults>
        <ChainOfThoughtSearchResults className="empty" />
      </ChainOfThought>
    )
    expect(document.querySelector(".mapped")).toBeNull()
    expect(document.querySelector(".conditional")).toBeNull()
    expect(document.querySelector(".empty")).toBeNull()
  })
})

describe("ChainOfThoughtSearchResult", () => {
  it("renders a secondary badge", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtSearchResult>Source</ChainOfThoughtSearchResult>
      </ChainOfThought>
    )
    const badge = screen.getByText("Source")
    await expect.element(badge).toBeVisible()
    await expect.element(badge).toHaveAttribute("data-slot", "badge")
    await expect.element(badge).toHaveClass("bg-secondary")
    await expect.element(badge).toHaveClass("font-normal")
  })

  it("lets the variant and className be overridden", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtSearchResult className="custom-result" variant="outline">
          Source
        </ChainOfThoughtSearchResult>
      </ChainOfThought>
    )
    const badge = screen.getByText("Source")
    await expect.element(badge).toHaveClass("border-border")
    await expect.element(badge).toHaveClass("custom-result")
    await expect.element(badge).not.toHaveClass("bg-secondary")
  })
})

describe("ChainOfThoughtContent", () => {
  it("renders content when open", async () => {
    const screen = await render(
      <ChainOfThought defaultOpen>
        <ChainOfThoughtHeader />
        <ChainOfThoughtContent className="custom-content">
          Content text
        </ChainOfThoughtContent>
      </ChainOfThought>
    )
    await expect.element(screen.getByText("Content text")).toBeVisible()
    await expect
      .element(screen.getByText("Content text"))
      .toHaveClass("custom-content")
  })

  it("unmounts when closed unless keepMounted", async () => {
    const screen = await render(
      <>
        <ChainOfThought>
          <ChainOfThoughtHeader>Plain</ChainOfThoughtHeader>
          <ChainOfThoughtContent>Unmounted</ChainOfThoughtContent>
        </ChainOfThought>
        <ChainOfThought>
          <ChainOfThoughtHeader>Kept</ChainOfThoughtHeader>
          <ChainOfThoughtContent keepMounted>Persisted</ChainOfThoughtContent>
        </ChainOfThought>
      </>
    )
    expect(screen.getByText("Unmounted").query()).toBeNull()
    const kept = screen.getByText("Persisted").element()
    expect(kept.hasAttribute("hidden")).toBe(true)
  })
})

describe("ChainOfThoughtImage", () => {
  it("renders the image container", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtImage className="custom-image">
          {/* biome-ignore lint/performance/noImgElement: a plain img keeps the fixture framework-agnostic */}
          <img alt="test" height={100} src="test.jpg" width={100} />
        </ChainOfThoughtImage>
      </ChainOfThought>
    )
    await expect.element(screen.getByAltText("test")).toBeInTheDocument()
    expect(document.querySelector(".custom-image")).not.toBeNull()
  })

  it("renders the caption", async () => {
    const screen = await render(
      <ChainOfThought>
        <ChainOfThoughtImage caption="Image caption">
          {/* biome-ignore lint/performance/noImgElement: a plain img keeps the fixture framework-agnostic */}
          <img alt="test" height={100} src="test.jpg" width={100} />
        </ChainOfThoughtImage>
      </ChainOfThought>
    )
    await expect.element(screen.getByText("Image caption")).toBeVisible()
    expect(screen.getByText("Image caption").element().tagName).toBe("P")
  })

  it("renders no caption node without one and keeps the child's own alt", async () => {
    const screen = await render(
      <main>
        <ChainOfThought>
          <ChainOfThoughtImage className="frame">
            {/* biome-ignore lint/performance/noImgElement: a plain img keeps the fixture framework-agnostic */}
            <img
              alt="p95 latency chart"
              height={10}
              src="chart.png"
              width={10}
            />
          </ChainOfThoughtImage>
        </ChainOfThought>
      </main>
    )
    expect(document.querySelectorAll(".frame p")).toHaveLength(0)
    await expect
      .element(screen.getByAltText("p95 latency chart"))
      .toHaveAttribute("alt", "p95 latency chart")
    await expectNoViolations()
  })
})

describe("accessibility", () => {
  it("passes axe closed and open", async () => {
    const screen = await render(<Demo />)
    const header = screen.getByRole("button", {
      name: "Investigating slow checkout",
    })
    await expectNoViolations()

    await userEvent.click(header)
    await expect.element(header).toHaveAttribute("aria-expanded", "true")
    await expect.element(screen.getByText("INC-2291")).toBeVisible()
    await expect
      .element(screen.getByRole("img", { name: "latency chart" }))
      .toBeVisible()
    await expect
      .element(screen.getByText("p95 latency by region"))
      .toBeVisible()
    await expectNoViolations()
  })

  it("passes axe open in dark mode", async () => {
    await withDark(async () => {
      const screen = await render(<Demo defaultOpen />)
      await expect.element(screen.getByText("Proposing a fix")).toBeVisible()
      await expectNoViolations()
    })
  })
})
