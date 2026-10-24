import { Box, Button, Group, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

const ERROR_TEXT = 'var(--buteco-color-error-text)'

export interface StateAction {
  label: string
  onClick: () => void
}

/**
 * Bloco de falha do protótipo (D18): fundo vermelho claro, ícone de alerta, título em peso 600, linha explicativa,
 * metadados e botões de contorno vermelho. Os estados que o protótipo não desenha seguem o mesmo padrão.
 */
export function StateBlock(props: { title: string; detail?: string; meta?: string; actions?: StateAction[] }) {
  const { title, detail, meta, actions = [] } = props
  return (
    <Box role="alert" px={12} py={10} bg="var(--mantine-color-red-light)" c={ERROR_TEXT} style={{ borderRadius: 9 }}>
      <Group gap={10} align="flex-start" wrap="nowrap">
        <IconAlertTriangle size={18} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
        <Stack gap={4} miw={0}>
          <Text fw={600} inherit>
            {title}
          </Text>
          {detail && <Text inherit>{detail}</Text>}
          {meta && (
            <Text ff="monospace" fz={11} inherit>
              {meta}
            </Text>
          )}
          {actions.length > 0 && (
            <Group gap={8} mt={4}>
              {actions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  color="red"
                  size="xs"
                  styles={{ root: { color: ERROR_TEXT, borderColor: ERROR_TEXT } }}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </Group>
          )}
        </Stack>
      </Group>
    </Box>
  )
}
