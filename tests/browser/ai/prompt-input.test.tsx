import { BrainIcon, GlobeIcon, MicIcon, SparklesIcon } from "lucide-react"
import { act, type ReactNode, StrictMode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  type PromptInputActionAddAttachmentsProps,
  PromptInputActionAddScreenshot,
  type PromptInputActionAddScreenshotProps,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  type PromptInputActionMenuTriggerProps,
  PromptInputBody,
  PromptInputButton,
  PromptInputCommand,
  PromptInputCommandEmpty,
  PromptInputCommandGroup,
  PromptInputCommandInput,
  PromptInputCommandItem,
  PromptInputCommandList,
  PromptInputCommandSeparator,
  type PromptInputError,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputHoverCard,
  PromptInputHoverCardContent,
  PromptInputHoverCardTrigger,
  type PromptInputProps,
  PromptInputProvider,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  type PromptInputSelectProps,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  type PromptInputSubmitProps,
  PromptInputTab,
  PromptInputTabBody,
  PromptInputTabItem,
  PromptInputTabLabel,
  PromptInputTabsList,
  PromptInputTextarea,
  type PromptInputTextareaProps,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  usePromptInputReferencedSources,
  useProviderAttachments,
} from "@/registry/ai/prompt-input"
import { expectNoViolations, runAxe, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type OnSubmit = PromptInputProps["onSubmit"]

/**
 * Polls until `read()` returns `expected`, then keeps sampling for a short
 * bounded window and fails if it changes. The positive half is a poll; the
 * hold is for "and nothing else happens" assertions, which have no event to
 * wait for.
 */
async function settled<T>(read: () => T, expected: T, holdMs = 100) {
  await expect.poll(read).toBe(expected)
  const until = performance.now() + holdMs
  while (performance.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(read()).toBe(expected)
  }
}

/** A promise the test settles by hand, for submits that must stay pending. */
function deferred() {
  let resolve = () => {}
  let reject = (_reason: unknown) => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, reject, resolve }
}

/** Fakes timers and the clock only, leaving React's scheduler alone. */
function useFakeTimers() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  })
}

/**
 * Runs `fn` inside React's act. vitest-browser-react only flags the act
 * environment during its own render/rerender calls, so it is set here too.
 */
async function inAct(fn: () => void): Promise<void> {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean | undefined }
  const previous = env.IS_REACT_ACT_ENVIRONMENT
  env.IS_REACT_ACT_ENVIRONMENT = true
  try {
    await act(async () => {
      fn()
    })
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = previous
  }
}

/** Advances the fake clock inside act so React flushes the resulting updates. */
const advance = (ms: number) => inAct(() => vi.advanceTimersByTime(ms))

/**
 * Moves the mouse onto `element` while timers are faked (userEvent cannot be
 * awaited then): the enter and move events Base UI's hover interaction reads.
 */
const hoverNative = (element: Element) =>
  inAct(() => {
    element.dispatchEvent(
      new PointerEvent("pointerenter", { pointerType: "mouse" })
    )
    element.dispatchEvent(new MouseEvent("mouseenter"))
    element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
  })

const makeFile = (name: string, type: string, size = 4) =>
  new File([new Uint8Array(size)], name, { type })

const toDataTransfer = (files: File[]) => {
  const dt = new DataTransfer()
  for (const file of files) {
    dt.items.add(file)
  }
  return dt
}

const fileInput = () => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) {
    throw new Error("hidden file input not rendered")
  }
  return input
}

/** Puts files on the hidden <input type="file"> and fires the native change event. */
const chooseFiles = (files: File[]) => {
  const input = fileInput()
  input.files = toDataTransfer(files).files
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

const pasteFiles = (target: Element, files: File[]) =>
  target.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: toDataTransfer(files),
    })
  )

const dispatchDrag = (
  target: EventTarget,
  type: "dragover" | "drop",
  dataTransfer: DataTransfer
) =>
  target.dispatchEvent(
    new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer })
  )

const dropFiles = (target: EventTarget, files: File[]) =>
  dispatchDrag(target, "drop", toDataTransfer(files))

const textDataTransfer = (text: string) => {
  const dt = new DataTransfer()
  dt.setData("text/plain", text)
  return dt
}

const textarea = () => page.getByRole("textbox", { name: "Message" })
const textareaEl = () => {
  const el = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="message"]'
  )
  if (!el) {
    throw new Error("textarea not rendered")
  }
  return el
}
const formEl = () => {
  const form = document.querySelector("form")
  if (!form) {
    throw new Error("form not rendered")
  }
  return form
}
const count = () => document.querySelector('[data-testid="count"]')?.textContent
const sourcesCount = () =>
  document.querySelector('[data-testid="sources-count"]')?.textContent
const attachmentUrls = () =>
  Array.from(document.querySelectorAll("li[data-url]")).map(
    (li) => li.getAttribute("data-url") ?? ""
  )
/** Accessible name (or tag) of the focused element, for readable assertions. */
const describeActive = () =>
  document.activeElement?.getAttribute("aria-label") ??
  document.activeElement?.tagName ??
  "none"
const submitButton = () => page.getByRole("button", { name: "Submit" })
const stopButton = () => page.getByRole("button", { name: "Stop" })
const menuTrigger = () => page.getByRole("button", { name: "Add attachment" })
const menuItem = (name: string) => page.getByRole("menuitem", { name })
const menuPopup = () =>
  document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')
const tooltipText = () =>
  document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? ""
/** The select trigger's text, which also holds the chevron icon's fallback glyph. */
const comboText = (name: string) =>
  page.getByRole("combobox", { name }).element().textContent ?? ""

const claude = { label: "Claude Sonnet 4", value: "claude-sonnet-4" }
const gpt = { label: "GPT-5", value: "gpt-5" }
const models = [claude, gpt]

