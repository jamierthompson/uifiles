// Derived from Vercel AI Elements prompt-input.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import type { ChatStatus, FileUIPart, SourceDocumentUIPart } from "ai"
import { cn } from "cn"
import {
  CornerDownLeftIcon,
  ImageIcon,
  Monitor,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react"
import { nanoid } from "nanoid"
import type {
  ChangeEvent,
  ChangeEventHandler,
  ClipboardEventHandler,
  ComponentProps,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
  KeyboardEventHandler,
  MouseEvent,
  MouseEventHandler,
  PropsWithChildren,
  ReactNode,
  RefObject,
} from "react"
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ============================================================================
// Helpers
// ============================================================================

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    // FileReader uses callback-based API, wrapping in Promise is necessary
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const captureScreenshot = async (): Promise<File | null> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    return null
  }

  let stream: MediaStream | null = null
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: true,
    })

    video.srcObject = stream

    // Video element uses callback-based API, wrapping in Promise is necessary
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error("Failed to load screen stream"))
    })

    await video.play()

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      return null
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) {
      return null
    }

    context.drawImage(video, 0, 0, width, height)
    // canvas.toBlob uses callback-based API, wrapping in Promise is necessary
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png")
    })
    if (!blob) {
      return null
    }

    const timestamp = new Date()
      .toISOString()
      .replaceAll(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "")

    return new File([blob], `screenshot-${timestamp}.png`, {
      lastModified: Date.now(),
      type: "image/png",
    })
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }
    video.pause()
    video.srcObject = null
  }
}

type AttachmentFile = FileUIPart & { id: string }

const toAttachment = (file: File): AttachmentFile => ({
  filename: file.name,
  id: nanoid(),
  mediaType: file.type,
  type: "file",
  url: URL.createObjectURL(file),
})

const revokeObjectUrls = (files: Pick<FileUIPart, "url">[]) => {
  for (const file of files) {
    if (file.url) {
      URL.revokeObjectURL(file.url)
    }
  }
}

// ============================================================================
// Provider Context & Types
// ============================================================================

export interface AttachmentsContext {
  files: (FileUIPart & { id: string })[]
  add: (files: File[] | FileList) => void
  remove: (id: string) => void
  clear: () => void
  openFileDialog: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
}

export interface TextInputContext {
  value: string
  setInput: (v: string) => void
  clear: () => void
}

export interface PromptInputControllerProps {
  textInput: TextInputContext
  attachments: AttachmentsContext
  /** INTERNAL: Allows PromptInput to register its file textInput + "open" callback */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void
}

const PromptInputController = createContext<PromptInputControllerProps | null>(
  null
)
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(
  null
)
// The provider's attachment list and text as add/remove/clear and
// setInput/clear leave them, before React commits. PromptInput checks
// maxFiles against the list, so an add() in the same handler as a remove()
// or clear() sees the freed slot, and a submit takes the text from here and
// clears it, so a second submit in the same tick does not send it again.
type ProviderRefs = {
  files: RefObject<AttachmentFile[]>
  text: RefObject<string>
}
const ProviderRefsContext = createContext<ProviderRefs | null>(null)

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController)
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    )
  }
  return ctx
}

// Optional variants (do NOT throw). Useful for dual-mode components.
const useOptionalPromptInputController = () => useContext(PromptInputController)

export const useProviderAttachments = () => {
  const ctx = useContext(ProviderAttachmentsContext)
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments()."
    )
  }
  return ctx
}

