# Buteco Chat

Aplicativo desktop (Electron + React + TypeScript + Mantine) para conversar com os agentes cadastrados na plataforma **Buteco Agentes**. É um cliente externo: fala com a plataforma só pelo contrato HTTP público e não importa código dela.

Uso interno, para testar agentes. O desenvolvimento segue o OpenSpec (`openspec/`): cada mudança passa por proposta, revisão e aplicação.

## Pré-requisitos

- Node.js 22.12 ou superior (o Vitest aceita as linhas 22, 24 e 26 em diante).
- npm.

```sh
npm install
```

O binário do Electron é baixado na primeira execução de `npm run dev` (ou de `npm run package`), e não durante o `npm install`.

Em `npm run dev`, o console do DevTools pode mostrar um erro de CSP sobre `worker-src` ("Creating a worker from 'blob:…'"). Ele vem do cliente do Vite, que tenta reconectar o HMR depois de uma queda do servidor. Nesse caso, recarregue a janela manualmente (⌘R). O app empacotado não carrega o cliente do Vite e não é afetado.

O npm avisa que `electron-winstaller` tem um script de instalação ainda não aprovado (`allowScripts`). Esse pacote é uma dependência do `electron-builder` usada só para gerar instaladores de Windows. Ele não roda nem é necessário neste projeto, e o script não deve ser aprovado. O mesmo vale para `fsevents`, dependência opcional do Vite que só é instalada no macOS (o aviso dele só aparece lá): o npm o lista porque o pacote traz um `binding.gyp`, mas ele já vem com o binário pronto, e o script não deve ser aprovado.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Abre o app em desenvolvimento, com o renderer servido pelo Vite (porta fixa 5173) e HMR. |
| `npm run build` | Gera main, preload e renderer de produção em `out/`. |
| `npm run typecheck` | Verifica os tipos (TypeScript estrito) do main, do preload, do renderer e de `src/shared`. |
| `npm test` | Roda os testes do Vitest: projeto `main` (Node) e projeto `renderer` (jsdom + Testing Library). |
| `npm run test:build` | Verifica os artefatos de `out/`: preload em CommonJS num arquivo só, nenhum asset como `data:`, CSP de produção no `index.html`. Rode depois de `npm run build`. |
| `npm run package` | Faz o build e empacota o app com o `electron-builder` em `release/`, para o sistema local (veja "Empacotamento"). |
| `npm run icons` | Regenera `build/icon.png`, `build/icon-mac.png` e `build/icons/` a partir da geometria do ícone do app (veja "Ícone do app"). |

## Entrar na plataforma

O app pede o endereço do serviço Buteco Agentes e o usuário e a senha do operador, os mesmos do painel. Para usar a plataforma local, informe `http://localhost:5017` (ela precisa estar no ar).

- O endereço aceita prefixo de caminho (`https://host/buteco`), mas não credenciais embutidas, query nem `#`.
- Com `http://` fora do próprio computador (`localhost`, `127.x.x.x`, `[::1]`), a tela avisa que a senha será enviada sem criptografia, mas deixa entrar.
- A sessão dura o que a plataforma definir (30 min por padrão) e não é renovada: depois disso, é preciso entrar de novo (veja "Quando a sessão expira").

Entre aberturas, o app lembra **só o endereço do serviço**, e só depois de um login bem-sucedido. Usuário, senha e token não são guardados em lugar nenhum; o token fica na memória do processo main até sair ou fechar o app.

O app roda uma instância por vez: abrir de novo traz a janela aberta para a frente. O `npm run dev` usa uma pasta de dados própria, `Buteco Chat (dev)`, separada da do app empacotado (veja "Pasta de dados"), então os dois podem ficar abertos juntos e lembram endereços diferentes.

## Conversar com um agente

Depois do login, a tela de conversas lista os agentes da plataforma no seletor da barra lateral. Os inativos aparecem desabilitados. Escolha um agente e escreva no campo de baixo: Enter envia e Shift+Enter quebra a linha. Uma mensagem tem até 16.000 caracteres.

- **Uma resposta por vez.** O app consulta a task a cada segundo até ela terminar. Enquanto espera, o envio fica bloqueado: a plataforma processa uma mensagem por vez em cada conversa.
- **Contexto.** A partir da segunda mensagem, o app reenvia o `contextId`, e o agente recebe o histórico da conversa guardado na plataforma. O `contextId` aparece abreviado no cabeçalho, e **Copiar** copia o valor completo.
- **Falhas.**
  - Se o agente não conseguir responder, **Reenviar** manda a mesma mensagem de novo, na mesma conversa.
  - Se a resposta não chegar em 90 s, dá para continuar aguardando ou reenviar. Reenviar antes confere se a resposta original já chegou.
  - Um agente inativo ou sem modelo configurado recusa a mensagem. Nesse caso não há reenvio: escolha outro agente.
