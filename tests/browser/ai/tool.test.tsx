import type { ReactNode } from "react"
import { Component } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ToolPart } from "@/registry/ai/tool"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/registry/ai/tool"
import { expectNoViolations, withDark } from "@/tests/a11y"
import "@/app/globals.css"

const input = { city: "Melbourne", unit: "celsius" }
const output = { temperature: 18, conditions: "Partly cloudy" }

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

/** Elements matching `text` exactly that are not inside the status badge. */
const outsideBadge = (
  screen: {
    getByText: (t: string, o: { exact: true }) => { elements: () => Element[] }
  },
  text: string
) =>
  screen
    .getByText(text, { exact: true })
    .elements()
    .filter((element) => element.closest("[data-slot='badge']") === null)

const rotateOf = (element: Element) => getComputedStyle(element).rotate

afterEach(() => {
  vi.restoreAllMocks()
})

describe("tool", () => {
  it("renders children", async () => {
    const screen = await render(<Tool>Content</Tool>)
    await expect.element(screen.getByText("Content")).toBeInTheDocument()
  })

  it("applies custom className to the collapsible root", async () => {
    await render(<Tool className="custom">Test</Tool>)
    const root = document.querySelector("[data-slot='collapsible']")
    expect(root?.classList.contains("custom")).toBe(true)
    expect(root?.classList.contains("rounded-md")).toBe(true)
  })

  it("expands on click, rotates the chevron and unmounts the panel when closed", async () => {
    const screen = await render(
      <main>
        <Tool>
          <ToolHeader state="output-available" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
            <ToolOutput errorText={undefined} output={output} />
          </ToolContent>
        </Tool>
      </main>
    )
    const trigger = screen.getByRole("button", { name: /get_weather/ })
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    expect(
      document.querySelector("[data-slot='collapsible-content']")
    ).toBeNull()
    const chevron = trigger.element().querySelector(":scope > svg") as Element
    expect(rotateOf(chevron)).toMatch(/^(none|0deg)$/)

    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    await expect.element(screen.getByText("Result")).toBeVisible()
    expect(
      document.querySelector("[data-slot='collapsible'][data-open]")
    ).not.toBeNull()
    await expect.poll(() => rotateOf(chevron)).toBe("180deg")

    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    await expect.element(screen.getByText("Parameters")).not.toBeInTheDocument()
  })

  it("toggles from the keyboard, names the panel via aria-controls and passes (open, eventDetails) to onOpenChange", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <main>
        <Tool onOpenChange={onOpenChange}>
          <ToolHeader state="output-available" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
          </ToolContent>
        </Tool>
      </main>
    )
    const trigger = screen.getByRole("button", { name: /get_weather/ })
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

    expect(onOpenChange).toHaveBeenCalledTimes(2)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true)
    expect(onOpenChange.mock.calls[0]?.[1]).toMatchObject({
      reason: "trigger-press",
    })
    expect(onOpenChange.mock.calls[1]?.[0]).toBe(false)
  })
})

