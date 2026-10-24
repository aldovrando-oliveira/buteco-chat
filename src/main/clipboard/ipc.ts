import { IpcChannels } from '../../shared/ipc-channels'
import { handle } from '../ipc/handle'

export const MAX_CLIPBOARD_LENGTH = 1024

/** `clipboard:writeText`: uma string de até 1 KiB (conversa-a2a, D6). Mensagens sem o valor. */
export function parseWriteTextArgs(args: unknown[]): [string] {
  if (args.length !== 1) throw new TypeError('clipboard:writeText espera 1 argumento.')
  const [text] = args
  if (typeof text !== 'string') throw new TypeError('texto deve ser string.')
  if (text.length > MAX_CLIPBOARD_LENGTH) throw new RangeError('texto excede o limite.')
  return [text]
}

/**
 * A fundação nega toda permissão do Chromium ao renderer, inclusive a de escrever na área de transferência (D8 da
 * fundação); a cópia passa pelo main. A leitura não é exposta.
 */
export function registerClipboardHandlers(clipboard: { writeText(text: string): void }): void {
  handle(IpcChannels.clipboardWriteText, parseWriteTextArgs, (text) => clipboard.writeText(text))
}
