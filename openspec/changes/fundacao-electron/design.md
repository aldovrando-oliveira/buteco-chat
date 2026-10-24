## Context

Repositório novo, só com o OpenSpec configurado. O Buteco Chat é um cliente desktop externo da plataforma Buteco Agentes. As regras invariáveis vêm do documento de construção: todo HTTP sai do main, o token só existe na memória do main, o preload expõe uma API mínima e a janela é endurecida. Esta change cria a base sobre a qual as outras quatro changes são construídas, sem nenhuma integração com a plataforma.

Versões de referência no momento da proposta (npm): `electron` 45, `electron-vite` 6.0 (peer `vite` ^6 || ^7 || ^8), `vite` 8.0, `@mantine/core` 9.7.3 (peer `react` ^19.2), `electron-builder` 26, `@fontsource/ibm-plex-*` 5.3, `vitest` 5.0. Máquina de desenvolvimento: macOS, Node 26, npm 11. As versões exatas ficam travadas no `package-lock.json` da instalação.

```
┌──────────────────────── main (Node) ───────────────────────────┐
│ index.ts: ciclo de vida, cria a janela                          │
│ security/: webPreferences, guardas de navegação/janela/webview, │
│            permissões, encaminhamento de console                │
│ ipc/handle.ts: registra handlers com validação de remetente     │
│ [futuro] auth/  a2a/   ← todo HTTP mora aqui                    │
└──────────────▲──────────────────────────────────────────────────┘
               │ ipcMain.handle (nenhum canal nesta change)
┌──────────────┴─────── preload (sandbox, 1 arquivo CJS) ─────────┐
│ contextBridge.exposeInMainWorld('buteco', {})                   │
└──────────────▲──────────────────────────────────────────────────┘
               │ window.buteco : ExposedApi           src/shared/api.ts
┌──────────────┴─────── renderer (file://, CSP em <meta>) ────────┐
│ React 19 · MantineProvider(tema) · Plex empacotada · casca      │
│ connect-src 'none' → o renderer não tem como fazer HTTP         │
└─────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Projeto com build, dev, typecheck, testes e empacotamento funcionando.
- Janela endurecida (itens 1–5 da arquitetura), com a política de navegação e de links externos testada no main.
- A regra "o renderer não faz HTTP" garantida pela CSP, e não só por convenção.
- Tipos do contrato do preload fixados em `src/shared/api.ts`, e um padrão de IPC com validação de remetente pronto para as próximas changes.
- Tema Mantine com a identidade da plataforma, claro e escuro, com contraste verificado por teste.
- Pacote local aprovado num teste de fumaça (fontes, tema, preload, zero violações de CSP).

**Non-Goals:**
- Qualquer chamada à plataforma, autenticação, token ou canal IPC de negócio.
- Empacotamento para outros sistemas operacionais ou arquiteturas, assinatura, notarização, publicação em loja e auto-update.
- Seletor manual de tema.
- ESLint/Prettier (podem entrar numa change futura de ferramental).
- `react-markdown`/`remark-gfm` (entram em `conversa-a2a`).

## Decisions

### D1. Build com `electron-vite` 6 + Vite
Os três alvos (main, preload e renderer) vêm num único `electron.vite.config.ts`, com HMR no renderer e reinício automático do main.
- *Alternativas*: `vite-plugin-electron`, que exige mais configuração manual do preload e dos tsconfigs; Electron Forge com o plugin de Vite, cuja integração com Vite continua marcada como experimental e que traz o próprio empacotador, sobrepondo-se ao D3.

### D2. Gerenciador de pacotes: npm
O `electron-builder` funciona melhor com `node_modules` plano. O pnpm exigiria `node-linker=hoisted`.

### D3. Empacotamento com `electron-builder`, só para o SO local
Configuração declarativa (bloco `build` no `package.json` ou `electron-builder.yml`), saída em `release/`, `asar: true`, sem identidade de assinatura. No macOS, o binário arm64 precisa ao menos de assinatura ad hoc para executar. Isso deve ser confirmado no teste de fumaça (ver Riscos). O README documenta `xattr -cr <App>.app` para cópias levadas a outra máquina.
- *Alternativa*: Electron Forge (descartado em D1).

### D4. Preload em CommonJS, arquivo único
Com `sandbox: true`, o preload não carrega ESM, e o `require` só alcança um subconjunto de módulos (`electron` e poucos internos). Decisão: o `package.json` **não** declara `"type": "module"`, e a configuração do preload no `electron-vite` força a saída em formato `cjs`, com tudo empacotado num arquivo só. Como o Vite 8 trocou o Rollup pelo Rolldown, o nome exato da opção (`rollupOptions` × `rolldownOptions`) deve ser conferido na versão instalada. Um teste no projeto `main` lê o artefato gerado e falha se encontrar `import ` de módulo ou `require` de algo que não seja `electron`.

### D5. `file://` com CSP em `<meta>`; `app://` descartado, com gatilho
O renderer de produção é carregado com `loadFile`. A CSP vai numa `<meta>` injetada no `index.html` por um pequeno plugin Vite (`transformIndexHtml`), que escolhe a política de produção ou a de dev conforme o modo.
- *Alternativa descartada*: protocolo próprio `app://` com `protocol.handle`, que daria origem própria e CSP por header. Fica descartado por enquanto, porque a navegação está bloqueada (D7) e nenhum HTTP sai do renderer.
- **Gatilho de migração**: se, no app empacotado, a CSP com `'self'` bloquear os módulos ou as fontes sob `file://`, a saída é migrar para `protocol.handle`. **A CSP nunca é afrouxada** para contornar isso.

