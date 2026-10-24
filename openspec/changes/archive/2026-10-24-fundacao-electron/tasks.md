## 1. Estrutura e ferramental

- [x] 1.1 Criar `package.json` (sem `"type": "module"`), `.gitignore` (`node_modules/`, `out/`, `dist/`, `release/`) e instalar as dependências com npm. Registrar no resumo da change as versões instaladas de `electron`, `electron-vite`, `vite`, `@mantine/core` e `vitest`
- [x] 1.2 Criar `tsconfig.json`, `tsconfig.node.json` (main, preload, shared) e `tsconfig.web.json` (renderer, shared), todos com `strict: true`, e o script `typecheck` cobrindo os dois
- [x] 1.3 Criar `electron.vite.config.ts` com main, preload (saída CJS em arquivo único, conferindo o nome da opção no Vite instalado, D4) e renderer (`@vitejs/plugin-react`, `assetsInlineLimit: 0`, dev server com porta fixa e `strictPort: true`)
- [x] 1.4 Criar o layout de `src/` (D14) e os scripts `dev`, `build`, `typecheck`, `test`, `test:build` e `package`
- [x] 1.5 Rodar `npm run dev` e confirmar que a janela abre, o HMR funciona no renderer e o reload não é bloqueado pelas guardas de navegação

## 2. Contrato compartilhado e preload

- [x] 2.1 Escrever `src/shared/api.ts` com `ChatError`, `Result<T>`, `ButecoApi`, `AgentSummary`, `TaskState`, copiados do documento de construção, e `ExposedApi = Pick<ButecoApi, never>`
- [x] 2.2 Escrever `src/shared/ipc-channels.ts` com a convenção `<namespace>:<acao>` (sem canais registrados nesta change)
- [x] 2.3 Escrever `src/preload/index.ts` expondo `window.buteco` (objeto vazio, tipado como `ExposedApi`) via `contextBridge.exposeInMainWorld`, e o `env.d.ts` do renderer declarando `window.buteco: ExposedApi`
- [x] 2.4 Confirmar que `window.buteco.auth` não compila no renderer (verificação de tipo negativa com `// @ts-expect-error` num arquivo de teste de tipos incluído no `typecheck`)

## 3. Janela segura (main)

- [x] 3.1 Implementar `classifyExternalUrl` (só `http:`/`https:` com `new URL()` válido → `open-external`; o resto → `discard`)
- [x] 3.2 Testes de `classifyExternalUrl`: `https://`, `http://`, `file:`, `javascript:`, `data:`, protocolo customizado, URL malformada, string vazia
- [x] 3.3 Implementar as guardas (`will-navigate`, `setWindowOpenHandler`, `will-attach-webview`) aplicadas em `web-contents-created`, com a decisão separada da ligação ao Electron
- [x] 3.4 Testes das guardas com `webContents` e `shell` simulados: navegação http(s) cancelada e enviada a `openExternal` uma vez; outros esquemas cancelados sem `openExternal`; `window.open` sempre `{ action: 'deny' }`; webview cancelado
- [x] 3.5 Implementar a negação de permissões (`setPermissionRequestHandler` nega, `setPermissionCheckHandler` devolve `false`) e testá-la com handlers simulados
- [x] 3.6 Criar a `BrowserWindow` com `contextIsolation`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`, `show: false`, `backgroundColor` conforme `nativeTheme` e exibição em `ready-to-show` (D12); extrair as `webPreferences` numa função testada
- [x] 3.7 Conferir no `electron.d.ts` instalado a assinatura de `console-message` e registrar em D12 o que foi encontrado; implementar o encaminhamento usando o objeto de evento (`details.level` textual), não os argumentos posicionais obsoletos; testar com evento simulado no formato atual: `warning` e `error` vão para o stdout, `info` e `debug` não. Revisão: o encaminhamento é ligado só no `webContents` da janela principal (em `createMainWindow`), não em `web-contents-created`; testado que a janela liga `console-message` e que `web-contents-created` não liga

## 4. IPC com validação de remetente

- [x] 4.1 Implementar a função pura de validação de remetente (frame presente, frame principal, `webContents` de janela do app; URL comparada com `new URL()`, ignorando `hash` e `search`: em produção, esquema `file:` + `pathname` do `index.html` empacotado, com a URL esperada montada por `pathToFileURL()` de `node:url`, nunca por concatenação; em dev, `origin` do dev server) e o utilitário `handle(channel, fn)` em `src/main/ipc/handle.ts`. Revisão: assinatura `handle(channel, parseArgs, fn)`, com `parseArgs` depois do remetente e antes de `fn` (D9)
- [x] 4.2 Testes: remetente legítimo executa o handler; `index.html#/conversas` e `index.html?x=1` do app são aceitos; com o app num caminho com espaço (ex.: `/Applications/Buteco Chat.app/Contents/Resources/app.asar/out/renderer/index.html`), a URL do frame com `%20` é aceita; outro `index.html` em caminho diferente é rejeitado; URL de outra origem, subframe e `senderFrame` nulo são rejeitados; em dev, porta diferente da do dev server é rejeitada. Em todas as rejeições, o handler não é executado. Revisão: argumentos inválidos (tipo errado, faltando, sobrando) rejeitados sem executar o handler; remetente inválido rejeitado antes de `parseArgs`

