import type { ReactNode } from "react"
import { Component } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Button } from "@/components/ui/button"
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/registry/ai/plan"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

// The harness page has no landmark of its own; <main> keeps axe's "region"
// rule about the component rather than the blank test page.
function Fixture({
  isStreaming = false,
  defaultOpen = true,
}: {
  isStreaming?: boolean
  defaultOpen?: boolean
}) {
  return (
    <main>
      <Plan defaultOpen={defaultOpen} isStreaming={isStreaming}>
        <PlanHeader>
          <div>
            <PlanTitle>Add user theme settings</PlanTitle>
            <PlanDescription>Four steps across db, API and UI</PlanDescription>
          </div>
          <PlanAction>
            <PlanTrigger />
          </PlanAction>
        </PlanHeader>
        <PlanContent>
          <ol>
            <li>Add the theme column</li>
            <li>Expose the settings route</li>
          </ol>
        </PlanContent>
        <PlanFooter>
          <Button size="sm">Approve and run</Button>
        </PlanFooter>
      </Plan>
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

const slot = (name: string) => document.querySelector(`[data-slot='${name}']`)

afterEach(() => {
  vi.restoreAllMocks()
})

describe("plan", () => {
  it("renders with children", async () => {
    const screen = await render(
      <Plan>
        <div>Content</div>
      </Plan>
    )
    await expect.element(screen.getByText("Content")).toBeInTheDocument()
  })

  it("renders the collapsible as one Card element carrying data-slot='plan'", async () => {
    await render(
      <Plan className="custom-class">
        <div>Content</div>
      </Plan>
    )
    const root = slot("plan")
    expect(root).not.toBeNull()
    expect(root?.classList.contains("custom-class")).toBe(true)
    expect(root?.classList.contains("shadow-none")).toBe(true)
    expect(root?.classList.contains("bg-card")).toBe(true)
    expect(slot("card")).toBeNull()
    expect(slot("collapsible")).toBeNull()
    expect(root?.querySelector("[data-slot='plan']")).toBeNull()
  })

  it("forwards collapsible props such as defaultOpen", async () => {
    const screen = await render(
      <Plan defaultOpen={false}>
        <PlanContent>Hidden content</PlanContent>
      </Plan>
    )
    expect(screen.getByText("Hidden content").query()).toBeNull()
    expect(slot("plan")?.hasAttribute("data-closed")).toBe(true)
  })

  it("passes (open, eventDetails) to onOpenChange and honors a read-only open", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <Plan onOpenChange={onOpenChange} open>
        <PlanHeader>
          <PlanTrigger />
        </PlanHeader>
        <PlanContent>Controlled content</PlanContent>
      </Plan>
    )
    const trigger = screen.getByRole("button", { name: "Toggle plan" })
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(trigger)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(onOpenChange.mock.calls[0]?.[1]).toMatchObject({
      reason: "trigger-press",
    })
    await expect
      .poll(() => trigger.element().getAttribute("aria-expanded"))
      .toBe("true")
    await expect.element(screen.getByText("Controlled content")).toBeVisible()
  })

  it("can be controlled", async () => {
    const onOpenChange = vi.fn()
    const ui = (open: boolean) => (
      <Plan onOpenChange={onOpenChange} open={open}>
        <PlanHeader>
          <PlanTrigger />
        </PlanHeader>
        <PlanContent>Controlled content</PlanContent>
      </Plan>
    )
    const screen = await render(ui(false))
    expect(screen.getByText("Controlled content").query()).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Toggle plan" }))
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true)

    await screen.rerender(ui(true))
    await expect.element(screen.getByText("Controlled content")).toBeVisible()
  })
})

describe("planHeader", () => {
  it("renders with children, the flex layout, data-slot and custom className", async () => {
    const screen = await render(
      <Plan>
        <PlanHeader className="custom-header">
          <div>Header content</div>
        </PlanHeader>
      </Plan>
    )
    await expect.element(screen.getByText("Header content")).toBeVisible()
    const header = slot("plan-header")
    expect(header).not.toBeNull()
    expect(header?.classList.contains("custom-header")).toBe(true)
    for (const cls of ["flex", "items-start", "justify-between"]) {
      expect(header?.classList.contains(cls)).toBe(true)
    }
    expect(slot("card-header")).toBeNull()
  })
})

