"use client"

import type {
  ChatStatus,
  FileUIPart,
  UIDataTypes,
  UIMessage,
  UIMessagePart,
  UITools,
} from "ai"
import { isToolUIPart } from "ai"
import { cn } from "cn"
import {
  CircleAlertIcon,
  FileIcon,
  LoaderCircleIcon,
  MessageCircleDashedIcon,
  XIcon,
} from "lucide-react"
import type { ComponentProps, KeyboardEvent, ReactNode } from "react"
import { Component, useCallback } from "react"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/registry/ai/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/registry/ai/reasoning"
import { MessageResponse } from "@/registry/ai/response"
import { Suggestion, Suggestions } from "@/registry/ai/suggestion"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/registry/ai/tool"

/** One part of an AI SDK `UIMessage`, with the default data and tool maps. */
export type ChatMessagePartType = UIMessagePart<UIDataTypes, UITools>

/** What the composer hands back on submit: the text and any attached files. */
export type ChatSubmitMessage = PromptInputMessage

/** Called by the error row's Retry button; `regenerate` from `useChat` fits as-is. */
export type ChatRetryHandler = () => void | Promise<void>

function isGenerating(status: ChatStatus) {
  return status === "submitted" || status === "streaming"
}

/**
 * Calls a consumer's `onSubmit` without waiting for it (`sendMessage`
 * settles only once the answer has streamed) and reports a rejection through
 * `console.error` instead of leaving it unhandled. A synchronous throw is
 * reported the same way; the return value says whether the call went out.
 */
function submitInBackground(
  onSubmit: (message: ChatSubmitMessage) => void | Promise<void>,
  message: ChatSubmitMessage
): boolean {
  try {
    Promise.resolve(onSubmit(message)).catch((reason: unknown) =>
      console.error(reason)
    )
    return true
  } catch (reason) {
    console.error(reason)
    return false
  }
}

export type ChatProps = Omit<ComponentProps<"div">, "onSubmit"> & {
  messages: UIMessage[]
  status: ChatStatus
  onSubmit: (message: ChatSubmitMessage) => void | Promise<void>
  onStop?: (() => void) | undefined
  /** The `error` from `useChat`; shown as a row at the end of the transcript. */
  error?: Error | undefined
  /** Called by the error row's Retry button; pass `regenerate` from `useChat`. */
  onRetry?: ChatRetryHandler | undefined
  /** One-click prompts shown in the empty state; each is submitted as-is. */
  suggestions?: string[] | undefined
  placeholder?: string | undefined
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
}

/**
 * A complete chat surface for AI SDK `useChat`: a scrolling transcript with an
 * empty state, streamed assistant parts, a "thinking" marker, an error row
 * with retry, and a composer. Fills its parent, so render it inside a
 * height-constrained container.
 */
export function Chat({
  messages,
  status,
  onSubmit,
  onStop,
  error,
  onRetry,
  suggestions,
  placeholder,
  emptyTitle,
  emptyDescription,
  className,
  ...props
}: ChatProps) {
  const busy = isGenerating(status)
  const handleSuggestion = useCallback(
    (text: string) => {
      if (busy) return
      submitInBackground(onSubmit, { text, files: [] })
    },
    [onSubmit, busy]
  )

  return (
    <div
      data-slot="chat"
      className={cn("flex h-full min-h-0 w-full flex-col gap-4", className)}
      {...props}
    >
      <MessageScrollerProvider autoScroll>
        <ChatMessages
          emptyDescription={emptyDescription}
          emptyTitle={emptyTitle}
          error={error}
          messages={messages}
          onRetry={onRetry}
          onSuggestionClick={handleSuggestion}
          status={status}
          suggestions={suggestions}
        />
      </MessageScrollerProvider>
      <ChatComposer
        onStop={onStop}
        onSubmit={onSubmit}
        placeholder={placeholder}
        status={status}
      />
    </div>
  )
}

