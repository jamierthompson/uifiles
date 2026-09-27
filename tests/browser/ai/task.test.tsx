import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/registry/ai/task"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

// The harness page has no landmark of its own; <main> keeps axe's "region"
// rule about the component rather than the blank test page.
function Fixture({ defaultOpen }: { defaultOpen?: boolean | undefined }) {
  return (
    <main>
      <Task defaultOpen={defaultOpen}>
        <TaskTrigger title="Scanning the project" />
        <TaskContent>
          <TaskItem>
            Reading <TaskItemFile>app/page.tsx</TaskItemFile>
          </TaskItem>
        </TaskContent>
      </Task>
    </main>
  )
}

const rotateOf = (element: Element) => getComputedStyle(element).rotate
const panel = () => document.querySelector("[data-slot='collapsible-content']")

afterEach(() => {
  vi.restoreAllMocks()
})

describe("task", () => {
  it("renders children", async () => {
    const screen = await render(<Task>Content</Task>)
    await expect.element(screen.getByText("Content")).toBeInTheDocument()
  })

  it("renders an empty task without crashing", async () => {
    await render(<Task />)
    expect(document.querySelector("[data-slot='collapsible']")).not.toBeNull()
  })

  it("is open by default", async () => {
    const screen = await render(<Fixture />)
    const trigger = screen.getByRole("button", { name: "Scanning the project" })
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    await expect.element(screen.getByText("app/page.tsx")).toBeVisible()
  })

  it("can start closed", async () => {
    const screen = await render(<Fixture defaultOpen={false} />)
    const trigger = screen.getByRole("button", { name: "Scanning the project" })
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("app/page.tsx").query()).toBeNull()
  })

  it("passes (open, eventDetails) to onOpenChange", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <Task onOpenChange={onOpenChange}>
        <TaskTrigger title="Task" />
        <TaskContent>Details</TaskContent>
      </Task>
    )
    await userEvent.click(screen.getByRole("button", { name: "Task" }))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(onOpenChange.mock.calls[0]?.[1]).toMatchObject({
      reason: "trigger-press",
    })
  })

  it("applies custom className to the root", async () => {
    await render(<Task className="custom">Content</Task>)
    expect(
      document
        .querySelector("[data-slot='collapsible']")
        ?.classList.contains("custom")
    ).toBe(true)
  })
})

describe("taskTrigger", () => {
  it("renders the title as a <span> inside a native <button>", async () => {
    const screen = await render(
      <Task>
        <TaskTrigger title="Search task" />
      </Task>
    )
    const trigger = screen.getByRole("button", { name: "Search task" })
    await expect.element(trigger).toBeVisible()
    expect(trigger.element().tagName).toBe("BUTTON")
    const label = trigger.element().querySelector("span")
    expect(label?.textContent).toBe("Search task")
    expect(trigger.element().querySelector("p, div")).toBeNull()
  })

  it("renders custom children inside the button and ignores title", async () => {
    const screen = await render(
      <Task>
        <TaskTrigger title="ignored">
          <span>Custom trigger</span>
        </TaskTrigger>
      </Task>
    )
    const button = screen.getByRole("button", { name: "Custom trigger" })
    await expect.element(button).toBeVisible()
    expect(button.element().tagName).toBe("BUTTON")
    expect(screen.getByText("ignored").query()).toBeNull()
  })

  it("nests an interactive custom child inside the button and leaves React's warning to the consumer", async () => {
    allowConsole("error")
    // A pass-through spy: the guard's wrapper still records and prints.
    const error = vi.spyOn(console, "error")
    const screen = await render(
      <Task>
        <TaskTrigger title="ignored">
          <span>Custom</span>
          <button type="button">Inner action</button>
        </TaskTrigger>
      </Task>
    )
    const inner = screen.getByRole("button", { name: "Inner action" })
    await expect.element(inner).toBeInTheDocument()
    expect(
      inner.element().closest("[data-slot='collapsible-trigger']")
    ).not.toBeNull()
    const logged = error.mock.calls
      .map((call) => call.map(String).join(" "))
      .join("\n")
    // React 19 logs "In HTML, %s cannot be a descendant of <%s>." with the
    // tag names as format arguments.
    expect(logged).toMatch(/cannot be a descendant of/)
    expect(logged).toMatch(/<button> button/)
  })

  it("has no interactive descendants of its own", async () => {
    const screen = await render(<Fixture />)
    const trigger = screen.getByRole("button", { name: "Scanning the project" })
    expect(
      trigger.element().querySelector("button, a, input, [tabindex]")
    ).toBeNull()
  })

  it("has a search icon by default", async () => {
    await render(
      <Task>
        <TaskTrigger title="Task" />
      </Task>
    )
    expect(document.querySelector("svg.lucide-search")).not.toBeNull()
  })

  it("substitutes the trigger element through render", async () => {
    const screen = await render(
      <Task defaultOpen={false}>
        <TaskTrigger
          nativeButton={false}
          render={<div data-testid="custom-trigger" />}
          title="Rendered"
        />
        <TaskContent>Details</TaskContent>
      </Task>
    )
    const trigger = screen.getByRole("button", { name: "Rendered" })
    expect(trigger.element().tagName).toBe("DIV")
    expect(trigger.element().getAttribute("data-testid")).toBe("custom-trigger")
    await userEvent.click(trigger)
    await expect.element(screen.getByText("Details")).toBeVisible()
  })

  it("toggles content on click", async () => {
    const screen = await render(<Fixture defaultOpen={false} />)
    const trigger = screen.getByRole("button", { name: "Scanning the project" })
    expect(screen.getByText("app/page.tsx").query()).toBeNull()

    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    await expect.element(screen.getByText("app/page.tsx")).toBeVisible()

    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    await expect
      .element(screen.getByText("app/page.tsx"))
      .not.toBeInTheDocument()
  })

  it("toggles from the keyboard, names the panel via aria-controls and rotates the chevron on data-panel-open", async () => {
    const screen = await render(<Fixture defaultOpen={false} />)
    const trigger = screen.getByRole("button", { name: "Scanning the project" })
    const chevron = trigger
      .element()
      .querySelector("svg.lucide-chevron-down") as Element
    expect(rotateOf(chevron)).toMatch(/^(none|0deg)$/)
    expect(trigger.element().hasAttribute("data-panel-open")).toBe(false)

    await userEvent.tab()
    expect(document.activeElement).toBe(trigger.element())
    await userEvent.keyboard("{Enter}")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger.element().hasAttribute("data-panel-open")).toBe(true)
    const panelId = trigger.element().getAttribute("aria-controls")
    expect(panelId).toBeTruthy()
    expect(document.getElementById(panelId ?? "")).toBe(panel())
    await expect.poll(() => rotateOf(chevron)).toBe("180deg")

    await userEvent.keyboard(" ")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger.element().hasAttribute("data-panel-open")).toBe(false)
  })

  it("is at least 24px tall so it meets the WCAG 2.2 target size", async () => {
    const screen = await render(<Fixture />)
    const { height } = screen
      .getByRole("button", { name: "Scanning the project" })
      .element()
      .getBoundingClientRect()
    expect(height).toBeGreaterThanOrEqual(24)
  })
})

