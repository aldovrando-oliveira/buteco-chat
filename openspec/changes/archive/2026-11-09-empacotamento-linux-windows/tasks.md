## 1. Configuração e testes

- [x] 1.1 Em `tooling/app-icon.test.ts`, escrever antes da configuração o `describe` "configuração por sistema" (D9, cenário 'Configuração por sistema'), e ver os testes falharem:
  - alvos `dir` no macOS e no Windows, e `deb` no Linux;
  - sem `icon` em `build.linux` e em `build.win`, com `build.icon` e `build.mac.icon` como hoje (o `build.linux.icon` foi revisto na 1.5, depois da 2.3);
  - `desktopName` igual a `buteco-chat.desktop`, `syncDesktopName` verdadeiro, `executableName` igual a `buteco-chat` (e igual ao `desktopName` sem `.desktop`), `category` igual a `Development`;
  - `maintainer` no formato `Nome <e-mail>`, por expressão regular, **sem o e-mail literal no teste**;
  - `homepage` com `https://`;
  - `publish: null`, `npmRebuild: false` e `mac.identity: null`.
- [x] 1.2 No `package.json` (D4, D5):
  - na raiz, `homepage: "https://github.com/aldovrando-oliveira/buteco-chat"` e `desktopName: "buteco-chat.desktop"`;
  - `build.linux` com `target: "deb"`, `category: "Development"`, `executableName: "buteco-chat"`, `maintainer` e `syncDesktopName: true`. O `maintainer` usa o nome e o e-mail informados pelo usuário na exploração. O e-mail não entra em nenhum outro arquivo;
  - `build.win` com `target: "dir"`.

  `build.mac`, `build.icon`, `npmRebuild` e `publish` não mudam.
- [x] 1.3 Rodar `npm test`, `npm run typecheck`, `npm run build` e `npm run test:build`, e conferir que tudo passa.
- [x] 1.4 `grep -rn` pelo e-mail do mantenedor no repositório, fora de `node_modules/` e `release/`. Só pode aparecer em `package.json`, em `build.linux.maintainer`.

- [x] 1.5 Ícone próprio do Linux (D2, D4, D9; acrescentada depois da divergência da 2.3):
  - em `tooling/app-icon.test.ts`, antes do código, ver falhar: `build.linux.icon === "build/icons"`; `build/icons/` com exatamente os oito arquivos (16, 24, 32, 48, 64, 128, 256 e 512), o IHDR de cada um batendo com o nome e o conteúdo igual ao gerado agora; `build.win.icon` ausente; o SVG dos tamanhos do Linux é o do quadro inteiro (pixel perto da borda esquerda azul e opaco, transparente no SVG do macOS);
  - `tooling/app-icon.ts` passa a gerar `build/icons/NxN.png` a partir do SVG do quadro inteiro, rasterizado em cada tamanho; `npm run icons` regenera as peças e `build/icon.png` e `build/icon-mac.png` não mudam;
  - `build.linux.icon: "build/icons"` no `package.json`;
  - rodar de novo `npm test`, `npm run typecheck`, `npm run build` e `npm run test:build`.

## 2. Conferências a partir do Mac

- [x] 2.1 `npm run package` no Mac. Conferir que `release/mac/Buteco Chat.app` continua sendo gerado como antes, já que `build.mac` não mudou. A fumaça do Mac não é refeita.
- [x] 2.2 Repetir a conferência estrutural do Windows (D6) com a configuração nova: `npx electron-builder --win dir --x64` com a saída numa pasta temporária, fora de `release/`. Conferir:
  - `win-unpacked/Buteco Chat.exe` e só o `app.asar` em `resources/`;
  - o asar só com `out/`;
  - o grupo de ícones do `.exe` de 16 a 256 px com a arte do app, lido com o `resedit`;
  - `ProductName` "Buteco Chat".

  Registrar o resultado aqui. O `.exe` não é executado.

  **Resultado (2026-10-25, macOS 15 x64, electron-builder 26.18.0, Electron 45.0.0, com `build.win.target: "dir"`):** geração com código 0, sem Wine. Log: `skipped dependencies rebuild reason=npmRebuild is set to false`, `updating asar integrity executable resource` e `no code signing certificate configured, signing is skipped`.
  - `win-unpacked/` tem `Buteco Chat.exe`, as DLLs, os `.pak`, `locales/` e só `resources/app.asar` (2.171.203 bytes);
  - o asar contém `out/` (20 entradas) e o `package.json`, que o Electron exige; não contém `node_modules`;
  - grupo de ícones 1: 16, 24, 32, 48, 64, 128 e 256 px, PNG de 32 bpp; os PNGs de 256 e 32 px mostram a arte do app;
  - `ProductName` e `FileDescription` "Buteco Chat", `FileVersion` 0.1.0, `CompanyName` "Aldovrando Oliveira".
