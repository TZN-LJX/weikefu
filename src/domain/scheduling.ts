const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const

export function nextReviewDate(base: Date, successfulReviews: number) {
  const interval = REVIEW_INTERVALS[Math.min(successfulReviews, REVIEW_INTERVALS.length - 1)]
  const result = new Date(base)
  result.setUTCDate(result.getUTCDate() + interval)
  return result
}
