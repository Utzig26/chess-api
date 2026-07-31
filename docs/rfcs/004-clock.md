# RFC-004: Clock and time control

**Status:** Implementado
**Depende de:** RFC-002, RFC-003

## Summary

O relógio preguiçoso: sem timer, sem cron, sem worker. O tempo restante é derivado de
`Date.now()` toda vez que a partida é lida. Incremento Fischer aplicado no lance.
**Diferente do legado, um `GET` não escreve no banco.**

## Motivation

O mecanismo do legado (§8.1 do legado) é a melhor ideia que aquela base tinha e vale
preservar quase inteira: é stateless de verdade, escala horizontalmente sem coordenação e
sobrevive a restart do processo. Nenhum `setInterval`, nenhuma fila.

O que não vale preservar é o efeito colateral: `findOne()` chamava `clock()`, que chamava
`game.save()`. **Toda leitura de partida era uma escrita** (§10.6 do legado) — viola a
semântica de `GET`, multiplica a carga no Mongo e cria corrida quando vários clientes
consultam ao mesmo tempo.

## Data model

```
timeControl: {
  white: number,      segundos restantes das brancas
  black: number,      segundos restantes das pretas
  increment: number,  0–10, Fischer
  turnTime: number    snapshot do relógio de quem tem a vez, no instante do último lance
}
```

`turnTime` é o campo que faz o mecanismo funcionar. É o relógio de quem está pensando,
congelado no momento em que virou a vez dele.

## Behaviour

### Cálculo

```
elapsed   = (now - timestamp do último lance) / 1000
remaining = turnTime - elapsed
```

Se `remaining > 0`, é o tempo de quem tem a vez; o outro lado mantém o valor gravado.
Se `remaining <= 0`, quem tem a vez perdeu por tempo.

Enquanto a partida está em `WP` ou `W` o relógio não corre: só começa no primeiro lance.
Sem isso, uma partida esperando adversário perderia por tempo sozinha.

### Leitura não escreve

Aqui está a diferença central para o legado. Toda leitura chama uma função **pura**:

```ts
project(game, now): GameView
```

que devolve a partida com os relógios já descontados, sem tocar no documento. O timeout
detectado numa leitura aparece na resposta como partida encerrada, mas **a persistência do
fim só acontece numa mutação** — no próximo `POST /move`, `/resign` ou `/draw`, ou no
próprio pedido que descobriu o timeout se ele já for uma mutação.

Consequência aceita: entre o instante do estouro e a próxima mutação, o documento no banco
ainda diz `A`. Toda leitura mostra o resultado correto, porque toda leitura projeta. É a
troca certa — o legado pagava uma escrita por leitura para manter o banco "atualizado" a
um estado que ninguém consultava direto.

### Incremento Fischer

Aplicado ao **fim** do lance, sobre quem acabou de jogar:

```
gasto        = (timestamp deste lance - timestamp do anterior) / 1000
novoTempo    = turnTime - gasto + increment
turnTime     = relógio do lado que agora tem a vez
```

**O bug do primeiro lance é corrigido.** No legado, quando o histórico tinha um único
lance a função só definia `turnTime = timeControl.black` e retornava, sem debitar o tempo
que as brancas levaram — o primeiro lance das brancas era grátis (§10.3 do legado). Aqui o
marco zero é o `startedAt` gravado quando a partida entra em `W`, e o primeiro lance debita
contra ele como qualquer outro.

## Error cases

O relógio não tem rota própria. Ele produz um efeito nas rotas dos outros:

| Status | Quando | Mensagem |
|---|---|---|
| 409 | mutação numa partida cujo tempo já estourou | `Time is up` — a partida é encerrada e a resposta traz o resultado |

## Testing strategy

Tudo com relógio injetado. **Nenhum teste usa `sleep`**: `now` é parâmetro, e é isso que
torna o mecanismo testável — mais um motivo para a função ser pura.

**Unitário:**
- desconta só do lado que tem a vez;
- `remaining <= 0` marca timeout para o lado da vez;
- não corre em `WP` nem em `W`;
- incremento soma depois de descontar o gasto;
- **o primeiro lance das brancas é debitado** (regressão do §10.3);
- incremento 0 não soma nada;
- `turnTime` alterna de lado a cada lance;
- projetar a mesma partida com dois `now` diferentes devolve dois resultados e **não
  modifica o documento** — a asserção que prova que `GET` não escreve.

**E2E:**
- `GET /games/:id` duas vezes com o relógio adiantado devolve tempos diferentes e
  `updatedAt` **inalterado**;
- partida com `white: 10` lida depois do estouro aparece encerrada por tempo;
- um `POST /move` depois do estouro devolve 409 e persiste o fim;
- criar com `timeControl` fora da faixa → 400.

## Notas de implementação

**A projeção mora na camada de view.** `projectGame(game, now)` é função pura em
`game-projection.ts`, e quem a chama é o `GameResponseDto` no construtor. Controllers e
service não precisam saber que existe uma projeção — quem serializa uma partida recebe os
relógios já descontados, e não há caminho de leitura que possa esquecer de projetar.

**O 409 de tempo esgotado não carrega o resultado.** A RFC dizia que "a resposta traz o
resultado", mas o envelope de erro não tem `data` — inventar um seria abrir exceção no
contrato justamente na camada que existe para não ter exceção. A mutação persiste o fim e
devolve `409 Time is up`; a leitura seguinte mostra `F`, o `result` e o `finishedAt`. Há
teste para os dois lados.

**O teste de "GET não escreve" precisa de um relógio manipulável, não de espera.** O e2e
recua `startedAt` e os timestamps do histórico direto no documento, e só então lê. Nenhum
teste dorme, e a asserção que fecha a dívida do §10.6 é comparar o `updatedAt` gravado
antes e depois de três leituras.

## Open questions

1. **Ninguém é notificado do timeout.** Como não há timer, o fim por tempo só se materializa
   quando alguém lê ou joga. Um espectador com o SSE aberto (RFC-006) fica olhando uma
   partida que já acabou. Resolver exige um scheduler — exatamente o que este desenho evita.
   Alternativa barata: o cliente sabe `turnTime` e o timestamp, então pode contar sozinho e
   pedir um `GET` quando zerar.
2. **Relógio do servidor.** `Date.now()` de instâncias diferentes pode divergir. Com NTP a
   divergência é de milissegundos e irrelevante para controles de 10s+, mas está registrado.
