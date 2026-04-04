const { objectType, intArg, nonNull } = require('@nexus/schema')

const HomeResumo = objectType({
  name: 'HomeResumo',
  definition(t) {
    t.int('totalLotes')
    t.int('lotesAtivos')
    t.int('lotesFinalizados')
    t.float('taxaConclusao')
  }
})

const HomeTarefas = objectType({
  name: 'HomeTarefas',
  definition(t) {
    t.int('pendentesHoje')
    t.int('pendentesSemana')
    t.int('atrasadas')
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
  }
})

const HomeCultura = objectType({
  name: 'HomeCultura',
  definition(t) {
    t.string('nome')
    t.int('quantidade')
  }
})

const HomeDashboard = objectType({
  name: 'HomeDashboard',
  definition(t) {
    t.field('resumo', { type: 'HomeResumo' })
    t.field('tarefas', { type: 'HomeTarefas' })
    t.field('producao', { type: 'HomeProducao' })
    t.list.field('culturas', { type: 'HomeCultura' })
  }
})

module.exports = {
  HomeResumo,
  HomeTarefas,
  HomeProducao,
  HomeCultura,
  HomeDashboard
}
