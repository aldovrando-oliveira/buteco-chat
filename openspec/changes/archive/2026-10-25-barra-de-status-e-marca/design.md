## Context

Change de ajustes de interface depois do fatiamento original. O protótipo aprovado é um canvas no claude.ai, sem cópia no disco, com as telas Login, Login — acessos seguintes, Conversas e Ícone do app. As medidas que o texto da exploração não trazia foram passadas depois, na revisão, e estão transcritas nos requisitos e em D11.

Estado atual relevante:
- **`SessionFooter.tsx`** concentra três coisas no rodapé da barra lateral:
  - avatar e "{usuário} @ {host}";
  - o relógio: `setTimeout` de 1 s, `onExpired` ao chegar a zero, e o relógio reinicia quando o `expiresAt` muda (sessao-expirada, D1);
  - o texto do tempo ou "Sessão expirada".

  Como o relógio vive dentro do `Sidebar`, a barra lateral inteira renderiza a cada segundo.
- **`ConversationHeader.tsx`** mostra "contextId", o valor abreviado (`abbreviateContextId`) e o botão **Copiar**, que chama `window.buteco.clipboard.writeText` e fica "Copiado" por 1,5 s (`COPIED_MS`).
- **`Conversation.createdAt`** é a hora em que o **rascunho** foi criado (`use-conversation.ts`), não a do primeiro envio. O primeiro envio é `turns[0].sentAt`.
- **`history/list-format.ts`** já formata `dd mmm` com uma tabela fixa de meses sem ponto e o ano só quando é outro (historico-conversas, D16).
- **`auth/Brand.tsx`** desenha um balão de conversa (`IconMessageCircle`) na cor primária, usado no login (24 px) e na barra lateral (18 px).
- **Layout** (`global.css`): `.buteco-conversation` é uma linha de `100vh`. Abaixo de 860 px vira coluna, e a lista fica com `max-height: 30vh`. A janela tem `minWidth` 720 e `minHeight` 520 (`security/window.ts`); D9 passa o mínimo para 600 e a lista para 25vh.
- **Empacotamento**: `package.json` sem `build.icon`, e o pacote sai com o ícone padrão do Electron. O `files: ["out/**/*"]` já deixa `build/` fora do asar, e `build/` é o `buildResources` padrão do electron-builder.
- **CSP de produção**: `img-src 'self'`, sem `data:`. O build tem `assetsInlineLimit: 0`, e o `test:build` confere que nenhum JS ou CSS tem `data:`.
- **Marca da plataforma** (`buteco-agents@58553b6`, de 2026-09-13):
  - `apps/frontend/public/app-icon.svg` é idêntico, byte a byte, a `docs/marca/app-icon.svg`;
  - 1024×1024, um `rect` com `rx=232` em `#2a6ecb` e dois `path` brancos dentro de `translate(302 232) scale(1.75)` → `translate(-136 -96)`;
  - cerca de 800 bytes de geometria e 7,8 KB de manifesto C2PA (`<metadata><c2pa:manifest>`);
  - o arquivo traz `role="img"` e `aria-label="Buteco Agentes"`, o nome da plataforma;
  - o `MANUAL.md` diz que abaixo de 24 px a gravata some, e proíbe sombra, gradiente e contorno.

