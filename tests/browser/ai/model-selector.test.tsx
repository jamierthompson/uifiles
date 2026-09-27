import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ModelSelectorDemo } from "@/app/preview/model-selector/model-selector-demo"
import { Button } from "@/components/ui/button"
import {
  ModelSelector,
  ModelSelectorContent,
  type ModelSelectorContentProps,
  ModelSelectorDialog,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  type ModelSelectorProps,
  ModelSelectorSeparator,
  ModelSelectorShortcut,
  ModelSelectorTrigger,
} from "@/registry/ai/model-selector"
import { expectNoViolations, withDark } from "@/tests/a11y"
import "@/app/globals.css"

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

/** The preview's composition: grouped models with logos behind a Button trigger. */
function Demo() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("GPT-4o")

  return (
    <main>
      <ModelSelector onOpenChange={setOpen} open={open}>
        <ModelSelectorTrigger render={<Button variant="outline" />}>
          <ModelSelectorLogo provider="openai" />
          <ModelSelectorName>{selected}</ModelSelectorName>
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
    </main>
  )
}

type Item = { id: string; name: string; keywords?: string[] | undefined }

/** A flat, controlled picker for filter, keyboard and empty-state tests. */
function Picker({
  items,
  onOpenChange,
  onSelect,
  emptyOutsideList = false,
  ...contentProps
}: {
  items: Item[]
  onOpenChange?: ModelSelectorProps["onOpenChange"]
  onSelect?: ((value: string) => void) | undefined
  emptyOutsideList?: boolean
} & Pick<
  ModelSelectorContentProps,
  "filter" | "shouldFilter" | "initialFocus"
>) {
  const [open, setOpen] = useState(false)
  const empty = <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>

  return (
    <main>
      <ModelSelector
        onOpenChange={(next, details) => {
          setOpen(next)
          onOpenChange?.(next, details)
        }}
        open={open}
      >
        <ModelSelectorTrigger render={<Button variant="outline" />}>
          Pick a model
        </ModelSelectorTrigger>
        <ModelSelectorContent {...contentProps}>
          <ModelSelectorInput placeholder="Search models..." />
          {emptyOutsideList && empty}
          <ModelSelectorList>
            {!emptyOutsideList && empty}
            <ModelSelectorGroup heading="Models">
              {items.map((model) => (
                <ModelSelectorItem
                  key={model.id}
                  {...(model.keywords && { keywords: model.keywords })}
                  onSelect={(value) => {
                    onSelect?.(value)
                    setOpen(false)
                  }}
                  value={model.id}
                >
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
    </main>
  )
}

const items: Item[] = [
  { id: "OpenAI/GPT-4o", name: "GPT-4o" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
]

const anthropic: Item[] = [
  { id: "anthropic/claude-opus-4", name: "Claude Opus 4" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
]

const openPicker = async (ui: React.ReactElement) => {
  const screen = await render(ui)
  await userEvent.click(screen.getByRole("button", { name: "Pick a model" }))
  const input = page.getByPlaceholder("Search models...")
  await expect.element(input).toBeVisible()
  return { screen, input }
}

describe("ModelSelector", () => {
  it("renders as a Dialog component", async () => {
    const screen = await render(
      <main>
        <ModelSelector>
          <div>Dialog Content</div>
        </ModelSelector>
      </main>
    )
    await expect.element(screen.getByText("Dialog Content")).toBeVisible()
  })

  it("accepts open prop to control visibility", async () => {
    const ui = (open: boolean) => (
      <main>
        <ModelSelector open={open}>
          <ModelSelectorTrigger>Open</ModelSelectorTrigger>
          <ModelSelectorContent>
            <div>Content</div>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const screen = await render(ui(false))
    await expect.element(page.getByText("Content")).not.toBeInTheDocument()

    await screen.rerender(ui(true))
    await expect.element(page.getByText("Content")).toBeVisible()

    await screen.rerender(ui(false))
    await expect.element(page.getByText("Content")).not.toBeInTheDocument()
  })

  it("opens initially with defaultOpen", async () => {
    await render(
      <main>
        <ModelSelector defaultOpen>
          <ModelSelectorContent>
            <div>Content</div>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await expect.element(page.getByRole("dialog")).toBeVisible()
  })

  it("handles onOpenChange callback", async () => {
    const handleOpenChange = vi.fn()
    const screen = await render(
      <main>
        <ModelSelector onOpenChange={handleOpenChange}>
          <ModelSelectorTrigger>Open Selector</ModelSelectorTrigger>
          <ModelSelectorContent>
            <div>Content</div>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )

    await userEvent.click(screen.getByText("Open Selector"))
    await expect.element(page.getByText("Content")).toBeVisible()
    expect(handleOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: "trigger-press" })
    )
  })

  it("closes on Escape, restores focus to the trigger and reports the reason", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <Picker items={items} onOpenChange={onOpenChange} />
    )
    const trigger = screen.getByRole("button", { name: "Pick a model" })
    await userEvent.click(trigger)
    await expect
      .element(page.getByRole("dialog", { name: "Model Selector" }))
      .toBeVisible()
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything())

    await userEvent.keyboard("{Escape}")
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" })
    )
    await expect.poll(() => document.activeElement).toBe(trigger.element())
  })

  it("closes on an outside press and reports the reason", async () => {
    const onOpenChange = vi.fn()
    await openPicker(<Picker items={items} onOpenChange={onOpenChange} />)
    const overlay = document.querySelector<HTMLElement>(
      '[data-slot="dialog-overlay"]'
    )
    expect(overlay).not.toBeNull()
    if (!overlay) return

    await userEvent.click(page.elementLocator(overlay), {
      position: { x: 4, y: 4 },
    })
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "outside-press" })
    )
  })
})

