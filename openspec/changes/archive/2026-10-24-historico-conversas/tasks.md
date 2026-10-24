## 1. Armazenamento (puro, com `Storage` injetado)

- [x] 1.1 `src/renderer/src/history/validate.ts` (D5): validação de uma conversa gravada (`id`, `AgentSummary` com `isGuid`, `contextId` e `taskId` com `isTaskOrContextId`, `title`, datas finitas, turnos com id inteiro positivo único, texto de até 16 000 caracteres, `sentAt` finito e `attempt` com `kind` e campos conhecidos, inclusive `interrupted`, `not-sent`, `resumed` em `pending`, `timeout` e `awaiting-login` / `poll`, e `completed.durationSeconds` `number | null`). Uma conversa sem turnos é inválida.
- [x] 1.2 Testes da validação: um caso válido por `kind` de `Attempt`, e um caso inválido por regra (campo ausente, tipo errado, `agent.id` não GUID, `contextId: "../x"`, turno com id repetido, texto com 16 001 caracteres, `kind` desconhecido, conversa sem turnos)
- [x] 1.3 `src/renderer/src/history/normalize.ts` (D15): `sending` → `interrupted`; `awaiting-login` / `send` → `not-sent`; `awaiting-login` / `poll` → `pending` com os mesmos dados; os demais sem mudança; `lastActivityAt` intacto. Testes de cada linha da tabela.
- [x] 1.4 `src/renderer/src/history/storage.ts`, leitura (D5):
  - chave `buteco-chat:sessions:<baseUrl>`;
  - ausente → vazia;
  - JSON inválido, sem `version` inteiro ou `version` < 1 → cópia em `buteco-chat:sessions-corrupt:<baseUrl>` (falha da cópia ignorada) e lista vazia;
  - `version` > 1 → lista vazia e modo só-memória;
  - `version: 1` → validação por conversa e normalização;
  - ids repetidos → fica a primeira;
  - `getItem` lançando → vazia e só em memória.
- [x] 1.5 `storage.ts`, gravação (D4, D8):
  - `{ version: 1, conversations }` só com as conversas com turnos;
  - nada no modo só-memória;
  - teto de 100 por serviço pela `lastActivityAt`, nunca a aberta, devolvendo os ids removidos;
  - em `QuotaExceededError`: remover as chaves `buteco-chat:sessions-corrupt:*` e tentar de novo; depois, a conversa mais antiga entre as chaves `buteco-chat:sessions:*` de `version: 1` de todos os serviços, nunca a aberta, reescrevendo a chave do outro serviço e tentando de novo; com só a aberta, desistir sem lançar;
  - outro erro do `setItem` → desistir sem lançar;
  - devolver os ids do serviço atual removidos, para a tela tirar da lista.
- [x] 1.6 Testes do armazenamento com um `Storage` simulado e cota configurável:
  - leitura de cada linha da tabela de D5, inclusive a cópia que falha por cota;
  - versão 2 nunca sobrescrita depois de gravações;
  - teto de 100;
  - ordem do LRU (a cópia corrompida primeiro, depois a conversa mais antiga de qualquer serviço, nunca a aberta);
  - chave de outro serviço com versão 2 ou JSON inválido não é tocada;
  - só a aberta e sem espaço → sem exceção;
  - nenhuma chave gravada contém `token`, `password` ou `expiresAt`.

## 2. Formatação da lista

- [x] 2.1 `src/renderer/src/history/list-format.ts` (D16):
  - `groupOf(lastActivityAt, now)`: `today` (mesmo dia ou futuro), `yesterday`, `week` (2 a 6 dias), `older`;
  - `itemTime(lastActivityAt, now)`: `HH:mm`, "ontem", dia da semana por tabela fixa (dom…sáb), `dd mmm` por tabela fixa (jan…dez) e o ano quando ele é outro;
  - `matchesSearch(title, query)`: NFD sem marcas combinantes, `toLocaleLowerCase('pt-BR')`, "contém", espaços nas pontas ignorados, busca vazia aceita tudo.
- [x] 2.2 Testes com o relógio fixo em sábado, 24/10/2026: os cenários "Grupos com itens" e "Horários por grupo", a virada do ano, uma data futura em **Hoje**, a meia-noite (23:59 de ontem → **Ontem**), "SITUACAO" achando "Situação do pedido" e a busca só de espaços