## 5. CSP

- [x] 5.1 Implementar o plugin Vite (`transformIndexHtml`) que injeta a CSP de produção (texto exato de D6) no build e a CSP de dev (porta fixa) no `dev`
- [x] 5.2 Teste do plugin: modo produção gera a CSP exata e não contém `unsafe-inline` em `script-src` nem `ws:`; modo dev permite só a origem do dev server
- [x] 5.3 Em `npm run dev`, executar `fetch('http://localhost:5017/agents')` no console do renderer e confirmar o bloqueio por CSP

## 6. Tema e identidade visual (renderer)

- [x] 6.1 Escrever `theme.ts` com as seis escalas, `primaryColor`, `primaryShade: { light: 6, dark: 4 }`, `fontSizes`, `lineHeights`, `headings`, `radius`, `defaultRadius`, `fontFamily` e `fontFamilyMonospace` (D10, D11)
- [x] 6.2 Escrever `css-variables.ts` (`cssVariablesResolver`) com `--buteco-color-page` nos blocos `light`/`dark` e a sobrescrita de `--mantine-color-butecoBlue-filled`/`-filled-hover` no bloco `dark` (tons 6/7); `global.css` com `body { background-color: var(--buteco-color-page) }`, o fundo estático em `html` (`#f6f5f3`, e `#121316` sob `@media (prefers-color-scheme: dark)`) para o intervalo antes do React (D10), e a classe de rótulo de seção (11px, caixa alta, `0.05em`, `dimmed`)
- [x] 6.3 Importar as fontes `@fontsource` (Sans latin 400/500/600, Mono latin 400/500), `@mantine/core/styles.css`, `@mantine/notifications/styles.css` e o `global.css`, nessa ordem; montar `MantineProvider` com `defaultColorScheme="auto"`, o resolver e `<Notifications />`, **sem** `ColorSchemeScript` (bloqueado pela CSP, D10)
- [x] 6.4 Teste dos valores do tema contra o documento de construção (escalas, `primaryShade`, tamanhos, alturas de linha, títulos, raios)
- [x] 6.5 Teste de contraste do primário preenchido: confirmar que `defaultVariantColorsResolver({ variant: 'filled', color: 'butecoBlue', theme })` devolve `var(--mantine-color-butecoBlue-filled)`; resolver essa variável no bloco `dark` e no `light` (padrão mesclado com o nosso resolver) até um hex da escala; exigir contraste WCAG ≥ 4,5:1 com `#ffffff` nos dois esquemas
- [x] 6.6 Teste de contraste do texto secundário: `--mantine-color-dimmed` sobre `--buteco-color-page` e sobre `--mantine-color-body`, nos dois esquemas, todos ≥ 4,5:1; e confirmar que `--mantine-color-body` não foi sobrescrito
- [x] 6.7 Implementar a tela-casca (marca "Buteco Chat", superfície com texto Sans, identificador Mono, texto secundário, rótulo de seção e botão preenchido) com `lang="pt-BR"` no `index.html`
- [x] 6.8 Teste de renderização da casca (marca visível, `lang="pt-BR"`, botão acessível por papel e nome)

