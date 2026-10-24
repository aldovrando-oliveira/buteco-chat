## Context

A `login-operador` deixou um token na memória do main (`getToken()`), o endereço normalizado da sessão (`status().serviceUrl`) e um destino pós-login provisório. `src/shared/api.ts` já declara `agents` e `chat` no contrato inicial, mas o preload só expõe `auth`.

Contrato da plataforma, conferido em `buteco-agents` (`apps/api`, `apps/workers`, `docs/a2a-integration.md`):
- `GET /agents` (Bearer): array sem paginação (`AgentEndpoints.cs`), com agentes inativos.
- `POST /agents/{id}/a2a` (Bearer, JSON-RPC 2.0):
  - sempre HTTP 200, com o erro em `error: { code, message }`;
  - sem token válido, HTTP 401 com corpo vazio;
  - só `SendMessage` e `GetTask` interessam.
- O worker grava **um artifact com uma parte de texto** (`Part.FromText(response.Text)`, `AgentExecutionService.cs:474`).
- `status_timestamp` pode ser nulo no banco.
- **Histórico**: `LoadSessionAsync` (`AgentExecutionService.cs:587`) carrega a sessão serializada da **task `completed` mais recente** do contexto, ordenada por `StatusTimestamp`, e acrescenta a mensagem nova. A sessão vai acumulando; não é uma soma de tasks.
- **Trava por contexto**: o worker executa uma task por vez em cada `contextId` do mesmo agente. Uma segunda mensagem espera até 30 s pela primeira e, depois disso, termina `FAILED` (`a2a-integration.md`, "duas mensagens ao mesmo tempo").
- **Sem deduplicação por `messageId`**: `EnqueueingAgentHandler` não lê o `messageId`, e o SDK `A2A 1.0.0-preview2` só o carrega como propriedade da mensagem. Cada `SendMessage` sem `taskId` cria uma task nova.

Protótipo aprovado: um canvas no claude.ai, sem cópia no disco. A especificação textual dele está transcrita nos requisitos de tela de `specs/conversa/spec.md`. Toda divergência está em D18.

```
 renderer (connect-src 'none')                    preload                main
 ┌───────────────────────────────────┐          ┌──────────┐   ┌──────────────────────────────────────┐
 │ App: checking │ login │ conversas │          │ buteco.  │   │ handle('agents:list')                │
 │ ConversationScreen                │ invoke   │  auth    │──▶│ handle('chat:send' | 'chat:getTask') │
 │  useConversation (estado em mem.) │─────────▶│  agents  │   │   parseArgs: GUID, ids, 16 000       │
 │  taskPoller (máquina pura):       │◀─Result──│  chat    │◀──│ ChatClient(fetch, auth, timers, uuid)│
 │   setTimeout 1 s encadeado        │          │ clipboard│   │   15 s, redirect:'manual', Bearer    │
 │   prazo 90 s por now()            │          └──────────┘   │ handle('clipboard:writeText') 1 KiB  │
 │  Markdown (react-markdown + gfm)  │                         └──────────────────┬───────────────────┘
 └───────────────────────────────────┘                                            │ GET  {base}/agents
                                                                                  ▼ POST {base}/agents/{guid}/a2a
```

## Goals / Non-Goals

**Goals:**
- Listar agentes e conversar com um deles em vários turnos, reenviando o `contextId`, com cada estado de task tratado e explicado.
- Todo HTTP no main, com o token nunca cruzando a ponte e todo id que entra numa URL validado.
- Tela fiel ao protótipo, nos esquemas claro e escuro, com as divergências registradas.
- Polling que respeita o contrato: uma task por vez por contexto, prazo no cliente, erro passageiro tolerado.

**Non-Goals:**
- Lista de conversas, busca e persistência local (`historico-conversas`). Aqui existe só a conversa atual, em memória.
- 401 em uso com retomada: banner, modal de novo login, reenvio ou retomada do polling (`sessao-expirada`). Aqui fica só o comportamento mínimo de D14.
- Streaming, push notification e os demais métodos A2A.
- Cancelar uma task na plataforma.
- Imagens remotas nas respostas, bloqueadas pela CSP (questão em aberto da fundação).

## Decisions

