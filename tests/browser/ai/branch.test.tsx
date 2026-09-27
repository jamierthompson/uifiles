import {
  Component,
  type ComponentProps,
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
  StrictMode,
  useState,
} from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
} from "@/registry/ai/branch"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

/** Records a render error instead of unmounting the whole test tree. */
class Boundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? (
      <div data-testid="crash">{this.state.error.message}</div>
    ) : (
      this.props.children
    )
  }
}

const answers = ["First answer", "Second answer", "Third answer"]

type DemoProps = ComponentProps<typeof MessageBranch> & {
  contentProps?: ComponentProps<typeof MessageBranchContent> | undefined
}

function Demo({ contentProps, children, ...branchProps }: DemoProps) {
  return (
    <main>
      <MessageBranch {...branchProps}>
        <MessageBranchContent {...contentProps}>
          {children ?? answers.map((answer) => <p key={answer}>{answer}</p>)}
        </MessageBranchContent>
        <MessageBranchSelector>
          <MessageBranchPrevious />
          <MessageBranchPage />
          <MessageBranchNext />
        </MessageBranchSelector>
      </MessageBranch>
    </main>
  )
}

/** A branch with its own state, to show a branch keeps its identity. */
function Note({ label }: { label: string }) {
  const [value, setValue] = useState("")
  return (
    <label>
      {label}
      <input onChange={(event) => setValue(event.target.value)} value={value} />
    </label>
  )
}

/** Branch texts whose wrapper is laid out (display: none wrappers have no offsetParent). */
function visibleAnswers() {
  return answers.filter((answer) => {
    const el = [...document.querySelectorAll("p")].find(
      (p) => p.textContent === answer
    )
    return el?.offsetParent !== null && el !== undefined
  })
}

/**
 * A client component as the Flight client hands it over when a Server
 * Component renders it: the element type is a lazy wrapper around the
 * module export, which React resolves when it mounts the element.
 */
const clientReference = <T,>(component: T) =>
  ({
    $$typeof: Symbol.for("react.lazy"),
    _payload: component,
    _init: (payload: T) => payload,
  }) as unknown as T

/** The branch tree built from client references, as a Server Component would. */
const serverComponentTree = () =>
  createElement(
    clientReference(MessageBranch),
    { defaultBranch: 1 },
    createElement(
      clientReference(MessageBranchContent),
      null,
      answers.map((answer) => <p key={answer}>{answer}</p>)
    ),
    createElement(
      clientReference(MessageBranchSelector),
      null,
      createElement(clientReference(MessageBranchPrevious)),
      createElement(clientReference(MessageBranchPage)),
      createElement(clientReference(MessageBranchNext))
    )
  )

const claimedByReact = (element: Element | null) =>
  element !== null &&
  Object.keys(element).some((key) => key.startsWith("__reactFiber$"))

afterEach(() => {
  vi.restoreAllMocks()
})

