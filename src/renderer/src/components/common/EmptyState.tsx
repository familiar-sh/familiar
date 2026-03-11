export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div style={emptyStyles.container}>
      {icon && <div style={emptyStyles.icon}>{icon}</div>}
      <h3 style={emptyStyles.title}>{title}</h3>
      {description && <p style={emptyStyles.description}>{description}</p>}
      {action && (
        <button style={emptyStyles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

const emptyStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: 12
  },
  icon: {
    fontSize: 32,
    color: '#5c5c6e',
    marginBottom: 4
  },
  title: {
    fontSize: 14,
    fontWeight: 500,
    color: '#f0f0f4',
    margin: 0,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  description: {
    fontSize: 13,
    color: '#8e8ea0',
    margin: 0,
    maxWidth: 280,
    lineHeight: 1.5
  },
  action: {
    marginTop: 8,
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: '#f0f0f4',
    backgroundColor: '#5e6ad2',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    transition: 'background-color 100ms ease'
  }
}