describe("taskContent", () => {
  it("renders content", async () => {
    const screen = await render(
      <Task>
        <TaskTrigger title="Task" />
        <TaskContent>Task details</TaskContent>
      </Task>
    )
    await expect.element(screen.getByText("Task details")).toBeVisible()
  })

  it("applies custom className to the panel", async () => {
    await render(
      <Task>
        <TaskTrigger title="Task" />
        <TaskContent className="custom">Content</TaskContent>
      </Task>
    )
    expect(panel()?.classList.contains("custom")).toBe(true)
  })

  it("keeps the panel in the DOM (hidden) when keepMounted is set", async () => {
    const screen = await render(
      <Task defaultOpen={false}>
        <TaskTrigger title="Scanning" />
        <TaskContent keepMounted>
          <TaskItem>persisted</TaskItem>
        </TaskContent>
      </Task>
    )
    expect(panel()).not.toBeNull()
    expect(panel()?.hasAttribute("hidden")).toBe(true)
    expect(screen.getByText("persisted").query()).not.toBeNull()
  })

  it("unmounts the panel when closed without keepMounted", async () => {
    await render(
      <Task defaultOpen={false}>
        <TaskTrigger title="Scanning" />
        <TaskContent>
          <TaskItem>gone</TaskItem>
        </TaskContent>
      </Task>
    )
    expect(panel()).toBeNull()
  })
})

describe("taskItem", () => {
  it("renders task item text", async () => {
    const screen = await render(<TaskItem>Task item text</TaskItem>)
    await expect.element(screen.getByText("Task item text")).toBeVisible()
  })

  it("applies custom className with the muted text style", async () => {
    const screen = await render(<TaskItem className="custom">Item</TaskItem>)
    const item = screen.getByText("Item").element()
    expect(item.classList.contains("custom")).toBe(true)
    expect(item.classList.contains("text-muted-foreground")).toBe(true)
  })
})

describe("taskItemFile", () => {
  it("renders a file chip", async () => {
    const screen = await render(<TaskItemFile>file.txt</TaskItemFile>)
    const chip = screen.getByText("file.txt").element()
    await expect.element(screen.getByText("file.txt")).toBeVisible()
    expect(chip.classList.contains("inline-flex")).toBe(true)
    expect(chip.classList.contains("bg-secondary")).toBe(true)
  })

  it("applies custom className", async () => {
    const screen = await render(
      <TaskItemFile className="custom">file.txt</TaskItemFile>
    )
    expect(
      screen.getByText("file.txt").element().classList.contains("custom")
    ).toBe(true)
  })
})

describe("accessibility", () => {
  it("passes axe open, closed and in dark mode", async () => {
    const screen = await render(<Fixture />)
    await expect.element(screen.getByText("app/page.tsx")).toBeVisible()
    await expectNoViolations()

    await userEvent.click(
      screen.getByRole("button", { name: "Scanning the project" })
    )
    await expect
      .element(screen.getByText("app/page.tsx"))
      .not.toBeInTheDocument()
    await expectNoViolations()

    await screen.rerender(<Fixture />)
    await withDark(async () => {
      await expectNoViolations()
    })
  })
})
