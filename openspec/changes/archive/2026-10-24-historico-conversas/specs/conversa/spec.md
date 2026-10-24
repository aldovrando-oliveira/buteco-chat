## MODIFIED Requirements

### Requirement: Layout da tela de conversas
Autenticado, o renderer SHALL mostrar a tela de conversas, com altura da janela:
- uma linha com a barra lateral à esquerda (288 px, superfície, borda à direita) e a área principal à direita;
- na área principal, o cabeçalho (superfície, borda inferior, padding 12×24), a timeline (coluna central de até 760 px, 18 px entre itens) e o composer (até 760 px).

Abaixo de 860 px de largura, a barra lateral MUST passar para cima da área principal, com largura total, e a lista de conversas MUST continuar visível, com altura máxima de 30% da altura da janela e rolagem própria. A interface MUST usar os tokens do tema nos esquemas claro e escuro.

#### Scenario: Largura estreita
- **WHEN** a janela tem menos de 860 px de largura
- **THEN** a barra lateral aparece acima da área principal, com o campo "Buscar conversas" e a lista de conversas visíveis

### Requirement: Barra lateral
A barra lateral SHALL conter, nesta ordem:
1. a marca: ícone de balão na cor primária, "Buteco" em peso 600 e "Chat" em cor secundária, 14 px;
2. o rótulo de seção "AGENTE" e o seletor de agente (34 px, raio 7 px);
3. o botão primário preenchido **Nova conversa**, largura total, 34 px, com ícone "+";
4. a busca e a lista de conversas (requisitos 'Busca de conversas' e 'Lista agrupada' de `historico-conversas`), que ocupam a altura entre **Nova conversa** e o rodapé;
5. o rodapé de sessão, separado por borda.

No seletor:
- cada agente aparece pelo nome;
- os inativos aparecem desabilitados, com o sufixo " (inativo)";
- o valor é o agente da conversa aberta;
- quando esse agente não está na lista carregada, ele MUST aparecer como item desabilitado, com o nome guardado na conversa e o sufixo " (inativo)";
- antes de a lista carregar, ou se ela falhar, o seletor MUST ficar desabilitado, mostrando o agente da conversa aberta, se houver;
- sem conversa guardada, a seleção inicial é o primeiro agente ativo da lista.

#### Scenario: Ordem e textos
- **WHEN** a tela de conversas aparece com agentes carregados
- **THEN** a barra lateral mostra, em ordem, "Buteco", "Chat", "AGENTE", o seletor, **Nova conversa**, o campo "Buscar conversas", a lista e o rodapé

#### Scenario: Agente inativo no seletor
- **WHEN** não há conversa guardada e a lista tem "Atendente" ativo e "Antigo" inativo
- **THEN** o seletor oferece "Antigo (inativo)" desabilitado e começa em "Atendente"

#### Scenario: Agente ausente no seletor
- **WHEN** a conversa aberta é do agente "Antigo", que não está na lista carregada
- **THEN** o seletor mostra "Antigo (inativo)", desabilitado na lista de opções

### Requirement: Rodapé de sessão
O rodapé SHALL mostrar:
- um avatar circular com as iniciais do usuário;
- "{usuário} @ {host}", com o usuário em peso 500 e "@ {host}" em mono 11 px, cor secundária;
- "Sessão válida por mais {n} min" (11 px, cor secundária; `n` arredondado para cima a partir de `expiresAt`) ou, na sessão expirada, "Sessão expirada" (11 px, `--mantine-color-red-text`);
- o botão **Sair** só com ícone de saída e `aria-label="Sair"`.

**Sair** MUST interromper o polling e chamar `logout()`, e o app volta à tela de login com usuário e senha vazios. As conversas MUST continuar guardadas: um novo login no mesmo serviço mostra a mesma lista. Quando o tempo restante chega a zero, o renderer MUST entrar no estado de sessão expirada (requisito 'Sessão expirada durante o uso'), sem chamar `status()` nem voltar à tela de login. Depois de um novo login, o tempo restante MUST ser contado a partir do `expiresAt` novo.

