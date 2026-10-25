## ADDED Requirements

### Requirement: Barra de status
Na tela de conversas, a janela SHALL ter no rodapé uma barra de status: um elemento `<footer>` com `aria-label="Barra de status"`, sem `role="status"`, de largura total, abaixo da barra lateral e da área principal. Medidas:
- 26 px de altura e padding horizontal de 12 px;
- superfície (`--mantine-color-body`) e borda superior;
- texto de 11 px em cor secundária (`--mantine-color-dimmed`);
- 16 px entre o grupo da esquerda e o da direita, 6 px entre ícone e texto, e ícones de 12 px.

Conteúdo:
- **à esquerda**, um ícone de servidor e o endereço completo do serviço da sessão, em mono. O `title` MUST ter o endereço completo. O endereço MUST ser truncado com reticências só quando não couber na largura da janela;
- **à direita**, um ícone de relógio e "Sessão válida por mais {n} min", com `n` arredondado para cima a partir de `expiresAt`. Na sessão expirada, o ícone MUST ser um cadeado, e o texto, "Sessão expirada" em `--mantine-color-red-text`, peso 500. O grupo da direita MUST NOT ser truncado nem encolher.

Quando o tempo restante chega a zero, o renderer MUST entrar no estado de sessão expirada (requisito 'Sessão expirada durante o uso'), sem chamar `status()` nem voltar à tela de login. Depois de um novo login, o tempo restante MUST ser contado a partir do `expiresAt` novo. A barra MUST NOT aparecer nas telas de login.

#### Scenario: Endereço e tempo restante
- **WHEN** a sessão é de `ana` em `http://localhost:5017`, com `expiresAt` 30 min à frente
- **THEN** o elemento de nome acessível "Barra de status" mostra `http://localhost:5017`, com esse valor no `title`, e "Sessão válida por mais 30 min", e não tem `role="status"`

#### Scenario: Endereço longo
- **WHEN** o endereço da sessão é `https://agentes.exemplo.com.br/plataforma/buteco`
- **THEN** a barra mostra o endereço completo, sem abreviação no texto, e o `title` tem o mesmo valor

#### Scenario: Tempo esgotado
- **WHEN** o tempo restante chega a zero
- **THEN** a barra mostra o cadeado e "Sessão expirada" em `--mantine-color-red-text`, o banner aparece, a conversa continua visível, e nem `status()` nem `logout()` são chamados

#### Scenario: Tempo restante depois do novo login
- **WHEN** a sessão expirou e o novo login devolve `expiresAt` 30 min à frente
- **THEN** a barra volta a mostrar o relógio e "Sessão válida por mais 30 min"

#### Scenario: Cores da barra
- **WHEN** a barra é renderizada com a sessão válida e depois expirada
- **THEN** o fundo é `--mantine-color-body`, o texto do endereço e do tempo restante usa `--mantine-color-dimmed`, e "Sessão expirada" usa `--mantine-color-red-text`, cobertos pelos requisitos 'Texto secundário com contraste mínimo' e 'Cores de erro e de aviso com contraste mínimo' (validação de campo) de `identidade-visual`

#### Scenario: Ausente nas telas de login
- **WHEN** a tela de primeiro acesso ou a de acessos seguintes é renderizada
- **THEN** não há elemento com nome acessível "Barra de status"

## RENAMED Requirements

- FROM: `### Requirement: Copiar o contextId`
- TO: `### Requirement: Copiar o ID da conversa`

## MODIFIED Requirements

### Requirement: Layout da tela de conversas
Autenticado, o renderer SHALL mostrar a tela de conversas, com altura da janela:
- a área de trabalho, que ocupa toda a altura menos a barra de status: uma linha com a barra lateral à esquerda (288 px, superfície, borda à direita) e a área principal à direita;
- na área principal, o cabeçalho (superfície, borda inferior, padding 12×24), a timeline (coluna central de até 760 px, 18 px entre itens) e o composer (até 760 px);
- abaixo da área de trabalho, a barra de status, de largura total (requisito 'Barra de status').

