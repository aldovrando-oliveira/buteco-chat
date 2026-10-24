# conversa Specification

## Purpose

Conversar com os agentes da plataforma Buteco Agentes: listar os agentes e enviar mensagens pelo JSON-RPC A2A a partir do main, validar o que entra e o que sai, expor os canais IPC `agents:*`, `chat:*` e `clipboard:*` sem o token, e oferecer no renderer a tela de conversas, com o acompanhamento de cada task até um estado terminal e a retomada da conversa depois de um novo login quando a sessão expira.

## Requirements

### Requirement: Requisições autenticadas à plataforma
Toda chamada a `/agents` e a `/agents/{agentId}/a2a` SHALL sair do main, por `fetch` injetado (`net.fetch` em produção), com:
- `Authorization: Bearer <token>`, o token vindo de `getToken()`;
- `accept: application/json`, mais `content-type: application/json` quando há corpo;
- `credentials: 'omit'`, `cache: 'no-store'`, `redirect: 'manual'`;
- timeout de 15 s por requisição, pelos timers injetados.

As rotas MUST ser montadas por concatenação sobre o `baseUrl` da sessão (`` `${baseUrl}/agents` ``, `` `${baseUrl}/agents/${agentId}/a2a` ``). Sem token na sessão, a chamada MUST devolver `{ ok: false, error: { kind: 'unauthorized' } }` sem chamar o `fetch`. Quando a plataforma responde 401, o cliente MUST chamar `auth.discard` com o token usado nessa requisição antes de devolver `unauthorized`. Nenhum valor devolvido ao renderer e nenhuma mensagem de erro ou de log MUST conter o token.

#### Scenario: Cabeçalhos e opções
- **WHEN** `agents.list()` é chamado com uma sessão em `https://host/buteco` e token `t0k`
- **THEN** o `fetch` recebe `https://host/buteco/agents` com `Authorization: Bearer t0k`, `redirect: 'manual'`, `credentials: 'omit'`, `cache: 'no-store'` e um `signal`

#### Scenario: Sem token
- **WHEN** `agents.list()`, `chat.send()` ou `chat.getTask()` é chamado sem sessão, ou com a sessão expirada
- **THEN** o resultado é `unauthorized` e o `fetch` não é chamado

#### Scenario: 401 descarta o token usado
- **WHEN** `chat.getTask()` é feito com o token `t0k` e a plataforma responde 401
- **THEN** `auth.discard('t0k')` é chamado e o resultado é `unauthorized`

#### Scenario: 401 antigo depois de um novo login
- **WHEN** uma consulta feita com o token `velho` está em andamento, um novo login define o token `novo` e a consulta então recebe 401
- **THEN** `auth.discard('velho')` é chamado e `getToken()` continua devolvendo `novo`

#### Scenario: Timeout da requisição
- **WHEN** a plataforma não responde em 15 s
- **THEN** a requisição é abortada e o resultado é `unreachable` com `message: 'timeout'`

### Requirement: Erros das chamadas mapeados para ChatError
As respostas e rejeições SHALL ser mapeadas assim:
- HTTP 401, com qualquer corpo → `unauthorized`;
- redirecionamento (rejeição com "redirect", `opaqueredirect`/status 0 ou 3xx) → `http` com o status, ou 0;
- outro status diferente de 200 → `http` com o status;
- rejeição `net::…` → `unreachable` com essa mensagem;
- timeout → `unreachable` com `'timeout'`;
- outra rejeição → `unreachable` com `'network'`.

No JSON-RPC, um HTTP 200 cujo corpo tem `error` MUST virar `rpc`, com `code` (inteiro) e `message` (string), mesmo que o corpo também traga `result`: `error` é verificado antes de `result`. `message` MUST ser usado só para exibição e log, nunca interpretado, e é cortado em 500 caracteres. Um 200 com corpo acima do limite (2 MiB em `/agents`, 1 MiB no JSON-RPC), JSON inválido, `error` sem `code` inteiro ou `message` string, ou `result` fora do formato esperado MUST virar `bad-response`.

#### Scenario: Erro JSON-RPC em HTTP 200
- **WHEN** `POST /agents/{id}/a2a` responde 200 com `{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32600, "message": "Requisição inválida." } }`
- **THEN** o resultado é `{ kind: 'rpc', code: -32600, message: 'Requisição inválida.' }`

#### Scenario: 401 com corpo vazio
- **WHEN** `POST /agents/{id}/a2a` responde 401 com corpo vazio
- **THEN** o resultado é `unauthorized`

#### Scenario: Status inesperado e redirecionamento
- **WHEN** `GET /agents` responde 500, ou o `fetch` rejeita com "Redirect was cancelled"
- **THEN** o resultado é `http` com status 500, ou com status 0, respectivamente

#### Scenario: Corpo malformado
- **WHEN** `GET /agents` responde 200 com `{}` (não é array) ou com texto que não é JSON
- **THEN** o resultado é `bad-response`

### Requirement: Lista de agentes
`agents.list()` SHALL chamar `GET {base}/agents` e devolver um `AgentSummary` por agente válido, só com `id`, `name`, `description` (`string` ou `null`), `isActive` e `skills[]` (`name`, `description` `string` ou `null`). Os outros campos, como `instructions`, `provider`, `model` e os vínculos, MUST ser descartados no main. Agentes inativos MUST vir na lista. Um item cujo `id` não é GUID, ou que não tem `name` string não vazia ou `isActive` booleano, MUST ser descartado sem invalidar os outros. Uma skill sem `name` string MUST ser descartada. A resposta inteira MUST ser `bad-response` só se o corpo não for um array.

#### Scenario: Lista com campos descartados
- **WHEN** `GET /agents` responde 200 com um agente com `id`, `name`, `description: null`, `isActive: false`, `skills: [{ "name": "Resumo", "description": null }]`, `instructions`, `provider` e `model`
- **THEN** o resultado tem um agente só com `id`, `name`, `description: null`, `isActive: false` e a skill, sem `instructions`, `provider` nem `model`

#### Scenario: Item com id inválido
- **WHEN** a lista traz dois agentes, um com `id: "../x"` e outro com GUID válido
- **THEN** o resultado tem só o agente de GUID válido

### Requirement: Envio de mensagem (SendMessage)
`chat.send(agentId, text, contextId)` SHALL fazer um `POST {base}/agents/{agentId}/a2a` com o corpo `{ "jsonrpc": "2.0", "id": <número>, "method": "SendMessage", "params": { "message": { "role": "ROLE_USER", "parts": [{ "text": <text> }], "messageId": <UUID>, "contextId": <contextId> } } }`. O `messageId` MUST ser um UUID novo a cada chamada. `contextId` MUST ser omitido quando `null`. A mensagem MUST NOT conter `taskId`. Nenhum método além de `SendMessage` e `GetTask` MUST ser chamado, nem `configuration` enviado.

O resultado SHALL ser `{ taskId, contextId, state, submittedAt }`, lido de `result.task`:
- `id` e `contextId` válidos pela regra de identificadores;
- `status.state` um dos cinco estados de `TaskState`;
- `submittedAt` é `status.timestamp` normalizado, ou `null` se ausente ou fora do formato ISO 8601 com fuso.

