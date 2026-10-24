## Context

A `conversa-a2a` deixou a conversa em memória (D17 dela) e reservou na barra lateral um `flex: 1` vazio para o histórico (D20). A `sessao-expirada` manteve a conversa durante a expiração, mas o **Sair** e uma recarga do renderer ainda a descartam. Esta change guarda as conversas no computador e troca "a conversa atual" por "uma lista de conversas, uma delas aberta".

Estado atual relevante:
- **`useConversation` parte do princípio de que só existe uma conversa.**
  - `conversationRef` guarda a conversa, e `updateTurn(turnId, attempt)` grava nela.
  - `dispatch` compara a geração depois do `await chat.send` e descarta o resultado se ela mudou. Hoje a geração muda em **Nova conversa** e na troca de agente, que descartam a conversa.
  - `dispatch` grava o `contextId` devolvido em `conversationRef.current`, ou seja, na conversa aberta no momento da resposta.
  - O poller (D8 da `conversa-a2a`) é criado uma vez, e `getTask` usa `conversationRef.current!.agent.id`, o agente da conversa aberta.
  - `pollingTurn` guarda só o `turnId`.
  - `renew` olha só o último turno da conversa aberta.
- **`agentActive` só tem dois valores.** Hoje não existe conversa antes de a lista carregar, então `false` sempre quer dizer inativo.
- **`task-poller.ts`**: `start(taskId, startedAt, initialState)` com prazo a partir de `startedAt`, `stop()` com geração. Não guarda o agente.
- **Identidade do serviço**: o `baseUrl` de `parseServiceUrl` (D6 da `login-operador`). `SessionInfo.serviceUrl` já é esse valor (`status().serviceUrl`).
- **Instância única** (D15 da `login-operador`): `requestSingleInstanceLock` por pasta de dados. O main abre uma janela só: `activate` abre só sem janelas, e `second-instance` foca a existente. O dev usa uma pasta própria (`devUserDataPath`).
- **`localStorage`** já guarda `buteco-chat:service-url` (`saved-service-url.ts`), com `try/catch` nas duas pontas. Em produção a origem do renderer é `file://` (`loadFile`). O Chromium limita o armazenamento a ~10 MB por origem, contados em UTF-16 (~5 M caracteres), compartilhados por todas as chaves.
- **Tamanhos**: uma mensagem tem até 16 000 caracteres (D16 da `conversa-a2a`). O corpo do JSON-RPC é limitado a 1 MiB no main, então uma resposta pode ter perto disso.
- **Separador de dia**: `dayLabel` e `isSameDay` já existem em `format.ts`, e a `Timeline` já os usa. Com a conversa só em memória, na prática só aparecia "Hoje".

```
                ┌────────────────────── renderer ───────────────────────┐
  localStorage  │  useConversation(serviceUrl)                          │
  ┌──────────┐  │  ┌──────────────┐   abrir/criar/excluir ┌──────────┐  │
  │ sessions:│◀─┼──│ conversas[]  │◀──────────────────────│ Sidebar  │  │
  │ <baseUrl>│──┼─▶│ openId       │──────── lista ───────▶│ (lista)  │  │
  └──────────┘  │  └──────┬───────┘                       └──────────┘  │
   gravação     │         │ poller único: segue a conversa aberta       │
   estrutural   │         ▼   { conversationId, turnId, agentId }       │
                │   chat.send / chat.getTask ──▶ resultado endereçado   │
                │                                à conversa de origem   │
                └───────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Nenhuma conversa se perde por **Nova conversa**, troca de agente, **Sair**, sessão expirada, recarga do renderer ou fechamento do app.
- Uma resposta pendente é retomada ao reabrir a conversa, na mesma task e sem reenvio.
- Histórico separado por serviço, com a chave do documento de construção.
- O app funciona com o armazenamento vazio, indisponível, cheio ou corrompido, e nunca grava token ou senha.
- Fidelidade ao protótipo da barra lateral, com as divergências registradas em D16.

**Non-Goals:**
- Criptografia do histórico. `safeStorage` exigiria IPC e o main (Risks).
- Histórico vindo da plataforma. O cliente não lê o histórico de um `contextId`.
- Busca no conteúdo das mensagens, renomear conversa, fixar conversa, exportar e importar.
- Acompanhar várias tasks ao mesmo tempo (D6).
- Usuário na chave (D3).

## Decisions

### D1. Modelo: várias conversas, uma aberta
```ts
interface Conversation {
  id: string                 // crypto.randomUUID(), local
  agent: AgentSummary        // o agente com que a conversa começou (D12 da conversa-a2a)
  contextId: string | null
  title: string | null       // null até o primeiro envio ("Nova conversa" na tela)
  createdAt: number
  lastActivityAt: number     // D9
  turns: Turn[]
}
// estado do hook
{ conversations: Conversation[]; openId: string | null }
```
- `Turn` e `Attempt` continuam os da D17 da `conversa-a2a` e da D4 da `sessao-expirada`, mais três mudanças:
  - `pending` ganha `resumed: boolean` (D7);
  - `completed.durationSeconds` passa a `number | null` (D7);
  - entram `{ kind: 'interrupted' }` e `{ kind: 'not-sent' }` (D5).
- **Ids dos turnos**: continuam inteiros, únicos dentro da conversa. Ao carregar, o próximo id de cada conversa é o maior id dela + 1.
- O id da conversa é gerado no renderer. `crypto.randomUUID` está disponível na origem `file://`, que o Chromium trata como contexto seguro.
- Uma conversa sem turnos é o **rascunho** (D10): fica só em memória, e existe no máximo um.

