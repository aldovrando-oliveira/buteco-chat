## ADDED Requirements

### Requirement: Endereço do serviço validado e normalizado
O módulo `src/shared/service-url.ts` SHALL exportar `parseServiceUrl(input: string)`, usada pelo renderer e pelo main. Ela MUST aceitar só endereços `http:` ou `https:` com host, sem credenciais embutidas, sem `?` e sem `#` em nenhuma parte da string (depois de `trim()`). Para um endereço aceito, MUST devolver `baseUrl` (origem mais caminho, sem barras finais), `host` (host com porta, se houver) e `insecure` (`true` para `http:` cujo host não é `localhost`, um endereço de `127.0.0.0/8` ou `[::1]`). Um prefixo de caminho MUST ser preservado. As rotas da plataforma MUST ser montadas por concatenação sobre `baseUrl` (`` `${baseUrl}/auth/login` ``), nunca por resolução relativa de URL.

#### Scenario: Endereço local
- **WHEN** `parseServiceUrl("http://localhost:5017")` é chamada
- **THEN** o resultado é aceito, com `baseUrl` `http://localhost:5017`, `host` `localhost:5017` e `insecure` `false`

#### Scenario: Barra final e espaços
- **WHEN** `parseServiceUrl("  https://Exemplo.com/  ")` é chamada
- **THEN** o resultado é aceito, com `baseUrl` `https://exemplo.com`

#### Scenario: Prefixo de caminho preservado
- **WHEN** `parseServiceUrl("https://host/buteco/")` é chamada e a rota de login é montada
- **THEN** `baseUrl` é `https://host/buteco` e a rota é `https://host/buteco/auth/login`

#### Scenario: Endereços recusados
- **WHEN** `parseServiceUrl` recebe `""`, `"localhost:5017"`, `"ftp://host"`, `"file:///x"`, `"http://user:pass@host"`, `"http://host/?x=1"`, `"http://host/?"`, `"http://host/#a"` ou `"não é url"`
- **THEN** o resultado é recusado

#### Scenario: HTTP fora de loopback
- **WHEN** `parseServiceUrl` recebe `http://192.168.0.10:5017`, `http://servidor.interno` e, separadamente, `http://127.0.0.1:5017`, `http://[::1]:5017` e `https://servidor.interno`
- **THEN** `insecure` é `true` nos dois primeiros e `false` nos três últimos

### Requirement: Login do operador no main
O main SHALL ter um serviço de autenticação em `src/main/auth/`, criado com `fetch`, relógio e timers (`setTimeout`/`clearTimeout`) injetados, que em produção são `net.fetch` do Electron, `Date.now` e os timers reais. `login(serviceUrl, username, password)` MUST enviar `POST {baseUrl}/auth/login` com corpo JSON `{ "username", "password" }`, `credentials: 'omit'`, `cache: 'no-store'`, `redirect: 'manual'` e timeout de 15 s. Em caso de sucesso, MUST guardar em memória `baseUrl`, `username`, token e `expiresAt`, e devolver só `{ expiresAt }`. O serviço MUST NOT guardar a senha depois da chamada, e MUST NOT gravar token, senha ou corpo de resposta em log, arquivo ou armazenamento.

#### Scenario: Login bem-sucedido
- **WHEN** a plataforma responde 200 com `{ "token": "abc", "expiresAt": "<30 min no futuro, com Z>" }`
- **THEN** `login` devolve `{ ok: true, value: { expiresAt } }`, sem token, e `status()` devolve `authenticated: true` com o `baseUrl`, o usuário e o `expiresAt`

#### Scenario: Data no formato do .NET
- **WHEN** a plataforma responde 200 com `expiresAt` `"2026-10-24T05:24:00.1234567+00:00"` e o relógio injetado está antes desse instante
- **THEN** `login` devolve `ok` com `expiresAt` `"2026-10-24T05:24:00.123Z"`

