## Context

O app foi empacotado e testado só no macOS (Intel, x64). O que existe hoje:

- **`package.json`** (`build`):
  - `appId`, `productName: "Buteco Chat"`, `directories.output: "release"`, `asar: true`;
  - `icon: "build/icon.png"`, `npmRebuild: false`, `publish: null`;
  - `files: ["out/**/*", "!node_modules/**/*"]`: o Vite empacota tudo e o `node_modules` não entra no asar;
  - `mac: { identity: null, icon: "build/icon-mac.png", target: "dir" }`;
  - sem `build.linux`, sem `build.win`, sem `desktopName` e sem `homepage`. O `author` é só um nome, sem e-mail. O `name` é `buteco-chat`.
- **Padrões do electron-builder 26.18** sem configuração: AppImage no Linux e instalador NSIS no Windows. Ninguém conferiu nenhum dos dois.
- **Main**:
  - em dev, `app.setPath('userData', devUserDataPath(...))` acrescenta ` (dev)` à pasta padrão antes de `requestSingleInstanceLock()`;
  - a janela e o Dock recebem os PNGs de `build/` só com o app não empacotado (barra-de-status-e-marca, D8);
  - `window-all-closed` encerra o app fora do macOS.
- **Spec "Teste de fumaça do pacote"** ainda cita "a casca", a tela provisória que saiu na `login-operador`.
- **README**: empacotamento, desbloqueio (`xattr -cr`) e pasta de dados (`~/Library/Application Support/Buteco Chat`) só para o macOS.

O que a exploração encontrou no código do electron-builder instalado (`node_modules/app-builder-lib`):
- **`out/util/resEdit.js`**: o ícone e a versão do `.exe` são gravados com o `resedit`, em JS puro, e não mais com `rcedit` pelo Wine. O `osslsigncode` só entraria para assinar.
- **`out/toolsets/linux.js`**: o `fpm` (que gera o `deb`) vem pronto, com Ruby, para Linux x64, arm64 e i386 e para macOS x64 e arm64.
- **`templates/linux/after-install.tpl`**, executado pelo `deb` na instalação:
  - cria `/usr/bin/<executável>` (por `update-alternatives`) apontando para `/opt/<productName>/<executável>`;
  - deixa o `chrome-sandbox` com SUID só onde os *user namespaces* não funcionam;
  - **instala `templates/linux/apparmor-profile.tpl`** em `/etc/apparmor.d/<executável>` quando o AppArmor aceita a ABI 4.0, ou seja, no Ubuntu 24.04 ou mais novo. É um perfil `unconfined` com `userns`.
- **`out/targets/LinuxTargetHelper.js`**: o `StartupWMClass` do `.desktop` vem do `desktopName` do `package.json`. Sem ele, cai no `productName` e a geração avisa: *"electron uses desktopName as app_id / WM_CLASS for window association"*. O nome do arquivo `.desktop` só segue o `desktopName` com `linux.syncDesktopName: true`.
- **`out/targets/FpmTarget.js`**:
  - o `deb` exige `homepage` (ou `repository`) e um mantenedor com e-mail (`linux.maintainer` ou `author.email`), ou falha;
  - as dependências padrão do pacote são `libgtk-3-0`, `libnotify4`, `libnss3`, `libxss1`, `libxtst6`, `xdg-utils`, `libatspi2.0-0`, `libuuid1` e `libsecret-1-0`;
  - o nome do arquivo é `${name}_${version}_${arch}.deb`, ou seja, `buteco-chat_0.1.0_amd64.deb`.
- **`out/linuxPackager.js`**: sem `executableName`, o executável é `sanitizedName.toLowerCase()`, que dá `buteco-chat`.

