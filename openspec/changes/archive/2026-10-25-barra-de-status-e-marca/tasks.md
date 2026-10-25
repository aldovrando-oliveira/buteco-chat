## 1. Origem da marca e peças geradas

- [x] 1.1 Copiar com `cp`, sem edição, `../buteco-agents/apps/frontend/public/app-icon.svg` para `assets/brand/app-icon.svg` (D6). Conferir que o SHA-256 é `b6f1d18ba292fb2a9a910897196f2335a617d3049393f8ce98793348fa0ce228` e que é igual a `docs/marca/app-icon.svg` do mesmo commit.
- [x] 1.2 Escrever `assets/brand/README.md` (D6), com:
  - origem `buteco-agents@58553b6` (2026-09-13) e caminho `apps/frontend/public/app-icon.svg`, igual a `docs/marca/app-icon.svg`;
  - o SHA-256;
  - a regra do C2PA (não editar; revisão nova substitui o arquivo, atualiza o registro e pede `npm run icons`);
  - o que deriva do arquivo;
  - a seção "Correção local" (D12: o que muda e onde está);
  - as regras do manual que valem aqui (mínimo de 24 px, sem sombra).
- [x] 1.3 `npm install -D @resvg/resvg-js`. Conferir que o pacote não tem script de instalação. No `README.md` do projeto, acrescentar o `fsevents`, cujo script também não deve ser aprovado, junto da linha do `electron-winstaller`.
- [x] 1.4 `src/shared/app-icon-geometry.ts` (D5, D12): módulo puro, sem React, com `viewBox`, `rect`, as duas transformações, os caminhos com `fill-rule` e as cores `#2a6ecb` e `#ffffff`. A asa direita da gravata vem invertida (`M366 326V402Q366 416 352 416L276 382V346L352 312Q366 312 366 326Z`), com um comentário que explica a correção e aponta para D12. Todo o resto é igual ao arquivo.
- [x] 1.5 `tooling/app-icon.ts` (D7):
  - funções puras que montam, **a partir das constantes de `src/shared/app-icon-geometry.ts`** e sem C2PA, o SVG de quadro inteiro e o do macOS (`<svg x="100" y="100" width="824" height="824" viewBox="0 0 1024 1024">` com a arte, num quadro transparente de 1024, sem sombra nem filtro);
  - renderização em 1024 com `@resvg/resvg-js`;
  - escrita de `build/icon.png` e `build/icon-mac.png` só quando executado como script.

  Em `package.json`, o script `"icons": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tooling/app-icon.ts"`, `build.icon: "build/icon.png"` e `build.mac.icon: "build/icon-mac.png"`. Para o import com extensão `.ts`, `allowImportingTsExtensions` no `tsconfig.node.json`. Rodar `npm run icons` e conferir os dois PNGs a olho, abrindo os arquivos.
- [x] 1.6 Testes no projeto `main`.

  `src/shared/app-icon-geometry.test.ts` (padrão do `page-background.test.ts`, com `node:fs` e expressões regulares simples):
  - o arquivo contém exatamente o subcaminho original da asa direita;
  - as constantes são iguais ao arquivo em `viewBox`, `rect` (`x`, `y`, `width`, `height`, `rx`, `ry`, `fill`), nos dois `transform` e no `d`, no `fill` e no `fill-rule` dos dois caminhos, exceto a asa direita, que é o subcaminho corrigido.

  Conferir por mutação que o teste falha com um `d` alterado.

  `tooling/app-icon.test.ts`:
  - SHA-256 de `assets/brand/app-icon.svg` igual ao do README, e o arquivo contém `<c2pa:manifest>`;
  - `build/icon.png` e `build/icon-mac.png` com assinatura PNG e IHDR de 1024×1024;
  - `package.json` com `build.icon` e `build.mac.icon` apontando para eles;
  - o SVG montado tem a asa invertida e não tem `metadata` nem `c2pa`;
  - o SVG do macOS tem o `<svg x="100" y="100" width="824" height="824">` com a arte e nenhum `filter`;
  - rasterizado em 1024 px com `@resvg/resvg-js`, o pixel (550, 701) do SVG montado é branco e o do arquivo original é `#2a6ecb`, com tolerância pequena de cor.