- [x] 2.3 (Opcional, pré-conferência antes da fumaça.) Gerar o `deb` no Mac, com `npx electron-builder --linux deb --x64` e a saída numa pasta temporária. Abrir o pacote com `ar x` e `tar` e conferir:
  - em `control`: `Package: buteco-chat`, `Maintainer`, `Homepage` e `Depends`;
  - `usr/share/applications/buteco-chat.desktop` com `StartupWMClass=buteco-chat`, `Icon=buteco-chat` e `Categories=Development;`;
  - os ícones nos oito tamanhos, em `usr/share/icons/hicolor/NxN/apps/buteco-chat.png`, com a arte do quadro inteiro (o de 256 px igual a `build/icons/256x256.png`);
  - `opt/Buteco Chat/resources/apparmor-profile` e o `postinst` com a instalação do perfil.

  Se a geração falhar no Mac, registrar o motivo e seguir: o caminho suportado é gerar no Linux (D6).

  **Resultado (2026-10-25, a partir do Mac):** geração com código 0 (`fpm` 1.17.0 baixado pelo electron-builder), sem o aviso de `desktopName`. `buteco-chat_0.1.0_amd64.deb` com 102 MB.
  - `control`: `Package: buteco-chat`, `Maintainer` com nome e e-mail, `Homepage` do GitHub e `Depends` com as nove padrão (Context do design). ✓
  - `buteco-chat.desktop`: `StartupWMClass=buteco-chat`, `Icon=buteco-chat`, `Categories=Development;`, `Exec="/opt/Buteco Chat/buteco-chat" %U`. ✓
  - `opt/Buteco Chat/resources/apparmor-profile` (`abi <abi/4.0>`, `userns`, `unconfined`), `postinst` com a instalação do perfil e o ajuste do `chrome-sandbox`, `postrm` com a remoção. ✓
  - **Ícones: divergem do design.** Só há `usr/share/icons/hicolor/1024x1024/apps/buteco-chat.png`, e ele é o `build/icon-mac.png` (SHA-256 igual), não o `build/icon.png`. Motivo, em `LinuxTargetHelper.computeDesktopIcons`: a fonte do ícone do Linux é `linux.icon`, senão `mac.icon`, e só depois `build.icon`; com um PNG único, o conjunto tem só esse tamanho. Decisão do usuário: ícone próprio do Linux em `build/icons/` (tarefa 1.5).

  **Nova rodada (2026-10-25, com `build.linux.icon: "build/icons"`):** geração com código 0, sem avisos. `control`, `.desktop`, perfil AppArmor e `postinst` iguais aos da primeira rodada. O pacote instala os oito tamanhos em `usr/share/icons/hicolor/NxN/apps/buteco-chat.png` (16 a 512), e nada mais em `hicolor`; cada um é idêntico, byte a byte, a `build/icons/NxN.png`, inclusive o de 256 px. ✓

## 3. README

- [x] 3.1 Seção "Empacotamento" (D11):
  - um parágrafo comum: `npm run package` gera para o sistema e a arquitetura locais, no próprio sistema, sem assinatura, sem notarização e sem auto-update;
  - subseções **macOS**, **Linux (Ubuntu)** e **Windows**.

  Em cada subseção:
  - os pré-requisitos;
  - o resultado em `release/`;
  - como abrir pelo terminal;
  - como liberar o app não assinado;
  - a pasta de dados.

  A subseção do macOS reúne o que já existe: o caminho do `.app`, o comando do terminal, a linha do `IMKCFRunLoopWakeUpReliable` e o `xattr -cr`.
- [x] 3.2 Subseção **Linux (Ubuntu)** (D1–D4, D7, D8):
  - Node 22.12 ou mais novo pelo `nvm` ou pela NodeSource (o `nodejs` do `apt` é antigo demais), `git` e `npm`. Nenhum pacote de compilação;
  - resultado: `release/buteco-chat_0.1.0_amd64.deb` (`arm64` em máquinas ARM);
  - instalar com `sudo apt install ./release/buteco-chat_*.deb`, atualizar com o mesmo comando e remover com `sudo apt remove buteco-chat`;
  - abrir pelo lançador ou pelo terminal com `buteco-chat`;
  - por que é um instalador: o perfil AppArmor do sandbox no Ubuntu 24.04+ e o `.desktop` do ícone no Wayland, em duas frases, com a orientação de não usar `--no-sandbox`;
  - `release/linux-unpacked/` não serve para abrir o app no Ubuntu 24.04+;
  - em `npm run dev` numa sessão Wayland, o painel mostra o ícone genérico (D2).
- [x] 3.3 Subseção **Windows**, começando com a linha de **não verificada** (cenário 'Windows não verificado') (D5, D7):
  - Node 22.12 ou mais novo e `npm`;
  - resultado: `release\win-unpacked\Buteco Chat.exe` (`win-arm64-unpacked` em ARM);
  - abrir pelo terminal com `& "release\win-unpacked\Buteco Chat.exe"` no PowerShell;
  - SmartScreen: só com Mark-of-the-Web ("Mais informações" → "Executar assim mesmo", ou `Unblock-File`). Gerado na própria máquina, ele não aparece.
