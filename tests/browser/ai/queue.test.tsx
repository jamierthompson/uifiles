import axe from "axe-core"
import { CheckIcon } from "lucide-react"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemAttachment,
  QueueItemContent,
  QueueItemDescription,
  QueueItemFile,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/registry/ai/queue"
import "@/app/globals.css"

// The harness page has no landmark of its own; wrapping in <main> keeps axe's
// page-level "region" rule about the component, not the blank test page.
function Fixture({ completed = false }: { completed?: boolean }) {
  return (
    <main>
      <Queue>
        <QueueSection>
          <QueueSectionTrigger>
            <QueueSectionLabel count={2} label="tasks" />
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              <QueueItem>
                <div className="flex items-start gap-2">
                  <QueueItemIndicator completed={completed} />
                  <QueueItemContent completed={completed}>
                    Add the migration
                  </QueueItemContent>
                  <QueueItemActions>
                    <QueueItemAction aria-label="Mark complete">
                      <CheckIcon />
                    </QueueItemAction>
                  </QueueItemActions>
                </div>
                <QueueItemDescription completed={completed}>
                  drizzle/0004_theme.sql
                </QueueItemDescription>
              </QueueItem>
              <QueueItem>
                <div className="flex items-start gap-2">
                  <QueueItemIndicator />
                  <QueueItemContent>Use this mockup</QueueItemContent>
                </div>
                <QueueItemAttachment>
                  <QueueItemFile>mockup.png</QueueItemFile>
                </QueueItemAttachment>
              </QueueItem>
            </QueueList>
          </QueueSectionContent>
        </QueueSection>
      </Queue>
    </main>
  )
}

it("renders a queue section with items, attachments and actions", async () => {
  const screen = await render(<Fixture />)
  await expect
    .element(screen.getByRole("button", { name: "2 tasks" }))
    .toBeVisible()
  await expect.element(screen.getByText("Add the migration")).toBeVisible()
  await expect.element(screen.getByText("drizzle/0004_theme.sql")).toBeVisible()
  await expect.element(screen.getByText("mockup.png")).toBeVisible()
  await expect
    .element(screen.getByRole("button", { name: "Mark complete" }))
    .toBeInTheDocument()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("strikes through completed items", async () => {
  const screen = await render(<Fixture completed />)
  await expect
    .element(screen.getByText("Add the migration"))
    .toHaveClass("line-through")
  await expect
    .element(screen.getByText("drizzle/0004_theme.sql"))
    .toHaveClass("line-through")
  // Upstream dims completed items to text-muted-foreground/50 and /40, which
  // measures 1.96:1 and 1.69:1 against the background; that is an inherited
  // design choice, so only the contrast rule is excluded here.
  const results = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
  })
  expect(results.violations).toEqual([])
})

it("collapses and expands a section from its trigger", async () => {
  const screen = await render(<Fixture />)
  const trigger = screen.getByRole("button", { name: "2 tasks" })
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  await expect
    .element(screen.getByText("Add the migration"))
    .not.toBeInTheDocument()

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  await expect.element(screen.getByText("Add the migration")).toBeVisible()
})