describe("toolHeader", () => {
  it("renders the title over the derived name", async () => {
    const screen = await render(
      <Tool>
        <ToolHeader state="input-available" title="search" type="tool-search" />
      </Tool>
    )
    await expect.element(screen.getByText("search")).toBeVisible()
  })

  it("derives the name from the type and keeps inner dashes", async () => {
    const screen = await render(
      <>
        <Tool>
          <ToolHeader state="input-available" type="tool-web-search" />
        </Tool>
        <Tool>
          <ToolHeader
            state="output-available"
            type="tool-get-current-weather"
          />
        </Tool>
      </>
    )
    await expect.element(screen.getByText("web-search")).toBeVisible()
    await expect.element(screen.getByText("get-current-weather")).toBeVisible()
  })

  it("derives an empty name from a bare 'tool-' type and keeps the badge as the accessible name", async () => {
    const screen = await render(
      <Tool>
        <ToolHeader state="input-available" type="tool-" />
      </Tool>
    )
    const trigger = screen.getByRole("button", { name: "Running" })
    await expect.element(trigger).toBeVisible()
    expect(
      trigger.element().querySelector("span.font-medium")?.textContent
    ).toBe("")
  })

  it("renders the dynamic tool name from toolName, and the title over it", async () => {
    const screen = await render(
      <>
        <Tool>
          <ToolHeader
            state="input-available"
            toolName="web-search"
            type="dynamic-tool"
          />
        </Tool>
        <Tool>
          <ToolHeader
            state="approval-requested"
            title="Custom Title"
            toolName="delete-file"
            type="dynamic-tool"
          />
        </Tool>
      </>
    )
    await expect.element(screen.getByText("web-search")).toBeVisible()
    await expect.element(screen.getByText("Custom Title")).toBeVisible()
    expect(screen.getByText("delete-file").query()).toBeNull()
    await expect.element(screen.getByText("Awaiting Approval")).toBeVisible()
  })

  it("has a wrench icon", async () => {
    await render(
      <Tool>
        <ToolHeader state="input-available" title="test" type="tool-test" />
      </Tool>
    )
    expect(document.querySelector("svg.lucide-wrench")).not.toBeNull()
  })

  const states: Array<[ToolPart["state"], string, string, string | null]> = [
    ["input-streaming", "Pending", "lucide-circle", null],
    ["input-available", "Running", "lucide-clock", null],
    [
      "approval-requested",
      "Awaiting Approval",
      "lucide-clock",
      "text-muted-foreground",
    ],
    ["approval-responded", "Responded", "lucide-check-circle", "text-primary"],
    ["output-available", "Completed", "lucide-check-circle", "text-primary"],
    ["output-denied", "Denied", "lucide-x-circle", "text-destructive"],
    ["output-error", "Error", "lucide-x-circle", "text-destructive"],
  ]

  it.each(states)(
    "shows the %s state as '%s' with a %s icon",
    async (state, label, icon, colour) => {
      const screen = await render(
        <Tool>
          <ToolHeader state={state} title="test" type="tool-test" />
        </Tool>
      )
      await expect
        .element(screen.getByText(label, { exact: true }))
        .toBeVisible()
      const badge = document.querySelector("[data-slot='badge']")
      const svg = badge?.querySelector("svg")
      expect(svg?.classList.contains(icon)).toBe(true)
      if (colour) expect(svg?.classList.contains(colour)).toBe(true)
    }
  )

  it("falls back to the raw state text and a neutral icon for an unknown state", async () => {
    const screen = await render(
      <Tool>
        <ToolHeader
          state={"from-the-future" as ToolPart["state"]}
          title="test"
          type="tool-test"
        />
      </Tool>
    )
    await expect.element(screen.getByText("from-the-future")).toBeVisible()
    const badge = document.querySelector("[data-slot='badge']")
    expect(badge?.querySelector("svg.lucide-circle")).not.toBeNull()
  })
})

describe("toolContent", () => {
  it("renders content when open and keeps it hidden in the DOM with keepMounted", async () => {
    const screen = await render(
      <>
        <Tool defaultOpen>
          <ToolHeader state="input-available" title="open" type="tool-test" />
          <ToolContent>Tool details</ToolContent>
        </Tool>
        <Tool>
          <ToolHeader state="input-available" title="closed" type="tool-test" />
          <ToolContent keepMounted>Persisted details</ToolContent>
        </Tool>
      </>
    )
    await expect.element(screen.getByText("Tool details")).toBeVisible()
    const persisted = screen.getByText("Persisted details").query()
    expect(persisted).not.toBeNull()
    expect(persisted?.hasAttribute("hidden")).toBe(true)
  })
})

