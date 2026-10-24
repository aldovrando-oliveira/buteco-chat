## Why

A fundação entregou um app endurecido, mas sem nenhuma integração com a plataforma: a casca só valida tema, fontes e CSP. Antes de listar agentes ou conversar (`conversa-a2a`), o app precisa saber **onde** está o serviço e **quem** é o operador, e o main precisa ter um token para as próximas chamadas. Esta change faz só isso: login do operador, token na memória do main e as telas de entrada, com um destino pós-login provisório.

## What Changes

- **Serviço de autenticação no main** (`src/main/auth/`): `login(serviceUrl, username, password)`, `logout()`, `status()` e `getToken()` (interno). O cliente HTTP é `net.fetch` do Electron, injetado (`createAuthService({ fetch, now })`). Token, `expiresAt`, endereço e usuário ficam só em memória; a senha não é guardada depois da chamada; nada de token, senha ou corpo de resposta em log.
- `POST {serviço}/auth/login` com timeout de 15 s, sem seguir redirecionamentos (comportamento do `net.fetch` verificado no Electron 45 e registrado no design), contador de geração (um `login` ou `logout` aborta a requisição anterior) e expiração verificada na leitura, sem timer.
- **Validação do endereço** em `src/shared/` (`parseServiceUrl`), usada pelo renderer para mensagens e pelo main para decidir: só `http:`/`https:`, sem credenciais embutidas, sem query e sem hash, barra final removida, **prefixo de caminho aceito** (`https://host/buteco`). `http:` fora de loopback é aceito com aviso.
- **Mapeamento de erros** para `ChatError`: `invalid-credentials`, `unreachable`, `http` (inclusive redirecionamento, com mensagem própria) e o tipo novo `bad-response`.
- **IPC**: canais `auth:login`, `auth:logout` e `auth:status` registrados com `handle()` e `parseArgs` (tipos, quantidade, limites de tamanho e endereço válido). `EXPOSED_NAMESPACES` passa a `['auth']`. O token nunca cruza a ponte.
- **Mudanças de contrato em `src/shared/api.ts`** (registradas no design): `ChatError` ganha `{ kind: 'bad-response' }`; `auth.status()` ganha `username: string | null`.
- **Renderer**: a casca sai. Entram a tela de login de primeiro acesso (campo de endereço), a de acessos seguintes (linha "Serviço" com **Alterar**) e o destino pós-login provisório ("operador @ host", tempo restante, **Sair**), seguindo o protótipo aprovado. Navegação por estado (`checking` → `login` → `session`), com o estado inicial vindo de `status()`. Só o endereço é lembrado (`localStorage` `buteco-chat:service-url`, gravado após login bem-sucedido).
- **Dependência nova**: `@tabler/icons-react`, para os ícones do protótipo (balão, servidor, saída).

## Capabilities

### New Capabilities
- `autenticacao`: serviço de autenticação do main (login, logout, status, token só em memória, expiração), validação e normalização do endereço do serviço, mapeamento de erros, canais IPC `auth:*`, e as telas de login e o destino pós-login provisório no renderer.

### Modified Capabilities
- `identidade-visual`: remove o requisito "Tela-casca"; os cenários de fundo da página e de fontes empacotadas passam a se referir à tela de login; a exigência de interface em pt-BR, que estava no requisito removido, vira requisito próprio.

`ponte-preload` não muda de requisito: a superfície exposta já é definida por `EXPOSED_NAMESPACES`, e as regras sobre o token ficam em `autenticacao`.

## Impact

- **Código novo**: `src/main/auth/`, `src/shared/service-url.ts`, telas em `src/renderer/src/` (login, sessão provisória); canais em `src/shared/ipc-channels.ts`; implementação de `auth` no preload; registro dos handlers em `src/main/index.ts`.
- **Código removido**: `src/renderer/src/Shell.tsx` e o teste da casca.
- **Contrato**: `ChatError` e `auth.status()` alterados (aditivos; nenhum consumidor existe ainda).
- **Plataforma**: primeira chamada real, `POST /auth/login` (rota anônima). Nenhuma outra rota.
- **Dependências seguintes**: `historico-conversas` usará o endereço normalizado por `parseServiceUrl` como chave do histórico local; `sessao-expirada` trata o 401 em uso e o aviso de sessão expirada; `conversa-a2a` substitui o destino provisório.
