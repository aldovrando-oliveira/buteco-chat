## Context

A `fundacao-electron` deixou o app endurecido e sem integração: `window.buteco` é `{}`, nenhum canal IPC existe e o renderer mostra uma casca. Esta é a primeira change que fala com a plataforma.

Contrato da plataforma (conferido em `apps/api` do Buteco Agentes):
- `POST {serviço}/auth/login`, anônima. Corpo `{ "username", "password" }`.
- 200: `{ "token": string, "expiresAt": string ISO 8601 }`. Token opaco, TTL padrão de 30 min, sem refresh.
- 401: ProblemDetails `title: "Usuário ou senha inválidos."`, igual para usuário inexistente, senha errada e campos vazios.
- A plataforma roda em HTTP puro atrás de nginx/Cloudflare, que terminam o TLS (`Program.cs`, sem `UseHttpsRedirection`). Um prefixo de caminho no proxy é plausível.

Protótipo aprovado: um canvas no claude.ai, sem cópia no disco. A especificação textual dele, fornecida na exploração, está transcrita nos requisitos de tela de `specs/autenticacao/spec.md` e é a referência de textos, ordem, estados e hierarquia visual. Toda divergência está listada em D11.

```
 renderer (file://, connect-src 'none')     preload             main
 ┌─────────────────────────────┐          ┌──────────┐   ┌─────────────────────────────────┐
 │ App: checking│login│session │          │ buteco.  │   │ handle('auth:*', parseArgs, fn) │
 │   status() decide o início  │─invoke──▶│  auth    │──▶│   parseArgs usa parseServiceUrl │
 │ LoginScreen / SessionScreen │◀─Result──│ (3 fns)  │◀──│ AuthService (memória)           │
 │ localStorage: service-url   │  sem     └──────────┘   │  { base, username, token, exp } │
 │ parseServiceUrl (mensagens) │  token                  │  fetch = net.fetch (injetado)   │
 └─────────────────────────────┘                         └───────────────┬─────────────────┘
                 src/shared: api.ts · ipc-channels.ts · service-url.ts   │ POST {base}/auth/login
                                                                         ▼  redirect:'manual', 15 s
                                                                   plataforma
```

## Goals / Non-Goals

**Goals:**
- Login do operador com o token guardado só na memória do main e nunca exposto ao renderer.
- Endereço do serviço validado e normalizado num único lugar, compartilhado por main e renderer, aceitando prefixo de caminho.
- Todo resultado de rede mapeado para um `ChatError` previsível, com a senha nunca seguindo um redirecionamento.
- Telas fiéis ao protótipo, nos esquemas claro e escuro, e um destino pós-login provisório com **Sair**.

**Non-Goals:**
- Listar agentes ou conversar (`conversa-a2a`).
- Tratar 401 em uso, avisar sessão expirada ou renovar o token (`sessao-expirada`).
- Histórico local e o que acontece com ele ao trocar de endereço (`historico-conversas`).
- Lembrar o usuário entre aberturas, ou guardar a senha em qualquer forma (inclusive Keychain).
- Corrigir diferença de relógio entre cliente e servidor.

## Decisions

### D1. Cliente HTTP: `net.fetch` do Electron, injetado
O serviço é criado por `createAuthService({ fetch, now, setTimeout, clearTimeout })`, onde `fetch` é `(url: string, init: RequestInit) => Promise<Response>`, `now` é `() => number`, e `setTimeout`/`clearTimeout` têm a forma dos globais (só o necessário: `(fn, ms) => handle` e `(handle) => void`). Em produção recebe `net.fetch`, `Date.now` e os `setTimeout`/`clearTimeout` reais. Nos testes, uma função que devolve `new Response(...)` (global do Node) ou rejeita, e os timers falsos do Vitest.
- **Por que `net.fetch`**: usa a pilha de rede do Chromium, que respeita proxy e PAC do sistema e o repositório de certificados do sistema (Keychain). Em rede corporativa com proxy ou TLS interceptado, o `fetch` do Node (undici) falharia sem configuração extra.
- **Alternativa descartada**: `fetch` do Node. Mais simples de testar sem injeção, mas a injeção resolve isso, e o custo do erro em ambiente corporativo é alto.
- `net.fetch` só funciona depois de `app.whenReady()`; o serviço e os handlers são criados ali.
- Opções fixas de toda requisição: `method: 'POST'`, `headers: { 'content-type': 'application/json', accept: 'application/json' }`, `credentials: 'omit'`, `cache: 'no-store'`, `redirect: 'manual'`, `signal`.

