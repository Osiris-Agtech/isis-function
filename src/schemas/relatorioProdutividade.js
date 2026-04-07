const { objectType, inputObjectType } = require('@nexus/schema')

const RelatorioProdutividadeFiltros = inputObjectType({
  name: 'RelatorioProdutividadeFiltros',
  definition(t) {
    t.string('dataInicio')
    t.string('dataFim')
    t.list.int('setorIds')
    t.list.int('areaIds')
    t.list.int('culturaIds')
  }
})

const ProdutividadeAreaDetalhe = objectType({
  name: 'ProdutividadeAreaDetalhe',
  definition(t) {
    t.int('areaId')
    t.string('areaNome')
    t.int('totalLotes')
    t.int('totalBandejasSemeadas')
    t.int('totalMudasTransplantadas')
    t.int('totalPlantasColhidas')
    t.int('totalEmbalagensProduzidas')
    t.float('taxaGerminacao')
    t.float('taxaTransplantio')
    t.float('taxaEmbalagem')
    t.float('taxaGlobal')
  }
})

const ProdutividadeSetorRanking = objectType({
  name: 'ProdutividadeSetorRanking',
  definition(t) {
    t.int('setorId')
    t.string('setorNome')
    t.string('areaNome')
    t.int('totalLotes')
    t.int('totalBandejasSemeadas')
    t.int('totalMudasTransplantadas')
    t.int('totalPlantasColhidas')
    t.int('totalEmbalagensProduzidas')
    t.float('taxaGerminacao')
    t.float('taxaTransplantio')
    t.float('taxaEmbalagem')
    t.float('taxaGlobal')
    t.list.field('areas', { type: 'ProdutividadeAreaDetalhe' })
  }
})

const RelatorioProdutividadeResult = objectType({
  name: 'RelatorioProdutividadeResult',
  definition(t) {
    t.list.field('setores', { type: 'ProdutividadeSetorRanking' })
    t.int('totalLotes')
    t.float('taxaGlobalMedia')
    t.string('periodoInicio')
    t.string('periodoFim')
  }
})

module.exports = {
  RelatorioProdutividadeFiltros,
  ProdutividadeAreaDetalhe,
  ProdutividadeSetorRanking,
  RelatorioProdutividadeResult,
}
