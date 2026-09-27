import { type ComponentProps, StrictMode, useState } from "react"
import type { BundledLanguage } from "shiki"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContainer,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockLanguageSelector,
  CodeBlockLanguageSelectorContent,
  CodeBlockLanguageSelectorItem,
  CodeBlockLanguageSelectorTrigger,
  CodeBlockLanguageSelectorValue,
  CodeBlockTitle,
  highlightCode,
} from "@/registry/ai/code-block"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

// Real shiki, instrumented: counts the highlighters created in this file,
// records which grammars are requested (at creation or through loadLanguage)
// and which code is tokenised, and can make the highlighter's start-up or one
// grammar load fail on demand.
const shiki = vi.hoisted(() => ({
  instances: 0,
  grammars: [] as string[],
  codeToTokens: [] as { code: string; lang: string }[],
  failNext: new Set<string>(),
  failStart: false,
}))

vi.mock("shiki", async (importOriginal) => {
  const actual = await importOriginal<typeof import("shiki")>()
  const requestGrammars = (langs: readonly unknown[]) => {
    const names = langs.map(String)
    shiki.grammars.push(...names)
    for (const lang of names) {
      if (shiki.failNext.delete(lang)) {
        throw new Error(`simulated load failure for ${lang}`)
      }
    }
  }
  const createHighlighter: typeof actual.createHighlighter = async (
    options
  ) => {
    if (shiki.failStart) {
      shiki.failStart = false
      throw new Error("simulated highlighter start-up failure")
    }
    requestGrammars(options.langs ?? [])
    const highlighter = await actual.createHighlighter(options)
    shiki.instances += 1
    const loadLanguage = highlighter.loadLanguage.bind(highlighter)
    highlighter.loadLanguage = async (...langs) => {
      requestGrammars(langs)
      return loadLanguage(...langs)
    }
    const codeToTokens = highlighter.codeToTokens.bind(highlighter)
    highlighter.codeToTokens = (code, tokenOptions) => {
      shiki.codeToTokens.push({ code, lang: String(tokenOptions.lang) })
      return codeToTokens(code, tokenOptions)
    }
    return highlighter
  }
  return { ...actual, createHighlighter }
})

const scroller = () =>
  document.querySelector<HTMLElement>('[data-slot="code-block-content"]')

const pre = (root: ParentNode = document) => root.querySelector("pre")

const LIGHT_BG = "rgb(255, 255, 255)"
const DARK_BG = "rgb(10, 12, 16)"

// The theme background lands on the <pre> only once shiki has tokenised.
const highlighted = (root: ParentNode = document, bg = LIGHT_BG) =>
  expect
    .poll(() => {
      const element = pre(root)
      return element ? getComputedStyle(element).backgroundColor : ""
    })
    .toBe(bg)

