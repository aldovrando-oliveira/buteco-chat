import { Box, Button, Group, Input, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconServer } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import type { ChatError } from '../../../shared/api'
import { parseServiceUrl } from '../../../shared/service-url'
import { Brand } from './Brand'
import { INSECURE_ADDRESS_WARNING, INVALID_ADDRESS_MESSAGE, loginErrorMessage } from './login-messages'
import { readSavedServiceUrl, saveServiceUrl } from './saved-service-url'

// Medidas do protótipo: campos com 34 px e raio 7 px (radius "sm"), rótulos em peso 500.
const FIELD_STYLES = { input: { height: 34, minHeight: 34 }, label: { fontWeight: 500 } }
const MONO_12 = { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 }
const HINT = { fontSize: 12 }

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

              {error && (
                <Box
                  role="alert"
                  px={12}
                  py={8}
                  bg="var(--mantine-color-red-light)"
                  c="var(--buteco-color-error-text)"
                  style={{ borderRadius: 7 }}
                >
                  {loginErrorMessage(error.error, error.address)}
                </Box>
              )}

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

/** Linha somente leitura dos acessos seguintes: ícone de servidor, endereço salvo e **Alterar**. */
function ServiceRow(props: { address: string; warning: string | null; disabled: boolean; onChange: () => void }) {
  return (
    <Input.Wrapper label="Serviço" styles={{ label: FIELD_STYLES.label }}>
      <Group
        h={34}
        px={10}
        gap={8}
        wrap="nowrap"
        bg="var(--mantine-color-default-hover)"
        style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 7 }}
      >
        <IconServer size={16} color="var(--mantine-color-dimmed)" aria-hidden />
        <Text flex={1} miw={0} truncate="end" style={MONO_12}>
          {props.address}
        </Text>
        <Button
          variant="transparent"
          size="compact-sm"
          px={0}
          c="var(--mantine-color-anchor)"
          disabled={props.disabled}
          onClick={props.onChange}
        >
          Alterar
        </Button>
      </Group>
      {props.warning && (
        <Text mt={5} style={{ ...HINT, color: 'var(--buteco-color-warning-text)' }}>
          {props.warning}
        </Text>
      )}
    </Input.Wrapper>
  )
}
