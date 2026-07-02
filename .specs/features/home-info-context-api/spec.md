# Spec de Feature: `home-info-context-api`

- **Repo:** `isis`
- **Path:** `.specs/features/home-info-context-api/spec.md`
- **Status:** Proposta
- **Última atualização:** 2026-07-02
- **Escopo:** API GraphQL `homeDashboard(contaId)` para Home adaptativa do app `osi-solucoes`

---

## 1) Contexto: por que esta feature existe

O app `osi-solucoes` precisa exibir uma Home adaptativa com informações operacionais consolidadas da conta. A API atual já possui a query `homeDashboard(contaId)` em `src/schemas/query.js` e tipos Nexus relacionados à Home em `src/schemas/homeDashboard.js`, mas ainda não expõe um bloco dedicado de contexto informativo para alimentar os cards/sections adaptativos do frontend.

A feature `home-info-context-api` adiciona ao payload de `homeDashboard(contaId)` o campo `infoContext`, composto por dados de cultivo do dia, reservatórios, progresso diário e últimas anotações de campo. A mudança deve ser aditiva ao contrato GraphQL, sem alteração de schema de banco, e deve respeitar os filtros de soft delete já existentes nos modelos que possuem `deleted_at`.

Há risco de acoplamento porque `src/schemas/query.js` é monolítico (~1514 linhas) e já concentra lógica inline. A implementação deve evitar adicionar lógica substancial diretamente nesse arquivo, preferindo serviço dedicado ou extração equivalente.

---

## 2) Goals e Non-Goals

### Goals

1. Expor `infoContext` dentro de `homeDashboard(contaId)` com contrato estável para o frontend.
2. Reaproveitar, para “Hoje no cultivo”, dados já calculados pela Home atual quando existirem no resolver.
3. Agregar dados de reservatórios da conta com totais, volumes, vínculo com solução nutritiva e lotes ativos vinculados.
4. Calcular progresso do dia com base em `Agenda.data` e `Agenda.finalizado`, sem prometer tempo gasto ou duração.
5. Retornar últimas anotações a partir de `Atividade` vinculada a `Lotes_Atividades`, preservando contexto de lote e usuário quando disponível.
6. Evitar N+1 por meio de consultas agregadas, includes controlados ou batching no serviço dedicado.
7. Manter a mudança aditiva e sem alteração de schema Prisma/banco.

### Non-Goals

1. Criar ou alterar tabelas, colunas, enums ou migrations Prisma.
2. Implementar cálculo de duração/tempo gasto em tarefas.
3. Redesenhar toda a query `homeDashboard` ou refatorar integralmente `src/schemas/query.js`.
4. Alterar regras de autenticação/autorização fora do necessário para respeitar o escopo de `contaId` existente.
5. Criar infraestrutura nova de testes se o projeto não possuir padrão existente.
6. Alterar código do app `osi-solucoes`; esta spec documenta apenas o contrato esperado.

---

## 3) Requisitos funcionais

### RF-01 — Expor `infoContext` em `homeDashboard(contaId)`

- A query `homeDashboard(contaId)` deve retornar o campo `infoContext`.
- `infoContext` deve conter os blocos:
  - `todayCultivation`
  - `reservoirReport`
  - `dayProgress`
  - `fieldNotesSummary`
- Campos sem dados devem retornar zeros, `null` quando o contrato permitir, ou arrays vazios; não devem quebrar a query.

### RF-02 — Hoje no cultivo

- `todayCultivation` deve reaproveitar dados já calculados na Home atual quando disponíveis:
  - tarefas de hoje
  - tarefas atrasadas
  - lotes ativos
  - colheitas próximas
  - alertas críticos
  - próximas tarefas
- Lotes ativos devem usar `Lote.ativo` e filtrar `Lote.deleted_at = null`.
- Tarefas devem vir de `Agenda`, filtrando `Agenda.deleted_at = null`.

### RF-03 — Relatório de reservatórios

