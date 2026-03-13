import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/**
 * Generate a deterministic UUID v5 from a task ID.
 * Uses DNS namespace so the same task ID always produces the same UUID.
 */
export function taskIdToUuid(taskId: string): string {
  // UUID v5 namespace (DNS)
  const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const nsBytes = Buffer.from(DNS_NAMESPACE.replace(/-/g, ''), 'hex')
  const hash = crypto.createHash('sha1').update(nsBytes).update(taskId).digest()
  // Set version (5) and variant bits per RFC 4122
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Get the Claude projects directory path for a given project root.
 */
function getClaudeProjectDir(projectRoot: string): string {
  return path.join(
    os.homedir(),
    '.claude',
    'projects',
    projectRoot.replace(/\//g, '-')
  )
}

/**
 * Copy the parent task's Claude session file to the child task's UUID path.
 * This is called when a forked task's terminal is first created, ensuring
 * the child gets the parent's full conversation history.
 *
 * Returns true if the copy was performed, false if skipped (child already
 * has a session, or parent session doesn't exist).
 */
export function ensureForkSessionCopied(
  taskId: string,
  forkedFrom: string,
  projectRoot: string
): boolean {
  const childUuid = taskIdToUuid(taskId)
  const parentUuid = taskIdToUuid(forkedFrom)
  const claudeProjectDir = getClaudeProjectDir(projectRoot)
  const childSessionFile = path.join(claudeProjectDir, `${childUuid}.jsonl`)
  const parentSessionFile = path.join(claudeProjectDir, `${parentUuid}.jsonl`)

  // Don't copy if child already has its own session
  if (fs.existsSync(childSessionFile)) {
    return false
  }

  if (!fs.existsSync(parentSessionFile)) {
    console.warn(`Parent session file not found for fork from ${forkedFrom}, will start fresh`)
    return false
  }

  try {
    fs.mkdirSync(claudeProjectDir, { recursive: true })

    // Read the parent session and check for compaction boundaries.
    // After compaction, the JSONL has two chains (both starting with parentUuid: null).
    // Claude Code may pick the first (pre-compaction) chain instead of the last
    // (post-compaction) chain. To fix this, only copy entries from the last
    // compact_boundary onward so the child session has a single chain.
    const content = fs.readFileSync(parentSessionFile, 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim().length > 0)

    let lastCompactIndex = -1
    for (let i = 0; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
          lastCompactIndex = i
        }
      } catch {
        // Skip malformed lines
      }
    }

    if (lastCompactIndex >= 0) {
      // Only copy from the last compaction boundary onward
      const trimmedContent = lines.slice(lastCompactIndex).join('\n') + '\n'
      fs.writeFileSync(childSessionFile, trimmedContent, 'utf-8')
      console.log(`Copied compacted session from ${forkedFrom} to ${taskId} (trimmed ${lastCompactIndex} pre-compaction lines)`)
    } else {
      // No compaction — copy the entire file
      fs.copyFileSync(parentSessionFile, childSessionFile)
      console.log(`Copied session from ${forkedFrom} to ${taskId}`)
    }

    return true
  } catch (err) {
    console.warn(`Failed to copy parent session for fork: ${err}`)
    return false
  }
}

/**
 * Resolve a Claude default command that contains `--resume $SOME_VAR` (or similar)
 * into either `--resume <uuid>` (if a prior session exists) or `--session-id <uuid>`
 * (if starting fresh). This avoids the interactive resume picker showing up when no
 * session matches the task ID.
 */
export function resolveClaudeSessionCommand(
  command: string,
  taskId: string,
  projectRoot: string
): string {
  // Match --resume followed by a shell variable (e.g. $FAMILIAR_TASK_ID)
  const resumePattern = /--resume\s+["']?\$\w+["']?/
  if (!resumePattern.test(command)) return command

  const sessionUuid = taskIdToUuid(taskId)
  const claudeProjectDir = getClaudeProjectDir(projectRoot)
  const sessionFile = path.join(claudeProjectDir, `${sessionUuid}.jsonl`)
  const hasExistingSession = fs.existsSync(sessionFile)

  if (hasExistingSession) {
    // Resume the existing session by its deterministic UUID
    return command.replace(resumePattern, `--resume "${sessionUuid}"`)
  } else {
    // Start a fresh session with the deterministic UUID (no resume picker)
    return command.replace(resumePattern, `--session-id "${sessionUuid}"`)
  }
}
