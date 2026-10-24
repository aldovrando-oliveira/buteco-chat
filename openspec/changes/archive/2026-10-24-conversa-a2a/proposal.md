## Why

Depois da `login-operador`, o app sabe onde está o serviço e tem um token no main, mas termina num destino provisório: não lista agentes nem conversa. Esta é a change que entrega o propósito do app. O usuário escolhe um agente, conversa com ele em vários turnos pelo JSON-RPC A2A da plataforma e vê cada resposta chegar, com todos os estados de task tratados.

## What Changes

- **Cliente da plataforma no main** (`src/main/chat/`):
  - `GET {serviço}/agents` e `POST {serviço}/agents/{agentId}/a2a` (`SendMessage`, `GetTask`), por `net.fetch` injetado e com o token de `getToken()`;
  - 15 s por requisição e `redirect: 'manual'`;
  - mapeamento para `ChatError`. 401 com corpo vazio vira `unauthorized`. Um `error` JSON-RPC num HTTP 200 vira `rpc`. Rede e timeout viram `unreachable`, outro status vira `http` e um corpo fora do contrato vira `bad-response`. Sem token na sessão, `unauthorized` sem chamar a rede;
  - `messageId` novo a cada envio, `contextId` só a partir do segundo, nunca `taskId` na mensagem;
  - a resposta do agente é o texto do último artifact;
  - os ids devolvidos pelo servidor são validados.
- **IPC**:
  - canais `agents:list`, `chat:send`, `chat:getTask` e `clipboard:writeText`, pelo `handle()` com `parseArgs`;
  - `agentId` como GUID, porque entra no caminho da URL;
  - `taskId` e `contextId` com formato e tamanho limitados;
  - mensagem com até 16 000 caracteres e texto copiado com até 1 KiB;
  - `EXPOSED_NAMESPACES` passa a `['auth', 'agents', 'chat', 'clipboard']`.
- **Mudanças de contrato em `src/shared/api.ts`** (registradas no design):
  - `chat.send` devolve também `submittedAt`;
  - `chat.getTask` devolve também `timestamp`;
  - namespace novo `clipboard.writeText`. A fundação nega a permissão de clipboard ao renderer (D8), então a cópia passa pelo main.
- **Renderer**: o destino provisório sai e entra a tela de conversas, fiel ao protótipo:
  - barra lateral com marca, seletor de agente, **Nova conversa**, espaço reservado para o histórico e o rodapé de sessão;
  - cabeçalho com título, `contextId` abreviado, **Copiar** e selos;
  - cartão da conversa vazia;
  - timeline com mensagens do usuário, respostas em Markdown e metadados;
  - pendente, falha, rejeitada, sem resposta a tempo e falha no envio;
  - composer com contador e bloqueio durante a espera.
- **Polling no renderer**: máquina de estados pura, com relógio e timers injetados, `setTimeout` encadeado a ~1 s e contador de geração.
  - O prazo é de 90 s, configurável, e medido pelo relógio, não por tiques.
  - Erros passageiros não encerram o turno.
  - **Continuar aguardando** retoma o polling. **Reenviar** depois do timeout consulta antes a task original.
- **Markdown**:
  - `react-markdown` + `remark-gfm`, sem HTML bruto;
  - links abertos no navegador pela política de navegação da fundação;
  - imagens viram link, porque a CSP bloqueia imagens remotas;
  - código em Plex Mono.
- **Comportamento mínimo para `unauthorized`**: `logout()`, volta ao login e a notificação "A sessão terminou. Entre de novo para continuar.", sem retomada. A `sessao-expirada` o substitui.
- **Confirmação ao descartar uma conversa com mensagens** (**Nova conversa** ou troca de agente). É provisória: a `historico-conversas` a remove.
- **Dependências novas**: `react-markdown` e `remark-gfm`.
- **Processo**: o `context` de `openspec/config.yaml` ganha a regra "um commit por change, depois do arquivamento".

## Capabilities

### New Capabilities
- `conversa`: cliente de `/agents` e do JSON-RPC A2A no main (requisições, mapeamento de erros, validação das respostas), canais IPC `agents:*`, `chat:*` e `clipboard:*`, e a tela de conversas no renderer (layout, seletor de agente, timeline, polling e estados de task, Markdown, composer, Copiar, `unauthorized`).

### Modified Capabilities
- `autenticacao`:
  - remove o requisito "Destino pós-login provisório", cujo rodapé de sessão passa para `conversa`;
  - "Tela inicial decidida pelo main" passa a levar à tela de conversas;
  - "Token nunca cruza a ponte" passa a valer também para os valores de `agents` e `chat`;
  - "Canais IPC de autenticação" troca o cenário de tipagem, que exigia que `window.buteco.chat` não compilasse.
- `identidade-visual`: "Cores de erro e de aviso com contraste mínimo" passa a cobrir também o texto do selo **Ativo** (variável nova `--buteco-color-success-text`) e o texto do balão do usuário.

`ponte-preload` e `janela-segura` não mudam de requisito:
- a superfície exposta continua definida por `EXPOSED_NAMESPACES`;
- a política de navegação já abre links http(s) no navegador;
- a negação de permissões continua: a cópia passa pelo main, e não pela API de permissões.

## Impact

- **Código novo**:
  - `src/main/chat/`: cliente A2A, `parseArgs` e registro dos canais;
  - `src/main/clipboard/`: canal de cópia;
  - `src/renderer/src/conversation/`: tela, componentes, máquina de polling e Markdown.
- **Código alterado**:
  - `src/shared/api.ts` e `src/shared/ipc-channels.ts`;
  - `src/preload/index.ts`;
  - `src/main/index.ts`, que registra os canais novos;
  - `src/renderer/src/App.tsx`, que troca `session` pela tela de conversas;
  - `css-variables.ts`;
  - `api-surface.typetest.ts`.
- **Código removido**: `src/renderer/src/auth/SessionScreen.tsx`. O rodapé é refeito na barra lateral.
- **Plataforma**: primeiras chamadas autenticadas, `GET /agents` e `POST /agents/{id}/a2a` (`SendMessage`, `GetTask`). Nenhum método A2A além desses dois.
- **Dependências seguintes**:
  - `historico-conversas`: lista, busca e persistência local, remoção da confirmação e retomada de task pendente pelo `taskId` guardado;
  - `sessao-expirada`: banner, modal de novo login, e reenvio ou retomada do polling depois de um 401 em uso, substituindo o comportamento mínimo desta change.