#### Scenario: Identificação e tempo restante
- **WHEN** a sessão é de `ana` em `http://localhost:5017`, com `expiresAt` 30 min à frente
- **THEN** o rodapé mostra o avatar "AN", "ana", "@ localhost:5017" e "Sessão válida por mais 30 min"

#### Scenario: Sair
- **WHEN** o usuário clica no botão de nome acessível "Sair"
- **THEN** `logout()` é chamado e a tela de acessos seguintes aparece, com usuário e senha vazios

#### Scenario: Conversas mantidas depois do Sair
- **WHEN** o usuário tem conversas, clica em "Sair" e entra de novo no mesmo serviço
- **THEN** a lista mostra as mesmas conversas, e a área principal mostra a de última atividade mais recente

#### Scenario: Tempo esgotado
- **WHEN** o tempo restante chega a zero
- **THEN** o rodapé mostra "Sessão expirada", o banner aparece, a conversa continua visível, e nem `status()` nem `logout()` são chamados

#### Scenario: Tempo restante depois do novo login
- **WHEN** a sessão expirou e o novo login devolve `expiresAt` 30 min à frente
- **THEN** o rodapé volta a mostrar "Sessão válida por mais 30 min"

### Requirement: Carregamento da lista de agentes
O renderer SHALL chamar `agents.list()` ao mostrar a tela de conversas, ao clicar em **Nova conversa**, depois de um `TASK_STATE_REJECTED` e depois de um novo login que retoma uma carga recusada com `unauthorized`.

**Sem conversa aberta**, durante a primeira carga, a área principal MUST mostrar "Carregando agentes…". Os outros casos:
- **falha**, exceto `unauthorized`: bloco de erro "Não foi possível carregar os agentes." com **Tentar de novo**;
- **lista vazia**: "Nenhum agente cadastrado na plataforma.";
- **só agentes inativos**: "Nenhum agente ativo no momento.".

**Com uma conversa aberta** (conversa guardada), a timeline dela MUST aparecer durante a primeira carga, e o agente fica desconhecido até a lista chegar (requisito 'Agente da conversa inativo'). Se a primeira carga falhar, exceto com `unauthorized`, a conversa MUST continuar legível, e o bloco de erro "Não foi possível carregar os agentes." com **Tentar de novo** MUST aparecer acima do composer, dentro da coluna de até 760 px.

Nesses casos, o composer fica bloqueado. Uma recarga que falha depois da primeira, com qualquer erro exceto `unauthorized`, MUST manter a lista anterior, sem bloco de erro. Um `unauthorized`, na primeira carga ou numa recarga, MUST seguir o requisito 'Sessão expirada durante o uso': a lista anterior, se houver, continua no seletor, e a carga é refeita depois do novo login (requisito 'Retomada depois do novo login').

#### Scenario: Falha ao carregar
- **WHEN** não há conversa guardada e `agents.list()` devolve `unreachable` na primeira carga
- **THEN** aparece "Não foi possível carregar os agentes." com **Tentar de novo**, e o clique chama `agents.list()` de novo

#### Scenario: Falha ao carregar com conversa guardada
- **WHEN** há uma conversa guardada e `agents.list()` devolve `unreachable` na primeira carga
- **THEN** a timeline da conversa continua visível, o bloco "Não foi possível carregar os agentes." com **Tentar de novo** aparece acima do composer, e o cabeçalho não mostra **Inativo**

#### Scenario: Recarga com falha passageira
- **WHEN** a recarga da lista depois de um `TASK_STATE_REJECTED` devolve `unreachable`
- **THEN** a lista anterior continua no seletor e nenhum bloco de erro aparece

#### Scenario: Recarga com sessão expirada
- **WHEN** a recarga da lista depois de um `TASK_STATE_REJECTED` devolve `unauthorized`
- **THEN** `auth.logout()` não é chamado, a lista anterior continua no seletor, e o banner "Sua sessão expirou." aparece

#### Scenario: Só inativos
- **WHEN** não há conversa guardada e todos os agentes da lista são inativos
- **THEN** aparece "Nenhum agente ativo no momento." e o envio fica bloqueado

