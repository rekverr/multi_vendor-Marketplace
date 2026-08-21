export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    const start = Math.min(Math.max(1, page - 2), Math.max(1, totalPages - 4))
    return start + index
  })
  return <nav className="pagination" aria-label="Catalog pages"><button disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>{pages.map((number) => <button className={number === page ? 'current' : ''} aria-current={number === page ? 'page' : undefined} key={number} onClick={() => onPage(number)}>{number}</button>)}<button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button></nav>
}
