# identidade-visual Specification

## Purpose

Aplicar a identidade visual da plataforma Buteco Agentes no renderer: tema Mantine (cores, fontes, tamanhos, raios), esquemas claro e escuro, fundo da página distinto das superfícies, contraste mínimo (inclusive das mensagens de erro e de aviso), fontes IBM Plex empacotadas e interface em pt-BR.

## Requirements

### Requirement: Tema Mantine com a identidade Buteco
O renderer SHALL usar um `MantineProvider` com tema contendo as escalas `butecoBlue`, `green`, `yellow`, `red`, `gray` e `dark` do documento de construção, com `primaryColor: 'butecoBlue'`, `primaryShade: { light: 6, dark: 4 }`, `fontSizes`, `lineHeights`, `headings` (peso 600; h1 20px a h6 12px), `radius` e `defaultRadius: 'sm'` conforme especificado.

#### Scenario: Valores do tema
- **WHEN** o teste lê o tema exportado
- **THEN** as seis escalas, o `primaryShade`, os tamanhos de fonte, as alturas de linha, os títulos e os raios são iguais aos do documento de construção

### Requirement: Esquema de cor segue o sistema
O app SHALL seguir `prefers-color-scheme` (`defaultColorScheme: 'auto'`), sem seletor manual de tema.

#### Scenario: Sistema em modo escuro
- **WHEN** o sistema operacional está em modo escuro e o app abre
- **THEN** a interface usa o esquema escuro

### Requirement: Fundo da página distinto das superfícies
O fundo da página SHALL ser `#f6f5f3` no claro e `#121316` no escuro, definido por uma variável própria (`--buteco-color-page`) aplicada ao `body`. A variável `--mantine-color-body`, que o Mantine usa como fundo de `Paper`, `Card`, `Modal` e outros, MUST continuar como superfície: branco no claro e `dark[7]` no escuro.

#### Scenario: Página e cartão no claro
- **WHEN** a tela de login é renderizada no esquema claro
- **THEN** o `body` tem fundo `#f6f5f3` e o cartão usa `--mantine-color-body` branco

#### Scenario: Página e cartão no escuro
- **WHEN** a tela de login é renderizada no esquema escuro
- **THEN** o `body` tem fundo `#121316` e o cartão usa `dark[7]`

### Requirement: Primário preenchido legível no escuro
No esquema escuro, a cor de fundo de `variant="filled"` da cor primária SHALL ser `butecoBlue[6]` (hover `butecoBlue[7]`). Os demais usos do primário no escuro (texto, `light`, `outline`, âncoras) MUST continuar derivados de `primaryShade.dark = 4`.

#### Scenario: Contraste do botão preenchido no escuro
- **WHEN** o teste resolve, a partir do tema e do resolvedor de variáveis CSS, a cor de fundo do primário preenchido no esquema escuro, e calcula o contraste WCAG do texto branco sobre ela
- **THEN** o contraste é de no mínimo 4,5:1

#### Scenario: Contraste do botão preenchido no claro
- **WHEN** o mesmo cálculo é feito no esquema claro
- **THEN** o contraste é de no mínimo 4,5:1

### Requirement: Texto secundário com contraste mínimo
O texto secundário (`--mantine-color-dimmed`) SHALL ser `gray[6]` no claro e `dark[2]` no escuro, e MUST ter contraste de no mínimo 4,5:1 tanto sobre o fundo da página quanto sobre a superfície, em cada esquema.

#### Scenario: Texto secundário sobre página e superfície
- **WHEN** o teste calcula o contraste de `--mantine-color-dimmed` sobre `--buteco-color-page` e sobre `--mantine-color-body`, nos dois esquemas
- **THEN** os quatro contrastes são de no mínimo 4,5:1

### Requirement: Fontes empacotadas
O app SHALL usar IBM Plex Sans como fonte de texto e IBM Plex Mono como fonte monoespaçada (`fontFamily` e `fontFamilyMonospace` do tema), carregadas de arquivos empacotados com o app (subset latin: Sans 400, 500 e 600; Mono 400 e 500). O build do renderer MUST NOT embutir nenhum asset como `data:` (`assetsInlineLimit: 0`), e nenhuma fonte MUST ser buscada na rede.

#### Scenario: Nenhum asset embutido
- **WHEN** o renderer é construído em produção
- **THEN** os arquivos CSS e JS gerados não contêm URLs `data:`, e os `.woff2` das fontes existem como arquivos no diretório de assets

#### Scenario: Fontes aplicadas no app empacotado
- **WHEN** o app empacotado abre a tela de login (cujo endereço do serviço usa Plex Mono)
- **THEN** depois de `await document.fonts.ready`, `document.fonts` contém ao menos uma `FontFace` com família "IBM Plex Sans" e uma com "IBM Plex Mono" em `status === 'loaded'`, e nenhuma violação de CSP de fonte aparece no console (`document.fonts.check` sozinho não serve, porque devolve `true` para famílias não registradas)

### Requirement: Rótulos de seção
O tema SHALL oferecer um estilo reutilizável para rótulos de seção: 11px, caixa alta, `letter-spacing: 0.05em`, cor de texto secundário.

#### Scenario: Rótulo renderizado
- **WHEN** um rótulo de seção é renderizado
- **THEN** ele tem `font-size: 11px`, `text-transform: uppercase` e `letter-spacing: 0.05em`

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
