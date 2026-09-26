import axe from "axe-core"
import { expect, it } from "vitest"
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
import "@/app/globals.css"

// The harness page has no landmark of its own; wrapping in <main> keeps axe's
// page-level "region" rule about the component, not the blank test page.
function Fixture({ isStreaming = false }: { isStreaming?: boolean }) {
  return (
    <main>
      <Plan defaultOpen isStreaming={isStreaming}>
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

it("renders a complete plan with a footer action and passes axe", async () => {
  const screen = await render(<Fixture />)
  await expect
    .element(screen.getByText("Add user theme settings"))
    .toBeVisible()
  await expect.element(screen.getByText("Add the theme column")).toBeVisible()
  await expect
    .element(screen.getByRole("button", { name: "Approve and run" }))
    .toBeVisible()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("marks streaming text with the shimmer utility and passes axe", async () => {
  const screen = await render(<Fixture isStreaming />)
  const title = screen.getByText("Add user theme settings")
  await expect.element(title).toBeVisible()
  await expect.element(title).toHaveClass("shimmer")
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("toggles the plan content from the trigger", async () => {
  const screen = await render(<Fixture />)
  const trigger = screen.getByRole("button", { name: "Toggle plan" })
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  await expect
    .element(screen.getByText("Add the theme column"))
    .not.toBeInTheDocument()

  await userEvent.click(trigger)
  await expect.element(screen.getByText("Add the theme column")).toBeVisible()
})