describe("ModelSelectorTrigger", () => {
  it("renders trigger button with children", async () => {
    const screen = await render(
      <main>
        <ModelSelector>
          <ModelSelectorTrigger>Select a model</ModelSelectorTrigger>
        </ModelSelector>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Select a model" }))
      .toBeVisible()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <ModelSelector>
          <ModelSelectorTrigger className="custom-trigger">
            Select
          </ModelSelectorTrigger>
        </ModelSelector>
      </main>
    )
    expect(screen.getByText("Select").element()).toHaveClass("custom-trigger")
  })

  it("can be disabled", async () => {
    const screen = await render(
      <main>
        <ModelSelector>
          <ModelSelectorTrigger disabled>Select</ModelSelectorTrigger>
        </ModelSelector>
      </main>
    )
    await expect.element(screen.getByText("Select")).toBeDisabled()
  })

  it("composes a custom element through render", async () => {
    const screen = await render(
      <main>
        <ModelSelector>
          <ModelSelectorTrigger render={<Button variant="outline" />}>
            Select
          </ModelSelectorTrigger>
        </ModelSelector>
      </main>
    )
    const trigger = screen.getByRole("button", { name: "Select" }).element()
    expect(trigger).toHaveClass("bg-background", "border-border")
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
  })
})

describe("ModelSelectorContent", () => {
  it("renders content with Command wrapper", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <div data-testid="content-child">Content</div>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const child = page.getByTestId("content-child")
    await expect.element(child).toBeVisible()
    expect(child.element().closest('[data-slot="command"]')).not.toBeNull()
  })

  it("names the dialog Model Selector by default and accepts a custom title", async () => {
    const ui = (title?: string) => (
      <main>
        <ModelSelector open>
          <ModelSelectorContent {...(title && { title })}>
            <div>Content</div>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const screen = await render(ui())
    await expect
      .element(page.getByRole("dialog", { name: "Model Selector" }))
      .toBeVisible()

    await screen.rerender(ui("Choose a model"))
    await expect
      .element(page.getByRole("dialog", { name: "Choose a model" }))
      .toBeVisible()
  })

  it("merges custom className with default", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent className="custom-content">
            <div data-testid="inner-content">Content</div>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const dialog = page.getByRole("dialog")
    await expect.element(dialog).toBeVisible()
    expect(dialog.element()).toHaveClass("p-0", "custom-content")
  })

  it("focuses the search input on open unless initialFocus says otherwise", async () => {
    const first = await openPicker(<Picker items={items} />)
    await expect.poll(() => document.activeElement).toBe(first.input.element())
    await first.screen.unmount()

    const second = await openPicker(
      <Picker initialFocus={false} items={items} />
    )
    expect(document.activeElement).not.toBe(second.input.element())
  })

  it("filters by whole terms instead of scattered letters", async () => {
    const { input } = await openPicker(<Picker items={anthropic} />)
    const opus = page.getByRole("option", { name: "Claude Opus 4" })
    const sonnet = page.getByRole("option", { name: "Claude Sonnet 4" })

    await userEvent.fill(input, "opus")
    await expect.element(opus).toBeVisible()
    await expect.element(sonnet).not.toBeInTheDocument()

    await userEvent.fill(input, "4  CLAUDE")
    await expect.element(opus).toBeVisible()
    await expect.element(sonnet).toBeVisible()

    await userEvent.fill(input, "claude 5")
    await expect.element(opus).not.toBeInTheDocument()
    await expect.element(sonnet).not.toBeInTheDocument()
    await expect.element(page.getByText("No models found.")).toBeVisible()
  })

  it("matches item keywords", async () => {
    const { input } = await openPicker(
      <Picker
        items={[
          {
            id: "google/gemini-2.5-flash-image",
            name: "Gemini 2.5 Flash Image",
            keywords: ["Nano Banana"],
          },
          ...anthropic,
        ]}
      />
    )
    await userEvent.fill(input, "banana")
    await expect
      .element(page.getByRole("option", { name: "Gemini 2.5 Flash Image" }))
      .toBeVisible()
    await expect
      .element(page.getByRole("option", { name: "Claude Opus 4" }))
      .not.toBeInTheDocument()
  })

  it("accepts a custom filter", async () => {
    const filter = vi.fn(() => 1)
    const { input } = await openPicker(
      <Picker filter={filter} items={anthropic} />
    )
    await userEvent.fill(input, "zzz")
    await expect
      .element(page.getByRole("option", { name: "Claude Opus 4" }))
      .toBeVisible()
    await expect
      .element(page.getByRole("option", { name: "Claude Sonnet 4" }))
      .toBeVisible()
    expect(filter).toHaveBeenCalledWith(
      "anthropic/claude-opus-4",
      "zzz",
      expect.any(Array)
    )
  })

  it("leaves items alone with shouldFilter={false}", async () => {
    const { input } = await openPicker(
      <Picker items={anthropic} shouldFilter={false} />
    )
    await userEvent.fill(input, "zzz")
    await expect
      .element(page.getByRole("option", { name: "Claude Opus 4" }))
      .toBeVisible()
    await expect
      .element(page.getByText("No models found."))
      .not.toBeInTheDocument()
  })
})

