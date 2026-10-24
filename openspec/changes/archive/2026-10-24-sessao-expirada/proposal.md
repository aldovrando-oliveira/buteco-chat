## Why

Hoje, quando o token vence ou é recusado durante o uso, a `conversa-a2a` chama `logout()`, volta ao login e mostra "A sessão terminou. Entre de novo para continuar.". A conversa em memória se perde, e a resposta em andamento é abandonada. Com tokens de 30 min, isso acontece numa sessão normal de trabalho.

Esta change mantém a conversa: o app avisa, pede um novo login sem sair da tela e retoma de onde parou. As regras do 401 vêm do documento de construção:
- **401 no `SendMessage`**: a mensagem não foi registrada e é reenviada uma vez, no mesmo `contextId`;
- **401 no `GetTask`**: a task já existe, então o polling do mesmo `taskId` é retomado, sem reenvio;
- **401 em `agents:list`**: a lista é recarregada.

## What Changes

- **Estado "sessão expirada" no renderer**, em vez da volta ao login. Entra-se nele por qualquer `unauthorized` de `agents` ou `chat`, ou pelo contador do rodapé chegando a zero. Nesse estado:
  - o rodapé troca "Sessão válida por mais {n} min" por "Sessão expirada" em vermelho;
  - aparece um banner acima do composer, com `role="alert"`, o texto do caso e **Entrar novamente**;
  - o composer fica bloqueado com "Entre novamente para continuar";
  - a pílula do pendente troca "Processando" por "Aguardando novo login para retomar" (ou "… para enviar");
  - **Reenviar**, **Continuar aguardando**, o seletor de agente e **Nova conversa** ficam bloqueados. **Copiar**, a leitura da timeline e **Sair** continuam disponíveis.
- **Modal "Entrar novamente"**:
  - serviço e usuário da sessão, somente leitura, e o campo de senha;
  - erros com os textos da tela de login;
  - **Cancelar** fecha o modal e mantém o banner.
- **Retomada depois do novo login, uma vez só**: o turno guarda o que retomar (`awaiting-login` com `resume: 'poll' | 'send'`).
  - Na retomada do polling, o prazo de 90 s recomeça.
  - Um 401 na primeira carga da lista, antes de existir conversa, usa o mesmo estado, e a lista é recarregada depois do login.
- **Main**: `AuthService.discard(token)` descarta a sessão só se o token ainda for o mesmo. O `ChatClient` o chama ao receber um 401. O renderer deixa de chamar `logout()` no `unauthorized`, então uma resposta antiga não derruba a sessão nova.
- **BREAKING (comportamento)**: saem a notificação "A sessão terminou. Entre de novo para continuar.", o `logout()` imediato e a volta ao login no `unauthorized` (D14 da `conversa-a2a`). O contador chegando a zero deixa de chamar `status()` e de voltar ao login.

## Capabilities

### New Capabilities
Nenhuma. O comportamento novo entra em `conversa`, que já é dona da tela e do `unauthorized`.

### Modified Capabilities
- `conversa`:
  - **removido**: o requisito "Sessão terminada";
  - **acrescentados**: "Sessão expirada durante o uso", "Banner de sessão expirada", "Novo login sem sair da conversa", "Retomada depois do novo login" e "Ações durante a sessão expirada";
  - **alterados**:
    - "Requisições autenticadas à plataforma": o 401 descarta o token recusado;
    - "Rodapé de sessão": a expiração passa a abrir o estado expirado;
    - "Carregamento da lista de agentes": `unauthorized` na primeira carga e nas recargas;
    - "Polling da task": parada no 401 e prazo novo na retomada;
    - "Resposta pendente": a pílula de espera do login;
    - "Composer": placeholder da sessão expirada.
- `autenticacao`: "Logout, status e expiração" ganha `discard(token)`, que descarta a sessão só quando o token informado ainda é o atual, sem canal IPC.
- `identidade-visual`: "Cores de erro e de aviso com contraste mínimo" passa a cobrir o texto do banner sobre `--mantine-color-yellow-light`. No claro, `--buteco-color-warning-text` passa de `yellow[7]` para `yellow[9]`, porque `yellow[7]` dá 4,16:1 sobre esse fundo.
- `empacotamento-local` e `ponte-preload`: só correções de redação, sem relação com a sessão expirada ("Teste de fumaça do pacote" e "Tipos compartilhados do contrato" deixam de falar de "a change" e de "contrato inicial"). Ver "Notas do sync" no design.

## Impact

- **Código alterado**:
  - `src/main/auth/service.ts`: `discard`;
  - `src/main/chat/client.ts`: chama `discard` no 401;
  - `src/renderer/src/App.tsx`: sai `sessionEnded` e entra a renovação do `SessionInfo`;
  - `src/renderer/src/theme/css-variables.ts`: tom de aviso no claro;
  - `src/renderer/src/conversation/`: `use-conversation.ts`, `ConversationScreen.tsx`, `SessionFooter.tsx`, `Sidebar.tsx`, `Composer.tsx` (sem mudança de contrato), `Timeline.tsx` e `blocks/PendingReply.tsx`;
  - testes de todos esses arquivos.
- **Código novo**: o banner e o modal de novo login em `src/renderer/src/conversation/`.
- **Contrato `src/shared/api.ts`, preload e canais IPC**: sem mudança. `discard` não tem canal.
- **Plataforma**: nenhuma chamada nova. O novo login usa o mesmo `POST /auth/login`.
- **Fora do escopo**:
  - aviso antes do vencimento;
  - persistência da conversa ao recarregar o renderer (`historico-conversas`);
  - troca de conta pelo modal.
