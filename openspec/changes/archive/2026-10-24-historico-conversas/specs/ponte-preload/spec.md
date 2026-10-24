## MODIFIED Requirements

### Requirement: Tipos compartilhados do contrato
O módulo `src/shared/api.ts` SHALL declarar o contrato entre main e renderer: os tipos `ChatError`, `Result<T>`, `ButecoApi`, `AgentSummary` e `TaskState`, a constante `EXPOSED_NAMESPACES` e o tipo `ExposedApi`, derivado dela, que seleciona de `ButecoApi` só os namespaces expostos pelo preload. Toda alteração desse contrato MUST ser registrada, com o motivo, no `design.md` da change que a faz. O tipo global de `window.buteco` no renderer MUST ser `ExposedApi`.

#### Scenario: Renderer não compila namespace não exposto
- **WHEN** o código do renderer referencia um namespace de `ButecoApi` que não está em `ExposedApi`
- **THEN** a checagem de tipos (`npm run typecheck`) falha
