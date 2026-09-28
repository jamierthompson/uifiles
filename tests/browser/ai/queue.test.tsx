import { CheckIcon, XIcon } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
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
  QueueItemImage,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/registry/ai/queue"
import { expectNoViolations, withDark } from "@/tests/a11y"
import "@/app/globals.css"

/** Tab through the page until `target` owns focus (keyboard-only reach). */
async function tabTo(target: Element, max = 12) {
  for (let i = 0; i < max; i += 1) {
    await userEvent.tab()
    if (document.activeElement === target) return
  }
  throw new Error("could not reach the target with Tab")
}

const rotateOf = (el: Element) => getComputedStyle(el).rotate
const UNROTATED = /^(none|0deg)$/

const STATE_PSEUDO = /:(hover|focus-visible|focus-within|focus)\b/g
const withoutState = (selector: string) => selector.replace(STATE_PSEUDO, "")
const hasState = (selector: string) => withoutState(selector) !== selector

/**
 * Style rules that would apply to `el` inside a media block matching
 * `media`, from every stylesheet on the page (nested media, layers and
 * supports blocks included). State pseudo-classes are ignored when matching
 * so the answer does not depend on where the pointer or focus is. The test
 * browser cannot switch to a coarse pointer, so touch-only rules are proven
 * from the CSSOM.
 */
function rulesUnderMedia(el: Element, media: RegExp): CSSStyleRule[] {
  const found: CSSStyleRule[] = []
  const applies = (rule: CSSStyleRule) => {
    try {
      return el.matches(withoutState(rule.selectorText))
    } catch {
      // A selector matches() cannot parse cannot select the element either.
      return false
    }
  }
  const walk = (rules: CSSRuleList, inside: boolean) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        walk(rule.cssRules, inside || media.test(rule.media.mediaText))
      } else if (rule instanceof CSSStyleRule) {
        if (inside && applies(rule)) found.push(rule)
        walk(rule.cssRules, inside)
      } else if ("cssRules" in rule) {
        walk((rule as CSSGroupingRule).cssRules, inside)
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      // A cross-origin sheet cannot be read and cannot style the fixture.
      continue
    }
    walk(rules, false)
  }
  return found
}

/**
 * sRGB bytes of `fg` painted over an opaque `bg`, so a translucent color is
 * composited the way the page shows it. The canvas accepts oklch() like CSS.
 */