### D2. Redirecionamento: verificado no Electron 45, nunca seguido
Teste descartável (fora do repositório), Electron 45.0.0 / Chromium 156: `net.fetch` POST contra um servidor local que responde 301, 302, 303, 307 e 308 com `Location` para outra porta, cada código com `redirect` `manual`, `error` e `follow`. Observado:

| `redirect` | Resultado | O destino recebeu? |
|---|---|---|
| `manual` | **rejeita** com `Error("Redirect was cancelled")` | não |
| `error` | rejeita com `Error("Attempted to redirect, but redirect policy was 'error'")` | não |
| `follow` | resolve 200; `response.redirected === false` | 301/302/303: GET sem corpo; **307/308: POST com a senha** |

Conclusões:
- No Electron 45, `redirect: 'manual'` **não** devolve o 3xx nem uma resposta opaca de status 0, como diz a especificação Fetch: rejeita a promessa. Os erros são `Error` simples, só com `message` (sem `code` nem `cause`).
- Com `follow`, um 307/308 reenviaria a senha para outro endereço, e `response.redirected` nem acusa. Seguir está fora de questão.
- Erros de rede vêm como `Error("net::ERR_…")` (ex.: `net::ERR_NAME_NOT_RESOLVED`, `net::ERR_CERT_AUTHORITY_INVALID`); um `fetch` abortado rejeita com `DOMException` (`AbortError`, ou `TimeoutError` quando o sinal foi de `AbortSignal.timeout`).

Regra adotada: `redirect: 'manual'` sempre. O classificador reconhece o redirecionamento nas três formas possíveis, para não depender de uma única versão do Electron:
1. promessa rejeitada com mensagem que contém `redirect` (sem diferenciar maiúsculas) e não começa com `net::` → redirecionamento;
2. resposta com `type === 'opaqueredirect'` ou `status === 0` → redirecionamento;
3. resposta com status 300–399 → redirecionamento.

Redirecionamento vira `{ kind: 'http', status }`, com o status 3xx quando conhecido e `0` quando não (formas 1 e 2). O renderer mostra a mensagem própria de redirecionamento para `status === 0` ou 300–399, nunca "erro 0". A garantia de segurança (a senha não segue) vem do `manual`, não do classificador: se uma versão futura mudar a mensagem, o pior caso é o redirecionamento cair em `unreachable`, sem vazar nada.

### D3. Timeout, geração e ciclo de uma chamada
- Timeout de 15 s pelo `setTimeout` injetado (D1): cada chamada tem um único `AbortController`; o timer chama `abort()` nele, e o cancelamento da geração aborta o mesmo controlador. O serviço guarda o motivo do aborto (`timeout` ou `cancelled`) antes de chamar `abort()`, e é esse motivo, e não o tipo do erro do `fetch`, que decide o resultado. O timer é cancelado com o `clearTimeout` injetado quando a chamada termina, de qualquer forma. Timeout → `unreachable` com `message: 'timeout'`. Na tela, a mesma mensagem de "Não foi possível conectar…".
- **Alternativa descartada**: `AbortSignal.timeout()`. Ele usa um timer interno que não obedece aos timers falsos do Vitest, então o teste de timeout precisaria esperar 15 s reais ou simular o aborto à mão, sem exercitar o caminho real.
- O serviço guarda um contador de geração e o `AbortController` da chamada em andamento. `login` e `logout` incrementam o contador e abortam a chamada anterior. Uma resposta cuja geração não é mais a atual é descartada: nunca grava estado. O resultado da chamada descartada é `unreachable` com `message: 'cancelled'` (o renderer não a mostra, porque o formulário fica desabilitado durante o login).
- `login` começa limpando o estado. Um login que falha deixa o app deslogado, e não com a sessão anterior.
- A senha só existe nos parâmetros de `login` e no corpo da requisição. Nenhuma referência a ela sobrevive à chamada.

