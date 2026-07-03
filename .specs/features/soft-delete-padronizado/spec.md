# Spec — Soft Delete Padronizado (Lote, Área, Setor, Reservatório, Solução Nutritiva)

- **Repo:** `isis`
- **Path:** `.specs/features/soft-delete-padronizado/spec.md`
- **Status:** Proposta
- **Última atualização:** 2026-07-03

---

## 1) Contexto

O backend `isis` atualmente possui mutações de soft delete para várias entidades, porém de forma inconsistente:

- Mutações simples (`softDeleteLote`, `softDeleteArea`, `softDeleteSetor`, `softDeleteReservatorio`) não validam existência, `deleted_at` duplicado, nem escopo de tenant.
- Mutações cascade (`softDeleteAreaCascade`, `softDeleteSetorCascade`, `softDeleteReservatorioCascade`, `softDeleteSNutritivaCascade`) têm validações parciais mas também inconsistentes.
- Nenhuma cascade propaga para `Agenda` quando um `Lote` é deletado.
- `Solucoes_Contas` e `Solucoes_Fertilizantes_Concentradas` não possuem `deleted_at`, impossibilitando soft delete controlado de `SNutritiva`.
- Mensagens de erro misturam `UserInputError`, `DomainError` sem critério uniforme.

A mutation `softDeleteProtocoloCascade` é o exemplo funcional de referência, mas também carece de tenant scope e transaction.

---

## 2) Goals e Non-Goals

### Goals

1. Padronizar TODAS as mutações de soft delete com validação de existência, duplo delete, e tenant scope.
2. Implementar cascade para dependências fortes: `Lote → Agendas`.
3. Adicionar `deleted_at` nas tabelas `solucoes_contas` e `solucoes_fertilizantes_concentradas` via migration.
4. Unificar mensagens de erro usando `DomainError` com códigos padronizados.
5. Garantir que mutações simples e cascade coexistam com semântica clara.
6. Revisar e atualizar types do GraphQL para expor `deleted_at` onde aplicável.

### Non-Goals

1. Não refatorar o schema de types do GraphQL além de expor `deleted_at`.
2. Não alterar queries de leitura (CRUD automático do Nexus continua sem filtro global).
3. Não introduzir hard delete (permanente).
4. Não refatorar `softDeleteProtocoloCascade` — já existe e é referência, mesmo que não ideal.
5. Não atualizar bibliotecas (`@nexus/schema@0.20.1`, `nexus-plugin-prisma@0.35.0`, `prisma@3.15.2`, `graphql@15.9.0` permanecem).

---

## 3) Decisões de design (confirmadas)

| Decisão | Escolha | Justificativa |
|---|---|---|
| **deleted_at em junction tables** | Adicionar coluna via migration | Permite soft delete completo de SNutritiva sem orphan records |
| **Cascade para dependência forte** | Lote deletado → Agendas deletadas | Agendas sem lote não têm sentido operacional |
| **Cascade para dependência média** | Área → Setores → Lotes → Agendas | Hierarquia física: deletar área implica perder setores e lotes |
| **Sem cascade para dependência fraca** | Reservatório não deleta SNutritiva; SNutritiva cascateia apenas reservatórios | Relação é de referência, não de composição |
| **Tenant scope** | Validar em TODAS as mutações | Impede deleção cross-account |
| **Erros padronizados** | `DomainError` com `NOT_FOUND`, `ALREADY_DELETED`, `TENANT_SCOPE_VIOLATION` | Uniformidade para o frontend tratar |
| **Transaction** | Usar `prisma.$transaction` em todas as cascades | Atomicidade entre múltiplos updates |
| **Mensagens** | Português, amigável para consumo do frontend | Consistente com o resto da API |

---

## 4) Escopo funcional

### RF-01 — Migration: `deleted_at` em junction tables

- Adicionar coluna `deleted_at` (`TIMESTAMP(6)`, nullable) em `solucoes_contas`.
- Adicionar coluna `deleted_at` (`TIMESTAMP(6)`, nullable) em `solucoes_fertilizantes_concentradas`.
- Nome da migration: `20260703000000_add_deleted_at_junction_tables`.

### RF-02 — Soft delete de Lote

**Simples:**
- Mutation: `softDeleteLote(loteId: Int!): Lote`
- Valida: existência, `deleted_at`, tenant scope.
- Apenas marca `deleted_at`.

