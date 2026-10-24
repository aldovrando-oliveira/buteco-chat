## ADDED Requirements

### Requirement: Preload compatível com sandbox
O preload SHALL ser gerado como um único arquivo CommonJS, sem `import` ESM e sem `require` de módulos além de `electron`, para carregar com `sandbox: true`.

#### Scenario: Artefato do preload
- **WHEN** o projeto é construído
- **THEN** o diretório de saída do preload contém um único arquivo `.js` em formato CommonJS, cujos únicos `require` são de `electron`

#### Scenario: Preload carrega no app empacotado
- **WHEN** o app empacotado é aberto
- **THEN** `window.buteco` existe no renderer e nenhum erro de carregamento do preload aparece no console

### Requirement: Superfície exposta mínima
O preload SHALL expor ao renderer apenas o objeto `window.buteco`, via `contextBridge.exposeInMainWorld`. O objeto MUST conter somente as funções já implementadas no main. Nesta change ele é vazio. O preload MUST NOT expor `ipcRenderer`, `require`, `process` ou funções genéricas de envio por canal.

#### Scenario: Nada além de window.buteco
- **WHEN** o renderer inspeciona `window`
- **THEN** existe `window.buteco`, e não existem `window.ipcRenderer`, `window.electron` nem `window.require`

#### Scenario: Objeto vazio nesta change
- **WHEN** o renderer lista as chaves de `window.buteco`
- **THEN** a lista é vazia

### Requirement: Tipos compartilhados do contrato
O módulo `src/shared/api.ts` SHALL declarar os tipos `ChatError`, `Result<T>`, `ButecoApi`, `AgentSummary` e `TaskState` exatamente como descritos no documento de construção, e um tipo `ExposedApi` que seleciona de `ButecoApi` só os namespaces já expostos. Nesta change, `ExposedApi` não seleciona nenhum. O tipo global de `window.buteco` no renderer MUST ser `ExposedApi`.

#### Scenario: Renderer não compila chamada não exposta
- **WHEN** o código do renderer referencia `window.buteco.auth.login`
- **THEN** a checagem de tipos (`npm run typecheck`) falha

### Requirement: Handlers IPC validam o remetente
O main SHALL registrar handlers IPC somente por um utilitário que valida o remetente antes de executar o handler: `event.senderFrame` MUST existir, MUST ser o frame principal (`parent === null`) de um `webContents` de janela do app, e a URL do frame MUST pertencer ao renderer do app. Em produção, esquema (`file:`) e caminho MUST ser iguais aos do `index.html` empacotado. Em dev, a origem (esquema, host e porta) MUST ser igual à do servidor de dev. Em ambos os casos, `hash` e `search` MUST ser ignorados. Remetentes inválidos MUST receber uma rejeição, sem executar o handler.

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