## 2. Ícone em dev (main)

- [x] 2.1 `createMainWindow(preloadPath, options?: { icon?: string })` em `security/window.ts`: o `icon` só entra nas opções do `BrowserWindow` quando é passado (D8). Testar com e sem `icon` em `window.test.ts`.
- [x] 2.2 Em `index.ts`, com `!app.isPackaged`:
  - caminhos `build/icon.png` e `build/icon-mac.png` a partir de `app.getAppPath()`;
  - `app.dock?.setIcon` com o do macOS no `whenReady`;
  - `createMainWindow` com o `icon` da janela.

  Empacotado, nenhum dos dois. Testes em `index.test.ts` com `isPackaged` falso e verdadeiro.

## 3. Componente do ícone e marca (renderer)

- [x] 3.1 `components/AppIcon.tsx` (D5), que importa a geometria de `src/shared/app-icon-geometry.ts`:
  - `<svg>` inline com `width`/`height` = `Math.max(24, size)`;
  - `aria-hidden="true"` e `focusable="false"`;
  - sem `role`, `aria-label` nem `<title>`;
  - cores literais.
- [x] 3.2 Mover `auth/Brand.tsx` para `components/Brand.tsx` e trocar o `IconMessageCircle` pelo `AppIcon`: 32 px com gap de 8 e texto de 16 no login; 24 px com gap de 6 e texto de 14 no modo compacto. Atualizar os imports do `LoginScreen` e do `Sidebar`.
- [x] 3.3 Testes do `AppIcon` no renderer (`identidade-visual`, 'Ícone do app na interface'), sem ler arquivo:
  - `viewBox`, `rect`, `transform` e caminhos iguais às constantes de `src/shared/app-icon-geometry.ts`;
  - tamanho 16 → 24 e 32 → 32;
  - `fill` literal nos esquemas claro e escuro, sem `var(`;
  - `aria-hidden="true"` e `focusable="false"`, sem `role` nem `aria-label`.
- [x] 3.4 Testes da marca nas telas:
  - as duas telas de login com o ícone de 32 px antes de "Buteco" e "Chat";
  - a barra lateral com o de 24 px;
  - nenhuma das três com ícone de balão;
  - nenhum `<img>` e nenhum atributo com `data:` no login nem na tela de conversas.

  Ajustar o cenário "Marca" em `screens.test.tsx`.

## 4. Barra de status e rodapé da barra lateral (renderer)

- [x] 4.1 `conversation/StatusBar.tsx` (D1):
  - `<footer aria-label="Barra de status">`, sem `role`;
  - o relógio e o cálculo dos minutos trazidos do `SessionFooter` sem mudar a regra (`TICK_MS`, reinício no `expiresAt` novo, `onExpired` ao chegar a zero);
  - à esquerda, `IconServer` e o `serviceUrl` em mono, truncado, com `title`;
  - à direita, `IconClock` e "Sessão válida por mais {n} min", ou `IconLock` e "Sessão expirada" em `--mantine-color-red-text`, peso 500;
  - ícones de 12 px, a 6 px do texto.
- [x] 4.2 `global.css`:
  - `.buteco-conversation` em coluna de `100vh`;
  - `.buteco-workspace` com a linha atual (`flex: 1`, `min-height: 0`) e a media query de 860 px;
  - `.buteco-statusbar` com 26 px, `flex-shrink: 0`, padding de 0×12, gap de 16, `--mantine-color-body`, borda superior, 11 px e `--mantine-color-dimmed`;
  - grupo da esquerda com `min-width: 0` e grupo da direita sem encolher.

  `ConversationScreen` passa a renderizar `.buteco-workspace` (`Sidebar` + `main`) e a `StatusBar`, com `expired` e `onExpired={chat.expire}`.

  Em `src/shared/sidebar-css.test.ts` (projeto `main`, porque o jsdom não aplica o CSS):
  - `.buteco-conversation` em coluna;
  - `.buteco-statusbar` com `height: 26px` e `flex-shrink: 0`;
  - na media query de 860 px, a coluna fica na `.buteco-workspace`, e a `.buteco-statusbar` não tem `display: none`.
