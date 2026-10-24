## MODIFIED Requirements

### Requirement: Token nunca cruza a ponte
`getToken()` SHALL existir só no main, para as chamadas autenticadas feitas pelo main, e MUST NOT ter canal IPC. Nenhum valor devolvido ao renderer MUST conter o token: nem o resultado de `login`, `status`, `agents.list`, `chat.send`, `chat.getTask` ou `clipboard.writeText`, nem mensagem de erro.

#### Scenario: Resultado do login sem token
- **WHEN** um login bem-sucedido devolve o resultado pelo canal `auth:login`
- **THEN** o valor serializado não contém a string do token

#### Scenario: Resultados da conversa sem token
- **WHEN** `agents:list`, `chat:send` e `chat:getTask` devolvem sucesso, `unauthorized`, `rpc` e `bad-response`
- **THEN** nenhum valor serializado contém a string do token

#### Scenario: Preload sem acesso ao token
- **WHEN** o renderer lista as funções de `window.buteco.auth`
- **THEN** elas são exatamente `login`, `logout` e `status`

### Requirement: Canais IPC de autenticação
O main SHALL registrar `auth:login`, `auth:logout` e `auth:status` pelo utilitário `handle()` (requisito 'Handlers IPC validam o remetente' de `ponte-preload`), com `parseArgs`.
- `auth:login` MUST aceitar exatamente três strings:
  - endereço com até 2048 caracteres e aceito por `parseServiceUrl`;
  - usuário com até 256 caracteres;
  - senha com até 1024 caracteres.
- `auth:logout` e `auth:status` MUST aceitar exatamente zero argumentos.

As mensagens de erro de `parseArgs`, inclusive a `cause`, MUST NOT conter nenhum valor recebido. `EXPOSED_NAMESPACES` SHALL incluir `'auth'`.

#### Scenario: Tipos e quantidade errados
- **WHEN** `auth:login` recebe um número no lugar de uma string, dois ou quatro argumentos, ou `auth:status` recebe um argumento
- **THEN** a chamada é rejeitada e o serviço não é chamado

#### Scenario: Tamanho excessivo
- **WHEN** `auth:login` recebe endereço com 2049 caracteres, usuário com 257 ou senha com 1025
- **THEN** a chamada é rejeitada e o serviço não é chamado

#### Scenario: Endereço inválido não vaza na mensagem
- **WHEN** `auth:login` recebe `http://user:pass@host` como endereço
- **THEN** a chamada é rejeitada, e nem a mensagem do erro nem a da `cause` contêm `user`, `pass` ou o endereço

#### Scenario: Tipagem do renderer
- **WHEN** o `typecheck` roda
- **THEN** `window.buteco.auth` compila no renderer com `login`, `logout` e `status`, e `window.buteco.auth.getToken` não compila

### Requirement: Tela inicial decidida pelo main
Ao montar, o renderer SHALL chamar `auth.status()` e mostrar a tela de conversas (capacidade `conversa`) se autenticado, ou a tela de login se não. Até a resposta, MUST aparecer só o fundo da página.

#### Scenario: Recarregar com sessão ativa
- **WHEN** o renderer é recarregado e `status()` devolve `authenticated: true`
- **THEN** a tela de conversas aparece, sem passar pela tela de login

#### Scenario: Login bem-sucedido
- **WHEN** o login dá certo
- **THEN** a tela de conversas aparece

## REMOVED Requirements

### Requirement: Destino pós-login provisório
**Reason**: Era provisório até existir a tela de conversas, que esta change entrega.
**Migration**: A identificação "{usuário} @ {host}", o tempo restante, **Sair** e a volta ao login ao chegar a zero passam para o rodapé da barra lateral (requisito 'Rodapé de sessão' de `conversa`). `SessionScreen.tsx` sai.