const useOptionalProviderAttachments = () =>
  useContext(ProviderAttachmentsContext)

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string
}>

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  children,
}: PromptInputProviderProps) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput)
  const textInputRef = useRef(initialTextInput)
  const setInput = useCallback((value: string) => {
    textInputRef.current = value
    setTextInput(value)
  }, [])
  const clearInput = useCallback(() => setInput(""), [setInput])

  // ----- attachments state (global when wrapped)
  const [attachmentFiles, setAttachmentFiles] = useState<AttachmentFile[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const openRef = useRef<() => void>(() => {
    // replaced by PromptInput via __registerFileInput
  })

  // Mirrors the attachments synchronously so object URLs can be created and
  // revoked outside React's state updaters, which StrictMode invokes twice.
  const attachmentsRef = useRef(attachmentFiles)

  useEffect(() => {
    attachmentsRef.current = attachmentFiles
  }, [attachmentFiles])

  const add = useCallback((files: File[] | FileList) => {
    const next = [...files].map(toAttachment)
    if (next.length === 0) {
      return
    }
    attachmentsRef.current = [...attachmentsRef.current, ...next]
    setAttachmentFiles((prev) => [...prev, ...next])
  }, [])

  const remove = useCallback((id: string) => {
    const found = attachmentsRef.current.find((f) => f.id === id)
    if (found?.url) {
      URL.revokeObjectURL(found.url)
    }
    attachmentsRef.current = attachmentsRef.current.filter((f) => f.id !== id)
    setAttachmentFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clear = useCallback(() => {
    revokeObjectUrls(attachmentsRef.current)
    attachmentsRef.current = []
    setAttachmentFiles([])
  }, [])

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(
    () => () => {
      revokeObjectUrls(attachmentsRef.current)
    },
    []
  )

  const openFileDialog = useCallback(() => {
    openRef.current?.()
  }, [])

  const attachments = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear,
      fileInputRef,
      files: attachmentFiles,
      openFileDialog,
      remove,
    }),
    [attachmentFiles, add, remove, clear, openFileDialog]
  )

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current
      openRef.current = open
    },
    []
  )

  const controller = useMemo<PromptInputControllerProps>(
    () => ({
      __registerFileInput,
      attachments,
      textInput: {
        clear: clearInput,
        setInput,
        value: textInput,
      },
    }),
    [textInput, clearInput, setInput, attachments, __registerFileInput]
  )

  const refs = useMemo<ProviderRefs>(
    () => ({ files: attachmentsRef, text: textInputRef }),
    []
  )

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        <ProviderRefsContext.Provider value={refs}>
          {children}
        </ProviderRefsContext.Provider>
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  )
}

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null)

export const usePromptInputAttachments = () => {
  // Prefer local context (inside PromptInput) as it has validation, fall back to provider
  const provider = useOptionalProviderAttachments()
  const local = useContext(LocalAttachmentsContext)
  const context = local ?? provider
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    )
  }
  return context
}

export type PromptInputError = {
  code: "max_files" | "max_file_size" | "accept" | "screenshot"
  message: string
}

const PromptInputErrorContext = createContext<
  ((error: PromptInputError) => void) | undefined
>(undefined)

// Set by PromptInputTextarea so a rejected submit does not write into a
// textarea the consumer controls through `value`.
const TextareaControlContext = createContext<RefObject<boolean> | null>(null)

// ============================================================================
// Referenced Sources (Local to PromptInput)
// ============================================================================

export interface ReferencedSourcesContext {
  sources: (SourceDocumentUIPart & { id: string })[]
  add: (sources: SourceDocumentUIPart[] | SourceDocumentUIPart) => void
  remove: (id: string) => void
  clear: () => void
}

export const LocalReferencedSourcesContext =
  createContext<ReferencedSourcesContext | null>(null)

export const usePromptInputReferencedSources = () => {
  const ctx = useContext(LocalReferencedSourcesContext)
  if (!ctx) {
    throw new Error(
      "usePromptInputReferencedSources must be used within a LocalReferencedSourcesContext.Provider"
    )
  }
  return ctx
}

/** Base UI menu items expose `onClick` (not Radix `onSelect`). */
type PromptInputActionMenuItemClickEvent = Parameters<
  NonNullable<ComponentProps<typeof DropdownMenuItem>["onClick"]>
>[0]

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string
}

export const PromptInputActionAddAttachments = ({
  label = "Add photos or files",
  onClick,
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const attachments = usePromptInputAttachments()

  const handleClick = useCallback(
    (event: PromptInputActionMenuItemClickEvent) => {
      onClick?.(event)
      if (event.defaultPrevented) {
        return
      }
      attachments.openFileDialog()
    },
    [onClick, attachments]
  )

  // Upstream keeps the menu open while the file dialog is up by calling
  // `preventDefault()` in Radix `onSelect`; Base UI's equivalent is `closeOnClick`.
  return (
    <DropdownMenuItem closeOnClick={false} {...props} onClick={handleClick}>
      <ImageIcon className="mr-2 size-4" /> {label}
    </DropdownMenuItem>
  )
}

export type PromptInputActionAddScreenshotProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string
}

export const PromptInputActionAddScreenshot = ({
  label = "Take screenshot",
  onClick,
  ...props
}: PromptInputActionAddScreenshotProps) => {
  const attachments = usePromptInputAttachments()
  const onError = useContext(PromptInputErrorContext)

  const handleClick = useCallback(
    async (event: PromptInputActionMenuItemClickEvent) => {
      onClick?.(event)
      if (event.defaultPrevented) {
        return
      }

      try {
        const screenshot = await captureScreenshot()
        if (screenshot) {
          attachments.add([screenshot])
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "AbortError")
        ) {
          return
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Screenshot capture failed."
        if (onError) {
          onError({ code: "screenshot", message })
        } else {
          console.error(error)
        }
      }
    },
    [onClick, attachments, onError]
  )

  return (
    <DropdownMenuItem {...props} onClick={handleClick}>
      <Monitor className="mr-2 size-4" />
      {label}
    </DropdownMenuItem>
  )
}

