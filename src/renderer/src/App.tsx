import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { Shell } from './Shell'
import { cssVariablesResolver } from './theme/css-variables'
import { theme } from './theme/theme'

// Sem ColorSchemeScript: é script inline e a CSP de produção o bloqueia (design D10).
export function App() {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
      <Notifications />
      <Shell />
    </MantineProvider>
  )
}
