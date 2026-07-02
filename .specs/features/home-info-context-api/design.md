# Design: `home-info-context-api`

- **Repo:** `isis`
- **Path:** `.specs/features/home-info-context-api/design.md`
- **Status:** Proposto
- **Última atualização:** 2026-07-02

---

## 1) Contexto: por que este desenho existe

A query `homeDashboard(contaId)` precisa oferecer um bloco `infoContext` para a Home adaptativa do app `osi-solucoes`. O código atual concentra a query em `src/schemas/query.js`, arquivo monolítico com lógica inline, enquanto `src/schemas/homeDashboard.js` contém apenas tipos Nexus de Home.

O desenho recomenda adicionar tipos GraphQL no arquivo de tipos da Home e concentrar a composição de dados em um serviço dedicado, evitando aumentar o acoplamento e o tamanho de `src/schemas/query.js`.

---

## 2) Goals e Non-Goals

### Goals

1. Definir os tipos GraphQL/Nexus necessários para `infoContext`.
2. Mapear cada campo para origem de dados Prisma confirmada.
3. Orientar uma arquitetura com boundary claro entre resolver GraphQL e composição de dados.
4. Documentar fallbacks seguros para dados ausentes.
5. Reduzir risco de N+1 e acoplamento no resolver monolítico.

### Non-Goals

1. Implementar código da API nesta etapa.
2. Alterar schema Prisma ou criar migrations.
3. Redefinir o contrato de `homeDashboard` fora da adição de `infoContext`.
4. Criar um sistema genérico de analytics ou métricas da Home.

---

## 3) Technical approach e decisões de design

### 3.1 Arquitetura recomendada

Arquitetura recomendada:

1. `src/schemas/homeDashboard.js`
   - Adicionar os tipos Nexus:
     - `HomeInfoContext`
     - `HomeTodayCultivationInfo`
     - `HomeReservoirReport`
     - `HomeReservoirSummary`
     - `HomeDayProgress`
     - `HomeFieldNotesSummary`
     - `HomeFieldNoteSummary`
     - `HomeInfoTask`
     - `HomeInfoAlert`
   - Adicionar `infoContext` ao tipo de retorno de `homeDashboard`, conforme padrão atual do projeto.

2. `src/services/homeInfoContextService.js` ou extração equivalente
   - Centralizar consultas Prisma e transformação para DTO.
   - Receber `contaId`, `prisma`/contexto e data de referência opcional para testabilidade.
   - Retornar objeto no shape de `HomeInfoContext`.

3. `src/schemas/query.js`
   - Manter o resolver como orquestrador fino.
   - Reaproveitar dados já calculados na Home atual quando disponíveis.
   - Delegar cálculo adicional ao serviço, evitando inserir blocos substanciais de lógica no arquivo monolítico.

### 3.2 Boundary do serviço

Interface conceitual:

```ts
buildHomeInfoContext({ contaId, prisma, referenceDate, existingHomeData }) => HomeInfoContext
```

Responsabilidades do serviço:

- Construir `todayCultivation` a partir de dados já existentes ou queries mínimas adicionais.
- Construir `reservoirReport` com agregações de reservatórios e lotes vinculados.
- Construir `dayProgress` a partir de `Agenda`.
- Construir `fieldNotesSummary` a partir de `Lotes_Atividades` + `Atividade`.
- Aplicar filtros `deleted_at = null` onde aplicável.
- Definir valores default vazios.

Responsabilidades fora do serviço:

- Definição de tipos GraphQL/Nexus.
- Autenticação/autorização já padronizada no resolver/contexto.
- Serialização GraphQL final.

### 3.3 Decisões de fallback

- Sem tarefas: listas vazias, contadores zero, `nextTask = null`, `completionLabel` indicando ausência de tarefas ou 0/0 conforme padrão de UX definido.
- Sem reservatórios: `totalReservoirs = 0`, `totalVolume = 0`, contadores zero, `highlightedReservoirs = []`.
- Reservatório sem solução: `solutionName = null`, `electricalConductivity = null`.
- Sem lotes vinculados: `linkedLotsCount = 0`, `activeLotsLinked = 0`.
- Sem usuário vinculado em anotação: `userName = null`.
- Sem lote vinculado em anotação por inconsistência relacional: `lotId = null`, `lotName = null`.
- Campos textuais opcionais ausentes: `description = null`.

---

## 4) Data structures / interfaces envolvidas

### 4.1 Tipos GraphQL obrigatórios

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

### 4.2 Origem dos dados Prisma