describe("ModelSelectorDialog", () => {
  it("renders as CommandDialog with an accessible name", async () => {
    await render(
      <main>
        <ModelSelectorDialog open>
          <div>Dialog Content</div>
        </ModelSelectorDialog>
      </main>
    )
    await expect.element(page.getByText("Dialog Content")).toBeVisible()
    await expect
      .element(page.getByRole("dialog", { name: "Command Palette" }))
      .toBeVisible()
  })

  it("handles open state", async () => {
    const ui = (open: boolean) => (
      <main>
        <ModelSelectorDialog open={open} title="Models">
          <div>Dialog Content</div>
        </ModelSelectorDialog>
      </main>
    )
    const screen = await render(ui(false))
    await expect
      .element(page.getByText("Dialog Content"))
      .not.toBeInTheDocument()

    await screen.rerender(ui(true))
    await expect.element(page.getByText("Dialog Content")).toBeVisible()
    await expect
      .element(page.getByRole("dialog", { name: "Models" }))
      .toBeVisible()
  })
})

describe("ModelSelectorInput", () => {
  it("renders search input", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorInput placeholder="Search models..." />
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await expect
      .element(page.getByPlaceholder("Search models..."))
      .toBeVisible()
  })

  it("applies custom height styling", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorInput className="custom-input" placeholder="Search" />
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const input = page.getByPlaceholder("Search")
    await expect.element(input).toBeVisible()
    expect(input.element()).toHaveClass("h-auto", "py-3.5", "custom-input")
    const group = input.element().closest('[data-slot="input-group"]')
    expect(group).not.toBeNull()
    // The base-nova InputGroup forces h-8 (32px); the content override lets
    // the py-3.5 input grow past it.
    expect(group?.getBoundingClientRect().height ?? 0).toBeGreaterThan(32)
  })

  it("handles user input", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorInput placeholder="Search models..." />
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const input = page.getByPlaceholder("Search models...")
    await userEvent.fill(input, "gpt-4")
    await expect.element(input).toHaveValue("gpt-4")
  })
})

