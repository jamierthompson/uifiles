// Derived from Vercel AI Elements model-selector.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import type { ComponentProps, ReactNode } from "react"
import { createContext, useContext, useState } from "react"
import { createPortal } from "react-dom"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export type ModelSelectorProps = ComponentProps<typeof Dialog>

export const ModelSelector = (props: ModelSelectorProps) => (
  <Dialog {...props} />
)

export type ModelSelectorTriggerProps = ComponentProps<typeof DialogTrigger>

// Base UI: compose a custom trigger with `render={<Button />}` instead of `asChild`.
export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <DialogTrigger {...props} />
)

type CommandFilter = NonNullable<ComponentProps<typeof Command>["filter"]>

// cmdk's default filter is fuzzy, so "opus" also matches
// "anthropic/claude-sonnet-4" through scattered letters. Model ids are short:
// every whitespace-separated term must appear verbatim in the value or a keyword.
const modelSelectorFilter: CommandFilter = (value, search, keywords = []) => {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return 1
  }
  const haystack = [value, ...keywords].join(" ").toLowerCase()
  return terms.every((term) => haystack.includes(term)) ? 1 : 0
}

export type ModelSelectorContentProps = ComponentProps<typeof DialogContent> & {
  title?: ReactNode
  /** Replaces the whole-term filter; `defaultFilter` from "cmdk" restores fuzzy matching. */
  filter?: CommandFilter | undefined
  /** `false` turns cmdk filtering off so the consumer renders only the matching items. */
  shouldFilter?: boolean | undefined
}

export const ModelSelectorContent = ({
  className,
  children,
  title = "Model Selector",
  filter = modelSelectorFilter,
  shouldFilter = true,
  ...props
}: ModelSelectorContentProps) => (
  <DialogContent
    aria-describedby={undefined}
    className={cn(
      "border-none! p-0 outline! outline-border! outline-solid!",
      className
    )}
    {...props}
  >
    <DialogTitle className="sr-only">{title}</DialogTitle>
    <Command
      className="**:data-[slot=command-input-wrapper]:h-auto **:data-[slot=input-group]:h-auto!"
      filter={filter}
      shouldFilter={shouldFilter}
    >
      {children}
    </Command>
  </DialogContent>
)

export type ModelSelectorDialogProps = ComponentProps<typeof CommandDialog>

export const ModelSelectorDialog = (props: ModelSelectorDialogProps) => (
  <CommandDialog {...props} />
)

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>

export const ModelSelectorInput = ({
  className,
  ...props
}: ModelSelectorInputProps) => (
  <CommandInput className={cn("h-auto py-3.5", className)} {...props} />
)

const EmptySlotContext = createContext<HTMLElement | null>(null)

export type ModelSelectorListProps = ComponentProps<typeof CommandList>

// cmdk renders its empty state inside the listbox, where a message is not a
// permitted child (axe `aria-required-children`). The list owns a live region
// after itself and ModelSelectorEmpty portals into it, so the composition can
// stay the same as upstream and the message is announced.
export const ModelSelectorList = ({
  children,
  ...props
}: ModelSelectorListProps) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  return (
    <EmptySlotContext.Provider value={slot}>
      <CommandList {...props}>{children}</CommandList>
      <div aria-live="polite" data-slot="model-selector-empty" ref={setSlot} />
    </EmptySlotContext.Provider>
  )
}

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => {
  const slot = useContext(EmptySlotContext)
  const empty = <CommandEmpty {...props} />

  return slot ? createPortal(empty, slot) : empty
}

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => (
  <CommandGroup {...props} />
)

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>

export const ModelSelectorItem = (props: ModelSelectorItemProps) => (
  <CommandItem {...props} />
)

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut {...props} />
)

export type ModelSelectorSeparatorProps = ComponentProps<
  typeof CommandSeparator
>

// cmdk forces role="separator", which a listbox may not own (axe
// `aria-required-children`). The divider is decorative: the groups around it
// carry their own headings, so it is hidden from assistive technology.
export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <div aria-hidden="true">
    <CommandSeparator {...props} />
  </div>
)

export type ModelSelectorLogoProps = Omit<
  ComponentProps<"img">,
  "src" | "alt"
> & {
  provider:
    | "moonshotai-cn"
    | "lucidquery"
    | "moonshotai"
    | "zai-coding-plan"
    | "alibaba"
    | "xai"
    | "vultr"
    | "nvidia"
    | "upstage"
    | "groq"
    | "github-copilot"
    | "mistral"
    | "vercel"
    | "nebius"
    | "deepseek"
    | "alibaba-cn"
    | "google-vertex-anthropic"
    | "venice"
    | "chutes"
    | "cortecs"
    | "github-models"
    | "togetherai"
    | "azure"
    | "baseten"
    | "huggingface"
    | "opencode"
    | "fastrouter"
    | "google"
    | "google-vertex"
    | "cloudflare-workers-ai"
    | "inception"
    | "wandb"
    | "openai"
    | "zhipuai-coding-plan"
    | "perplexity"
    | "openrouter"
    | "zenmux"
    | "v0"
    | "iflowcn"
    | "synthetic"
    | "deepinfra"
    | "zhipuai"
    | "submodel"
    | "zai"
    | "inference"
    | "requesty"
    | "morph"
    | "lmstudio"
    | "anthropic"
    | "aihubmix"
    | "fireworks-ai"
    | "modelscope"
    | "llama"
    | "scaleway"
    | "amazon-bedrock"
    | "cerebras"
    | (string & {})
  /** Empty by default: the logo is decorative next to ModelSelectorName. */
  alt?: string | undefined
  /**
   * Replaces the default `https://models.dev/logos/<provider>.svg`: a
   * self-hosted file or a data URI for offline use or an `img-src 'self'` CSP.
   */
  src?: string | undefined
}

export const ModelSelectorLogo = ({
  provider,
  className,
  alt = "",
  src,
  onError,
  ...props
}: ModelSelectorLogoProps) => {
  const source = src ?? `https://models.dev/logos/${provider}.svg`
  // models.dev has no logo for an unknown provider; hide the broken image
  // instead of showing the browser's placeholder glyph.
  const [failedSource, setFailedSource] = useState<string | null>(null)

  return (
    // biome-ignore lint/performance/noImgElement: remote SVG logos from models.dev, not an optimizable asset
    <img
      aria-hidden={alt === "" || undefined}
      hidden={failedSource === source || undefined}
      {...props}
      alt={alt}
      className={cn("size-3 dark:invert", className)}
      height={12}
      onError={(event) => {
        setFailedSource(source)
        onError?.(event)
      }}
      src={source}
      width={12}
    />
  )
}

export type ModelSelectorLogoGroupProps = ComponentProps<"div">

export const ModelSelectorLogoGroup = ({
  className,
  ...props
}: ModelSelectorLogoGroupProps) => (
  <div
    className={cn(
      "flex shrink-0 items-center -space-x-1 [&>img]:rounded-full [&>img]:bg-background [&>img]:p-px [&>img]:ring-1 dark:[&>img]:bg-foreground",
      className
    )}
    {...props}
  />
)

export type ModelSelectorNameProps = ComponentProps<"span">

export const ModelSelectorName = ({
  className,
  ...props
}: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
)