export interface PromptInputMessage {
  text: string
  files: FileUIPart[]
}

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "onError"
> & {
  // e.g., "image/*" or leave undefined for any
  accept?: string
  multiple?: boolean
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean
  // Kept for API parity with AI Elements. Browsers do not let scripts set a
  // file input's value, so this only clears the hidden input when the
  // attachment list empties; native form posts never carry the attachments.
  syncHiddenInput?: boolean
  // Minimal constraints
  maxFiles?: number
  // bytes
  maxFileSize?: number
  onError?: (err: PromptInputError) => void
  // Returning `false` (or throwing/rejecting) rejects the submit: the text is
  // restored and the attachments and referenced sources are kept.
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
    // biome-ignore lint/suspicious/noConfusingVoidType: `void` keeps `async () => {}` and useChat's sendMessage (Promise<void>) assignable alongside a `false` return.
  ) => void | boolean | Promise<void | boolean>
}

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  // Try to use a provider controller if present
  const controller = useOptionalPromptInputController()
  const usingProvider = !!controller
  const providerRefs = useContext(ProviderRefsContext)

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  // ----- Local attachments (only used when no provider)
  const [items, setItems] = useState<AttachmentFile[]>([])
  const files = usingProvider ? controller.attachments.files : items

  // ----- Local referenced sources (always local to PromptInput)
  const [referencedSources, setReferencedSources] = useState<
    (SourceDocumentUIPart & { id: string })[]
  >([])

  // Mirrors `files` synchronously: validation, object URLs and `onError` run
  // outside React's state updaters (StrictMode invokes those twice), and the
  // unmount cleanup needs the latest list without a stale closure.
  const filesRef = useRef(files)

  useEffect(() => {
    filesRef.current = files
  }, [files])

  // The attachments as of now, not as of the last render: add, remove and
  // clear update these synchronously (the provider's own ref in provider
  // mode), so maxFiles and a submit's snapshot see changes made earlier in
  // the same handler.
  const currentFiles = useCallback(
    () =>
      (usingProvider ? providerRefs?.files.current : undefined) ??
      filesRef.current,
    [usingProvider, providerRefs]
  )

  // Ids of attachments carried by a submit that has not settled yet: a
  // second submit (a double press, or one while an async onSubmit is
  // pending) leaves them out instead of sending them again.
  const inFlightFileIdsRef = useRef(new Set<string>())
  // Settles once the latest submit has called onSubmit, so submits reach
  // onSubmit in the order they were made even when an earlier one is still
  // converting its attachments.
  const submitTurnRef = useRef<Promise<void>>(Promise.resolve())

  const textareaControlledRef = useRef(false)

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === "") {
        return true
      }

      const patterns = accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      const type = f.type.toLowerCase()
      const name = f.name.toLowerCase()

      return patterns.some((pattern) => {
        if (pattern === "*/*") {
          return true
        }
        if (pattern.startsWith(".")) {
          // e.g: .pdf -> matches by file name, which also covers files the
          // OS reports with an empty type
          return name.endsWith(pattern)
        }
        if (pattern.endsWith("/*")) {
          // e.g: image/* -> image/
          const prefix = pattern.slice(0, -1)
          return type.startsWith(prefix)
        }
        return type === pattern
      })
    },
    [accept]
  )

  // Applies accept, maxFileSize and maxFiles in that order and reports every
  // file that was dropped, so a partially rejected batch is never silent.
  const acceptFiles = useCallback(
    (fileList: File[] | FileList, currentCount: number): File[] => {
      const incoming = [...fileList]
      if (incoming.length === 0) {
        return []
      }
      const accepted = incoming.filter((f) => matchesAccept(f))
      if (accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        })
        return []
      }
      if (accepted.length < incoming.length) {
        onError?.({
          code: "accept",
          message:
            "Some files do not match the accepted types and were not added.",
        })
      }
      const sized = maxFileSize
        ? accepted.filter((f) => f.size <= maxFileSize)
        : accepted
      if (sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        })
        return []
      }
      if (sized.length < accepted.length) {
        onError?.({
          code: "max_file_size",
          message: "Some files exceed the maximum size and were not added.",
        })
      }
      if (typeof maxFiles !== "number") {
        return sized
      }
      const capacity = Math.max(0, maxFiles - currentCount)
      if (sized.length > capacity) {
        onError?.({
          code: "max_files",
          message: "Too many files. Some were not added.",
        })
      }
      return sized.slice(0, capacity)
    },
    [matchesAccept, maxFileSize, maxFiles, onError]
  )

  const addLocal = useCallback(
    (fileList: File[] | FileList) => {
      const next = acceptFiles(fileList, filesRef.current.length).map(
        toAttachment
      )
      if (next.length === 0) {
        return
      }
      filesRef.current = [...filesRef.current, ...next]
      setItems((prev) => [...prev, ...next])
    },
    [acceptFiles]
  )

  const removeLocal = useCallback((id: string) => {
    const found = filesRef.current.find((file) => file.id === id)
    if (found?.url) {
      URL.revokeObjectURL(found.url)
    }
    filesRef.current = filesRef.current.filter((file) => file.id !== id)
    setItems((prev) => prev.filter((file) => file.id !== id))
  }, [])

  // Wrapper that validates files before calling provider's add
  const addWithProviderValidation = useCallback(
    (fileList: File[] | FileList) => {
      const capped = acceptFiles(fileList, currentFiles().length)
      if (capped.length > 0) {
        controller?.attachments.add(capped)
      }
    },
    [acceptFiles, controller, currentFiles]
  )

  const clearAttachments = useCallback(() => {
    if (usingProvider) {
      controller?.attachments.clear()
      return
    }
    revokeObjectUrls(filesRef.current)
    filesRef.current = []
    setItems([])
  }, [usingProvider, controller])

  const removeAttachments = useCallback(
    (ids: ReadonlySet<string>) => {
      if (usingProvider) {
        for (const id of ids) {
          controller?.attachments.remove(id)
        }
        return
      }
      revokeObjectUrls(filesRef.current.filter((file) => ids.has(file.id)))
      filesRef.current = filesRef.current.filter((file) => !ids.has(file.id))
      setItems((prev) => prev.filter((file) => !ids.has(file.id)))
    },
    [usingProvider, controller]
  )

  const clearReferencedSources = useCallback(() => setReferencedSources([]), [])

  const removeReferencedSources = useCallback(
    (ids: ReadonlySet<string>) =>
      setReferencedSources((prev) =>
        prev.filter((source) => !ids.has(source.id))
      ),
    []
  )

  const add = usingProvider ? addWithProviderValidation : addLocal
  const remove = usingProvider ? controller.attachments.remove : removeLocal
  const openFileDialog = usingProvider
    ? controller.attachments.openFileDialog
    : openFileDialogLocal

  // Let provider know about our hidden file input so external menus can call openFileDialog()
  useEffect(() => {
    if (!usingProvider) {
      return
    }
    controller.__registerFileInput(inputRef, () => inputRef.current?.click())
  }, [usingProvider, controller])

  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = ""
    }
  }, [files, syncHiddenInput])

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current
    if (!form) {
      return
    }
    if (globalDrop) {
      // when global drop is on, let the document-level handler own drops
      return
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault()
      }
    }
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault()
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files)
      }
    }
    form.addEventListener("dragover", onDragOver)
    form.addEventListener("drop", onDrop)
    return () => {
      form.removeEventListener("dragover", onDragOver)
      form.removeEventListener("drop", onDrop)
    }
  }, [add, globalDrop])

  useEffect(() => {
    if (!globalDrop) {
      return
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault()
      }
    }
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault()
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files)
      }
    }
    document.addEventListener("dragover", onDragOver)
    document.addEventListener("drop", onDrop)
    return () => {
      document.removeEventListener("dragover", onDragOver)
      document.removeEventListener("drop", onDrop)
    }
  }, [add, globalDrop])

  useEffect(
    () => () => {
      if (!usingProvider) {
        revokeObjectUrls(filesRef.current)
      }
    },
    [usingProvider]
  )

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.currentTarget.files) {
        add(event.currentTarget.files)
      }
      // Reset input value to allow selecting files that were previously removed
      event.currentTarget.value = ""
    },
    [add]
  )

  const attachmentsCtx = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear: clearAttachments,
      fileInputRef: inputRef,
      files: files.map((item) => ({ ...item, id: item.id })),
      openFileDialog,
      remove,
    }),
    [files, add, remove, clearAttachments, openFileDialog]
  )

  const refsCtx = useMemo<ReferencedSourcesContext>(
    () => ({
      add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => {
        const array = Array.isArray(incoming) ? incoming : [incoming]
        setReferencedSources((prev) => [
          ...prev,
          ...array.map((s) => ({ ...s, id: nanoid() })),
        ])
      },
      clear: clearReferencedSources,
      remove: (id: string) => {
        setReferencedSources((prev) => prev.filter((s) => s.id !== id))
      },
      sources: referencedSources,
    }),
    [referencedSources, clearReferencedSources]
  )

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault()

      const form = event.currentTarget
      const text = usingProvider
        ? (providerRefs?.text.current ?? controller.textInput.value)
        : (() => {
            const formData = new FormData(form)
            return (formData.get("message") as string) || ""
          })()

      // Clear the text as soon as it is captured, in both modes, so input
      // typed during the async blob conversion or a pending onSubmit is kept,
      // and a second submit in the meantime does not send the same text.
      if (usingProvider) {
        controller.textInput.clear()
      } else {
        form.reset()
      }

      // Only what this submit carried is cleared once it is accepted, so a
      // file attached while a slow onSubmit is still pending survives.
      const inFlight = inFlightFileIdsRef.current
      const submittedFiles = currentFiles().filter(
        (file) => !inFlight.has(file.id)
      )
      const submittedFileIds = new Set(submittedFiles.map((file) => file.id))
      for (const id of submittedFileIds) {
        inFlight.add(id)
      }
      const submittedSourceIds = new Set(
        referencedSources.map((source) => source.id)
      )

      const previousTurn = submitTurnRef.current
      let endTurn = () => {}
      submitTurnRef.current = new Promise<void>((resolve) => {
        endTurn = resolve
      })

      const commit = () => {
        removeAttachments(submittedFileIds)
        removeReferencedSources(submittedSourceIds)
      }

      // A rejected submit gives the text back so the user can retry, unless
      // they have typed something new since the reset. A controlled textarea
      // belongs to the consumer, so it is left alone.
      const restoreText = () => {
        if (usingProvider) {
          if (providerRefs?.text.current === "") {
            controller.textInput.setInput(text)
          }
          return
        }
        if (textareaControlledRef.current) {
          return
        }
        const textarea = form.querySelector<HTMLTextAreaElement>(
          'textarea[name="message"]'
        )
        if (textarea && textarea.value === textarea.defaultValue) {
          textarea.value = text
        }
      }

      try {
        // Convert blob URLs to data URLs asynchronously
        const convertedFiles: FileUIPart[] = await Promise.all(
          submittedFiles.map(async ({ id: _id, ...item }) => {
            if (item.url?.startsWith("blob:")) {
              const dataUrl = await convertBlobUrlToDataUrl(item.url)
              // If conversion failed, keep the original blob URL
              return {
                ...item,
                url: dataUrl ?? item.url,
              }
            }
            return item
          })
        )

        await previousTurn
        const result = onSubmit({ files: convertedFiles, text }, event)
        endTurn()
        // A sync onSubmit commits in the same tick; an async one once it
        // settles. Throwing, rejecting or returning false rejects the submit.
        const accepted = result instanceof Promise ? await result : result
        if (accepted === false) {
          restoreText()
        } else {
          commit()
        }
      } catch {
        restoreText()
      } finally {
        endTurn()
        for (const id of submittedFileIds) {
          inFlight.delete(id)
        }
      }
    },
    [
      usingProvider,
      controller,
      providerRefs,
      currentFiles,
      referencedSources,
      onSubmit,
      removeAttachments,
      removeReferencedSources,
    ]
  )

  // Render with or without local provider
  const inner = (
    <>
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title="Upload files"
        type="file"
      />
      <form
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...props}
      >
        <InputGroup className="overflow-hidden">{children}</InputGroup>
      </form>
    </>
  )

  const withReferencedSources = (
    <LocalReferencedSourcesContext.Provider value={refsCtx}>
      <TextareaControlContext.Provider value={textareaControlledRef}>
        {inner}
      </TextareaControlContext.Provider>
    </LocalReferencedSourcesContext.Provider>
  )

  // Always provide LocalAttachmentsContext so children get validated add function
  return (
    <LocalAttachmentsContext.Provider value={attachmentsCtx}>
      <PromptInputErrorContext.Provider value={onError}>
        {withReferencedSources}
      </PromptInputErrorContext.Provider>
    </LocalAttachmentsContext.Provider>
  )
}

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>

