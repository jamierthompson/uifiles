import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/registry/ai/sources"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("sources", () => {
  it("renders children", async () => {
    const screen = await render(
      <main>
        <Sources>Content</Sources>
      </main>
    )
    await expect.element(screen.getByText("Content")).toBeVisible()
  })

  it("applies custom className", async () => {
    await render(
      <main>
        <Sources className="custom">Test</Sources>
      </main>
    )
    const root = document.querySelector("[data-slot='collapsible']")
    expect(root?.className).toContain("custom")
    expect(root?.className).toContain("not-prose")
  })

  it("expands to reveal the source links", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={2} />
          <SourcesContent>
            <Source href="https://ai-sdk.dev/docs" title="AI SDK docs" />
            <Source href="https://base-ui.com" title="Base UI" />
          </SourcesContent>
        </Sources>
      </main>
    )

    const trigger = screen.getByRole("button", { name: "Used 2 sources" })
    await expect.element(trigger).toBeVisible()
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    await expect
      .element(screen.getByRole("link", { name: "AI SDK docs" }))
      .not.toBeInTheDocument()
    await expectNoViolations()

    await userEvent.click(trigger)

    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    const link = screen.getByRole("link", { name: "AI SDK docs" })
    await expect.element(link).toBeVisible()
    await expect
      .element(link)
      .toHaveAttribute("href", "https://ai-sdk.dev/docs")
    await expect
      .element(screen.getByRole("link", { name: "Base UI" }))
      .toBeVisible()

    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("opens by default with defaultOpen", async () => {
    const screen = await render(
      <main>
        <Sources defaultOpen>
          <SourcesTrigger count={1} />
          <SourcesContent>
            <Source href="https://example.com" title="Example" />
          </SourcesContent>
        </Sources>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Used 1 source" }))
      .toHaveAttribute("aria-expanded", "true")
    await expect
      .element(screen.getByRole("link", { name: "Example" }))
      .toBeVisible()
  })

  it("follows a controlled open prop and reports toggles through onOpenChange", async () => {
    const onOpenChange = vi.fn()
    const composition = (open: boolean) => (
      <main>
        <Sources onOpenChange={onOpenChange} open={open}>
          <SourcesTrigger count={1} />
          <SourcesContent>
            <Source href="https://example.com" title="Example" />
          </SourcesContent>
        </Sources>
      </main>
    )
    const screen = await render(composition(false))
    const trigger = screen.getByRole("button", { name: "Used 1 source" })

    await userEvent.click(trigger)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("link", { name: "Example" }).query()).toBeNull()

    await screen.rerender(composition(true))
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    await expect
      .element(screen.getByRole("link", { name: "Example" }))
      .toBeVisible()
  })

  it("does not open while disabled and reports the trigger press in eventDetails", async () => {
    const onOpenChange = vi.fn()
    const ui = (disabled: boolean) => (
      <main>
        <Sources disabled={disabled} onOpenChange={onOpenChange}>
          <SourcesTrigger count={1} />
          <SourcesContent>
            <Source href="https://example.com" title="Example" />
          </SourcesContent>
        </Sources>
      </main>
    )
    const screen = await render(ui(true))
    const trigger = screen.getByRole("button", { name: "Used 1 source" })
    await expect.element(trigger).toBeDisabled()
    expect(onOpenChange).not.toHaveBeenCalled()
    await expectNoViolations()

    await screen.rerender(ui(false))
    await expect.element(trigger).toBeEnabled()
    await userEvent.click(trigger)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true)
    expect(onOpenChange.mock.calls[0]?.[1]).toMatchObject({
      reason: "trigger-press",
    })
    await expect
      .element(screen.getByRole("link", { name: "Example" }))
      .toBeVisible()
  })
})

