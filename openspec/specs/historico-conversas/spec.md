# historico-conversas Specification

## Purpose

Guardar no computador as conversas com os agentes, separadas por endereço de serviço: o formato gravado, a gravação nos eventos estruturais, a leitura defensiva, o limite de conversas e de espaço e a normalização ao reabrir; a lista da barra lateral, com busca, grupos por data, seleção, criação e exclusão; a conversa aberta ao entrar e a retomada de uma resposta pendente.

## Requirements

### Requirement: Histórico guardado por serviço
O renderer SHALL guardar as conversas em `localStorage['buteco-chat:sessions:<baseUrl>']`, em que `<baseUrl>` é o endereço normalizado da sessão (`SessionInfo.serviceUrl`). A lista da barra lateral MUST mostrar só as conversas da chave do serviço da sessão atual. A chave MUST NOT incluir o usuário.

#### Scenario: Serviços separados
- **WHEN** há conversas guardadas em `buteco-chat:sessions:http://localhost:5017` e em `buteco-chat:sessions:https://host/buteco`, e a sessão é de `https://host/buteco`
- **THEN** a lista mostra só as conversas de `https://host/buteco`

#### Scenario: Troca de serviço pelo Sair
- **WHEN** o usuário sai, entra em outro serviço e depois volta ao primeiro
- **THEN** a lista mostra as conversas do outro serviço e, na volta, as do primeiro de novo

### Requirement: Conteúdo gravado
O valor da chave SHALL ser o JSON `{ "version": 1, "conversations": [...] }`. Cada conversa MUST guardar:
- o id local;
- o `AgentSummary` com que começou (`id`, `name`, `description`, `isActive`, `skills`);
- o `contextId` (`null` até o primeiro envio que o devolve);
- o título;
- as datas de criação e de última atividade;
- os turnos, cada um com o id, o texto, o horário de envio e a tentativa, com o `taskId`, o estado e o que a linha de metadados usa.

Só conversas com ao menos uma mensagem MUST ser gravadas. Nenhum token, senha ou campo de sessão MUST ser gravado.

#### Scenario: Conversa gravada depois da resposta
- **WHEN** o usuário envia "Olá" ao agente "Atendente" e a task `1a2b3c4d-…` completa com o `contextId` `3a7d9f10-…`
- **THEN** a chave do serviço tem `version: 1` e uma conversa com o agente "Atendente", o `contextId` `3a7d9f10-…`, o título "Olá" e um turno com o texto "Olá", a task `1a2b3c4d-…` e o texto da resposta

#### Scenario: Sem token nem senha
- **WHEN** a sessão expira, o usuário entra de novo no modal com a senha `s3nh@` e continua a conversa
- **THEN** nenhum valor do `localStorage` contém `s3nh@`, e nenhuma conversa gravada tem campo `token`, `password` ou `expiresAt`

#### Scenario: Rascunho não é gravado
- **WHEN** o usuário clica em **Nova conversa** e não envia nada
- **THEN** a conversa nova aparece na lista, e a chave do serviço não a contém

### Requirement: Gravação nos eventos estruturais
O renderer SHALL gravar a chave do serviço, de forma síncrona, quando:
- um turno é criado;
- a tentativa de um turno muda de tipo, ou o estado de uma resposta pendente muda (`Submitted` → `Working`);
- o `contextId` da conversa é gravado;
- o título é fixado;
- uma conversa é excluída.

Uma consulta do polling que devolve o mesmo estado da anterior MUST NOT gravar. Leitura e escrita MUST estar em `try/catch`. Sem armazenamento disponível, o app MUST funcionar com as conversas só em memória.

#### Scenario: Consulta repetida não grava
- **WHEN** a task fica em `TASK_STATE_WORKING` por cinco consultas seguidas
- **THEN** `localStorage.setItem` é chamado uma vez para a mudança para `Working`, e não a cada consulta

#### Scenario: Armazenamento indisponível
- **WHEN** `localStorage.getItem` e `setItem` lançam erro
- **THEN** a tela de conversas abre com o rascunho do primeiro agente ativo, e o envio e a resposta funcionam normalmente