Abaixo de 860 px de largura, a barra lateral MUST passar para cima da área principal, com largura total, e a lista de conversas MUST continuar visível, com altura máxima de 25% da altura da janela e rolagem própria. A barra de status MUST continuar no rodapé da janela, abaixo da área principal. A interface MUST usar os tokens do tema nos esquemas claro e escuro.

#### Scenario: Largura estreita
- **WHEN** a janela tem menos de 860 px de largura
- **THEN** a barra lateral aparece acima da área principal, com o campo "Buscar conversas" e a lista de conversas visíveis, e a barra de status continua como último elemento da tela, com largura total

#### Scenario: Barra de status fora da barra lateral
- **WHEN** a tela de conversas é renderizada na largura larga
- **THEN** a barra de status não está dentro da barra lateral nem da área principal, e vem depois das duas

### Requirement: Barra lateral
A barra lateral SHALL conter, nesta ordem:
1. a marca: o ícone do app de 24 px (requisito 'Ícone do app na interface' de `identidade-visual`), "Buteco" em peso 600 e "Chat" em cor secundária, 14 px;
2. o rótulo de seção "AGENTE" e o seletor de agente (34 px, raio 7 px);
3. o botão primário preenchido **Nova conversa**, largura total, 34 px, com ícone "+";
4. a busca e a lista de conversas (requisitos 'Busca de conversas' e 'Lista agrupada' de `historico-conversas`), que ocupam a altura entre **Nova conversa** e o rodapé;
5. o rodapé de sessão, separado por borda.

No seletor:
- cada agente aparece pelo nome;
- os inativos aparecem desabilitados, com o sufixo " (inativo)";
- o valor é o agente da conversa aberta;
- quando esse agente não está na lista carregada, ele MUST aparecer como item desabilitado, com o nome guardado na conversa e o sufixo " (inativo)";
- antes de a lista carregar, ou se ela falhar, o seletor MUST ficar desabilitado, mostrando o agente da conversa aberta, se houver;
- sem conversa guardada, a seleção inicial é o primeiro agente ativo da lista.

#### Scenario: Ordem e textos
- **WHEN** a tela de conversas aparece com agentes carregados
- **THEN** a barra lateral mostra, em ordem, "Buteco", "Chat", "AGENTE", o seletor, **Nova conversa**, o campo "Buscar conversas", a lista e o rodapé

#### Scenario: Marca na barra lateral
- **WHEN** a tela de conversas é renderizada
- **THEN** o topo da barra lateral tem o ícone do app de 24 px antes de "Buteco", e nenhum ícone de balão de conversa

#### Scenario: Agente inativo no seletor
- **WHEN** não há conversa guardada e a lista tem "Atendente" ativo e "Antigo" inativo
- **THEN** o seletor oferece "Antigo (inativo)" desabilitado e começa em "Atendente"

#### Scenario: Agente ausente no seletor
- **WHEN** a conversa aberta é do agente "Antigo", que não está na lista carregada
- **THEN** o seletor mostra "Antigo (inativo)", desabilitado na lista de opções

### Requirement: Rodapé de sessão
O rodapé da barra lateral SHALL ter padding 8×14 e mostrar, numa linha:
- um avatar circular de 30 px com as iniciais do usuário, a 10 px do nome;
- o nome do usuário em peso 500, truncado com reticências só quando não couber;
- o botão **Sair** só com ícone de saída e `aria-label="Sair"`.

O rodapé MUST NOT mostrar o endereço do serviço nem o tempo de sessão, que ficam na barra de status (requisito 'Barra de status').

**Sair** MUST interromper o polling e chamar `logout()`, e o app volta à tela de login com usuário e senha vazios. As conversas MUST continuar guardadas: um novo login no mesmo serviço mostra a mesma lista.