```
┌─ .buteco-conversation (coluna, 100vh) ──────────────────────────┐
│ ┌─ .buteco-workspace (linha; coluna abaixo de 860; flex 1) ───┐ │
│ │ ┌─ aside 288 ──────┐ ┌─ main ──────────────────────────────┐│ │
│ │ │ [■] Buteco Chat  │ │ título                              ││ │
│ │ │ AGENTE [select]  │ │ Iniciada hoje às 14:32 · ⧉ Copiar ID││ │
│ │ │ [+ Nova conversa]│ ├─────────────────────────────────────┤│ │
│ │ │ busca / lista    │ │ Timeline                            ││ │
│ │ │ ──────────────── │ │ (banner) / Composer                 ││ │
│ │ │JC joana_carvalho⎋│ │                                     ││ │
│ │ └──────────────────┘ └─────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────┘ │
│ <footer aria-label="Barra de status">  26 px, borda superior    │
│  ▤ https://agentes.exemplo.com.br/…      ⏱ Sessão válida por …  │
└─────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Endereço completo e tempo de sessão sempre legíveis, numa barra de status no rodapé da janela.
- Nome do usuário sem truncamento no rodapé da barra lateral.
- Cabeçalho da conversa sem termos de protocolo, com a data de início e **Copiar ID**.
- Um único ícone do app em todos os lugares: o pacote, a janela em dev, o login e a barra lateral.
- O SVG oficial guardado intacto, com a origem registrada, e todas as outras peças derivadas dele.
- Fidelidade ao protótipo, com as divergências registradas em D11.

**Non-Goals:**
- Mudar a regra da sessão expirada, do contador ou da retomada (`sessao-expirada`). Só muda o componente que mostra e conta.
- Nome "Electron" no Dock em dev.
- Ícone `.icon` do Icon Composer para o macOS 26 (Open Questions).
- Favicon, lockups ou o símbolo solto da plataforma dentro do app.
- Atualizar "hoje"/"ontem" do cabeçalho na virada da meia-noite (D3).

## Decisions

### D1. Barra de status: estrutura e dono do relógio
- **Componente novo `conversation/StatusBar.tsx`**, renderizado pelo `ConversationScreen` depois de `.buteco-workspace`, fora do `Sidebar` e do `main`:
  - recebe `session` (`serviceUrl`, `expiresAt`), `expired` e `onExpired`;
  - assume do `SessionFooter`, sem alterar, o relógio (`TICK_MS`, o `useEffect` que reinicia no `expiresAt` novo e o `onExpired` ao chegar a zero) e o cálculo dos minutos (`Math.ceil`);
  - como só a barra renderiza a cada segundo, a barra lateral deixa de renderizar a cada tique.
- **Elemento**: `<footer aria-label="Barra de status">`, sem `role="status"`. Uma região viva anunciaria a troca de minuto o tempo todo. A sessão expirada já tem o banner com `role="alert"`.
- **Layout da barra** (`.buteco-statusbar` em `global.css`):
  - altura de 26 px, `flex-shrink: 0`, padding de 0×12 e gap de 16;
  - `background: var(--mantine-color-body)`, `border-top` com `--mantine-color-default-border`;
  - 11 px em `--mantine-color-dimmed`;
  - grupo da esquerda com `min-width: 0` e o endereço em `ff="monospace"`, `truncate="end"` e `title={serviceUrl}`;
  - grupo da direita com `flex-shrink: 0`;
  - ícones Tabler de 12 px, a 6 px do texto: `IconServer`, `IconClock` e `IconLock`.
- **O endereço mostrado é o `serviceUrl` da sessão**, já normalizado por `parseServiceUrl` no login, sem remontar a partir do host. É o mesmo valor que a tela de acessos seguintes mostra.
- **Raiz da tela**: `.buteco-conversation` vira coluna de `100vh`, com dois filhos:
  - `.buteco-workspace`, que herda o papel de linha que a raiz tinha (com `flex: 1` e `min-height: 0`) e a media query de 860 px;
  - a barra de status.

  Na largura estreita, só a `.buteco-workspace` vira coluna, e a barra continua por último. O jsdom não aplica o `global.css`. Por isso, as regras de CSS (a raiz em coluna, a `.buteco-workspace` na media query e os 26 px da barra) são conferidas por leitura do arquivo em `src/shared/sidebar-css.test.ts`, no projeto `main`, no mesmo padrão da lista a 30vh (historico-conversas, D16 #5).
- **Login**: a barra pertence ao `ConversationScreen`, então as telas de login não a montam. Nenhuma condição extra é necessária.

Alternativa descartada: guardar o relógio num hook `useSessionClock` compartilhado entre a barra e o rodapé. Só a barra precisa dele agora, e com dois consumidores voltaria a renderização por segundo da barra lateral.

### D2. Rodapé da barra lateral
O `SessionFooter` passa a ter só o avatar (30 px), o nome (peso 500, `truncate="end"`) e **Sair**, com padding 8×14 e gap de 10. O padding vertical cai de 12 para 8, como permitido na revisão, e libera 8 px na largura estreita (D9). Saem as props `expired` e `onExpired` e o import de `parseServiceUrl`. O nome do componente fica, porque o requisito continua "Rodapé de sessão" e o componente ainda é dono do **Sair**.

### D3. "Iniciada…" no cabeçalho
- **Origem do horário**: `turns[0].sentAt`. O `createdAt` marca a criação do rascunho: um rascunho aberto às 10:00 e enviado às 10:30 apareceria como "Iniciada às 10:00". Sem turnos, o texto é "Ainda sem mensagens". Um turno cujo envio falhou sem `contextId` mostra "Iniciada…" sem **Copiar ID**.
- **Formatação**: a função `startedLabel(sentAt, now)` fica em `conversation/format.ts`.
  - O dia de calendário local é comparado com `daysAgo`, a mesma conta da lista, que arredonda os dias de 23 h e 25 h do horário de verão.
  - Hoje: "Iniciada hoje às HH:mm". Ontem: "Iniciada ontem às HH:mm". Antes disso: "Iniciada em {dayMonth} às HH:mm".
  - **Futuro** (relógio local atrasado em relação ao do envio): "hoje", como na lista, que trata data futura como hoje.
- **Formato compartilhado, sem import circular**: `formatTime`, `daysAgo` e `dayMonth(ms, now)` vão para um módulo neutro, `src/renderer/src/format/dates.ts`. O `dayMonth` dá `dd mmm` com o ano quando ele é outro. Tanto `conversation/format.ts` quanto `history/list-format.ts` importam desse módulo, e nenhum dos dois importa o outro; antes, a lista importava `formatTime` de `conversation/format.ts`. O `itemTime` passa a usar o `dayMonth`. Os testes de `formatTime`, `daysAgo` (inclusive o dia de 23 h do horário de verão) e `dayMonth` ficam em `format/dates.test.ts`. Há uma diferença de propósito: de 2 a 6 dias atrás, a lista mostra o dia da semana ("seg"), e o cabeçalho sempre mostra dia e mês ("20 out"). "Iniciada em seg às 18:40" fica ambíguo fora do agrupamento da lista.
- **`now`**: `Date.now()` lido na renderização do cabeçalho. **Limitação aceita**: uma conversa aberta que atravessa a meia-noite continua dizendo "hoje" até a próxima renderização (envio, resposta, troca de conversa). Um relógio no cabeçalho custaria um timer só para isso, e o texto não dirige nenhuma ação.
- **`abbreviateContextId`** e o teste dele são removidos, porque o cabeçalho era o único uso.

### D4. Copiar ID e o anúncio
- O `CopyButton` passa a ter o texto visível "Copiar ID" / "Copiado", `aria-label="Copiar ID da conversa"` fixo e `title={contextId}`. Continuam a chamada pelo main (`clipboard.writeText`, D6 da `conversa-a2a`) e os 1,5 s (`COPIED_MS`).
- **Anúncio**: o `aria-label` fixo esconde dos leitores de tela a troca para "Copiado". Por isso, um `<span aria-live="polite">` visualmente oculto (`VisuallyHidden` do Mantine) fica sempre montado e recebe "ID copiado" junto com `copied`. Ele é limpo quando o botão volta. A região precisa existir antes da mudança de texto para ser anunciada; por isso ela não é montada só depois do clique.
- **Separador**: um `Text` "·" em cor secundária, com `aria-hidden`, e gap de 6 entre os três itens.
- Durante os 1,5 s, o texto visível ("Copiado") não está contido no nome acessível (WCAG 2.5.3, rótulo no nome). É o padrão do protótipo; a região viva cobre o retorno de informação. Ver D11 #3.

### D5. Componente do ícone: `components/AppIcon.tsx`
- **Fonte do que é desenhado**: `src/shared/app-icon-geometry.ts`, um módulo puro, sem React, com `VIEWBOX`, os atributos do `rect`, as duas transformações, os caminhos com `fill-rule` e as cores `#2a6ecb` e `#ffffff`. A geometria vem do `app-icon.svg`, com uma única correção: o sentido da asa direita da gravata (D12). Tudo o que o app desenha sai daí: o `AppIcon` e os PNGs (D7). O arquivo em `assets/brand/` é a origem registrada (D6). Por ficar em `src/shared/`, o módulo é visível nos projetos `main` e `renderer`.
- **Fidelidade em dois testes.** O renderer não tem os tipos do Node, mesmo achado da `historico-conversas` que levou o teste do CSS para `src/shared/sidebar-css.test.ts`.
  - **Arquivo e constantes** (projeto `main`, `src/shared/app-icon-geometry.test.ts`, no padrão do `page-background.test.ts`): lê `assets/brand/app-icon.svg` com `node:fs` e extrai os atributos com expressões regulares simples (sem `DOMParser`, porque não há DOM no projeto Node). Confere:
    - que o arquivo contém exatamente o subcaminho original da asa direita (D12). Se a plataforma publicar outra revisão, o teste quebra e obriga a rever a correção;
    - que as constantes são iguais ao arquivo em `viewBox`, no `rect` (`x`, `y`, `width`, `height`, `rx`, `ry`, `fill`), nos `transform` dos dois `<g>` e no `d`, no `fill` e no `fill-rule` dos dois caminhos, **exceto** a asa direita, que é o subcaminho corrigido.
  - **Componente e constantes** (projeto `renderer`): o `AppIcon` renderizado usa as constantes no `viewBox`, no `rect`, nos `transform` e nos caminhos, com `aria-hidden`, `focusable="false"`, `Math.max(24, size)` e nenhum `var(` nas cores.