```
               npm run package (no próprio sistema)
                              │
          ┌───────────────────┼────────────────────┐
          ▼                   ▼                    ▼
       macOS               Windows               Linux (Ubuntu)
     target: dir         target: dir          target: deb
          │                   │                    │
 release/mac/            release/win-unpacked/  release/buteco-chat_0.1.0_amd64.deb
  Buteco Chat.app          Buteco Chat.exe       (+ release/linux-unpacked/, intermediário)
          │                   │                    │ sudo apt install ./release/…deb
          ▼                   ▼                    ▼
 xattr -cr (se copiado)   SmartScreen só com     /opt/Buteco Chat/buteco-chat
                          Mark-of-the-Web        /usr/bin/buteco-chat
                                                 /usr/share/applications/buteco-chat.desktop
                                                 /etc/apparmor.d/buteco-chat (24.04+)
```

## Goals / Non-Goals

**Goals:**
- Gerar e usar o app no Linux (Ubuntu) e no Windows, além do macOS, com o sandbox do Chromium ligado e o ícone do app no lançador e na barra de tarefas.
- Configuração explícita por sistema no `package.json`, conferida por teste.
- README que leve alguém do `git clone` ao app aberto em cada sistema, com a pasta de dados de cada um.
- Fumaça no Linux feita pelo usuário, seguindo só o README e o roteiro do `tasks.md`. **Adiada no fechamento** (D12): a change foi arquivada sem ela.

**Non-Goals:**
- Assinatura de código, notarização, auto-update, publicação de releases e lojas.
- CI. Um workflow do GitHub Actions que gere e abra o pacote do Windows fica como melhoria futura (D10).
- Fumaça no Windows. A seção do README fica marcada como não verificada.
- Outros formatos do Linux (AppImage, `rpm`, `snap`, Flatpak) e outras distribuições além do Ubuntu e derivadas.
- Mudar o código do main por causa do Linux. Em especial, o ícone continua vindo só do pacote quando o app está empacotado (D2).

## Decisions

### D1. Linux: `deb`, pelo sandbox do Chromium no Ubuntu 24.04+
**O problema.** Desde o 23.10, e por padrão no 24.04 LTS, o Ubuntu restringe pelo AppArmor os *user namespaces* sem privilégio (`kernel.apparmor_restrict_unprivileged_userns=1`). O sandbox do Chromium usa esses namespaces. Sem eles, cai para o `chrome-sandbox` com SUID de root, e sem isso o Electron aborta: *"The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now."* Isso afeta qualquer Electron executado de uma pasta comum: AppImage, `dir`, `tar.gz` e o próprio `release/linux-unpacked/`.

**A decisão.** Alvo `deb`. A instalação pelo `apt` roda o `after-install.tpl`, que instala o perfil AppArmor com `userns` para `/opt/Buteco Chat/buteco-chat` e ajusta o `chrome-sandbox`. O app abre com o sandbox ligado, sem nenhum passo manual. O Ubuntu 22.04, que não restringe, também funciona: o script pula o perfil e o app roda como hoje.

**Alternativas descartadas:**
- **`--no-sandbox`** (no `.desktop`, no `executableArgs` ou no README): desliga o sandbox de todos os processos do Chromium, inclusive do renderer, que carrega Markdown de respostas de agentes. Contraria a `janela-segura` (`sandbox: true`). O renderer continuaria isolado pelo `contextIsolation`, mas sem a barreira do SO.
- **`sudo chown root chrome-sandbox && sudo chmod 4755 chrome-sandbox`** num `dir` ou `tar.gz`: funciona, mas é um passo manual com `sudo` em cada geração, deixa um binário SUID de root numa pasta do usuário e é refeito a cada `npm run package`. No AppImage é impossível, porque a imagem é montada só para leitura.
- **`sudo sysctl kernel.apparmor_restrict_unprivileged_userns=0`**: afrouxa a proteção para o sistema inteiro, por causa de um app.
- **AppImage**: o formato de arquivo único mais comum no Linux, mas cai nos três problemas acima e no do ícone (D2). Também exigiria `libfuse2`, que não vem instalada no Ubuntu 22.04 ou mais novo.