describe("sourcesTrigger", () => {
  it("renders default trigger with count", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={3} />
        </Sources>
      </main>
    )
    await expect.element(screen.getByText("Used 3 sources")).toBeVisible()
  })

  it("pluralises the count", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={1} />
        </Sources>
        <Sources>
          <SourcesTrigger count={0} />
        </Sources>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Used 1 source" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Used 0 sources" }))
      .toBeVisible()
    expect(screen.getByText("Used 1 sources").query()).toBeNull()
  })

  it("renders custom children", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={5}>Custom trigger</SourcesTrigger>
        </Sources>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Custom trigger" }))
      .toBeVisible()
    expect(screen.getByText("Used 5 sources").query()).toBeNull()
  })

  it("has chevron icon", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={2} />
        </Sources>
      </main>
    )
    const button = screen.getByRole("button", { name: "Used 2 sources" })
    await expect.element(button).toBeVisible()
    expect(button.element().querySelector("svg")).not.toBeNull()
  })

  it("is clickable", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={1} />
          <SourcesContent>Hidden</SourcesContent>
        </Sources>
      </main>
    )
    await userEvent.click(screen.getByRole("button"))
    await expect.element(screen.getByText("Hidden")).toBeVisible()
  })

  it("renders a non-submitting button with only phrasing content and a 24px target", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger className="custom" count={2} />
        </Sources>
      </main>
    )
    const button = screen.getByRole("button", { name: "Used 2 sources" })
    await expect.element(button).toHaveAttribute("type", "button")
    const element = button.element()
    expect(element.querySelector("p, div")).toBeNull()
    expect(element.className).toContain("custom")
    expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    await expectNoViolations()
  })
})

describe("sourcesContent", () => {
  it("renders content when open", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={1} />
          <SourcesContent>
            <Source href="https://example.com" title="Example" />
          </SourcesContent>
        </Sources>
      </main>
    )
    await userEvent.click(screen.getByRole("button"))
    await expect.element(screen.getByText("Example")).toBeVisible()
  })

  it("keeps content mounted but hidden with keepMounted", async () => {
    const screen = await render(
      <main>
        <Sources>
          <SourcesTrigger count={1} />
          <SourcesContent keepMounted>
            <Source href="https://example.com" title="Example" />
          </SourcesContent>
        </Sources>
      </main>
    )
    const link = screen.getByRole("link", {
      name: "Example",
      includeHidden: true,
    })
    await expect.element(link).toBeInTheDocument()
    await expect.element(link).not.toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Used 1 source" }))
    await expect.element(link).toBeVisible()
  })

  it("merges className onto the panel", async () => {
    const screen = await render(
      <main>
        <Sources defaultOpen>
          <SourcesTrigger count={1} />
          <SourcesContent className="custom" data-testid="panel">
            <Source href="https://example.com" title="Example" />
          </SourcesContent>
        </Sources>
      </main>
    )
    const panel = screen.getByTestId("panel")
    await expect.element(panel).toBeVisible()
    expect(panel.element().className).toContain("custom")
    expect(panel.element().className).toContain("flex-col")
  })
})

