import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorMessage } from '../../api/api-error'
import { ErrorState } from '../../components/AsyncState'
import { PageLoader } from '../../components/PageLoader'
import { Rating } from '../../entities/product/Rating'
import { StockBadge } from '../../entities/product/StockBadge'
import type { PublicProduct } from '../../entities/product/product.types'
import { formatMoney } from '../../lib/format'
import { catalogApi } from './catalog.api'
import { ReviewsPanel } from './ReviewsPanel'

export function ProductDetailPage() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<PublicProduct | null>(null)
  const [failure, setFailure] = useState<{ productId: string; message: string } | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void catalogApi.product(productId, controller.signal).then((response) => {
      setProduct(response)
      setFailure(null)
    }).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setFailure({ productId, message: errorMessage(requestError) })
    })
    return () => controller.abort()
  }, [productId, reload])

  if (failure?.productId === productId) return <main className="detail-page"><ErrorState message={failure.message} onRetry={() => setReload((value) => value + 1)} /></main>
  if (!product || product.id !== productId) return <PageLoader label="Loading product" />
  return <main className="detail-page"><Link className="back-link" to="/products">← Back to catalog</Link>
    <section className="product-detail"><div className="detail-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.title} /> : <span>{product.title.slice(0, 1)}</span>}</div>
      <div className="detail-copy"><span className="eyebrow">{product.category.name} · {product.type === 'AUCTION' ? 'Auction' : 'Fixed price'}</span><h1>{product.title}</h1>
        <div className="detail-byline"><span>Sold by <strong>{product.seller.displayName}</strong></span><Rating average={product.ratingAverage} count={product.ratingCount} /></div>
        <p className="detail-description">{product.description}</p><div className="detail-price"><strong>{formatMoney(product.price)}</strong><StockBadge stock={product.stock} /></div>
        {product.type === 'AUCTION' && product.auction ? <Link className="button button-primary" to={`/auctions/${product.auction.id}`}>View live auction</Link> : product.stock <= 0 ? <span className="availability-note">This Product is not currently purchasable.</span> : <span className="availability-note">Available for purchase. Cart support is coming next.</span>}
      </div></section><ReviewsPanel productId={product.id} />
  </main>
}
