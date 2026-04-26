# Spec de Feature: CRUD de Fertilizantes Tenant-Aware (Backend + Contrato + Integração)

- **Repo:** `isis`
- **Path:** `.specs/features/fertilizantes-crud-tenant/spec.md`
- **Status:** Proposta
- **Última atualização:** 2026-04-26
- **Responsáveis:** Backend/API + Integração App

---

## 1) Contexto (por que esta feature existe)

A base já possui elementos parciais para fertilizantes tenant-aware:
- `origin` no backend (ex.: `SYSTEM`, `CUSTOM`)
- `fk_contas_id` para escopo por conta
- seed de fertilizante de sistema
- mutations de `create/update/softDelete` com regras de tenant e bloqueio para itens `SYSTEM`
- query `fertilizantesCatalogo(contaId)`

No frontend já existe consumo de catálogo e badge “Sistema”, porém o fluxo fim-a-fim de CRUD custom não está completo.  
Além disso, há riscos de inconsistência e regressão:
- desalinhamento de serialização (`fertlizante_model.g.dart`) para `origin`
- filtro `deleted_at: null` em histórico de soluções potencialmente quebrando leitura histórica
- possíveis resolvers de soluções ainda sem blindagem tenant

Esta spec fecha lacunas de backend/contrato para garantir comportamento consistente, seguro e auditável.

---

## 2) Goals e Non-Goals

### Goals
1. Garantir CRUD completo de fertilizantes **custom** com isolamento por tenant.
2. Preservar imutabilidade lógica de fertilizantes `SYSTEM`.
3. Garantir contrato API consistente para `origin` (não nulo nos fluxos esperados).
4. Evitar quebra de histórico de soluções por soft delete de fertilizantes.
5. Blindar resolvers de soluções para evitar vazamento cross-tenant.
6. Definir critérios objetivos de aceite e rastreabilidade.

### Non-Goals
1. Redesenhar domínio de soluções além do necessário para histórico.
2. Alterar política de seed de `SYSTEM`.
3. Refatoração ampla de schema não relacionada à feature.
4. Introduzir novos módulos de permissão além do escopo tenant atual.

---

## 3) Escopo funcional (backend + contrato)

### RF-01 — Criar fertilizante custom
- Criação permitida apenas para tenant autenticado.
- `origin` do criado deve ser `CUSTOM`.
- `fk_contas_id` deve ser derivado de contexto autenticado (não confiado de input cliente).
- Deve aparecer no catálogo do tenant após criação.

### RF-02 — Atualizar fertilizante custom
- Atualização permitida apenas se:
  - item pertence ao tenant (`fk_contas_id` correspondente), e
  - `origin = CUSTOM`, e
  - não está soft-deletado.
- Tentativa em item `SYSTEM` deve falhar com erro de domínio explícito.

### RF-03 — Soft delete de fertilizante custom
- Soft delete permitido apenas para `CUSTOM` do próprio tenant.
- Item soft-deletado não aparece em catálogo operacional.
- Histórico de uso em soluções **deve permanecer consultável**.

### RF-04 — Catálogo tenant-aware consistente
- `fertilizantesCatalogo(contaId)` deve retornar:
  - fertilizantes `SYSTEM` ativos
  - fertilizantes `CUSTOM` ativos da conta solicitada/autorizada
- Não deve retornar custom de outras contas.

### RF-05 — Histórico de soluções resiliente a soft delete
- Consultas históricas não podem “sumir” com referência de fertilizante usado no passado por causa de `deleted_at`.
- Estratégia mínima: permitir resolução histórica por IDs vinculados à solução mesmo se fertilizante estiver soft-deletado.
- Resultado deve identificar item como removido/inativo quando aplicável.

### RF-06 — Blindagem tenant nos resolvers de soluções
- Resolvers relacionados a soluções/fertilizantes devem validar escopo tenant de ponta a ponta.
- Leitura/escrita fora do tenant deve resultar em erro de autorização/escopo.

### RF-07 — Contrato de origem explícito
- `origin` deve ser parte confiável do contrato GraphQL para leituras relevantes.
- Valores aceitos: `SYSTEM`, `CUSTOM`.
- Ausência/`null` em cenários normais de catálogo/edição é inválida.

---

## 4) Abordagem técnica e decisões de design

1. **Tenant derivado de contexto autenticado**
   - Evita spoofing por input cliente.
   - `contaId` informado em query é validado contra escopo do token.

2. **Imutabilidade de `SYSTEM`**
   - Regra de domínio centralizada na camada de serviço (não apenas no resolver).
   - Evita bypass por reuso interno.

3. **Soft delete com preservação histórica**
   - Catálogo operacional filtra removidos.
   - Histórico ignora filtro estrito `deleted_at: null` quando necessário para reconstrução histórica.
   - Deve existir sinalização de item inativo/removido no payload histórico.

4. **Blindagem em todos os resolvers de soluções**
   - Revisão sistemática de resolvers que tocam entidades multi-tenant.
   - Regra: nenhum acesso a entidade sem checagem de `fk_contas_id` (ou vínculo equivalente).

5. **Contrato backward-safe**
   - Alterações preferencialmente aditivas.
   - Mudanças breaking exigem versionamento e comunicação explícita.

---

## 5) Estruturas de dados / interfaces envolvidas

> Observação: nomes exatos devem seguir o schema atual do projeto.

