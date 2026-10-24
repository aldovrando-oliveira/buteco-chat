## Why

Hoje a conversa existe só em memória. **Nova conversa**, a troca de agente, o **Sair** e qualquer recarga do renderer apagam a conversa sem volta, por isso a `conversa-a2a` pede confirmação antes de descartar. Uma resposta pendente também se perde quando o app fecha, embora a task continue no servidor.

Esta é a quinta e última change do fatiamento. Cada conversa passa a ficar guardada no computador, separada por endereço de serviço, aparece na barra lateral, pode ser buscada e reaberta, e uma resposta pendente é retomada ao reabrir. A persistência segue o documento de construção: chave `buteco-chat:sessions:<serviço normalizado>`, porque um `contextId` só existe no servidor que o criou.

## What Changes

- **Persistência local por serviço** em `localStorage['buteco-chat:sessions:<baseUrl>']`, no formato versionado `{ version: 1, conversations }`:
  - cada conversa guarda o id local, o `AgentSummary` com que começou, o `contextId`, o título, as datas de criação e de última atividade, e os turnos com a tentativa;
  - nenhum token ou senha é gravado;
  - a gravação é síncrona e só nos eventos estruturais;
  - a leitura é defensiva: JSON corrompido vai para uma cópia `:corrupt`, uma versão maior que a conhecida deixa o serviço em modo só-memória, e itens inválidos são descartados um a um;
  - o app funciona com o armazenamento vazio ou indisponível;
  - cota: teto de 100 conversas por serviço; com `QuotaExceededError`, a cópia `:corrupt` sai primeiro e depois as conversas mais antigas de qualquer serviço, nunca a aberta.
- **Normalização ao reabrir**: `sending` vira "Não foi possível confirmar o envio da mensagem." com a linha "O app foi fechado durante o envio."; o envio retido por `awaiting-login` vira o bloco novo "A mensagem não foi enviada."; uma task guardada volta a pendente e é retomada.
- **Barra lateral do protótipo**: busca "Buscar conversas" e lista rolável com os grupos **Hoje**, **Ontem**, **Esta semana** e **Anteriores**, item ativo, estado "Nenhuma conversa encontrada." e **Excluir conversa** (lixeira no hover/foco, com modal de confirmação). Abaixo de 860 px, a lista aparece com altura máxima de ~30vh, em vez de ficar escondida.
- **Várias conversas**: selecionar um item abre a conversa. Ao entrar na tela, abre a conversa com a última atividade mais recente. Um único poller acompanha a conversa aberta; trocar de conversa pausa o polling sem descartar nada, e voltar retoma a mesma task com prazo novo.
- **Endereçamento por conversa**: o resultado de um `chat.send`, o `contextId` e a resposta de uma consulta vão para a conversa de origem, mesmo que outra esteja aberta.
- **Agente "desconhecido"** enquanto a lista carrega ou falha: a conversa guardada fica legível, com um placeholder neutro no composer, sem o selo **Inativo**.
- **Nova conversa e troca de agente sem modal**: a conversa anterior continua na lista. Com a aberta vazia, **Nova conversa** não cria outra, e a troca de agente muda o agente dela. Uma conversa vazia aparece na lista, mas só é gravada no primeiro envio.
- **Sessão expirada e Sair**: a conversa deixa de ser descartada. O novo login retoma os envios retidos de todas as conversas; as tasks guardadas são consultadas quando a conversa é aberta.
- **Separadores de dia** na timeline passam a aparecer de verdade em conversas reabertas.
- **BREAKING (comportamento)**: saem os modais de confirmação de **Nova conversa** e da troca de agente (D13 da `conversa-a2a`) e a regra "A conversa descartada não fica guardada em lugar nenhum".

## Capabilities

### New Capabilities
- `historico-conversas`: persistência local das conversas por serviço (chave, formato, gravação, leitura defensiva, cota, normalização ao reabrir), lista da barra lateral (busca, grupos, item, seleção, criação, exclusão), conversa aberta ao entrar e ordem pela última atividade.

### Modified Capabilities
- `conversa`:
  - "Layout da tela de conversas": a lista aparece na largura estreita;
  - "Barra lateral": o espaço reservado passa a ter a busca e a lista; o seletor mostra o agente ausente como item desabilitado;
  - "Carregamento da lista de agentes": a conversa guardada aparece antes da lista e continua legível numa falha;
  - "Cabeçalho da conversa": só o selo com o nome enquanto o agente é desconhecido;
  - "Timeline": separadores de dia em conversas reabertas;
  - "Polling da task": trocar de conversa pausa sem descartar, e a resposta vai para a conversa de origem;
  - "Resposta concluída": sem duração pelo relógio local numa resposta retomada;
  - "Blocos de estado": os dois blocos novos;
  - "Composer": placeholder com o agente desconhecido;
  - "Nova conversa e troca de agente": sem modal;
  - "Agente da conversa inativo": agente ausente na abertura e estado desconhecido;
  - "Sessão expirada durante o uso", "Retomada depois do novo login" e "Ações durante a sessão expirada": várias conversas, o Sair sem descarte, a busca e a seleção liberadas, e **Excluir** bloqueado;
  - "Rodapé de sessão": o Sair não descarta as conversas.
- `identidade-visual`: "Cores de erro e de aviso com contraste mínimo" ganha o texto do item ativo da lista (variável nova `--buteco-color-accent-text`) e o horário do item sob o hover.
- `ponte-preload`: só uma correção de redação, sem relação com o histórico. Em "Tipos compartilhados do contrato", "só os namespaces já expostos" passa a "só os namespaces expostos pelo preload". Ver "Notas do sync" no design.

## Impact

- **Código novo** em `src/renderer/src/history/`: o armazenamento (`storage.ts`: chave, leitura, validação, gravação, cota), a normalização ao reabrir, o agrupamento e as datas da lista, e os componentes da busca, da lista e do modal de exclusão.
- **Código alterado**:
  - `src/renderer/src/conversation/use-conversation.ts`: várias conversas, conversa aberta, endereçamento por `(conversationId, turnId)`, poller com `agentId`, agente desconhecido e retomada em várias conversas;
  - `ConversationScreen.tsx`: sem os modais, com a lista e a exclusão;
  - `Sidebar.tsx`: a lista no lugar reservado e o seletor com o agente ausente;
  - `Timeline.tsx` e `blocks/StateBlock.tsx`: os blocos novos;
  - `ConversationHeader.tsx`: o selo com o agente desconhecido;
  - `format.ts`: o rótulo do horário da lista;
  - `styles/global.css`: a lista e a largura estreita;
  - `theme/css-variables.ts`: `--buteco-color-accent-text`;
  - os testes de todos esses arquivos.
- **Main, preload, contrato `src/shared/api.ts` e canais IPC**: sem mudança.
- **Plataforma**: nenhuma chamada nova.
- **Dados**: chave nova no `localStorage` do renderer, em texto puro na pasta de dados do app (risco registrado no design).
- **Fora do escopo**:
  - criptografia do histórico (`safeStorage`);
  - sincronização com a plataforma e histórico vindo do servidor;
  - exportação e importação;
  - busca no conteúdo das mensagens;
  - renomear conversa.
