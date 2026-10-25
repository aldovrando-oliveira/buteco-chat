import { Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import type { ChatError } from '../../../shared/api'
import { parseServiceUrl } from '../../../shared/service-url'
import { Brand } from '../components/Brand'
import { FIELD_STYLES, HINT, LoginErrorBlock, MONO_12, ServiceRow } from './login-fields'
import { INSECURE_ADDRESS_WARNING, INVALID_ADDRESS_MESSAGE } from './login-messages'
import { readSavedServiceUrl, saveServiceUrl } from './saved-service-url'

/** Tela de login nas duas variantes: primeiro acesso (campo de endereço) e acessos seguintes (linha "Serviço"). */
export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [savedAddress] = useState(readSavedServiceUrl)
  const [editingAddress, setEditingAddress] = useState(savedAddress === null)
  const [address, setAddress] = useState(savedAddress ?? '')
  const [addressTouched, setAddressTouched] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ error: ChatError; address: string } | null>(null)

  const parsed = parseServiceUrl(address)
  // Só depois de sair do campo ou tentar enviar, para não acusar "h" enquanto o usuário digita (D10).
  const showInvalid = addressTouched && !parsed.ok
  const canSubmit = parsed.ok && username !== '' && password !== '' && !loading

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddressTouched(true)
    if (!canSubmit || !parsed.ok) return
    setLoading(true)
    setError(null)
    const result = await window.buteco.auth.login(parsed.baseUrl, username, password)
    setLoading(false)
    if (result.ok) {
      saveServiceUrl(parsed.baseUrl)
      onLoggedIn()
      return
    }
    setError({ error: result.error, address: parsed.baseUrl })
    if (result.error.kind === 'invalid-credentials') setPassword('')
  }

  const insecureWarning = parsed.ok && parsed.insecure ? INSECURE_ADDRESS_WARNING : null

  return (
    <Stack mih="100vh" justify="center" align="center" p="md">
      <Stack w="100%" maw={380} gap={20}>
        <Brand />
        <Paper withBorder radius="lg" p={24}>
          {/* noValidate: a mensagem de endereço é a do protótipo, não o balão nativo do type="url" (D10). */}
          <form noValidate onSubmit={(event) => void submit(event)}>
            <Stack gap={14}>
              <Stack gap={4}>
                <Title order={1}>Entrar</Title>
                <Text c="dimmed">Use o mesmo usuário e senha do painel Buteco Agentes.</Text>
              </Stack>

              {error && <LoginErrorBlock error={error.error} address={error.address} />}

              {editingAddress ? (
                <TextInput
                  label="Endereço do serviço"
                  type="url"
                  placeholder="http://localhost:5017"
                  value={address}
                  onChange={(event) => setAddress(event.currentTarget.value)}
                  onBlur={() => setAddressTouched(address.trim() !== '')}
                  disabled={loading}
                  autoFocus={savedAddress !== null}
                  error={showInvalid ? INVALID_ADDRESS_MESSAGE : undefined}
                  description={insecureWarning}
                  inputWrapperOrder={['label', 'input', 'description', 'error']}
                  styles={{
                    ...FIELD_STYLES,
                    input: { ...FIELD_STYLES.input, ...MONO_12 },
                    // A cor padrão do erro do Mantine (red[8] no escuro) não tem 4,5:1 sobre a superfície (D12).
                    error: { ...HINT, color: 'var(--mantine-color-red-text)' },
                    description: { ...HINT, color: 'var(--buteco-color-warning-text)' }
                  }}
                />
              ) : (
                <ServiceRow
                  address={savedAddress ?? ''}
                  warning={insecureWarning}
                  disabled={loading}
                  onChange={() => setEditingAddress(true)}
                />
              )}

              <TextInput
                label="Usuário"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
                disabled={loading}
                styles={FIELD_STYLES}
              />
              {/* TextInput, não PasswordInput: o protótipo não tem o botão de mostrar a senha. */}
              <TextInput
                label="Senha"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                disabled={loading}
                styles={FIELD_STYLES}
              />
              <Button type="submit" fullWidth h={36} loading={loading} disabled={!canSubmit && !loading}>
                Entrar
              </Button>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Stack>
  )
}