### D2. Ícone no Wayland: `desktopName` e o `.desktop` instalado
**O problema.** O Electron 45 roda em Wayland por padrão quando a sessão é Wayland, como no GNOME do Ubuntu. No Wayland:
- o `icon` do `BrowserWindow` é ignorado (o protocolo `xdg-shell` não tem ícone de janela);
- o painel associa a janela a um `.desktop` instalado pelo `app_id`, e mostra o ícone desse `.desktop`.

O Electron deriva o `app_id` (e o `WM_CLASS` no X11) do `desktopName` do `package.json`.

**A decisão:**
- `desktopName: "buteco-chat.desktop"` na raiz do `package.json`;
- `linux.syncDesktopName: true`, para que o arquivo instalado seja `buteco-chat.desktop` e o `StartupWMClass` seja `buteco-chat`;
- o `deb` instala o `.desktop` em `/usr/share/applications/` e o ícone em `/usr/share/icons/hicolor/NxN/apps/buteco-chat.png`, em oito tamanhos.

**De onde vem o ícone do Linux.** A pré-conferência do `deb` (tarefa 2.3) mostrou que, sem `linux.icon`, o pacote levava o `build/icon-mac.png`, com a margem do grid do macOS, e só no tamanho de 1024 px. A causa está em `LinuxTargetHelper.computeDesktopIcons`: no Linux, o electron-builder procura `linux.icon`, depois **`mac.icon`** e só então `build.icon`. Com um PNG único, o conjunto instalado tem só o tamanho dele. No painel, a arte reduzida a 824/1024 ficaria menor que a dos vizinhos.

Por isso o Linux passa a ter **ícone próprio na configuração**: `build.linux.icon: "build/icons"`, uma pasta com `16x16.png`, `24x24.png`, `32x32.png`, `48x48.png`, `64x64.png`, `128x128.png`, `256x256.png` e `512x512.png`, os tamanhos de `apps` do tema `hicolor`. Os oito PNGs são **gerados da mesma geometria** por `npm run icons`, a partir do SVG do quadro inteiro (o mesmo de `build/icon.png`, sem a margem do macOS), rasterizado direto em cada tamanho, e ficam no git, como os outros. O electron-builder copia cada um para `hicolor/NxN/apps/`. A arte é a mesma nos três sistemas; só o macOS tem a margem do grid.

O Windows não tem esse problema: lá a busca é `win.icon` e depois `build.icon`, e a conferência da tarefa 2.2 mostrou o `.exe` com a arte do quadro inteiro. `build.win` continua sem `icon`.

**Só o `deb` resolve**, porque é o único dos alvos considerados que instala um `.desktop`. Um AppImage ou um `dir` aberto pelo terminal fica com o ícone genérico no painel do Wayland. A regra "Sem ícone de dev no pacote" (`empacotamento-local`, 'Ícone do aplicativo') continua: passar `icon` ao `BrowserWindow` no pacote do Linux não ajudaria no Wayland, e no X11 só repetiria o que o `.desktop` já faz.

**Limitação aceita em dev.** Com `npm run dev` numa sessão Wayland, a janela recebe `build/icon.png`, mas o painel mostra o ícone genérico, porque não há `.desktop` instalado para o `app_id`. No X11, o ícone aparece. A fumaça é do pacote, e o README registra isso.

### D3. Quebra de simetria com o Mac
No macOS e no Windows, o resultado é uma pasta que se abre direto (`dir`). No Linux, é um instalador que pede `sudo`.

**Motivo:** D1 e D2. Os dois problemas do Linux (sandbox e ícone) só se resolvem com arquivos fora da pasta do app, em `/etc/apparmor.d/` e `/usr/share/applications/`. Escrever esses arquivos exige root, e o `deb` é o jeito padrão do Ubuntu de fazer isso e desfazer depois, com `sudo apt remove buteco-chat`.