### Requirement: Cabeçalho da conversa
O cabeçalho SHALL mostrar:
- **o título** (15 px, peso 600, truncado):
  - antes do primeiro envio, "Nova conversa";
  - depois, os primeiros 40 caracteres da primeira mensagem, com quebras de linha e espaços em sequência trocados por um espaço e sem espaços nas pontas, seguidos de "…" quando a mensagem é mais longa;
- **abaixo do título**, "contextId" (12 px, cor secundária) e:
  - sem `contextId`, "— aguardando o primeiro envio";
  - com `contextId`, o valor abreviado em mono 11 px: os 8 primeiros caracteres, "…" e os 4 últimos, ou o valor inteiro se tiver até 12 caracteres. Ao lado vem o botão discreto **Copiar** (ícone de cópia e texto, 11 px);
- **à direita**, o nome do agente guardado na conversa num selo neutro e o selo **Ativo** (verde claro) ou **Inativo** (neutro). Enquanto a lista de agentes não carregou, ou se a primeira carga falhou, MUST aparecer só o selo com o nome, sem **Ativo** nem **Inativo**.

#### Scenario: Antes do primeiro envio
- **WHEN** a conversa ainda não teve envio
- **THEN** o título é "Nova conversa", aparece "— aguardando o primeiro envio" e não há **Copiar**

#### Scenario: contextId abreviado
- **WHEN** o `contextId` da conversa é `3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f`
- **THEN** o cabeçalho mostra `3a7d9f10…4e5f` e o botão **Copiar**

#### Scenario: Título da primeira mensagem
- **WHEN** a primeira mensagem tem 60 caracteres, com uma quebra de linha no meio
- **THEN** o título tem os 40 primeiros caracteres, sem a quebra, seguidos de "…"

#### Scenario: Agente ainda desconhecido
- **WHEN** a conversa guardada do agente "Atendente" está aberta e `agents.list()` ainda não respondeu
- **THEN** o cabeçalho mostra o selo "Atendente", sem **Ativo** nem **Inativo**

### Requirement: Timeline
Os itens SHALL aparecer em ordem de envio.
- **Separador de dia**: antes do primeiro item de cada dia local, uma linha fina, o rótulo (11 px, cor secundária) e outra linha fina. O rótulo é "Hoje", "Ontem" ou a data `dd/mm/aaaa`, calculado em relação ao dia em que a conversa é exibida.
- **Mensagem do usuário**:
  - à direita, num balão com fundo `--mantine-color-butecoBlue-light`, raio `11 11 4 11`, padding 8×12, largura máxima de 80% e quebras de linha preservadas;
  - abaixo, o horário local de envio `HH:mm` (11 px, cor secundária).
- **Resposta do agente**:
  - à esquerda, um avatar circular de 26 px (superfície, borda, ícone de robô na cor primária);
  - ao lado, o nome do agente (12 px, peso 600) e o horário local de chegada `HH:mm` (11 px, cor secundária);
  - o texto em Markdown;
  - a linha de metadados em mono 11 px, cor secundária: `task {8 primeiros caracteres do taskId} · Completed · {duração} s`.

A duração tem uma casa decimal com vírgula (por exemplo `3,2`). Ela é o `timestamp` do `GetTask` terminal menos o `submittedAt` do envio. Quando um dos dois é `null` ou a diferença é negativa, o renderer usa o relógio local, do início do envio até a chegada do estado terminal, exceto numa resposta retomada (requisito 'Resposta concluída').

#### Scenario: Mensagem e resposta
- **WHEN** o usuário envia "linha 1\nlinha 2" e a task `1a2b3c4d-…` completa com `submittedAt` `18:24:00.000Z` e `timestamp` `18:24:03.240Z`
- **THEN** o balão mostra as duas linhas, a resposta mostra o nome do agente e o texto, e a linha de metadados é `task 1a2b3c4d · Completed · 3,2 s`

#### Scenario: Duração pelo relógio local
- **WHEN** o `GetTask` terminal devolve `timestamp: null`, e 4,5 s se passaram no relógio do renderer entre o envio e a chegada
- **THEN** a linha de metadados termina em `4,5 s`

#### Scenario: Separador de dia
- **WHEN** a conversa tem itens de hoje
- **THEN** antes do primeiro aparece o separador "Hoje"

