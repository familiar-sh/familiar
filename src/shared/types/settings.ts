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

export type CodingAgent = 'claude-code' | 'other'

export const CODING_AGENT_LABELS: Record<CodingAgent, string> = {
  'claude-code': 'Claude Code',
  other: 'Other'
}

export interface ProjectSettings {
  /** Command to run in the tmux session when a task terminal is first created */
  defaultCommand?: string
  /** Configurable terminal snippets shown as buttons above the terminal */
  snippets?: Snippet[]
  /** When true, agents should simplify verbose task titles to a few words and move the original prompt to the task document */
  simplifyTaskTitles?: boolean
  /** Project label definitions (name, color, description) */
  labels?: import('./board').LabelConfig[]
  /** Selected coding agent harness (set during onboarding) */
  codingAgent?: CodingAgent
  /** Whether to skip the doctor check during onboarding */
  skipDoctor?: boolean
}

export const DEFAULT_SNIPPETS: Snippet[] = [
  { title: 'Start', command: '/familiar', pressEnter: true }
]

export const DEFAULT_SETTINGS: ProjectSettings = {
  defaultCommand:
    'claude --dangerously-skip-permissions --resume $FAMILIAR_TASK_ID',
  snippets: DEFAULT_SNIPPETS,
  labels: undefined // Populated from DEFAULT_LABELS on first load
}