### D4. Mapeamento de erros e validação da resposta
| Situação | Resultado |
|---|---|
| 200 com corpo válido | `ok`, estado gravado, devolve `{ expiresAt }` |
| 200 com corpo inválido (D5) | `{ kind: 'bad-response' }` |
| 401 | `{ kind: 'invalid-credentials' }` |
| redirecionamento (D2) | `{ kind: 'http', status: 3xx ou 0 }` |
| qualquer outro status, inclusive outros 2xx | `{ kind: 'http', status }` |
| rejeição `net::…` | `{ kind: 'unreachable', message: <a mensagem net::> }` |
| timeout | `{ kind: 'unreachable', message: 'timeout' }` |
| outra rejeição | `{ kind: 'unreachable', message: 'network' }` |

`message` de `unreachable` nunca contém corpo de resposta, URL com credenciais (impossível depois de D6) ou dados do usuário.

### D5. `bad-response`: critérios
Corpo do 200 é lido como texto, com limite de 64 KiB (acima disso, `bad-response`), e convertido com `JSON.parse`. Vale se, e somente se:
- é um objeto com `token` string, não vazia, de no máximo 8192 caracteres;
- `expiresAt` é string no formato `AAAA-MM-DDThh:mm:ss`, com fração de segundos opcional de 1 a 7 casas e fuso obrigatório `Z` ou `±hh:mm` (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?(Z|[+-]\d{2}:\d{2})$`), que `Date.parse` converte num número finito;
- `expiresAt` é posterior a `now()`.

**Formato do .NET.** A plataforma serializa `DateTimeOffset` com sete casas decimais e fuso numérico (`"2026-10-24T05:24:00.1234567+00:00"`). Conferido o `Date.parse` com sete casas no V8 do Electron 45.0.0 (V8 15.6) e do Node 26 (V8 14.6), que é o dos testes: os dois aceitam e truncam para milissegundos (`.1234567+00:00` → `05:24:00.123Z`; com `-03:00` → `08:24:00.123Z`). Por isso não há normalização da fração antes da conversão. O teste com uma string exatamente nesse formato protege contra uma mudança futura do V8, e os testes não usam só datas geradas por `toISOString()`.

O fuso explícito é exigido porque `Date.parse` aceita formatos soltos (em V8, `Date.parse("1")` é o ano 2001) e interpretaria uma data sem fuso como hora local. O `expiresAt` devolvido e guardado é normalizado com `new Date(ms).toISOString()`.

### D6. Endereço do serviço: `parseServiceUrl` em `src/shared/service-url.ts`
Função pura usada pelo renderer (mensagem de inválido, aviso de HTTP, valor gravado e exibido) e pelo main (dentro do `parseArgs`, onde decide). Recebe uma string e devolve `{ ok: true, baseUrl, host, insecure }` ou `{ ok: false }`.
1. `trim()`; vazio → inválido.
2. A string não pode conter `?` nem `#` (checado na string, porque `new URL('http://h/?')` tem `search === ''`).
3. `new URL()` precisa ter sucesso; `protocol` é `http:` ou `https:`; `username` e `password` vazios; `hostname` não vazio.
4. `baseUrl = origin + pathname` sem as barras finais. **Prefixo de caminho aceito**: `https://host/buteco/` → `https://host/buteco`. Porta padrão some e host fica em minúsculas, pelo próprio `URL`.
5. `host` é `URL.host` (com porta), usado em "operador @ {host}".
6. `insecure` é `true` para `http:` cujo `hostname` não é loopback: `localhost`, `127.0.0.0/8` (já normalizado pelo `URL`, ex.: `127.1` → `127.0.0.1`) ou `[::1]`.

Rotas são montadas por concatenação sobre a base normalizada: `` `${baseUrl}/auth/login` ``. **Nunca** `new URL('auth/login', baseUrl)`: sem barra final, ele descarta o último segmento (`https://host/buteco` + `auth/login` → `https://host/auth/login`). Há teste para isso.

A forma normalizada é a identidade do serviço: é o que vai para o `localStorage`, o que aparece na linha "Serviço" e o que `status().serviceUrl` devolve. A `historico-conversas` vai usá-la como chave do histórico local, então ela precisa ser estável: mudanças em `parseServiceUrl` daqui em diante são mudanças de contrato.

### D7. IPC e `parseArgs`
Canais em `src/shared/ipc-channels.ts`: `auth:login`, `auth:logout`, `auth:status`.
- `auth:login`: exatamente 3 argumentos string. `serviceUrl` até 2048 caracteres e válido por `parseServiceUrl`; `username` até 256; `password` até 1024. Strings vazias em usuário e senha passam (a plataforma responde 401); o renderer não deixa enviar vazio.
- `auth:logout` e `auth:status`: exatamente 0 argumentos.
- **Mensagens de erro nunca repetem valores**, nem na `cause`: o Electron imprime no stderr do main o erro de um handler que rejeita, e `util.inspect` inclui a `cause`. Uma mensagem como "URL inválida: http://user:pass@host" vazaria a senha no log. As mensagens são fixas ("serviceUrl inválido", "argumento 2 excede o limite"…), com teste usando `http://user:pass@host`.
- Endereço inválido no main é rejeição do IPC, não `ChatError`: o renderer valida antes, então isso só acontece por bug ou ataque.
- O preload implementa `auth` com `ipcRenderer.invoke` nos três canais, e só isso. `EXPOSED_NAMESPACES` passa a `['auth']`.

### D8. Expiração: verificada na leitura, sem timer
`status()` e `getToken()` comparam `now()` com `expiresAt`. Se `now() >= expiresAt`, limpam o estado e respondem como deslogado. Não há timer: o main não tem canal para avisar o renderer, e criar um é escopo da `sessao-expirada`. O destino provisório conta o tempo a partir de `expiresAt` e, ao chegar a zero, chama `status()` e volta ao login, sem mensagem.

### D9. Mudanças no contrato `src/shared/api.ts`
A fundação permite alterar o contrato registrando aqui:
- `ChatError` ganha `| { kind: 'bad-response' }`: um 200 malformado não é um status inesperado, e a `conversa-a2a` terá o mesmo caso nas respostas JSON-RPC.
- `auth.status()` passa a devolver `{ authenticated, serviceUrl, username, expiresAt }`, com `username: string | null`: o destino pós-login mostra o nome digitado, e depois de um recarregamento do renderer (Cmd+R, HMR) só o main sabe quem está logado. Deslogado, os três campos são `null`.

As duas mudanças são aditivas e não há consumidor anterior.

### D10. Renderer: navegação por estado e formulário
- `App` tem um estado `checking | login | session`. Ao montar, chama `status()`: autenticado → `session`, senão → `login`. Em `checking` só aparece o fundo da página. **Alternativa descartada**: roteador por hash. Traria uma dependência e um URL capaz de apontar para "sessão" sem autenticação. A validação de remetente já ignora o hash, então a `conversa-a2a` pode adotar um roteador sem custo.
- A tela de login é um `<form noValidate onSubmit>` com `preventDefault`. O `onSubmit` permite enviar com Enter sem violar `form-action 'none'`; o `noValidate` evita a validação nativa do `type="url"`, que mostraria um balão do navegador no lugar da mensagem do protótipo.
- **Entrar** fica desabilitado com usuário ou senha vazios, com endereço inválido e durante o login (com estado de carregamento; campos desabilitados).
- Mensagem de endereço inválido: aparece quando o campo não vazio perde o foco ou numa tentativa de envio, e some assim que o valor fica válido. Assim ela não aparece enquanto o usuário digita "h".
- Acessos seguintes: a linha "Serviço" mostra o endereço salvo. **Alterar** troca a linha pelo campo, preenchido com o endereço salvo e com foco; a troca não volta sozinha. Um valor salvo que `parseServiceUrl` rejeita é tratado como ausente (primeiro acesso, campo vazio).
- Depois de um erro: `invalid-credentials` mantém o usuário e limpa a senha; `unreachable`, `http` e `bad-response` mantêm os dois.
- `localStorage['buteco-chat:service-url']` recebe o `baseUrl` normalizado só depois de login bem-sucedido. Leitura e escrita em `try/catch`: sem armazenamento, o app funciona como se fosse sempre o primeiro acesso.
- Sair: chama `logout()` e volta ao login, na variante de acessos seguintes se houver endereço salvo, com usuário e senha vazios.

### D11. Fidelidade ao protótipo e divergências
O protótipo é seguido em textos, ordem, estados e hierarquia visual (requisitos de tela no spec). Divergências, todas no mesmo padrão visual dos elementos existentes:

| # | Divergência | Motivo | Padrão visual |
|---|---|---|---|
| 1 | Aviso "A senha será enviada sem criptografia." abaixo do endereço (campo ou linha "Serviço") quando `insecure` | Decisão da exploração (avisar, não bloquear). Contraria "nada abaixo do endereço exceto o erro de validação" | Mesma posição e tipografia da mensagem de validação (12 px), com a cor de aviso; o campo **não** fica com borda vermelha |
| 2 | Erro `http`: "O serviço em {endereço} respondeu com erro {status}. Confira o endereço." | O protótipo só tem os erros de credenciais e conexão; um 404 é o sintoma típico de prefixo errado | Bloco de erro do protótipo |
| 3 | Erro de redirecionamento: "O serviço em {endereço} respondeu com um redirecionamento, que o app não segue. Confira o endereço (por exemplo, https:// em vez de http://)." | D2; o caso comum é o proxy redirecionar http → https | Bloco de erro do protótipo |
| 4 | Erro `bad-response`: "O serviço em {endereço} deu uma resposta inesperada. Confira o endereço." | D5 | Bloco de erro do protótipo |
| 5 | Estado de carregamento no **Entrar** e campos desabilitados durante o login | D3 (evita chamadas concorrentes); o protótipo não mostra o estado de espera | `loading` do `Button` do Mantine |

`{endereço}` nas mensagens é o `baseUrl` normalizado da tentativa.

### D12. Cores das mensagens e contraste
Contraste WCAG calculado com as escalas do tema:
- Texto da mensagem de validação: `--mantine-color-red-text` (claro `red[6]` sobre branco 4,9:1; escuro `red[4]` sobre `dark[7]` 6,0:1).
- Bloco de erro: fundo `--mantine-color-red-light` (claro `red[1]`; escuro `red[9]` escurecido 50%). O texto do bloco precisa ser vermelho e ter ≥ 4,5:1 sobre esse fundo. Nenhuma variável padrão do Mantine atende os dois esquemas: `red-light-color` é `red[9]` no claro (5,75:1), mas `red[0]`, quase branco, no escuro, o que contraria o "texto vermelho" do protótipo; `red-text` é `red[4]` no escuro (4,9:1), mas `red[6]` no claro (4,3:1, reprova). Por isso o texto usa a variável própria `--buteco-color-error-text`: `red[9]` no claro e `red[4]` no escuro.
- Aviso de HTTP: `yellow[6]`, que é o `--mantine-color-yellow-text` padrão no claro, dá 3,7:1 sobre branco e reprova. Usa-se `yellow[7]` (4,7:1) no claro e `yellow[4]` (7,8:1) no escuro, por uma variável própria `--buteco-color-warning-text` no `cssVariablesResolver`, como `--buteco-color-page`.
- Um teste de contraste, no padrão do da fundação, cobre os três casos nos dois esquemas.

### D13. Ícones: `@tabler/icons-react`
O protótipo usa três ícones de traço (balão de conversa, servidor, saída). `@tabler/icons-react` (3.49) é o conjunto usado nos exemplos do Mantine, gera `<svg>` inline pelo React (compatível com a CSP: nada de `data:` nem fonte de ícones) e é importado por ícone. **Alternativa**: SVGs escritos à mão em componentes locais, sem dependência. Escolhido o pacote para não manter desenhos à mão, que precisariam ser trocados a cada ícone novo da `conversa-a2a`.

### D14. Botão Sair só de ícone
No protótipo, o **Sair** do rodapé é só ícone (saída), sem texto visível. Implementado como `ActionIcon` com o ícone de saída e `aria-label="Sair"`. Os testes o encontram pelo nome acessível.

### D15. Layout do código
```
src/shared/service-url.ts            parseServiceUrl (+ teste no projeto main)
src/shared/api.ts                    D9
src/shared/ipc-channels.ts           auth:login | auth:logout | auth:status
src/main/auth/service.ts             createAuthService({ fetch, now, setTimeout, clearTimeout }) (+ teste)
src/main/auth/ipc.ts                 parseArgs dos três canais e registro com handle() (+ teste)
src/main/index.ts                    cria o serviço com net.fetch e registra os canais em whenReady
src/preload/index.ts                 auth via ipcRenderer.invoke
src/renderer/src/App.tsx             estado checking | login | session
src/renderer/src/auth/LoginScreen.tsx, SessionScreen.tsx, Brand.tsx, saved-service-url.ts
```
`Shell.tsx` e o teste da casca saem. `Notifications` continua no `App`, sem uso nesta change.

## Risks / Trade-offs

- [Mensagem de redirecionamento do Electron mudar numa atualização] → A segurança vem de `redirect: 'manual'`. O pior caso é o redirecionamento ser mostrado como "não foi possível conectar". O classificador também aceita as formas da especificação Fetch (D2).
- [Relógio local diferente do servidor] → Adiantado: a sessão acaba antes no cliente e o usuário entra de novo. Atrasado: o token pode já estar vencido no servidor; o 401 em uso é tratado na `sessao-expirada`. Com o relógio adiantado em mais que o tempo de vida do token, um `expiresAt` válido parece vencido na chegada e o login vira `bad-response` ("deu uma resposta inesperada"); esse é um dos caminhos para essa mensagem. Sem correção pelo cabeçalho `Date` nem tratamento específico nesta change.
- [Strings em JavaScript não podem ser zeradas] → "Não guardar a senha" significa não manter referência depois da chamada. O valor pode ficar na memória até a coleta de lixo. Aceito.
- [`localStorage` do dev (`localhost:5173`) e do app empacotado (`file://`) são separados] → A fumaça do endereço lembrado é feita no app empacotado.
- [Aviso de HTTP fora de loopback não impede o envio da senha em claro] → Decisão consciente: ferramenta interna, testes em rede local são esperados.
- [Erro de certificado aparece como "não foi possível conectar"] → A `message` de `unreachable` guarda o `net::ERR_CERT_…`, disponível para uma mensagem específica no futuro. Por ora, a mensagem do protótipo.

## Migration Plan

Nada em produção. Não há dado a migrar: o `localStorage` só ganha uma chave nova. Rollback = reverter os commits da change.

## Open Questions

Nenhuma.
