## MODIFIED Requirements

### Requirement: Scripts do projeto
O `package.json` SHALL oferecer os scripts:
- `dev`: o app em desenvolvimento, com HMR;
- `build`: main, preload e renderer de produção;
- `typecheck`: TypeScript estrito em todos os alvos, sem emitir;
- `test`: Vitest nos projetos `main` e `renderer`;
- `test:build`: verificações sobre os artefatos de `build` (formato do preload, ausência de `data:`, CSP de produção no `index.html`);
- `package`: build seguido do empacotamento local;
- `icons`: regenera `build/icon.png`, `build/icon-mac.png` e os PNGs de `build/icons/` a partir da geometria do ícone (requisito 'Ícone do aplicativo').

#### Scenario: Testes rodam os dois projetos
- **WHEN** `npm test` é executado
- **THEN** o Vitest roda os testes do projeto `main` em ambiente node e os do projeto `renderer` em jsdom, e termina com código 0 se todos passarem

#### Scenario: Typecheck estrito
- **WHEN** `npm run typecheck` é executado
- **THEN** main, preload, renderer e shared são verificados com `strict: true`, e o comando falha em qualquer erro de tipo

#### Scenario: Regenerar os ícones
- **WHEN** `npm run icons` é executado
- **THEN** `build/icon.png` e `build/icon-mac.png` são reescritos com 1024×1024, e `build/icons/` com os oito tamanhos do Linux, todos a partir da geometria do ícone, e `assets/brand/app-icon.svg` não muda


### Requirement: Empacotamento para o sistema local
O script `package` SHALL gerar, em `release/`, o app empacotado com `electron-builder` para o sistema operacional e a arquitetura da máquina em que roda. O código vai em `asar`, sem assinatura de desenvolvedor, sem notarização e sem auto-update. O caminho suportado é gerar cada pacote no próprio sistema. A configuração MUST ser explícita para os três sistemas:
- **macOS**: alvo `dir`, sem identidade de assinatura. O resultado é `release/mac/Buteco Chat.app` (ou `release/mac-arm64/`).
- **Windows**: alvo `dir`. O resultado é `release/win-unpacked/Buteco Chat.exe` (ou `release/win-arm64-unpacked/`).
- **Linux**: alvo `deb`, com executável `buteco-chat`, categoria `Development`, um mantenedor com nome e e-mail e `homepage` com o repositório. O ícone vem de `build/icons/` (requisito 'Ícone do aplicativo'). O `desktopName` do `package.json` é `buteco-chat.desktop`, com `syncDesktopName`, para que o `app_id` da janela corresponda ao `.desktop` instalado. O resultado é `release/buteco-chat_<versão>_<arquitetura>.deb`. Instalado, o pacote MUST deixar o app abrir com o sandbox do Chromium ligado, inclusive no Ubuntu 24.04 ou mais novo, e com o ícone do app no lançador e no painel.

O Windows usa o ícone de `build.icon` e não tem ícone próprio na configuração. O Linux MUST ter `build.linux.icon` apontando para `build/icons`: sem ele, o electron-builder procura o ícone do Linux em `mac.icon` antes de `build.icon`, e o pacote levaria a arte com a margem do macOS.

#### Scenario: Pacote gerado
- **WHEN** `npm run package` é executado no macOS, no Windows ou no Linux
- **THEN** `release/` contém o resultado do alvo daquele sistema, para a arquitetura local

#### Scenario: Configuração por sistema
- **WHEN** o teste lê o `package.json`
- **THEN** `build.mac.target` e `build.win.target` são `dir` e `build.linux.target` é `deb`
- **AND** `build.linux.icon` é `build/icons`, `build.win` não tem `icon`, `build.icon` é `build/icon.png`, e `build.mac.icon` é `build/icon-mac.png`
- **AND** `desktopName` é `buteco-chat.desktop`, `build.linux.syncDesktopName` é verdadeiro, `build.linux.executableName` é `buteco-chat` e `build.linux.category` é `Development`
- **AND** `build.linux.maintainer` está no formato `Nome <e-mail>`, `homepage` começa com `https://`, `build.publish` é `null` e `build.npmRebuild` é falso

