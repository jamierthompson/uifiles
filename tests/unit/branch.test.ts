/**
 * Server rendering of the branch leaf. MessageBranch reads the branch count
 * off its own children while rendering, so the selector and the page count
 * are in the server HTML instead of appearing after hydration, including
 * when a Server Component renders the tree (the App Router case).
 */
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { Readable } from "node:stream"
import { text } from "node:stream/consumers"
import {
  Fragment,
  forwardRef,
  createElement as h,
  memo,
  type ReactNode,
} from "react"
import { renderToString } from "react-dom/server"
import { prerenderToNodeStream } from "react-dom/static"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import * as branchModule from "@/registry/ai/branch"
import {
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
} from "@/registry/ai/branch"

const answers = ["First", "Second", "Third"]

const content = (count = answers.length) =>
  h(
    MessageBranchContent,
    null,
    answers.slice(0, count).map((answer) => h("p", { key: answer }, answer))
  )

const selector = () =>
  h(
    MessageBranchSelector,
    null,
    h(MessageBranchPrevious),
    h(MessageBranchPage),
    h(MessageBranchNext)
  )

const visible = (text: string) =>
  new RegExp(`class="[^"]*\\bblock\\b[^"]*"><p>${text}</p>`)
const hidden = (text: string) =>
  new RegExp(`class="[^"]*\\bhidden\\b[^"]*"><p>${text}</p>`)
/** React separates adjacent text nodes with an empty comment. */
const pageCount = (current: number, total: number) =>
  new RegExp(`>${current}<!-- --> of <!-- -->${total}<`)

afterEach(() => {
  vi.restoreAllMocks()
})

describe("branch on the server", () => {
  it("renders the selector, the page count and the requested branch", () => {
    const errors = vi.spyOn(console, "error")
    const html = renderToString(
      h(MessageBranch, { defaultBranch: 1 }, content(), selector())
    )
    expect(html).toContain('aria-label="Previous branch"')
    expect(html).toContain('aria-label="Next branch"')
    expect(html).toMatch(pageCount(2, 3))
    expect(html).toMatch(hidden("First"))
    expect(html).toMatch(visible("Second"))
    expect(html).toMatch(hidden("Third"))
    expect(errors).not.toHaveBeenCalled()
  })

  it("counts the content through a wrapping element or fragment, before or after the selector", () => {
    const wrappers: Array<(node: ReactNode) => ReactNode> = [
      (node) => node,
      (node) => h("div", { className: "wrapper" }, node),
      (node) => h(Fragment, null, node),
      (node) => h("section", null, h(Fragment, null, h("div", null, node))),
    ]
    for (const wrap of wrappers) {
      for (const order of [
        [wrap(content()), selector()],
        [selector(), wrap(content())],
      ]) {
        const html = renderToString(h(MessageBranch, null, ...order))
        expect(html).toContain('aria-label="Next branch"')
        expect(html).toMatch(pageCount(1, 3))
        expect(html).toMatch(visible("First"))
      }
    }
  })

  it("clamps an out-of-range branch and hides the selector for a single branch", () => {
    const clamped = renderToString(
      h(MessageBranch, { branch: 9 }, content(), selector())
    )
    expect(clamped).toMatch(pageCount(3, 3))
    expect(clamped).toMatch(visible("Third"))

    const single = renderToString(
      h(MessageBranch, null, content(1), selector(), h(MessageBranchPage))
    )
    expect(single).not.toContain('aria-label="Next branch"')
    expect(single).toMatch(pageCount(1, 1))
  })

  it("cannot see content a custom component renders, so that selector waits for the client", () => {
    const Answers = () => content()
    const html = renderToString(
      h(
        MessageBranch,
        null,
        h(Answers),
        selector(),
        h(MessageBranchPage, { id: "outside" })
      )
    )
    expect(html).not.toContain('aria-label="Next branch"')
    expect(html).toMatch(/id="outside"[^>]*>0<!-- --> of <!-- -->0</)
    // The content still shows its first branch on its own.
    expect(html).toMatch(visible("First"))
    expect(html).toMatch(hidden("Second"))
  })
})

/**
 * A client component as the Flight client hands it to the renderer when a
 * Server Component renders it: the element type is a lazy wrapper around
 * the module export (react-server-dom's `createLazyChunkWrapper`), which
 * React resolves only when it mounts the element.
 */
const clientReference = <T>(component: T, init = (payload: T) => payload) =>
  ({
    $$typeof: Symbol.for("react.lazy"),
    _payload: component,
    _init: init,
  }) as unknown as T

