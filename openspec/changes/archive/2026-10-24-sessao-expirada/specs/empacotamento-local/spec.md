## MODIFIED Requirements

### Requirement: Teste de fumaça do pacote
Antes de uma versão do pacote ser considerada pronta, o app empacotado SHALL passar por um teste de fumaça manual, iniciado pelo terminal, que confirma: a janela abre sem flash branco; a casca aparece com Plex Sans e Plex Mono carregadas; o tema claro e o escuro funcionam, alternando o tema do sistema; no esquema escuro, nem a janela nem o primeiro quadro do React aparecem claros; `window.buteco` existe; pelo DevTools do pacote, `window.open('https://example.com')` e `location.href = 'https://example.com'` abrem o navegador padrão sem navegar o app, e `location.href = 'file:///etc/hosts'` não tem efeito; e há zero violações de CSP no stdout e no console. A casca não ganha link para esse teste.

#### Scenario: Fumaça aprovada
- **WHEN** o pacote é aberto pelo terminal e os itens do teste de fumaça são verificados
- **THEN** todos os itens passam, e o resultado é registrado no `tasks.md`

#### Scenario: Falha sob file://
- **WHEN** o teste de fumaça encontra fontes ou módulos bloqueados pela CSP sob `file://`
- **THEN** o pacote não é dado como pronto, e a correção é migrar para um protocolo próprio (`protocol.handle`), nunca afrouxar a CSP