- **Alternativas descartadas**:
  - `import svg from '…/app-icon.svg?raw'` com `dangerouslySetInnerHTML`: levaria os 7,8 KB do C2PA para o bundle, o `aria-label="Buteco Agentes"` para o DOM e o filete da gravata (D12);
  - `?url` com `<img>`: seria aceito pela CSP (`img-src 'self'`), mas foi vetado. Além disso, perderia o `aria-hidden` controlado e a correção de D12;
  - plugin de SVG para componente (svgr): uma dependência nova para dois caminhos.
- **API**: `AppIcon({ size })`, que desenha com `Math.max(24, size)` como `width` e `height`. Atributos: `aria-hidden="true"`, `focusable="false"`, sem `role`, sem `aria-label` e sem `<title>`. As cores são literais, sem `var(`: o ícone é o mesmo nos dois esquemas, como na barra de tarefas. Branco sobre `#2a6ecb` dá ≈4,9:1, mas não é texto e não tem requisito de contraste.
- **`Brand`** vai de `auth/Brand.tsx` para `components/Brand.tsx`, porque o login e a barra lateral o usam. A prop `compact` continua:
  - normal: `AppIcon size={32}`, gap de 8, texto de 16 px, centralizado;
  - compacta: `AppIcon size={24}`, gap de 6, texto de 14 px, alinhado à esquerda.

  O `IconMessageCircle` sai.

