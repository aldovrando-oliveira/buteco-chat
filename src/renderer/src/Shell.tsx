import { Button, Code, Paper, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { SectionLabel } from './components/SectionLabel'

/** Tela provisória da fundação: valida tema, fontes e CSP. As telas de login e conversa substituem esta. */
export function Shell() {
  return (
    <Stack mih="100vh" align="center" justify="center" gap="md" p="md">
      <Title order={1}>Buteco Chat</Title>
      <Paper withBorder p="lg" w="100%" maw={380}>
        <Stack gap="sm">
          <SectionLabel>Fundação</SectionLabel>
          <Text>Base do aplicativo pronta para as próximas etapas.</Text>
          <Code>3f9c2a1e…b7d0</Code>
          <Text size="sm" c="dimmed">
            Texto secundário para conferir o contraste.
          </Text>
          <Button onClick={() => notifications.show({ message: 'Tema e fontes carregados.' })}>
            Testar notificação
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}
