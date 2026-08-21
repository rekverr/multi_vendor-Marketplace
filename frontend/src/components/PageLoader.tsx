export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <main className="page-loader" aria-live="polite" aria-busy="true">
      <span className="loader-mark" aria-hidden="true" />
      <p>{label}</p>
    </main>
  )
}
