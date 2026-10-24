import type { CSSVariablesResolver } from '@mantine/core'
import { PAGE_BACKGROUND } from '../../../shared/page-background'

/**
 * Mesclado pelo Mantine por cima do resolvedor padrão (design D10).
 * - `--buteco-color-page`: fundo da página. `--mantine-color-body` continua sendo a superfície (Paper, Card, Modal).
 * - No escuro, o primário preenchido usa o tom 6 (o 4 não dá 4,5:1 com texto branco). O `variantColorResolver`
 *   não recebe o esquema de cor, por isso a troca é feita aqui, na variável que ele referencia.
 * - Texto do bloco de erro e do aviso (login-operador, D12): nenhuma variável padrão do Mantine é vermelha/amarela
 *   e tem 4,5:1 nos dois esquemas (`red-light-color` é quase branco no escuro; `yellow-text` dá 3,7:1 no claro).
 */
export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: {
    '--buteco-color-page': PAGE_BACKGROUND.light,
    '--buteco-color-error-text': 'var(--mantine-color-red-9)',
    '--buteco-color-warning-text': 'var(--mantine-color-yellow-7)'
  },
  dark: {
    '--buteco-color-page': PAGE_BACKGROUND.dark,
    '--buteco-color-error-text': 'var(--mantine-color-red-4)',
    '--buteco-color-warning-text': 'var(--mantine-color-yellow-4)',
    [`--mantine-color-${theme.primaryColor}-filled`]: `var(--mantine-color-${theme.primaryColor}-6)`,
    [`--mantine-color-${theme.primaryColor}-filled-hover`]: `var(--mantine-color-${theme.primaryColor}-7)`
  }
})