## 3. Estado de várias conversas (`use-conversation.ts`)

- [x] 3.1 Modelo de D1: `{ conversations, openId }`, `Conversation` com `id`, `createdAt` e `lastActivityAt`, próximo id de turno por conversa (o maior + 1). `useConversation(serviceUrl)` lê o armazenamento ao montar.
- [x] 3.2 Endereçamento (D2):
  - `updateTurn(conversationId, turnId, attempt)` e `setContextId(conversationId, …)`, que ignoram uma conversa inexistente;
  - `dispatch` e o `getTask` prévio de `resend` gravam na conversa de origem;
  - com a origem fechada, um estado não terminal vira `pending` sem `start`;
  - a geração só muda no Sair e na desmontagem.
- [x] 3.3 Poller (D2, D6):
  - `pollingRef = { conversationId, turnId, agentId }`, com `getTask` usando `agentId`;
  - abrir uma conversa com o último turno `pending` chama `start(taskId, Date.now(), state)` e marca `resumed: true`;
  - sair da aberta chama `stop()` e mantém o turno `pending`;
  - os callbacks do poller continuam estáveis (comentário do hook).
- [x] 3.4 Duração (D7): `completed.durationSeconds` é `null` quando `resumed` é `true` e os horários do servidor faltam ou dão diferença negativa; `resumed` preservado em `timeout` e `awaiting-login` / `poll`, e devolvido ao `pending` em Continuar aguardando, no novo login e no Reenviar que encontra a original concluída (teste: retomada → prazo esgotado → Continuar aguardando → `COMPLETED` sem horários → sem duração; e o caminho pelo novo login)
- [x] 3.5 Gravação estrutural (D4): gravar só quando `kind` muda, quando `state` muda dentro de `pending`, e na criação de turno, no `contextId`, no título e na exclusão; tirar da lista os ids que o armazenamento devolver como removidos
- [x] 3.6 Última atividade (D9): atualizar no envio (novo, Reenviar, envio retido depois do login) e no estado terminal (resposta do envio, polling, `getTask` prévio de Reenviar). Lista ordenada pela última atividade.
- [x] 3.7 Abertura ao entrar (D11): a de `lastActivityAt` mais recente, sem esperar a lista; sem histórico, o rascunho do primeiro ativo quando a lista carregar
- [x] 3.8 Rascunho, Nova conversa e troca de agente (D10), sem modal:
  - no máximo um rascunho, removido ao abrir outra conversa;
  - **Nova conversa** só recarrega a lista quando ela não carregou, com o rascunho aberto ou sem agente ativo; senão, cria o rascunho com o agente aberto, se ativo, ou o primeiro ativo;
  - a troca de agente muda o rascunho, ou cria um rascunho com o agente escolhido.
- [x] 3.9 `agentStatus: 'unknown' | 'active' | 'inactive'` (D12) no lugar de `agentActive`, com o desconhecido na carga e na falha da primeira carga
- [x] 3.10 Excluir (D13): remove da memória e do disco; aberta → `stop()` e rascunho com o mesmo agente; os resultados em andamento são ignorados pela busca do id
- [x] 3.11 Sessão expirada (D14):
  - abrir uma conversa `pending` durante a expiração → `awaiting-login` / `poll`, sem consulta;
  - `renew`: `dispatch` dos `awaiting-login` / `send` de todas as conversas; os `poll` voltam a `pending`, com `start` só na aberta;
  - o caso do banner vem da conversa aberta;
  - **Excluir** bloqueado;
  - o Sair não descarta.
- [x] 3.12 Reenviar em `interrupted` e `not-sent` (D15), como em `send-error`. `BUSY` não inclui os dois.

## 4. Telas

- [x] 4.1 `ConversationList.tsx` (D16):
  - busca de 34 px com a lupa e `aria-label` "Buscar conversas";
  - lista rolável com borda acima e padding 4×8;
  - grupos com `SectionLabel` e padding 12×8×6, só com itens;
  - item como botão de largura total (8×10, raio 7 px), com duas linhas truncadas e o nome do agente guardado;
  - item ativo com `butecoBlue-light`, `--buteco-color-accent-text`, peso 500 e `aria-current="true"`;
  - "Nenhuma conversa encontrada.";
  - lixeira `ActionIcon` `subtle` como irmão do botão, visível em `:hover`/`:focus-within`, com `aria-label` "Excluir conversa {título}", ausente no rascunho e desabilitada na sessão expirada.