Um estado fora dos cinco, ou um id inválido, MUST virar `bad-response`. `TASK_STATE_REJECTED` já no `SendMessage` MUST ser devolvido como sucesso, com esse estado.

#### Scenario: Primeira mensagem sem contextId
- **WHEN** `chat.send(agentId, 'oi', null)` é chamado
- **THEN** o corpo enviado tem `method: "SendMessage"`, `params.message.role: "ROLE_USER"`, `parts: [{ text: "oi" }]`, um `messageId` UUID, e não tem `contextId` nem `taskId`

#### Scenario: Mensagem seguinte com contextId
- **WHEN** `chat.send(agentId, 'e agora?', 'ctx-1')` é chamado
- **THEN** `params.message.contextId` é `"ctx-1"` e a mensagem não tem `taskId`

#### Scenario: messageId novo a cada envio
- **WHEN** `chat.send` é chamado duas vezes com os mesmos argumentos
- **THEN** os dois `messageId` são UUIDs diferentes

#### Scenario: Resultado do envio
- **WHEN** a resposta é `result.task = { id: "t-1", contextId: "c-1", status: { state: "TASK_STATE_SUBMITTED", timestamp: "2026-10-24T18:24:00.1234567+00:00" } }`
- **THEN** o resultado é `{ taskId: 't-1', contextId: 'c-1', state: 'TASK_STATE_SUBMITTED', submittedAt: '2026-10-24T18:24:00.123Z' }`

#### Scenario: Rejeitada no envio
- **WHEN** a resposta do `SendMessage` tem `status.state: "TASK_STATE_REJECTED"`
- **THEN** o resultado é sucesso com `state: 'TASK_STATE_REJECTED'`

#### Scenario: Estado fora do contrato
- **WHEN** a resposta tem `status.state: "TASK_STATE_INPUT_REQUIRED"`
- **THEN** o resultado é `bad-response`

### Requirement: Consulta da task (GetTask)
`chat.getTask(agentId, taskId)` SHALL fazer um `POST {base}/agents/{agentId}/a2a` com `{ "jsonrpc": "2.0", "id": <número>, "method": "GetTask", "params": { "id": <taskId> } }` e devolver `{ state, text, timestamp }`:
- `state` é `result.status.state`, um dos cinco estados;
- `timestamp` é `result.status.timestamp` normalizado, ou `null`;
- `text`:
  - em `TASK_STATE_COMPLETED`, as partes com `text` string do **último** item de `result.artifacts`, unidas com `"\n\n"`. Partes sem `text` são ignoradas, e sem artifact ou sem parte de texto o valor é `""`;
  - nos outros estados, `null`.

A resposta MUST NOT ser lida de `status.message`. Um `result.id` diferente do `taskId` pedido, ou um estado fora dos cinco, MUST virar `bad-response`.

#### Scenario: Cada estado
- **WHEN** `GetTask` responde com `TASK_STATE_SUBMITTED`, `TASK_STATE_WORKING`, `TASK_STATE_FAILED` ou `TASK_STATE_REJECTED`
- **THEN** o resultado tem esse `state` e `text: null`

#### Scenario: Texto do último artifact
- **WHEN** `GetTask` responde `TASK_STATE_COMPLETED` com dois artifacts, o último com as partes `{ text: "a" }`, `{ data: {} }` e `{ text: "b" }`
- **THEN** `text` é `"a\n\nb"`

#### Scenario: Concluída sem texto
- **WHEN** `GetTask` responde `TASK_STATE_COMPLETED` sem `artifacts`
- **THEN** `text` é `""`

#### Scenario: Task de outro id
- **WHEN** `GetTask` para `t-1` responde com `result.id: "t-2"`
- **THEN** o resultado é `bad-response`

### Requirement: Identificadores validados
`agentId` SHALL ser um GUID (`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`), porque entra no caminho da URL. `taskId` e `contextId` SHALL seguir `^[A-Za-z0-9._:-]{1,128}$`. A mesma regra MUST valer para o que o renderer envia (no `parseArgs`) e para o que a plataforma devolve: um `taskId` ou `contextId` devolvido fora dela vira `bad-response`, para o renderer nunca receber um id que o IPC recusaria depois.

#### Scenario: contextId devolvido inválido
- **WHEN** o `SendMessage` devolve `contextId: "a/b"`
- **THEN** o resultado é `bad-response`

### Requirement: Canais IPC de agentes, conversa e cópia
O main SHALL registrar `agents:list`, `chat:send`, `chat:getTask` e `clipboard:writeText` pelo utilitário `handle()`, com `parseArgs`:
- `agents:list`: exatamente zero argumentos;
- `chat:send`: exatamente três argumentos, nesta ordem:
  - `agentId` GUID;
  - texto string com 1 a 16 000 caracteres (`length`), não só de espaços em branco;
  - `contextId` pela regra de identificadores, ou `null`;
- `chat:getTask`: exatamente dois argumentos, `agentId` GUID e `taskId` pela regra de identificadores;
- `clipboard:writeText`: exatamente um argumento, string com até 1024 caracteres.

As mensagens de erro de `parseArgs`, inclusive a `cause`, MUST NOT conter nenhum valor recebido. `EXPOSED_NAMESPACES` SHALL ser `['auth', 'agents', 'chat', 'clipboard']`. O preload MUST implementar cada função com um canal fixo.

#### Scenario: agentId com travessia de caminho
- **WHEN** `chat:send` ou `chat:getTask` recebe `agentId` igual a `../auth/login`, `x/y`, `x?y` ou um GUID com `/` no fim
- **THEN** a chamada é rejeitada e o cliente não é chamado

#### Scenario: Limites de tamanho
- **WHEN** `chat:send` recebe texto com 16 001 caracteres, texto vazio ou só com espaços, ou `contextId` com 129 caracteres; ou `clipboard:writeText` recebe 1025 caracteres
- **THEN** a chamada é rejeitada e o cliente não é chamado

#### Scenario: Limites aceitos
- **WHEN** `chat:send` recebe texto com 16 000 caracteres e `contextId` com 128, e `clipboard:writeText` recebe 1024
- **THEN** as chamadas são aceitas

#### Scenario: Mensagem de erro sem valores
- **WHEN** `chat:send` recebe `agentId` igual a `../segredo` e texto `senha123` acima do limite
- **THEN** a chamada é rejeitada, e nem a mensagem do erro nem a da `cause` contêm `segredo`, `senha123` ou o `agentId`

#### Scenario: Tipagem do renderer
- **WHEN** o `typecheck` roda
- **THEN** `window.buteco.agents`, `window.buteco.chat` e `window.buteco.clipboard` compilam no renderer

### Requirement: Cópia pela área de transferência no main
`clipboard.writeText(text)` SHALL escrever o texto na área de transferência do sistema pelo módulo `clipboard` do Electron, no main. A negação de permissões do renderer (requisito 'Permissões negadas' de `janela-segura`) MUST continuar valendo.

#### Scenario: Copiar
- **WHEN** o renderer chama `clipboard.writeText('ctx-1')`
- **THEN** o main chama `clipboard.writeText('ctx-1')` do Electron

