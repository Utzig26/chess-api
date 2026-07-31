# RFC-005: Game termination

**Status:** Implementado
**Depende de:** RFC-001, RFC-003, RFC-004

## Summary

Como a partida acaba: desistência, empate por acordo (dois booleanos, sem rota de
"aceitar") e as cinco terminações automáticas que o motor detecta. Define o estado `F`, o
`result` e o `finishedAt`.

## API contract

| | Rota | Efeito |
|---|---|---|
| 🔒 | `POST /games/:id/resign` | Desiste |
| 🔒 | `POST /games/:id/draw` | Oferece ou aceita empate |
| 🔒 | `DELETE /games/:id/draw` | Retira a própria oferta |

Nenhuma tem corpo. Todas devolvem a partida atualizada.

### Empate sem endpoint de aceitar

`drawOffer` é `{ white: boolean, black: boolean }`. Oferecer é `POST /:id/draw`; aceitar é
**chamar a mesma rota**. Quando os dois ficam `true`, a partida encerra em empate.
`DELETE` zera apenas a flag de quem chamou.

Herdado do legado (§5 do legado) e vale manter: elimina um endpoint, elimina o estado
intermediário "oferta pendente de resposta" e é naturalmente idempotente — oferecer duas
vezes não faz nada.

## Behaviour

### Detecção automática vence o motivo pedido

Antes de aplicar o motivo que a rota pediu, consulta o motor:

```
if checkmate            → "checkmate"
else if insufficientMaterial → "insufficientMaterial"
else if stalemate       → "stalemate"
else if threefoldRepetition  → "threefoldRepetition"
else if fiftyMoveRule   → "fiftyMoveRule"
else                    → o motivo pedido (resign / draw / timeout)
```

Comportamento do legado (§7 do legado), mantido de propósito: significa que **uma
desistência numa posição já empatada por material insuficiente é registrada como empate**,
não como desistência. Está certo — a posição já era empate antes de a pessoa clicar, e o
resultado da partida não deve depender de quem clicou primeiro.

A diferença é onde isso mora. No legado era um `switch` de 85 linhas numa função solta
(§10.10 do legado); aqui é uma tabela de terminação num serviço injetável, testável sem
banco.

### Estado final

```
status.state          = 'F'
status.result         = 'White wins' | 'Black wins' | 'Draw'
status.additionalInfo = frase legível
status.finishedAt     = timestamp
```

Uma partida em `F` recusa qualquer mutação com 409. As terminações automáticas são
avaliadas depois de todo lance (RFC-003) e o timeout depois de toda mutação (RFC-004).

### Self-play

Quem joga dos dois lados pode desistir e pode empatar consigo mesmo — a oferta marca a
flag da cor da vez, e a segunda chamada marca a outra e encerra. O legado já se comportava
assim (`drawRequest` sabia empatar consigo mesmo); aqui é documentado.

## Error cases

| Status | Quando | Mensagem |
|---|---|---|
| 401 | sem token | `Unauthorized` |
| 403 | não é jogador | `You are not a player in this game` |
| 404 | partida não existe | `Game not found` |
| 409 | partida não está em `W` nem `A` | `This game is already finished` |
| 409 | `DELETE /draw` sem oferta própria ativa | `You have no draw offer to withdraw` |

## Testing strategy

**Unitário:** desistência das brancas → `Black wins`; das pretas → `White wins`; uma oferta
só marca a flag; duas ofertas de lados diferentes encerram em `Draw`; duas do mesmo lado
não encerram; `DELETE` zera só a própria flag; **desistência numa posição de material
insuficiente é gravada como empate** (a regra do §7); `finishedAt` é preenchido;
partida em `F` recusa mutação.

**E2E:** mate do pastor encerra sozinho com `result: "White wins"`; afogamento a partir de
uma posição montada; ciclo completo de oferta → retirada → oferta → aceite; desistência de
espectador → 403; desistir duas vezes → 409; **self-play empata consigo mesmo**; todo
encerramento traz `finishedAt` e `result` no envelope.

## Notas de implementação

**A tabela virou uma função pura de três argumentos.** `resolveTermination(outcome,
sideToMove, requested)` recebe o que o motor detectou, de quem é a vez e o motivo pedido, e
devolve `{ result, additionalInfo }` — ou `null` quando não há nada a encerrar. O `finish()`
que a RFC-003 tinha criado foi absorvido: o fluxo de lance agora chama a mesma função com
`requested: null`.

**O vencedor do xeque-mate sai da vez, não de quem jogou.** Nas duas entradas a posição de
mate tem o lado matado na vez, então `winnerAgainst(sideToMove)` serve tanto para o lance
que dá mate quanto para uma desistência numa posição já matada. Isso é o que permitiu
unificar os dois caminhos numa função só.

**Toda mutação passa pelo mesmo portão.** `openMutation` resolve partida, valida jogador e
checa o relógio antes de qualquer coisa — usado por lance, desistência, oferta e retirada.
Sem isso, desistir de uma partida com o tempo já estourado registraria desistência em vez
de derrota por tempo.

**Contra si mesmo, a oferta alterna sozinha.** Quem tem as duas cores marca primeiro a flag
da cor da vez e depois a outra, então duas chamadas encerram em empate. É a leitura direta
do modelo de dois booleanos, sem caso especial.

## Open questions

1. **Empate por material insuficiente com tempo esgotado.** A regra FIDE diz que se o lado
   que não estourou não tem material para dar mate, é empate, não vitória por tempo. O
   legado não tratava. Vale implementar, e a ordem da tabela já favorece: material
   insuficiente é avaliado antes do timeout.
2. **Abandono sem desistência.** Um jogador que simplesmente some só perde quando o relógio
   estoura — o que, pela RFC-004, ninguém detecta até alguém ler a partida.
