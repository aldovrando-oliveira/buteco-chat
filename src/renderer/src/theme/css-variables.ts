import type { CSSVariablesResolver } from '@mantine/core'
import { PAGE_BACKGROUND } from '../../../shared/page-background'

/**
 * Mesclado pelo Mantine por cima do resolvedor padrão (design D10).
 * - `--buteco-color-page`: fundo da página. `--mantine-color-body` continua sendo a superfície (Paper, Card, Modal).
 * - No escuro, o primário preenchido usa o tom 6 (o 4 não dá 4,5:1 com texto branco). O `variantColorResolver`
 *   não recebe o esquema de cor, por isso a troca é feita aqui, na variável que ele referencia.
 */
export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: {
    '--buteco-color-page': PAGE_BACKGROUND.light
  },
  dark: {
    '--buteco-color-page': PAGE_BACKGROUND.dark,
    [`--mantine-color-${theme.primaryColor}-filled`]: `var(--mantine-color-${theme.primaryColor}-6)`,
    [`--mantine-color-${theme.primaryColor}-filled-hover`]: `var(--mantine-color-${theme.primaryColor}-7)`
  }
})
