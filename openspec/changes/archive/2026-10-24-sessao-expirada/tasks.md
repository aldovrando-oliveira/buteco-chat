## 1. Main: descarte do token recusado

- [x] 1.1 Em `src/main/auth/service.ts`, acrescentar `discard(token)` ao `AuthService` (D3): limpa a sessão só se o token for o atual, sem mexer no login em andamento nem na geração. Nenhum canal IPC.
- [x] 1.2 Testes do `AuthService`:
  - `discard` com o token atual limpa `status()` e `getToken()`;
  - `discard` com outro token não muda nada;
  - `discard` sem sessão não muda nada;
  - `discard('velho')` durante um `login` não o aborta, e o login termina com o token novo.
- [x] 1.3 Em `src/main/chat/client.ts`, guardar o token lido antes da requisição e, no 401 da plataforma, chamar `auth.discard(token)` antes de devolver `unauthorized`. `ChatClientDeps.auth` passa a `Pick<AuthService, 'status' | 'getToken' | 'discard'>`.
- [x] 1.4 Testes do cliente:
  - 401 em `/agents`, `SendMessage` e `GetTask` chama `discard` com o token usado;
  - sem token, `unauthorized` sem `fetch` e sem `discard`;
  - 401 de uma requisição feita com o token `velho`, depois de um login com `novo` (`AuthService` real e `fetch` simulado), mantém `novo`;
  - outros erros (`rpc`, `http` 500, `unreachable`) não chamam `discard`.
- [x] 1.5 Conferir que `src/main/auth/ipc.ts` e o preload não mudam, e que o teste do preload continua garantindo `auth` só com `login`, `logout` e `status`

## 2. Estado da sessão e retomada (renderer)

- [x] 2.1 Em `use-conversation.ts`, criar o estado `ativa | expirada` (D1), com a lista marcada para recarga e a entrada idempotente `expire()`. Trocar `endSession()` por `expire()` em todos os `unauthorized`. Remover o parâmetro `onSessionEnded`.
- [x] 2.2 Acrescentar `awaiting-login` (`resume: 'send' | 'poll'`) a `Attempt` (D4):
  - 401 no `chat.send` → `send`;
  - 401 no `getTask` do poller → `poll` com os dados do `pending`;
  - 401 no `getTask` prévio de Reenviar → volta a `timeout`;
  - `dispatch` com a sessão expirada → `send`, sem `chat.send`;
  - sucesso de um `chat.send` durante a expiração → `poll`, sem `start`.
- [x] 2.3 Expiração pelo contador:
  - `expire()` chamado pelo rodapé;
  - `stop()` no poller sem trocar a geração da conversa;
  - turno `pending` → `awaiting-login` / `poll`;
  - os demais estados ficam como estão.
- [x] 2.4 Implementar `renewed(expiresAt)` (D7), que só age com a sessão `expirada`, de forma síncrona:
  - passa a `ativa`;
  - retoma o turno: `poll` → `pending` + `start(taskId, Date.now(), state)`; `send` → `dispatch` no `contextId` atual;
  - recarrega a lista, como primeira carga se ela nunca carregou.
- [x] 2.5 Expor do hook o estado da sessão, o caso do banner (`poll | send | nada`) e o bloqueio das ações (D9)
- [x] 2.6 Época da sessão (D7), incrementada no `renew`. Um `unauthorized` de uma chamada anterior ao novo login não expira:
  - `chat.send` → `dispatch` na época atual;
  - `agents.list` → recarga;
  - `getTask` prévio de Reenviar → volta a `timeout`.

  **Continuar aguardando** com `start` em vez de `extend` (D4).

## 3. Telas (renderer)

- [x] 3.1 `SessionFooter`: prop `expired`, que mostra "Sessão expirada" (11 px, `--mantine-color-red-text`) no lugar dos minutos e não chama mais nada ao chegar a zero além de `onExpired` uma vez. `Sidebar`: repassar `expired` e bloquear o seletor e **Nova conversa**.
- [x] 3.2 `SessionExpiredBanner.tsx` (D11):
  - `yellow-light`, `--buteco-color-warning-text`, raio 9 px, `role="alert"`;
  - cadeado, "Sua sessão expirou." em peso 600 e a linha do caso em `--mantine-color-text`;
  - **Entrar novamente** em primário preenchido;
  - dentro da coluna de 760 px, acima do composer.