### D6. CSP de produção e de desenvolvimento
Produção:
```
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
font-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none';
form-action 'none'; frame-src 'none'; object-src 'none'
```
- `style-src 'unsafe-inline'`: o `MantineProvider` injeta um `<style>` com as variáveis CSS, e os componentes usam o atributo `style`. Um nonce (`getStyleNonce`) exigiria entregar um valor novo por carregamento, o que não é possível com `<meta>` estática sob `file://`. Injeção de estilo é risco baixo, e o trade-off fica registrado.
- `img-src 'self'`, **sem** `data:`: nada na fundação precisa disso. O CSS do `@mantine/core` 9.7.3 não contém nenhuma URL `data:` (conferido no pacote), e os ícones do Mantine são SVG inline em elementos, não imagens.
- `connect-src 'none'`: torna a regra "todo HTTP no main" verificável pela plataforma Chromium.

Desenvolvimento: `script-src 'self' 'unsafe-inline'` (preâmbulo do React Refresh), `connect-src` restrito a `http://localhost:<porta>` e `ws://localhost:<porta>` do servidor Vite, com `strictPort: true` para a porta não variar. Como `'self'` e a origem do dev incluem a porta, a plataforma em `localhost:5017` continua inacessível pelo renderer mesmo em dev.

### D7. Política de navegação e de links externos
Uma função pura `classifyExternalUrl(url): 'open-external' | 'discard'` aceita só `http:` e `https:` com `new URL()` válido. As guardas usam essa função:
- `will-navigate`: `preventDefault()` sempre; se `open-external`, `shell.openExternal(url)`.
- `setWindowOpenHandler`: devolve sempre `{ action: 'deny' }`; se `open-external`, `shell.openExternal(url)`.
- `will-attach-webview`: `preventDefault()`.
As guardas são aplicadas em `app.on('web-contents-created')`, para valer em qualquer `webContents`. A lógica de decisão fica separada da ligação com o Electron, para ser testada no Vitest (projeto `main`) com `shell` simulado.

### D8. Permissões negadas
`session.defaultSession.setPermissionRequestHandler` nega tudo e `setPermissionCheckHandler` devolve `false`. Consequência registrada para `conversa-a2a`: o botão **Copiar** do `contextId` não deve depender de `navigator.clipboard`. Ou ele passa por um IPC no main (`clipboard.writeText`), ou a change abre exceção explícita e testada para `clipboard-sanitized-write`.