describe("messageBranch", () => {
  it("renders children", async () => {
    const screen = await render(
      <main>
        <MessageBranch>Content</MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("Content")).toBeVisible()
  })

  it("throws error when components used outside MessageBranch provider", async () => {
    // React reports the caught render error on the console.
    allowConsole("error")
    const screen = await render(
      <main>
        <Boundary>
          <MessageBranchNext />
        </Boundary>
      </main>
    )
    const crash = screen.getByTestId("crash")
    await expect.element(crash).toBeInTheDocument()
    expect(crash.element().textContent).toContain(
      "MessageBranch components must be used within MessageBranch"
    )
  })

  it("calls onBranchChange when branch changes", async () => {
    const onBranchChange = vi.fn()
    const screen = await render(
      <main>
        <MessageBranch onBranchChange={onBranchChange}>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchSelector>
            <MessageBranchPrevious />
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageBranch>
      </main>
    )
    await userEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(onBranchChange).toHaveBeenCalledWith(1)
  })

  it("forwards className and rest props to the root", async () => {
    await render(<Demo className="custom" data-testid="root" />)
    const root = document.querySelector("[data-testid='root']")
    expect(root?.className).toContain("custom")
    expect(root?.className).toContain("grid")
  })

  it("shows the first of three branches with a selector", async () => {
    const screen = await render(<Demo />)

    await expect.element(screen.getByText("First answer")).toBeVisible()
    await expect.element(screen.getByText("Second answer")).not.toBeVisible()
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Previous branch" }))
      .toBeEnabled()
    await expect
      .element(screen.getByRole("button", { name: "Next branch" }))
      .toBeEnabled()

    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("navigates with next/previous and wraps around both ways", async () => {
    const onBranchChange = vi.fn()
    const screen = await render(<Demo onBranchChange={onBranchChange} />)
    const next = screen.getByRole("button", { name: "Next branch" })
    const previous = screen.getByRole("button", { name: "Previous branch" })

    await userEvent.click(next)
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    await expect.element(screen.getByText("Second answer")).toBeVisible()
    expect(onBranchChange).toHaveBeenLastCalledWith(1)

    await userEvent.click(previous)
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    expect(onBranchChange).toHaveBeenLastCalledWith(0)

    await userEvent.click(previous)
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    await expect.element(screen.getByText("Third answer")).toBeVisible()
    expect(onBranchChange).toHaveBeenLastCalledWith(2)

    await userEvent.click(next)
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    expect(onBranchChange).toHaveBeenLastCalledWith(0)
    expect(onBranchChange).toHaveBeenCalledTimes(4)
  })

  it("calls the latest onBranchChange after the parent swaps the callback", async () => {
    const first = vi.fn()
    const second = vi.fn()
    const screen = await render(<Demo onBranchChange={first} />)
    await screen.rerender(<Demo onBranchChange={second} />)

    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledExactlyOnceWith(1)
  })

  it("shows the controlled branch and reports changes without switching on its own", async () => {
    const onBranchChange = vi.fn()
    const screen = await render(
      <Demo branch={1} onBranchChange={onBranchChange} />
    )
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    await expect.element(screen.getByText("Second answer")).toBeVisible()

    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    expect(onBranchChange).toHaveBeenCalledExactlyOnceWith(2)
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Second answer"])

    await screen.rerender(<Demo branch={2} onBranchChange={onBranchChange} />)
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Third answer"])
  })

  it("follows a parent that stores the branch in state", async () => {
    function Controlled() {
      const [branch, setBranch] = useState(0)
      return <Demo branch={branch} onBranchChange={setBranch} />
    }
    const screen = await render(<Controlled />)
    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    await userEvent.click(
      screen.getByRole("button", { name: "Previous branch" })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Previous branch" })
    )
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Third answer"])
  })

  it("clamps a defaultBranch past the end to the last branch", async () => {
    const screen = await render(<Demo defaultBranch={7} />)
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Third answer"])

    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["First answer"])
  })

  it("clamps a negative defaultBranch to the first branch", async () => {
    const screen = await render(<Demo defaultBranch={-2} />)
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["First answer"])
  })

  it("clamps a controlled branch that is out of range and tells the parent once", async () => {
    const onBranchChange = vi.fn()
    const screen = await render(
      <Demo branch={9} onBranchChange={onBranchChange} />
    )
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Third answer"])
    expect(onBranchChange).toHaveBeenCalledExactlyOnceWith(2)
  })

  it("tells a controlled parent once when the list shrinks below its branch", async () => {
    const onBranchChange = vi.fn()
    const ui = (count: number) => (
      <main>
        <MessageBranch branch={2} onBranchChange={onBranchChange}>
          <MessageBranchContent>
            {answers.slice(0, count).map((answer) => (
              <p key={answer}>{answer}</p>
            ))}
          </MessageBranchContent>
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    const screen = await render(ui(3))
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    expect(onBranchChange).not.toHaveBeenCalled()

    await screen.rerender(ui(2))
    await expect.element(screen.getByText("2 of 2")).toBeVisible()
    await expect.element(screen.getByText("Second answer")).toBeVisible()
    expect(onBranchChange).toHaveBeenCalledExactlyOnceWith(1)

    // A parent that ignores the report is not asked again.
    await screen.rerender(ui(2))
    expect(onBranchChange).toHaveBeenCalledTimes(1)
  })

  it("keeps a controlled parent's state in step with the clamped branch", async () => {
    function Controlled({ count }: { count: number }) {
      const [branch, setBranch] = useState(2)
      return (
        <main>
          <MessageBranch branch={branch} onBranchChange={setBranch}>
            <MessageBranchContent>
              {answers.slice(0, count).map((answer) => (
                <p key={answer}>{answer}</p>
              ))}
            </MessageBranchContent>
            <MessageBranchPage />
          </MessageBranch>
          <span data-testid="held">{branch}</span>
        </main>
      )
    }
    const screen = await render(<Controlled count={3} />)
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    await expect.element(screen.getByTestId("held")).toHaveTextContent("2")

    await screen.rerender(<Controlled count={2} />)
    await expect.element(screen.getByText("2 of 2")).toBeVisible()
    await expect.element(screen.getByTestId("held")).toHaveTextContent("1")
  })

  it("reports a controlled clamp once under StrictMode's replayed effects", async () => {
    const onBranchChange = vi.fn()
    const screen = await render(
      <StrictMode>
        <Demo branch={9} onBranchChange={onBranchChange} />
      </StrictMode>
    )
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    await expect.poll(() => onBranchChange.mock.calls).toEqual([[2]])
  })

  it("reports the same clamp again after the parent adopted it and asks for the branch once more", async () => {
    function Controlled() {
      const [branch, setBranch] = useState(9)
      return (
        <main>
          <MessageBranch branch={branch} onBranchChange={setBranch}>
            <MessageBranchContent>
              {answers.map((answer) => (
                <p key={answer}>{answer}</p>
              ))}
            </MessageBranchContent>
            <MessageBranchPage />
          </MessageBranch>
          <button onClick={() => setBranch(9)} type="button">
            Ask for branch 10
          </button>
          <span data-testid="held">{branch}</span>
        </main>
      )
    }
    const screen = await render(<Controlled />)
    await expect.element(screen.getByTestId("held")).toHaveTextContent("2")
    await userEvent.click(
      screen.getByRole("button", { name: "Ask for branch 10" })
    )
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    await expect.element(screen.getByTestId("held")).toHaveTextContent("2")
  })

  it("does not report a clamp while there is no content to clamp against", async () => {
    const onBranchChange = vi.fn()
    const screen = await render(
      <main>
        <MessageBranch branch={2} onBranchChange={onBranchChange}>
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("0 of 0")).toBeVisible()
    expect(onBranchChange).not.toHaveBeenCalled()
  })

  it("clamps the current branch when branches are removed", async () => {
    const screen = await render(<Demo defaultBranch={2} />)
    await expect.element(screen.getByText("3 of 3")).toBeVisible()

    await screen.rerender(
      <Demo defaultBranch={2}>
        <p key="First answer">First answer</p>
        <p key="Second answer">Second answer</p>
      </Demo>
    )
    await expect.element(screen.getByText("2 of 2")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Second answer"])
  })

  it("returns to the remembered uncontrolled index when a removed branch comes back", async () => {
    const ui = (count: number) => (
      <Demo defaultBranch={2}>
        {answers.slice(0, count).map((answer) => (
          <p key={answer}>{answer}</p>
        ))}
      </Demo>
    )
    const screen = await render(ui(3))
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    await screen.rerender(ui(2))
    await expect.element(screen.getByText("2 of 2")).toBeVisible()
    await screen.rerender(ui(3))
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    await expect.element(screen.getByText("Third answer")).toBeVisible()
  })
})

describe("messageBranchContent", () => {
  it("renders active branch", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("Branch 1")).toBeVisible()
    await expect.element(screen.getByText("Branch 2")).not.toBeVisible()
  })

  it("keeps only the active branch visible when className is set", async () => {
    const screen = await render(<Demo contentProps={{ className: "p-2" }} />)
    await expect.element(screen.getByText("First answer")).toBeVisible()
    expect(visibleAnswers()).toEqual(["First answer"])
    const wrapper = screen.getByText("First answer").element().parentElement
    expect(wrapper?.className).toContain("p-2")
    expect(wrapper?.className).toContain("block")
  })

  it("keeps only the active branch visible when className is undefined", async () => {
    const screen = await render(
      <Demo contentProps={{ className: undefined }} />
    )
    await expect.element(screen.getByText("First answer")).toBeVisible()
    expect(visibleAnswers()).toEqual(["First answer"])
  })

  it("forwards rest props to every branch wrapper", async () => {
    await render(
      <Demo
        contentProps={
          { "data-testid": "branch" } as ComponentProps<
            typeof MessageBranchContent
          >
        }
      />
    )
    expect(document.querySelectorAll("[data-testid='branch']")).toHaveLength(3)
  })

  it("ignores null, undefined and boolean children when counting branches", async () => {
    const showExtra = false
    const screen = await render(
      <Boundary>
        <Demo>
          <p key="a">Only answer</p>
          {showExtra ? <p key="b">Extra</p> : null}
          {showExtra && <p key="c">Extra</p>}
          {undefined}
        </Demo>
      </Boundary>
    )
    expect(screen.getByTestId("crash").query()).toBeNull()
    await expect.element(screen.getByText("Only answer")).toBeVisible()
    expect(screen.getByRole("button").query()).toBeNull()
  })

  it("counts a fragment child as one branch", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <Fragment key="pair">
              <p>Alpha</p>
              <p>Beta</p>
            </Fragment>
          </MessageBranchContent>
          <MessageBranchPage />
          <MessageBranchSelector>
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("1 of 1")).toBeVisible()
    await expect.element(screen.getByText("Alpha")).toBeVisible()
    await expect.element(screen.getByText("Beta")).toBeVisible()
    expect(screen.getByRole("button").query()).toBeNull()
  })

  it("keys unkeyed children without a key warning", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <p>Alpha</p>
            <p>Beta</p>
          </MessageBranchContent>
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("1 of 2")).toBeVisible()
  })

  it("resolves lazy (Server Component) children without a key warning", async () => {
    // Children rendered by a Server Component reach a client component as
    // lazy nodes whose payload resolves to the keyed element.
    const lazyNode = (element: ReactElement) =>
      ({
        $$typeof: Symbol.for("react.lazy"),
        _payload: element,
        _init: (payload: ReactElement) => payload,
      }) as unknown as ReactNode
    const screen = await render(
      <Demo>
        {lazyNode(<p key="concise">Concise</p>)}
        {lazyNode(<p key="detailed">Detailed</p>)}
      </Demo>
    )
    await expect.element(screen.getByText("Concise")).toBeVisible()
    await expect.element(screen.getByText("Detailed")).not.toBeVisible()
    await expect.element(screen.getByText("1 of 2")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    await expect.element(screen.getByText("Detailed")).toBeVisible()
  })

  it("hides inactive branches with display:none and keeps focus on the control after navigating", async () => {
    const screen = await render(<Demo />)
    const next = screen.getByRole("button", { name: "Next branch" })
    await userEvent.click(next)
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    const hidden = screen.getByText("First answer").element()
    expect(getComputedStyle(hidden.parentElement as HTMLElement).display).toBe(
      "none"
    )
    expect(document.activeElement).toBe(next.element())
  })

  it("keeps a branch mounted with its state while the user navigates away and back", async () => {
    const screen = await render(
      <Demo>
        <Note key="a" label="A" />
        <Note key="b" label="B" />
      </Demo>
    )
    const inputA = screen.getByRole("textbox", { name: "A" })
    await userEvent.fill(inputA, "kept")
    const wrapperBefore = inputA.element().closest("main > div > div")
    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    await expect.element(screen.getByText("2 of 2")).toBeVisible()
    await userEvent.click(
      screen.getByRole("button", { name: "Previous branch" })
    )
    await expect.element(screen.getByText("1 of 2")).toBeVisible()
    await expect.element(inputA).toHaveValue("kept")
    expect(inputA.element().closest("main > div > div")).toBe(wrapperBefore)
  })

  it("is counted through a wrapping element or fragment", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <div>
            <Fragment key="inner">
              <MessageBranchContent>
                {answers.map((answer) => (
                  <p key={answer}>{answer}</p>
                ))}
              </MessageBranchContent>
            </Fragment>
          </div>
          <MessageBranchSelector>
            <MessageBranchPage />
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Second answer"])
  })

  it("is counted after mount when a custom component renders it, and uncounted when that unmounts", async () => {
    function Answers() {
      return (
        <MessageBranchContent>
          {answers.map((answer) => (
            <p key={answer}>{answer}</p>
          ))}
        </MessageBranchContent>
      )
    }
    const ui = (withContent: boolean) => (
      <main>
        <MessageBranch>
          {withContent ? <Answers /> : null}
          <MessageBranchSelector>
            <MessageBranchNext />
          </MessageBranchSelector>
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    const screen = await render(ui(true))
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    expect(visibleAnswers()).toEqual(["Second answer"])

    await screen.rerender(ui(false))
    await expect.element(screen.getByText("0 of 0")).toBeVisible()
    expect(screen.getByRole("button").query()).toBeNull()
  })

  it("resets the count when the content unmounts so the selector hides and the page reads 0 of 0", async () => {
    const ui = (withContent: boolean) => (
      <main>
        <MessageBranch>
          {withContent ? (
            <MessageBranchContent>
              {answers.map((answer) => (
                <p key={answer}>{answer}</p>
              ))}
            </MessageBranchContent>
          ) : null}
          <MessageBranchSelector>
            <MessageBranchNext />
          </MessageBranchSelector>
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    const screen = await render(ui(true))
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Next branch" }))
      .toBeVisible()
    await screen.rerender(ui(false))
    await expect.element(screen.getByText("0 of 0")).toBeVisible()
    expect(screen.getByRole("button").query()).toBeNull()
  })
})

