# chess-api

API REST de xadrez multiplayer assíncrono em NestJS + MongoDB.
Reescrita em andamento — `docs/legacy-api.md` documenta a versão anterior e serve de
especificação de comportamento para as features ainda não portadas.

---

## Commits

- **O autor é somente Gabriel Utzig.** Nunca adicionar `Co-Authored-By:`, `Claude-Session:`
  ou qualquer outro trailer de atribuição.
- Nenhuma menção a assistentes de IA em mensagem de commit, corpo de PR, código ou
  documentação.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `perf:`.
  Assunto no imperativo e em inglês; corpo explicando o *porquê* quando não for óbvio.
- Nunca commitar direto na `master` sem pedido explícito.

## O que não é versionado

`.claude/`, `.claude-*/`, `CLAUDE.local.md`, `.env`, `.pnpm-store/`.
Este arquivo (`CLAUDE.md`) é versionado por ser a fonte das regras do projeto.

---

## Código

**Tudo em inglês** — identificadores, mensagens de erro, textos de Swagger, nomes de teste,
mensagens de commit. Este arquivo e os documentos em `docs/` são a única exceção.

**Sem comentários.** O código deve ser autoexplicativo: nomes claros, funções pequenas.
Exceção única: um "porquê" não óbvio (workaround, bug de biblioteca, decisão
contraintuitiva), em no máximo 2 linhas. Nunca comentar o que o código já diz, nunca
docstrings óbvios, nunca separadores de seção, nunca TODOs não pedidos.

**Proibido:** `console.log` (use o logger injetado), `any` explícito ou implícito,
acesso direto a `process.env` fora de `src/config/`, lógica de negócio em controller.

**TypeScript:** `strict` ligado. Retornos de método público sempre anotados. Nada de
`!` non-null assertion para calar o compilador — trate o caso.

**Async:** toda chamada que retorna `Promise` é aguardada. A ausência de um `await` já
custou uma falha crítica de autenticação neste repo (`docs/legacy-api.md` §14.1).

---

## Padrões de arquitetura

```
src/
├── config/           configuração tipada e validada no boot
├── common/           camada transversal: filters, interceptors, guards, decorators, dto
├── auth/
├── users/
└── <feature>/
    ├── <feature>.controller.ts
    ├── <feature>.service.ts
    ├── <feature>.module.ts
    ├── dto/
    └── schema/
```

- **Nomes de arquivo em kebab-case**, sufixo pelo papel:
  `create-user.dto.ts`, `jwt-auth.guard.ts`, `all-exceptions.filter.ts`,
  `global-response.interceptor.ts`, `refresh-token.schema.ts`.
- **Imports internos pelo alias `@app/*`**, nunca caminhos relativos que sobem de diretório
  (`../../`) e nunca `src/...` cru.
- Providers globais registrados por DI (`APP_FILTER`, `APP_INTERCEPTOR`, `APP_PIPE`),
  nunca instanciados com `new` no `main.ts`.
- Um serviço não importa outro módulo de domínio direto: importa o módulo e consome o que
  ele exporta. `forwardRef` só quando existir ciclo real.
- Toda biblioteca externa de domínio fica atrás de um adapter próprio. Nenhum arquivo além
  do adapter importa a lib.

## Respostas HTTP

Toda resposta sai pelo envelope único (`SuccessResponse` / `ErrorResponse`), incluindo erros.
A mensagem de sucesso vem do decorator `@WrapMessage(...)` no handler, nunca de um `if`
dentro do controller. Nenhum caminho de erro pode escapar do filtro global.

## Swagger

Toda rota exposta tem `@ApiOperation`, e um `@ApiResponse` para **cada** status que ela pode
retornar. DTOs de request e de response com `@ApiProperty` em todos os campos. As respostas
documentadas mostram o envelope real, não o DTO cru.

## Testes

- Teste unitário no service, e2e no controller. Toda feature nova chega com os dois.
- **Todo bug corrigido chega junto com o teste que o teria pego** — escrito antes do fix,
  visto falhando, e só então o fix.
- Nomes de teste descrevem o comportamento, não o método:
  `rejects sign in when the password does not match`, não `test checkPassword`.
- Os e2e sobem a aplicação com os mesmos globals do `main.ts`, senão não exercitam envelope,
  filtros nem pipes.

---

## Comandos

```
npm run start:dev     # watch
npm run lint          # eslint --fix
npm test              # unitários
npm run test:e2e      # e2e
docker compose up -d  # MongoDB local
```