#### Scenario: Identificação
- **WHEN** a sessão é de `ana` em `http://localhost:5017`, com `expiresAt` 30 min à frente
- **THEN** o rodapé da barra lateral mostra o avatar "AN", "ana" e o botão "Sair", e não mostra `localhost:5017` nem "Sessão válida por mais 30 min"

#### Scenario: Nome longo
- **WHEN** o usuário é `joana_carvalho`
- **THEN** o texto do rodapé é `joana_carvalho` inteiro, sem host nem tempo ao lado, e na largura de 288 px o nome cabe sem reticências

#### Scenario: Sair
- **WHEN** o usuário clica no botão de nome acessível "Sair"
- **THEN** `logout()` é chamado e a tela de acessos seguintes aparece, com usuário e senha vazios

#### Scenario: Conversas mantidas depois do Sair
- **WHEN** o usuário tem conversas, clica em "Sair" e entra de novo no mesmo serviço
- **THEN** a lista mostra as mesmas conversas, e a área principal mostra a de última atividade mais recente

### Requirement: Cabeçalho da conversa
O cabeçalho SHALL mostrar:
- **o título** (15 px, peso 600, truncado):
  - antes do primeiro envio, "Nova conversa";
  - depois, os primeiros 40 caracteres da primeira mensagem, com quebras de linha e espaços em sequência trocados por um espaço e sem espaços nas pontas, seguidos de "…" quando a mensagem é mais longa;
- **abaixo do título**, em 12 px e cor secundária, quando a conversa começou, pelo horário local do envio da primeira mensagem, comparado ao dia de calendário local:
  - no mesmo dia, "Iniciada hoje às {HH:mm}";
  - no dia anterior, "Iniciada ontem às {HH:mm}";
  - antes disso, "Iniciada em {dd mmm} às {HH:mm}", com o mês abreviado sem ponto (jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez), seguido do ano quando ele não é o atual ("Iniciada em 15 out 2025 às 14:32");
  - sem mensagens, "Ainda sem mensagens";
- **ao lado**, só quando a conversa tem `contextId`, um "·" em cor secundária e o botão discreto **Copiar ID** (ícone de cópia e texto, 11 px, `aria-label="Copiar ID da conversa"`, `title` com o `contextId` completo), com 6 px entre o texto, o "·" e o botão;
- **à direita**, o nome do agente guardado na conversa num selo neutro e o selo **Ativo** (verde claro) ou **Inativo** (neutro). Enquanto a lista de agentes não carregou, ou se a primeira carga falhou, MUST aparecer só o selo com o nome, sem **Ativo** nem **Inativo**.

O cabeçalho MUST NOT mostrar como texto visível a palavra "contextId" nem o `contextId`, inteiro ou abreviado.

#### Scenario: Antes do primeiro envio
- **WHEN** a conversa ainda não teve envio
- **THEN** o título é "Nova conversa", aparece "Ainda sem mensagens", e não há "·" nem **Copiar ID**

#### Scenario: Iniciada hoje
- **WHEN** a primeira mensagem foi enviada hoje às 14:32 e a conversa tem o `contextId` `3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f`
- **THEN** o cabeçalho mostra "Iniciada hoje às 14:32", "·" e o botão de nome acessível "Copiar ID da conversa", com texto "Copiar ID" e `title` `3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f`

#### Scenario: Iniciada ontem
- **WHEN** hoje é 24/10/2026 e a primeira mensagem foi enviada em 23/10/2026 às 09:05
- **THEN** o cabeçalho mostra "Iniciada ontem às 09:05"

#### Scenario: Iniciada em outro dia do ano
- **WHEN** hoje é 24/10/2026 e a primeira mensagem foi enviada em 20/10/2026 às 18:40
- **THEN** o cabeçalho mostra "Iniciada em 20 out às 18:40"

#### Scenario: Iniciada em outro ano
- **WHEN** hoje é 24/10/2026 e a primeira mensagem foi enviada em 15/10/2025 às 14:32
- **THEN** o cabeçalho mostra "Iniciada em 15 out 2025 às 14:32"