### Requirement: Layout da tela de conversas
Autenticado, o renderer SHALL mostrar a tela de conversas, com altura da janela:
- uma linha com a barra lateral à esquerda (288 px, superfície, borda à direita) e a área principal à direita;
- na área principal, o cabeçalho (superfície, borda inferior, padding 12×24), a timeline (coluna central de até 760 px, 18 px entre itens) e o composer (até 760 px).

Abaixo de 860 px de largura, a barra lateral MUST passar para cima da área principal, com largura total. A interface MUST usar os tokens do tema nos esquemas claro e escuro.

#### Scenario: Largura estreita
- **WHEN** a janela tem menos de 860 px de largura
- **THEN** a barra lateral aparece acima da área principal

### Requirement: Barra lateral
A barra lateral SHALL conter, nesta ordem:
1. a marca: ícone de balão na cor primária, "Buteco" em peso 600 e "Chat" em cor secundária, 14 px;
2. o rótulo de seção "AGENTE" e o seletor de agente (34 px, raio 7 px);
3. o botão primário preenchido **Nova conversa**, largura total, 34 px, com ícone "+";
4. um espaço vazio, que ocupa a altura entre **Nova conversa** e o rodapé;
5. o rodapé de sessão, separado por borda.

No seletor:
- cada agente aparece pelo nome;
- os inativos aparecem desabilitados, com o sufixo " (inativo)";
- a seleção inicial é o primeiro agente ativo da lista.

#### Scenario: Ordem e textos
- **WHEN** a tela de conversas aparece com agentes carregados
- **THEN** a barra lateral mostra, em ordem, "Buteco", "Chat", "AGENTE", o seletor, **Nova conversa** e o rodapé

#### Scenario: Agente inativo no seletor
- **WHEN** a lista tem "Atendente" ativo e "Antigo" inativo
- **THEN** o seletor oferece "Antigo (inativo)" desabilitado e começa em "Atendente"

### Requirement: Rodapé de sessão
O rodapé SHALL mostrar:
- um avatar circular com as iniciais do usuário;
- "{usuário} @ {host}", com o usuário em peso 500 e "@ {host}" em mono 11 px, cor secundária;
- "Sessão válida por mais {n} min" (11 px, cor secundária; `n` arredondado para cima a partir de `expiresAt`) ou, na sessão expirada, "Sessão expirada" (11 px, `--mantine-color-red-text`);
- o botão **Sair** só com ícone de saída e `aria-label="Sair"`.

**Sair** MUST interromper o polling e chamar `logout()`, e o app volta à tela de login com usuário e senha vazios. Quando o tempo restante chega a zero, o renderer MUST entrar no estado de sessão expirada (requisito 'Sessão expirada durante o uso'), sem chamar `status()` nem voltar à tela de login. Depois de um novo login, o tempo restante MUST ser contado a partir do `expiresAt` novo.

#### Scenario: Identificação e tempo restante
- **WHEN** a sessão é de `ana` em `http://localhost:5017`, com `expiresAt` 30 min à frente
- **THEN** o rodapé mostra o avatar "AN", "ana", "@ localhost:5017" e "Sessão válida por mais 30 min"

#### Scenario: Sair
- **WHEN** o usuário clica no botão de nome acessível "Sair"
- **THEN** `logout()` é chamado e a tela de acessos seguintes aparece, com usuário e senha vazios

#### Scenario: Tempo esgotado
- **WHEN** o tempo restante chega a zero
- **THEN** o rodapé mostra "Sessão expirada", o banner aparece, a conversa continua visível, e nem `status()` nem `logout()` são chamados

#### Scenario: Tempo restante depois do novo login
- **WHEN** a sessão expirou e o novo login devolve `expiresAt` 30 min à frente
- **THEN** o rodapé volta a mostrar "Sessão válida por mais 30 min"

### Requirement: Carregamento da lista de agentes
O renderer SHALL chamar `agents.list()` ao mostrar a tela de conversas, ao clicar em **Nova conversa**, depois de um `TASK_STATE_REJECTED` e depois de um novo login que retoma uma carga recusada com `unauthorized`.

Durante a primeira carga, a área principal MUST mostrar "Carregando agentes…". Os outros casos:
- **falha**, exceto `unauthorized`: bloco de erro "Não foi possível carregar os agentes." com **Tentar de novo**;
- **lista vazia**: "Nenhum agente cadastrado na plataforma.";
- **só agentes inativos**: "Nenhum agente ativo no momento.".

Nesses três casos, o composer fica bloqueado. Uma recarga que falha depois da primeira, com qualquer erro exceto `unauthorized`, MUST manter a lista anterior, sem bloco de erro. Um `unauthorized`, na primeira carga ou numa recarga, MUST seguir o requisito 'Sessão expirada durante o uso': a lista anterior, se houver, continua no seletor, e a carga é refeita depois do novo login (requisito 'Retomada depois do novo login').

#### Scenario: Falha ao carregar
- **WHEN** `agents.list()` devolve `unreachable` na primeira carga
- **THEN** aparece "Não foi possível carregar os agentes." com **Tentar de novo**, e o clique chama `agents.list()` de novo

#### Scenario: Recarga com falha passageira
- **WHEN** a recarga da lista depois de um `TASK_STATE_REJECTED` devolve `unreachable`
- **THEN** a lista anterior continua no seletor e nenhum bloco de erro aparece

#### Scenario: Recarga com sessão expirada
- **WHEN** a recarga da lista depois de um `TASK_STATE_REJECTED` devolve `unauthorized`
- **THEN** `auth.logout()` não é chamado, a lista anterior continua no seletor, e o banner "Sua sessão expirou." aparece

#### Scenario: Só inativos
- **WHEN** todos os agentes da lista são inativos
- **THEN** aparece "Nenhum agente ativo no momento." e o envio fica bloqueado

### Requirement: Cabeçalho da conversa
O cabeçalho SHALL mostrar:
- **o título** (15 px, peso 600, truncado):
  - antes do primeiro envio, "Nova conversa";
  - depois, os primeiros 40 caracteres da primeira mensagem, com quebras de linha e espaços em sequência trocados por um espaço e sem espaços nas pontas, seguidos de "…" quando a mensagem é mais longa;
- **abaixo do título**, "contextId" (12 px, cor secundária) e:
  - sem `contextId`, "— aguardando o primeiro envio";
  - com `contextId`, o valor abreviado em mono 11 px: os 8 primeiros caracteres, "…" e os 4 últimos, ou o valor inteiro se tiver até 12 caracteres. Ao lado vem o botão discreto **Copiar** (ícone de cópia e texto, 11 px);
- **à direita**, o nome do agente num selo neutro e o selo **Ativo** (verde claro) ou **Inativo** (neutro).

#### Scenario: Antes do primeiro envio
- **WHEN** a conversa ainda não teve envio
- **THEN** o título é "Nova conversa", aparece "— aguardando o primeiro envio" e não há **Copiar**

#### Scenario: contextId abreviado
- **WHEN** o `contextId` da conversa é `3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f`
- **THEN** o cabeçalho mostra `3a7d9f10…4e5f` e o botão **Copiar**

