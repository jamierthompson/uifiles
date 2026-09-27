// Derived from Vercel AI Elements code-block.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import { CheckIcon, CopyIcon } from "lucide-react"
import type { ComponentProps, CSSProperties, HTMLAttributes } from "react"
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type {
  BundledLanguage,
  BundledTheme,
  HighlighterGeneric,
  SpecialLanguage,
  ThemedToken,
} from "shiki"
import {
  bundledLanguages,
  bundledLanguagesInfo,
  createHighlighter,
} from "shiki"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Shiki uses bitflags for font styles: 1=italic, 2=bold, 4=underline
const isItalic = (fontStyle: number | undefined) => fontStyle && fontStyle & 1
const isBold = (fontStyle: number | undefined) => fontStyle && fontStyle & 2
const isUnderline = (fontStyle: number | undefined) =>
  fontStyle && fontStyle & 4

// Transform tokens to include pre-computed keys to avoid noArrayIndexKey lint
interface KeyedToken {
  token: ThemedToken
  key: string
}
interface KeyedLine {
  tokens: KeyedToken[]
  key: string
}

const addKeysToTokens = (lines: ThemedToken[][]): KeyedLine[] =>
  lines.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      key: `line-${lineIdx}-${tokenIdx}`,
      token,
    })),
  }))

// Token rendering component
const TokenSpan = ({ token }: { token: ThemedToken }) => (
  <span
    className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
    style={
      {
        backgroundColor: token.bgColor,
        color: token.color,
        fontStyle: isItalic(token.fontStyle) ? "italic" : undefined,
        fontWeight: isBold(token.fontStyle) ? "bold" : undefined,
        textDecoration: isUnderline(token.fontStyle) ? "underline" : undefined,
        ...token.htmlStyle,
      } as CSSProperties
    }
  >
    {token.content}
  </span>
)

// Line number styles using CSS counters. The gutter is `--line-digits`
// characters wide (set on <code> from the line count) so four-digit numbers
// stay right-aligned instead of overflowing a fixed box.
const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-[calc(var(--line-digits,2)*1ch)]",
  "before:mr-4",
  "before:text-right",
  "before:text-muted-foreground",
  "before:font-mono",
  "before:select-none"
)

// Line rendering component
const LineSpan = ({
  keyedLine,
  showLineNumbers,
}: {
  keyedLine: KeyedLine
  showLineNumbers: boolean
}) => (
  <span className={showLineNumbers ? LINE_NUMBER_CLASSES : "block"}>
    {keyedLine.tokens.length === 0
      ? "\n"
      : keyedLine.tokens.map(({ token, key }) => (
          <TokenSpan key={key} token={token} />
        ))}
  </span>
)

// Types
type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string
  language: BundledLanguage
  showLineNumbers?: boolean
}

interface TokenizedCode {
  tokens: ThemedToken[][]
  fg: string
  bg: string
  /** Theme custom properties (`--shiki-dark`, `--shiki-dark-bg`) for the `<pre>`. */
  vars: Record<string, string>
}

interface CodeBlockContextType {
  code: string
}

// Context
const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
})

type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>
type HighlightLanguage = BundledLanguage | SpecialLanguage

const THEMES = {
  dark: "github-dark-high-contrast",
  light: "github-light-high-contrast",
} as const

const FALLBACK_LANGUAGE: SpecialLanguage = "text"
const SPECIAL_LANGUAGES = new Set<string>([
  "text",
  "plaintext",
  "txt",
  "plain",
  "ansi",
])

// One highlighter for every block, created on first use with both themes and
// no grammars: Shiki warns from its tenth instance on, and every instance
// would load the themes again (uifiles change; upstream made one per language).
let highlighterPromise: Promise<Highlighter> | undefined

// Grammar loads per language, shared by concurrent callers
const languageLoads = new Map<string, Promise<Highlighter>>()

// Token cache, keyed on the whole code and the language
const tokensCache = new Map<string, TokenizedCode>()

// In-flight highlights per cache key, so concurrent callers share one job
const pending = new Map<string, Promise<void>>()

// Subscribers for async token updates
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>()

// Languages already reported as unknown (one warning each, not one per render)
const warnedLanguages = new Set<string>()

// Callers such as Tool pass `code` straight from streamed model output, which
// can be undefined before the first chunk; never let that reach `split`.
const toCodeString = (code: unknown): string =>
  typeof code === "string" ? code : ""