### D6. Origem do SVG: `assets/brand/`
- `assets/brand/app-icon.svg` é copiado com `cp` de `buteco-agents/apps/frontend/public/app-icon.svg` (`58553b6`), sem nenhuma edição: nem formatação, nem remoção do C2PA, nem troca do `aria-label`, **nem a correção da gravata** (D12). O SHA-256 é `b6f1d18ba292fb2a9a910897196f2335a617d3049393f8ce98793348fa0ce228`. Ele é a **origem registrada**; o que o app desenha sai da geometria corrigida (D5).
- `assets/brand/README.md` registra:
  - repositório, caminho, commit e data;
  - o SHA-256;
  - que o arquivo é igual a `docs/marca/app-icon.svg`;
  - a regra do C2PA: não editar, e substituir por revisão nova do pacote atualizando o registro e rodando `npm run icons`;
  - o que deriva dele (a geometria corrigida e, a partir dela, os dois PNGs e o `AppIcon`);
  - a seção "Correção local" (D12);
  - as regras do manual que valem aqui (mínimo de 24 px, sem sombra).
- **Teste** (projeto `main`, `tooling/app-icon.test.ts`): o SHA-256 do arquivo é igual ao do README, e o arquivo contém `<c2pa:manifest>`.
- **Por que `assets/` e não `build/`**: `build/` é a pasta do electron-builder e guarda peças geradas. A origem fica separada do que é gerado. `assets/` não entra no bundle do renderer nem no asar.

