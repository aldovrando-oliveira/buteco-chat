## Context

A `conversa-a2a` tratou o `unauthorized` com o comportamento mínimo da D14 dela:
1. `stop()` no poller;
2. `auth.logout()`;
3. volta ao login;
4. a notificação "A sessão terminou. Entre de novo para continuar.".

O contador do rodapé chegando a zero chama `status()` e volta ao login, sem notificação. Nos dois casos, a conversa em memória se perde.

Estado atual relevante:
- **O renderer já tem serviço e usuário.** O `App` guarda `SessionInfo` (`serviceUrl`, `username`, `expiresAt`) no `View` de sessão, e o `ConversationScreen` o recebe.
- **`AuthService.login()` zera a sessão no início** (`session = null`). Durante um novo login, qualquer chamada que chegue ao main devolve `unauthorized` sem rede.
- **O `ChatClient` devolve `unauthorized` sem chamar o `fetch`** quando falta o token (`client.ts`, `request`). Depois do `expiresAt`, o `getToken()` já é `null`, então um `SendMessage` nessa condição nunca sai do main.
- **O 401 da plataforma não limpa o token no main.** Hoje é o `logout()` do renderer que limpa.
- **Poller (D8 da `conversa-a2a`)**: tem `start(taskId, startedAt, initialState)`, `extend()` e `stop()`, com geração.
- **Turno (D17 da `conversa-a2a`)**: guarda o texto e a tentativa (`Attempt`), com `contextId` na conversa.
- **Plataforma (`buteco-agents`, `apps/api`)**:
  - o token do operador dura `Auth:OperatorTokenLifetime`, 30 min por padrão;
  - é assinado com `Auth:TokenSigningKey`;
  - o 401 sai do middleware de autenticação, antes do endpoint, então um `SendMessage` recusado com 401 não cria task.

```
                 unauthorized (agents | chat) ou contador = 0
   ┌────────┐  ─────────────────────────────────────────────▶  ┌──────────────────────────┐
   │ ativa  │                                                   │ expirada                 │
   │        │  ◀── novo login OK no modal: aplica a retomada ── │  turno: awaiting-login   │
   └────────┘      uma vez (poll | send) e recarrega a lista   │    resume: poll | send   │
       │            se marcada                                  │  recarregarLista: bool   │
       │ Sair                                                   └──────────────────────────┘
       ▼                                                          um 2º unauthorized só
   tela de login                                                  acrescenta à retomada
```

## Goals / Non-Goals

**Goals:**
- Nenhum 401 ou vencimento faz perder a conversa, o `contextId` ou a resposta em andamento.
- Regras do 401 do documento de construção:
  - `SendMessage` é reenviado uma vez, no mesmo `contextId`;
  - `GetTask` retoma o mesmo `taskId`, nunca com reenvio;
  - `agents:list` é recarregado.
- Fidelidade ao protótipo (rodapé, banner, composer, pílula, modal), com as divergências registradas em D11.
- O 401 é a fonte de verdade; o `expiresAt` só antecipa o mesmo estado.

**Non-Goals:**
- Aviso antes do vencimento: o protótipo não tem. O rodapé já mostra os minutos restantes.
- Renovação silenciosa do token (refresh): a plataforma não oferece, e a senha nunca é guardada.
- Troca de conta ou de serviço pelo modal. O caminho é **Sair** e entrar pela tela de login.
- Preservar a conversa ao recarregar o renderer (`historico-conversas`).

## Decisions

### D1. Estado da sessão no renderer: `ativa` | `expirada`
O estado fica em `useConversation`, ao lado da conversa, e não no `App`. É o hook que conhece os turnos, o poller e a lista. O `ConversationScreen` o lê para o banner, o modal, o composer e o rodapé.
- **Entradas**: qualquer `unauthorized` de `agents.list`, `chat.send` ou `chat.getTask` (inclusive o `getTask` prévio do **Reenviar** depois do prazo), e o contador do rodapé chegando a zero.
  - O contador entra direto, sem `status()`. Main e renderer usam o mesmo `Date.now()`, e depois do `expiresAt` o main já responderia `unauthorized` sem rede.
  - Um 401 com tempo restante (token revogado) entra no mesmo estado, e o rodapé mostra "Sessão expirada" mesmo assim.