**O que isso muda no uso:**
- uma nova versão é instalada por cima com o mesmo `apt install ./…deb`;
- `release/linux-unpacked/` continua sendo gerado, mas o README não o oferece como forma de abrir o app: no Ubuntu 24.04+, ele cai no problema de D1.

### D4. Configuração do Linux
```jsonc
// raiz do package.json
"homepage": "https://github.com/aldovrando-oliveira/buteco-chat",
"desktopName": "buteco-chat.desktop",
// build
"linux": {
  "target": "deb",
  "category": "Development",
  "executableName": "buteco-chat",
  "maintainer": "<nome> <<e-mail>>",
  "syncDesktopName": true,
  "icon": "build/icons"
}
```
- **`category: "Development"`**: o README define o app como "uso interno, para testar agentes", uma ferramenta de quem desenvolve ou opera agentes. `Network` serve para clientes de rede de uso geral (navegadores, mensageiros), e o app não é um mensageiro de pessoas. A categoria só decide em qual grupo do lançador ele aparece.
- **`executableName: "buteco-chat"`**: já é o padrão, mas o padrão vem do `name` do `package.json`. Explícito, ele trava o nome do binário, do link em `/usr/bin`, do perfil AppArmor e do ícone em `hicolor` contra uma mudança de `name`, e combina com o `desktopName`. Sem espaço, ele dispensa aspas no terminal.
- **`maintainer`**: o nome e o e-mail informados pelo usuário. O e-mail aparece **só** nesse campo, e o teste confere o formato `Nome <e-mail>` sem repetir o valor (D9).
- **`icon: "build/icons"`**: a pasta dos oito tamanhos gerados (D2). Sem ela, o pacote pegaria o `mac.icon`.
- **`homepage`**: o repositório do GitHub (`origin`). O `deb` grava esse endereço no campo `Homepage` do pacote.
- **Dependências do pacote**: as padrão do electron-builder (Context). No Ubuntu 24.04, as bibliotecas renomeadas na transição `t64` (`libgtk-3-0t64` e outras) oferecem o nome antigo, e o `apt` as resolve. Não há `depends` próprio.
- **Arquitetura**: a da máquina, como hoje. O roteiro da fumaça pede `uname -m`, e o README cita `amd64` no nome do arquivo como exemplo.