### D7. Geração dos PNGs: `tooling/app-icon.ts` e o script `icons`
- **Ferramenta**: `@resvg/resvg-js` como devDependency, com binário pronto por plataforma via `optionalDependencies` e sem script de instalação. Ele renderiza SVG fielmente, sem libvips. O `sharp` passaria pela librsvg e é bem mais pesado. Na máquina não há `rsvg-convert` nem `magick`.
- **Script**: `"icons": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tooling/app-icon.ts"`. O Node 26 executa `.ts` direto, por remoção de tipos, e `tooling/**/*.ts` já está no `tsconfig.node.json`. A opção `--disable-warning` cala só o aviso de `package.json` sem `"type"`, sem mudar o tipo de módulo do projeto. O script importa `src/shared/app-icon-geometry.ts` com a extensão `.ts`, como o Node exige. Para isso, o `tsconfig.node.json` ganha `allowImportingTsExtensions`; o `typecheck` já roda com `--noEmit`.
- **SVG a partir da geometria, não do arquivo**: o script monta o SVG a partir das constantes de D5, já com a correção de D12 e sem C2PA, que não se aplica a peças derivadas. As funções puras (montar o SVG inteiro e o do macOS) ficam separadas da escrita em disco, para poderem ser testadas.
  - `build/icon.png`: o SVG montado, renderizado com `fitTo: { mode: 'width', value: 1024 }`;
  - `build/icon-mac.png`: um SVG de 1024 com fundo transparente, que envolve a mesma arte num `<svg x="100" y="100" width="824" height="824" viewBox="0 0 1024 1024">` (824/1024 = 0,8046875, centralizado com 100 de margem), renderizado em 1024. O canto resultante é 232 × 0,8047 ≈ 187, praticamente o raio do template da Apple (≈185), sem redesenhar nada;
  - **sem sombra**: o manual proíbe, e o macOS 26 aplica a própria moldura, então uma sombra embutida poderia dobrar (decisão da revisão). Se na fumaça do macOS 15 o ícone parecer "colado", a decisão é revista.
- **Os PNGs entram no git**: mudam só com uma revisão da marca, e assim o `package` não ganha um passo nem um binário nativo no caminho crítico.
- **Sem teste byte a byte**: o rasterizador não garante bytes idênticos entre máquinas. O teste `tooling/app-icon.test.ts` confere:
  - os dois arquivos existem e começam com a assinatura PNG;
  - o IHDR tem 1024×1024 (largura e altura nos bytes 16–23);
  - o `package.json` tem `build.icon = "build/icon.png"` e `build.mac.icon = "build/icon-mac.png"`;
  - o SVG do macOS tem o `<svg x="100" y="100" width="824" height="824">` com a arte dentro, sem `filter` nem sombra;
  - **a correção, por pixel** (D12): rasterizando em 1024 px o SVG montado a partir das constantes, o pixel em (550, 701) é branco; no arquivo original, o mesmo pixel é `#2a6ecb`. A comparação tem uma tolerância pequena de cor.

  A fidelidade da arte fica no teste de geometria (D5) e na fumaça.
- **electron-builder**: `build.icon: "build/icon.png"` e `build.mac.icon: "build/icon-mac.png"`. Ele gera o `.icns` (macOS) e o `.ico` (Windows) a partir dos PNGs de 1024, que nenhum de nós versiona. `build/` continua fora do asar pelo `files` atual.