// NUL cannot appear in a fence info string, so "foo:bar" + "baz" and
// "foo" + "bar:baz" get different keys.
const getTokensCacheKey = (code: string, language: string) =>
  `${language}\0${code}`

// Display names for the scroll container's default label ("TypeScript code").
const languageNames = new Map<string, string>()
for (const info of bundledLanguagesInfo) {
  for (const key of [info.id, ...(info.aliases ?? [])]) {
    languageNames.set(key, info.name)
  }
}

const defaultContentLabel = (language: unknown): string => {
  const name =
    typeof language === "string" ? languageNames.get(language) : undefined
  return name ? `${name} code` : "Code"
}

// Unknown grammars (typos, exotic fence info strings) render as plain text
// instead of leaving a rejected highlighter in the cache. `Object.hasOwn`,
// not `in`: "constructor" or "toString" is not a grammar either.
const resolveLanguage = (language: unknown): HighlightLanguage => {
  if (typeof language !== "string" || language === "") {
    return FALLBACK_LANGUAGE
  }
  if (
    Object.hasOwn(bundledLanguages, language) ||
    SPECIAL_LANGUAGES.has(language)
  ) {
    return language as HighlightLanguage
  }
  if (!warnedLanguages.has(language)) {
    warnedLanguages.add(language)
    console.warn(
      `CodeBlock: shiki has no "${language}" grammar; rendering it as plain text.`
    )
  }
  return FALLBACK_LANGUAGE
}

const getSharedHighlighter = (): Promise<Highlighter> => {
  if (highlighterPromise) {
    return highlighterPromise
  }
  highlighterPromise = createHighlighter({
    langs: [],
    themes: [THEMES.light, THEMES.dark],
  }).catch((error: unknown) => {
    // A failed start (offline, chunk error) must not poison later attempts.
    highlighterPromise = undefined
    throw error
  })
  return highlighterPromise
}

const getHighlighter = (language: HighlightLanguage): Promise<Highlighter> => {
  const cached = languageLoads.get(language)
  if (cached) {
    return cached
  }

  const loaded = getSharedHighlighter()
    .then(async (highlighter) => {
      // Plain-text languages load nothing, and Shiki skips a grammar it
      // already has under another alias ("ts" after "typescript").
      await highlighter.loadLanguage(language)
      return highlighter
    })
    .catch((error: unknown) => {
      // A failed grammar load must not poison later attempts either.
      languageLoads.delete(language)
      throw error
    })

  languageLoads.set(language, loaded)
  return loaded
}

// Shiki packs the dual-theme colours as "#fff;--shiki-dark-bg:#0a0c10";
// React needs the colour and the custom properties as separate style keys.
const splitThemeStyle = (
  value: string | undefined,
  fallback: string
): { color: string; vars: Record<string, string> } => {
  const [color = "", ...declarations] = (value ?? "").split(";")
  const vars: Record<string, string> = {}
  for (const declaration of declarations) {
    const separator = declaration.indexOf(":")
    if (separator > 0) {
      vars[declaration.slice(0, separator).trim()] = declaration
        .slice(separator + 1)
        .trim()
    }
  }
  return { color: color.trim() || fallback, vars }
}

const tokenize = async (
  code: string,
  language: unknown
): Promise<TokenizedCode> => {
  const lang = resolveLanguage(language)
  const highlighter = await getHighlighter(lang)
  const result = highlighter.codeToTokens(code, { lang, themes: THEMES })
  const bg = splitThemeStyle(result.bg, "transparent")
  const fg = splitThemeStyle(result.fg, "inherit")
  return {
    bg: bg.color,
    fg: fg.color,
    tokens: result.tokens,
    vars: { ...bg.vars, ...fg.vars },
  }
}

// Create raw tokens for immediate display while highlighting loads. Shiki
// splits on CRLF too, so the raw and highlighted line counts match.
const createRawTokens = (code: unknown): TokenizedCode => ({
  bg: "transparent",
  fg: "inherit",
  tokens: toCodeString(code)
    .split(/\r?\n/)
    .map((line) =>
      line === ""
        ? []
        : [
            {
              color: "inherit",
              content: line,
            } as ThemedToken,
          ]
    ),
  vars: {},
})

const subscribeToNothing = () => () => {}