### D1. Cliente da plataforma no main: `createChatClient`, injetado
`src/main/chat/client.ts` exporta `createChatClient({ fetch, auth, setTimeout, clearTimeout, randomUUID })`, onde `auth` é o `AuthService` da login-operador. Não há `now`: a expiração é verificada pelo próprio `AuthService`. Em produção, `fetch` é `net.fetch` e `randomUUID` é `crypto.randomUUID`. Nos testes, entram um `fetch` simulado, os timers falsos do Vitest e um gerador de UUID controlado.
- **Sessão**: cada chamada lê `auth.status().serviceUrl` e `auth.getToken()`. Se algum for `null`, devolve `unauthorized` sem rede. Não muda nada na interface do `AuthService`.
- **Opções fixas**: as de D1 da login-operador (`credentials: 'omit'`, `cache: 'no-store'`, `redirect: 'manual'`, `signal`), mais `Authorization: Bearer`. `GET /agents` não tem corpo; o JSON-RPC é `POST` com `content-type: application/json`.
- **Timeout**: 15 s por requisição, com o mesmo padrão de D3 da login-operador. Um `AbortController` por chamada; o motivo `timeout` é gravado antes do `abort()`; o timer é injetado.
- **Sem geração no main**: o cliente não guarda estado entre chamadas. Descartar respostas obsoletas é papel do renderer (D8).
- **JSON-RPC `id`**: contador inteiro do cliente. A resposta não é recusada por `id` diferente, porque a requisição HTTP já casa as duas pontas.
- **Reuso**: `classifyRejection`, a regra de redirecionamento (D2 da login-operador) e a expressão de data ISO (D5) saem de `src/main/auth/service.ts` para `src/main/http/` e são importadas pelos dois serviços. Os testes da autenticação continuam como estão.
- **Alternativa descartada**: dar ao `AuthService` um método `request()` autenticado. Misturaria autenticação, que é provisória e isolada em `src/main/auth`, com o protocolo A2A.

### D2. Mapeamento de erros
| Situação | Resultado |
|---|---|
| sem token ou sem sessão | `unauthorized`, sem rede |
| HTTP 401 (qualquer corpo) | `unauthorized` |
| redirecionamento (as três formas de D2 da login-operador) | `http` com status 3xx ou 0 |
| outro status ≠ 200 | `http` com o status |
| 200, corpo acima do limite ou JSON inválido | `bad-response` |
| 200 com `error` (antes de olhar `result`) | `rpc` com `code` e `message` (cortada em 500); `error` malformado → `bad-response` |
| 200 com `result` fora do formato | `bad-response` |
| rejeição `net::…` / timeout / outra | `unreachable` com a mensagem `net::`, `'timeout'` ou `'network'` |

Limites de corpo: 2 MiB em `/agents`, que traz `instructions` de cada agente e só é descartado no main, e 1 MiB no JSON-RPC.

