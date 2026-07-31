# RFC-006: Real time stream

**Status:** Proposto
**Depende de:** RFC-002, RFC-003, RFC-005

## Summary

Server-Sent Events por partida, aberto a espectadores sem autenticação. Cinco tipos de
evento, payload é a partida completa. **Decisão tomada: uma instância, `EventEmitter` em
memória**, atrás de uma interface que permite trocar por Redis sem tocar em quem publica.

## Motivation

É a feature que dá a sensação de tempo real, e o legado resolvia em 19 linhas (§8.2 do
legado). O desenho estava certo no essencial: SSE é **notificação**, nunca fonte da
verdade. O evento carrega o estado novo, mas o cliente sempre pode reconstruir tudo com um
`GET /games/:id`. Isso é o que permite perder eventos sem corromper nada.

## API contract

| | Rota | |
|---|---|---|
| 🔓 | `GET /games/:id/sse` | Abre o stream (`text/event-stream`) |

Cada evento é `{ type, game }`, com `game` serializado igual ao `GET /games/:id`:

| `type` | Disparado por |
|---|---|
| `join` | `POST /:id/join` |
| `move` | `POST /:id/move` |
| `resign` | `POST /:id/resign` |
| `drawOffer` | `POST /:id/draw` |
| `drawCancel` | `DELETE /:id/draw` |

## Design

```
src/realtime/
├── realtime.module.ts
├── game-events.service.ts       EventEmitter + fromEvent
└── interfaces/game-event.interface.ts
```

`GameEventsService` expõe `publish(gameId, event)` e `subscribe(gameId)`. Quem publica são
os serviços de `games`, que **não conhecem SSE** — só chamam `publish`. É essa fronteira
que torna a troca por Redis Pub/Sub uma mudança de um arquivo.

### Bug de origem, corrigido

O legado abria o stream de uma partida inexistente e ficava lá para sempre, porque faltava
um `await`:

```ts
const game = this.gamesService.findOne(id)   // Promise, sempre truthy
if (!game) throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
```

Era a única chamada sem `await` no arquivo (§10.1 do legado) — e a mesma classe de erro que
derrubou a autenticação nesta reescrita. Aqui a existência é verificada **antes** de abrir o
stream, com o `await`, e o teste que prova isso é obrigatório.

### Duplicação de providers, corrigida

O `SSEService` do legado era declarado em `providers` de dois módulos, criando **dois
`EventEmitter` distintos** (§2 do legado). Funcionava por acidente: `subscribe` e `emit`
eram chamados do mesmo controller, que resolvia para a instância local. Um segundo módulo
publicando teria os eventos sumindo no vazio. Aqui `RealtimeModule` é o dono e exporta;
ninguém redeclara.

### Heartbeat e reconexão

O legado não tinha nenhum dos dois. Esta RFC acrescenta o mínimo que evita conexão morta:

- **Comentário de keep-alive a cada 30s** (`:\n\n`), que atravessa proxies sem virar evento.
- **Evento inicial** com o estado atual assim que o cliente conecta, para ele não precisar
  de um `GET` separado.
- **Sem replay e sem `Last-Event-ID`.** Reconectar recomeça do estado atual, que é
  suficiente justamente porque o payload é a partida inteira, não um delta.

## Sem autenticação, deliberadamente

Qualquer um assiste qualquer partida, como no legado. Xadrez é jogo de espectador e as
partidas já são públicas via `GET /games/:id`; exigir token no stream não protegeria nada
que o `GET` não exponha. Fica **registrado como decisão**, não como omissão — que era o
estado no legado.

## Error cases

| Status | Quando | Mensagem |
|---|---|---|
| 404 | partida não existe | `Game not found` — **antes** de abrir o stream |

Erro depois do stream aberto não vira status HTTP: os headers já foram enviados. A conexão
é encerrada e o cliente reconecta.

## Testing strategy

**Unitário:** `publish` entrega a quem assina aquele `gameId`; não entrega a quem assina
outro; dois assinantes da mesma partida recebem os dois; `unsubscribe` para de receber.

**E2E:** `GET /games/:id/sse` devolve `content-type: text/event-stream`; **stream de
partida inexistente devolve 404 e não abre conexão** (regressão do §10.1); um `POST /move`
numa conexão faz o evento `move` chegar na outra; o payload do evento é igual ao corpo de
`GET /games/:id`; desistência emite `resign` com a partida já em `F`; o cliente recebe o
estado atual ao conectar.

## Open questions

1. **Escala horizontal.** Com mais de uma instância, um cliente conectado à instância A não
   recebe o lance processado pela instância B (§10.7 do legado). É o limite conhecido e
   aceito desta versão. Trocar por Redis Pub/Sub mexe só em `GameEventsService` — a
   interface existe para isso. **Antes de subir uma segunda instância, esta RFC precisa ser
   revisada.**
2. **Fim por tempo não gera evento.** Como o relógio é preguiçoso (RFC-004), ninguém publica
   nada quando o tempo estoura — o espectador vê uma partida viva que já acabou. O cliente
   consegue contar sozinho a partir de `turnTime`; resolver no servidor exigiria o
   scheduler que a RFC-004 evita de propósito.
3. **Limite de conexões por partida.** Sem limite, um stream aberto por requisição é um
   vetor de exaustão de file descriptors. O throttler não cobre conexão longa.
