import type { Metadata } from "next"
import { ItemCard } from "@/app/_components/item-card"
import { loadRegistry, previewGroups } from "@/lib/registry"
import { previewHref } from "@/lib/site"

export const metadata: Metadata = {
  title: "Components",
  description:
    "Every component uifiles ships, rendered in each of its states, in light and dark.",
}

export default function PreviewIndex() {
  const groups = previewGroups(loadRegistry().items)
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Components
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          Every component uifiles ships, rendered in each of its states, in
          light and dark. Open one to try it, copy its install command and see
          what it installs with.
        </p>
      </div>
      {groups.map((group) => (
        <section
          aria-labelledby={`${group.id}-heading`}
          className="flex scroll-mt-20 flex-col gap-4"
          id={group.id}
          key={group.id}
        >
          <div className="flex flex-col gap-1">
            <h2
              className="font-heading text-lg font-semibold tracking-tight"
              id={`${group.id}-heading`}
            >
              {group.label}{" "}
              <span className="ml-1 font-mono text-sm font-normal text-muted-foreground tabular-nums">
                {group.items.length}
              </span>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              {group.description}
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {group.items.map((item) => (
              <li key={item.name}>
                <ItemCard
                  description={item.description}
                  href={previewHref(item.name)}
                  name={item.name}
                  title={item.title ?? item.name}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