### D5. Windows: `dir`
```jsonc
"win": { "target": "dir" }
```
- **Resultado**: `release\win-unpacked\Buteco Chat.exe`, ou `release\win-arm64-unpacked\` numa máquina ARM. É a mesma forma do Mac: uma pasta que se abre direto, sem instalar.
- **Alternativas descartadas**:
  - **`portable`**: um `.exe` único, mas montado com o NSIS, que se extrai numa pasta temporária a cada abertura. A abertura fica lenta, e o ganho de "um arquivo só" não importa para um app gerado na própria máquina;
  - **`nsis`**: um instalador de verdade, com entrada no menu Iniciar e desinstalador. Sem auto-update e sem distribuição, não paga o que acrescenta. No Windows, o ícone na barra de tarefas vem do próprio `.exe`, então o Windows não tem o problema do Linux (D2).
- **SmartScreen**: só avisa quando o `.exe` tem *Mark-of-the-Web*, ou seja, quando veio de download, ou de um zip baixado e extraído pelo Explorer. Gerado na própria máquina, ele abre sem aviso. Copiado de outra máquina por download, aparece "O Windows protegeu o computador", e o README explica "Mais informações" → "Executar assim mesmo". Outra saída é remover a marca antes, com `Unblock-File` no PowerShell.
- **`electron-winstaller`**: é *peer* do `electron-builder-squirrel-windows`, usado só pelo alvo `squirrel`. Nenhum alvo escolhido o usa, então a linha do README continua certa. O `.exe` traz `SquirrelAwareVersion: 1` nas informações de versão, mas o valor vem do binário padrão do Electron e só importa para o Squirrel.
- **Seção do README não verificada**: ninguém roda o app no Windows nesta change. A primeira linha da seção diz isso. A verificação feita é só a estrutural de D6.

### D6. Onde gerar e a conferência do `win-unpacked` gerado no Mac
**Caminho suportado: cada sistema gera o próprio pacote**, com `npm run package`. O README só documenta esse caminho, e o spec o registra.

O que funciona a partir de outro sistema (não documentado):
- **Windows a partir do Mac**: funciona sem Wine, porque o ícone é gravado com o `resedit` (Context). Foi conferido nesta change (abaixo).
- **`deb` a partir do Mac**: o `fpm` vem pronto para macOS, então a geração deve funcionar. Na exploração eu tinha dito que não; o código mostra que sim. Fica como pré-conferência opcional da estrutura do pacote antes da fumaça (tarefa 2.3). Não substitui a fumaça.

**Conferência do `win-unpacked` gerado no Mac** (2026-10-25, macOS 15 x64, electron-builder 26.18.0, Electron 45.0.0). Comando: `npx electron-builder --win dir --x64` com a saída numa pasta temporária, a partir do `package.json` desta change **antes** de qualquer edição, sem `build.win` e com o ícone vindo de `build.icon`. Resultado:
- a geração terminou com código 0. O log registra `skipped dependencies rebuild reason=npmRebuild is set to false`, `updating asar integrity executable resource` e `no code signing certificate configured, signing is skipped`;
- a pasta `win-unpacked/` tem `Buteco Chat.exe`, as DLLs e os `.pak` do Electron, `locales/` e `resources/app.asar` (2,1 MB), e só o asar dentro de `resources/`;
- o `app.asar` contém só `out/main`, `out/preload` e `out/renderer`, com as fontes Plex em `.woff2`/`.woff`, sem `node_modules`;
- o grupo de ícones 1 do `.exe`, lido com o `resedit`, tem 16, 24, 32, 48, 64, 128 e 256 px, em PNG de 32 bpp. Os PNGs extraídos de 256 e 32 px mostram o ícone do app (quadrado azul de cantos arredondados, rosto e gravata brancos), não o do Electron;
- as informações de versão trazem `ProductName` e `FileDescription` "Buteco Chat", `FileVersion` 0.1.0 e `CompanyName` "Aldovrando Oliveira".

O `.exe` não foi executado. Com `build.win.target: "dir"` explícito, o resultado deve ser o mesmo. A tarefa 2.2 repete a conferência depois da edição.

### D7. Pasta de dados e instância única
Pelo `app.getPath('userData')`, que é `appData` mais o nome do app (`productName`):

| Sistema | Empacotado | Dev |
| --- | --- | --- |
| macOS | `~/Library/Application Support/Buteco Chat` | `… /Buteco Chat (dev)` |
| Windows | `%APPDATA%\Buteco Chat` | `%APPDATA%\Buteco Chat (dev)` |
| Linux | `~/.config/Buteco Chat` (ou `$XDG_CONFIG_HOME/Buteco Chat`) | `~/.config/Buteco Chat (dev)` |

- O histórico fica em `Local Storage/` dentro dessa pasta, nos três sistemas.
- **Espaço e parênteses no nome**: são aceitos nos três sistemas. No Linux, o README coloca o caminho entre aspas.
- **Instância única no Linux**: o Chromium cria `SingletonLock`, `SingletonSocket` e `SingletonCookie` na pasta de dados. São links simbólicos, e o socket real fica num diretório temporário, então o limite de 108 caracteres do caminho de socket Unix não se aplica. Dev e pacote continuam podendo ficar abertos juntos, porque as pastas são diferentes. Nenhuma mudança no main.
- **Desinstalar não apaga os dados**: `apt remove` (e até `apt purge`) não mexe em `~/.config`. O README diz como apagar.

### D8. Dependências nativas e `npm install`
- **`@resvg/resvg-js`** (devDependency, só para `npm run icons`): tem binário pronto para Linux x64 e arm64 (glibc e musl) e para Windows x64, ia32 e arm64, pelas `optionalDependencies`. Não entra no `package`.
- **`npmRebuild: false` continua correto**: o asar não leva `node_modules`, e não há dependência nativa de produção.
- **Sem compiladores**: os únicos pacotes com script de instalação no `package-lock.json` são o `electron-winstaller` (não usado) e o `fsevents` (opcional, só no macOS). O esbuild, o Rollup e o resvg usam binários prontos.
- **Binário do Electron**: baixado na primeira execução de `npm run dev` ou de `npm run package`, como no Mac. O electron-builder baixa o Electron do sistema alvo.
- **Pré-requisito do Node no Ubuntu**: o `nodejs` do `apt` é antigo demais (o 24.04 traz a linha 18). O README pede o Node 22.12 ou mais novo, pelo `nvm` ou pelo repositório da NodeSource.

### D9. Testes de configuração
Em `tooling/app-icon.test.ts` (projeto `main`), e não no `test:build`: o `test:build` confere artefatos de `out/`, e estas verificações só leem o `package.json`, como as do ícone que já estão lá. Um `describe` novo, "configuração por sistema", confere:
- `build.linux.target === "deb"`, `build.win.target === "dir"` e `build.mac.target === "dir"`;
- `build.linux.icon === "build/icons"`, e `build/icons/` tem exatamente os oito arquivos de D2, cada um um PNG com o IHDR do tamanho do nome e igual ao gerado agora a partir do SVG do quadro inteiro;
- o SVG dos tamanhos do Linux é o do quadro inteiro, sem a margem do macOS: rasterizado, um pixel perto da borda esquerda, a meia altura, é o azul do ícone, opaco, e no SVG do macOS o mesmo pixel é transparente;
- `build.win.icon` não existe (herda `build.icon`, que continua `build/icon.png`), e `build.mac.icon` continua `build/icon-mac.png`;
- `desktopName === "buteco-chat.desktop"`, `build.linux.syncDesktopName === true` e `build.linux.executableName === "buteco-chat"`, com o `desktopName` sem `.desktop` igual ao `executableName`;
- `build.linux.category === "Development"`;
- `build.linux.maintainer` no formato `Nome <e-mail>` (por expressão regular, sem o valor literal), e `homepage` começando com `https://`;
- `build.publish === null`, `build.npmRebuild === false` e `build.mac.identity === null`.

