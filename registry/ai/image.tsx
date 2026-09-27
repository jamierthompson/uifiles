// Derived from Vercel AI Elements image.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.

import type { GeneratedFile } from "ai"
import { cn } from "cn"

export type ImageProps = GeneratedFile & {
  className?: string | undefined
  /** Text alternative for the generated image; pass "" only when it is decorative. */
  alt: string
}

export const Image = ({
  base64,
  uint8Array: _uint8Array,
  mediaType,
  providerMetadata: _providerMetadata,
  alt,
  className,
  ...props
}: ImageProps) =>
  base64 ? (
    // biome-ignore lint/performance/noImgElement: the source is an inline data: URL from the model, which next/image cannot optimize
    <img
      {...props}
      alt={alt}
      className={cn("h-auto max-w-full overflow-hidden rounded-md", className)}
      src={`data:${mediaType || "image/png"};base64,${base64}`}
    />
  ) : null