### D8. Ícone em dev
- `createMainWindow(preloadPath, options?: { icon?: string })` acrescenta `icon` às opções do `BrowserWindow` só quando recebe o caminho. Assim a função continua testável sem `app`. O `BrowserWindow` ignora `icon` no macOS.
- No `index.ts`, com `!app.isPackaged`:
  - `const devIcons = { window: join(app.getAppPath(), 'build/icon.png'), dock: join(app.getAppPath(), 'build/icon-mac.png') }`. Em dev, `app.getAppPath()` é a raiz do projeto;
  - `app.dock?.setIcon(devIcons.dock)` dentro do `whenReady`. Fora do macOS, `app.dock` é `undefined`;
  - `createMainWindow(preloadPath, { icon: devIcons.window })`.
- Empacotado, `devIcons` é `null`: nada é chamado, e o ícone vem do bundle (`.icns` no `Info.plist`, `.ico` no executável).
- **Testes**: `window.test.ts` confere que `icon` só entra nas opções quando é passado. `index.test.ts`, com o `electron` simulado como hoje, confere que, com `isPackaged=false`, `dock.setIcon` recebe o caminho de `icon-mac.png` e a janela recebe o de `icon.png`, e que com `isPackaged=true` nenhum dos dois acontece.

### D9. Altura na largura estreita
Estimativa, não medição, na janela mínima de 720×520, que já é estreita por estar abaixo de 860:

```
barra lateral empilhada   ≈ 170   (marca, AGENTE, Nova conversa)
busca + lista (30vh)      ≈ 156
rodapé da barra lateral   ≈  46   (avatar de 30 + padding de 8×2)
barra de status              26
                          ─────
                          ≈ 398  → sobram ≈ 120 px para cabeçalho + timeline + composer
```

A barra de status não disputa com a lista, que tem `max-height` próprio, nem com o composer, que não encolhe. Ela disputa com a timeline. Antes desta change já sobravam só cerca de 140 px; o padding de 8 do rodapé (D2) devolve parte dos 26.

**Plano da fumaça**, decidido na revisão:
1. medir 720×520 e 859×700;
2. se 720×520 ficar ruim, reduzir a lista para `max-height: 25vh` na largura estreita;
3. se ainda não couber, subir o `minHeight` da janela para 600.

A barra de status nunca é escondida. O resultado e o passo aplicado ficam no `tasks.md`, e uma mudança de 30vh para 25vh ou de 520 para 600 entra no spec por um delta nesta mesma change.

**Medição na fumaça 6.4** (dev, `getBoundingClientRect`):

| Janela | Barra lateral | Principal | Cabeçalho | Barra de status | Timeline + composer |
| --- | --- | --- | --- | --- | --- |
| 720×520 | 374 | 120 | 66 | 26 | 54 |
| 859×700 | 428 | 246 | 66 | 26 | 180 |

A barra lateral mediu 374 px, como a estimativa (≈ 372). Em 720×520, os 54 px não comportam o composer, que não encolhe, e a timeline some. Só o passo 2 daria 80 px (a lista perde 5vh, 26 px). Por isso, os **passos 2 e 3 foram aplicados juntos**:
- a lista passa a `max-height: 25vh` na largura estreita (`global.css`, conferido em `sidebar-css.test.ts`);
- a janela passa a `minHeight` 600 (`security/window.ts`, conferido em `window.test.ts`). A janela mínima é 720×600, e a projeção é de 368 px para a barra lateral (374 − 156 + 150) e 206 px para a área principal: **140 px** para timeline e composer, contra 54.

**Remedição:** em 720×600, 368 px na barra lateral, 206 na principal e 140 para timeline e composer, como projetado; em 859×700, 393, 281 e 215. O composer e o cabeçalho cabem, mas a timeline continua curta demais para ler a conversa. **Limitação aceita**: empilhar a barra lateral inteira não serve abaixo de 860 px. A solução, por exemplo a barra lateral recolhida num menu de hambúrguer, fica para a próxima change. Os 25vh e os 600 ficam, porque melhoram o que existe até lá.

O spec só registra os 25% da lista, no delta de "Layout da tela de conversas" (`conversa`). Nenhum requisito fixa o tamanho da janela; o mínimo de 720×600 fica registrado só aqui e no código.