Alternativa descartada: um `Map` por id. A lista é pequena (≤ 100 por serviço, D4), e um array ordenado por `lastActivityAt` serve direto à lista da barra lateral.

### D2. Endereçamento por conversa (problemas A e B da exploração)
- **Toda atualização leva o id da conversa**: `updateTurn(conversationId, turnId, attempt)` e `setContextId(conversationId, contextId)`. Uma atualização para uma conversa que não existe mais (excluída, D13) é ignorada.
- **`dispatch` não descarta o resultado ao trocar de conversa.** Ele guarda o `conversationId` de origem e grava o resultado nela, inclusive o `contextId` da primeira resposta. Se a origem não estiver aberta quando o resultado chega:
  - com estado não terminal, o turno vai para `pending` sem polling, e é retomado quando a conversa for aberta (D6);
  - com estado terminal, vai direto ao estado final.
- **A geração passa a valer só para o Sair e para a desmontagem da tela.** Trocar de conversa, **Nova conversa**, a troca de agente e **Excluir** não mudam a geração. O descarte de uma conversa excluída é feito pela busca do id.
- **O `getTask` prévio de Reenviar** (D9 da `conversa-a2a`) segue a mesma regra: o resultado vai para a conversa de origem.
- **O poller guarda o agente**: `pollingRef = { conversationId, turnId, agentId }`, e `getTask` usa `pollingRef.current.agentId`. Os eventos do poller usam o `conversationId` e o `turnId` do ref. `task-poller.ts` não muda.

### D3. Chave, formato e conteúdo
- **Chave**: `buteco-chat:sessions:<baseUrl>`, o `baseUrl` de `SessionInfo.serviceUrl`. `useConversation` recebe o `serviceUrl` e lê a chave ao montar. Trocar de serviço passa pelo **Sair** e por um login novo, que desmontam e montam a tela de novo, então a lista é a do serviço novo.
- **Sem usuário na chave**: há um operador só. Uma autenticação multiusuário no futuro migra pela versão (Risks).
- **Formato**: `{ "version": 1, "conversations": [ … ] }`. Cada conversa é gravada como em D1, com os turnos.
  - Só as conversas com ao menos um turno. O rascunho nunca é gravado.
  - Nenhum campo de token, senha ou `SessionInfo`. O renderer não conhece o token. O `ChatError` de `send-error` não tem token (requisito "Requisições autenticadas à plataforma").
- **O que não é gravado**: a busca e o estado da sessão expirada. A conversa aberta também não, porque D11 a recalcula pela última atividade.

### D4. Gravação
- **Síncrona**, com o `JSON.stringify` do serviço inteiro e um `setItem`.
- **Só nos eventos estruturais**:
  - turno criado (envio);
  - mudança de `attempt.kind`, e de `state` dentro de `pending`;
  - `contextId` gravado;
  - título fixado;
  - conversa excluída.
- **O que não grava**: uma consulta do poller com o mesmo estado da anterior. Hoje `onState` chama `updateTurn` a cada segundo. O hook compara `kind` e `state` antes de gravar, e a renderização continua igual.
- Sem debounce e sem gravação ao fechar. Cada evento estrutural já está no disco quando a função volta, então um crash perde no máximo uma mudança de estado de `Submitted` para `Working`, que se recupera na próxima consulta.
- **Teto de 100 conversas por serviço**: ao gravar com mais de 100, as de `lastActivityAt` mais antigo saem até sobrarem 100. A aberta nunca sai. Elas também saem da lista na tela, para a tela não mostrar o que o disco não tem.
- **`localStorage` indisponível** (`getItem` ou `setItem` lança outra coisa que não `QuotaExceededError`): a lista fica só em memória, e o app funciona como hoje.

Alternativa descartada: debounce de algumas centenas de ms. Sobraria uma janela de perda num crash ou num fechamento, sem ganho, porque os eventos estruturais são raros.