#### Scenario: Primeiro envio sem contextId
- **WHEN** a primeira mensagem foi enviada hoje às 10:00 e o envio falhou antes de a plataforma devolver um `contextId`
- **THEN** o cabeçalho mostra "Iniciada hoje às 10:00", sem "·" e sem **Copiar ID**

#### Scenario: Sem o termo contextId
- **WHEN** a conversa aberta tem o `contextId` `3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f`
- **THEN** o texto visível do cabeçalho não contém "contextId", `3a7d9f10` nem `4e5f`

#### Scenario: Título da primeira mensagem
- **WHEN** a primeira mensagem tem 60 caracteres, com uma quebra de linha no meio
- **THEN** o título tem os 40 primeiros caracteres, sem a quebra, seguidos de "…"

#### Scenario: Agente ainda desconhecido
- **WHEN** a conversa guardada do agente "Atendente" está aberta e `agents.list()` ainda não respondeu
- **THEN** o cabeçalho mostra o selo "Atendente", sem **Ativo** nem **Inativo**

### Requirement: Copiar o ID da conversa
**Copiar ID** SHALL chamar `clipboard.writeText` com o `contextId` completo e trocar o texto visível do botão para "Copiado" por 1,5 s, voltando depois para "Copiar ID". O nome acessível MUST continuar "Copiar ID da conversa". Depois da cópia, uma região oculta com `aria-live="polite"` MUST anunciar "ID copiado", e o texto dela é limpo quando o botão volta a "Copiar ID".

#### Scenario: Copiado
- **WHEN** o usuário clica em **Copiar ID**
- **THEN** `clipboard.writeText` recebe o `contextId` completo, o botão mostra "Copiado", a região `aria-live="polite"` tem "ID copiado", e depois de 1,5 s o botão volta a "Copiar ID" e a região fica vazia

### Requirement: Conversa vazia
Antes do primeiro envio, a área da timeline SHALL mostrar um cartão centralizado com:
- o rótulo "NOVA CONVERSA COM";
- o nome do agente (17 px, peso 600);
- a descrição em cor secundária, omitida quando `null`;
- as skills como selos neutros;
- a nota "A conversa entra no histórico depois da primeira mensagem." (12 px, cor secundária).

O cartão MUST NOT mostrar a palavra "contextId".

#### Scenario: Cartão do agente
- **WHEN** o agente selecionado é "Atendente", com descrição "Responde dúvidas" e as skills "Resumo" e "Tradução", e a conversa está vazia
- **THEN** o cartão mostra "NOVA CONVERSA COM", "Atendente", "Responde dúvidas", os selos "Resumo" e "Tradução" e a nota "A conversa entra no histórico depois da primeira mensagem.", sem "contextId"

### Requirement: Sessão expirada durante o uso
O renderer SHALL entrar no estado de sessão expirada, sem sair da tela de conversas, quando:
- qualquer chamada de `agents.list`, `chat.send` ou `chat.getTask` devolve `unauthorized`, inclusive com tempo restante na barra de status (token recusado pela plataforma);
- o tempo restante da barra de status chega a zero.

Nesse estado:
- as conversas, as mensagens, os `contextId` e a lista de agentes carregada MUST ser mantidos;
- o renderer MUST NOT chamar `auth.logout()` nem voltar à tela de login;
- o polling MUST ser interrompido, sem nenhuma consulta agendada;
- nenhuma chamada a `chat.send` MUST acontecer até o novo login;
- abrir uma conversa cujo último turno está pendente MUST guardar a task para a retomada, sem consulta, com a pílula "Aguardando novo login para retomar".

Entrar no estado já estando nele MUST NOT mudar nada além do que fica guardado para a retomada (requisito 'Retomada depois do novo login'). Um `chat.send` já em andamento ao entrar no estado MUST ter o resultado aproveitado: com sucesso, a task devolvida fica guardada para retomar o polling, sem consulta até o novo login.