- **Idempotente**: entrar já estando `expirada` não muda nada além de acrescentar à retomada (D4, D8).
- **O renderer nunca chama `logout()` no `unauthorized`.** Só **Sair** chama.
- **Ao entrar**, o poller recebe `stop()`. A geração da conversa **não** muda, e um `chat.send` em andamento tem o resultado aproveitado (D4).
- **Saída**: só pelo novo login no modal (D6, D7) ou por **Sair**, que vai à tela de login e descarta a conversa, como hoje.

Alternativa descartada: guardar o estado no `App` e passá-lo para baixo. O `App` teria de conhecer turnos e retomada, ou o hook teria de reagir a uma prop, com o risco de aplicar a retomada duas vezes num re-render.

### D2. Serviço e usuário ficam no renderer
O modal lê `serviceUrl` e `username` do `SessionInfo` que o `ConversationScreen` já recebe. O main não ganha um "último login" sem token, e `status()` continua devolvendo `null` nos três campos quando não há sessão.

Depois do novo login, o `ConversationScreen` chama `onRenewed(expiresAt)`. O `App` troca só o `expiresAt` do `View` de sessão, sem desmontar a tela (mesmo `kind`, mesmo componente).

Alternativa descartada: o main manter serviço e usuário depois da expiração. Isso mudaria `status()` e a tela de abertura (o que mostrar ao reabrir com o token vencido?) sem ganho: o renderer já tem os dois valores.

### D3. `discard(token)` no `AuthService`
`AuthService` ganha `discard(token: string): void`, que descarta a sessão só se o token atual for igual ao informado. Não há canal IPC. O `ChatClient` lê o token antes da requisição e, se a resposta for 401, chama `discard` com esse mesmo token. Assim, o main não continua respondendo `authenticated: true` com um token revogado, e um renderer recarregado nesse estado vai ao login.

Por que comparar o token. Uma consulta pode estar em andamento com o token antigo quando o novo login termina. Se o 401 dela limpasse a sessão sem comparar, a sessão nova morreria. Com a comparação:
- durante o login, `session` é `null`, e `discard` não faz nada;
- depois do login, o token é outro, e `discard` também não faz nada.

O mesmo motivo tira o `logout()` do renderer no `unauthorized` (D1). O `getToken()` continua só no main, e o `discard` também. `ChatClientDeps.auth` passa a `Pick<AuthService, 'status' | 'getToken' | 'discard'>`.

Alternativa descartada: o `ChatClient` chamar `logout()`. Isso aborta um login em andamento (requisito "Uma chamada de login por vez") e tem a mesma corrida.

### D4. A retomada fica no turno: `awaiting-login`
`Attempt` ganha:
```ts
| { kind: 'awaiting-login'; resume: 'send' }
| { kind: 'awaiting-login'; resume: 'poll'; taskId: string; state: PendingState; submittedAt: string | null; startedAtLocal: number }
```
- **401 no `chat.send`**: o turno vai para `awaiting-login` / `send`. Vale também para o envio de **Reenviar**. O texto já está no `Turn`, e o `contextId` na conversa.
- **401 no `getTask` do poller**: o turno vai para `awaiting-login` / `poll`, com os dados do `pending`, e o `lastState` vem do próprio `pending`.
- **401 no `getTask` prévio de Reenviar depois do prazo** (D9 da `conversa-a2a`): nada foi enviado. O turno volta a `timeout` com os mesmos dados, e não há retomada automática. Depois do login, o usuário escolhe de novo.
- **Expiração com chamadas em andamento**:
  - um `chat.send` que já saiu tem o resultado aproveitado. Se der certo enquanto a sessão está expirada, o turno vai para `awaiting-login` / `poll` com a task devolvida, sem polling. Descartar esse resultado pela geração faria perder o `taskId` e levaria a um reenvio duplicado;
  - o `getTask` em andamento do poller é descartado pela geração do `stop()`, e o turno vai para `awaiting-login` / `poll` com o `pending` atual;
  - o `getTask` prévio de Reenviar segue a mesma regra do resultado: se não estiver `COMPLETED`, o reenvio que viria a seguir vira `awaiting-login` / `send`, sem chamar `chat.send`.
