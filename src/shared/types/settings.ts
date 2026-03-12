export interface Snippet {
  /** Button label */
  title: string
  /** Command to send to the terminal */
  command: string
  /** Whether to press Enter after sending the command */
  pressEnter: boolean
  /** Lucide icon name (e.g., "play", "rocket"). undefined = no icon */
  icon?: string
  /** Show this snippet as a button on TaskCards in the board. Default: false */
  showInDashboard?: boolean
  /** When shown in dashboard, display only the icon (no text label). Default: false */
  showIconInDashboard?: boolean
  /** When shown in terminal bar, display only the icon (no text label). Default: false */
  showIconInTerminal?: boolean
}

export interface ProjectSettings {
  /** Command to run in the tmux session when a task terminal is first created */
  defaultCommand?: string
  /** Configurable terminal snippets shown as buttons above the terminal */
  snippets?: Snippet[]
}

export const DEFAULT_SNIPPETS: Snippet[] = [
  { title: 'Start', command: '/kanban-agent', pressEnter: true }
]

export const DEFAULT_SETTINGS: ProjectSettings = {
  defaultCommand: 'claude --dangerously-skip-permissions',
  snippets: DEFAULT_SNIPPETS
}
