import axe from "axe-core"
import { useState } from "react"
import { expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Button } from "@/components/ui/button"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/registry/ai/model-selector"
import "@/app/globals.css"

// Wait for enter animations so axe measures final colors, not mid-fade frames.
const settle = () =>
  Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))

const groups = [
  {
    heading: "OpenAI",
    models: [{ id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" }],
  },
  {
    heading: "Anthropic",
    models: [
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        provider: "anthropic",
      },
    ],
  },
] as const

function Demo() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("GPT-4o")

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger render={<Button variant="outline" />}>
        {selected}
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {groups.map((group) => (
            <ModelSelectorGroup heading={group.heading} key={group.heading}>
              {group.models.map((model) => (
                <ModelSelectorItem
                  key={model.id}
                  onSelect={() => {
                    setSelected(model.name)
                    setOpen(false)
                  }}
                  value={model.id}
                >
                  <ModelSelectorLogo provider={model.provider} />
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  )
}

it("opens from a button and selects a model", async () => {
  const screen = await render(<Demo />)

  const trigger = screen.getByRole("button", { name: "GPT-4o" })
  await expect.element(trigger).toBeVisible()
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()

  await userEvent.click(trigger)

  const dialog = page.getByRole("dialog")
  await expect.element(dialog).toBeVisible()
  await expect.element(page.getByPlaceholder("Search models...")).toBeVisible()
  const option = page.getByRole("option", { name: /Claude Sonnet 4/ })
  await expect.element(option).toBeVisible()

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])

  await userEvent.click(option)

  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
  await expect
    .element(screen.getByRole("button", { name: "Claude Sonnet 4" }))
    .toBeVisible()
})
