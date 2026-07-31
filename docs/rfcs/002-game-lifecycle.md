# RFC-002: Game lifecycle

**Status:** Proposto
**Depende de:** RFC-001

## Summary

Cria o módulo `games`: o schema da partida, a máquina de estados, a criação com escolha ou
sorteio de cor, o ID legível e a entrada do segundo jogador. **Jogar contra si mesmo é
feature suportada e documentada**, não efeito colateral.

## Motivation

É o núcleo que sumiu na reescrita. Sem partida não há lance, relógio, fim de jogo nem SSE.

O legado tinha isso funcionando, e a máquina de estados dele (§7 do legado) estava certa —
o que estava errado era onde ela morava: `updateStatus` era um `switch` de 85 linhas numa
função solta no fim do service, fora da injeção de dependência e intestável isoladamente.

## API contract

| | Rota | Efeito |
|---|---|---|
| 🔒 | `POST /games` | Cria a partida, criador ocupa uma cor |
| 🔒 | `POST /games/:id/join` | Ocupa a vaga livre |

`POST /games`:

```jsonc
{
  "pieces": "w",                                        // opcional: "w" | "b"; omitido = sorteio
  "timeControl": { "white": 600, "black": 600, "increment": 5 }
}
```

Resposta 201, no envelope, com `data` sendo a partida serializada:

```jsonc
{
  "id": "brave-crimson-knight-e4",
  "whitePlayer": "magnus",
  "blackPlayer": null,
  "turn": "w",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "status": { "state": "WP", "result": null, "additionalInfo": "Waiting for the players to connect" },
  "timeControl": { "white": 600, "black": 600, "increment": 5 },
  "history": [],
  "createdAt": "…"
}
```

## Data model

Coleção `games`:

| Campo | Tipo | Notas |
|---|---|---|
| `resourceId` | `string` | **único**, é o `id` público |
| `whitePlayer` / `blackPlayer` | `{ id: ObjectId, username: string } \| null` | |
| `turn` | `'w' \| 'b'` | derivado do motor, gravado para consulta |
| `fen`, `pgn`, `history` | | RFC-001 |
| `timeControl` | `{ white, black, increment, turnTime }` | RFC-004 |
| `status` | `{ state, result, additionalInfo, finishedAt }` | |
| `drawOffer` | `{ white: boolean, black: boolean }` | RFC-005 |

Índices: `resourceId` único; `status.state` para a listagem (RFC-007);
`{ 'whitePlayer.id': 1 }` e `{ 'blackPlayer.id': 1 }` para "minhas partidas".

**O `id` do jogador nunca sai na resposta.** Serializa só o `username`, como o legado
fazia por `@Transform` (§6 do legado). O cliente descobre de que lado está comparando com
o `username` do `GET /users/me`.

### resourceId

`<adjetivo>-<cor>-<substantivo>-<casa>`, ex.: `brave-crimson-knight-e4`. Muito melhor que
um ObjectId numa URL compartilhável.

O legado gerava com `unique-names-generator` num `do…while` consultando o banco até achar
um livre. Mantém a ideia, **inverte o controle**: gera, tenta inserir, e deixa o índice
único rejeitar — no máximo 5 tentativas, depois 500. É a mesma lição da checagem de
username duplicado: o índice decide, atomicamente.

## Behaviour

```
WP  Waiting for Players    → criada, uma cor livre
W   Waiting for first move → dois jogadores, tabuleiro intocado
A   Active                 → pelo menos um lance
F   Finished               → RFC-005
```

Transições desta RFC: `POST /games` cria em `WP`; `POST /:id/join` leva a `W`.
`W → A` é da RFC-003; qualquer coisa `→ F` é da RFC-005.

`additionalInfo` é uma frase legível por transição. **A grafia errada do legado é
corrigida** (`aditionalInfo` → `additionalInfo`, `"Wating for the players connect"` →
`"Waiting for the players to connect"`): o contrato está sendo refeito do zero, não há
cliente para quebrar (§10 cosméticos do legado).

### Jogar contra si mesmo

Decisão tomada: **é feature**. Quem criou a partida pode chamar `POST /:id/join` e ocupar
a outra cor. A partida fica com o mesmo `username` nos dois lados e a pessoa joga os dois
— útil para treino, análise e para testar um cliente sem um segundo usuário.

No legado isso funcionava por omissão: `getGameStatus(game,'join')` só conferia o estado,
ninguém verificava quem estava entrando, e `wichPlayer()` já devolvia `'wb'` para esse caso
(§10.2 do legado). Aqui passa a ser explícito: a validação de vez (RFC-003) trata `'wb'`
como "pode jogar dos dois lados", e a documentação Swagger diz isso.

### Validação do corpo

- `pieces`: `'w' | 'b'`, opcional. Omitido → sorteio.
- `timeControl.white` / `.black`: inteiros, 10 a 5400 segundos.
- `timeControl.increment`: inteiro, 0 a 10 segundos.

## Error cases

| Status | Quando | Mensagem |
|---|---|---|
| 400 | corpo inválido | `Validation failed` + `errors[]` |
| 401 | sem access token | `Unauthorized` |
| 404 | `:id` não existe | `Game not found` |
| 409 | `join` numa partida que não está em `WP` | `This game is not joinable` |
| 500 | 5 colisões seguidas de `resourceId` | `Internal server error` |

## Testing strategy

**Unitário** (`GamesService`): sorteio cobre as duas cores; cor escolhida é respeitada;
estado inicial é `WP`; `join` preenche a vaga livre e vai para `W`; `join` fora de `WP` dá
conflito; **o criador consegue ocupar a segunda cor**; colisão de `resourceId` tenta de novo.

**E2E** (`GamesController`): criar → 201 no envelope; matriz de `timeControl` inválido
(9 segundos, 5401, incremento 11, negativo, não-inteiro, campo faltando); criar sem token →
401; `join` em partida inexistente → 404; `join` duas vezes → 409; **`id` do jogador não
aparece em nenhuma resposta**; FEN inicial é completo e parseável.

## Open questions

1. **Abandono.** Uma partida em `WP` que ninguém entra fica lá para sempre. Um TTL index
   em `createdAt` para partidas ainda em `WP` resolveria. Fora do escopo do básico, mas a
   listagem (RFC-007) vai expor o problema.
2. **Limite de partidas simultâneas por usuário.** Sem limite, um usuário autenticado cria
   partidas indefinidamente. O throttler já cobre a rajada, não o acúmulo.
