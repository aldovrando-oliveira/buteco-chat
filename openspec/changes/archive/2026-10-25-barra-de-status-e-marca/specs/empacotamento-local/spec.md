## ADDED Requirements

### Requirement: Ícone do aplicativo
O repositório SHALL guardar em `assets/brand/app-icon.svg` uma cópia **sem edição** do ícone de aplicativo oficial da plataforma (`apps/frontend/public/app-icon.svg` de `buteco-agents`, commit `58553b6`), com o manifesto C2PA. Ao lado, `assets/brand/README.md` MUST registrar:
- o repositório, o caminho e o commit de origem;
- o SHA-256 do arquivo;
- a regra de proveniência: o arquivo não é editado. Uma revisão da marca substitui o arquivo inteiro e atualiza o registro.

O app não importa código da plataforma; só esse arquivo é copiado.

O que é desenhado SHALL sair da geometria do ícone (requisito 'Ícone do app na interface' de `identidade-visual`): igual à do `app-icon.svg`, exceto pelo sentido do subcaminho da asa direita da gravata, invertido para eliminar o filete vazado. O arquivo é a origem registrada e não recebe a correção. O script `icons` MUST montar o SVG a partir dessa geometria, sem o manifesto C2PA, e gerar os dois PNGs abaixo, que ficam versionados no git:
- `build/icon.png`: 1024×1024, o ícone no quadro inteiro, para Windows e Linux;
- `build/icon-mac.png`: 1024×1024, o ícone inteiro reduzido a 824/1024 e centralizado num quadro transparente, sem sombra, no grid de ícones do macOS.

O electron-builder MUST usar `build/icon-mac.png` no macOS e `build/icon.png` nos demais sistemas. `.icns` e `.ico` são gerados pelo próprio electron-builder e não ficam no repositório. Com o app não empacotado (dev):
- a janela principal MUST receber `build/icon.png` como `icon` (barra de tarefas no Windows e no Linux);
- no macOS, o Dock MUST usar `build/icon-mac.png` (`app.dock.setIcon`).

Empacotado, nenhuma das duas chamadas acontece: o ícone vem do pacote.

#### Scenario: Arquivo de origem intacto
- **WHEN** o teste lê `assets/brand/app-icon.svg`
- **THEN** o SHA-256 do arquivo é igual ao registrado em `assets/brand/README.md`, o arquivo contém `<c2pa:manifest>` e o subcaminho original da asa direita, `M366 326Q366 312 352 312L276 346V382L352 416Q366 416 366 402Z`

#### Scenario: PNGs a partir da geometria corrigida
- **WHEN** o script monta o SVG do ícone
- **THEN** o SVG tem a asa direita invertida e não tem `<metadata>` nem `c2pa`, e, rasterizado em 1024 px, o pixel em (550, 701) é branco

#### Scenario: Peças geradas
- **WHEN** o teste lê `build/icon.png`, `build/icon-mac.png` e o `package.json`
- **THEN** os dois arquivos são PNG com IHDR de 1024×1024, `build.mac.icon` é `build/icon-mac.png` e `build.icon` é `build/icon.png`

#### Scenario: Ícone em dev
- **WHEN** o app não empacotado abre a janela principal
- **THEN** o `BrowserWindow` recebe o caminho de `build/icon.png` como `icon` e, no macOS, `app.dock.setIcon` é chamado com o caminho de `build/icon-mac.png`

#### Scenario: Sem ícone de dev no pacote
- **WHEN** o app empacotado abre a janela principal
- **THEN** o `BrowserWindow` não recebe `icon` e `app.dock.setIcon` não é chamado

## MODIFIED Requirements

### Requirement: Scripts do projeto
O `package.json` SHALL oferecer os scripts:
- `dev`: o app em desenvolvimento, com HMR;
- `build`: main, preload e renderer de produção;
- `typecheck`: TypeScript estrito em todos os alvos, sem emitir;
- `test`: Vitest nos projetos `main` e `renderer`;
- `test:build`: verificações sobre os artefatos de `build` (formato do preload, ausência de `data:`, CSP de produção no `index.html`);
- `package`: build seguido do empacotamento local;
- `icons`: regenera `build/icon.png` e `build/icon-mac.png` a partir da geometria do ícone (requisito 'Ícone do aplicativo').

#### Scenario: Testes rodam os dois projetos
- **WHEN** `npm test` é executado
- **THEN** o Vitest roda os testes do projeto `main` em ambiente node e os do projeto `renderer` em jsdom, e termina com código 0 se todos passarem

#### Scenario: Typecheck estrito
- **WHEN** `npm run typecheck` é executado
- **THEN** main, preload, renderer e shared são verificados com `strict: true`, e o comando falha em qualquer erro de tipo

#### Scenario: Regenerar os ícones
- **WHEN** `npm run icons` é executado
- **THEN** `build/icon.png` e `build/icon-mac.png` são reescritos a partir da geometria do ícone, com 1024×1024, e `assets/brand/app-icon.svg` não muda

### Requirement: Teste de fumaça do pacote
Antes de uma versão do pacote ser considerada pronta, o app empacotado SHALL passar por um teste de fumaça manual, iniciado pelo terminal. A casca não ganha link para esse teste. O teste confirma:
- a janela abre sem flash branco;
- a casca aparece com Plex Sans e Plex Mono carregadas;
- o tema claro e o escuro funcionam, alternando o tema do sistema;
- no esquema escuro, nem a janela nem o primeiro quadro do React aparecem claros;
- o ícone do app, e não o padrão do Electron, aparece no Dock ou na barra de tarefas, do tamanho dos ícones vizinhos;
- `window.buteco` existe;
- pelo DevTools do pacote, `window.open('https://example.com')` e `location.href = 'https://example.com'` abrem o navegador padrão sem navegar o app, e `location.href = 'file:///etc/hosts'` não tem efeito;
- há zero violações de CSP no stdout e no console.

#### Scenario: Fumaça aprovada
- **WHEN** o pacote é aberto pelo terminal e os itens do teste de fumaça são verificados
- **THEN** todos os itens passam, e o resultado é registrado na change que prepara a versão

#### Scenario: Falha sob file://
- **WHEN** o teste de fumaça encontra fontes ou módulos bloqueados pela CSP sob `file://`
- **THEN** o pacote não é dado como pronto, e a correção é migrar para um protocolo próprio (`protocol.handle`), nunca afrouxar a CSP