- [x] 4.2 `DeleteConversationModal.tsx` (D13): os textos, a frase da resposta pendente quando o último turno está em `sending`, `pending`, `timeout` ou `awaiting-login`, e **Cancelar** e **Excluir conversa** (`color="red"`, preenchido)
- [x] 4.3 `Sidebar.tsx`: a lista no lugar de `history-placeholder`; o seletor com o agente ausente como item desabilitado " (inativo)" e, com o agente desconhecido, desabilitado mostrando o agente guardado
- [x] 4.4 `ConversationScreen.tsx`:
  - sair o `Discard`, os modais e `PENDING_NOTE`;
  - os placeholders "Carregando agentes…" e "Agentes indisponíveis no momento";
  - o bloco "Não foi possível carregar os agentes." com **Tentar de novo** acima do composer quando há conversa aberta;
  - `Timeline` com `key` pelo id da conversa (rolagem até o fim ao abrir).
- [x] 4.5 `ConversationHeader.tsx`: sem selo de estado com o agente desconhecido. `Timeline.tsx`/`StateBlock.tsx`: os blocos `interrupted` e `not-sent`. `AgentReply.tsx`: linha de metadados sem duração quando ela é `null`.
- [x] 4.6 `global.css`: classes da lista, do item, do hover e da lixeira; abaixo de 860 px, a área da lista visível com `max-height: 30vh` e rolagem (no lugar do `display: none`), por classe e não por prop de estilo (D20 da `conversa-a2a`)
- [x] 4.7 `css-variables.ts`: `--buteco-color-accent-text` (`butecoBlue[8]` / `butecoBlue[3]`) e, no bloco `dark`, `--mantine-color-red-filled` → `var(--mantine-color-red-6)` e `--mantine-color-red-filled-hover` → `var(--mantine-color-red-7)` (D13), com o comentário citando esta change

## 5. Testes do renderer

Com `window.buteco` simulado (`test-chat.ts`), um `localStorage` simulado por teste e timers falsos.

- [x] 5.1 Persistência:
  - envio e resposta gravam a conversa (cenário "Conversa gravada depois da resposta");
  - o rascunho não é gravado;
  - cinco consultas `WORKING` seguidas gravam uma vez;
  - armazenamento que lança → o app funciona;
  - depois de um novo login com a senha `s3nh@`, nenhum valor do `localStorage` contém `s3nh@`.
- [x] 5.2 Reabrir (desmontar e montar a tela com o mesmo `localStorage`):
  - abre a conversa mais recente, com a timeline antes de `agents.list()` responder;
  - com a task pendente → `getTask` da mesma task, sem `chat.send`, com prazo de 90 s a partir da abertura;
  - só a conversa aberta é consultada;
  - `sending` → bloco do envio interrompido e **Reenviar**;
  - envio retido → "A mensagem não foi enviada." sem `chat.send` até o clique;
  - task retida → pendente e consulta.
- [x] 5.3 Várias conversas:
  - trocar de conversa durante o envio → `contextId` e task na origem, sem consulta, e retomada ao voltar com o agente de A;
  - `REJECTED` com a origem fechada;
  - consulta em andamento descartada ao abrir outra conversa, com o turno ainda pendente;
  - resposta retomada sem horários do servidor → metadados sem duração; com os horários → com a duração.
- [x] 5.4 Ordem: a resposta faz a conversa subir; abrir, retomar, `Submitted` → `Working` e prazo esgotado não mudam a ordem
- [x] 5.5 Lista:
  - grupos e horários com o relógio fixo;
  - item ativo com `aria-current`;
  - busca sem acento e sem resultado;
  - Nova conversa no topo de **Hoje**;
  - rascunho removido ao sair dele;
  - item de agente ausente com o nome guardado.
- [x] 5.6 Nova conversa e troca de agente: sem modal; troca com mensagens, troca com o rascunho, Nova conversa com o rascunho aberto, com resposta pendente (A continua pendente na lista) e a partir de agente inativo
- [x] 5.7 Agente: desconhecido na carga (sem selo de estado, "Carregando agentes…", seletor desabilitado com o agente guardado), falha da primeira carga com conversa (bloco acima do composer e **Tentar de novo**) e agente ausente (**Inativo**, seletor com "Antigo (inativo)")
- [x] 5.8 Excluir:
  - outra conversa;
  - a aberta → rascunho do mesmo agente;
  - com resposta pendente → frase do modal e nenhuma consulta depois;
  - envio em andamento de uma conversa excluída → descartado e fora da chave;
  - **Cancelar**.