export const PromptInputBody = ({
  className,
  ...props
}: PromptInputBodyProps) => (
  <div className={cn("contents", className)} {...props} />
)

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>

export const PromptInputTextarea = ({
  onChange,
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const controller = useOptionalPromptInputController()
  const attachments = usePromptInputAttachments()
  const [isComposing, setIsComposing] = useState(false)

  const controlledRef = useContext(TextareaControlContext)
  const isControlled = !controller && props.value !== undefined
  useEffect(() => {
    if (controlledRef) {
      controlledRef.current = isControlled
    }
  }, [controlledRef, isControlled])

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      // Call the external onKeyDown handler first
      onKeyDown?.(e)

      // If the external handler prevented default, don't run internal logic
      if (e.defaultPrevented) {
        return
      }

      if (e.key === "Enter") {
        // keyCode 229 marks a key handled by an IME; Safari fires it on the
        // Enter that confirms a composition after `compositionend` has run.
        if (
          isComposing ||
          e.nativeEvent.isComposing ||
          e.nativeEvent.keyCode === 229
        ) {
          return
        }
        if (e.shiftKey) {
          return
        }
        e.preventDefault()

        // Enter only submits through an enabled submit button, so a disabled
        // button or a Stop button (type="button" while generating) blocks it
        const { form } = e.currentTarget
        if (!form) {
          return
        }
        const submitButton = form.querySelector<HTMLButtonElement>(
          'button[type="submit"]'
        )
        if (!submitButton || submitButton.disabled) {
          return
        }

        form.requestSubmit()
      }

      // Remove last attachment when Backspace is pressed and textarea is empty
      if (
        e.key === "Backspace" &&
        e.currentTarget.value === "" &&
        attachments.files.length > 0
      ) {
        e.preventDefault()
        const lastAttachment = attachments.files.at(-1)
        if (lastAttachment) {
          attachments.remove(lastAttachment.id)
        }
      }
    },
    [onKeyDown, isComposing, attachments]
  )

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      const items = event.clipboardData?.items

      if (!items) {
        return
      }

      const files: File[] = []

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
        }
      }

      if (files.length > 0) {
        event.preventDefault()
        attachments.add(files)
      }
    },
    [attachments]
  )

  const handleCompositionEnd = useCallback(() => setIsComposing(false), [])
  const handleCompositionStart = useCallback(() => setIsComposing(true), [])

  const controlledProps = controller
    ? {
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
          controller.textInput.setInput(e.currentTarget.value)
          onChange?.(e)
        },
        value: controller.textInput.value,
      }
    : {
        onChange,
      }

  return (
    <InputGroupTextarea
      aria-label="Message"
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      name="message"
      onCompositionEnd={handleCompositionEnd}
      onCompositionStart={handleCompositionStart}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      {...props}
      {...controlledProps}
    />
  )
}

