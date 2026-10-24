import { Button, Group, Modal, Stack, Text } from '@mantine/core'

const PENDING_NOTE = 'A resposta pendente será descartada: a task continua no servidor, mas o app deixa de acompanhá-la.'

/**
 * Confirmação de **Excluir conversa** (historico-conversas, D13): o layout dos modais de confirmação, com a ação em
 * vermelho preenchido, porque a exclusão não tem volta (D16 #12).
 */
export function DeleteConversationModal(props: {
  opened: boolean
  /** Último turno em envio, pendente, sem resposta a tempo ou aguardando novo login. */
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { opened, pending, onCancel, onConfirm } = props
  return (
    <Modal opened={opened} onClose={onCancel} withCloseButton={false} centered>
      <Stack gap={16}>
        <Text>
          Excluir esta conversa? Ela será apagada deste computador e não poderá ser recuperada.
          {pending && ` ${PENDING_NOTE}`}
        </Text>
        <Group justify="flex-end" gap={8}>
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button color="red" variant="filled" onClick={onConfirm}>
            Excluir conversa
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