const hexToRgb = (hex: string) => {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`
}

const lineSpans = (root: ParentNode) =>
  root.querySelectorAll<HTMLElement>("pre > code > span")

const CHECK_PATH = 'path[d="M20 6 9 17l-5-5"]'
const showsCheck = (button: Element) =>
  button.querySelector(CHECK_PATH) !== null

const stubClipboard = (clipboard: unknown) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  })
}

// React flushes state from async handlers on its own scheduler; two frames
// are enough for that to land while `setTimeout` is faked.
const flush = async () => {
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
}

const code = `const greeting: string = "hello"
console.log(greeting)`

const languages = { typescript: "TypeScript", javascript: "JavaScript" }

beforeEach(() => {
  shiki.grammars.length = 0
  shiki.codeToTokens.length = 0
  shiki.failNext.clear()
  shiki.failStart = false
})

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard")
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// code-block.tsx keeps one highlighter and its grammar loads per module, so
// once any block in this file has highlighted, a start-up failure cannot
// recur and every later block reuses what is loaded. A copy of the module
// imported under its own URL starts from nothing (its own highlighter and
// caches, the same React and the same mocked shiki), so the tests that need
// a cold start hold in any order. vi.resetModules() cannot do this in browser
// mode: the browser keeps one instance per module URL.
async function coldCodeBlock() {
  const url = new URL("../../../registry/ai/code-block.tsx", import.meta.url)
  url.searchParams.set("copy", crypto.randomUUID())
  const copy: typeof import("@/registry/ai/code-block") = await import(
    /* @vite-ignore */ url.href
  )
  expect(copy.CodeBlock, "a separate module instance").not.toBe(CodeBlock)
  return copy
}

describe("shared highlighter", () => {
  it("keeps the raw text when the highlighter fails to start and starts it on the next mount", async () => {
    const { CodeBlock: ColdCodeBlock } = await coldCodeBlock()
    const before = shiki.instances
    // The logged start-up failure is the behaviour under test.
    allowConsole("error")
    const errors = vi.spyOn(console, "error")
    shiki.failStart = true
    const ui = () => (
      <main>
        <ColdCodeBlock code="const first = 1" language="typescript" />
      </main>
    )
    const screen = await render(ui())
    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        "Failed to highlight code:",
        expect.any(Error)
      )
    )
    expect(shiki.failStart, "the start-up failure was consumed").toBe(false)
    expect(screen.container.textContent).toContain("const first = 1")
    expect(
      getComputedStyle(pre(screen.container) as Element).backgroundColor
    ).toBe("rgba(0, 0, 0, 0)")
    await screen.unmount()

    const retry = await render(ui())
    await highlighted(retry.container)
    expect(shiki.instances - before).toBe(1)
    expect(errors).toHaveBeenCalledTimes(1)
    errors.mockRestore()
  })

  it("highlights blocks in twelve languages with one highlighter, loading each grammar once, and Shiki logs nothing", async () => {
    const { CodeBlock: ColdCodeBlock } = await coldCodeBlock()
    const before = shiki.instances
    // No allowConsole: Shiki console.warns once ten highlighters exist, and
    // the console guard fails the test on it.
    const blocks = [
      ["ts", "ts", "const port: number = 3000"],
      ["typescript", "typescript", 'let host = "localhost"'],
      ["tsx", "tsx", 'const card = <div className="card" />'],
      ["js", "js", "function add(a, b) { return a + b }"],
      ["bash", "bash", 'echo "deploying" | tee deploy.log'],
      ["sh", "sh", 'export PATH="$HOME/bin:$PATH"'],
      ["yml", "yml", "name: ci\non: push"],
      ["json", "json", '{ "retries": 3 }'],
      ["css", "css", ".card { color: red; }"],
      ["html", "html", '<p class="lead">Hello</p>'],
      ["python", "python", "def area(r): return 3.14 * r ** 2"],
      ["plaintext", "plaintext", "just some words"],
      // A second block per language reuses the grammar load.
      ["ts-again", "ts", "const retries: number = 3"],
      ["python-again", "python", "def perimeter(r): return 2 * 3.14 * r"],
    ] as const
    await render(
      <main>
        {blocks.map(([id, language, source]) => (
          <ColdCodeBlock
            code={source}
            data-testid={id}
            key={id}
            language={language as BundledLanguage}
          />
        ))}
      </main>
    )
    for (const [id, language, source] of blocks) {
      const block = page.getByTestId(id).element()
      await highlighted(block)
      const firstLine = lineSpans(block)[0]
      const colours = new Set(
        [...(firstLine?.querySelectorAll("span") ?? [])].map(
          (token) => token.style.color
        )
      )
      expect(colours.size > 1, `${id} is tokenised by its grammar`).toBe(
        language !== "plaintext"
      )
      expect(
        shiki.codeToTokens.find((call) => call.code === source)?.lang
      ).toBe(language)
    }
    expect(shiki.instances - before).toBe(1)
    // Every grammar is requested exactly once, even for the second ts/python
    // block.
    expect([...shiki.grammars].sort()).toEqual(
      [...new Set(blocks.map(([, language]) => language))].sort()
    )
  })
})

describe("codeBlock", () => {
  it("renders code content", async () => {
    const screen = await render(
      <main>
        <CodeBlock code="const foo = 'bar';" language="javascript" />
      </main>
    )
    expect(screen.container.textContent).toContain("const foo")
    await highlighted(screen.container)
    expect(screen.container.textContent).toContain("const foo")
  })

  it("renders with line numbers", async () => {
    const screen = await render(
      <main>
        <CodeBlock
          code={"line1\nline2"}
          language="javascript"
          showLineNumbers
        />
      </main>
    )
    expect(screen.container.textContent).toContain("line1")
    expect(lineSpans(screen.container)).toHaveLength(2)
    expect(
      screen.container
        .querySelector<HTMLElement>("pre > code")
        ?.style.getPropertyValue("--line-digits")
    ).toBe("1")
  })

  it("renders children actions", async () => {
    const screen = await render(
      <main>
        <CodeBlock code="code" language="javascript">
          <button type="button">Action</button>
        </CodeBlock>
      </main>
    )
    await expect.element(screen.getByText("Action")).toBeInTheDocument()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <CodeBlock className="custom-class" code="code" language="javascript" />
      </main>
    )
    const root = screen.container.querySelector("[data-language]")
    expect(root).toHaveClass("custom-class")
    expect(root).toHaveClass("group")
    expect(root).toHaveClass("relative")
  })

  it("highlights TypeScript with shiki once it loads", async () => {
    const screen = await render(
      <main>
        <CodeBlock code={code} language="typescript" showLineNumbers />
      </main>
    )
    // Before shiki resolves each line is a single raw span; after
    // highlighting `const` becomes its own token.
    await expect
      .element(screen.getByText("const", { exact: true }))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText("greeting", { exact: true }).first())
      .toBeInTheDocument()
    expect(
      document.querySelector("[data-language='typescript']")
    ).not.toBeNull()
    await expectNoViolations()
  })

  it("shows the new code when only the middle of a snippet changes", async () => {
    // Same length, same first and last 100 characters, different middle.
    const filler = (char: string) => char.repeat(100)
    const codeA = `${filler("a")}\nconst middle = 1\n${filler("z")}`
    const codeB = `${filler("a")}\nconst middle = 2\n${filler("z")}`
    const screen = await render(
      <main>
        <CodeBlock code={codeA} language="typescript" />
      </main>
    )
    await highlighted(screen.container)
    expect(screen.container.textContent).toContain("middle = 1")

    await screen.rerender(
      <main>
        <CodeBlock code={codeB} language="typescript" />
      </main>
    )
    await expect
      .poll(() => screen.container.textContent)
      .toContain("middle = 2")
    await highlighted(screen.container)
    expect(screen.container.textContent).toContain("middle = 2")
    expect(screen.container.textContent).not.toContain("middle = 1")
  })

  it("re-highlights when only the language changes", async () => {
    const source = "print(1)"
    const screen = await render(
      <main>
        <CodeBlock code={source} language="javascript" />
      </main>
    )
    await highlighted(screen.container)

    await screen.rerender(
      <main>
        <CodeBlock code={source} language="python" />
      </main>
    )
    expect(
      screen.container.querySelector("[data-language='python']")
    ).not.toBeNull()
    await vi.waitFor(() =>
      expect(shiki.codeToTokens.filter((call) => call.code === source)).toEqual(
        [
          { code: source, lang: "javascript" },
          { code: source, lang: "python" },
        ]
      )
    )
    await highlighted(screen.container)
  })

  it("ignores a highlight that finishes after the code changed", async () => {
    const first = "const first = 1"
    const second = "const second = 2"
    const screen = await render(
      <main>
        <CodeBlock code={first} language="javascript" />
      </main>
    )
    await screen.rerender(
      <main>
        <CodeBlock code={second} language="javascript" />
      </main>
    )
    await highlighted(screen.container)
    expect(screen.container.textContent).toContain(second)
    expect(screen.container.textContent).not.toContain(first)
  })

  it("lets the highlight a block started finish for later callers after it unmounts", async () => {
    const third = "const third = 3"
    const late = await render(
      <main>
        <CodeBlock code={third} language="javascript" />
      </main>
    )
    await late.unmount()
    // The unmounted block's job is shared, not cancelled: the next caller
    // gets its tokens and the code is tokenised once.
    const tokens = await new Promise<{ tokens: unknown[][] }>((resolve) => {
      highlightCode(third, "javascript", resolve)
    })
    expect(tokens.tokens).toHaveLength(1)
    expect(
      shiki.codeToTokens.filter((call) => call.code === third)
    ).toHaveLength(1)
  })

  it("renders a language named after an Object.prototype key as plain text with one warning", async () => {
    // `"constructor" in bundledLanguages` is true through the prototype
    // chain; the check must be an own-property one.
    allowConsole("warn")
    const warn = vi.spyOn(console, "warn")
    const errors = vi.spyOn(console, "error")
    const screen = await render(
      <main>
        <CodeBlock
          code="class A {}"
          language={"constructor" as BundledLanguage}
        />
        <CodeBlock
          code="class B {}"
          language={"hasOwnProperty" as BundledLanguage}
        />
      </main>
    )
    for (const element of screen.container.querySelectorAll("pre")) {
      await expect
        .poll(() => getComputedStyle(element).backgroundColor)
        .toBe(LIGHT_BG)
    }
    expect(errors).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0]?.[0])).toContain("constructor")
    expect(String(warn.mock.calls[1]?.[0])).toContain("hasOwnProperty")
    expect(shiki.grammars).not.toContain("constructor")
    expect(shiki.grammars).not.toContain("hasOwnProperty")
    expect(screen.container.textContent).toContain("class A {}")
    expect(screen.container.textContent).toContain("class B {}")
  })

  it("keeps two blocks apart when the language string contains a colon", async () => {
    // ("foo:bar", "baz") and ("foo", "bar:baz") must not share a cache key.
    // Neither is a shiki grammar, so each is reported once.
    allowConsole("warn")
    const warn = vi.spyOn(console, "warn")
    const screen = await render(
      <main>
        <CodeBlock
          code="baz"
          data-testid="first"
          language={"foo:bar" as BundledLanguage}
        />
        <CodeBlock
          code="bar:baz"
          data-testid="second"
          language={"foo" as BundledLanguage}
        />
      </main>
    )
    for (const block of screen.container.querySelectorAll("[data-testid]")) {
      await highlighted(block)
    }
    expect(page.getByTestId("first").element().textContent).toBe("baz")
    expect(page.getByTestId("second").element().textContent).toBe("bar:baz")
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining('"foo:bar"'),
      expect.stringContaining('"foo"'),
    ])
  })

  it("sizes the gutter for one line and for ten thousand lines", async () => {
    // Both blocks mount fresh. Rerendering a one-line block into 10,000 lines
    // makes React place 9,999 new siblings, and each placement walks the
    // pending siblings after it (getHostSibling): quadratic, and over 5 s
    // under v8 coverage, against about 1 s for a fresh mount.
    const digits = (id: string) =>
      page
        .getByTestId(id)
        .element()
        .querySelector<HTMLElement>("pre > code")
        ?.style.getPropertyValue("--line-digits")
    const lines = (count: number) =>
      Array.from({ length: count }, (_, index) => `${index}`).join("\n")
    const screen = await render(
      <main>
        <CodeBlock
          code="one"
          data-testid="one"
          language={"" as BundledLanguage}
          showLineNumbers
        />
        <CodeBlock
          code={lines(10_000)}
          data-testid="many"
          language={"" as BundledLanguage}
          showLineNumbers
        />
      </main>
    )
    expect(digits("one")).toBe("1")
    expect(digits("many")).toBe("5")
    expect(lineSpans(page.getByTestId("many").element())).toHaveLength(10_000)
    for (const block of screen.container.querySelectorAll("[data-testid]")) {
      await highlighted(block)
    }
  })

  it("renders empty code as a single empty line", async () => {
    const screen = await render(
      <main>
        <CodeBlock code="" language="typescript" showLineNumbers />
      </main>
    )
    expect(lineSpans(screen.container)).toHaveLength(1)
    await highlighted(screen.container)
    expect(lineSpans(screen.container)).toHaveLength(1)
  })

  it("treats a missing code prop as empty text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })
    const missing = undefined as unknown as string
    const screen = await render(
      <main>
        <CodeBlock code={missing} language="json" showLineNumbers>
          <CodeBlockCopyButton aria-label="Copy" />
        </CodeBlock>
        <CodeBlockContent code={null as unknown as string} language="json" />
      </main>
    )
    for (const block of screen.container.querySelectorAll("pre")) {
      expect(lineSpans(block.parentElement as HTMLElement)).toHaveLength(1)
    }
    await userEvent.click(screen.getByRole("button", { name: "Copy" }))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(""))

    const tokens = await new Promise((resolve) => {
      highlightCode(missing, "json", resolve)
    })
    expect(tokens).toMatchObject({ tokens: [[]] })
  })

  it("renders CRLF input as the same lines before and after highlighting", async () => {
    const screen = await render(
      <main>
        <CodeBlock code={"let a = 1\r\nlet b = 2"} language="javascript" />
      </main>
    )
    expect(lineSpans(screen.container)).toHaveLength(2)
    expect(screen.container.textContent).not.toContain("\r")
    await highlighted(screen.container)
    expect(lineSpans(screen.container)).toHaveLength(2)
    expect(screen.container.textContent).not.toContain("\r")
  })

  it("preserves tab characters", async () => {
    const screen = await render(
      <main>
        <CodeBlock code={"if (a) {\n\treturn b\n}"} language="javascript" />
      </main>
    )
    expect(screen.container.textContent).toContain("\treturn b")
    await highlighted(screen.container)
    expect(screen.container.textContent).toContain("\treturn b")
  })

  it("renders code as text, never as markup", async () => {
    const payload = `<script>document.title = "pwned"</script>`
    const screen = await render(
      <main>
        <CodeBlock code={payload} language="html" />
      </main>
    )
    await highlighted(screen.container)
    expect(screen.container.querySelector("script")).toBeNull()
    expect(screen.container.textContent).toContain(payload)
    expect(document.title).not.toBe("pwned")
  })

  it("widens the line-number gutter with the digit count", async () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_, index) => `x${index + 1}`).join("\n")
    const screen = await render(
      <main>
        <CodeBlock code={lines(10)} language="javascript" showLineNumbers />
      </main>
    )
    const codeElement = () =>
      screen.container.querySelector<HTMLElement>("pre > code")
    const gutterWidth = () =>
      Number.parseFloat(
        getComputedStyle(lineSpans(screen.container)[0] as Element, "::before")
          .width
      )
    expect(codeElement()?.style.getPropertyValue("--line-digits")).toBe("2")
    const twoDigits = gutterWidth()
    expect(twoDigits).toBeGreaterThan(0)

    await screen.rerender(
      <main>
        <CodeBlock code={lines(1000)} language="javascript" showLineNumbers />
      </main>
    )
    expect(lineSpans(screen.container)).toHaveLength(1000)
    expect(codeElement()?.style.getPropertyValue("--line-digits")).toBe("4")
    expect(gutterWidth()).toBeCloseTo(twoDigits * 2, 0)
  })

  it("renders line numbers in the full muted-foreground colour", async () => {
    const screen = await render(
      <main>
        <span className="text-muted-foreground" data-testid="reference">
          ref
        </span>
        <CodeBlock code="a\nb" language="javascript" showLineNumbers />
      </main>
    )
    const reference = page.getByTestId("reference").element()
    const gutter = getComputedStyle(
      lineSpans(screen.container)[0] as Element,
      "::before"
    )
    expect(gutter.content).toContain("counter(line)")
    expect(gutter.color).toBe(getComputedStyle(reference).color)
  })

  it("applies the shiki theme background and colours in light and dark mode", async () => {
    const errors = vi.spyOn(console, "error")
    const screen = await render(
      <main>
        <CodeBlock code="let themed = true" language="typescript" />
      </main>
    )
    await highlighted(screen.container)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()

    const preElement = pre(screen.container) as HTMLElement
    expect(preElement.style.getPropertyValue("--shiki-dark-bg")).toBe("#0a0c10")
    expect(preElement.style.getPropertyValue("--shiki-dark")).toBe("#f0f3f6")
    expect(getComputedStyle(preElement).color).toBe(hexToRgb("#0e1116"))

    const token = screen.getByText("let", { exact: true }).element()
    expect(token).toBeInstanceOf(HTMLElement)
    const tokenStyle = (token as HTMLElement).style
    expect(getComputedStyle(token).color).toBe(tokenStyle.color)

    await withDark(async () => {
      await highlighted(screen.container, DARK_BG)
      expect(getComputedStyle(preElement).color).toBe(hexToRgb("#f0f3f6"))
      expect(getComputedStyle(token).color).toBe(
        hexToRgb(tokenStyle.getPropertyValue("--shiki-dark"))
      )
      expect(getComputedStyle(token).color).not.toBe(tokenStyle.color)
      await expectNoViolations()
    })
  })

  it("tokenises a block once per mount, even under StrictMode", async () => {
    const source = "const once = 1"
    const screen = await render(
      <StrictMode>
        <main>
          <CodeBlock code={source} language="javascript" />
        </main>
      </StrictMode>
    )
    await highlighted(screen.container)
    expect(
      shiki.codeToTokens.filter((call) => call.code === source)
    ).toHaveLength(1)
  })

  it("renders an unknown language as plain text with one warning per language", async () => {
    // The warning is the behaviour under test; nothing may reach console.error.
    allowConsole("warn")
    const warn = vi.spyOn(console, "warn")
    const errors = vi.spyOn(console, "error")
    const screen = await render(
      <main>
        <CodeBlock
          code="+++++[>++++<-]>."
          language={"brainfuck" as BundledLanguage}
        />
        <CodeBlock
          code="-[--->+<]>-."
          language={"brainfuck" as BundledLanguage}
        />
      </main>
    )
    await expect.element(screen.getByText("+++++[>++++<-]>.")).toBeVisible()
    await expect.element(screen.getByText("-[--->+<]>-.")).toBeVisible()
    for (const element of screen.container.querySelectorAll("pre")) {
      await expect
        .poll(() => getComputedStyle(element).backgroundColor)
        .toBe(LIGHT_BG)
    }
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain("brainfuck")
    expect(errors).not.toHaveBeenCalled()
    expect(shiki.grammars).not.toContain("brainfuck")
    expect(
      shiki.codeToTokens.find((call) => call.code === "+++++[>++++<-]>.")?.lang
    ).toBe("text")

    await screen.rerender(
      <main>
        <CodeBlock code="D'`" language={"malbolge" as BundledLanguage} />
      </main>
    )
    await highlighted(screen.container)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[1]?.[0])).toContain("malbolge")
    expect(errors).not.toHaveBeenCalled()
    warn.mockRestore()
    errors.mockRestore()
  })

  it("renders an empty or undefined language as plain text without warning", async () => {
    const warn = vi.spyOn(console, "warn")
    const screen = await render(
      <main>
        <CodeBlock code="plain words" language={"" as BundledLanguage} />
        <CodeBlockContent
          code="plain"
          language={undefined as unknown as BundledLanguage}
        />
      </main>
    )
    for (const element of screen.container.querySelectorAll("pre")) {
      await expect
        .poll(() => getComputedStyle(element).backgroundColor)
        .toBe(LIGHT_BG)
    }
    expect(screen.container.textContent).toContain("plain words")
    expect(screen.container.textContent).toContain("plain")
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("keeps the raw text when a grammar fails to load and retries on the next mount", async () => {
    // The logged load failure is the behaviour under test.
    allowConsole("error")
    const errors = vi.spyOn(console, "error")
    shiki.failNext.add("ruby")
    const screen = await render(
      <main>
        <CodeBlock code="puts 1" language="ruby" />
      </main>
    )
    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        "Failed to highlight code:",
        expect.any(Error)
      )
    )
    expect(screen.container.textContent).toContain("puts 1")
    expect(
      getComputedStyle(pre(screen.container) as Element).backgroundColor
    ).toBe("rgba(0, 0, 0, 0)")
    await screen.unmount()

    const retry = await render(
      <main>
        <CodeBlock code="puts 1" language="ruby" />
      </main>
    )
    await highlighted(retry.container)
    expect(shiki.grammars.filter((lang) => lang === "ruby")).toHaveLength(2)
    expect(errors).toHaveBeenCalledTimes(1)
    errors.mockRestore()
  })
})

