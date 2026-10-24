# empacotamento-local Specification

## Purpose

Garantir os scripts de desenvolvimento, teste, build e empacotamento local do app, o teste de fumaça do pacote e a documentação básica do repositório.

## Requirements

### Requirement: Scripts do projeto
O `package.json` SHALL oferecer os scripts `dev` (app em desenvolvimento com HMR), `build` (main, preload e renderer de produção), `typecheck` (TypeScript estrito em todos os alvos, sem emitir), `test` (Vitest nos projetos `main` e `renderer`), `test:build` (verificações sobre os artefatos de `build`: formato do preload, ausência de `data:`, CSP de produção no `index.html`) e `package` (build seguido do empacotamento local).

#### Scenario: Testes rodam os dois projetos
- **WHEN** `npm test` é executado
- **THEN** o Vitest roda os testes do projeto `main` em ambiente node e os do projeto `renderer` em jsdom, e termina com código 0 se todos passarem

#### Scenario: Typecheck estrito
- **WHEN** `npm run typecheck` é executado
- **THEN** main, preload, renderer e shared são verificados com `strict: true`, e o comando falha em qualquer erro de tipo

### Requirement: Empacotamento para o sistema local
O script `package` SHALL gerar, em `release/`, o app empacotado com `electron-builder` só para o sistema operacional e a arquitetura da máquina em que roda, com o código em `asar`, sem assinatura de desenvolvedor, sem notarização e sem auto-update.

#### Scenario: Pacote gerado
- **WHEN** `npm run package` é executado na máquina de desenvolvimento
- **THEN** `release/` contém um app executável para o SO e a arquitetura locais

### Requirement: Teste de fumaça do pacote
Antes de uma versão do pacote ser considerada pronta, o app empacotado SHALL passar por um teste de fumaça manual, iniciado pelo terminal, que confirma: a janela abre sem flash branco; a casca aparece com Plex Sans e Plex Mono carregadas; o tema claro e o escuro funcionam, alternando o tema do sistema; no esquema escuro, nem a janela nem o primeiro quadro do React aparecem claros; `window.buteco` existe; pelo DevTools do pacote, `window.open('https://example.com')` e `location.href = 'https://example.com'` abrem o navegador padrão sem navegar o app, e `location.href = 'file:///etc/hosts'` não tem efeito; e há zero violações de CSP no stdout e no console. A casca não ganha link para esse teste.

#### Scenario: Fumaça aprovada
- **WHEN** o pacote é aberto pelo terminal e os itens do teste de fumaça são verificados
- **THEN** todos os itens passam, e o resultado é registrado no `tasks.md`

#### Scenario: Falha sob file://
- **WHEN** o teste de fumaça encontra fontes ou módulos bloqueados pela CSP sob `file://`
- **THEN** o pacote não é dado como pronto, e a correção é migrar para um protocolo próprio (`protocol.handle`), nunca afrouxar a CSP

### Requirement: Arquivos ignorados e documentação
O repositório SHALL ter um `.gitignore` com `node_modules/`, `out/`, `dist/` e `release/`, e um `README.md` em pt-BR que explique os pré-requisitos, os scripts, a arquitetura em alto nível (main, preload, renderer, shared) e, no macOS, como liberar o app não assinado com `xattr -cr`.

#### Scenario: Artefatos de build fora do git
- **WHEN** `npm run build` e `npm run package` são executados
- **THEN** `git status` não lista arquivos de `out/`, `dist/` ou `release/`
