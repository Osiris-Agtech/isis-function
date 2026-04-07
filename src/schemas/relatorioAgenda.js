const { objectType, inputObjectType } = require('@nexus/schema')

const RelatorioAgendaFiltros = inputObjectType({
  name: 'RelatorioAgendaFiltros',
  definition(t) {
    t.int('diasAVencer')
    t.list.int('usuarioIds')
    t.list.int('loteIds')
    t.boolean('apenasComAlerta')
  }
})

const AgendaTarefaItem = objectType({
  name: 'AgendaTarefaItem',
  definition(t) {
    t.int('id')
    t.string('titulo')
    t.string('descricao')
    t.string('data')
    t.boolean('alerta')
    t.int('usuarioId')
    t.string('usuarioNome')
    t.int('loteId')
    t.string('loteNome')
    t.string('setorNome')
  }
})

const AgendaLoteTaxaConclusao = objectType({
  name: 'AgendaLoteTaxaConclusao',
  definition(t) {
    t.int('loteId')
    t.string('loteNome')
    t.string('setorNome')
    t.int('totalTarefas')
    t.int('tarefasConcluidas')
    t.int('tarefasVencidas')
    t.float('taxaConclusao')
  }
})

const RelatorioAgendaResult = objectType({
  name: 'RelatorioAgendaResult',
  definition(t) {
    t.int('diasAVencer')
    t.string('geradoEm')
    t.list.field('tarefasVencidas', { type: 'AgendaTarefaItem' })
    t.list.field('tarefasAVencer', { type: 'AgendaTarefaItem' })
    t.list.field('lotesComTaxaConclusao', { type: 'AgendaLoteTaxaConclusao' })
  }
})

module.exports = {
  RelatorioAgendaFiltros,
  AgendaTarefaItem,
  AgendaLoteTaxaConclusao,
  RelatorioAgendaResult,
}