describe("server rendering", () => {
  it("shows the selector for content a Server Component hands over as client references", async () => {
    const screen = await render(<main>{serverComponentTree()}</main>)
    await expect.element(screen.getByText("2 of 3")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Next branch" }))
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
    await expect.element(screen.getByText("Third answer")).toBeVisible()
  })

  it("renders client references' selector on the server and hydrates it without a warning", async () => {
    // The console guard fails the test on a hydration mismatch.
    const html = renderToString(serverComponentTree())
    expect(html).toContain('aria-label="Next branch"')
    expect(html).toMatch(/>2<!-- --> of <!-- -->3</)

    const container = document.createElement("main")
    document.body.append(container)
    container.innerHTML = html
    const root = hydrateRoot(container, serverComponentTree())
    try {
      const next = container.querySelector<HTMLButtonElement>(
        "[aria-label='Next branch']"
      )
      expect(next).not.toBeNull()
      await expect.poll(() => claimedByReact(next)).toBe(true)
      next?.click()
      await expect.poll(() => container.textContent).toContain("3 of 3")
    } finally {
      root.unmount()
      container.remove()
    }
  })

  it("renders the selector and page count on the server and hydrates them without a warning", async () => {
    // The console guard fails the test on a hydration mismatch.
    const tree = (
      <MessageBranch defaultBranch={1}>
        <MessageBranchContent>
          {answers.map((answer) => (
            <p key={answer}>{answer}</p>
          ))}
        </MessageBranchContent>
        <MessageBranchSelector>
          <MessageBranchPrevious />
          <MessageBranchPage />
          <MessageBranchNext />
        </MessageBranchSelector>
      </MessageBranch>
    )
    const html = renderToString(tree)
    expect(html).toContain('aria-label="Previous branch"')
    expect(html).toContain('aria-label="Next branch"')
    expect(html).toMatch(/>2<!-- --> of <!-- -->3</)
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*"><p>First answer<\/p>/)
    expect(html).toMatch(/class="[^"]*\bblock\b[^"]*"><p>Second answer<\/p>/)

    const container = document.createElement("main")
    document.body.append(container)
    container.innerHTML = html
    const root = hydrateRoot(container, tree)
    try {
      const next = container.querySelector<HTMLButtonElement>(
        "[aria-label='Next branch']"
      )
      expect(next).not.toBeNull()
      await expect.poll(() => claimedByReact(next)).toBe(true)
      next?.click()
      await expect.poll(() => container.textContent).toContain("3 of 3")
    } finally {
      root.unmount()
      container.remove()
    }
  })
})

describe("messageBranchSelector", () => {
  it("hides when only one branch", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Single Branch</div>
          </MessageBranchContent>
          <MessageBranchSelector>
            <span>Selector</span>
          </MessageBranchSelector>
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("Single Branch")).toBeVisible()
    expect(screen.getByText("Selector").query()).toBeNull()
  })

  it("shows when multiple branches", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchSelector>
            <span>Selector</span>
          </MessageBranchSelector>
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("Selector")).toBeVisible()
  })

  it("hides the selector when there is a single branch", async () => {
    const screen = await render(
      <Demo>
        <p key="only">Only answer</p>
      </Demo>
    )
    await expect.element(screen.getByText("Only answer")).toBeVisible()
    expect(screen.getByRole("button").query()).toBeNull()
    await expectNoViolations()
  })

  it("hides with no content and the page reads 0 of 0", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchSelector>
            <span>Selector</span>
          </MessageBranchSelector>
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("0 of 0")).toBeVisible()
    expect(screen.getByText("Selector").query()).toBeNull()
  })

  it("renders a button group and merges className", async () => {
    const screen = await render(
      <Demo>
        <p key="a">A</p>
        <p key="b">B</p>
      </Demo>
    )
    await screen.rerender(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <p key="a">A</p>
            <p key="b">B</p>
          </MessageBranchContent>
          <MessageBranchSelector aria-label="Branches" className="custom">
            <MessageBranchPrevious />
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageBranch>
      </main>
    )
    const group = screen.getByRole("group", { name: "Branches" })
    await expect.element(group).toBeVisible()
    expect(group.element().className).toContain("custom")
  })
})