- `reservoirReport` deve agregar `Reservatorio` da conta (`fk_contas_id = contaId`) com `Reservatorio.deleted_at = null`.
- Deve calcular:
  - total de reservatórios
  - volume total
  - reservatórios com solução nutritiva vinculada
  - reservatórios sem solução nutritiva vinculada
  - lotes ativos vinculados a reservatórios
  - destaques de reservatórios
- Quando houver solução nutritiva, deve incluir `SNutritiva.nome` e `SNutritiva.c_eletrica`.

### RF-04 — Progresso do dia

- `dayProgress` deve usar `Agenda.data` para identificar tarefas do dia.
- Deve calcular:
  - total de tarefas de hoje
  - tarefas finalizadas de hoje
  - tarefas pendentes de hoje
  - tarefas atrasadas
  - próxima tarefa pendente
  - label textual de conclusão (`completionLabel`)
- Deve diferenciar pendentes e finalizadas por `Agenda.finalizado`.
- Não deve expor tempo gasto, duração, início ou fim de execução, pois o schema atual não possui dados confiáveis para isso.

### RF-05 — Últimas anotações de campo

- `fieldNotesSummary` deve retornar últimas anotações a partir de `Atividade` vinculada a `Lotes_Atividades`.
- A ordenação deve usar `Atividade.created_at` em ordem decrescente.
- O retorno deve ser por vínculo `Lotes_Atividades`, não apenas por `Atividade`, para preservar contexto do lote.
- Deve incluir lote e usuário quando disponíveis.
- Deve limitar `latestNotes` a 5 itens.
- `totalRecentNotes` deve refletir a quantidade total considerada pela janela definida pela implementação ou, no mínimo, a contagem de itens retornados; a escolha exata deve ser explicitada no design/implementação.

---

## 4) Requisitos não funcionais

### RNF-01 — Compatibilidade aditiva

- A mudança deve ser backward-compatible: clientes existentes que não selecionam `infoContext` não devem ser impactados.

### RNF-02 — Performance e N+1

- A implementação não deve introduzir N+1 para reservatórios, lotes, tarefas ou anotações.
- Preferir serviço dedicado para consolidar consultas e transformar dados em DTO GraphQL.

### RNF-03 — Soft delete consistente

- Modelos com `deleted_at` devem filtrar registros operacionais ativos com `deleted_at = null`:
  - `Agenda`
  - `Reservatorio`
  - `Lote`
  - `SNutritiva`, quando consultada diretamente/operacionalmente
- `Atividade` e `Lotes_Atividades` não possuem `deleted_at` no schema confirmado.

### RNF-04 — Segurança multi-tenant

- Todos os dados retornados devem respeitar `contaId` e vínculos de conta disponíveis nos modelos.
- Dados de outra conta não podem vazar por relações indiretas.

### RNF-05 — Degradação segura

- Ausência de reservatórios, solução nutritiva, lotes, usuários ou anotações deve resultar em payload válido com arrays vazios, zeros ou campos nullable conforme contrato.

---

## 5) Contrato GraphQL para frontend

> Nomes e tipos escalares devem seguir o padrão Nexus/GraphQL existente do projeto. Datas são serializadas como `String` no contrato desta feature.

```graphql
type HomeInfoContext {
  todayCultivation: HomeTodayCultivationInfo
  reservoirReport: HomeReservoirReport
  dayProgress: HomeDayProgress
  fieldNotesSummary: HomeFieldNotesSummary
}

type HomeTodayCultivationInfo {
  tasksToday: Int
  overdueTasks: Int
  activeLots: Int
  upcomingHarvests: Int
  alerts: [HomeInfoAlert]
  nextTasks: [HomeInfoTask]
}

type HomeReservoirReport {
  totalReservoirs: Int
  totalVolume: Float
  reservoirsWithSolution: Int
  reservoirsWithoutSolution: Int
  activeLotsLinked: Int
  highlightedReservoirs: [HomeReservoirSummary]
}

type HomeReservoirSummary {
  id: Int
  name: String
  volume: Float
  solutionName: String
  electricalConductivity: Float
  linkedLotsCount: Int
}

type HomeDayProgress {
  totalTasksToday: Int
  completedTasksToday: Int
  pendingTasksToday: Int
  overdueTasks: Int
  nextTask: HomeInfoTask
  completionLabel: String
}

type HomeFieldNotesSummary {
  totalRecentNotes: Int
  latestNotes: [HomeFieldNoteSummary]
}

type HomeFieldNoteSummary {
  id: Int
  title: String
  description: String
  lotId: Int
  lotName: String
  userName: String
  createdAt: String
}

type HomeInfoTask {
  id: Int
  title: String
  description: String
  lotId: Int
  lotName: String
  date: String
  overdue: Boolean
}

type HomeInfoAlert {
  type: String
  message: String
  lotId: Int
  lotName: String
  severity: String
  date: String
}
```