- **Regra geral**: com a sessão `expirada`, `dispatch` nunca chama `chat.send`, e o poller nunca recebe `start`/`extend`. Em vez disso, o turno vai para `awaiting-login`.
- **Continuar aguardando** passa a chamar `start(taskId, agora, lastState)` em vez de `extend()`, o que substitui o que dizia a D9 da `conversa-a2a`. Depois de um 401 no `getTask` prévio de Reenviar, o turno volta a `timeout`, mas o poller já recebeu `stop()` e não guarda mais a task, então `extend()` não faria nada e o pendente ficaria parado. O efeito de `start` é o mesmo: mesma task, prazo novo a partir do clique.
- **Expiração pelo contador**:
  - um turno `pending` vai para `awaiting-login` / `poll`;
  - um turno em `sending` espera o resultado (acima);
  - um turno em `timeout`, `failed`, `send-error`, `poll-error`, `completed` ou `rejected` não muda.

### D5. Polling: para no primeiro 401, prazo novo na retomada
O poller já para no `unauthorized` (`onError` encerra a task). Na retomada:
```ts
pollerRef.current.start(taskId, Date.now(), state)
```
O prazo de 90 s recomeça a partir da retomada. O `startedAtLocal` do turno continua o original, usado só na duração de plano B (D11 da `conversa-a2a`).

O tempo de espera do login não conta. Se contasse, quem levasse mais de 90 s para entrar cairia direto em "O agente não respondeu a tempo", quando o mais provável é a task já ter terminado e a primeira consulta devolver `COMPLETED`. A primeira consulta sai 1 s depois do `start`, como em qualquer envio.

### D6. Modal "Entrar novamente"
Um componente novo, `ReloginModal.tsx`, com `Modal` do Mantine, largura máxima de 360 px, superfície, raio 11 px e `role="dialog"` com o título.
- **Campos**:
  - "Serviço": o `serviceUrl` em mono 12 px, numa caixa somente leitura (superfície sutil `--mantine-color-default-hover`, borda, raio 7 px), sem **Alterar**;
  - "Usuário": `TextInput` `readOnly` com o usuário da sessão;
  - "Senha": `type="password"`, `autoComplete="current-password"`, com o foco ao abrir.
- **Botões**: **Cancelar** (`variant="default"`) e **Entrar** (primário preenchido), alinhados à direita.
- **Envio**: `auth.login(serviceUrl, username, senha)`. **Entrar** fica desabilitado com a senha vazia e mostra carregamento durante o login; com isso, a senha fica desabilitada, e **Cancelar**, Esc e o clique fora não fecham o modal. Um contador de tentativas no modal descarta o resultado de uma tentativa que não seja a última. O `AuthService` aborta o login anterior com `{ unreachable, 'cancelled' }` (requisito "Uma chamada de login por vez"), e esse resultado nunca chega à tela.
- **Erros**: o bloco de erro e os textos são os da tela de login (`loginErrorMessage`), com `{endereço}` igual ao `serviceUrl` da sessão.
  - `invalid-credentials` limpa a senha.
  - `unreachable`, `http` e `bad-response` mantêm a senha. O modal continua aberto, e a retomada continua guardada.
- **Cancelar**, Esc e o clique fora fecham o modal sem chamar nada. O banner continua, e **Entrar novamente** reabre o modal com a senha vazia e sem erro.
- **Sem gravação do endereço**: o `localStorage` já tem esse `baseUrl`.

O componente reaproveita de `LoginScreen.tsx` os estilos dos campos e a linha "Serviço". A linha é extraída para um componente comum, e a variante do modal não tem **Alterar**.

### D7. Depois do novo login: retomada uma vez só
No sucesso, de forma síncrona e nesta ordem:
1. Se a sessão não estiver `expirada`, nada é feito (proteção contra um segundo evento de sucesso).
2. A sessão passa a `ativa`, o modal fecha, e `onRenewed(expiresAt)` atualiza o rodapé.
3. O turno em `awaiting-login`, se houver (só o último turno pode estar):
   - `poll`: volta a `pending` com os mesmos dados, e `start(taskId, Date.now(), state)` é chamado (D5);
   - `send`: `dispatch(turnId, turn.text)` no `contextId` atual da conversa, que troca o turno para `sending` antes do `await` do `chat.send`.