#### Scenario: Título da primeira mensagem
- **WHEN** a primeira mensagem tem 60 caracteres, com uma quebra de linha no meio
- **THEN** o título tem os 40 primeiros caracteres, sem a quebra, seguidos de "…"

### Requirement: Copiar o contextId
**Copiar** SHALL chamar `clipboard.writeText` com o `contextId` completo e trocar o texto do botão para "Copiado" por 1,5 s, voltando depois para "Copiar".

#### Scenario: Copiado
- **WHEN** o usuário clica em **Copiar**
- **THEN** `clipboard.writeText` recebe o `contextId` completo, o botão mostra "Copiado" e volta a "Copiar" depois de 1,5 s

### Requirement: Conversa vazia
Antes do primeiro envio, a área da timeline SHALL mostrar um cartão centralizado com:
- o rótulo "NOVA CONVERSA COM";
- o nome do agente (17 px, peso 600);
- a descrição em cor secundária, omitida quando `null`;
- as skills como selos neutros;
- a nota "O contextId desta conversa é atribuído no primeiro envio." (12 px, cor secundária).

#### Scenario: Cartão do agente
- **WHEN** o agente selecionado é "Atendente", com descrição "Responde dúvidas" e as skills "Resumo" e "Tradução", e a conversa está vazia
- **THEN** o cartão mostra "NOVA CONVERSA COM", "Atendente", "Responde dúvidas", os selos "Resumo" e "Tradução" e a nota do contextId

### Requirement: Timeline
Os itens SHALL aparecer em ordem de envio.
- **Separador de dia**: antes do primeiro item de cada dia local, uma linha fina, o rótulo (11 px, cor secundária) e outra linha fina. O rótulo é "Hoje", "Ontem" ou a data `dd/mm/aaaa`.
- **Mensagem do usuário**:
  - à direita, num balão com fundo `--mantine-color-butecoBlue-light`, raio `11 11 4 11`, padding 8×12, largura máxima de 80% e quebras de linha preservadas;
  - abaixo, o horário local de envio `HH:mm` (11 px, cor secundária).
- **Resposta do agente**:
  - à esquerda, um avatar circular de 26 px (superfície, borda, ícone de robô na cor primária);
  - ao lado, o nome do agente (12 px, peso 600) e o horário local de chegada `HH:mm` (11 px, cor secundária);
  - o texto em Markdown;
  - a linha de metadados em mono 11 px, cor secundária: `task {8 primeiros caracteres do taskId} · Completed · {duração} s`.

A duração tem uma casa decimal com vírgula (por exemplo `3,2`). Ela é o `timestamp` do `GetTask` terminal menos o `submittedAt` do envio. Quando um dos dois é `null` ou a diferença é negativa, o renderer usa o relógio local, do início do envio até a chegada do estado terminal.

#### Scenario: Mensagem e resposta
- **WHEN** o usuário envia "linha 1\nlinha 2" e a task `1a2b3c4d-…` completa com `submittedAt` `18:24:00.000Z` e `timestamp` `18:24:03.240Z`
- **THEN** o balão mostra as duas linhas, a resposta mostra o nome do agente e o texto, e a linha de metadados é `task 1a2b3c4d · Completed · 3,2 s`

#### Scenario: Duração pelo relógio local
- **WHEN** o `GetTask` terminal devolve `timestamp: null`, e 4,5 s se passaram no relógio do renderer entre o envio e a chegada
- **THEN** a linha de metadados termina em `4,5 s`

#### Scenario: Separador de dia
- **WHEN** a conversa tem itens de hoje
- **THEN** antes do primeiro aparece o separador "Hoje"

### Requirement: Polling da task
Depois de um envio que devolve estado não terminal, o renderer SHALL consultar `chat.getTask` até o primeiro estado terminal (`COMPLETED`, `FAILED` ou `REJECTED`).
- Cada consulta MUST ser agendada 1 s depois da resposta da anterior, com `setTimeout` encadeado, nunca `setInterval`. Assim, nunca há duas consultas da mesma task ao mesmo tempo.
- O prazo é de 90 s a partir do envio, configurável. Ele MUST ser medido pelo relógio injetado, comparando `now()` com o limite a cada resposta e antes de agendar a próxima consulta, nunca pela contagem de consultas. Esgotado o prazo, o turno vai para o estado "sem resposta a tempo".
- `unreachable` e `http` 5xx numa consulta MUST NOT encerrar o turno: o polling continua até o prazo.
- `rpc`, `bad-response` e `http` diferente de 5xx MUST encerrar o turno com o bloco "Não foi possível acompanhar a resposta do agente." e **Reenviar**.
- `unauthorized` MUST interromper o polling e guardar a task para a retomada (requisitos 'Sessão expirada durante o uso' e 'Retomada depois do novo login'). Na retomada, o polling da mesma task recomeça com prazo novo de 90 s a partir da retomada; o tempo de espera do login não conta no prazo.
- **Nova conversa**, troca de agente, **Sair** e a entrada na sessão expirada MUST interromper o polling, e a resposta de uma consulta já em andamento MUST ser descartada (contador de geração).

A lógica do polling MUST ser uma máquina de estados pura, com relógio e timers injetados, testável com timers falsos.

#### Scenario: Consulta encadeada
- **WHEN** o envio devolve `TASK_STATE_SUBMITTED` e a primeira consulta demora 3 s para responder `TASK_STATE_WORKING`
- **THEN** a segunda consulta acontece 1 s depois dessa resposta, e não durante a espera

#### Scenario: Prazo pelo relógio com consultas atrasadas
- **WHEN** os timers disparam com atraso (cada consulta agendada para 1 s dispara depois de 20 s), e o relógio passa de 90 s desde o envio na quinta consulta
- **THEN** o turno vai para "sem resposta a tempo" na resposta dessa consulta, e não depois de 90 consultas

#### Scenario: Erro passageiro
- **WHEN** uma consulta devolve `unreachable` e a seguinte devolve `TASK_STATE_COMPLETED`
- **THEN** a resposta aparece normalmente

#### Scenario: Task não encontrada
- **WHEN** uma consulta devolve `rpc` com `code: -32001`
- **THEN** o polling para e aparece "Não foi possível acompanhar a resposta do agente." com **Reenviar**

#### Scenario: Resposta descartada depois de Nova conversa
- **WHEN** uma consulta está em andamento, o usuário começa uma nova conversa e a consulta então responde `TASK_STATE_COMPLETED`
- **THEN** a nova conversa continua vazia e nenhuma consulta é agendada

#### Scenario: Consulta em andamento quando o contador chega a zero
- **WHEN** uma consulta está em andamento, o tempo restante chega a zero e a consulta então responde `TASK_STATE_WORKING`
- **THEN** nenhuma consulta é agendada até o novo login, e depois dele o polling continua na mesma task

### Requirement: Resposta pendente
Enquanto a task não chega a um estado terminal, a timeline SHALL mostrar, à esquerda, o avatar do agente com um ponto animado e uma pílula (superfície, borda, raio 9 px) com três pontos animados, "Processando" (12 px, cor secundária) e `task {8 caracteres} · {estado}` em mono 11 px. O estado é `Submitted` ou `Working`, conforme o último estado conhecido. O bloco MUST ter `role="status"`.