// Anything that takes focus or handles clicks itself; a click on one of these
// inside an addon must not move focus to the textarea.
const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "summary",
  "label",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="textbox"]',
].join(", ")

// shadcn's InputGroupAddon focuses the group's first <input> when its surface
// is clicked. In a composer that input is Base UI Select's hidden input, which
// forwards focus to the select trigger, and clicks on portaled menu items
// reach the addon through React's tree. Focus the textarea instead, and only
// for clicks that land on the addon's own inert surface.
const useAddonClick = (
  onClick: MouseEventHandler<HTMLDivElement> | undefined
) =>
  useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) {
        return
      }
      const { currentTarget, target } = event
      if (!(target instanceof Element) || !currentTarget.contains(target)) {
        return
      }
      if (target.closest(INTERACTIVE_SELECTOR)) {
        return
      }
      const group =
        currentTarget.closest('[data-slot="input-group"]') ??
        currentTarget.parentElement
      group?.querySelector("textarea")?.focus()
    },
    [onClick]
  )

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>

export const PromptInputHeader = ({
  className,
  onClick,
  ...props
}: PromptInputHeaderProps) => {
  const handleClick = useAddonClick(onClick)
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("order-first flex-wrap gap-1", className)}
      onClick={handleClick}
      {...props}
    />
  )
}

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>

