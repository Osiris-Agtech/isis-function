const { objectType, intArg, nonNull } = require('@nexus/schema')

const HomeResumo = objectType({
  name: 'HomeResumo',
  definition(t) {
    t.int('totalLotes')
    t.int('lotesAtivos')
    t.int('lotesFinalizados')
    t.float('taxaConclusao')
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
  HomeDashboard
}