#### Scenario: Separadores numa conversa reaberta
- **WHEN** hoje é 24/10/2026 e o usuário abre uma conversa guardada com mensagens de 20/10/2026, de 23/10/2026 e de hoje
- **THEN** aparecem, em ordem, os separadores "20/10/2026", "Ontem" e "Hoje", cada um antes da primeira mensagem do seu dia

### Requirement: Polling da task
Depois de um envio que devolve estado não terminal, o renderer SHALL consultar `chat.getTask` até o primeiro estado terminal (`COMPLETED`, `FAILED` ou `REJECTED`).
- Cada consulta MUST ser agendada 1 s depois da resposta da anterior, com `setTimeout` encadeado, nunca `setInterval`. Assim, nunca há duas consultas da mesma task ao mesmo tempo.
- O prazo é de 90 s a partir do envio, configurável. Ele MUST ser medido pelo relógio injetado, comparando `now()` com o limite a cada resposta e antes de agendar a próxima consulta, nunca pela contagem de consultas. Esgotado o prazo, o turno vai para o estado "sem resposta a tempo".
- `unreachable` e `http` 5xx numa consulta MUST NOT encerrar o turno: o polling continua até o prazo.
- `rpc`, `bad-response` e `http` diferente de 5xx MUST encerrar o turno com o bloco "Não foi possível acompanhar a resposta do agente." e **Reenviar**.
- `unauthorized` MUST interromper o polling e guardar a task para a retomada (requisitos 'Sessão expirada durante o uso' e 'Retomada depois do novo login'). Na retomada, o polling da mesma task recomeça com prazo novo de 90 s a partir da retomada; o tempo de espera do login não conta no prazo.
- Só a conversa aberta é acompanhada, e cada consulta MUST usar o agente da conversa a que a task pertence. Abrir outra conversa (inclusive por **Nova conversa**, troca de agente ou exclusão da conversa aberta) MUST interromper o polling e descartar a resposta de uma consulta já em andamento (contador de geração), sem mudar o turno: ele continua pendente e é retomado quando a conversa for aberta de novo (requisito 'Retomada da resposta pendente ao abrir' de `historico-conversas`).
- **Sair** e a entrada na sessão expirada MUST interromper o polling, e a resposta de uma consulta já em andamento MUST ser descartada (contador de geração).

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
- **WHEN** uma consulta da conversa A está em andamento, o usuário começa uma nova conversa e a consulta então responde `TASK_STATE_COMPLETED`
- **THEN** a nova conversa continua vazia, nenhuma consulta é agendada, e ao voltar para A a próxima chamada é `chat.getTask` da mesma task

#### Scenario: Consulta com o agente da conversa
- **WHEN** a conversa A, do agente `a1…`, está aberta com a task `9f8e7d6c-…` pendente, depois de o usuário ter passado pela conversa B, do agente `b2…`
- **THEN** `chat.getTask` é chamado com o agente `a1…` e a task `9f8e7d6c-…`

#### Scenario: Consulta em andamento quando o contador chega a zero
- **WHEN** uma consulta está em andamento, o tempo restante chega a zero e a consulta então responde `TASK_STATE_WORKING`
- **THEN** nenhuma consulta é agendada até o novo login, e depois dele o polling continua na mesma task

### Requirement: Resposta concluída
Em `TASK_STATE_COMPLETED`, a timeline SHALL trocar o pendente pela resposta do agente (requisito 'Timeline'). Com `text` vazio ou só de espaços, o lugar do texto MUST mostrar "O agente não devolveu texto." em cor secundária.

Numa resposta retomada pela abertura da conversa (requisito 'Retomada da resposta pendente ao abrir' de `historico-conversas`), sem os dois horários do servidor ou com diferença negativa entre eles, a linha de metadados MUST ficar `task {8 caracteres} · Completed`, sem duração: o relógio local mediria também o tempo em que a conversa ficou fechada.

#### Scenario: Concluída sem texto
- **WHEN** o `GetTask` devolve `TASK_STATE_COMPLETED` com `text: ""`
- **THEN** a resposta mostra "O agente não devolveu texto." e a linha de metadados