const source = (n = 1) => ({
  mediaType: "text/plain",
  sourceId: `s${n}`,
  title: n === 1 ? "Test Source" : `Source ${n}`,
  type: "source-document" as const,
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Lists the attachments from context the way a consumer would (shadcn
 * Attachment), with remove buttons and optional "Add <name>" buttons that
 * push a batch through `attachments.add`.
 */
function AttachmentList({ batches }: { batches?: Record<string, File[]> }) {
  const attachments = usePromptInputAttachments()
  return (
    <div>
      <span data-testid="count">{attachments.files.length}</span>
      {batches
        ? Object.entries(batches).map(([name, files]) => (
            <button
              key={name}
              onClick={() => attachments.add(files)}
              type="button"
            >
              Add {name}
            </button>
          ))
        : null}
      <button onClick={attachments.clear} type="button">
        Clear all
      </button>
      <button onClick={attachments.openFileDialog} type="button">
        Open dialog
      </button>
      <ul>
        {attachments.files.map((file) => {
          const isImage = file.mediaType.startsWith("image/")
          return (
            <li data-url={file.url} key={file.id}>
              <Attachment size="sm">
                <AttachmentMedia variant={isImage ? "image" : "icon"}>
                  {isImage ? (
                    // biome-ignore lint/performance/noImgElement: a plain preview of a fake file, not a page asset
                    <img alt={file.filename} src={file.url} />
                  ) : null}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{file.filename}</AttachmentTitle>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remove ${file.filename}`}
                    onClick={() => attachments.remove(file.id)}
                  >
                    x
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SourceList() {
  const refs = usePromptInputReferencedSources()
  return (
    <div>
      <span data-testid="sources-count">{refs.sources.length}</span>
      <button onClick={() => refs.add(source())} type="button">
        Add source
      </button>
      <button onClick={() => refs.add([source(1), source(2)])} type="button">
        Add sources
      </button>
      <ul>
        {refs.sources.map((s) => (
          <li key={s.id}>
            <span>{s.title}</span>
            <button
              aria-label={`Remove ${s.title}`}
              onClick={() => refs.remove(s.id)}
              type="button"
            >
              x
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

type ComposerProps = {
  input?: Partial<Omit<PromptInputProps, "children">>
  submit?: PromptInputSubmitProps
  withSubmit?: boolean
  textarea?: PromptInputTextareaProps
  withSources?: boolean
  withSelect?: boolean
  select?: PromptInputSelectProps
  batches?: Record<string, File[]>
  menuTrigger?: PromptInputActionMenuTriggerProps
  addAttachments?: PromptInputActionAddAttachmentsProps
  screenshot?: PromptInputActionAddScreenshotProps
  menuItemOnClick?: () => void
  tools?: ReactNode
}

// Rendered inside <main> so axe's "region" rule sees a landmark, as on a real page.
function Composer({
  input,
  submit,
  withSubmit = true,
  textarea: textareaProps,
  withSources,
  withSelect = true,
  select,
  batches,
  menuTrigger: menuTriggerProps,
  addAttachments,
  screenshot,
  menuItemOnClick,
  tools,
}: ComposerProps) {
  return (
    <main>
      <PromptInput onSubmit={() => {}} {...input}>
        <PromptInputHeader>
          <AttachmentList {...(batches ? { batches } : {})} />
          {withSources ? <SourceList /> : null}
        </PromptInputHeader>
        <PromptInputBody>
          <PromptInputTextarea {...textareaProps} />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                aria-label="Add attachment"
                {...menuTriggerProps}
              />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments {...addAttachments} />
                <PromptInputActionAddScreenshot {...screenshot} />
                {menuItemOnClick ? (
                  <PromptInputActionMenuItem onClick={menuItemOnClick}>
                    Custom action
                  </PromptInputActionMenuItem>
                ) : null}
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            {tools}
            {withSelect ? (
              <PromptInputSelect
                defaultValue={claude.value}
                items={models}
                {...select}
              >
                <PromptInputSelectTrigger aria-label="Model">
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((model) => (
                    <PromptInputSelectItem
                      key={model.value}
                      value={model.value}
                    >
                      {model.label}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            ) : null}
          </PromptInputTools>
          {withSubmit ? <PromptInputSubmit {...submit} /> : null}
        </PromptInputFooter>
      </PromptInput>
    </main>
  )
}

/** Minimal upstream-style composition: form, textarea and submit only. */
function Bare({
  onSubmit = () => {},
  children,
  withSubmit = true,
}: {
  onSubmit?: OnSubmit
  children?: ReactNode
  withSubmit?: boolean
}) {
  return (
    <main>
      <PromptInput onSubmit={onSubmit}>
        <PromptInputBody>
          {children}
          <PromptInputTextarea />
          {withSubmit ? <PromptInputSubmit /> : null}
        </PromptInputBody>
      </PromptInput>
    </main>
  )
}

const mockDisplayMedia = ({
  videoWidth = 64,
  videoHeight = 32,
  blob = new Blob(["png"], { type: "image/png" }),
}: { videoWidth?: number; videoHeight?: number; blob?: Blob | null } = {}) => {
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {},
      writable: true,
    })
  }
  if (!("getDisplayMedia" in navigator.mediaDevices)) {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    })
  }
  const stopTrack = vi.fn()
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream
  const getDisplayMedia = vi
    .spyOn(navigator.mediaDevices, "getDisplayMedia")
    .mockResolvedValue(stream)

  const originalCreateElement = document.createElement.bind(document)
  const video = originalCreateElement("video")
  const canvas = originalCreateElement("canvas")
  const play = vi.spyOn(video, "play").mockResolvedValue()
  const pause = vi.spyOn(video, "pause").mockImplementation(() => {})
  Object.defineProperty(video, "videoWidth", {
    configurable: true,
    value: videoWidth,
  })
  Object.defineProperty(video, "videoHeight", {
    configurable: true,
    value: videoHeight,
  })
  let srcObject: unknown = null
  Object.defineProperty(video, "srcObject", {
    configurable: true,
    get: () => srcObject,
    set: (value) => {
      srcObject = value
      if (value) {
        setTimeout(
          () => video.onloadedmetadata?.(new Event("loadedmetadata")),
          0
        )
      }
    },
  })
  vi.spyOn(canvas, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  const toBlob = vi
    .spyOn(canvas, "toBlob")
    .mockImplementation((callback) => callback?.(blob))
  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName === "video") {
      return video
    }
    if (tagName === "canvas") {
      return canvas
    }
    return originalCreateElement(tagName as keyof HTMLElementTagNameMap)
  }) as typeof document.createElement)

  return { getDisplayMedia, pause, play, stopTrack, toBlob, video }
}

const openMenu = async () => {
  await menuTrigger().click()
  await expect.element(menuItem("Add photos or files")).toBeVisible()
}

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await page.viewport(414, 896)
})

// ---------------------------------------------------------------------------
// PromptInput
// ---------------------------------------------------------------------------

describe("PromptInput", () => {
  it("renders a form around an input group and forwards className and rest props to the form", async () => {
    await render(
      <main>
        <PromptInput
          className="custom-form"
          data-testid="composer"
          onSubmit={() => {}}
        >
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
        </PromptInput>
      </main>
    )
    const form = formEl()
    expect(form.getAttribute("data-testid")).toBe("composer")
    expect(form.classList.contains("custom-form")).toBe(true)
    expect(form.classList.contains("w-full")).toBe(true)
    expect(form.querySelector('[data-slot="input-group"]')).not.toBeNull()
  })

  it("calls onSubmit with the message and the submit event", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Bare onSubmit={onSubmit} />)
    await textarea().fill("Hello")
    expect(textareaEl().value).toBe("Hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ files: [], text: "Hello" })
    expect(onSubmit.mock.calls[0]?.[1].type).toBe("submit")
  })

  it("clears the textarea after form submission - #125", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Bare onSubmit={onSubmit} />)
    await textarea().fill("Hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await expect.element(textarea()).toHaveValue("")
  })

  it("does not lose user input typed immediately after submission - #125", async () => {
    const pending = deferred()
    const onSubmit = vi.fn<OnSubmit>(() => pending.promise)
    await render(<Bare onSubmit={onSubmit} />)
    await textarea().fill("First message")
    await userEvent.keyboard("{Enter}")
    // Cleared synchronously, before the async submission completes.
    expect(textareaEl().value).toBe("")
    await userEvent.keyboard("Second message")
    expect(textareaEl().value).toBe("Second message")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    pending.resolve()
    await settled(() => textareaEl().value, "Second message")
  })

  it("converts blob URLs to data URLs on submit and strips the internal id - #113", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(
      <Composer input={{ accept: "image/*", multiple: true, onSubmit }} />
    )
    const input = fileInput()
    expect(input.accept).toBe("image/*")
    expect(input.multiple).toBe(true)
    expect(input.getAttribute("aria-label")).toBe("Upload files")

    chooseFiles([makeFile("a.png", "image/png", 3)])
    await expect.poll(count).toBe("1")
    // The input is reset so the same file can be picked again after removal.
    expect(input.value).toBe("")
    expect(attachmentUrls()[0]?.startsWith("blob:")).toBe(true)

    await submitButton().click()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    const message = onSubmit.mock.calls[0]?.[0]
    expect(message?.text).toBe("")
    expect(message?.files).toHaveLength(1)
    const [file] = message?.files ?? []
    expect(file).toMatchObject({
      filename: "a.png",
      mediaType: "image/png",
      type: "file",
    })
    expect(file?.url.startsWith("data:image/png;base64,")).toBe(true)
    expect("id" in (file as object)).toBe(false)
    await expect.poll(count).toBe("0")
  })

  it("keeps the blob URL when the data URL conversion fails", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("offline"))
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Composer input={{ onSubmit }} />)
    chooseFiles([makeFile("a.txt", "text/plain")])
    await expect.poll(count).toBe("1")
    await submitButton().click()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].files[0]?.url.startsWith("blob:")).toBe(
      true
    )
  })

  it("does not clear attachments or referenced sources when onSubmit throws an error - #126", async () => {
    const onSubmit = vi.fn<OnSubmit>(() => {
      throw new Error("Submission failed")
    })
    await render(<Composer input={{ onSubmit }} withSources />)
    chooseFiles([makeFile("test.txt", "text/plain")])
    await page.getByRole("button", { name: "Add source" }).click()
    await expect.poll(count).toBe("1")
    await textarea().fill("test message")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await settled(count, "1")
    await expect.element(page.getByText("test.txt")).toBeVisible()
    await expect.element(page.getByText("Test Source")).toBeVisible()
    expect(sourcesCount()).toBe("1")
  })

  it("does not clear attachments or referenced sources when async onSubmit rejects - #126", async () => {
    const onSubmit = vi.fn<OnSubmit>(() =>
      Promise.reject(new Error("Async submission failed"))
    )
    await render(<Composer input={{ onSubmit }} withSources />)
    chooseFiles([makeFile("test.txt", "text/plain")])
    await page.getByRole("button", { name: "Add source" }).click()
    await expect.poll(count).toBe("1")
    await textarea().fill("test message")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await settled(count, "1")
    expect(sourcesCount()).toBe("1")
  })

  it("clears attachments and referenced sources when async onSubmit resolves - #126", async () => {
    const onSubmit = vi.fn<OnSubmit>(() => Promise.resolve())
    await render(<Composer input={{ onSubmit }} withSources />)
    chooseFiles([makeFile("test.txt", "text/plain")])
    await page.getByRole("button", { name: "Add source" }).click()
    await expect.poll(count).toBe("1")
    await textarea().fill("test message")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await expect.poll(count).toBe("0")
    expect(sourcesCount()).toBe("0")
    await expect.element(page.getByText("test.txt")).not.toBeInTheDocument()
    await expect.element(page.getByText("Test Source")).not.toBeInTheDocument()
  })

  it("clears attachments and referenced sources when a sync onSubmit returns", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Composer input={{ onSubmit }} withSources />)
    chooseFiles([makeFile("test.txt", "text/plain")])
    await page.getByRole("button", { name: "Add source" }).click()
    await expect.poll(count).toBe("1")
    await submitButton().click()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await expect.poll(count).toBe("0")
    expect(sourcesCount()).toBe("0")
  })

  it.each([
    ["local state", false],
    ["a PromptInputProvider", true],
  ])(
    "clears the text as a submit starts and restores it when async onSubmit rejects, unless the user typed since, with %s",
    async (_label, withProvider) => {
      const submits = [deferred(), deferred(), deferred()]
      let attempt = 0
      const onSubmit = vi.fn<OnSubmit>(() => submits[attempt++]?.promise)
      const composer = <Composer input={{ onSubmit }} />
      await render(
        withProvider ? (
          <PromptInputProvider>{composer}</PromptInputProvider>
        ) : (
          composer
        )
      )
      await textarea().fill("please retry me")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
      expect(textareaEl().value).toBe("")
      submits[0]?.reject(new Error("network"))
      await expect.poll(() => textareaEl().value).toBe("please retry me")

      await textarea().fill("second try")
      await userEvent.keyboard("{Enter}")
      await userEvent.keyboard("new draft")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(2)
      submits[1]?.reject(new Error("network"))
      await settled(() => textareaEl().value, "new draft")

      await textarea().fill("third")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(3)
      submits[2]?.resolve()
      await settled(() => textareaEl().value, "")
      expect(onSubmit.mock.calls.map(([message]) => message.text)).toEqual([
        "please retry me",
        "second try",
        "third",
      ])
    }
  )

  it("keeps what the user types while a provider-mode submit is pending, instead of clearing it once the submit is accepted", async () => {
    const pending = deferred()
    const onSubmit = vi.fn<OnSubmit>(() => pending.promise)
    await render(
      <PromptInputProvider>
        <Bare onSubmit={onSubmit} />
      </PromptInputProvider>
    )
    await textarea().fill("First message")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => textareaEl().value).toBe("")
    await userEvent.keyboard("Second message")
    expect(textareaEl().value).toBe("Second message")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("First message")
    pending.resolve()
    await settled(() => textareaEl().value, "Second message")
  })

  it("restores the typed text when a sync onSubmit throws", async () => {
    const onSubmit = vi.fn<OnSubmit>(() => {
      throw new Error("sync failure")
    })
    await render(<Composer input={{ onSubmit }} />)
    await textarea().fill("keep me")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await expect.poll(() => textareaEl().value).toBe("keep me")
  })

  it("restores the edited text of a defaultValue textarea after a failed submit", async () => {
    const onSubmit = vi.fn<OnSubmit>(() => Promise.reject(new Error("no")))
    await render(
      <Composer input={{ onSubmit }} textarea={{ defaultValue: "template" }} />
    )
    await textarea().fill("template plus edits")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await expect.poll(() => textareaEl().value).toBe("template plus edits")
  })

  it("leaves a controlled textarea to its owner after a rejected submit, so the DOM and the consumer's state agree", async () => {
    let draftState = ""
    const onSubmit = vi.fn<OnSubmit>()
    function Controlled() {
      const [draft, setDraft] = useState("")
      const [, bump] = useState(0)
      draftState = draft
      return (
        <main>
          <button onClick={() => bump((n) => n + 1)} type="button">
            rerender
          </button>
          <PromptInput
            onSubmit={async (message, event) => {
              // The preview page's pattern: clear the mirror, then fail.
              setDraft("")
              onSubmit(message, event)
              throw new Error("network")
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                onChange={(event) => setDraft(event.currentTarget.value)}
                value={draft}
              />
              <PromptInputSubmit />
            </PromptInputBody>
          </PromptInput>
        </main>
      )
    }
    await render(<Controlled />)
    await textarea().fill("please retry")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await settled(() => textareaEl().value === draftState, true)
    await page.getByRole("button", { name: "rerender" }).click()
    expect(textareaEl().value).toBe(draftState)
  })

  it.each([
    ["local state", false],
    ["a PromptInputProvider", true],
  ])(
    "clears only what the submit carried once a pending onSubmit resolves, with %s",
    async (_label, withProvider) => {
      const pending = deferred()
      const onSubmit = vi.fn<OnSubmit>(() => pending.promise)
      const composer = <Composer input={{ onSubmit }} withSources />
      await render(
        withProvider ? (
          <PromptInputProvider>{composer}</PromptInputProvider>
        ) : (
          composer
        )
      )
      chooseFiles([makeFile("sent.txt", "text/plain")])
      await page.getByRole("button", { name: "Add source" }).click()
      await expect.poll(count).toBe("1")
      await submitButton().click()
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
      expect(
        onSubmit.mock.calls[0]?.[0].files.map((file) => file.filename)
      ).toEqual(["sent.txt"])

      // Attached while the submit is still pending.
      chooseFiles([makeFile("later.txt", "text/plain")])
      await page.getByRole("button", { name: "Add sources" }).click()
      await expect.poll(count).toBe("2")
      expect(sourcesCount()).toBe("3")

      pending.resolve()
      await expect.poll(count).toBe("1")
      await expect.element(page.getByText("later.txt")).toBeVisible()
      expect(page.getByText("sent.txt").query()).toBeNull()
      expect(sourcesCount()).toBe("2")
      await expect.element(page.getByText("Source 2")).toBeVisible()
    }
  )

  it.each([
    ["local state", false],
    ["a PromptInputProvider", true],
  ])(
    "revokes a file removed while its submit is pending once, not again when the submit is accepted, with %s",
    async (_label, withProvider) => {
      const pending = deferred()
      const onSubmit = vi.fn<OnSubmit>(() => pending.promise)
      const revoke = vi.spyOn(URL, "revokeObjectURL")
      const composer = <Composer input={{ onSubmit }} />
      await render(
        withProvider ? (
          <PromptInputProvider>{composer}</PromptInputProvider>
        ) : (
          composer
        )
      )
      chooseFiles([
        makeFile("gone.txt", "text/plain"),
        makeFile("stays.txt", "text/plain"),
      ])
      await expect.poll(count).toBe("2")
      await submitButton().click()
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)

      await page.getByRole("button", { name: "Remove gone.txt" }).click()
      await expect.poll(count).toBe("1")
      expect(revoke).toHaveBeenCalledTimes(1)

      pending.resolve()
      await settled(count, "0")
      expect(revoke).toHaveBeenCalledTimes(2)
    }
  )

  it.each([
    ["local state", false],
    ["a PromptInputProvider", true],
  ])(
    "carries the text and an attachment through exactly one submit when a second submit lands during the blob conversion, with %s",
    async (_label, withProvider) => {
      const gate = deferred()
      vi.spyOn(window, "fetch").mockImplementation(async () => {
        await gate.promise
        return new Response(new Blob(["x"], { type: "text/plain" }))
      })
      const onSubmit = vi.fn<OnSubmit>()
      const composer = <Composer input={{ onSubmit }} />
      await render(
        withProvider ? (
          <PromptInputProvider>{composer}</PromptInputProvider>
        ) : (
          composer
        )
      )
      chooseFiles([makeFile("once.txt", "text/plain")])
      await expect.poll(count).toBe("1")
      await textarea().fill("hi")

      // Enter, a submit click and a keyboard shortcut all end here; the
      // second arrives in the same tick, while the first is still reading the
      // file as a data URL.
      formEl().requestSubmit()
      formEl().requestSubmit()
      gate.resolve()

      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(2)
      await settled(() => onSubmit.mock.calls.length, 2)
      expect(onSubmit.mock.calls.map(([message]) => message)).toEqual([
        {
          files: [expect.objectContaining({ filename: "once.txt" })],
          text: "hi",
        },
        { files: [], text: "" },
      ])
      await expect.poll(count).toBe("0")
      expect(textareaEl().value).toBe("")
    }
  )

  it.each([
    ["local state", false],
    ["a PromptInputProvider", true],
  ])(
    "leaves a file out of a second submit while an async onSubmit carrying it is pending, and gives back its text and file once that submit is rejected, with %s",
    async (_label, withProvider) => {
      const first = deferred()
      const onSubmit = vi
        .fn<OnSubmit>()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {})
      const composer = <Composer input={{ onSubmit }} />
      await render(
        withProvider ? (
          <PromptInputProvider>{composer}</PromptInputProvider>
        ) : (
          composer
        )
      )
      chooseFiles([makeFile("a.txt", "text/plain")])
      await expect.poll(count).toBe("1")
      await textarea().fill("first")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)

      await textarea().fill("second")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(2)
      expect(onSubmit.mock.calls[1]?.[0]).toEqual({ files: [], text: "second" })
      await settled(count, "1")

      first.reject(new Error("network"))
      await expect.poll(() => textareaEl().value).toBe("first")
      expect(count()).toBe("1")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(3)
      expect(onSubmit.mock.calls[2]?.[0]).toEqual({
        files: [expect.objectContaining({ filename: "a.txt" })],
        text: "first",
      })
      await expect.poll(count).toBe("0")
    }
  )

  it("calls onSubmit in submit order while an earlier submit is still converting its attachments", async () => {
    const gate = deferred()
    vi.spyOn(window, "fetch").mockImplementation(async () => {
      await gate.promise
      return new Response(new Blob(["x"], { type: "text/plain" }))
    })
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Composer input={{ onSubmit }} />)
    chooseFiles([makeFile("slow.txt", "text/plain")])
    await expect.poll(count).toBe("1")
    await textarea().fill("first")
    formEl().requestSubmit()
    await textarea().fill("second")
    formEl().requestSubmit()
    // The text-only second submit has nothing to convert but waits its turn.
    await settled(() => onSubmit.mock.calls.length, 0)

    gate.resolve()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit.mock.calls.map(([message]) => message.text)).toEqual([
      "first",
      "second",
    ])
    expect(onSubmit.mock.calls[1]?.[0].files).toEqual([])
  })

  it.each<[string, OnSubmit]>([
    ["a sync", () => false],
    ["an async", async () => false],
  ])(
    "keeps the draft, attachments and sources when %s onSubmit returns false",
    async (_label, veto) => {
      const onSubmit = vi.fn<OnSubmit>(veto)
      await render(<Composer input={{ onSubmit }} withSources />)
      chooseFiles([makeFile("kept.txt", "text/plain")])
      await page.getByRole("button", { name: "Add source" }).click()
      await expect.poll(count).toBe("1")
      await textarea().fill("not yet")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
      await expect.poll(() => textareaEl().value).toBe("not yet")
      await settled(count, "1")
      expect(sourcesCount()).toBe("1")
      await expect.element(page.getByText("kept.txt")).toBeVisible()
    }
  )

  it("keeps the provider text when onSubmit rejects and clears it when it resolves", async () => {
    let fail = true
    const onSubmit = vi.fn<OnSubmit>(() =>
      fail ? Promise.reject(new Error("network")) : Promise.resolve()
    )
    await render(
      <PromptInputProvider initialInput="seeded">
        <Composer input={{ onSubmit }} />
      </PromptInputProvider>
    )
    expect(textareaEl().value).toBe("seeded")
    await textarea().fill("keep me")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ text: "keep me" })
    await settled(() => textareaEl().value, "keep me")

    fail = false
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(2)
    await expect.element(textarea()).toHaveValue("")
  })

  it("keeps the provider text and the attachments when onSubmit returns false", async () => {
    const onSubmit = vi.fn<OnSubmit>(() => false)
    await render(
      <PromptInputProvider initialInput="draft">
        <Composer input={{ onSubmit }} />
      </PromptInputProvider>
    )
    chooseFiles([makeFile("kept.txt", "text/plain")])
    await expect.poll(count).toBe("1")
    await textarea().click()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("draft")
    await settled(() => textareaEl().value, "draft")
    expect(count()).toBe("1")
  })

  it("does not gate empty or whitespace text; a second Enter sends an empty message", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Composer input={{ onSubmit }} />)
    await textarea().click()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ files: [], text: "" })

    await textarea().fill("   ")
    await userEvent.keyboard("{Enter}{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(3)
    expect(onSubmit.mock.calls[1]?.[0].text).toBe("   ")
    expect(onSubmit.mock.calls[2]?.[0].text).toBe("")
  })

  it("clears the hidden file input when the last attachment goes and syncHiddenInput is set", async () => {
    await render(<Composer input={{ syncHiddenInput: true }} />)
    chooseFiles([makeFile("a.txt", "text/plain")])
    await expect.poll(count).toBe("1")
    const input = fileInput()
    input.files = toDataTransfer([makeFile("stale.txt", "text/plain")]).files
    expect(input.value).not.toBe("")
    await page.getByRole("button", { name: "Remove a.txt" }).click()
    await expect.poll(count).toBe("0")
    await expect.poll(() => input.value).toBe("")
  })

  describe("file validation", () => {
    it("enforces maxFiles limit", async () => {
      const onError = vi.fn()
      const files = [
        makeFile("test1.txt", "text/plain"),
        makeFile("test2.txt", "text/plain"),
        makeFile("test3.txt", "text/plain"),
      ]
      await render(
        <Composer batches={{ files }} input={{ maxFiles: 2, onError }} />
      )
      await page.getByRole("button", { name: "Add files" }).click()
      await expect.poll(count).toBe("2")
      expect(onError).toHaveBeenCalledWith({
        code: "max_files",
        message: expect.any(String),
      })
    })

    it("enforces maxFiles at the boundary and reports a single over-limit file", async () => {
      const onError = vi.fn()
      await render(<Composer input={{ maxFiles: 3, onError }} />)
      chooseFiles([
        makeFile("1.txt", "text/plain"),
        makeFile("2.txt", "text/plain"),
      ])
      await expect.poll(count).toBe("2")
      expect(onError).not.toHaveBeenCalled()

      // exact fit: one slot left, one file
      chooseFiles([makeFile("3.txt", "text/plain")])
      await expect.poll(count).toBe("3")
      expect(onError).not.toHaveBeenCalled()

      // one over: nothing added, one error
      chooseFiles([makeFile("4.txt", "text/plain")])
      await settled(count, "3")
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenLastCalledWith({
        code: "max_files",
        message: expect.any(String),
      })
    })

    it("truncates to the remaining capacity when more files arrive than slots", async () => {
      const onError = vi.fn()
      await render(<Composer input={{ maxFiles: 2, onError }} />)
      chooseFiles([makeFile("1.txt", "text/plain")])
      await expect.poll(count).toBe("1")
      chooseFiles([
        makeFile("2.txt", "text/plain"),
        makeFile("3.txt", "text/plain"),
        makeFile("4.txt", "text/plain"),
      ])
      await expect.poll(count).toBe("2")
      expect(onError).toHaveBeenCalledTimes(1)
      await expect.element(page.getByText("2.txt")).toBeVisible()
      await expect.element(page.getByText("3.txt")).not.toBeInTheDocument()
    })

    it("rejects every file when maxFiles is 0 and treats maxFileSize 0 as no limit", async () => {
      const onError = vi.fn()
      const screen = await render(<Composer input={{ maxFiles: 0, onError }} />)
      chooseFiles([makeFile("1.txt", "text/plain")])
      await settled(count, "0")
      expect(onError).toHaveBeenCalledWith({
        code: "max_files",
        message: expect.any(String),
      })
      await screen.unmount()

      await render(<Composer input={{ maxFileSize: 0, onError }} />)
      chooseFiles([makeFile("big.bin", "application/octet-stream", 5000)])
      await expect.poll(count).toBe("1")
      expect(onError).toHaveBeenCalledTimes(1)
    })

    it("enforces maxFileSize limit", async () => {
      const onError = vi.fn()
      const largeFile = makeFile("large.txt", "text/plain", 2000)
      await render(
        <Composer
          batches={{ file: [largeFile] }}
          input={{ maxFileSize: 1000, onError }}
        />
      )
      await page.getByRole("button", { name: "Add file" }).click()
      await settled(count, "0")
      expect(onError).toHaveBeenCalledWith({
        code: "max_file_size",
        message: expect.any(String),
      })
    })

    it("enforces maxFileSize inclusively and accepts zero-byte files", async () => {
      const onError = vi.fn()
      await render(<Composer input={{ maxFileSize: 10, onError }} />)
      chooseFiles([makeFile("exact.bin", "application/octet-stream", 10)])
      await expect.poll(count).toBe("1")
      chooseFiles([makeFile("empty.bin", "application/octet-stream", 0)])
      await expect.poll(count).toBe("2")
      expect(onError).not.toHaveBeenCalled()

      chooseFiles([makeFile("over.bin", "application/octet-stream", 11)])
      await settled(count, "2")
      expect(onError).toHaveBeenCalledWith({
        code: "max_file_size",
        message: expect.any(String),
      })
    })

    it("reports max_file_size when only some of the chosen files fit", async () => {
      const onError = vi.fn()
      await render(<Composer input={{ maxFileSize: 10, onError }} />)
      chooseFiles([
        makeFile("small.bin", "application/octet-stream", 5),
        makeFile("big.bin", "application/octet-stream", 50),
      ])
      await expect.poll(count).toBe("1")
      await expect.element(page.getByText("small.bin")).toBeVisible()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith({
        code: "max_file_size",
        message: expect.any(String),
      })
    })

    it("reports accept when only some of the chosen files match", async () => {
      const onError = vi.fn()
      await render(<Composer input={{ accept: "image/*", onError }} />)
      chooseFiles([
        makeFile("a.png", "image/png"),
        makeFile("notes.txt", "text/plain"),
      ])
      await expect.poll(count).toBe("1")
      await expect.element(page.getByText("a.png")).toBeVisible()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("reports partial rejections through the provider path too", async () => {
      const onError = vi.fn()
      await render(
        <PromptInputProvider>
          <Composer input={{ accept: "image/*", maxFileSize: 10, onError }} />
        </PromptInputProvider>
      )
      chooseFiles([
        makeFile("a.png", "image/png", 5),
        makeFile("notes.txt", "text/plain", 5),
        makeFile("huge.png", "image/png", 50),
      ])
      await expect.poll(count).toBe("1")
      expect(onError.mock.calls.map((call) => call[0]?.code)).toEqual([
        "accept",
        "max_file_size",
      ])
    })

    it("enforces accept image filter", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{ file: [makeFile("test.txt", "text/plain")] }}
          input={{ accept: "image/*", onError }}
        />
      )
      await page.getByRole("button", { name: "Add file" }).click()
      await settled(count, "0")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("allows image files when accept is image/*", async () => {
      await render(
        <Composer
          batches={{ file: [makeFile("test.png", "image/png")] }}
          input={{ accept: "image/*" }}
        />
      )
      await page.getByRole("button", { name: "Add file" }).click()
      await expect.poll(count).toBe("1")
    })

    it("enforces accept video/* filter", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            text: [makeFile("test.txt", "text/plain")],
            video: [makeFile("test.mp4", "video/mp4")],
          }}
          input={{ accept: "video/*", onError }}
        />
      )
      await page.getByRole("button", { name: "Add text" }).click()
      await settled(count, "0")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
      await page.getByRole("button", { name: "Add video" }).click()
      await expect.poll(count).toBe("1")
    })

    it("enforces accept audio/* filter", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            audio: [makeFile("test.mp3", "audio/mpeg")],
            image: [makeFile("test.png", "image/png")],
          }}
          input={{ accept: "audio/*", onError }}
        />
      )
      await page.getByRole("button", { name: "Add image" }).click()
      await settled(count, "0")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
      await page.getByRole("button", { name: "Add audio" }).click()
      await expect.poll(count).toBe("1")
    })

    it("enforces accept with exact MIME type", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            jpeg: [makeFile("test.jpg", "image/jpeg")],
            png: [makeFile("test.png", "image/png")],
          }}
          input={{ accept: "image/png", onError }}
        />
      )
      await page.getByRole("button", { name: "Add png" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add jpeg" }).click()
      await settled(count, "1")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("allows exact MIME type match for application/pdf", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            pdf: [makeFile("doc.pdf", "application/pdf")],
            text: [makeFile("doc.txt", "text/plain")],
          }}
          input={{ accept: "application/pdf", onError }}
        />
      )
      await page.getByRole("button", { name: "Add pdf" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add text" }).click()
      await settled(count, "1")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("accepts multiple comma-separated patterns with wildcards", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            audio: [makeFile("test.mp3", "audio/mpeg")],
            image: [makeFile("test.png", "image/png")],
            text: [makeFile("test.txt", "text/plain")],
            video: [makeFile("test.mp4", "video/mp4")],
          }}
          input={{ accept: "image/*, video/*", onError }}
        />
      )
      await page.getByRole("button", { name: "Add image" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add video" }).click()
      await expect.poll(count).toBe("2")
      await page.getByRole("button", { name: "Add audio" }).click()
      await settled(count, "2")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
      await page.getByRole("button", { name: "Add text" }).click()
      await settled(count, "2")
      expect(onError).toHaveBeenCalledTimes(2)
    })

    it("accepts multiple comma-separated exact MIME types", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            jpeg: [makeFile("test.jpg", "image/jpeg")],
            pdf: [makeFile("doc.pdf", "application/pdf")],
            png: [makeFile("test.png", "image/png")],
            text: [makeFile("doc.txt", "text/plain")],
          }}
          input={{ accept: "image/png, application/pdf", onError }}
        />
      )
      await page.getByRole("button", { name: "Add png" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add pdf" }).click()
      await expect.poll(count).toBe("2")
      await page.getByRole("button", { name: "Add jpeg" }).click()
      await settled(count, "2")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
      await page.getByRole("button", { name: "Add text" }).click()
      await settled(count, "2")
      expect(onError).toHaveBeenCalledTimes(2)
    })

    it("accepts mixed wildcard and exact MIME type patterns", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            docx: [
              makeFile(
                "doc.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              ),
            ],
            jpeg: [makeFile("test.jpg", "image/jpeg")],
            pdf: [makeFile("doc.pdf", "application/pdf")],
            png: [makeFile("test.png", "image/png")],
          }}
          input={{ accept: "image/*, application/pdf", onError }}
        />
      )
      await page.getByRole("button", { name: "Add png" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add jpeg" }).click()
      await expect.poll(count).toBe("2")
      await page.getByRole("button", { name: "Add pdf" }).click()
      await expect.poll(count).toBe("3")
      await page.getByRole("button", { name: "Add docx" }).click()
      await settled(count, "3")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("handles accept with extra whitespace in patterns", async () => {
      await render(
        <Composer
          batches={{
            image: [makeFile("test.png", "image/png")],
            pdf: [makeFile("doc.pdf", "application/pdf")],
          }}
          input={{ accept: "  image/*  ,  application/pdf  " }}
        />
      )
      await page.getByRole("button", { name: "Add image" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add pdf" }).click()
      await expect.poll(count).toBe("2")
    })

    it("accepts all files when accept is empty string", async () => {
      await render(
        <Composer
          batches={{
            image: [makeFile("test.png", "image/png")],
            text: [makeFile("test.txt", "text/plain")],
          }}
          input={{ accept: "" }}
        />
      )
      await page.getByRole("button", { name: "Add image" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add text" }).click()
      await expect.poll(count).toBe("2")
    })

    it("accepts all files when accept is only whitespace", async () => {
      await render(
        <Composer
          batches={{
            image: [makeFile("test.png", "image/png")],
            text: [makeFile("test.txt", "text/plain")],
          }}
          input={{ accept: "   " }}
        />
      )
      await page.getByRole("button", { name: "Add image" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add text" }).click()
      await expect.poll(count).toBe("2")
    })

    it("filters out empty patterns from comma-separated list", async () => {
      const onError = vi.fn()
      await render(
        <Composer
          batches={{
            image: [makeFile("test.png", "image/png")],
            text: [makeFile("test.txt", "text/plain")],
          }}
          input={{ accept: "image/*,  ,  ", onError }}
        />
      )
      await page.getByRole("button", { name: "Add image" }).click()
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Add text" }).click()
      await settled(count, "1")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("rejects files with no type against MIME patterns", async () => {
      const onError = vi.fn()
      await render(
        <Composer input={{ accept: "image/*, application/pdf", onError }} />
      )
      chooseFiles([makeFile("mystery", "")])
      await settled(count, "0")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("matches extension patterns case-insensitively by file name, including files with no type", async () => {
      const onError = vi.fn()
      await render(<Composer input={{ accept: ".pdf,.MD", onError }} />)
      chooseFiles([
        makeFile("doc.pdf", "application/pdf"),
        makeFile("Notes.PDF", "application/pdf"),
        makeFile("readme.md", ""),
      ])
      await expect.poll(count).toBe("3")
      expect(onError).not.toHaveBeenCalled()

      chooseFiles([makeFile("doc.txt", "text/plain")])
      await settled(count, "3")
      expect(onError).toHaveBeenCalledWith({
        code: "accept",
        message: expect.any(String),
      })
    })

    it("matches every file, typed or not, when accept is */*", async () => {
      const onError = vi.fn()
      await render(<Composer input={{ accept: "*/*", onError }} />)
      chooseFiles([makeFile("a.png", "image/png"), makeFile("mystery", "")])
      await expect.poll(count).toBe("2")
      expect(onError).not.toHaveBeenCalled()
    })

    it("enforces maxFiles limit when using PromptInputProvider", async () => {
      const onError = vi.fn()
      const files = [
        makeFile("test1.txt", "text/plain"),
        makeFile("test2.txt", "text/plain"),
        makeFile("test3.txt", "text/plain"),
      ]
      await render(
        <PromptInputProvider>
          <Composer batches={{ files }} input={{ maxFiles: 2, onError }} />
        </PromptInputProvider>
      )
      await page.getByRole("button", { name: "Add files" }).click()
      await expect.poll(count).toBe("2")
      expect(onError).toHaveBeenCalledWith({
        code: "max_files",
        message: expect.any(String),
      })
    })

    it.each([
      ["local state", false],
      ["a PromptInputProvider", true],
    ])(
      "caps two add() calls from one handler at maxFiles with %s",
      async (_label, withProvider) => {
        const onError = vi.fn()
        const files = [
          makeFile("1.txt", "text/plain"),
          makeFile("2.txt", "text/plain"),
          makeFile("3.txt", "text/plain"),
        ]
        function AddTwice() {
          const attachments = usePromptInputAttachments()
          return (
            <button
              onClick={() => {
                attachments.add(files.slice(0, 1))
                attachments.add(files.slice(1))
              }}
              type="button"
            >
              Add twice
            </button>
          )
        }
        const composer = (
          <main>
            <PromptInput maxFiles={2} onError={onError} onSubmit={() => {}}>
              <PromptInputBody>
                <AddTwice />
                <AttachmentList />
                <PromptInputTextarea />
              </PromptInputBody>
            </PromptInput>
          </main>
        )
        await render(
          withProvider ? (
            <PromptInputProvider>{composer}</PromptInputProvider>
          ) : (
            composer
          )
        )
        await page.getByRole("button", { name: "Add twice" }).click()
        await settled(count, "2")
        expect(onError).toHaveBeenCalledExactlyOnceWith({
          code: "max_files",
          message: expect.any(String),
        })
      }
    )

    it.each([
      ["remove", "local state", false],
      ["remove", "a PromptInputProvider", true],
      ["clear", "local state", false],
      ["clear", "a PromptInputProvider", true],
    ])(
      "lets one handler %s an attachment and add a replacement within maxFiles, with %s",
      async (path, _label, withProvider) => {
        const onError = vi.fn()
        function Replace() {
          const attachments = usePromptInputAttachments()
          return (
            <button
              onClick={() => {
                const current = attachments.files[0]
                if (path === "remove" && current) {
                  attachments.remove(current.id)
                } else {
                  attachments.clear()
                }
                attachments.add([makeFile("new.txt", "text/plain")])
              }}
              type="button"
            >
              Replace
            </button>
          )
        }
        const composer = (
          <main>
            <PromptInput maxFiles={1} onError={onError} onSubmit={() => {}}>
              <PromptInputBody>
                <Replace />
                <AttachmentList />
                <PromptInputTextarea />
              </PromptInputBody>
            </PromptInput>
          </main>
        )
        await render(
          withProvider ? (
            <PromptInputProvider>{composer}</PromptInputProvider>
          ) : (
            composer
          )
        )
        chooseFiles([makeFile("old.txt", "text/plain")])
        await expect.poll(count).toBe("1")

        await page.getByRole("button", { name: "Replace" }).click()
        await settled(count, "1")
        await expect.element(page.getByText("new.txt")).toBeVisible()
        expect(page.getByText("old.txt").query()).toBeNull()
        expect(onError).not.toHaveBeenCalled()
      }
    )

    it("frees a slot for the composer's add() when the provider's own remove() runs in the same handler", async () => {
      const onError = vi.fn()
      // A chip list may remove through useProviderAttachments directly.
      function Swap() {
        const provider = useProviderAttachments()
        const composer = usePromptInputAttachments()
        return (
          <button
            onClick={() => {
              const current = provider.files[0]
              if (current) provider.remove(current.id)
              composer.add([makeFile("new.txt", "text/plain")])
            }}
            type="button"
          >
            Swap
          </button>
        )
      }
      await render(
        <PromptInputProvider>
          <main>
            <PromptInput maxFiles={1} onError={onError} onSubmit={() => {}}>
              <PromptInputBody>
                <Swap />
                <AttachmentList />
                <PromptInputTextarea />
              </PromptInputBody>
            </PromptInput>
          </main>
        </PromptInputProvider>
      )
      chooseFiles([makeFile("old.txt", "text/plain")])
      await expect.poll(count).toBe("1")
      await page.getByRole("button", { name: "Swap" }).click()
      await settled(count, "1")
      await expect.element(page.getByText("new.txt")).toBeVisible()
      expect(onError).not.toHaveBeenCalled()
    })

    it("reports an over-limit add once and creates one object URL per file under StrictMode", async () => {
      const onError = vi.fn()
      const create = vi.spyOn(URL, "createObjectURL")
      const files = [
        makeFile("1.txt", "text/plain"),
        makeFile("2.txt", "text/plain"),
      ]
      // Added as an array (the paste and attachments.add path): a FileList
      // read lazily inside a state updater would be empty by the time
      // StrictMode re-invokes it and hide the duplication.
      await render(
        <StrictMode>
          <Composer batches={{ files }} input={{ maxFiles: 1, onError }} />
        </StrictMode>
      )
      await page.getByRole("button", { name: "Add files" }).click()
      await expect.poll(count).toBe("1")
      expect(onError).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledTimes(1)

      chooseFiles([makeFile("3.txt", "text/plain")])
      await settled(count, "1")
      expect(onError).toHaveBeenCalledTimes(2)
      expect(create).toHaveBeenCalledTimes(1)
    })

    it("creates one object URL per file under StrictMode through the provider", async () => {
      const create = vi.spyOn(URL, "createObjectURL")
      const files = [makeFile("1.txt", "text/plain")]
      await render(
        <StrictMode>
          <PromptInputProvider>
            <Composer batches={{ files }} />
          </PromptInputProvider>
        </StrictMode>
      )
      await page.getByRole("button", { name: "Add files" }).click()
      await expect.poll(count).toBe("1")
      expect(create).toHaveBeenCalledTimes(1)
    })
  })

  describe("drag and drop", () => {
    it("accepts drops on the form and ignores document drops unless globalDrop is set", async () => {
      const screen = await render(<Composer />)
      expect(dropFiles(formEl(), [makeFile("a.png", "image/png")])).toBe(false)
      await expect.poll(count).toBe("1")

      dropFiles(document.body, [makeFile("b.png", "image/png")])
      await settled(count, "1")

      await screen.unmount()
      await render(<Composer input={{ globalDrop: true }} />)
      dropFiles(document.body, [makeFile("c.png", "image/png")])
      await expect.poll(count).toBe("1")
    })

    it("prevents the dragover default only for file drags and ignores text drops", async () => {
      await render(<Composer />)
      const form = formEl()
      expect(
        dispatchDrag(form, "dragover", toDataTransfer([makeFile("a", "")]))
      ).toBe(false)
      expect(dispatchDrag(form, "dragover", textDataTransfer("hello"))).toBe(
        true
      )
      expect(dispatchDrag(form, "drop", textDataTransfer("hello"))).toBe(true)
      await settled(count, "0")
    })
  })

  describe("paste functionality", () => {
    it("adds files from clipboard and swallows the paste; text-only paste is untouched", async () => {
      await render(<Composer />)
      const el = textareaEl()
      await textarea().fill("draft")

      expect(pasteFiles(el, [makeFile("shot.png", "image/png")])).toBe(false)
      await expect.poll(count).toBe("1")
      expect(el.value).toBe("draft")

      const notHandled = el.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: textDataTransfer("hello"),
        })
      )
      expect(notHandled).toBe(true)
      expect(count()).toBe("1")
    })

    it("handles paste with no files", async () => {
      await render(<Composer />)
      const el = textareaEl()
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      })
      expect(() => el.dispatchEvent(event)).not.toThrow()
      expect(event.defaultPrevented).toBe(false)
      await settled(count, "0")
    })
  })
})

// ---------------------------------------------------------------------------
// PromptInputProvider and hooks
// ---------------------------------------------------------------------------

describe("PromptInputProvider", () => {
  function Controls() {
    const controller = usePromptInputController()
    return (
      <div>
        <span data-testid="input-value">{controller.textInput.value}</span>
        <button
          onClick={() => controller.textInput.setInput("test")}
          type="button"
        >
          Set Input
        </button>
        <button onClick={controller.textInput.clear} type="button">
          Clear input
        </button>
      </div>
    )
  }

  it("provides context to children and drives the composer textarea from outside", async () => {
    await render(
      <PromptInputProvider>
        <Controls />
        <Composer />
      </PromptInputProvider>
    )
    await expect.element(page.getByTestId("input-value")).toHaveTextContent("")
    await page.getByRole("button", { name: "Set Input" }).click()
    await expect
      .element(page.getByTestId("input-value"))
      .toHaveTextContent("test")
    await expect.element(textarea()).toHaveValue("test")
    await page.getByRole("button", { name: "Clear input" }).click()
    await expect.element(textarea()).toHaveValue("")
  })

  it("throws error when usePromptInputController used outside provider", async () => {
    function Bad() {
      usePromptInputController()
      return null
    }
    allowConsole("error")
    await expect(render(<Bad />)).rejects.toThrow(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    )
  })

  it("throws when useProviderAttachments or usePromptInputAttachments have no provider", async () => {
    function BadProvider() {
      useProviderAttachments()
      return null
    }
    function BadAttachments() {
      usePromptInputAttachments()
      return null
    }
    allowConsole("error")
    await expect(render(<BadProvider />)).rejects.toThrow(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments()."
    )
    await expect(render(<BadAttachments />)).rejects.toThrow(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    )
  })

  it("provides initial input value", async () => {
    await render(
      <PromptInputProvider initialInput="Hello world">
        <Controls />
        <Composer />
      </PromptInputProvider>
    )
    await expect
      .element(page.getByTestId("input-value"))
      .toHaveTextContent("Hello world")
    expect(textareaEl().value).toBe("Hello world")
  })

  it("manages attachments globally and revokes their object URLs on remove, clear and unmount", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL")
    const files = [
      makeFile("a.txt", "text/plain"),
      makeFile("b.txt", "text/plain"),
      makeFile("c.txt", "text/plain"),
    ]
    function Global() {
      const attachments = useProviderAttachments()
      return (
        <div>
          <button onClick={() => attachments.add(files)} type="button">
            Add File
          </button>
          <button
            onClick={() => {
              const first = attachments.files[0]
              if (first) {
                attachments.remove(first.id)
              }
            }}
            type="button"
          >
            Remove first
          </button>
          <button onClick={attachments.clear} type="button">
            Clear
          </button>
          <span data-testid="count">{attachments.files.length}</span>
          <ul>
            {attachments.files.map((file) => (
              <li data-url={file.url} key={file.id}>
                {file.filename}
              </li>
            ))}
          </ul>
        </div>
      )
    }
    const screen = await render(
      <PromptInputProvider>
        <Global />
      </PromptInputProvider>
    )
    expect(count()).toBe("0")
    await page.getByRole("button", { name: "Add File" }).click()
    await expect.poll(count).toBe("3")
    const urls = attachmentUrls()
    expect(urls.every((url) => url.startsWith("blob:"))).toBe(true)

    await page.getByRole("button", { name: "Remove first" }).click()
    await expect.poll(count).toBe("2")
    expect(revoke).toHaveBeenCalledWith(urls[0])
    expect(revoke).toHaveBeenCalledTimes(1)

    await page.getByRole("button", { name: "Clear" }).click()
    await expect.poll(count).toBe("0")
    expect(revoke).toHaveBeenCalledWith(urls[1])
    expect(revoke).toHaveBeenCalledWith(urls[2])
    expect(revoke).toHaveBeenCalledTimes(3)

    await page.getByRole("button", { name: "Add File" }).click()
    await expect.poll(count).toBe("3")
    const pending = attachmentUrls()
    revoke.mockClear()
    await screen.unmount()
    expect(revoke).toHaveBeenCalledTimes(3)
    for (const url of pending) {
      expect(revoke).toHaveBeenCalledWith(url)
    }
  })

  it("validates through PromptInput when a provider is present, and openFileDialog reaches the hidden input", async () => {
    const onError = vi.fn()
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})

    function Outside() {
      const controller = usePromptInputController()
      return (
        <>
          <button
            onClick={() =>
              controller.attachments.add([
                makeFile("o1.txt", "text/plain"),
                makeFile("o2.txt", "text/plain"),
              ])
            }
            type="button"
          >
            Add outside
          </button>
          <button onClick={controller.attachments.openFileDialog} type="button">
            Open outside
          </button>
          <span data-testid="provider-count">
            {controller.attachments.files.length}
          </span>
        </>
      )
    }

    await render(
      <PromptInputProvider>
        <Outside />
        <Composer input={{ maxFiles: 1, onError }} />
      </PromptInputProvider>
    )

    chooseFiles([
      makeFile("1.txt", "text/plain"),
      makeFile("2.txt", "text/plain"),
    ])
    await expect.poll(count).toBe("1")
    expect(onError).toHaveBeenCalledWith({
      code: "max_files",
      message: expect.any(String),
    })

    await page.getByRole("button", { name: "Open outside" }).click()
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0]).toBe(fileInput())

    // The provider's own add() is unvalidated by design; validation lives in PromptInput.
    await page.getByRole("button", { name: "Add outside" }).click()
    await expect
      .poll(
        () =>
          document.querySelector('[data-testid="provider-count"]')?.textContent
      )
      .toBe("3")
  })
})

// ---------------------------------------------------------------------------
// PromptInputBody
// ---------------------------------------------------------------------------

describe("PromptInputBody", () => {
  it("renders body content as a contents wrapper and merges className", async () => {
    await render(
      <main>
        <PromptInput onSubmit={() => {}}>
          <PromptInputBody className="custom-body" data-testid="body">
            Content
          </PromptInputBody>
        </PromptInput>
      </main>
    )
    await expect.element(page.getByText("Content")).toBeVisible()
    const body = page.getByTestId("body").element()
    expect(body.classList.contains("contents")).toBe(true)
    expect(body.classList.contains("custom-body")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// PromptInputTextarea
// ---------------------------------------------------------------------------

describe("PromptInputTextarea", () => {
  it("renders a textarea named message with the default placeholder and an accessible name", async () => {
    await render(<Bare />)
    const el = textareaEl()
    expect(el.placeholder).toBe("What would you like to know?")
    expect(el.getAttribute("aria-label")).toBe("Message")
    expect(el.classList.contains("field-sizing-content")).toBe(true)
    await expect.element(textarea()).toBeVisible()
  })

  it("uses custom placeholder, aria-label and className", async () => {
    await render(
      <Composer
        textarea={{
          "aria-label": "Ask anything",
          className: "custom-textarea",
          placeholder: "Custom placeholder",
        }}
      />
    )
    const el = textareaEl()
    expect(el.placeholder).toBe("Custom placeholder")
    expect(el.getAttribute("aria-label")).toBe("Ask anything")
    expect(el.classList.contains("custom-textarea")).toBe(true)
    expect(el.classList.contains("field-sizing-content")).toBe(true)
  })

  it("submits on Enter key", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Bare onSubmit={onSubmit} />)
    await textarea().fill("Test")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Test" }),
      expect.anything()
    )
  })

  it("does not submit on Shift+Enter", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Bare onSubmit={onSubmit} />)
    await textarea().click()
    await userEvent.keyboard("line one{Shift>}{Enter}{/Shift}line two")
    await expect.element(textarea()).toHaveValue("line one\nline two")
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("line one\nline two")
  })

  it("does not submit on Enter during IME composition - #21", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Bare onSubmit={onSubmit} />)
    const el = textareaEl()
    await textarea().fill("日本語")

    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        isComposing: true,
        key: "Enter",
      })
    )
    await settled(() => onSubmit.mock.calls.length, 0)

    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true })
    )
    await userEvent.keyboard("{Enter}")
    await settled(() => onSubmit.mock.calls.length, 0)

    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
  })

  it("does not submit on an Enter with keyCode 229, which Safari fires after compositionend", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Bare onSubmit={onSubmit} />)
    const el = textareaEl()
    await textarea().fill("日本語")
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        isComposing: false,
        key: "Enter",
        keyCode: 229,
      })
    )
    await settled(() => onSubmit.mock.calls.length, 0)
    expect(el.value).toBe("日本語")
  })

  it("calls a consumer onKeyDown for every key and lets it veto Enter with preventDefault", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    const onKeyDown = vi.fn(
      (event: { key: string; preventDefault(): void }) => {
        if (event.key === "Enter") {
          event.preventDefault()
        }
      }
    )
    await render(<Composer input={{ onSubmit }} textarea={{ onKeyDown }} />)
    await textarea().click()
    await userEvent.keyboard("ab{Enter}")
    expect(onKeyDown).toHaveBeenCalledTimes(3)
    await settled(() => onSubmit.mock.calls.length, 0)
  })

  it("does not submit on Enter while the submit button is disabled", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Composer input={{ onSubmit }} submit={{ disabled: true }} />)
    await textarea().fill("blocked")
    await userEvent.keyboard("{Enter}")
    await settled(() => onSubmit.mock.calls.length, 0)
    expect(textareaEl().value).toBe("blocked")
  })

  it("does not submit on Enter without a submit button in the form", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Bare onSubmit={onSubmit} withSubmit={false} />)
    await textarea().fill("no button")
    await userEvent.keyboard("{Enter}")
    await settled(() => onSubmit.mock.calls.length, 0)
    expect(textareaEl().value).toBe("no button")
  })

  it.each(["submitted", "streaming"] as const)(
    "does not submit or stop on Enter while %s with a Stop button",
    async (status) => {
      const onSubmit = vi.fn<OnSubmit>()
      const onStop = vi.fn()
      await render(
        <Composer input={{ onSubmit }} submit={{ onStop, status }} />
      )
      await textarea().fill("interrupting")
      await userEvent.keyboard("{Enter}")
      await settled(() => onSubmit.mock.calls.length, 0)
      expect(onStop).not.toHaveBeenCalled()
      expect(textareaEl().value).toBe("interrupting")
    }
  )

  it.each(["submitted", "streaming"] as const)(
    "still submits on Enter while %s when no onStop is wired, because the button stays a Submit button",
    async (status) => {
      const onSubmit = vi.fn<OnSubmit>()
      await render(<Composer input={{ onSubmit }} submit={{ status }} />)
      await expect.element(submitButton()).toHaveAttribute("type", "submit")
      expect(stopButton().query()).toBeNull()
      await textarea().fill("go")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({ files: [], text: "go" })
    }
  )

  it("removes attachment if backspace key is pressed and textarea is empty", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL")
    await render(<Composer />)
    chooseFiles([
      makeFile("first.txt", "text/plain"),
      makeFile("second.txt", "text/plain"),
      makeFile("third.txt", "text/plain"),
    ])
    await expect.poll(count).toBe("3")
    const urls = attachmentUrls()

    await textarea().click()
    expect(textareaEl().value).toBe("")
    await userEvent.keyboard("{Backspace}")
    await expect.poll(count).toBe("2")
    await expect.element(page.getByText("third.txt")).not.toBeInTheDocument()
    expect(revoke).toHaveBeenCalledWith(urls[2])

    await userEvent.keyboard("{Backspace}")
    await expect.poll(count).toBe("1")
    await expect.element(page.getByText("second.txt")).not.toBeInTheDocument()

    await userEvent.keyboard("{Backspace}")
    await expect.poll(count).toBe("0")
    await expect.element(page.getByText("first.txt")).not.toBeInTheDocument()
  })

  it("does not remove attachment when backspace key is pressed and textarea has content", async () => {
    await render(<Composer />)
    chooseFiles([makeFile("test.txt", "text/plain")])
    await expect.poll(count).toBe("1")
    await textarea().fill("Some text")
    await userEvent.keyboard("{Backspace}")
    await settled(count, "1")
    expect(textareaEl().value).toBe("Some tex")
  })

  it("resets a defaultValue textarea to its default (not empty) after submit", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    await render(
      <Composer input={{ onSubmit }} textarea={{ defaultValue: "template" }} />
    )
    await textarea().fill("template plus edits")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("template plus edits")
    expect(textareaEl().value).toBe("template")
  })

  it("leaves a consumer-controlled textarea (no provider) under consumer control after submit", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    function Controlled() {
      const [draft, setDraft] = useState("")
      return (
        <Composer
          input={{ onSubmit }}
          textarea={{
            onChange: (event) => setDraft(event.currentTarget.value),
            value: draft,
          }}
        />
      )
    }
    await render(<Controlled />)
    await textarea().fill("controlled")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("controlled")
    await settled(() => textareaEl().value, "controlled")
  })

  it("keeps the default aria-label over a consumer's visible label until it is unset", async () => {
    function Labelled({ unsetDefault }: { unsetDefault: boolean }) {
      return (
        <main>
          <PromptInput onSubmit={() => {}}>
            <PromptInputBody>
              <label htmlFor="question">Your question</label>
              <PromptInputTextarea
                id="question"
                {...(unsetDefault ? { "aria-label": undefined } : {})}
              />
            </PromptInputBody>
          </PromptInput>
        </main>
      )
    }
    const screen = await render(<Labelled unsetDefault={false} />)
    expect(
      page.getByRole("textbox", { name: "Message" }).query()
    ).not.toBeNull()
    expect(
      page.getByRole("textbox", { name: "Your question" }).query()
    ).toBeNull()
    await screen.rerender(<Labelled unsetDefault />)
    expect(
      page.getByRole("textbox", { name: "Your question" }).query()
    ).not.toBeNull()
  })

  it("keeps calling a consumer onChange in provider mode while the provider owns the value", async () => {
    const onChange = vi.fn()
    function Value() {
      const controller = usePromptInputController()
      return <span data-testid="input-value">{controller.textInput.value}</span>
    }
    await render(
      <PromptInputProvider>
        <Value />
        <Composer textarea={{ onChange, value: "ignored" }} />
      </PromptInputProvider>
    )
    expect(textareaEl().value).toBe("")
    await textarea().fill("typed")
    await expect
      .element(page.getByTestId("input-value"))
      .toHaveTextContent("typed")
    expect(onChange).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Attachments (usePromptInputAttachments consumers)
// ---------------------------------------------------------------------------

describe("attachments", () => {
  it("renders file and image attachments, the image with its filename as alt text", async () => {
    await render(<Composer />)
    chooseFiles([
      makeFile("document.pdf", "application/pdf"),
      makeFile("image.png", "image/png"),
    ])
    await expect.poll(count).toBe("2")
    await expect.element(page.getByText("document.pdf")).toBeVisible()
    await expect.element(page.getByText("image.png")).toBeVisible()
    const img = page.getByAltText("image.png").element()
    expect(img.getAttribute("src")?.startsWith("blob:")).toBe(true)
    expect(
      document.querySelectorAll('[data-slot="attachment-media"] img')
    ).toHaveLength(1)
  })

  it("removes attachment when remove button clicked", async () => {
    await render(<Composer />)
    chooseFiles([makeFile("test.txt", "text/plain")])
    await expect.element(page.getByText("test.txt")).toBeVisible()
    await page.getByRole("button", { name: "Remove test.txt" }).click()
    await expect.element(page.getByText("test.txt")).not.toBeInTheDocument()
    expect(count()).toBe("0")
  })

  it("revokes object URLs on remove, clear and unmount", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL")
    const screen = await render(<Composer />)
    chooseFiles([
      makeFile("1.txt", "text/plain"),
      makeFile("2.txt", "text/plain"),
    ])
    await expect.poll(count).toBe("2")
    const urls = attachmentUrls()
    expect(urls.every((url) => url.startsWith("blob:"))).toBe(true)

    await page.getByRole("button", { name: "Remove 1.txt" }).click()
    await expect.poll(count).toBe("1")
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith(urls[0])

    chooseFiles([makeFile("3.txt", "text/plain")])
    await expect.poll(count).toBe("2")
    const remaining = attachmentUrls()
    revoke.mockClear()
    await page.getByRole("button", { name: "Clear all" }).click()
    await expect.poll(count).toBe("0")
    expect(revoke).toHaveBeenCalledTimes(2)
    for (const url of remaining) {
      expect(revoke).toHaveBeenCalledWith(url)
    }

    chooseFiles([makeFile("4.txt", "text/plain")])
    await expect.poll(count).toBe("1")
    const [pending] = attachmentUrls()
    revoke.mockClear()
    await screen.unmount()
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith(pending)
  })

  it("opens the hidden file input from openFileDialog", async () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})
    await render(<Composer />)
    await page.getByRole("button", { name: "Open dialog" }).click()
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0]).toBe(fileInput())
  })
})

// ---------------------------------------------------------------------------
// Referenced sources
// ---------------------------------------------------------------------------

describe("referenced sources", () => {
  it("adds one or many sources, removes one by id and renders nothing when empty", async () => {
    await render(<Composer withSources />)
    expect(sourcesCount()).toBe("0")
    expect(document.querySelectorAll("li")).toHaveLength(0)
    await page.getByRole("button", { name: "Add source" }).click()
    await expect.element(page.getByText("Test Source")).toBeVisible()
    await page.getByRole("button", { name: "Add sources" }).click()
    await expect.poll(sourcesCount).toBe("3")
    await expect.element(page.getByText("Source 2")).toBeVisible()
    await page.getByRole("button", { name: "Remove Source 2" }).click()
    await expect.poll(sourcesCount).toBe("2")
    await expect.element(page.getByText("Source 2")).not.toBeInTheDocument()
  })

  it("throws when usePromptInputReferencedSources is used outside PromptInput", async () => {
    function Bad() {
      usePromptInputReferencedSources()
      return null
    }
    allowConsole("error")
    await expect(render(<Bad />)).rejects.toThrow(
      /usePromptInputReferencedSources/
    )
  })
})

// ---------------------------------------------------------------------------
// PromptInputActionMenu*
// ---------------------------------------------------------------------------

describe("PromptInputActionMenu", () => {
  it("renders a menu trigger with the plus icon, aria-haspopup and aria-expanded", async () => {
    await render(<Composer />)
    const trigger = menuTrigger().element()
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(trigger.getAttribute("type")).toBe("button")
    expect(trigger.querySelector("svg.lucide-plus")).not.toBeNull()
  })

  it("lets custom trigger children replace the plus icon and merges className", async () => {
    await render(
      <Composer
        menuTrigger={{
          children: <span>More</span>,
          className: "custom-trigger",
        }}
      />
    )
    const trigger = menuTrigger().element()
    expect(trigger.textContent).toBe("More")
    expect(trigger.querySelector("svg")).toBeNull()
    expect(trigger.classList.contains("custom-trigger")).toBe(true)
  })

  it("renders action menu content aligned to the start and closes on Escape, returning focus to the trigger", async () => {
    await render(<Composer menuItemOnClick={() => {}} withSelect={false} />)
    await openMenu()
    expect(menuTrigger().element().getAttribute("aria-expanded")).toBe("true")
    await expect.element(menuItem("Take screenshot")).toBeVisible()
    await expect.element(menuItem("Custom action")).toBeVisible()
    expect(menuPopup()?.getAttribute("data-align")).toBe("start")
    await userEvent.keyboard("{Escape}")
    await expect
      .element(menuItem("Add photos or files"))
      .not.toBeInTheDocument()
    expect(menuTrigger().element().getAttribute("aria-expanded")).toBe("false")
    expect(describeActive()).toBe("Add attachment")
  })

  it("handles menu item click and closes the menu", async () => {
    const onClick = vi.fn()
    await render(<Composer menuItemOnClick={onClick} />)
    await openMenu()
    await menuItem("Custom action").click()
    expect(onClick).toHaveBeenCalledTimes(1)
    await expect.element(menuItem("Custom action")).not.toBeInTheDocument()
  })

  it("activates items from the keyboard", async () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})
    await render(<Composer />)
    await openMenu()
    await userEvent.keyboard("{ArrowDown}")
    expect(document.activeElement?.getAttribute("role")).toBe("menuitem")
    await userEvent.keyboard("{Enter}")
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("returns focus to the menu trigger after activating an item when the footer has no select", async () => {
    await render(<Composer menuItemOnClick={() => {}} withSelect={false} />)
    await openMenu()
    await menuItem("Custom action").click()
    await expect.element(menuItem("Custom action")).not.toBeInTheDocument()
    expect(describeActive()).toBe("Add attachment")
  })

  it("returns focus to the menu trigger after a mouse activation when the footer has a model select", async () => {
    await render(<Composer menuItemOnClick={() => {}} />)
    await openMenu()
    await menuItem("Custom action").click()
    await expect.element(menuItem("Custom action")).not.toBeInTheDocument()
    expect(describeActive()).toBe("Add attachment")
  })

  it("returns focus to the menu trigger after a keyboard activation when the footer has a model select", async () => {
    const onClick = vi.fn()
    await render(<Composer menuItemOnClick={onClick} />)
    await openMenu()
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    expect(document.activeElement?.textContent).toBe("Custom action")
    await userEvent.keyboard("{Enter}")
    expect(onClick).toHaveBeenCalledTimes(1)
    await expect.element(menuItem("Custom action")).not.toBeInTheDocument()
    expect(describeActive()).toBe("Add attachment")
  })

  it("still opens the menu when the trigger also has a tooltip", async () => {
    await render(<Composer menuTrigger={{ tooltip: "Attach" }} />)
    await menuTrigger().click()
    await expect.element(menuItem("Take screenshot")).toBeVisible()
  })
})

describe("PromptInputActionAddAttachments", () => {
  it("opens the file dialog when clicked and keeps the menu open; closeOnClick can override", async () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})
    const screen = await render(<Composer />)
    await openMenu()
    const item = menuItem("Add photos or files")
    expect(item.element().querySelector("svg.lucide-image")).not.toBeNull()
    await item.click()
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0]).toBe(fileInput())
    await settled(() => menuPopup() !== null, true)
    await expect.element(item).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await expect.element(item).not.toBeInTheDocument()

    await screen.unmount()
    await render(<Composer addAttachments={{ closeOnClick: true }} />)
    await openMenu()
    await menuItem("Add photos or files").click()
    await expect
      .element(menuItem("Add photos or files"))
      .not.toBeInTheDocument()
    expect(click).toHaveBeenCalledTimes(2)
  })

  it("accepts custom label", async () => {
    await render(<Composer addAttachments={{ label: "Upload files" }} />)
    await menuTrigger().click()
    await expect.element(menuItem("Upload files")).toBeVisible()
  })

  it("calls a consumer onClick first and skips the file dialog when it prevents default", async () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})
    const onClick = vi.fn()
    const screen = await render(<Composer addAttachments={{ onClick }} />)
    await openMenu()
    await menuItem("Add photos or files").click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    await userEvent.keyboard("{Escape}")
    await screen.unmount()

    const veto = vi.fn((event: { preventDefault(): void }) =>
      event.preventDefault()
    )
    await render(<Composer addAttachments={{ onClick: veto }} />)
    await openMenu()
    await menuItem("Add photos or files").click()
    expect(veto).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
  })
})

describe("PromptInputActionAddScreenshot", () => {
  it("captures a screenshot named screenshot-*.png, stops the tracks and releases the video", async () => {
    const mocks = mockDisplayMedia()
    await render(<Composer />)
    await openMenu()
    await menuItem("Take screenshot").click()
    await expect.poll(count).toBe("1")
    await expect
      .element(
        page.getByText(
          /^screenshot-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.png$/
        )
      )
      .toBeVisible()
    expect(mocks.getDisplayMedia).toHaveBeenCalledTimes(1)
    expect(mocks.getDisplayMedia).toHaveBeenCalledWith({
      audio: false,
      video: true,
    })
    expect(mocks.play).toHaveBeenCalledTimes(1)
    expect(mocks.toBlob).toHaveBeenCalledTimes(1)
    expect(mocks.stopTrack).toHaveBeenCalledTimes(1)
    expect(mocks.pause).toHaveBeenCalledTimes(1)
    expect(mocks.video.srcObject).toBeNull()
    // The menu closes after the action (closeOnClick default).
    await expect.element(menuItem("Take screenshot")).not.toBeInTheDocument()
  })

  it("accepts custom label", async () => {
    await render(<Composer screenshot={{ label: "Capture screen" }} />)
    await menuTrigger().click()
    const item = menuItem("Capture screen")
    await expect.element(item).toBeVisible()
    expect(item.element().querySelector("svg.lucide-monitor")).not.toBeNull()
  })

  it("ignores denied capture permission and an aborted picker", async () => {
    const mocks = mockDisplayMedia()
    mocks.getDisplayMedia
      .mockRejectedValueOnce(
        new DOMException("Permission denied", "NotAllowedError")
      )
      .mockRejectedValueOnce(new DOMException("cancelled", "AbortError"))
    await render(<Composer />)
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await openMenu()
      await menuItem("Take screenshot").click()
      await expect
        .poll(() => mocks.getDisplayMedia)
        .toHaveBeenCalledTimes(attempt)
      await settled(count, "0")
    }
  })

  it("skips capture when the consumer onClick prevents default and no-ops when unsupported", async () => {
    const mocks = mockDisplayMedia()
    const onClick = vi.fn((event: { preventDefault(): void }) =>
      event.preventDefault()
    )
    const screen = await render(<Composer screenshot={{ onClick }} />)
    await openMenu()
    await menuItem("Take screenshot").click()
    expect(onClick).toHaveBeenCalledTimes(1)
    await settled(() => mocks.getDisplayMedia.mock.calls.length, 0)
    expect(count()).toBe("0")
    await screen.unmount()

    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: undefined,
      writable: true,
    })
    await render(<Composer />)
    await openMenu()
    await menuItem("Take screenshot").click()
    await settled(count, "0")
  })

  it("adds nothing when the stream has no size or the canvas yields no blob, and still releases the stream", async () => {
    const empty = mockDisplayMedia({ videoWidth: 0 })
    const screen = await render(<Composer />)
    await openMenu()
    await menuItem("Take screenshot").click()
    await expect.poll(() => empty.stopTrack).toHaveBeenCalledTimes(1)
    expect(empty.toBlob).not.toHaveBeenCalled()
    expect(count()).toBe("0")
    await screen.unmount()
    vi.restoreAllMocks()

    const noBlob = mockDisplayMedia({ blob: null })
    await render(<Composer />)
    await openMenu()
    await menuItem("Take screenshot").click()
    await expect.poll(() => noBlob.toBlob).toHaveBeenCalledTimes(1)
    await settled(() => noBlob.stopTrack.mock.calls.length, 1)
    expect(count()).toBe("0")
  })

  it("routes other capture failures to PromptInput onError with the screenshot code", async () => {
    const onError = vi.fn<(error: PromptInputError) => void>()
    const mocks = mockDisplayMedia()
    mocks.getDisplayMedia
      .mockRejectedValueOnce(
        new DOMException("Not supported here", "NotSupportedError")
      )
      .mockRejectedValueOnce(new Error("boom"))
    await render(<Composer input={{ onError }} />)
    await openMenu()
    await menuItem("Take screenshot").click()
    await expect.poll(() => onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenLastCalledWith({
      code: "screenshot",
      message: "Not supported here",
    })
    await openMenu()
    await menuItem("Take screenshot").click()
    await expect.poll(() => onError).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenLastCalledWith({
      code: "screenshot",
      message: "boom",
    })
    expect(count()).toBe("0")
  })

  it("logs other capture failures to console.error when PromptInput has no onError", async () => {
    allowConsole("error")
    const consoleError = vi.spyOn(console, "error")
    const mocks = mockDisplayMedia()
    const failure = new Error("boom")
    mocks.getDisplayMedia.mockRejectedValueOnce(failure)
    await render(<Composer />)
    await openMenu()
    await menuItem("Take screenshot").click()
    await expect.poll(() => consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(failure)
    expect(count()).toBe("0")
  })
})

// ---------------------------------------------------------------------------
// PromptInputSelect*
// ---------------------------------------------------------------------------

describe("PromptInputSelect", () => {
  it("renders model select with all subcomponents and a placeholder", async () => {
    await render(
      <main>
        <PromptInput onSubmit={() => {}}>
          <PromptInputBody>
            <PromptInputSelect>
              <PromptInputSelectTrigger aria-label="Model">
                <PromptInputSelectValue placeholder="Choose model" />
              </PromptInputSelectTrigger>
              <PromptInputSelectContent>
                <PromptInputSelectItem value="model-1">
                  Model 1
                </PromptInputSelectItem>
                <PromptInputSelectItem value="model-2">
                  Model 2
                </PromptInputSelectItem>
              </PromptInputSelectContent>
            </PromptInputSelect>
          </PromptInputBody>
        </PromptInput>
      </main>
    )
    await expect.element(page.getByText("Choose model")).toBeVisible()
    const trigger = page.getByRole("combobox", { name: "Model" })
    expect(trigger.element().getAttribute("aria-expanded")).toBe("false")
    await trigger.click()
    await expect.element(page.getByRole("listbox")).toBeVisible()
    await expect
      .element(page.getByRole("option", { name: "Model 2" }))
      .toBeVisible()
    expect(trigger.element().getAttribute("aria-expanded")).toBe("true")
  })

  it("renders the raw value without items and the label with items; a null value shows the placeholder", async () => {
    await render(
      <main>
        <PromptInputSelect defaultValue="gpt-4">
          <PromptInputSelectTrigger aria-label="Raw">
            <PromptInputSelectValue />
          </PromptInputSelectTrigger>
          <PromptInputSelectContent>
            <PromptInputSelectItem value="gpt-4">GPT-4</PromptInputSelectItem>
          </PromptInputSelectContent>
        </PromptInputSelect>
        <PromptInputSelect items={models} value={null}>
          <PromptInputSelectTrigger aria-label="Empty">
            <PromptInputSelectValue placeholder="Pick a model" />
          </PromptInputSelectTrigger>
          <PromptInputSelectContent>
            {models.map((model) => (
              <PromptInputSelectItem key={model.value} value={model.value}>
                {model.label}
              </PromptInputSelectItem>
            ))}
          </PromptInputSelectContent>
        </PromptInputSelect>
        <PromptInputSelect defaultValue={gpt.value} items={models}>
          <PromptInputSelectTrigger aria-label="Labelled">
            <PromptInputSelectValue />
          </PromptInputSelectTrigger>
          <PromptInputSelectContent>
            {models.map((model) => (
              <PromptInputSelectItem key={model.value} value={model.value}>
                {model.label}
              </PromptInputSelectItem>
            ))}
          </PromptInputSelectContent>
        </PromptInputSelect>
      </main>
    )
    await expect.poll(() => comboText("Raw")).toContain("gpt-4")
    await expect.poll(() => comboText("Empty")).toContain("Pick a model")
    await expect.poll(() => comboText("Labelled")).toContain("GPT-5")
  })

  it("picking an item reports (value, details), renders the label, and survives submit", async () => {
    const onValueChange = vi.fn()
    const onSubmit = vi.fn<OnSubmit>()
    await render(<Composer input={{ onSubmit }} select={{ onValueChange }} />)
    const combobox = page.getByRole("combobox", { name: "Model" })
    const label = () => combobox.element().textContent ?? ""
    await expect.poll(label).toContain("Claude Sonnet 4")
    await combobox.click()
    await page.getByRole("option", { name: "GPT-5" }).click()
    expect(onValueChange).toHaveBeenCalledWith(
      "gpt-5",
      expect.objectContaining({ reason: expect.any(String) })
    )
    await expect.poll(label).toContain("GPT-5")

    // handleSubmit calls form.reset(); the Base UI select must keep its value.
    await textarea().fill("hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await settled(() => label().includes("GPT-5"), true)
    expect(onValueChange).toHaveBeenCalledTimes(1)
  })

  it("opens from the keyboard, moves the highlight with arrows and selects with Enter", async () => {
    const onValueChange = vi.fn()
    await render(<Composer select={{ onValueChange }} />)
    const combobox = page.getByRole("combobox", { name: "Model" })
    combobox.element().focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect.element(page.getByRole("listbox")).toBeVisible()
    expect(document.activeElement?.textContent).toBe("Claude Sonnet 4")
    await userEvent.keyboard("{ArrowDown}")
    expect(document.activeElement?.textContent).toBe("GPT-5")
    await userEvent.keyboard("{Enter}")
    expect(onValueChange).toHaveBeenCalledWith("gpt-5", expect.anything())
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
    await expect.poll(() => comboText("Model")).toContain("GPT-5")
    expect(describeActive()).toBe("Model")
  })
})

// ---------------------------------------------------------------------------
// PromptInputHoverCard*
// ---------------------------------------------------------------------------

describe("PromptInputHoverCard", () => {
  const card = () => document.querySelector('[data-slot="hover-card-content"]')

  function Card({
    openDelay,
    triggerDelay,
  }: {
    openDelay?: number
    triggerDelay?: number
  }) {
    return (
      <main>
        <PromptInputHoverCard
          {...(openDelay !== undefined ? { openDelay } : {})}
        >
          <PromptInputHoverCardTrigger
            {...(triggerDelay !== undefined ? { delay: triggerDelay } : {})}
          >
            Hover me
          </PromptInputHoverCardTrigger>
          <PromptInputHoverCardContent>Card body</PromptInputHoverCardContent>
        </PromptInputHoverCard>
        <p>Elsewhere</p>
      </main>
    )
  }

  // The pointer stays where the previous test left it, so park it off the
  // trigger before measuring hover behaviour.
  const parkPointer = () => userEvent.hover(page.getByText("Elsewhere"))

  it("renders the hover card aligned to the start, opens on hover, closes on unhover and passes axe", async () => {
    await render(<Card />)
    await parkPointer()
    const trigger = page.getByText("Hover me")
    await expect.element(trigger).toBeVisible()
    expect(card()).toBeNull()
    await userEvent.hover(trigger)
    await expect.element(page.getByText("Card body")).toBeVisible()
    expect(card()?.getAttribute("data-align")).toBe("start")
    await expectNoViolations(card() as Element)
    await expectNoViolations({
      exclude: ["[data-base-ui-portal]"],
      include: [document.body],
    })
    await userEvent.unhover(trigger)
    await expect.element(page.getByText("Card body")).not.toBeInTheDocument()
  })

  it("opens with no delay by default, after openDelay when set, and a trigger delay overrides the root's", async () => {
    const hoverTrigger = () => hoverNative(page.getByText("Hover me").element())

    let screen = await render(<Card />)
    await parkPointer()
    useFakeTimers()
    expect(card()).toBeNull()
    await hoverTrigger()
    await advance(0)
    expect(card()?.textContent).toBe("Card body")
    vi.useRealTimers()
    await screen.unmount()

    screen = await render(<Card openDelay={500} />)
    await parkPointer()
    useFakeTimers()
    await hoverTrigger()
    await advance(499)
    expect(card()).toBeNull()
    await advance(1)
    expect(card()?.textContent).toBe("Card body")
    vi.useRealTimers()
    await screen.unmount()

    await render(<Card openDelay={500} triggerDelay={0} />)
    await parkPointer()
    useFakeTimers()
    await hoverTrigger()
    await advance(0)
    expect(card()?.textContent).toBe("Card body")
  })
})

// ---------------------------------------------------------------------------
// PromptInputCommand*
// ---------------------------------------------------------------------------

describe("PromptInputCommand", () => {
  it("renders command input, groups with headings, items and a separator", async () => {
    const onSelect = vi.fn()
    await render(
      <main>
        <PromptInputCommand>
          <PromptInputCommandInput placeholder="Search..." />
          <PromptInputCommandList>
            <PromptInputCommandEmpty>No results</PromptInputCommandEmpty>
            <PromptInputCommandGroup heading="Suggestions">
              <PromptInputCommandItem onSelect={onSelect}>
                Item 1
              </PromptInputCommandItem>
              <PromptInputCommandItem>Item 2</PromptInputCommandItem>
            </PromptInputCommandGroup>
            <PromptInputCommandSeparator />
            <PromptInputCommandGroup heading="More">
              <PromptInputCommandItem>Item 3</PromptInputCommandItem>
            </PromptInputCommandGroup>
          </PromptInputCommandList>
        </PromptInputCommand>
      </main>
    )
    await expect.element(page.getByPlaceholder("Search...")).toBeVisible()
    await expect.element(page.getByText("Suggestions")).toBeVisible()
    await expect.element(page.getByText("Item 1")).toBeVisible()
    await expect.element(page.getByText("Item 2")).toBeVisible()
    await expect.element(page.getByText("Item 3")).toBeVisible()
    expect(document.querySelector('[role="separator"]')).not.toBeNull()
    await page.getByText("Item 1").click()
    expect(onSelect).toHaveBeenCalledWith("Item 1")
  })

  it("filters items and shows empty state", async () => {
    await render(
      <main>
        <PromptInputCommand>
          <PromptInputCommandInput placeholder="Search" />
          <PromptInputCommandList>
            <PromptInputCommandEmpty>No results found</PromptInputCommandEmpty>
            <PromptInputCommandGroup heading="Actions">
              <PromptInputCommandItem>Alpha</PromptInputCommandItem>
              <PromptInputCommandItem>Beta</PromptInputCommandItem>
            </PromptInputCommandGroup>
          </PromptInputCommandList>
        </PromptInputCommand>
      </main>
    )
    await expect.element(page.getByText("Alpha")).toBeVisible()
    await page.getByPlaceholder("Search").fill("zzz")
    await expect.element(page.getByText("No results found")).toBeVisible()
    await expect.element(page.getByText("Alpha")).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// PromptInputTab*
// ---------------------------------------------------------------------------

describe("PromptInputTab", () => {
  it("renders tab list, label, body and items with merged classNames", async () => {
    await render(
      <main>
        <PromptInputTabsList className="custom-list" data-testid="list">
          <PromptInputTab className="custom-tab" data-testid="tab">
            <PromptInputTabLabel className="custom-label">
              Commands
            </PromptInputTabLabel>
            <PromptInputTabBody className="custom-body" data-testid="body">
              <PromptInputTabItem className="custom-item">
                Command 1
              </PromptInputTabItem>
              <PromptInputTabItem>Command 2</PromptInputTabItem>
            </PromptInputTabBody>
          </PromptInputTab>
          <PromptInputTab>Tab 2</PromptInputTab>
        </PromptInputTabsList>
      </main>
    )
    const heading = page.getByRole("heading", { level: 3, name: "Commands" })
    await expect.element(heading).toBeVisible()
    expect(heading.element().classList.contains("custom-label")).toBe(true)
    await expect.element(page.getByText("Command 1")).toBeVisible()
    await expect.element(page.getByText("Command 2")).toBeVisible()
    await expect.element(page.getByText("Tab 2")).toBeVisible()
    expect(page.getByTestId("list").element().className).toBe("custom-list")
    expect(page.getByTestId("tab").element().className).toBe("custom-tab")
    const body = page.getByTestId("body").element()
    expect(body.classList.contains("space-y-1")).toBe(true)
    expect(body.classList.contains("custom-body")).toBe(true)
    const item = page.getByText("Command 1").element()
    expect(item.classList.contains("custom-item")).toBe(true)
    expect(item.classList.contains("hover:bg-accent")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// PromptInputButton
// ---------------------------------------------------------------------------

describe("PromptInputButton", () => {
  function Toolbar({ children }: { children: ReactNode }) {
    return (
      <main>
        <PromptInput onSubmit={() => {}}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>{children}</PromptInputTools>
            <PromptInputSubmit />
          </PromptInputFooter>
        </PromptInput>
      </main>
    )
  }

  it("renders a ghost type=button that never submits the form", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    const onClick = vi.fn()
    await render(
      <main>
        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
            <PromptInputButton onClick={onClick}>Action</PromptInputButton>
          </PromptInputBody>
        </PromptInput>
      </main>
    )
    const button = page.getByRole("button", { name: "Action" })
    expect(button.element().getAttribute("type")).toBe("button")
    expect(button.element().className).toContain("hover:bg-muted")
    await button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    await settled(() => onSubmit.mock.calls.length, 0)
  })

  it("sizes itself from the child count unless size is given, and merges className", async () => {
    await render(
      <Toolbar>
        <PromptInputButton aria-label="Search" className="custom-button">
          <span>icon</span>
        </PromptInputButton>
        <PromptInputButton>
          <span>icon</span>
          <span>Label</span>
        </PromptInputButton>
        <PromptInputButton aria-label="Big" size="sm" variant="outline">
          <span>icon</span>
        </PromptInputButton>
      </Toolbar>
    )
    const single = page.getByRole("button", { name: "Search" }).element()
    expect(single.getAttribute("data-size")).toBe("icon-sm")
    expect(single.classList.contains("custom-button")).toBe(true)
    expect(
      page
        .getByRole("button", { name: "icon Label" })
        .element()
        .getAttribute("data-size")
    ).toBe("sm")
    const big = page.getByRole("button", { name: "Big" }).element()
    expect(big.getAttribute("data-size")).toBe("sm")
    expect(big.className).toContain("border-border")
  })

  it("renders button with string tooltip", async () => {
    await render(
      <Toolbar>
        <PromptInputButton tooltip="Search the web">Search</PromptInputButton>
      </Toolbar>
    )
    const button = page.getByRole("button", { name: "Search" })
    await expect.element(button).toBeVisible()
    await userEvent.hover(button)
    await expect
      .poll(tooltipText, { timeout: 3000 })
      .toContain("Search the web")
  })

  it("renders button with object tooltip containing shortcut on the requested side", async () => {
    await render(
      <Toolbar>
        <PromptInputButton
          tooltip={{ content: "Open Search", shortcut: "⌘K", side: "bottom" }}
        >
          Search
        </PromptInputButton>
      </Toolbar>
    )
    await userEvent.hover(page.getByRole("button", { name: "Search" }))
    await expect.poll(tooltipText, { timeout: 3000 }).toContain("Open Search")
    expect(tooltipText()).toContain("⌘K")
    expect(
      document
        .querySelector('[data-slot="tooltip-content"]')
        ?.getAttribute("data-side")
    ).toBe("bottom")
  })

  it("does not render tooltip when prop is not provided", async () => {
    await render(
      <Toolbar>
        <PromptInputButton>Action</PromptInputButton>
      </Toolbar>
    )
    const button = page.getByRole("button", { name: "Action" })
    expect(button.element().getAttribute("aria-describedby")).toBeNull()
    await userEvent.hover(button)
    await settled(
      () => document.querySelector('[data-slot="tooltip-content"]'),
      null
    )
  })

  it("opens the tooltip on hover with no delay, like upstream's delayDuration 0", async () => {
    await render(
      <Toolbar>
        <PromptInputButton aria-label="Search" tooltip="Search the web">
          <span>icon</span>
        </PromptInputButton>
      </Toolbar>
    )
    // Park the real pointer away from the button (a previous test may have
    // left it there) and let any tooltip it opened finish closing before
    // faking the clock.
    await userEvent.hover(textarea())
    await expect.poll(tooltipText).toBe("")
    useFakeTimers()
    await hoverNative(page.getByRole("button", { name: "Search" }).element())
    await advance(0)
    expect(tooltipText()).toBe("Search the web")
  })

  it("does not describe a button whose tooltip repeats its visible text", async () => {
    await render(
      <Toolbar>
        <PromptInputButton tooltip="Search">
          <GlobeIcon />
          <span>Search</span>
        </PromptInputButton>
        <PromptInputButton tooltip="Search the web">
          <GlobeIcon />
          <span>Look up</span>
        </PromptInputButton>
      </Toolbar>
    )
    const repeated = page.getByRole("button", { name: "Search" }).element()
    expect(repeated.getAttribute("aria-describedby")).toBeNull()
    const described = page.getByRole("button", { name: "Look up" }).element()
    const id = described.getAttribute("aria-describedby")
    expect(id).not.toBeNull()
    expect(document.getElementById(id ?? "")?.textContent).toBe(
      "Search the web"
    )
  })

  it("treats an empty tooltip as none: no aria-describedby and nothing on hover", async () => {
    await render(
      <Toolbar>
        <PromptInputButton aria-label="Voice input" tooltip="">
          <MicIcon />
        </PromptInputButton>
        <PromptInputButton aria-label="Search" tooltip={{ content: "" }}>
          <GlobeIcon />
        </PromptInputButton>
      </Toolbar>
    )
    for (const name of ["Voice input", "Search"]) {
      const button = page.getByRole("button", { name })
      expect(button.element().getAttribute("aria-describedby")).toBeNull()
      await userEvent.hover(button)
      await settled(
        () => document.querySelector('[data-slot="tooltip-content"]'),
        null
      )
    }
  })

  it("exposes a tooltip shortcut as aria-keyshortcuts, also when the tooltip repeats the visible text", async () => {
    await render(
      <Toolbar>
        <PromptInputButton tooltip={{ content: "Search", shortcut: "⌘K" }}>
          <GlobeIcon />
          <span>Search</span>
        </PromptInputButton>
        <PromptInputButton
          aria-label="Deep research"
          tooltip={{ content: "Research in depth", shortcut: "Ctrl+Shift+R" }}
        >
          <BrainIcon />
        </PromptInputButton>
        <PromptInputButton
          aria-label="Send now"
          tooltip={{ content: "Send now", shortcut: "⌘⇧↵" }}
        >
          <SparklesIcon />
        </PromptInputButton>
        <PromptInputButton
          aria-label="Close"
          tooltip={{ content: "Close", shortcut: "esc" }}
        >
          <SparklesIcon />
        </PromptInputButton>
        <PromptInputButton aria-label="Voice input" tooltip="Dictate">
          <MicIcon />
        </PromptInputButton>
        <PromptInputButton
          aria-keyshortcuts="Alt+M"
          aria-label="Mic"
          tooltip={{ content: "Dictate", shortcut: "⌥D" }}
        >
          <MicIcon />
        </PromptInputButton>
      </Toolbar>
    )
    const button = (name: string) =>
      page.getByRole("button", { name }).element()
    const shortcuts = (name: string) =>
      button(name).getAttribute("aria-keyshortcuts")

    // The description is skipped because it repeats "Search"; the shortcut
    // is not lost with it.
    expect(shortcuts("Search")).toBe("Meta+K")
    expect(button("Search").getAttribute("aria-describedby")).toBeNull()

    expect(shortcuts("Deep research")).toBe("Control+Shift+R")
    const describedBy = button("Deep research").getAttribute("aria-describedby")
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
      "Research in depth Ctrl+Shift+R"
    )
    expect(shortcuts("Send now")).toBe("Meta+Shift+Enter")
    expect(shortcuts("Close")).toBe("Escape")
    expect(shortcuts("Voice input")).toBeNull()
    expect(shortcuts("Mic")).toBe("Alt+M")
  })

  it("exposes the tooltip text as an accessible description unless it repeats the label", async () => {
    await render(
      <Toolbar>
        <PromptInputButton
          aria-label="Search"
          tooltip={{ content: "Search the web", shortcut: "⌘K" }}
        >
          <span>icon</span>
        </PromptInputButton>
        <PromptInputButton aria-label="Voice input" tooltip="Voice input">
          <span>icon</span>
        </PromptInputButton>
      </Toolbar>
    )
    const search = page.getByRole("button", { name: "Search" }).element()
    const describedBy = search.getAttribute("aria-describedby")
    expect(describedBy).not.toBeNull()
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
      "Search the web ⌘K"
    )
    const voice = page.getByRole("button", { name: "Voice input" }).element()
    expect(voice.getAttribute("aria-describedby")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PromptInputSubmit
// ---------------------------------------------------------------------------

describe("PromptInputSubmit", () => {
  it("renders submit button", async () => {
    await render(<Bare />)
    const button = submitButton().element()
    expect(button.getAttribute("type")).toBe("submit")
    expect(button.getAttribute("data-size")).toBe("icon-sm")
    expect(button.className).toContain("bg-primary")
    expect(button.querySelector("svg.lucide-corner-down-left")).not.toBeNull()
  })

  it("shows loading icon when submitted", async () => {
    await render(<Composer submit={{ status: "submitted" }} />)
    // The spinner reports progress; without onStop a press still submits, so
    // the button keeps its Submit name and type.
    const button = submitButton().element()
    expect(button.querySelector(".animate-spin")).not.toBeNull()
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull()
    expect(button.getAttribute("type")).toBe("submit")
  })

  it("shows stop icon when streaming", async () => {
    await render(
      <Composer submit={{ onStop: () => {}, status: "streaming" }} />
    )
    const button = stopButton().element()
    expect(button.querySelector("svg.lucide-square")).not.toBeNull()
    expect(button.getAttribute("type")).toBe("button")
  })

  it.each([
    ["submitted", '[data-slot="spinner"]'],
    ["streaming", "svg.lucide-corner-down-left"],
  ] as const)(
    "keeps the Submit name, type=submit and no stop glyph while %s without onStop, so a press submits the draft",
    async (status, glyph) => {
      const onSubmit = vi.fn<OnSubmit>()
      const onClick = vi.fn()
      await render(
        <Composer input={{ onSubmit }} submit={{ onClick, status }} />
      )
      const submit = submitButton()
      await expect.element(submit).toBeVisible()
      expect(stopButton().query()).toBeNull()
      expect(submit.element().getAttribute("type")).toBe("submit")
      expect(submit.element().querySelector(glyph)).not.toBeNull()
      expect(submit.element().querySelector("svg.lucide-square")).toBeNull()
      await expectNoViolations()

      await textarea().fill("go")
      await submit.click()
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({ files: [], text: "go" })
      await expect.element(textarea()).toHaveValue("")
    }
  )

  it.each(["ready", "error"] as const)(
    "stays a Submit button while %s even with onStop wired",
    async (status) => {
      const onSubmit = vi.fn<OnSubmit>()
      const onStop = vi.fn()
      await render(
        <Composer input={{ onSubmit }} submit={{ onStop, status }} />
      )
      const submit = submitButton()
      await expect.element(submit).toHaveAttribute("type", "submit")
      expect(submit.element().querySelector("svg.lucide-square")).toBeNull()
      await submit.click()
      await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
      expect(onStop).not.toHaveBeenCalled()
    }
  )

  it("shows the error icon with the Submit label when status is error", async () => {
    await render(<Composer submit={{ status: "error" }} />)
    const button = submitButton().element()
    expect(button.querySelector("svg.lucide-x")).not.toBeNull()
    expect(button.getAttribute("type")).toBe("submit")
  })

  it.each(["submitted", "streaming"] as const)(
    "renders Stop as type=button while %s with onStop so clicking it never submits",
    async (status) => {
      const onSubmit = vi.fn<OnSubmit>()
      const onStop = vi.fn()
      const onClick = vi.fn()
      await render(
        <Composer input={{ onSubmit }} submit={{ onClick, onStop, status }} />
      )
      await textarea().fill("draft")
      const stop = stopButton()
      await expect.element(stop).toBeVisible()
      expect(submitButton().query()).toBeNull()
      expect(stop.element().getAttribute("type")).toBe("button")
      await stop.click()
      expect(onStop).toHaveBeenCalledTimes(1)
      expect(onClick).not.toHaveBeenCalled()
      await settled(() => onSubmit.mock.calls.length, 0)
      expect(textareaEl().value).toBe("draft")
    }
  )

  it("submits exactly once per click when ready and passes onClick through", async () => {
    const onSubmit = vi.fn<OnSubmit>()
    const onClick = vi.fn()
    await render(<Composer input={{ onSubmit }} submit={{ onClick }} />)
    await textarea().fill("Hello there")
    await submitButton().click()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      files: [],
      text: "Hello there",
    })
    await expect.element(textarea()).toHaveValue("")
    await settled(() => onSubmit.mock.calls.length, 1)
  })

  it("lets props override the aria-label and children replace the icon", async () => {
    await render(
      <Composer
        submit={{
          "aria-label": "Send",
          children: <span>Go</span>,
          className: "custom-submit",
        }}
      />
    )
    const button = page.getByRole("button", { name: "Send" }).element()
    expect(button.textContent).toBe("Go")
    expect(button.querySelector("svg")).toBeNull()
    expect(button.classList.contains("custom-submit")).toBe(true)
    expect(button.classList.contains("shrink-0")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// PromptInputHeader / PromptInputFooter / PromptInputTools
// ---------------------------------------------------------------------------

describe("PromptInputHeader, PromptInputFooter and PromptInputTools", () => {
  it("renders header, footer and tools content with merged classNames and block-end alignment", async () => {
    await render(
      <main>
        <PromptInput onSubmit={() => {}}>
          <PromptInputBody>
            <PromptInputHeader className="custom-header" data-testid="header">
              Header content
            </PromptInputHeader>
            <PromptInputTextarea />
            <PromptInputFooter className="custom-footer" data-testid="footer">
              <PromptInputTools className="custom-tools" data-testid="tools">
                Tools
              </PromptInputTools>
              <span>Footer content</span>
            </PromptInputFooter>
          </PromptInputBody>
        </PromptInput>
      </main>
    )
    await expect.element(page.getByText("Header content")).toBeVisible()
    await expect.element(page.getByText("Footer content")).toBeVisible()
    await expect.element(page.getByText("Tools")).toBeVisible()
    const header = page.getByTestId("header").element()
    expect(header.getAttribute("data-align")).toBe("block-end")
    expect(header.classList.contains("order-first")).toBe(true)
    expect(header.classList.contains("custom-header")).toBe(true)
    const footer = page.getByTestId("footer").element()
    expect(footer.getAttribute("data-align")).toBe("block-end")
    expect(footer.classList.contains("justify-between")).toBe(true)
    expect(footer.classList.contains("custom-footer")).toBe(true)
    const tools = page.getByTestId("tools").element()
    expect(tools.classList.contains("flex-wrap")).toBe(true)
    expect(tools.classList.contains("custom-tools")).toBe(true)
    // The header renders before the textarea even though it is declared after it in the footer tree.
    expect(
      header.compareDocumentPosition(textareaEl()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("focuses the textarea, not the model select, when the footer or header whitespace is clicked", async () => {
    await render(<Composer />)
    const combobox = page.getByRole("combobox", { name: "Model" }).element()
    const footer = document.querySelector<HTMLElement>(
      '[data-slot="input-group-addon"]:has([role="combobox"])'
    )
    const header = document.querySelector<HTMLElement>(
      '[data-slot="input-group-addon"]:has([data-testid="count"])'
    )
    if (!(footer && header)) {
      throw new Error("addons not rendered")
    }
    footer.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    footer.click()
    await expect.poll(() => document.activeElement).toBe(textareaEl())
    expect(document.activeElement).not.toBe(combobox)

    combobox.focus()
    header.click()
    await expect.poll(() => document.activeElement).toBe(textareaEl())
  })

  it("leaves focus alone for clicks on controls inside the footer", async () => {
    await render(<Composer />)
    const combobox = page.getByRole("combobox", { name: "Model" })
    await combobox.click()
    await expect.element(page.getByRole("listbox")).toBeVisible()
    expect(document.activeElement).not.toBe(textareaEl())
    await userEvent.keyboard("{Escape}")
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
    expect(describeActive()).toBe("Model")
  })

  it.each([
    [
      "a role=switch control",
      <div
        aria-checked="false"
        aria-label="Web search"
        data-testid="control"
        key="switch"
        role="switch"
        tabIndex={0}
      >
        off
      </div>,
    ],
    [
      "a plain tabindex=0 element",
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a bare focusable element is the case under test.
      <div data-testid="control" key="chip" tabIndex={0}>
        chip
      </div>,
    ],
  ])("leaves focus on %s inside the footer", async (_label, control) => {
    await render(
      <main>
        <PromptInput onSubmit={() => {}}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>{control}</PromptInputTools>
            <PromptInputSubmit />
          </PromptInputFooter>
        </PromptInput>
      </main>
    )
    const target = page.getByTestId("control")
    await target.click()
    await settled(() => document.activeElement, target.element())
  })

  it("leaves focus with a label's control and with a role=button inside a label in the footer", async () => {
    await render(
      <main>
        <PromptInput onSubmit={() => {}}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <label htmlFor="deep">
                <input id="deep" type="checkbox" /> Deep think
              </label>
              {/* biome-ignore lint/a11y/noLabelWithoutControl: the label wraps a widget, which is the case under test. */}
              <label>
                {/* biome-ignore lint/a11y/useSemanticElements: a widget role inside a label is the case under test. */}
                <div role="button" tabIndex={0}>
                  Fast mode
                </div>
              </label>
            </PromptInputTools>
            <PromptInputSubmit />
          </PromptInputFooter>
        </PromptInput>
      </main>
    )
    await page.getByText("Deep think").click()
    const checkbox = page.getByRole("checkbox").element()
    await settled(() => document.activeElement, checkbox)

    const chip = page.getByRole("button", { name: "Fast mode" }).element()
    await page.getByText("Fast mode").click()
    await settled(() => document.activeElement, chip)
  })

  it("calls a consumer onClick first and skips focusing when it prevents default", async () => {
    const onClick = vi.fn()
    const veto = vi.fn((event: { preventDefault(): void }) =>
      event.preventDefault()
    )
    await render(
      <main>
        <PromptInput onSubmit={() => {}}>
          <PromptInputHeader data-testid="header" onClick={onClick}>
            Header
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter data-testid="footer" onClick={veto}>
            Footer
          </PromptInputFooter>
        </PromptInput>
      </main>
    )
    await page.getByTestId("header").click()
    expect(onClick).toHaveBeenCalledTimes(1)
    await expect.poll(() => document.activeElement).toBe(textareaEl())

    textareaEl().blur()
    await page.getByTestId("footer").click()
    expect(veto).toHaveBeenCalledTimes(1)
    await settled(() => document.activeElement === textareaEl(), false)
  })

  /**
   * The geometry of the composer's controls: where they overlap, how many
   * rows the toolbar takes, and whether anything pokes out of the form.
   */
  function composerGeometry() {
    const form = formEl().getBoundingClientRect()
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'form button, form [role="combobox"], form textarea'
      )
    ).map((el) => ({
      name: el.getAttribute("aria-label") ?? el.textContent ?? el.tagName,
      rect: el.getBoundingClientRect(),
    }))
    const overlaps: string[] = []
    for (const [i, a] of controls.entries()) {
      for (const b of controls.slice(i + 1)) {
        const intersects =
          a.rect.left < b.rect.right &&
          b.rect.left < a.rect.right &&
          a.rect.top < b.rect.bottom &&
          b.rect.top < a.rect.bottom
        if (intersects) {
          overlaps.push(`${a.name} overlaps ${b.name}`)
        }
      }
    }
    const outside = controls
      .filter(
        ({ rect }) => rect.left < form.left - 1 || rect.right > form.right + 1
      )
      .map(({ name }) => name)
    const toolRows = new Set(
      controls
        .filter(({ name }) => name !== "Submit" && name !== "TEXTAREA")
        .map(({ rect }) => Math.round(rect.top))
    ).size
    return { controls, outside, overlaps, toolRows }
  }

  /**
   * Axe, plus the "obscured" incompletes axe reports for covered targets. The
   * pointer is parked on the textarea first so no tooltip (a portal outside
   * <main>) is open from wherever the previous test left the mouse.
   */
  async function expectNothingObscured() {
    await userEvent.hover(textarea())
    await expect.poll(tooltipText).toBe("")
    const results = await runAxe()
    expect(results.violations).toEqual([])
    const obscured = results.incomplete.flatMap((result) =>
      result.nodes
        .flatMap((node) => [...node.any, ...node.all, ...node.none])
        .map((check) => check.message)
        .filter((message) => /obscured/i.test(message))
    )
    expect(obscured).toEqual([])
  }

  it("keeps every toolbar control clear of the submit button at phone width", async () => {
    await page.viewport(375, 812)
    // The same toolbar and side padding as the preview page.
    await render(
      <div className="mx-auto w-full max-w-3xl px-4">
        <Composer
          tools={
            <>
              <PromptInputButton aria-label="Voice input" tooltip="Voice input">
                <MicIcon />
              </PromptInputButton>
              <PromptInputButton tooltip={{ content: "Search the web" }}>
                <GlobeIcon />
                <span>Search</span>
              </PromptInputButton>
            </>
          }
        />
      </div>
    )
    await expect.element(submitButton()).toBeVisible()
    const geometry = composerGeometry()
    expect(geometry.controls.length).toBeGreaterThan(4)
    expect(geometry.overlaps).toEqual([])
    expect(geometry.outside).toEqual([])
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375)
    await expectNothingObscured()
  })

  it("wraps six tools into rows that never cover the submit button, which stays inside the footer", async () => {
    await page.viewport(375, 812)
    await render(
      <div className="mx-auto w-full max-w-3xl px-4">
        <Composer
          tools={
            <>
              <PromptInputButton aria-label="Voice input" tooltip="Voice input">
                <MicIcon />
              </PromptInputButton>
              <PromptInputButton tooltip="Search the web">
                <GlobeIcon />
                <span>Search</span>
              </PromptInputButton>
              <PromptInputButton tooltip="Think longer">
                <BrainIcon />
                <span>Think</span>
              </PromptInputButton>
              <PromptInputButton tooltip="Improve the prompt">
                <SparklesIcon />
                <span>Improve</span>
              </PromptInputButton>
            </>
          }
        />
      </div>
    )
    await expect.element(submitButton()).toBeVisible()
    const geometry = composerGeometry()
    expect(geometry.overlaps, JSON.stringify(geometry)).toEqual([])
    expect(geometry.outside).toEqual([])
    expect(geometry.toolRows).toBeGreaterThan(1)
    // The submit button sits inside the footer, right-aligned, below the textarea.
    const submit = submitButton().element().getBoundingClientRect()
    const footer = (
      submitButton()
        .element()
        .closest('[data-slot="input-group-addon"]') as HTMLElement | null
    )?.getBoundingClientRect()
    expect(footer).toBeDefined()
    expect(submit.right).toBeLessThanOrEqual((footer?.right ?? 0) + 1)
    expect(submit.top).toBeGreaterThanOrEqual((footer?.top ?? 0) - 1)
    expect(submit.bottom).toBeLessThanOrEqual((footer?.bottom ?? 0) + 1)
    expect(submit.top).toBeGreaterThanOrEqual(
      textareaEl().getBoundingClientRect().bottom
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375)
    await expectNothingObscured()
  })
})

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("accessibility", () => {
  it("renders an accessible composer", async () => {
    await render(<Composer />)
    await expect.element(textarea()).toBeVisible()
    await expect.element(submitButton()).toBeVisible()
    await expect.element(menuTrigger()).toBeVisible()
    // `items` on the select root lets Base UI's Select.Value render the label.
    await expect
      .element(page.getByRole("combobox", { name: "Model" }))
      .toBeVisible()
    await expect.element(page.getByText("Claude Sonnet 4")).toBeVisible()
    await expectNoViolations()
  })

  it("passes axe with attachments and referenced sources listed", async () => {
    await render(<Composer withSources />)
    chooseFiles([
      makeFile("a.png", "image/png"),
      makeFile("b.pdf", "application/pdf"),
    ])
    await page.getByRole("button", { name: "Add source" }).click()
    await expect.poll(count).toBe("2")
    await expectNoViolations()
  })

  it("passes axe with the action menu open", async () => {
    await render(<Composer />)
    await openMenu()
    const popup = menuPopup()
    expect(popup).not.toBeNull()
    await expectNoViolations(popup as Element)
    // The popup is portaled outside <main>, so it is scanned on its own above
    // and its portal container is excluded from the page scan.
    await expectNoViolations({
      exclude: ["[data-base-ui-portal]"],
      include: [document.body],
    })
  })

  it("passes axe with the model select open", async () => {
    await render(<Composer />)
    await page.getByRole("combobox", { name: "Model" }).click()
    await expect
      .element(page.getByRole("option", { name: "GPT-5" }))
      .toBeVisible()
    const popup = document.querySelector('[data-slot="select-content"]')
    expect(popup).not.toBeNull()
    await expectNoViolations(popup as Element)
    // Base UI's Select is modal and renders floating-ui focus guards
    // (aria-hidden spans with tabindex=0) that axe's aria-hidden-focus rule
    // flags; they belong to the vendored select, not to this component.
    await expectNoViolations({
      exclude: ["[data-base-ui-portal]", "[data-base-ui-focus-guard]"],
      include: [document.body],
    })
  })

  it.each(["submitted", "streaming", "error"] as const)(
    "passes axe in the %s status",
    async (status) => {
      await render(<Composer submit={{ onStop: () => {}, status }} />)
      await expectNoViolations()
    }
  )

  it("passes axe in dark mode with the full composition", async () => {
    await withDark(async () => {
      await render(
        <Composer
          submit={{ status: "ready" }}
          tools={
            <>
              <PromptInputButton aria-label="Voice input" tooltip="Voice input">
                <span>mic</span>
              </PromptInputButton>
              <PromptInputButton tooltip={{ content: "Search the web" }}>
                <span>globe</span>
                <span>Search</span>
              </PromptInputButton>
              <PromptInputHoverCard>
                <PromptInputHoverCardTrigger>
                  Details
                </PromptInputHoverCardTrigger>
                <PromptInputHoverCardContent>
                  Card body
                </PromptInputHoverCardContent>
              </PromptInputHoverCard>
            </>
          }
          withSources
        />
      )
      chooseFiles([makeFile("a.png", "image/png")])
      await expect.poll(count).toBe("1")
      // Park the pointer on the textarea so no tooltip or hover card opens
      // from where the previous test left the mouse.
      await userEvent.hover(textarea())
      await expectNoViolations()
    })
  })
})