// Synchronous highlight with callback for async results. The callback runs
// exactly once per call: synchronously on a cache hit, otherwise when the
// shared highlight for this code and language resolves.
export const highlightCode = (
  code: string,
  language: BundledLanguage,
  callback?: (result: TokenizedCode) => void
): TokenizedCode | null => {
  const text = toCodeString(code)
  const tokensCacheKey = getTokensCacheKey(text, String(language))

  const cached = tokensCache.get(tokensCacheKey)
  if (cached) {
    callback?.(cached)
    return cached
  }

  if (callback) {
    const subs = subscribers.get(tokensCacheKey)
    if (subs) {
      subs.add(callback)
    } else {
      subscribers.set(tokensCacheKey, new Set([callback]))
    }
  }

  if (!pending.has(tokensCacheKey)) {
    const job = tokenize(text, language)
      .then((tokenized) => {
        tokensCache.set(tokensCacheKey, tokenized)
        const subs = subscribers.get(tokensCacheKey)
        subscribers.delete(tokensCacheKey)
        if (subs) {
          for (const sub of subs) {
            sub(tokenized)
          }
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to highlight code:", error)
        subscribers.delete(tokensCacheKey)
      })
      .finally(() => {
        pending.delete(tokensCacheKey)
      })
    pending.set(tokensCacheKey, job)
  }

  return null
}

const CodeBlockBody = memo(
  ({
    tokenized,
    showLineNumbers,
    className,
  }: {
    tokenized: TokenizedCode
    showLineNumbers: boolean
    className?: string
  }) => {
    const preStyle = useMemo(
      () =>
        ({
          backgroundColor: tokenized.bg,
          color: tokenized.fg,
          ...tokenized.vars,
        }) as CSSProperties,
      [tokenized]
    )

    const keyedLines = useMemo(
      () => addKeysToTokens(tokenized.tokens),
      [tokenized.tokens]
    )

    const codeStyle = useMemo(
      () =>
        showLineNumbers
          ? ({
              "--line-digits": String(keyedLines.length).length,
            } as CSSProperties)
          : undefined,
      [showLineNumbers, keyedLines.length]
    )

    return (
      <pre
        className={cn(
          "m-0 p-4 text-sm dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]",
          className
        )}
        style={preStyle}
      >
        <code
          className={cn(
            "font-mono text-sm",
            showLineNumbers && "[counter-increment:line_0] [counter-reset:line]"
          )}
          style={codeStyle}
        >
          {keyedLines.map((keyedLine) => (
            <LineSpan
              key={keyedLine.key}
              keyedLine={keyedLine}
              showLineNumbers={showLineNumbers}
            />
          ))}
        </code>
      </pre>
    )
  },
  (prevProps, nextProps) =>
    prevProps.tokenized === nextProps.tokenized &&
    prevProps.showLineNumbers === nextProps.showLineNumbers &&
    prevProps.className === nextProps.className
)

CodeBlockBody.displayName = "CodeBlockBody"

export const CodeBlockContainer = ({
  className,
  language,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { language: string }) => (
  <div
    className={cn(
      "group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
      className
    )}
    data-language={language}
    style={{
      containIntrinsicSize: "auto 200px",
      contentVisibility: "auto",
      ...style,
    }}
    {...props}
  />
)

export const CodeBlockHeader = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export const CodeBlockTitle = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
)

export const CodeBlockFilename = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("font-mono", className)} {...props}>
    {children}
  </span>
)

export const CodeBlockActions = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("-my-1 -mr-1 flex items-center gap-2", className)}
    {...props}
  >
    {children}
  </div>
)

export type CodeBlockContentProps = {
  code: string
  language: BundledLanguage
  showLineNumbers?: boolean
  /**
   * Accessible name of the scroll container when the code overflows.
   * Defaults to "<Language> code" ("TypeScript code"), or "Code" when the
   * language is not a shiki grammar.
   */
  "aria-label"?: string | undefined
}

