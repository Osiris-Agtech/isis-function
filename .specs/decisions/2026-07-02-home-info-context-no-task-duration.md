# Decisão: não expor duração/tempo gasto em tarefas no `home-info-context-api`

- **Data:** 2026-07-02
- **Status:** Aceita para a spec
- **Feature:** `home-info-context-api`

---

## 1) Contexto: por que esta decisão existe

A Home adaptativa do app `osi-solucoes` precisa exibir progresso do dia dentro de `homeDashboard(contaId).infoContext.dayProgress`. Durante o levantamento do schema Prisma atual, o modelo `Agenda` possui campos como `data` e `finalizado`, mas não possui campos confiáveis para medir execução real de tarefa, como `started_at`, `completed_at` ou `duration_minutes`.

Expor tempo gasto ou duração a partir dos dados atuais exigiria inferência frágil, potencialmente enganosa para o usuário e difícil de validar.

---

## 2) Goals e Non-Goals

### Goals

1. Evitar contrato GraphQL que prometa métrica sem origem confiável no banco.
2. Manter `dayProgress` baseado em dados verificáveis: total, finalizadas, pendentes, atrasadas e próxima tarefa.
3. Registrar explicitamente a razão da ausência de tempo/duração para evitar reintrodução acidental.

### Non-Goals

1. Criar campos novos no schema Prisma.
2. Implementar tracking de início/fim de tarefas.
3. Estimar duração com base em heurísticas, `updated_at` ou diferença entre datas sem semântica de execução.

---

## 3) Technical approach e decisão tomada

Foi decidido que `HomeDayProgress` não incluirá campos de duração, tempo gasto, tempo estimado, `startedAt`, `completedAt` ou similares nesta feature.

O contrato deve se limitar a:

- `totalTasksToday`
- `completedTasksToday`
- `pendingTasksToday`
- `overdueTasks`
- `nextTask`
- `completionLabel`

`completionLabel` pode comunicar progresso por quantidade, mas não deve sugerir duração real ou economia de tempo.

---

## 4) Data structures ou interfaces envolvidas

### Modelo Prisma relevante

- `Agenda.data`: data planejada da tarefa.
- `Agenda.finalizado`: status de conclusão.
- `Agenda.created_at` / `Agenda.updated_at`: metadados de registro, não representam início/fim real de execução.

### Contrato GraphQL impactado

```graphql
type HomeDayProgress {
  totalTasksToday: Int!
  completedTasksToday: Int!
  pendingTasksToday: Int!
  overdueTasks: Int!
  nextTask: HomeInfoTask
  completionLabel: String!
}
```

---

## 5) Alternativas descartadas

1. **Usar `updated_at - created_at` como duração**
   - Descartado porque mede ciclo de vida do registro, não execução da tarefa.

2. **Usar `Agenda.data` como início ou conclusão**
   - Descartado porque representa agendamento, não execução real.

3. **Adicionar campos novos ao banco nesta feature**
   - Descartado porque o requisito explícito é não alterar schema DB e a feature atual é aditiva na API.

4. **Retornar duração como `null`**
   - Descartado porque cria expectativa de suporte futuro no contrato sem necessidade atual.

---

## 6) Acceptance criteria

1. `HomeDayProgress` não possui campos de duração/tempo gasto.
2. `homeDashboard(contaId).infoContext.dayProgress` diferencia tarefas por quantidade e status, não por tempo.
3. Nenhuma implementação desta feature usa `created_at`/`updated_at` como proxy de duração.
4. Documentação da feature aponta esta decisão como justificativa para a ausência de métricas temporais.

---

## 7) Open questions que precisam de clarificação

1. Em uma feature futura, o produto precisará rastrear início/fim real de tarefas?
2. Caso seja necessário no futuro, a medição deve ser manual pelo usuário, automática por evento de status, ou ambas?
3. O frontend deve exibir apenas percentual/contagem de conclusão ou uma mensagem textual sem percentual?
