## 1. Contrato compartilhado

- [ ] 1.1 Em `src/shared/api.ts`, acrescentar `{ kind: 'bad-response' }` a `ChatError` e `username: string | null` ao retorno de `auth.status()` (D9); `EXPOSED_NAMESPACES` passa a `['auth']`
- [ ] 1.2 Em `src/shared/ipc-channels.ts`, declarar `auth:login`, `auth:logout` e `auth:status`
- [ ] 1.3 Implementar `parseServiceUrl` em `src/shared/service-url.ts` (D6), com `baseUrl`, `host` e `insecure`
- [ ] 1.4 Testes de `parseServiceUrl`: cenários aceitos e recusados do spec, prefixo preservado, `?` vazio e `#` recusados, `insecure` para loopback (`localhost`, `127.0.0.1`, `127.1`, `[::1]`), rede local e `https:`; teste de que `` `${baseUrl}/auth/login` `` preserva `/buteco` e de que `new URL('auth/login', 'https://host/buteco')` o descarta (documenta o motivo da concatenação)

## 2. Serviço de autenticação (main)

- [ ] 2.1 Implementar `createAuthService({ fetch, now, setTimeout, clearTimeout })` em `src/main/auth/service.ts`: `login`, `logout`, `status`, `getToken`, com as opções de requisição de D1, timeout de 15 s e contador de geração com aborto (D3)
- [ ] 2.2 Implementar o classificador de resposta e de rejeição (D2, D4) e a validação do corpo 200 (D5)
- [ ] 2.3 Testes com `fetch` simulado: 200 válido (resultado sem token, `status()` preenchido, `expiresAt` normalizado); `expiresAt` no formato do .NET (`"2026-10-24T05:24:00.1234567+00:00"`, escrito literalmente no teste) aceito e normalizado para `.123Z`; requisição enviada (URL com prefixo, método, corpo, `redirect: 'manual'`, `credentials`, `cache`, `signal`); 401; `net::ERR_CONNECTION_REFUSED`; timeout com os timers falsos do Vitest injetados (`vi.advanceTimersByTime(15_000)` aborta a chamada e o resultado é `timeout`; a resposta antes de 15 s cancela o timer); 404, 500 e 204; redirecionamento nas três formas (3xx, status 0/`opaqueredirect`, rejeição "Redirect was cancelled") com uma única chamada ao `fetch`; cada caso de 200 malformado do spec
- [ ] 2.4 Testes de ciclo: login que falha limpa a sessão anterior; `logout` durante login aborta e mantém deslogado mesmo com 200 tardio; segundo login substitui o primeiro; `logout` limpa tudo; `status()` e `getToken()` depois da expiração; o serviço não guarda a senha (nenhuma propriedade do estado a contém) e não chama `console`

## 3. IPC e preload

- [ ] 3.1 Implementar em `src/main/auth/ipc.ts` os `parseArgs` dos três canais (D7) e a função que os registra com `handle()`; mensagens de erro fixas, sem valores, inclusive na `cause`
- [ ] 3.2 Testes de `parseArgs`: tipos errados, quantidade errada, limites (2048/256/1024 aceitos, +1 recusado), endereço inválido; com `http://user:pass@host`, nem a mensagem nem a `cause` contêm `user`, `pass` ou o endereço; o valor devolvido por `auth:login` serializado não contém o token
- [ ] 3.3 Em `src/main/index.ts`, criar o serviço com `net.fetch` e `Date.now` e registrar os canais dentro de `app.whenReady()`
- [ ] 3.4 No preload, implementar `auth` com `ipcRenderer.invoke` nos três canais; ajustar o teste do preload (`window.buteco` só com `auth`; `auth` só com `login`, `logout` e `status`; cada função chama o canal certo com os argumentos recebidos)
- [ ] 3.5 Ajustar `api-surface.typetest.ts`: `window.buteco.auth` compila e `window.buteco.chat` tem `@ts-expect-error`; rodar `npm run typecheck`

## 4. Tema

- [ ] 4.1 Instalar `@tabler/icons-react` (D13) e registrar a versão instalada no resumo da change
- [ ] 4.2 Acrescentar `--buteco-color-error-text` e `--buteco-color-warning-text` ao `cssVariablesResolver` (D12)
- [ ] 4.3 Teste de contraste das mensagens de erro, de aviso e de validação, nos dois esquemas, no padrão do teste da fundação

## 5. Telas (renderer)

- [ ] 5.1 Implementar a leitura e a gravação do endereço salvo (`buteco-chat:service-url`) com `try/catch` e validação por `parseServiceUrl`
- [ ] 5.2 Implementar a marca (balão, "Buteco", "Chat") e a estrutura comum da tela de login conforme o spec (380 px, 20 px, cartão com raio 11 px, padding 24 px, 14 px entre itens; campos de 34 px, raio 7 px; botão de 36 px)
- [ ] 5.3 Implementar o endereço nas duas variantes: campo de primeiro acesso (mono 12 px, placeholder, validação no blur e no envio, borda e mensagem vermelhas) e linha "Serviço" com ícone de servidor, truncamento e **Alterar**; aviso de HTTP (D11 #1)
- [ ] 5.4 Implementar o envio (`<form noValidate onSubmit>`, `preventDefault`), o estado de carregamento, o bloco de erro com `role="alert"` e as cinco mensagens, e as regras de usuário e senha depois do erro
- [ ] 5.5 Implementar o destino pós-login provisório: "{usuário} @ {host}", "Sessão válida por mais {n} min", botão **Sair** só de ícone com `aria-label="Sair"`, volta ao login ao chegar a zero
- [ ] 5.6 Implementar o estado `checking | login | session` no `App`, com o estado inicial vindo de `status()`; remover `Shell.tsx`
- [ ] 5.7 Testes do renderer com `window.buteco.auth` simulado: as duas variantes de tela (textos, ordem, `autocomplete`, sem textos de ajuda); validação do endereço (aparece no blur, some ao corrigir, desabilita **Entrar**); aviso de HTTP em rede local e ausente em loopback; **Alterar**; cada mensagem de erro, inclusive redirecionamento sem "erro 0"; senha limpa só em `invalid-credentials`; **Entrar** desabilitado com campos vazios e durante o login; endereço gravado só após sucesso e normalizado; `localStorage` que lança erro; recarregar com sessão ativa; destino pós-login com usuário, host e minutos; **Sair**; tempo esgotado
- [ ] 5.8 Substituir o teste da casca pelo teste de `lang="pt-BR"` e ajustar os testes de fundo da página para a tela de login

## 6. Verificação

- [ ] 6.1 Rodar `npm run typecheck`, `npm test`, `npm run build` e `npm run test:build`
- [ ] 6.2 Fumaça em dev contra a plataforma local (`http://localhost:5017`): login certo, senha errada (usuário mantido, senha limpa), serviço parado, endereço com prefixo inexistente (erro 404), Sair, nos esquemas claro e escuro
- [ ] 6.3 Fumaça no app empacotado: login certo, fechar e reabrir com o endereço lembrado na linha "Serviço", fontes Plex carregadas e nenhuma violação de CSP no console; conferir no stdout que nenhum token, senha ou corpo de resposta aparece
- [ ] 6.4 Atualizar o `README.md` (como apontar para a plataforma local e o que é lembrado entre aberturas)
