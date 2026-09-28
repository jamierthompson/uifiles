"use client"

import { FileIcon, GlobeIcon, MicIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Demo } from "@/app/_components/demo"
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
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  type PromptInputError,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/registry/ai/prompt-input"
import { Suggestion, Suggestions } from "@/registry/ai/suggestion"

// `items` gives Base UI's Select.Value a label to render for each value.
const defaultModel = { label: "Claude Sonnet 4", value: "claude-sonnet-4" }
const models = [
  defaultModel,
  { label: "GPT-5", value: "gpt-5" },
  { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
]

const suggestions = [
  "Summarize this repository",
  "Write a unit test for the parser",
  "Explain the auth flow",
  "Find unused exports",
]

/** Attached-but-unsent files, read from the surrounding PromptInput. */
function Attachments() {
  const attachments = usePromptInputAttachments()
  if (attachments.files.length === 0) {
    return null
  }
  return (
    <PromptInputHeader>
      <AttachmentGroup>
        {attachments.files.map((file) => {
          const isImage = file.mediaType.startsWith("image")
          const name = file.filename ?? (isImage ? "Image" : "File")
          return (
            <Attachment
              key={file.id}
              orientation={isImage ? "vertical" : "horizontal"}
              size="sm"
            >
              <AttachmentMedia variant={isImage ? "image" : "icon"}>
                {isImage ? (
                  // biome-ignore lint/performance/noImgElement: a blob: URL preview of a local file, which next/image cannot optimize.
                  <img alt={name} src={file.url} />
                ) : (
                  <FileIcon />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{name}</AttachmentTitle>
                <AttachmentDescription>{file.mediaType}</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${name}`}
                  onClick={() => attachments.remove(file.id)}
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          )
        })}
      </AttachmentGroup>
    </PromptInputHeader>
  )
}

export default function PromptInputPreview() {
  const [model, setModel] = useState<string | null>(defaultModel.value)
  const [lastMessage, setLastMessage] = useState<PromptInputMessage | null>(
    null
  )
  const [lastError, setLastError] = useState<PromptInputError | null>(null)
  const [draft, setDraft] = useState("")

  const handleSubmit = (message: PromptInputMessage) => {
    // Like the chat block: an empty submit is rejected, so nothing is
    // recorded and the composer keeps its state.
    if (message.text.trim() === "" && message.files.length === 0) {
      return false
    }
    setLastMessage(message)
    setLastError(null)
    setDraft("")
  }

  return (
    <>
      <Demo
        description="Type, attach files from the menu, pick a model, then submit with Enter. A suggestion fills the draft; an empty submit is swallowed."
        title="Ready"
      >
        <div className="flex flex-col gap-3">
          <Suggestions>
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                onClick={setDraft}
                suggestion={suggestion}
              />
            ))}
          </Suggestions>
          <PromptInput
            accept="image/*"
            multiple
            onError={setLastError}
            onSubmit={handleSubmit}
          >
            <Attachments />
            <PromptInputBody>
              <PromptInputTextarea
                onChange={(event) => setDraft(event.currentTarget.value)}
                value={draft}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger aria-label="Add attachment" />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                    <PromptInputActionAddScreenshot />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputButton
                  aria-label="Voice input"
                  tooltip="Voice input"
                >
                  <MicIcon />
                </PromptInputButton>
                <PromptInputButton tooltip={{ content: "Search the web" }}>
                  <GlobeIcon />
                  <span>Search</span>
                </PromptInputButton>
                <PromptInputSelect
                  items={models}
                  onValueChange={setModel}
                  value={model}
                >
                  <PromptInputSelectTrigger aria-label="Model">
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {models.map((item) => (
                      <PromptInputSelectItem
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit status="ready" />
            </PromptInputFooter>
          </PromptInput>
          {lastMessage ? (
            <p className="text-xs text-muted-foreground">
              Submitted: “{lastMessage.text}” with {lastMessage.files.length}{" "}
              file(s)
            </p>
          ) : null}
          {lastError ? (
            <p className="text-xs text-muted-foreground">
              Rejected ({lastError.code}): {lastError.message}
            </p>
          ) : null}
        </div>
      </Demo>

      <Demo
        description="While a response is in flight the submit button becomes Stop and the draft stays put."
        title="Streaming"
      >
        <PromptInput onSubmit={() => {}}>
          <Attachments />
          <PromptInputBody>
            <PromptInputTextarea
              defaultValue="Explain how the registry build step works."
              placeholder="Generating…"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger aria-label="Add attachment" />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                  <PromptInputActionAddScreenshot />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputSelect
                defaultValue={defaultModel.value}
                items={models}
              >
                <PromptInputSelectTrigger aria-label="Model">
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((item) => (
                    <PromptInputSelectItem key={item.value} value={item.value}>
                      {item.label}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit onStop={() => {}} status="streaming" />
          </PromptInputFooter>
        </PromptInput>
      </Demo>
    </>
  )
}
