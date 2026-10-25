# Marca — ícone do app

`app-icon.svg` é o ícone de aplicativo oficial da plataforma Buteco Agentes: 1024×1024, quadrado de canto 232 em
`#2a6ecb` com o símbolo (cabeça e gravata) em branco.

## Origem

| | |
| --- | --- |
| Repositório | `buteco-agents` |
| Caminho | `apps/frontend/public/app-icon.svg` (idêntico a `docs/marca/app-icon.svg`) |
| Commit | `58553b6` (2026-09-13) |
| SHA-256 | `b6f1d18ba292fb2a9a910897196f2335a617d3049393f8ce98793348fa0ce228` |

O app não importa código da plataforma; só este arquivo é copiado.

## Proveniência

O arquivo mantém o manifesto C2PA (`<metadata><c2pa:manifest>`) como entregue. **Não edite o arquivo**, nem para
formatar: a assinatura deixa de conferir. Uma revisão da marca substitui o arquivo inteiro; depois, atualize a tabela
acima (commit e SHA-256) e rode `npm run icons`.

## O que deriva dele

Este arquivo é a origem registrada; o que o app desenha sai da geometria em `src/shared/app-icon-geometry.ts`, copiada
daqui com a correção abaixo. Um teste compara as constantes com este arquivo.

- `AppIcon` (renderer): a marca dentro do app, desenhada a partir da geometria.
- `build/icon.png`: 1024×1024, o ícone no quadro inteiro (Windows e Linux; janela em dev).
- `build/icon-mac.png`: 1024×1024, o ícone reduzido a 824/1024 e centralizado num quadro transparente, sem sombra
  (grid de ícones do macOS; Dock em dev).

Os dois PNGs são gerados por `npm run icons` (`tooling/app-icon.ts`) a partir da geometria, sem C2PA, e ficam no git.

## Correção local

No original, a asa direita da gravata é desenhada no sentido oposto ao da asa esquerda e do nó. Com o `fill-rule`
padrão (`nonzero`), a faixa em que ela encosta no nó fica vazada: um filete azul à direita do nó, visível a partir de
uns 128 px. Na geometria do chat, a asa direita usa os mesmos pontos em sentido inverso:

- original: `M366 326Q366 312 352 312L276 346V382L352 416Q366 416 366 402Z`
- no chat: `M366 326V402Q366 416 352 416L276 382V346L352 312Q366 312 366 326Z`

Este arquivo não recebe a correção. O ícone do chat difere do da plataforma só nesse filete. Detalhes na decisão D12
de `openspec/changes/archive/*-barra-de-status-e-marca/design.md`. Se a plataforma publicar uma revisão, o teste que
exige o subcaminho original quebra, e a correção deve ser revista.

## Regras do manual que valem aqui

- Abaixo de 24 px a gravata some: o `AppIcon` nunca desenha menor que 24 px.
- Sem sombra, gradiente ou contorno, inclusive na peça do macOS.
- Dentro do app, a marca é sempre este ícone, com as cores fixas nos dois esquemas, nunca o símbolo solto nem o logo
  da plataforma.
