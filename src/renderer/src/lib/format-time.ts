/**
 * Format an ISO 8601 timestamp as a human-readable relative time string.
 *
 * Examples: "just now", "2m ago", "3h ago", "yesterday", "5d ago", "Mar 3"
 */
export function formatRelativeTime(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()

  // Future dates or less than a minute ago
  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`

  // Older than a week — show short date
  const month = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()
  const yearNow = now.getFullYear()
  const yearDate = date.getFullYear()

  if (yearDate === yearNow) {
    return `${month} ${day}`
  }
  return `${month} ${day}, ${yearDate}`
}

/**
 * Format an ISO 8601 timestamp as a compact duration string.
 *
 * Examples: "1m", "45m", "2h", "1d 14h", "3d"
 */
export function formatDuration(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 0) return '0m'

  const totalMinutes = Math.floor(diffMs / 60000)
  if (totalMinutes < 1) return '<1m'
  if (totalMinutes < 60) return `${totalMinutes}m`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h`

  const days = Math.floor(totalHours / 24)
  const remainingHours = totalHours % 24
  if (remainingHours === 0) return `${days}d`
  return `${days}d ${remainingHours}h`
}
