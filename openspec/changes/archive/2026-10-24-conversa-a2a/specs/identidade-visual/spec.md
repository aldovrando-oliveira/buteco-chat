## MODIFIED Requirements

### Requirement: Cores de erro e de aviso com contraste mínimo
Cada texto da tabela abaixo SHALL usar a sua variável sobre o seu fundo e MUST ter contraste de no mínimo 4,5:1 sobre ele, em cada esquema:

| Texto | Variável (claro / escuro) | Fundo |
|---|---|---|
| bloco de erro | `--buteco-color-error-text` (`red[9]` / `red[4]`) | `--mantine-color-red-light` |
| aviso | `--buteco-color-warning-text` (`yellow[7]` / `yellow[4]`) | superfície |
| validação de campo | `--mantine-color-red-text` | superfície |
| selo **Ativo** | `--buteco-color-success-text` (`green[9]` / `green[4]`) | `--mantine-color-green-light` |
| balão do usuário | `--mantine-color-text` | `--mantine-color-butecoBlue-light` |

#### Scenario: Contraste das mensagens
- **WHEN** o teste resolve, a partir do tema e do resolvedor de variáveis CSS, as cores de texto e de fundo do bloco de erro, do aviso e da mensagem de validação, nos dois esquemas
- **THEN** os seis contrastes são de no mínimo 4,5:1

#### Scenario: Contraste do selo Ativo e do balão do usuário
- **WHEN** o teste resolve as cores de texto e de fundo do selo **Ativo** e do balão do usuário, nos dois esquemas
- **THEN** os quatro contrastes são de no mínimo 4,5:1