describe("ModelSelectorList", () => {
  it("renders list container", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList className="custom-list">
              <div data-testid="list-content">Items</div>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const content = page.getByTestId("list-content")
    await expect.element(content).toBeVisible()
    const list = content.element().closest('[role="listbox"]')
    expect(list).toHaveClass("custom-list")
  })

  it("renders the empty state outside the listbox in a polite live region", async () => {
    await openPicker(<Picker items={[]} />)
    const empty = page.getByText("No models found.")
    await expect.element(empty).toBeVisible()
    const element = empty.element()
    expect(element.closest('[role="listbox"]')).toBeNull()
    expect(element.parentElement).toHaveAttribute("aria-live", "polite")
    expect(element.parentElement?.previousElementSibling).toHaveAttribute(
      "role",
      "listbox"
    )
  })
})

describe("ModelSelectorEmpty", () => {
  it("renders empty state message", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorEmpty>No models found</ModelSelectorEmpty>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await expect.element(page.getByText("No models found")).toBeVisible()
  })

  it("shows when the search matches nothing and passes axe", async () => {
    const { input } = await openPicker(<Picker items={items} />)
    await expect
      .element(page.getByText("No models found."))
      .not.toBeInTheDocument()

    await userEvent.fill(input, "zzz")
    await expect.element(page.getByText("No models found.")).toBeVisible()
    await expect
      .element(page.getByRole("option", { name: "GPT-4o" }))
      .not.toBeInTheDocument()
    await expectNoViolations()

    await userEvent.fill(input, "sonnet")
    await expect
      .element(page.getByRole("option", { name: "Claude Sonnet 4" }))
      .toBeVisible()
    await expect
      .element(page.getByText("No models found."))
      .not.toBeInTheDocument()
  })

  it("shows with no items at all and passes axe", async () => {
    await openPicker(<Picker items={[]} />)
    await expect.element(page.getByText("No models found.")).toBeVisible()
    await expectNoViolations()
  })

  it("renders in place when used outside ModelSelectorList", async () => {
    await openPicker(<Picker emptyOutsideList items={[]} />)
    const empty = page.getByText("No models found.")
    await expect.element(empty).toBeVisible()
    expect(
      empty.element().closest('[data-slot="model-selector-empty"]')
    ).toBeNull()
    await expectNoViolations()
  })
})

describe("ModelSelectorGroup", () => {
  it("renders group with heading", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorGroup heading="Popular Models">
                <ModelSelectorItem value="a">Model A</ModelSelectorItem>
              </ModelSelectorGroup>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await expect.element(page.getByText("Popular Models")).toBeVisible()
    await expect
      .element(page.getByRole("group", { name: "Popular Models" }))
      .toBeVisible()
  })

  it("renders group children", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorGroup heading="Models">
                <div data-testid="group-content">Content</div>
              </ModelSelectorGroup>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await expect.element(page.getByTestId("group-content")).toBeVisible()
  })
})

describe("ModelSelectorItem", () => {
  it("renders selectable item", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorItem value="gpt-4">GPT-4</ModelSelectorItem>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await expect
      .element(page.getByRole("option", { name: "GPT-4" }))
      .toBeVisible()
  })

  it("handles click events", async () => {
    const handleSelect = vi.fn()
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorItem onSelect={handleSelect} value="gpt-4">
                GPT-4
              </ModelSelectorItem>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await userEvent.click(page.getByText("GPT-4"))
    await vi.waitFor(() => expect(handleSelect).toHaveBeenCalledWith("gpt-4"))
  })

  it("can be disabled", async () => {
    const handleSelect = vi.fn()
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorItem disabled onSelect={handleSelect} value="gpt-4">
                GPT-4
              </ModelSelectorItem>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const item = page.getByRole("option", { name: "GPT-4" })
    await expect.element(item).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(item, { force: true })
    expect(handleSelect).not.toHaveBeenCalled()
  })

  it("receives the value unchanged and follows ArrowDown, Enter and click", async () => {
    const onSelect = vi.fn()
    const { screen } = await openPicker(
      <Picker items={items} onSelect={onSelect} />
    )
    const first = page.getByRole("option", { name: "GPT-4o" })
    const second = page.getByRole("option", { name: "Claude Sonnet 4" })
    await expect.element(first).toHaveAttribute("aria-selected", "true")
    await userEvent.keyboard("{ArrowDown}")
    await expect.element(second).toHaveAttribute("aria-selected", "true")
    await expect.element(first).toHaveAttribute("aria-selected", "false")
    await userEvent.keyboard("{Enter}")
    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith("anthropic/claude-sonnet-4")
    )
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Pick a model" }))
    await userEvent.click(page.getByRole("option", { name: "GPT-4o" }))
    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenLastCalledWith("OpenAI/GPT-4o")
    )
  })
})

