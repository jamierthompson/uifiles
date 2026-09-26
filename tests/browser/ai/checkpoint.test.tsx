import axe from "axe-core"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
} from "@/registry/ai/checkpoint"
import "@/app/globals.css"

// The harness page has no landmark of its own; wrapping in <main> keeps axe's
// page-level "region" rule about the component, not the blank test page.
it("renders a checkpoint with a separator and passes axe", async () => {
  const screen = await render(
    <main>
      <Checkpoint>
        <CheckpointIcon />
        <CheckpointTrigger>Checkpoint 1</CheckpointTrigger>
      </Checkpoint>
    </main>
  )
  await expect
    .element(screen.getByRole("button", { name: "Checkpoint 1" }))
    .toBeVisible()
  await expect.element(screen.getByRole("separator")).toBeInTheDocument()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("shows the tooltip when the trigger is hovered", async () => {
  const screen = await render(
    <main>
      <Checkpoint>
        <CheckpointIcon />
        <CheckpointTrigger tooltip="Restore to this point">
          Checkpoint 2
        </CheckpointTrigger>
      </Checkpoint>
    </main>
  )
  const trigger = screen.getByRole("button", { name: "Checkpoint 2" })
  await expect.element(trigger).toBeVisible()
  await userEvent.hover(trigger)
  await expect.element(screen.getByText("Restore to this point")).toBeVisible()
  // Let the wrapper's fade-in finish so axe measures the settled colors.
  const popup = document.querySelector("[data-slot='tooltip-content']")
  expect(popup).not.toBeNull()
  await Promise.all(
    (popup as HTMLElement)
      .getAnimations({ subtree: true })
      .map((animation) => animation.finished)
  )
  // The tooltip popup is portaled to <body>, outside the <main> landmark, so
  // the page-level "region" best-practice rule is excluded for this run only.
  const results = await axe.run(document.body, {
    rules: { region: { enabled: false } },
  })
  expect(results.violations).toEqual([])
})