#### Scenario: Requisição enviada
- **WHEN** `login("https://host/buteco/", "ana", "s3nha")` é chamado
- **THEN** o `fetch` injetado recebe `https://host/buteco/auth/login`, método `POST`, corpo `{"username":"ana","password":"s3nha"}`, `redirect: 'manual'`, `credentials: 'omit'`, `cache: 'no-store'` e um `signal`

#### Scenario: Login começa limpando a sessão
- **WHEN** há uma sessão válida e um novo `login` falha
- **THEN** `status()` devolve `authenticated: false`

### Requirement: Erros do login mapeados para ChatError
O serviço SHALL devolver `{ ok: false, error }` com: `invalid-credentials` para 401; `unreachable` para rejeição de rede (mensagem `net::…`), timeout (mensagem `timeout`) ou outra rejeição (mensagem `network`); `http` com o status para qualquer outro status que não seja 200, inclusive outros 2xx; `http` para redirecionamento, com o status 3xx quando conhecido ou `0` quando a resposta é opaca ou a promessa rejeita por redirecionamento; e `bad-response` para um 200 cujo corpo não é válido. Um corpo 200 é válido se, e somente se, tem até 64 KiB, é JSON de objeto, tem `token` string não vazia de até 8192 caracteres e `expiresAt` string ISO 8601 com data, hora, fração de segundos opcional de 1 a 7 casas e fuso obrigatório `Z` ou `±hh:mm`, posterior ao relógio injetado. A `message` de `unreachable` MUST NOT conter corpo de resposta nem dados do usuário.

#### Scenario: Credenciais inválidas
- **WHEN** a plataforma responde 401
- **THEN** o resultado é `{ kind: 'invalid-credentials' }`

#### Scenario: Erro de rede
- **WHEN** o `fetch` rejeita com `Error("net::ERR_CONNECTION_REFUSED")`
- **THEN** o resultado é `{ kind: 'unreachable', message: 'net::ERR_CONNECTION_REFUSED' }`

#### Scenario: Timeout
- **WHEN** o `fetch` não responde em 15 s
- **THEN** a requisição é abortada e o resultado é `{ kind: 'unreachable', message: 'timeout' }`

#### Scenario: Outro status
- **WHEN** a plataforma responde 404, 500 ou 204
- **THEN** o resultado é `{ kind: 'http', status }` com o status recebido

#### Scenario: Redirecionamento
- **WHEN** o `fetch` devolve uma resposta 307, devolve uma resposta opaca de status 0, ou rejeita com `Error("Redirect was cancelled")`
- **THEN** o resultado é `{ kind: 'http', status: 307 }` no primeiro caso e `{ kind: 'http', status: 0 }` nos outros dois, e nenhuma segunda requisição é feita

#### Scenario: Resposta 200 malformada
- **WHEN** a plataforma responde 200 com corpo que não é JSON, sem `token`, com `token` vazio ou maior que 8192 caracteres, sem `expiresAt`, com `expiresAt` sem fuso (`"2099-01-01T00:00:00"`), com oito casas decimais (`"2099-01-01T00:00:00.12345678Z"`), com `expiresAt` não ISO (`"1"`), com `expiresAt` no passado, ou com corpo maior que 64 KiB
- **THEN** o resultado é `{ kind: 'bad-response' }` e `status()` devolve `authenticated: false`

### Requirement: Uma chamada de login por vez
Cada `login` e cada `logout` SHALL abortar a chamada de login em andamento. A resposta de uma chamada abortada ou substituída MUST NOT alterar o estado da sessão, e o resultado dessa chamada é `{ kind: 'unreachable', message: 'cancelled' }`.

#### Scenario: Sair durante o login
- **WHEN** `logout()` é chamado enquanto um `login` aguarda a resposta, e a plataforma responde 200 depois disso
- **THEN** a requisição pendente é abortada, e `status()` continua `authenticated: false`

#### Scenario: Dois logins seguidos
- **WHEN** um segundo `login` é chamado antes do primeiro terminar
- **THEN** o primeiro é abortado e só o resultado do segundo define a sessão