4. Se a lista foi marcada para recarga (D8), `agents.list()` é chamado: como primeira carga se nunca carregou, ou como recarga.

Como a troca de estado e a do turno são síncronas, um segundo sucesso não encontra a sessão `expirada` nem um turno em `awaiting-login`, e não reenvia. Um segundo login só aconteceria depois de um novo `unauthorized`, que cria uma retomada nova. A guarda do passo 1 e o contador de tentativas do modal (D6) ficam como defesa em profundidade.

**Época da sessão.** `useConversation` guarda uma época, incrementada a cada `renew`. Cada chamada guarda a época em que começou: `chat.send` em `dispatch`, `agents.list` em `loadAgents` e o `getTask` prévio de `resend`. Um `unauthorized` de uma época anterior veio com o token de antes do novo login e **não** chama `expire()`:
- **`chat.send`**: o 401 prova que a mensagem não foi registrada, e o turno é reenviado (`dispatch`) na época atual, uma vez, no mesmo `contextId`. Caso típico: envio em andamento, sessão expirada pelo contador, novo login, e o envio antigo volta 401;
- **`agents.list`**: a lista é carregada de novo na época atual (como primeira carga, se nunca carregou);
- **`getTask` prévio de Reenviar**: o turno volta a `timeout`, sem expirar.

O `getTask` do poller não precisa de época: a entrada na sessão expirada chama `stop()`, e a resposta antiga é descartada pela geração do poller. Sem a época, um 401 antigo abriria um segundo modal com a sessão nova válida.

### D8. Lista de agentes
- **`unauthorized` numa recarga** (Nova conversa, depois de `REJECTED`): a sessão entra em `expirada`, a lista anterior continua no seletor, e a recarga fica marcada.
- **`unauthorized` na primeira carga**, antes de existir conversa: mesmo estado `expirada` e mesmo modal.
  - A área principal não mostra "Carregando agentes…" nem o bloco de erro da lista: fica vazia, só com o banner (texto "Entre de novo para continuar.") e o composer bloqueado.
  - Depois do login, a primeira carga é refeita, com "Carregando agentes…" e a seleção do primeiro ativo.
- Um `unauthorized` de `getTask` e outro de `agents.list` juntos (por exemplo, a recarga depois de `REJECTED` e o polling de outra coisa) somam: um só login retoma o turno **e** recarrega a lista, cada um uma vez.

### D9. Ações durante a sessão expirada
- **Liberadas**:
  - **Copiar** do `contextId`, que não usa a rede;
  - a rolagem e a leitura da timeline, inclusive a seleção de texto;
  - **Sair**;
  - **Entrar novamente**.