Na sessão expirada, a mesma pílula MUST trocar "Processando" por:
- "Aguardando novo login para retomar", mantendo `task {8 caracteres} · {estado}`, quando há uma task guardada;
- "Aguardando novo login para enviar", sem a linha da task, quando o envio foi retido.

#### Scenario: Pendente
- **WHEN** a última consulta devolveu `TASK_STATE_WORKING` para a task `9f8e7d6c-…`
- **THEN** aparece um elemento com `role="status"` contendo "Processando" e `task 9f8e7d6c · Working`

#### Scenario: Pendente aguardando o novo login
- **WHEN** a task `9f8e7d6c-…` estava em `TASK_STATE_WORKING` e uma consulta devolve `unauthorized`
- **THEN** o elemento com `role="status"` mostra "Aguardando novo login para retomar" e `task 9f8e7d6c · Working`, sem "Processando"

#### Scenario: Envio retido
- **WHEN** `chat.send` devolve `unauthorized`
- **THEN** o elemento com `role="status"` mostra "Aguardando novo login para enviar", sem linha de task

### Requirement: Resposta concluída
Em `TASK_STATE_COMPLETED`, a timeline SHALL trocar o pendente pela resposta do agente (requisito 'Timeline'). Com `text` vazio ou só de espaços, o lugar do texto MUST mostrar "O agente não devolveu texto." em cor secundária.

#### Scenario: Concluída sem texto
- **WHEN** o `GetTask` devolve `TASK_STATE_COMPLETED` com `text: ""`
- **THEN** a resposta mostra "O agente não devolveu texto." e a linha de metadados

### Requirement: Blocos de estado
Os blocos de falha SHALL seguir o padrão do bloco de falha do protótipo:
- fundo `--mantine-color-red-light`;
- ícone de alerta;
- título em peso 600 e uma linha explicativa, com o texto em `--buteco-color-error-text`;
- a linha de metadados, quando há task;
- botões de contorno vermelho;
- `role="alert"`.

Os blocos SHALL ser:

| Situação | Título | Linha explicativa | Metadados | Ações |
|---|---|---|---|---|
| `TASK_STATE_FAILED` | "O agente não conseguiu responder." | "A plataforma não informa o motivo. Você pode reenviar a mensagem." | `task {8} · Failed` | **Reenviar** |
| `TASK_STATE_REJECTED` | "O agente não aceitou a mensagem: pode estar inativo ou sem modelo configurado." | — | `task {8} · Rejected` | nenhuma |
| prazo esgotado | "O agente não respondeu a tempo." | "Se a primeira tentativa terminar depois, o agente pode ver a pergunta duas vezes." | `task {8} · {último estado}` | **Continuar aguardando**, **Reenviar** |
| falha no envio (`unreachable`, `http`, `bad-response`) | "Não foi possível confirmar o envio da mensagem." | "Confira a conexão com o serviço e tente de novo." | — | **Reenviar** |
| falha no envio (`rpc`) | "A plataforma recusou a mensagem." | a `message` do erro | `erro {code}` | **Reenviar** |
| falha no polling | "Não foi possível acompanhar a resposta do agente." | — | `task {8}` | **Reenviar** |

Regras dos botões:
- **Reenviar** MUST fazer um `chat.send` novo com o mesmo texto e o `contextId` atual da conversa: o da primeira resposta, ou `null` se a primeira mensagem nunca chegou a ter `contextId`. O bloco é trocado pelo pendente do envio novo, sem repetir o balão do usuário.
- No bloco de prazo esgotado, **Reenviar** MUST consultar antes `chat.getTask` da task original:
  - se ela estiver `COMPLETED`, mostra essa resposta e não reenvia;
  - nos outros casos, inclusive erro, reenvia.
- **Continuar aguardando** MUST retomar o polling da mesma task, com prazo novo de 90 s a partir do clique.

#### Scenario: Falha e Reenviar no mesmo contextId
- **WHEN** a task da segunda mensagem termina em `TASK_STATE_FAILED` e o usuário clica em **Reenviar**
- **THEN** `chat.send` é chamado com o mesmo texto e o `contextId` da conversa, o bloco de falha some e aparece o pendente, sem um segundo balão do usuário

#### Scenario: Rejeitada no envio
- **WHEN** `chat.send` devolve `state: 'TASK_STATE_REJECTED'`
- **THEN** aparece o bloco "O agente não aceitou a mensagem: pode estar inativo ou sem modelo configurado.", sem **Reenviar**, nenhuma consulta é feita e `agents.list()` é chamado

#### Scenario: Sem resposta a tempo e Continuar aguardando
- **WHEN** o prazo esgota e o usuário clica em **Continuar aguardando**
- **THEN** o pendente volta e o polling da mesma task continua por mais 90 s

#### Scenario: Reenviar depois do prazo com a original concluída
- **WHEN** o prazo esgotou, o usuário clica em **Reenviar** e `chat.getTask` da task original devolve `TASK_STATE_COMPLETED` com texto
- **THEN** a resposta original aparece e `chat.send` não é chamado

#### Scenario: Reenviar depois do prazo com a original pendente
- **WHEN** o prazo esgotou, o usuário clica em **Reenviar** e `chat.getTask` da task original devolve `TASK_STATE_WORKING`
- **THEN** `chat.send` é chamado com o mesmo texto e o mesmo `contextId`

#### Scenario: Falha ambígua no envio
- **WHEN** `chat.send` devolve `unreachable` com `message: 'timeout'`
- **THEN** aparece "Não foi possível confirmar o envio da mensagem." com **Reenviar**, e nenhum texto afirma que a mensagem não foi enviada

### Requirement: Markdown das respostas
O texto das respostas SHALL ser renderizado como Markdown com GFM (tabelas, listas de tarefas, tachado, links automáticos), por `react-markdown` e `remark-gfm`, sem nenhum plugin que interprete HTML bruto.
- O HTML no texto MUST aparecer como texto, sem criar elementos.
- Links MUST ser `<a>` com o `href` depois do `urlTransform` padrão, que descarta `javascript:` e afins. O clique é resolvido pela política de navegação (requisito 'Navegação bloqueada dentro do app' de `janela-segura`), que abre http(s) no navegador padrão e descarta o resto, sem handler próprio no renderer.
- Imagens MUST ser renderizadas como link para a URL, com o texto `alt`, ou a URL quando o `alt` é vazio. Nenhum `<img>` é criado.
- Código, inline ou em bloco, MUST usar Plex Mono. O bloco tem rolagem horizontal.

#### Scenario: HTML bruto como texto
- **WHEN** a resposta é `<b>oi</b><script>x()</script>`
- **THEN** nenhum elemento `b` ou `script` é criado e o texto `<b>oi</b>` aparece literalmente

#### Scenario: Link
- **WHEN** a resposta é `[docs](https://exemplo.com)` e `[x](javascript:alert(1))`
- **THEN** o primeiro vira `<a href="https://exemplo.com">docs</a>`, e o segundo não tem `href` com `javascript:`

#### Scenario: Imagem como link
- **WHEN** a resposta é `![gráfico](https://exemplo.com/g.png)` e `![](https://exemplo.com/h.png)`
- **THEN** não há `<img>`, e aparecem os links "gráfico" e "https://exemplo.com/h.png" para as URLs