- [x] 5.9 Sessão expirada:
  - busca e seleção liberadas, **Nova conversa**, seletor e lixeira desabilitados;
  - abrir uma conversa pendente → pílula "Aguardando novo login para retomar" sem consulta;
  - envio retido em A com B aberta → um único `chat.send` de A no login;
  - task de A com B aberta → consulta só ao abrir A;
  - **Sair** com resposta pendente → após novo login no mesmo serviço, a conversa aparece com a resposta pendente.
- [x] 5.10 Sair: a lista volta no mesmo serviço, e outro serviço mostra outra lista
- [x] 5.11 Separadores na conversa reaberta: "20/10/2026", "Ontem" e "Hoje"
- [x] 5.12 Largura estreita: a busca e a lista continuam visíveis (classe com `max-height: 30vh`, sem `display: none`), conferida pela regra CSS em `src/shared/sidebar-css.test.ts`, no padrão de `page-background.test.ts` (o jsdom não aplica a media query, e o renderer não tem os tipos do Node para ler o arquivo)
- [x] 5.13 Contraste (`identidade-visual`): `--buteco-color-accent-text` sobre `--mantine-color-butecoBlue-light` e `--mantine-color-dimmed` sobre `--mantine-color-default-hover`, nos dois esquemas, e os valores `#1e4d92` e `#b0c8ee`. Branco sobre `--mantine-color-red-filled` e `--mantine-color-red-filled-hover`, nos dois esquemas, resolvendo para `#cf3a2b` e `#c23325`; o contorno vermelho dos blocos de falha continua igual. Medição prévia: 7,4:1 e 9,6:1; 5,1:1 e 5,2:1; vermelho 4,9:1 e 5,5:1. Se algum par ficar abaixo de 4,5:1, parar e registrar em D16.
- [x] 5.14 Remover ou reescrever os testes dos modais de descarte ("Trocar de agente com mensagens", "Nova conversa com resposta pendente" com confirmação) e os de "Sair descarta a conversa"
- [x] 5.15 Conferir por mutação as guardas de endereçamento (D2), de gravação estrutural (D4), do modo só-memória (D5) e da aberta nunca removida (D4, D8)

## 6. Verificação

- [x] 6.1 Rodar `npm run typecheck`, `npm test`, `npm run build` e `npm run test:build`
- [x] 6.2 Parar para a revisão do código pelo usuário
- [x] 6.3 Fumaça em dev contra a plataforma local (`http://localhost:5017`), manual, feita pelo usuário. Parar, deixar o dev rodando e entregar o roteiro:
  - duas conversas com agentes diferentes, troca entre elas com uma resposta pendente, e a resposta aparece ao voltar;
  - fechar o app com uma resposta pendente e reabrir: a resposta aparece sem pergunta duplicada no agente;
  - recarregar o renderer (Ctrl+R/Cmd+R em dev) no meio de uma conversa;
  - busca, grupos, item ativo, Excluir (com e sem pendente);
  - largura estreita;
  - Sair e entrar de novo no mesmo serviço;
  - sessão expirada com o TTL de 2 min, lendo outra conversa durante a expiração;
  - esquemas claro e escuro.
- [x] 6.4 Fumaça no app empacotado, manual, feita pelo usuário:
  - histórico mantido depois de fechar e abrir;
  - nenhuma violação de CSP no console;
  - nenhum token, senha ou corpo de resposta no stdout;
  - o arquivo do `Local Storage` na pasta de dados não contém a senha usada.
- [x] 6.5 Atualizar o `README.md`: onde o histórico fica, que ele é separado por serviço, que fica em texto puro e como excluir uma conversa
- [x] 6.6 Fechamento sem commits intermediários:
  - `/opsx:sync` e revisão dos specs pelo usuário;
  - `/opsx:archive` sem reaplicar os deltas;
  - conferir que `openspec/specs/` não mudou no arquivamento;
  - conferir que nada de `out/`, `release/` ou `node_modules/` entra;
  - um único commit `feat: histórico de conversas por serviço (historico-conversas)`, só com autorização explícita.