Alternativa descartada: uma chave por conversa, para gravar só a que mudou. Seria mais barato, mas a chave por serviço vem do documento de construção, e cada gravação continuaria pequena perto da cota, com os eventos raros. Fica como caminho se a medição mostrar lentidão (Risks).

### D5. Leitura defensiva
Na montagem da tela:

| Conteúdo da chave | Comportamento |
|---|---|
| ausente | lista vazia |
| JSON inválido, ou sem `version` inteiro, ou `version` < 1 | copia o texto para `buteco-chat:sessions-corrupt:<baseUrl>` (uma cópia, sobrescrita) e começa vazia. A primeira gravação sobrescreve a chave original |
| `version` maior que 1 | **modo só-memória para este serviço**: a lista começa vazia, nada é gravado na chave nesta tela, e a chave original fica intacta |
| `version: 1` | cada conversa é validada; a inválida é descartada sozinha |
| `getItem` lança | lista vazia, só em memória |

- **Nome da cópia**: `sessions-corrupt:` como prefixo, em vez de `:corrupt` como sufixo. O `baseUrl` pode conter `:` (`http://host:5017`), e um sufixo tornaria ambígua a varredura por prefixo das chaves de sessão (D8). O efeito pedido é o mesmo: uma cópia à parte, nunca lida pelo app.
- **Falha ao gravar a cópia** (cota ou outro erro): o app segue sem ela.
- **Validação de uma conversa**: a unidade de descarte é a conversa, porque tirar um turno do meio deixaria a timeline incoerente. Ela é descartada quando:
  - `id` não é string não vazia, ou repete um id já lido;
  - `agent` não é um `AgentSummary` (`isGuid(id)`, `name` string não vazia, `isActive` booleano, `description` string ou `null`, `skills` array);
  - `contextId` não é `null` nem `isTaskOrContextId`;
  - `title` não é string nem `null`;
  - `createdAt` ou `lastActivityAt` não é número finito;
  - algum turno é inválido:
    - `id` não é inteiro positivo único;
    - `text` não é string de até 16 000 caracteres;
    - `sentAt` não é número finito;
    - `attempt` tem um `kind` desconhecido ou campos fora do tipo (`taskId` por `isTaskOrContextId`, `state` entre os estados conhecidos).
- **Turnos vazios**: uma conversa gravada sem turnos é descartada, porque não deveria existir (D3).
- **Por que validar dados do próprio app**: a timeline, a Markdown e o poller confiam nos tipos. Um campo errado vindo de uma versão com bug quebraria a tela inteira, em vez de só uma conversa.

### D6. Um poller, que segue a conversa aberta
```
abrir A (pendente)   start(A.task, agora)        ── consulta A
abrir B              stop(); A fica `pending`    ── nada de A até voltar
B pendente?          start(B.task, agora)        ── consulta B
voltar para A        start(A.task, agora)        ── 1ª consulta 1 s depois; já COMPLETED → resposta
```
- Só a conversa aberta é acompanhada. Abrir uma conversa cujo último turno está `pending` chama `start(taskId, Date.now(), state)` e marca `resumed: true` (D7). O prazo de 90 s recomeça na abertura, como na retomada da `sessao-expirada` (D5 dela).
- **Sair da conversa aberta** por outra, **Nova conversa**, troca de agente ou **Excluir**: `stop()` no poller, e o turno continua `pending`, na memória e no disco. A consulta em andamento é descartada pela geração do poller, sem mudar o turno.
- **Ao entrar na tela**, nada é consultado em massa: só a conversa aberta (D11) retoma.
- Um turno em `timeout` não é retomado sozinho. **Continuar aguardando** e **Reenviar** continuam do usuário.
- Na sessão expirada, abrir uma conversa com o último turno `pending` o troca para `awaiting-login` / `poll`, sem consulta (D14).

A task vive no servidor, então pausar o polling não perde nada: ao voltar, a resposta já pronta aparece na primeira consulta.

Alternativa descartada: o poller continuar na conversa de origem. Ficaria sem resposta para uma segunda conversa pendente.

Alternativa descartada: um poller por conversa pendente. Seriam N timers e N gerações para o Sair e a expiração pararem, sem ganho visível, porque a resposta só é lida na conversa aberta.