### Observações de contrato

- O schema GraphQL segue o padrão nullable do projeto em Nexus; o resolver deve retornar defaults não nulos para blocos, listas e contadores quando possível.
- `description`, `lotId`, `lotName`, `userName`, `solutionName`, `electricalConductivity`, `volume`, `date` em alertas e `nextTask` podem ser nullable conforme disponibilidade dos dados.
- `tasksToday`, `overdueTasks` e `upcomingHarvests` em `todayCultivation` são contadores para manter aderência ao contrato solicitado; listas detalhadas devem ficar em `alerts` e `nextTasks`.
- `latestNotes` deve retornar até 5 itens.

---

## 6) Critérios de aceite testáveis

1. **WHEN** `homeDashboard(contaId)` é consultada selecionando `infoContext`  
   **THEN** a resposta inclui `todayCultivation`, `reservoirReport`, `dayProgress` e `fieldNotesSummary`.

2. **WHEN** a conta possui tarefas, atrasos, lotes ativos, colheitas próximas e alertas já refletidos na Home atual  
   **THEN** `todayCultivation` retorna valores coerentes com os dados existentes da Home.

3. **WHEN** a conta possui reservatórios ativos com e sem solução nutritiva  
   **THEN** `reservoirReport` retorna totais, volume, contagem com/sem solução e destaques com `solutionName` e `electricalConductivity` quando disponíveis.

4. **WHEN** há lotes ativos vinculados a reservatórios  
   **THEN** `reservoirReport.activeLotsLinked` conta apenas lotes com `ativo = true` e `deleted_at = null`.

5. **WHEN** há agendas de hoje finalizadas e pendentes  
   **THEN** `dayProgress` diferencia `completedTasksToday` e `pendingTasksToday` por `Agenda.finalizado`.

6. **WHEN** há agendas atrasadas não finalizadas  
   **THEN** `dayProgress.overdueTasks` e `todayCultivation.overdueTasks` refletem essas agendas sem incluir soft-deletadas.

7. **WHEN** há atividade vinculada a lote via `Lotes_Atividades`  
   **THEN** `fieldNotesSummary.latestNotes` retorna a anotação com `lotId`, `lotName` e `userName` quando disponíveis.

8. **WHEN** há mais de 5 anotações elegíveis  
   **THEN** `latestNotes` retorna somente as 5 mais recentes por `Atividade.created_at` desc.

9. **WHEN** a conta não possui dados para algum bloco  
   **THEN** o bloco retorna arrays vazios, zeros ou `null` em campos nullable, sem erro de execução.

10. **WHEN** registros possuem `deleted_at` preenchido em modelos com soft delete  
    **THEN** eles não entram nas agregações operacionais do `infoContext`.

---

## 7) Open questions que precisam de clarificação

1. `totalRecentNotes` deve contar todas as anotações recentes em uma janela temporal específica ou apenas a quantidade retornada em `latestNotes`?
2. Qual deve ser a janela exata para “colheitas próximas” se a Home atual não tiver uma regra já consolidada?
3. Quais valores fechados o frontend espera para `HomeInfoAlert.type` e `HomeInfoAlert.severity`?
4. `HomeDashboard.infoContext` deve permanecer nullable para tolerar falhas parciais futuras?
5. A autorização de `contaId` já é garantida em `homeDashboard` ou a implementação deve reforçar essa validação no serviço?