export type ChatMessagesProps = ComponentProps<typeof MessageScroller> & {
  messages: UIMessage[]
  status: ChatStatus
  error?: Error | undefined
  onRetry?: ChatRetryHandler | undefined
  suggestions?: string[] | undefined
  onSuggestionClick?: ((suggestion: string) => void) | undefined
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
}

/**
 * The transcript: a `MessageScroller` frame (render it inside a
 * `MessageScrollerProvider`) that shows `ChatEmpty` until the first message,
 * one `ChatMessage` per message, `ChatThinkingMarker` while a request is
 * pending, and `ChatErrorMarker` when `error` is set or `status` is "error"
 * (a generic message when no `error` is given).
 */
export function ChatMessages({
  messages,
  status,
  error,
  onRetry,
  suggestions,
  onSuggestionClick,
  emptyTitle,
  emptyDescription,
  className,
  ...props
}: ChatMessagesProps) {
  return (
    <MessageScroller className={cn("flex-1", className)} {...props}>
      <MessageScrollerViewport>
        <MessageScrollerContent aria-busy={isGenerating(status)}>
          {messages.length === 0 ? (
            <MessageScrollerItem className="flex flex-1">
              <ChatEmpty
                description={emptyDescription}
                onSuggestionClick={onSuggestionClick}
                suggestions={suggestions}
                title={emptyTitle}
              />
            </MessageScrollerItem>
          ) : (
            messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                status={index === messages.length - 1 ? status : "ready"}
              />
            ))
          )}
          {status === "submitted" ? <ChatThinkingMarker /> : null}
          {error || status === "error" ? (
            <ChatErrorMarker error={error} onRetry={onRetry} />
          ) : null}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton />
    </MessageScroller>
  )
}

export type ChatEmptyProps = Omit<ComponentProps<typeof Empty>, "title"> & {
  title?: ReactNode
  description?: ReactNode
  suggestions?: string[] | undefined
  onSuggestionClick?: ((suggestion: string) => void) | undefined
}

