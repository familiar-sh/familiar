import type { AgentStatus, TaskStatus } from '@shared/types'

export interface AgentStatusBadgeProps {
  status: AgentStatus
  taskStatus?: TaskStatus
  showLabel?: boolean
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { color: string; label: string; glow?: boolean; pulse?: boolean }
> = {
  idle: { color: '#5c5c6e', label: 'Idle' },
  running: { color: '#5e6ad2', label: 'Running', pulse: true },
  done: { color: '#27ae60', label: 'Done' },
  error: { color: '#e74c3c', label: 'Error', glow: true }
}

export function AgentStatusBadge({
  status,
  taskStatus,
  showLabel = false
}: AgentStatusBadgeProps): React.JSX.Element {
  // Only show running/done colors when the task status matches; otherwise gray
  let effectiveStatus = status
  if (status === 'running' && taskStatus && taskStatus !== 'in-progress') {
    effectiveStatus = 'idle'
  } else if (status === 'done' && taskStatus && taskStatus !== 'done') {
    effectiveStatus = 'idle'
  }
  const config = STATUS_CONFIG[effectiveStatus]

  return (
    <span
      style={badgeStyles.container}
      aria-label={`Agent: ${config.label}`}
      data-testid={`agent-status-${status}`}
    >
      <span
        style={{
          ...badgeStyles.dot,
          backgroundColor: config.color,
          ...(config.pulse
            ? { animation: 'agentPulse 2s ease-in-out infinite' }
            : {}),
          ...(config.glow
            ? { boxShadow: `0 0 6px 1px ${config.color}` }
            : {})
        }}
      />
      {showLabel && <span style={badgeStyles.label}>{config.label}</span>}
    </span>
  )
}

const badgeStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0
  },
  label: {
    fontSize: 11,
    color: '#8e8ea0',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  }
}

// Add keyframes for agent pulse animation
if (typeof document !== 'undefined') {
  const styleId = 'agent-status-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes agentPulse {
        0%, 100% {
          opacity: 1;
          box-shadow: 0 0 0 0 rgba(94, 106, 210, 0.4);
        }
        50% {
          opacity: 0.7;
          box-shadow: 0 0 0 4px rgba(94, 106, 210, 0);
        }
      }
    `
    document.head.appendChild(style)
  }
}
