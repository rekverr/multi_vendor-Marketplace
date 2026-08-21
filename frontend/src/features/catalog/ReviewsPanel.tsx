import { useEffect, useState } from 'react'
import { errorMessage } from '../../api/api-error'
import type { ReviewsResponse } from '../../entities/product/product.types'
import { formatDate } from '../../lib/format'
import { catalogApi } from './catalog.api'

export function ReviewsPanel({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void catalogApi.reviews(productId, 1, controller.signal).then(setReviews).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(requestError))
    })
    return () => controller.abort()
  }, [productId])

  return <section className="reviews-panel"><header><div><span className="eyebrow">Verified purchases</span><h2>Customer reviews</h2></div>{reviews && <strong>{reviews.ratingAverage} / 5 <small>{reviews.ratingCount} total</small></strong>}</header>
    {error ? <p className="inline-error">Reviews are temporarily unavailable: {error}</p> : !reviews ? <div className="review-loading">Loading reviews...</div> : reviews.items.length === 0 ? <p className="review-empty">No verified reviews yet.</p> : <div className="review-list">{reviews.items.map((review) => <article key={review.id}><div><span className="review-stars" aria-label={`${review.rating} out of 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time></div><p>{review.text}</p></article>)}</div>}
  </section>
}