### D7. Horário e duração de uma resposta retomada
- **Horário exibido**: continua o relógio local da chegada (D11 da `conversa-a2a`), também numa retomada. Uma resposta terminada às 10:02 e vista às 15:40 mostra 15:40. A resposta nunca aparece antes da pergunta.
- **Duração**: os horários do servidor continuam valendo, porque não dependem do cliente. O plano B pelo relógio local mediria também a ausência do usuário. Por isso, num turno `pending` com `resumed: true` sem os dois horários do servidor (ou com diferença negativa), `durationSeconds` é `null`, e a linha de metadados fica `task {8} · Completed`, sem a duração.
- `resumed` passa a `true` quando o polling recomeça pela abertura da conversa, inclusive depois de uma recarga. A retomada depois do novo login e **Continuar aguardando** não marcam uma resposta como retomada.
- **A marca acompanha a task**: `timeout` e `awaiting-login` / `poll` também têm `resumed`. Quando um `pending` retomado esgota o prazo, ou é interrompido pela sessão expirada, o valor é preservado e volta ao `pending` em **Continuar aguardando**, na retomada depois do novo login, no **Reenviar** que encontra a original concluída e na normalização ao reabrir. Assim, uma resposta retomada nunca mede pelo relógio local o tempo em que a conversa ficou fechada, também depois de um prazo esgotado ou de uma expiração. A mudança entrou ainda em `version: 1`, porque não havia dados reais gravados; um `timeout` ou `awaiting-login` / `poll` sem `resumed`, gravado antes dela, é descartado pela validação (D5).

### D8. Cota (`QuotaExceededError`)
```
setItem falha por cota
  1. remove todas as chaves buteco-chat:sessions-corrupt:* e tenta de novo
  2. enquanto falhar: remove a conversa de lastActivityAt mais antigo entre TODOS os serviços
     (as chaves buteco-chat:sessions:* em version 1), nunca a aberta, e tenta de novo
  3. sobrou só a aberta e ainda não cabe: a gravação é abandonada; tudo continua em memória,
     e a próxima gravação estrutural tenta de novo
```
- **Outros serviços**: tirar uma conversa de outro serviço reescreve a chave dele. Uma chave de outro serviço em modo só-memória (versão maior) ou inválida não é tocada no passo 2.
- **Conversas do serviço atual removidas** saem também da lista na tela.
- **"Não gravada" não aparece na tela**: o protótipo não tem lugar para isso, e o caso exige uma única conversa de vários MB (Risks).

### D9. Última atividade e ordem
`lastActivityAt` é atualizado:
- no envio de uma mensagem, por um turno novo, **Reenviar** ou o envio retido que sai depois do novo login;
- na chegada de um estado terminal (`COMPLETED`, `FAILED` ou `REJECTED`), venha ele da resposta do `chat.send`, de uma consulta do polling ou do `getTask` prévio de Reenviar.

Abrir, buscar, retomar o polling, mudar de `Submitted` para `Working`, prazo esgotado, falha de envio ou de consulta e a normalização ao reabrir **não** mudam a ordem. O rascunho começa com `lastActivityAt = createdAt`, para aparecer no topo de **Hoje**.

A lista é ordenada por `lastActivityAt` decrescente. Uma resposta que chega faz a conversa subir.

### D10. Rascunho, Nova conversa e troca de agente
- **Rascunho**: a conversa sem turnos. Ela aparece na lista com o título "Nova conversa", mas só é gravada no primeiro envio. Existe no máximo uma:
  - abrir outra conversa com o rascunho aberto o remove da lista, porque ele não tem nada;
  - o rascunho não tem **Excluir**.
- **Nova conversa** (sem modal):
  - com a lista de agentes ainda não carregada (carregando ou com falha), só recarrega a lista, como hoje sem conversa;
  - com a aberta vazia (rascunho), não cria outra e recarrega a lista;
  - nos outros casos, cria um rascunho e o abre. O agente é o da conversa aberta, se estiver ativo, ou o primeiro ativo da lista. Sem agente ativo, só recarrega a lista. Depois recarrega a lista, como hoje.
- **Troca de agente no seletor** (sem modal):
  - com a aberta vazia, muda o agente dela;
  - com mensagens, cria um rascunho com o agente escolhido e o abre.
- **O que sai**: os modais e o `Discard` do `ConversationScreen`, as divergências #11 da D18 da `conversa-a2a` e a frase "A conversa descartada não fica guardada em lugar nenhum".

O rascunho com o agente da conversa aberta só quando ele está ativo: criar um rascunho de um agente inativo ou ausente abriria um composer já bloqueado.

### D11. Conversa aberta ao entrar na tela
- **Com histórico**: abre a de `lastActivityAt` mais recente, sem esperar a lista de agentes. Se o último turno estiver `pending`, o polling começa (D6). A conversa fica legível com o agente desconhecido (D12).
- **Sem histórico**: como hoje. A lista carrega e o rascunho é criado com o primeiro agente ativo.
- A rolagem da timeline vai para o fim ao abrir uma conversa. A `Timeline` recebe `key` pelo id da conversa, e o efeito de rolagem roda na montagem.

