import { PreviewShell } from "@/app/_components/preview-shell"
import { SiteFooter } from "@/app/_components/site-footer"
import { SiteHeader } from "@/app/_components/site-header"
import { loadRegistry, previewGroups } from "@/lib/registry"
import { type PreviewGroup, previewEntry } from "@/lib/site"

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read at build time (every preview is prerendered) and handed to the
  // client shell, which picks the current item from the route segment.
  const groups: PreviewGroup[] = previewGroups(loadRegistry().items).map(
    (group) => ({
      id: group.id,
      label: group.label,
      description: group.description,
      items: group.items.map(previewEntry),
    })
  )
  return (
    <>
      <SiteHeader active="components" />
      <PreviewShell groups={groups}>{children}</PreviewShell>
      <SiteFooter />
    </>
  )
}