### Requirement: Logout, status e expiração
`logout()` SHALL descartar token, `expiresAt`, `baseUrl` e usuário. `status()` SHALL devolver `{ authenticated, serviceUrl, username, expiresAt }`, com os três últimos `null` quando não autenticado. A expiração MUST ser verificada na leitura, sem timer: quando o relógio injetado alcança `expiresAt`, `status()` e `getToken()` MUST descartar a sessão e responder como não autenticado.

#### Scenario: Logout limpa o estado
- **WHEN** `logout()` é chamado com uma sessão válida
- **THEN** `status()` devolve `{ authenticated: false, serviceUrl: null, username: null, expiresAt: null }` e `getToken()` devolve `null`

#### Scenario: Status depois da expiração
- **WHEN** o relógio injetado avança até `expiresAt`
- **THEN** `status()` devolve `authenticated: false` com os demais campos `null`, e `getToken()` devolve `null`

### Requirement: Token nunca cruza a ponte
`getToken()` SHALL existir só no main, para as chamadas autenticadas feitas pelo main, e MUST NOT ter canal IPC. Nenhum valor devolvido ao renderer (resultado de `login`, de `status` ou mensagem de erro) MUST conter o token.

#### Scenario: Resultado do login sem token
- **WHEN** um login bem-sucedido devolve o resultado pelo canal `auth:login`
- **THEN** o valor serializado não contém a string do token

#### Scenario: Preload sem acesso ao token
- **WHEN** o renderer lista as funções de `window.buteco.auth`
- **THEN** elas são exatamente `login`, `logout` e `status`

### Requirement: Canais IPC de autenticação
O main SHALL registrar `auth:login`, `auth:logout` e `auth:status` pelo utilitário `handle()` (requisito 'Handlers IPC validam o remetente' de `ponte-preload`), com `parseArgs`. `auth:login` MUST aceitar exatamente três strings: endereço com até 2048 caracteres e aceito por `parseServiceUrl`, usuário com até 256 e senha com até 1024. `auth:logout` e `auth:status` MUST aceitar exatamente zero argumentos. As mensagens de erro de `parseArgs`, inclusive a `cause`, MUST NOT conter nenhum valor recebido. `EXPOSED_NAMESPACES` SHALL incluir `'auth'`.

#### Scenario: Tipos e quantidade errados
- **WHEN** `auth:login` recebe um número no lugar de uma string, dois ou quatro argumentos, ou `auth:status` recebe um argumento
- **THEN** a chamada é rejeitada e o serviço não é chamado

#### Scenario: Tamanho excessivo
- **WHEN** `auth:login` recebe endereço com 2049 caracteres, usuário com 257 ou senha com 1025
- **THEN** a chamada é rejeitada e o serviço não é chamado

#### Scenario: Endereço inválido não vaza na mensagem
- **WHEN** `auth:login` recebe `http://user:pass@host` como endereço
- **THEN** a chamada é rejeitada, e nem a mensagem do erro nem a da `cause` contêm `user`, `pass` ou o endereço

#### Scenario: Tipagem do renderer
- **WHEN** o `typecheck` roda
- **THEN** `window.buteco.auth` compila no renderer e `window.buteco.chat` não

### Requirement: Estrutura das telas de login
As duas telas de login SHALL ter o fundo da página (`--buteco-color-page`), conteúdo centralizado nos dois eixos, coluna de largura máxima de 380 px e 20 px entre os blocos. No topo, centralizada, MUST estar a marca: ícone de balão de conversa de traço, 24 px, na cor primária, seguido de "Buteco" (16 px, peso 600) e "Chat" (16 px, cor secundária). Abaixo, um cartão (superfície, borda, raio 11 px, padding 24 px, 14 px entre os itens) MUST conter, nesta ordem: o título "Entrar" (20 px, peso 600) com o subtítulo "Use o mesmo usuário e senha do painel Buteco Agentes." em cor secundária; o bloco de erro, só quando houver erro; o endereço do serviço; o campo "Usuário" (`autocomplete="username"`); o campo "Senha" (`type="password"`, `autocomplete="current-password"`); e o botão primário preenchido "Entrar", de largura total e 36 px de altura. Rótulos MUST ter peso 500; campos, 34 px de altura e raio 7 px. A tela MUST NOT ter texto de ajuda permanente: nada abaixo do endereço além da mensagem de validação e do aviso de HTTP, e nada abaixo do cartão. As telas MUST funcionar nos esquemas claro e escuro.