### D12. Agente ativo, inativo ou desconhecido (problema C)
`agentStatus: 'unknown' | 'active' | 'inactive'` substitui `agentActive`:
- **`unknown`**: a lista ainda carrega, ou a primeira carga falhou.
  - O cabeçalho mostra só o selo com o nome, sem **Ativo** nem **Inativo**.
  - O composer fica bloqueado com "Carregando agentes…" (carregando) ou "Agentes indisponíveis no momento" (falha).
  - O seletor fica desabilitado, mostrando o agente guardado.
- **`inactive`**: a lista carregou, e o agente está inativo ou ausente. Fica como a D12 da `conversa-a2a`: selo **Inativo** e "{agente} está inativo. Escolha outro agente ou comece uma nova conversa.".
- **`active`**: normal.
- **Falha da primeira carga com uma conversa aberta**: a conversa continua legível. Acima do composer, na coluna de 760 px (o lugar do banner da sessão expirada), aparece o bloco de falha "Não foi possível carregar os agentes." com **Tentar de novo**. Sem conversa aberta, fica como hoje, na área principal.
- **Seletor com o agente ausente da lista**: o agente guardado entra como item desabilitado com " (inativo)", e o seletor fica nele. Antes, o `Select` controlado ficaria sem valor.
- **Nome e descrição** vêm do `AgentSummary` guardado na conversa, na lista lateral, no cabeçalho e nas respostas, mesmo que a plataforma tenha renomeado o agente. O estado ativo vem sempre da lista carregada.

### D13. Excluir conversa
- **Onde**: um `ActionIcon` `subtle` com ícone de lixeira, à direita do item, irmão do botão (botão dentro de botão não é HTML válido). Ele aparece no hover da linha e no foco dentro dela (`:hover`, `:focus-within`), e é alcançável por Tab. Tem `aria-label` "Excluir conversa {título}".
- **Modal de confirmação**, no padrão dos modais que saem (D10):
  - texto: "Excluir esta conversa? Ela será apagada deste computador e não poderá ser recuperada.";
  - com resposta pendente (último turno em `sending`, `pending`, `timeout` ou `awaiting-login`), mais: "A resposta pendente será descartada: a task continua no servidor, mas o app deixa de acompanhá-la.";
  - botões **Cancelar** (`default`) e **Excluir conversa** (`color="red"`, preenchido). O vermelho é a convenção para uma ação destrutiva sem volta. Os outros modais do app usam o primário porque nenhum apaga dados.
- **Vermelho preenchido legível no escuro**: o Mantine usa o tom 4 (`primaryShade.dark`) no preenchido de todas as cores, e o branco sobre `red[4]` (`#f0766a`) dá 2,8:1. O bloco `dark` do `cssVariablesResolver` sobrescreve `--mantine-color-red-filled` → `var(--mantine-color-red-6)` e `--mantine-color-red-filled-hover` → `var(--mantine-color-red-7)`, como foi feito com o azul (D10 da `fundacao-electron`). No claro, o preenchido já é `red[6]`. O branco dá 4,9:1 sobre `red[6]` e 5,5:1 sobre `red[7]`, nos dois esquemas. Os botões de contorno vermelho dos blocos de falha usam `--mantine-color-red-outline` e não mudam.
- **Confirmar**:
  - remove a conversa da memória e do disco;
  - se ela estava aberta: `stop()` no poller e abre um rascunho com o **mesmo agente**, mesmo inativo;
  - um `chat.send` ou um `getTask` em andamento dela é ignorado na chegada (D2).
- **Bloqueado** na sessão expirada (D14).

### D14. Sessão expirada com várias conversas (problema D)
- **Liberadas**: a busca e a seleção de conversas, para leitura, como "leitura da timeline" na D9 da `sessao-expirada`.
- **Bloqueados**: **Nova conversa**, o seletor de agente e **Excluir**, além do que já era (composer, **Reenviar**, **Continuar aguardando**).
- **Abrir uma conversa durante a expiração**: um último turno `pending` vai para `awaiting-login` / `poll`, sem consulta.
- **Sair da conversa aberta durante a expiração**: os turnos `awaiting-login` ficam como estão.
- **`renew`**, de forma síncrona, uma vez:
  - em **todas** as conversas, os turnos `awaiting-login` / `send` chamam `dispatch` (D2), que não depende do poller;
  - os turnos `awaiting-login` / `poll` voltam a `pending`. Só o da conversa aberta recebe `start`; os outros retomam quando forem abertos (D6);
  - a lista de agentes, se marcada, como hoje.