### Requirement: Leitura defensiva do histórico
Ao abrir a tela de conversas, o renderer SHALL ler a chave do serviço assim:
- **ausente**: lista vazia;
- **JSON inválido**, sem `version` inteiro ou com `version` menor que 1: o texto MUST ser copiado para `buteco-chat:sessions-corrupt:<baseUrl>`, e a lista começa vazia. Se a gravação da cópia falhar, o app MUST seguir sem ela;
- **`version` maior que 1**: a lista começa vazia, e a chave MUST NOT ser gravada enquanto a tela estiver aberta;
- **`version: 1`**: cada conversa MUST ser validada, e uma conversa inválida (campo ausente ou de tipo errado, id repetido, `agent.id` que não é GUID, `contextId` ou `taskId` inválido, turno inválido, texto acima de 16 000 caracteres ou nenhum turno) MUST ser descartada sem invalidar as outras.

#### Scenario: JSON corrompido
- **WHEN** a chave do serviço contém `{"version":1,"conv`
- **THEN** a tela abre sem histórico, `buteco-chat:sessions-corrupt:<baseUrl>` contém `{"version":1,"conv`, e o primeiro envio grava a chave do serviço com a conversa nova

#### Scenario: Cópia sem espaço
- **WHEN** a chave do serviço está corrompida e a gravação da cópia lança `QuotaExceededError`
- **THEN** a tela abre sem histórico e o envio funciona normalmente

#### Scenario: Versão desconhecida
- **WHEN** a chave do serviço tem `version: 2`
- **THEN** a tela abre sem histórico, e depois de um envio e da resposta a chave continua com o valor original

#### Scenario: Conversa inválida descartada sozinha
- **WHEN** a chave tem duas conversas, uma com `contextId: "../x"` e outra válida
- **THEN** a lista mostra só a válida

### Requirement: Limite de conversas e de espaço
O renderer SHALL manter no máximo 100 conversas por serviço. Ao gravar com mais de 100, as de última atividade mais antiga MUST sair até sobrarem 100, nunca a aberta.

Quando a gravação falha com `QuotaExceededError`, o renderer MUST, nesta ordem e tentando gravar de novo depois de cada passo:
1. remover todas as chaves `buteco-chat:sessions-corrupt:*`;
2. remover, uma por vez, a conversa de última atividade mais antiga entre as chaves `buteco-chat:sessions:*` de `version: 1` de todos os serviços, nunca a conversa aberta.

Se só restar a conversa aberta e a gravação ainda falhar, as conversas MUST continuar em memória, e a próxima gravação MUST tentar de novo. Uma conversa removida do serviço atual MUST sair também da lista.

#### Scenario: Teto de 100
- **WHEN** há 100 conversas guardadas e o usuário envia a primeira mensagem de uma conversa nova
- **THEN** a chave tem 100 conversas, sem a de última atividade mais antiga, e a lista também não a mostra

#### Scenario: Cota esgotada
- **WHEN** a gravação lança `QuotaExceededError` até a remoção da cópia corrompida e da conversa mais antiga de outro serviço
- **THEN** a cópia corrompida sai primeiro, depois a conversa de outro serviço, e a gravação seguinte dá certo com a conversa aberta

#### Scenario: Conversa aberta maior que a cota
- **WHEN** só resta a conversa aberta e a gravação continua lançando `QuotaExceededError`
- **THEN** a conversa continua na tela e na lista, sem nenhum erro visível

### Requirement: Normalização ao reabrir
Ao ler as conversas guardadas, o renderer SHALL trocar a última tentativa de cada turno assim:
- **envio em andamento** (`sending`): bloco de falha "Não foi possível confirmar o envio da mensagem." com a linha "O app foi fechado durante o envio." e **Reenviar**;
- **envio retido** pela sessão expirada: bloco de falha "A mensagem não foi enviada." com a linha "A sessão terminou antes do envio. Você pode enviá-la de novo." e **Reenviar**;
- **task guardada** pela sessão expirada: resposta pendente, com a mesma task e o mesmo estado;
- os demais estados ficam como estão.

**Reenviar** nos dois blocos novos MUST fazer um `chat.send` novo, com o mesmo texto e o `contextId` da conversa, sem repetir o balão do usuário. A normalização MUST NOT mudar a última atividade.