#### Scenario: Ordem dos elementos
- **WHEN** a tela de login é renderizada com um erro
- **THEN** no cartão aparecem, nesta ordem, "Entrar", o subtítulo, o bloco de erro, o endereço, "Usuário", "Senha" e o botão "Entrar"

#### Scenario: Marca
- **WHEN** a tela de login é renderizada
- **THEN** acima do cartão aparecem o ícone de balão, "Buteco" e "Chat"

#### Scenario: Campos acessíveis
- **WHEN** a tela de login é renderizada
- **THEN** o campo "Usuário" tem `autocomplete="username"` e o campo "Senha" tem `type="password"` e `autocomplete="current-password"`

#### Scenario: Sem textos de ajuda
- **WHEN** a tela é renderizada sem erro, com endereço válido em `https:`
- **THEN** não há texto entre o endereço e o campo "Usuário" nem abaixo do cartão

### Requirement: Tela de primeiro acesso
Sem endereço salvo válido, a tela SHALL mostrar o campo "Endereço do serviço" (`type="url"`, fonte mono 12 px, placeholder `http://localhost:5017`). Só quando o endereço é inválido, o campo MUST ter borda vermelha e, abaixo dele, em vermelho 12 px, o texto "Informe um endereço completo, começando com http:// ou https://.". A mensagem MUST aparecer quando o campo não vazio perde o foco ou numa tentativa de envio, e MUST sumir quando o valor fica válido. O formulário MUST usar `noValidate` e enviar por `onSubmit` com `preventDefault`, inclusive com Enter.

#### Scenario: Campo vazio no primeiro acesso
- **WHEN** a tela abre sem endereço salvo
- **THEN** aparece o campo "Endereço do serviço" vazio, com placeholder `http://localhost:5017`, e nenhuma mensagem de validação

#### Scenario: Endereço inválido
- **WHEN** o usuário digita `localhost:5017` e sai do campo
- **THEN** o campo fica com borda vermelha, a mensagem "Informe um endereço completo, começando com http:// ou https://." aparece abaixo dele, e **Entrar** fica desabilitado

#### Scenario: Endereço corrigido
- **WHEN** com a mensagem visível, o usuário corrige o valor para `http://localhost:5017`
- **THEN** a mensagem some e a borda deixa de ser vermelha

#### Scenario: Endereço salvo inválido
- **WHEN** o valor salvo em `buteco-chat:service-url` é recusado por `parseServiceUrl`
- **THEN** a tela de primeiro acesso aparece, com o campo vazio

### Requirement: Tela de acessos seguintes
Com endereço salvo válido, no lugar do campo a tela SHALL mostrar o rótulo "Serviço" e uma linha somente leitura (34 px de altura, fundo de superfície sutil, borda, raio 7 px) com um ícone de servidor em cor secundária, o endereço salvo em mono 12 px, truncado com reticências, e um botão discreto **Alterar** (sem fundo, texto na cor primária). **Alterar** MUST trocar a linha pelo campo "Endereço do serviço" já preenchido com o endereço salvo. Usuário e senha MUST começar vazios.

#### Scenario: Linha do serviço
- **WHEN** a tela abre com `https://host/buteco` salvo
- **THEN** aparecem o rótulo "Serviço", o endereço `https://host/buteco` e o botão **Alterar**, sem campo de endereço editável, e os campos "Usuário" e "Senha" vazios

