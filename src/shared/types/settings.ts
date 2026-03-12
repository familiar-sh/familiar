export interface Snippet {
  /** Button label */
  title: string
  /** Command to send to the terminal */
  command: string
  /** Whether to press Enter after sending the command */
  pressEnter: boolean
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
  snippets: DEFAULT_SNIPPETS
}