#### Scenario: Retomada sem horários do servidor
- **WHEN** a conversa é reaberta com a task `1a2b3c4d-…` pendente, e o `GetTask` devolve `TASK_STATE_COMPLETED` com `timestamp: null`
- **THEN** a linha de metadados é `task 1a2b3c4d · Completed`

#### Scenario: Retomada com horários do servidor
- **WHEN** a conversa é reaberta com a task `1a2b3c4d-…` pendente, enviada com `submittedAt` `18:24:00.000Z`, e o `GetTask` devolve `TASK_STATE_COMPLETED` com `timestamp` `18:24:03.240Z`
- **THEN** a linha de metadados é `task 1a2b3c4d · Completed · 3,2 s`

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
| envio interrompido pelo fechamento do app | "Não foi possível confirmar o envio da mensagem." | "O app foi fechado durante o envio." | — | **Reenviar** |
| envio retido que não saiu antes do fechamento | "A mensagem não foi enviada." | "A sessão terminou antes do envio. Você pode enviá-la de novo." | — | **Reenviar** |

Os dois últimos blocos vêm da normalização ao reabrir (requisito 'Normalização ao reabrir' de `historico-conversas`).

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

#### Scenario: Reenviar depois do envio interrompido
- **WHEN** a conversa reaberta mostra "O app foi fechado durante o envio." e o usuário clica em **Reenviar**
- **THEN** `chat.send` é chamado com o mesmo texto e o `contextId` da conversa, e aparece o pendente, sem um segundo balão

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
  - com uma conversa aberta e a lista de agentes ainda carregando: "Carregando agentes…";
  - com uma conversa aberta e a primeira carga da lista com falha: "Agentes indisponíveis no momento";
  - com o agente da conversa inativo (requisito 'Agente da conversa inativo');
  - sem conversa aberta, durante a carga ou a falha da lista de agentes, ou sem agente ativo.
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

#### Scenario: Bloqueado com o agente desconhecido
- **WHEN** a conversa guardada está aberta e `agents.list()` ainda não respondeu
- **THEN** o placeholder é "Carregando agentes…", e quando a lista chega com o agente ativo o placeholder passa a "Mensagem para {agente}"

#### Scenario: Acima do limite
- **WHEN** o usuário cola 16 001 caracteres
- **THEN** o campo mantém os 16 001 caracteres, aparecem "16.001 / 16.000" e "A mensagem passa do limite de 16.000 caracteres.", e o envio fica desabilitado

### Requirement: Nova conversa e troca de agente
**Nova conversa** e a troca de agente no seletor SHALL agir sem modal de confirmação, porque a conversa anterior continua na lista:
- **Nova conversa**:
  - com a lista de agentes ainda não carregada, ou com falha, MUST só chamar `agents.list()` de novo;
  - com a conversa aberta sem mensagens, MUST NOT criar outra conversa; só recarrega a lista;
  - nos outros casos, MUST criar uma conversa vazia, sem `contextId`, e abri-la. O agente é o da conversa aberta, se estiver ativo, ou o primeiro agente ativo da lista. Sem agente ativo, só recarrega a lista;
- **troca de agente**:
  - com a conversa aberta sem mensagens, MUST trocar o agente dela;
  - com mensagens, MUST criar uma conversa vazia com o agente escolhido e abri-la.

A conversa que estava aberta continua na lista, com as mensagens e o `contextId`, e a resposta pendente dela fica guardada (requisito 'Polling da task').

#### Scenario: Nova conversa sem modal
- **WHEN** a conversa aberta tem mensagens e o usuário clica em **Nova conversa**
- **THEN** nenhum modal aparece, a conversa vazia mostra o cartão do mesmo agente, e a conversa anterior continua na lista

#### Scenario: Trocar de agente com mensagens
- **WHEN** a conversa aberta tem mensagens e o usuário escolhe outro agente no seletor
- **THEN** nenhum modal aparece, a área principal mostra a conversa vazia do novo agente, e a conversa anterior continua na lista com o agente anterior

#### Scenario: Trocar de agente com a conversa vazia
- **WHEN** a conversa aberta não tem mensagens e o usuário escolhe outro agente
- **THEN** a lista continua com uma só conversa vazia, e o cartão mostra o novo agente