export const PromptInputFooter = ({
  className,
  onClick,
  ...props
}: PromptInputFooterProps) => {
  const handleClick = useAddonClick(onClick)
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("justify-between gap-1", className)}
      onClick={handleClick}
      {...props}
    />
  )
}

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div
    className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}
    {...props}
  />
)

export type PromptInputButtonTooltip =
  | string
  | {
      content: ReactNode
      shortcut?: string
      side?: ComponentProps<typeof TooltipContent>["side"]
    }

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton> & {
  tooltip?: PromptInputButtonTooltip
}

/** The text a node renders, read from React children (icons contribute nothing). */
const textOf = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("")
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children)
  }
  return ""
}

// Key names for aria-keyshortcuts, which wants UI Events key values joined by
// "+" ("Meta+K"), not the glyphs a tooltip shows ("⌘K").
const KEY_GLYPHS: Record<string, string> = {
  "⌘": "Meta",
  "⌃": "Control",
  "⌥": "Alt",
  "⇧": "Shift",
  "↵": "Enter",
  "⏎": "Enter",
  "⌫": "Backspace",
  "⌦": "Delete",
  "⎋": "Escape",
  "⇥": "Tab",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
  "←": "ArrowLeft",
  "→": "ArrowRight",
}

const KEY_WORDS: Record<string, string> = {
  alt: "Alt",
  cmd: "Meta",
  command: "Meta",
  control: "Control",
  ctrl: "Control",
  del: "Delete",
  enter: "Enter",
  esc: "Escape",
  escape: "Escape",
  meta: "Meta",
  opt: "Alt",
  option: "Alt",
  return: "Enter",
  shift: "Shift",
  space: "Space",
  tab: "Tab",
}