describe("branch rendered by a Server Component", () => {
  it("counts content handed over as a client reference", () => {
    const errors = vi.spyOn(console, "error")
    const html = renderToString(
      h(
        clientReference(MessageBranch),
        { defaultBranch: 1 },
        h(
          clientReference(MessageBranchContent),
          null,
          answers.map((answer) => h("p", { key: answer }, answer))
        ),
        h(
          clientReference(MessageBranchSelector),
          null,
          h(clientReference(MessageBranchPrevious)),
          h(clientReference(MessageBranchPage)),
          h(clientReference(MessageBranchNext))
        )
      )
    )
    expect(errors).not.toHaveBeenCalled()
    expect(html).toContain('aria-label="Next branch"')
    expect(html).toMatch(pageCount(2, 3))
    expect(html).toMatch(visible("Second"))
  })

  it("counts content wrapped in memo or forwardRef", () => {
    const Memoized = memo(MessageBranchContent)
    const Forwarded = forwardRef(MessageBranchContent)
    for (const Content of [Memoized, Forwarded, clientReference(Memoized)]) {
      const html = renderToString(
        h(
          MessageBranch,
          null,
          h(
            Content,
            null,
            answers.map((answer) => h("p", { key: answer }, answer))
          ),
          selector()
        )
      )
      expect(html).toContain('aria-label="Next branch"')
      expect(html).toMatch(pageCount(1, 3))
    }
  })

  it("waits for a reference whose module is still loading and counts it", async () => {
    // A pending chunk throws its promise from _init until the module is in.
    const errors = vi.spyOn(console, "error")
    let loaded = false
    let loading: Promise<void> | undefined
    const pending = clientReference(MessageBranchContent, (payload) => {
      if (loaded) return payload
      loading ??= new Promise((resolve) =>
        setImmediate(() => {
          loaded = true
          resolve()
        })
      )
      throw loading
    })
    const { prelude } = await prerenderToNodeStream(
      h(
        MessageBranch,
        { defaultBranch: 2 },
        h(
          pending,
          null,
          answers.map((answer) => h("p", { key: answer }, answer))
        ),
        selector()
      )
    )
    const html = await text(prelude)
    expect(loading).toBeDefined()
    expect(errors).not.toHaveBeenCalled()
    expect(html).toContain('aria-label="Next branch"')
    expect(html).toMatch(pageCount(3, 3))
    expect(html).toMatch(visible("Third"))
  })
})

/**
 * The App Router pipeline end to end: a Server Component tree is serialised
 * by React's Flight server (in its own process, under the react-server
 * condition, with the client components as client references), decoded by
 * the Flight client Next uses for SSR, and prerendered by Fizz.
 */
describe("branch through a real Flight round trip", () => {
  const FLIGHT_SERVER = `
const { createElement: h } = require("react")
const {
  registerClientReference,
  renderToPipeableStream,
} = require("next/dist/compiled/react-server-dom-webpack/server.node")
const client = (name) =>
  registerClientReference(() => { throw new Error(name) }, "branch", name)
const [Branch, Content, Selector, Previous, Page, Next] = [
  "MessageBranch", "MessageBranchContent", "MessageBranchSelector",
  "MessageBranchPrevious", "MessageBranchPage", "MessageBranchNext",
].map(client)
// A Server Component, as app/preview/branch/page.tsx is.
function Answers() {
  return h(Branch, { defaultBranch: 1 },
    h(Content, null, ["First", "Second", "Third"].map((a) => h("p", { key: a }, a))),
    h(Selector, null, h(Previous), h(Page), h(Next)))
}
renderToPipeableStream(h(Answers), { branch: { id: "branch", chunks: [], name: "*" } }, {
  onError(error) { console.error(error); process.exitCode = 1 },
}).pipe(process.stdout)
`
  const require = createRequire(import.meta.url)
  const { createFromNodeStream } =
    require("next/dist/compiled/react-server-dom-webpack/client.node") as {
      createFromNodeStream: (
        stream: Readable,
        manifest: {
          moduleMap: Record<string, Record<string, unknown>>
          serverModuleMap: null
          moduleLoading: null
        }
        // The root as a thenable, which React renders once it resolves.
      ) => ReactNode
    }
  let flight = ""
  beforeAll(() => {
    const result = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--input-type=commonjs", "-"],
      { cwd: process.cwd(), encoding: "utf8", input: FLIGHT_SERVER }
    )
    if (result.status !== 0) throw new Error(result.stderr)
    flight = result.stdout
  })
  const globals = globalThis as {
    __next_require__?: (id: string) => unknown
    __webpack_chunk_load__?: (id: string) => Promise<void>
  }

  afterEach(() => {
    delete globals.__next_require__
    delete globals.__webpack_chunk_load__
  })

  /**
   * Prerenders the decoded tree; `chunks` are [id, file] pairs the Flight
   * client loads (one macrotask each) before the module can be required.
   */
  const serverHtml = async (chunks: string[]) => {
    const loads: string[] = []
    globals.__next_require__ = (id) => {
      expect(id).toBe("branch")
      return branchModule
    }
    globals.__webpack_chunk_load__ = (id) => {
      loads.push(id)
      return new Promise((resolve) => setImmediate(resolve))
    }
    const tree = createFromNodeStream(Readable.from([flight]), {
      moduleMap: { branch: { "*": { id: "branch", chunks, name: "*" } } },
      serverModuleMap: null,
      moduleLoading: null,
    })
    const { prelude } = await prerenderToNodeStream(h(Fragment, null, tree))
    return { html: await text(prelude), loads }
  }

  it("carries the client references Next hands to server rendering", () => {
    expect(flight).toMatch(/:I\["branch",\[\],"MessageBranchContent"\]/)
    expect(flight).toMatch(
      /"\$L[0-9a-f]+",null,\{"children":\[\["\$","p","First"/
    )
  })

  it("renders the selector and page count on the first render, while the module chunk still loads", async () => {
    const { html, loads } = await serverHtml([
      "branch-first-render",
      "branch.js",
    ])
    expect(loads).toEqual(["branch-first-render"])
    expect(html).toContain('aria-label="Previous branch"')
    expect(html).toContain('aria-label="Next branch"')
    expect(html).toMatch(pageCount(2, 3))
    expect(html).toMatch(visible("Second"))
  })

  it("renders the selector and page count once the module is loaded", async () => {
    const { html, loads } = await serverHtml([])
    expect(loads).toEqual([])
    expect(html).toContain('aria-label="Next branch"')
    expect(html).toMatch(pageCount(2, 3))
    expect(html).toMatch(hidden("First"))
  })
})
