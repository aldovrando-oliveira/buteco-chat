import { Box, Stack, Text } from '@mantine/core'
import { formatTime } from '../format'

/** Mensagem do usuário: à direita, balão de destaque claro, raio 11 11 4 11, quebras de linha preservadas. */
export function UserMessage({ text, sentAt }: { text: string; sentAt: number }) {
  return (
    <Stack gap={4} align="flex-end">
      <Box
        px={12}
        py={8}
        maw="80%"
        bg="var(--mantine-color-butecoBlue-light)"
        c="var(--mantine-color-text)"
        style={{ borderRadius: '11px 11px 4px 11px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        data-testid="user-message"
      >
        {text}
      </Box>
      <Text fz={11} c="dimmed">
        {formatTime(sentAt)}
      </Text>
    </Stack>
  )
}