O que o teste não pega (o perfil AppArmor instalado, o ícone no painel, o `.exe` abrindo) fica com a fumaça no Linux, com a conferência estrutural do Windows (D6) e com a pré-conferência opcional do `deb`.

### D10. Melhoria futura: CI para o Windows
Um workflow do GitHub Actions em `windows-latest` rodaria `npm ci`, `npm test`, `npm run package` e um teste de fumaça automatizado: abrir o `.exe` com `--enable-logging`, esperar a janela e conferir que não há violação de CSP no log. Isso tiraria a marca de "não verificada" da seção do Windows. Fica fora desta change, que não tem CI. O mesmo workflow poderia ter um job `ubuntu-latest` gerando o `deb`.

### D11. Specs e README
- **"Empacotamento para o sistema local"** passa a listar o alvo e o resultado de cada sistema, a regra de gerar no próprio sistema e as dependências do pacote do Linux (sandbox e ícone instalados com o pacote). O cenário "Configuração por sistema" corresponde a D9.
- **"Teste de fumaça do pacote"**:
  - sai "a casca", e entram a tela de login e a de conversas;
  - o teste vale por sistema: quem prepara a versão roda a fumaça no sistema dela;
  - os itens comuns ficam como estão, com "Dock ou barra de tarefas" passando a incluir o painel do Linux;
  - há itens só do Linux: sandbox ligado (o app abre sem `--no-sandbox`), ícone no lançador e no painel, e a pasta de dados em `~/.config`;
  - o Windows não tem fumaça até haver quem teste, e o README diz isso.
