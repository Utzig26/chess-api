# RFC-003: Moves

**Status:** Implementado
**Depende de:** RFC-001, RFC-002

## Summary

Submissão de lances em SAN, consulta dos lances legais, validação de jogador e de vez, e
proteção contra lances simultâneos por concorrência otimista.

## API contract

| | Rota | Efeito |
|---|---|---|
| 🔒 | `POST /games/:id/move` | Aplica o lance |
| 🔓 | `GET /games/:id/moves` | Lista os lances legais da posição |

`POST /games/:id/move`:

```json
{ "move": "Nf3" }
```

Devolve 200 com a partida atualizada. `GET /games/:id/moves` devolve
`{ "game": { … }, "moves": ["a3","a4","Nf3", …] }`.

## Behaviour

Ordem da validação, e o status de cada falha:

1. partida existe → 404
2. estado é `W` ou `A` → 409
3. quem chama é jogador da partida → 403
4. é a vez dele → 409
5. o relógio não estourou (RFC-004) → a partida encerra e devolve 409
6. o SAN é legal na posição → 422

Passou tudo: aplica pelo motor, grava `fen`, `pgn`, `history`, troca `turn`, atualiza o
relógio (RFC-004), avalia fim de jogo (RFC-005), e emite o evento (RFC-006).

`W → A` acontece no primeiro lance.

### Self-play

Se o mesmo usuário é branco e preto (RFC-002), o passo 3 passa e o passo 4 usa a vez do
tabuleiro. Ele joga os dois lados, alternando. Nenhum caso especial no código: a checagem
"é jogador" devolve de quais cores ele é dono, e "é a vez" pergunta se `turn` está nesse
conjunto.

### Validação do SAN

O legado validava por regex antes de chegar ao motor (§5 do legado). **Isso não se mantém.**
A regex aceita coisas que a posição não permite e rejeita nada que o motor não fosse
rejeitar — é validação duplicada, e a duplicada é a que mente. O DTO garante apenas que
`move` é string de 2 a 10 caracteres; a legalidade é do motor, resposta única.

### Concorrência

O legado lia, validava e salvava sem transação nem versionamento (§10.9 do legado): dois
`POST /move` simultâneos liam o mesmo estado e o último sobrescrevia o primeiro — o
tabuleiro perdia um lance.

Aqui a escrita usa **concorrência otimista** com o `__v` do Mongoose: o update condiciona
ao `__v` lido. Se outra requisição gravou no meio, o update não casa e a requisição
devolve **409 `Game state changed, retry`**. Sem retry automático: em xadrez, dois lances
simultâneos na mesma partida significam que um dos dois não era a vez de quem jogou, e o
cliente precisa saber.

## Error cases

| Status | Quando | Mensagem |
|---|---|---|
| 400 | `move` ausente ou fora de 2–10 chars | `Validation failed` |
| 401 | sem token | `Unauthorized` |
| 403 | não é jogador da partida | `You are not a player in this game` |
| 404 | partida não existe | `Game not found` |
| 409 | estado não é `W`/`A` | `This game is not accepting moves` |
| 409 | não é a vez | `It is not your turn` |
| 409 | `__v` divergiu | `Game state changed, retry` |
| 422 | SAN ilegal na posição | `Illegal move` |

422 e não 400: o corpo está bem-formado, o conteúdo é que não é aplicável àquela posição.

## Testing strategy

**Unitário:** lance legal aplica e troca a vez; ilegal devolve erro sem tocar no banco;
não-jogador é recusado; fora da vez é recusado; **self-play consegue jogar os dois lados
alternando**; primeiro lance leva `W → A`; `__v` divergente devolve conflito.

**E2E:** partida completa até o mate do pastor (`f3 e5 g4 Qh4#`) terminando em `F`;
`GET /:id/moves` na posição inicial devolve 20 lances; lance de espectador → 403; lance
fora da vez → 409; SAN inválido (`Xz9`, `""`, `"e4e5e6e7e8"`) → 400 ou 422; lance em
partida em `WP` → 409; **dois `POST /move` disparados em paralelo: um 200 e um 409, e o
histórico tem exatamente um lance a mais**.

## Notas de implementação

**A concorrência otimista saiu de graça.** Em vez de condicionar o update ao `__v` na mão,
basta `optimisticConcurrency: true` nas opções do `@Schema`: o Mongoose passa a incluir o
`__v` no filtro de todo `save()` e lança `VersionError` quando ele não bate. O service só
traduz isso para 409. Vale para o `join` também, onde duas entradas simultâneas na mesma
vaga passam a ser resolvidas pelo banco.

**A numeração do lance não vem do motor.** O `moveNumber()` do chess.js descreve a
*posição*, então depois de `1. e4` ele ainda devolve 1, e depois de `1... e5` devolve 2 —
usar isso direto numeraria o lance das pretas como se fosse o par seguinte. O número do
registro é derivado do próprio histórico: `floor(history.length / 2) + 1`. Um teste fixa a
sequência esperada em `[1, 1, 2]`.

**A terminação automática entrou junto.** Um lance que dá mate precisa encerrar a partida
no mesmo `save()`, senão o estado fica inconsistente entre a resposta e o banco. Desistência
e empate por acordo continuam com a RFC-005, que vai absorver este `finish()` na tabela de
terminação.

## Open questions

1. **Notação UCI** (`e2e4`) como alternativa ao SAN. O legado só falava SAN. Aceitar as
   duas é barato no adapter, mas dobra a superfície de teste — fica para depois do básico.
2. **Retry automático no conflito de `__v`.** Recarregar e revalidar seria transparente
   para o cliente, mas mascara o caso em que os dois lances eram legítimos.
