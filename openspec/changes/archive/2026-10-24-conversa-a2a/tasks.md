## 1. Contrato compartilhado e processo

- [x] 1.1 Em `src/shared/api.ts`, aplicar D7:
  - `submittedAt` em `chat.send`;
  - `timestamp` em `chat.getTask`;
  - namespace `clipboard`;
  - `EXPOSED_NAMESPACES = ['auth', 'agents', 'chat', 'clipboard']`.
- [x] 1.2 Em `src/shared/ipc-channels.ts`, declarar `agents:list`, `chat:send`, `chat:getTask` e `clipboard:writeText`
- [x] 1.3 Implementar `src/shared/ids.ts` (`isGuid`, `isTaskOrContextId`, D3). Testes:
  - GUID válido, maiúsculo e minúsculo;
  - recusados: `../auth/login`, `x/y`, `x?y`, `%2e%2e`, GUID com `/` no fim;
  - id com 128 e 129 caracteres;
  - caracteres fora de `[A-Za-z0-9._:-]`.
- [x] 1.4 Acrescentar ao `context` de `openspec/config.yaml`: "Um commit por change, feito depois do arquivamento; nada é commitado durante a change." (D23)

## 2. Utilitários HTTP do main

- [x] 2.1 Extrair de `src/main/auth/service.ts` para `src/main/http/` o `classifyRejection`, a regra de redirecionamento e `ISO_DATE_TIME` (D1), e importá-los na autenticação sem mudar comportamento
- [x] 2.2 Rodar os testes de `src/main/auth/` sem alterá-los e confirmar que passam

## 3. Cliente da plataforma (main)

- [x] 3.1 Implementar `createChatClient({ fetch, auth, setTimeout, clearTimeout, randomUUID })` em `src/main/chat/client.ts` (D1):
  - sessão lida de `auth.status().serviceUrl` e `auth.getToken()`, e `unauthorized` sem rede quando falta;
  - opções fixas, Bearer e timeout de 15 s;
  - limites de corpo de D2.
- [x] 3.2 Implementar `agents.list` com o descarte de campos e de itens inválidos (D12)
- [x] 3.3 Implementar `chat.send`:
  - corpo JSON-RPC de `SendMessage`, `messageId` novo, `contextId` omitido quando `null`, sem `taskId`;
  - validação de `result.task` (ids, estado, `submittedAt`).
- [x] 3.4 Implementar `chat.getTask`: corpo de `GetTask`, verificação de `result.id`, texto do último artifact (D4) e `timestamp`
- [x] 3.5 Implementar o mapeamento de erros de D2: `error` antes de `result`, `message` cortada em 500
- [x] 3.6 Testes com `fetch` simulado, em `/agents`:
  - 200 com descarte de `instructions`, `provider` e `model`;
  - inativos mantidos;
  - item com `id` inválido descartado;
  - corpo `{}` e não-JSON → `bad-response`;
  - 401 e 500;
  - redirecionamento nas três formas;
  - `net::ERR_CONNECTION_REFUSED`;
  - timeout de 15 s com timers falsos;
  - URL com prefixo `https://host/buteco/agents`;
  - cabeçalho `Authorization` e opções da requisição.
- [x] 3.7 Testes do JSON-RPC:
  - `error` em HTTP 200 → `rpc` com `code` e `message`;
  - `error` e `result` juntos → `rpc`;
  - `error` malformado → `bad-response`;
  - 401 com corpo vazio → `unauthorized`;
  - `SendMessage` sem `contextId` no primeiro e com ele no seguinte;
  - nenhuma mensagem com `taskId`;
  - `messageId` diferente a cada chamada, com o gerador injetado;
  - `REJECTED` já no `SendMessage` como sucesso;
  - `GetTask` com cada um dos cinco estados;
  - estado fora do contrato (`TASK_STATE_INPUT_REQUIRED`) → `bad-response`;
  - `result.id` diferente → `bad-response`;
  - `contextId` devolvido inválido → `bad-response`;
  - texto de dois artifacts com parte não textual (`"a\n\nb"`);
  - `COMPLETED` sem artifacts (`""`);
  - `timestamp` no formato do .NET (sete casas, `+00:00`) normalizado;
  - `timestamp` ausente ou inválido → `null`.