describe("ModelSelectorShortcut", () => {
  it("renders keyboard shortcut", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorItem value="gpt-4">
                GPT-4
                <ModelSelectorShortcut className="custom">
                  ⌘K
                </ModelSelectorShortcut>
              </ModelSelectorItem>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    const shortcut = page.getByText("⌘K")
    await expect.element(shortcut).toBeVisible()
    expect(shortcut.element()).toHaveAttribute("data-slot", "command-shortcut")
    expect(shortcut.element()).toHaveClass("custom")
  })
})

describe("ModelSelectorSeparator", () => {
  it("renders a decorative separator between items and hides it while searching", async () => {
    await render(
      <main>
        <ModelSelector open>
          <ModelSelectorContent>
            <ModelSelectorInput placeholder="Search" />
            <ModelSelectorList>
              <ModelSelectorItem value="item-1">Item 1</ModelSelectorItem>
              <ModelSelectorSeparator className="custom" />
              <ModelSelectorItem value="item-2">Item 2</ModelSelectorItem>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )
    await expect.element(page.getByText("Item 1")).toBeVisible()
    await expect.element(page.getByText("Item 2")).toBeVisible()
    const find = () =>
      document.querySelector<HTMLElement>('[data-slot="command-separator"]')
    const separator = find()
    expect(separator).toHaveClass("custom")
    expect(separator?.closest('[aria-hidden="true"]')).not.toBeNull()
    await expect.element(page.getByRole("separator")).not.toBeInTheDocument()
    await expectNoViolations()

    await userEvent.fill(page.getByPlaceholder("Search"), "item")
    await expect.poll(find).toBeNull()
  })
})

