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
  FileIcon,
  LoaderCircleIcon,
  MessageCircleDashedIcon,
  XIcon,
} from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { useCallback } from "react"
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

export type ChatProps = Omit<ComponentProps<"div">, "onSubmit"> & {
  messages: UIMessage[]
  status: ChatStatus
  onSubmit: (message: ChatSubmitMessage) => void | Promise<void>
  onStop?: () => void
  /** One-click prompts shown in the empty state; each is submitted as-is. */
  suggestions?: string[]
  placeholder?: string
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
}

/**
 * A complete chat surface for AI SDK `useChat`: a scrolling transcript with an
 * empty state, streamed assistant parts, a "thinking" marker, and a composer.
 * Fills its parent, so render it inside a height-constrained container.
 */
export function Chat({
  messages,
  status,
  onSubmit,
  onStop,
  suggestions,
  placeholder,
  emptyTitle,
  emptyDescription,
  className,
  ...props
}: ChatProps) {
  const handleSuggestion = useCallback(
    (text: string) => onSubmit({ text, files: [] }),
    [onSubmit]
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
          messages={messages}
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
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
}

/**
 * The transcript: a `MessageScroller` frame (render it inside a
 * `MessageScrollerProvider`) that shows `ChatEmpty` until the first message,
 * one `ChatMessage` per message, and `ChatThinkingMarker` while a request is
 * pending.
 */
export function ChatMessages({
  messages,
  status,
  suggestions,
  onSuggestionClick,
  emptyTitle,
  emptyDescription,
  className,
  ...props
}: ChatMessagesProps) {
  const isBusy = status === "submitted" || status === "streaming"

  return (
    <MessageScroller className={cn("flex-1", className)} {...props}>
      <MessageScrollerViewport>
        <MessageScrollerContent aria-busy={isBusy}>
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
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}
          {status === "submitted" ? <ChatThinkingMarker /> : null}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton />
    </MessageScroller>
  )
}

export type ChatEmptyProps = Omit<ComponentProps<typeof Empty>, "title"> & {
  title?: ReactNode
  description?: ReactNode
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
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
                onClick={onSuggestionClick}
                suggestion={suggestion}
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
}

/**
 * One transcript row. User messages align end and render text in a `Bubble`;
 * assistant messages render each part with the matching AI component. File
 * parts from either role render as an `AttachmentGroup` above the text.
 */
export function ChatMessage({ message, ...props }: ChatMessageProps) {
  const isUser = message.role === "user"
  const files = message.parts.filter(
    (part): part is FileUIPart => part.type === "file"
  )

  if (message.role === "system") {
    return (
      <MessageScrollerItem messageId={message.id} {...props}>
        <Marker variant="separator">
          <MarkerContent>{getMessageText(message)}</MarkerContent>
        </Marker>
      </MessageScrollerItem>
    )
  }

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
}

/**
 * Renders a single UI part: user text → `Bubble`, assistant text →
 * `MessageResponse`, reasoning → `Reasoning`, tool-* / dynamic-tool → `Tool`.
 * File parts are rendered by `ChatAttachments`; step, source, data and custom
 * parts render nothing.
 */
export function ChatMessagePart({ part, role }: ChatMessagePartProps) {
  if (isToolUIPart(part)) {
    return <ChatToolPart part={part} />
  }

  switch (part.type) {
    case "text":
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
        <Reasoning className="mb-0" isStreaming={part.state === "streaming"}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      )
    default:
      return null
  }
}

export type ChatToolPartProps = {
  part: ToolPart
}

/** A tool call in any AI SDK state; opens by default when the tool errored. */
export function ChatToolPart({ part }: ChatToolPartProps) {
  return (
    <Tool className="mb-0" defaultOpen={part.state === "output-error"}>
      {part.type === "dynamic-tool" ? (
        <ToolHeader
          state={part.state}
          title={part.title}
          toolName={part.toolName}
          type="dynamic-tool"
        />
      ) : (
        <ToolHeader state={part.state} title={part.title} type={part.type} />
      )}
      <ToolContent>
        <ToolInput input={part.input} />
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
  onRemove?: (index: number) => void
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

export type ChatComposerProps = Omit<
  ComponentProps<typeof PromptInput>,
  "onSubmit" | "children"
> & {
  onSubmit: (message: ChatSubmitMessage) => void | Promise<void>
  onStop?: () => void
  status?: ChatStatus
  placeholder?: string
}

/**
 * The prompt input: textarea (Enter submits, Shift+Enter breaks a line), an
 * attachment menu, a preview of attached files, and a submit button that
 * becomes a stop button while the response is in flight.
 */
export function ChatComposer({
  onSubmit,
  onStop,
  status = "ready",
  placeholder,
  ...props
}: ChatComposerProps) {
  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (message.text.trim() === "" && message.files.length === 0) {
        return
      }
      return onSubmit(message)
    },
    [onSubmit]
  )

  return (
    <PromptInput multiple onSubmit={handleSubmit} {...props}>
      <ChatComposerAttachments />
      <PromptInputBody>
        <PromptInputTextarea placeholder={placeholder} />
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
        <PromptInputSubmit onStop={onStop} status={status} />
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