- **"Arquivos ignorados e documentação"**: o README explica para os três sistemas como gerar, abrir pelo terminal, liberar o app não assinado e onde ficam os dados.
- **README**: a seção "Empacotamento" ganha uma subseção por sistema. A pasta de dados sai da seção "Histórico de conversas", que passa a apontar para a tabela de D7, e o parágrafo da instância única deixa de citar só o macOS.

### D12. Fumaça no Linux adiada (decisão do fechamento)
No fechamento, o usuário decidiu não fazer a fumaça no Ubuntu agora e arquivar a change assim mesmo. O que foi verificado do Linux é só a estrutura do `deb` gerado no Mac (tarefa 2.3) e os testes de configuração (D9). Não foram testados: a instalação com `apt`, a abertura com o sandbox ligado, o ícone no painel e no lançador, e a pasta de dados.

Por isso:
- a seção do Linux no README começa com a mesma marca de **não verificada** da seção do Windows;
- o spec "Teste de fumaça do pacote" registra que a fumaça do Linux está pendente e que o pacote do Linux não é dado como pronto até ela ser aprovada;
- o roteiro da tarefa 4.1 fica no `tasks.md` arquivado, para ser seguido quando houver um Ubuntu disponível. Uma change futura roda a fumaça, registra o resultado e tira a marca do README.

## Risks / Trade-offs

- [O `deb` não funcionar num Ubuntu real, já que a fumaça foi adiada (D12)] → a seção do Linux fica marcada como não verificada, e o roteiro da 4.1 está pronto para a primeira rodada.

- [O `deb` precisa de `sudo` para instalar] → é o preço de D1 e D2, registrado em D3. O README mostra como remover (`sudo apt remove buteco-chat`).
- [Um Ubuntu com o AppArmor desligado, ou uma derivada com outra política] → sem o perfil, o `after-install` usa o SUID quando os namespaces não funcionam. A fumaça registra a versão exata e o retorno de `cat /etc/os-release`.
- [A transição `t64` do Ubuntu 24.04 quebrar alguma dependência padrão do `deb`] → o `apt install ./…deb` mostra a dependência faltante. Se isso acontecer, a fumaça falha e a change ganha um `linux.depends` próprio.
- [O ícone no painel não aparecer mesmo com o `desktopName`] → a fumaça pede `echo $XDG_SESSION_TYPE`. No Wayland, a causa provável é o `StartupWMClass` ou o `app_id`, que a saída de `grep StartupWMClass /usr/share/applications/buteco-chat.desktop` ajuda a diagnosticar.
- [A seção do Windows envelhecer sem verificação] → a marca de "não verificada" no topo da seção e a melhoria futura de D10.
- [`release/linux-unpacked/` parecer uma forma de abrir o app] → o README diz explicitamente que ele não serve no Ubuntu 24.04+ e por quê.
- [A pré-conferência do `deb` no Mac divergir do gerado no Linux] → ela é opcional e só olha a estrutura (`control`, `.desktop`, `after-install`, perfil AppArmor). A fumaça é feita com o `deb` gerado no Linux.

## Migration Plan

Não há migração de dados. Quem já usa o app no Mac não percebe mudança: `build.mac` não muda, e a fumaça do Mac não é refeita. Para desfazer a change, basta remover `build.linux`, `build.win`, `desktopName` e `homepage`.

## Open Questions

- Versão exata do Ubuntu e tipo de sessão (Wayland ou X11) da máquina da fumaça: vêm no retorno do usuário. Ficam em aberto com a fumaça adiada (D12).
- Arquitetura da máquina Linux. Se for arm64, o nome do arquivo passa a `buteco-chat_0.1.0_arm64.deb`, e o README cita os dois.
