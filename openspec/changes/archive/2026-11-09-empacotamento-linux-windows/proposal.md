## Why

Hoje o app só é empacotado e documentado para o macOS:
- o `package.json` só tem o bloco `build.mac` (`target: "dir"`, sem assinatura);
- o spec "Empacotamento para o sistema local" fala só do SO da máquina de desenvolvimento;
- o README só explica o Mac.

No Linux e no Windows, o `electron-builder` usaria os alvos padrão dele (AppImage e instalador NSIS), que ninguém conferiu. No Ubuntu 24.04 ou mais novo, o AppImage nem abre: o sandbox do Chromium aborta. O objetivo é poder gerar e usar o app também no Linux e no Windows, documentado, sem assinatura, sem notarização e sem auto-update, como no Mac.

## What Changes

- **Linux: pacote `deb`** (`build.linux`):
  - `target: "deb"`, `category: "Development"`, `executableName: "buteco-chat"`, `maintainer`, `syncDesktopName: true` e `icon: "build/icons"`, com os oito tamanhos do `hicolor` gerados por `npm run icons` da mesma geometria, no quadro inteiro (sem `linux.icon`, o electron-builder usaria o `mac.icon`, com a margem do macOS);
  - na raiz do `package.json`, `desktopName: "buteco-chat.desktop"` e `homepage` com o repositório do GitHub.

  O `deb` instala o perfil AppArmor que o sandbox do Chromium exige no Ubuntu 24.04+ e o `.desktop` que liga a janela ao ícone no Wayland. É o primeiro alvo com instalador. A quebra de simetria com o Mac é deliberada e está registrada no design.
- **Windows: pasta `dir`** (`build.win`): `release/win-unpacked/Buteco Chat.exe`, como no Mac, sem instalador e sem `portable`. A configuração e a documentação entram, mas a seção do README fica marcada como **não verificada**: ninguém roda o app no Windows nesta change. O `win-unpacked` é gerado uma vez a partir do Mac só para conferir a estrutura e o ícone do `.exe`.
- **macOS**: sem mudança de configuração.
- **Caminho suportado: cada sistema gera o próprio pacote.** Gerar o do Windows a partir do Mac funciona, porque o electron-builder 26 grava o ícone com o `resedit`, em JS puro, mas não é o caminho documentado.
- **README**, na seção de empacotamento, por sistema:
  - pré-requisitos;
  - o comando e onde fica o resultado em `release/`;
  - como abrir pelo terminal;
  - como liberar o app não assinado: `xattr -cr` no macOS, SmartScreen só quando o `.exe` tem Mark-of-the-Web no Windows, instalação com `apt` no Linux;
  - a pasta de dados de cada sistema, pelo `app.getPath('userData')`, com a variante `(dev)`.

  A linha do `electron-winstaller` fica. A do `fsevents` passa a dizer que vale só no macOS.
- **Testes de configuração** em `tooling/app-icon.test.ts`: os alvos de Linux e Windows, o ícone próprio do Linux em `build/icons/`, o do Windows herdado de `build.icon`, `desktopName` com `syncDesktopName`, `maintainer` preenchido e `publish: null`.
- **Fumaça no Linux**: um roteiro para o usuário seguir sozinho no Ubuntu, a partir de `git clone`. A change só fecha depois dela.

## Capabilities

### New Capabilities
Nenhuma.

### Modified Capabilities
- `empacotamento-local`:
  - "Empacotamento para o sistema local": descreve os três sistemas, com o alvo de cada um (`dir` no macOS e no Windows, `deb` no Linux), e a regra de gerar cada pacote no próprio sistema;
  - "Teste de fumaça do pacote": sai "a casca", a tela provisória removida na `login-operador`, e entram a tela de login e a de conversas. O teste passa a valer por sistema, com os itens do Linux, e o Windows fica sem fumaça até haver quem teste;
  - "Arquivos ignorados e documentação": o README explica, para os três sistemas, como gerar, abrir e liberar o app não assinado, e onde ficam os dados.

## Impact

- **Código alterado**:
  - `package.json`: `homepage`, `desktopName`, `build.linux` e `build.win`. `build.mac`, `build.icon`, `npmRebuild: false` e `publish: null` não mudam;
  - `tooling/app-icon.test.ts`: as verificações de configuração;
  - `README.md`.
- **Sem mudança**: código do main, do preload e do renderer, CSP, IPC, contrato da API e dependências (o `electron-builder` 26.18 já gera `deb` e `dir` do Windows).
- **E-mail do mantenedor**: só em `build.linux.maintainer`, e em nenhum outro arquivo do repositório.
- **Fora do escopo**:
  - assinatura de código (Windows e macOS), notarização, auto-update, publicação de releases e lojas;
  - CI, inclusive um workflow do GitHub Actions para gerar o pacote do Windows, que fica como melhoria futura no design;
  - AppImage, `rpm`, `snap`, Flatpak, instalador NSIS e `portable`.
