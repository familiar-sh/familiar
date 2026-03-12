import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
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
  const [searchInput, setSearchInput] = useState(filters.search)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const priorityDropdownRef = useRef<HTMLDivElement>(null)
  const agentDropdownRef = useRef<HTMLDivElement>(null)

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

  return (
    <header className={styles.header}>
      <div className={styles.searchArea}>
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
              setShowPriorityDropdown(!showPriorityDropdown)
              setShowAgentDropdown(false)
            }}
            data-testid="priority-filter-button"
          >
            Priority
            {filters.priority.length > 0 && (
              <span className={styles.filterBadge}>{filters.priority.length}</span>
            )}
          </button>

          {showPriorityDropdown && (
            <div className={styles.dropdown} data-testid="priority-dropdown">
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

        {/* Agent status filter dropdown */}
        <div className={styles.dropdownContainer} ref={agentDropdownRef}>
          <button
            className={`${styles.filterButton} ${filters.agentStatus.length > 0 ? styles.filterButtonActive : ''}`}
            onClick={() => {
              setShowAgentDropdown(!showAgentDropdown)
              setShowPriorityDropdown(false)
            }}
            data-testid="agent-filter-button"
          >
            Agent
            {filters.agentStatus.length > 0 && (
              <span className={styles.filterBadge}>{filters.agentStatus.length}</span>
            )}
          </button>

          {showAgentDropdown && (
            <div className={styles.dropdown} data-testid="agent-dropdown">
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
    </header>
  )
}