#### Scenario: 401 durante o polling
- **WHEN** uma consulta da task devolve `unauthorized`
- **THEN** nenhuma consulta é agendada, `auth.logout()` não é chamado, a conversa continua visível e o banner "Sua sessão expirou." aparece

#### Scenario: Token recusado com tempo restante
- **WHEN** a barra de status mostra "Sessão válida por mais 20 min" e `chat.send` devolve `unauthorized`
- **THEN** a barra de status mostra "Sessão expirada" e o banner aparece

#### Scenario: Envio em andamento quando o contador chega a zero
- **WHEN** um `chat.send` está em andamento, o tempo restante chega a zero e o envio então devolve a task `9f8e7d6c-…` em `TASK_STATE_SUBMITTED`
- **THEN** nenhuma consulta é feita, a pílula mostra "Aguardando novo login para retomar" e `task 9f8e7d6c · Submitted`, e depois do novo login o polling dessa task começa sem novo `chat.send`

#### Scenario: Abrir uma conversa pendente na sessão expirada
- **WHEN** a sessão está expirada e o usuário abre uma conversa cujo último turno está pendente na task `9f8e7d6c-…`
- **THEN** `chat.getTask` não é chamado, e a pílula mostra "Aguardando novo login para retomar" e `task 9f8e7d6c · Working`

### Requirement: Banner de sessão expirada
Na sessão expirada, o renderer SHALL mostrar um banner acima do composer, dentro da coluna de até 760 px, com:
- fundo `--mantine-color-yellow-light`, texto em `--buteco-color-warning-text`, raio 9 px e `role="alert"`;
- um ícone de cadeado;
- o título "Sua sessão expirou." em peso 600;
- uma linha explicativa em `--mantine-color-text`;
- o botão primário preenchido **Entrar novamente**, que abre o modal de novo login.

A linha explicativa MUST depender do que está guardado para a retomada:
- **resposta pendente** (polling interrompido): "A resposta em andamento continua sendo processada. Entre de novo para retomá-la — nada será reenviado.";
- **envio retido** (401 no `chat.send`): "Sua mensagem ainda não foi enviada. Entre de novo para enviá-la — ela será enviada uma única vez.";
- **nada em andamento**, com ou sem conversa: "Entre de novo para continuar."

A barra de status MUST trocar o relógio e "Sessão válida por mais {n} min" pelo cadeado e "Sessão expirada" (11 px, `--mantine-color-red-text`, peso 500), mantendo o endereço do serviço. O rodapé da barra lateral continua com avatar, usuário e **Sair**.

#### Scenario: Banner com resposta pendente
- **WHEN** a sessão expira com uma task em `TASK_STATE_WORKING`
- **THEN** um elemento com `role="alert"` mostra "Sua sessão expirou.", "A resposta em andamento continua sendo processada. Entre de novo para retomá-la — nada será reenviado." e **Entrar novamente**

#### Scenario: Banner com envio retido
- **WHEN** `chat.send` devolve `unauthorized`
- **THEN** o banner mostra "Sua mensagem ainda não foi enviada. Entre de novo para enviá-la — ela será enviada uma única vez."

#### Scenario: Banner sem nada em andamento
- **WHEN** o tempo restante chega a zero com a última resposta já concluída
- **THEN** o banner mostra "Entre de novo para continuar.", a barra de status mostra "Sessão expirada" e o endereço do serviço, e o rodapé da barra lateral continua com o usuário e "Sair"