#### Scenario: Alterar o endereço
- **WHEN** o usuário clica em **Alterar**
- **THEN** a linha some e aparece o campo "Endereço do serviço" com o valor `https://host/buteco`

### Requirement: Aviso de HTTP sem criptografia
Quando o endereço (digitado ou salvo) é aceito e `insecure`, a tela SHALL mostrar, abaixo do endereço, "A senha será enviada sem criptografia.", em 12 px e na cor de aviso, sem borda vermelha no campo e sem impedir o envio. Para loopback ou `https:`, o aviso MUST NOT aparecer.

#### Scenario: HTTP em rede local
- **WHEN** o endereço é `http://192.168.0.10:5017`
- **THEN** o aviso "A senha será enviada sem criptografia." aparece e **Entrar** continua habilitado

#### Scenario: HTTP em loopback
- **WHEN** o endereço é `http://localhost:5017`
- **THEN** o aviso não aparece

### Requirement: Envio e mensagens de erro do login
**Entrar** SHALL ficar desabilitado com usuário ou senha vazios, com endereço inválido e durante o login; durante o login, o botão mostra carregamento e os campos ficam desabilitados. Um erro MUST aparecer no bloco de erro acima do endereço (fundo vermelho claro, texto vermelho, raio 7 px, `role="alert"`), com `{endereço}` igual ao `baseUrl` da tentativa:
- `invalid-credentials`: "Usuário ou senha incorretos."
- `unreachable`: "Não foi possível conectar a {endereço}. Confira o endereço e se o serviço está no ar."
- `http` com status 0 ou entre 300 e 399: "O serviço em {endereço} respondeu com um redirecionamento, que o app não segue. Confira o endereço (por exemplo, https:// em vez de http://)."
- `http` com outro status: "O serviço em {endereço} respondeu com erro {status}. Confira o endereço."
- `bad-response`: "O serviço em {endereço} deu uma resposta inesperada. Confira o endereço."

Depois de `invalid-credentials`, o usuário MUST ser mantido e a senha limpa. Depois de `unreachable`, `http` ou `bad-response`, usuário e senha MUST ser mantidos.

#### Scenario: Senha errada
- **WHEN** o login devolve `invalid-credentials`
- **THEN** o bloco com `role="alert"` mostra "Usuário ou senha incorretos.", o campo "Usuário" mantém o valor e o campo "Senha" fica vazio

#### Scenario: Serviço fora do ar
- **WHEN** o login em `http://localhost:5017` devolve `unreachable`
- **THEN** o bloco mostra "Não foi possível conectar a http://localhost:5017. Confira o endereço e se o serviço está no ar." e usuário e senha mantêm os valores

#### Scenario: Erro HTTP
- **WHEN** o login em `https://host` devolve `{ kind: 'http', status: 404 }`
- **THEN** o bloco mostra "O serviço em https://host respondeu com erro 404. Confira o endereço."

#### Scenario: Redirecionamento
- **WHEN** o login devolve `{ kind: 'http', status: 0 }` ou `{ kind: 'http', status: 301 }`
- **THEN** o bloco mostra a mensagem de redirecionamento, e não "erro 0" nem "erro 301"

#### Scenario: Resposta inesperada
- **WHEN** o login em `https://host` devolve `bad-response`
- **THEN** o bloco mostra "O serviço em https://host deu uma resposta inesperada. Confira o endereço."

#### Scenario: Campos vazios
- **WHEN** usuário ou senha estão vazios
- **THEN** **Entrar** fica desabilitado

#### Scenario: Login em andamento
- **WHEN** o usuário envia o formulário e a resposta ainda não chegou
- **THEN** **Entrar** mostra carregamento e os campos ficam desabilitados

### Requirement: Endereço lembrado só depois do sucesso
O renderer SHALL gravar o `baseUrl` normalizado em `localStorage['buteco-chat:service-url']` só depois de um login bem-sucedido. Nenhum outro dado de login MUST ser gravado. Leitura e escrita MUST estar em `try/catch`; sem armazenamento, o app MUST funcionar como no primeiro acesso.

