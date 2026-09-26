import { Image } from "@/registry/ai/image"

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
      <h1 className="font-heading text-xl font-semibold">Image</h1>
      <p className="text-sm text-muted-foreground">
        Renders a generated image (base64 + media type) as a data URL.
      </p>
      <Image {...generated} alt="A stylised sunset over mountains" />
      <Image
        {...generated}
        alt="The same image constrained to 240px wide"
        className="w-60"
      />
    </>
  )
}