/** Empty-transcript state with an optional row of one-click suggestions. */
export function ChatEmpty({
  title = "Start a conversation",
  description = "Ask a question or pick a suggestion to begin.",
  suggestions,
  onSuggestionClick,
  className,
  ...props
}: ChatEmptyProps) {
  return (
    <Empty className={cn("h-full", className)} {...props}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircleDashedIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {suggestions && suggestions.length > 0 ? (
        <EmptyContent>
          <Suggestions>
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                {...(onSuggestionClick !== undefined && {
                  onClick: onSuggestionClick,
                })}
              />
            ))}
          </Suggestions>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

export type ChatMessageProps = Omit<
  ComponentProps<typeof MessageScrollerItem>,
  "children"
> & {
  message: UIMessage
  /**
   * The chat status while this is the live message. Once it is not
   * generating, parts left marked streaming or running (after Stop, or a
   * stream that ended early) are shown settled. Omit for standalone use.
   */
  status?: ChatStatus | undefined
}

/** Parts the block draws; step, source, data and custom parts are not among them. */
function isRenderablePart(part: ChatMessagePartType) {
  if (isToolUIPart(part)) return true
  switch (part.type) {
    case "text":
      return part.text.trim() !== ""
    case "reasoning":
    case "file":
      return true
    default:
      return false
  }
}

/**
 * One transcript row (render it inside a `MessageScrollerProvider`). User
 * messages align end and render text in a `Bubble`; assistant messages render
 * each part with the matching AI component. File parts from either role
 * render as an `AttachmentGroup` above the text. A message with nothing to
 * draw yet, such as the `start`/`start-step` window before the first token,
 * renders no row at all.
 */
export function ChatMessage({ message, status, ...props }: ChatMessageProps) {
  const isUser = message.role === "user"

  if (message.role === "system") {
    const text = getMessageText(message)
    if (text.trim() === "") return null
    return (
      <MessageScrollerItem messageId={message.id} {...props}>
        <Marker variant="separator">
          <MarkerContent>{text}</MarkerContent>
        </Marker>
      </MessageScrollerItem>
    )
  }

  if (!message.parts.some(isRenderablePart)) return null

  const files = message.parts.filter(
    (part): part is FileUIPart => part.type === "file"
  )

  return (
    <MessageScrollerItem
      messageId={message.id}
      scrollAnchor={isUser}
      {...props}
    >
      <Message align={isUser ? "end" : "start"}>
        <MessageContent>
          {files.length > 0 ? <ChatAttachments files={files} /> : null}
          {message.parts.map((part, index) => (
            <ChatMessagePart
              // biome-ignore lint/suspicious/noArrayIndexKey: UI parts carry no id; the array is append-only while streaming, so the index is stable.
              key={`${message.id}-${part.type}-${index}`}
              part={part}
              role={message.role}
              status={status}
            />
          ))}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  )
}

export type ChatMessagePartProps = {
  part: ChatMessagePartType
  role: UIMessage["role"]
  /** See `ChatMessageProps["status"]`. */
  status?: ChatStatus | undefined
}

/** Whether parts may still be receiving deltas; unknown status counts as live. */
function isLive(status: ChatStatus | undefined) {
  return status === undefined || isGenerating(status)
}

/**
 * Renders a single UI part: user text → `Bubble`, assistant text →
 * `MessageResponse`, reasoning → `Reasoning`, tool-* / dynamic-tool → `Tool`.
 * Whitespace-only text renders nothing, so a files-only turn shows just its
 * attachments. File parts are rendered by `ChatAttachments`; step, source,
 * data and custom parts render nothing. A part that throws while rendering
 * becomes an inline error row instead of unmounting the chat.
 */
export function ChatMessagePart({ part, role, status }: ChatMessagePartProps) {
  return (
    <ChatMessagePartBoundary
      partType={part.type}
      resetKey={"state" in part ? part.state : undefined}
    >
      <ChatMessagePartBody part={part} role={role} status={status} />
    </ChatMessagePartBoundary>
  )
}

function ChatMessagePartBody({ part, role, status }: ChatMessagePartProps) {
  if (isToolUIPart(part)) {
    return <ChatToolPart part={part} status={status} />
  }

  switch (part.type) {
    case "text":
      if (part.text.trim() === "") {
        return null
      }
      if (role === "user") {
        return (
          <Bubble>
            <BubbleContent className="whitespace-pre-wrap">
              {part.text}
            </BubbleContent>
          </Bubble>
        )
      }
      return <MessageResponse>{part.text}</MessageResponse>
    case "reasoning":
      return (
        <Reasoning
          className="mb-0"
          isStreaming={part.state === "streaming" && isLive(status)}
        >
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      )
    default:
      return null
  }
}

type ChatMessagePartBoundaryProps = {
  children: ReactNode
  partType: string
  /** A change (the part's `state`) retries the part after a render error. */
  resetKey: unknown
}

type ChatMessagePartBoundaryState = {
  error: Error | null
}

/** Keeps one malformed part from unmounting the whole transcript. */
class ChatMessagePartBoundary extends Component<
  ChatMessagePartBoundaryProps,
  ChatMessagePartBoundaryState
> {
  state: ChatMessagePartBoundaryState = { error: null }

  static getDerivedStateFromError(
    error: unknown
  ): ChatMessagePartBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidUpdate(previous: ChatMessagePartBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <Marker className="text-destructive" role="alert">
        <MarkerIcon>
          <CircleAlertIcon />
        </MarkerIcon>
        <MarkerContent>
          Could not render the {this.props.partType} part: {error.message}
        </MarkerContent>
      </Marker>
    )
  }
}

export type ChatToolPartProps = {
  part: ToolPart
  /** See `ChatMessageProps["status"]`. */
  status?: ChatStatus | undefined
}

/** The unparsed input the SDK keeps when a tool call's JSON failed to parse. */
function formatRawInput(rawInput: unknown) {
  if (rawInput === undefined) return undefined
  if (typeof rawInput === "string") return rawInput
  try {
    return JSON.stringify(rawInput, null, 2)
  } catch {
    return String(rawInput)
  }
}