### D9. Contrato do preload e IPC
- `src/shared/api.ts` declara `ChatError`, `Result<T>`, `ButecoApi`, `AgentSummary`, `TaskState` exatamente como no documento de construção, e `type ExposedApi = Pick<ButecoApi, never>`. Cada change seguinte amplia o `Pick` (por exemplo, `Pick<ButecoApi, 'auth'>`) ao implementar o namespace. Assim o tipo global de `window.buteco` nunca promete o que não existe.
- `api.ts` é o **contrato inicial**, não um contrato congelado. Uma change pode alterá-lo (por exemplo, acrescentando o namespace de área de transferência previsto em D8), desde que registre no próprio `design.md` a alteração e o motivo.
- Nomes de canal no formato `<namespace>:<acao>` (`auth:login`, `chat:send`…), declarados como constantes em `src/shared/`.
- `src/main/ipc/handle.ts` envolve `ipcMain.handle`: rejeita se `event.senderFrame` for `null`, se não for frame principal, se o `webContents` não for de uma janela do app ou se a URL não for a do renderer. A comparação da URL usa `new URL()` e **ignora `hash` e `search`**, para que um roteamento por hash (`index.html#/conversas`) continue válido. Em produção, comparam-se esquema (`file:`) e `pathname` com os do `index.html` empacotado. A URL esperada **MUST** ser montada com `pathToFileURL()` (`node:url`) a partir do caminho do `index.html`, **nunca** por concatenação de string: o caminho do app empacotado contém espaço (`Buteco Chat.app`), e o `new URL()` do frame vem com `%20`. Em dev, compara-se a `origin` com a do dev server. Outro `index.html` em caminho diferente é rejeitado. A validação é uma função pura, testada no projeto `main`.
- *Alternativa descartada*: stubs "não implementado" para toda a `ButecoApi`, que mentiriam no tipo e criariam canais sem dono.

### D10. Tema Mantine: o que a versão 9.7.3 realmente oferece
Conferido nos tipos e no código do `@mantine/core@9.7.3`:
- `VariantColorsResolver = (input: { color, theme, variant, gradient?, autoContrast? }) => { background, hover, color, border, hoverColor? }`. **O resolvedor não recebe o esquema de cor.** Para `variant="filled"` com cor do tema sem tom explícito, o resolvedor padrão devolve `background: var(--mantine-color-<cor>-filled)` e `hover: var(--mantine-color-<cor>-filled-hover)`.
- O tom de `--mantine-color-<cor>-filled` em cada esquema é definido pelo resolvedor de variáveis CSS (`getCSSColorVariables`), com `primaryShade.light` no bloco `light` e `primaryShade.dark` no bloco `dark`. Um `cssVariablesResolver` passado ao provider é mesclado por cima do padrão (`deepMerge(default, custom)`), então as nossas chaves vencem.
- `--mantine-color-body` é o fundo do `body` (`baseline.css`) **e também** de `Paper`, `Card`/`ModalBase`, `AppShell`, `Tabs`, `Table` e outros. Os padrões são `theme.white` no claro e `dark-7` no escuro. `--mantine-color-dimmed` já vale `gray-6` / `dark-2` por padrão.

Consequência para a **variante A** (manter `primaryShade: { light: 6, dark: 4 }` e usar o tom 6 só no preenchido escuro): um `variantColorResolver` não consegue distinguir claro de escuro. Ele só devolve uma referência a variável, e é o bloco `dark` das variáveis CSS que decide o tom. Por isso a variante A é implementada no **`cssVariablesResolver`**, sobrescrevendo no bloco `dark`:
```
--mantine-color-butecoBlue-filled:       var(--mantine-color-butecoBlue-6)
--mantine-color-butecoBlue-filled-hover: var(--mantine-color-butecoBlue-7)
```
`--mantine-primary-color-filled` já aponta para essa variável, então botões, `Badge`, `Checkbox`, `Switch` e demais componentes preenchidos herdam a troca. Texto (`-text` = tom 4), `light`, `outline` e âncoras (tom 4) continuam derivados de `primaryShade.dark = 4`, como a variante A pede. **Nenhum `variantColorResolver` customizado é necessário.** Fica registrado que isso diverge da letra da decisão ("sobrescrever com `variantColorResolver`") e mantém o seu efeito.
- Contraste esperado (WCAG, texto `#ffffff`): `butecoBlue[6]` `#2a6ecb` ≈ 5,0:1 (passa); `butecoBlue[4]` `#6495db` ≈ 3,1:1 (reprova, motivo da troca).
- Teste: a partir do tema e do `cssVariablesResolver` exportados, resolver `var(--mantine-color-butecoBlue-filled)` no bloco `dark`, e depois no `light`, até um hex da escala, e exigir contraste ≥ 4,5:1 com o branco. O teste também confere que o `defaultVariantColorsResolver` devolve essa variável para `variant: 'filled', color: 'butecoBlue'`. Se uma versão futura do Mantine mudar o caminho, o teste quebra.