- **Respostas** são mostradas em Markdown, sem HTML. Links abrem no navegador padrão. Imagens aparecem como link, porque o app não carrega imagens da internet.
- **Nova conversa** e a troca de agente começam uma conversa nova, sem `contextId`, sem pedir confirmação: a conversa anterior continua no histórico.

## Histórico de conversas

Cada conversa é guardada neste computador assim que a primeira mensagem é enviada, e aparece na barra lateral, agrupada por data, com o agente e o horário da última atividade. A busca filtra pelo título (o começo da primeira mensagem), sem diferenciar maiúsculas nem acentos. Ao entrar, o app abre a conversa mais recente.

- **Reabrir.** Clicar numa conversa mostra a timeline como estava. Se havia uma resposta em andamento (inclusive ao fechar o app ou recarregar a janela), o app volta a acompanhar a mesma task, sem reenviar a mensagem. Uma mensagem que estava sendo enviada no momento do fechamento aparece como envio interrompido, com **Reenviar**.
- **Por serviço.** Cada endereço de serviço tem a sua lista. `http://localhost:5017` e `http://127.0.0.1:5017` são serviços diferentes, com históricos separados. **Sair** não apaga o histórico: ao entrar de novo no mesmo serviço, a lista volta.
- **Limite.** São guardadas até 100 conversas por serviço. Passando disso, ou se o espaço de armazenamento acabar, as conversas mais antigas (pela última atividade) são removidas primeiro. A conversa aberta nunca é removida.
- **Excluir.** A lixeira ao lado de cada conversa pede confirmação e apaga a conversa só deste computador. Se houver uma resposta em andamento, ela deixa de ser acompanhada. O contexto guardado na plataforma não é apagado, e não há como desfazer. Com a sessão expirada, a exclusão fica bloqueada.
- **Agente indisponível.** Se o agente de uma conversa foi desativado ou removido da plataforma, a conversa abre normalmente para leitura, e o seletor mostra o agente como "(inativo)". Para continuar, comece uma nova conversa com outro agente.

**Onde fica e o que contém.** O histórico fica no `Local Storage` da pasta de dados do app (o caminho de cada sistema está em "Pasta de dados", na seção "Empacotamento"), na chave `buteco-chat:sessions:<endereço do serviço>`. É **texto puro, sem criptografia**: qualquer pessoa com acesso à sua conta no computador pode ler as mensagens e as respostas. Senha e token nunca entram nele.

Se o conteúdo gravado estiver corrompido, o app começa com a lista vazia e guarda uma cópia do original em `buteco-chat:sessions-corrupt:<endereço>`. Se ele tiver sido gravado por uma versão mais nova do app, nada é sobrescrito: as conversas dessa sessão ficam só na memória.

Para apagar todo o histórico, feche o app e remova a pasta `Local Storage` da pasta de dados; os comandos de cada sistema estão em "Pasta de dados". Isso também apaga o endereço de serviço lembrado.

### Quando a sessão expira

Quando o tempo do rodapé chega a zero, ou quando a plataforma recusa o token durante o uso (por exemplo, depois de um reinício com outra chave de assinatura), o app **não sai da conversa**:
- o rodapé mostra "Sessão expirada" e aparece um aviso acima do campo de mensagem com **Entrar novamente**;
- o envio, **Reenviar**, **Continuar aguardando**, o seletor de agente, **Nova conversa** e a exclusão de conversas ficam bloqueados; ler e buscar outras conversas continua possível; **Copiar** e **Sair** continuam disponíveis;
- **Entrar novamente** pede só a senha, com o mesmo serviço e o mesmo usuário. Para trocar de conta, use **Sair**.

Depois do novo login, o app retoma de onde parou:
- **resposta em andamento**: volta a acompanhar a mesma task, sem reenviar a mensagem (o agente não a processa duas vezes);
- **mensagem recusada no envio**: a plataforma não a registrou, então ela é enviada uma única vez, na mesma conversa;
- **lista de agentes recusada**: é carregada de novo.

**Para testar com a plataforma local**, reduza a vida do token do operador ao subir o `apps/api` de `buteco-agents`, por exemplo para 2 min:

```sh
Auth__OperatorTokenLifetime=00:02:00 dotnet run --project apps/api/src/Buteco.Api
```