#### Scenario: Código e tabela
- **WHEN** a resposta tem um bloco de código e uma tabela GFM
- **THEN** o código é renderizado em `pre`/`code` com a fonte monoespaçada do tema e a tabela como `table`

### Requirement: Composer
Abaixo da timeline, o renderer SHALL mostrar uma caixa (superfície, borda, raio 11 px) com:
- um textarea de 2 linhas, sem borda, com placeholder "Mensagem para {agente}";
- o botão de enviar (34 px, primário preenchido, ícone de seta para cima, `aria-label="Enviar mensagem"`).

Abaixo da caixa, "Enter envia · Shift+Enter quebra a linha" (11 px, cor secundária).
- Enter MUST enviar e Shift+Enter MUST quebrar a linha. Enter durante composição de IME MUST NOT enviar.
- O texto vai como foi digitado, e o campo é limpo depois do envio.
- Enviar fica desabilitado com texto vazio ou só de espaços.
- **Limite de 16 000 caracteres:**
  - a partir de 14 400, aparece um contador "{n} / 16.000" (11 px, cor secundária);
  - acima do limite, o texto não é cortado, o envio fica desabilitado e aparece "A mensagem passa do limite de 16.000 caracteres." na cor de validação.
- **Envio bloqueado**, com o textarea desabilitado e um placeholder próprio:
  - na sessão expirada: "Entre novamente para continuar", que prevalece sobre os demais;
  - com resposta pendente ou no estado "sem resposta a tempo": "Aguardando a resposta do agente…";
  - com o agente da conversa inativo (requisito 'Agente da conversa inativo');
  - durante a carga ou a falha da lista de agentes, ou sem agente ativo.
- **Foco**: quando o envio deixa de estar bloqueado, o foco MUST voltar ao textarea só se estava nele quando o bloqueio começou e nenhum outro elemento recebeu foco no intervalo.

#### Scenario: Foco devolvido depois da resposta
- **WHEN** o usuário envia com Enter, com o foco no textarea, e a resposta chega
- **THEN** o foco volta ao textarea

#### Scenario: Foco não é puxado de volta
- **WHEN** durante a espera o usuário leva o foco a outro elemento, ou o foco não estava no textarea quando o envio começou
- **THEN** a resposta chega e o foco não vai para o textarea

#### Scenario: Enter e Shift+Enter
- **WHEN** o usuário digita "oi", pressiona Shift+Enter, digita "tudo bem?" e pressiona Enter
- **THEN** `chat.send` recebe `"oi\ntudo bem?"` e o campo fica vazio

#### Scenario: Envio desabilitado com texto vazio
- **WHEN** o campo está vazio ou só tem espaços e quebras de linha
- **THEN** o botão "Enviar mensagem" está desabilitado e Enter não chama `chat.send`

#### Scenario: Bloqueado durante a espera
- **WHEN** há uma resposta pendente
- **THEN** o placeholder é "Aguardando a resposta do agente…", o textarea e o botão estão desabilitados, e Enter não chama `chat.send`

#### Scenario: Bloqueado no estado sem resposta a tempo
- **WHEN** o prazo da task esgotou e o usuário ainda não escolheu nenhuma ação
- **THEN** o composer continua bloqueado

#### Scenario: Bloqueado na sessão expirada
- **WHEN** a sessão expira com a conversa parada e o agente ativo
- **THEN** o placeholder é "Entre novamente para continuar", o textarea e o botão estão desabilitados, e depois do novo login o placeholder volta a "Mensagem para {agente}"

#### Scenario: Acima do limite
- **WHEN** o usuário cola 16 001 caracteres
- **THEN** o campo mantém os 16 001 caracteres, aparecem "16.001 / 16.000" e "A mensagem passa do limite de 16.000 caracteres.", e o envio fica desabilitado

### Requirement: Nova conversa e troca de agente
**Nova conversa** e a troca de agente no seletor SHALL descartar a conversa atual e começar uma vazia, sem `contextId`, com o agente selecionado. Quando a conversa atual tem ao menos uma mensagem, o renderer MUST pedir confirmação num modal:
- **Nova conversa**: "Começar uma nova conversa descarta a atual." Botões **Cancelar** e **Começar nova conversa**;
- **troca de agente**: "Trocar de agente começa uma nova conversa e descarta a atual." Botões **Cancelar** e **Trocar de agente**;
- com resposta pendente ou no estado "sem resposta a tempo", o texto acrescenta "A resposta pendente também será descartada.".

**Cancelar** mantém a conversa e, na troca, volta o seletor ao agente atual. Com a conversa vazia, a troca é imediata e sem modal. A conversa descartada não fica guardada em lugar nenhum.

#### Scenario: Conversa vazia sem confirmação
- **WHEN** a conversa não tem mensagens e o usuário escolhe outro agente ou clica em **Nova conversa**
- **THEN** nenhum modal aparece, e a conversa vazia mostra o cartão do agente selecionado

#### Scenario: Trocar de agente com mensagens
- **WHEN** a conversa tem mensagens e o usuário escolhe outro agente no seletor
- **THEN** aparece o modal "Trocar de agente começa uma nova conversa e descarta a atual."; **Trocar de agente** mostra a conversa vazia do novo agente, e **Cancelar** mantém a conversa e o seletor no agente anterior

#### Scenario: Nova conversa com resposta pendente
- **WHEN** há resposta pendente e o usuário clica em **Nova conversa** e confirma
- **THEN** o polling para, a conversa vazia aparece e a próxima mensagem é enviada sem `contextId`

### Requirement: Agente da conversa inativo
Quando uma recarga da lista mostra o agente da conversa atual inativo, ou ausente da lista, o renderer SHALL:
- trocar o selo do cabeçalho para **Inativo**;
- bloquear o composer com o placeholder "{agente} está inativo. Escolha outro agente ou comece uma nova conversa.".

A conversa e as mensagens MUST continuar visíveis. Se o agente voltar a ficar ativo numa recarga seguinte, o selo e o composer MUST voltar ao normal.

#### Scenario: Rejeitada e agente inativo
- **WHEN** um envio devolve `TASK_STATE_REJECTED` e a recarga da lista mostra o agente com `isActive: false`
- **THEN** o selo mostra **Inativo** e o composer fica bloqueado com "{agente} está inativo. Escolha outro agente ou comece uma nova conversa."

### Requirement: Sessão expirada durante o uso
O renderer SHALL entrar no estado de sessão expirada, sem sair da tela de conversas, quando:
- qualquer chamada de `agents.list`, `chat.send` ou `chat.getTask` devolve `unauthorized`, inclusive com tempo restante no rodapé (token recusado pela plataforma);
- o tempo restante do rodapé chega a zero.

Nesse estado:
- a conversa, as mensagens, o `contextId` e a lista de agentes carregada MUST ser mantidos;
- o renderer MUST NOT chamar `auth.logout()` nem voltar à tela de login;
- o polling MUST ser interrompido, sem nenhuma consulta agendada;
- nenhuma chamada a `chat.send` MUST acontecer até o novo login.