- [x] 3.8 Testes de sessão:
  - sem sessão e com sessão expirada → `unauthorized` com o `fetch` nunca chamado;
  - nenhum resultado serializado (sucesso, `unauthorized`, `rpc`, `bad-response`) contém o token;
  - o cliente não chama `console`.

## 4. IPC, área de transferência e preload

- [x] 4.1 Implementar os `parseArgs` de D5 em `src/main/chat/ipc.ts` e o registro com `handle()`; mensagens de erro fixas, sem valores, inclusive na `cause`
- [x] 4.2 Implementar `src/main/clipboard/ipc.ts`: `clipboard:writeText` com até 1024 caracteres, chamando `clipboard.writeText` do Electron (D6)
- [x] 4.3 Testes de `parseArgs`:
  - quantidade e tipos errados;
  - `agentId` não GUID (`../auth/login`, `x/y`, `x?y`);
  - texto com 16 000 aceito e com 16 001, vazio ou só de espaços recusado;
  - `contextId` com 128 aceito, 129 recusado, `null` aceito;
  - `taskId` inválido;
  - clipboard com 1024 aceito e 1025 recusado;
  - com `agentId` `../segredo` e texto `senha123`, nem a mensagem nem a `cause` contêm esses valores;
  - o handler do clipboard chama `clipboard.writeText` com o texto.
- [x] 4.4 Em `src/main/index.ts`, criar o cliente com `net.fetch`, os timers reais e `crypto.randomUUID`, e registrar os canais em `app.whenReady()`
- [x] 4.5 No preload, implementar `agents`, `chat` e `clipboard` com `ipcRenderer.invoke` em canais fixos. Ajustar o teste do preload:
  - as chaves de `window.buteco` são os quatro namespaces;
  - cada função chama o canal certo com os argumentos recebidos;
  - `auth` continua só com `login`, `logout` e `status`.
- [x] 4.6 Ajustar `api-surface.typetest.ts`:
  - `agents`, `chat` e `clipboard` compilam;
  - `@ts-expect-error` em `window.buteco.auth.getToken`;
  - rodar `npm run typecheck`.

## 5. Tema e dependências

- [x] 5.1 Instalar `react-markdown` e `remark-gfm` (D15) e registrar as versões instaladas no resumo da change
- [x] 5.2 Acrescentar `--buteco-color-success-text` (`green[9]` no claro, `green[4]` no escuro) ao `cssVariablesResolver` (D19)
- [x] 5.3 Estender o teste de contraste: o texto do selo **Ativo** sobre `--mantine-color-green-light` e `--mantine-color-text` sobre `--mantine-color-butecoBlue-light`, nos dois esquemas

## 6. Polling e estado da conversa (renderer)

- [x] 6.1 Implementar `createTaskPoller` em `src/renderer/src/conversation/task-poller.ts` (D8):
  - `start`, `extend`, `stop`;
  - `setTimeout` encadeado;
  - prazo por `now()` comparado depois de cada resposta;
  - geração;
  - erros passageiros e erros que encerram o turno.
- [x] 6.2 Testes do poller com timers falsos:
  - consulta encadeada: a próxima só 1 s depois da resposta, mesmo com a anterior demorando 3 s;
  - para no primeiro estado terminal;
  - timeout aos 90 s;
  - **timers atrasados**: cada disparo com 20 s de atraso, por `vi.setSystemTime`, e o prazo detectado pelo tempo decorrido, não pelo número de consultas;
  - `extend` dá mais 90 s a partir do clique;
  - `unreachable` e `http` 503 não encerram, enquanto `rpc` -32001, `bad-response` e `http` 404 encerram;
  - `unauthorized` encerra;
  - `stop` durante uma consulta em andamento descarta a resposta e não agenda nada.
- [x] 6.3 Implementar `format.ts`: título (40 caracteres, espaços colapsados, "…"), `contextId` abreviado, duração com vírgula (D11), contador "{n} / 16.000", rótulo do separador de dia, iniciais do avatar. Testes de cada função.
- [x] 6.4 Implementar `use-conversation.ts` com o estado de D17. Cobre:
  - envio e gravação do `contextId`;
  - Reenviar no mesmo `Turn`;
  - Reenviar depois do prazo com `getTask` prévio (D9);
  - Continuar aguardando;
  - Nova conversa e troca de agente com `stop()`;
  - recarga da lista depois de `REJECTED`;
  - `unauthorized` → `onSessionEnded`.

