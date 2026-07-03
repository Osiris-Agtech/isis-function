# Plano de Implementação — Soft Delete Padronizado

## Arquivos tocados e responsabilidades

| # | Arquivo | Responsabilidade | Ação |
|---|---|---|---|
| 1 | `prisma/schema.prisma` | Adicionar `deleted_at` em `Solucoes_Contas` e `Solucoes_Fertilizantes_Concentradas` | Editar |
| 2 | `prisma/migrations/20260703000000_add_deleted_at_junction_tables/migration.sql` | Migration SQL para adicionar colunas | Criar |
| 3 | `src/errors/apiErrors.js` | Adicionar `ALREADY_DELETED: 409` em `ERROR_STATUS_BY_CODE` | Editar |
| 4 | `src/schemas/solucoes_contas.js` | Adicionar `t.model.deleted_at()` | Editar |
| 5 | `src/schemas/solucoes_fertilizantes_concentradas.js` | Adicionar `t.model.deleted_at()` | Editar |
| 6 | `src/schemas/softDeleteUtils.js` | Utilitários compartilhados: `getAuthorizedContaIds`, `assertEntityInTenantScope`, `assertNotDeleted` | Criar |
| 7 | `src/schemas/softDeleteResolvers.js` | Resolver functions para todas as soft delete mutations | Criar |
| 8 | `src/schemas/mutation.js` | Importar resolvers, registrar `t.field()` calls, remover implementações inline antigas | Editar |

## Limites que não devem ser cruzados

- `mutation.js` NÃO deve ter as implementações inline — apenas `t.field()` delegando para os resolvers importados.
- `prisma/schema.prisma` NÃO deve ter nenhuma alteração além de adicionar `deleted_at`.
- NENHUM arquivo de schema GraphQL existente deve ser alterado além de `solucoes_contas.js` e `solucoes_fertilizantes_concentradas.js`.
- NENHUMA dependência npm deve ser adicionada ou atualizada.

## Riscos de acoplamento

- `softDeleteResolvers.js` importa de `softDeleteUtils.js` — interface deve ser estável antes da implementação.
- `mutation.js` importa de `softDeleteResolvers.js` — nomes exportados devem ser combinados previamente.
- A ordem de declaração das mutações no `mutationType({ definition(t) { ... })` não importa para o GraphQL, mas para legibilidade, manter agrupamento: simples primeiro, cascade depois, por entidade.

## Workflows de implementação

### Workstream 1 (paralelo): Migration + Schema + Types
**Arquivos permitidos:** `prisma/schema.prisma`, `prisma/migrations/20260703000000_add_deleted_at_junction_tables/migration.sql`, `src/schemas/solucoes_contas.js`, `src/schemas/solucoes_fertilizantes_concentradas.js`
**Arquivos proibidos:** Qualquer outro arquivo
**Dependências:** Nenhuma
**Validação:** `npx prisma generate`

### Workstream 2 (paralelo): apiErrors + Utils
**Arquivos permitidos:** `src/errors/apiErrors.js`, `src/schemas/softDeleteUtils.js` (criar)
**Arquivos proibidos:** Qualquer outro arquivo
**Dependências:** Nenhuma
**Contrato de exportação de softDeleteUtils.js:**
```js
module.exports = {
  getAuthorizedContaIds,   // (prisma, authUserId) => number[]
  assertEntityInTenantScope,  // (prisma, authUserId, modelName, entityId) => entity
  assertNotDeleted,        // (entity, entityName) => void
  ALREADY_DELETED,         // código de erro
}
```

### Workstream 3 (sequencial, após WS2): Resolvers
**Arquivos permitidos:** `src/schemas/softDeleteResolvers.js` (criar)
**Arquivos proibidos:** Qualquer outro arquivo
**Dependências:** `softDeleteUtils.js` (contrato definido acima)
**Contrato de exportação:**
```js
module.exports = {
  softDeleteLote,
  softDeleteLoteCascade,
  softDeleteArea,
  softDeleteAreaCascade,
  softDeleteSetor,
  softDeleteSetorCascade,
  softDeleteReservatorio,
  softDeleteReservatorioCascade,
  softDeleteSNutritiva,
  softDeleteSNutritivaCascade,
}
```
Cada função tem assinatura: `async (prisma, authUserId, args) => entity`

### Workstream 4 (sequencial, após WS3): Mutation.js registration
**Arquivos permitidos:** `src/schemas/mutation.js`
**Arquivos proibidos:** Qualquer outro arquivo
**Dependências:** `softDeleteResolvers.js` (contrato definido acima)

## Validação final

```bash
npx prisma generate
node -e "require('./src/schemas')"  # verifica se o schema carrega sem erros
# Teste de linter/typecheck: N/A (projeto não tem)
```
