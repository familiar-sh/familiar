interface LoadingSpinnerProps {
  size?: number
  color?: string
  label?: string
}

export function LoadingSpinner({
  size = 24,
  color = 'var(--accent, #5e6ad2)',
  label
}: LoadingSpinnerProps): JSX.Element {
  return (
    <div style={spinnerStyles.container}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'spin 1s linear infinite' }}
        role="status"
        aria-label={label ?? 'Loading'}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="45 90"
          opacity="0.9"
        />
      </svg>
      {label && <span style={spinnerStyles.label}>{label}</span>}
    </div>
  )
}

const spinnerStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24
  },
  label: {
    fontSize: 13,
    color: '#8e8ea0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  }
}
