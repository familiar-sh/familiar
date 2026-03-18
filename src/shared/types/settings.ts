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

export interface WorktreeEnvVariable {
  /** Environment variable name (ALL_CAPS) */
  name: string
  /** Environment variable value */
  value: string
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
  /** @deprecated Theme settings moved to GlobalSettings in ~/.familiar/settings.json */
  themeMode?: 'system' | 'light' | 'dark'
  /** @deprecated Theme settings moved to GlobalSettings in ~/.familiar/settings.json */
  darkTheme?: string
  /** @deprecated Theme settings moved to GlobalSettings in ~/.familiar/settings.json */
  lightTheme?: string
  /** Last-used environment variables for the worktree post-create hook */
  worktreeEnvVariables?: WorktreeEnvVariable[]
  /** Code editor to use when opening project folders. 'system' uses macOS `open`, others use CLI commands */
  codeEditor?: CodeEditor
  /** Custom command for code editor when codeEditor is 'custom' */
  codeEditorCustomCommand?: string
}

export type CodeEditor = 'system' | 'vscode' | 'cursor' | 'zed' | 'sublime' | 'custom'

export const CODE_EDITOR_LABELS: Record<CodeEditor, string> = {
  system: 'System Default',
  vscode: 'Visual Studio Code',
  cursor: 'Cursor',
  zed: 'Zed',
  sublime: 'Sublime Text',
  custom: 'Custom Command'
}

export const CODE_EDITOR_COMMANDS: Record<Exclude<CodeEditor, 'system' | 'custom'>, string> = {
  vscode: 'code',
  cursor: 'cursor',
  zed: 'zed',
  sublime: 'subl'
}

export const DEFAULT_SNIPPETS: Snippet[] = [
  { title: 'Start', command: '/familiar-agent', pressEnter: true }
]

export const DEFAULT_SETTINGS: ProjectSettings = {
  defaultCommand:
    'claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions --resume $FAMILIAR_TASK_ID',
  snippets: DEFAULT_SNIPPETS,
  simplifyTaskTitles: true,
  labels: undefined // Populated from DEFAULT_LABELS on first load
}

/** Global settings stored in ~/.familiar/settings.json (shared across all projects) */
export interface GlobalSettings {
  /** Theme mode: system follows OS, or force light/dark */
  themeMode?: 'system' | 'light' | 'dark'
  /** Selected dark theme preset ID */
  darkTheme?: string
  /** Selected light theme preset ID */
  lightTheme?: string
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  themeMode: 'system',
  darkTheme: 'familiar-dark',
  lightTheme: 'familiar-light'
}
