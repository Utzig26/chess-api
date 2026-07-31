# RFC-007: Game queries

**Status:** Proposto
**Depende de:** RFC-002

## Summary

As rotas de leitura: consultar uma partida, listar partidas com paginação e filtro, e
listar as do usuário autenticado. Toda leitura passa pela projeção pura do relógio
(RFC-004) e **nenhuma escreve no banco**.

## API contract

| | Rota | |
|---|---|---|
| 🔓 | `GET /games/:id` | Uma partida |
| 🔓 | `GET /games` | Lista paginada |
| 🔒 | `GET /games/mine` | Partidas do usuário autenticado |

`GET /games` aceita:

| Query | Default | |
|---|---|---|
| `state` | `A` | `WP` \| `W` \| `A` \| `F` |
| `page` | 1 | ≥ 1 |
| `limit` | 20 | 1–100 |

Resposta com `data` paginado dentro do envelope de sempre:

```jsonc
{
  "success": true, "statusCode": 200, "message": "Games listed",
  "requestId": "…",
  "data": {
    "items": [ /* partidas */ ],
    "page": 1, "limit": 20, "total": 137, "totalPages": 7
  }
}
```

O legado tinha só `GET /games`, sem paginação, devolvendo todas as partidas com
`gameState == "A"` (§5 do legado) — um array que cresce sem limite.

## Behaviour

### Leitura é leitura

Toda rota daqui chama a projeção pura da RFC-004: os relógios saem descontados até
`Date.now()`, e o documento não é tocado. Uma partida cujo tempo estourou aparece encerrada
na resposta; a persistência do fim fica para a próxima mutação.

É a correção do §10.6 do legado, onde `findOne()` chamava `clock()`, que chamava
`game.save()` — toda leitura era uma escrita.

### `GET /games/mine`

Não existia no legado. Usa os índices `whitePlayer.id` e `blackPlayer.id` da RFC-002 e é o
que torna a API utilizável por um cliente de verdade: sem isso, quem fecha o navegador não
tem como reencontrar suas partidas, já que o `resourceId` é a única chave e ele não aparece
em lugar nenhum depois.

Ordena por `updatedAt` decrescente. Aceita os mesmos `state`, `page` e `limit`.

### Serialização

Igual em todas as rotas, e igual ao payload do SSE (RFC-006) — um único serializador. O
`id` do jogador nunca sai; `pgn` sai, porque é o que permite ao cliente montar o tabuleiro
sem replay próprio.

## Error cases

| Status | Quando | Mensagem |
|---|---|---|
| 400 | `state` fora do enum, `page` < 1, `limit` fora de 1–100 | `Validation failed` |
| 401 | `GET /games/mine` sem token | `Unauthorized` |
| 404 | `:id` não existe | `Game not found` |

## Testing strategy

**Unitário:** filtro por estado; paginação calcula `totalPages`; `page` além do fim devolve
lista vazia com `total` correto; `mine` casa nas duas cores; ordenação por `updatedAt`.

**E2E:** `GET /games/:id` no envelope; inexistente → 404; matriz de query inválida → 400;
lista respeita `limit`; `mine` sem token → 401; `mine` traz partida em que o usuário é
preto; **`id` do jogador não aparece em nenhuma resposta**; e a asserção que importa:
**dois `GET /games/:id` consecutivos não alteram `updatedAt`**.

## Open questions

1. **Ordenação da listagem pública.** Hoje implícita por `createdAt`. Partidas aguardando
   adversário provavelmente deveriam vir primeiro em `GET /games?state=WP`.
2. **Busca por jogador.** `GET /games?player=magnus` seria útil e o índice já existe, mas
   expõe o histórico de qualquer usuário — decisão de produto, não técnica.
3. **Cache.** Como a leitura é pura e derivada do tempo, `Cache-Control` é delicado: a
   resposta muda a cada segundo mesmo sem mutação.
