# RFC-001: Chess engine adapter

**Status:** Proposto
**Depende de:** —

## Summary

Introduz `ChessEngineService`, a única fronteira do projeto com a biblioteca de xadrez.
Adota o `chess.js` oficial no lugar do fork `github:Utzig26/chess.js#dev` que a versão
antiga usava, e define como a posição é persistida: FEN, PGN e histórico SAN.

## Motivation

O legado persistia o **objeto `Chess` inteiro** no Mongo (`@Prop({ type: Chess })`) e o
reidratava com `new Chess(game.board)`, passando um objeto onde o construtor oficial espera
uma string FEN. Isso é o que forçou o fork — um fork pessoal, não mantido, de uma
biblioteca de terceiros, no caminho crítico da regra de negócio.

Além disso o motor era chamado direto do service (§10.10 do legado): trocar de biblioteca,
ou testar a regra sem ela, era impossível.

Sem esta RFC nada mais anda: as RFCs 002 a 006 dependem de saber o que é uma posição.

## Design

```
src/chess/
├── chess.module.ts
├── chess-engine.service.ts       única importação de chess.js no projeto
├── interfaces/
│   ├── position.interface.ts
│   └── move-result.interface.ts
└── chess-engine.service.spec.ts
```

Contrato:

```ts
loadGame(pgn: string): LoadedGame
legalMoves(game: LoadedGame): string[]
applyMove(game: LoadedGame, san: string): MoveResult
outcome(game: LoadedGame): GameOutcome | null
turn(game: LoadedGame): 'w' | 'b'
```

`LoadedGame` é um tipo opaco do módulo. Nenhum consumidor recebe um `Chess`.

`MoveResult` traz `{ san, fen, pgn, moveNumber, color }`.
`GameOutcome` é `'checkmate' | 'stalemate' | 'insufficientMaterial' | 'threefoldRepetition' | 'fiftyMoveRule'`.

## Data model

O que a partida persiste, e por quê:

| Campo | Tipo | Razão |
|---|---|---|
| `fen` | `string` | posição atual, barata de ler sem replay |
| `pgn` | `string` | **fonte da verdade**; o replay reconstrói o estado interno do motor |
| `history` | `[{ san, timestamp, moveNumber }]` | contrato público e base do relógio (RFC-004) |

O PGN é o campo que importa. Repetição tripla e regra dos 50 lances dependem do
**histórico de posições**, não da posição atual — um FEN sozinho não sabe que aquela
posição já apareceu duas vezes. Carregando o PGN, o `chess.js` reconstrói isso sozinho e
`isThreefoldRepetition()` responde certo, sem nenhuma lógica nossa.

O custo é recomputar a partida a cada requisição. Uma partida longa tem ~80 lances; o
replay é da ordem de microssegundos e não aparece ao lado do round-trip do Mongo.

O `fen` fica como campo derivado, gravado junto no mesmo `save()`. Se divergir do PGN, o
PGN vence — e um teste garante que não divergem.

## Behaviour

- `applyMove` valida o SAN contra os lances legais da posição. Lance ilegal **não** lança:
  devolve um resultado de erro tipado, e quem decide o status HTTP é a RFC-003.
- O FEN inicial completo (`rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`)
  passa a ser constante do módulo. O legado guardava só a parte de peças (§10.4 do
  legado), e qualquer cliente que confiasse nele antes do primeiro lance recebia FEN
  inválido.
- `outcome` devolve `null` enquanto a partida está viva. Ela **não** decide desistência ou
  empate por acordo: isso não é estado do tabuleiro e é da RFC-005.

## Error cases

Nenhum HTTP. Este módulo não conhece HTTP — devolve resultados tipados. Traduzir para
status é responsabilidade de quem chama.

## Testing strategy

Unitário, sem banco e sem app. É o módulo mais fácil de testar do projeto e o que mais
paga por isso:

- lances legais e ilegais a partir da posição inicial;
- notação SAN em todas as formas que o legado aceitava por regex: peça, peão, captura,
  promoção, *en passant*, roque dos dois lados;
- **repetição tripla reconstruída por replay do PGN** — o teste que justifica persistir PGN;
- regra dos 50 lances;
- xeque-mate (mate do pastor), afogamento, material insuficiente;
- FEN inicial completo e parseável;
- `fen` derivado bate com o PGN depois de N lances.

## Open questions

Nenhuma. A decisão de motor e de persistência foi tomada; esta RFC só a registra.