## 7. Telas (renderer)

- [x] 7.1 Implementar o layout (D20): linha barra lateral + área principal, altura da janela, e o breakpoint de 860 px. A largura da barra lateral, a direção da raiz e a área reservada ficam em classes, não em props de estilo do Mantine.
- [x] 7.2 Implementar a barra lateral:
  - marca;
  - "AGENTE" e o seletor (34 px, raio 7 px, inativos desabilitados com " (inativo)", primeiro ativo selecionado);
  - **Nova conversa**;
  - área reservada;
  - rodapé de sessão: avatar com iniciais, "{usuário} @ {host}", minutos restantes, **Sair** só de ícone e volta ao login ao chegar a zero.
- [x] 7.3 Implementar o carregamento da lista com os estados de D12 e D18 #9
- [x] 7.4 Implementar o cabeçalho: título, "contextId" com o valor abreviado ou "— aguardando o primeiro envio", **Copiar** → "Copiado" por 1,5 s, selo do agente e selo **Ativo**/**Inativo**
- [x] 7.5 Implementar a conversa vazia: "NOVA CONVERSA COM", nome, descrição, skills e a nota do contextId
- [x] 7.6 Implementar a timeline:
  - separador de dia;
  - balão do usuário (`butecoBlue-light`, raio `11 11 4 11`, 80%, quebras preservadas, horário);
  - resposta do agente (avatar de robô, nome, horário, Markdown, linha de metadados);
  - pendente com `role="status"` e o estado real.
- [x] 7.7 Implementar os blocos de estado de D18, com `role="alert"`: falha, rejeitada, sem resposta a tempo, falha no envio, recusa da plataforma, falha ao acompanhar
- [x] 7.8 Implementar `Markdown.tsx` (D15):
  - GFM, sem HTML bruto;
  - `urlTransform` padrão;
  - `img` como link;
  - código em Plex Mono com rolagem;
  - tabela do Mantine.
- [x] 7.9 Implementar o composer:
  - textarea de 2 linhas;
  - botão "Enviar mensagem";
  - Enter / Shift+Enter / IME;
  - placeholder do agente e os de bloqueio;
  - contador a partir de 14 400 e a mensagem de limite;
  - dica "Enter envia · Shift+Enter quebra a linha".
- [x] 7.10 Implementar os modais de confirmação de **Nova conversa** e da troca de agente (D13), com o texto da resposta pendente e **Cancelar** devolvendo o seletor
- [x] 7.11 No `App`, trocar `session` pela tela de conversas e implementar `onSessionEnded` (D14): `stop`, `logout()`, login e a notificação. Remover `SessionScreen.tsx` e adaptar os testes que o usavam.

## 8. Testes do renderer

- [x] 8.1 Criar `test-chat.ts`, um `window.buteco` simulado com `auth`, `agents`, `chat` e `clipboard`
- [x] 8.2 Testes da barra lateral e da lista:
  - ordem e textos;
  - seletor com inativo desabilitado e seleção inicial;
  - rodapé (avatar, usuário, host, minutos);
  - **Sair**;
  - tempo esgotado;
  - "Carregando agentes…";
  - falha com **Tentar de novo**;
  - lista vazia;
  - só inativos com o composer bloqueado;
  - recarga depois de `REJECTED` com `unreachable` mantém a lista em silêncio;
  - recarga depois de `REJECTED` com `unauthorized` → `logout()`, tela de login e notificação.
- [x] 8.3 Testes da conversa vazia e do cabeçalho:
  - cartão com descrição e skills;
  - "Nova conversa" e "— aguardando o primeiro envio";
  - título da primeira mensagem;
  - `contextId` abreviado;
  - **Copiar** chama `clipboard.writeText` com o valor completo, mostra "Copiado" e volta depois de 1,5 s (timers falsos);
  - selos **Ativo** e **Inativo**.
- [x] 8.4 Testes do fluxo, com timers falsos:
  - envio mostra o balão e o pendente (`role="status"`, `Submitted` → `Working`);
  - `COMPLETED` com Markdown e a linha `task … · Completed · 3,2 s`;
  - duração pelo relógio local com `timestamp: null`;
  - "O agente não devolveu texto.";
  - a segunda mensagem vai com o `contextId` da primeira.
- [x] 8.5 Testes dos estados:
  - `FAILED` + **Reenviar** no mesmo `contextId`, sem segundo balão;
  - `REJECTED` no envio e no polling (sem **Reenviar**, lista recarregada, selo **Inativo** e composer bloqueado quando o agente vem inativo);
  - prazo esgotado + **Continuar aguardando**;
  - prazo esgotado + **Reenviar** com a original `COMPLETED` (sem `chat.send`) e com ela `WORKING` (com `chat.send`);
  - falha ambígua no envio com "Não foi possível confirmar o envio da mensagem.";
  - `rpc` no envio com a `message`;
  - falha ao acompanhar.
- [x] 8.6 Testes do Markdown:
  - HTML bruto como texto, sem `b` nem `script`;
  - link `https` com `href` e `javascript:` sem `href` perigoso;
  - imagem como link com `alt` e com a URL;
  - código em fonte monoespaçada;
  - tabela GFM.
- [x] 8.7 Testes do composer:
  - Enter envia e Shift+Enter quebra a linha;
  - Enter durante composição de IME não envia;
  - desabilitado com texto vazio ou só de espaços;
  - bloqueado durante o pendente e no prazo esgotado ("Aguardando a resposta do agente…");
  - contador a partir de 14 400;
  - 16 001 caracteres sem corte, com a mensagem de limite e o envio desabilitado.
- [x] 8.8 Testes de Nova conversa e troca de agente:
  - conversa vazia sem modal;
  - com mensagens, o modal certo em cada caso;
  - **Cancelar** devolve o seletor;
  - confirmar com resposta pendente para o polling e a próxima mensagem vai sem `contextId`.
- [x] 8.9 Teste de sessão terminada: `unauthorized` no polling e na lista → `logout()`, tela de login, notificação "A sessão terminou. Entre de novo para continuar." e nenhuma consulta agendada
- [x] 8.10 Ajustar os testes do `App` (recarregar com sessão ativa e login bem-sucedido → tela de conversas)

## 9. Verificação

- [x] 9.1 Rodar `npm run typecheck`, `npm test`, `npm run build` e `npm run test:build`
- [x] 9.2 Parar para a revisão do código pelo usuário
- [x] 9.3 Fumaça em dev contra a plataforma local (`http://localhost:5017`):
  - conversa de vários turnos que comprova o contexto ("meu nome é X" e depois "qual é o meu nome?");
  - agente inativo (`REJECTED`, selo **Inativo**, composer bloqueado);
  - **Copiar** (colar o `contextId` em outro app);
  - link numa resposta abrindo no navegador;
  - **Nova conversa** com confirmação;
  - **Sair**;
  - esquemas claro e escuro;
  - janela estreita com a barra lateral em cima.

  Manual, feita pelo usuário: parar, deixar o dev rodando e entregar o roteiro de cada item. Resultado: todos os itens conforme o esperado; o item opcional de prazo esgotado (90 s) não foi exercitado manualmente, e fica coberto pelos testes automatizados.
- [x] 9.4 Fumaça no app empacotado:
  - conversa de dois turnos;
  - Markdown renderizado (as dependências entram no bundle);
  - fontes Plex;
  - nenhuma violação de CSP no console;
  - nenhum token, senha ou corpo de resposta no stdout.

  Manual, feita pelo usuário: parar, deixar o pacote gerado e entregar o roteiro de cada item. Resultado: todos os itens passaram.
- [x] 9.5 Atualizar o `README.md` (como conversar com um agente da plataforma local; o que não é guardado entre aberturas)
- [x] 9.6 Fechamento sem commits intermediários:
  - `/opsx:sync` e revisão dos specs pelo usuário;
  - `/opsx:archive` sem reaplicar os deltas;
  - conferir que `openspec/specs/` não mudou no arquivamento;
  - conferir que nada de `out/`, `release/` ou `node_modules/` entra;
  - um único commit `feat: conversa com agentes via A2A (conversa-a2a)`, só com autorização explícita.
