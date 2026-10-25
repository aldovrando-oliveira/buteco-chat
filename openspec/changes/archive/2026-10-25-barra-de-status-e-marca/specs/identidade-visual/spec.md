## ADDED Requirements

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
