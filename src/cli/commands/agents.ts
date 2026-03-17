import { Command } from 'commander'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { BASE_AGENTS_MD } from '../../shared/prompts'
import { getProjectRoot, readSettings } from '../lib/file-ops'
import type { ProjectSettings } from '../../shared/types/settings'

/**
 * Build a markdown section describing which settings are currently enabled.
 * Returns an empty string if no settings are active.
 */
export function buildSettingsSection(settings: ProjectSettings): string {
  const lines: string[] = []

  if (settings.simplifyTaskTitles) {
    lines.push(
      '- **`simplifyTaskTitles` is ON**: You MUST simplify the task title to a short descriptive name ' +
        '(3-6 words) **regardless of how long or short the current title is**. Always do this. ' +
        'FIRST, save the original title/prompt verbatim into `document.md` under an `## Original Prompt` heading ' +
        '(this section must always remain at the top of the document and must never be modified or deleted). ' +
        'THEN, shorten the title using `familiar update $FAMILIAR_TASK_ID --title "Short title"`. ' +
        'The original prompt text must never be lost.'
    )
  }

  // Future settings can be added here with the same pattern.

  if (lines.length === 0) {
    return '\n## Active Settings\n\nNo special settings are enabled.\n'
  }

  return '\n## Active Settings\n\nThe following settings are enabled for this project — obey them:\n\n' + lines.join('\n') + '\n'
}

export function agentsCommand(): Command {
  return new Command('agents')
    .description('Print the base agent instructions for AI agent onboarding')
    .option('--copy', 'Copy the prompt to clipboard')
    .action(async (_opts: { copy?: boolean }) => {
      const root = getProjectRoot()
      const settings = await readSettings(root)
      const settingsSection = buildSettingsSection(settings)
      const output = BASE_AGENTS_MD + settingsSection

      console.log(output)

      if (_opts.copy) {
        try {
          execSync('pbcopy', { input: output })
          console.log(chalk.green('\nCopied to clipboard.'))
        } catch {
          console.error(chalk.red('\nFailed to copy to clipboard.'))
        }
      }
    })
}
