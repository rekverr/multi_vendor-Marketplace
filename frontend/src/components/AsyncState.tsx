import type { ReactNode } from 'react'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="async-state error-state" role="alert">
      <span className="eyebrow">Unable to load</span>
      <h2>The marketplace did not respond.</h2>
      <p>{message}</p>
      {onRetry && <button className="button button-secondary" onClick={onRetry}>Try again</button>}
    </section>
  )
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <section className="async-state"><span className="empty-mark">0</span><h2>{title}</h2><p>{children}</p></section>
}

export function CardSkeletons() {
  return <div className="product-grid" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index} />)}</div>
}