function paintOver(fg: string, bg: string): [number, number, number] {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext("2d", { colorSpace: "srgb" })
  if (!ctx) throw new Error("no 2d canvas context")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillStyle = fg
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/** WCAG contrast ratio of `fg` (possibly translucent) against opaque `bg`. */
function contrast(fg: string, bg: string): number {
  const luminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map((byte) => {
      const c = byte / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
  }
  const over = luminance(paintOver(fg, bg))
  const under = luminance(paintOver(bg, bg))
  const [hi, lo] = over > under ? [over, under] : [under, over]
  return (hi + 0.05) / (lo + 0.05)
}

function Fixture({
  count = 2,
  completed = false,
}: {
  count?: number
  completed?: boolean
}) {
  const ids = Array.from({ length: count }, (_, i) => `task-${i + 1}`)
  return (
    <main>
      <Queue>
        <QueueSection>
          <QueueSectionTrigger>
            <QueueSectionLabel count={count} label="tasks" />
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              {ids.map((id) => (
                <QueueItem key={id}>
                  <div className="flex items-start gap-2">
                    <QueueItemIndicator completed={completed} />
                    <QueueItemContent completed={completed}>
                      {id}
                    </QueueItemContent>
                    <QueueItemActions>
                      <QueueItemAction aria-label={`Complete ${id}`}>
                        <CheckIcon />
                      </QueueItemAction>
                      <QueueItemAction aria-label={`Remove ${id}`}>
                        <XIcon />
                      </QueueItemAction>
                    </QueueItemActions>
                  </div>
                  <QueueItemDescription completed={completed}>
                    {id} description
                  </QueueItemDescription>
                </QueueItem>
              ))}
            </QueueList>
          </QueueSectionContent>
        </QueueSection>
      </Queue>
    </main>
  )
}

/** The text-spacing override WCAG 1.4.12 tests with, scoped to the fixture. */
const TEXT_SPACING =
  "main * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } main p { margin-bottom: 2em !important; }"

const SPACED_TITLE = "Also update the README with the new setting"

function SpacedTitles({ spaced, width }: { spaced: boolean; width: string }) {
  return (
    <main>
      {spaced && <style>{TEXT_SPACING}</style>}
      <div className="text-sm" style={{ width }}>
        <QueueItemContent data-testid="plain">{SPACED_TITLE}</QueueItemContent>
        <QueueItemContent data-testid="titled" title="README: new setting">
          {SPACED_TITLE}
        </QueueItemContent>
        <QueueItemContent data-testid="composed">
          <span>{SPACED_TITLE}</span>
        </QueueItemContent>
      </div>
    </main>
  )
}

describe("Queue", () => {
  it("renders queue container", async () => {
    const screen = await render(<Queue>Content</Queue>)
    await expect.element(screen.getByText("Content")).toBeVisible()
    expect(screen.container.firstElementChild?.tagName).toBe("DIV")
  })

  it("applies custom className", async () => {
    const screen = await render(<Queue className="custom-class">Content</Queue>)
    await expect
      .element(screen.getByText("Content"))
      .toHaveClass("custom-class")
    await expect.element(screen.getByText("Content")).toHaveClass("rounded-xl")
  })
})

describe("QueueItem", () => {
  it("renders list item", async () => {
    const screen = await render(
      <ul>
        <QueueItem>Item content</QueueItem>
      </ul>
    )
    const item = screen.getByText("Item content")
    await expect.element(item).toBeVisible()
    expect(item.element().tagName).toBe("LI")
    await expect.element(item).toHaveClass("group")
  })

  it("applies custom className", async () => {
    const screen = await render(
      <ul>
        <QueueItem className="custom-item">Item</QueueItem>
      </ul>
    )
    await expect.element(screen.getByText("Item")).toHaveClass("custom-item")
  })
})

describe("QueueItemIndicator", () => {
  it("renders indicator", async () => {
    const screen = await render(<QueueItemIndicator data-testid="dot" />)
    const dot = screen.getByTestId("dot")
    await expect.element(dot).toBeInTheDocument()
    await expect.element(dot).toHaveClass("rounded-full")
  })

  it("renders completed state as a filled full-alpha dot", async () => {
    const screen = await render(
      <QueueItemIndicator completed data-testid="dot" />
    )
    const dot = screen.getByTestId("dot")
    await expect.element(dot).toHaveClass("border-muted-foreground")
    await expect.element(dot).toHaveClass("bg-muted-foreground")
    expect(dot.element().className).not.toContain("border-muted-foreground/")
  })

  it("renders pending state as a hollow full-alpha dot", async () => {
    const screen = await render(
      <QueueItemIndicator completed={false} data-testid="dot" />
    )
    const dot = screen.getByTestId("dot")
    await expect.element(dot).toHaveClass("border-muted-foreground")
    await expect.element(dot).not.toHaveClass("bg-muted-foreground")
    expect(dot.element().className).not.toContain("border-muted-foreground/")
    const style = getComputedStyle(dot.element())
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("keeps both dots at 3:1 against the panel, the card and the hovered row in both themes", async () => {
    const screen = await render(
      <main>
        <Queue data-testid="queue">
          <QueueList>
            <QueueItem>
              <div className="flex items-start gap-2">
                <QueueItemIndicator data-testid="pending" />
                <QueueItemContent>Pending task</QueueItemContent>
              </div>
            </QueueItem>
            <QueueItem>
              <div className="flex items-start gap-2">
                <QueueItemIndicator completed data-testid="done" />
                <QueueItemContent completed>Done task</QueueItemContent>
              </div>
            </QueueItem>
          </QueueList>
        </Queue>
      </main>
    )
    const check = (theme: string) => {
      const root = getComputedStyle(document.documentElement)
      const panel = getComputedStyle(
        screen.getByTestId("queue").element()
      ).backgroundColor
      const hovered = root.getPropertyValue("--muted").trim()
      const card = root.getPropertyValue("--card").trim()
      const pending = getComputedStyle(screen.getByTestId("pending").element())
      const done = getComputedStyle(screen.getByTestId("done").element())
      expect(done.backgroundColor).toBe(done.borderTopColor)
      for (const [name, bg] of [
        ["panel", panel],
        ["hovered row", hovered],
        ["card", card],
      ] as const) {
        expect(
          contrast(pending.borderTopColor, bg),
          `${theme}: pending dot vs ${name}`
        ).toBeGreaterThanOrEqual(3)
        expect(
          contrast(done.backgroundColor, bg),
          `${theme}: completed dot vs ${name}`
        ).toBeGreaterThanOrEqual(3)
      }
    }
    check("light")
    await withDark(async () => {
      check("dark")
    })
  })
})

describe("QueueItemContent", () => {
  it("renders content text", async () => {
    const screen = await render(
      <QueueItemContent>Task content</QueueItemContent>
    )
    await expect.element(screen.getByText("Task content")).toBeVisible()
  })

  it("applies completed styling with full-alpha text", async () => {
    const screen = await render(
      <QueueItemContent completed>Done</QueueItemContent>
    )
    const content = screen.getByText("Done")
    await expect.element(content).toHaveClass("line-through")
    await expect.element(content).toHaveClass("text-muted-foreground")
    expect(content.element().className).not.toContain("text-muted-foreground/")
  })

  it("applies pending styling", async () => {
    const screen = await render(
      <QueueItemContent completed={false}>Pending</QueueItemContent>
    )
    const content = screen.getByText("Pending")
    await expect.element(content).toHaveClass("text-muted-foreground")
    await expect.element(content).not.toHaveClass("line-through")
  })

  it("wraps a long title onto a second line before clamping", async () => {
    const title =
      "Wire the settings form to the PATCH route and show a toast on success"
    const screen = await render(
      <div className="w-56">
        <QueueItemContent>{title}</QueueItemContent>
      </div>
    )
    const content = screen.getByText(title).element()
    expect(getComputedStyle(content).webkitLineClamp).toBe("2")
    const lineHeight = Number.parseFloat(getComputedStyle(content).lineHeight)
    const { height } = content.getBoundingClientRect()
    // Two rendered lines: taller than one line, no taller than two.
    expect(height).toBeGreaterThan(lineHeight * 1.5)
    expect(height).toBeLessThanOrEqual(lineHeight * 2 + 1)
  })

  it("clamps whole lines under WCAG 1.4.12 text spacing", async () => {
    const title =
      "Also update the README with the new environment variables and the migration steps for existing installs"
    const screen = await render(
      <main>
        {/* The text-spacing override WCAG 1.4.12 tests with. */}
        <style>
          {
            ".spaced * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }"
          }
        </style>
        <div className="spaced w-56 text-sm">
          <QueueItemContent>{title}</QueueItemContent>
        </div>
      </main>
    )
    const content = screen.getByText(title).element()
    const style = getComputedStyle(content)
    expect(style.letterSpacing).not.toBe("normal")
    const lineHeight = Number.parseFloat(style.lineHeight)
    expect(lineHeight).toBeCloseTo(Number.parseFloat(style.fontSize) * 1.5)
    // Clamped, and the box is exactly two line boxes: no line is cut through.
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight)
    expect(content.getBoundingClientRect().height).toBeCloseTo(
      lineHeight * 2,
      0
    )
  })

  it("shows the whole title in a title attribute when text spacing clamps a title that fit in two lines", async () => {
    const screen = await render(
      <SpacedTitles spaced={false} width="max-content" />
    )
    const plain = screen.getByTestId("plain").element()
    // The column is sized from the one-line width so the title takes two
    // lines at default spacing whatever font the browser falls back to.
    const oneLine = plain.getBoundingClientRect().width
    const width = `${Math.ceil(oneLine / 1.7)}px`
    await screen.rerender(<SpacedTitles spaced={false} width={width} />)
    const lineHeight = Number.parseFloat(getComputedStyle(plain).lineHeight)
    expect(plain.getBoundingClientRect().height).toBeGreaterThan(
      lineHeight * 1.5
    )
    expect(plain.scrollHeight).toBeLessThanOrEqual(plain.clientHeight)

    await screen.rerender(<SpacedTitles spaced width={width} />)
    expect(getComputedStyle(plain).letterSpacing).not.toBe("normal")
    // The wider text needs a third line, which the clamp hides.
    expect(plain.scrollHeight).toBeGreaterThan(plain.clientHeight)
    expect(plain.getAttribute("title")).toBe(SPACED_TITLE)
    // A consumer's title wins; children that are not a string get none.
    expect(screen.getByTestId("titled").element().getAttribute("title")).toBe(
      "README: new setting"
    )
    expect(screen.getByTestId("composed").element().hasAttribute("title")).toBe(
      false
    )
    await expectNoViolations()
  })
})

describe("QueueItemDescription", () => {
  it("renders description", async () => {
    const screen = await render(
      <QueueItemDescription>Description text</QueueItemDescription>
    )
    await expect.element(screen.getByText("Description text")).toBeVisible()
    await expect
      .element(screen.getByText("Description text"))
      .toHaveClass("ml-6")
  })

  it("applies completed styling with full-alpha text", async () => {
    const screen = await render(
      <QueueItemDescription completed>Done description</QueueItemDescription>
    )
    const description = screen.getByText("Done description")
    await expect.element(description).toHaveClass("line-through")
    await expect.element(description).toHaveClass("text-muted-foreground")
    expect(description.element().className).not.toContain(
      "text-muted-foreground/"
    )
  })
})

describe("QueueItemActions", () => {
  it("renders actions container", async () => {
    const screen = await render(
      <QueueItemActions className="custom-actions">Actions</QueueItemActions>
    )
    await expect.element(screen.getByText("Actions")).toBeVisible()
    await expect
      .element(screen.getByText("Actions"))
      .toHaveClass("custom-actions")
  })
})

describe("QueueItemAction", () => {
  it("renders action button", async () => {
    const screen = await render(<QueueItemAction>Click me</QueueItemAction>)
    const button = screen.getByRole("button", { name: "Click me" })
    await expect.element(button).toBeInTheDocument()
    await expect.element(button).toHaveAttribute("type", "button")
  })

  it("calls onClick handler", async () => {
    const handleClick = vi.fn()
    const screen = await render(
      <QueueItemAction onClick={handleClick}>Action</QueueItemAction>
    )
    await userEvent.click(screen.getByRole("button", { name: "Action" }))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it("is hidden at rest and revealed when focused from the keyboard", async () => {
    const screen = await render(<Fixture count={1} />)
    const action = screen
      .getByRole("button", { name: "Complete task-1" })
      .element() as HTMLElement
    expect(getComputedStyle(action).opacity).toBe("0")
    await tabTo(action)
    expect(document.activeElement).toBe(action)
    await expect.poll(() => getComputedStyle(action).opacity).toBe("1")
  })

  it("reveals every action in the row while one of them has focus", async () => {
    const screen = await render(<Fixture count={1} />)
    const complete = screen
      .getByRole("button", { name: "Complete task-1" })
      .element() as HTMLElement
    const remove = screen
      .getByRole("button", { name: "Remove task-1" })
      .element() as HTMLElement
    await tabTo(complete)
    await expect.poll(() => getComputedStyle(remove).opacity).toBe("1")
    await userEvent.tab()
    expect(document.activeElement).toBe(remove)
    await expect.poll(() => getComputedStyle(complete).opacity).toBe("1")
  })

  it("is always visible on a coarse pointer, where neither hover nor Tab exists", async () => {
    const screen = await render(<Fixture count={1} />)
    const action = screen
      .getByRole("button", { name: "Complete task-1" })
      .element()
    // Tailwind gates group-hover on (hover: hover), so the hover reveal is
    // absent on a phone; a (pointer: coarse) rule must reveal the action
    // with no interaction at all.
    const hoverReveals = rulesUnderMedia(action, /hover:\s*hover/).filter(
      (rule) => rule.style.opacity === "1" && /:hover\b/.test(rule.selectorText)
    )
    expect(hoverReveals.length).toBeGreaterThan(0)
    const coarseReveals = rulesUnderMedia(action, /pointer:\s*coarse/).filter(
      (rule) => rule.style.opacity === "1" && !hasState(rule.selectorText)
    )
    expect(
      coarseReveals.length,
      "a rule that reveals the action on a coarse pointer"
    ).toBeGreaterThan(0)
  })
})

describe("QueueItemAttachment", () => {
  it("renders attachment container", async () => {
    const screen = await render(
      <QueueItemAttachment className="custom-attachment">
        Attachments
      </QueueItemAttachment>
    )
    await expect.element(screen.getByText("Attachments")).toBeVisible()
    await expect
      .element(screen.getByText("Attachments"))
      .toHaveClass("custom-attachment")
  })
})

describe("QueueItemImage", () => {
  it("renders image", async () => {
    const screen = await render(
      <QueueItemImage alt="Test image" src="test.jpg" />
    )
    const img = screen.getByAltText("Test image")
    await expect.element(img).toBeInTheDocument()
    await expect.element(img).toHaveAttribute("src", "test.jpg")
  })

  it("has correct dimensions", async () => {
    const screen = await render(<QueueItemImage src="test.jpg" />)
    const img = screen.container.querySelector("img")
    expect(img).toHaveAttribute("height", "32")
    expect(img).toHaveAttribute("width", "32")
  })

  it("defaults to an empty alt and merges className", async () => {
    const screen = await render(
      <QueueItemImage className="custom-image" src="test.jpg" />
    )
    const img = screen.container.querySelector("img")
    expect(img?.getAttribute("alt")).toBe("")
    expect(img).toHaveClass("custom-image")
    expect(img).toHaveClass("object-cover")
  })
})

describe("QueueItemFile", () => {
  it("shows the whole name in a title while the chip truncates it", async () => {
    const name = "settings-mockup-final-approved-v2.png"
    const screen = await render(
      <main>
        <QueueItemFile>{name}</QueueItemFile>
        <QueueItemFile title="Mockup, second draft">{name}</QueueItemFile>
        <QueueItemFile>
          <span>{name}</span>
        </QueueItemFile>
      </main>
    )
    const [plain, titled, composed] = screen.getByText(name).elements()
    const chip = (text: Element | undefined) =>
      text?.closest("span.rounded") ?? null
    expect(plain && plain.scrollWidth > plain.clientWidth).toBe(true)
    expect(chip(plain)?.getAttribute("title")).toBe(name)
    // A consumer's title wins; children that are not a string get none.
    expect(chip(titled)?.getAttribute("title")).toBe("Mockup, second draft")
    expect(chip(composed)?.hasAttribute("title")).toBe(false)
    await expectNoViolations()
  })

  it("renders file name", async () => {
    const screen = await render(
      <QueueItemFile className="custom-file">document.pdf</QueueItemFile>
    )
    const name = screen.getByText("document.pdf")
    await expect.element(name).toBeVisible()
    await expect.element(name).toHaveClass("truncate")
    const chip = name.element().parentElement
    expect(chip).toHaveClass("custom-file")
    expect(chip?.querySelector("svg")).not.toBeNull()
  })
})

describe("QueueList", () => {
  it("renders list container", async () => {
    const screen = await render(
      <QueueList className="custom-list">
        <li>Item 1</li>
        <li>Item 2</li>
      </QueueList>
    )
    await expect.element(screen.getByText("Item 1")).toBeVisible()
    await expect.element(screen.getByText("Item 2")).toBeVisible()
    const scrollArea = document.querySelector("[data-slot='scroll-area']")
    expect(scrollArea).toHaveClass("custom-list")
    expect(screen.getByText("Item 1").element().parentElement?.tagName).toBe(
      "UL"
    )
  })

  it("scrolls a long list inside max-h-40 with a focusable viewport", async () => {
    await render(<Fixture count={30} />)
    const viewport = document.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement
    expect(viewport).not.toBeNull()
    await expect
      .poll(() => viewport.scrollHeight > viewport.clientHeight)
      .toBe(true)
    expect(viewport.clientHeight).toBeLessThanOrEqual(160)
    await expect.poll(() => viewport.tabIndex).toBe(0)
    await expectNoViolations()
  })
})

describe("QueueSection", () => {
  it("renders collapsible section", async () => {
    const screen = await render(
      <QueueSection className="custom-section">
        <QueueSectionTrigger>Section</QueueSectionTrigger>
        <QueueSectionContent>Content</QueueSectionContent>
      </QueueSection>
    )
    await expect.element(screen.getByText("Section")).toBeVisible()
    await expect.element(screen.getByText("Content")).toBeVisible()
    expect(document.querySelector("[data-slot='collapsible']")).toHaveClass(
      "custom-section"
    )
  })

  it("opens by default", async () => {
    const screen = await render(
      <QueueSection>
        <QueueSectionTrigger>Section</QueueSectionTrigger>
        <QueueSectionContent>Content</QueueSectionContent>
      </QueueSection>
    )
    await expect.element(screen.getByText("Content")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Section" }))
      .toHaveAttribute("aria-expanded", "true")
  })

  it("can be collapsed", async () => {
    const screen = await render(
      <QueueSection>
        <QueueSectionTrigger>Section</QueueSectionTrigger>
        <QueueSectionContent>Content</QueueSectionContent>
      </QueueSection>
    )
    const trigger = screen.getByRole("button", { name: "Section" })
    await expect.element(screen.getByText("Content")).toBeVisible()
    await userEvent.click(trigger)
    await expect.element(screen.getByText("Content")).not.toBeInTheDocument()
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("honors defaultOpen={false} and a controlled open", async () => {
    const screen = await render(
      <>
        <QueueSection defaultOpen={false}>
          <QueueSectionTrigger>Closed</QueueSectionTrigger>
          <QueueSectionContent>Closed content</QueueSectionContent>
        </QueueSection>
        <QueueSection open={false}>
          <QueueSectionTrigger>Locked</QueueSectionTrigger>
          <QueueSectionContent>Locked content</QueueSectionContent>
        </QueueSection>
      </>
    )
    expect(screen.getByText("Closed content").query()).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Closed" }))
    await expect.element(screen.getByText("Closed content")).toBeVisible()

    const locked = screen.getByRole("button", { name: "Locked" })
    await userEvent.click(locked)
    await expect.element(locked).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("Locked content").query()).toBeNull()
  })

  it("passes (open, eventDetails) to onOpenChange", async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      <QueueSection onOpenChange={onOpenChange}>
        <QueueSectionTrigger>Section</QueueSectionTrigger>
        <QueueSectionContent>Content</QueueSectionContent>
      </QueueSection>
    )
    await userEvent.click(screen.getByRole("button", { name: "Section" }))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]).toHaveLength(2)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(onOpenChange.mock.calls[0]?.[1]).toMatchObject({
      reason: "trigger-press",
    })
  })

  it("keeps the panel in the DOM (hidden) when keepMounted is set", async () => {
    const screen = await render(
      <QueueSection defaultOpen={false}>
        <QueueSectionTrigger>Section</QueueSectionTrigger>
        <QueueSectionContent keepMounted>Persisted</QueueSectionContent>
      </QueueSection>
    )
    const panel = screen.getByText("Persisted").element()
    expect(panel.getAttribute("data-slot")).toBe("collapsible-content")
    expect(panel.hasAttribute("hidden")).toBe(true)
  })
})

describe("QueueSectionTrigger", () => {
  it("renders trigger button", async () => {
    const screen = await render(
      <QueueSection>
        <QueueSectionTrigger className="custom-trigger">
          Trigger text
        </QueueSectionTrigger>
        <QueueSectionContent>Content</QueueSectionContent>
      </QueueSection>
    )
    const trigger = screen.getByRole("button", { name: "Trigger text" })
    await expect.element(trigger).toBeInTheDocument()
    expect(trigger.element().tagName).toBe("BUTTON")
    await expect.element(trigger).toHaveAttribute("type", "button")
    await expect.element(trigger).toHaveClass("custom-trigger")
    await expect.element(trigger).toHaveClass("group")
  })

  it("rotates the chevron on data-panel-open and toggles from the keyboard", async () => {
    const screen = await render(<Fixture />)
    const trigger = screen
      .getByRole("button", { name: "2 tasks" })
      .element() as HTMLElement
    const chevron = trigger.querySelector("svg") as SVGElement
    expect(trigger.hasAttribute("data-panel-open")).toBe(true)
    expect(rotateOf(chevron)).toMatch(UNROTATED)

    await tabTo(trigger)
    await userEvent.keyboard("{Enter}")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger.hasAttribute("data-panel-open")).toBe(false)
    expect(trigger.hasAttribute("aria-controls")).toBe(false)
    await expect.poll(() => rotateOf(chevron)).toBe("-90deg")

    await userEvent.keyboard(" ")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger.getAttribute("aria-controls")).toBe(
      document.querySelector("[data-slot='collapsible-content']")?.id
    )
    await expect.poll(() => rotateOf(chevron)).toMatch(UNROTATED)
  })
})

describe("QueueSectionLabel", () => {
  it("renders label with count", async () => {
    const screen = await render(<QueueSectionLabel count={5} label="tasks" />)
    await expect.element(screen.getByText("5 tasks")).toBeVisible()
  })

  it("renders with icon", async () => {
    const screen = await render(
      <QueueSectionLabel
        className="custom-label"
        count={3}
        icon={<span data-testid="icon">fire</span>}
        label="items"
      />
    )
    await expect.element(screen.getByTestId("icon")).toBeVisible()
    await expect.element(screen.getByText("3 items")).toBeVisible()
    expect(document.querySelector(".custom-label")).not.toBeNull()
  })

  it("names the trigger by the label alone without a count", async () => {
    const screen = await render(
      <QueueSection>
        <QueueSectionTrigger>
          <QueueSectionLabel label="tasks" />
        </QueueSectionTrigger>
        <QueueSectionContent>Content</QueueSectionContent>
      </QueueSection>
    )
    await expect
      .element(screen.getByRole("button", { name: "tasks" }))
      .toBeVisible()
  })
})

describe("QueueSectionContent", () => {
  it("renders content", async () => {
    const screen = await render(
      <QueueSection>
        <QueueSectionTrigger>Section</QueueSectionTrigger>
        <QueueSectionContent className="custom-content">
          Section content
        </QueueSectionContent>
      </QueueSection>
    )
    const content = screen.getByText("Section content")
    await expect.element(content).toBeVisible()
    await expect.element(content).toHaveClass("custom-content")
  })
})

describe("queue integration", () => {
  it("renders complete queue structure", async () => {
    const screen = await render(
      <main>
        <Queue>
          <QueueSection>
            <QueueSectionTrigger>
              <QueueSectionLabel count={2} label="pending tasks" />
            </QueueSectionTrigger>
            <QueueSectionContent>
              <QueueList>
                <QueueItem>
                  <div className="flex items-start gap-2">
                    <QueueItemIndicator />
                    <QueueItemContent>Task 1</QueueItemContent>
                  </div>
                  <QueueItemDescription>Description 1</QueueItemDescription>
                </QueueItem>
                <QueueItem>
                  <div className="flex items-start gap-2">
                    <QueueItemIndicator completed />
                    <QueueItemContent completed>Task 2</QueueItemContent>
                  </div>
                </QueueItem>
              </QueueList>
            </QueueSectionContent>
          </QueueSection>
        </Queue>
      </main>
    )
    await expect.element(screen.getByText("2 pending tasks")).toBeVisible()
    await expect.element(screen.getByText("Task 1")).toBeVisible()
    await expect.element(screen.getByText("Task 2")).toBeVisible()
    await expect.element(screen.getByText("Description 1")).toBeVisible()
    await expectNoViolations()
  })

  it("renders queue with attachments", async () => {
    const screen = await render(
      <main>
        <Queue>
          <QueueList>
            <QueueItem>
              <QueueItemContent>Message with files</QueueItemContent>
              <QueueItemAttachment>
                <QueueItemImage alt="preview" src="image.jpg" />
                <QueueItemFile>document.pdf</QueueItemFile>
              </QueueItemAttachment>
            </QueueItem>
          </QueueList>
        </Queue>
      </main>
    )
    await expect.element(screen.getByText("Message with files")).toBeVisible()
    await expect.element(screen.getByAltText("preview")).toBeInTheDocument()
    await expect.element(screen.getByText("document.pdf")).toBeVisible()
    await expectNoViolations()
  })

  it("renders queue with actions", async () => {
    const handleDelete = vi.fn()
    const handleEdit = vi.fn()
    const screen = await render(
      <Queue>
        <QueueList>
          <QueueItem>
            <QueueItemContent>Task with actions</QueueItemContent>
            <QueueItemActions>
              <QueueItemAction onClick={handleEdit}>Edit</QueueItemAction>
              <QueueItemAction onClick={handleDelete}>Delete</QueueItemAction>
            </QueueItemActions>
          </QueueItem>
        </QueueList>
      </Queue>
    )
    await expect.element(screen.getByText("Task with actions")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Edit" }))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole("button", { name: "Delete" }))
      .toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(handleDelete).toHaveBeenCalledOnce()
    expect(handleEdit).not.toHaveBeenCalled()
  })

  it("completed rows keep full-alpha muted text and pass color-contrast", async () => {
    const screen = await render(<Fixture completed />)
    await expect.element(screen.getByText("task-1")).toHaveClass("line-through")
    await expect
      .element(screen.getByText("task-1 description"))
      .toHaveClass("line-through")
    await expectNoViolations()
  })

  it("passes axe with the section collapsed", async () => {
    const screen = await render(<Fixture />)
    const trigger = screen.getByRole("button", { name: "2 tasks" })
    await userEvent.click(trigger)
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
    await expect.element(screen.getByText("task-1")).not.toBeInTheDocument()
    await expectNoViolations()
  })

  it("passes axe in dark mode", async () => {
    await withDark(async () => {
      const screen = await render(<Fixture completed />)
      await expect.element(screen.getByText("task-1")).toBeVisible()
      await expectNoViolations()
    })
  })
})