describe("toolInput", () => {
  it("renders the input as highlighted JSON under a Parameters heading", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolInput input={{ query: "test search" }} />
        </ToolContent>
      </Tool>
    )
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    await expect.element(screen.getByText(/"query"/).first()).toBeVisible()
    expect(document.querySelector("[data-language='json']")).not.toBeNull()
  })

  it("formats nested input with two-space indentation", async () => {
    await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolInput input={{ key: "value", nested: { data: "test" } }} />
        </ToolContent>
      </Tool>
    )
    // The code block renders one block-level span per line, so the nested key
    // shows up as its own line indented by four spaces.
    await expect
      .poll(() =>
        Array.from(document.querySelectorAll("pre > code > span")).map(
          (line) => line.textContent
        )
      )
      .toEqual([
        "{",
        '  "key": "value",',
        '  "nested": {',
        '    "data": "test"',
        "  }",
        "}",
      ])
  })

  it("renders a placeholder instead of crashing when the input is still undefined", async () => {
    const onError = vi.fn()
    const screen = await render(
      <main>
        <Boundary onError={onError}>
          <Tool defaultOpen>
            <ToolHeader state="input-streaming" type="tool-get_weather" />
            <ToolContent>
              <ToolInput input={undefined} />
            </ToolContent>
          </Tool>
        </Boundary>
      </main>
    )
    expect(onError).not.toHaveBeenCalled()
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    await expect.element(screen.getByText("No input yet")).toBeVisible()
    expect(document.querySelector("pre")).toBeNull()
    await expectNoViolations()
    await withDark(async () => {
      await expectNoViolations()
    })
  })

  it("renders a null input as the JSON literal", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolInput input={null} />
        </ToolContent>
      </Tool>
    )
    await expect.element(screen.getByText("null")).toBeVisible()
  })

  it("renders an empty object input and a null output as JSON literals", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolInput input={{}} />
          <ToolOutput errorText={undefined} output={null} />
        </ToolContent>
      </Tool>
    )
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    await expect.element(screen.getByText("Result")).toBeVisible()
    await expect
      .poll(() =>
        Array.from(document.querySelectorAll("pre")).map((pre) =>
          pre.textContent?.trim()
        )
      )
      .toEqual(["{}", "null"])
  })

  it("never throws for input JSON cannot serialise", async () => {
    const onError = vi.fn()
    const circular: { self?: unknown } = {}
    circular.self = circular
    const screen = await render(
      <Boundary onError={onError}>
        <Tool defaultOpen>
          <ToolContent>
            <ToolInput data-testid="big" input={{ count: BigInt(10) }} />
            <ToolInput data-testid="circular" input={circular} />
          </ToolContent>
        </Tool>
      </Boundary>
    )
    expect(onError).not.toHaveBeenCalled()
    await expect.element(screen.getByText(/"count": "10"/)).toBeVisible()
    await expect.element(screen.getByText("[object Object]")).toBeVisible()
  })

  it("forwards className and rest props to the wrapper", async () => {
    await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolInput className="custom" data-testid="wrapper" input={input} />
        </ToolContent>
      </Tool>
    )
    const wrapper = document.querySelector("[data-testid='wrapper']")
    expect(wrapper?.classList.contains("custom")).toBe(true)
    expect(wrapper?.classList.contains("space-y-2")).toBe(true)
  })
})