- **Banner e modal**: o caso (`poll`, `send` ou `idle`) é o da conversa aberta. Um envio retido em outra conversa também sai no novo login, mesmo que o banner diga "Entre de novo para continuar.".
- **Sair** (na sessão expirada ou não): não descarta mais nada. Para o poller e a geração, e chama `logout()`. Cada evento estrutural já foi gravado (D4). Um `chat.send` em andamento no Sair tem o resultado descartado pela geração, e o turno fica `sending` no disco, que a normalização transforma em "envio interrompido" (D15) no próximo login.

### D15. Normalização ao reabrir
Aplicada a cada conversa lida do disco, antes de chegar ao estado:

| Gravado | Ao reabrir | Por quê |
|---|---|---|
| `sending` | `interrupted`: "Não foi possível confirmar o envio da mensagem." + "O app foi fechado durante o envio." + **Reenviar** | A mesma ambiguidade da D10 da `conversa-a2a`: sem `taskId`, não há o que consultar, e a task pode ter sido criada |
| `awaiting-login` / `send` | `not-sent`: "A mensagem não foi enviada." + "A sessão terminou antes do envio. Você pode enviá-la de novo." + **Reenviar** | O 401 prova que nada foi registrado. Reenviar sozinho horas depois surpreende, e uma recarga com a sessão do main viva não passa por um novo login |
| `awaiting-login` / `poll` | `pending` com os mesmos dados | A task existe, e consultar não tem efeito colateral. A retomada é a de D6 |
| `pending` | `pending` | Idem |
| os demais | sem mudança | **Reenviar** depois do prazo já consulta a original antes (D9 da `conversa-a2a`) |

- **Reenviar** em `interrupted` e `not-sent` faz um `chat.send` novo, com o mesmo texto e o `contextId` da conversa, como em `send-error`.
- A normalização não muda `lastActivityAt` (D9) e só vai para o disco na próxima gravação estrutural.

### D16. Fidelidade ao protótipo e divergências
O protótipo é seguido nos textos, nas medidas e nos estados da barra lateral:
- **busca**: 34 px, raio 7 px, fundo `--mantine-color-default-hover`, lupa à esquerda em cor secundária, placeholder "Buscar conversas" e `aria-label` "Buscar conversas";
- **lista**: borda fina acima, rolável, padding 4×8;
- **grupos**: **Hoje**, **Ontem**, **Esta semana** e **Anteriores**, com o `SectionLabel` (11 px, caixa alta, `letter-spacing: 0.05em`, cor secundária) e padding 12×8×6, só com itens;
- **item**: botão de largura total, padding 8×10, raio 7 px, com duas linhas truncadas: o título e, em 11 px, "{agente} · {horário}";
- **item ativo**: fundo `--mantine-color-butecoBlue-light` (azul 1), texto `--buteco-color-accent-text`, título em peso 500, `aria-current="true"`;
- **item inativo**: transparente, hover `--mantine-color-default-hover`, horário em cor secundária;
- **busca sem resultado**: "Nenhuma conversa encontrada." em cor secundária;
- **Nova conversa**: cria o item no topo de **Hoje** e o seleciona;
- **seleção**: abre a conversa na área principal.

**Horário do item**: "HH:mm" em **Hoje**, "ontem" em **Ontem**, o dia da semana abreviado em **Esta semana** (dom, seg, ter, qua, qui, sex, sáb) e `dd mmm` em **Anteriores** (jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez; por exemplo, "15 out"). As abreviações são uma tabela fixa, e não `Intl`, cuja saída em pt-BR tem ponto ("seg.", "out.") e varia com a versão do ICU.

**Grupos**, pelo dia local de `lastActivityAt` em relação a hoje:
- **Hoje**: o mesmo dia, ou uma data no futuro (relógio ajustado para trás);
- **Ontem**: o dia anterior;
- **Esta semana**: de 2 a 6 dias atrás;
- **Anteriores**: 7 dias ou mais.

**Busca**: sobre o título exibido ("Nova conversa" para o rascunho). A comparação é de "contém", sem diferenciar maiúsculas nem acentos: `normalize('NFD')`, sem marcas combinantes, `toLocaleLowerCase('pt-BR')`. Espaços nas pontas da busca são ignorados, e a busca vazia mostra tudo.

Divergências, todas no padrão visual dos elementos existentes:

