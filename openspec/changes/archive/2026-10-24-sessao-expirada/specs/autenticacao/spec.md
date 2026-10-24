## MODIFIED Requirements

### Requirement: Logout, status e expiração
`logout()` SHALL descartar token, `expiresAt`, `baseUrl` e usuário. `status()` SHALL devolver `{ authenticated, serviceUrl, username, expiresAt }`, com os três últimos `null` quando não autenticado. A expiração MUST ser verificada na leitura, sem timer: quando o relógio injetado alcança `expiresAt`, `status()` e `getToken()` MUST descartar a sessão e responder como não autenticado.

`discard(token)` SHALL descartar a sessão como o `logout()` só quando `token` é igual ao token da sessão atual. Com outro token ou sem sessão, MUST NOT mudar nada. Diferente do `logout()`, `discard` MUST NOT abortar um login em andamento. `discard` existe só no main, para o cliente da plataforma descartar um token recusado com 401, e MUST NOT ter canal IPC.

#### Scenario: Logout limpa o estado
- **WHEN** `logout()` é chamado com uma sessão válida
- **THEN** `status()` devolve `{ authenticated: false, serviceUrl: null, username: null, expiresAt: null }` e `getToken()` devolve `null`

#### Scenario: Status depois da expiração
- **WHEN** o relógio injetado avança até `expiresAt`
- **THEN** `status()` devolve `authenticated: false` com os demais campos `null`, e `getToken()` devolve `null`

#### Scenario: Descarte do token atual
- **WHEN** a sessão tem o token `abc` e `discard('abc')` é chamado
- **THEN** `status()` devolve `authenticated: false` com os demais campos `null`, e `getToken()` devolve `null`

#### Scenario: Descarte de um token antigo
- **WHEN** a sessão tem o token `novo` e `discard('velho')` é chamado
- **THEN** a sessão continua, e `getToken()` devolve `novo`

#### Scenario: Descarte durante um login
- **WHEN** um `login` aguarda a resposta, `discard('velho')` é chamado e a plataforma então responde 200 com o token `novo`
- **THEN** o login não é abortado, e `getToken()` devolve `novo`

#### Scenario: Sem canal de descarte
- **WHEN** os canais IPC são registrados
- **THEN** nenhum canal chama `discard`, e `window.buteco.auth` só tem `login`, `logout` e `status`
