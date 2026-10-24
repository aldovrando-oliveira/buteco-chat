## MODIFIED Requirements

### Requirement: Cores de erro e de aviso com contraste mínimo
Cada texto da tabela abaixo SHALL usar a sua variável sobre o seu fundo e MUST ter contraste de no mínimo 4,5:1 sobre ele, em cada esquema:

| Texto | Variável (claro / escuro) | Fundo |
|---|---|---|
| bloco de erro | `--buteco-color-error-text` (`red[9]` / `red[4]`) | `--mantine-color-red-light` |
| aviso | `--buteco-color-warning-text` (`yellow[9]` / `yellow[4]`) | superfície |
| validação de campo | `--mantine-color-red-text` | superfície |
| selo **Ativo** | `--buteco-color-success-text` (`green[9]` / `green[4]`) | `--mantine-color-green-light` |
| balão do usuário | `--mantine-color-text` | `--mantine-color-butecoBlue-light` |
| título do banner de sessão expirada | `--buteco-color-warning-text` (`yellow[9]` / `yellow[4]`) | `--mantine-color-yellow-light` |
| linha explicativa do banner de sessão expirada | `--mantine-color-text` | `--mantine-color-yellow-light` |
| item ativo da lista de conversas | `--buteco-color-accent-text` (`butecoBlue[8]` / `butecoBlue[3]`) | `--mantine-color-butecoBlue-light` |
| horário do item da lista sob o hover | `--mantine-color-dimmed` | `--mantine-color-default-hover` |
| botão vermelho preenchido (**Excluir conversa**) | branco | `--mantine-color-red-filled` (`red[6]` nos dois esquemas) e `--mantine-color-red-filled-hover` (`red[7]` nos dois esquemas) |

No esquema escuro, `--mantine-color-red-filled` MUST resolver para `red[6]` e `--mantine-color-red-filled-hover` para `red[7]`, como o primário preenchido (requisito 'Primário preenchido legível no escuro'). Os demais usos do vermelho no escuro MUST continuar derivados de `primaryShade.dark = 4`.

#### Scenario: Contraste das mensagens
- **WHEN** o teste resolve, a partir do tema e do resolvedor de variáveis CSS, as cores de texto e de fundo do bloco de erro, do aviso e da mensagem de validação, nos dois esquemas
- **THEN** os seis contrastes são de no mínimo 4,5:1

#### Scenario: Contraste do selo Ativo e do balão do usuário
- **WHEN** o teste resolve as cores de texto e de fundo do selo **Ativo** e do balão do usuário, nos dois esquemas
- **THEN** os quatro contrastes são de no mínimo 4,5:1

#### Scenario: Contraste do banner de sessão expirada
- **WHEN** o teste resolve `--buteco-color-warning-text` e `--mantine-color-text` sobre `--mantine-color-yellow-light`, nos dois esquemas
- **THEN** os quatro contrastes são de no mínimo 4,5:1, e `--buteco-color-warning-text` resolve para `#8a5a00` no claro e `#e2a63f` no escuro

#### Scenario: Contraste da lista de conversas
- **WHEN** o teste resolve `--buteco-color-accent-text` sobre `--mantine-color-butecoBlue-light` e `--mantine-color-dimmed` sobre `--mantine-color-default-hover`, nos dois esquemas
- **THEN** os quatro contrastes são de no mínimo 4,5:1, e `--buteco-color-accent-text` resolve para `#1e4d92` no claro e `#b0c8ee` no escuro

#### Scenario: Contraste do botão vermelho preenchido
- **WHEN** o teste resolve `--mantine-color-red-filled` e `--mantine-color-red-filled-hover`, nos dois esquemas, e calcula o contraste do texto branco sobre cada um
- **THEN** os quatro contrastes são de no mínimo 4,5:1, e as duas variáveis resolvem para `#cf3a2b` e `#c23325` nos dois esquemas