- [x] 3.3 Extrair a linha "Serviço" de `LoginScreen.tsx` para reuso, com **Alterar** opcional, sem mudança visual na tela de login
- [x] 3.4 `ReloginModal.tsx` (D6):
  - 360 px, raio 11 px, título de 17 px em peso 600 e o subtítulo do caso;
  - Serviço e Usuário somente leitura e a Senha com foco;
  - **Cancelar** e **Entrar**;
  - carregamento que trava fechar;
  - contador de tentativas;
  - erros por `loginErrorMessage` com o endereço da sessão;
  - senha limpa em `invalid-credentials`;
  - senha vazia ao reabrir.
- [x] 3.5 `PendingReply`: prop de rótulo ("Processando", "Aguardando novo login para retomar" ou "… para enviar"). `Timeline`: renderizar `awaiting-login` e desabilitar **Reenviar**/**Continuar aguardando** com a sessão expirada (`StateBlock` com ações desabilitáveis).
- [x] 3.6 `ConversationScreen`:
  - banner e modal;
  - placeholder "Entre novamente para continuar" com prioridade e composer bloqueado;
  - área principal vazia no 401 da primeira carga (D8);
  - `onRenewed(expiresAt)` no sucesso do modal;
  - **Sair** com `chat.stop()` como hoje.
- [x] 3.7 `App`:
  - remover `SESSION_ENDED_MESSAGE`, `sessionEnded`, `handleSessionEnded` e o `onExpired → refreshView`;
  - acrescentar `onRenewed`, que troca só o `expiresAt` do `View` de sessão sem desmontar a tela;
  - manter o `<Notifications />` só se outro uso existir; senão, remover junto com a importação.
- [x] 3.8 Remover `@mantine/notifications` (`npm uninstall`) e conferir que nada mais o importa

## 4. Testes do renderer

Com `window.buteco` simulado (`test-chat.ts`, estendido para controlar `auth.login`) e timers falsos.

- [x] 4.1 401 no `GetTask`:
  - banner com o texto da resposta pendente;
  - pílula "Aguardando novo login para retomar" com `task {8} · Working`;
  - rodapé "Sessão expirada";
  - composer bloqueado com "Entre novamente para continuar";
  - nenhuma consulta agendada e nenhum `logout()`;
  - modal preenchido;
  - novo login → banner some, `getTask` do mesmo `taskId` e nenhum `chat.send`.
- [x] 4.2 Prazo novo na retomada: 80 s pendente, 5 min no modal, retomada; a task continua `WORKING` e o timeout só vem 90 s depois da retomada
- [x] 4.3 401 no `SendMessage`:
  - banner e subtítulo do envio retido;
  - pílula "Aguardando novo login para enviar";
  - novo login → um único `chat.send` com o mesmo texto e o mesmo `contextId`, e um único balão;
  - um segundo sucesso de `renewed` não reenvia.
- [x] 4.4 401 na recarga da lista: a lista anterior continua no seletor, e o novo login chama `agents.list()`. Lista e task juntas: um login retoma as duas, cada uma uma vez.
- [x] 4.5 401 na primeira carga:
  - banner "Entre de novo para continuar." e modal sem subtítulo;
  - sem "Carregando agentes…" e sem bloco de erro;
  - novo login → "Carregando agentes…" e a conversa vazia do primeiro ativo.
- [x] 4.6 Contador chegando a zero:
  - com a conversa parada: banner "Entre de novo para continuar.", modal sem subtítulo, sem `status()` e sem `logout()`;
  - com um `getTask` em andamento: resposta descartada e retomada no mesmo `taskId` depois do login;
  - com um `chat.send` em andamento que depois dá certo: `awaiting-login` / `poll`, sem consulta e com polling depois do login;
  - rodapé com os minutos do `expiresAt` novo depois do login.
- [x] 4.7 401 no `getTask` prévio de **Reenviar** depois do prazo: volta ao bloco de prazo esgotado, sem `chat.send`, e nada é retomado depois do login
- [x] 4.8 Modal:
  - **Cancelar** fecha sem `auth.login`, o banner continua e **Sair** continua disponível;
  - reabrir mostra a senha vazia e sem erro;
  - `invalid-credentials` mostra "Usuário ou senha incorretos." e limpa a senha;
  - `unreachable`, `http` 500 e `bad-response` mostram a mensagem da tela de login com o endereço da sessão, mantêm a senha e o modal aberto, e um login seguinte retoma o que estava guardado;
  - durante o login, Esc e **Cancelar** não fecham;
  - o resultado `cancelled` de uma tentativa substituída não mostra erro.
- [x] 4.9 Ações na sessão expirada:
  - **Reenviar**, **Continuar aguardando**, seletor e **Nova conversa** desabilitados;
  - **Copiar** chama `clipboard.writeText` e mostra "Copiado".
- [x] 4.10 **Sair** durante a sessão expirada: `logout()`, tela de login com campos vazios, e nenhuma consulta nem envio depois (avançar os timers)
- [x] 4.11 Remover os testes de "Sessão terminada" e as referências a `SESSION_ENDED_MESSAGE`, trocando-os pelos cenários acima. Ajustar `App.test.tsx`.
- [x] 4.12 Contraste do banner (D11 #8, `identidade-visual`):
  - em `css-variables.ts`, `--buteco-color-warning-text` no claro passa a `yellow[9]`, e o comentário cita esta change;
  - no teste do tema, o tom esperado no claro passa a `#8a5a00`;
  - acrescentar ao teste de contraste `--buteco-color-warning-text` e `--mantine-color-text` sobre `--mantine-color-yellow-light`, nos dois esquemas;
  - o aviso sobre a superfície continua no teste.
  Medição prévia: claro 5,29:1 e 18,7:1; escuro 5,99:1 e 10,7:1. Se algum par ficar abaixo de 4,5:1, parar e registrar em D11.
- [x] 4.13 Época da sessão, com o 401 antigo chegando depois do novo login e sem banner nem modal de novo em cada caso:
  - `chat.send`: reenvio único no mesmo `contextId`, um balão;
  - `agents.list`: recarga;
  - `getTask` prévio de Reenviar: volta ao prazo esgotado;
  - `getTask` do poller: descartado, e o polling continua.

  Cada guarda conferida por mutação.

## 5. Verificação

- [x] 5.1 Rodar `npm run typecheck`, `npm test`, `npm run build` e `npm run test:build`
- [x] 5.2 Parar para a revisão do código pelo usuário
- [x] 5.3 Fumaça em dev contra a plataforma local (`http://localhost:5017`).

  **Expiração pelo relógio**, com o `apps/api` subindo com `Auth__OperatorTokenLifetime=00:02:00`:
  - uma conversa com resposta pendente atravessando a expiração: banner, pílula, novo login e resposta exibida sem pergunta duplicada no agente;
  - um envio feito depois da expiração: banner do envio retido, novo login e uma única mensagem no contexto;
  - **Cancelar**, senha errada no modal e **Sair** durante a sessão expirada.

  **401 com tempo restante (token revogado)**: trocar `Auth__TokenSigningKey` e reiniciar o `apps/api`. Reiniciar sem trocar a chave não invalida o token.
  - a próxima consulta ou envio dá 401, e o rodapé mostra "Sessão expirada" mesmo com minutos restantes;
  - **durante o reinício**: o novo login no modal cai em `unreachable`, com a mensagem da tela de login, e a retomada continua guardada; com a API no ar, o login seguinte retoma.

  Também: esquemas claro e escuro (banner, rodapé vermelho, modal).

  Manual, feita pelo usuário: parar, deixar o dev rodando e entregar o roteiro de cada item. Resultado: todos os itens conforme o esperado, nos esquemas claro e escuro (A.1 a A.6, B.1 a B.4, C). Para a parte B, a API foi reiniciada sem o TTL de 2 min, porque a troca da chave levava mais que a vida do token. A plataforma em dev precisou de `TZ=America/Sao_Paulo` e, nos workers, de `Mcp__CredentialEncryptionKey` e da `Gemini:ApiKey` nos user-secrets.
- [x] 5.4 Fumaça no app empacotado:
  - uma expiração com retomada (com o TTL de 2 min);
  - nenhuma violação de CSP no console;
  - nenhum token, senha ou corpo de resposta no stdout.

  Manual, feita pelo usuário. Resultado: expiração com retomada e Console sem violação de CSP conforme o esperado. O stdout do app ficou vazio durante toda a sessão (avisos e erros do renderer, inclusive CSP, iriam para ele).
- [x] 5.5 Atualizar o `README.md`: o que acontece quando a sessão expira e como reduzir o TTL na plataforma para testar
- [x] 5.6 Fechamento sem commits intermediários:
  - `/opsx:sync` e revisão dos specs pelo usuário;
  - `/opsx:archive` sem reaplicar os deltas;
  - conferir que `openspec/specs/` não mudou no arquivamento;
  - conferir que nada de `out/`, `release/` ou `node_modules/` entra;
  - um único commit `feat: sessão expirada com novo login e retomada (sessao-expirada)`, só com autorização explícita.
