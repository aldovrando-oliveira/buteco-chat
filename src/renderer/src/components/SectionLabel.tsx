import { Text } from '@mantine/core'
import type { ReactNode } from 'react'

/** Rótulo de seção: 11px, caixa alta, `letter-spacing: 0.05em`, texto secundário. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text component="span" fz={11} fw={600} tt="uppercase" lts="0.05em" c="dimmed">
      {children}
    </Text>
  )
}