describe("highlightCode", () => {
  it("notifies a caller synchronously on a cache hit", async () => {
    const source = "const hit = 1"
    const first = await new Promise((resolve) => {
      highlightCode(source, "javascript", resolve)
    })
    const callback = vi.fn()
    const sync = highlightCode(source, "javascript", callback)
    expect(sync).toBe(first)
    expect(callback).toHaveBeenCalledExactlyOnceWith(first)
  })

  it("shares one highlight between concurrent callers", async () => {
    const source = "const shared = 2"
    const a = vi.fn()
    const b = vi.fn()
    expect(highlightCode(source, "javascript", a)).toBeNull()
    expect(highlightCode(source, "javascript", b)).toBeNull()
    expect(highlightCode(source, "javascript")).toBeNull()
    await vi.waitFor(() => {
      expect(a).toHaveBeenCalledTimes(1)
      expect(b).toHaveBeenCalledTimes(1)
    })
    expect(a.mock.calls[0]?.[0]).toBe(b.mock.calls[0]?.[0])
    expect(
      shiki.codeToTokens.filter((call) => call.code === source)
    ).toHaveLength(1)
  })

  it("forgets the callers of a failed highlight: the retry notifies only its own caller", async () => {
    // The logged load failure is the behaviour under test. Haskell appears in
    // no other test here, so its grammar is still unloaded in this module
    // whatever the order.
    allowConsole("error")
    const errors = vi.spyOn(console, "error")
    shiki.failNext.add("haskell")
    const source = 'main = putStrLn "retry"'
    const failed = vi.fn()
    expect(highlightCode(source, "haskell", failed)).toBeNull()
    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        "Failed to highlight code:",
        expect.any(Error)
      )
    )
    expect(shiki.failNext.has("haskell"), "the load failure was consumed").toBe(
      false
    )

    const retried = vi.fn()
    expect(highlightCode(source, "haskell", retried)).toBeNull()
    await vi.waitFor(() => expect(retried).toHaveBeenCalledTimes(1))
    expect(shiki.grammars.filter((lang) => lang === "haskell")).toHaveLength(2)
    // A failed call's callback never runs, not even when a later call for
    // the same code and language succeeds.
    expect(failed).not.toHaveBeenCalled()
    expect(highlightCode(source, "haskell")).toBe(retried.mock.calls[0]?.[0])
    expect(errors).toHaveBeenCalledTimes(1)
    errors.mockRestore()
  })

  it("highlights the same code independently per language", async () => {
    const source = "# note"
    const python = await new Promise<{ tokens: unknown[][] }>((resolve) => {
      highlightCode(source, "python", resolve)
    })
    const javascript = await new Promise<{ tokens: unknown[][] }>((resolve) => {
      highlightCode(source, "javascript", resolve)
    })
    expect(python).not.toBe(javascript)
    expect(python.tokens).toHaveLength(1)
    expect(javascript.tokens).toHaveLength(1)
    expect(JSON.stringify(python.tokens)).not.toBe(
      JSON.stringify(javascript.tokens)
    )
  })
})