describe("messageBranchPrevious", () => {
  it("renders previous button", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchPrevious />
        </MessageBranch>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /previous/i }))
      .toBeEnabled()
  })

  it("navigates to previous branch", async () => {
    const screen = await render(
      <main>
        <MessageBranch defaultBranch={1}>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchPrevious />
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("2 of 2")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /previous/i }))
    await expect.element(screen.getByText("1 of 2")).toBeVisible()
  })

  it("wraps to last branch when clicking previous on first branch", async () => {
    const screen = await render(
      <main>
        <MessageBranch defaultBranch={0}>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
            <div key="3">Branch 3</div>
          </MessageBranchContent>
          <MessageBranchPrevious />
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("1 of 3")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /previous/i }))
    await expect.element(screen.getByText("3 of 3")).toBeVisible()
  })

  it("is disabled outside a selector when there is one branch", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Only</div>
          </MessageBranchContent>
          <MessageBranchPrevious />
          <MessageBranchNext />
        </MessageBranch>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: "Previous branch" }))
      .toBeDisabled()
    await expect
      .element(screen.getByRole("button", { name: "Next branch" }))
      .toBeDisabled()
  })

  it("renders custom children and forwards button props", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchPrevious className="custom" variant="outline">
            Back
          </MessageBranchPrevious>
          <MessageBranchNext aria-label="Forward" className="custom" />
        </MessageBranch>
      </main>
    )
    // The default aria-label stays the accessible name; children only replace the icon.
    const back = screen.getByRole("button", { name: "Previous branch" })
    await expect.element(back).toHaveTextContent("Back")
    expect(back.element().className).toContain("custom")
    expect(back.element().querySelector("svg")).toBeNull()
    await expect
      .element(screen.getByRole("button", { name: "Forward" }))
      .toBeVisible()
  })
})