| # | Divergência | Motivo | Padrão visual |
|---|---|---|---|
| 1 | "Esta semana" = de 2 a 6 dias atrás | Pela semana do calendário, o grupo ficaria sempre vazio na segunda-feira, e o início da semana em pt-BR é ambíguo (domingo ou segunda). O protótipo não define | Rótulo de seção |
| 2 | Abreviações sem ponto; em **Anteriores**, com o ano quando ele é outro: "15 out 2025" | O protótipo mostra "seg" e "15 out", sem ponto. "15 out" seria ambíguo entre anos | Linha 11 px do item |
| 3 | Busca sem diferenciar maiúsculas nem acentos | Em pt-BR, "situacao" deve achar "Situação". O protótipo não define | Campo de busca |
| 4 | **Excluir conversa**: lixeira no hover/foco do item e modal de confirmação | D13; o protótipo não tem. Sem isso, nada sai do disco, exceto pelo teto e pela cota | `ActionIcon` `subtle` em cor secundária; modal com o layout dos que saem (D10), com a ação em vermelho (#12) |
| 12 | **Excluir conversa** no modal em vermelho preenchido, e não no primário dos outros modais | D13: a exclusão apaga a conversa para sempre, e o vermelho é a convenção para ação destrutiva. No escuro, o preenchido vermelho passa a `red[6]`/`red[7]` para o branco ter 4,5:1 | `Button` `color="red"` `variant="filled"` |
| 5 | Largura estreita: a busca e a lista aparecem, com a lista em altura máxima de 30vh e rolagem | Esconder tornaria o histórico inacessível abaixo de 860 px. O protótipo não desenha a largura estreita | Mesma lista, com `max-height` |
| 6 | Blocos "envio interrompido" e "A mensagem não foi enviada." | D15 | Bloco de falha, sem linha de metadados (não há task) |
| 7 | Agente desconhecido: composer com "Carregando agentes…" ou "Agentes indisponíveis no momento", cabeçalho sem selo de estado e, na falha, o bloco "Não foi possível carregar os agentes." com **Tentar de novo** acima do composer | D12. Antes, não havia conversa sem a lista | Placeholder do composer; bloco de falha na coluna de 760 px |
| 8 | Seletor com o agente ausente como item desabilitado " (inativo)" | D12 | Item desabilitado do `Select` |
| 9 | Linha de metadados sem duração numa resposta retomada sem os horários do servidor | D7 | Linha de metadados |
| 10 | Rascunho sem lixeira e removido da lista ao abrir outra conversa | D10. Um rascunho não tem nada a perder nem a guardar | Item da lista |
| 11 | Na sessão expirada, a busca e a seleção liberadas, e **Excluir** bloqueado | D14 | Estado `disabled` do `ActionIcon` |

**Cores e contraste** (calculados com as escalas do tema):
- **Texto do item ativo** (`ac-text` do protótipo): variável nova `--buteco-color-accent-text`, `butecoBlue[8]` (`#1e4d92`) no claro e `butecoBlue[3]` (`#b0c8ee`) no escuro.
  - Sobre `--mantine-color-butecoBlue-light`: 7,4:1 no claro (`#eef3fb`) e 9,6:1 no escuro (`#0d203c`).
  - `--mantine-color-butecoBlue-light-color` não serve: no claro é `butecoBlue[6]`, com 4,5:1 exatos, sem margem.
- **Horário do item sob o hover**: `--mantine-color-dimmed` sobre `--mantine-color-default-hover`, com 5,1:1 no claro (`gray[6]` sobre `gray[0]`) e 5,2:1 no escuro (`dark[2]` sobre `dark[5]`).
- **Botão vermelho preenchido** (D13): branco sobre `--mantine-color-red-filled`, com 4,9:1 (`red[6]`) nos dois esquemas, e 5,5:1 sobre o hover (`red[7]`).

### D17. Layout do código
```
src/renderer/src/history/
  storage.ts            chave, leitura (D5), gravação (D4), teto, cota (D8) (+ teste)
  validate.ts           validação de uma conversa gravada (D5) (+ teste)
  normalize.ts          normalização ao reabrir (D15) (+ teste)
  list-format.ts        grupos, horário do item, busca normalizada (D16) (+ teste)
  ConversationList.tsx  busca, grupos, itens, lixeira
  DeleteConversationModal.tsx
src/renderer/src/conversation/
  model.ts              tipos Attempt, Turn e Conversation, fora do hook: o armazenamento não depende dele
  use-conversation.ts   D1, D2, D6, D9, D10, D11, D12, D14
  ConversationScreen.tsx sem os modais de descarte; lista, exclusão, bloco da lista de agentes acima do composer
  Sidebar.tsx           a lista no lugar reservado; seletor com o agente ausente
  ConversationHeader.tsx selo com agentStatus
  Timeline.tsx, blocks/StateBlock.tsx, blocks/AgentReply.tsx  blocos novos; duração opcional
  test-chat.ts          localStorage simulado por teste
src/renderer/src/styles/global.css   lista, item, hover/foco da lixeira, largura estreita
src/renderer/src/theme/css-variables.ts  --buteco-color-accent-text; vermelho preenchido no escuro (+ teste)
```
O armazenamento fica fora de `conversation/` porque não depende da tela, e os testes dele são puros, com um `Storage` injetado.

`useConversation` continua o dono do estado. O hook atual já tem 400 linhas, e o apply pode extrair o endereçamento (D2) e a seleção (D10, D11) em funções puras testáveis. A regra é que o poller continue criado uma vez, com callbacks estáveis (comentário atual do hook).

### Notas do sync
- **`Purpose` de `conversa`**: editado à mão no sync, porque o formato do delta não tem operação para `Purpose`. O arquivamento roda sem reaplicar os deltas, então a edição se mantém.
  - antes: "… e oferecer no renderer a tela de conversas, com o acompanhamento de cada task até um estado terminal e a retomada da conversa depois de um novo login quando a sessão expira.";
  - depois: "… e oferecer no renderer a tela de conversas, com várias conversas guardadas entre as quais o usuário alterna, o acompanhamento da task da conversa aberta até um estado terminal e a retomada depois de um novo login quando a sessão expira.".
- **`Purpose` de `historico-conversas`**: escrito no sync, ao criar o spec: "Guardar no computador as conversas com os agentes, separadas por endereço de serviço: o formato gravado, a gravação nos eventos estruturais, a leitura defensiva, o limite de conversas e de espaço e a normalização ao reabrir; a lista da barra lateral, com busca, grupos por data, seleção, criação e exclusão; a conversa aberta ao entrar e a retomada de uma resposta pendente.".
- **Correção de redação sem relação com o histórico**: uma frase provisória, encontrada na revisão de frases do sync e corrigida por esta change, como MODIFIED:
  - `ponte-preload`, "Tipos compartilhados do contrato": "só os namespaces já expostos" → "só os namespaces expostos pelo preload".

## Risks / Trade-offs

- [Conversas em texto puro na pasta de dados do app] → Quem tem acesso ao perfil do usuário no sistema lê as perguntas e as respostas. **Excluir conversa** (D13) apaga uma conversa. `safeStorage` resolveria, mas exige IPC e fica fora do escopo.
- [Outra pessoa que entra no mesmo serviço, no mesmo computador, vê o histórico] → A chave é só por serviço (D3), com operador único. Se a autenticação deixar de ser provisória e passar a ter vários usuários, o `version` permite migrar para uma chave com usuário.
- [A chave depende da origem do renderer (`file://`)] → Uma mudança futura para um protocolo próprio (`app://`) muda a origem e deixa o histórico, e o `service-url`, para trás. Quem fizer essa mudança precisa migrar as chaves.
- [Uma segunda janela quebraria a garantia de escritor único] → Hoje há uma instância por pasta de dados e uma janela só (Context). A gravação sobrescreve o blob inteiro: com duas janelas, a última apagaria o que a outra gravou. Uma change que abra uma segunda `BrowserWindow` precisa tratar isso.
- [Uma conversa aberta maior que a cota fica só em memória] → Exige vários MB numa conversa só (respostas perto de 1 MiB). Não aparece na tela (D8). Ela se perde ao fechar o app.
- [O LRU apaga conversas de outros serviços] → A cota é da origem, não do serviço. A alternativa, falhar a gravação do serviço atual com espaço ocupado por um serviço sem uso, seria pior.
- [Gravar o blob inteiro a cada evento estrutural] → Com poucos MB, um `stringify` e um `setItem` síncronos levam alguns ms a cada envio ou resposta, não a cada segundo (D4). Se a medição mostrar travadas, o caminho é uma chave por conversa, com um índice por serviço.
- [Resposta retomada mostra o horário da reabertura] → D7. O horário local é a regra da D11 da `conversa-a2a`.
- [Task apagada pela plataforma antes da reabertura] → O `getTask` devolve `rpc` (`-32001`), e o turno mostra "Não foi possível acompanhar a resposta do agente." com **Reenviar**, como hoje.
- [Envio interrompido pode ter criado uma task] → Mesmo risco da falha ambígua (D10 da `conversa-a2a`): o **Reenviar** pode fazer o agente ver a pergunta duas vezes.
- [Rótulos da lista na virada da meia-noite] → Os grupos e os horários são calculados no render, e a lista se refaz no próximo render (envio, resposta, busca, seleção). Sem timer para a meia-noite.
- [A versão maior deixa o serviço em modo só-memória sem aviso] → Só acontece ao voltar para uma versão mais antiga do app. Melhor que apagar dados de uma versão mais nova.

## Migration Plan

Não há dado a migrar: hoje nada é guardado. A primeira versão do formato é 1. Rollback: reverter o commit da change. A chave `buteco-chat:sessions:*` fica no `localStorage` sem ser lida e não interfere na versão anterior.

## Open Questions

Nenhuma.
