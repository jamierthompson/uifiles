import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Previews",
  description:
    "One rendered page per uifiles registry item, in light and dark.",
}

export default function PreviewIndex() {
  const dir = join(process.cwd(), "app/preview")
  const names = readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory())
    .sort()
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Previews</h1>
      <ul className="flex flex-col text-sm">
        {names.map((n) => (
          <li key={n}>
            <Link
              className="inline-block py-1 underline"
              href={`/preview/${n}`}
            >
              {n}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
