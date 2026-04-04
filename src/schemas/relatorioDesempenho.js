const { objectType, inputObjectType } = require('@nexus/schema')

const RelatorioDesempenhoFiltros = inputObjectType({
  name: 'RelatorioDesempenhoFiltros',
  definition(t) {
    t.string('dataInicio')
    t.string('dataFim')
    t.list.int('usuarioIds')
  }
})

const DesempenhoAtividadeItem = objectType({
  name: 'DesempenhoAtividadeItem',
  definition(t) {
    t.int('atividadeId')
    t.string('atividadeNome')
    t.int('loteId')
    t.string('loteNome')
  }
})

const DesempenhoAgendaItem = objectType({
  name: 'DesempenhoAgendaItem',
  definition(t) {
    t.int('agendaId')
    t.string('titulo')
    t.string('data')
    t.boolean('finalizado')
    t.boolean('vencida')
  }
})

const DesempenhoUsuarioRanking = objectType({
  name: 'DesempenhoUsuarioRanking',
  definition(t) {
    t.int('usuarioId')
    t.string('usuarioNome')
    t.int('totalAtividades')
    t.int('totalAgendas')
    t.int('agendasFinalizadas')
    t.int('agendasNoPrazo')
    t.float('taxaConclusao')
    t.float('taxaPrazo')
    t.list.field('ultimasAtividades', { type: 'DesempenhoAtividadeItem' })
    t.list.field('agendasPendentes', { type: 'DesempenhoAgendaItem' })
  }
})

const RelatorioDesempenhoResult = objectType({
  name: 'RelatorioDesempenhoResult',
  definition(t) {
    t.list.field('usuarios', { type: 'DesempenhoUsuarioRanking' })
    t.int('totalUsuarios')
    t.float('taxaConclusaoMedia')
    t.string('periodoInicio')
    t.string('periodoFim')
  }
})

module.exports = {
  RelatorioDesempenhoFiltros,
  DesempenhoAtividadeItem,
  DesempenhoAgendaItem,
  DesempenhoUsuarioRanking,
  RelatorioDesempenhoResult,
}