#### Scenario: Envio interrompido
- **WHEN** o app fecha com um turno em envio e é aberto de novo
- **THEN** a conversa mostra "Não foi possível confirmar o envio da mensagem." e "O app foi fechado durante o envio.", e **Reenviar** chama `chat.send` com o mesmo texto e o `contextId` da conversa

#### Scenario: Envio retido não sai sozinho
- **WHEN** o app fecha com a sessão expirada e uma mensagem retida, e o usuário entra de novo pela tela de login
- **THEN** a conversa mostra "A mensagem não foi enviada." com **Reenviar**, e `chat.send` não é chamado até o clique

#### Scenario: Task guardada vira pendente
- **WHEN** o app fecha com a sessão expirada e a task `9f8e7d6c-…` guardada, e o usuário entra de novo
- **THEN** ao abrir a conversa aparece "Processando" com `task 9f8e7d6c · Working`, e a próxima chamada é `chat.getTask` dessa task

### Requirement: Retomada da resposta pendente ao abrir
Só a conversa aberta SHALL ter a resposta pendente acompanhada. Abrir uma conversa cujo último turno está pendente MUST retomar o polling da mesma task, com prazo novo de 90 s a partir da abertura, sem chamar `chat.send`. Ao abrir a tela de conversas, MUST NOT haver consulta das conversas que não estão abertas. Um turno em "sem resposta a tempo" MUST NOT ser retomado sozinho.

#### Scenario: Reabrir com a resposta pronta
- **WHEN** o app fecha com a task `9f8e7d6c-…` pendente, a task completa no servidor, e o app é aberto de novo
- **THEN** a conversa abre, `chat.getTask` da task `9f8e7d6c-…` devolve `TASK_STATE_COMPLETED` e a resposta aparece, sem `chat.send`

#### Scenario: Prazo novo ao reabrir
- **WHEN** a task foi enviada há 10 min e continua `TASK_STATE_WORKING` depois da reabertura
- **THEN** o turno só vai para "sem resposta a tempo" 90 s depois da abertura

#### Scenario: Só a conversa aberta é consultada
- **WHEN** há duas conversas com resposta pendente e a tela abre
- **THEN** `chat.getTask` só é chamado para a task da conversa aberta

### Requirement: Resultado na conversa de origem
O resultado de um `chat.send` e de um `chat.getTask` SHALL ser gravado na conversa que fez a chamada, mesmo que outra esteja aberta quando ele chega:
- o `contextId` devolvido vai para a conversa de origem;
- com estado não terminal e a origem fechada, o turno fica pendente, sem consulta, até a conversa ser aberta;
- com estado terminal, o turno vai ao estado final.

O polling MUST consultar a task com o agente da conversa a que ela pertence. Um resultado de uma conversa excluída MUST ser descartado.

#### Scenario: Trocar de conversa durante o envio
- **WHEN** o usuário envia a primeira mensagem da conversa A, abre a conversa B antes da resposta, e o envio devolve a task `9f8e7d6c-…` em `TASK_STATE_SUBMITTED` com o `contextId` `3a7d9f10-…`
- **THEN** B continua sem esse `contextId`, nenhuma consulta é feita, e ao voltar para A o cabeçalho mostra `3a7d9f10…` e a próxima chamada é `chat.getTask` da task `9f8e7d6c-…` com o agente de A

#### Scenario: Envio rejeitado com a origem fechada
- **WHEN** o envio da conversa A devolve `TASK_STATE_REJECTED` enquanto B está aberta
- **THEN** ao voltar para A aparece o bloco "O agente não aceitou a mensagem: pode estar inativo ou sem modelo configurado."

### Requirement: Última atividade e ordem da lista
A última atividade de uma conversa SHALL ser o horário local:
- do envio de uma mensagem (mensagem nova, **Reenviar** ou envio retido que sai depois do novo login);
- da chegada de um estado terminal (`COMPLETED`, `FAILED` ou `REJECTED`), pela resposta do envio, pelo polling ou pela consulta prévia de **Reenviar**.

Uma conversa nova começa com a última atividade igual à criação. Abrir uma conversa, buscar, retomar o polling, a mudança de `Submitted` para `Working`, o prazo esgotado, as falhas de envio ou de consulta e a normalização ao reabrir MUST NOT mudar a última atividade. A lista SHALL ser ordenada pela última atividade, da mais recente para a mais antiga.