describe("codeBlockContent", () => {
  it("highlights on its own, outside CodeBlock", async () => {
    const screen = await render(
      <main>
        <CodeBlockContent code="let alone = true" language="javascript" />
      </main>
    )
    await expect
      .element(screen.getByText("let", { exact: true }))
      .toBeInTheDocument()
    await highlighted(screen.container)
  })

  it("makes an overflowing block a focusable, named scroll container", async () => {
    const longLine = `const url = "${"x".repeat(400)}"`
    const screen = await render(
      <main style={{ width: 240 }}>
        <CodeBlock code={longLine} language="typescript" />
      </main>
    )
    await highlighted(screen.container)
    const region = scroller() as HTMLElement
    expect(region.scrollWidth).toBeGreaterThan(region.clientWidth)
    await expect.poll(() => region.getAttribute("tabindex")).toBe("0")
    expect(region.getAttribute("role")).toBe("group")
    expect(region.getAttribute("aria-label")).toBe("TypeScript code")
    await expectNoViolations()

    await userEvent.tab()
    expect(document.activeElement).toBe(region)
    await userEvent.keyboard("{ArrowRight}")
    await expect.poll(() => region.scrollLeft).toBeGreaterThan(0)
  })

  it("names the scroll container after the language or its shiki alias and falls back to Code", async () => {
    // "nonsense-lang" is not a shiki grammar and is reported once.
    allowConsole("warn")
    const warn = vi.spyOn(console, "warn")
    const longLine = `const url = "${"n".repeat(400)}"`
    // "sh" is an alias of "shellscript", whose display name is "Shell".
    const cases = [
      ["ts", "TypeScript code"],
      ["sh", "Shell code"],
      ["bash", "Shell code"],
      ["tsx", "TSX code"],
      ["js", "JavaScript code"],
      ["yml", "YAML code"],
      ["json", "JSON code"],
      ["text", "Code"],
      ["plaintext", "Code"],
      ["nonsense-lang", "Code"],
    ] as const
    await render(
      <main style={{ width: 240 }}>
        {cases.map(([language]) => (
          <CodeBlock
            code={longLine}
            data-testid={language}
            key={language}
            language={language as BundledLanguage}
          />
        ))}
      </main>
    )
    for (const [language, label] of cases) {
      const region = page
        .getByTestId(language)
        .element()
        .querySelector('[data-slot="code-block-content"]') as HTMLElement
      await expect.poll(() => region.getAttribute("aria-label")).toBe(label)
      expect(region.getAttribute("role")).toBe("group")
    }
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('"nonsense-lang"')
    )
  })

  it("keeps two overflowing blocks on one page free of landmark violations", async () => {
    const longLine = `const url = "${"l".repeat(400)}"`
    const screen = await render(
      <main style={{ width: 240 }}>
        <CodeBlock code={longLine} language="typescript" />
        <CodeBlock code={longLine} language="typescript" />
      </main>
    )
    const regions = screen.container.querySelectorAll<HTMLElement>(
      '[data-slot="code-block-content"]'
    )
    expect(regions).toHaveLength(2)
    for (const region of regions) {
      await expect.poll(() => region.getAttribute("tabindex")).toBe("0")
      expect(region.getAttribute("aria-label")).toBe("TypeScript code")
    }
    expect(screen.container.querySelector('[role="region"]')).toBeNull()
    await expectNoViolations()
  })

  it("becomes a scroll container when streamed code grows past the block", async () => {
    const ui = (code: string) => (
      <main style={{ width: 240 }}>
        <CodeBlock code={code} language="typescript" />
      </main>
    )
    const screen = await render(ui("let a = 1"))
    await highlighted(screen.container)
    const region = scroller() as HTMLElement
    expect(region.hasAttribute("tabindex")).toBe(false)

    await screen.rerender(ui(`let a = "${"x".repeat(300)}"`))
    await expect.poll(() => region.getAttribute("tabindex")).toBe("0")
    expect(region.getAttribute("role")).toBe("group")
  })

  it("becomes a scroll container once a hidden block is shown", async () => {
    const long = `const url = "${"y".repeat(300)}"`
    const ui = (hidden: boolean) => (
      <main style={{ width: 240 }}>
        <div hidden={hidden}>
          <CodeBlock code={long} language="typescript" />
        </div>
      </main>
    )
    const screen = await render(ui(true))
    const region = scroller() as HTMLElement
    expect(region.clientWidth).toBe(0)
    expect(region.hasAttribute("tabindex")).toBe(false)

    await screen.rerender(ui(false))
    await expect.poll(() => region.getAttribute("tabindex")).toBe("0")
  })

  it("becomes a scroll container once a block below the fold scrolls into view", async () => {
    const long = `const url = "${"z".repeat(300)}"`
    await render(
      <main style={{ width: 240 }}>
        <div style={{ height: 4000 }} />
        <CodeBlock code={long} language="typescript" />
      </main>
    )
    const region = scroller() as HTMLElement
    region.scrollIntoView()
    await expect.poll(() => region.getAttribute("tabindex")).toBe("0")
    window.scrollTo(0, 0)
  })

  it("keeps the scroll container keyboard-scrollable in right-to-left text", async () => {
    const long = `const url = "${"r".repeat(300)}"`
    await render(
      <main dir="rtl" style={{ width: 240 }}>
        <CodeBlock code={long} language="typescript" />
      </main>
    )
    const region = scroller() as HTMLElement
    await expect.poll(() => region.getAttribute("tabindex")).toBe("0")
    await userEvent.tab()
    expect(document.activeElement).toBe(region)
    await userEvent.keyboard("{ArrowLeft}")
    await expect.poll(() => region.scrollLeft).toBeLessThan(0)
  })

  it("routes aria-label from CodeBlock to the scroll region", async () => {
    const longLine = `const url = "${"y".repeat(400)}"`
    const screen = await render(
      <main style={{ width: 240 }}>
        <CodeBlock
          aria-label="Fetch example"
          code={longLine}
          language="typescript"
        />
      </main>
    )
    const region = scroller() as HTMLElement
    await expect
      .poll(() => region.getAttribute("aria-label"))
      .toBe("Fetch example")
    expect(
      screen.container
        .querySelector("[data-language]")
        ?.hasAttribute("aria-label")
    ).toBe(false)
    await expectNoViolations()
  })

  it("is not a tab stop when the code fits, and re-checks on resize", async () => {
    const short = "const answer = 42"
    const screen = await render(
      <main style={{ width: 380 }}>
        <CodeBlock code={short} language="typescript" />
      </main>
    )
    await highlighted(screen.container)
    const region = scroller() as HTMLElement
    expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth)
    expect(region.hasAttribute("tabindex")).toBe(false)
    expect(region.hasAttribute("role")).toBe(false)
    expect(region.hasAttribute("aria-label")).toBe(false)

    await screen.rerender(
      <main style={{ width: 96 }}>
        <CodeBlock code={short} language="typescript" />
      </main>
    )
    await expect.poll(() => region.getAttribute("tabindex")).toBe("0")

    await screen.rerender(
      <main style={{ width: 380 }}>
        <CodeBlock code={short} language="typescript" />
      </main>
    )
    await expect.poll(() => region.hasAttribute("tabindex")).toBe(false)
  })
})