**Cascade (sobrescreve a atual):**
- Mutation: `softDeleteLoteCascade(loteId: Int!): Lote`
- Valida: existência, `deleted_at`, tenant scope.
- `$transaction`:
  1. Soft delete Agendas vinculadas (`fk_lote_id`) com `deleted_at = null`.
  2. Soft delete do próprio Lote.
- A mutation `softDeleteLoteCascade` **substitui** o comportamento da atual `softDeleteLote` no frontend (que não tem cascade). A `softDeleteLote` simples permanece para uso interno/futuro.

### RF-03 — Soft delete de Área

**Simples:**
- Mutation: `softDeleteArea(areaId: Int!): Area`
- Valida: existência, `deleted_at`, tenant scope.
- Apenas marca `deleted_at`.

**Cascade (sobrescreve a atual):**
- Mutation: `softDeleteAreaCascade(areaId: Int!): Area`
- `$transaction`:
  1. Buscar Setores da área.
  2. Soft delete Agendas dos Lotes desses Setores.
  3. Soft delete Lotes desses Setores.
  4. Soft delete Setores.
  5. Soft delete da própria Área.

### RF-04 — Soft delete de Setor

**Simples:**
- Mutation: `softDeleteSetor(setorId: Int!): Setor`
- Valida: existência, `deleted_at`, tenant scope.

**Cascade (sobrescreve a atual):**
- Mutation: `softDeleteSetorCascade(setorId: Int!): Setor`
- `$transaction`:
  1. Soft delete Agendas dos Lotes do setor.
  2. Soft delete Lotes do setor.
  3. Soft delete do próprio Setor.

### RF-05 — Soft delete de Reservatório

**Simples:**
- Mutation: `softDeleteReservatorio(reservatorioId: Int!): Reservatorio`
- Valida: existência, `deleted_at`, tenant scope.
- Apenas marca `deleted_at`.

**Cascade (sobrescreve a atual):**
- Mutation: `softDeleteReservatorioCascade(reservatorioId: Int!): Reservatorio`
- `$transaction`:
  1. Soft delete Agendas dos Lotes vinculados.
  2. Soft delete Lotes vinculados.
  3. Desvincula Setores (opcional — apenas marca `fk_reservatorios_id = null` OU soft delete).
  4. Soft delete do próprio Reservatório.
- Decisão: Setores **não** são soft-deletados ao deletar reservatório — apenas desvinculados (`fk_reservatorios_id = null`), pois um setor pode existir sem reservatório.

### RF-06 — Soft delete de Solução Nutritiva (SNutritiva)

**Simples:**
- Mutation: `softDeleteSNutritiva(snutritivaId: Int!): SNutritiva`
- Valida: existência, `deleted_at`, tenant scope.
- Apenas marca `deleted_at`.

**Cascade (sobrescreve a atual):**
- Mutation: `softDeleteSNutritivaCascade(snutritivaId: Int!): SNutritiva`
- `$transaction`:
  1. Soft delete `Solucoes_Contas` vinculadas (agora com `deleted_at`).
  2. Soft delete `Solucoes_Fertilizantes_Concentradas` vinculadas (agora com `deleted_at`).
  3. Buscar Reservatórios vinculados.
  4. Soft delete Agendas dos Lotes desses Reservatórios.
  5. Soft delete Lotes desses Reservatórios.
  6. Desvincula Setores desses Reservatórios (`fk_reservatorios_id = null`).
  7. Soft delete Reservatórios.
  8. Soft delete da própria SNutritiva.

### RF-07 — Padronização de erros

Todas as mutações devem usar:

| Condição | Erro | Código | HTTP |
|---|---|---|---|
| Entidade não encontrada | `DomainError('NOT_FOUND', 'X não encontrado')` | `NOT_FOUND` | 404 |
| Entidade já deletada | `DomainError('ALREADY_DELETED', 'X já foi removido')` | `ALREADY_DELETED` | 409 |
| Fora do escopo do tenant | `DomainError('TENANT_SCOPE_VIOLATION', 'X fora do escopo da conta')` | `TENANT_SCOPE_VIOLATION` | 403 |
| Parâmetro inválido | `DomainError('VALIDATION_ERROR', '...')` | `VALIDATION_ERROR` | 400 |

> Nota: `ALREADY_DELETED` (409) é um novo código. Se necessário, registrar em `ERROR_STATUS_BY_CODE` em `apiErrors.js`.

### RF-08 — Utilitário de tenant scope reutilizável

Extrair função `assertEntityInTenantScope(prisma, authUserId, model, entityId, scopeConfig?)` que:
- Dado um model Prisma, entityId, e regras de escopo, valida que o usuário autenticado tem acesso.
- Para entidades com `fk_contas_id` direto: busca a entidade e compara `fk_contas_id` com as contas autorizadas.
- Para `SNutritiva`: usa a lógica existente via `solucoes_contas`.
- Reutilizável por todas as mutações.