#### Scenario: Gravação após sucesso
- **WHEN** o login em `https://host/buteco/` dá certo
- **THEN** `localStorage['buteco-chat:service-url']` é `https://host/buteco`, e nenhuma outra chave contém o usuário ou a senha

#### Scenario: Falha não grava
- **WHEN** o login devolve qualquer erro
- **THEN** o valor de `buteco-chat:service-url` não muda

#### Scenario: Armazenamento indisponível
- **WHEN** `localStorage.getItem` e `setItem` lançam erro
- **THEN** a tela de primeiro acesso aparece, o login funciona e nenhum erro escapa

### Requirement: Uma instância do app por pasta de dados
O main SHALL pedir o bloqueio de instância única (`app.requestSingleInstanceLock()`) antes de criar janelas ou registrar canais. Se o bloqueio for negado, o processo MUST encerrar sem criar janela nem registrar canais. Na instância principal, a abertura de uma segunda instância MUST trazer a janela existente para a frente (restaurando-a se minimizada) ou abrir uma janela se não houver nenhuma. Fora do app empacotado, o main MUST usar uma pasta de dados própria (a pasta padrão com o sufixo ` (dev)`), definida antes do bloqueio, para o dev nunca disputar a pasta do pacote.

#### Scenario: Segunda instância
- **WHEN** o app já está aberto e uma segunda instância é iniciada com a mesma pasta de dados
- **THEN** a segunda instância encerra sem criar janela nem registrar canais, e a janela da primeira é focada

#### Scenario: Instância principal sem janela
- **WHEN** a instância principal está aberta sem janela (macOS) e uma segunda instância é iniciada
- **THEN** a instância principal abre uma janela

#### Scenario: Pasta de dados do dev
- **WHEN** o app roda fora do pacote
- **THEN** a pasta de dados é a padrão com o sufixo ` (dev)`; no app empacotado, a pasta padrão não muda

#### Scenario: Endereço lembrado com o dev aberto
- **WHEN** o dev está aberto e o app empacotado faz login, é fechado e reaberto
- **THEN** a linha "Serviço" mostra o endereço do login

### Requirement: Tela inicial decidida pelo main
Ao montar, o renderer SHALL chamar `auth.status()` e mostrar o destino pós-login se autenticado, ou a tela de login se não. Até a resposta, MUST aparecer só o fundo da página.

#### Scenario: Recarregar com sessão ativa
- **WHEN** o renderer é recarregado e `status()` devolve `authenticated: true`
- **THEN** o destino pós-login aparece, sem passar pela tela de login

### Requirement: Destino pós-login provisório
Depois do login, o renderer SHALL mostrar, sobre o fundo da página, "{usuário} @ {host}" no formato do rodapé da barra lateral do protótipo de conversas (usuário em peso 500; "@ {host}" em mono 11 px, cor secundária), o texto "Sessão válida por mais {n} min" (11 px, cor secundária, `n` arredondado para cima a partir de `expiresAt`) e o botão **Sair** com ícone de saída e `aria-label="Sair"`. **Sair** MUST chamar `logout()` e voltar à tela de login, com usuário e senha vazios. Quando o tempo restante chega a zero, o renderer MUST chamar `status()` e voltar à tela de login se não estiver autenticado. Esta tela é provisória e será substituída pela tela de conversas.

#### Scenario: Identificação e tempo restante
- **WHEN** o login de `ana` em `http://localhost:5017` dá certo, com `expiresAt` 30 min à frente
- **THEN** aparecem "ana", "@ localhost:5017" e "Sessão válida por mais 30 min"

#### Scenario: Sair
- **WHEN** o usuário clica no botão de nome acessível "Sair"
- **THEN** `logout()` é chamado e a tela de acessos seguintes aparece, com usuário e senha vazios

#### Scenario: Tempo esgotado
- **WHEN** o tempo restante chega a zero e `status()` devolve `authenticated: false`
- **THEN** a tela de login aparece