Para simular um token recusado com tempo restante, reinicie o `apps/api` com outro `Auth__TokenSigningKey`. Reiniciar sem trocar a chave não invalida o token.

## Arquitetura

```
src/
  main/      processo main (Node): janela, segurança, IPC; todo HTTP com a plataforma sai daqui
  preload/   ponte mínima exposta ao renderer como window.buteco (contextBridge)
  renderer/  interface React + Mantine, carregada de file:// no app empacotado
  shared/    tipos e constantes usados pelo main e pelo renderer (contrato da API em api.ts)
tooling/     plugin do Vite que injeta a Content-Security-Policy e gerador dos PNGs do ícone do app
assets/      origem da marca: o app-icon.svg da plataforma, copiado sem edição (assets/brand/README.md)
build/       recursos do electron-builder: os PNGs do ícone do app (icons/ para o Linux), gerados por npm run icons e versionados
```

Regras que valem para todo o código:

- **Todo HTTP sai do processo main.** O renderer não tem como fazer requisições: a CSP de produção tem `connect-src 'none'`.
- O token de acesso fica só na memória do main, e a senha nunca é guardada.
- A janela roda com `contextIsolation`, `sandbox` e sem `nodeIntegration`. Navegação e novas janelas são bloqueadas: links `http(s)` abrem no navegador padrão, e qualquer outro esquema é descartado.
- O preload expõe em `window.buteco` só o que já está implementado no main. Todo handler IPC valida o remetente e os argumentos antes de executar.

As decisões e os motivos estão em `openspec/changes/` (ou, depois de arquivadas, em `openspec/specs/`).

## Empacotamento

`npm run package` gera o app para o sistema operacional e a arquitetura da máquina em que roda, e precisa ser executado no próprio sistema: o pacote do Linux é gerado no Linux, o do Windows no Windows e o do macOS no macOS. O app não tem assinatura de desenvolvedor, notarização nem atualização automática. O resultado fica em `release/`.

Para ver os avisos e erros do renderer, como violações de CSP, abra o app pelo terminal, com o comando de cada sistema abaixo.

### macOS

- **Pré-requisitos:** os gerais (Node.js e npm).
- **Resultado:** `release/mac/Buteco Chat.app`, ou `release/mac-arm64/` em Macs Apple Silicon.
- **Pelo terminal:**

  ```sh
  "release/mac/Buteco Chat.app/Contents/MacOS/Buteco Chat"
  ```

  Uma linha como `error messaging the mach port for IMKCFRunLoopWakeUpReliable` vem do macOS (Input Method Kit), não do app, e pode ser ignorada.
- **App não assinado em outra máquina:** ao copiar o `.app` para outro Mac (por download, AirDrop ou zip), o macOS marca o arquivo como em quarentena e se recusa a abri-lo, dizendo que ele "está danificado". Como o app não é assinado, remova a quarentena antes de abrir:

  ```sh
  xattr -cr "/caminho/para/Buteco Chat.app"
  ```

### Linux (Ubuntu)

> **Não verificada:** esta seção ainda não foi conferida num Ubuntu. O `deb` só foi gerado a partir de um Mac, para conferir a estrutura do pacote (`control`, `.desktop`, ícones e perfil do AppArmor); a instalação e a abertura do app não foram testadas.