describe("source", () => {
  it("renders source link", async () => {
    const screen = await render(
      <main>
        <Source href="https://example.com" title="Example" />
      </main>
    )
    const link = screen.getByRole("link", { name: "Example" })
    await expect.element(link).toHaveAttribute("href", "https://example.com")
    await expect.element(link).toHaveAttribute("target", "_blank")
    await expect.element(link).toHaveAttribute("rel", "noreferrer noopener")
  })

  it("renders default with icon and title", async () => {
    const screen = await render(
      <main>
        <Source href="https://example.com" title="Example" />
      </main>
    )
    await expect.element(screen.getByText("Example")).toBeVisible()
  })

  it("renders custom children", async () => {
    const screen = await render(
      <main>
        <Source href="https://example.com" title="Example">
          <span>Custom content</span>
        </Source>
      </main>
    )
    await expect
      .element(screen.getByRole("link", { name: "Custom content" }))
      .toBeVisible()
    expect(screen.getByText("Example").query()).toBeNull()
  })

  it("has book icon by default", async () => {
    const screen = await render(
      <main>
        <Source href="https://example.com" title="Example" />
      </main>
    )
    const link = screen.getByRole("link", { name: "Example" })
    await expect.element(link).toBeVisible()
    expect(link.element().querySelector("svg")).not.toBeNull()
  })

  it("labels the link with the hostname when there is no title", async () => {
    const screen = await render(
      <main>
        <Source href="https://developer.mozilla.org/en-US/docs/Web" />
        <Source href="mailto:cite@example.com" />
      </main>
    )
    await expect
      .element(screen.getByRole("link", { name: "developer.mozilla.org" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("link", { name: "mailto:cite@example.com" }))
      .toBeVisible()
  })

  it("labels the link with the hostname when the title is an empty string", async () => {
    const screen = await render(
      <main>
        <Sources defaultOpen>
          <SourcesTrigger count={1} />
          <SourcesContent>
            <Source href="https://example.com/report" title="" />
          </SourcesContent>
        </Sources>
      </main>
    )
    const link = screen.getByRole("link", { name: "example.com" })
    await expect.element(link).toBeVisible()
    expect(link.element().textContent?.trim()).toBe("example.com")
    await expectNoViolations()
  })

  it("falls back to the icon and title when children is an empty string", async () => {
    const screen = await render(
      <main>
        <Source href="https://example.com" title="Example">
          {""}
        </Source>
      </main>
    )
    const link = screen.getByRole("link", { name: "Example" })
    await expect.element(link).toBeVisible()
    expect(link.element().querySelector("svg")).not.toBeNull()
  })

  it("treats a protocol-relative href as external and labels it with the href", async () => {
    const screen = await render(
      <main>
        <Source href="//cdn.example.com/paper.pdf" />
      </main>
    )
    const link = screen.getByRole("link", {
      name: "//cdn.example.com/paper.pdf",
    })
    await expect.element(link).toHaveAttribute("target", "_blank")
    await expect.element(link).toHaveAttribute("rel", "noreferrer noopener")
  })

  it("lets React neutralise a javascript: href from a model-supplied source", async () => {
    // React logs its own warning while it replaces the URL.
    allowConsole("error")
    const screen = await render(
      <main>
        {/* biome-ignore lint/security/noScriptUrl: the test asserts React blocks this URL */}
        <Source href="javascript:window.__pwned = 1" title="Trap" />
      </main>
    )
    const link = screen.getByRole("link", { name: "Trap" })
    await expect.element(link).toBeVisible()
    expect(link.element().getAttribute("href")).toMatch(
      /^javascript:throw new Error\('React has blocked/
    )
    expect(link.element().getAttribute("target")).toBe("_blank")
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it("renders plain text instead of a link when there is no href", async () => {
    const screen = await render(
      <main>
        <Source className="custom" data-testid="source" title="Internal memo" />
      </main>
    )
    await expect.element(screen.getByText("Internal memo")).toBeVisible()
    expect(screen.getByRole("link").query()).toBeNull()
    expect(document.querySelector("a")).toBeNull()
    const element = screen.getByTestId("source").element()
    expect(element.tagName).toBe("SPAN")
    expect(element.hasAttribute("tabindex")).toBe(false)
    expect(element.className).toContain("custom")
    expect(element.querySelector("svg")).not.toBeNull()
    await expectNoViolations()
  })

  it("opens relative links in the same tab", async () => {
    const screen = await render(
      <main>
        <Source href="/docs/cache" title="Cache docs" />
      </main>
    )
    const link = screen.getByRole("link", { name: "Cache docs" })
    await expect.element(link).toHaveAttribute("href", "/docs/cache")
    expect(link.element().hasAttribute("target")).toBe(false)
    expect(link.element().hasAttribute("rel")).toBe(false)
  })

  it("lets props override target and rel and merges className", async () => {
    const screen = await render(
      <main>
        <Source
          className="custom"
          href="https://example.com"
          rel="noopener"
          target="_self"
          title="Example"
        />
      </main>
    )
    const link = screen.getByRole("link", { name: "Example" })
    await expect.element(link).toHaveAttribute("target", "_self")
    await expect.element(link).toHaveAttribute("rel", "noopener")
    expect(link.element().className).toContain("custom")
    expect(link.element().className).toContain("items-center")
  })
})