### Requirement: Retomada depois do novo login
Depois de um novo login bem-sucedido no modal, o renderer SHALL, uma única vez:
- fechar o modal e tirar o banner;
- voltar a barra de status a "Sessão válida por mais {n} min", com o `expiresAt` novo;
- liberar o composer e as ações bloqueadas;
- retomar o que estava guardado, em todas as conversas:
  - **resposta pendente** (401 no `chat.getTask`, envio que deu certo durante a expiração, ou conversa pendente aberta durante a expiração): na conversa aberta, retomar o polling da **mesma** task, com prazo novo de 90 s a partir da retomada, sem chamar `chat.send`. Nas outras conversas, o turno volta a pendente e o polling é retomado quando a conversa for aberta;
  - **envio retido** (401 no `chat.send`): chamar `chat.send` uma única vez com o mesmo texto e o `contextId` atual da conversa a que o turno pertence (`null` se ela ainda não tinha), sem repetir o balão do usuário, mesmo que essa conversa não esteja aberta;
  - **lista de agentes** (401 em `agents.list`): chamar `agents.list()` de novo. Uma lista que nunca carregou é refeita como primeira carga.

Turnos e uma recarga da lista guardados juntos MUST ser retomados todos, cada um uma vez. Um segundo evento de sucesso sem nova expiração MUST NOT retomar nada. Um 401 no `chat.getTask` feito por **Reenviar** antes de reenviar (prazo esgotado) MUST devolver o turno ao estado "sem resposta a tempo", sem retomada automática.

O texto do banner e o subtítulo do modal MUST seguir o que está guardado na conversa aberta.

Um `unauthorized` de uma chamada iniciada **antes** do novo login MUST NOT expirar a sessão de novo:
- `chat.send`: a mensagem não foi registrada e MUST ser enviada uma única vez com o token novo, com o mesmo texto e o `contextId` atual;
- `agents.list`: a lista MUST ser carregada de novo;
- `chat.getTask` prévio de **Reenviar**: o turno volta a "sem resposta a tempo";
- `chat.getTask` do polling: a resposta MUST ser descartada, e o polling retomado continua.

#### Scenario: Retomada do polling no mesmo taskId
- **WHEN** a consulta da task `9f8e7d6c-…` devolve `unauthorized` e o novo login dá certo
- **THEN** o banner some, a próxima consulta é `chat.getTask` da mesma task, e `chat.send` não é chamado

#### Scenario: Prazo novo na retomada
- **WHEN** a task estava pendente havia 80 s, o novo login leva 5 min e a task continua `TASK_STATE_WORKING` depois da retomada
- **THEN** o turno só vai para "sem resposta a tempo" 90 s depois da retomada, e não na primeira consulta

#### Scenario: Reenvio único depois de 401 no envio
- **WHEN** a segunda mensagem da conversa recebe `unauthorized` no `chat.send` e o novo login dá certo
- **THEN** `chat.send` é chamado uma única vez com o mesmo texto e o `contextId` da conversa, e a timeline continua com um único balão dessa mensagem

#### Scenario: Envio retido em outra conversa
- **WHEN** o envio da conversa A recebe `unauthorized`, o usuário abre a conversa B durante a expiração e o novo login dá certo
- **THEN** `chat.send` é chamado uma única vez com o texto e o `contextId` de A, e B continua aberta

#### Scenario: Task guardada em outra conversa
- **WHEN** a consulta da conversa A devolve `unauthorized`, o usuário abre a conversa B e o novo login dá certo
- **THEN** nenhuma consulta da task de A acontece até o usuário abrir A, e então a próxima chamada é `chat.getTask` dessa task

#### Scenario: Dois logins seguidos
- **WHEN** o reenvio da mensagem retida já começou depois de um novo login e o renderer recebe outro sucesso de login sem nova expiração
- **THEN** `chat.send` continua chamado uma única vez

#### Scenario: Recarga da lista depois do login
- **WHEN** a recarga da lista depois de um `TASK_STATE_REJECTED` devolve `unauthorized` e o novo login dá certo
- **THEN** `agents.list()` é chamado de novo e a lista anterior continua no seletor até a resposta

#### Scenario: 401 na primeira carga
- **WHEN** não há conversa guardada e a primeira chamada a `agents.list()` devolve `unauthorized`
- **THEN** aparece o banner com "Entre de novo para continuar.", o modal não tem subtítulo, a área principal não mostra "Carregando agentes…" nem o bloco de erro, e depois do novo login aparece "Carregando agentes…" e a conversa vazia do primeiro agente ativo