describe("codeBlockCopyButton", () => {
  it("renders copy button", async () => {
    const screen = await render(
      <main>
        <CodeBlock code="test code" language="javascript">
          <CodeBlockCopyButton aria-label="Copy" />
        </CodeBlock>
      </main>
    )
    await expect.element(screen.getByRole("button")).toBeInTheDocument()
    expect(showsCheck(screen.getByRole("button").element())).toBe(false)
  })

  it("copies code to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })
    const screen = await render(
      <main>
        <CodeBlock code="test code" language="javascript">
          <CodeBlockCopyButton aria-label="Copy" />
        </CodeBlock>
      </main>
    )
    await userEvent.click(screen.getByRole("button"))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("test code"))
  })

  it("calls onCopy callback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })
    const onCopy = vi.fn()
    const screen = await render(
      <main>
        <CodeBlock code={code} language="typescript">
          <CodeBlockHeader>
            <CodeBlockTitle>
              <CodeBlockFilename>greeting.ts</CodeBlockFilename>
            </CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockCopyButton aria-label="Copy code" onCopy={onCopy} />
            </CodeBlockActions>
          </CodeBlockHeader>
        </CodeBlock>
      </main>
    )
    await userEvent.click(screen.getByRole("button", { name: "Copy code" }))
    await vi.waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1))
    expect(writeText).toHaveBeenCalledWith(code)
    await expectNoViolations()
  })

  it("calls onError when clipboard fails", async () => {
    const error = new Error("Clipboard error")
    stubClipboard({ writeText: vi.fn().mockRejectedValue(error) })
    const onError = vi.fn()
    const onCopy = vi.fn()
    const screen = await render(
      <main>
        <CodeBlock code="test code" language="javascript">
          <CodeBlockCopyButton onCopy={onCopy} onError={onError} />
        </CodeBlock>
      </main>
    )
    await userEvent.click(screen.getByRole("button"))
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error))
    expect(onCopy).not.toHaveBeenCalled()
    expect(showsCheck(screen.getByRole("button").element())).toBe(false)
  })

  it("calls onError when clipboard API is not available", async () => {
    const onError = vi.fn()
    const onCopy = vi.fn()
    for (const clipboard of [undefined, { writeText: undefined }]) {
      stubClipboard(clipboard)
      const screen = await render(
        <main>
          <CodeBlock code="test code" language="javascript">
            <CodeBlockCopyButton onCopy={onCopy} onError={onError} />
          </CodeBlock>
        </main>
      )
      await userEvent.click(screen.getByRole("button"))
      await vi.waitFor(() =>
        expect(onError).toHaveBeenLastCalledWith(
          expect.objectContaining({ message: "Clipboard API not available" })
        )
      )
      await screen.unmount()
    }
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    expect(onCopy).not.toHaveBeenCalled()
  })

  it("shows the check for `timeout` ms, ignores clicks meanwhile, then re-arms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })
    const screen = await render(
      <main>
        <CodeBlock code="const x = 1" language="javascript">
          <CodeBlockCopyButton aria-label="Copy" />
        </CodeBlock>
      </main>
    )
    const button = screen.getByRole("button", { name: "Copy" })
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })

    await userEvent.click(button)
    await flush()
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(showsCheck(button.element())).toBe(true)

    await userEvent.click(button)
    await flush()
    expect(writeText).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1999)
    await flush()
    expect(showsCheck(button.element())).toBe(true)

    vi.advanceTimersByTime(1)
    await flush()
    expect(showsCheck(button.element())).toBe(false)

    await userEvent.click(button)
    await flush()
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(writeText).toHaveBeenLastCalledWith("const x = 1")
  })

  it("honours a custom timeout", async () => {
    stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
    const screen = await render(
      <main>
        <CodeBlock code="const x = 1" language="javascript">
          <CodeBlockCopyButton aria-label="Copy" timeout={500} />
        </CodeBlock>
      </main>
    )
    const button = screen.getByRole("button", { name: "Copy" })
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    await userEvent.click(button)
    await flush()
    expect(showsCheck(button.element())).toBe(true)

    vi.advanceTimersByTime(499)
    await flush()
    expect(showsCheck(button.element())).toBe(true)

    vi.advanceTimersByTime(1)
    await flush()
    expect(showsCheck(button.element())).toBe(false)
  })

  it("clears the reset timer on unmount", async () => {
    stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
    const setTimeoutSpy = vi.spyOn(window, "setTimeout")
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
    const screen = await render(
      <main>
        <CodeBlock code="const x = 1" language="javascript">
          <CodeBlockCopyButton aria-label="Copy" />
        </CodeBlock>
      </main>
    )
    const button = screen.getByRole("button", { name: "Copy" })
    await userEvent.click(button)
    await vi.waitFor(() => expect(showsCheck(button.element())).toBe(true))

    const index = setTimeoutSpy.mock.calls.findIndex(
      ([, delay]) => delay === 2000
    )
    expect(index).toBeGreaterThanOrEqual(0)
    const resetTimer = setTimeoutSpy.mock.results[index]?.value
    expect(typeof resetTimer).toBe("number")
    expect(clearTimeoutSpy).not.toHaveBeenCalledWith(resetTimer)

    await screen.unmount()
    expect(clearTimeoutSpy).toHaveBeenCalledWith(resetTimer)
  })

  it("renders custom children instead of the icon", async () => {
    const screen = await render(
      <main>
        <CodeBlock code="test code" language="javascript">
          <CodeBlockCopyButton>Copy snippet</CodeBlockCopyButton>
        </CodeBlock>
      </main>
    )
    const button = screen.getByRole("button", { name: "Copy snippet" })
    await expect.element(button).toBeVisible()
    expect(button.element().querySelector("svg")).toBeNull()
  })
})