#### Scenario: Nova conversa com a conversa vazia
- **WHEN** a conversa aberta não tem mensagens e o usuário clica em **Nova conversa**
- **THEN** a lista continua com uma só conversa vazia e `agents.list()` é chamado

#### Scenario: Nova conversa com resposta pendente
- **WHEN** há resposta pendente na conversa A e o usuário clica em **Nova conversa**
- **THEN** o polling para, a conversa vazia aparece, a próxima mensagem é enviada sem `contextId`, e A continua na lista com a resposta pendente guardada

#### Scenario: Nova conversa a partir de agente inativo
- **WHEN** a conversa aberta é do agente "Antigo", inativo, e o usuário clica em **Nova conversa**
- **THEN** a conversa vazia é do primeiro agente ativo da lista

### Requirement: Agente da conversa inativo
O estado do agente da conversa aberta SHALL ser:
- **desconhecido** enquanto a lista de agentes não carregou, ou quando a primeira carga falhou: o cabeçalho mostra só o selo com o nome, e o composer fica bloqueado com o placeholder do requisito 'Composer';
- **inativo** quando a lista carregada mostra o agente inativo, ou não o contém;
- **ativo** quando a lista carregada mostra o agente ativo.

Com o agente inativo, o renderer SHALL:
- trocar o selo do cabeçalho para **Inativo**;
- bloquear o composer com o placeholder "{agente} está inativo. Escolha outro agente ou comece uma nova conversa.".

A conversa e as mensagens MUST continuar visíveis, com o nome guardado na conversa. Se o agente voltar a ficar ativo numa recarga seguinte, o selo e o composer MUST voltar ao normal.

#### Scenario: Rejeitada e agente inativo
- **WHEN** um envio devolve `TASK_STATE_REJECTED` e a recarga da lista mostra o agente com `isActive: false`
- **THEN** o selo mostra **Inativo** e o composer fica bloqueado com "{agente} está inativo. Escolha outro agente ou comece uma nova conversa."

#### Scenario: Conversa de um agente que sumiu
- **WHEN** a conversa guardada do agente "Antigo" é aberta e a lista carregada não tem esse agente
- **THEN** a timeline mostra as mensagens com o nome "Antigo", o selo mostra **Inativo** e o composer fica bloqueado com "Antigo está inativo. Escolha outro agente ou comece uma nova conversa."

### Requirement: Sessão expirada durante o uso
O renderer SHALL entrar no estado de sessão expirada, sem sair da tela de conversas, quando:
- qualquer chamada de `agents.list`, `chat.send` ou `chat.getTask` devolve `unauthorized`, inclusive com tempo restante no rodapé (token recusado pela plataforma);
- o tempo restante do rodapé chega a zero.

Nesse estado:
- as conversas, as mensagens, os `contextId` e a lista de agentes carregada MUST ser mantidos;
- o renderer MUST NOT chamar `auth.logout()` nem voltar à tela de login;
- o polling MUST ser interrompido, sem nenhuma consulta agendada;
- nenhuma chamada a `chat.send` MUST acontecer até o novo login;
- abrir uma conversa cujo último turno está pendente MUST guardar a task para a retomada, sem consulta, com a pílula "Aguardando novo login para retomar".

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

#### Scenario: Abrir uma conversa pendente na sessão expirada
- **WHEN** a sessão está expirada e o usuário abre uma conversa cujo último turno está pendente na task `9f8e7d6c-…`
- **THEN** `chat.getTask` não é chamado, e a pílula mostra "Aguardando novo login para retomar" e `task 9f8e7d6c · Working`

