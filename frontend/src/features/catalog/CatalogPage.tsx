import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage } from '../../api/api-error'
import { CardSkeletons, EmptyState, ErrorState } from '../../components/AsyncState'
import { ProductCard } from '../../entities/product/ProductCard'
import type { NamedReference, ProductListResponse } from '../../entities/product/product.types'
import { catalogApi, type CatalogQuery, type CatalogSort } from './catalog.api'
import { CatalogFilters, type CatalogFilterValues } from './CatalogFilters'
import { Pagination } from './Pagination'

const PAGE_SIZE = 12

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState<ProductListResponse | null>(null)
  const [categories, setCategories] = useState<NamedReference[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadedRequest, setLoadedRequest] = useState('')
  const [reload, setReload] = useState(0)
  const queryKey = params.toString()
  const query = readQuery(params)
  const requestKey = `${queryKey}:${reload}`
  const loading = loadedRequest !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    void catalogApi.categories(controller.signal).then(setCategories).catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void catalogApi.list(readQuery(new URLSearchParams(queryKey)), controller.signal)
      .then((response) => {
        setResult(response)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedRequest(requestKey)
      })
    return () => controller.abort()
  }, [queryKey, reload, requestKey])

  function updateParams(values: CatalogFilterValues | { sort: string }): void {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    next.delete('page')
    setParams(next)
  }

  const filters = readFilters(params)
  return (
    <main className="catalog-page">
      <header className="catalog-heading"><div><span className="eyebrow">Public catalog</span><h1>Find the uncommon.</h1></div>
        <p>Search and filters query the marketplace projection. Product detail remains backed by PostgreSQL.</p></header>
      <CatalogFilters key={queryKey} values={filters} categories={categories}
        onApply={(values) => updateParams(values)} onClear={() => setParams({})} />
      <div className="catalog-toolbar">
        <span>{result ? `${result.pagination.total} products` : 'Searching products'}</span>
        <label>Sort<select value={query.sort ?? 'newest'} onChange={(event) => updateParams({ sort: event.target.value })}>
          <option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
        </select></label>
      </div>
      {result && Object.keys(result.facets.type ?? {}).length > 0 && <div className="facet-strip" aria-label="Product type summary">{Object.entries(result.facets.type).map(([name, count]) => <span key={name}>{name.replace('_', ' ')} <strong>{count}</strong></span>)}</div>}
      {loading ? <CardSkeletons /> : error ? <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} /> : result?.items.length ? <>
        <div className="product-grid">{result.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        <Pagination page={result.pagination.page} totalPages={result.pagination.totalPages} onPage={(page) => { const next = new URLSearchParams(params); next.set('page', String(page)); setParams(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      </> : <EmptyState title="No products match this view">Try broadening the search or clearing one of the filters.</EmptyState>}
    </main>
  )
}

function readQuery(params: URLSearchParams): CatalogQuery {
  const available = params.get('available')
  return {
    q: params.get('q') || undefined,
    page: positiveInteger(params.get('page')),
    pageSize: PAGE_SIZE,
    categoryId: params.get('categoryId') || undefined,
    sellerId: params.get('sellerId') || undefined,
    minPrice: params.get('minPrice') || undefined,
    maxPrice: params.get('maxPrice') || undefined,
    available: available === 'true' ? true : available === 'false' ? false : undefined,
    sort: validSort(params.get('sort')),
  }
}

function readFilters(params: URLSearchParams): CatalogFilterValues {
  return { q: params.get('q') ?? '', categoryId: params.get('categoryId') ?? '', sellerId: params.get('sellerId') ?? '', minPrice: params.get('minPrice') ?? '', maxPrice: params.get('maxPrice') ?? '', available: params.get('available') ?? '' }
}

function positiveInteger(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function validSort(value: string | null): CatalogSort {
  return value === 'price_asc' || value === 'price_desc' ? value : 'newest'
}