- **Bloqueadas**:
  - o composer (D11 #3);
  - **Reenviar** e **Continuar aguardando** dos blocos de estado;
  - o seletor de agente;
  - **Nova conversa**.
- **Sair** durante a sessão expirada: `chat.stop()`, `auth.logout()` e a tela de login com usuário e senha vazios, como hoje. A retomada é descartada com a conversa.

Botões bloqueados ficam `disabled`, sem sumir: o usuário vê o que poderá fazer depois do login.

### D10. O que sai da `conversa-a2a`
- `SESSION_ENDED_MESSAGE`, `sessionEnded` e `handleSessionEnded` do `App`, e a prop `onSessionEnded` de `ConversationScreen`/`useConversation`.
- `endSession()` em `useConversation`, trocado pela entrada em `expirada` (D1).
- O caminho do contador no `SessionFooter`: `onExpired` passa a entrar em `expirada`, sem `refreshView`.
- Requisito "Sessão terminada": **REMOVED**, substituído pelos requisitos novos.
- Divergência #13 da D18 da `conversa-a2a` (a notificação): deixa de existir.

**Continua**: abrir o app com o token já vencido leva à tela de login sem notificação ("Tela inicial decidida pelo main"), porque não há conversa a preservar. Recarregar o renderer durante a sessão expirada também leva ao login, porque o `discard` ou o vencimento já limparam o main. Nesse caso, a conversa se perde (Risks).

### D11. Fidelidade ao protótipo e divergências
O protótipo é seguido em textos, cores, medidas e hierarquia:
- rodapé: "Sessão expirada" em 11 px, `--mantine-color-red-text`;
- banner: `yellow-light`, texto em `--buteco-color-warning-text` (#8), raio 9 px, `role="alert"`, cadeado, título em peso 600, linha explicativa em `--mantine-color-text` e **Entrar novamente** em primário preenchido, dentro da coluna de 760 px acima do composer;
- composer: placeholder "Entre novamente para continuar";
- pílula: "Aguardando novo login para retomar" com `task {8} · Working`;
- modal: textos, medidas e botões, como em D6.

Divergências, todas no padrão visual dos elementos existentes:

| # | Divergência | Motivo | Padrão visual |
|---|---|---|---|
| 1 | Linha explicativa do banner por caso:<br>• **task pendente** (`resume: 'poll'`): a do protótipo, "A resposta em andamento continua sendo processada. Entre de novo para retomá-la — nada será reenviado.";<br>• **401 no envio** (`resume: 'send'`): "Sua mensagem ainda não foi enviada. Entre de novo para enviá-la — ela será enviada uma única vez.";<br>• **nada em andamento** (lista, contador com a conversa parada, turno em prazo esgotado, primeira carga): "Entre de novo para continuar." | O texto do protótipo só é verdadeiro com uma task pendente. No envio, a mensagem **será** enviada; sem nada em andamento, não há resposta a retomar. O texto neutro vale com e sem conversa (401 na primeira carga) | Banner do protótipo; só o texto muda |
| 2 | Subtítulo do modal por caso:<br>• **pendente**: o do protótipo, "A conversa e a resposta em andamento continuam onde estavam.";<br>• **envio**: "A conversa continua onde estava. A mensagem será enviada depois do login.";<br>• **nada em andamento**: sem subtítulo | O mesmo do #1. Sem nada em andamento, o único conteúdo seria "Entre de novo para continuar.", que repete o título "Entrar novamente" e o banner logo atrás. Sem conversa (primeira carga), "a conversa continua" seria falso | Subtítulo do modal, cor secundária; sem ele, os campos sobem e o espaçamento entre título e "Serviço" é o mesmo entre os demais blocos |
| 3 | Pílula do envio retido: "Aguardando novo login para enviar", sem `task …` | Não há task: o `SendMessage` não foi registrado. O `PendingReply` já aceita `taskId: null` | Pílula do pendente, com os pontos animados |
| 4 | Ações bloqueadas na sessão expirada: **Reenviar**, **Continuar aguardando**, seletor de agente e **Nova conversa** desabilitados | D9. Sem isso, cada clique gera outro 401, ou uma nova conversa descarta o que espera retomada | Estado `disabled` dos componentes do Mantine |
| 5 | 401 no `getTask` prévio de **Reenviar** depois do prazo: o turno volta a "sem resposta a tempo", sem retomada automática | D4. Nada foi enviado, e a decisão entre aguardar e reenviar continua do usuário | Bloco de prazo esgotado |
| 6 | Modal: **Cancelar**, Esc e o clique fora fecham, exceto durante o login. Foco no campo de senha ao abrir | D6. O protótipo não define teclado nem foco | `Modal` do Mantine |
| 7 | 401 na primeira carga da lista: a área principal fica vazia, só com o banner, até o novo login | D8. O protótipo parte de uma lista carregada | Banner do protótipo |
| 8 | `--buteco-color-warning-text` no claro passa de `yellow[7]` (`#9d6a13`) para `yellow[9]` (`#8a5a00`). No escuro continua `yellow[4]` | Sobre `--mantine-color-yellow-light` do claro (`#fbf1de`), `yellow[7]` dá 4,16:1, abaixo de 4,5:1; `yellow[9]` dá 5,29:1. No escuro, `yellow[4]` dá 5,99:1 sobre o fundo do banner. Um token só para a "cor de aviso", como em D12 da `login-operador`: o aviso "A senha será enviada sem criptografia." da tela de login fica um pouco mais escuro e ganha contraste sobre a superfície | Cor de aviso do tema |

O rodapé sem tempo restante mantém avatar, usuário, host e **Sair**. Só a linha do tempo muda.

### D12. Layout do código
```
src/main/auth/service.ts                   + discard(token) (+ teste)
src/main/chat/client.ts                    401 → auth.discard(token usado) (+ teste)
src/renderer/src/App.tsx                   − sessionEnded/notificação; + onRenewed(expiresAt)
src/renderer/src/auth/LoginScreen.tsx      ServiceRow extraído para reuso (sem mudança visual)
src/renderer/src/theme/css-variables.ts    --buteco-color-warning-text no claro: yellow[9] (D11 #8) (+ teste)
src/renderer/src/conversation/
  use-conversation.ts                      sessão ativa|expirada, awaiting-login, retomada (D1, D4, D7, D8)
  ConversationScreen.tsx                   banner, modal, bloqueios (D9)
  SessionExpiredBanner.tsx                 novo
  ReloginModal.tsx                         novo
  SessionFooter.tsx, Sidebar.tsx           "Sessão expirada"; seletor e Nova conversa bloqueáveis
  Timeline.tsx, blocks/PendingReply.tsx    pílula de espera; ações bloqueáveis
  Composer.tsx                             sem mudança (o placeholder vem da tela)
```
`task-poller.ts` não muda: `start` já cobre a retomada.

### D13. Fumaça manual contra a plataforma
- **Relógio**: subir o `apps/api` com `Auth__OperatorTokenLifetime=00:02:00`, para o vencimento acontecer em 2 min.
- **Token revogado com tempo restante**: trocar `Auth__TokenSigningKey` e reiniciar o `apps/api`. Reiniciar sem trocar a chave não invalida o token. Durante o reinício, o novo login no modal cai em `unreachable` e mantém a retomada.

### Notas do sync
- **`Purpose` de `conversa`**: editado à mão no sync, porque o formato do delta não tem operação para `Purpose`. O arquivamento roda sem reaplicar os deltas, então a edição se mantém.
  - antes: "… e oferecer no renderer a tela de conversas, com o acompanhamento de cada task até um estado terminal.";
  - depois: "… e oferecer no renderer a tela de conversas, com o acompanhamento de cada task até um estado terminal e a retomada da conversa depois de um novo login quando a sessão expira.".
- **Correções de redação sem relação com a sessão expirada**: duas frases presas a uma change, encontradas na revisão do sync e corrigidas por esta change, como MODIFIED:
  - `empacotamento-local`, "Teste de fumaça do pacote": "Antes de considerar a change pronta" → "Antes de uma versão do pacote ser considerada pronta"; no cenário "Falha sob file://", "a change não é dada como pronta" → "o pacote não é dado como pronto";
  - `ponte-preload`, "Tipos compartilhados do contrato": "o contrato inicial" → "o contrato"; "Uma change MAY alterar esse contrato, desde que registre a alteração e o motivo no próprio `design.md`." → "Toda alteração desse contrato MUST ser registrada, com o motivo, no `design.md` da change que a faz.".

## Risks / Trade-offs

- [Recarregar o renderer na sessão expirada perde a conversa] → Ela fica em memória por escopo. A `historico-conversas` resolve.
- [A garantia "401 no `SendMessage` = não registrado" depende da plataforma] → O 401 sai do middleware de autenticação do ASP.NET, antes do endpoint (Context). Se um dia a plataforma autenticar depois de criar a task, o reenvio duplicaria a pergunta. Fica registrado como premissa do contrato.
- [Relógio local adiantado em relação à plataforma] → O contador chega a zero antes, e o usuário entra de novo mais cedo, sem perder nada. Com o relógio atrasado, o 401 chega primeiro e leva ao mesmo estado.
- [Resultado de um `chat.send` que chega depois da expiração] → D4 aproveita o resultado, em vez de descartá-lo pela geração. Descartar levaria a um reenvio duplicado.
- [Um segundo 401 logo depois da retomada (token novo também recusado)] → Entra de novo em `expirada`, com a retomada nova. Não há laço automático: cada login é uma ação do usuário.
- [`discard` com o token errado] → Comparação exata de string. O pior caso é não limpar um token revogado, o que só faz o próximo uso dar 401 de novo.

## Migration Plan

Nada a migrar: a conversa continua em memória, o `localStorage` não ganha chave e o contrato IPC não muda. Rollback: reverter o commit da change.

## Open Questions

Nenhuma.
