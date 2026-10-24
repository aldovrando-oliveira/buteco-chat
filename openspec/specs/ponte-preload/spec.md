# ponte-preload Specification

## Purpose

Definir a fronteira entre main e renderer: preload compatível com sandbox, superfície mínima exposta em `window.buteco`, tipos compartilhados do contrato e validação de remetente e de argumentos em todo handler IPC.

## Requirements

### Requirement: Preload compatível com sandbox
O preload SHALL ser gerado como um único arquivo CommonJS, sem `import` ESM e sem `require` de módulos além de `electron`, para carregar com `sandbox: true`.

#### Scenario: Artefato do preload
- **WHEN** o projeto é construído
- **THEN** o diretório de saída do preload contém um único arquivo `.js` em formato CommonJS, cujos únicos `require` são de `electron`

#### Scenario: Preload carrega no app empacotado
- **WHEN** o app empacotado é aberto
- **THEN** `window.buteco` existe no renderer e nenhum erro de carregamento do preload aparece no console

### Requirement: Superfície exposta mínima
O preload SHALL expor ao renderer apenas o objeto `window.buteco`, via `contextBridge.exposeInMainWorld`. O objeto MUST conter exatamente os namespaces selecionados por `ExposedApi` (listados em `EXPOSED_NAMESPACES`, em `src/shared/api.ts`), cada um só com funções implementadas no main. O preload MUST NOT expor `ipcRenderer`, `require`, `process` ou funções genéricas de envio por canal.

#### Scenario: Nada além de window.buteco
- **WHEN** o renderer inspeciona `window`
- **THEN** existe `window.buteco`, e não existem `window.ipcRenderer`, `window.electron` nem `window.require`

#### Scenario: Chaves iguais aos namespaces expostos
- **WHEN** o renderer lista as chaves de `window.buteco`
- **THEN** elas são exatamente os namespaces de `ExposedApi`

### Requirement: Tipos compartilhados do contrato
O módulo `src/shared/api.ts` SHALL declarar o contrato entre main e renderer: os tipos `ChatError`, `Result<T>`, `ButecoApi`, `AgentSummary` e `TaskState`, a constante `EXPOSED_NAMESPACES` e o tipo `ExposedApi`, derivado dela, que seleciona de `ButecoApi` só os namespaces já expostos. Toda alteração desse contrato MUST ser registrada, com o motivo, no `design.md` da change que a faz. O tipo global de `window.buteco` no renderer MUST ser `ExposedApi`.

#### Scenario: Renderer não compila namespace não exposto
- **WHEN** o código do renderer referencia um namespace de `ButecoApi` que não está em `ExposedApi`
- **THEN** a checagem de tipos (`npm run typecheck`) falha

### Requirement: Handlers IPC validam o remetente
O main SHALL registrar handlers IPC somente por um utilitário que valida o remetente antes de executar o handler: `event.senderFrame` MUST existir, MUST ser o frame principal (`parent === null`) de um `webContents` de janela do app, e a URL do frame MUST pertencer ao renderer do app. Em produção, esquema (`file:`) e caminho MUST ser iguais aos do `index.html` empacotado. Em dev, a origem (esquema, host e porta) MUST ser igual à do servidor de dev. Em ambos os casos, `hash` e `search` MUST ser ignorados. Remetentes inválidos MUST receber uma rejeição, sem executar o handler. Todo canal MUST declarar a validação dos seus argumentos: o utilitário recebe uma função `parseArgs(args: unknown[])`, executada depois da validação do remetente e antes do handler. Se `parseArgs` lançar erro, a chamada MUST ser rejeitada sem executar o handler.

#### Scenario: Argumentos validados antes do handler
- **WHEN** um remetente legítimo chama um canal registrado com `handle(channel, parseArgs, fn)`, com argumentos no formato que `parseArgs` aceita
- **THEN** `fn` recebe os argumentos devolvidos por `parseArgs`

#### Scenario: Argumentos em formato inválido
- **WHEN** um remetente legítimo chama o canal com argumentos que `parseArgs` rejeita (tipo errado, faltando ou sobrando)
- **THEN** a chamada é rejeitada e o handler não é executado

#### Scenario: Remetente legítimo
- **WHEN** um handler registrado pelo utilitário recebe uma chamada do frame principal da janela, com a URL do renderer do app
- **THEN** o handler é executado e o seu valor é devolvido

#### Scenario: URL do renderer com hash ou query
- **WHEN** a chamada vem do frame principal com URL `file://<caminho do app>/index.html#/conversas` ou `file://<caminho do app>/index.html?x=1`
- **THEN** o handler é executado

#### Scenario: Caminho do app com espaço
- **WHEN** o `index.html` empacotado está em `/Applications/Buteco Chat.app/Contents/Resources/app.asar/out/renderer/index.html` e a chamada vem do frame principal com a URL correspondente, codificada com `%20`
- **THEN** o handler é executado

#### Scenario: Outro index.html em caminho diferente
- **WHEN** a chamada vem do frame principal com URL `file:///tmp/outro/index.html`
- **THEN** o handler não é executado e a chamada é rejeitada

#### Scenario: Remetente de outra origem
- **WHEN** a chamada vem de um frame com URL `https://malicioso.exemplo/`
- **THEN** o handler não é executado e a chamada é rejeitada

#### Scenario: Subframe ou frame ausente
- **WHEN** a chamada vem de um subframe, ou `event.senderFrame` é `null`
- **THEN** o handler não é executado e a chamada é rejeitada
