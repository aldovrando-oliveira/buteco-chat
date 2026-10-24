## Why

O repositório só tem o OpenSpec configurado. As changes seguintes (`login-operador`, `conversa-a2a`, `historico-conversas`, `sessao-expirada`) precisam de uma base já pronta: um app Electron com a janela endurecida, a fronteira main ↔ renderer definida, o tema visual da plataforma e os scripts de dev, teste e empacotamento. Fazer isso primeiro, numa change separada, permite revisar as decisões de segurança e de ferramental isoladamente, antes que qualquer código de HTTP ou de autenticação exista.

## What Changes

- Estrutura do projeto Electron + React 19 + TypeScript estrito com `electron-vite` 6 (main, preload e renderer), usando npm.
- Janela segura: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, permissões negadas, `<webview>` bloqueado, sem flash branco ao abrir (`backgroundColor` conforme o tema do sistema + `ready-to-show`).
- Política de navegação: `will-navigate` e `setWindowOpenHandler` negam tudo. URLs `http:`/`https:` são entregues a `shell.openExternal`. Qualquer outro esquema é descartado.
- CSP restritiva em `<meta>` no build de produção (`connect-src 'none'`: o renderer não tem como fazer HTTP), com uma CSP de desenvolvimento separada, aplicada só no `dev`.
- Preload em CJS, num arquivo único, compatível com sandbox, expondo `window.buteco` via `contextBridge`. Nesta change o objeto exposto é vazio: os tipos completos do contrato ficam em `src/shared/api.ts`, e cada change seguinte expõe só o que implementar.
- Utilitário de IPC no main que registra handlers validando o remetente (frame principal da janela do app, URL esperada do renderer). Nenhum canal é registrado nesta change.
- Encaminhamento das mensagens de console do renderer para o stdout do main, para que violações de CSP fiquem visíveis no app empacotado.
- Tema Mantine 9 com a identidade Buteco: escalas de cor, tipografia, raios, fundo da página próprio, `primary` preenchido com tom 6 no escuro, `prefers-color-scheme`. Fontes IBM Plex Sans e Mono empacotadas via `@fontsource` (subset latin), sem nenhum asset embutido como `data:`.
- Tela-casca com a marca "Buteco Chat", para validar tema, fontes e CSP.
- Vitest com dois projetos (`main` em node, `renderer` em jsdom + Testing Library), incluindo testes da política de navegação, da validação de remetente do IPC e de contraste do tema.
- Empacotamento local com `electron-builder`, só para o sistema operacional da máquina de desenvolvimento, sem assinatura.
- `README.md` (como rodar, testar, empacotar; `xattr -cr` no macOS) e `.gitignore` (`node_modules/`, `out/`, `dist/`, `release/`).

## Capabilities

### New Capabilities
- `janela-segura`: configuração de segurança da janela, política de navegação e de abertura de janelas, permissões, CSP de produção e de desenvolvimento.
- `ponte-preload`: preload em sandbox, objeto `window.buteco` exposto via `contextBridge`, tipos compartilhados do contrato e validação de remetente nos handlers IPC.
- `identidade-visual`: tema Mantine com as cores, fontes, tamanhos e raios da plataforma, esquemas claro/escuro, fundo da página, contraste mínimo e tela-casca.
- `empacotamento-local`: scripts de dev, teste, build e empacotamento para o SO local, e o teste de fumaça do pacote.

### Modified Capabilities
<!-- Nenhuma: não há specs existentes em openspec/specs/. -->

## Impact

- **Código novo**: `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`, `electron.vite.config.ts`, `vitest.config.ts`, tsconfigs, configuração do `electron-builder`.
- **Dependências novas**: `electron`, `electron-vite`, `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `electron-builder`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `typescript`. `react-markdown`/`remark-gfm` ficam para `conversa-a2a`.
- **Nenhuma integração com a plataforma Buteco Agentes** nesta change: nenhuma rota HTTP, nenhum token, nenhum IPC de negócio.
- **Contrato inicial**: `src/shared/api.ts` declara os tipos `ButecoApi`, `Result`, `ChatError`, `AgentSummary` e `TaskState` conforme o documento de construção. É o contrato de partida, não um contrato congelado. Uma change seguinte pode alterá-lo (por exemplo, o namespace de área de transferência previsto em D8), desde que registre a alteração e o motivo no seu próprio `design.md`.
