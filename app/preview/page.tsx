import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import Link from "next/link"

export default function PreviewIndex() {
  const dir = join(process.cwd(), "app/preview")
  const names = readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory())
    .sort()
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Previews</h1>
      <ul className="flex flex-col gap-1 text-sm">
        {names.map((n) => (
          <li key={n}>
            <Link className="underline" href={`/preview/${n}`}>
              {n}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