- **Pré-requisitos:** `git`, npm e Node.js 22.12 ou superior, instalado pelo [nvm](https://github.com/nvm-sh/nvm) ou pelo repositório da NodeSource. O `nodejs` do `apt` é antigo demais (o Ubuntu 24.04 traz a linha 18). Nenhum pacote de compilação é necessário.
- **Resultado:** o pacote `release/buteco-chat_0.1.0_amd64.deb` (`arm64` no lugar de `amd64` em máquinas ARM).
- **Instalar, atualizar e remover:**

  ```sh
  sudo apt install ./release/buteco-chat_*.deb   # instala, ou atualiza por cima de uma versão anterior
  sudo apt remove buteco-chat
  ```

- **Abrir:** pelo lançador de aplicativos (no Ubuntu, em "Mostrar aplicativos", buscando "Buteco") ou, para ver os avisos, pelo terminal:

  ```sh
  buteco-chat
  ```

**Por que um instalador.** No Ubuntu 24.04 ou mais novo, o sandbox do Chromium só funciona com um perfil do AppArmor para o executável, e o `deb` instala esse perfil em `/etc/apparmor.d/buteco-chat`. Ele também instala o `.desktop` e os ícones que fazem o painel mostrar o ícone do app no Wayland. Não abra o app com `--no-sandbox`: isso desliga o isolamento do Chromium em todos os processos, inclusive no que mostra as respostas dos agentes.

A pasta `release/linux-unpacked/`, gerada no caminho, não serve para abrir o app no Ubuntu 24.04 ou mais novo: sem o perfil do AppArmor, ele aborta com um erro do `chrome-sandbox`.

Em `npm run dev` numa sessão Wayland, o painel mostra um ícone genérico, porque não há `.desktop` instalado para a janela de desenvolvimento. Numa sessão X11, o ícone aparece.

### Windows

> **Não verificada:** esta seção ainda não foi conferida num Windows. O pacote só foi gerado a partir de um Mac, para conferir a estrutura e o ícone do `.exe`.

- **Pré-requisitos:** os gerais (Node.js e npm).
- **Resultado:** `release\win-unpacked\Buteco Chat.exe` (ou `release\win-arm64-unpacked\` em máquinas ARM), uma pasta que se abre direto, sem instalar.
- **Pelo terminal** (PowerShell):

  ```powershell
  & "release\win-unpacked\Buteco Chat.exe"
  ```

- **App não assinado:** o SmartScreen só avisa quando o `.exe` tem *Mark-of-the-Web*, ou seja, quando chegou por download ou por um zip baixado e extraído pelo Explorer. Gerado na própria máquina, ele abre sem aviso. Se aparecer "O Windows protegeu o computador", clique em **Mais informações** e depois em **Executar assim mesmo**, ou remova a marca antes de abrir, no PowerShell:

  ```powershell
  Get-ChildItem -Recurse "C:\caminho\para\win-unpacked" | Unblock-File
  ```

### Pasta de dados

O app guarda seus dados (o endereço de serviço lembrado e o histórico, em `Local Storage/`) numa pasta do usuário, a do `app.getPath('userData')` do Electron. O `npm run dev` usa uma pasta própria, com ` (dev)` no nome.

| Sistema | App empacotado | `npm run dev` |
| --- | --- | --- |
| macOS | `~/Library/Application Support/Buteco Chat` | `~/Library/Application Support/Buteco Chat (dev)` |
| Linux | `~/.config/Buteco Chat` (ou `$XDG_CONFIG_HOME/Buteco Chat`) | `~/.config/Buteco Chat (dev)` |
| Windows | `%APPDATA%\Buteco Chat` | `%APPDATA%\Buteco Chat (dev)` |

O nome tem espaço: no terminal, use o caminho entre aspas, como em `ls ~/.config/"Buteco Chat"`.

Para apagar o histórico, feche o app e remova a pasta `Local Storage` de dentro da pasta de dados. Isso também apaga o endereço de serviço lembrado:

```sh
rm -rf ~/Library/"Application Support/Buteco Chat/Local Storage"   # macOS
rm -rf ~/.config/"Buteco Chat/Local Storage"                        # Linux
```

```powershell
Remove-Item -Recurse "$env:APPDATA\Buteco Chat\Local Storage"     # Windows
```

Desinstalar o app não apaga essa pasta: no Linux, nem `sudo apt remove buteco-chat` nem `apt purge` mexem em `~/.config/Buteco Chat`. Para remover tudo, apague a pasta de dados inteira.

### Ícone do app

O ícone vem do `app-icon.svg` oficial da plataforma, copiado **sem edição** para `assets/brand/` (origem, SHA-256 e a regra do manifesto C2PA em `assets/brand/README.md`). O app não importa código da plataforma. O que é desenhado sai da geometria em `src/shared/app-icon-geometry.ts`, que tem uma correção local na gravata. Dessa geometria saem o ícone dentro do app e os PNGs de `build/`:
- `icon.png`, no quadro inteiro, para o Windows;
- `icon-mac.png`, com a margem do grid do macOS, sem sombra;
- `icons/NxN.png`, o mesmo quadro inteiro de `icon.png` em 16, 24, 32, 48, 64, 128, 256 e 512 px, para o Linux. O `deb` instala cada um no tamanho correspondente do tema `hicolor`. Sem essa pasta, o `electron-builder` usaria no Linux o `icon-mac.png`, com a margem.

O `electron-builder` gera o `.icns` e o `.ico` a partir deles. Em `npm run dev`, a janela usa o `icon.png` e o Dock do macOS usa o `icon-mac.png`.

Uma revisão da marca substitui `assets/brand/app-icon.svg` inteiro e atualiza o registro no README dele. Depois, revise a correção da gravata e rode `npm run icons`.
