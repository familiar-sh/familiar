import { app, net } from 'electron'

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
}

interface GitHubRelease {
  tag_name: string
  html_url: string
  body: string
  published_at: string
  draft: boolean
  prerelease: boolean
}

const GITHUB_REPO = 'familiar-sh/familiar'
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

/**
 * Compare two semver strings. Returns:
 *  1 if a > b, -1 if a < b, 0 if equal
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export class UpdateService {
  private lastCheck = 0
  private cachedUpdate: UpdateInfo | null = null
  private dismissedVersion: string | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null

  async checkForUpdates(force = false): Promise<UpdateInfo | null> {
    const now = Date.now()
    if (!force && now - this.lastCheck < CHECK_INTERVAL_MS && this.cachedUpdate) {
      return this.cachedUpdate
    }

    try {
      const release = await this.fetchLatestRelease()
      if (!release) return null

      const currentVersion = app.getVersion()
      const latestVersion = release.tag_name.replace(/^v/, '')

      if (compareSemver(latestVersion, currentVersion) > 0) {
        // Don't return dismissed versions unless forced
        if (!force && this.dismissedVersion === latestVersion) {
          return null
        }

        this.cachedUpdate = {
          currentVersion,
          latestVersion,
          releaseUrl: release.html_url,
          releaseNotes: release.body || '',
          publishedAt: release.published_at
        }
        this.lastCheck = now
        return this.cachedUpdate
      }

      this.lastCheck = now
      this.cachedUpdate = null
      return null
    } catch (err) {
      console.error('Failed to check for updates:', err)
      return null
    }
  }

  dismissUpdate(version: string): void {
    this.dismissedVersion = version
    this.cachedUpdate = null
  }

  startPeriodicCheck(onUpdate: (info: UpdateInfo) => void): void {
    // Initial check after 30 seconds
    setTimeout(async () => {
      const update = await this.checkForUpdates()
      if (update) onUpdate(update)
    }, 30_000)

    // Periodic check every 4 hours
    this.intervalId = setInterval(async () => {
      const update = await this.checkForUpdates()
      if (update) onUpdate(update)
    }, CHECK_INTERVAL_MS)
  }

  stopPeriodicCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

    return new Promise((resolve) => {
      const request = net.request(url)
      request.setHeader('Accept', 'application/vnd.github.v3+json')
      request.setHeader('User-Agent', `Familiar/${app.getVersion()}`)

      let body = ''

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          resolve(null)
          return
        }
        response.on('data', (chunk) => {
          body += chunk.toString()
        })
        response.on('end', () => {
          try {
            const release = JSON.parse(body) as GitHubRelease
            if (release.draft || release.prerelease) {
              resolve(null)
              return
            }
            resolve(release)
          } catch {
            resolve(null)
          }
        })
      })

      request.on('error', () => {
        resolve(null)
      })

      request.end()
    })
  }
}
