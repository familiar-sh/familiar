import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useDropdownPosition } from '@renderer/hooks/useDropdownPosition'
import { useProjectLabels } from '@renderer/hooks/useProjectLabels'
import type { Priority, AgentStatus } from '@shared/types'
import styles from './Header.module.css'

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'None' }
]

const AGENT_STATUS_OPTIONS: { value: AgentStatus; label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' }
]

export function Header(): React.JSX.Element {
  const { filters, setFilter, clearFilters } = useUIStore()
  const projectLabels = useProjectLabels()
  const [searchInput, setSearchInput] = useState(filters.search)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [showLabelDropdown, setShowLabelDropdown] = useState(false)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.api.getVersion().then(setAppVersion).catch(() => {})
  }, [])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const priorityDropdownRef = useRef<HTMLDivElement>(null)
  const agentDropdownRef = useRef<HTMLDivElement>(null)
  const labelDropdownRef = useRef<HTMLDivElement>(null)
  const priorityMenuRef = useRef<HTMLDivElement>(null)
  const agentMenuRef = useRef<HTMLDivElement>(null)
  const labelMenuRef = useRef<HTMLDivElement>(null)
  useDropdownPosition(priorityMenuRef, showPriorityDropdown)
  useDropdownPosition(agentMenuRef, showAgentDropdown)
  useDropdownPosition(labelMenuRef, showLabelDropdown)

  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.priority.length > 0 ||
    filters.labels.length > 0 ||
    filters.agentStatus.length > 0

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        setFilter('search', value)
      }, 200)
    },
    [setFilter]
  )

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Sync search input when filters are cleared externally
  useEffect(() => {
    if (filters.search === '' && searchInput !== '') {
      setSearchInput('')
    }
  }, [filters.search])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPriorityDropdown(false)
      }
      if (
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(e.target as Node)
      ) {
        setShowAgentDropdown(false)
      }
      if (
        labelDropdownRef.current &&
        !labelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowLabelDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const togglePriority = useCallback(
    (priority: Priority) => {
      const current = filters.priority
      if (current.includes(priority)) {
        setFilter(
          'priority',
          current.filter((p) => p !== priority)
        )
      } else {
        setFilter('priority', [...current, priority])
      }
    },
    [filters.priority, setFilter]
  )

  const toggleAgentStatus = useCallback(
    (status: AgentStatus) => {
      const current = filters.agentStatus
      if (current.includes(status)) {
        setFilter(
          'agentStatus',
          current.filter((s) => s !== status)
        )
      } else {
        setFilter('agentStatus', [...current, status])
      }
    },
    [filters.agentStatus, setFilter]
  )

  const toggleLabel = useCallback(
    (label: string) => {
      const current = filters.labels
      if (current.includes(label)) {
        setFilter(
          'labels',
          current.filter((l) => l !== label)
        )
      } else {
        setFilter('labels', [...current, label])
      }
    },
    [filters.labels, setFilter]
  )

  return (
    <header className={styles.header}>
      <div className={styles.searchArea}>
        <svg
          className={styles.searchIcon}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search tasks..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          data-testid="search-input"
        />
      </div>

      <div className={styles.filterGroup}>
        {/* Priority filter dropdown */}
        <div className={styles.dropdownContainer} ref={priorityDropdownRef}>
          <button
            className={`${styles.filterButton} ${filters.priority.length > 0 ? styles.filterButtonActive : ''}`}
            onClick={() => {
              const wasOpen = showPriorityDropdown
              setShowPriorityDropdown(false)
              setShowAgentDropdown(false)
              setShowLabelDropdown(false)
              setShowPriorityDropdown(!wasOpen)
            }}
            data-testid="priority-filter-button"
          >
            Priority
            {filters.priority.length > 0 && (
              <span className={styles.filterBadge}>{filters.priority.length}</span>
            )}
          </button>

          {showPriorityDropdown && (
            <div ref={priorityMenuRef} className={styles.dropdown} data-testid="priority-dropdown">
              {PRIORITY_OPTIONS.map((opt) => (
                <label key={opt.value} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={filters.priority.includes(opt.value)}
                    onChange={() => togglePriority(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Label filter dropdown */}
        <div className={styles.dropdownContainer} ref={labelDropdownRef}>
          <button
            className={`${styles.filterButton} ${filters.labels.length > 0 ? styles.filterButtonActive : ''}`}
            onClick={() => {
              const wasOpen = showLabelDropdown
              setShowPriorityDropdown(false)
              setShowAgentDropdown(false)
              setShowLabelDropdown(false)
              setShowLabelDropdown(!wasOpen)
            }}
            data-testid="label-filter-button"
          >
            Label
            {filters.labels.length > 0 && (
              <span className={styles.filterBadge}>{filters.labels.length}</span>
            )}
          </button>

          {showLabelDropdown && (
            <div ref={labelMenuRef} className={styles.dropdown} data-testid="label-dropdown">
              {projectLabels.map((label) => (
                <label key={label.name} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={filters.labels.includes(label.name)}
                    onChange={() => toggleLabel(label.name)}
                  />
                  <span
                    className={styles.labelDot}
                    style={{ backgroundColor: label.color }}
                  />
                  <span>{label.name}</span>
                </label>
              ))}
              {projectLabels.length === 0 && (
                <div className={styles.dropdownEmpty}>No labels configured</div>
              )}
            </div>
          )}
        </div>

        {/* Agent status filter dropdown */}
        <div className={styles.dropdownContainer} ref={agentDropdownRef}>
          <button
            className={`${styles.filterButton} ${filters.agentStatus.length > 0 ? styles.filterButtonActive : ''}`}
            onClick={() => {
              const wasOpen = showAgentDropdown
              setShowPriorityDropdown(false)
              setShowAgentDropdown(false)
              setShowLabelDropdown(false)
              setShowAgentDropdown(!wasOpen)
            }}
            data-testid="agent-filter-button"
          >
            Agent Status
            {filters.agentStatus.length > 0 && (
              <span className={styles.filterBadge}>{filters.agentStatus.length}</span>
            )}
          </button>

          {showAgentDropdown && (
            <div ref={agentMenuRef} className={styles.dropdown} data-testid="agent-dropdown">
              {AGENT_STATUS_OPTIONS.map((opt) => (
                <label key={opt.value} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={filters.agentStatus.includes(opt.value)}
                    onChange={() => toggleAgentStatus(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            className={styles.clearFilters}
            onClick={clearFilters}
            data-testid="clear-filters-button"
          >
            Clear filters
          </button>
        )}
      </div>

      <button
        className={styles.aboutButton}
        onClick={() => setShowAboutDialog(true)}
        title="About Familiar"
        data-testid="about-button"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {showAboutDialog && (
        <div
          className={styles.aboutOverlay}
          onClick={() => setShowAboutDialog(false)}
          data-testid="about-overlay"
        >
          <div
            className={styles.aboutDialog}
            onClick={(e) => e.stopPropagation()}
            data-testid="about-dialog"
          >
            <div className={styles.aboutHeader}>
              <h2 className={styles.aboutTitle}>Familiar</h2>
              <button
                className={styles.aboutClose}
                onClick={() => setShowAboutDialog(false)}
                aria-label="Close"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className={styles.aboutVersion}>Version {appVersion || '...'}</p>
            <p className={styles.aboutDescription}>
              A kanban board with embedded terminals for agentic AI coding workflows.
            </p>
            <p className={styles.aboutCopyright}>
              &copy; {new Date().getFullYear()} Familiar
            </p>
          </div>
        </div>
      )}
    </header>
  )
}