- [x] 4.3 `SessionFooter` (D2):
  - só avatar de 30 px, nome em peso 500 truncado, gap de 10 e **Sair**, com padding 8×14;
  - saem `expired`, `onExpired`, o relógio e `parseServiceUrl`;
  - `Sidebar` deixa de repassar `onExpired` ao rodapé e mantém `expired` para o bloqueio do seletor e de **Nova conversa**.
- [x] 4.4 Testes da barra (`conversa`, 'Barra de status'):
  - endereço completo no texto e no `title`, com nome acessível "Barra de status" e sem `role="status"`;
  - endereço longo sem abreviação no texto;
  - "Sessão válida por mais 30 min";
  - zero → cadeado e "Sessão expirada" com `--mantine-color-red-text`, banner, sem `status()` nem `logout()`;
  - minutos do `expiresAt` novo depois do novo login;
  - fundo `--mantine-color-body` e texto `--mantine-color-dimmed` (D10);
  - ausente nas duas telas de login;
  - depois da barra lateral e da área principal, fora das duas.
- [x] 4.5 Testes do rodapé (`conversa`, 'Rodapé de sessão'):
  - avatar "AN", "ana" e **Sair**;
  - sem `localhost:5017` nem "Sessão válida…";
  - `joana_carvalho` inteiro no texto;
  - **Sair** e conversas mantidas como hoje.
- [x] 4.6 Atualizar os testes existentes que procuram o tempo, o host ou "Sessão expirada" no rodapé (`conversation.test.tsx`, `history.test.tsx`, `App.test.tsx`): passam a procurar dentro da barra de status. As regras da `sessao-expirada` continuam testadas com o mesmo comportamento.

## 5. Cabeçalho da conversa (renderer)

- [x] 5.1 Módulo neutro `src/renderer/src/format/dates.ts` com `formatTime`, `daysAgo` e `dayMonth(ms, now)` (`dd mmm`, com o ano quando ele é outro), testado em `format/dates.test.ts`. `conversation/format.ts`, `history/list-format.ts` e os blocos da timeline importam dele, e nenhum importa o outro (sem ciclo). O `itemTime` passa a usar o `dayMonth`, e os testes da lista continuam passando sem alteração.
- [x] 5.2 `startedLabel(sentAt, now)` em `conversation/format.ts` (D3):
  - "Iniciada hoje às HH:mm" (inclusive para data futura);
  - "Iniciada ontem às HH:mm";
  - "Iniciada em {dayMonth} às HH:mm".

  Remover `abbreviateContextId` e o teste dele. Testes em `format.test.ts` para hoje, ontem, 20 out, 15 out 2025, futuro e dia com horário de verão.
- [x] 5.3 `ConversationHeader` (D3, D4):
  - recebe `startedAt: number | null` (`turns[0]?.sentAt ?? null`) e mostra `startedLabel` ou "Ainda sem mensagens" em 12 px e cor secundária;
  - com `contextId`: "·" com `aria-hidden` e **Copiar ID** (11 px, `aria-label="Copiar ID da conversa"`, `title` com o ID completo), gap de 6;
  - região `VisuallyHidden` sempre montada, com `aria-live="polite"`, que recebe "ID copiado" e é limpa depois de `COPIED_MS`;
  - sai o texto "contextId" e o valor abreviado.
- [x] 5.4 Testes do cabeçalho (`conversa`, 'Cabeçalho da conversa' e 'Copiar o ID da conversa'), com timers falsos e data fixa em 24/10/2026:
  - "Ainda sem mensagens" sem "·" nem **Copiar ID**;
  - hoje às 14:32 com **Copiar ID** e `title`;
  - ontem às 09:05, em 20 out às 18:40 e em 15 out 2025 às 14:32;
  - primeiro envio sem `contextId`: "Iniciada…" sem **Copiar ID**;
  - nenhum "contextId", `3a7d9f10` nem `4e5f` no texto visível;
  - **Copiar ID** → `clipboard.writeText` com o ID completo, "Copiado", região com "ID copiado", e depois de 1,5 s "Copiar ID" e região vazia;
  - **Copiar ID** disponível na sessão expirada.