describe("codeBlockLanguageSelector", () => {
  const Selector = ({
    onValueChange,
    contentProps,
  }: {
    onValueChange?: (value: string | null) => void
    contentProps?: Partial<
      ComponentProps<typeof CodeBlockLanguageSelectorContent>
    >
  }) => {
    const [language, setLanguage] = useState<string | null>("typescript")
    // Headroom above the trigger, or Base UI flips `side="top"` to bottom.
    return (
      <main style={contentProps?.side === "top" ? { paddingTop: 300 } : {}}>
        <CodeBlock code={code} language="typescript">
          <CodeBlockHeader>
            <CodeBlockTitle>
              <CodeBlockFilename>greeting.ts</CodeBlockFilename>
            </CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockLanguageSelector
                items={languages}
                onValueChange={(value) => {
                  setLanguage(value)
                  onValueChange?.(value)
                }}
                value={language}
              >
                <CodeBlockLanguageSelectorTrigger aria-label="Language">
                  <CodeBlockLanguageSelectorValue />
                </CodeBlockLanguageSelectorTrigger>
                <CodeBlockLanguageSelectorContent {...contentProps}>
                  <CodeBlockLanguageSelectorItem value="typescript">
                    TypeScript
                  </CodeBlockLanguageSelectorItem>
                  <CodeBlockLanguageSelectorItem value="javascript">
                    JavaScript
                  </CodeBlockLanguageSelectorItem>
                </CodeBlockLanguageSelectorContent>
              </CodeBlockLanguageSelector>
            </CodeBlockActions>
          </CodeBlockHeader>
        </CodeBlock>
      </main>
    )
  }

  // Type-level contract: a `useState<string | null>` setter and a literal
  // union both satisfy onValueChange without casts.
  const Typed = () => {
    const [nullable, setNullable] = useState<string | null>(null)
    const [literal, setLiteral] = useState<"typescript" | "javascript">(
      "typescript"
    )
    return (
      <>
        <CodeBlockLanguageSelector
          onValueChange={setNullable}
          value={nullable}
        />
        <CodeBlockLanguageSelector
          items={languages}
          onValueChange={(value) => {
            if (value) setLiteral(value)
          }}
          value={literal}
        />
      </>
    )
  }

  it("switches language through the selector", async () => {
    const onValueChange = vi.fn()
    const screen = await render(<Selector onValueChange={onValueChange} />)

    const trigger = screen.getByRole("combobox", { name: "Language" })
    await expect.element(trigger).toBeVisible()
    expect(trigger.element().textContent).toContain("TypeScript")
    await expectNoViolations()

    await userEvent.click(trigger)
    const option = screen.getByRole("option", { name: "JavaScript" })
    await expect.element(option).toBeVisible()
    // The popup is portaled to <body>, outside the <main> landmark, so the
    // open-state check is scoped to it; every WCAG rule still runs on it.
    await expectNoViolations(
      document.querySelector('[data-slot="select-content"]') as HTMLElement
    )

    await userEvent.click(option)
    await vi.waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith("javascript")
    )
    await expect
      .poll(() => trigger.element().textContent)
      .toContain("JavaScript")
  })

  it("opens and selects with the keyboard", async () => {
    const onValueChange = vi.fn()
    const screen = await render(<Selector onValueChange={onValueChange} />)
    const trigger = screen.getByRole("combobox", { name: "Language" })
    ;(trigger.element() as HTMLElement).focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect
      .element(screen.getByRole("option", { name: "JavaScript" }))
      .toBeVisible()
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await vi.waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith("javascript")
    )
    await expect
      .element(screen.getByRole("option", { name: "JavaScript" }))
      .not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger.element())
  })

  it("forwards side, align and alignItemWithTrigger to the popup", async () => {
    const screen = await render(
      <Selector contentProps={{ alignItemWithTrigger: false, side: "top" }} />
    )
    await userEvent.click(screen.getByRole("combobox", { name: "Language" }))
    await expect
      .element(screen.getByRole("option", { name: "JavaScript" }))
      .toBeVisible()
    const popup = document.querySelector<HTMLElement>(
      '[data-slot="select-content"]'
    )
    expect(popup?.dataset.alignTrigger).toBe("false")
    expect(popup?.dataset.side).toBe("top")
    expect(popup?.dataset.align).toBe("end")
  })

  it("accepts nullable and literal-union state without casts", async () => {
    const screen = await render(
      <main>
        <Typed />
      </main>
    )
    expect(screen.container.querySelector('[role="combobox"]')).toBeNull()
  })
})

