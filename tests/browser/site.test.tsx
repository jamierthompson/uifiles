import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { CopyButton } from "@/app/_components/copy-button"
import { Demo } from "@/app/_components/demo"
import { InstallCommand } from "@/app/_components/install-command"
import { expectNoViolations, withDark } from "@/tests/a11y"
import "@/app/globals.css"

const original = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "clipboard"
)

/** Replaces `navigator.clipboard.writeText` for one test. */
function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard")
  if (original) {
    Object.defineProperty(Navigator.prototype, "clipboard", original)
  }
})

describe("Demo (app/_components/demo.tsx)", () => {
  it("renders a section headed by its title, with the description and actions beside it, and passes axe in both themes", async () => {
    const screen = await render(
      <main>
        <h1>Reasoning</h1>
        <Demo
          actions={<button type="button">Restart</button>}
          description="Opens itself while the thought streams in."
          title="Streaming"
        >
          <p>the component</p>
        </Demo>
        <Demo title="Finished, collapsed">
          <p>another state</p>
        </Demo>
      </main>
    )
    const heading = screen.getByRole("heading", { level: 2, name: "Streaming" })
    await expect.element(heading).toBeVisible()
    const section = (await heading.element()).closest("section")
    expect(section?.dataset.slot).toBe("demo")
    expect(section?.textContent).toContain(
      "Opens itself while the thought streams in."
    )
    expect(
      section?.querySelector("[data-slot='demo-surface']")?.textContent
    ).toBe("the component")
    await expect
      .element(screen.getByRole("button", { name: "Restart" }))
      .toBeVisible()
    await expect
      .element(
        screen.getByRole("heading", { level: 2, name: "Finished, collapsed" })
      )
      .toBeVisible()
    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("lets a demo drop the surface padding for a block that fills it", async () => {
    const screen = await render(
      <main>
        <h1>Chat</h1>
        <Demo className="p-0" title="Scripted conversation">
          <p>block</p>
        </Demo>
      </main>
    )
    const surface = (await screen.getByText("block").element()).parentElement
    expect(surface?.dataset.slot).toBe("demo-surface")
    expect(getComputedStyle(surface as Element).paddingLeft).toBe("0px")
  })
})

describe("InstallCommand and CopyButton (app/_components)", () => {
  it("shows the command in a wrapping <pre>, copies it on click and announces it, then returns to the copy icon", async () => {
    const writeText = vi.fn(async () => {})
    stubClipboard(writeText)
    const screen = await render(
      <main>
        <h1>uifiles</h1>
        <InstallCommand
          command="pnpm dlx shadcn@latest add @uifiles/button"
          label="Copy the add command"
        />
      </main>
    )
    const pre = document.querySelector("pre")
    expect(pre?.textContent).toBe("pnpm dlx shadcn@latest add @uifiles/button")
    expect(getComputedStyle(pre as Element).whiteSpace).toBe("pre-wrap")
    const button = screen.getByRole("button", { name: "Copy the add command" })
    const status = screen.getByRole("status")
    await expect.element(status).toHaveTextContent("")
    await expectNoViolations()
    await withDark(() => expectNoViolations())

    await userEvent.click(button)
    expect(writeText).toHaveBeenCalledWith(
      "pnpm dlx shadcn@latest add @uifiles/button"
    )
    await expect.element(status).toHaveTextContent("Copied")
    await expect.element(button).toHaveAttribute("data-copied", "")
    // The name stays put: a changing label is not announced, the status is.
    await expect
      .element(screen.getByRole("button", { name: "Copy the add command" }))
      .toBeVisible()
    await expectNoViolations()

    await expect
      .poll(() => (button.element() as HTMLElement).dataset.copied, {
        timeout: 4000,
      })
      .toBeUndefined()
    await expect.element(status).toHaveTextContent("")
  })

  it("restarts the two-second window on a second click instead of ending it early", async () => {
    stubClipboard(async () => {})
    const screen = await render(
      <main>
        <CopyButton label="Copy" text="x" />
      </main>
    )
    const button = screen.getByRole("button", { name: "Copy" })
    await userEvent.click(button)
    await expect.element(button).toHaveAttribute("data-copied", "")
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await userEvent.click(button)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    // 2.4 s after the first click, 1.2 s after the second: still copied.
    expect((button.element() as HTMLElement).dataset.copied).toBe("")
    await expect
      .poll(() => (button.element() as HTMLElement).dataset.copied, {
        timeout: 4000,
      })
      .toBeUndefined()
  })

  it("stays quiet when the clipboard refuses", async () => {
    stubClipboard(async () => {
      throw new Error("denied")
    })
    const screen = await render(
      <main>
        <CopyButton label="Copy" text="x" />
      </main>
    )
    const button = screen.getByRole("button", { name: "Copy" })
    await userEvent.click(button)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect((button.element() as HTMLElement).dataset.copied).toBeUndefined()
    await expect.element(screen.getByRole("status")).toHaveTextContent("")
  })
})
