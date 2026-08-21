import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorMessage } from '../../api/api-error'
import { ErrorState } from '../../components/AsyncState'
import { PageLoader } from '../../components/PageLoader'
import type { PublicAuction } from '../../entities/product/product.types'
import { StockBadge } from '../../entities/product/StockBadge'
import { ReviewsPanel } from '../catalog/ReviewsPanel'
import { formatDate, formatMoney } from '../../lib/format'
import { auctionsApi } from './auctions.api'

export function AuctionDetailPage() {
  const { auctionId = '' } = useParams()
  const [auction, setAuction] = useState<PublicAuction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void auctionsApi.detail(auctionId, controller.signal).then(setAuction).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(requestError))
    })
    return () => controller.abort()
  }, [auctionId, reload])

  if (error) return <main className="detail-page"><ErrorState message={error} onRetry={() => { setError(null); setReload((value) => value + 1) }} /></main>
  if (!auction) return <PageLoader label="Loading auction" />
  const displayPrice = auction.currentHighestBid?.amount ?? auction.startingPrice

  return <main className="detail-page auction-page"><Link className="back-link" to={`/products/${auction.product.id}`}>← Product details</Link>
    <section className="auction-hero"><div className="auction-image">{auction.product.imageUrl ? <img src={auction.product.imageUrl} alt={auction.product.title} /> : <span>{auction.product.title.slice(0, 1)}</span>}<span className="auction-status">{auction.status}</span></div>
      <div className="auction-copy"><span className="eyebrow">Live marketplace auction</span><h1>{auction.product.title}</h1><p>{auction.product.description}</p>
        <div className="auction-price"><span>{auction.currentHighestBid ? 'Current highest bid' : 'Starting price'}</span><strong>{formatMoney(displayPrice)}</strong><small>{auction.bidCount} accepted {auction.bidCount === 1 ? 'bid' : 'bids'}</small></div>
        <Countdown startsAt={auction.startsAt} endsAt={auction.endsAt} status={auction.status} />
        <div className="auction-facts"><span>Minimum increment <strong>{formatMoney(auction.minimumIncrement)}</strong></span><span>Seller <strong>{auction.product.seller.displayName}</strong></span><StockBadge stock={auction.product.stock} /></div>
        <p className="authority-note">Displayed timing is informational. The backend decides whether an auction is active and whether a bid is valid.</p>
      </div></section>
    <section className="bid-history"><header><div><span className="eyebrow">Accepted bids</span><h2>Bid history</h2></div><span>Showing {auction.bids.length} of {auction.bidCount}</span></header>
      {auction.bids.length === 0 ? <p className="review-empty">No accepted bids yet.</p> : <ol>{auction.bids.map((bid, index) => <li key={bid.id}><span>#{auction.bidCount - index}</span><strong>{formatMoney(bid.amount)}</strong><time dateTime={bid.createdAt}>{formatDate(bid.createdAt)}</time></li>)}</ol>}
    </section>
    <ReviewsPanel productId={auction.product.id} />
  </main>
}

function Countdown({ startsAt, endsAt, status }: { startsAt: string; endsAt: string; status: PublicAuction['status'] }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [])
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (now === 0) return <div className="countdown"><span>Synchronizing countdown</span></div>
  const waiting = now < start
  const remaining = Math.max(0, (waiting ? start : end) - now)
  const seconds = Math.floor(remaining / 1000)
  const parts = [Math.floor(seconds / 86400), Math.floor((seconds % 86400) / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
  const terminal = status === 'SOLD' || status === 'UNSOLD' || status === 'ENDED' || now >= end
  return <div className={`countdown ${terminal ? 'countdown-ended' : ''}`}><span>{terminal ? 'Auction closed' : waiting ? 'Starts in' : 'Time remaining'}</span>
    {terminal ? <strong>{status}</strong> : <div>{parts.map((part, index) => <span key={['days','hours','minutes','seconds'][index]}><strong>{String(part).padStart(2, '0')}</strong><small>{['days','hours','min','sec'][index]}</small></span>)}</div>}
    <time dateTime={waiting ? startsAt : endsAt}>{waiting ? `Starts ${formatDate(startsAt)}` : `Ends ${formatDate(endsAt)}`}</time>
  </div>
}