`message` de `rpc` é texto livre em pt-BR. Serve para exibição (D18 #6) e para log, e nunca para decidir nada: só `code` é estável.

### D3. Validação do que entra e do que sai
- **`agentId`**: GUID, `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`. Ele entra no caminho da URL, então a regra exclui `/`, `..`, `?`, `#` e `%` por construção. Em `/agents`, um item com `id` fora da regra é descartado (D12).
- **`taskId` e `contextId`**: `^[A-Za-z0-9._:-]{1,128}$`. A plataforma gera GUIDs, mas o contrato os trata como opacos. A regra aceita qualquer id razoável e exclui o que poderia ser usado para injeção ou para inchar mensagens. Ela vale nos dois sentidos: no `parseArgs` e no que a plataforma devolve. Sem isso, o servidor poderia devolver um id que o IPC recusaria no `GetTask` seguinte, travando o turno com um erro de programação.
- **Timestamps**: a mesma expressão de D5 da login-operador (fração de 0 a 7 casas, fuso obrigatório), normalizados com `toISOString()`. Fora do formato, `null`, nunca `bad-response`: a duração tem plano B (D11).
- **Estados**: só os cinco de `TaskState`. Os outros quatro do protocolo nunca são produzidos pela plataforma e viram `bad-response`, sem lógica própria.
- **Validadores**: ficam em `src/shared/ids.ts`, usados pelo main (`parseArgs` e respostas) e pelo renderer (testes e simulação).

### D4. A resposta do agente: texto do último artifact
Em `COMPLETED`, `text` é a junção, com `"\n\n"`, das partes com `text` string do **último** item de `artifacts`. Partes sem `text` (dados, arquivos) são ignoradas. É a mesma leitura do worker da plataforma ao delegar entre agentes, então "a resposta" significa a mesma coisa nos dois lados. Hoje há um artifact com uma parte, e a regra só importa se a plataforma mudar.
- Sem artifact ou sem texto: `text = ""`, e a tela mostra "O agente não devolveu texto.". A task terminou bem, então não é `bad-response`.
- Nos outros estados, `text = null`. `status.message` nunca é lido: é sempre `null`, e a doc da plataforma diz isso.
- **Alternativa descartada**: concatenar todos os artifacts. Perderia a equivalência com a delegação e poderia repetir conteúdo se a plataforma passar a gravar rascunhos.

### D5. IPC
Canais em `src/shared/ipc-channels.ts`: `agents:list`, `chat:send`, `chat:getTask`, `clipboard:writeText`. `parseArgs` em `src/main/chat/ipc.ts` e `src/main/clipboard/ipc.ts`:

| Canal | Argumentos |
|---|---|
| `agents:list` | nenhum |
| `chat:send` | `agentId` GUID; `text` string, `1 ≤ length ≤ 16 000`, `trim() !== ''`; `contextId` id válido ou `null` |
| `chat:getTask` | `agentId` GUID; `taskId` id válido |
| `clipboard:writeText` | `text` string, `length ≤ 1024` |

- As mensagens de erro são fixas, sem valores, inclusive na `cause` (D7 da login-operador). Um texto de mensagem pode conter dados sensíveis do usuário.
- Argumento inválido é rejeição do IPC, não `ChatError`, porque o renderer valida antes.
- O preload implementa cada função com `ipcRenderer.invoke` no seu canal fixo.
- `EXPOSED_NAMESPACES = ['auth', 'agents', 'chat', 'clipboard']`.

### D6. Área de transferência pelo main
A fundação nega toda permissão do Chromium (D8 da fundação), inclusive `clipboard-sanitized-write`. Por isso, `navigator.clipboard.writeText` falha no renderer. A cópia vai por `clipboard:writeText`, que chama `clipboard.writeText` do Electron no main.
- **Genérico, mas pequeno**: o canal aceita qualquer texto de até 1 KiB, para não criar um canal por botão de copiar. Pelo limite, um renderer comprometido só consegue escrever na área de transferência um texto curto. A leitura da área de transferência não é exposta.
- **Alternativa descartada**: liberar `clipboard-sanitized-write` no handler de permissões. Afrouxaria um requisito da `janela-segura` por um botão.

### D7. Mudanças no contrato `src/shared/api.ts`
A fundação permite alterar o contrato, registrando aqui:
- `chat.send(...)` passa a devolver `{ taskId, contextId, state, submittedAt: string | null }`. `submittedAt` é o `status.timestamp` do `SendMessage`, base da duração (D11).
- `chat.getTask(...)` passa a devolver `{ state, text, timestamp: string | null }`. `timestamp` é o `status.timestamp` da consulta, o fim da duração quando o estado é terminal.
- O namespace novo `clipboard: { writeText(text: string): Promise<void> }` (D6).
- `EXPOSED_NAMESPACES` passa a `['auth', 'agents', 'chat', 'clipboard']`.
- A constante `MAX_MESSAGE_LENGTH = 16_000` (D16), usada pelo composer e pelo `parseArgs` de `chat:send`, para o limite ser um só nos dois lados.

`ChatError` não muda: `rpc` e `bad-response` já existem. Todas as mudanças são aditivas, e nenhum consumidor anterior existe.

### D8. Polling no renderer, numa máquina de estados pura
`src/renderer/src/conversation/task-poller.ts` exporta `createTaskPoller({ getTask, now, setTimeout, clearTimeout, intervalMs = 1000, deadlineMs = 90_000 })`.
- **Interface**: `start(taskId, startedAt)`, `extend()` (Continuar aguardando, com prazo novo a partir de `now()`) e `stop()`. Os eventos `onState`, `onDone(result)`, `onTimeout` e `onError` saem por callback.
- **Hook e componentes**: o hook `useConversation` liga o poller ao estado React. Os componentes não conhecem timers.
- **Uma consulta por vez**: a próxima só é agendada com `setTimeout(intervalMs)` depois da resposta da anterior. Nunca `setInterval`.
- **Prazo pelo relógio**: o limite é `startedAt + deadlineMs`. Depois de cada resposta não terminal, e antes de agendar a próxima, o poller compara `now()` com o limite. O Chromium desacelera timers de janelas ocultas ou minimizadas (`backgroundThrottling`), então contar consultas daria um prazo de vários minutos. A comparação acontece depois da resposta, então uma task que completou na consulta que passa do prazo ainda é mostrada como concluída.
- **Geração**: cada `start`/`stop` incrementa um contador. Uma resposta de geração antiga é descartada e não agenda nada.
- **Erros na consulta**:
  - `unreachable` e `http` 5xx são passageiros (queda de rede, reinício da API): o polling continua até o prazo;
  - `rpc` (por exemplo `-32001`), `bad-response` e `http` diferente de 5xx encerram o turno;
  - `unauthorized` encerra tudo (D14).
- **Por que no renderer**:
  - o contrato atual basta;
  - não cria o primeiro canal main → renderer;
  - a conversa já vive em memória no renderer, então sobreviver a um Cmd+R no main não traria nada.
- **Mudança para o main sem reescrita**: a máquina é pura e com dependências injetadas, então pode ir para o main se uma change futura precisar. A `historico-conversas` guarda o `taskId` pendente e chama `start` ao reabrir. A `sessao-expirada` chama `start` de novo depois do novo login.
- **Alternativa descartada**: polling no main com eventos para o renderer. Exigiria um canal de eventos no preload (`on`/`off` com assinatura fixa), gerência de assinantes e ciclo de vida por janela, sem ganho para esta change.

### D9. Reenviar e Continuar aguardando depois do prazo
O prazo esgotado não prova que a task morreu. Pode ser o caso raro em que ela nunca sai de `submitted`/`working` (mensagem descartada na infraestrutura), ou só um LLM lento. Pelo funcionamento do worker (Context):
- **Task morta**: não há trava presa nem sessão nova. O reenvio funciona sem efeito colateral.
- **Task lenta, ainda em `working`**: ela segura a trava. O reenvio espera até 30 s:
  - se a original terminar nesse tempo, o reenvio carrega a sessão dela (que já tem a pergunta e a resposta) e acrescenta a pergunta de novo. O agente vê a pergunta duas vezes e responde de novo;
  - se não terminar, o reenvio termina `FAILED` e cai no bloco de falha, que já tem **Reenviar**.
- **Task que completou depois do prazo e antes do clique**: é o caso evitável. O **Reenviar** do bloco de prazo faz antes um `chat.getTask` da original. Se ela estiver `COMPLETED`, mostra essa resposta e não reenvia. Em qualquer outro resultado, inclusive erro, reenvia.

**Continuar aguardando** chama `extend()`: mais 90 s sobre a mesma task, sem reenviar nada.

O composer fica bloqueado no estado de prazo esgotado: mandar outra mensagem no mesmo contexto bateria na trava. As saídas são **Continuar aguardando**, **Reenviar** e **Nova conversa**. A linha explicativa do bloco diz ao usuário o risco que sobra: "Se a primeira tentativa terminar depois, o agente pode ver a pergunta duas vezes."

### D10. Falha ambígua no `SendMessage`
Um `unreachable` (inclusive `timeout`), um `http` 5xx ou um `bad-response` no `SendMessage` não provam que nada foi criado: a API pode ter gravado a task e publicado o job antes de a resposta se perder. Como a plataforma não deduplica por `messageId` (Context), reutilizar o mesmo `messageId` no **Reenviar** não evitaria nada. O **Reenviar** desse caso faz um envio novo, com `messageId` novo, como todos os outros.
- O título do bloco não afirma que nada foi enviado: "Não foi possível confirmar o envio da mensagem.".
- Sem `taskId`, não há como consultar a task perdida. A duplicação possível vai para os Riscos.
- `rpc` no envio é diferente: a plataforma respondeu e recusou (por exemplo `-32600`, agente inexistente), então nada foi criado. O bloco diz "A plataforma recusou a mensagem." e mostra a `message` do erro (D18 #6).

### D11. Duração: horários do servidor, com o relógio local como plano B
A duração é `timestamp` do `GetTask` terminal menos `submittedAt` do `SendMessage`. Os dois vêm do servidor: a API grava o primeiro e o worker o segundo, os dois no mesmo banco, com precisão de microssegundo. Medir pelo relógio local erraria em até ~1 s, por causa do intervalo de polling, e a linha mostra uma casa decimal.
- **Plano B**: o relógio do renderer, do início do `chat.send` até a chegada do estado terminal, quando um dos horários é `null` (o banco permite) ou a diferença é negativa (relógios diferentes entre API e worker).
- **Formato**: uma casa decimal com vírgula, por `Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })`.
- **Horários exibidos** (`HH:mm` nas mensagens): sempre o relógio local. Assim, a resposta nunca aparece "antes" da pergunta por diferença de relógio entre cliente e servidor.

### D12. Agentes: lista, seleção e inativos
- `agents.list()` roda em três momentos: ao montar a tela, em **Nova conversa** (mesmo com a conversa vazia) e depois de um `REJECTED`. Uma recarga que falha com qualquer erro exceto `unauthorized` mantém a lista anterior em silêncio. Só a primeira carga mostra erro. Um `unauthorized`, na primeira carga ou numa recarga, segue D14: não há silêncio para sessão terminada.
- No main, um item inválido (`id` não GUID, `name` vazio, `isActive` não booleano) é descartado sozinho. Um agente estranho não deve derrubar a lista.
- O seletor (`Select` do Mantine) lista todos. Os inativos aparecem desabilitados, com " (inativo)". A seleção inicial é o primeiro ativo, na ordem da plataforma.
- **Agente da conversa inativo ou ausente numa recarga**:
  - o selo vira **Inativo** e o composer é bloqueado com "{agente} está inativo. Escolha outro agente ou comece uma nova conversa.";
  - a conversa continua visível;
  - o caso típico é um `REJECTED` no envio seguinte, que dispara a recarga;
  - se o agente voltar a ficar ativo numa recarga posterior, o bloqueio sai;
  - quando o agente some da lista, a conversa guarda o `AgentSummary` com que começou, para continuar mostrando nome e descrição.

### D13. Nova conversa, troca de agente e confirmação provisória
O `contextId` pertence ao agente: o worker separa o contexto por `AgentId`. Por isso, trocar de agente começa uma conversa nova. Sem a `historico-conversas`, começar outra conversa apaga a atual sem volta. Por isso, a confirmação (modal do Mantine) vale para **Nova conversa** e para a troca de agente, só quando a conversa tem ao menos uma mensagem. Os textos estão no spec.
- **Cancelar** na troca devolve o seletor ao agente da conversa: o `Select` é controlado pelo estado da conversa, não pelo valor escolhido.
- Confirmar chama `stop()` no poller. Uma resposta tardia é descartada pela geração.
- A `historico-conversas` remove a confirmação, porque a conversa anterior passa a ficar na lista.

### D14. `unauthorized`: comportamento mínimo e honesto
Qualquer `unauthorized` de `agents` ou `chat` (401, ou sessão vencida no main) leva ao mesmo caminho:
1. `stop()` no poller;
2. `auth.logout()`, que limpa o main mesmo que o 401 tenha vindo de um token revogado antes do `expiresAt`;
3. volta ao login (variante de acessos seguintes);
4. `notifications.show` com "A sessão terminou. Entre de novo para continuar." (o `<Notifications />` já está montado no `App`).

A conversa em memória se perde, e o design não esconde isso: não há retomada nem reenvio. O contador do rodapé chegando a zero continua com o comportamento da login-operador (`status()` e volta ao login, sem notificação). A `sessao-expirada` substitui os dois pelo banner, pelo modal e pela retomada (`start` de novo no poller, D8).

### D15. Markdown: `react-markdown` + `remark-gfm`, sem HTML bruto
Versões atuais: `react-markdown` 10.1 (peer `react >= 18`) e `remark-gfm` 4.0. As duas são ESM e entram no bundle do renderer pelo Vite, então o `!node_modules/**/*` do `electron-builder` não as afeta (comprovado pela fumaça do pacote).
- **Sem `rehype-raw`**: o HTML do texto vira texto. Não há `skipHtml`: mostrar o HTML como texto é mais honesto que sumir com ele.
- **Links**: `urlTransform` padrão, que mantém `http`, `https`, `mailto` e relativos e descarta `javascript:`, `data:` etc. O `<a>` não ganha `onClick`. O clique navega, e a guarda `will-navigate` da fundação cancela a navegação e abre http(s) no navegador. O resto é descartado.
- **Imagens**: o componente `img` vira um `<a href={src}>{alt || src}</a>`. A CSP (`img-src 'self'`) bloquearia a imagem, e um ícone quebrado é pior que um link. Abrir é escolha do usuário.
- **Código**: `code` e `pre` com `ff="monospace"` (Plex Mono). O `pre` usa a superfície e tem `overflow-x: auto`.
- **Tabelas**: `Table` do Mantine, com rolagem horizontal.
- Nada disso usa script inline nem `eval`, o que é compatível com a CSP de produção.
- **Alternativa descartada**: `marked` + sanitizador. Produz HTML string e exigiria `dangerouslySetInnerHTML` e um sanitizador sob manutenção nossa.

### D16. Composer e limite da mensagem
16 000 caracteres (`string.length`, as unidades UTF-16 que o `parseArgs` também conta). A plataforma não impõe limite além do padrão do Kestrel, e 16 000 cobre colar um trecho de código com folga.
- Colar acima do limite não corta o texto: cortar no meio de um código seria pior.
- O contador "{n} / 16.000", com separador de milhar pt-BR, aparece a partir de 14 400 (90%).
- Acima do limite, o envio fica desabilitado e aparece a mensagem na cor de validação.
- Texto só com espaços conta como vazio. O texto vai como foi digitado, sem `trim`.
- Enter envia quando `!event.shiftKey && !event.nativeEvent.isComposing`.

### D17. Estado da conversa (em memória)
```
Conversation { agent: AgentSummary, contextId: string | null, title: string | null, turns: Turn[] }
Turn {
  id, text, sentAt (local),
  attempt:
    | { kind: 'sending' }
    | { kind: 'pending',   taskId, state: 'SUBMITTED' | 'WORKING', submittedAt, startedAtLocal }
    | { kind: 'completed', taskId, text, receivedAt (local), durationSeconds }
    | { kind: 'failed' | 'rejected', taskId }
    | { kind: 'timeout',   taskId, lastState }
    | { kind: 'send-error', error: ChatError }
    | { kind: 'poll-error', taskId }
}
```
- O `contextId` é gravado na conversa na primeira resposta de `SendMessage` que o traz, inclusive `REJECTED`, e reenviado em todos os envios seguintes.
- O título é fixado no primeiro envio.
- **Reenviar** troca o `attempt` do mesmo `Turn`, sem criar outro balão.
- Só o último `Turn` pode estar em `sending`, `pending` ou `timeout`.

### D18. Fidelidade ao protótipo e divergências
O protótipo é seguido em textos, ordem, estados e hierarquia visual. Divergências, todas no padrão visual dos elementos existentes:

| # | Divergência | Motivo | Padrão visual |
|---|---|---|---|
| 1 | Bloco **Rejeitada**: "O agente não aceitou a mensagem: pode estar inativo ou sem modelo configurado.", sem ação | Estado não desenhado no protótipo; texto da exploração | Bloco de falha |
| 2 | Bloco **Sem resposta a tempo**: "O agente não respondeu a tempo." + "Se a primeira tentativa terminar depois, o agente pode ver a pergunta duas vezes." + **Continuar aguardando** e **Reenviar** | D9 | Bloco de falha; os dois botões em contorno vermelho |
| 3 | Linha explicativa do bloco **Falha**: "A plataforma não informa o motivo. Você pode reenviar a mensagem." | O protótipo tem "uma linha explicativa" sem texto fixo; a plataforma não dá motivo | Bloco de falha |
| 4 | Bloco **Falha no envio**: "Não foi possível confirmar o envio da mensagem." + "Confira a conexão com o serviço e tente de novo." + **Reenviar** | D10 | Bloco de falha, sem linha de metadados (não há task) |
| 5 | Bloco **Falha ao acompanhar**: "Não foi possível acompanhar a resposta do agente." + **Reenviar** | D8 (`rpc`/`bad-response` no polling) | Bloco de falha |
| 6 | Bloco **Recusa da plataforma** (`rpc` no envio): "A plataforma recusou a mensagem." + a `message` do erro + `erro {code}` | D10; a `message` é pt-BR e serve para exibição | Bloco de falha |
| 7 | Pílula do pendente com o estado real (`Submitted` ou `Working`) | O protótipo mostra só `Working`; `Submitted` é o estado até um worker pegar a task | Pílula do pendente |
| 8 | "O agente não devolveu texto." no lugar do Markdown | D4 | Texto secundário, 13 px |
| 9 | "Carregando agentes…", "Não foi possível carregar os agentes." + **Tentar de novo**, "Nenhum agente cadastrado na plataforma.", "Nenhum agente ativo no momento." | D12; o protótipo parte de uma lista carregada | Carregamento: texto secundário centralizado; falha: bloco de falha; vazios: o cartão da conversa vazia, só com o texto |
| 10 | " (inativo)" no seletor e composer bloqueado com "{agente} está inativo. Escolha outro agente ou comece uma nova conversa." | D12 | Item desabilitado do `Select`; placeholder do composer |
| 11 | Modais de confirmação de **Nova conversa** e da troca de agente | D13, provisórios | `Modal` do Mantine; ação principal em primário preenchido, **Cancelar** em `default` |
| 12 | Contador "{n} / 16.000" e "A mensagem passa do limite de 16.000 caracteres." abaixo do composer | D16 | 11 px secundário; a mensagem em `--mantine-color-red-text` |
| 13 | Notificação "A sessão terminou. Entre de novo para continuar." na tela de login | D14 | `notifications.show` padrão |
| 14 | Separador de dia "Ontem" e `dd/mm/aaaa` | Uma conversa aberta pode atravessar a meia-noite; o protótipo só mostra "Hoje" | Separador de dia |
| 15 | Foco devolvido ao textarea quando o composer deixa de estar bloqueado (resposta, falha, rejeição, Nova conversa…), só se o foco estava nele quando o bloqueio começou e nenhum outro elemento recebeu foco no intervalo | Quem envia com Enter continua digitando sem clicar de novo; o protótipo não define o foco. Quem saiu para outro elemento não tem o foco puxado de volta | Sem mudança visual |

### D19. Cores e contraste
Calculado com as escalas do tema (`src/renderer/src/test/contrast.ts`):
- **Balão do usuário**: `--mantine-color-butecoBlue-light`, que é o "azul 1" do protótipo no claro (`butecoBlue[1]`, `#eef3fb`). No escuro, o Mantine usa `butecoBlue[9]` escurecido 50% (`#0d203c`).
  - Texto `--mantine-color-text`: 18,9:1 no claro e cerca de 10:1 no escuro.
  - O protótipo não define o escuro; a variável do Mantine é a escolha consistente.
- **Selo Ativo** (verde claro): fundo `--mantine-color-green-light`.
  - O texto padrão do Mantine é `green[9]` no claro, mas `green[0]`, quase branco, no escuro. É o mesmo problema do bloco de erro (D12 da login-operador).
  - Variável nova `--buteco-color-success-text`: `green[9]` no claro (4,8:1 sobre `green[1]`) e `green[4]` no escuro (5,5:1 sobre `#0d3d25`).
- **Blocos de falha**: reusam `--buteco-color-error-text` sobre `--mantine-color-red-light`, já testado.
- **Texto secundário na timeline** (horários, metadados): `--mantine-color-dimmed` sobre o fundo da página, já testado.

### D20. Layout
- A raiz é `display: flex`, com altura `100vh`.
- **Barra lateral**: coluna de 288 px, com a área de histórico reservada como um `flex: 1` vazio, para o rodapé ficar no fim.
- **Área principal**: coluna com cabeçalho fixo, timeline rolável e composer fixo. Timeline e composer ficam centralizados, com `max-width: 760px`.
- **Breakpoint**: abaixo de 860 px, a raiz vira coluna e a barra lateral fica com largura total e sem a área reservada.
  - Regra CSS em `global.css` (`@media (max-width: 859.98px)`), sem JS.
  - A janela tem `minWidth: 720`, então um breakpoint de 768 (o `sm` do Mantine) quase nunca apareceria.
  - **Por classes, não por props de estilo**: uma regra `@media` de folha de estilo não sobrescreve estilo inline. A largura da barra lateral, a direção da raiz e a exibição da área reservada são definidas por classes (no `global.css` ou num CSS module), nunca por props de estilo do Mantine (`w`, `display`, `direction`, `style`…), que viram estilo inline ou variáveis com precedência própria. Os demais elementos podem usar as props normalmente.
- **Rolagem**: a timeline rola para o fim quando chega um item novo, se o usuário já estava perto do fim.

### D21. Layout do código
```
src/shared/api.ts                      D7
src/shared/ipc-channels.ts             + agents:list | chat:send | chat:getTask | clipboard:writeText
src/shared/ids.ts                      isGuid, isTaskOrContextId (+ teste)
src/main/http/                         classifyRejection, redirecionamento, ISO_DATE_TIME (extraídos da auth)
src/main/chat/client.ts                createChatClient (+ teste)
src/main/chat/ipc.ts                   parseArgs e registro (+ teste)
src/main/clipboard/ipc.ts              clipboard:writeText (+ teste)
src/main/index.ts                      cria o cliente e registra os canais em whenReady
src/preload/index.ts                   agents, chat, clipboard
src/renderer/src/App.tsx               session → ConversationScreen; onSessionEnded (D14)
src/renderer/src/conversation/
  ConversationScreen.tsx               layout, barra lateral, cabeçalho, área principal
  Sidebar.tsx, SessionFooter.tsx, AgentSelect.tsx
  ConversationHeader.tsx, EmptyConversation.tsx, Timeline.tsx, Composer.tsx
  blocks/ (UserMessage, AgentReply, PendingReply, StateBlock)
  Markdown.tsx                         D15
  task-poller.ts                       D8 (+ teste)
  use-conversation.ts                  estado de D17, envio, Reenviar, Continuar aguardando
  format.ts                            título, contextId abreviado, duração, separador de dia (+ teste)
  test-chat.ts                         window.buteco simulado
```
`SessionScreen.tsx` sai. A marca (`Brand.tsx`) e o `SectionLabel` são reaproveitados.

### D22. Observação externa: limite do histórico na plataforma
`docs/a2a-integration.md` diz que o histórico reenviado ao LLM é limitado às "últimas 20 mensagens", mas o worker usa `MaxHistoryMessages = 200` (`AgentExecutionService.cs:58`). Não afeta o cliente: ele não monta histórico, só reenvia o `contextId`. Fica registrado para ser levado à plataforma.

### D23. Processo: um commit por change
A partir desta change, cada change gera um único commit, feito depois do arquivamento. O `context` de `openspec/config.yaml` recebe a regra: "Um commit por change, feito depois do arquivamento; nada é commitado durante a change." Essa alteração entra no commit desta change.

### Notas do sync
O `Purpose` de `openspec/specs/autenticacao/spec.md` foi ajustado à mão no sync, porque o formato do delta não tem operação para `Purpose`. A troca:
- antes: "… garantir uma instância do app por pasta de dados e oferecer as telas de login e o destino pós-login provisório.";
- depois: "… garantir uma instância do app por pasta de dados e oferecer as telas de login.".

O arquivamento roda sem reaplicar os deltas, então a edição se mantém.

## Risks / Trade-offs

- [Reenviar depois de uma falha ambígua no envio pode criar uma segunda task com a mesma pergunta] → A plataforma não deduplica por `messageId` (Context), e sem `taskId` não há o que consultar. Se a primeira task existir e completar, o agente verá a pergunta duas vezes no contexto. O texto do bloco não afirma que nada foi enviado. Uma deduplicação na plataforma resolveria; registrar como pedido externo.
- [Reenviar depois do prazo com a original ainda em `working`] → D9: a consulta prévia cobre o caso de a original já ter completado. Se ela completar durante a espera da trava, o agente vê a pergunta duas vezes. Se não, o reenvio vira `FAILED` em até 30 s e cai no bloco de falha. A linha explicativa do bloco avisa.
- [Timers desacelerados com a janela oculta] → O prazo é pelo relógio (D8). A consulta seguinte pode atrasar, mas o turno nunca passa do prazo sem ser avaliado na resposta seguinte.
- [Uma resposta enorme ou um Markdown patológico travando o renderer] → Corpo do JSON-RPC limitado a 1 MiB no main. O `react-markdown` não tem execução de código. Uma tabela imensa só fica lenta.
- [Links da resposta abrem o navegador para qualquer http(s)] → É decisão do usuário clicar, e o destino aparece no texto do link. `javascript:` e outros esquemas são descartados duas vezes, pelo `urlTransform` e pela guarda de navegação.
- [Duração com relógios diferentes entre API e worker] → A diferença negativa usa o relógio local (D11). Uma diferença positiva com erro pequeno é aceita.
- [Conversa perdida num 401 ou ao recarregar o renderer] → Em memória, por escopo. O design diz isso na notificação de D14. A `historico-conversas` e a `sessao-expirada` resolvem.
- [O texto livre de `rpc` mostrado ao usuário pode mudar ou ser técnico] → Só exibição, cortado em 500 caracteres, com o `code` ao lado. Nenhuma lógica depende dele.
- [Lista de agentes grande] → Sem paginação na plataforma. O limite de 2 MiB cobre centenas de agentes com instruções longas. Acima disso, `bad-response` e o bloco de erro da lista.

## Migration Plan

Nada em produção nem dado a migrar: a conversa é só em memória e o `localStorage` não ganha chave. Rollback: reverter o commit da change.

## Open Questions

Nenhuma.
