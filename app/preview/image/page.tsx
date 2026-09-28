import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import { Image } from "@/registry/ai/image"

export const metadata: Metadata = { title: "Image" }

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e3a5f"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#sky)"/>
  <circle cx="480" cy="230" r="56" fill="#fde68a"/>
  <path d="M0 300 L120 220 L220 280 L340 190 L460 260 L640 200 L640 360 L0 360 Z" fill="#0f172a"/>
</svg>`

const generated = {
  base64: Buffer.from(svg).toString("base64"),
  uint8Array: new Uint8Array(Buffer.from(svg)),
  mediaType: "image/svg+xml",
}

export default function ImagePreview() {
  return (
    <>
      <Demo
        description="A base64 payload and its media type from the AI SDK, rendered as a data URL at the width of its container."
        title="Generated image"
      >
        <Image {...generated} alt="A stylized sunset over mountains" />
      </Demo>
      <Demo
        description="The same image with a width class; the height follows."
        title="Constrained width"
      >
        <Image
          {...generated}
          alt="The same image constrained to 240px wide"
          className="w-60"
        />
      </Demo>
    </>
  )
}
