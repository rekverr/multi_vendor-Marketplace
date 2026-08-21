import { useState, type FormEvent } from 'react'
import type { NamedReference } from '../../entities/product/product.types'

export interface CatalogFilterValues {
  q: string
  categoryId: string
  sellerId: string
  minPrice: string
  maxPrice: string
  available: string
}

export function CatalogFilters({ values, categories, onApply, onClear }: {
  values: CatalogFilterValues
  categories: NamedReference[]
  onApply: (values: CatalogFilterValues) => void
  onClear: () => void
}) {
  const [draft, setDraft] = useState(values)

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onApply(draft)
  }

  function update(field: keyof CatalogFilterValues, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <form className="catalog-filters" onSubmit={submit}>
      <div className="search-field"><label htmlFor="catalog-search">Search marketplace</label>
        <div><input id="catalog-search" type="search" value={draft.q} placeholder="What are you looking for?" onChange={(event) => update('q', event.target.value)} />
          <button className="button button-primary">Search</button></div>
      </div>
      <div className="filter-grid">
        <label>Category<select value={draft.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Availability<select value={draft.available} onChange={(event) => update('available', event.target.value)}><option value="">Any stock</option><option value="true">Available</option><option value="false">Unavailable</option></select></label>
        <label>Minimum price<input inputMode="decimal" value={draft.minPrice} placeholder="0.00" onChange={(event) => update('minPrice', event.target.value)} /></label>
        <label>Maximum price<input inputMode="decimal" value={draft.maxPrice} placeholder="500.00" onChange={(event) => update('maxPrice', event.target.value)} /></label>
        <label className="seller-filter">Seller ID<input value={draft.sellerId} placeholder="Seller UUID" onChange={(event) => update('sellerId', event.target.value)} /></label>
      </div>
      <div className="filter-actions"><button className="button button-secondary" type="button" onClick={() => { setDraft({ q:'', categoryId:'', sellerId:'', minPrice:'', maxPrice:'', available:'' }); onClear() }}>Clear filters</button><button className="text-button" type="submit">Apply filters</button></div>
    </form>
  )
}
