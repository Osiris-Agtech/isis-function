const { objectType, inputObjectType } = require('@nexus/schema')

const RelatorioCicloFiltros = inputObjectType({
  name: 'RelatorioCicloFiltros',
  definition(t) {
    t.string('dataInicio')
    t.string('dataFim')
    t.list.int('culturaIds')
    t.list.int('setorIds')
    t.list.int('areaIds')
  }
})

const CicloLoteDetalhe = objectType({
  name: 'CicloLoteDetalhe',
  definition(t) {
    t.int('loteId')
    t.string('loteNome')
    t.string('semeaduraData')
    t.string('transplantioData')
    t.string('colheitaData')
    t.int('duracaoRealDias')
    t.int('duracaoPlanejadaDias')
    t.int('desvioDias')
    t.float('desvioPercentual')
    t.string('setorNome')
    t.string('areaNome')
  }
})

const CicloRankingCultura = objectType({
  name: 'CicloRankingCultura',
  definition(t) {
    t.int('culturaId')
    t.string('culturaNome')
    t.int('totalLotes')
    t.float('duracaoRealMedia')
    t.float('duracaoPlanejadaMedia')
    t.float('desvioMedioDias')
    t.float('desvioMedioPercentual')
    t.float('desvioMaxDias')
    t.float('desvioMinDias')
    t.list.field('lotes', { type: 'CicloLoteDetalhe' })
  }
})

const RelatorioCicloResult = objectType({
  name: 'RelatorioCicloResult',
  definition(t) {
    t.list.field('culturas', { type: 'CicloRankingCultura' })
    t.int('totalLotes')
    t.float('desvioMedioGeral')
    t.string('periodoInicio')
    t.string('periodoFim')
  }
})

module.exports = {
  RelatorioCicloFiltros,
  CicloLoteDetalhe,
  CicloRankingCultura,
  RelatorioCicloResult,
}