### D10. Contraste
A barra usa exatamente `--mantine-color-body` como fundo, `--mantine-color-dimmed` como texto e `--mantine-color-red-text` em "Sessão expirada". Os dois pares já são medidos:
- `dimmed` sobre superfície, nos dois esquemas, em "Texto secundário com contraste mínimo";
- `red-text` sobre superfície na linha "validação de campo" de "Cores de erro e de aviso com contraste mínimo".

Os 11 px contam como texto normal, e o limite já é 4,5:1. Nenhuma linha nova entra na tabela. Um teste de componente confere que a barra usa essas três variáveis, para que o requisito de contraste continue valendo para ela.

### D11. Fidelidade ao protótipo e divergências
O protótipo é seguido em textos, cores, medidas e hierarquia:
- **barra de status**: 26 px, padding horizontal de 12, 16 entre os grupos, 6 entre ícone e texto, ícones de 12 px, servidor e endereço em mono, relógio e o tempo, ou cadeado e "Sessão expirada" em vermelho, peso 500;
- **rodapé da barra lateral**: avatar de 30 px, 10 px até o nome e **Sair**;
- **cabeçalho**: "Iniciada…" / "Ainda sem mensagens", "·" e **Copiar ID**, com 6 px entre eles;
- **marca**: o ícone do app com 32 px no login.

| # | Divergência | Motivo | Padrão visual |
|---|---|---|---|
| 1 | Ícone na barra lateral com **24 px**, em vez dos 20 px do balão do protótipo original | Abaixo de 24 px a gravata some (manual da marca). O componente impõe o mínimo | Mesmo alinhamento à esquerda e o mesmo texto de 14 px |
| 2 | Padding vertical do rodapé da barra lateral de **8 px**, em vez de 12 | Libera altura na largura estreita (D9), permitido na revisão | Mesmo avatar, gap e borda |
| 3 | Região oculta `aria-live="polite"` com "ID copiado" | O `aria-label` fixo esconde a troca para "Copiado" dos leitores de tela | Invisível |
| 4 | De 2 a 6 dias atrás, o cabeçalho mostra "em 20 out", e não o dia da semana da lista | "Iniciada em seg" fica ambíguo fora do agrupamento | Mesmo formato `dd mmm` da lista |
| 5 | Ícone do macOS reduzido a 824/1024, com margem transparente e sem sombra; Windows e Linux com o quadro inteiro | Grid de ícones do macOS (Big Sur em diante). O manual proíbe sombra | Mesma arte do `app-icon.svg` |
| 6 | Gravata sem o filete vazado entre a asa direita e o nó, diferente da arte da plataforma | Defeito de sentido no subcaminho da asa direita do arquivo oficial (D12) | Mesmos pontos e cores; só o sentido da asa direita muda |
| 7 | Nota da conversa vazia: "A conversa entra no histórico depois da primeira mensagem.", no lugar de "O contextId desta conversa é atribuído no primeiro envio." | O mesmo motivo do cabeçalho: "contextId" é um termo de protocolo. O rascunho só é gravado no primeiro envio (`historico-conversas`), então a nota diz o que muda para o usuário | Mesma nota, 12 px, cor secundária |

### D12. Correção local da gravata
- **Causa**: no `app-icon.svg` oficial, a gravata é um único `<path>` com três subcaminhos (asa esquerda, asa direita, nó) e `fill-rule` padrão, `nonzero`. A asa esquerda e o nó são desenhados em sentido horário. A asa direita, espelhada, ficou anti-horária. Na faixa em que ela se sobrepõe ao nó (x 276–280, y 346–382 nas unidades do símbolo), os sentidos se anulam, e a área fica vazada, com um filete azul vertical à direita do nó. À esquerda, os sentidos se somam, e a área fica preenchida. Navegadores aplicam a mesma regra, então o painel da plataforma tem o mesmo filete. O mesmo caminho está em toda a família da marca de `buteco-agents`.
- **Medição** (largura do filete = 4 unidades × 1,75 × tamanho/1024):

  | Tamanho | Largura do filete |
  |---|---|
  | Barra lateral (24 px) e login (32 px) | ≈0,1 px, invisível |
  | Dock (≈128 px) | ≈0,9 px, um risco leve |
  | Finder grande e "Obter informações" (512–1024 px) | 3,5–7 px, visível |

  Conferido rasterizando o arquivo com `@resvg/resvg-js`: o pixel (550, 701) em 1024 px é `#2a6ecb`, e com a asa invertida ele é branco.