Fundo da página: como `--mantine-color-body` é a superfície, **não** é sobrescrito. O `cssVariablesResolver` define `--buteco-color-page` (`#f6f5f3` no `light`, `#121316` no `dark`), e um CSS global do app aplica `body { background-color: var(--buteco-color-page) }`, importado depois de `@mantine/core/styles.css`. Surfaces e bordas continuam nos padrões do Mantine (branco/`dark-7`, `gray-3`/`dark-4`), que já coincidem com a identidade. Um teste de contraste cobre `dimmed` sobre página e superfície, nos dois esquemas.

`defaultColorScheme: 'auto'`, com o gerenciador padrão do Mantine. Ele grava a preferência em `localStorage` (sem dado sensível) e já trata as falhas de acesso.

**Sem `ColorSchemeScript`.** O `ColorSchemeScript` do Mantine é um `<script>` inline que define `data-mantine-color-scheme` antes do React. A CSP de produção (`script-src 'self'`) o bloqueia, então ele **não é usado**. Conferido no 9.7.3: o provider define o atributo em `useIsomorphicEffect` (efeito de layout, antes da pintura), o que cobre o primeiro quadro do React. Para o intervalo antes do React montar, quando ainda não existe o atributo, três camadas evitam o claro no esquema escuro: (1) `backgroundColor` da janela (D12); (2) no `global.css`, um fundo estático em `html` (`#f6f5f3`, e `#121316` sob `@media (prefers-color-scheme: dark)`), que não depende do atributo; (3) `--buteco-color-page` sem atributo fica indefinida, então o `body` fica transparente e deixa ver o fundo de `html`. O item 8.3(a) verifica isso no escuro.

### D11. Fontes via `@fontsource`, sem `data:`
Importar apenas `@fontsource/ibm-plex-sans/latin-{400,500,600}.css` e `@fontsource/ibm-plex-mono/latin-{400,500}.css`. `build.assetsInlineLimit: 0` no renderer garante que nenhum `.woff2` (nem outro asset) vire `data:`. `font-src 'self'` cobre os arquivos copiados para os assets. O tema define `fontFamily: '"IBM Plex Sans", system-ui, sans-serif'` e `fontFamilyMonospace: '"IBM Plex Mono", ui-monospace, monospace'`. Um teste pós-build varre os CSS e JS gerados atrás de `data:`.

### D12. Janela sem flash branco e console encaminhado
`BrowserWindow` criada com `show: false`, `backgroundColor` calculado de `nativeTheme.shouldUseDarkColors` (`#121316` ou `#f6f5f3`) e exibida em `ready-to-show`. O main escuta `console-message` do `webContents` e repassa avisos e erros ao stdout, em dev e no pacote. Isso torna objetivo o critério "zero violações de CSP" do teste de fumaça. O renderer nunca terá token (regra do projeto), então o repasse não expõe credencial.

**Assinatura do `console-message`.** O formato mudou em versões recentes, então a implementação **deve conferir o `electron.d.ts` da versão instalada** e registrar aqui o que encontrou. Na proposta, conferido no `electron@45.0.0`: `on('console-message', (details: Event<WebContentsConsoleMessageEventParams>) => void)`, com `details.level: 'info' | 'warning' | 'error' | 'debug'`, `details.message`, `details.lineNumber`, `details.sourceId` e `details.frame`. Os argumentos posicionais antigos (`level` numérico de 0 a 3, `message`, `line`, `sourceId`) ainda existem, mas estão marcados `@deprecated` e **não são usados**. Repassam-se ao stdout só `warning` e `error`; `info` e `debug` são descartados. A filtragem é uma função pura testada com evento simulado nesse formato.

