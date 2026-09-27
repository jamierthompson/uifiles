import { FlagIcon } from "lucide-react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
} from "@/registry/ai/checkpoint"
import { expectNoViolations, withDark } from "@/tests/a11y"
import "@/app/globals.css"

/** Tab through the page until `target` owns focus (keyboard-only reach). */
async function tabTo(target: Element, max = 8) {
  for (let i = 0; i < max; i += 1) {
    await userEvent.tab()
    if (document.activeElement === target) return
  }
  throw new Error("could not reach the target with Tab")
}

const TOOLTIP = "[data-slot='tooltip-content']"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Checkpoint", () => {
  it("renders a checkpoint with an always-exposed horizontal separator", async () => {
    const screen = await render(
      <main>
        <Checkpoint className="custom-checkpoint" data-testid="row">
          <CheckpointIcon />
          <CheckpointTrigger>Checkpoint 1</CheckpointTrigger>
        </Checkpoint>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Checkpoint 1" }))
      .toBeVisible()
    const separator = screen.getByRole("separator")
    await expect.element(separator).toBeInTheDocument()
    await expect
      .element(separator)
      .toHaveAttribute("aria-orientation", "horizontal")
    const row = screen.getByTestId("row")
    await expect.element(row).toHaveClass("custom-checkpoint")
    await expect.element(row).toHaveClass("text-muted-foreground")
    // The separator is the last child so it fills the rest of the row.
    expect(row.element().lastElementChild).toBe(separator.element())
    await expectNoViolations()
  })
})

describe("CheckpointIcon", () => {
  it("renders the bookmark and merges className", async () => {
    const screen = await render(
      <Checkpoint>
        <CheckpointIcon className="custom-icon" data-testid="icon" />
        <CheckpointTrigger>Checkpoint</CheckpointTrigger>
      </Checkpoint>
    )
    const icon = screen.getByTestId("icon")
    await expect.element(icon).toHaveClass("lucide-bookmark")
    await expect.element(icon).toHaveClass("custom-icon")
    await expect.element(icon).toHaveClass("shrink-0")
  })

  it("lets children replace the bookmark", async () => {
    const screen = await render(
      <Checkpoint>
        <CheckpointIcon>
          <FlagIcon data-testid="flag" />
        </CheckpointIcon>
        <CheckpointTrigger>Checkpoint</CheckpointTrigger>
      </Checkpoint>
    )
    await expect.element(screen.getByTestId("flag")).toBeInTheDocument()
    expect(document.querySelector(".lucide-bookmark")).toBeNull()
  })
})