#### Scenario: Resposta faz a conversa subir
- **WHEN** a lista tem A acima de B, e uma resposta de B chega
- **THEN** B passa para cima de A

#### Scenario: Abrir e retomar não mudam a ordem
- **WHEN** a lista tem A acima de B, e o usuário abre B, cuja task continua `TASK_STATE_WORKING` depois da retomada
- **THEN** A continua acima de B

#### Scenario: Prazo esgotado não muda a ordem
- **WHEN** a lista tem A acima de B, e a task de B vai para "sem resposta a tempo"
- **THEN** A continua acima de B

### Requirement: Conversa aberta ao entrar
Ao abrir a tela de conversas, o renderer SHALL abrir a conversa de última atividade mais recente do serviço, sem esperar a lista de agentes. Sem conversas guardadas, MUST abrir uma conversa nova com o primeiro agente ativo da lista, quando ela carregar. Ao abrir uma conversa, a timeline MUST rolar até o fim.

#### Scenario: Última conversa aberta
- **WHEN** há conversas guardadas e a tela abre
- **THEN** a área principal mostra a conversa de última atividade mais recente, e o item dela na lista tem `aria-current="true"`

#### Scenario: Conversa visível antes da lista
- **WHEN** há conversas guardadas e `agents.list()` ainda não respondeu
- **THEN** a timeline da conversa aparece, sem "Carregando agentes…" na área principal

### Requirement: Conversa nova na lista
Uma conversa sem mensagens SHALL aparecer na lista, com o título "Nova conversa", no topo de **Hoje**, e só é gravada no primeiro envio. MUST existir no máximo uma conversa sem mensagens: abrir outra conversa com ela aberta a remove da lista. A conversa sem mensagens MUST NOT ter **Excluir**.

#### Scenario: Nova conversa no topo
- **WHEN** a conversa aberta tem mensagens e o usuário clica em **Nova conversa**
- **THEN** o item "Nova conversa" aparece no topo de **Hoje**, com `aria-current="true"`, e a área principal mostra o cartão da conversa vazia

#### Scenario: Conversa vazia removida ao sair dela
- **WHEN** a conversa aberta é "Nova conversa", sem mensagens, e o usuário seleciona outra conversa
- **THEN** o item "Nova conversa" sai da lista

### Requirement: Busca de conversas
Acima da lista, a barra lateral SHALL ter o campo de busca: 34 px, raio 7 px, fundo `--mantine-color-default-hover`, ícone de lupa à esquerda em cor secundária, placeholder "Buscar conversas" e nome acessível "Buscar conversas". A busca MUST filtrar pelo título exibido, por "contém", sem diferenciar maiúsculas, minúsculas nem acentos, ignorando espaços nas pontas. A busca vazia mostra todas as conversas. Sem resultado, a lista MUST mostrar "Nenhuma conversa encontrada." em cor secundária.

#### Scenario: Busca sem acento
- **WHEN** há as conversas "Situação do pedido" e "Resumo da reunião", e o usuário digita "SITUACAO"
- **THEN** a lista mostra só "Situação do pedido"

#### Scenario: Sem resultado
- **WHEN** o usuário digita um texto que não está em nenhum título
- **THEN** a lista mostra "Nenhuma conversa encontrada." e nenhum rótulo de grupo

### Requirement: Lista agrupada
Abaixo da busca, separada por uma borda fina, a barra lateral SHALL ter a lista rolável de conversas (padding 4×8), em grupos pela data local da última atividade:
- **Hoje**: o mesmo dia, ou uma data futura;
- **Ontem**: o dia anterior;
- **Esta semana**: de 2 a 6 dias atrás;
- **Anteriores**: 7 dias ou mais.

Cada grupo MUST ter o rótulo de seção (11 px, caixa alta, `letter-spacing: 0.05em`, cor secundária, padding 12×8×6) e MUST aparecer só quando tem itens.

#### Scenario: Grupos com itens
- **WHEN** hoje é sábado, 24/10/2026, e há conversas com última atividade hoje, ontem, na terça-feira (20/10) e em 15/10
- **THEN** aparecem os rótulos "Hoje", "Ontem", "Esta semana" e "Anteriores", nessa ordem, cada um com a sua conversa

