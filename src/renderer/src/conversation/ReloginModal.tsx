import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useRef, useState, type FormEvent } from 'react'
import type { ChatError } from '../../../shared/api'
import { FIELD_STYLES, LoginErrorBlock, ServiceRow } from '../auth/login-fields'
import type { SessionInfo } from './SessionFooter'
import type { ExpiredCase } from './use-conversation'

/** Subtítulo por caso (sessao-expirada, D11 #2). Sem nada em andamento, o modal não tem subtítulo. */
const SUBTITLE: Record<ExpiredCase, string | null> = {
  poll: 'A conversa e a resposta em andamento continuam onde estavam.',
  send: 'A conversa continua onde estava. A mensagem será enviada depois do login.',
  idle: null
}

/**
 * Modal "Entrar novamente" (sessao-expirada, D6): serviço e usuário da sessão, somente leitura, e a senha. Os erros
 * são os da tela de login. Durante o login, nada fecha o modal: um sucesso depois de fechado deixaria o main com
 * sessão nova e a tela ainda expirada.
 */
export function ReloginModal(props: {
  opened: boolean
  session: SessionInfo
  expiredCase: ExpiredCase
  onClose: () => void
  onLoggedIn: (expiresAt: string) => void
}) {
  const { opened, session, expiredCase, onClose, onLoggedIn } = props
  const [loading, setLoading] = useState(false)
  // Remonta o formulário a cada abertura: senha vazia e sem erro.
  const [openCount, setOpenCount] = useState(0)
  const [wasOpened, setWasOpened] = useState(opened)
  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) setOpenCount((count) => count + 1)
  }

  const subtitle = SUBTITLE[expiredCase]
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnEscape={!loading}
      closeOnClickOutside={!loading}
      withCloseButton={false}
      centered
      size={360}
      radius="lg"
      title="Entrar novamente"
      styles={{ title: { fontSize: 17, fontWeight: 600 } }}
    >
      <Stack gap={14}>
        {subtitle !== null && <Text c="dimmed">{subtitle}</Text>}
        <ReloginForm
          key={openCount}
          session={session}
          onLoadingChange={setLoading}
          onCancel={onClose}
          onLoggedIn={onLoggedIn}
        />
      </Stack>
    </Modal>
  )
}

function ReloginForm(props: {
  session: SessionInfo
  onLoadingChange: (loading: boolean) => void
  onCancel: () => void
  onLoggedIn: (expiresAt: string) => void
}) {
  const { session, onLoadingChange, onCancel, onLoggedIn } = props
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ChatError | null>(null)
  // Só a última tentativa tem efeito: o `cancelled` de uma substituída nunca chega à tela.
  const attempt = useRef(0)

  function changeLoading(next: boolean) {
    setLoading(next)
    onLoadingChange(next)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || password === '') return
    const myAttempt = ++attempt.current
    changeLoading(true)
    setError(null)
    const result = await window.buteco.auth.login(session.serviceUrl, session.username, password)
    if (myAttempt !== attempt.current) return
    changeLoading(false)
    if (result.ok) return onLoggedIn(result.value.expiresAt)
    setError(result.error)
    if (result.error.kind === 'invalid-credentials') setPassword('')
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <Stack gap={14}>
        {error && <LoginErrorBlock error={error} address={session.serviceUrl} />}
        <ServiceRow address={session.serviceUrl} warning={null} disabled={loading} />
        <TextInput label="Usuário" value={session.username} readOnly styles={FIELD_STYLES} />
        <TextInput
          label="Senha"
          type="password"
          autoComplete="current-password"
          data-autofocus
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          disabled={loading}
          styles={FIELD_STYLES}
        />
        <Group justify="flex-end" gap={8}>
          <Button variant="default" disabled={loading} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={password === '' && !loading}>
            Entrar
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