Entrar no estado já estando nele MUST NOT mudar nada além do que fica guardado para a retomada (requisito 'Retomada depois do novo login'). Um `chat.send` já em andamento ao entrar no estado MUST ter o resultado aproveitado: com sucesso, a task devolvida fica guardada para retomar o polling, sem consulta até o novo login.

#### Scenario: 401 durante o polling
- **WHEN** uma consulta da task devolve `unauthorized`
- **THEN** nenhuma consulta é agendada, `auth.logout()` não é chamado, a conversa continua visível e o banner "Sua sessão expirou." aparece

#### Scenario: Token recusado com tempo restante
- **WHEN** o rodapé mostra "Sessão válida por mais 20 min" e `chat.send` devolve `unauthorized`
- **THEN** o rodapé mostra "Sessão expirada" e o banner aparece

#### Scenario: Envio em andamento quando o contador chega a zero
- **WHEN** um `chat.send` está em andamento, o tempo restante chega a zero e o envio então devolve a task `9f8e7d6c-…` em `TASK_STATE_SUBMITTED`
- **THEN** nenhuma consulta é feita, a pílula mostra "Aguardando novo login para retomar" e `task 9f8e7d6c · Submitted`, e depois do novo login o polling dessa task começa sem novo `chat.send`

### Requirement: Banner de sessão expirada
Na sessão expirada, o renderer SHALL mostrar um banner acima do composer, dentro da coluna de até 760 px, com:
- fundo `--mantine-color-yellow-light`, texto em `--buteco-color-warning-text`, raio 9 px e `role="alert"`;
- um ícone de cadeado;
- o título "Sua sessão expirou." em peso 600;
- uma linha explicativa em `--mantine-color-text`;
- o botão primário preenchido **Entrar novamente**, que abre o modal de novo login.

A linha explicativa MUST depender do que está guardado para a retomada:
- **resposta pendente** (polling interrompido): "A resposta em andamento continua sendo processada. Entre de novo para retomá-la — nada será reenviado.";
- **envio retido** (401 no `chat.send`): "Sua mensagem ainda não foi enviada. Entre de novo para enviá-la — ela será enviada uma única vez.";
- **nada em andamento**, com ou sem conversa: "Entre de novo para continuar."

O rodapé de sessão MUST trocar "Sessão válida por mais {n} min" por "Sessão expirada" (11 px, `--mantine-color-red-text`), mantendo avatar, usuário, host e **Sair**.

#### Scenario: Banner com resposta pendente
- **WHEN** a sessão expira com uma task em `TASK_STATE_WORKING`
- **THEN** um elemento com `role="alert"` mostra "Sua sessão expirou.", "A resposta em andamento continua sendo processada. Entre de novo para retomá-la — nada será reenviado." e **Entrar novamente**

#### Scenario: Banner com envio retido
- **WHEN** `chat.send` devolve `unauthorized`
- **THEN** o banner mostra "Sua mensagem ainda não foi enviada. Entre de novo para enviá-la — ela será enviada uma única vez."

#### Scenario: Banner sem nada em andamento
- **WHEN** o tempo restante chega a zero com a última resposta já concluída
- **THEN** o banner mostra "Entre de novo para continuar." e o rodapé mostra "Sessão expirada"

### Requirement: Novo login sem sair da conversa
**Entrar novamente** SHALL abrir um modal (`role="dialog"`, largura máxima de 360 px, superfície, raio 11 px) com:
- o título "Entrar novamente" (17 px, peso 600) e, conforme o caso, um subtítulo em cor secundária:
  - resposta pendente: "A conversa e a resposta em andamento continuam onde estavam.";
  - envio retido: "A conversa continua onde estava. A mensagem será enviada depois do login.";
  - nada em andamento, com ou sem conversa: sem subtítulo;
- "Serviço": o endereço da sessão em mono 12 px, somente leitura (superfície sutil, borda, raio 7 px), sem **Alterar**;
- "Usuário": o usuário da sessão, somente leitura;
- "Senha": `type="password"`, `autocomplete="current-password"`, com o foco ao abrir;
- **Cancelar** (contorno) e **Entrar** (primário preenchido), alinhados à direita.

Regras:
- **Entrar** chama `auth.login` com o endereço e o usuário da sessão e a senha digitada. Fica desabilitado com a senha vazia e mostra carregamento durante o login; nesse tempo, a senha fica desabilitada, e **Cancelar**, Esc e o clique fora MUST NOT fechar o modal.
- Só o resultado da última tentativa MUST ter efeito na tela. O resultado de uma tentativa substituída é descartado.
- Um erro aparece no bloco de erro do modal, com os textos da tela de login (requisito 'Envio e mensagens de erro do login' de `autenticacao`) e `{endereço}` igual ao endereço da sessão.
  - Depois de `invalid-credentials`, a senha MUST ser limpa.
  - Depois de `unreachable`, `http` ou `bad-response`, a senha é mantida.
  - Em qualquer erro, o modal MUST continuar aberto e o que estava guardado para a retomada MUST ser mantido.
- **Cancelar**, Esc e o clique fora fecham o modal sem chamar `auth`. O banner continua, e **Entrar novamente** reabre o modal com a senha vazia e sem erro.
- O modal não oferece caminho para trocar de serviço ou de usuário.
- O endereço não é gravado de novo no `localStorage`.

#### Scenario: Modal preenchido com a sessão
- **WHEN** a sessão de `ana` em `http://localhost:5017` expira com uma resposta pendente e o usuário clica em **Entrar novamente**
- **THEN** aparece um `role="dialog"` com "Entrar novamente", "A conversa e a resposta em andamento continuam onde estavam.", "http://localhost:5017" somente leitura, o campo "Usuário" somente leitura com `ana` e o campo "Senha" vazio e com foco

#### Scenario: Modal sem nada em andamento
- **WHEN** a sessão expira pelo contador com a última resposta já concluída e o usuário clica em **Entrar novamente**
- **THEN** o modal mostra "Entrar novamente" sem subtítulo, seguido de "Serviço"

#### Scenario: Senha errada no modal
- **WHEN** o novo login devolve `invalid-credentials`
- **THEN** o modal continua aberto, mostra "Usuário ou senha incorretos." e o campo "Senha" fica vazio

#### Scenario: Serviço fora do ar no modal
- **WHEN** o novo login em `http://localhost:5017` devolve `unreachable` com uma resposta pendente guardada
- **THEN** o modal continua aberto com "Não foi possível conectar a http://localhost:5017. Confira o endereço e se o serviço está no ar.", a senha é mantida, e um login seguinte bem-sucedido retoma o polling da task

#### Scenario: Erro HTTP e resposta inesperada no modal
- **WHEN** o novo login devolve `{ kind: 'http', status: 500 }` ou `bad-response`
- **THEN** o modal continua aberto com a mensagem correspondente da tela de login, e o banner continua

#### Scenario: Cancelar
- **WHEN** o usuário abre o modal e clica em **Cancelar**
- **THEN** o modal fecha, `auth.login` não é chamado, o banner continua e **Sair** continua disponível

#### Scenario: Login em andamento no modal
- **WHEN** o usuário clica em **Entrar** e a resposta ainda não chegou
- **THEN** **Entrar** mostra carregamento, e **Cancelar** e Esc não fecham o modal

