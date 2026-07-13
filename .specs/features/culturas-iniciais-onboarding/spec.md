# Spec — Culturas iniciais "Alface Crespa" e "Rúcula" no onboarding

> Status: incorporada pela spec `.specs/features/onboarding-transacional/spec.md`.
> A criação das culturas iniciais continua obrigatória, mas agora deve fazer parte do boundary transacional do onboarding.

## Contexto

Historicamente, as mutations `createUserAccount` e `inviteContributor` (ramo de novo usuário) criavam dados iniciais para a nova conta: soluções nutritivas (SN Alface 01, SN Rúcula 01), área (Estufa UFMT), reservatórios e setores. A necessidade original era garantir registros de `Cultura` para que o usuário recém-cadastrado tivesse culturas disponíveis para vincular lotes, protocolos e relatórios. A evolução atual desse requisito está na spec de onboarding transacional.

O modelo `Cultura` requer apenas `nome` e vínculo com `Conta` via `fk_contas_id`. O campo `privado` default é `true`.

---

## Goals / Non-Goals

### Goals
1. Criar cultura "Alface" vinculada à nova conta no onboarding.
2. Criar cultura "Rúcula" vinculada à nova conta no onboarding.
3. Aplicar nas duas mutations que criam conta: `createUserAccount` e `inviteContributor` (ramo novo usuário).
4. Manter consistência com os dados iniciais já existentes (soluções, área, reservatórios, setores).

### Non-Goals
1. Não alterar schema do banco.
2. Não alterar contrato GraphQL de nenhuma mutation.
3. Não adicionar novas mutations ou queries.
4. Não criar culturas retroativamente para contas existentes.
5. Não alterar o seed de dados base (`prisma/seed.js`).

---

## Escopo funcional

1. Em `createUserAccount` (`src/schemas/mutation.js`, ~linha 2000):
   - Inserir `prisma.cultura.create` para "Alface" e "Rúcula" vinculadas à nova `conta.id`, após a criação da conta e antes ou junto dos demais itens iniciais.

2. Em `inviteContributor` (`src/schemas/mutation.js`, ~linha 1581):
   - No ramo que cria **novo usuário** (a partir de ~linha 1760), inserir a mesma criação de culturas, após a criação da conta e antes/durante os demais itens iniciais.

3. As culturas devem ser criadas com `privado: true` (default) ou `privado: false` — decisão: manter default do schema (`true`) para não expor a outras contas.

---

## Abordagem técnica

- Adicionar 2 chamadas `prisma.cultura.create` em cada mutation.
- Inserir após a criação da `Conta` e antes da criação das soluções nutritivas para manter uma ordem lógica (conta → culturas → soluções → reservatórios/setores).
- Usar o mesmo `conta.id` já disponível no escopo.

### Pontos de inserção exatos

**createUserAccount** (~linha 2087-2162):
```
2087: const conta = await prisma.conta.create(...)
...
2162: /// CRIA SOLUÇÕES NUTRITIVAS INICIAIS
```
Inserir entre a criação da conta (linha 2097) e o bloco de soluções (linha 2162).

**inviteContributor** (~linha 1774-1868):
```
1774: const conta = await prisma.conta.create(...)
...
1868: /// CRIA SOLUÇÕES NUTRITIVAS INICIAIS
```
Inserir entre a criação da conta (linha 1783) e o bloco de soluções (linha 1868).

---

## Critérios de aceite

1. **WHEN** um novo usuário se cadastra via `createUserAccount`
   **THEN** a conta recém-criada possui culturas "Alface" e "Rúcula" no banco.
2. **WHEN** um colaborador é convidado via `inviteContributor` e não possui conta
   **THEN** a nova conta criada possui culturas "Alface" e "Rúcula" no banco.
3. **WHEN** um colaborador existente é convidado via `inviteContributor` (ramo sem criação de conta)
   **THEN** nenhuma cultura nova é criada (comportamento inalterado).
4. **WHEN** as culturas são criadas
   **THEN** os demais dados iniciais (soluções, área, reservatórios, setores) continuam sendo criados sem alteração.

---

## Dependências / impacto

### Dependências
1. Camada de resolver GraphQL em `src/schemas/mutation.js`.
2. Modelo Prisma `Cultura` já existe no schema.

### Impacto
1. Apenas `src/schemas/mutation.js` é alterado.
2. Nenhuma mudança de API, schema de banco, ou contratos.

### Riscos
- `mutation.js` já possui ~2870 linhas. Adicionar ~10 linhas é aceitável para o escopo, mas idealmente esse bloco de "onboarding data" seria extraído para um módulo separado no futuro.
