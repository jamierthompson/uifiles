import axe from "axe-core"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/registry/ai/tool"
import "@/app/globals.css"

const input = { city: "Melbourne", unit: "celsius" }
const output = { temperature: 18, conditions: "Partly cloudy" }

it("renders a collapsed tool call that expands on click", async () => {
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
  await expect.element(trigger).toBeVisible()
  expect(trigger.element().textContent).toContain("get_weather")
  expect(trigger.element().textContent).toContain("Completed")
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  expect(document.querySelector("[data-slot='collapsible-content']")).toBeNull()

  const collapsed = await axe.run(document.body)
  expect(collapsed.violations).toEqual([])

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  await expect.element(screen.getByText("Parameters")).toBeVisible()
  await expect.element(screen.getByText("Result")).toBeVisible()
  // The Base UI root carries data-open, which drives the chevron rotation.
  expect(
    document.querySelector("[data-slot='collapsible'][data-open]")
  ).not.toBeNull()

  const expanded = await axe.run(document.body)
  expect(expanded.violations).toEqual([])
})

it("shows every lifecycle state, including errors", async () => {
  const screen = await render(
    <main>
      <Tool>
        <ToolHeader state="input-streaming" type="tool-get_weather" />
      </Tool>
      <Tool>
        <ToolHeader state="input-available" type="tool-get_weather" />
      </Tool>
      <Tool>
        <ToolHeader
          state="approval-requested"
          title="Search the web"
          toolName="web_search"
          type="dynamic-tool"
        />
      </Tool>
      <Tool defaultOpen>
        <ToolHeader state="output-error" type="tool-get_weather" />
        <ToolContent>
          <ToolOutput errorText="Service unavailable" output={undefined} />
        </ToolContent>
      </Tool>
    </main>
  )

  await expect.element(screen.getByText("Pending")).toBeVisible()
  await expect.element(screen.getByText("Running")).toBeVisible()
  await expect.element(screen.getByText("Awaiting Approval")).toBeVisible()
  await expect.element(screen.getByText("Search the web")).toBeVisible()
  await expect
    .element(screen.getByText("Error", { exact: true }).first())
    .toBeVisible()
  await expect.element(screen.getByText("Service unavailable")).toBeVisible()

  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})
