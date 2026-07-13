const { objectType, intArg, nonNull } = require('@nexus/schema')
const { buildHomeInfoContext } = require('../services/homeInfoContextService')

const HomeResumo = objectType({
  name: 'HomeResumo',
  definition(t) {
    t.int('totalLotes')
    t.int('lotesAtivos')
    t.int('lotesFinalizados')
    t.float('taxaConclusao')
    t.nonNull.int('lotesAtivosComProtocolo')
    t.nonNull.boolean('hasActiveLotWithProtocol')
    t.nonNull.list.nonNull.int('activeLotProtocolIds')
    // Novos campos
    t.list.field('lotesPorStatus', { type: 'HomeLoteStatus' })
    t.int('lotesComColheitaProxima')
    t.list.field('especiesEmAndamento', { type: 'HomeEspecieDetalhe' })
  }
})

const HomeTarefas = objectType({
  name: 'HomeTarefas',
  definition(t) {
    t.int('pendentesHoje')
    t.int('pendentesSemana')
    t.int('atrasadas')
    // Novos campos
    t.field('porVencimento', { type: 'HomeTarefasPorVencimento' })
    t.field('porPrioridade', { type: 'HomeTarefasPorPrioridade' })
    t.list.field('ultimasTarefas', { type: 'HomeTarefaDetalhe' })
  }
})

const HomeProducao = objectType({
  name: 'HomeProducao',
  definition(t) {
    t.int('totalPlantasColhidas')
    t.int('totalEmbalagensProduzidas')
    t.int('lotesComColheitaProxima')
    t.string('periodoInicio')
    t.string('periodoFim')
    // Novos campos
    t.list.field('producaoMensal', { type: 'HomeProducaoMensal' })
    t.field('taxasMedia', { type: 'HomeTaxasMedia' })
    t.field('comparativoPeriodo', { type: 'HomeComparativoPeriodo' })
    t.field('culturaMaisProducao', { type: 'HomeCulturaDestaque' })
  }
})

const HomeCultura = objectType({
  name: 'HomeCultura',
  definition(t) {
    t.string('nome')
    t.int('quantidade')
    t.string('cor')
  }
})

// NOVO: Detalhe de status de lote
const HomeLoteStatus = objectType({
  name: 'HomeLoteStatus',
  definition(t) {
    t.string('status')
    t.int('quantidade')
    t.string('cor')
  }
})

// NOVO: Espécie em detalhe
const HomeEspecieDetalhe = objectType({
  name: 'HomeEspecieDetalhe',
  definition(t) {
    t.string('nome')
    t.float('percentual')
    t.string('status')
  }
})

// NOVO: Produção mensal
const HomeProducaoMensal = objectType({
  name: 'HomeProducaoMensal',
  definition(t) {
    t.string('mes')
    t.float('quantidade')
  }
})

// NOVO: Taxas médias de produtividade
const HomeTaxasMedia = objectType({
  name: 'HomeTaxasMedia',
  definition(t) {
    t.float('taxaGerminacao')
    t.float('taxaTransplantio')
    t.float('taxaEmbalagem')
    t.float('taxaGlobal')
  }
})

// NOVO: Comparativo com período anterior
const HomeComparativoPeriodo = objectType({
  name: 'HomeComparativoPeriodo',
  definition(t) {
    t.int('plantasColhidas')
    t.float('variacaoPercentual')
  }
})

// NOVO: Cultura em destaque
const HomeCulturaDestaque = objectType({
  name: 'HomeCulturaDestaque',
  definition(t) {
    t.string('nome')
    t.int('quantidade')
    t.float('percentualDoTotal')
  }
})

// NOVO: Resumo da equipe
const HomeEquipeResumo = objectType({
  name: 'HomeEquipeResumo',
  definition(t) {
    t.int('membrosAtivos')
    t.float('taxaConclusaoMedia')
    t.int('atividadesNoPrazo')
    t.int('atividadesVencidas')
  }
})

// NOVO: Detalhe de tarefa
const HomeTarefaDetalhe = objectType({
  name: 'HomeTarefaDetalhe',
  definition(t) {
    t.int('id')
    t.string('titulo')
    t.string('loteNome')
    t.string('data')
    t.boolean('vencida')
  }
})

// NOVO: Tarefas por vencimento
const HomeTarefasPorVencimento = objectType({
  name: 'HomeTarefasPorVencimento',
  definition(t) {
    t.int('hoje')
    t.int('estaSemana')
    t.int('proximaSemana')
  }
})

// NOVO: Tarefas por prioridade
const HomeTarefasPorPrioridade = objectType({
  name: 'HomeTarefasPorPrioridade',
  definition(t) {
    t.int('alta')
    t.int('media')
    t.int('baixa')
  }
})