- [x] 3.4 Pasta de dados: uma tabela com os três sistemas, empacotado e dev, pelo `app.getPath('userData')` (D7):
  - colocada na seção "Empacotamento";
  - a seção "Histórico de conversas" passa a apontar para ela, em vez de citar só o caminho do macOS;
  - o parágrafo da instância única deixa de citar só o macOS;
  - como apagar o histórico em cada sistema, lembrando que remover o `deb` não apaga `~/.config/Buteco Chat`.
- [x] 3.5 Pré-requisitos gerais:
  - a linha do `electron-winstaller` fica como está;
  - a do `fsevents` passa a dizer que o aviso só aparece no macOS.

- [x] 3.6 **Parada para a revisão do usuário**, antes de entregar o roteiro da fumaça: o diff do `package.json`, do README, dos testes e do gerador de ícones, com o resultado das conferências 2.1, 2.2 e 2.3. Só seguir para a seção 4 com a revisão aprovada.

  **Encerrada em 2026-11-08:** o usuário decidiu fechar a change sem a fumaça no Ubuntu (D12).
- [x] 3.7 Seção do Linux no README começando com a marca de **não verificada**, como a do Windows (D12, cenário 'Linux não verificado').

## 4. Fumaça no Linux (feita pelo usuário)

> **Não realizada (2026-11-08):** a fumaça no Linux foi adiada por decisão do usuário, e a change foi arquivada sem ela (D12). O roteiro abaixo fica registrado para a primeira rodada, numa change futura.

- [x] 4.1 Roteiro, a partir de um Ubuntu sem o projeto:
  1. **Pré-requisitos**:
     - `sudo apt install git curl`;
     - instalar o `nvm` (instruções em github.com/nvm-sh/nvm), abrir um terminal novo e rodar `nvm install 22`;
     - conferir com `node --version` (22.12 ou mais novo) e `npm --version`.
  2. `git clone git@github.com:aldovrando-oliveira/buteco-chat.git && cd buteco-chat`, ou o endereço `https://`.
  3. `npm install`. Os avisos do `allowScripts` sobre o `electron-winstaller` são esperados e o script não deve ser aprovado.
  4. `npm run package 2>&1 | tee package.log`. Conferir que `release/` tem `buteco-chat_0.1.0_<arquitetura>.deb`.
  5. `sudo apt install ./release/buteco-chat_*.deb`. A saída não pode ter erro de dependência.
  6. Abrir pelo terminal com `buteco-chat 2>&1 | tee app.log`, **sem** `--no-sandbox`.
  7. Itens a conferir (spec 'Teste de fumaça do pacote'):
     - a janela abre sem o erro do `chrome-sandbox` e sem flash branco;
     - o ícone do app aparece no painel (dock do Ubuntu) enquanto ele está aberto, do tamanho dos vizinhos, e no lançador ("Mostrar aplicativos", buscando "Buteco");
     - a tela de login aparece com as fontes Plex;
     - o login funciona com o endereço da plataforma digitado na tela (a plataforma precisa estar acessível dessa máquina, por exemplo pelo IP da máquina que roda o `apps/api`);
     - a conversa com um agente recebe resposta;
     - o histórico continua depois de fechar e reabrir o app;
     - a barra de status mostra o endereço e o tempo de sessão;
     - os temas claro e escuro funcionam, trocando em Configurações → Aparência com o app aberto, e o esquema escuro não mostra janela clara ao abrir;
     - pelo DevTools (Ctrl+Shift+I), `window.buteco` existe, `window.open('https://example.com')` e `location.href = 'https://example.com'` abrem o navegador sem navegar o app, e `location.href = 'file:///etc/hosts'` não tem efeito;
     - nenhuma violação de CSP no `app.log` nem no console;
     - a pasta de dados existe: `ls -la ~/.config/"Buteco Chat"/"Local Storage"`.
  8. **O que mandar de volta**:
     - `cat /etc/os-release`, `echo $XDG_SESSION_TYPE` e `uname -m`;
     - os avisos do `npm run package` (`package.log`);
     - a saída do `apt install`;
     - `app.log`;
     - `grep -E 'StartupWMClass|Icon|Categories' /usr/share/applications/buteco-chat.desktop` e `ls /etc/apparmor.d/buteco-chat`;
     - a lista dos itens do passo 7, com o que passou e o que falhou (e um print, se o ícone não aparecer).
- [x] 4.2 Registrar aqui o resultado da fumaça: a versão do Ubuntu, a sessão, a arquitetura e os itens. Se algo falhar, corrigir, atualizar o README e o design e pedir uma nova rodada. A change só fecha com a fumaça aprovada.

  **Resultado:** não testado. A regra "a change só fecha com a fumaça aprovada" foi dispensada pelo usuário em 2026-11-08; o Linux segue como não verificado no README e no spec (D12).

## 5. Fechamento

- [x] 5.1 Revisar o README do zero, como alguém que só tem o repositório, nos três sistemas, e conferir que a seção do Windows começa com a marca de não verificada. A do Linux também começa com ela (D12).
- [x] 5.2 `openspec validate empacotamento-linux-windows --strict`, sync revisado dos specs e arquivamento. Nada é commitado durante a change; o único commit vem depois do arquivamento, quando o usuário pedir.
