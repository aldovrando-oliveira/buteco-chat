## ADDED Requirements

### Requirement: Interface em pt-BR
A interface SHALL estar em pt-BR, e o `index.html` MUST declarar `lang="pt-BR"`.

#### Scenario: Idioma do documento
- **WHEN** o renderer monta o app
- **THEN** o documento tem `lang="pt-BR"`

### Requirement: Cores de erro e de aviso com contraste mínimo
O texto do bloco de erro SHALL usar a variável `--buteco-color-error-text` (`red[9]` no claro, `red[4]` no escuro) sobre `--mantine-color-red-light`. O texto de aviso SHALL usar `--buteco-color-warning-text` (`yellow[7]` no claro, `yellow[4]` no escuro). A mensagem de validação de campo SHALL usar `--mantine-color-red-text`. Os três MUST ter contraste de no mínimo 4,5:1 sobre o seu fundo (bloco de erro, superfície e superfície, respectivamente), em cada esquema.

#### Scenario: Contraste das mensagens
- **WHEN** o teste resolve, a partir do tema e do resolvedor de variáveis CSS, as cores de texto e de fundo do bloco de erro, do aviso e da mensagem de validação, nos dois esquemas
- **THEN** os seis contrastes são de no mínimo 4,5:1

## MODIFIED Requirements

### Requirement: Fundo da página distinto das superfícies
O fundo da página SHALL ser `#f6f5f3` no claro e `#121316` no escuro, definido por uma variável própria (`--buteco-color-page`) aplicada ao `body`. A variável `--mantine-color-body`, que o Mantine usa como fundo de `Paper`, `Card`, `Modal` e outros, MUST continuar como superfície: branco no claro e `dark[7]` no escuro.

#### Scenario: Página e cartão no claro
- **WHEN** a tela de login é renderizada no esquema claro
- **THEN** o `body` tem fundo `#f6f5f3` e o cartão usa `--mantine-color-body` branco

#### Scenario: Página e cartão no escuro
- **WHEN** a tela de login é renderizada no esquema escuro
- **THEN** o `body` tem fundo `#121316` e o cartão usa `dark[7]`

### Requirement: Fontes empacotadas
O app SHALL usar IBM Plex Sans como fonte de texto e IBM Plex Mono como fonte monoespaçada (`fontFamily` e `fontFamilyMonospace` do tema), carregadas de arquivos empacotados com o app (subset latin: Sans 400, 500 e 600; Mono 400 e 500). O build do renderer MUST NOT embutir nenhum asset como `data:` (`assetsInlineLimit: 0`), e nenhuma fonte MUST ser buscada na rede.

#### Scenario: Nenhum asset embutido
- **WHEN** o renderer é construído em produção
- **THEN** os arquivos CSS e JS gerados não contêm URLs `data:`, e os `.woff2` das fontes existem como arquivos no diretório de assets

#### Scenario: Fontes aplicadas no app empacotado
- **WHEN** o app empacotado abre a tela de login (cujo endereço do serviço usa Plex Mono)
- **THEN** depois de `await document.fonts.ready`, `document.fonts` contém ao menos uma `FontFace` com família "IBM Plex Sans" e uma com "IBM Plex Mono" em `status === 'loaded'`, e nenhuma violação de CSP de fonte aparece no console (`document.fonts.check` sozinho não serve, porque devolve `true` para famílias não registradas)

## REMOVED Requirements

### Requirement: Tela-casca
**Reason**: A casca só existia para validar tema, fontes e CSP antes de haver telas reais. A tela de login, com cartão, Plex Sans, Plex Mono, texto secundário e botão primário preenchido, cobre as mesmas verificações.
**Migration**: As verificações de fundo e de fontes passam a usar a tela de login (requisitos modificados acima); a exigência de pt-BR vira o requisito "Interface em pt-BR"; as telas estão especificadas em `autenticacao`.
