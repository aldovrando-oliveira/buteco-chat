## MODIFIED Requirements

### Requirement: Resultado na conversa de origem
O resultado de um `chat.send` e de um `chat.getTask` SHALL ser gravado na conversa que fez a chamada, mesmo que outra esteja aberta quando ele chega:
- o `contextId` devolvido vai para a conversa de origem;
- com estado não terminal e a origem fechada, o turno fica pendente, sem consulta, até a conversa ser aberta;
- com estado terminal, o turno vai ao estado final.

O polling MUST consultar a task com o agente da conversa a que ela pertence. Um resultado de uma conversa excluída MUST ser descartado.

#### Scenario: Trocar de conversa durante o envio
- **WHEN** o usuário envia a primeira mensagem da conversa A, abre a conversa B antes da resposta, e o envio devolve a task `9f8e7d6c-…` em `TASK_STATE_SUBMITTED` com o `contextId` `3a7d9f10-…`
- **THEN** B continua sem esse `contextId` (o `title` do **Copiar ID** de B não é `3a7d9f10-…`), nenhuma consulta é feita, e ao voltar para A o botão **Copiar ID** do cabeçalho tem o `contextId` `3a7d9f10-…` no `title`, e a próxima chamada é `chat.getTask` da task `9f8e7d6c-…` com o agente de A

#### Scenario: Envio rejeitado com a origem fechada
- **WHEN** o envio da conversa A devolve `TASK_STATE_REJECTED` enquanto B está aberta
- **THEN** ao voltar para A aparece o bloco "O agente não aceitou a mensagem: pode estar inativo ou sem modelo configurado."
