import { Link } from 'react-router-dom'
import { formatMoney } from '../../lib/format'
import type { PublicProduct } from './product.types'
import { Rating } from './Rating'
import { StockBadge } from './StockBadge'

export function ProductCard({ product }: { product: PublicProduct }) {
  return (
    <article className="product-card">
      <Link className="product-image" to={`/products/${product.id}`} aria-label={`View ${product.title}`}>
        {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{product.title.slice(0, 1)}</span>}
        <span className="product-type">{product.type === 'AUCTION' ? 'Auction' : 'Fixed price'}</span>
      </Link>
      <div className="product-card-body">
        <div className="product-meta"><span>{product.category.name}</span><Rating average={product.ratingAverage} count={product.ratingCount} /></div>
        <h2><Link to={`/products/${product.id}`}>{product.title}</Link></h2>
        <p className="seller-name">by {product.seller.displayName}</p>
        <div className="product-card-footer">
          <strong>{product.type === 'AUCTION' ? 'View bidding' : formatMoney(product.price)}</strong>
          <StockBadge stock={product.stock} />
        </div>
      </div>
    </article>
  )
}
