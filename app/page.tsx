import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { InstallCommand } from "@/app/_components/install-command"
import { ItemCard } from "@/app/_components/item-card"
import { SiteFooter } from "@/app/_components/site-footer"
import { SiteHeader } from "@/app/_components/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  baseUrl,
  CATALOG_GROUPS,
  isUpstreamAlias,
  loadRegistry,
  previewGroups,
  primitiveGroups,
} from "@/lib/registry"
import {
  GITHUB_URL,
  initCommand,
  installCommand,
  previewHref,
  registryJsonHref,
  shadcnDocsHref,
} from "@/lib/site"

const STACK = ["Base UI", "shadcn 4", "Tailwind v4", "React 19", "Next 16"]

function SectionHeading({
  id,
  label,
  count,
  description,
}: {
  id: string
  label: string
  count?: number | undefined
  description: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2
        className="font-heading text-xl font-semibold tracking-tight"
        id={`${id}-heading`}
      >
        {label}
        {count === undefined ? null : (
          <span className="ml-2 font-mono text-sm font-normal text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export default function Page() {
  const { items } = loadRegistry()
  const origin = baseUrl()
  const groups = previewGroups(items)
  const primitives = primitiveGroups(items)
  const base = items.find((item) => item.type === "registry:base")
  const aliasCount = items.filter(isUpstreamAlias).length
  const sections = [
    ...groups.map((group) => ({
      id: group.id,
      label: group.label,
      count: group.items.length,
    })),
    { id: "primitives", label: "Primitives", count: aliasCount },
  ]

  return (
    <>
      <SiteHeader />
      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pt-12 pb-20 outline-none sm:px-6 sm:pt-20"
        id="main"
        tabIndex={-1}
      >
        <section className="relative isolate flex flex-col gap-6">
          {/* A dot grid that fades out under the hero; decorative only. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-20 -z-10 h-96 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_0%,black,transparent)] bg-[size:16px_16px]"
          />
          <ul className="flex flex-wrap gap-1.5">
            {STACK.map((name) => (
              <li key={name}>
                <Badge variant="secondary">{name}</Badge>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-4">
            <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
              uifiles
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A shadcn/ui registry on Base UI. Every shadcn primitive under one
              namespace, AI chat and agent components ported from Vercel AI
              Elements, and the tokens that tie them together. Components are
              files copied into your project, not a dependency.
            </p>
          </div>
          <div className="flex max-w-2xl flex-col gap-2">
            <InstallCommand
              command={initCommand(origin)}
              label="Copy the init command"
            />
            <InstallCommand
              command={installCommand("button")}
              label="Copy the add command"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants()} href="/preview">
              Browse components
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
            <a
              className={buttonVariants({ variant: "outline" })}
              href={GITHUB_URL}
            >
              GitHub
            </a>
          </div>
        </section>

        <nav aria-label="Catalog">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {sections.map((section) => (
              <li className="flex" key={section.id}>
                <a
                  className="flex flex-1 flex-col gap-1 bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                  href={`#${section.id}`}
                >
                  <span className="font-heading text-2xl font-semibold tabular-nums">
                    {section.count}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {section.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {groups.map((group) => (
          <section
            aria-labelledby={`${group.id}-heading`}
            className="flex scroll-mt-20 flex-col gap-6"
            id={group.id}
            key={group.id}
          >
            <SectionHeading
              count={group.items.length}
              description={group.description}
              id={group.id}
              label={group.label}
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <section
          aria-labelledby="primitives-heading"
          className="flex scroll-mt-20 flex-col gap-8"
          id="primitives"
        >
          <SectionHeading
            count={aliasCount}
            description={`${CATALOG_GROUPS.primitives.description} Each links to its shadcn/ui documentation.`}
            id="primitives"
            label={CATALOG_GROUPS.primitives.label}
          />
          {primitives.map((group) => (
            <div className="flex flex-col gap-3" key={group.label}>
              <h3 className="text-sm font-medium">
                {group.label}
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground tabular-nums">
                  {group.items.length}
                </span>
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <li key={item.name}>
                    <ItemCard
                      description={item.description}
                      external
                      href={shadcnDocsHref(item.name)}
                      lines={2}
                      name={item.name}
                      title={item.title ?? item.name}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {base ? (
          <section
            aria-labelledby="base-heading"
            className="flex scroll-mt-20 flex-col gap-6"
            id="base"
          >
            <SectionHeading
              description={CATALOG_GROUPS.base.description}
              id="base"
              label={CATALOG_GROUPS.base.label}
            />
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6">
              <div className="flex flex-col gap-1">
                <span className="leading-6 font-medium">
                  {base.title ?? base.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  @uifiles/{base.name}
                </span>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {base.description}
              </p>
              <InstallCommand
                command={initCommand(origin)}
                label="Copy the init command for the design system"
              />
              <a
                className="inline-flex w-fit items-center py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                href={registryJsonHref(base.name)}
              >
                Registry JSON
              </a>
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  )
}
