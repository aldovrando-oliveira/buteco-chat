## MODIFIED Requirements

### Requirement: Estrutura das telas de login
As duas telas de login SHALL ter o fundo da página (`--buteco-color-page`), conteúdo centralizado nos dois eixos, coluna de largura máxima de 380 px e 20 px entre os blocos. No topo, centralizada, MUST estar a marca: o ícone do app de 32 px (requisito 'Ícone do app na interface' de `identidade-visual`), seguido de "Buteco" (16 px, peso 600) e "Chat" (16 px, cor secundária). Abaixo, um cartão (superfície, borda, raio 11 px, padding 24 px, 14 px entre os itens) MUST conter, nesta ordem: o título "Entrar" (20 px, peso 600) com o subtítulo "Use o mesmo usuário e senha do painel Buteco Agentes." em cor secundária; o bloco de erro, só quando houver erro; o endereço do serviço; o campo "Usuário" (`autocomplete="username"`); o campo "Senha" (`type="password"`, `autocomplete="current-password"`); e o botão primário preenchido "Entrar", de largura total e 36 px de altura. Rótulos MUST ter peso 500; campos, 34 px de altura e raio 7 px. A tela MUST NOT ter texto de ajuda permanente: nada abaixo do endereço além da mensagem de validação e do aviso de HTTP, e nada abaixo do cartão. As telas MUST funcionar nos esquemas claro e escuro.

#### Scenario: Ordem dos elementos
- **WHEN** a tela de login é renderizada com um erro
- **THEN** no cartão aparecem, nesta ordem, "Entrar", o subtítulo, o bloco de erro, o endereço, "Usuário", "Senha" e o botão "Entrar"

#### Scenario: Marca
- **WHEN** a tela de primeiro acesso ou a de acessos seguintes é renderizada
- **THEN** acima do cartão aparecem o ícone do app de 32 px, "Buteco" e "Chat", e nenhum ícone de balão de conversa

#### Scenario: Campos acessíveis
- **WHEN** a tela de login é renderizada
- **THEN** o campo "Usuário" tem `autocomplete="username"` e o campo "Senha" tem `type="password"` e `autocomplete="current-password"`

#### Scenario: Sem textos de ajuda
- **WHEN** a tela é renderizada sem erro, com endereço válido em `https:`
- **THEN** não há texto entre o endereço e o campo "Usuário" nem abaixo do cartão