- [x] 5.6 Conversa vazia: a nota passa a "A conversa entra no histórico depois da primeira mensagem." (delta MODIFIED em "Conversa vazia", D11 #7), com teste de que nenhum texto visível da tela contém "contextId", vazia ou depois do envio.
- [x] 5.5 Atualizar os testes que esperam o ID abreviado ou "Copiar" (`conversation.test.tsx` e o cenário "Trocar de conversa durante o envio" em `history.test.tsx`): passam a conferir o `title` de **Copiar ID**.

## 6. Verificação

- [x] 6.1 Rodar `npm run typecheck`, `npm test`, `npm run build` e `npm run test:build`
- [x] 6.2 Atualizar o `README.md`:
  - script `icons`;
  - `assets/brand/` e `build/` na árvore de pastas, e `tooling/` passa a citar o gerador de ícones;
  - a regra de origem do ícone.
- [x] 6.3 Parar para a revisão do código pelo usuário
- [x] 6.4 Fumaça em dev, manual, feita pelo usuário (parar, deixar o dev rodando e entregar o roteiro):
  - o ícone no Dock em dev, com margem, ao lado de outros apps;
  - o mesmo ícone no login (32 px) e na barra lateral (24 px), nos dois esquemas;
  - a barra de status nos dois esquemas, com sessão válida e expirada (TTL de 2 min na plataforma);
  - o nome do usuário inteiro no rodapé;
  - "Iniciada…" e **Copiar ID** com o VoiceOver anunciando "ID copiado";
  - a janela estreita em 720×520 e em 859×700 (D9). Se 720×520 ficar ruim: lista a 25vh; se ainda não couber, `minHeight` 600, com delta nos specs. Registrar a medição e o passo aplicado aqui.
  - **Resultado (1ª rodada):** A1 a E4 ok; E5 não verificado, por falta de conversa de dias anteriores (coberto por `startedLabel` e `dates.test.ts`). F1, em 720×520: barra lateral 374, principal 120, cabeçalho 66, barra 26, ou seja, 54 px para timeline e composer, ruim. F2, em 859×700: principal 246, ou seja, 180 px, ok.
  - **Passo aplicado:** os passos 2 e 3 juntos (D9): lista a 25vh na largura estreita e `minHeight` 600, com o delta de 25% em "Layout da tela de conversas". Projeção em 720×600: 140 px para timeline e composer. Falta medir de novo F1 (720×600) e F2 (859×700).
  - **Resultado (2ª rodada):** F1, em 720×600: barra lateral 368, principal 206, cabeçalho 66, barra 26, ou seja, 140 px, como projetado. F2, em 859×700: barra lateral 393, principal 281, ou seja, 215 px. Nos dois tamanhos, o composer e o cabeçalho ficam visíveis, mas sobra pouco da timeline para ler a conversa. **Limitação aceita pelo usuário** nesta change: a largura estreita passa a ser tratada na próxima change, por exemplo com a barra lateral recolhida num menu de hambúrguer (D9).
  - O erro de `worker-src` no console do dev vem do cliente do Vite (ping do HMR por `SharedWorker` em `blob:`) e não desta change; a CSP de dev fica como está, com uma nota no README.
- [x] 6.5 Fumaça no app empacotado (`npm run package`), manual, feita pelo usuário:
  - o ícone do app no Finder e no Dock, do tamanho dos vizinhos, sem o ícone do Electron;
  - se parecer "colado" por falta de sombra, registrar para revisitar (D7);
  - a barra de status e a marca;
  - nenhuma violação de CSP no console nem no stdout.
  - **Resultado:** ícone no Finder, no Dock e no ⌘Tab ok, do tamanho dos vizinhos e sem o do Electron; sem sombra, o ícone não parece "colado" (D7 fica como está); marca, barra de status (válida, expirada e novo login) e nenhuma violação de CSP ok.
- [x] 6.6 Fechamento sem commits intermediários:
  - `/opsx:sync` e revisão dos specs pelo usuário;
  - `/opsx:archive` sem reaplicar os deltas;
  - conferir que `openspec/specs/` não mudou no arquivamento;
  - conferir que entram `assets/brand/` e `build/icon*.png`, e que nada de `out/`, `release/` ou `node_modules/` entra;
  - um único commit `feat: barra de status e ícone do app (barra-de-status-e-marca)`, só com autorização explícita.