---

## 5) Abordagem técnica e restrições

### Stack vigente (NÃO alterar)

```
@nexus/schema: ^0.20.1
nexus: ^1.0.0
nexus-plugin-prisma: ^0.35.0
@prisma/client: ^3.15.2
graphql: ^15.9.0
graphql-yoga: ^5.20.0
```

- `nexus-plugin-prisma` com `experimentalCRUD: true` para `t.model()`.
- Schema gerado via `makeSchema()` em runtime.
- Mutations definidas dentro de `mutationType({ definition(t) { ... })` em `src/schemas/mutation.js`.

### Estrutura do mutation.js

O mutation.js já é muito grande (2700+ linhas). Para minimizar inchaço:

1. **Resolver functions** serão definidas como funções externas (no mesmo arquivo ou extraídas).
2. **Registro no mutationType** seguirá o padrão existente: `t.field('nome', { type, args, resolve })`.
3. **Helpers compartilhados** (`assertEntityInTenantScope`, `assertNotDeleted`, `buildCascadeTransaction`) serão definidos no topo do mutation.js ou em módulo separado.

### Modelo de tenant scope por entidade

| Entidade | Campo de tenant | Estratégia |
|---|---|---|
| `Lote` | `setor.area.fk_contas_id` (indireto via setor → área → conta) | `findUnique` com `include: { setor: { include: { area: { select: { fk_contas_id: true } } } } }` |
| `Area` | `fk_contas_id` (direto) | `findUnique` com `select: { fk_contas_id: true }` |
| `Setor` | `area.fk_contas_id` (indireto) | `findUnique` com `include: { area: { select: { fk_contas_id: true } } }` |
| `Reservatorio` | `fk_contas_id` (direto) | `findUnique` com `select: { fk_contas_id: true }` |
| `SNutritiva` | via `solucoes_contas.fk_contas_id` | `findFirst` com `where: { id, solucoes_contas: { some: { fk_contas_id: { in: authorizedContaIds } } } }` |

### Fluxo padrão de uma mutation

```
1. assertEntityInTenantScope → busca entidade + valida tenant + retorna entidade
2. assertNotDeleted → se deleted_at preenchido, erro ALREADY_DELETED
3. Se cascade: monta array de operações + $transaction
4. Se simples: update direto
5. Retorna entidade atualizada
```

---

## 6) Estruturas de dados / interfaces

### Mutações propostas (assinaturas GraphQL)

```graphql
# Já existem (serão mantidas com validações aprimoradas):
softDeleteLote(loteId: Int!): Lote
softDeleteArea(areaId: Int!): Area
softDeleteSetor(setorId: Int!): Setor
softDeleteReservatorio(reservatorioId: Int!): Reservatorio
softDeleteSNutritiva(snutritivaId: Int!): SNutritiva

# Já existem (serão sobrescritas com validações + cascade para Agendas):
softDeleteLoteCascade(loteId: Int!): Lote
softDeleteAreaCascade(areaId: Int!): Area
softDeleteSetorCascade(setorId: Int!): Setor
softDeleteReservatorioCascade(reservatorioId: Int!): Reservatorio
softDeleteSNutritivaCascade(snutritivaId: Int!): SNutritiva
```

### Types GraphQL (alterações)

`Solucoes_Contas` — adicionar:
```graphql
deleted_at: DateTime
```

`Solucoes_Fertilizantes_Concentradas` — adicionar:
```graphql
deleted_at: DateTime
```

---

## 7) Critérios de aceite (WHEN / THEN)

1. **Lote simples**
   - WHEN `softDeleteLote` é chamado com ID válido e não deletado
   - THEN `deleted_at` é preenchido, e Agendas vinculadas permanecem intactas.

2. **Lote cascade**
   - WHEN `softDeleteLoteCascade` é chamado
   - THEN `deleted_at` é preenchido no Lote e em todas as Agendas com `fk_lote_id = loteId` e `deleted_at = null`.

3. **Área cascade**
   - WHEN `softDeleteAreaCascade` é chamado
   - THEN área, todos os setores, lotes e agendas desses lotes são soft-deletados.

4. **Setor cascade**
   - WHEN `softDeleteSetorCascade` é chamado
   - THEN setor, todos os lotes e agendas desses lotes são soft-deletados.