const toKeyShortcuts = (shortcut: string): string | undefined => {
  const keys: string[] = []
  for (const token of shortcut.split(/[\s+]+/)) {
    let rest = token
    // Glyphs run together ("⌘⇧K"), so peel them off one at a time.
    while (rest !== "") {
      const glyph = KEY_GLYPHS[rest.charAt(0)]
      if (!glyph) break
      keys.push(glyph)
      rest = rest.slice(1)
    }
    if (rest === "") continue
    const word = KEY_WORDS[rest.toLowerCase()]
    keys.push(word ?? (rest.length === 1 ? rest.toUpperCase() : rest))
  }
  return keys.length > 0 ? keys.join("+") : undefined
}

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  tooltip,
  ...props
}: PromptInputButtonProps) => {
  const descriptionId = useId()
  const newSize =
    size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm")

  const tooltipContent =
    typeof tooltip === "string" ? tooltip : tooltip?.content
  const hasTooltip = Boolean(tooltipContent)
  const shortcut = typeof tooltip === "string" ? undefined : tooltip?.shortcut
  const side = typeof tooltip === "string" ? "top" : (tooltip?.side ?? "top")
  // Base UI tooltips are visual only (no role or aria-describedby), so the
  // content is mirrored in a visually hidden description unless it would
  // just repeat the button's own name (its aria-label or visible text).
  const repeatsName =
    typeof tooltipContent === "string" &&
    [props["aria-label"], textOf(props.children)].some(
      (name) => name?.trim() === tooltipContent.trim()
    )
  const describes = hasTooltip && !repeatsName
  // The shortcut survives a skipped description as aria-keyshortcuts.
  const keyShortcuts =
    hasTooltip && shortcut ? toKeyShortcuts(shortcut) : undefined

  const button = (
    <InputGroupButton
      aria-describedby={describes ? descriptionId : undefined}
      aria-keyshortcuts={keyShortcuts}
      className={cn(className)}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  )

  if (!hasTooltip) {
    return button
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger delay={0} render={button} />
        <TooltipContent side={side}>
          {tooltipContent}
          {shortcut && (
            <span className="ml-2 text-muted-foreground">{shortcut}</span>
          )}
        </TooltipContent>
      </Tooltip>
      {describes && (
        <span className="sr-only" id={descriptionId}>
          {tooltipContent}
          {shortcut && ` ${shortcut}`}
        </span>
      )}
    </>
  )
}

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
)

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger
    render={
      <PromptInputButton className={className} {...props}>
        {children ?? <PlusIcon className="size-4" />}
      </PromptInputButton>
    }
  />
)

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
)

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps) => (
  <DropdownMenuItem className={cn(className)} {...props} />
)

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus
  onStop?: () => void
}

type PromptInputSubmitClickEvent = Parameters<
  NonNullable<PromptInputSubmitProps["onClick"]>
>[0]

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const isGenerating = status === "submitted" || status === "streaming"
  // Only a wired onStop makes this a Stop button. Without one a press still
  // submits, so the name, the glyph and the type stay those of Submit.
  const canStop = isGenerating && onStop !== undefined

  let Icon = <CornerDownLeftIcon className="size-4" />

  if (status === "submitted") {
    // Progress rather than an action, so it shows with or without onStop.
    Icon = <Spinner />
  } else if (status === "streaming" && canStop) {
    Icon = <SquareIcon className="size-4" />
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />
  }

  const handleClick = useCallback(
    (e: PromptInputSubmitClickEvent) => {
      if (canStop) {
        e.preventDefault()
        onStop?.()
        return
      }
      onClick?.(e)
    },
    [canStop, onStop, onClick]
  )

  return (
    <InputGroupButton
      aria-label={canStop ? "Stop" : "Submit"}
      className={cn("shrink-0", className)}
      onClick={handleClick}
      size={size}
      type={canStop ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </InputGroupButton>
  )
}

export type PromptInputSelectProps = ComponentProps<typeof Select>

