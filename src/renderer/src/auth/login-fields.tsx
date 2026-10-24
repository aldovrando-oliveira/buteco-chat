import { Box, Button, Group, Input, Text } from '@mantine/core'
import { IconServer } from '@tabler/icons-react'
import type { ChatError } from '../../../shared/api'
import { loginErrorMessage } from './login-messages'

// Peças da tela de login reaproveitadas pelo modal de novo login (sessao-expirada, D6).

// Medidas do protótipo: campos com 34 px e raio 7 px (radius "sm"), rótulos em peso 500.
export const FIELD_STYLES = { input: { height: 34, minHeight: 34 }, label: { fontWeight: 500 } }
export const MONO_12 = { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 }
export const HINT = { fontSize: 12 }

/** Bloco de erro do login: fundo vermelho claro, texto vermelho, raio 7 px, `role="alert"`. */
export function LoginErrorBlock({ error, address }: { error: ChatError; address: string }) {
  return (
    <Box
      role="alert"
      px={12}
      py={8}
      bg="var(--mantine-color-red-light)"
      c="var(--buteco-color-error-text)"
      style={{ borderRadius: 7 }}
    >
      {loginErrorMessage(error, address)}
    </Box>
  )
}

/**
 * Linha somente leitura "Serviço": ícone de servidor, endereço e **Alterar** (só na tela de login; o modal de novo
 * login não troca de serviço, sessao-expirada D6).
 */
export function ServiceRow(props: {
  address: string
  warning: string | null
  disabled: boolean
  onChange?: () => void
}) {
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
        {props.onChange && (
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
        )}
      </Group>
      {props.warning && (
        <Text mt={5} style={{ ...HINT, color: 'var(--buteco-color-warning-text)' }}>
          {props.warning}
        </Text>
      )}
    </Input.Wrapper>
  )
}