### Requirement: Retomada depois do novo login
Depois de um novo login bem-sucedido no modal, o renderer SHALL, uma única vez:
- fechar o modal e tirar o banner;
- voltar o rodapé a "Sessão válida por mais {n} min", com o `expiresAt` novo;
- liberar o composer e as ações bloqueadas;
- retomar o que estava guardado, em todas as conversas:
  - **resposta pendente** (401 no `chat.getTask`, envio que deu certo durante a expiração, ou conversa pendente aberta durante a expiração): na conversa aberta, retomar o polling da **mesma** task, com prazo novo de 90 s a partir da retomada, sem chamar `chat.send`. Nas outras conversas, o turno volta a pendente e o polling é retomado quando a conversa for aberta;
  - **envio retido** (401 no `chat.send`): chamar `chat.send` uma única vez com o mesmo texto e o `contextId` atual da conversa a que o turno pertence (`null` se ela ainda não tinha), sem repetir o balão do usuário, mesmo que essa conversa não esteja aberta;
  - **lista de agentes** (401 em `agents.list`): chamar `agents.list()` de novo. Uma lista que nunca carregou é refeita como primeira carga.

Turnos e uma recarga da lista guardados juntos MUST ser retomados todos, cada um uma vez. Um segundo evento de sucesso sem nova expiração MUST NOT retomar nada. Um 401 no `chat.getTask` feito por **Reenviar** antes de reenviar (prazo esgotado) MUST devolver o turno ao estado "sem resposta a tempo", sem retomada automática.

O texto do banner e o subtítulo do modal MUST seguir o que está guardado na conversa aberta.

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

#### Scenario: Envio retido em outra conversa
- **WHEN** o envio da conversa A recebe `unauthorized`, o usuário abre a conversa B durante a expiração e o novo login dá certo
- **THEN** `chat.send` é chamado uma única vez com o texto e o `contextId` de A, e B continua aberta

#### Scenario: Task guardada em outra conversa
- **WHEN** a consulta da conversa A devolve `unauthorized`, o usuário abre a conversa B e o novo login dá certo
- **THEN** nenhuma consulta da task de A acontece até o usuário abrir A, e então a próxima chamada é `chat.getTask` dessa task

#### Scenario: Dois logins seguidos
- **WHEN** o reenvio da mensagem retida já começou depois de um novo login e o renderer recebe outro sucesso de login sem nova expiração
- **THEN** `chat.send` continua chamado uma única vez

#### Scenario: Recarga da lista depois do login
- **WHEN** a recarga da lista depois de um `TASK_STATE_REJECTED` devolve `unauthorized` e o novo login dá certo
- **THEN** `agents.list()` é chamado de novo e a lista anterior continua no seletor até a resposta

#### Scenario: 401 na primeira carga
- **WHEN** não há conversa guardada e a primeira chamada a `agents.list()` devolve `unauthorized`
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
- **liberadas**: **Copiar** do `contextId`, a rolagem e a leitura da timeline, a busca e a seleção de conversas na lista, **Sair** e **Entrar novamente**;
- **bloqueadas** (desabilitadas, sem sumir): o composer, **Reenviar** e **Continuar aguardando** dos blocos de estado, o seletor de agente, **Nova conversa** e **Excluir conversa**.

**Sair** MUST interromper tudo, chamar `auth.logout()` e mostrar a tela de login com usuário e senha vazios. As conversas continuam guardadas, e o que estava guardado para a retomada passa pela normalização ao reabrir (requisito 'Normalização ao reabrir' de `historico-conversas`) no próximo login.

#### Scenario: Ações bloqueadas
- **WHEN** a sessão expira com a última tentativa em "sem resposta a tempo"
- **THEN** **Reenviar**, **Continuar aguardando**, o seletor de agente, **Nova conversa** e os botões **Excluir conversa** estão desabilitados

#### Scenario: Copiar continua disponível
- **WHEN** a sessão está expirada e o usuário clica em **Copiar** no cabeçalho
- **THEN** `clipboard.writeText` é chamado com o `contextId` completo e aparece "Copiado"

#### Scenario: Ler outra conversa durante a expiração
- **WHEN** a sessão está expirada e o usuário busca e seleciona outra conversa
- **THEN** a timeline dela aparece, e o banner e o composer bloqueado continuam

#### Scenario: Sair durante a sessão expirada
- **WHEN** a sessão está expirada com uma resposta pendente guardada e o usuário clica em "Sair"
- **THEN** `auth.logout()` é chamado, a tela de login aparece, nenhuma consulta nem envio acontece depois, e um novo login no mesmo serviço mostra a conversa com a resposta pendente