describe("planTitle", () => {
  it("renders text content without a shimmer when not streaming", async () => {
    const screen = await render(
      <Plan isStreaming={false}>
        <PlanHeader>
          <PlanTitle>Static Title</PlanTitle>
        </PlanHeader>
      </Plan>
    )
    await expect.element(screen.getByText("Static Title")).toBeVisible()
    const title = slot("plan-title")
    expect(title?.textContent).toBe("Static Title")
    expect(title?.querySelector(".shimmer")).toBeNull()
  })

  it("renders with a shimmer when streaming", async () => {
    const screen = await render(
      <Plan isStreaming>
        <PlanHeader>
          <PlanTitle>Streaming Title</PlanTitle>
        </PlanHeader>
      </Plan>
    )
    const text = screen.getByText("Streaming Title")
    await expect.element(text).toBeVisible()
    await expect.element(text).toHaveClass("shimmer")
    expect(text.element().closest("[data-slot='plan-title']")).not.toBeNull()
  })

  it("is not a heading element, so it never breaks the page's heading order", async () => {
    await render(
      <Plan>
        <PlanHeader>
          <PlanTitle>Title</PlanTitle>
        </PlanHeader>
      </Plan>
    )
    expect(slot("plan-title")?.tagName).toBe("DIV")
    expect(document.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull()
  })

  it("throws when used outside Plan", async () => {
    allowConsole("error")
    const onError = vi.fn()
    await render(
      <Boundary onError={onError}>
        <PlanTitle>Title</PlanTitle>
      </Boundary>
    )
    expect(onError.mock.calls[0]?.[0].message).toBe(
      "Plan components must be used within Plan"
    )
  })
})

describe("planDescription", () => {
  it("renders text with text-balance, data-slot and custom className", async () => {
    const screen = await render(
      <Plan>
        <PlanHeader>
          <PlanDescription className="custom-desc">
            Plan description text
          </PlanDescription>
        </PlanHeader>
      </Plan>
    )
    await expect
      .element(screen.getByText("Plan description text"))
      .toBeVisible()
    const description = slot("plan-description")
    expect(description?.classList.contains("text-balance")).toBe(true)
    expect(description?.classList.contains("custom-desc")).toBe(true)
    expect(description?.querySelector(".shimmer")).toBeNull()
  })

  it("renders with a shimmer when streaming", async () => {
    const screen = await render(
      <Plan isStreaming>
        <PlanHeader>
          <PlanDescription>Streaming description</PlanDescription>
        </PlanHeader>
      </Plan>
    )
    await expect
      .element(screen.getByText("Streaming description"))
      .toHaveClass("shimmer")
  })

  it("throws when used outside Plan", async () => {
    allowConsole("error")
    const onError = vi.fn()
    await render(
      <Boundary onError={onError}>
        <PlanDescription>Description</PlanDescription>
      </Boundary>
    )
    expect(onError.mock.calls[0]?.[0].message).toBe(
      "Plan components must be used within Plan"
    )
  })
})

describe("planAction", () => {
  it("renders children in the card action slot, outside the trigger", async () => {
    const screen = await render(
      <Plan>
        <PlanHeader>
          <PlanAction className="custom-action">
            <button type="button">Action</button>
            <PlanTrigger />
          </PlanAction>
        </PlanHeader>
      </Plan>
    )
    const action = screen.getByRole("button", { name: "Action" })
    await expect.element(action).toBeVisible()
    const slotEl = slot("plan-action")
    expect(slotEl?.classList.contains("custom-action")).toBe(true)
    expect(slotEl?.classList.contains("col-start-2")).toBe(true)
    const trigger = screen
      .getByRole("button", { name: "Toggle plan" })
      .element()
    expect(action.element().closest("button")).toBe(action.element())
    expect(trigger.querySelector("button")).toBeNull()
    expect(trigger.parentElement?.closest("button")).toBeNull()
  })
})

describe("planContent", () => {
  it("renders children as the card content with data-slot and custom className", async () => {
    const screen = await render(
      <Plan defaultOpen>
        <PlanContent className="custom-content">
          <div>Plan content</div>
        </PlanContent>
      </Plan>
    )
    await expect.element(screen.getByText("Plan content")).toBeVisible()
    const content = slot("plan-content")
    expect(content?.classList.contains("custom-content")).toBe(true)
    expect(content?.classList.contains("px-(--card-spacing)")).toBe(true)
    expect(slot("card-content")).toBeNull()
    expect(slot("collapsible-content")).toBeNull()
  })

  it("is collapsible", async () => {
    const screen = await render(
      <Plan defaultOpen={false}>
        <PlanHeader>
          <PlanTrigger />
        </PlanHeader>
        <PlanContent>Collapsible content</PlanContent>
      </Plan>
    )
    expect(screen.getByText("Collapsible content").query()).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Toggle plan" }))
    await expect.element(screen.getByText("Collapsible content")).toBeVisible()
  })
})

describe("planFooter", () => {
  it("renders children with data-slot and custom className", async () => {
    const screen = await render(
      <Plan>
        <PlanFooter className="custom-footer">
          <div>Footer content</div>
        </PlanFooter>
      </Plan>
    )
    await expect.element(screen.getByText("Footer content")).toBeVisible()
    const footer = slot("plan-footer")
    expect(footer?.classList.contains("custom-footer")).toBe(true)
    expect(slot("card-footer")).toBeNull()
  })
})

describe("planTrigger", () => {
  it("renders a ghost icon toggle button with a chevron and a screen-reader label", async () => {
    const screen = await render(
      <Plan>
        <PlanHeader>
          <PlanTrigger />
        </PlanHeader>
      </Plan>
    )
    const trigger = screen.getByRole("button", { name: "Toggle plan" })
    await expect.element(trigger).toBeVisible()
    const element = trigger.element()
    expect(element.getAttribute("data-slot")).toBe("plan-trigger")
    expect(element.classList.contains("size-8")).toBe(true)
    expect(element.querySelector("svg.lucide-chevrons-up-down")).not.toBeNull()
    expect(element.querySelector(".sr-only")?.textContent).toBe("Toggle plan")
    expect(slot("collapsible-trigger")).toBeNull()
  })

  it("lets a className override beat the default size", async () => {
    const screen = await render(
      <Plan>
        <PlanHeader>
          <PlanTrigger className="custom-trigger size-10" />
        </PlanHeader>
      </Plan>
    )
    const element = screen
      .getByRole("button", { name: "Toggle plan" })
      .element()
    expect(element.classList.contains("custom-trigger")).toBe(true)
    expect(element.classList.contains("size-10")).toBe(true)
    expect(element.classList.contains("size-8")).toBe(false)
  })

  it("substitutes the element through render", async () => {
    const screen = await render(
      <Plan defaultOpen={false}>
        <PlanHeader>
          <PlanTrigger render={<button data-testid="own" type="button" />} />
        </PlanHeader>
        <PlanContent>Rendered content</PlanContent>
      </Plan>
    )
    const trigger = screen.getByRole("button", { name: "Toggle plan" })
    expect(trigger.element().getAttribute("data-testid")).toBe("own")
    expect(trigger.element().getAttribute("data-slot")).toBe("plan-trigger")
    await userEvent.click(trigger)
    await expect.element(screen.getByText("Rendered content")).toBeVisible()
  })

  it("toggles content visibility on click", async () => {
    const screen = await render(
      <Plan defaultOpen={false}>
        <PlanHeader>
          <PlanTrigger />
        </PlanHeader>
        <PlanContent>Toggle content</PlanContent>
      </Plan>
    )
    const trigger = screen.getByRole("button", { name: "Toggle plan" })
    expect(screen.getByText("Toggle content").query()).toBeNull()

    await userEvent.click(trigger)
    await expect.element(screen.getByText("Toggle content")).toBeVisible()

    await userEvent.click(trigger)
    await expect
      .element(screen.getByText("Toggle content"))
      .not.toBeInTheDocument()
  })

  it("toggles from the keyboard and names the plan content via aria-controls", async () => {
    const screen = await render(<Fixture defaultOpen={false} />)
    const trigger = screen.getByRole("button", { name: "Toggle plan" })
    await userEvent.tab()
    expect(document.activeElement).toBe(trigger.element())

    await userEvent.keyboard("{Enter}")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    const panelId = trigger.element().getAttribute("aria-controls")
    expect(panelId).toBeTruthy()
    expect(document.getElementById(panelId ?? "")).toBe(slot("plan-content"))

    await userEvent.keyboard(" ")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  })
})

describe("integration", () => {
  it("renders the complete plan structure", async () => {
    const screen = await render(
      <Plan defaultOpen>
        <PlanHeader>
          <PlanTitle>My Plan</PlanTitle>
          <PlanDescription>Plan description</PlanDescription>
          <PlanAction>
            <button type="button">Edit</button>
          </PlanAction>
          <PlanTrigger />
        </PlanHeader>
        <PlanContent>
          <ul>
            <li>Step 1</li>
            <li>Step 2</li>
          </ul>
        </PlanContent>
        <PlanFooter>
          <button type="button">Submit</button>
        </PlanFooter>
      </Plan>
    )
    await expect.element(screen.getByText("My Plan")).toBeVisible()
    await expect.element(screen.getByText("Plan description")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Edit" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Toggle plan" }))
      .toBeVisible()
    await expect.element(screen.getByText("Step 1")).toBeVisible()
    await expect.element(screen.getByText("Step 2")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Submit" }))
      .toBeVisible()
  })

  it("shimmers the title and description together while streaming", async () => {
    const screen = await render(<Fixture isStreaming />)
    await expect
      .element(screen.getByText("Add user theme settings"))
      .toHaveClass("shimmer")
    await expect
      .element(screen.getByText("Four steps across db, API and UI"))
      .toHaveClass("shimmer")
    expect(document.querySelectorAll(".shimmer")).toHaveLength(2)

    await screen.rerender(<Fixture />)
    expect(document.querySelectorAll(".shimmer")).toHaveLength(0)
  })
})

describe("accessibility", () => {
  it("passes axe open, closed, streaming and in dark mode", async () => {
    const screen = await render(<Fixture />)
    await expect.element(screen.getByText("Add the theme column")).toBeVisible()
    await expectNoViolations()

    await userEvent.click(screen.getByRole("button", { name: "Toggle plan" }))
    await expect
      .element(screen.getByText("Add the theme column"))
      .not.toBeInTheDocument()
    await expectNoViolations()

    await screen.rerender(<Fixture isStreaming />)
    await expectNoViolations()

    await withDark(async () => {
      await expectNoViolations()
    })
  })
})