#### Scenario: Grupo vazio escondido
- **WHEN** todas as conversas têm última atividade hoje
- **THEN** só aparece o rótulo "Hoje"

### Requirement: Item da lista
Cada conversa SHALL ser um botão de largura total, com padding 8×10 e raio 7 px, e duas linhas truncadas:
- o título ("Nova conversa" antes do primeiro envio);
- em 11 px, "{agente} · {horário}", com o nome do agente guardado na conversa.

O horário MUST ser:
- **Hoje**: `HH:mm`;
- **Ontem**: "ontem";
- **Esta semana**: o dia da semana abreviado, sem ponto: dom, seg, ter, qua, qui, sex ou sáb;
- **Anteriores**: `dd mmm`, com o mês abreviado sem ponto (jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez), seguido do ano quando ele não é o atual.

O item da conversa aberta MUST ter fundo `--mantine-color-butecoBlue-light`, texto em `--buteco-color-accent-text`, título em peso 500 e `aria-current="true"`. Os outros MUST ter fundo transparente, hover `--mantine-color-default-hover` e o horário em cor secundária. Selecionar um item MUST abrir a conversa na área principal.

#### Scenario: Horários por grupo
- **WHEN** hoje é sábado, 24/10/2026, e há conversas com última atividade hoje às 09:05, ontem, em 20/10/2026, em 15/10/2026 e em 15/10/2025
- **THEN** os horários são "09:05", "ontem", "ter", "15 out" e "15 out 2025"

#### Scenario: Item ativo
- **WHEN** o usuário seleciona a conversa "Resumo da reunião", do agente "Atendente"
- **THEN** o item dela tem `aria-current="true"` e "Atendente · {horário}", e a área principal mostra a timeline dela

#### Scenario: Agente que sumiu da plataforma
- **WHEN** uma conversa guardada é do agente "Antigo", que não está mais na lista de agentes
- **THEN** o item mostra "Antigo · {horário}"

### Requirement: Excluir conversa
Cada item com mensagens SHALL ter um botão só com ícone de lixeira, com nome acessível "Excluir conversa {título}", visível no hover e no foco dentro do item, e alcançável pelo teclado. O clique MUST abrir um modal com:
- "Excluir esta conversa? Ela será apagada deste computador e não poderá ser recuperada.";
- quando o último turno tem resposta pendente, em envio, sem resposta a tempo ou aguardando novo login, mais: "A resposta pendente será descartada: a task continua no servidor, mas o app deixa de acompanhá-la.";
- os botões **Cancelar** e **Excluir conversa**, este em vermelho preenchido (`--mantine-color-red-filled`).

**Excluir conversa** MUST remover a conversa da lista e da chave do serviço. Se ela estava aberta, o polling MUST parar e a área principal MUST mostrar uma conversa nova com o mesmo agente. O resultado de uma chamada em andamento da conversa excluída MUST ser descartado. **Cancelar** fecha o modal sem mudar nada.

#### Scenario: Excluir outra conversa
- **WHEN** a conversa A está aberta e o usuário exclui a conversa B
- **THEN** B sai da lista e da chave do serviço, e A continua aberta

#### Scenario: Excluir a conversa aberta
- **WHEN** o usuário exclui a conversa aberta, do agente "Atendente"
- **THEN** a conversa sai da lista e da chave, e a área principal mostra o cartão "NOVA CONVERSA COM" "Atendente"

#### Scenario: Excluir com resposta pendente
- **WHEN** a conversa aberta tem a task `9f8e7d6c-…` pendente e o usuário clica na lixeira
- **THEN** o modal mostra também "A resposta pendente será descartada: a task continua no servidor, mas o app deixa de acompanhá-la.", e depois de **Excluir conversa** nenhuma consulta da task acontece

#### Scenario: Envio em andamento de uma conversa excluída
- **WHEN** o envio da conversa A está em andamento, o usuário exclui A, e o envio então devolve uma task
- **THEN** A não volta à lista, a chave não a contém e nenhuma consulta é feita

#### Scenario: Cancelar a exclusão
- **WHEN** o usuário clica na lixeira e depois em **Cancelar**
- **THEN** o modal fecha e a conversa continua na lista e na chave
