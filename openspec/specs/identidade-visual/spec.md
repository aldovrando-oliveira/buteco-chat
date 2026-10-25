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

### Requirement: Ícone do app na interface
Dentro da interface, a marca do app SHALL ser sempre o ícone de aplicativo oficial (`assets/brand/app-icon.svg`, requisito 'Ícone do aplicativo' de `empacotamento-local`), desenhado por um único componente: um quadrado de 1024 com canto 232 em `#2a6ecb`, com o símbolo da cabeça e da gravata em branco. Regras:
- **SVG inline**: a geometria fica no código do componente. MUST NOT haver `<img>`, URL `data:` nem leitura do arquivo em tempo de execução;
- **geometria**: igual à do `assets/brand/app-icon.svg` (retângulo, raio, transformações e o `d` de cada caminho), exceto pelo sentido do subcaminho da asa direita da gravata, invertido para eliminar o filete vazado entre a asa e o nó. A asa direita MUST ser `M366 326V402Q366 416 352 416L276 382V346L352 312Q366 312 366 326Z`, os mesmos pontos de `M366 326Q366 312 352 312L276 346V382L352 416Q366 416 366 402Z` do arquivo, em sentido inverso;
- **cores fixas** `#2a6ecb` e `#ffffff`, as mesmas nos esquemas claro e escuro, sem variáveis do tema;
- **tamanho**: em px, com largura igual à altura e mínimo de 24 px. Um tamanho menor pedido MUST ser desenhado com 24 px, porque abaixo disso a gravata some (manual da marca);
- **acessibilidade**: `aria-hidden="true"` e `focusable="false"`. O nome acessível vem do texto "Buteco Chat" ao lado;
- **forma única**: dentro do app, a marca MUST NOT ser o símbolo solto, o logo ou lockup da plataforma (cabeça em tinta e gravata em azul) nem um ícone genérico.

O ícone aparece com 32 px nas telas de login e com 24 px no topo da barra lateral.

#### Scenario: Mesma geometria do arquivo
- **WHEN** o teste lê `assets/brand/app-icon.svg` e compara com as constantes de geometria que o componente usa
- **THEN** o arquivo contém o subcaminho original da asa direita, e o `viewBox`, o `rect` (posição, tamanho, `rx`, `ry` e cor), as duas transformações e o `d`, o `fill` e o `fill-rule` dos dois caminhos são iguais nos dois, exceto a asa direita, que nas constantes é o subcaminho invertido

#### Scenario: Gravata sem filete vazado
- **WHEN** o SVG montado a partir das constantes e o arquivo original são rasterizados em 1024 px
- **THEN** o pixel em (550, 701), entre a asa direita e o nó, é branco no primeiro e `#2a6ecb` no segundo, com uma tolerância pequena de cor

#### Scenario: Componente desenhado a partir das constantes
- **WHEN** o componente é renderizado
- **THEN** o `viewBox`, o `rect`, as transformações e os caminhos do `svg` são os das constantes de geometria

#### Scenario: Tamanho mínimo
- **WHEN** o componente é renderizado com tamanho 16 e com tamanho 32
- **THEN** o `svg` tem `width` e `height` 24 no primeiro caso e 32 no segundo, com `viewBox="0 0 1024 1024"` nos dois

#### Scenario: Cores fixas nos dois esquemas
- **WHEN** o componente é renderizado no esquema claro e no escuro
- **THEN** o quadrado tem `fill="#2a6ecb"` e os caminhos `fill="#ffffff"` nos dois, sem `var(`

#### Scenario: Fora da árvore de acessibilidade
- **WHEN** o componente é renderizado ao lado de "Buteco Chat"
- **THEN** o `svg` tem `aria-hidden="true"` e `focusable="false"`, e não tem `role` nem `aria-label`

#### Scenario: Sem imagem nem data
- **WHEN** a tela de login e a tela de conversas são renderizadas
- **THEN** não há elemento `<img>`, nenhum atributo contém `data:`, e o ícone é um `svg` inline
