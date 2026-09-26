export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-10">
      {children}
    </div>
  )
}
