import axe from "axe-core"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/registry/ai/task"
import "@/app/globals.css"

// The harness page has no landmark of its own; wrapping in <main> keeps axe's
// page-level "region" rule about the component, not the blank test page.
function Fixture({ defaultOpen }: { defaultOpen?: boolean }) {
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

it("renders an open task with its items and passes axe", async () => {
  const screen = await render(<Fixture />)
  const trigger = screen.getByRole("button", { name: "Scanning the project" })
  await expect.element(trigger).toBeVisible()
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  await expect.element(screen.getByText("app/page.tsx")).toBeVisible()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("collapses and expands from the trigger", async () => {
  const screen = await render(<Fixture defaultOpen={false} />)
  const trigger = screen.getByRole("button", { name: "Scanning the project" })
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  await expect.element(screen.getByText("app/page.tsx")).not.toBeInTheDocument()

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  await expect.element(screen.getByText("app/page.tsx")).toBeVisible()

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  await expect.element(screen.getByText("app/page.tsx")).not.toBeInTheDocument()
})
