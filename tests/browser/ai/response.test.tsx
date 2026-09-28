import { type ComponentProps, lazy, StrictMode, Suspense } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import ResponsePreview from "@/app/preview/response/page"
import { MessageResponse } from "@/registry/ai/response"
import { expectNoViolations, settle, withDark } from "@/tests/a11y"
import "@/app/globals.css"

const CODE_BLOCK_BODY = "[data-streamdown='code-block-body']"
const SHORT_CODE = "```ts\nconst a = 1\n```"
const LONG_CODE =
  "```ts\nconst reallyLongIdentifierName = anotherReallyLongFunctionName(withArguments, andMore, andEvenMore)\n```"
const TALL_CODE = `\`\`\`ts\n${Array.from(
  { length: 60 },
  (_, i) => `const line${i} = ${i}`
).join("\n")}\n\`\`\``
// Header cells never wrap, so the table is at least as wide as its headers:
// wider than a phone, narrower than a desktop window.
const WIDE_TABLE = [
  "| Caching strategy | Freshness guarantee | Relative cost | Recommended for |",
  "| --- | --- | --- | --- |",
  "| no-store | Always fresh | Highest | Personalized dashboards |",
  "| force-cache | Until redeploy | Lowest | Reference data |",
].join("\n")

const markdown = `## Cache strategy

Some **bold** prose.

\`\`\`ts
const answer = 42
\`\`\`

| Strategy | Cost |
| --- | --- |
| no-store | Highest |
| force-cache | Lowest |

A display equation:

$$
c = h \\cdot c_{hit} + (1 - h) \\cdot c_{miss}
$$
`

/**
 * Streamdown's `Components` index signature requires renderers to accept
 * `Record<string, unknown> & { node?: Element }`, hence the `object` param.
 */
type ParagraphProps = ComponentProps<"p"> & { node?: unknown }

const codeBlockBody = () => document.querySelector<HTMLElement>(CODE_BLOCK_BODY)
/** The div Streamdown scrolls a table in: the table's parent inside the wrapper. */
const tableScroller = () =>
  document.querySelector("[data-streamdown='table']")?.parentElement ?? null
/** The attributes a scroller carries while it overflows. */
const scrollRegion = (element: Element | null) =>
  element && {
    tabindex: element.getAttribute("tabindex"),
    role: element.getAttribute("role"),
    label: element.getAttribute("aria-label"),
  }
const NAMED_CODE = { tabindex: "0", role: "group", label: "Code" }
const NAMED_TABLE = { tabindex: "0", role: "group", label: "Table" }
const NAMED_MATH = { tabindex: "0", role: "group", label: "Math" }
const UNMARKED = { tabindex: null, role: null, label: null }
// Fourteen terms: about 800 px of formula, wider than any phone.
const LONG_FORMULA = `$$\np(x) = ${Array.from(
  { length: 14 },
  (_, i) => `a_{${i}} x^{${i}}`
).join(" + ")}\n$$`
// Tall constructs whose parts KaTeX positions outside the line box.
const TALL_FORMULAS = [
  "P(A \\mid B) = \\frac{P(B \\mid A)P(A)}{P(B)}",
  "\\sum_{i=1}^{n} \\frac{x_i^2}{\\sqrt{y_i}}",
  "\\int_0^\\infty e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}",
  "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
  "\\underbrace{a + b}_{n} \\cdot \\overline{x_j}",
  "\\overbrace{a + b + c}^{\\text{sum}} + \\hat{x}",
  "\\prod_{k=1}^{\\infty} \\lim_{n \\to \\infty} \\binom{n}{k}",
  "\\sqrt[3]{\\dfrac{a}{b}} + \\left( \\frac{a}{b} \\right)^2",
  "f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}",
  "\\boxed{E = mc^2}",
]
const mathDisplays = () => [
  ...document.querySelectorAll<HTMLElement>(".katex-display"),
]
const streamdownRoot = () =>
  document.querySelector<HTMLElement>("[data-slot='message-response'] > div")
const claimedByReact = (element: Element | null) =>
  element !== null &&
  Object.keys(element).some((key) => key.startsWith("__reactFiber$"))

afterEach(async () => {
  await page.viewport(414, 896)
  vi.restoreAllMocks()
})