describe("layout parts", () => {
  it("merge className, pass children and keep the container's data and style", async () => {
    await render(
      <main>
        <CodeBlockContainer
          className="custom-container"
          data-testid="container"
          language="json"
          style={{ color: "rgb(1, 2, 3)" }}
        >
          <CodeBlockHeader className="custom-header" data-testid="header">
            <CodeBlockTitle className="custom-title" data-testid="title">
              <CodeBlockFilename
                className="custom-filename"
                data-testid="filename"
              >
                data.json
              </CodeBlockFilename>
            </CodeBlockTitle>
            <CodeBlockActions className="custom-actions" data-testid="actions">
              <button type="button">Do</button>
            </CodeBlockActions>
          </CodeBlockHeader>
        </CodeBlockContainer>
      </main>
    )
    const container = page.getByTestId("container").element() as HTMLElement
    expect(container.dataset.language).toBe("json")
    expect(container).toHaveClass("custom-container")
    expect(container.style.contentVisibility).toBe("auto")
    expect(container.style.containIntrinsicSize).toBe("auto 200px")
    expect(container.style.color).toBe("rgb(1, 2, 3)")
    for (const part of ["header", "title", "filename", "actions"]) {
      await expect.element(page.getByTestId(part)).toHaveClass(`custom-${part}`)
    }
    expect(page.getByTestId("filename").element().tagName).toBe("SPAN")
    await expect.element(page.getByText("data.json")).toBeVisible()
    await expect.element(page.getByRole("button", { name: "Do" })).toBeVisible()
    await expectNoViolations()
  })

  it("passes axe as a full composition in dark mode", async () => {
    await withDark(async () => {
      const screen = await render(<Composition />)
      await highlighted(screen.container, DARK_BG)
      await expectNoViolations()
    })
  })
})

const Composition = () => (
  <main>
    <CodeBlock code={code} language="typescript" showLineNumbers>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>greeting.ts</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockLanguageSelector
            defaultValue="typescript"
            items={languages}
          >
            <CodeBlockLanguageSelectorTrigger aria-label="Language">
              <CodeBlockLanguageSelectorValue />
            </CodeBlockLanguageSelectorTrigger>
            <CodeBlockLanguageSelectorContent>
              <CodeBlockLanguageSelectorItem value="typescript">
                TypeScript
              </CodeBlockLanguageSelectorItem>
              <CodeBlockLanguageSelectorItem value="javascript">
                JavaScript
              </CodeBlockLanguageSelectorItem>
            </CodeBlockLanguageSelectorContent>
          </CodeBlockLanguageSelector>
          <CodeBlockCopyButton aria-label="Copy code" />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  </main>
)