## 7. Verificações de build

- [x] 7.1 Teste `test:build` do preload: `out/preload` tem um único `.js`, em CommonJS, sem `import` ESM e com `require` só de `electron`
- [x] 7.2 Teste `test:build` de assets: nenhum CSS/JS do renderer contém `data:`; os `.woff2` das fontes existem como arquivos; o `index.html` gerado contém a CSP de produção exata
- [x] 7.3 Rodar `npm run typecheck`, `npm test`, `npm run build` e `npm run test:build`, todos com sucesso

## 8. Empacotamento e fumaça

- [x] 8.1 Configurar o `electron-builder` (saída `release/`, `asar: true`, só o SO e a arquitetura locais, sem identidade de assinatura, sem publicação)
- [x] 8.2 Rodar `npm run package` e confirmar que o app gerado abre na máquina de dev (se o macOS recusar o binário não assinado, configurar assinatura ad hoc e registrar no design)
- [x] 8.3 **Teste de fumaça manual do pacote**, iniciado pelo terminal, registrando o resultado de cada item aqui: (a) com o sistema no esquema escuro, nem a janela nem o primeiro quadro do React aparecem claros (repetir a abertura algumas vezes); no claro, a janela abre sem flash escuro; (b) casca visível; (c) `document.fonts` tem "IBM Plex Sans" e "IBM Plex Mono" com `status === 'loaded'`; (d) tema claro e escuro corretos ao alternar o tema do sistema, com fundo da página distinto da superfície; (e) `window.buteco` existe e `Object.keys(window.buteco)` é `[]`; `typeof require === 'undefined'`; (f) `fetch('http://localhost:5017/agents')` bloqueado por CSP; (g) pelo DevTools do pacote, `window.open('https://example.com')` e `location.href = 'https://example.com'` abrem o navegador padrão sem navegar o app, e `location.href = 'file:///etc/hosts'` não tem efeito (a casca não ganha link para isso); (h) zero violações de CSP no stdout e no console
  Resultado (executado pelo usuário no pacote x64, macOS, em 2026-10-24):
  - (a) Sem flash no esquema escuro nem no claro, em aberturas repetidas.
  - (b) Casca completa; o botão mostrou a notificação.
  - (c) Carregadas: IBM Plex Sans 400 e 600, IBM Plex Mono 400 (pesos não usados pela casca ficam `unloaded`, esperado).
  - (d) Claro: body `rgb(246, 245, 243)`, Paper `rgb(255, 255, 255)`. Escuro: body `rgb(18, 19, 22)`, Paper `rgb(27, 29, 33)`.
  - (e) `["object", [], "undefined", "undefined"]`.
  - (f) `fetch` bloqueado ("bloqueado: Failed to fetch"); violação de `connect-src 'none'` no console e no terminal como `[renderer:error]`.
  - (g) `window.open` e `location.href` para `https://example.com` abriram o navegador padrão sem mudar o app; `file:///etc/hosts` não teve efeito; `location.href` continuou no `index.html` do `app.asar`.
  - (h) Nenhuma violação de CSP. Ao abrir o DevTools, o terminal mostrou duas linhas `[renderer:error]` vindas de `devtools://devtools/bundled/...` ("Request Autofill.enable failed", "Autofill.setAddresses failed"), ruído do DevTools. Corrigido ligando o encaminhamento de console só na janela principal (D12).
  - Reverificação de (h) no pacote regerado (usuário, 2026-10-24): app aberto pelo terminal e DevTools aberto com ⌥⌘I; nenhuma linha apareceu no terminal. Aprovado.
- [x] 8.4 Se o item (c) ou (h) falhar por causa de `file://`, parar e abrir a migração para `protocol.handle` (D5); não afrouxar a CSP. Não se aplicou: (c) e (h) passaram sob `file://`

## 9. Documentação

- [x] 9.1 Escrever `README.md` em pt-BR: pré-requisitos (Node, npm), scripts, arquitetura em alto nível (main, preload, renderer, shared; regra "todo HTTP no main"; `connect-src 'none'`), empacotamento local e `xattr -cr <App>.app` no macOS