describe("messageResponse", () => {
  it("renders markdown content", async () => {
    const screen = await render(
      <main>
        <MessageResponse>Plain text</MessageResponse>
      </main>
    )
    await expect.element(screen.getByText("Plain text")).toBeVisible()
  })

  it("renders markdown with formatting", async () => {
    const screen = await render(
      <main>
        <MessageResponse>**Bold** text</MessageResponse>
      </main>
    )
    const bold = screen.getByText("Bold")
    await expect.element(bold).toBeVisible()
    // Streamdown renders emphasis as a styled span tagged data-streamdown.
    expect(bold.element().getAttribute("data-streamdown")).toBe("strong")
  })

  it("applies custom className", async () => {
    await render(
      <main>
        <MessageResponse className="custom-class">Text</MessageResponse>
      </main>
    )
    expect(streamdownRoot()?.className).toContain("custom-class")
    expect(streamdownRoot()?.className).toContain("size-full")
  })

  it("renders children as markdown", async () => {
    const screen = await render(
      <main>
        <MessageResponse># Heading</MessageResponse>
      </main>
    )
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Heading" }))
      .toBeVisible()
  })

  it("renders markdown with a code fence, table and math", async () => {
    const screen = await render(
      <main>
        <MessageResponse>{markdown}</MessageResponse>
      </main>
    )

    await expect
      .element(screen.getByRole("heading", { name: "Cache strategy" }))
      .toBeVisible()
    await expect.element(screen.getByText("bold")).toBeVisible()
    await expect.element(screen.getByText("no-store")).toBeVisible()
    await expect
      .element(screen.getByRole("cell", { name: "Lowest" }))
      .toBeVisible()
    // Shiki highlights asynchronously; the raw text is present either way.
    await expect
      .element(screen.getByText("answer", { exact: false }).first())
      .toBeVisible()
    // KaTeX renders MathML alongside the visual output.
    await expect
      .poll(() => document.querySelectorAll("math").length)
      .toBeGreaterThanOrEqual(1)

    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("re-renders only when children or isAnimating change", async () => {
    let renders = 0
    const Paragraph = (props: object) => {
      renders += 1
      const { node: _node, ...rest } = props as ParagraphProps
      return <p {...rest} />
    }
    const components = { p: Paragraph }
    const ui = (props: {
      className: string
      isAnimating: boolean
      children: string
    }) => (
      <main>
        <MessageResponse caret="block" components={components} {...props} />
      </main>
    )

    const screen = await render(
      ui({
        className: "alpha",
        isAnimating: false,
        children: "Hello **world**",
      })
    )
    await expect.element(screen.getByText("world")).toBeVisible()
    expect(streamdownRoot()?.className).toContain("alpha")
    const before = renders

    // Same children and isAnimating: the memo skips the update entirely, so
    // a changed className does not reach the DOM.
    await screen.rerender(
      ui({ className: "beta", isAnimating: false, children: "Hello **world**" })
    )
    expect(renders).toBe(before)
    expect(streamdownRoot()?.className).toContain("alpha")
    expect(streamdownRoot()?.className).not.toContain("beta")

    // isAnimating flips: the update goes through, bringing the pending className
    // and the streaming caret with it.
    await screen.rerender(
      ui({ className: "beta", isAnimating: true, children: "Hello **world**" })
    )
    await expect.poll(() => streamdownRoot()?.className).toContain("beta")
    expect(streamdownRoot()?.className).not.toContain("alpha")
    expect(
      streamdownRoot()?.style.getPropertyValue("--streamdown-caret")
    ).not.toBe("")

    // New children re-render the blocks.
    await screen.rerender(
      ui({ className: "beta", isAnimating: true, children: "Hello **there**" })
    )
    await expect.element(screen.getByText("there")).toBeVisible()
    expect(renders).toBeGreaterThan(before)
  })

  it("closes incomplete markdown while streaming and leaves it literal when parseIncompleteMarkdown is off", async () => {
    const screen = await render(
      <main>
        <div data-testid="parsed">
          <MessageResponse>{"partial **bo"}</MessageResponse>
        </div>
        <div data-testid="literal">
          <MessageResponse parseIncompleteMarkdown={false}>
            {"partial **bo"}
          </MessageResponse>
        </div>
      </main>
    )
    const parsed = screen.getByTestId("parsed")
    await expect.element(parsed).toHaveTextContent("partial bo")
    expect(
      parsed.element().querySelector("[data-streamdown='strong']")?.textContent
    ).toBe("bo")
    expect(parsed.element().textContent).not.toContain("**")

    const literal = screen.getByTestId("literal")
    await expect.element(literal).toHaveTextContent("partial **bo")
    expect(
      literal.element().querySelector("[data-streamdown='strong']")
    ).toBeNull()
  })

  it("highlights with the high-contrast GitHub themes by default and honors a shikiTheme override", async () => {
    await render(
      <main>
        <div data-testid="default">
          <MessageResponse>{SHORT_CODE}</MessageResponse>
        </div>
        <div data-testid="nord">
          <MessageResponse shikiTheme={["nord", "nord"]}>
            {SHORT_CODE}
          </MessageResponse>
        </div>
      </main>
    )
    // Shiki writes each token's light and dark colors as custom properties.
    const keywordColors = (id: string) => {
      const token = [
        ...document.querySelectorAll<HTMLElement>(
          `[data-testid='${id}'] ${CODE_BLOCK_BODY} code span span`
        ),
      ].find((span) => span.textContent === "const")
      return token
        ? [
            token.style.getPropertyValue("--sdm-c"),
            token.style.getPropertyValue("--shiki-dark"),
          ]
        : undefined
    }
    await expect
      .poll(() => keywordColors("default"), { timeout: 10_000 })
      .toEqual(["#A0111F", "#FF9492"])
    await expect
      .poll(() => keywordColors("nord"), { timeout: 10_000 })
      .toEqual(["#81A1C1", "#81A1C1"])
  })

  it("sanitizes raw HTML and routes links through the link-safety button by default", async () => {
    const screen = await render(
      <main>
        <MessageResponse>
          {
            '<script>window.__pwned = 1</script><img src="x" onerror="window.__pwned = 2" alt="x">\n\nSee [the docs](https://example.com/docs).'
          }
        </MessageResponse>
      </main>
    )
    // Streamdown 2.6 defaults linkSafety to enabled: the link is a button that
    // opens a confirmation modal.
    const link = screen.getByRole("button", { name: "the docs" })
    await expect.element(link).toBeVisible()
    expect(link.element().getAttribute("data-streamdown")).toBe("link")
    const slot = document.querySelector("[data-slot='message-response']")
    expect(slot?.querySelector("script")).toBeNull()
    expect(slot?.querySelector("img[onerror]")).toBeNull()
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it("renders plain anchors that open in a new tab when linkSafety is disabled", async () => {
    const screen = await render(
      <main>
        <MessageResponse linkSafety={{ enabled: false }}>
          {"See [the docs](https://example.com/docs)."}
        </MessageResponse>
      </main>
    )
    const link = screen.getByRole("link", { name: "the docs" })
    await expect.element(link).toBeVisible()
    await expect
      .element(link)
      .toHaveAttribute("href", "https://example.com/docs")
    await expect.element(link).toHaveAttribute("target", "_blank")
    // rehype-harden adds noopener as well.
    await expect.element(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders nothing for empty or undefined children without crashing", async () => {
    await render(
      <main>
        <MessageResponse />
        <MessageResponse>{""}</MessageResponse>
      </main>
    )
    expect(
      document.querySelectorAll("[data-slot='message-response']")
    ).toHaveLength(2)
    expect(
      document.querySelector("[data-slot='message-response'] p")
    ).toBeNull()
  })

  it("wraps Streamdown in a display: contents slot", async () => {
    await render(
      <main>
        <MessageResponse>Plain</MessageResponse>
      </main>
    )
    const slot = document.querySelector<HTMLElement>(
      "[data-slot='message-response']"
    )
    expect(slot).not.toBeNull()
    expect(slot && getComputedStyle(slot).display).toBe("contents")
  })
})

describe("scrollable code blocks", () => {
  it("marks only overflowing code block bodies as named tab stops", async () => {
    const screen = await render(
      <main>
        <div className="w-60">
          <MessageResponse>{LONG_CODE}</MessageResponse>
        </div>
        <div className="w-[800px]">
          <MessageResponse>{SHORT_CODE}</MessageResponse>
        </div>
      </main>
    )
    await expect
      .element(screen.getByText(/reallyLongIdentifierName/))
      .toBeVisible()
    const bodies = () => [
      ...document.querySelectorAll<HTMLElement>(CODE_BLOCK_BODY),
    ]
    await expect.poll(() => bodies().length).toBe(2)
    await expect
      .poll(() => scrollRegion(bodies()[0] ?? null))
      .toEqual(NAMED_CODE)
    expect(scrollRegion(bodies()[1] ?? null)).toEqual(UNMARKED)
    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("marks a code block taller than the default codeBlockMaxHeight as a tab stop", async () => {
    await page.viewport(1200, 800)
    await render(
      <main>
        <div style={{ width: 900 }}>
          <MessageResponse>{TALL_CODE}</MessageResponse>
        </div>
      </main>
    )
    await expect.poll(() => codeBlockBody()).not.toBeNull()
    const body = codeBlockBody()
    if (!body) return
    await expect.poll(() => body.scrollHeight > body.clientHeight).toBe(true)
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
    await expect.poll(() => scrollRegion(body)).toEqual(NAMED_CODE)
    await expectNoViolations()
  })

  it("re-checks a code block body when its size changes and nothing else does", async () => {
    await page.viewport(1400, 800)
    // A body of fixed content: with no Shiki pass and no streaming, a size
    // change is the only thing that can prompt a re-check.
    const Body = (props: object) => {
      const {
        node: _node,
        children: _children,
        ...rest
      } = props as ParagraphProps
      return (
        <p {...rest}>
          <span
            data-streamdown="code-block-body"
            style={{ display: "block", overflow: "auto" }}
          >
            <span style={{ display: "inline-block", width: 600 }}>
              wide code
            </span>
          </span>
        </p>
      )
    }
    await render(
      <main>
        <div data-testid="box" style={{ width: 1200 }}>
          <MessageResponse components={{ p: Body }}>Hello</MessageResponse>
        </div>
      </main>
    )
    await expect.poll(() => codeBlockBody()).not.toBeNull()
    expect(scrollRegion(codeBlockBody())).toEqual(UNMARKED)

    const box = document.querySelector<HTMLElement>("[data-testid='box']")
    expect(box).not.toBeNull()
    if (!box) return
    box.style.width = "300px"
    await expect.poll(() => scrollRegion(codeBlockBody())).toEqual(NAMED_CODE)

    box.style.width = "1200px"
    await expect.poll(() => scrollRegion(codeBlockBody())).toEqual(UNMARKED)
  })

  it("adds the tab stop when streamed content starts to overflow", async () => {
    const screen = await render(
      <main>
        <div className="w-60">
          <MessageResponse>{"```ts\nconst a = 1"}</MessageResponse>
        </div>
      </main>
    )
    await expect.poll(() => codeBlockBody()).not.toBeNull()
    await expect
      .poll(() => codeBlockBody()?.hasAttribute("tabindex"))
      .toBe(false)

    await screen.rerender(
      <main>
        <div className="w-60">
          <MessageResponse>
            {
              "```ts\nconst a = 1\nconst reallyLongIdentifierName = anotherReallyLongFunctionName(withArguments, andMore, andEvenMore)\n```"
            }
          </MessageResponse>
        </div>
      </main>
    )
    await expect.poll(() => scrollRegion(codeBlockBody())).toEqual(NAMED_CODE)
  })

  it("re-checks overflow when only a text node inside the code block changes", async () => {
    // A body that cannot change size: overflow hidden shows no scrollbar,
    // so a longer text is a characterData mutation and nothing else.
    const Body = (props: object) => {
      const {
        node: _node,
        children: _children,
        ...rest
      } = props as ParagraphProps
      return (
        <p {...rest}>
          <span
            data-streamdown="code-block-body"
            style={{ display: "block", overflow: "hidden", whiteSpace: "pre" }}
          >
            short
          </span>
        </p>
      )
    }
    await render(
      <main>
        <div className="w-60">
          <MessageResponse components={{ p: Body }}>Hello</MessageResponse>
        </div>
      </main>
    )
    await expect.poll(() => codeBlockBody()).not.toBeNull()
    const body = codeBlockBody()
    if (!body) return
    expect(scrollRegion(body)).toEqual(UNMARKED)

    const text = body.firstChild
    expect(text).toBeInstanceOf(Text)
    if (!(text instanceof Text)) return
    text.data = "_".repeat(400)
    expect(body.scrollWidth).toBeGreaterThan(body.clientWidth)
    await expect.poll(() => scrollRegion(body)).toEqual(NAMED_CODE)
  })

  it("leaves server-rendered code blocks untouched until React has hydrated them", async () => {
    // The console guard fails the test on a hydration mismatch. renderToString
    // (the legacy server build) stamps contexts in a slot the client renderer
    // does not read; the streaming build shares the slot and every later
    // client render in this file would warn about multiple renderers.
    // Phrasing content only: a <div> inside the <p> would be re-parented by the
    // HTML parser when the markup is assigned to innerHTML.
    const Body = () => (
      <span
        data-streamdown="code-block-body"
        style={{ display: "block", overflow: "auto", width: 120 }}
      >
        <span style={{ display: "inline-block", width: 600 }}>wide code</span>
      </span>
    )
    // The server tree renders the body inside a completed Suspense boundary,
    // as Streamdown does for its lazily loaded highlighted code body.
    const ServerParagraph = (props: object) => {
      const { node: _node, children, ...rest } = props as ParagraphProps
      return (
        <p {...rest}>
          {children}
          <Suspense fallback={<span>loading</span>}>
            <Body />
          </Suspense>
        </p>
      )
    }
    // The client tree suspends on that body until the test releases it, so
    // the boundary stays dehydrated after MessageResponse itself has hydrated.
    let release: () => void = () => {}
    const gate = new Promise<{ default: typeof Body }>((resolve) => {
      release = () => resolve({ default: Body })
    })
    const LazyBody = lazy(() => gate)
    const ClientParagraph = (props: object) => {
      const { node: _node, children, ...rest } = props as ParagraphProps
      return (
        <p {...rest}>
          {children}
          <Suspense fallback={<span>loading</span>}>
            <LazyBody />
          </Suspense>
        </p>
      )
    }
    const tree = (Paragraph: (props: object) => React.JSX.Element) => (
      <MessageResponse components={{ p: Paragraph }}>Hello</MessageResponse>
    )

    const html = renderToString(tree(ServerParagraph))
    expect(html).toContain("<!--$-->")
    expect(html).not.toContain("tabindex")

    const container = document.createElement("main")
    document.body.append(container)
    container.innerHTML = html
    const frames = vi.spyOn(window, "requestAnimationFrame")
    const root = hydrateRoot(container, tree(ClientParagraph))
    try {
      const slot = container.querySelector("[data-slot='message-response']")
      await expect.poll(() => claimedByReact(slot)).toBe(true)
      const body = container.querySelector(CODE_BLOCK_BODY)
      expect(body).not.toBeNull()
      expect(claimedByReact(body)).toBe(false)
      expect(scrollRegion(body)).toEqual(UNMARKED)
      // While the body is dehydrated the marker polls for it frame after
      // frame; once several frames have passed it has looked and declined.
      const seen = frames.mock.calls.length
      await expect
        .poll(() => frames.mock.calls.length - seen)
        .toBeGreaterThanOrEqual(3)
      expect(scrollRegion(body)).toEqual(UNMARKED)

      release()
      await expect.poll(() => claimedByReact(body)).toBe(true)
      await expect.poll(() => scrollRegion(body)).toEqual(NAMED_CODE)
    } finally {
      root.unmount()
      container.remove()
    }
  })
})

describe("scrollable tables", () => {
  it("makes a table wider than a phone a named tab stop and releases it when the table fits", async () => {
    await page.viewport(375, 800)
    const screen = await render(
      <main>
        <MessageResponse>{WIDE_TABLE}</MessageResponse>
      </main>
    )
    await expect
      .element(screen.getByRole("cell", { name: "no-store" }))
      .toBeVisible()
    const scroller = tableScroller()
    expect(scroller).not.toBeNull()
    if (!scroller) return
    await expect
      .poll(() => scroller.scrollWidth > scroller.clientWidth)
      .toBe(true)
    await expect.poll(() => scrollRegion(scroller)).toEqual(NAMED_TABLE)
    await expectNoViolations()
    await withDark(() => expectNoViolations())

    await page.viewport(1400, 800)
    await expect
      .poll(() => scroller.scrollWidth > scroller.clientWidth)
      .toBe(false)
    await expect.poll(() => scrollRegion(scroller)).toEqual(UNMARKED)

    await page.viewport(375, 800)
    await expect.poll(() => scrollRegion(scroller)).toEqual(NAMED_TABLE)
  })

  it("names a table and a code block in the same response separately", async () => {
    await page.viewport(375, 800)
    const screen = await render(
      <main>
        <MessageResponse>{`${WIDE_TABLE}\n\n${LONG_CODE}`}</MessageResponse>
      </main>
    )
    await expect
      .element(screen.getByRole("cell", { name: "no-store" }))
      .toBeVisible()
    await expect.poll(() => scrollRegion(tableScroller())).toEqual(NAMED_TABLE)
    await expect.poll(() => scrollRegion(codeBlockBody())).toEqual(NAMED_CODE)
    await expect
      .element(screen.getByRole("group", { name: "Table" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("group", { name: "Code" }))
      .toBeVisible()
    await expectNoViolations()
  })
})

describe("display math", () => {
  it("scrolls a formula wider than a phone inside a named tab stop instead of widening the page", async () => {
    await page.viewport(375, 800)
    const screen = await render(
      <main className="px-4">
        <MessageResponse>{`Polynomial:\n\n${LONG_FORMULA}\n`}</MessageResponse>
      </main>
    )
    await expect.element(screen.getByText("Polynomial:")).toBeVisible()
    await expect.poll(() => mathDisplays().length).toBe(1)
    const [display] = mathDisplays()
    if (!display) return
    await expect
      .poll(() => display.scrollWidth > display.clientWidth)
      .toBe(true)
    // WCAG 1.4.10: the formula scrolls, the page does not.
    const root = document.documentElement
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    await expect.poll(() => scrollRegion(display)).toEqual(NAMED_MATH)
    await expect
      .element(screen.getByRole("group", { name: "Math" }))
      .toBeVisible()
    await expectNoViolations()
    await withDark(() => expectNoViolations())

    display.focus()
    expect(document.activeElement).toBe(display)
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    await expect.poll(() => display.scrollLeft).toBeGreaterThan(0)

    await page.viewport(1400, 800)
    await expect
      .poll(() => display.scrollWidth > display.clientWidth)
      .toBe(false)
    await expect.poll(() => scrollRegion(display)).toEqual(UNMARKED)
  })

  it("leaves formulas that fit unmarked and clips none of their tall parts", async () => {
    await page.viewport(375, 800)
    const screen = await render(
      <main className="p-4">
        <MessageResponse>
          {TALL_FORMULAS.map((formula) => `$$\n${formula}\n$$`).join("\n\n")}
        </MessageResponse>
      </main>
    )
    await expect.poll(() => mathDisplays().length).toBe(TALL_FORMULAS.length)
    for (const display of mathDisplays()) {
      expect(display.scrollWidth).toBeLessThanOrEqual(display.clientWidth)
      expect(scrollRegion(display)).toEqual(UNMARKED)
    }
    // overflow-y is hidden, so a part drawn outside the box would be cut:
    // the page must look the same with the clip lifted.
    const main = screen.getByRole("main").element()
    await settle()
    const clipped = await page.screenshot({ element: main, save: false })
    for (const display of mathDisplays()) display.style.overflow = "visible"
    const unclipped = await page.screenshot({ element: main, save: false })
    expect(clipped === unclipped).toBe(true)
  })
  it("adds no tab stop to a formula that cannot scroll because the stylesheet rule is missing", async () => {
    await page.viewport(375, 800)
    const screen = await render(
      <main className="unscrolled px-4">
        {/* An unlayered rule beats the layered one in app/globals.css. */}
        <style>{".unscrolled .katex-display { overflow: visible }"}</style>
        <MessageResponse>{`Polynomial:\n\n${LONG_FORMULA}\n`}</MessageResponse>
      </main>
    )
    await expect.element(screen.getByText("Polynomial:")).toBeVisible()
    await expect.poll(() => mathDisplays().length).toBe(1)
    const [display] = mathDisplays()
    if (!display) return
    expect(getComputedStyle(display).overflowX).toBe("visible")
    await expect
      .poll(() => display.scrollWidth > display.clientWidth)
      .toBe(true)
    expect(scrollRegion(display)).toEqual(UNMARKED)
  })
})

describe("views Streamdown portals to the body", () => {
  it("makes the fullscreen table view a named tab stop while the table overflows", async () => {
    await page.viewport(375, 700)
    const screen = await render(
      <main>
        <MessageResponse>{WIDE_TABLE}</MessageResponse>
      </main>
    )
    await expect
      .element(screen.getByRole("cell", { name: "no-store" }))
      .toBeVisible()
    await userEvent.click(
      screen.getByRole("button", { name: "View fullscreen" })
    )
    const fullscreen = () =>
      document.querySelector<HTMLElement>(
        "[data-streamdown='table-fullscreen']"
      )
    await expect.poll(fullscreen).not.toBeNull()
    const view = fullscreen()
    const scroller =
      view?.querySelector("[data-streamdown='table']")?.parentElement ?? null
    expect(scroller).not.toBeNull()
    if (!(view && scroller)) return
    expect(view.parentElement).toBe(document.body)
    await expect
      .poll(() => scroller.scrollWidth > scroller.clientWidth)
      .toBe(true)
    await expect.poll(() => scrollRegion(scroller)).toEqual(NAMED_TABLE)
    await expectNoViolations(view)

    await page.viewport(1400, 800)
    await expect.poll(() => scrollRegion(scroller)).toEqual(UNMARKED)

    await userEvent.keyboard("{Escape}")
    await expect.poll(fullscreen).toBeNull()
  })
})

describe("link safety", () => {
  const LONG_HREF = `https://example.com/${"segment/".repeat(30)}`
  const linkSafetyDialog = () =>
    document.querySelector<HTMLDialogElement>(
      "dialog[data-slot='link-safety-dialog']"
    )

  it("confirms a link in a modal dialog that takes focus, shows the whole URL and gives focus back on Escape", async () => {
    await page.viewport(375, 700)
    const screen = await render(
      <main>
        <MessageResponse>{`See [the docs](${LONG_HREF}).`}</MessageResponse>
      </main>
    )
    const link = screen.getByRole("button", { name: "the docs" })
    await userEvent.click(link)
    const dialog = page.getByRole("dialog", { name: "Open external link?" })
    await expect.element(dialog).toBeVisible()
    await expect
      .element(dialog)
      .toHaveAccessibleDescription("You're about to visit an external website.")
    expect(linkSafetyDialog()?.open).toBe(true)
    // Streamdown's own modal (a role="button" backdrop) is not rendered.
    expect(
      document.querySelector("[data-streamdown='link-safety-modal']")
    ).toBeNull()
    await expect
      .element(page.getByRole("button", { name: "Close" }))
      .toHaveFocus()
    await expect.element(page.getByText(LONG_HREF)).toBeVisible()
    await expectNoViolations()
    await withDark(() => expectNoViolations())

    await userEvent.keyboard("{Escape}")
    await expect.poll(linkSafetyDialog).toBeNull()
    await expect.element(link).toHaveFocus()
  })

  it("opens the URL in a new tab from the dialog and closes it", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    const screen = await render(
      <main>
        <MessageResponse>
          {"See [the docs](https://example.com/docs)."}
        </MessageResponse>
      </main>
    )
    const link = screen.getByRole("button", { name: "the docs" })
    await userEvent.click(link)
    await userEvent.click(page.getByRole("button", { name: "Open link" }))
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://example.com/docs",
      "_blank",
      "noreferrer"
    )
    await expect.poll(linkSafetyDialog).toBeNull()
    await expect.element(link).toHaveFocus()
  })

  it("copies the URL, says so, and closes from the close button or the backdrop", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined)
    const screen = await render(
      <main>
        <MessageResponse>
          {"See [the docs](https://example.com/docs)."}
        </MessageResponse>
      </main>
    )
    const link = screen.getByRole("button", { name: "the docs" })
    await userEvent.click(link)
    await userEvent.click(page.getByRole("button", { name: "Copy link" }))
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      "https://example.com/docs"
    )
    await expect
      .element(page.getByRole("button", { name: "Copied" }))
      .toBeVisible()
    await userEvent.click(page.getByRole("button", { name: "Close" }))
    await expect.poll(linkSafetyDialog).toBeNull()
    await expect.element(link).toHaveFocus()

    await userEvent.click(link)
    await expect.poll(() => linkSafetyDialog()?.open).toBe(true)
    // The backdrop is outside the panel; a click there lands on the dialog.
    await userEvent.click(page.elementLocator(document.body), {
      position: { x: 4, y: 4 },
    })
    await expect.poll(linkSafetyDialog).toBeNull()
  })

  it("stays open under StrictMode's replayed effects", async () => {
    const screen = await render(
      <StrictMode>
        <main>
          <MessageResponse>
            {"See [the docs](https://example.com/docs)."}
          </MessageResponse>
        </main>
      </StrictMode>
    )
    await userEvent.click(screen.getByRole("button", { name: "the docs" }))
    await expect
      .element(page.getByRole("dialog", { name: "Open external link?" }))
      .toBeVisible()
    // The replayed effect ran on the dialog it had already opened.
    expect(linkSafetyDialog()?.open).toBe(true)
    await expect
      .element(page.getByRole("button", { name: "Close" }))
      .toHaveFocus()
  })

  it("speaks the translations passed to MessageResponse", async () => {
    const screen = await render(
      <main>
        <MessageResponse
          translations={{
            close: "Schließen",
            copyLink: "Link kopieren",
            externalLinkWarning: "Sie verlassen diese Seite.",
            openExternalLink: "Externen Link öffnen?",
            openLink: "Link öffnen",
          }}
        >
          {"Siehe [die Doku](https://example.com/docs)."}
        </MessageResponse>
      </main>
    )
    await userEvent.click(screen.getByRole("button", { name: "die Doku" }))
    const dialog = page.getByRole("dialog", { name: "Externen Link öffnen?" })
    await expect.element(dialog).toBeVisible()
    await expect
      .element(dialog)
      .toHaveAccessibleDescription("Sie verlassen diese Seite.")
    for (const name of ["Schließen", "Link kopieren", "Link öffnen"]) {
      await expect.element(page.getByRole("button", { name })).toBeVisible()
    }
  })

  it("keeps a consumer's renderModal and onLinkCheck", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    const screen = await render(
      <main>
        <MessageResponse
          linkSafety={{
            enabled: true,
            onLinkCheck: (url) => url.startsWith("https://trusted.example"),
            // Rendered inside the link's paragraph: phrasing content only.
            renderModal: ({ isOpen, url }) =>
              isOpen ? <span>Custom check for {url}</span> : null,
          }}
        >
          {
            "See [trusted](https://trusted.example/a) and [other](https://other.example/b)."
          }
        </MessageResponse>
      </main>
    )
    await userEvent.click(screen.getByRole("button", { name: "trusted" }))
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://trusted.example/a",
      "_blank",
      "noreferrer"
    )
    await userEvent.click(screen.getByRole("button", { name: "other" }))
    await expect
      .element(screen.getByText("Custom check for https://other.example/b"))
      .toBeVisible()
    expect(linkSafetyDialog()).toBeNull()
  })
})

describe("the preview page", () => {
  it("keeps its long formula inside the column at phone width", async () => {
    await page.viewport(375, 800)
    // The preview layout's main: px-4 inside the viewport.
    await render(
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
        <ResponsePreview />
      </main>
    )
    await expect.poll(() => mathDisplays().length).toBe(2)
    const [fits, loss] = mathDisplays()
    if (!(fits && loss)) return
    await expect.poll(() => scrollRegion(loss)).toEqual(NAMED_MATH)
    expect(scrollRegion(fits)).toEqual(UNMARKED)
    const root = document.documentElement
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    await expectNoViolations()
  })
})