/**
 * A tool call in any AI SDK state; opens by default when the tool errored.
 * `ToolInput` shows its "No input yet" placeholder until the first input
 * delta arrives; the raw input is shown as text when the call errored before
 * its input parsed. A call still marked running once the chat is no longer
 * generating (after Stop, or a client tool awaiting its output) is shown as
 * Pending rather than Running.
 */
export function ChatToolPart({ part, status }: ChatToolPartProps) {
  const isErrored = part.state === "output-error"
  const rawInput =
    isErrored && part.input === undefined && "rawInput" in part
      ? formatRawInput(part.rawInput)
      : undefined
  const state =
    part.state === "input-available" && !isLive(status)
      ? "input-streaming"
      : part.state

  return (
    <Tool className="mb-0" defaultOpen={isErrored}>
      {part.type === "dynamic-tool" ? (
        <ToolHeader
          state={state}
          toolName={part.toolName}
          type="dynamic-tool"
          {...(part.title !== undefined && { title: part.title })}
        />
      ) : (
        <ToolHeader
          state={state}
          type={part.type}
          {...(part.title !== undefined && { title: part.title })}
        />
      )}
      <ToolContent>
        {rawInput !== undefined ? (
          <div className="space-y-2 overflow-hidden">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Raw input
            </div>
            <pre className="rounded-md bg-muted/50 p-3 text-xs wrap-break-word whitespace-pre-wrap">
              {rawInput}
            </pre>
          </div>
        ) : (
          <ToolInput input={part.input} />
        )}
        <ToolOutput errorText={part.errorText} output={part.output} />
      </ToolContent>
    </Tool>
  )
}

export type ChatAttachmentsProps = Omit<
  ComponentProps<typeof AttachmentGroup>,
  "children"
> & {
  files: FileUIPart[]
  onRemove?: ((index: number) => void) | undefined
}

/** AI SDK file parts as a scrollable row of shadcn `Attachment`s. */
export function ChatAttachments({
  files,
  onRemove,
  ...props
}: ChatAttachmentsProps) {
  return (
    <AttachmentGroup {...props}>
      {files.map((file, index) => {
        const isImage = file.mediaType.startsWith("image")
        const name = file.filename ?? (isImage ? "Image" : "File")
        return (
          <Attachment
            // biome-ignore lint/suspicious/noArrayIndexKey: file parts have no id and the same file can be attached twice.
            key={`${file.url}-${index}`}
            orientation={isImage ? "vertical" : "horizontal"}
            size="sm"
          >
            <AttachmentMedia variant={isImage ? "image" : "icon"}>
              {isImage ? (
                // biome-ignore lint/performance/noImgElement: the source is usually a data: or blob: URL, which next/image cannot optimize.
                <img alt={name} src={file.url} />
              ) : (
                <FileIcon />
              )}
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{name}</AttachmentTitle>
              <AttachmentDescription>{file.mediaType}</AttachmentDescription>
            </AttachmentContent>
            {onRemove ? (
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemove(index)}
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            ) : null}
          </Attachment>
        )
      })}
    </AttachmentGroup>
  )
}

export type ChatThinkingMarkerProps = ComponentProps<typeof MessageScrollerItem>

/** Transcript row shown while a request is submitted but nothing has streamed. */
export function ChatThinkingMarker({
  children = "Thinking…",
  ...props
}: ChatThinkingMarkerProps) {
  return (
    <MessageScrollerItem {...props}>
      <Marker>
        <MarkerIcon>
          <LoaderCircleIcon className="animate-spin" />
        </MarkerIcon>
        <MarkerContent className="shimmer">{children}</MarkerContent>
      </Marker>
    </MessageScrollerItem>
  )
}

export type ChatErrorMarkerProps = Omit<
  ComponentProps<typeof MessageScrollerItem>,
  "children"
> & {
  /** Shown by message; without one (or with an empty message) a generic line. */
  error?: Error | undefined
  onRetry?: ChatRetryHandler | undefined
}

/**
 * Transcript row for a failed request, with a Retry button when `onRetry` is
 * given. A rejected `onRetry` (`regenerate` rejects when there is nothing to
 * regenerate) is reported through `console.error`, never as an unhandled
 * rejection.
 */