### 5.1 Entidade Fertilizante (conceitual)
- `id: ID`
- `nome: String` (ou campo equivalente já existente)
- `origin: FertilizanteOrigin` (**obrigatório em leitura de catálogo/edição**)
- `fk_contas_id: ID | null` (null/ausente para SYSTEM, presente para CUSTOM conforme modelo atual)
- `deleted_at: DateTime | null`

### 5.2 Enum
- `FertilizanteOrigin = SYSTEM | CUSTOM`

### 5.3 Operações GraphQL (conceitual)
- Query:
  - `fertilizantesCatalogo(contaId)` (com validação de escopo)
  - Query histórica de solução com fertilizantes sem perda por soft delete
- Mutations:
  - criar custom
  - atualizar custom
  - softDelete custom

### 5.4 Erros de domínio (tipados/explicitos)
- `FORBIDDEN_TENANT_SCOPE`
- `SYSTEM_FERTILIZER_IMMUTABLE`
- `FERTILIZER_NOT_FOUND_OR_INACCESSIBLE`
- `INVALID_ORIGIN_CONTRACT`

---

## 6) Critérios de aceite (WHEN/THEN)

1. **WHEN** usuário autenticado cria fertilizante no tenant A  
   **THEN** item é persistido com `origin=CUSTOM`, vinculado ao tenant A e visível no catálogo do tenant A.

2. **WHEN** usuário do tenant A tenta criar fertilizante informando conta B no input  
   **THEN** backend ignora/sobrescreve com tenant do contexto ou rejeita request; nunca persiste em B.

3. **WHEN** usuário do tenant A atualiza fertilizante CUSTOM de A  
   **THEN** atualização ocorre com sucesso.

4. **WHEN** usuário do tenant A tenta atualizar fertilizante `SYSTEM`  
   **THEN** operação falha com erro `SYSTEM_FERTILIZER_IMMUTABLE`.

5. **WHEN** usuário do tenant A tenta atualizar/deletar fertilizante CUSTOM do tenant B  
   **THEN** operação falha com erro de escopo (`FORBIDDEN_TENANT_SCOPE` ou equivalente).

6. **WHEN** usuário soft-deleta fertilizante CUSTOM do próprio tenant  
   **THEN** item não aparece mais em catálogo operacional.

7. **WHEN** consulta histórica de solução referencia fertilizante soft-deletado  
   **THEN** histórico continua retornando informação suficiente do fertilizante (com status inativo/removido).

8. **WHEN** `fertilizantesCatalogo` é chamado no tenant A  
   **THEN** resposta contém `SYSTEM` + CUSTOM de A, e não contém CUSTOM de B.

9. **WHEN** catálogo é retornado  
   **THEN** `origin` vem preenchido com valor válido do enum para todos itens elegíveis.

10. **WHEN** resolver de soluções recebe ID de entidade fora do tenant  
    **THEN** acesso é bloqueado e nenhum dado sensível cross-tenant é retornado.

---

## 7) Edge cases

1. Fertilizante custom já soft-deletado recebe nova tentativa de delete.
2. Atualização concorrente de fertilizante no instante de soft delete.
3. Histórico contendo referência para fertilizante fisicamente inexistente (legado/inconsistência).
4. Token com tenant inválido ou sem claim de conta.
5. `origin` inesperado no banco (dado legado fora do enum).
6. Query de catálogo com `contaId` divergente do contexto autenticado.
7. Solução contendo múltiplos fertilizantes onde parte está ativa e parte deletada.

---

## 8) Open questions (precisam de clarificação)

1. Em histórico, qual representação UX/API para fertilizante deletado: flag `isDeleted`, label textual, ou ambos?
2. `fertilizantesCatalogo(contaId)` deve aceitar `contaId` explícito no futuro ou migrar para derivação exclusiva do contexto?
3. Em caso de dado legado sem `origin`, qual estratégia: migração obrigatória, fallback temporário, ou erro duro?
4. Lista exata de resolvers de soluções que exigem hardening tenant (inventário final).
5. Política de erro padronizada (códigos e mensagens) já definida no backend?

---

## 9) Rastreabilidade de requisitos

| ID | Requisito | Origem do gap | Componente | Critério de aceite relacionado |
|---|---|---|---|---|
| RF-01 | Create custom tenant-aware | Gap CRUD fim-a-fim | Backend mutation | CA-1, CA-2 |
| RF-02 | Update custom com bloqueio SYSTEM | Gap CRUD + regra domínio | Backend mutation/service | CA-3, CA-4, CA-5 |
| RF-03 | Soft delete custom sem quebrar histórico | Gap histórico | Backend mutation/query | CA-6, CA-7 |
| RF-04 | Catálogo com SYSTEM + CUSTOM do tenant | Gap integração | Query catálogo | CA-8 |
| RF-05 | Histórico resiliente a deleted_at | Gap query histórico | Query soluções/histórico | CA-7 |
| RF-06 | Hardening tenant em resolvers soluções | Gap segurança multi-tenant | Resolvers soluções | CA-10 |
| RF-07 | Contrato origin explícito | Gap serialização/contrato | Schema/DTO | CA-9 |

---

## 10) Dependências e impacto

- Dependência de alinhamento com frontend para uso consistente de `origin`.
- Potencial ajuste de testes de integração e snapshot de schema.
- Possível migração de dados legados para `origin` não nulo.