### D13. Testes com Vitest `projects`
Um `vitest.config.ts` com dois projetos:
- `main`: ambiente `node`, cobre `src/main/**` e `src/shared/**` (política de URL, validação de remetente, artefato do preload, varredura de `data:` no build).
- `renderer`: ambiente `jsdom`, Testing Library + `@testing-library/jest-dom`, setup com `matchMedia` e `ResizeObserver` simulados (exigidos pelo Mantine), cobre tema, contraste e casca.
Os testes que dependem do build (artefato do preload e varredura de `data:`) rodam num script separado (`test:build`), executado depois de `npm run build`, para o `npm test` continuar rápido.

### D14. Layout do código
```
src/
  main/      index.ts · security/{window,navigation,permissions,console}.ts · ipc/handle.ts
  preload/   index.ts
  shared/    api.ts · ipc-channels.ts
  renderer/  index.html · src/{main.tsx,App.tsx,env.d.ts} · src/theme/{theme.ts,css-variables.ts} · src/styles/global.css
```
tsconfigs separados (`tsconfig.node.json` para main/preload/shared, `tsconfig.web.json` para renderer/shared), todos com `strict: true`.

### D15. DevTools permanece no app empacotado
Nesta change, o menu padrão do Electron, com "Toggle Developer Tools", continua no pacote. O teste de fumaça depende dele nos itens 8.3 (c) fontes, (e) `window.buteco`, (f) CSP do `fetch` e (g) navegação externa. Uma change que remova o DevTools do pacote precisa trazer outra forma de fazer essas verificações (por exemplo, um modo de diagnóstico ou testes de ponta a ponta automatizados).

## Risks / Trade-offs

- [`'self'` sob `file://` se comporta diferente do esperado no Chromium, bloqueando módulos ou fontes] → Coberto pelo teste de fumaça do pacote. Se falhar, a correção é migrar para `protocol.handle` (D5), nunca afrouxar a CSP.
- [`style-src 'unsafe-inline'` permite injeção de estilo] → Aceito: injeção de estilo tem impacto baixo, e `script-src` continua sem `unsafe-inline` em produção.
- [Pacote arm64 não assinado não abre no macOS] → O teste de fumaça confirma que o pacote abre na máquina de dev. Se não abrir, configurar assinatura ad hoc no `electron-builder` (sem identidade de desenvolvedor) e registrar no README.
- [Atualização do Mantine muda o caminho `filled` → variável CSS] → O teste de D10 confere o resolvedor padrão e o contraste, e quebra se o caminho mudar.
- [Reload de dev disparar `will-navigate` e ser bloqueado] → Pela documentação, o Electron não emite `will-navigate` em `reload`. Mesmo assim, conferir no primeiro `npm run dev`. Se afetar o HMR, permitir só navegação para a URL exata do renderer de dev.
- [Negar todas as permissões quebrar algo em changes futuras, como a cópia para a área de transferência] → Registrado em D8, com a saída indicada.
- [O Vite 8 (Rolldown) mudar o nome de opções de saída do preload] → D4 exige conferir na versão instalada, e o teste do artefato do preload detecta regressão.

## Migration Plan

Não se aplica: repositório novo, nada em produção. Rollback = reverter os commits da change.

## Open Questions

- **Imagens em Markdown (para `conversa-a2a`)**: a CSP `img-src 'self'` bloqueia imagens remotas nas respostas do agente. Essa change deve renderizar `![alt](url)` como **link** (texto `alt`, ou a URL, abrindo via D7) em vez de `<img>`, para não exibir imagem quebrada. Fica fora desta change.
- **Cópia para a área de transferência (para `conversa-a2a`)**: IPC `clipboard.writeText` no main ou exceção de permissão (D8).
- **Electron fuses**: desligar `RunAsNode`, `EnableNodeOptionsEnvironmentVariable` e `EnableNodeCliInspectArguments`, e ligar `OnlyLoadAppFromAsar`, via configuração do `electron-builder`. A recomendação é sim, numa change de endurecimento. Fica fora daqui para não ampliar o escopo sem revisão. A validação de integridade do asar depende de assinatura e fica fora de qualquer forma.