export function ChatErrorMarker({
  error,
  onRetry,
  ...props
}: ChatErrorMarkerProps) {
  const retry = useCallback(() => {
    if (!onRetry) return
    Promise.resolve()
      .then(() => onRetry())
      .catch((reason: unknown) => console.error(reason))
  }, [onRetry])

  return (
    <MessageScrollerItem {...props}>
      <Marker className="text-destructive" role="alert">
        <MarkerIcon>
          <CircleAlertIcon />
        </MarkerIcon>
        <MarkerContent>
          {error?.message || "Something went wrong."}
        </MarkerContent>
        {onRetry ? (
          <Button
            className="ml-auto"
            onClick={retry}
            size="sm"
            variant="outline"
          >
            Retry
          </Button>
        ) : null}
      </Marker>
    </MessageScrollerItem>
  )
}

export type ChatComposerProps = Omit<
  ComponentProps<typeof PromptInput>,
  "onSubmit" | "children"
> & {
  onSubmit: (message: ChatSubmitMessage) => void | Promise<void>
  onStop?: (() => void) | undefined
  status?: ChatStatus | undefined
  placeholder?: string | undefined
}

/**
 * The prompt input: textarea (Enter submits, Shift+Enter breaks a line), an
 * attachment menu, a preview of attached files, and a submit button. While a
 * response is in flight nothing submits and the draft and attachments are
 * kept; the button is then a Stop button that calls `onStop` when one is
 * passed (`Chat` passes its own through), and without `onStop` it keeps the
 * Submit name and a press does nothing. After an error the button is a plain
 * Submit again, since the transcript's error row carries Retry. `onSubmit`'s
 * promise is not awaited: `sendMessage` settles only when the answer has
 * finished streaming, and the composer clears as soon as the message is sent.
 * A rejection is reported through `console.error`; a synchronous throw is
 * reported too and keeps the draft.
 */
export function ChatComposer({
  onSubmit,
  onStop,
  status = "ready",
  placeholder,
  ...props
}: ChatComposerProps) {
  const busy = isGenerating(status)

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      // `false` rejects the submit: PromptInput keeps the attachments and
      // restores the draft (a programmatic requestSubmit skips the guards).
      if (busy) return false
      if (message.text.trim() === "" && message.files.length === 0) {
        return
      }
      // A synchronous throw rejects the submit, so the draft and the
      // attachments stay for another try.
      if (!submitInBackground(onSubmit, message)) return false
    },
    [onSubmit, busy]
  )

  // PromptInput resets the form before calling onSubmit, so Enter has to be
  // stopped here to keep the draft while a response is in flight.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        busy &&
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault()
      }
    },
    [busy]
  )

  const handleSubmitClick = useCallback<
    NonNullable<ComponentProps<typeof PromptInputSubmit>["onClick"]>
  >(
    (event) => {
      if (busy) event.preventDefault()
    },
    [busy]
  )

  return (
    <PromptInput multiple onSubmit={handleSubmit} {...props}>
      <ChatComposerAttachments />
      <PromptInputBody>
        <PromptInputTextarea
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger aria-label="Add attachment" />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
        </PromptInputTools>
        <PromptInputSubmit
          onClick={handleSubmitClick}
          status={status === "error" ? "ready" : status}
          {...(onStop !== undefined && { onStop })}
        />
      </PromptInputFooter>
    </PromptInput>
  )
}

/** Attached-but-unsent files, read from the surrounding `PromptInput`. */
function ChatComposerAttachments() {
  const attachments = usePromptInputAttachments()
  const remove = useCallback(
    (index: number) => {
      const file = attachments.files[index]
      if (file) attachments.remove(file.id)
    },
    [attachments]
  )

  if (attachments.files.length === 0) {
    return null
  }

  return (
    <PromptInputHeader>
      <ChatAttachments files={attachments.files} onRemove={remove} />
    </PromptInputHeader>
  )
}

/** Concatenates the text parts of a message. */
export function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}
