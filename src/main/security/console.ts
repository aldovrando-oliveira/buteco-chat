import type { WebContents, WebContentsConsoleMessageEventParams } from 'electron'

type ConsoleDetails = Pick<WebContentsConsoleMessageEventParams, 'level' | 'message' | 'sourceId' | 'lineNumber'>

const FORWARDED_LEVELS: ReadonlySet<ConsoleDetails['level']> = new Set(['warning', 'error'])

/** Linha a escrever no stdout, ou `null` para níveis que não são repassados (info, debug). */
export function formatConsoleMessage(details: ConsoleDetails): string | null {
  if (!FORWARDED_LEVELS.has(details.level)) return null
  return `[renderer:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})\n`
}

/** Repassa avisos e erros do console do renderer (inclusive violações de CSP) ao stdout do main (design D12). */
export function forwardConsoleMessages(
  contents: WebContents,
  write: (line: string) => unknown = (line) => process.stdout.write(line)
): void {
  contents.on('console-message', (details) => {
    const line = formatConsoleMessage(details)
    if (line !== null) write(line)
  })
}