#### Scenario: Ícones instalados pelo deb
- **WHEN** o `deb` gerado é aberto
- **THEN** ele contém `usr/share/icons/hicolor/NxN/apps/buteco-chat.png` nos oito tamanhos de `build/icons/`, cada um igual ao arquivo correspondente

#### Scenario: App no Ubuntu com sandbox
- **WHEN** o `deb` é instalado com `apt` num Ubuntu 24.04 ou mais novo e `buteco-chat` é executado no terminal, sem `--no-sandbox`
- **THEN** a janela abre, sem o erro do `chrome-sandbox`

### Requirement: Teste de fumaça do pacote
Antes de uma versão do pacote ser considerada pronta num sistema, o app empacotado SHALL passar por um teste de fumaça manual nesse sistema, iniciado pelo terminal. O app não ganha link para esse teste. O teste confirma:
- a janela abre sem flash branco;
- a tela de login e a de conversas aparecem com Plex Sans e Plex Mono carregadas;
- o login funciona contra a plataforma, num endereço informado na tela;
- uma conversa recebe resposta e continua no histórico depois de fechar e reabrir o app;
- a barra de status mostra o endereço e o tempo de sessão;
- o tema claro e o escuro funcionam, alternando o tema do sistema;
- no esquema escuro, nem a janela nem o primeiro quadro do React aparecem claros;
- o ícone do app, e não o padrão do Electron, aparece no Dock, na barra de tarefas ou no painel, do tamanho dos ícones vizinhos;
- `window.buteco` existe;
- pelo DevTools do pacote, `window.open('https://example.com')` e `location.href = 'https://example.com'` abrem o navegador padrão sem navegar o app, e `location.href = 'file:///etc/hosts'` não tem efeito;
- há zero violações de CSP no stdout e no console.

No Linux, o teste também confirma:
- o app abre com o sandbox ligado, sem `--no-sandbox`;
- o ícone aparece no lançador de aplicativos;
- a pasta de dados fica em `~/.config/Buteco Chat`.

O Windows não tem teste de fumaça enquanto não houver quem teste, e o README marca a seção dele como não verificada. A fumaça do Linux foi adiada: até ela ser feita e aprovada, o README marca a seção do Linux como não verificada, e o pacote do Linux não é dado como pronto.

#### Scenario: Fumaça aprovada
- **WHEN** o pacote é aberto pelo terminal e os itens do teste de fumaça do sistema são verificados
- **THEN** todos os itens passam, e o resultado é registrado na change que prepara a versão, com o sistema e a versão dele

#### Scenario: Falha sob file://
- **WHEN** o teste de fumaça encontra fontes ou módulos bloqueados pela CSP sob `file://`
- **THEN** o pacote não é dado como pronto, e a correção é migrar para um protocolo próprio (`protocol.handle`), nunca afrouxar a CSP

#### Scenario: Sandbox recusado no Linux
- **WHEN** o app instalado pelo `deb` só abre com `--no-sandbox`
- **THEN** o pacote não é dado como pronto, e a correção nunca é desligar o sandbox

### Requirement: Arquivos ignorados e documentação
O repositório SHALL ter um `.gitignore` com `node_modules/`, `out/`, `dist/` e `release/`, e um `README.md` em pt-BR que explique os pré-requisitos, os scripts e a arquitetura em alto nível (main, preload, renderer, shared). Para cada sistema (macOS, Windows e Linux), o README MUST explicar:
- os pré-requisitos do sistema;
- o comando, que roda no próprio sistema, e onde fica o resultado em `release/`;
- como abrir o app pelo terminal para ver os avisos do renderer;
- como liberar o app não assinado: `xattr -cr` no macOS; no Windows, o SmartScreen ("Mais informações" → "Executar assim mesmo"), que só aparece quando o `.exe` tem Mark-of-the-Web; no Linux, a instalação do `deb` com `apt` e a remoção;
- onde fica a pasta de dados (`app.getPath('userData')`), com o `Local Storage` do histórico e a variante `(dev)`.

