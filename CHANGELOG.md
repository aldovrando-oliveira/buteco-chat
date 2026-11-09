# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

## [Unreleased]

### Adicionado
- Empacotamento para Linux: pacote `deb` com perfil do AppArmor para o
  sandbox do Chromium no Ubuntu 24.04+, `.desktop` e ícones `hicolor` nos oito
  tamanhos. **Não verificado num Ubuntu**: só a estrutura do pacote foi
  conferida.
- Empacotamento para Windows: pasta `release/win-unpacked/` com
  `Buteco Chat.exe`, sem instalador. **Não verificado num Windows**.
- README com geração, abertura, liberação do app não assinado e pasta de dados
  para macOS, Linux e Windows.

## [0.1.0] - 2026-11-08

Primeira versão do Buteco Chat: cliente desktop (Electron) para conversar com
os agentes da plataforma Buteco Agentes.

### Adicionado

#### Fundação do app
- Projeto Electron + React 19 + TypeScript estrito com `electron-vite` (main,
  preload e renderer).
- Janela endurecida: `contextIsolation`, `sandbox`, `nodeIntegration`
  desligado, permissões negadas, `<webview>` bloqueado e abertura sem flash
  branco.
- Política de navegação que nega tudo; links `http:`/`https:` vão para o
  navegador do sistema.
- CSP restritiva no build de produção (`connect-src 'none'`), com CSP própria
  para o `dev`.
- Preload em CJS compatível com sandbox, expondo `window.buteco` via
  `contextBridge`, e handlers IPC que validam o remetente e os argumentos.
- Tema Mantine com a identidade Buteco (cores, tipografia IBM Plex, raios,
  claro/escuro conforme o sistema).
- Testes com Vitest (projetos `main` e `renderer`) e empacotamento local com
  `electron-builder`, sem assinatura.

#### Login do operador
- Serviço de autenticação no main; token, validade e usuário ficam só em
  memória e nunca cruzam a ponte com o renderer.
- Validação do endereço do serviço (`http:`/`https:`, sem credenciais, query
  ou hash; prefixo de caminho aceito; aviso para `http:` fora de loopback).
- Telas de primeiro acesso (com campo de endereço) e de acessos seguintes
  (com **Alterar**); o endereço do serviço é lembrado após login bem-sucedido.
- Instância única do app e pasta de dados própria para o modo de
  desenvolvimento.

#### Conversa com agentes via A2A
- Listagem de agentes (`GET /agents`) e conversa em vários turnos pelo
  JSON-RPC A2A (`SendMessage`, `GetTask`), com timeout de 15 s e todos os
  estados de task tratados.
- Acompanhamento da resposta por polling (~1 s, prazo de 90 s), com
  **Continuar aguardando** e **Reenviar**.
- Respostas renderizadas em Markdown (GFM) e cópia de texto pelo main.

#### Sessão expirada
- Estado "sessão expirada" no lugar da volta ao login: banner com
  **Entrar novamente**, composer e ações bloqueados, leitura e cópia
  preservadas.
- Modal de novo login com serviço e usuário fixos; após entrar, o envio ou o
  polling interrompido é retomado uma única vez.
- O main descarta a sessão em um 401 apenas se o token ainda for o mesmo,
  evitando que uma resposta antiga derrube a sessão nova.

#### Histórico de conversas
- Conversas persistidas localmente por serviço, em formato versionado.
- Barra lateral com busca, grupos **Hoje**, **Ontem**, **Esta semana** e
  **Anteriores** e exclusão de conversa com confirmação.
- Várias conversas abertas em paralelo: trocar de conversa pausa o polling
  sem perder nada, e cada resposta vai para a conversa de origem.
- Conversas reabertas retomam tasks pendentes e sinalizam envios
  interrompidos pelo fechamento do app.
- Separadores de dia na timeline.

#### Barra de status e marca
- Barra de status no rodapé da tela de conversas, com o endereço do serviço e
  o tempo restante da sessão (ou "Sessão expirada").
- Cabeçalho da conversa com a data de início ("Iniciada hoje às HH:mm") e o
  botão **Copiar ID**.
- Ícone oficial do app na janela, no Dock, no pacote e nas telas de login e
  na barra lateral, gerado pelo script `npm run icons`.

[Unreleased]: https://github.com/aldovrando-oliveira/buteco-chat/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aldovrando-oliveira/buteco-chat/releases/tag/v0.1.0