#### Scenario: Envio antigo recusado depois do novo login
- **WHEN** um `chat.send` está em andamento, o tempo restante chega a zero, o novo login dá certo e só então o envio antigo devolve `unauthorized`
- **THEN** o banner e o modal não voltam, `chat.send` é chamado de novo uma única vez com o mesmo texto e o mesmo `contextId`, e a timeline continua com um único balão

#### Scenario: Lista antiga recusada depois do novo login
- **WHEN** uma recarga da lista está em andamento, a sessão expira, o novo login dá certo e só então a recarga devolve `unauthorized`
- **THEN** o banner não volta e `agents.list()` é chamado de novo

#### Scenario: Consulta prévia de Reenviar recusada depois do novo login
- **WHEN** o `chat.getTask` prévio de **Reenviar** está em andamento, a sessão expira, o novo login dá certo e só então a consulta devolve `unauthorized`
- **THEN** o banner não volta, o turno mostra "O agente não respondeu a tempo." e `chat.send` não é chamado

#### Scenario: Consulta antiga do polling recusada depois do novo login
- **WHEN** uma consulta da task está em andamento, o tempo restante chega a zero, o novo login dá certo e só então a consulta antiga devolve `unauthorized`
- **THEN** o banner não volta e o polling da mesma task continua

#### Scenario: Lista e task juntas
- **WHEN** a sessão expira com uma task pendente e uma recarga da lista também devolve `unauthorized`, e um único novo login dá certo
- **THEN** o polling da task é retomado e `agents.list()` é chamado, cada um uma vez

#### Scenario: Reenviar depois do prazo com sessão expirada
- **WHEN** o prazo esgotou, o usuário clica em **Reenviar** e a consulta prévia da task original devolve `unauthorized`
- **THEN** o turno volta ao bloco "O agente não respondeu a tempo.", `chat.send` não é chamado, e depois do novo login nada é retomado automaticamente

### Requirement: Ações durante a sessão expirada
Na sessão expirada, o renderer SHALL manter liberadas e bloquear as ações abaixo:
- **liberadas**: **Copiar ID** do cabeçalho, a rolagem e a leitura da timeline, a busca e a seleção de conversas na lista, **Sair** e **Entrar novamente**;
- **bloqueadas** (desabilitadas, sem sumir): o composer, **Reenviar** e **Continuar aguardando** dos blocos de estado, o seletor de agente, **Nova conversa** e **Excluir conversa**.

**Sair** MUST interromper tudo, chamar `auth.logout()` e mostrar a tela de login com usuário e senha vazios. As conversas continuam guardadas, e o que estava guardado para a retomada passa pela normalização ao reabrir (requisito 'Normalização ao reabrir' de `historico-conversas`) no próximo login.

#### Scenario: Ações bloqueadas
- **WHEN** a sessão expira com a última tentativa em "sem resposta a tempo"
- **THEN** **Reenviar**, **Continuar aguardando**, o seletor de agente, **Nova conversa** e os botões **Excluir conversa** estão desabilitados

#### Scenario: Copiar ID continua disponível
- **WHEN** a sessão está expirada e o usuário clica em **Copiar ID** no cabeçalho
- **THEN** `clipboard.writeText` é chamado com o `contextId` completo e aparece "Copiado"

#### Scenario: Ler outra conversa durante a expiração
- **WHEN** a sessão está expirada e o usuário busca e seleciona outra conversa
- **THEN** a timeline dela aparece, e o banner e o composer bloqueado continuam

#### Scenario: Sair durante a sessão expirada
- **WHEN** a sessão está expirada com uma resposta pendente guardada e o usuário clica em "Sair"
- **THEN** `auth.logout()` é chamado, a tela de login aparece, nenhuma consulta nem envio acontece depois, e um novo login no mesmo serviço mostra a conversa com a resposta pendente