// Annotated with `typeof Select` so Base UI's generic value type survives the
// wrapper (otherwise `onValueChange` receives `unknown`).
export const PromptInputSelect: typeof Select = (props) => <Select {...props} />

export type PromptInputSelectTriggerProps = ComponentProps<typeof SelectTrigger>

export const PromptInputSelectTrigger = ({
  className,
  ...props
}: PromptInputSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className
    )}
    {...props}
  />
)

export type PromptInputSelectContentProps = ComponentProps<typeof SelectContent>

export const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
)

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>

export const PromptInputSelectItem = ({
  className,
  ...props
}: PromptInputSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
)

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>

export const PromptInputSelectValue = ({
  className,
  ...props
}: PromptInputSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
)

// Base UI's PreviewCard puts open/close delays on the Trigger, not the Root.
// Upstream exposes them on the root, so carry them to the trigger via context
// to keep the public API identical.
const PromptInputHoverCardDelayContext = createContext<{
  openDelay: number
  closeDelay: number
}>({ closeDelay: 0, openDelay: 0 })

export type PromptInputHoverCardProps = ComponentProps<typeof HoverCard> & {
  openDelay?: number
  closeDelay?: number
}

export const PromptInputHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}: PromptInputHoverCardProps) => {
  const delays = useMemo(
    () => ({ closeDelay, openDelay }),
    [closeDelay, openDelay]
  )
  return (
    <PromptInputHoverCardDelayContext.Provider value={delays}>
      <HoverCard {...props} />
    </PromptInputHoverCardDelayContext.Provider>
  )
}

export type PromptInputHoverCardTriggerProps = ComponentProps<
  typeof HoverCardTrigger
>

export const PromptInputHoverCardTrigger = (
  props: PromptInputHoverCardTriggerProps
) => {
  const { openDelay, closeDelay } = useContext(PromptInputHoverCardDelayContext)
  return (
    <HoverCardTrigger closeDelay={closeDelay} delay={openDelay} {...props} />
  )
}

export type PromptInputHoverCardContentProps = ComponentProps<
  typeof HoverCardContent
>

export const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}: PromptInputHoverCardContentProps) => (
  <HoverCardContent align={align} {...props} />
)

export type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>

export const PromptInputTabsList = ({
  className,
  ...props
}: PromptInputTabsListProps) => <div className={cn(className)} {...props} />

export type PromptInputTabProps = HTMLAttributes<HTMLDivElement>

export const PromptInputTab = ({
  className,
  ...props
}: PromptInputTabProps) => <div className={cn(className)} {...props} />

export type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>

export const PromptInputTabLabel = ({
  className,
  ...props
}: PromptInputTabLabelProps) => (
  // Content provided via children in props
  <h3
    className={cn(
      "mb-2 px-3 text-xs font-medium text-muted-foreground",
      className
    )}
    {...props}
  />
)

export type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>

export const PromptInputTabBody = ({
  className,
  ...props
}: PromptInputTabBodyProps) => (
  <div className={cn("space-y-1", className)} {...props} />
)

export type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>

export const PromptInputTabItem = ({
  className,
  ...props
}: PromptInputTabItemProps) => (
  <div
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent",
      className
    )}
    {...props}
  />
)

export type PromptInputCommandProps = ComponentProps<typeof Command>

export const PromptInputCommand = ({
  className,
  ...props
}: PromptInputCommandProps) => <Command className={cn(className)} {...props} />

export type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>

export const PromptInputCommandInput = ({
  className,
  ...props
}: PromptInputCommandInputProps) => (
  <CommandInput className={cn(className)} {...props} />
)

export type PromptInputCommandListProps = ComponentProps<typeof CommandList>

export const PromptInputCommandList = ({
  className,
  ...props
}: PromptInputCommandListProps) => (
  <CommandList className={cn(className)} {...props} />
)

export type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>

export const PromptInputCommandEmpty = ({
  className,
  ...props
}: PromptInputCommandEmptyProps) => (
  <CommandEmpty className={cn(className)} {...props} />
)

export type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>

export const PromptInputCommandGroup = ({
  className,
  ...props
}: PromptInputCommandGroupProps) => (
  <CommandGroup className={cn(className)} {...props} />
)

export type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>

export const PromptInputCommandItem = ({
  className,
  ...props
}: PromptInputCommandItemProps) => (
  <CommandItem className={cn(className)} {...props} />
)

export type PromptInputCommandSeparatorProps = ComponentProps<
  typeof CommandSeparator
>

export const PromptInputCommandSeparator = ({
  className,
  ...props
}: PromptInputCommandSeparatorProps) => (
  <CommandSeparator className={cn(className)} {...props} />
)
