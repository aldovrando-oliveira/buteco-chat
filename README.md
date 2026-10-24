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

O npm avisa que `electron-winstaller` tem um script de instalação ainda não aprovado (`allowScripts`). Esse pacote é uma dependência do `electron-builder` usada só para gerar instaladores de Windows. Ele não roda nem é necessário neste projeto, e o script não deve ser aprovado.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Abre o app em desenvolvimento, com o renderer servido pelo Vite (porta fixa 5173) e HMR. |
| `npm run build` | Gera main, preload e renderer de produção em `out/`. |
| `npm run typecheck` | Verifica os tipos (TypeScript estrito) do main, do preload, do renderer e de `src/shared`. |
| `npm test` | Roda os testes do Vitest: projeto `main` (Node) e projeto `renderer` (jsdom + Testing Library). |
| `npm run test:build` | Verifica os artefatos de `out/`: preload em CommonJS num arquivo só, nenhum asset como `data:`, CSP de produção no `index.html`. Rode depois de `npm run build`. |
| `npm run package` | Faz o build e empacota o app com o `electron-builder` em `release/`. |

## Entrar na plataforma

O app pede o endereço do serviço Buteco Agentes e o usuário e a senha do operador, os mesmos do painel. Para usar a plataforma local, informe `http://localhost:5017` (ela precisa estar no ar).

- O endereço aceita prefixo de caminho (`https://host/buteco`), mas não credenciais embutidas, query nem `#`.
- Com `http://` fora do próprio computador (`localhost`, `127.x.x.x`, `[::1]`), a tela avisa que a senha será enviada sem criptografia, mas deixa entrar.
- A sessão dura o que a plataforma definir (30 min por padrão) e não é renovada: depois disso, é preciso entrar de novo.

Entre aberturas, o app lembra **só o endereço do serviço**, e só depois de um login bem-sucedido. Usuário, senha e token não são guardados em lugar nenhum; o token fica na memória do processo main até sair ou fechar o app.

O app roda uma instância por vez: abrir de novo traz a janela aberta para a frente. O `npm run dev` usa uma pasta de dados própria (`Buteco Chat (dev)`, em `~/Library/Application Support/` no macOS), separada da do app empacotado, então os dois podem ficar abertos juntos e lembram endereços diferentes.

## Arquitetura

```
src/
  main/      processo main (Node): janela, segurança, IPC; todo HTTP com a plataforma sai daqui
  preload/   ponte mínima exposta ao renderer como window.buteco (contextBridge)
  renderer/  interface React + Mantine, carregada de file:// no app empacotado
  shared/    tipos e constantes usados pelo main e pelo renderer (contrato da API em api.ts)
tooling/     plugin do Vite que injeta a Content-Security-Policy
```

Regras que valem para todo o código:

- **Todo HTTP sai do processo main.** O renderer não tem como fazer requisições: a CSP de produção tem `connect-src 'none'`.
- O token de acesso fica só na memória do main, e a senha nunca é guardada.
- A janela roda com `contextIsolation`, `sandbox` e sem `nodeIntegration`. Navegação e novas janelas são bloqueadas: links `http(s)` abrem no navegador padrão, e qualquer outro esquema é descartado.
- O preload expõe em `window.buteco` só o que já está implementado no main. Todo handler IPC valida o remetente e os argumentos antes de executar.

As decisões e os motivos estão em `openspec/changes/` (ou, depois de arquivadas, em `openspec/specs/`).

## Empacotamento

`npm run package` gera o app só para o sistema operacional e a arquitetura da máquina em que roda, sem assinatura de desenvolvedor, sem notarização e sem atualização automática. No macOS, o resultado fica em `release/mac/Buteco Chat.app` (ou `release/mac-arm64/` em Macs Apple Silicon).

Para ver os avisos e erros do renderer, como violações de CSP, abra o app pelo terminal:

```sh
"release/mac/Buteco Chat.app/Contents/MacOS/Buteco Chat"
```

### macOS: app não assinado em outra máquina

Ao copiar o `.app` para outro Mac (por download, AirDrop ou zip), o macOS marca o arquivo como em quarentena e se recusa a abri-lo, dizendo que ele "está danificado". Como o app não é assinado, remova a quarentena antes de abrir:

```sh
xattr -cr "/caminho/para/Buteco Chat.app"
```