#### Scenario: Resultado de tentativa substituída
- **WHEN** uma tentativa de login devolve `{ kind: 'unreachable', message: 'cancelled' }` depois de uma tentativa seguinte ter começado
- **THEN** nenhuma mensagem de erro aparece por causa dela

### Requirement: Retomada depois do novo login
Depois de um novo login bem-sucedido no modal, o renderer SHALL, uma única vez:
- fechar o modal e tirar o banner;
- voltar o rodapé a "Sessão válida por mais {n} min", com o `expiresAt` novo;
- liberar o composer e as ações bloqueadas;
- retomar o que estava guardado:
  - **resposta pendente** (401 no `chat.getTask`, ou envio que deu certo durante a expiração): retomar o polling da **mesma** task, com prazo novo de 90 s a partir da retomada, sem chamar `chat.send`;
  - **envio retido** (401 no `chat.send`): chamar `chat.send` uma única vez com o mesmo texto e o `contextId` atual da conversa (`null` se a conversa ainda não tinha), sem repetir o balão do usuário;
  - **lista de agentes** (401 em `agents.list`): chamar `agents.list()` de novo. Uma lista que nunca carregou é refeita como primeira carga.

Um turno e uma recarga da lista guardados juntos MUST ser retomados os dois, cada um uma vez. Um segundo evento de sucesso sem nova expiração MUST NOT retomar nada. Um 401 no `chat.getTask` feito por **Reenviar** antes de reenviar (prazo esgotado) MUST devolver o turno ao estado "sem resposta a tempo", sem retomada automática.

Um `unauthorized` de uma chamada iniciada **antes** do novo login MUST NOT expirar a sessão de novo:
- `chat.send`: a mensagem não foi registrada e MUST ser enviada uma única vez com o token novo, com o mesmo texto e o `contextId` atual;
- `agents.list`: a lista MUST ser carregada de novo;
- `chat.getTask` prévio de **Reenviar**: o turno volta a "sem resposta a tempo";
- `chat.getTask` do polling: a resposta MUST ser descartada, e o polling retomado continua.

#### Scenario: Retomada do polling no mesmo taskId
- **WHEN** a consulta da task `9f8e7d6c-…` devolve `unauthorized` e o novo login dá certo
- **THEN** o banner some, a próxima consulta é `chat.getTask` da mesma task, e `chat.send` não é chamado

#### Scenario: Prazo novo na retomada
- **WHEN** a task estava pendente havia 80 s, o novo login leva 5 min e a task continua `TASK_STATE_WORKING` depois da retomada
- **THEN** o turno só vai para "sem resposta a tempo" 90 s depois da retomada, e não na primeira consulta

#### Scenario: Reenvio único depois de 401 no envio
- **WHEN** a segunda mensagem da conversa recebe `unauthorized` no `chat.send` e o novo login dá certo
- **THEN** `chat.send` é chamado uma única vez com o mesmo texto e o `contextId` da conversa, e a timeline continua com um único balão dessa mensagem

#### Scenario: Dois logins seguidos
- **WHEN** o reenvio da mensagem retida já começou depois de um novo login e o renderer recebe outro sucesso de login sem nova expiração
- **THEN** `chat.send` continua chamado uma única vez

#### Scenario: Recarga da lista depois do login
- **WHEN** a recarga da lista depois de um `TASK_STATE_REJECTED` devolve `unauthorized` e o novo login dá certo
- **THEN** `agents.list()` é chamado de novo e a lista anterior continua no seletor até a resposta

#### Scenario: 401 na primeira carga
- **WHEN** a primeira chamada a `agents.list()` devolve `unauthorized`, antes de existir conversa
- **THEN** aparece o banner com "Entre de novo para continuar.", o modal não tem subtítulo, a área principal não mostra "Carregando agentes…" nem o bloco de erro, e depois do novo login aparece "Carregando agentes…" e a conversa vazia do primeiro agente ativo

#### Scenario: Envio antigo recusado depois do novo login
- **WHEN** um `chat.send` está em andamento, o tempo restante chega a zero, o novo login dá certo e só então o envio antigo devolve `unauthorized`
- **THEN** o banner e o modal não voltam, `chat.send` é chamado de novo uma única vez com o mesmo texto e o mesmo `contextId`, e a timeline continua com um único balão

#### Scenario: Lista antiga recusada depois do novo login
- **WHEN** uma recarga da lista está em andamento, a sessão expira, o novo login dá certo e só então a recarga devolve `unauthorized`
- **THEN** o banner não volta e `agents.list()` é chamado de novo

#### Scenario: Consulta prévia de Reenviar recusada depois do novo login
- **WHEN** o `chat.getTask` prévio de **Reenviar** está em andamento, a sessão expira, o novo login dá certo e só então a consulta devolve `unauthorized`
- **THEN** o banner não volta, o turno mostra "O agente não respondeu a tempo." e `chat.send` não é chamado

#### Scenario: Consulta antiga do polling recusada depois do novo login
- **WHEN** uma consulta da task está em andamento, o tempo restante chega a zero, o novo login dá certo e só então a consulta antiga devolve `unauthorized`
- **THEN** o banner não volta e o polling da mesma task continua

#### Scenario: Lista e task juntas
- **WHEN** a sessão expira com uma task pendente e uma recarga da lista também devolve `unauthorized`, e um único novo login dá certo
- **THEN** o polling da task é retomado e `agents.list()` é chamado, cada um uma vez

#### Scenario: Reenviar depois do prazo com sessão expirada
- **WHEN** o prazo esgotou, o usuário clica em **Reenviar** e a consulta prévia da task original devolve `unauthorized`
- **THEN** o turno volta ao bloco "O agente não respondeu a tempo.", `chat.send` não é chamado, e depois do novo login nada é retomado automaticamente

### Requirement: Ações durante a sessão expirada
Na sessão expirada, o renderer SHALL manter liberadas e bloquear as ações abaixo:
- **liberadas**: **Copiar** do `contextId`, a rolagem e a leitura da timeline, **Sair** e **Entrar novamente**;
- **bloqueadas** (desabilitadas, sem sumir): o composer, **Reenviar** e **Continuar aguardando** dos blocos de estado, o seletor de agente e **Nova conversa**.

**Sair** MUST interromper tudo, chamar `auth.logout()` e mostrar a tela de login com usuário e senha vazios. O que estava guardado para a retomada é descartado com a conversa.

#### Scenario: Ações bloqueadas
- **WHEN** a sessão expira com a última tentativa em "sem resposta a tempo"
- **THEN** **Reenviar**, **Continuar aguardando**, o seletor de agente e **Nova conversa** estão desabilitados

#### Scenario: Copiar continua disponível
- **WHEN** a sessão está expirada e o usuário clica em **Copiar** no cabeçalho
- **THEN** `clipboard.writeText` é chamado com o `contextId` completo e aparece "Copiado"

#### Scenario: Sair durante a sessão expirada
- **WHEN** a sessão está expirada com uma resposta pendente guardada e o usuário clica em "Sair"
- **THEN** `auth.logout()` é chamado, a tela de login aparece, e nenhuma consulta nem envio acontece depois
