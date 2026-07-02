function startOfDay(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function dateOnly(value) {
  return value ? new Date(value).toISOString().split('T')[0] : null
}

function dateTimeString(value) {
  return value ? new Date(value).toISOString() : null
}

function toNumber(value) {
  return value == null ? null : Number(value)
}

function mapAgendaToTask(agenda, referenceDay) {
  const activeLot = agenda.lote && agenda.lote.deleted_at == null

  return {
    id: agenda.id,
    title: agenda.titulo || 'Sem título',
    description: agenda.descricao || null,
    lotId: activeLot ? agenda.fk_lote_id || null : null,
    lotName: activeLot ? agenda.lote.nome || null : null,
    date: dateOnly(agenda.data),
    overdue: agenda.data ? new Date(agenda.data) < referenceDay : false,
  }
}

function mapExistingAlert(alert) {
  return {
    type: alert.tipo || 'alerta',
    message: alert.mensagem || '',
    lotId: alert.loteId || null,
    lotName: alert.loteNome || null,
    severity: alert.gravidade || 'media',
    date: alert.data || null,
  }
}

function buildCompletionLabel(completedTasksToday, totalTasksToday) {
  if (totalTasksToday === 0) {
    return 'Nenhuma tarefa para hoje'
  }

  return `${completedTasksToday}/${totalTasksToday} tarefas concluídas hoje`
}

async function buildHomeInfoContext({ prisma, contaId, referenceDate = new Date(), existingHomeData = {} }) {
  const todayStart = startOfDay(referenceDate)
  const tomorrowStart = addDays(todayStart, 1)
  const sevenDaysEnd = addDays(todayStart, 7)

  const [tasksToday, overdueTasks, nextTasks, reservoirs, fieldNotes] = await Promise.all([
    prisma.agenda.findMany({
      where: {
        fk_conta_id: contaId,
        deleted_at: null,
        data: { gte: todayStart, lt: tomorrowStart },
      },
      include: {
        lote: { select: { id: true, nome: true, deleted_at: true } },
      },
      orderBy: { data: 'asc' },
    }),
    prisma.agenda.findMany({
      where: {
        fk_conta_id: contaId,
        deleted_at: null,
        finalizado: false,
        data: { lt: todayStart },
      },
      include: {
        lote: { select: { id: true, nome: true, deleted_at: true } },
      },
      orderBy: { data: 'asc' },
    }),
    prisma.agenda.findMany({
      where: {
        fk_conta_id: contaId,
        deleted_at: null,
        finalizado: false,
        data: { gte: todayStart },
      },
      include: {
        lote: { select: { id: true, nome: true, deleted_at: true } },
      },
      orderBy: { data: 'asc' },
      take: 5,
    }),
    prisma.reservatorio.findMany({
      where: {
        fk_contas_id: contaId,
        deleted_at: null,
      },
      include: {
        solucao: { select: { nome: true, c_eletrica: true, deleted_at: true } },
        lotes: {
          where: {
            ativo: true,
            deleted_at: null,
          },
          select: { id: true },
        },
      },
      orderBy: [
        { nome: 'asc' },
        { id: 'asc' },
      ],
    }),
    prisma.lotes_Atividades.findMany({
      where: {
        fk_contas_id: contaId,
        atividade: { fk_contas_id: contaId },
        lote: { deleted_at: null },
      },
      include: {
        atividade: { select: { id: true, nome: true, descricao: true, created_at: true } },
        lote: { select: { id: true, nome: true, deleted_at: true } },
        usuario: { select: { nome: true } },
      },
      orderBy: { atividade: { created_at: 'desc' } },
      take: 5,
    }),
  ])

  const totalTasksToday = tasksToday.length
  const completedTasksToday = tasksToday.filter((task) => task.finalizado === true).length
  const pendingTasksToday = totalTasksToday - completedTasksToday
  const overdueTasksCount = overdueTasks.length
  const activeLots = Array.isArray(existingHomeData.lotes)
    ? existingHomeData.lotes.filter((lote) => lote.ativo === true && lote.deleted_at == null).length
    : 0
  const upcomingHarvests = Array.isArray(existingHomeData.lotesColheitaProximaList)
    ? existingHomeData.lotesColheitaProximaList.length
    : 0

  const highlightedReservoirs = reservoirs.slice(0, 5).map((reservoir) => {
    const activeSolution = reservoir.solucao && reservoir.solucao.deleted_at == null

    return {
      id: reservoir.id,
      name: reservoir.nome || 'Sem nome',
      volume: toNumber(reservoir.volume),
      solutionName: activeSolution ? reservoir.solucao.nome || null : null,
      electricalConductivity: activeSolution ? toNumber(reservoir.solucao.c_eletrica) : null,
      linkedLotsCount: reservoir.lotes.length,
    }
  })

  const reservoirReport = {
    totalReservoirs: reservoirs.length,
    totalVolume: reservoirs.reduce((sum, reservoir) => sum + (toNumber(reservoir.volume) || 0), 0),
    reservoirsWithSolution: reservoirs.filter((reservoir) => reservoir.fk_solucoes_id && reservoir.solucao?.deleted_at == null).length,
    reservoirsWithoutSolution: reservoirs.filter((reservoir) => !reservoir.fk_solucoes_id || reservoir.solucao?.deleted_at != null).length,
    activeLotsLinked: reservoirs.reduce((sum, reservoir) => sum + reservoir.lotes.length, 0),
    highlightedReservoirs,
  }

  const nextTask = tasksToday.find((task) => task.finalizado === false && task.data && new Date(task.data) >= referenceDate)
    || tasksToday.find((task) => task.finalizado === false)
    || null

  return {
    todayCultivation: {
      tasksToday: totalTasksToday,
      overdueTasks: overdueTasksCount,
      activeLots,
      upcomingHarvests,
      alerts: Array.isArray(existingHomeData.alertasCritico)
        ? existingHomeData.alertasCritico.map(mapExistingAlert)
        : [],
      nextTasks: nextTasks.map((task) => mapAgendaToTask(task, todayStart)),
    },
    reservoirReport,
    dayProgress: {
      totalTasksToday,
      completedTasksToday,
      pendingTasksToday,
      overdueTasks: overdueTasksCount,
      nextTask: nextTask ? mapAgendaToTask(nextTask, todayStart) : null,
      completionLabel: buildCompletionLabel(completedTasksToday, totalTasksToday),
    },
    fieldNotesSummary: {
      totalRecentNotes: fieldNotes.length,
      latestNotes: fieldNotes.map((note) => ({
        id: note.id,
        title: note.atividade?.nome || 'Sem título',
        description: note.atividade?.descricao || null,
        lotId: note.lote && note.lote.deleted_at == null ? note.lote.id : null,
        lotName: note.lote && note.lote.deleted_at == null ? note.lote.nome || null : null,
        userName: note.usuario?.nome || null,
        createdAt: dateTimeString(note.atividade?.created_at),
      })),
    },
  }
}

module.exports = {
  buildHomeInfoContext,
}