describe("ModelSelectorLogo", () => {
  // A same-origin path would 404 on the test server and fire a real `error`;
  // a data URI loads without a request.
  const svg = (id: string) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" data-id="${id}"/>`
    )}`

  const logo = (container: HTMLElement) => {
    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    return img as HTMLImageElement
  }

  it("renders a decorative logo image with the models.dev source", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogo provider="openai" />
      </main>
    )
    const img = logo(screen.container)
    expect(img).toHaveAttribute("src", "https://models.dev/logos/openai.svg")
    expect(img).toHaveAttribute("width", "12")
    expect(img).toHaveAttribute("height", "12")
    expect(img).toHaveAttribute("alt", "")
    expect(img).toHaveAttribute("aria-hidden", "true")
  })

  it("applies default size class", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogo provider="anthropic" />
      </main>
    )
    expect(logo(screen.container)).toHaveClass("size-3", "dark:invert")
  })

  it("accepts custom className", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogo className="custom-logo-size" provider="google" />
      </main>
    )
    expect(logo(screen.container)).toHaveClass("custom-logo-size")
  })

  it("supports all known providers", async () => {
    const providers = [
      "openai",
      "anthropic",
      "google",
      "mistral",
      "groq",
      "perplexity",
    ]
    const screen = await render(
      <main>
        {providers.map((provider) => (
          <ModelSelectorLogo
            data-testid={provider}
            key={provider}
            provider={provider}
          />
        ))}
      </main>
    )
    for (const provider of providers) {
      expect(screen.getByTestId(provider).element()).toHaveAttribute(
        "src",
        `https://models.dev/logos/${provider}.svg`
      )
    }
  })

  it("supports custom string providers", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogo provider="custom-provider" />
      </main>
    )
    expect(logo(screen.container)).toHaveAttribute(
      "src",
      "https://models.dev/logos/custom-provider.svg"
    )
  })

  it("accepts additional img props", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogo loading="lazy" provider="openai" />
      </main>
    )
    expect(logo(screen.container)).toHaveAttribute("loading", "lazy")
  })

  it("becomes an accessible image when alt is given", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogo alt="OpenAI" provider="openai" />
      </main>
    )
    const img = logo(screen.container)
    expect(img).toHaveAttribute("alt", "OpenAI")
    expect(img).not.toHaveAttribute("aria-hidden")
    await expect
      .element(screen.getByRole("img", { name: "OpenAI" }))
      .toBeInTheDocument()
  })

  it("hides itself when the provider has no logo and still calls onError", async () => {
    const onError = vi.fn()
    const screen = await render(
      <main>
        <ModelSelectorLogo onError={onError} provider="no-such-provider" />
      </main>
    )
    const img = logo(screen.container)
    img.dispatchEvent(new Event("error"))
    await expect.poll(() => img.hidden).toBe(true)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(getComputedStyle(img).display).toBe("none")
  })

  it("loads a custom src instead of the models.dev URL", async () => {
    const local = svg("openai")
    const screen = await render(
      <main>
        <ModelSelectorLogo provider="openai" src={local} />
      </main>
    )
    const img = logo(screen.container)
    expect(img).toHaveAttribute("src", local)
    expect(img.getAttribute("src")).not.toContain("models.dev")
    expect(img).toHaveAttribute("alt", "")
    expect(img).toHaveClass("size-3", "dark:invert")
  })

  it("hides a custom src that fails and shows it again once the src changes", async () => {
    const onError = vi.fn()
    const ui = (src: string) => (
      <main>
        <ModelSelectorLogo onError={onError} provider="openai" src={src} />
      </main>
    )
    const screen = await render(ui(svg("missing")))
    const img = logo(screen.container)
    img.dispatchEvent(new Event("error"))
    await expect.poll(() => img.hidden).toBe(true)
    expect(onError).toHaveBeenCalledTimes(1)

    await screen.rerender(ui(svg("present")))
    expect(img.hidden).toBe(false)
    expect(img).toHaveAttribute("src", svg("present"))
  })

  it("keeps option and trigger names to the model name", async () => {
    // The role queries prove the name; the attribute checks prove it does not
    // depend on whether the logo request succeeded in this environment.
    const decorative = (root: Element) => {
      const img = root.querySelector("img")
      expect(img).toHaveAttribute("alt", "")
      expect(img).toHaveAttribute("aria-hidden", "true")
    }
    const screen = await render(<Demo />)
    const trigger = screen.getByRole("button", { exact: true, name: "GPT-4o" })
    decorative(trigger.element())
    await userEvent.click(trigger)
    const option = page.getByRole("option", { exact: true, name: "GPT-4o" })
    await expect.element(option).toBeVisible()
    decorative(option.element())
    await expect
      .element(
        page.getByRole("option", { exact: true, name: "Claude Sonnet 4" })
      )
      .toBeVisible()
  })
})

describe("ModelSelectorLogoGroup", () => {
  it("renders multiple logos in a group", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogoGroup>
          <ModelSelectorLogo provider="openai" />
          <ModelSelectorLogo provider="anthropic" />
          <ModelSelectorLogo provider="google" />
        </ModelSelectorLogoGroup>
      </main>
    )
    const sources = [...screen.container.querySelectorAll("img")].map((img) =>
      img.getAttribute("src")
    )
    expect(sources).toEqual([
      "https://models.dev/logos/openai.svg",
      "https://models.dev/logos/anthropic.svg",
      "https://models.dev/logos/google.svg",
    ])
  })

  it("applies styling classes for logo group", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogoGroup data-testid="group">
          <ModelSelectorLogo provider="openai" />
        </ModelSelectorLogoGroup>
      </main>
    )
    expect(screen.getByTestId("group").element()).toHaveClass(
      "-space-x-1",
      "flex",
      "shrink-0"
    )
  })

  it("accepts custom className", async () => {
    const screen = await render(
      <main>
        <ModelSelectorLogoGroup className="custom-group" data-testid="group">
          <ModelSelectorLogo provider="openai" />
        </ModelSelectorLogoGroup>
      </main>
    )
    expect(screen.getByTestId("group").element()).toHaveClass("custom-group")
  })
})

