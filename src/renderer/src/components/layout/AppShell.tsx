import { Header } from './Header'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  return (
    <div className="app">
      <Header />
      <main className="app-main">{children}</main>
    </div>
  )
}
