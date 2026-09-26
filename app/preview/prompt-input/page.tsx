"use client"

import { GlobeIcon, MicIcon } from "lucide-react"
import { useState } from "react"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/registry/ai/prompt-input"
import { Suggestion, Suggestions } from "@/registry/ai/suggestion"

// `items` gives Base UI's Select.Value a label to render for each value.
const models = [
  { label: "Claude Sonnet 4", value: "claude-sonnet-4" },
  { label: "GPT-5", value: "gpt-5" },
  { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
]

const suggestions = [
  "Summarize this repository",
  "Write a unit test for the parser",
  "Explain the auth flow",
  "Find unused exports",
]

export default function PromptInputPreview() {
  const [model, setModel] = useState<string | null>(models[0].value)
  const [lastMessage, setLastMessage] = useState<PromptInputMessage | null>(
    null
  )
  const [draft, setDraft] = useState("")

  const handleSubmit = (message: PromptInputMessage) => {
    setLastMessage(message)
    setDraft("")
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Ready</h2>
        <Suggestions>
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              onClick={setDraft}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
        <PromptInput onSubmit={handleSubmit} accept="image/*" multiple>
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
              <PromptInputButton aria-label="Voice input" tooltip="Voice input">
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
                    <PromptInputSelectItem key={item.value} value={item.value}>
                      {item.label}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!draft.trim()} status="ready" />
          </PromptInputFooter>
        </PromptInput>
        {lastMessage ? (
          <p className="text-xs text-muted-foreground">
            Submitted: “{lastMessage.text}” with {lastMessage.files.length}{" "}
            file(s)
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Streaming</h2>
        <PromptInput onSubmit={() => {}}>
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
              <PromptInputSelect defaultValue={models[0].value} items={models}>
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
      </section>
    </>
  )
}
