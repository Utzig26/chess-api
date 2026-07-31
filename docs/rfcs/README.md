# RFCs

Cada feature de xadrez ainda não portada tem uma RFC aqui antes de virar código.
A especificação de comportamento é `../legacy-api.md`: a versão antiga já resolveu
esses problemas, e o documento registra tanto o que ela acertou quanto onde errou.

## Índice

| # | Título | Status | Depende de |
|---|---|---|---|
| [001](001-chess-engine-adapter.md) | Chess engine adapter | Proposto | — |
| [002](002-game-lifecycle.md) | Game lifecycle | Proposto | 001 |
| [003](003-moves.md) | Moves | Proposto | 001, 002 |
| [004](004-clock.md) | Clock and time control | Proposto | 002, 003 |
| [005](005-game-termination.md) | Game termination | Proposto | 001, 003, 004 |
| [006](006-realtime-stream.md) | Real time stream | Proposto | 002, 003, 005 |
| [007](007-game-queries.md) | Game queries | Proposto | 002 |

Ordem de implementação: 001 → 002 → 003 → 004 → 005 → 007 → 006.
O 006 vem por último de propósito: o SSE só transporta o que os outros já produzem,
e escrevê-lo antes esconderia bugs de estado atrás de um stream.

## Template

```markdown
# RFC-NNN: Título

**Status:** Proposto | Aceito | Implementado
**Depende de:** RFC-XXX

## Summary
Um parágrafo: o que entra.

## Motivation
Por que agora, e o que quebra se não existir.

## API contract
Rotas, corpos, respostas — no envelope real.

## Data model
Campos, índices, invariantes.

## Behaviour
Regras, transições, casos de borda.

## Error cases
Cada erro, com status e mensagem.

## Testing strategy
O que o teste unitário cobre, o que o e2e cobre.

## Open questions
O que ainda não foi decidido.
```

## Convenções que valem para todas

- Tudo em inglês no código; as RFCs em português.
- Nenhuma rota sem `@ApiOperation` e um `@ApiResponse` por status possível.
- Toda resposta pelo envelope (`SuccessResponse` / `ErrorResponse`), inclusive erro.
- Serviço testado por unitário, controller por e2e, os dois na mesma entrega.
- Biblioteca externa de domínio sempre atrás de um adapter (RFC-001 é o caso).