- **Escolha: corrigir só no chat**, num único lugar: a asa direita em `src/shared/app-icon-geometry.ts` passa de `M366 326Q366 312 352 312L276 346V382L352 416Q366 416 366 402Z` para os mesmos pontos em sentido inverso, `M366 326V402Q366 416 352 416L276 382V346L352 312Q366 312 366 326Z`. Cabeça, asa esquerda, nó, `rect`, transformações e cores continuam iguais ao original. Um comentário no módulo explica a correção e aponta para esta decisão.
- **O arquivo não muda**: `assets/brand/app-icon.svg` continua a cópia sem edição, com o C2PA, o SHA e o README de origem. O teste de D5 exige que o arquivo tenha o subcaminho original. Assim, uma revisão nova da plataforma quebra o teste e obriga a decidir se a correção ainda vale.
- **Consequência**: o ícone do chat difere do da plataforma nesse filete (D11 #6). Nos tamanhos de dentro do app, a diferença é invisível; no Dock e no Finder, o ícone do chat é o correto.
- **Alternativa descartada**: corrigir em `buteco-agents` e recopiar. Fica fora do escopo por enquanto. Quando a plataforma publicar uma revisão corrigida, a troca segue o README (arquivo novo, registro atualizado, `npm run icons`), e a correção local sai.

## Risks / Trade-offs

- [O macOS 26 trata ícones legados (`.icns`) com a própria máscara e moldura, e o ícone pode aparecer dentro de uma moldura cinza ou com escala diferente] → Não dá para testar aqui, porque a máquina de desenvolvimento roda o macOS 15. Fica em Open Questions; a saída futura seria um `.icon` do Icon Composer.
- [Sem sombra, o ícone pode parecer "colado" ao lado dos vizinhos no Dock do macOS 15] → Comparação na fumaça. Se incomodar, a decisão é revista numa change própria, já que hoje o manual proíbe a sombra.
- [A altura na largura estreita fica mais apertada com a barra de status] → Plano de D9, com a barra sempre visível.
- [Os PNGs no git podem ficar desatualizados em relação ao SVG] → O SVG só muda por revisão da marca, que pelo README exige rodar `npm run icons`. O teste do SHA-256 falha quando o SVG muda e lembra a regeneração. Os PNGs não são comparados byte a byte (D7).
- [A geometria copiada pode divergir do SVG] → Teste de geometria (D5), que só aceita a diferença da asa direita (D12).
- [O ícone do chat difere do da plataforma no filete da gravata] → Diferença intencional (D12), invisível nos tamanhos de dentro do app. O teste que exige o subcaminho original avisa quando a plataforma publicar outra revisão.
- [O `@resvg/resvg-js` traz um binário nativo por plataforma] → É só devDependency, fora do pacote e fora do `package`. Sem script de instalação, então nada muda no aviso de `allowScripts` do npm descrito no README.
- ["hoje"/"ontem" ficam velhos na virada da meia-noite] → Limitação aceita (D3).
- [Texto visível "Copiado" fora do nome acessível por 1,5 s (WCAG 2.5.3)] → Padrão do protótipo, com a região viva de D4.

## Migration Plan

Sem migração de dados: nada guardado muda (`historico-conversas`). Os PNGs e o SVG entram junto com o código. Para reverter, basta reverter o commit da change. Os pacotes antigos continuam com o ícone do Electron.

## Open Questions

- **macOS 26**: avaliar, quando houver máquina com o sistema, se o `.icns` derivado aparece bem ou se vale gerar um `.icon` (Icon Composer). Fica fora desta change.
