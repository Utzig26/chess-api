# RFC-001: Chess engine adapter

**Status:** Implementado
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
├── interfaces/chess.interface.ts
└── chess-engine.service.spec.ts
```

Contrato:

```ts
readonly initialFen: string
position(pgn: string): ChessPosition
legalMoves(pgn: string): string[]
applyMove(pgn: string, san: string): AppliedMove | null
```

`ChessPosition` é `{ fen, pgn, turn, moveNumber, outcome }`.
`AppliedMove` estende com `{ san, color }`.
`GameOutcome` é `'checkmate' | 'stalemate' | 'insufficientMaterial' | 'threefoldRepetition' | 'fiftyMoveRule'`.

> **Refinamento na implementação.** A proposta original era `loadGame(pgn)` devolvendo um
> `LoadedGame` opaco que as outras chamadas receberiam. O serviço acabou **stateless, com o
> PGN como único parâmetro**: some o problema de vazar um `Chess` disfarçado de tipo opaco,
> cada método vira função pura e o teste não precisa montar handle nenhum. O custo é
> reparsear o PGN por chamada — um fluxo de lance faz dois parses, na casa dos
> microssegundos, contra um round-trip de Mongo.

A fronteira não é convenção: uma regra `no-restricted-imports` no ESLint quebra o build se
qualquer arquivo fora de `src/chess` importar `chess.js`.

Posições arbitrárias entram por PGN com cabeçalho `[SetUp "1"] [FEN "…"]`, que o `chess.js`
honra. É como os testes montam mate, afogamento e material insuficiente sem precisar de uma
entrada por FEN no contrato público — e é o que a RFC-005 vai usar.

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
  devolve `null`, e quem decide o status HTTP é a RFC-003. O `chess.js` 1.x lança em
  `move()` para lance ilegal — o adapter converte isso em valor de retorno, para que a
  regra de negócio não dependa de `try/catch`.
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

1. **Ordem da tabela de terminação.** `insufficientMaterial` é avaliado antes de
   `stalemate` e de `threefoldRepetition`, o que importa para a RFC-005: uma desistência
   numa posição de material insuficiente vira empate. Xeque-mate vem antes de tudo, e há
   teste para isso.
2. **Notação UCI.** O adapter é o lugar natural para aceitar `e2e4` além de SAN, mas
   dobraria a matriz de teste da RFC-003. Fica para depois do básico.
