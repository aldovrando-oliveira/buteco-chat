## ADDED Requirements

### Requirement: Preferências de segurança da janela
A janela principal SHALL ser criada com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` e `webviewTag: false`, e MUST carregar o preload do app como único script privilegiado.

#### Scenario: Janela criada com isolamento
- **WHEN** o app cria a janela principal
- **THEN** as `webPreferences` têm `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` e `webviewTag: false`

#### Scenario: Renderer sem acesso ao Node
- **WHEN** o código do renderer verifica `typeof require` e `typeof process`
- **THEN** ambos são `"undefined"`

### Requirement: Navegação bloqueada dentro do app
O app SHALL impedir que qualquer `webContents` navegue para fora da página do renderer. Em uma tentativa de navegação (`will-navigate`), o app MUST cancelar a navegação. Se a URL de destino tiver esquema `http:` ou `https:`, o app MUST abri-la com `shell.openExternal`. Qualquer outro esquema MUST ser descartado sem efeito.

#### Scenario: Navegação para link http(s)
- **WHEN** o renderer tenta navegar para `https://exemplo.com/pagina`
- **THEN** a navegação é cancelada e `shell.openExternal` é chamado uma vez com `https://exemplo.com/pagina`

#### Scenario: Navegação para esquema não web
- **WHEN** o renderer tenta navegar para `file:///etc/passwd`, `javascript:alert(1)` ou `buteco://qualquer`
- **THEN** a navegação é cancelada e `shell.openExternal` não é chamado

#### Scenario: URL malformada
- **WHEN** o destino da navegação não é uma URL válida
- **THEN** a navegação é cancelada e `shell.openExternal` não é chamado

### Requirement: Abertura de novas janelas bloqueada
O handler de `setWindowOpenHandler` SHALL responder sempre `{ action: 'deny' }`. Se a URL tiver esquema `http:` ou `https:`, o app MUST abri-la com `shell.openExternal`. Qualquer outro esquema MUST ser descartado.

#### Scenario: window.open com https
- **WHEN** o renderer chama `window.open('https://exemplo.com')` ou o usuário clica num link com `target="_blank"` para essa URL
- **THEN** nenhuma janela Electron é criada e `shell.openExternal` é chamado com `https://exemplo.com/`

#### Scenario: window.open com outro esquema
- **WHEN** o renderer chama `window.open('file:///tmp/x')`
- **THEN** o handler devolve `{ action: 'deny' }` e `shell.openExternal` não é chamado

### Requirement: Guardas aplicadas a todo webContents
As guardas de navegação, abertura de janelas e `<webview>` SHALL ser aplicadas no evento `web-contents-created`, de modo que valham para qualquer `webContents` criado pelo app, e não só para a janela principal.

#### Scenario: Tentativa de anexar webview
- **WHEN** qualquer `webContents` dispara `will-attach-webview`
- **THEN** o evento é cancelado

### Requirement: Permissões negadas
A sessão padrão SHALL negar toda solicitação de permissão (`setPermissionRequestHandler`) e responder `false` a toda verificação de permissão (`setPermissionCheckHandler`).

#### Scenario: Pedido de permissão
- **WHEN** o renderer pede acesso a notificações, câmera, microfone, geolocalização ou área de transferência pela API de permissões
- **THEN** o pedido é negado

### Requirement: CSP de produção
O `index.html` do build de produção SHALL conter uma `<meta http-equiv="Content-Security-Policy">` com exatamente as diretivas: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'`. Nenhuma diretiva MUST ser afrouxada para resolver falhas de carregamento sob `file://`. Nesse caso, a correção é migrar o carregamento para um protocolo próprio.

#### Scenario: Renderer não consegue fazer HTTP
- **WHEN** o renderer do app empacotado executa `fetch('http://localhost:5017/agents')`
- **THEN** a requisição é bloqueada pela CSP e nenhuma conexão é aberta

#### Scenario: Build de produção contém a CSP exata
- **WHEN** o renderer é construído em modo de produção
- **THEN** o `index.html` gerado contém a meta CSP de produção, e não contém a CSP de desenvolvimento

### Requirement: CSP de desenvolvimento separada
No `dev`, o `index.html` SHALL receber uma CSP própria, que permite apenas o necessário para o servidor do Vite e o HMR: script inline para o preâmbulo do React Refresh e `connect-src` restrito à origem exata do servidor de desenvolvimento (`http` e `ws` na porta fixa). A CSP de desenvolvimento MUST NOT permitir conexões a outras portas ou hosts.

#### Scenario: Plataforma local inacessível pelo renderer em dev
- **WHEN** no `dev` o renderer executa `fetch('http://localhost:5017/agents')`
- **THEN** a requisição é bloqueada pela CSP

### Requirement: Console do renderer encaminhado ao main
O main SHALL repassar ao seu stdout as mensagens de console de nível `warning` e `error` do renderer, inclusive as violações de CSP, em dev e no app empacotado. O nível MUST ser lido do objeto do evento `console-message` no formato da versão instalada do Electron (nível textual), e não dos argumentos posicionais obsoletos. Mensagens `info` e `debug` MUST NOT ser repassadas.

#### Scenario: Filtragem por nível
- **WHEN** chegam eventos `console-message` com `level` `warning`, `error`, `info` e `debug`
- **THEN** só os de `warning` e `error` são escritos no stdout

#### Scenario: Violação de CSP visível no terminal
- **WHEN** o app empacotado é iniciado pelo terminal e o renderer sofre uma violação de CSP
- **THEN** a mensagem da violação aparece no stdout do processo
