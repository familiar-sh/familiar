export async function notifyApp(event: string, data?: unknown): Promise<void> {
  // TODO: Implement IPC to running Electron app
  // Could use Unix domain socket, HTTP, or similar
}

export async function isAppRunning(): Promise<boolean> {
  return false
}