5. **Reservatório cascade**
   - WHEN `softDeleteReservatorioCascade` é chamado
   - THEN reservatório é deletado, lotes vinculados e agendas são deletados, setores têm `fk_reservatorios_id = null`.

6. **SNutritiva cascade**
   - WHEN `softDeleteSNutritivaCascade` é chamado
   - THEN SNutritiva é deletada, `Solucoes_Contas` e `Solucoes_Fertilizantes_Concentradas` vinculadas são soft-deletadas, reservatórios são deletados, lotes e agendas desses reservatórios são deletados, setores são desvinculados.

7. **Tenant scope**
   - WHEN mutation é chamada com entidade de outra conta
   - THEN erro `TENANT_SCOPE_VIOLATION` é retornado.

8. **Duplo delete**
   - WHEN mutation é chamada em entidade já deletada
   - THEN erro `ALREADY_DELETED` é retornado.

9. **Entidade inexistente**
   - WHEN mutation é chamada com ID que não existe
   - THEN erro `NOT_FOUND` é retornado.

10. **Retorno**
    - WHEN a mutation cascade é bem-sucedida
    - THEN retorna o objeto da entidade raiz com `deleted_at` preenchido.

---

## 8) Edge cases

1. Lote sem Agendas: cascade roda sem afetar nada.
2. Área sem setores: cascade deleta apenas a área.
3. Setor sem lotes: cascade deleta apenas o setor.
4. Reservatório sem lotes nem setores: cascade deleta apenas o reservatório.
5. SNutritiva sem reservatórios: cascade deleta apenas junction tables + a solução.
6. Tenant scope para SNutritiva usa lógica especial via `solucoes_contas` (já existe em `assertSolucaoInTenantScope`, será reutilizada).
7. Usuário não autenticado (`authUserId = null`): erro `VALIDATION_ERROR` genérico ou `UNAUTHENTICATED`.
8. Concorrência: `$transaction` garante atomicidade da cascade. Entre validação e execução pode haver TOCTOU, aceitável para soft delete.

---

## 9) Dependências e impacto

### Dependências
1. Migration de banco (adição de `deleted_at`).
2. Regenerar client Prisma (`npx prisma generate`).
3. Schema GraphQL é gerado automaticamente pelo Nexus.

### Impacto
1. Mutações cascade atuais serão sobrescritas — frontend que consome `softDeleteAreaCascade`, etc., pode precisar de ajuste se esperava comportamento antigo (mas o comportamento novo é strict-super-set).
2. Código existente em `mutation.js` para as mutations simples será substituído.
3. `apiErrors.js` pode precisar do código `ALREADY_DELETED` em `ERROR_STATUS_BY_CODE`.

### Estratégia de rollout
1. Migration primeiro.
2. Regenerar Prisma client.
3. Implementar helpers + mutations.
4. Testar cada mutation unitariamente via chamada GraphQL direta.
5. Homologar com frontend.

---

## 10) Rastreabilidade

| ID | Requisito | Origem | Componente | Critério |
|---|---|---|---|---|
| RF-01 | Migration junction tables | Falta deleted_at em solucoes_contas e solucoes_fertilizantes_concentradas | Migration SQL | CA-6 |
| RF-02 | Soft delete Lote + cascade Agenda | Lote deletado deixa agendas órfãs | mutation.js | CA-1, CA-2 |
| RF-03 | Soft delete Área + cascade hierarquia | Área sem cascade consistente | mutation.js | CA-3 |
| RF-04 | Soft delete Setor + cascade | Setor sem cascade consistente | mutation.js | CA-4 |
| RF-05 | Soft delete Reservatório + cascade | Reservatório sem cascade consistente | mutation.js | CA-5 |
| RF-06 | Soft delete SNutritiva + cascade | SNutritiva sem limpeza de junction tables | mutation.js | CA-6 |
| RF-07 | Erros padronizados | UserInputError vs DomainError inconsistente | mutation.js, apiErrors.js | CA-7, CA-8, CA-9 |
| RF-08 | Utilitário tenant scope | Duplicação de lógica | mutation.js | CA-7 |

---

## 11) Open questions

1. `ALREADY_DELETED` — confirmar se frontend precisa de código específico ou pode tratar como `VALIDATION_ERROR`. Se sim, remover da spec e usar `VALIDATION_ERROR` padrão.
2. Soft delete de `Concentrada`? Ficou fora do escopo por enquanto.
3. A mutation `softDeleteLote` simples (sem cascade) é realmente necessária, ou deve ser unificada na cascade? Decisão: manter ambas para flexibilidade.