describe("toolOutput", () => {
  it("renders string output in a code block under a Result heading", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolOutput errorText={undefined} output="Result data" />
        </ToolContent>
      </Tool>
    )
    await expect.element(screen.getByText("Result")).toBeVisible()
    await expect.element(screen.getByText("Result data")).toBeVisible()
    expect(document.querySelector("pre")).not.toBeNull()
  })

  it("renders object output as JSON", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolOutput
            errorText={undefined}
            output={{ data: [1, 2, 3], result: "success" }}
          />
        </ToolContent>
      </Tool>
    )
    await expect.element(screen.getByText("Result")).toBeVisible()
    await expect
      .poll(() => document.querySelector("pre")?.textContent)
      .toContain('"result": "success"')
  })

  it("renders a React element output as-is", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolOutput
            errorText={undefined}
            output={<em data-testid="node">custom node</em>}
          />
        </ToolContent>
      </Tool>
    )
    await expect.element(screen.getByText("custom node")).toBeVisible()
    expect(document.querySelector("pre")).toBeNull()
    expect(document.querySelector("[data-testid='node']")?.tagName).toBe("EM")
  })

  it("renders an error under an Error heading, not a Result heading", async () => {
    const screen = await render(
      <main>
        <Tool defaultOpen>
          <ToolHeader state="output-error" type="tool-get_weather" />
          <ToolContent>
            <ToolOutput errorText="Service unavailable" output={undefined} />
          </ToolContent>
        </Tool>
      </main>
    )
    await expect.element(screen.getByText("Service unavailable")).toBeVisible()
    const headings = outsideBadge(screen, "Error")
    expect(headings).toHaveLength(1)
    expect(headings[0]?.classList.contains("uppercase")).toBe(true)
    expect(screen.getByText("Result", { exact: true }).query()).toBeNull()
    const container = screen
      .getByText("Service unavailable")
      .element().parentElement
    expect(container?.classList.contains("text-destructive")).toBe(true)
    expect(document.querySelector("pre")).toBeNull()
    await expectNoViolations()
  })

  it("renders both the error text and a partial output", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolOutput errorText="boom" output="partial" />
        </ToolContent>
      </Tool>
    )
    await expect.element(screen.getByText("boom")).toBeVisible()
    await expect.element(screen.getByText("partial")).toBeVisible()
    expect(outsideBadge(screen, "Error")).toHaveLength(1)
  })

  it("renders nothing when there is neither output nor error", async () => {
    const screen = await render(
      <Tool defaultOpen>
        <ToolContent>
          <ToolOutput errorText={undefined} output={undefined} />
        </ToolContent>
      </Tool>
    )
    expect(screen.getByText("Result").query()).toBeNull()
    expect(
      document.querySelector("[data-slot='collapsible-content']")?.textContent
    ).toBe("")
  })

  it.each([
    [0, "0"],
    [false, "false"],
    ["", ""],
  ])(
    "shows the falsy result %j under a Result heading",
    async (value, text) => {
      const screen = await render(
        <Tool defaultOpen>
          <ToolContent>
            <ToolOutput errorText={undefined} output={value} />
          </ToolContent>
        </Tool>
      )
      await expect.element(screen.getByText("Result")).toBeVisible()
      if (text) {
        await expect
          .element(screen.getByText(text, { exact: true }))
          .toBeVisible()
      }
    }
  )

  it("renders output JSON cannot serialise without throwing", async () => {
    const onError = vi.fn()
    const screen = await render(
      <Boundary onError={onError}>
        <Tool defaultOpen>
          <ToolContent>
            <ToolOutput errorText={undefined} output={{ total: BigInt(42) }} />
          </ToolContent>
        </Tool>
      </Boundary>
    )
    expect(onError).not.toHaveBeenCalled()
    await expect.element(screen.getByText(/"total": "42"/)).toBeVisible()
  })
})

describe("accessibility", () => {
  it("passes axe collapsed, expanded, errored and in dark mode", async () => {
    const screen = await render(
      <main>
        <Tool>
          <ToolHeader state="output-available" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
            <ToolOutput errorText={undefined} output={output} />
          </ToolContent>
        </Tool>
        <Tool defaultOpen>
          <ToolHeader state="output-error" type="tool-get_weather" />
          <ToolContent>
            <ToolInput input={input} />
            <ToolOutput errorText="Service unavailable" output={undefined} />
          </ToolContent>
        </Tool>
        <Tool>
          <ToolHeader
            state="approval-requested"
            title="Search the web"
            toolName="web_search"
            type="dynamic-tool"
          />
        </Tool>
      </main>
    )
    await expectNoViolations()

    await userEvent.click(screen.getByRole("button", { name: /Completed/ }))
    await expect.element(screen.getByText("Result")).toBeVisible()
    await expectNoViolations()

    await withDark(async () => {
      await expectNoViolations()
    })
  })
})