describe("ModelSelectorName", () => {
  it("renders model name text", async () => {
    const screen = await render(
      <main>
        <ModelSelectorName>GPT-4 Turbo</ModelSelectorName>
      </main>
    )
    await expect.element(screen.getByText("GPT-4 Turbo")).toBeVisible()
  })

  it("applies text styling classes", async () => {
    const screen = await render(
      <main>
        <ModelSelectorName>Model Name</ModelSelectorName>
      </main>
    )
    expect(screen.getByText("Model Name").element()).toHaveClass(
      "flex-1",
      "truncate",
      "text-left"
    )
  })

  it("accepts custom className", async () => {
    const screen = await render(
      <main>
        <ModelSelectorName className="custom-name">Model</ModelSelectorName>
      </main>
    )
    expect(screen.getByText("Model").element()).toHaveClass("custom-name")
  })

  it("truncates long text", async () => {
    const longName = "A very long model name that should be truncated"
    const screen = await render(
      <main>
        <ModelSelectorName>{longName}</ModelSelectorName>
      </main>
    )
    expect(screen.getByText(longName).element()).toHaveClass("truncate")
  })
})

const renderCompleteModelSelector = () =>
  render(
    <main>
      <ModelSelector open>
        <ModelSelectorTrigger>Select Model</ModelSelectorTrigger>
        <ModelSelectorContent>
          <ModelSelectorInput placeholder="Search models..." />
          <ModelSelectorList>
            <ModelSelectorGroup heading="OpenAI">
              <ModelSelectorItem value="gpt-4">
                <ModelSelectorLogoGroup>
                  <ModelSelectorLogo provider="openai" />
                </ModelSelectorLogoGroup>
                <ModelSelectorName>GPT-4</ModelSelectorName>
                <ModelSelectorShortcut>⌘1</ModelSelectorShortcut>
              </ModelSelectorItem>
            </ModelSelectorGroup>
            <ModelSelectorSeparator />
            <ModelSelectorGroup heading="Anthropic">
              <ModelSelectorItem value="claude">
                <ModelSelectorLogoGroup>
                  <ModelSelectorLogo provider="anthropic" />
                </ModelSelectorLogoGroup>
                <ModelSelectorName>Claude</ModelSelectorName>
              </ModelSelectorItem>
            </ModelSelectorGroup>
            <ModelSelectorEmpty>No models found</ModelSelectorEmpty>
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
    </main>
  )

describe("integration tests", () => {
  it("renders search input and OpenAI group", async () => {
    await renderCompleteModelSelector()
    await expect
      .element(page.getByPlaceholder("Search models..."))
      .toBeVisible()
    await expect.element(page.getByText("OpenAI")).toBeVisible()
    await expect.element(page.getByText("GPT-4")).toBeVisible()
  })

  it("renders shortcuts and Anthropic group", async () => {
    await renderCompleteModelSelector()
    await expect.element(page.getByText("⌘1")).toBeVisible()
    await expect.element(page.getByText("Anthropic")).toBeVisible()
    await expect.element(page.getByText("Claude")).toBeVisible()
    await expectNoViolations()
  })

  it("handles model selection flow", async () => {
    const handleSelect = vi.fn()
    const handleOpenChange = vi.fn()
    const screen = await render(
      <main>
        <ModelSelector onOpenChange={handleOpenChange}>
          <ModelSelectorTrigger>Select Model</ModelSelectorTrigger>
          <ModelSelectorContent>
            <ModelSelectorList>
              <ModelSelectorItem onSelect={handleSelect} value="gpt-4">
                GPT-4
              </ModelSelectorItem>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </main>
    )

    await userEvent.click(screen.getByText("Select Model"))
    await expect.element(page.getByText("GPT-4")).toBeVisible()
    expect(handleOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: "trigger-press" })
    )

    await userEvent.click(page.getByText("GPT-4"))
    await vi.waitFor(() => expect(handleSelect).toHaveBeenCalledWith("gpt-4"))
  })

  it("opens from a button and selects a model", async () => {
    const screen = await render(<Demo />)

    const trigger = screen.getByRole("button", { name: "GPT-4o" })
    await expect.element(trigger).toBeVisible()
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    await expectNoViolations()

    await userEvent.click(trigger)

    await expect.element(page.getByRole("dialog")).toBeVisible()
    await expect
      .element(page.getByPlaceholder("Search models..."))
      .toBeVisible()
    const option = page.getByRole("option", { name: "Claude Sonnet 4" })
    await expect.element(option).toBeVisible()
    await expectNoViolations()

    await userEvent.click(option)

    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    await expect
      .element(screen.getByRole("button", { name: "Claude Sonnet 4" }))
      .toBeVisible()
  })

  it("passes axe in dark mode with the dialog open", async () => {
    await withDark(async () => {
      const screen = await render(<Demo />)
      await userEvent.click(screen.getByRole("button", { name: "GPT-4o" }))
      await expect
        .element(page.getByRole("option", { name: "Claude Sonnet 4" }))
        .toBeVisible()
      await expectNoViolations()
    })
  })
})

