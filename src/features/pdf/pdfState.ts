export function normalizePage(page: number, totalPages: number) {
  return Math.max(1, Math.min(totalPages, Math.round(page)))
}