describe("CheckpointTrigger", () => {
  it("defaults to a small ghost button and accepts overrides", async () => {
    const screen = await render(
      <>
        <CheckpointTrigger>Default</CheckpointTrigger>
        <CheckpointTrigger
          className="custom-trigger"
          size="lg"
          variant="outline"
        >
          Custom
        </CheckpointTrigger>
      </>
    )
    const plain = screen.getByRole("button", { name: "Default" })
    await expect.element(plain).toHaveAttribute("type", "button")
    await expect.element(plain).toHaveClass("h-7")
    await expect.element(plain).toHaveClass("hover:bg-muted")
    await expect.element(plain).not.toHaveClass("border-border")

    const custom = screen.getByRole("button", { name: "Custom" })
    await expect.element(custom).toHaveClass("h-9")
    await expect.element(custom).toHaveClass("border-border")
    await expect.element(custom).toHaveClass("custom-trigger")
    await expect.element(custom).not.toHaveClass("h-7")
  })

  it("fires onClick once with and without a tooltip", async () => {
    const plain = vi.fn()
    const tipped = vi.fn()
    const screen = await render(
      <main>
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger onClick={plain}>Plain</CheckpointTrigger>
        </Checkpoint>
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger onClick={tipped} tooltip="Restore here">
            Tipped
          </CheckpointTrigger>
        </Checkpoint>
      </main>
    )
    await userEvent.click(screen.getByRole("button", { name: "Plain" }))
    expect(plain).toHaveBeenCalledTimes(1)
    const tippedButton = screen.getByRole("button", { name: "Tipped" })
    expect(tippedButton.element().tagName).toBe("BUTTON")
    await expect.element(tippedButton).toHaveAttribute("type", "button")
    await userEvent.click(tippedButton)
    expect(tipped).toHaveBeenCalledTimes(1)
    expect(plain).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll("[role='separator']")).toHaveLength(2)
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
    expect(document.querySelector(TOOLTIP)).toBeNull()
    await userEvent.hover(trigger)
    // The tooltip text also lives in the sr-only description, so the popup
    // is located by its slot rather than by text.
    await expect
      .poll(() => document.querySelector(TOOLTIP)?.textContent)
      .toBe("Restore to this point")
    const popup = document.querySelector(TOOLTIP) as HTMLElement
    await expect.element(page.elementLocator(popup)).toBeVisible()
    // The popup is portaled to <body>, outside the fixture's landmark, so the
    // page run leaves the portal out and a second run covers the popup itself.
    let portal: HTMLElement = popup
    while (portal.parentElement && portal.parentElement !== document.body) {
      portal = portal.parentElement
    }
    await expectNoViolations({ include: [document.body], exclude: [portal] })
    await expectNoViolations(popup)
  })

  // The console guard in tests/setup.ts fails this test if Base UI warns
  // about the missing provider.
  it("opens the tooltip on keyboard focus without a TooltipProvider", async () => {
    const screen = await render(
      <main>
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger tooltip="Restore here">Tipped</CheckpointTrigger>
        </Checkpoint>
      </main>
    )
    expect(document.querySelector("[data-slot='tooltip-provider']")).toBeNull()
    const trigger = screen.getByRole("button", { name: "Tipped" })
    await tabTo(trigger.element())
    await expect
      .poll(() => document.querySelector(TOOLTIP)?.textContent)
      .toBe("Restore here")
    await expect
      .element(page.elementLocator(document.querySelector(TOOLTIP) as Element))
      .toBeVisible()
  })

  it("exposes the tooltip text as the accessible description before it opens", async () => {
    const screen = await render(
      <main>
        <p>Turn 4</p>
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger tooltip="Restore the workspace to this point">
            Checkpoint 4
          </CheckpointTrigger>
        </Checkpoint>
      </main>
    )
    // Park the pointer away from where an earlier test may have left it, so
    // the tooltip is provably closed while the description is read.
    await userEvent.hover(screen.getByText("Turn 4"))
    const trigger = screen.getByRole("button", { name: "Checkpoint 4" })
    await expect.element(trigger).toBeVisible()
    await expect.poll(() => document.querySelector(TOOLTIP)).toBeNull()
    const describedBy = trigger.element().getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const description = document.getElementById(describedBy ?? "")
    expect(description?.textContent).toBe("Restore the workspace to this point")
    // The mirror is for assistive technology only; the visible tooltip stays
    // the one Base UI opens on hover and focus.
    expect(description?.classList.contains("sr-only")).toBe(true)
    expect(
      screen.getByText("Restore the workspace to this point").elements()
    ).toHaveLength(1)
    await expectNoViolations()
  })

  it("adds no description when the tooltip only repeats the button's name", async () => {
    const screen = await render(
      <main>
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger tooltip="Checkpoint 5">
            Checkpoint 5
          </CheckpointTrigger>
        </Checkpoint>
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger aria-label="Restore here" tooltip="Restore here">
            <FlagIcon />
          </CheckpointTrigger>
        </Checkpoint>
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger>Untipped</CheckpointTrigger>
        </Checkpoint>
      </main>
    )
    for (const name of ["Checkpoint 5", "Restore here", "Untipped"]) {
      const trigger = screen.getByRole("button", { name })
      await expect.element(trigger).toBeVisible()
      expect(trigger.element().hasAttribute("aria-describedby")).toBe(false)
    }
    expect(document.querySelector(".sr-only")).toBeNull()
  })

  it("adds no description when the tooltip repeats a name its children build from text and numbers", async () => {
    const index = 1
    const screen = await render(
      <main>
        <CheckpointTrigger tooltip="Checkpoint 1">
          Checkpoint {index}
        </CheckpointTrigger>
        <CheckpointTrigger tooltip="Checkpoint 2">
          {/* biome-ignore lint/complexity/noUselessFragments: the name is read through fragments too */}
          <>
            Checkpoint <span>{index + 1}</span>
          </>
        </CheckpointTrigger>
        <CheckpointTrigger aria-label="  " tooltip="Checkpoint   3">
          {"  Checkpoint "}
          {3}
          {false}
        </CheckpointTrigger>
      </main>
    )
    for (const name of ["Checkpoint 1", "Checkpoint 2", "Checkpoint 3"]) {
      const trigger = screen.getByRole("button", { name })
      await expect.element(trigger).toBeVisible()
      expect(trigger.element().hasAttribute("aria-describedby")).toBe(false)
    }
    expect(document.querySelector(".sr-only")).toBeNull()
  })

  it("describes a button whose name is more than the text it can read while rendering", async () => {
    function Latest() {
      return <span>(latest)</span>
    }
    const screen = await render(
      <main>
        <span id="turn">Turn 3</span>
        {/* Named by aria-label; the visible text is the new information. */}
        <CheckpointTrigger aria-label="Restore" tooltip="Checkpoint 1">
          Checkpoint 1
        </CheckpointTrigger>
        {/* A component's output is unknown until it renders. */}
        <CheckpointTrigger tooltip="Checkpoint 2">
          Checkpoint 2 <Latest />
        </CheckpointTrigger>
        <CheckpointTrigger aria-labelledby="turn" tooltip="Checkpoint 3">
          Checkpoint 3
        </CheckpointTrigger>
      </main>
    )
    for (const [name, description] of [
      ["Restore", "Checkpoint 1"],
      ["Checkpoint 2 (latest)", "Checkpoint 2"],
      ["Turn 3", "Checkpoint 3"],
    ] as const) {
      const trigger = screen.getByRole("button", { name })
      await expect.element(trigger).toBeVisible()
      await expect.element(trigger).toHaveAccessibleDescription(description)
    }
  })

  it("lets a consumer's aria-describedby win over the tooltip mirror", async () => {
    const screen = await render(
      <main>
        <p id="own-description">Restores the files, not the chat.</p>
        <CheckpointTrigger
          aria-describedby="own-description"
          tooltip="Restore the workspace to this point"
        >
          Checkpoint 1
        </CheckpointTrigger>
      </main>
    )
    const trigger = screen.getByRole("button", { name: "Checkpoint 1" })
    await expect.element(trigger).toBeVisible()
    expect(trigger.element().getAttribute("aria-describedby")).toBe(
      "own-description"
    )
    await expect
      .element(trigger)
      .toHaveAccessibleDescription("Restores the files, not the chat.")
    await expectNoViolations()
  })
})

describe("accessibility", () => {
  it("passes axe in dark mode", async () => {
    await withDark(async () => {
      const screen = await render(
        <main>
          <Checkpoint>
            <CheckpointIcon />
            <CheckpointTrigger tooltip="Restore here">
              Checkpoint 3
            </CheckpointTrigger>
          </Checkpoint>
        </main>
      )
      await expect
        .element(screen.getByRole("button", { name: "Checkpoint 3" }))
        .toBeVisible()
      await expectNoViolations()
    })
  })
})
