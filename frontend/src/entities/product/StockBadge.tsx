export function StockBadge({ stock }: { stock: number }) {
  const available = stock > 0
  return <span className={`stock-badge ${available ? 'in-stock' : 'out-of-stock'}`}>{available ? `${stock} available` : 'Unavailable'}</span>
}