| Bloco | Campo | Origem Prisma | Filtros/Regras |
|---|---|---|---|
| `todayCultivation` | `tasksToday` | `Agenda` | contador com `fk_conta_id = contaId`, `deleted_at = null`, `data` no dia de referência |
| `todayCultivation` | `overdueTasks` | `Agenda` | contador com `data < início do dia`, `finalizado = false`, `deleted_at = null` |
| `todayCultivation` | `activeLots` | `Lote` | `ativo = true`, `deleted_at = null`, conta por vínculo disponível |
| `todayCultivation` | `upcomingHarvests` | `Lote.colheita_data` | contador com `deleted_at = null`, janela a confirmar ou reaproveitar regra atual |
| `todayCultivation` | `alerts` | `Agenda.alerta` e/ou dados existentes da Home | Reaproveitar regra atual; filtrar soft-deleted |
| `todayCultivation` | `nextTasks` | `Agenda` | pendentes futuras/hoje, ordenadas por `data` asc |
| `reservoirReport` | totais/volume | `Reservatorio` | `fk_contas_id = contaId`, `deleted_at = null` |
| `reservoirReport` | solução | `Reservatorio.solucao` → `SNutritiva` | incluir `nome`, `c_eletrica`; respeitar `deleted_at` se aplicável |
| `reservoirReport` | lotes vinculados | `Reservatorio.lotes` → `Lote` | `ativo = true`, `deleted_at = null` |
| `dayProgress` | contadores | `Agenda` | `data` no dia, `deleted_at = null` |
| `dayProgress` | atrasadas | `Agenda` | `data < início do dia`, `finalizado = false`, `deleted_at = null` |
| `dayProgress` | próxima pendente | `Agenda` | hoje, `finalizado = false`, `data >= agora` quando aplicável, ordenada por `data` asc |
| `fieldNotesSummary` | últimas notas | `Lotes_Atividades` + `Atividade` | ordenar por `Atividade.created_at` desc, limitar 5 |
| `fieldNotesSummary` | lote | `Lotes_Atividades.lote` | incluir quando disponível, filtrar lote `deleted_at = null` em leitura operacional |
| `fieldNotesSummary` | usuário | `Lotes_Atividades.usuario` | incluir `Usuario.nome` quando disponível |

### 4.3 Campos Prisma confirmados relevantes

- `Agenda`: `id`, `titulo`, `descricao`, `alerta`, `ativo`, `finalizado`, `data`, `deleted_at`, `fk_conta_id`, `fk_lote_id`, `fk_usuarios_id`.
- `Reservatorio`: `id`, `nome`, `volume`, `fk_solucoes_id`, `fk_contas_id`, `deleted_at`.
- `SNutritiva`: `id`, `nome`, `c_eletrica`, `deleted_at`.
- `Lote`: `id`, `nome`, `ativo`, `colheita_data`, `fk_reservatorios_id`, `deleted_at`.
- `Atividade`: `id`, `nome`, `descricao`, `created_at`, `fk_contas_id`.
- `Lotes_Atividades`: `id`, `fk_lotes_id`, `fk_atividades_id`, `fk_usuarios_id`, `fk_contas_id`.
- `Usuario`: `id`, `nome`, `email`, `ativo`.

---

## 5) Riscos de acoplamento e N+1

### Risco 1 — Crescimento de `src/schemas/query.js`

- **Problema:** arquivo já é monolítico e concentra lógica inline.
- **Mitigação:** resolver deve chamar serviço dedicado; lógica de agregação fica fora do schema.

### Risco 2 — N+1 em reservatórios/lotes/solução

- **Problema:** consultar lotes ou solução por reservatório individualmente escala mal.
- **Mitigação:** buscar reservatórios com relações necessárias em uma consulta Prisma controlada ou usar agregações separadas agrupadas por ID.

### Risco 3 — N+1 em anotações por lote/usuário

- **Problema:** buscar lote e usuário para cada vínculo `Lotes_Atividades` individualmente.
- **Mitigação:** consultar `Lotes_Atividades` com includes de `atividade`, `lote` e `usuario`, ou consulta equivalente com seleção explícita.

### Risco 4 — Dados duplicados em anotações

- **Problema:** uma mesma `Atividade` pode aparecer em múltiplos vínculos de lote.
- **Decisão:** retornar por vínculo lote-atividade para preservar contexto do lote, mesmo que a atividade se repita com lotes diferentes.

### Risco 5 — Métricas sem dados confiáveis

- **Problema:** o schema não possui `started_at`, `completed_at` ou `duration_minutes`.
- **Mitigação:** não expor tempo de execução/duração; decisão registrada em `.specs/decisions/2026-07-02-home-info-context-no-task-duration.md`.

---

## 6) Acceptance criteria de design

1. Tipos Nexus correspondem ao contrato GraphQL documentado em `spec.md`.
2. `query.js` recebe apenas integração fina com `infoContext`, sem nova lógica substancial inline.
3. Serviço dedicado retorna payload completo com defaults seguros.
4. Consultas Prisma filtram `deleted_at = null` nos modelos aplicáveis.
5. Consultas de reservatórios e anotações não executam uma query por item.
6. `fieldNotesSummary.latestNotes` retorna até 5 vínculos lote-atividade ordenados por `Atividade.created_at` desc.
7. Nenhum campo de duração/tempo gasto é criado ou retornado.

---

## 7) Open questions que precisam de clarificação

1. Qual regra exata de janela de “colheitas próximas” deve ser usada se a Home atual não tiver implementação reutilizável?
2. `completionLabel` deve ser formatado no backend em português ou o backend deve retornar apenas dados numéricos e uma chave semântica?
3. A lista `highlightedReservoirs` deve ter limite fixo? Se sim, 3, 5 ou todos?
4. `severity` e `type` de alertas devem ser enums GraphQL ou strings por compatibilidade com padrões atuais?
5. Como o projeto padroniza datas de início/fim do dia: timezone do servidor, timezone da conta ou UTC?
