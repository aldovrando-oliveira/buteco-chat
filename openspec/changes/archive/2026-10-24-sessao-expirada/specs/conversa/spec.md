## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Sessão terminada
**Reason**: O comportamento mínimo da `conversa-a2a` (D14 dela) perdia a conversa e a resposta em andamento num 401. Agora o renderer entra na sessão expirada, pede um novo login sem sair da tela e retoma de onde parou.
**Migration**: Ver os requisitos 'Sessão expirada durante o uso', 'Banner de sessão expirada', 'Novo login sem sair da conversa', 'Retomada depois do novo login' e 'Ações durante a sessão expirada'. A notificação "A sessão terminou. Entre de novo para continuar." e o `auth.logout()` no `unauthorized` deixam de existir.