export const CodeBlockContent = ({
  code,
  language,
  showLineNumbers = false,
  "aria-label": ariaLabel,
}: CodeBlockContentProps) => {
  const text = toCodeString(code)

  // Memoized raw tokens for immediate display
  const rawTokens = useMemo(() => createRawTokens(text), [text])

  // Synchronous cache lookup — avoids setState in effect for cached results.
  // Skipped on the server and during hydration: the server's module cache
  // warms across requests, so reading it there makes SSR output diverge from
  // the client's first render (uifiles change; upstream hydrates inconsistently).
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )
  const syncTokens = useMemo(
    () => (isHydrated ? highlightCode(text, language) : null) ?? rawTokens,
    [text, language, rawTokens, isHydrated]
  )

  // Async highlighting result (populated after shiki loads)
  const [asyncTokens, setAsyncTokens] = useState<TokenizedCode | null>(null)
  const asyncKeyRef = useRef({ code: text, language })

  // Invalidate stale async tokens synchronously during render
  if (
    asyncKeyRef.current.code !== text ||
    asyncKeyRef.current.language !== language
  ) {
    asyncKeyRef.current = { code: text, language }
    setAsyncTokens(null)
  }

  useEffect(() => {
    let cancelled = false

    highlightCode(text, language, (result) => {
      if (!cancelled) {
        setAsyncTokens(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, [text, language])

  const tokenized = asyncTokens ?? syncTokens

  // A block that overflows must be a tab stop so keyboard users can scroll
  // it (axe scrollable-region-focusable). It is a named group, not a region:
  // a landmark per block would trip axe landmark-unique as soon as a page
  // has two. Measured after mount and again when the container resizes, the
  // content changes (highlighted tokens replacing raw text, streamed code)
  // or the fonts finish loading; the attributes go through React state so
  // server HTML and hydration match.
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    let disposed = false
    const check = () => {
      if (disposed) return
      setScrollable(
        scroller.scrollWidth > scroller.clientWidth ||
          scroller.scrollHeight > scroller.clientHeight
      )
    }
    check()
    const resizeObserver = new ResizeObserver(check)
    resizeObserver.observe(scroller)
    const mutationObserver = new MutationObserver(check)
    mutationObserver.observe(scroller, {
      characterData: true,
      childList: true,
      subtree: true,
    })
    document.fonts?.ready.then(check, () => undefined)
    return () => {
      disposed = true
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return (
    <div
      className="relative overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      data-slot="code-block-content"
      ref={scrollerRef}
      {...(scrollable && {
        "aria-label": ariaLabel ?? defaultContentLabel(language),
        role: "group",
        tabIndex: 0,
      })}
    >
      <CodeBlockBody showLineNumbers={showLineNumbers} tokenized={tokenized} />
    </div>
  )
}

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: CodeBlockProps) => {
  const text = toCodeString(code)
  const contextValue = useMemo(() => ({ code: text }), [text])

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <CodeBlockContainer className={className} language={language} {...props}>
        {children}
        <CodeBlockContent
          aria-label={ariaLabel}
          code={text}
          language={language}
          showLineNumbers={showLineNumbers}
        />
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  )
}

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void
  onError?: (error: Error) => void
  timeout?: number
}

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false)
  const timeoutRef = useRef<number>(0)
  const { code } = useContext(CodeBlockContext)

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"))
      return
    }

    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(code)
        setIsCopied(true)
        onCopy?.()
        timeoutRef.current = window.setTimeout(
          () => setIsCopied(false),
          timeout
        )
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [code, onCopy, onError, timeout, isCopied])

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const Icon = isCopied ? CheckIcon : CopyIcon

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  )
}

// Generic over the value so `useState<string | null>` setters and literal
// unions both type-check against Base UI's `(value | null, eventDetails)`.
export type CodeBlockLanguageSelectorProps<Value extends string = string> =
  ComponentProps<typeof Select<Value, false>>

export const CodeBlockLanguageSelector = <Value extends string = string>(
  props: CodeBlockLanguageSelectorProps<Value>
) => <Select {...props} />

export type CodeBlockLanguageSelectorTriggerProps = ComponentProps<
  typeof SelectTrigger
>

export const CodeBlockLanguageSelectorTrigger = ({
  className,
  ...props
}: CodeBlockLanguageSelectorTriggerProps) => (
  <SelectTrigger
    className={cn(
      "h-7 border-none bg-transparent px-2 text-xs shadow-none",
      className
    )}
    size="sm"
    {...props}
  />
)

export type CodeBlockLanguageSelectorValueProps = ComponentProps<
  typeof SelectValue
>

export const CodeBlockLanguageSelectorValue = (
  props: CodeBlockLanguageSelectorValueProps
) => <SelectValue {...props} />

export type CodeBlockLanguageSelectorContentProps = ComponentProps<
  typeof SelectContent
>

export const CodeBlockLanguageSelectorContent = ({
  align = "end",
  ...props
}: CodeBlockLanguageSelectorContentProps) => (
  <SelectContent align={align} {...props} />
)

export type CodeBlockLanguageSelectorItemProps = ComponentProps<
  typeof SelectItem
>

export const CodeBlockLanguageSelectorItem = (
  props: CodeBlockLanguageSelectorItemProps
) => <SelectItem {...props} />