// NOVO: Alerta crítico
const HomeAlertaCritico = objectType({
  name: 'HomeAlertaCritico',
  definition(t) {
    t.string('tipo')
    t.string('mensagem')
    t.int('loteId')
    t.string('loteNome')
    t.string('gravidade') // 'alta', 'media', 'baixa'
    t.string('data')
  }
})

const HomeInfoAlert = objectType({
  name: 'HomeInfoAlert',
  definition(t) {
    t.string('type')
    t.string('message')
    t.int('lotId')
    t.string('lotName')
    t.string('severity')
    t.string('date')
  }
})

const HomeInfoTask = objectType({
  name: 'HomeInfoTask',
  definition(t) {
    t.int('id')
    t.string('title')
    t.string('description')
    t.int('lotId')
    t.string('lotName')
    t.string('date')
    t.boolean('overdue')
  }
})

const HomeTodayCultivationInfo = objectType({
  name: 'HomeTodayCultivationInfo',
  definition(t) {
    t.int('tasksToday')
    t.int('overdueTasks')
    t.int('activeLots')
    t.int('upcomingHarvests')
    t.list.field('alerts', { type: 'HomeInfoAlert' })
    t.list.field('nextTasks', { type: 'HomeInfoTask' })
  }
})

const HomeReservoirSummary = objectType({
  name: 'HomeReservoirSummary',
  definition(t) {
    t.int('id')
    t.string('name')
    t.float('volume')
    t.string('solutionName')
    t.float('electricalConductivity')
    t.int('linkedLotsCount')
  }
})

const HomeReservoirReport = objectType({
  name: 'HomeReservoirReport',
  definition(t) {
    t.int('totalReservoirs')
    t.float('totalVolume')
    t.int('reservoirsWithSolution')
    t.int('reservoirsWithoutSolution')
    t.int('activeLotsLinked')
    t.list.field('highlightedReservoirs', { type: 'HomeReservoirSummary' })
  }
})

const HomeDayProgress = objectType({
  name: 'HomeDayProgress',
  definition(t) {
    t.int('totalTasksToday')
    t.int('completedTasksToday')
    t.int('pendingTasksToday')
    t.int('overdueTasks')
    t.field('nextTask', { type: 'HomeInfoTask' })
    t.string('completionLabel')
  }
})

const HomeFieldNoteSummary = objectType({
  name: 'HomeFieldNoteSummary',
  definition(t) {
    t.int('id')
    t.string('title')
    t.string('description')
    t.int('lotId')
    t.string('lotName')
    t.string('userName')
    t.string('createdAt')
  }
})

const HomeFieldNotesSummary = objectType({
  name: 'HomeFieldNotesSummary',
  definition(t) {
    t.int('totalRecentNotes')
    t.list.field('latestNotes', { type: 'HomeFieldNoteSummary' })
  }
})

const HomeInfoContext = objectType({
  name: 'HomeInfoContext',
  definition(t) {
    t.field('todayCultivation', { type: 'HomeTodayCultivationInfo' })
    t.field('reservoirReport', { type: 'HomeReservoirReport' })
    t.field('dayProgress', { type: 'HomeDayProgress' })
    t.field('fieldNotesSummary', { type: 'HomeFieldNotesSummary' })
  }
})

const HomeDashboard = objectType({
  name: 'HomeDashboard',
  definition(t) {
    t.field('resumo', { type: 'HomeResumo' })
    t.field('tarefas', { type: 'HomeTarefas' })
    t.field('producao', { type: 'HomeProducao' })
    t.list.field('culturas', { type: 'HomeCultura' })
    // Novos campos
    t.field('equipe', { type: 'HomeEquipeResumo' })
    t.list.field('alertasCritico', { type: 'HomeAlertaCritico' })
    t.field('infoContext', {
      type: 'HomeInfoContext',
      resolve: (parent, _, ctx) => {
        if (parent.infoContext) {
          return parent.infoContext
        }

        const seed = parent.__homeInfoContextSeed
        if (!seed) {
          return null
        }

        return buildHomeInfoContext({
          prisma: ctx.prisma,
          contaId: seed.contaId,
          referenceDate: new Date(),
          existingHomeData: seed,
        })
      },
    })
  }
})

module.exports = {
  HomeResumo,
  HomeTarefas,
  HomeProducao,
  HomeCultura,
  HomeLoteStatus,
  HomeEspecieDetalhe,
  HomeProducaoMensal,
  HomeTaxasMedia,
  HomeComparativoPeriodo,
  HomeCulturaDestaque,
  HomeEquipeResumo,
  HomeTarefaDetalhe,
  HomeTarefasPorVencimento,
  HomeTarefasPorPrioridade,
  HomeAlertaCritico,
  HomeInfoContext,
  HomeTodayCultivationInfo,
  HomeReservoirReport,
  HomeReservoirSummary,
  HomeDayProgress,
  HomeFieldNotesSummary,
  HomeFieldNoteSummary,
  HomeInfoTask,
  HomeInfoAlert,
  HomeDashboard
}
