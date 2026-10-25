## Why

O fatiamento original deixou três arestas na interface, que o protótipo atualizado corrige (canvas "Buteco Chat": Login, Login — acessos seguintes, Conversas e Ícone do app):
- o rodapé da barra lateral trunca usuário e host ("joana_… @ agentes.exemplo…"), justamente as duas informações que o operador quer conferir;
- o cabeçalho da conversa mostra "contextId", um termo do protocolo que o usuário não precisa entender;
- o app não tem marca própria: a janela usa o ícone padrão do Electron, e as telas usam um balão de conversa genérico. A plataforma já tem o ícone de aplicativo oficial (`app-icon.svg`).

## What Changes

- **Barra de status no rodapé da janela**, só na tela de conversas: faixa de largura total, abaixo da barra lateral e da área principal, com o endereço completo do serviço à esquerda e o tempo de sessão à direita ("Sessão válida por mais {n} min" ou, na sessão expirada, cadeado e "Sessão expirada" em vermelho). É um `<footer aria-label="Barra de status">`, não `role="status"`. O contador e a passagem ao estado expirado mudam de componente, mas a regra continua a mesma.
- **Rodapé da barra lateral**: só avatar, nome do usuário e **Sair**. O host e o tempo vão para a barra de status.
- **Cabeçalho da conversa**: a segunda linha passa a "Iniciada hoje às {HH:mm}", "Iniciada ontem às {HH:mm}" ou "Iniciada em {dd mmm[ aaaa]} às {HH:mm}", e "Ainda sem mensagens" antes do primeiro envio. Ao lado vem o botão **Copiar ID** (`aria-label="Copiar ID da conversa"`), que fica "Copiado" por 1,5 s e é anunciado por uma região `aria-live`. O ID abreviado e a palavra "contextId" deixam de aparecer.
- **Ícone do app**:
  - o `app-icon.svg` oficial é copiado sem edição para `assets/brand/`, com a origem registrada;
  - a partir dele são gerados `build/icon.png` (quadro inteiro, Windows e Linux) e `build/icon-mac.png` (reduzido a 824/1024 em quadro transparente, sem sombra), versionados no git e regenerados pelo script `icons`;
  - o pacote usa esses PNGs, e em dev a janela e o Dock também;
  - dentro do app, um único componente desenha o mesmo ícone (geometria inline, cores fixas, mínimo de 24 px, `aria-hidden`), no lugar do balão: 32 px nas duas telas de login e 24 px no topo da barra lateral.
- **BREAKING (interface)**: saem o "contextId" abreviado do cabeçalho, o host e o tempo do rodapé da barra lateral, e o balão de conversa como marca.

## Capabilities

### New Capabilities
Nenhuma.

### Modified Capabilities
- `conversa`:
  - **acrescentado**: "Barra de status";
  - **renomeado**: "Copiar o contextId" passa a "Copiar o ID da conversa", com o texto **Copiar ID** e o anúncio "ID copiado";
  - **alterados**:
    - "Layout da tela de conversas": barra de status no rodapé da janela, também na largura estreita, e a lista da largura estreita a 25% da altura da janela (era 30%);
    - "Barra lateral": ícone do app de 24 px na marca;
    - "Rodapé de sessão": só avatar, nome e **Sair**; o tempo vai para a barra de status;
    - "Cabeçalho da conversa": "Iniciada…" / "Ainda sem mensagens" e **Copiar ID**;
    - "Conversa vazia": a nota passa a "A conversa entra no histórico depois da primeira mensagem.", sem "contextId";
    - "Sessão expirada durante o uso", "Banner de sessão expirada", "Retomada depois do novo login" e "Ações durante a sessão expirada": "rodapé" passa a "barra de status" e **Copiar** passa a **Copiar ID**, sem mudança de regra.
- `historico-conversas`: o cenário "Trocar de conversa durante o envio", de "Resultado na conversa de origem", deixa de esperar o ID abreviado no cabeçalho.
- `autenticacao`: em "Estrutura das telas de login", a marca passa a ser o ícone do app de 32 px.
- `identidade-visual`: **acrescentado** "Ícone do app na interface". É o lugar único das regras da marca dentro do app: componente único, geometria do `app-icon.svg`, cores fixas, mínimo de 24 px, `aria-hidden`, sem `data:` nem `<img>`, nem símbolo solto nem logo da plataforma.
- `empacotamento-local`:
  - **acrescentado**: "Ícone do aplicativo" (origem do SVG, peças derivadas, margem no macOS, ícone em dev);
  - **alterados**: "Scripts do projeto" (script `icons`) e "Teste de fumaça do pacote" (ícone e barra de status).

## Impact

- **Código novo**:
  - `src/renderer/src/components/AppIcon.tsx`;
  - `src/renderer/src/conversation/StatusBar.tsx`;
  - `tooling/app-icon.ts`;
  - `assets/brand/app-icon.svg` e `assets/brand/README.md`;
  - `build/icon.png` e `build/icon-mac.png`.
- **Código alterado**:
  - `Brand.tsx`: passa de `auth/` para `components/`;
  - `SessionFooter.tsx`, `Sidebar.tsx`, `ConversationScreen.tsx` e `ConversationHeader.tsx`;
  - `format.ts`: sai `abbreviateContextId`;
  - `format/dates.ts` (novo): `formatTime`, `daysAgo` e `dayMonth()`, compartilhados por `conversation/format.ts` e `history/list-format.ts`;
  - `EmptyConversation.tsx`: nota sem "contextId";
  - `styles/global.css`;
  - `src/main/security/window.ts` e `src/main/index.ts`: ícone em dev;
  - `package.json`: script `icons`, `build.mac.icon` e `build.icon`, e a devDependency `@resvg/resvg-js`;
  - `README.md`;
  - testes desses arquivos.
- **Contrato `src/shared/api.ts`, preload, canais IPC e CSP**: sem mudança.
- **Plataforma**: nenhuma chamada nova. Só o arquivo `apps/frontend/public/app-icon.svg` é copiado de `buteco-agents@58553b6`; nenhum código é importado.
- **Fora do escopo**:
  - nome "Electron" no Dock em dev;
  - ícone `.icon` do Icon Composer para o macOS 26;
  - favicon e lockups da plataforma.