// The docs preview: groups wrapped in plain divs with separators between
// them, a shortcut, and logos passed through `src`.
describe("preview composition", () => {
  const openPreview = async () => {
    const screen = await render(
      <main>
        <ModelSelectorDemo />
      </main>
    )
    await userEvent.click(screen.getByRole("button", { name: "GPT-4o" }))
    const input = page.getByPlaceholder("Search models...")
    await expect.element(input).toBeVisible()
    return { screen, input }
  }

  it("requests no logo from models.dev", async () => {
    const { screen } = await openPreview()
    await expect
      .element(page.getByRole("option", { name: "Gemini 2.5 Pro" }))
      .toBeVisible()
    const images = [
      ...screen.container.querySelectorAll("img"),
      ...document.querySelectorAll<HTMLImageElement>('[role="dialog"] img'),
    ]
    expect(images.length).toBeGreaterThanOrEqual(9)
    for (const img of images) {
      const src = img.getAttribute("src") ?? ""
      expect(src).toMatch(/^data:image\/svg\+xml,/)
      expect(src).not.toContain("models.dev")
      expect(img.hidden).toBe(false)
      expect(img).toHaveAttribute("alt", "")
    }
    await expect.poll(() => images.every((img) => img.complete)).toBe(true)
    expect(images.every((img) => img.naturalWidth > 0)).toBe(true)
  })

  it("passes axe open, filtered to one group and filtered to none", async () => {
    const { input } = await openPreview()
    await expect
      .element(page.getByRole("option", { name: "Gemini 2.5 Pro" }))
      .toBeVisible()
    await expectNoViolations()

    await userEvent.fill(input, "anthropic")
    // The shortcut is part of the option's accessible name ("Claude Sonnet 4⌘1").
    await expect
      .element(page.getByRole("option", { name: /Claude Sonnet 4/ }))
      .toBeVisible()
    await expect
      .element(page.getByRole("option", { name: "GPT-4o" }))
      .not.toBeInTheDocument()
    await expectNoViolations()

    await userEvent.fill(input, "mistral")
    await expect.element(page.getByText("No models found.")).toBeVisible()
    await expectNoViolations()
  })

  it("keeps one empty-state node while the query keeps changing", async () => {
    const { input } = await openPreview()
    await userEvent.fill(input, "zz")
    const empty = page.getByText("No models found.")
    await expect.element(empty).toBeVisible()
    const node = empty.element()
    const region = node.parentElement as HTMLElement
    expect(region).toHaveAttribute("aria-live", "polite")

    await userEvent.fill(input, "zzz")
    await userEvent.fill(input, "zzzz")
    await expect.element(page.getByText("No models found.")).toBeVisible()
    expect(page.getByText("No models found.").element()).toBe(node)
    expect(region.childElementCount).toBe(1)
  })

  it("treats a whitespace-only query as no query", async () => {
    const { input } = await openPreview()
    await userEvent.fill(input, "   ")
    for (const name of [/^GPT-4o$/, /Claude Sonnet 4/, /Gemini 2.5 Pro/]) {
      await expect.element(page.getByRole("option", { name })).toBeVisible()
    }
    await expect
      .element(page.getByText("No models found."))
      .not.toBeInTheDocument()
  })

  it("selects a model from the keyboard and updates the trigger", async () => {
    const { screen } = await openPreview()
    await userEvent.fill(page.getByPlaceholder("Search models..."), "opus")
    await expect
      .element(page.getByRole("option", { name: "Claude Opus 4" }))
      .toBeVisible()
    await userEvent.keyboard("{Enter}")
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    await expect
      .element(screen.getByRole("button", { name: "Claude Opus 4" }))
      .toBeVisible()
    expect(screen.container.textContent).toContain("anthropic/claude-opus-4")
  })
})