A seção do Windows MUST começar com uma linha que diga que ela não foi verificada num Windows. Enquanto a fumaça do Linux não for aprovada, a seção do Linux MUST começar com uma linha que diga que ela não foi verificada num Ubuntu.

#### Scenario: Artefatos de build fora do git
- **WHEN** `npm run build` e `npm run package` são executados
- **THEN** `git status` não lista arquivos de `out/`, `dist/` ou `release/`

#### Scenario: Windows não verificado
- **WHEN** alguém lê a seção do Windows no README
- **THEN** a primeira linha da seção diz que ela não foi verificada num Windows

#### Scenario: Linux não verificado
- **WHEN** alguém lê a seção do Linux no README antes de a fumaça do Linux ser aprovada
- **THEN** a primeira linha da seção diz que ela não foi verificada num Ubuntu

### Requirement: Ícone do aplicativo
O repositório SHALL guardar em `assets/brand/app-icon.svg` uma cópia **sem edição** do ícone de aplicativo oficial da plataforma (`apps/frontend/public/app-icon.svg` de `buteco-agents`, commit `58553b6`), com o manifesto C2PA. Ao lado, `assets/brand/README.md` MUST registrar:
- o repositório, o caminho e o commit de origem;
- o SHA-256 do arquivo;
- a regra de proveniência: o arquivo não é editado. Uma revisão da marca substitui o arquivo inteiro e atualiza o registro.

O app não importa código da plataforma; só esse arquivo é copiado.

O que é desenhado SHALL sair da geometria do ícone (requisito 'Ícone do app na interface' de `identidade-visual`): igual à do `app-icon.svg`, exceto pelo sentido do subcaminho da asa direita da gravata, invertido para eliminar o filete vazado. O arquivo é a origem registrada e não recebe a correção. O script `icons` MUST montar o SVG a partir dessa geometria, sem o manifesto C2PA, e gerar as peças abaixo, que ficam versionadas no git:
- `build/icon.png`: 1024×1024, o ícone no quadro inteiro, para o Windows;
- `build/icon-mac.png`: 1024×1024, o ícone inteiro reduzido a 824/1024 e centralizado num quadro transparente, sem sombra, no grid de ícones do macOS;
- `build/icons/NxN.png`, com N em 16, 24, 32, 48, 64, 128, 256 e 512 (os tamanhos de `apps` do tema `hicolor`): o mesmo SVG do quadro inteiro de `build/icon.png`, sem a margem do macOS, rasterizado direto em cada tamanho, para o Linux.

O electron-builder MUST usar `build/icon-mac.png` no macOS, `build/icons/` no Linux (`build.linux.icon`) e `build/icon.png` no Windows (`build.icon`, herdado). `.icns` e `.ico` são gerados pelo próprio electron-builder e não ficam no repositório. Com o app não empacotado (dev):
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

#### Scenario: Tamanhos do Linux
- **WHEN** o teste lê `build/icons/` e o `package.json`
- **THEN** a pasta tem exatamente os oito arquivos `NxN.png`, cada um um PNG com IHDR de N×N, `build.linux.icon` é `build/icons` e `build.win` não tem `icon`

#### Scenario: Linux no quadro inteiro
- **WHEN** o script monta o SVG dos tamanhos do Linux e o rasteriza
- **THEN** o SVG é o do quadro inteiro, e um pixel perto da borda esquerda, a meia altura, é o azul do ícone, opaco, enquanto no SVG do macOS o mesmo pixel é transparente

#### Scenario: Ícone em dev
- **WHEN** o app não empacotado abre a janela principal
- **THEN** o `BrowserWindow` recebe o caminho de `build/icon.png` como `icon` e, no macOS, `app.dock.setIcon` é chamado com o caminho de `build/icon-mac.png`

#### Scenario: Sem ícone de dev no pacote
- **WHEN** o app empacotado abre a janela principal
- **THEN** o `BrowserWindow` não recebe `icon` e `app.dock.setIcon` não é chamado