describe("messageBranchNext", () => {
  it("renders next button", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchNext />
        </MessageBranch>
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /next/i }))
      .toBeEnabled()
  })

  it("wraps to the first branch when clicking next on the last branch", async () => {
    const screen = await render(
      <main>
        <MessageBranch defaultBranch={1}>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchNext />
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("2 of 2")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /next/i }))
    await expect.element(screen.getByText("1 of 2")).toBeVisible()
    await expect.element(screen.getByText("Branch 1")).toBeVisible()
  })
})

describe("messageBranchPage", () => {
  it("displays current page count", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchPage />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByText("1 of 2")).toBeVisible()
  })

  it("merges className and forwards rest props", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchPage className="custom" data-testid="page" />
        </MessageBranch>
      </main>
    )
    const page = screen.getByTestId("page")
    await expect.element(page).toHaveTextContent("1 of 2")
    expect(page.element().className).toContain("custom")
    expect(page.element().className).toContain("text-muted-foreground")
  })

  it("renders a div by default and another element through the render prop", async () => {
    const screen = await render(
      <main>
        <MessageBranch>
          <MessageBranchContent>
            <div key="1">Branch 1</div>
            <div key="2">Branch 2</div>
          </MessageBranchContent>
          <MessageBranchPage data-testid="div" />
          <MessageBranchPage data-testid="span" render={<span />} />
        </MessageBranch>
      </main>
    )
    await expect.element(screen.getByTestId("span")).toHaveTextContent("1 of 2")
    expect(screen.getByTestId("div").element().tagName).toBe("DIV")
    expect(screen.getByTestId("span").element().tagName).toBe("SPAN")
  })
})
