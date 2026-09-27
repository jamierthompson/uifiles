"use client"

import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorSeparator,
  ModelSelectorShortcut,
  ModelSelectorTrigger,
} from "@/registry/ai/model-selector"
import { type LogoProvider, logos } from "./logos"

type Model = {
  id: string
  name: string
  provider: LogoProvider
  shortcut?: string
}

const groups: { heading: string; models: Model[] }[] = [
  {
    heading: "OpenAI",
    models: [
      { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o mini", provider: "openai" },
    ],
  },
  {
    heading: "Anthropic",
    models: [
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        provider: "anthropic",
        shortcut: "⌘1",
      },
      {
        id: "anthropic/claude-opus-4",
        name: "Claude Opus 4",
        provider: "anthropic",
      },
    ],
  },
  {
    heading: "Google",
    models: [
      {
        id: "google/gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        provider: "google",
      },
    ],
  },
]

const allModels = groups.flatMap((group) => group.models)

export function ModelSelectorDemo() {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(allModels[0]?.id)
  const selected = allModels.find((model) => model.id === selectedId)

  return (
    <div className="flex items-center gap-4 rounded-xl border p-4">
      <ModelSelector onOpenChange={setOpen} open={open}>
        <ModelSelectorTrigger render={<Button variant="outline" />}>
          {selected ? (
            <>
              <ModelSelectorLogo
                provider={selected.provider}
                src={logos[selected.provider]}
              />
              <ModelSelectorName>{selected.name}</ModelSelectorName>
            </>
          ) : (
            "Select a model"
          )}
          <ChevronDownIcon className="text-muted-foreground" />
        </ModelSelectorTrigger>
        <ModelSelectorContent>
          <ModelSelectorInput placeholder="Search models..." />
          <ModelSelectorList>
            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
            {groups.map((group, index) => (
              <div key={group.heading}>
                {index > 0 && <ModelSelectorSeparator />}
                <ModelSelectorGroup heading={group.heading}>
                  {group.models.map((model) => (
                    <ModelSelectorItem
                      data-checked={model.id === selectedId}
                      key={model.id}
                      keywords={[model.name, model.provider]}
                      onSelect={() => {
                        setSelectedId(model.id)
                        setOpen(false)
                      }}
                      value={model.id}
                    >
                      <ModelSelectorLogo
                        provider={model.provider}
                        src={logos[model.provider]}
                      />
                      <ModelSelectorName>{model.name}</ModelSelectorName>
                      {model.shortcut && (
                        <ModelSelectorShortcut>
                          {model.shortcut}
                        </ModelSelectorShortcut>
                      )}
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
              </div>
            ))}
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
      <ModelSelectorLogoGroup aria-hidden>
        <ModelSelectorLogo provider="openai" src={logos.openai} />
        <ModelSelectorLogo provider="anthropic" src={logos.anthropic} />
        <ModelSelectorLogo provider="google" src={logos.google} />
      </ModelSelectorLogoGroup>
      <span className="text-sm text-muted-foreground">
        Selected: <code>{selectedId}</code>
      </span>
    </div>
  )
}
